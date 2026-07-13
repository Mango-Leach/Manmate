const Appointment = require('../models/Appointment');
const Therapist = require('../models/Therapist');
const User = require('../models/User');
const { getDB } = require('../config/database');
const googleCalendarService = require('../services/googleCalendarService');
const emailService = require('../services/emailService');
const whatsappService = require('../services/whatsappService');
const logger = require('../utils/logger');

const WEEKDAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

// Derive the weekday name from a calendar date string ("YYYY-MM-DD") without
// any timezone dependence. Falls back to UTC interpretation for other formats.
function getCalendarWeekday(date) {
  const str = String(date);
  const match = str.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (match) {
    const utc = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
    return WEEKDAY_NAMES[utc.getUTCDay()];
  }
  return WEEKDAY_NAMES[new Date(date).getUTCDay()];
}
exports.getCalendarWeekday = getCalendarWeekday;

// Atomically deduct a session fee from a client's wallet. Returns true on success,
// false if the balance is insufficient. Also records a debit transaction.
async function chargeWallet(email, amount, description) {
  const db = getDB();
  const users = db.collection('users');
  const result = await users.findOneAndUpdate(
    { email, walletBalance: { $gte: amount } },
    { $inc: { walletBalance: -amount }, $set: { updatedAt: new Date() } },
    { returnDocument: 'after' }
  );
  if (!result) return false;
  await db.collection('transactions').insertOne({
    userEmail: email,
    type: 'debit',
    amount,
    description,
    timestamp: new Date(),
  });
  return true;
}

// Refund a previously-charged session fee back to the client's wallet and record
// a credit transaction. Best-effort; logs on failure.
async function refundWallet(email, amount, description) {
  if (!email || !(amount > 0)) return;
  try {
    const db = getDB();
    await db.collection('users').updateOne(
      { email },
      { $inc: { walletBalance: amount }, $set: { updatedAt: new Date() } }
    );
    await db.collection('transactions').insertOne({
      userEmail: email,
      type: 'credit',
      amount,
      description,
      timestamp: new Date(),
    });
    logger.info(`💰 Refunded ₹${amount} to ${email}: ${description}`);
  } catch (e) {
    logger.error('Wallet refund failed:', e.message);
  }
}

// Resolve the therapist record and client account for an appointment so we can
// notify them and build calendar events. Best-effort: missing pieces come back null.
async function resolveParticipants(appointment) {
  let therapist = null;
  if (appointment.therapistId) {
    const allTherapists = await Therapist.findAll();
    therapist = allTherapists.find(
      t => t._id.toString() === appointment.therapistId.toString()
    ) || null;
  }

  let clientUser = null;
  if (appointment.userId) {
    try {
      clientUser = await User.findById(appointment.userId.toString());
    } catch (e) {
      logger.warn('Could not load client user for appointment:', e.message);
    }
  }

  return {
    therapist,
    therapistName: therapist?.name || 'Your therapist',
    clientName: clientUser?.name || null,
    clientEmail: appointment.clientEmail || clientUser?.email || null
  };
}

exports.createAppointment = async (req, res) => {
  try {
    const { therapistId, date, timeSlot, notes, clientEmail, clientName } = req.body;
    const userId = req.user.id; // From authMiddleware

    // Basic validation
    if (!therapistId || !date || !timeSlot) {
      return res.status(400).json({
        success: false,
        error: 'Please provide therapist, date, and time slot'
      });
    }

    // Email validation
    if (!clientEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clientEmail)) {
      return res.status(400).json({
        success: false,
        error: 'Please provide a valid email address'
      });
    }

    // Get therapist details
    const allTherapists = await Therapist.findAll();
    const therapist = allTherapists.find(t => t._id.toString() === therapistId);
    if (!therapist) {
      return res.status(404).json({
        success: false,
        error: 'Therapist not found'
      });
    }
    // Verify that the requested timeSlot is within the therapist's availability.
    // The weekday must be derived from the calendar date the client picked, not
    // from the server's local timezone — otherwise a "Sunday" booking can be
    // validated against Saturday's (or Monday's) availability depending on the
    // host TZ, letting unavailable days slip through (bug T-1).
    const appointmentDate = new Date(date);
    if (isNaN(appointmentDate.getTime())) {
      return res.status(400).json({ success: false, error: 'Invalid appointment date' });
    }
    const weekday = getCalendarWeekday(date);
    const dayAvailability = (therapist.availability && therapist.availability[weekday]) || [];
    if (!Array.isArray(dayAvailability) || !dayAvailability.includes(timeSlot)) {
      return res.status(400).json({
        success: false,
        error: `Selected time slot is not available for this therapist on ${weekday}`
      });
    }

    // Reject bookings for dates in the past.
    const todayStr = new Date().toISOString().split('T')[0];
    const dateStr = /^\d{4}-\d{2}-\d{2}/.test(String(date)) ? String(date).slice(0, 10) : appointmentDate.toISOString().split('T')[0];
    if (dateStr < todayStr) {
      return res.status(400).json({
        success: false,
        error: 'Appointment date cannot be in the past'
      });
    }



    if (!therapist.email) {
      return res.status(400).json({
        success: false,
        error: 'Therapist email not configured. Please contact admin.'
      });
    }

    // Check for appointment conflicts (same therapist, same date, same time slot)
    const conflictingAppointment = await Appointment.checkConflict(therapistId, date, timeSlot);
    if (conflictingAppointment) {
      return res.status(409).json({
        success: false,
        error: 'This time slot is already booked. Please choose a different time.'
      });
    }

    // Check if this client already has any appointment at the same date/time with any therapist
    const clientConflict = await Appointment.checkClientConflict(userId, date, timeSlot);
    if (clientConflict) {
      return res.status(409).json({
        success: false,
        error: 'You already have an appointment booked at this time. Please choose a different time slot.'
      });
    }

    // Charge the client's wallet for the full session price (set per therapist in
    // the admin dashboard via `pricePerMin`, which holds the fixed session fee).
    // Deduct up-front so the slot is only held once paid; refund if the insert
    // below loses the slot-conflict race.
    const sessionPrice = Number(therapist.pricePerMin) || 0;
    const payerEmail = (req.user.email || clientEmail || '').toLowerCase();
    let walletCharged = false;
    if (sessionPrice > 0) {
      walletCharged = await chargeWallet(
        payerEmail,
        sessionPrice,
        `Therapy session with ${therapist.name}`
      );
      if (!walletCharged) {
        const userDoc = await getDB().collection('users').findOne(
          { email: payerEmail },
          { projection: { walletBalance: 1 } }
        );
        return res.status(402).json({
          success: false,
          code: 'insufficient_funds',
          error: `Insufficient wallet balance. This session costs ₹${sessionPrice.toLocaleString('en-IN')}. Please top up your wallet and try again.`,
          balance: userDoc?.walletBalance || 0,
          required: sessionPrice,
        });
      }
    }

    // Parse appointment date and time
// Duplicate declaration removed; using earlier appointmentDate variable
    const [hours, minutes] = timeSlot.split(':');
    const startDateTime = new Date(appointmentDate);
    startDateTime.setHours(parseInt(hours), parseInt(minutes), 0, 0);

    // Assume 1-hour sessions
    const endDateTime = new Date(startDateTime);
    endDateTime.setHours(startDateTime.getHours() + 1);

    // Reminder schedule rules:
    // 1) Send 1-hour reminder only when session is at least 1 hour away at booking time.
    // 2) Always keep 5-minute reminder enabled (if session is still in the future).
    const now = new Date();
    const msUntilSession = startDateTime.getTime() - now.getTime();
    const skipOneHourReminder = msUntilSession < 60 * 60 * 1000;
    const oneHourReminderAt = skipOneHourReminder
      ? null
      : new Date(startDateTime.getTime() - 60 * 60 * 1000);
    const fiveMinuteReminderAt = new Date(startDateTime.getTime() - 5 * 60 * 1000);

    // NOTE: The Google Calendar event + Meet link are intentionally NOT created
    // here. The booking starts as 'pending'; the calendar event/Meet link is
    // created only when the therapist confirms (see updateAppointmentStatus).
    const meetLink = null;

    // Create appointment in database. The model relies on a partial-unique index
    // to atomically reject a slot grabbed by a concurrent request after the
    // checkConflict above (the check-then-insert race window).
    let appointment;
    try {
      appointment = await Appointment.create({
        therapistId,
        userId,
        date: appointmentDate,
        timeSlot,
        notes: notes || '',
        meetingLink: null,
        clientEmail: clientEmail,
        amountPaid: walletCharged ? sessionPrice : 0,
        payerEmail: walletCharged ? payerEmail : null,
        calendarEventId: null,
        startDateTime,
        endDateTime,
        reminderSchedule: {
          skipOneHourReminder,
          oneHourReminderAt,
          fiveMinuteReminderAt
        }
      });
    } catch (createError) {
      // Booking failed after we charged the wallet — refund so the client isn't
      // left out of pocket for an appointment that was never created.
      if (walletCharged) {
        await refundWallet(payerEmail, sessionPrice, `Refund — booking failed for ${therapist.name}`);
      }
      if (createError.code === 'SLOT_CONFLICT') {
        return res.status(409).json({
          success: false,
          error: 'This time slot is already booked. Please choose a different time.'
        });
      }
      throw createError;
    }

    // Send "booking received / pending confirmation" email to the client and a
    // "new appointment request" email to the therapist. No Meet link yet.
    try {
      await emailService.sendAppointmentConfirmation({
        clientEmail,
        clientName: clientName || req.user.name || 'Client',
        therapistEmail: therapist.email,
        therapistName: therapist.name,
        date: appointmentDate,
        timeSlot,
        meetLink,
        notes: notes || 'No additional notes'
      });

      logger.info(`✅ Booking (pending) emails sent to ${clientEmail} and ${therapist.email}`);
    } catch (emailError) {
      logger.error('Email sending failed (non-critical):', emailError.message);
    }

    res.status(201).json({
      success: true,
      data: {
        ...appointment,
        therapistName: therapist.name,
        meetLink
      },
      message: 'Booking request sent! It is pending confirmation from the therapist. You will receive the Google Meet link by email once it is confirmed.'
    });
  } catch (error) {
    logger.error('Error booking appointment:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Server Error'
    });
  }
};

exports.getTherapistAppointments = async (req, res) => {
  try {
    // We need to find the "Therapist" profile associated with this "User"
    // The logged in user is in req.user
    // Check if req.user has role 'therapist'
    if (req.user.role !== 'therapist') {
      return res.status(403).json({
        success: false,
        error: 'Not authorized as a therapist'
      });
    }

    // We need to find the Therapist ID that corresponds to this User ID.
    // In the 'therapists' collection, is there a link to the 'users' collection?
    // Let's assume for now that the 'therapists' collection might store email, or we updated Therapist to link to User.
    // Looking at Therapist.js model, it has 'email'.

    // Strategy: Find therapist by email (since req.user.email exists)
    // If 'therapists' collection doesn't have email for some reason, we might fallback to name, but email is safer.

    // Use the native driver method from Therapist model
    const therapists = await Therapist.findAll();
    // This is inefficient but findAll returns array. efficient way would be findOne({ email: ... })
    // But TherapistModel doesn't have findByEmail exposed yet?
    // Wait, User has findByEmail. Therapist has findAll.
    // Let's add findByEmail or just iterate (therapists list is likely small).

    let therapistProfile = therapists.find(t => t.email === req.user.email);

    // Fallback: match by name if email not found
    if (!therapistProfile) {
      therapistProfile = therapists.find(t => t.name === req.user.name);
    }

    if (!therapistProfile) {
      return res.status(404).json({
        success: false,
        error: 'Therapist profile not found for this user'
      });
    }

    const appointments = await Appointment.findByTherapistId(therapistProfile._id);

    res.status(200).json({
      success: true,
      data: appointments
    });
  } catch (error) {
    console.error('Error fetching therapist appointments:', error);
    res.status(500).json({
      success: false,
      error: 'Server Error'
    });
  }
};

exports.getUserAppointments = async (req, res) => {
  try {
    const userId = req.user.id;
    const appointments = await Appointment.findByUserId(userId);

    res.status(200).json({
      success: true,
      data: appointments
    });
  } catch (error) {
    console.error('Error fetching user appointments:', error);
    res.status(500).json({
      success: false,
      error: 'Server Error'
    });
  }
};

exports.updateAppointmentStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!['pending', 'confirmed', 'cancelled', 'completed'].includes(status)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid status'
      });
    }

    // Authorization: only the therapist who owns the appointment (or an admin)
    // may change its status. The booking client may cancel their own booking.
    const target = await Appointment.findById(id);
    if (!target) {
      return res.status(404).json({ success: false, error: 'Appointment not found' });
    }
    if (req.user.role !== 'admin') {
      if (req.user.role === 'therapist') {
        const ownTherapist = await Therapist.findByEmail(req.user.email);
        if (!ownTherapist || target.therapistId.toString() !== ownTherapist._id.toString()) {
          return res.status(403).json({ success: false, error: 'Not authorized to modify this appointment' });
        }
      } else {
        const isOwner = target.userId && target.userId.toString() === String(req.user.id);
        if (!isOwner || status !== 'cancelled') {
          return res.status(403).json({ success: false, error: 'You can only cancel your own appointments' });
        }
      }
    }

    // Guard: a session can only be marked "completed" on or after its scheduled date.
    if (status === 'completed') {
      const existing = target;
      if (!existing) {
        return res.status(404).json({ success: false, error: 'Appointment not found' });
      }
      const apptDate = new Date(existing.date);
      apptDate.setHours(0, 0, 0, 0);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      if (today < apptDate) {
        return res.status(400).json({
          success: false,
          error: `Session can only be marked as completed on or after the appointment date (${apptDate.toDateString()}).`
        });
      }
    }

    const updated = await Appointment.updateStatus(id, status);

    if (!updated) {
      return res.status(404).json({
        success: false,
        error: 'Appointment not found'
      });
    }

    // On cancellation, refund the session fee charged at booking time (once).
    if (status === 'cancelled' && updated.amountPaid > 0 && updated.payerEmail && !updated.refunded) {
      const flipped = await Appointment.markRefunded(id);
      if (flipped) {
        await refundWallet(updated.payerEmail, updated.amountPaid, 'Refund — therapy session cancelled');
        updated.refunded = true;
      }
    }

    // Post-status side effects for confirm/cancel. Each step is best-effort so a
    // single failure never blocks the status change or the others.
    if (['confirmed', 'cancelled'].includes(status)) {
      const { therapist, therapistName, clientName, clientEmail } = await resolveParticipants(updated);

      // On confirmation: create the Google Calendar event + Meet link now
      // (deferred from booking time). Only if one doesn't already exist and the
      // therapist hasn't turned off auto-Meet creation (bug T-4).
      const autoMeetEnabled = !therapist || therapist.autoCreateMeet !== false;
      if (status === 'confirmed' && !updated.calendarEventId && autoMeetEnabled) {
        try {
          let startDateTime = updated.startDateTime ? new Date(updated.startDateTime) : null;
          let endDateTime = updated.endDateTime ? new Date(updated.endDateTime) : null;
          // Fallback for older appointments that lack start/end timestamps.
          if (!startDateTime && updated.date && updated.timeSlot) {
            const [h, m] = updated.timeSlot.split(':');
            startDateTime = new Date(updated.date);
            startDateTime.setHours(parseInt(h), parseInt(m), 0, 0);
            endDateTime = new Date(startDateTime);
            endDateTime.setHours(startDateTime.getHours() + 1);
          }

          if (therapist?.email && startDateTime && endDateTime) {
            const calendarEvent = await googleCalendarService.createAppointmentEvent({
              summary: `Therapy Session - ${therapistName} & ${clientName || 'Client'}`,
              description: updated.notes || 'Scheduled therapy session via StressReliefChat',
              startDateTime,
              endDateTime,
              therapistEmail: therapist.email,
              therapistName,
              clientEmail,
              clientName: clientName || 'Client',
              therapistRefreshToken: therapist.googleRefreshToken
            });
            await Appointment.updateMeetingDetails(id, {
              meetingLink: calendarEvent.meetLink,
              calendarEventId: calendarEvent.eventId
            });
            updated.meetingLink = calendarEvent.meetLink;
            updated.calendarEventId = calendarEvent.eventId;
            logger.info(`✅ Calendar event created on confirm: ${calendarEvent.eventId}, Meet: ${calendarEvent.meetLink}`);
          }
        } catch (calErr) {
          logger.error('Calendar event creation on confirm failed (non-critical):', calErr.message);
        }
      }

      // On cancellation: remove the calendar event if one was created.
      if (status === 'cancelled' && updated.calendarEventId) {
        try {
          await googleCalendarService.deleteAppointmentEvent(
            updated.calendarEventId,
            therapist?.googleRefreshToken
          );
          await Appointment.updateMeetingDetails(id, { meetingLink: null, calendarEventId: null });
          updated.meetingLink = null;
          updated.calendarEventId = null;
          logger.info('✅ Calendar event deleted on cancel');
        } catch (delErr) {
          logger.error('Calendar event deletion on cancel failed (non-critical):', delErr.message);
        }
      }

      // WhatsApp notification (non-blocking).
      if (updated.whatsappNumber) {
        try {
          await whatsappService.sendStatusUpdate(updated.whatsappNumber, status, {
            therapistName,
            date: updated.date,
            timeSlot: updated.timeSlot
          });
        } catch (waErr) {
          logger.warn(`WhatsApp status update failed (non-critical): ${waErr.message}`);
        }
      }

      // Email the client (sent to the booking email, falling back to the
      // registered account email). Includes the Meet link on confirmation.
      if (clientEmail) {
        try {
          await emailService.sendAppointmentStatusUpdate({
            clientEmail,
            clientName,
            therapistName,
            status,
            date: updated.date,
            timeSlot: updated.timeSlot,
            meetLink: updated.meetingLink || null
          });
          logger.info(`✅ Appointment ${status} email sent to ${clientEmail}`);
        } catch (mailErr) {
          logger.error('Appointment status email failed (non-critical):', mailErr.message);
        }
      }
    }

    res.status(200).json({
      success: true,
      data: updated,
      message: `Appointment ${status}`
    });

  } catch (error) {
    console.error('Error updating appointment:', error);
    res.status(500).json({
      success: false,
      error: 'Server Error'
    });
  }
};

exports.rescheduleAppointment = async (req, res) => {
  try {
    const { id } = req.params;
    const { date, timeSlot } = req.body;

    if (!date || !timeSlot) {
      return res.status(400).json({ success: false, error: 'Please provide date and timeSlot' });
    }

    const existing = await Appointment.findById(id);
    if (!existing) {
      return res.status(404).json({ success: false, error: 'Appointment not found' });
    }

    // Authorize: only the therapist who owns this appointment (or an admin)
    if (req.user.role === 'therapist') {
      const therapistProfile = await Therapist.findByEmail(req.user.email);
      if (!therapistProfile || existing.therapistId.toString() !== therapistProfile._id.toString()) {
        return res.status(403).json({ success: false, error: 'Not authorized to reschedule this appointment' });
      }
    } else if (req.user.role !== 'admin') {
      return res.status(403).json({ success: false, error: 'Not authorized to reschedule appointments' });
    }

    // The rescheduled slot must still fall within the therapist's availability
    // (same rule as booking — bug T-1 also applied here).
    const owningTherapist = await Therapist.findById(existing.therapistId.toString());
    if (owningTherapist) {
      const weekday = getCalendarWeekday(date);
      const dayAvailability = (owningTherapist.availability && owningTherapist.availability[weekday]) || [];
      if (!Array.isArray(dayAvailability) || !dayAvailability.includes(timeSlot)) {
        return res.status(400).json({
          success: false,
          error: `The selected time slot is outside your availability on ${weekday}`
        });
      }
    }

    // Conflict check on new slot (exclude this appointment itself)
    const conflict = await Appointment.checkConflict(existing.therapistId.toString(), date, timeSlot);
    if (conflict && conflict._id.toString() !== id) {
      return res.status(409).json({ success: false, error: 'This time slot is already booked.' });
    }

    const appointmentDate = new Date(date);
    const [hours, minutes] = timeSlot.split(':');
    const startDateTime = new Date(appointmentDate);
    startDateTime.setHours(parseInt(hours), parseInt(minutes), 0, 0);
    const endDateTime = new Date(startDateTime);
    endDateTime.setHours(startDateTime.getHours() + 1);

    // Recalculate reminder schedule for the new time
    const now = new Date();
    const msUntilSession = startDateTime.getTime() - now.getTime();
    const skipOneHourReminder = msUntilSession < 60 * 60 * 1000;
    const oneHourReminderAt = skipOneHourReminder ? null : new Date(startDateTime.getTime() - 60 * 60 * 1000);
    const fiveMinuteReminderAt = new Date(startDateTime.getTime() - 5 * 60 * 1000);

    let updated;
    try {
      updated = await Appointment.reschedule(id, {
        date: appointmentDate,
        timeSlot,
        startDateTime,
        endDateTime,
        reminderSchedule: { skipOneHourReminder, oneHourReminderAt, fiveMinuteReminderAt }
      });
    } catch (rescheduleError) {
      if (rescheduleError.code === 'SLOT_CONFLICT') {
        return res.status(409).json({ success: false, error: 'This time slot is already booked.' });
      }
      throw rescheduleError;
    }

    // Resolve therapist + client once for calendar sync and notifications.
    const { therapist, therapistName, clientName, clientEmail } = await resolveParticipants(updated || existing);
    let meetLink = existing.meetingLink || null;

    // Sync the Google Calendar event with the new time. A reschedule confirms the
    // booking, so create the event if none exists yet, otherwise move it.
    try {
      if (existing.calendarEventId) {
        await googleCalendarService.updateAppointmentEvent(
          existing.calendarEventId,
          {
            start: { dateTime: startDateTime.toISOString(), timeZone: 'Asia/Kolkata' },
            end: { dateTime: endDateTime.toISOString(), timeZone: 'Asia/Kolkata' }
          },
          therapist?.googleRefreshToken
        );
      } else if (therapist?.email) {
        const calendarEvent = await googleCalendarService.createAppointmentEvent({
          summary: `Therapy Session - ${therapistName} & ${clientName || 'Client'}`,
          description: existing.notes || 'Scheduled therapy session via StressReliefChat',
          startDateTime,
          endDateTime,
          therapistEmail: therapist.email,
          therapistName,
          clientEmail,
          clientName: clientName || 'Client',
          therapistRefreshToken: therapist.googleRefreshToken
        });
        meetLink = calendarEvent.meetLink;
        await Appointment.updateMeetingDetails(id, {
          meetingLink: calendarEvent.meetLink,
          calendarEventId: calendarEvent.eventId
        });
        if (updated) {
          updated.meetingLink = calendarEvent.meetLink;
          updated.calendarEventId = calendarEvent.eventId;
        }
        logger.info(`✅ Calendar event created on reschedule: ${calendarEvent.eventId}`);
      }
    } catch (calErr) {
      logger.error('Reschedule calendar sync failed (non-critical):', calErr.message);
    }

    // Send reschedule notification email to client (non-blocking)
    if (clientEmail) {
      emailService.sendRescheduleNotification({
        clientEmail,
        clientName,
        therapistName,
        oldDate: existing.date,
        oldTimeSlot: existing.timeSlot,
        newDate: appointmentDate,
        newTimeSlot: timeSlot,
        meetLink
      }).catch(err => logger.error('Reschedule notification email failed:', err));
    }

    res.status(200).json({
      success: true,
      data: updated,
      message: 'Appointment rescheduled and confirmed.'
    });
  } catch (error) {
    logger.error('Error rescheduling appointment:', error);
    res.status(500).json({ success: false, error: 'Server Error' });
  }
};

exports.getBookedTimeSlots = async (req, res) => {
  try {
    const { therapistId, date } = req.query;

    if (!therapistId || !date) {
      return res.status(400).json({
        success: false,
        error: 'Therapist ID and date are required'
      });
    }

    // Get all appointments for this therapist on this date that are not cancelled/completed
    const appointments = await Appointment.getBookedSlots(therapistId, date);

    // Extract just the time slots
    const bookedSlots = appointments.map(apt => apt.timeSlot);

    res.status(200).json({
      success: true,
      data: {
        bookedSlots
      }
    });
  } catch (error) {
    logger.error('Error fetching booked time slots:', error);
    res.status(500).json({
      success: false,
      error: 'Server Error'
    });
  }
};

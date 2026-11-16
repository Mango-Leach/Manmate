const { getDB } = require('../config/database');
const { ObjectId } = require('mongodb');

class AppointmentModel {
  constructor() {
    this.collectionName = 'appointments';
  }

  getCollection() {
    const db = getDB();
    return db.collection(this.collectionName);
  }

  async create(appointmentData) {
    const collection = this.getCollection();
    const appointment = {
      therapistId: new ObjectId(appointmentData.therapistId),
      userId: new ObjectId(appointmentData.userId),
      date: new Date(appointmentData.date),
      timeSlot: appointmentData.timeSlot,
      startDateTime: appointmentData.startDateTime ? new Date(appointmentData.startDateTime) : null,
      endDateTime: appointmentData.endDateTime ? new Date(appointmentData.endDateTime) : null,
      status: 'pending', // pending, confirmed, cancelled, completed
      // `active` mirrors the booking's status for the partial-unique slot index.
      // true while the slot is held (pending/confirmed), false once it frees up
      // (cancelled/completed). The unique index only applies to active docs, so a
      // freed slot can be re-booked.
      active: true,
      notes: appointmentData.notes ? appointmentData.notes.trim() : '',
      clientEmail: appointmentData.clientEmail || null,
      // Wallet payment captured at booking time (full session price).
      amountPaid: Number(appointmentData.amountPaid) || 0,
      payerEmail: appointmentData.payerEmail || null,
      refunded: false,
      meetingLink: appointmentData.meetingLink || null,
      calendarEventId: appointmentData.calendarEventId || null,
      whatsappNumber: appointmentData.whatsappNumber ? appointmentData.whatsappNumber.trim() : '',
      reminderSent: false,
      emailReminder: {
        oneHour: {
          scheduledAt: appointmentData.reminderSchedule?.oneHourReminderAt
            ? new Date(appointmentData.reminderSchedule.oneHourReminderAt)
            : null,
          sent: false,
          sentAt: null,
          skipped: Boolean(appointmentData.reminderSchedule?.skipOneHourReminder),
          skippedAt: appointmentData.reminderSchedule?.skipOneHourReminder ? new Date() : null
        },
        thirtyMinutes: {
          scheduledAt: appointmentData.reminderSchedule?.thirtyMinuteReminderAt
            ? new Date(appointmentData.reminderSchedule.thirtyMinuteReminderAt)
            : null,
          sent: false,
          sentAt: null
        },
        fiveMinutes: {
          scheduledAt: appointmentData.reminderSchedule?.fiveMinuteReminderAt
            ? new Date(appointmentData.reminderSchedule.fiveMinuteReminderAt)
            : null,
          sent: false,
          sentAt: null
        }
      },
      createdAt: new Date(),
      updatedAt: new Date()
    };

    try {
      const result = await collection.insertOne(appointment);
      return { ...appointment, _id: result.insertedId };
    } catch (error) {
      // Duplicate key from the partial-unique slot index => the slot was taken
      // by a concurrent request between the conflict check and this insert.
      if (error && error.code === 11000) {
        const conflict = new Error('This time slot is already booked. Please choose a different time.');
        conflict.code = 'SLOT_CONFLICT';
        throw conflict;
      }
      throw error;
    }
  }

  async findByTherapistId(therapistId) {
    const collection = this.getCollection();
    // therapistId can be a string or ObjectId, ensure it's ObjectId for query if stored as such
    // However, in create we stored as ObjectId.
    // Need to be careful if therapistId passed here is string.
    const query = { therapistId: new ObjectId(therapistId) };

    // We need to join with Users to get user name
    const appointments = await collection.aggregate([
      { $match: query },
      {
        $lookup: {
          from: 'users',
          localField: 'userId',
          foreignField: '_id',
          as: 'user'
        }
      },
      {
        $unwind: {
          path: '$user',
          preserveNullAndEmptyArrays: true
        }
      },
      {
        $project: {
          _id: 1,
          date: 1,
          timeSlot: 1,
          status: 1,
          notes: 1,
          whatsappNumber: 1,
          therapistId: 1,
          userId: {
            _id: '$user._id',
            name: '$user.name',
            email: '$user.email'
          }
        }
      },
      { $sort: { date: 1 } }
    ]).toArray();

    return appointments;
  }

  async findByUserId(userId) {
    const collection = this.getCollection();
    const query = { userId: new ObjectId(userId) };

    // Ensure we can get therapist details if needed (users might want to see who they booked)
    // Since we don't have a 'therapists' collection that matches 1:1 with a user model easily in all cases
    // (sometimes therapist is just a role on a user, sometimes it's a separate collection 'therapists' from admin)
    // The 'therapists' collection seems to be the one from admin.

    const appointments = await collection.aggregate([
      { $match: query },
      {
        $lookup: {
          from: 'therapists',
          localField: 'therapistId',
          foreignField: '_id',
          as: 'therapist'
        }
      },
      {
        $unwind: {
          path: '$therapist',
          preserveNullAndEmptyArrays: true
        }
      },
      {
        $project: {
          _id: 1,
          date: 1,
          timeSlot: 1,
          status: 1,
          notes: 1,
          whatsappNumber: 1,
          userId: 1,
          therapistId: {
            _id: '$therapist._id',
            name: '$therapist.name'
          }
        }
      },
      { $sort: { date: 1 } }
    ]).toArray();

    return appointments;
  }

  async updateStatus(id, status) {
    const collection = this.getCollection();
    const result = await collection.findOneAndUpdate(
      { _id: new ObjectId(id) },
      {
        $set: {
          status: status,
          // Free the slot for re-booking once cancelled/completed; hold it otherwise.
          active: !['cancelled', 'completed'].includes(status),
          updatedAt: new Date()
        }
      },
      { returnDocument: 'after' }
    );
    return result;
  }

  // Atomically flag the appointment as refunded. Returns the doc only if this
  // call is the one that flipped the flag (guards against double refunds when an
  // appointment is cancelled more than once or by both parties).
  async markRefunded(id) {
    const collection = this.getCollection();
    return await collection.findOneAndUpdate(
      { _id: new ObjectId(id), refunded: { $ne: true } },
      { $set: { refunded: true, refundedAt: new Date(), updatedAt: new Date() } },
      { returnDocument: 'after' }
    );
  }

  async reschedule(id, { date, timeSlot, startDateTime, endDateTime, reminderSchedule }) {
    const collection = this.getCollection();

    const oneHourAt = reminderSchedule?.oneHourReminderAt
      ? new Date(reminderSchedule.oneHourReminderAt)
      : null;
    const fiveMinAt = reminderSchedule?.fiveMinuteReminderAt
      ? new Date(reminderSchedule.fiveMinuteReminderAt)
      : null;
    const thirtyMinAt = reminderSchedule?.thirtyMinuteReminderAt
      ? new Date(reminderSchedule.thirtyMinuteReminderAt)
      : null;

    let result;
    try {
      result = await collection.findOneAndUpdate(
      { _id: new ObjectId(id) },
      {
        $set: {
          date: new Date(date),
          timeSlot,
          startDateTime: startDateTime ? new Date(startDateTime) : null,
          endDateTime: endDateTime ? new Date(endDateTime) : null,
          status: 'confirmed',
          active: true,
          // Reset reminder schedule for the new time
          'emailReminder.oneHour.scheduledAt': oneHourAt,
          'emailReminder.oneHour.sent': false,
          'emailReminder.oneHour.sentAt': null,
          'emailReminder.oneHour.skipped': !oneHourAt,
          'emailReminder.oneHour.skippedAt': !oneHourAt ? new Date() : null,
          'emailReminder.fiveMinutes.scheduledAt': fiveMinAt,
          'emailReminder.fiveMinutes.sent': false,
          'emailReminder.fiveMinutes.sentAt': null,
          'emailReminder.thirtyMinutes.scheduledAt': thirtyMinAt,
          'emailReminder.thirtyMinutes.sent': false,
          'emailReminder.thirtyMinutes.sentAt': null,
          reminderSent: false,
          updatedAt: new Date()
        }
      },
      { returnDocument: 'after' }
      );
    } catch (error) {
      if (error && error.code === 11000) {
        const conflict = new Error('This time slot is already booked. Please choose a different time.');
        conflict.code = 'SLOT_CONFLICT';
        throw conflict;
      }
      throw error;
    }
    return result;
  }

  async findUpcomingAppointments(hoursAhead = 24) {
    const collection = this.getCollection();
    const now = new Date();
    const windowEnd = new Date(now.getTime() + hoursAhead * 60 * 60 * 1000);

    return await collection.find({
      status: 'confirmed',
      date: { $gte: now, $lte: windowEnd },
      reminderSent: { $ne: true },
      whatsappNumber: { $exists: true, $ne: '' }
    }).toArray();
  }

  async markReminderSent(id) {
    const collection = this.getCollection();
    return await collection.updateOne(
      { _id: new ObjectId(id) },
      { $set: { reminderSent: true, reminderSentAt: new Date() } }
    );
  }

  async findById(id) {
    const collection = this.getCollection();
    return await collection.findOne({ _id: new ObjectId(id) });
  }

  // Persist the Google Meet link / calendar event id. Used when the calendar
  // event is created on confirmation (or cleared on cancellation), separately
  // from booking time.
  async updateMeetingDetails(id, { meetingLink, calendarEventId }) {
    const collection = this.getCollection();
    return await collection.updateOne(
      { _id: new ObjectId(id) },
      {
        $set: {
          meetingLink: meetingLink ?? null,
          calendarEventId: calendarEventId ?? null,
          updatedAt: new Date()
        }
      }
    );
  }

  async checkConflict(therapistId, date, timeSlot) {
    const collection = this.getCollection();

    // Normalize the date to check only year, month, day (ignore time portion)
    const appointmentDate = new Date(date);
    const startOfDay = new Date(appointmentDate.getFullYear(), appointmentDate.getMonth(), appointmentDate.getDate());
    const endOfDay = new Date(startOfDay);
    endOfDay.setDate(endOfDay.getDate() + 1);

    // Find any existing appointment for this therapist on the same date and time slot
    // Only check for appointments that are not cancelled
    const existingAppointment = await collection.findOne({
      therapistId: new ObjectId(therapistId),
      date: {
        $gte: startOfDay,
        $lt: endOfDay
      },
      timeSlot: timeSlot,
      status: { $nin: ['cancelled', 'completed'] } // Ignore cancelled/completed appointments
    });

    return existingAppointment;
  }

  async checkClientConflict(userId, date, timeSlot) {
    const collection = this.getCollection();
    const appointmentDate = new Date(date);
    const startOfDay = new Date(appointmentDate.getFullYear(), appointmentDate.getMonth(), appointmentDate.getDate());
    const endOfDay = new Date(startOfDay);
    endOfDay.setDate(endOfDay.getDate() + 1);

    return await collection.findOne({
      userId: new ObjectId(userId),
      date: { $gte: startOfDay, $lt: endOfDay },
      timeSlot,
      status: { $nin: ['cancelled', 'completed'] }
    });
  }

  async getBookedSlots(therapistId, date) {
    const collection = this.getCollection();

    // Normalize the date to check only year, month, day
    const appointmentDate = new Date(date);
    const startOfDay = new Date(appointmentDate.getFullYear(), appointmentDate.getMonth(), appointmentDate.getDate());
    const endOfDay = new Date(startOfDay);
    endOfDay.setDate(endOfDay.getDate() + 1);

    // Find all appointments for this therapist on this date that are not cancelled/completed
    const appointments = await collection.find({
      therapistId: new ObjectId(therapistId),
      date: {
        $gte: startOfDay,
        $lt: endOfDay
      },
      status: { $nin: ['cancelled', 'completed'] }
    }).toArray();

    return appointments;
  }
}

module.exports = new AppointmentModel();

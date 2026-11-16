const Therapist = require('../models/Therapist');
const UserModel = require('../models/User');
const logger = require('../utils/logger');
const emailService = require('../services/emailService');
const { generateOAuthUrl } = require('./calendarOAuthController');

const DEFAULT_BOOKING_SLOTS = ['09:00', '10:00', '11:00', '12:00', '14:00', '15:00', '16:00', '17:00', '18:00'];

exports.getTherapists = async (req, res, next) => {
  try {
    res.set('Cache-Control', 'no-store');
    const therapists = await Therapist.findAll();

    // Map _id to id for frontend compatibility
    const formattedTherapists = therapists.map(t => ({
      ...t,
      id: t._id.toString()
    }));

    res.json({
      success: true,
      data: formattedTherapists
    });
  } catch (error) {
    logger.error('Error fetching therapists:', error);
    next(error);
  }
};

exports.addTherapist = async (req, res, next) => {
  try {
    const { name, title, description, credentials, specialties, experience, gender } = req.body;
    const email = String(req.body.email || '').trim().toLowerCase();
    const avatar = req.body.avatar || req.body.photoUrl || '';

    if (!name || !title || !email) {
      return res.status(400).json({
        success: false,
        error: 'Please provide name, email, and title'
      });
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ success: false, error: 'Please provide a valid email address' });
    }

    const submittedRate = req.body.pricePerMin ?? req.body.rate;
    const sessionRate = submittedRate === undefined ? 799 : Number(submittedRate);
    if (!Number.isFinite(sessionRate) || sessionRate < 0) {
      return res.status(400).json({ success: false, error: 'Session price must be a non-negative number' });
    }

    const existingProfile = await Therapist.findByEmail(email);
    if (existingProfile) {
      return res.status(409).json({ success: false, error: 'A therapist profile already exists for this email. Edit the existing profile instead.' });
    }

    // Create or upgrade user in users collection. If an earlier request created
    // the user but failed before creating the profile, allow this retry to finish.
    const existingUser = await UserModel.findByEmail(email);

    if (existingUser) {
      if (existingUser.role === 'admin') {
        return res.status(409).json({ success: false, error: 'An admin account cannot be converted into a therapist account' });
      }
      if (existingUser.role !== 'therapist') {
        await UserModel.update(email, { role: 'therapist', isAvailable: false });
        logger.info(`User upgraded to therapist by admin: ${email}`);
      }
    } else {
      // Create new user with therapist role
      await UserModel.create({
        name,
        email,
        role: 'therapist',
        emailVerified: true,
        isAvailable: false,
      });
      logger.info(`New therapist user created by admin: ${email}`);
    }

    // Also create entry in therapists collection
    const newTherapist = await Therapist.create({
      name,
      email,
      title,
      description,
      credentials,
      specialties: Array.isArray(specialties) ? specialties : [],
      pricePerMin: sessionRate,
      avatar,
      experience,
      gender,
      rating: 5.0
    });
    if (existingUser) {
      try {
        await UserModel.update(email, { name });
      } catch (userUpdateError) {
        logger.warn(`Therapist profile created but user account name did not sync for ${email}:`, userUpdateError.message);
      }
    }

    // Calendar onboarding is helpful but must not make an already-persisted
    // therapist look like a failed create if OAuth or SMTP is unavailable.
    const therapistId = newTherapist._id.toString();
    try {
      const oauthUrl = generateOAuthUrl(therapistId);
      emailService.sendTherapistWelcome({ therapistEmail: email, therapistName: name, therapistId, oauthUrl })
        .catch(error => logger.error(`Failed to send therapist welcome email to ${email}:`, error));
    } catch (oauthError) {
      logger.warn(`Therapist saved, but calendar welcome link could not be generated for ${email}:`, oauthError.message);
    }

    logger.info(`✅ Therapist profile created: ${email}`);

    res.status(201).json({
      success: true,
      data: { ...newTherapist, id: newTherapist._id }
    });
  } catch (error) {
    logger.error('Error adding therapist:', error);
    next(error);
  }
};

exports.updateTherapist = async (req, res, next) => {
  try {
    const { id } = req.params;
    const updates = { ...req.body };
    delete updates._id; // Prevent updating _id
    if (updates.photoUrl !== undefined && updates.avatar === undefined) updates.avatar = updates.photoUrl;
    delete updates.photoUrl;
    const submittedRate = updates.pricePerMin ?? updates.rate;
    delete updates.rate;
    if (submittedRate !== undefined) {
      const sessionRate = Number(submittedRate);
      if (!Number.isFinite(sessionRate) || sessionRate < 0) {
        return res.status(400).json({ success: false, error: 'Session price must be a non-negative number' });
      }
      updates.pricePerMin = sessionRate;
    }

    logger.info(`[Controller] Updating therapist ${id}`);

    const updatedTherapist = await Therapist.update(id, updates);

    logger.info(`[Controller] Update result: ${updatedTherapist ? 'Success' : 'Not Found'}`);

    if (!updatedTherapist) {
      return res.status(404).json({
        success: false,
        error: 'Therapist not found'
      });
    }

    if (updates.name && updatedTherapist.email) {
      try {
        await UserModel.update(updatedTherapist.email, { name: updatedTherapist.name });
      } catch (userUpdateError) {
        logger.warn(`Therapist profile name saved but user account name did not sync for ${updatedTherapist.email}:`, userUpdateError.message);
      }
    }

    res.json({
      success: true,
      data: { ...updatedTherapist, id: updatedTherapist._id }
    });
  } catch (error) {
    logger.error('Error updating therapist:', error);
    next(error);
  }
};

exports.deleteTherapist = async (req, res, next) => {
  try {
    const { id } = req.params;

    // Find the therapist first to get email for user role cleanup
    const therapist = await Therapist.findById(id);

    const success = await Therapist.delete(id);

    if (!success) {
      return res.status(404).json({
        success: false,
        error: 'Therapist not found'
      });
    }

    // Reset the user's role back to client
    if (therapist && therapist.email) {
      try {
        await UserModel.update(therapist.email, {
          role: 'client',
          isAvailable: undefined,
        });
        logger.info(`Therapist user role reset to client: ${therapist.email}`);
      } catch (roleResetError) {
        // Log but don't fail the whole request — therapist profile is already deleted
        logger.error(`Failed to reset role for ${therapist.email}:`, roleResetError);
      }
    } else {
      logger.warn(`deleteTherapist: could not find therapist email for id ${id} — user role not reset`);
    }

    res.json({
      success: true,
      message: 'Therapist deleted successfully'
    });
  } catch (error) {
    logger.error('Error deleting therapist:', error);
    next(error);
  }
};

/**
 * GET /api/therapists/:id/availability  (public)
 * Returns the weekly availability grid a therapist configured in their
 * dashboard, so the member booking page shows exactly the same slots.
 */
exports.getTherapistAvailability = async (req, res, next) => {
  try {
    const { id } = req.params;
    const therapist = await Therapist.findById(id);

    if (!therapist) {
      return res.status(404).json({
        success: false,
        error: 'Therapist not found'
      });
    }

    res.json({
      success: true,
      data: {
        availability: therapist.isDemo || !therapist.email
          ? (therapist.availability || {})
          : Object.fromEntries(
            ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
              .map(day => [
                day,
                Array.isArray(therapist.availability?.[day])
                  ? therapist.availability[day]
                  : DEFAULT_BOOKING_SLOTS
              ])
          )
      }
    });
  } catch (error) {
    logger.error('Error fetching therapist availability:', error);
    next(error);
  }
};

exports.getProfile = async (req, res, next) => {
  try {
    const email = req.user.email;
    const therapist = await Therapist.findByEmail(email);

    if (!therapist) {
      return res.status(404).json({
        success: false,
        error: 'Therapist profile not found'
      });
    }

    res.json({
      success: true,
      data: { ...therapist, id: therapist._id }
    });
  } catch (error) {
    logger.error('Error fetching therapist profile:', error);
    next(error);
  }
};

// Helper: filter appointments by optional date range
function filterByDateRange(appointments, startDate, endDate) {
  if (!startDate && !endDate) return appointments;
  const start = startDate ? new Date(startDate) : null;
  const end = endDate ? new Date(endDate) : null;
  if (end) end.setHours(23, 59, 59, 999);
  return appointments.filter(a => {
    const d = new Date(a.date);
    if (start && d < start) return false;
    if (end && d > end) return false;
    return true;
  });
}

function buildAnalyticsPayload(therapist, appointments, startDate, endDate) {
  const filtered = filterByDateRange(appointments, startDate, endDate);

  const total = filtered.length;
  const completed = filtered.filter(a => a.status === 'completed').length;
  const confirmed = filtered.filter(a => a.status === 'confirmed').length;
  const pending = filtered.filter(a => a.status === 'pending').length;
  const cancelled = filtered.filter(a => a.status === 'cancelled').length;

  const now = new Date();
  const thisMonth = appointments.filter(a => {
    const d = new Date(a.date);
    return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
  }).length;

  return {
    name: therapist.name,
    email: therapist.email,
    title: therapist.title,
    specialties: therapist.specialties || [],
    experience: therapist.experience || '',
    rating: therapist.rating || 0,
    rate: therapist.pricePerMin || therapist.rate || 0,
    totalSessions: total,
    completedSessions: completed,
    confirmedSessions: confirmed,
    pendingSessions: pending,
    cancelledSessions: cancelled,
    sessionsThisMonth: thisMonth,
    joinedAt: therapist.createdAt,
    filtered: !!(startDate || endDate),
  };
}

/**
 * GET /api/therapists/analytics/me?startDate=YYYY-MM-DD&endDate=YYYY-MM-DD
 * Therapist views their own analytics
 */
exports.getMyAnalytics = async (req, res, next) => {
  try {
    const email = req.user.email;
    const { startDate, endDate } = req.query;
    const therapist = await Therapist.findByEmail(email);

    if (!therapist) {
      return res.status(404).json({ success: false, error: 'Therapist profile not found' });
    }

    const Appointment = require('../models/Appointment');
    const appointments = await Appointment.findByTherapistId(therapist._id.toString());

    res.json({
      success: true,
      data: { analytics: buildAnalyticsPayload(therapist, appointments, startDate, endDate) }
    });
  } catch (error) {
    logger.error('Error fetching therapist analytics:', error);
    next(error);
  }
};

/**
 * GET /api/therapists/:id/analytics?startDate=YYYY-MM-DD&endDate=YYYY-MM-DD
 * Admin views analytics for any therapist
 */
exports.getTherapistAnalyticsByAdmin = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { startDate, endDate } = req.query;
    const therapist = await Therapist.findById(id);

    if (!therapist) {
      return res.status(404).json({ success: false, error: 'Therapist not found' });
    }

    const Appointment = require('../models/Appointment');
    const appointments = await Appointment.findByTherapistId(id);

    res.json({
      success: true,
      data: {
        analytics: {
          id: therapist._id.toString(),
          ...buildAnalyticsPayload(therapist, appointments, startDate, endDate),
        }
      }
    });
  } catch (error) {
    logger.error('Error fetching therapist analytics by admin:', error);
    next(error);
  }
};

exports.updateProfile = async (req, res, next) => {
  try {
    const email = req.user.email;

    // Whitelist: therapists may edit their own descriptive fields and settings,
    // but never pricing, ratings, email, or Google Calendar credentials.
    const ALLOWED_FIELDS = ['availability', 'autoCreateMeet', 'bio', 'description', 'specialties', 'title', 'experience', 'avatar', 'name'];
    const updates = {};
    for (const key of ALLOWED_FIELDS) {
      if (Object.prototype.hasOwnProperty.call(req.body, key)) {
        updates[key] = req.body[key];
      }
    }
    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ success: false, error: 'No updatable fields provided' });
    }
    if (Object.prototype.hasOwnProperty.call(updates, 'autoCreateMeet')) {
      updates.autoCreateMeet = updates.autoCreateMeet === true;
    }

    // Validate the availability grid: { Monday: ['09:00', …], … } with only
    // known weekday keys and HH:MM slot strings.
    if (Object.prototype.hasOwnProperty.call(updates, 'availability')) {
      const a = updates.availability;
      const VALID_DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
      if (!a || typeof a !== 'object' || Array.isArray(a)) {
        return res.status(400).json({ success: false, error: 'Invalid availability format' });
      }
      const cleaned = {};
      for (const day of VALID_DAYS) {
        const slots = a[day];
        if (slots === undefined) { cleaned[day] = []; continue; }
        if (!Array.isArray(slots) || slots.some(s => typeof s !== 'string' || !/^\d{2}:\d{2}$/.test(s))) {
          return res.status(400).json({ success: false, error: `Invalid time slots for ${day}` });
        }
        cleaned[day] = [...new Set(slots)].sort();
      }
      updates.availability = cleaned;
    }

    const therapist = await Therapist.findByEmail(email);

    if (!therapist) {
      return res.status(404).json({
        success: false,
        error: 'Therapist profile not found'
      });
    }

    logger.info(`[Controller] Updating profile for therapist ${therapist._id}`);
    const updatedTherapist = await Therapist.update(therapist._id, updates);

    res.json({
      success: true,
      data: { ...updatedTherapist, id: updatedTherapist._id }
    });
  } catch (error) {
    logger.error('Error updating therapist profile:', error);
    next(error);
  }
};

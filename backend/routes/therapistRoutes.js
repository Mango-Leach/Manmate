const express = require('express');
const router = express.Router();
const therapistController = require('../controllers/therapistController');
const calendarOAuthController = require('../controllers/calendarOAuthController');
const { authenticate } = require('../middleware/auth'); const { validateDobNotFuture, validateProfileFields } = require('../middleware/validator');
const { requireAdmin } = require('../middleware/roleAuth');

// Public routes
router.get('/', therapistController.getTherapists);
router.get('/:id/availability', therapistController.getTherapistAvailability);

// Protected Therapist routes
router.get('/profile', authenticate, therapistController.getProfile);
router.put('/profile', authenticate, validateDobNotFuture, validateProfileFields, therapistController.updateProfile);
router.get('/analytics/me', authenticate, therapistController.getMyAnalytics);

// Google Calendar OAuth routes (for therapists)
router.get('/calendar/auth-url', authenticate, calendarOAuthController.getAuthUrl);
router.post('/calendar/callback', calendarOAuthController.handleCallback);
router.get('/calendar/status', authenticate, calendarOAuthController.getStatus);
router.delete('/calendar/disconnect', authenticate, calendarOAuthController.disconnectCalendar);

// Protected Admin routes
router.post('/', authenticate, requireAdmin, therapistController.addTherapist);
router.get('/:id/analytics', authenticate, requireAdmin, therapistController.getTherapistAnalyticsByAdmin);
router.put('/:id', authenticate, requireAdmin, therapistController.updateTherapist);
router.delete('/:id', authenticate, requireAdmin, therapistController.deleteTherapist);

module.exports = router;

const express = require('express');
const router = express.Router();
const appointmentController = require('../controllers/appointmentController');
const { authenticate } = require('../middleware/auth');
const whatsappService = require('../services/whatsappService');

router.post('/', authenticate, appointmentController.createAppointment);
router.get('/booked-slots', appointmentController.getBookedTimeSlots); // Public endpoint - no auth needed
router.get('/therapist', authenticate, appointmentController.getTherapistAppointments);
router.get('/user', authenticate, appointmentController.getUserAppointments);
router.put('/:id/status', authenticate, appointmentController.updateAppointmentStatus);
router.put('/:id/reschedule', authenticate, appointmentController.rescheduleAppointment);

// Test endpoint: GET /api/appointments/test-whatsapp?phone=91XXXXXXXXXX
router.get('/test-whatsapp', async (req, res) => {
  const { phone } = req.query;
  if (!phone) {
    return res.status(400).json({ error: 'Provide ?phone=91XXXXXXXXXX' });
  }
  try {
    const result = await whatsappService.sendTestMessage(phone);
    res.json({ success: !!result, data: result });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;

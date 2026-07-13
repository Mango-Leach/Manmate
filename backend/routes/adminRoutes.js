const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const { getReports, updateReportStatus, sendWarning, suspendUser, unsuspendUser } = require('../controllers/reportController');
const { authenticate } = require('../middleware/auth');
const { requireAdmin } = require('../middleware/roleAuth');

// All admin routes require authentication and admin role
router.use(authenticate);
router.use(requireAdmin);

// Listener management
router.get('/listeners', adminController.getListeners);
router.post('/listeners', adminController.addListener);
router.patch('/listeners/bulk-rate', adminController.setAllListenersRate);
router.put('/listeners/:id', adminController.updateListener);
router.delete('/listeners/:id', adminController.deleteListener);
router.get('/listeners/:id/analytics', adminController.getListenerAnalytics);

// Platform settings
router.get('/settings', adminController.getAdminSettings);
router.post('/settings', adminController.saveAdminSettings);

// Statistics
router.get('/stats', adminController.getStats);

// Diagnostics (verify callLogs data)
router.get('/diagnostics', adminController.getDiagnostics);

// Transcript browser
router.get('/transcripts', adminController.getTranscripts);
router.get('/transcripts/session/:sessionId/conversation', adminController.getSessionConversation);

// Reports
router.get('/reports', getReports);
router.patch('/reports/:id', updateReportStatus);
router.post('/reports/:id/warn', sendWarning);
router.post('/reports/:id/suspend', suspendUser);
router.post('/reports/:id/unsuspend', unsuspendUser);

module.exports = router;

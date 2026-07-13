const express = require('express');
const router = express.Router();
const { uploadAndTranscribe, getTranscriptsBySession } = require('../controllers/transcriptionController');
const { optionalAuth } = require('../middleware/auth');

// POST /api/transcribe/upload
// Body: { sessionId, callId, speaker, filename, audioBase64, archiveToGoogle }
router.post('/upload', optionalAuth, uploadAndTranscribe);

// GET /api/transcribe/session/:sessionId
// Retrieve all transcripts for a session
router.get('/session/:sessionId', optionalAuth, getTranscriptsBySession);

module.exports = router;

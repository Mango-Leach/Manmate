const fs = require('fs');
const path = require('path');
const logger = require('../utils/logger');
const transcriptionService = require('../services/transcriptionService');
const TranscriptModel = require('../models/Transcript');

const CONFIDENCE_THRESHOLD = parseFloat(process.env.STT_CONFIDENCE_THRESHOLD || '0.75');
const ALLOW_EMPTY_TRANSCRIPTS = String(process.env.ALLOW_EMPTY_TRANSCRIPTS || '').toLowerCase() === 'true';

async function uploadAndTranscribe(req, res, next) {
  let filePath = null;
  try {
    const { sessionId, callId, speaker, filename, audioBase64, archiveToGoogle } = req.body || {};
    if (!audioBase64 || !sessionId) {
      logger.warn('[Transcription] Missing required fields: sessionId or audioBase64');
      return res.status(400).json({ error: 'sessionId and audioBase64 are required' });
    }

    const audioSizeKB = Math.round(audioBase64.length / 1024);
    logger.info(`[Transcription] Upload received: sessionId=${sessionId}, speaker=${speaker || 'unknown'}, audioSize=${audioSizeKB}KB`);

    const safeFilename = (filename || 'upload.wav').replace(/[^a-zA-Z0-9.\-\_]/g, '_');
    filePath = await transcriptionService.saveBase64ToFile(audioBase64, safeFilename);
    logger.info(`[Transcription] File saved temporarily: ${filePath}`);

    // Primary: Whisper
    logger.info(`[Transcription] Starting Whisper transcription for sessionId=${sessionId}...`);
    const whisperResult = await transcriptionService.transcribeWithWhisper(filePath, { model: 'medium' });
    logger.info(`[Transcription] Whisper result: text_length=${(whisperResult.text || '').length}, confidence=${(whisperResult.confidence || 0).toFixed(2)}, language=${whisperResult.language || 'unknown'}`);

    let final = whisperResult;
    let processor = 'whisper';

    // Decide fallback to Sarvam
    const lowConfidence = (whisperResult.confidence || 0) < CONFIDENCE_THRESHOLD;
    const isHindi = (whisperResult.language || '').toLowerCase().startsWith('hi');
    if ((lowConfidence || isHindi) && process.env.SARVAM_API_KEY) {
      logger.info(`[Transcription] Attempting Sarvam fallback (lowConfidence=${lowConfidence}, isHindi=${isHindi})...`);
      const sarvamResult = await transcriptionService.transcribeWithSarvam(filePath);
      // Prefer sarvam if it yields non-empty transcript and higher confidence
      if (sarvamResult.text && (sarvamResult.confidence || 0) >= (whisperResult.confidence || 0)) {
        logger.info(`[Transcription] Using Sarvam result (confidence=${(sarvamResult.confidence || 0).toFixed(2)})`);
        final = sarvamResult;
        processor = 'sarvam';
      }
    }

    if (!ALLOW_EMPTY_TRANSCRIPTS && (!final.text || final.text.trim().length === 0)) {
      logger.warn(`[Transcription] Empty transcript discarded: sessionId=${sessionId}, speaker=${speaker || 'unknown'}, processor=${processor}, failedAudioPath=${final.failedAudioPath || 'n/a'}`);
      return res.status(422).json({
        error: 'Transcription produced empty text',
        sessionId,
        speaker: speaker || 'unknown',
        processor,
        failedAudioPath: final.failedAudioPath || null,
      });
    }

    // Persist to DB
    const record = {
      sessionId,
      callId: callId || null,
      speaker: speaker || 'unknown',
      text: final.text || '',
      segments: final.segments || [],
      confidence: final.confidence || 0,
      processor,
      model: final.model || null,
      audioPath: final.failedAudioPath || null,
    };
    const saved = await TranscriptModel.insert(record);
    logger.info(`[Transcription] Saved to DB: sessionId=${sessionId}, recordId=${saved._id}, processor=${processor}, textLength=${(saved.text || '').length}`);

    // Optionally create Google Doc copy
    let doc = null;
    if (archiveToGoogle === 'true' || archiveToGoogle === true) {
      logger.info(`[Transcription] Creating Google Doc archive for sessionId=${sessionId}...`);
      doc = await transcriptionService.createGoogleDoc(record.text, { title: `Transcript ${sessionId}` });
      logger.info(`[Transcription] Google Doc created: ${doc}`);
    }

    logger.info(`[Transcription] Upload complete: sessionId=${sessionId}, recordId=${saved._id}`);
    // Clean up temp file
    return res.json({ saved, doc });
  } catch (err) {
    logger.error(`[Transcription] Upload error for sessionId=${req.body?.sessionId || 'unknown'}:`, err);
    next(err);
  } finally {
    if (filePath) {
      try { fs.unlinkSync(filePath); } catch (e) { /* noop */ }
    }
  }
}

async function getTranscriptsBySession(req, res, next) {
  try {
    const { sessionId } = req.params;
    if (!sessionId) {
      return res.status(400).json({ error: 'sessionId is required' });
    }
    const transcripts = await TranscriptModel.findBySession(sessionId);
    return res.json({ sessionId, transcripts });
  } catch (err) {
    logger.error('Fetch transcripts error:', err);
    next(err);
  }
}

module.exports = {
  uploadAndTranscribe,
  getTranscriptsBySession,
};

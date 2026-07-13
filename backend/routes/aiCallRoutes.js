const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const AppError = require('../utils/AppError');
const logger = require('../utils/logger');

// GET /api/ai-call/signed-url
// Returns a short-lived signed WebSocket URL for the Serenity ElevenLabs agent.
// Keeping the agent private + the API key server-side means clients can never
// connect to the agent directly or read our ElevenLabs credentials.
router.get('/signed-url', authenticate, async (req, res, next) => {
  try {
    const apiKey = process.env.ELEVENLABS_API_KEY;
    const agentId = process.env.ELEVENLABS_AGENT_ID;

    if (!apiKey || !agentId) {
      logger.error('ElevenLabs not configured: missing ELEVENLABS_API_KEY or ELEVENLABS_AGENT_ID');
      return next(new AppError('Voice assistant is not configured', 503));
    }

    const r = await fetch(
      `https://api.elevenlabs.io/v1/convai/conversation/get-signed-url?agent_id=${encodeURIComponent(agentId)}`,
      { headers: { 'xi-api-key': apiKey } }
    );

    if (!r.ok) {
      const detail = await r.text().catch(() => '');
      logger.error(`ElevenLabs signed-url failed (${r.status}): ${detail}`);
      return next(new AppError('Failed to start voice session', 502));
    }

    const data = await r.json();
    res.json({ signedUrl: data.signed_url, agentId });
  } catch (error) {
    logger.error('Error fetching ElevenLabs signed URL:', error);
    next(new AppError('Failed to start voice session', 500));
  }
});

// POST /api/ai-call/chat
// Text-based chat with the Serenity ElevenLabs agent.
// Client sends { message, history } where history is an array of
// { role: 'user'|'assistant', content: string } representing the conversation so far.
// The backend proxies to ElevenLabs Conversational AI agent REST endpoint and
// returns { reply } — the agent's text response.
router.post('/chat', authenticate, async (req, res, next) => {
  try {
    const apiKey = process.env.ELEVENLABS_API_KEY;
    const agentId = process.env.ELEVENLABS_AGENT_ID;

    if (!apiKey || !agentId) {
      logger.error('ElevenLabs not configured: missing ELEVENLABS_API_KEY or ELEVENLABS_AGENT_ID');
      return next(new AppError('Chat assistant is not configured', 503));
    }

    const { message, history = [] } = req.body;
    if (!message || typeof message !== 'string' || !message.trim()) {
      return next(new AppError('message is required', 400));
    }

    // Build the messages array — prior turns plus the new user message
    const messages = [
      ...history.map((m) => ({
        role: m.role === 'assistant' ? 'assistant' : 'user',
        content: String(m.content || ''),
      })),
      { role: 'user', content: message.trim() },
    ];

    const r = await fetch(
      `https://api.elevenlabs.io/v1/convai/agents/${encodeURIComponent(agentId)}/chat`,
      {
        method: 'POST',
        headers: {
          'xi-api-key': apiKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ messages }),
      }
    );

    if (!r.ok) {
      const detail = await r.text().catch(() => '');
      logger.error(`ElevenLabs chat failed (${r.status}): ${detail}`);
      return next(new AppError('Chat request failed', 502));
    }

    const data = await r.json();
    // ElevenLabs returns { message: { role, content } } or { content } depending on version
    const reply =
      data?.message?.content ||
      data?.content ||
      data?.reply ||
      (Array.isArray(data?.messages) ? data.messages[data.messages.length - 1]?.content : null) ||
      "I'm here with you. Could you tell me more?";

    res.json({ reply });
  } catch (error) {
    logger.error('Error in Serenity text chat:', error);
    next(new AppError('Chat request failed', 500));
  }
});

module.exports = router;

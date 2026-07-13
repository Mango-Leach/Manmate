const { google } = require('googleapis');
const path = require('path');
const Therapist = require('../models/Therapist');
const logger = require('../utils/logger');

// Load Google OAuth credentials: prefer JSON file, then GOOGLE_CREDENTIALS_JSON env var, then individual env vars
const credentialsPath = path.join(__dirname, '..', 'google-credentials.json');
let client_id, client_secret, redirect_uris;
try {
  const credentials = require(credentialsPath);
  ({ client_id, client_secret, redirect_uris } = credentials.installed || credentials.web);
} catch (_) {
  if (process.env.GOOGLE_CREDENTIALS_JSON) {
    try {
      const credentials = JSON.parse(process.env.GOOGLE_CREDENTIALS_JSON);
      ({ client_id, client_secret, redirect_uris } = credentials.installed || credentials.web);
    } catch (parseErr) {
      logger.warn('GOOGLE_CREDENTIALS_JSON is invalid JSON — Google Calendar OAuth disabled.');
    }
  } else if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
    client_id = process.env.GOOGLE_CLIENT_ID;
    client_secret = process.env.GOOGLE_CLIENT_SECRET;
    redirect_uris = [process.env.GOOGLE_CALENDAR_REDIRECT_URI || 'http://localhost:3000'];
  } else {
    logger.warn('No Google credentials found — Google Calendar OAuth disabled.');
  }
}

/**
 * Return 503 if Google credentials are not configured
 */
function credentialsNotConfigured(res) {
  if (!client_id) {
    res.status(503).json({ success: false, error: 'Google Calendar credentials not configured on this server.' });
    return true;
  }
  return false;
}

/**
 * Helper function to generate OAuth URL for a therapist
 * Can be used by both the API endpoint and email notification
 */
function generateOAuthUrl(therapistId) {
  const oauth2Client = new google.auth.OAuth2(
    client_id,
    client_secret,
    redirect_uris[0]
  );

  return oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: ['https://www.googleapis.com/auth/calendar'],
    prompt: 'consent',
    state: therapistId
  });
}

/**
 * Generate Google Calendar OAuth authorization URL for therapist
 * GET /api/therapist/calendar/auth-url
 */
exports.getAuthUrl = async (req, res) => {
  if (credentialsNotConfigured(res)) return;
  try {
    // req.user.id is the *users*-collection id; the therapist document lives in
    // the *therapists* collection with its own _id. Resolve by email — this was
    // the root cause of the calendar connect/status mismatch (bug T-3).
    const therapist = await Therapist.findByEmail(req.user.email);

    if (!therapist) {
      return res.status(404).json({
        success: false,
        error: 'Therapist profile not found for this account'
      });
    }
    const therapistId = therapist._id.toString();

    // Check if already connected
    if (therapist.googleCalendarConnected && therapist.googleRefreshToken) {
      return res.status(200).json({
        success: true,
        message: 'Google Calendar already connected',
        connected: true,
        email: therapist.googleCalendarEmail
      });
    }

    // Generate authorization URL using helper function
    const authUrl = generateOAuthUrl(therapistId);

    logger.info(`Generated OAuth URL for therapist ${therapistId}`);

    res.status(200).json({
      success: true,
      authUrl: authUrl,
      instructions: 'Click the URL to authorize your Google Calendar access'
    });

  } catch (error) {
    logger.error('Error generating auth URL:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to generate authorization URL'
    });
  }
};

/**
 * Handle OAuth callback and save refresh token
 * POST /api/therapist/calendar/callback
 * Body: { code: string, therapistId: string }
 */
exports.handleCallback = async (req, res) => {
  if (credentialsNotConfigured(res)) return;
  try {
    const { code, therapistId } = req.body;

    if (!code || !therapistId) {
      return res.status(400).json({
        success: false,
        error: 'Authorization code and therapist ID required'
      });
    }

    // Verify therapist exists
    const therapist = await Therapist.findById(therapistId);
    if (!therapist) {
      return res.status(404).json({
        success: false,
        error: 'Therapist not found'
      });
    }

    // Create OAuth2 client
    const oauth2Client = new google.auth.OAuth2(
      client_id,
      client_secret,
      redirect_uris[0]
    );

    // Exchange authorization code for tokens
    const { tokens } = await oauth2Client.getToken(code);
    const refreshToken = tokens.refresh_token;

    if (!refreshToken) {
      return res.status(400).json({
        success: false,
        error: 'Failed to obtain refresh token. Please try again.'
      });
    }

    // Get user info to confirm email
    oauth2Client.setCredentials(tokens);
    const oauth2 = google.oauth2({ version: 'v2', auth: oauth2Client });
    const userInfo = await oauth2.userinfo.get();
    const googleEmail = userInfo.data.email;

    // Update therapist with refresh token
    await Therapist.update(therapistId, {
      googleRefreshToken: refreshToken,
      googleCalendarConnected: true,
      googleCalendarEmail: googleEmail
    });

    logger.info(`✅ Google Calendar connected for therapist ${therapistId} (${googleEmail})`);

    res.status(200).json({
      success: true,
      message: 'Google Calendar connected successfully!',
      email: googleEmail
    });

  } catch (error) {
    logger.error('Error handling OAuth callback:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to connect Google Calendar. Please try again.'
    });
  }
};

/**
 * Disconnect Google Calendar
 * DELETE /api/therapist/calendar/disconnect
 */
exports.disconnectCalendar = async (req, res) => {
  if (credentialsNotConfigured(res)) return;
  try {
    // Resolve by email — req.user.id belongs to the users collection (bug T-3).
    const therapist = await Therapist.findByEmail(req.user.email);
    if (!therapist) {
      return res.status(404).json({
        success: false,
        error: 'Therapist profile not found for this account'
      });
    }
    const therapistId = therapist._id.toString();

    await Therapist.update(therapistId, {
      googleRefreshToken: null,
      googleCalendarConnected: false,
      googleCalendarEmail: null,
      // Auto-Meet cannot work without a connected calendar (bug T-4).
      autoCreateMeet: false
    });

    logger.info(`Google Calendar disconnected for therapist ${therapistId}`);

    res.status(200).json({
      success: true,
      message: 'Google Calendar disconnected successfully'
    });

  } catch (error) {
    logger.error('Error disconnecting calendar:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to disconnect Google Calendar'
    });
  }
};

/**
 * Get calendar connection status
 * GET /api/therapist/calendar/status
 */
exports.getStatus = async (req, res) => {
  if (credentialsNotConfigured(res)) return;
  try {
    // Resolve by email — req.user.id belongs to the users collection (bug T-3).
    const therapist = await Therapist.findByEmail(req.user.email);

    if (!therapist) {
      return res.status(404).json({
        success: false,
        error: 'Therapist profile not found for this account'
      });
    }

    // "Connected" requires an actual refresh token — a stale flag without a
    // token means calendar calls would fail, so report it as disconnected.
    const connected = Boolean(therapist.googleCalendarConnected && therapist.googleRefreshToken);

    res.status(200).json({
      success: true,
      connected,
      email: connected ? (therapist.googleCalendarEmail || null) : null,
      autoCreateMeet: connected ? therapist.autoCreateMeet !== false : false
    });

  } catch (error) {
    logger.error('Error getting calendar status:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get calendar status'
    });
  }
};

// Export helper function for use in other controllers
module.exports.generateOAuthUrl = generateOAuthUrl;

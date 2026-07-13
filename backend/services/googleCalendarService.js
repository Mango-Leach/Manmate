const { google } = require('googleapis');
const path = require('path');
const logger = require('../utils/logger');

function loadCredentials() {
  // 1. Try google-credentials.json file
  try {
    const credentialsPath = path.join(__dirname, '..', 'google-credentials.json');
    const creds = require(credentialsPath);
    return creds.installed || creds.web;
  } catch (_) {}

  // 2. Try GOOGLE_CREDENTIALS_JSON env var (full JSON string)
  if (process.env.GOOGLE_CREDENTIALS_JSON) {
    try {
      const creds = JSON.parse(process.env.GOOGLE_CREDENTIALS_JSON);
      return creds.installed || creds.web;
    } catch (_) {
      logger.warn('GOOGLE_CREDENTIALS_JSON is invalid JSON');
    }
  }

  // 3. Use individual env vars (GOOGLE_CLIENT_ID + GOOGLE_CLIENT_SECRET)
  if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
    return {
      client_id: process.env.GOOGLE_CLIENT_ID,
      client_secret: process.env.GOOGLE_CLIENT_SECRET,
      redirect_uris: [
        process.env.GOOGLE_CALENDAR_REDIRECT_URI || 'http://localhost:3000'
      ]
    };
  }

  return null;
}

class GoogleCalendarService {
  constructor() {
    this.calendar = null;
    this.auth = null;
    this.clientConfig = null;
    this.initialize();
  }

  async initialize() {
    try {
      this.clientConfig = loadCredentials();

      if (!this.clientConfig) {
        logger.warn('Google OAuth credentials not configured — Google Calendar service disabled.');
        return;
      }

      const { client_id, client_secret, redirect_uris } = this.clientConfig;

      this.auth = new google.auth.OAuth2(client_id, client_secret, redirect_uris[0]);

      if (process.env.GOOGLE_REFRESH_TOKEN) {
        this.auth.setCredentials({
          refresh_token: process.env.GOOGLE_REFRESH_TOKEN,
          token_type: 'Bearer'
        });
        this.calendar = google.calendar({ version: 'v3', auth: this.auth });
        logger.info('Google Calendar service initialized (admin refresh token set)');
      } else {
        logger.warn('GOOGLE_REFRESH_TOKEN not set — admin calendar fallback disabled. Therapists must connect their own calendar.');
      }
    } catch (error) {
      logger.error('Failed to initialize Google Calendar service:', error.message);
    }
  }

  createCustomAuthClient(refreshToken) {
    const { client_id, client_secret, redirect_uris } = this.clientConfig;

    const oauth2Client = new google.auth.OAuth2(client_id, client_secret, redirect_uris[0]);
    oauth2Client.setCredentials({ refresh_token: refreshToken, token_type: 'Bearer' });

    return {
      auth: oauth2Client,
      calendar: google.calendar({ version: 'v3', auth: oauth2Client })
    };
  }

  /**
   * Resolve the calendar client to operate on an event. Prefer the therapist's
   * own calendar (the event was created there), and fall back to the admin
   * calendar. The same selection must be used for create/update/delete so we
   * don't, e.g., create on the therapist's calendar but try to delete from the
   * admin's.
   * @param {string|null|undefined} therapistRefreshToken
   */
  getCalendarClient(therapistRefreshToken) {
    if (therapistRefreshToken && this.clientConfig) {
      logger.info('Using therapist\'s own Google Calendar');
      return this.createCustomAuthClient(therapistRefreshToken).calendar;
    }
    if (this.calendar) {
      logger.info('Using admin Google Calendar fallback');
      return this.calendar;
    }
    throw new Error('No Google Calendar credentials available. Therapist must connect their Google Calendar.');
  }

  async createAppointmentEvent(eventDetails) {
    const {
      summary,
      description,
      startDateTime,
      endDateTime,
      therapistEmail,
      therapistName,
      clientEmail,
      clientName,
      therapistRefreshToken
    } = eventDetails;

    const calendar = this.getCalendarClient(therapistRefreshToken);

    const event = {
      summary: summary || `Therapy Session - ${therapistName} & ${clientName}`,
      description: description || 'Scheduled therapy session via StressReliefChat',
      start: {
        dateTime: startDateTime.toISOString(),
        timeZone: 'Asia/Kolkata',
      },
      end: {
        dateTime: endDateTime.toISOString(),
        timeZone: 'Asia/Kolkata',
      },
      attendees: [
        {
          email: therapistEmail,
          displayName: therapistName,
          organizer: true,
          responseStatus: 'accepted'
        },
        {
          email: clientEmail,
          displayName: clientName,
          responseStatus: 'needsAction'
        }
      ],
      conferenceData: {
        createRequest: {
          requestId: `therapy-${Date.now()}`,
          conferenceSolutionKey: { type: 'hangoutsMeet' }
        }
      },
      guestsCanModifyEvent: false,
      guestsCanInviteOthers: false,
      guestsCanSeeOtherGuests: true,
      reminders: {
        useDefault: false,
        overrides: [
          { method: 'email', minutes: 60 },
          { method: 'popup', minutes: 15 }
        ]
      }
    };

    try {
      const response = await calendar.events.insert({
        calendarId: 'primary',
        resource: event,
        conferenceDataVersion: 1,
        sendUpdates: 'none'
      });

      const createdEvent = response.data;
      const meetLink = createdEvent.hangoutLink ||
        createdEvent.conferenceData?.entryPoints?.find(ep => ep.entryPointType === 'video')?.uri;

      logger.info(`✅ Calendar event created with Meet link: ${meetLink}`);

      return {
        eventId: createdEvent.id,
        meetLink,
        htmlLink: createdEvent.htmlLink,
        event: createdEvent
      };
    } catch (error) {
      logger.error('Failed to create calendar event:', error.message);
      if (error.code === 401) {
        logger.error('Google OAuth token expired or invalid. Therapist must reconnect their Google Calendar.');
      }
      throw new Error(`Calendar event creation failed: ${error.message}`);
    }
  }

  async updateAppointmentEvent(eventId, updates, therapistRefreshToken) {
    try {
      const calendar = this.getCalendarClient(therapistRefreshToken);
      const response = await calendar.events.patch({
        calendarId: 'primary',
        eventId,
        resource: updates,
        sendUpdates: 'none'
      });
      logger.info(`✅ Calendar event updated: ${eventId}`);
      return response.data;
    } catch (error) {
      logger.error('Failed to update calendar event:', error.message);
      throw error;
    }
  }

  async deleteAppointmentEvent(eventId, therapistRefreshToken) {
    try {
      const calendar = this.getCalendarClient(therapistRefreshToken);
      await calendar.events.delete({
        calendarId: 'primary',
        eventId,
        sendUpdates: 'none'
      });
      logger.info(`✅ Calendar event deleted: ${eventId}`);
      return true;
    } catch (error) {
      logger.error('Failed to delete calendar event:', error.message);
      throw error;
    }
  }

  getAuthUrl() {
    const SCOPES = ['https://www.googleapis.com/auth/calendar'];
    return this.auth.generateAuthUrl({
      access_type: 'offline',
      scope: SCOPES,
      prompt: 'consent'
    });
  }

  async getTokensFromCode(code) {
    const { tokens } = await this.auth.getToken(code);
    this.auth.setCredentials(tokens);
    logger.info('Google OAuth tokens obtained');
    return tokens;
  }
}

module.exports = new GoogleCalendarService();

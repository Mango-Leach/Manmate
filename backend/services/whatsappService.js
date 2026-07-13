const axios = require('axios');
const logger = require('../utils/logger');

class WhatsAppService {
  constructor() {
    this.apiVersion = process.env.WHATSAPP_API_VERSION || 'v21.0';
    this.phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
    this.accessToken = process.env.WHATSAPP_ACCESS_TOKEN;
    this.baseUrl = `https://graph.facebook.com/${this.apiVersion}/${this.phoneNumberId}/messages`;
  }

  /**
     * Check if WhatsApp service is properly configured
     */
  isConfigured() {
    return !!(this.phoneNumberId && this.accessToken);
  }

  /**
     * Format phone number to international format (E.164)
     * Assumes Indian numbers if no country code provided
     */
  formatPhoneNumber(number) {
    if (!number) return null;
    let cleaned = number.replace(/\D/g, '');

    // If it's a 10-digit Indian number, prefix with 91
    if (cleaned.length === 10) {
      cleaned = '91' + cleaned;
    }

    return cleaned;
  }

  /**
     * Send a template message via Meta WhatsApp Cloud API
     */
  async sendTemplateMessage(to, templateName, languageCode = 'en', components = []) {
    if (!this.isConfigured()) {
      logger.warn('WhatsApp service not configured. Skipping message.');
      return null;
    }

    const formattedNumber = this.formatPhoneNumber(to);
    if (!formattedNumber) {
      logger.warn('Invalid phone number provided for WhatsApp message.');
      return null;
    }

    const payload = {
      messaging_product: 'whatsapp',
      to: formattedNumber,
      type: 'template',
      template: {
        name: templateName,
        language: { code: languageCode },
      }
    };

    // Add components (body parameters, header, etc.) if provided
    if (components.length > 0) {
      payload.template.components = components;
    }

    try {
      const response = await axios.post(this.baseUrl, payload, {
        headers: {
          'Authorization': `Bearer ${this.accessToken}`,
          'Content-Type': 'application/json'
        }
      });

      logger.info(`✅ WhatsApp template "${templateName}" sent to +${formattedNumber}`, {
        messageId: response.data?.messages?.[0]?.id
      });

      return response.data;
    } catch (error) {
      const errData = error.response?.data?.error || error.message;
      logger.error(`❌ WhatsApp send failed to +${formattedNumber}:`, errData);
      return null;
    }
  }

  /**
     * Send a plain text message (only works within 24-hour customer service window)
     */
  async sendTextMessage(to, text) {
    if (!this.isConfigured()) {
      logger.warn('WhatsApp service not configured. Skipping message.');
      return null;
    }

    const formattedNumber = this.formatPhoneNumber(to);
    if (!formattedNumber) {
      logger.warn('Invalid phone number provided for WhatsApp message.');
      return null;
    }

    const payload = {
      messaging_product: 'whatsapp',
      to: formattedNumber,
      type: 'text',
      text: { body: text }
    };

    try {
      const response = await axios.post(this.baseUrl, payload, {
        headers: {
          'Authorization': `Bearer ${this.accessToken}`,
          'Content-Type': 'application/json'
        }
      });

      logger.info(`✅ WhatsApp text message sent to +${formattedNumber}`, {
        messageId: response.data?.messages?.[0]?.id
      });

      return response.data;
    } catch (error) {
      const errData = error.response?.data?.error || error.message;
      logger.error(`❌ WhatsApp text send failed to +${formattedNumber}:`, errData);
      return null;
    }
  }

  /**
     * Send appointment confirmation after booking.
     * Template: "Hello, your appointment with {{1}} on {{2}} at {{3}} has been confirmed."
     */
  async sendAppointmentConfirmation(whatsappNumber, appointmentDetails) {
    const { therapistName, date, timeSlot } = appointmentDetails;

    const components = [
      {
        type: 'body',
        parameters: [
          { type: 'text', text: therapistName || 'your therapist' },
          { type: 'text', text: this.formatDate(date) },
          { type: 'text', text: timeSlot || 'scheduled time' }
        ]
      }
    ];

    return await this.sendTemplateMessage(whatsappNumber, 'appointment_confirmation', 'en_US', components);
  }

  /**
     * Send appointment reminder (X hours before)
     * Template: "🔔 Reminder: You have an upcoming appointment with {{1}} on {{2}} at {{3}}..."
     */
  async sendAppointmentReminder(whatsappNumber, appointmentDetails) {
    const { therapistName, date, timeSlot } = appointmentDetails;

    const components = [
      {
        type: 'body',
        parameters: [
          { type: 'text', text: therapistName || 'your therapist' },
          { type: 'text', text: this.formatDate(date) },
          { type: 'text', text: timeSlot || 'scheduled time' }
        ]
      }
    ];

    let result = await this.sendTemplateMessage(whatsappNumber, 'appointment_reminder', 'en', components);

    if (!result) {
      logger.info('⚠️ appointment_reminder template failed, falling back to hello_world');
      result = await this.sendTemplateMessage(whatsappNumber, 'hello_world');
    }

    return result;
  }

  /**
     * Send status update (confirmed / cancelled / completed)
     * Template: "...Your appointment with {{1}} has been {{2}}..."
     */
  async sendStatusUpdate(whatsappNumber, status, appointmentDetails) {
    const { therapistName } = appointmentDetails;

    const components = [
      {
        type: 'body',
        parameters: [
          { type: 'text', text: therapistName || 'your therapist' },
          { type: 'text', text: status }
        ]
      }
    ];

    let result = await this.sendTemplateMessage(whatsappNumber, 'appointment_status_update', 'en', components);

    if (!result) {
      logger.info('⚠️ appointment_status_update template failed, falling back to hello_world');
      result = await this.sendTemplateMessage(whatsappNumber, 'hello_world');
    }

    return result;
  }

  /**
     * Quick test method — sends the pre-approved "hello_world" template
     * Use this to verify your API credentials are working
     */
  async sendTestMessage(whatsappNumber) {
    return await this.sendTemplateMessage(whatsappNumber, 'hello_world');
  }

  /**
     * Format a date for display in WhatsApp messages
     */
  formatDate(date) {
    if (!date) return 'N/A';
    const d = new Date(date);
    return d.toLocaleDateString('en-IN', {
      weekday: 'short',
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  }
}

module.exports = new WhatsAppService();

const nodemailer = require('nodemailer');
const axios = require('axios');
const logger = require('../utils/logger');

class EmailService {
  constructor() {
    this.transporter = null;
    this.elasticEmailApiKey = process.env.ELASTIC_EMAIL_API_KEY?.trim() || null;
    this.initialize();
  }

  initialize() {
    // Elastic Email's REST API uses HTTPS, which works on Render free instances
    // where outbound SMTP ports are blocked. Keep SMTP available for local use.
    if (this.elasticEmailApiKey) {
      logger.info('Email service initialized — Elastic Email API configured');
      return;
    }

    const port = parseInt(process.env.SMTP_PORT || '587');
    const isSSL = port === 465;

    // Configure email transporter
    // Gmail App Passwords are shown with spaces for readability but auth requires no spaces
    const smtpPassword = (process.env.SMTP_PASSWORD || '').replace(/\s/g, '');

    const emailConfig = {
      host: process.env.SMTP_HOST || 'smtp.gmail.com',
      port,
      secure: isSSL, // true for 465 (SSL), false for 587 (STARTTLS)
      auth: {
        user: process.env.SMTP_USER,
        pass: smtpPassword,
      },
      // Force IPv4 — Render/cloud platforms often lack IPv6 connectivity
      family: 4,
      // For port 587: upgrade to TLS after connecting
      ...(!isSSL && { requireTLS: true }),
      tls: {
        rejectUnauthorized: false,
      },
      // Use shorter timeouts so failures surface faster
      connectionTimeout: 15000,
      greetingTimeout: 15000,
      socketTimeout: 15000,
      logger: false,
      debug: false,
    };

    // Only create transporter if credentials are provided
    if (emailConfig.auth.user && smtpPassword) {
      this.transporter = nodemailer.createTransport(emailConfig);
      // Verify SMTP connection at startup so misconfiguration shows in logs immediately
      this.transporter.verify((error) => {
        if (error) {
          logger.error(`SMTP connection failed: ${error.message}`);
        } else {
          logger.info('Email service initialized — SMTP connection verified');
        }
      });
    } else {
      logger.warn('Email credentials not configured - emails will be logged only');
    }
  }

  async sendEmail({ to, subject, html, text }) {
    try {
      if (this.elasticEmailApiKey) {
        const from = process.env.EMAIL_FROM;
        if (!from) {
          throw new Error('EMAIL_FROM must be set to a verified Elastic Email sender');
        }

        const body = [];
        if (html) body.push({ ContentType: 'HTML', Content: html, Charset: 'utf-8' });
        if (text) body.push({ ContentType: 'PlainText', Content: text, Charset: 'utf-8' });

        const response = await axios.post('https://api.elasticemail.com/v4/emails/transactional', {
          Recipients: { To: [to] },
          Content: {
            From: from,
            Subject: subject,
            Body: body,
          },
        }, {
          headers: {
            'X-ElasticEmail-ApiKey': this.elasticEmailApiKey,
            'Content-Type': 'application/json',
          },
          timeout: 15000,
        });

        const messageId = response.data?.MessageID || response.data?.TransactionID || 'accepted';
        logger.info(`Email accepted by Elastic Email for ${to}: ${messageId}`);
        return { success: true, messageId };
      }

      if (!this.transporter) {
        // In development, just log the email
        logger.info('EMAIL (not sent - no transporter):', {
          to,
          subject,
          text: text || 'See HTML',
        });
        return { success: true, messageId: 'dev-mode' };
      }

      const mailOptions = {
        from: process.env.EMAIL_FROM || process.env.SMTP_USER,
        to,
        subject,
        html,
        text,
      };

      const info = await this.transporter.sendMail(mailOptions);
      logger.info(`Email sent to ${to}: ${info.messageId}`);
      return { success: true, messageId: info.messageId };
    } catch (error) {
      // Avoid logging Axios request config, which contains the API key header.
      if (this.elasticEmailApiKey) {
        const providerMessage = error.response?.data?.Error || error.response?.data?.message || error.message;
        logger.error(`Elastic Email API send failed (${error.response?.status || 'network'}): ${providerMessage}`);
      } else {
        logger.error('Failed to send email:', error);
      }
      throw error;
    }
  }

  async sendOTP(email, otp) {
    const subject = 'Your StressReliefChat Login Code';
    const html = `
            <!DOCTYPE html>
            <html>
            <head>
                <style>
                    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
                    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                    .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
                    .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
                    .otp-code { font-size: 32px; font-weight: bold; color: #667eea; text-align: center; letter-spacing: 8px; padding: 20px; background: white; border-radius: 8px; margin: 20px 0; }
                    .footer { text-align: center; margin-top: 20px; color: #666; font-size: 12px; }
                    .warning { color: #e74c3c; font-weight: bold; }
                </style>
            </head>
            <body>
                <div class="container">
                    <div class="header">
                        <h1>🔐 Login Verification</h1>
                    </div>
                    <div class="content">
                        <p>Hello,</p>
                        <p>You requested a login code for StressReliefChat. Use the code below to complete your login:</p>
                        <div class="otp-code">${otp}</div>
                        <p>This code will expire in <strong>5 minutes</strong>.</p>
                        <p class="warning">⚠️ If you didn't request this code, please ignore this email.</p>
                        <p>For your security, never share this code with anyone.</p>
                    </div>
                    <div class="footer">
                        <p>© 2024 StressReliefChat - Your mental wellness companion</p>
                    </div>
                </div>
            </body>
            </html>
        `;
    const text = `Your StressReliefChat login code is: ${otp}\n\nThis code will expire in 5 minutes.\n\nIf you didn't request this code, please ignore this email.`;

    // Log OTP in console for development when email is not configured
    if (!this.transporter) {
      logger.info(`📧 OTP for ${email}: ${otp} (Email not sent - SMTP not configured)`);
      logger.info('💡 Check backend console for OTP code');
    }

    return await this.sendEmail({ to: email, subject, html, text });
  }

  async sendEmailVerification(email, token) {
    const verificationUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/verify-email?token=${token}`;
    const subject = 'Verify Your Email - StressReliefChat';
    const html = `
            <!DOCTYPE html>
            <html>
            <head>
                <style>
                    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
                    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                    .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
                    .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
                    .button { display: inline-block; padding: 15px 30px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; text-decoration: none; border-radius: 8px; font-weight: bold; margin: 20px 0; }
                    .footer { text-align: center; margin-top: 20px; color: #666; font-size: 12px; }
                </style>
            </head>
            <body>
                <div class="container">
                    <div class="header">
                        <h1>✉️ Verify Your Email</h1>
                    </div>
                    <div class="content">
                        <p>Welcome to StressReliefChat!</p>
                        <p>Please verify your email address to complete your registration:</p>
                        <div style="text-align: center;">
                            <a href="${verificationUrl}" class="button">Verify Email Address</a>
                        </div>
                        <p>Or copy and paste this link into your browser:</p>
                        <p style="word-break: break-all; color: #667eea;">${verificationUrl}</p>
                        <p>This link will expire in 24 hours.</p>
                    </div>
                    <div class="footer">
                        <p>© 2024 StressReliefChat - Your mental wellness companion</p>
                    </div>
                </div>
            </body>
            </html>
        `;
    const text = `Welcome to StressReliefChat!\n\nPlease verify your email address by clicking this link:\n${verificationUrl}\n\nThis link will expire in 24 hours.`;

    return await this.sendEmail({ to: email, subject, html, text });
  }

  async sendPasswordReset(email, token) {
    const resetUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/reset-password?token=${token}`;
    const subject = 'Reset Your Password - StressReliefChat';
    const html = `
            <!DOCTYPE html>
            <html>
            <head>
                <style>
                    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
                    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                    .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
                    .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
                    .button { display: inline-block; padding: 15px 30px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; text-decoration: none; border-radius: 8px; font-weight: bold; margin: 20px 0; }
                    .footer { text-align: center; margin-top: 20px; color: #666; font-size: 12px; }
                    .warning { color: #e74c3c; font-weight: bold; }
                </style>
            </head>
            <body>
                <div class="container">
                    <div class="header">
                        <h1>🔑 Password Reset</h1>
                    </div>
                    <div class="content">
                        <p>You requested to reset your password for StressReliefChat.</p>
                        <p>Click the button below to reset your password:</p>
                        <div style="text-align: center;">
                            <a href="${resetUrl}" class="button">Reset Password</a>
                        </div>
                        <p>Or copy and paste this link into your browser:</p>
                        <p style="word-break: break-all; color: #667eea;">${resetUrl}</p>
                        <p>This link will expire in 1 hour.</p>
                        <p class="warning">⚠️ If you didn't request this, please ignore this email and your password will remain unchanged.</p>
                    </div>
                    <div class="footer">
                        <p>© 2024 StressReliefChat - Your mental wellness companion</p>
                    </div>
                </div>
            </body>
            </html>
        `;
    const text = `You requested to reset your password for StressReliefChat.\n\nClick this link to reset your password:\n${resetUrl}\n\nThis link will expire in 1 hour.\n\nIf you didn't request this, please ignore this email.`;

    return await this.sendEmail({ to: email, subject, html, text });
  }

  async sendAppointmentConfirmation({
    clientEmail,
    clientName,
    therapistEmail,
    therapistName,
    date,
    timeSlot,
    meetLink,
    notes
  }) {
    const formattedDate = new Date(date).toLocaleDateString('en-IN', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });

    // Email to Client
    const clientSubject = '📩 Booking Received — Pending Confirmation - StressReliefChat';
    const clientHtml = `
            <!DOCTYPE html>
            <html>
            <head>
                <style>
                    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
                    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                    .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
                    .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
                    .info-box { background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #667eea; }
                    .button { display: inline-block; padding: 15px 30px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; text-decoration: none; border-radius: 8px; font-weight: bold; margin: 20px 0; }
                    .footer { text-align: center; margin-top: 20px; color: #666; font-size: 12px; }
                    .highlight { color: #667eea; font-weight: bold; }
                </style>
            </head>
            <body>
                <div class="container">
                    <div class="header">
                        <h1>📩 We've Received Your Booking Request</h1>
                    </div>
                    <div class="content">
                        <p>Dear ${clientName},</p>
                        <p>Your therapy session request has been received and is <strong>pending confirmation</strong> from your therapist. We'll email you again as soon as it's confirmed.</p>

                        <div class="info-box">
                            <h3 style="margin-top: 0;">📅 Requested Appointment Details</h3>
                            <p><strong>Therapist:</strong> ${therapistName}</p>
                            <p><strong>Date:</strong> ${formattedDate}</p>
                            <p><strong>Time:</strong> ${timeSlot}</p>
                            <p><strong>Status:</strong> Pending confirmation</p>
                            ${notes ? `<p><strong>Notes:</strong> ${notes}</p>` : ''}
                        </div>

                        ${meetLink ? `
                        <div style="text-align: center;">
                            <p><strong>🎥 Your Google Meet link (active once confirmed):</strong></p>
                            <a href="${meetLink}" class="button">Join Meeting</a>
                            <p style="font-size: 12px; color: #666;">Or copy this link: <a href="${meetLink}">${meetLink}</a></p>
                        </div>
                        ` : '<p><em>A meeting link will be shared once your therapist confirms.</em></p>'}

                        <div class="info-box">
                            <h4>📝 Before Your Session:</h4>
                            <ul>
                                <li>Find a quiet, private space</li>
                                <li>Test your camera and microphone</li>
                                <li>Prepare any topics you'd like to discuss</li>
                                <li>Join 5 minutes early if possible</li>
                            </ul>
                        </div>

                        <p>If you need to reschedule or cancel, please contact us as soon as possible.</p>
                        <p>Looking forward to supporting your wellness journey! 💚</p>
                    </div>
                    <div class="footer">
                        <p>© 2024 StressReliefChat - Your mental wellness companion</p>
                    </div>
                </div>
            </body>
            </html>
        `;

    // Email to Therapist
    const therapistSubject = '🔔 New Appointment Scheduled - StressReliefChat';
    const therapistHtml = `
            <!DOCTYPE html>
            <html>
            <head>
                <style>
                    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
                    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                    .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
                    .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
                    .info-box { background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #764ba2; }
                    .button { display: inline-block; padding: 15px 30px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; text-decoration: none; border-radius: 8px; font-weight: bold; margin: 20px 0; }
                    .footer { text-align: center; margin-top: 20px; color: #666; font-size: 12px; }
                </style>
            </head>
            <body>
                <div class="container">
                    <div class="header">
                        <h1>📅 New Session Scheduled</h1>
                    </div>
                    <div class="content">
                        <p>Dear ${therapistName},</p>
                        <p>A new therapy session has been scheduled with a client.</p>
                        
                        <div class="info-box">
                            <h3 style="margin-top: 0;">📋 Session Details</h3>
                            <p><strong>Client:</strong> ${clientName}</p>
                            <p><strong>Client Email:</strong> ${clientEmail}</p>
                            <p><strong>Date:</strong> ${formattedDate}</p>
                            <p><strong>Time:</strong> ${timeSlot}</p>
                            ${notes ? `<p><strong>Client Notes:</strong> ${notes}</p>` : ''}
                        </div>

                        ${meetLink ? `
                        <div style="text-align: center;">
                            <p><strong>🎥 Meeting Link:</strong></p>
                            <a href="${meetLink}" class="button">Join Meeting</a>
                            <p style="font-size: 12px; color: #666;">Or copy this link: <a href="${meetLink}">${meetLink}</a></p>
                        </div>
                        ` : '<p><em>Meeting link will be shared shortly.</em></p>'}

                        <div class="info-box">
                            <h4>📋 Preparation Reminder:</h4>
                            <ul>
                                <li>Review client notes before the session</li>
                                <li>Ensure a quiet, professional environment</li>
                                <li>Test your equipment beforehand</li>
                                <li>Have necessary resources ready</li>
                            </ul>
                        </div>

                        <p>You can view all your appointments in your therapist dashboard.</p>
                        <p>Thank you for your dedication to mental wellness! 🙏</p>
                    </div>
                    <div class="footer">
                        <p>© 2024 StressReliefChat - Your mental wellness companion</p>
                    </div>
                </div>
            </body>
            </html>
        `;

    // Send both emails in parallel
    try {
      const [clientResult, therapistResult] = await Promise.all([
        this.sendEmail({
          to: clientEmail,
          subject: clientSubject,
          html: clientHtml,
          text: `We've received your booking request — it's pending confirmation from your therapist.\n\nTherapist: ${therapistName}\nDate: ${formattedDate}\nTime: ${timeSlot}\nStatus: Pending confirmation\n\n${meetLink ? `Meeting Link (active once confirmed): ${meetLink}` : 'A meeting link will be shared once confirmed.'}`
        }),
        this.sendEmail({
          to: therapistEmail,
          subject: therapistSubject,
          html: therapistHtml,
          text: `New appointment scheduled!\n\nClient: ${clientName} (${clientEmail})\nDate: ${formattedDate}\nTime: ${timeSlot}\n\n${meetLink ? `Meeting Link: ${meetLink}` : 'Meeting link will be shared shortly.'}`
        })
      ]);

      logger.info(`✅ Client email sent to: ${clientEmail}`);
      logger.info(`✅ Therapist email sent to: ${therapistEmail}`);

      return {
        success: true,
        clientEmailId: clientResult.messageId,
        therapistEmailId: therapistResult.messageId
      };
    } catch (error) {
      logger.error('Failed to send appointment emails:', error);
      throw error;
    }
  }

  async sendClientAppointmentReminder({
    clientEmail,
    clientName,
    therapistName,
    date,
    timeSlot,
    meetLink,
    reminderType
  }) {
    const formattedDate = new Date(date).toLocaleDateString('en-IN', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });

    const reminderLabels = {
      one_hour: { title: '⏰ Reminder: Session in 1 Hour', line: 'Your therapy session starts in about 1 hour.' },
      thirty_minutes: { title: '⏰ Reminder: Session in 30 Minutes', line: 'Your therapy session starts in about 30 minutes. Your Google Meet link is below.' },
      five_minutes: { title: '🚨 Reminder: Session in 5 Minutes', line: 'Your therapy session starts in about 5 minutes. Please join now.' }
    };
    const { title: reminderTitle, line: reminderLine } = reminderLabels[reminderType] || reminderLabels.five_minutes;

    const subject = `${reminderTitle} - StressReliefChat`;
    const html = `
            <!DOCTYPE html>
            <html>
            <head>
                <style>
                    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
                    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                    .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
                    .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
                    .info-box { background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #667eea; }
                    .button { display: inline-block; padding: 15px 30px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; text-decoration: none; border-radius: 8px; font-weight: bold; margin: 20px 0; }
                    .footer { text-align: center; margin-top: 20px; color: #666; font-size: 12px; }
                </style>
            </head>
            <body>
                <div class="container">
                    <div class="header">
                        <h1>${reminderTitle}</h1>
                    </div>
                    <div class="content">
                        <p>Dear ${clientName || 'Client'},</p>
                        <p>${reminderLine}</p>

                        <div class="info-box">
                            <h3 style="margin-top: 0;">📅 Session Details</h3>
                            <p><strong>Therapist:</strong> ${therapistName || 'Your therapist'}</p>
                            <p><strong>Date:</strong> ${formattedDate}</p>
                            <p><strong>Time:</strong> ${timeSlot}</p>
                        </div>

                        ${meetLink ? `
                        <div style="text-align: center;">
                            <a href="${meetLink}" class="button">Join Meeting</a>
                        </div>
                        <p style="font-size: 12px; color: #666;">Meeting link: <a href="${meetLink}">${meetLink}</a></p>
                        ` : '<p><em>Meeting link is not available yet. Please contact support if needed.</em></p>'}

                        <p>Wishing you a helpful and comfortable session. 💚</p>
                    </div>
                    <div class="footer">
                        <p>© 2024 StressReliefChat - Your mental wellness companion</p>
                    </div>
                </div>
            </body>
            </html>
        `;

    const text = `${reminderTitle}\n\nHi ${clientName || 'Client'},\n${reminderLine}\n\nTherapist: ${therapistName || 'Your therapist'}\nDate: ${formattedDate}\nTime: ${timeSlot}\n${meetLink ? `Meeting Link: ${meetLink}` : ''}`;

    return await this.sendEmail({
      to: clientEmail,
      subject,
      html,
      text
    });
  }

  async sendRescheduleNotification({ clientEmail, clientName, therapistName, oldDate, oldTimeSlot, newDate, newTimeSlot, meetLink }) {
    const fmtDate = (d) => new Date(d).toLocaleDateString('en-IN', {
      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
    });

    const subject = '📅 Appointment Rescheduled - StressReliefChat';
    const html = `
            <!DOCTYPE html>
            <html>
            <head>
                <style>
                    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
                    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                    .header { background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
                    .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
                    .info-box { background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #f59e0b; }
                    .old { text-decoration: line-through; color: #9ca3af; }
                    .new { color: #059669; font-weight: bold; }
                    .button { display: inline-block; padding: 15px 30px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; text-decoration: none; border-radius: 8px; font-weight: bold; margin: 20px 0; }
                    .footer { text-align: center; margin-top: 20px; color: #666; font-size: 12px; }
                </style>
            </head>
            <body>
                <div class="container">
                    <div class="header">
                        <h1>📅 Your Appointment Has Been Rescheduled</h1>
                    </div>
                    <div class="content">
                        <p>Dear ${clientName || 'Client'},</p>
                        <p>Your therapist <strong>${therapistName}</strong> has rescheduled your appointment to a new time.</p>

                        <div class="info-box">
                            <h3 style="margin-top: 0;">🗓️ Updated Appointment Details</h3>
                            <p><strong>Therapist:</strong> ${therapistName}</p>
                            <p>
                                <strong>Previous Date:</strong>
                                <span class="old">${fmtDate(oldDate)} at ${oldTimeSlot}</span>
                            </p>
                            <p>
                                <strong>New Date:</strong>
                                <span class="new">${fmtDate(newDate)} at ${newTimeSlot}</span>
                            </p>
                        </div>

                        ${meetLink ? `
                        <div style="text-align: center;">
                            <p><strong>🎥 Your meeting link remains the same:</strong></p>
                            <a href="${meetLink}" class="button">Join Meeting</a>
                            <p style="font-size: 12px; color: #666;"><a href="${meetLink}">${meetLink}</a></p>
                        </div>
                        ` : ''}

                        <p>If this new time doesn't work for you, please contact your therapist or our support team to arrange a suitable time.</p>
                        <p>We look forward to supporting your wellness journey! 💚</p>
                    </div>
                    <div class="footer">
                        <p>© 2024 StressReliefChat - Your mental wellness companion</p>
                    </div>
                </div>
            </body>
            </html>
        `;

    const text = `Your appointment has been rescheduled.\n\nTherapist: ${therapistName}\nPrevious: ${fmtDate(oldDate)} at ${oldTimeSlot}\nNew Time: ${fmtDate(newDate)} at ${newTimeSlot}\n${meetLink ? `\nMeeting Link: ${meetLink}` : ''}`;

    return await this.sendEmail({ to: clientEmail, subject, html, text });
  }

  /**
   * Notify the client when a therapist confirms or cancels their appointment.
   * @param {{clientEmail:string, clientName?:string, therapistName?:string,
   *          status:'confirmed'|'cancelled', date:Date|string, timeSlot:string,
   *          meetLink?:string|null}} params
   */
  async sendAppointmentStatusUpdate({ clientEmail, clientName, therapistName, status, date, timeSlot, meetLink }) {
    const formattedDate = new Date(date).toLocaleDateString('en-IN', {
      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
    });

    const isConfirmed = status === 'confirmed';
    const accent = isConfirmed ? '#059669' : '#dc2626';
    const subject = isConfirmed
      ? '✅ Appointment Confirmed - StressReliefChat'
      : '❌ Appointment Cancelled - StressReliefChat';
    const heading = isConfirmed
      ? '✅ Your Appointment is Confirmed!'
      : '❌ Your Appointment Was Cancelled';
    const intro = isConfirmed
      ? `Good news — <strong>${therapistName || 'your therapist'}</strong> has confirmed your therapy session.`
      : `Unfortunately, <strong>${therapistName || 'your therapist'}</strong> has cancelled your therapy session.`;
    const outro = isConfirmed
      ? '<p>Please join 5 minutes early. Looking forward to supporting your wellness journey! 💚</p>'
      : '<p>We\'re sorry for the inconvenience. You can book another session with this or another therapist anytime.</p>';

    const html = `
            <!DOCTYPE html>
            <html>
            <head>
                <style>
                    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
                    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                    .header { background: linear-gradient(135deg, ${accent} 0%, ${accent} 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
                    .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
                    .info-box { background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid ${accent}; }
                    .button { display: inline-block; padding: 15px 30px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; text-decoration: none; border-radius: 8px; font-weight: bold; margin: 20px 0; }
                    .footer { text-align: center; margin-top: 20px; color: #666; font-size: 12px; }
                </style>
            </head>
            <body>
                <div class="container">
                    <div class="header">
                        <h1>${heading}</h1>
                    </div>
                    <div class="content">
                        <p>Dear ${clientName || 'Client'},</p>
                        <p>${intro}</p>

                        <div class="info-box">
                            <h3 style="margin-top: 0;">📅 Appointment Details</h3>
                            <p><strong>Therapist:</strong> ${therapistName || 'Your therapist'}</p>
                            <p><strong>Date:</strong> ${formattedDate}</p>
                            <p><strong>Time:</strong> ${timeSlot}</p>
                        </div>

                        ${isConfirmed && meetLink ? `
                        <div style="text-align: center;">
                            <p><strong>🎥 Join your session via Google Meet:</strong></p>
                            <a href="${meetLink}" class="button">Join Meeting</a>
                            <p style="font-size: 12px; color: #666;">Or copy this link: <a href="${meetLink}">${meetLink}</a></p>
                        </div>
                        ` : ''}

                        ${outro}
                    </div>
                    <div class="footer">
                        <p>© 2024 StressReliefChat - Your mental wellness companion</p>
                    </div>
                </div>
            </body>
            </html>
        `;

    const text = isConfirmed
      ? `Your appointment is confirmed!\n\nTherapist: ${therapistName || 'Your therapist'}\nDate: ${formattedDate}\nTime: ${timeSlot}\n${meetLink ? `\nMeeting Link: ${meetLink}` : ''}`
      : `Your appointment has been cancelled.\n\nTherapist: ${therapistName || 'Your therapist'}\nDate: ${formattedDate}\nTime: ${timeSlot}\n\nYou can book another session anytime.`;

    return await this.sendEmail({ to: clientEmail, subject, html, text });
  }

  async sendWalletRecharge({ clientEmail, clientName, amount, newBalance, paymentId }) {
    const subject = '💰 Wallet Recharged Successfully - StressReliefChat';
    const html = `
            <!DOCTYPE html>
            <html>
            <head>
                <style>
                    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
                    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                    .header { background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
                    .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
                    .info-box { background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #10b981; }
                    .amount { font-size: 36px; font-weight: bold; color: #10b981; text-align: center; padding: 15px; }
                    .footer { text-align: center; margin-top: 20px; color: #666; font-size: 12px; }
                </style>
            </head>
            <body>
                <div class="container">
                    <div class="header">
                        <h1>✅ Wallet Recharged!</h1>
                    </div>
                    <div class="content">
                        <p>Dear ${clientName || 'User'},</p>
                        <p>Your StressReliefChat wallet has been recharged successfully.</p>

                        <div class="amount">+₹${amount}</div>

                        <div class="info-box">
                            <h3 style="margin-top: 0;">💳 Transaction Details</h3>
                            <p><strong>Amount Added:</strong> ₹${amount}</p>
                            <p><strong>Updated Balance:</strong> ₹${newBalance}</p>
                            <p><strong>Payment ID:</strong> ${paymentId}</p>
                            <p><strong>Date:</strong> ${new Date().toLocaleDateString('en-IN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
                        </div>

                        <p>You can now book therapy sessions using your wallet balance.</p>
                        <p>If you did not authorize this transaction, please contact our support team immediately.</p>
                        <p>Thank you for being a part of StressReliefChat! 💚</p>
                    </div>
                    <div class="footer">
                        <p>© 2024 StressReliefChat - Your mental wellness companion</p>
                    </div>
                </div>
            </body>
            </html>
        `;
    const text = `Your StressReliefChat wallet has been recharged successfully.\n\nAmount Added: ₹${amount}\nUpdated Balance: ₹${newBalance}\nPayment ID: ${paymentId}\n\nIf you did not authorize this transaction, please contact our support team immediately.`;

    return await this.sendEmail({ to: clientEmail, subject, html, text });
  }

  /**
     * Send welcome email to new therapist with Google Calendar OAuth link
     */
  async sendWarningEmail({ toEmail, toName, reason, sessionId }) {
    const subject = 'Community Standards Warning — StressReliefChat';
    const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>Community Warning</title>
</head>
<body style="margin:0;padding:0;background:#F5F1E8;font-family:'Georgia',serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#F5F1E8;padding:40px 0;">
    <tr>
      <td align="center">
        <table width="580" cellpadding="0" cellspacing="0" style="max-width:580px;width:100%;">

          <!-- Header -->
          <tr>
            <td style="background:#2D3B2E;border-radius:16px 16px 0 0;padding:36px 40px;text-align:center;">
              <p style="margin:0 0 8px;font-size:13px;letter-spacing:2px;text-transform:uppercase;color:#8FB89A;font-family:Arial,sans-serif;font-weight:600;">StressReliefChat</p>
              <h1 style="margin:0;font-size:26px;font-weight:400;color:#F5F1E8;font-family:'Georgia',serif;letter-spacing:-0.3px;">
                Community Standards Notice
              </h1>
            </td>
          </tr>

          <!-- Warning stripe -->
          <tr>
            <td style="background:#B26B5C;padding:12px 40px;text-align:center;">
              <p style="margin:0;font-size:12px;letter-spacing:1.5px;text-transform:uppercase;color:#F5F1E8;font-family:Arial,sans-serif;font-weight:700;">
                ⚠ &nbsp; Formal Warning &nbsp; ⚠
              </p>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="background:#FDFAF4;padding:40px;border-radius:0 0 16px 16px;">

              <p style="margin:0 0 20px;font-size:15px;line-height:1.7;color:#3A3A3A;">
                Dear <strong>${toName || 'User'}</strong>,
              </p>

              <p style="margin:0 0 20px;font-size:15px;line-height:1.7;color:#3A3A3A;">
                We have received a report regarding your behaviour during a recent session on StressReliefChat. After review, we are issuing this formal warning.
              </p>

              <!-- Violation box -->
              <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;">
                <tr>
                  <td style="background:#FEF3F0;border-left:4px solid #B26B5C;border-radius:0 8px 8px 0;padding:18px 20px;">
                    <p style="margin:0 0 6px;font-size:11px;letter-spacing:1.2px;text-transform:uppercase;color:#B26B5C;font-family:Arial,sans-serif;font-weight:700;">Reported Violation</p>
                    <p style="margin:0;font-size:15px;color:#2D3B2E;font-weight:600;">${reason}</p>
                    ${sessionId ? `<p style="margin:6px 0 0;font-size:11px;color:#9A9A9A;font-family:Arial,sans-serif;">Session reference: ${sessionId.slice(0, 16)}…</p>` : ''}
                  </td>
                </tr>
              </table>

              <p style="margin:0 0 20px;font-size:15px;line-height:1.7;color:#3A3A3A;">
                StressReliefChat is a safe space built on empathy and respect. Our community guidelines exist to protect every person who reaches out for support. Behaviour that harms others goes against everything we stand for.
              </p>

              <!-- Guidelines box -->
              <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;">
                <tr>
                  <td style="background:#F0F5F1;border-radius:10px;padding:20px 24px;">
                    <p style="margin:0 0 12px;font-size:11px;letter-spacing:1.2px;text-transform:uppercase;color:#4A7C59;font-family:Arial,sans-serif;font-weight:700;">Our Community Standards</p>
                    <table cellpadding="0" cellspacing="0">
                      ${['Treat every person with kindness and dignity', 'No harassment, threats, or abusive language', 'Respect boundaries — emotional and conversational', 'Do not share misleading or harmful information', 'Maintain confidentiality of what others share'].map(rule => `
                      <tr>
                        <td style="padding:4px 0;vertical-align:top;">
                          <span style="color:#4A7C59;font-size:14px;margin-right:8px;">✓</span>
                        </td>
                        <td style="padding:4px 0;">
                          <p style="margin:0;font-size:14px;line-height:1.5;color:#3A3A3A;">${rule}</p>
                        </td>
                      </tr>`).join('')}
                    </table>
                  </td>
                </tr>
              </table>

              <!-- Consequence notice -->
              <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:28px;">
                <tr>
                  <td style="background:#FFF8F0;border:1px solid #F0D5C0;border-radius:10px;padding:18px 20px;">
                    <p style="margin:0;font-size:14px;line-height:1.65;color:#5A3A1A;">
                      <strong>Please be aware:</strong> Repeated violations of our community standards may result in temporary suspension or permanent removal of your account. This warning has been recorded.
                    </p>
                  </td>
                </tr>
              </table>

              <p style="margin:0 0 28px;font-size:15px;line-height:1.7;color:#3A3A3A;">
                We believe in giving people the opportunity to reflect and do better. We hope you will continue to be part of our community with renewed care for those around you.
              </p>

              <p style="margin:0 0 6px;font-size:14px;color:#6A6A6A;">With care,</p>
              <p style="margin:0;font-size:15px;font-weight:600;color:#2D3B2E;">The StressReliefChat Safety Team</p>

            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding:24px 40px;text-align:center;">
              <p style="margin:0 0 4px;font-size:12px;color:#9A9A9A;font-family:Arial,sans-serif;">
                This notice was sent by the StressReliefChat moderation team.
              </p>
              <p style="margin:0;font-size:11px;color:#BBBBBB;font-family:Arial,sans-serif;">
                If you believe this warning was issued in error, please reply to this email.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

    const text = `Community Standards Warning — StressReliefChat\n\nDear ${toName || 'User'},\n\nWe have received a report regarding your behaviour during a recent session.\n\nViolation reported: ${reason}\n\nStressReliefChat is a safe space built on empathy and respect. Repeated violations may result in account suspension.\n\nWith care,\nThe StressReliefChat Safety Team`;

    return await this.sendEmail({ to: toEmail, subject, html, text });
  }

  async sendTherapistWelcome({ therapistEmail, therapistName, therapistId, oauthUrl }) {
    const subject = '🎉 Welcome to StressReliefChat - Connect Your Google Calendar';
    const html = `
            <!DOCTYPE html>
            <html>
            <head>
                <style>
                    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
                    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                    .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
                    .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
                    .info-box { background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #667eea; }
                    .button { display: inline-block; padding: 15px 30px; background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: white; text-decoration: none; border-radius: 8px; font-weight: bold; margin: 20px 0; }
                    .footer { text-align: center; margin-top: 20px; color: #666; font-size: 12px; }
                    .highlight { color: #667eea; font-weight: bold; }
                    .step { background: white; padding: 15px; margin: 10px 0; border-radius: 6px; border-left: 3px solid #667eea; }
                </style>
            </head>
            <body>
                <div class="container">
                    <div class="header">
                        <h1>🎉 Welcome to StressReliefChat!</h1>
                    </div>
                    <div class="content">
                        <p>Dear ${therapistName},</p>
                        <p>Welcome to the StressReliefChat therapist team! We're excited to have you on board.</p>
                        
                        <div class="info-box">
                            <h3 style="margin-top: 0;">🔗 Important: Connect Your Google Calendar</h3>
                            <p>To enable automatic appointment scheduling and Google Meet link generation, please connect your Google Calendar:</p>
                        </div>

                        <div style="text-align: center;">
                            <a href="${oauthUrl}" class="button">📅 Connect Google Calendar Now</a>
                        </div>

                        <div class="info-box">
                            <h4>✨ Why Connect Your Calendar?</h4>
                            <ul>
                                <li><strong>Automatic Scheduling:</strong> Appointments appear in your Google Calendar</li>
                                <li><strong>You're the Meeting Host:</strong> Join sessions directly without waiting</li>
                                <li><strong>Google Meet Integration:</strong> Auto-generated video call links</li>
                                <li><strong>Email Reminders:</strong> Never miss a session</li>
                            </ul>
                        </div>

                        <div class="info-box">
                            <h4>📋 Setup Instructions:</h4>
                            <div class="step">
                                <strong>Step 1:</strong> Click the "Connect Google Calendar" button above
                            </div>
                            <div class="step">
                                <strong>Step 2:</strong> Sign in with your Google account (the one you want to use for sessions)
                            </div>
                            <div class="step">
                                <strong>Step 3:</strong> Grant calendar access permissions
                            </div>
                            <div class="step">
                                <strong>Step 4:</strong> You'll be redirected - copy the URL and complete authorization
                            </div>
                            <div class="step">
                                <strong>Step 5:</strong> Done! All future appointments will use YOUR calendar
                            </div>
                        </div>

                        <p style="background: #fef3c7; padding: 15px; border-radius: 6px; border-left: 4px solid #f59e0b;">
                            <strong>⏰ One-Time Setup:</strong> This authorization is a one-time process that takes only 2 minutes. Once connected, everything works automatically!
                        </p>

                        <p><strong>Need Help?</strong> If you encounter any issues during setup, please contact our admin team.</p>

                        <p>We look forward to supporting mental wellness together! 💚</p>
                        
                        <p style="margin-top: 30px; color: #666;">
                            Best regards,<br>
                            <strong>StressReliefChat Team</strong>
                        </p>
                    </div>
                    <div class="footer">
                        <p>© 2024 StressReliefChat - Your mental wellness companion</p>
                        <p style="font-size: 10px; color: #999; margin-top: 10px;">Therapist ID: ${therapistId}</p>
                    </div>
                </div>
            </body>
            </html>
        `;

    const text = `Welcome to StressReliefChat, ${therapistName}!\n\nTo enable automatic appointment scheduling with Google Meet, please connect your Google Calendar:\n\n${oauthUrl}\n\nThis is a one-time setup that takes only 2 minutes. Once connected:\n- Appointments automatically sync to your calendar\n- You become the meeting host\n- Google Meet links are auto-generated\n- Email reminders keep you on track\n\nNeed help? Contact our admin team.\n\nBest regards,\nStressReliefChat Team`;

    try {
      const result = await this.sendEmail({
        to: therapistEmail,
        subject,
        html,
        text
      });

      logger.info(`✅ Welcome email sent to therapist: ${therapistEmail}`);
      return result;
    } catch (error) {
      logger.error('Failed to send therapist welcome email:', error);
      throw error;
    }
  }
}

module.exports = new EmailService();

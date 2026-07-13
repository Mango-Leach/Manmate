const cron = require('node-cron');
const { getDB } = require('../config/database');
const { ObjectId } = require('mongodb');
const emailService = require('./emailService');
const logger = require('../utils/logger');

class ReminderScheduler {
  constructor() {
    this.cronJob = null;
  }

  /**
     * Start the reminder scheduler
     * Runs every minute for reliable 5-minute reminder delivery
     */
  start() {
    this.cronJob = cron.schedule('* * * * *', async () => {
      await this.sendUpcomingReminders();
    });

    logger.info('✅ Email reminder scheduler started (checking every minute)');
  }

  /**
     * Stop the scheduler gracefully
     */
  stop() {
    if (this.cronJob) {
      this.cronJob.stop();
      logger.info('🛑 Email reminder scheduler stopped');
    }
  }

  async getClientName(usersCollection, appointment) {
    if (!appointment.userId) return 'Client';

    try {
      const user = await usersCollection.findOne({ _id: new ObjectId(appointment.userId) });
      return user?.name || 'Client';
    } catch (error) {
      logger.warn(`Unable to resolve client name for appointment ${appointment._id}: ${error.message}`);
      return 'Client';
    }
  }

  async getTherapistName(therapistsCollection, appointment) {
    if (!appointment.therapistId) return 'Your therapist';

    try {
      const therapist = await therapistsCollection.findOne({ _id: new ObjectId(appointment.therapistId) });
      return therapist?.name || 'Your therapist';
    } catch (error) {
      logger.warn(`Unable to resolve therapist name for appointment ${appointment._id}: ${error.message}`);
      return 'Your therapist';
    }
  }

  async processReminderBatch({ appointments, reminderPath, reminderType, usersCollection, therapistsCollection, appointmentsCollection }) {
    for (const appointment of appointments) {
      try {
        const clientName = await this.getClientName(usersCollection, appointment);
        const therapistName = await this.getTherapistName(therapistsCollection, appointment);

        await emailService.sendClientAppointmentReminder({
          clientEmail: appointment.clientEmail,
          clientName,
          therapistName,
          date: appointment.date,
          timeSlot: appointment.timeSlot,
          meetLink: appointment.meetingLink,
          reminderType
        });

        const updatePath = `${reminderPath}.sent`;
        const updateTimePath = `${reminderPath}.sentAt`;

        await appointmentsCollection.updateOne(
          { _id: appointment._id },
          {
            $set: {
              [updatePath]: true,
              [updateTimePath]: new Date(),
              updatedAt: new Date()
            }
          }
        );

        logger.info(`✅ ${reminderType} email reminder sent for appointment ${appointment._id}`);
      } catch (error) {
        logger.error(`❌ Failed to send ${reminderType} reminder for appointment ${appointment._id}: ${error.message}`);
      }
    }
  }

  /**
     * Find upcoming appointments and send reminders
     */
  async sendUpcomingReminders() {
    try {
      const db = getDB();
      const appointmentsCollection = db.collection('appointments');
      const therapistsCollection = db.collection('therapists');
      const usersCollection = db.collection('users');

      const now = new Date();

      // 1-hour reminders:
      // - only for non-cancelled and non-completed appointments
      // - only when explicitly not skipped at booking time
      // - due when scheduled time is reached
      // - session still in the future
      const oneHourDue = await appointmentsCollection.find({
        status: { $nin: ['cancelled', 'completed'] },
        clientEmail: { $exists: true, $ne: '' },
        startDateTime: { $gt: now },
        'emailReminder.oneHour.sent': { $ne: true },
        'emailReminder.oneHour.skipped': { $ne: true },
        'emailReminder.oneHour.scheduledAt': { $ne: null, $lte: now }
      }).toArray();

      // 5-minute reminders:
      // - only for non-cancelled and non-completed appointments
      // - due when scheduled time is reached
      // - session still in the future
      const fiveMinuteDue = await appointmentsCollection.find({
        status: { $nin: ['cancelled', 'completed'] },
        clientEmail: { $exists: true, $ne: '' },
        startDateTime: { $gt: now },
        'emailReminder.fiveMinutes.sent': { $ne: true },
        'emailReminder.fiveMinutes.scheduledAt': { $ne: null, $lte: now }
      }).toArray();

      if (oneHourDue.length === 0 && fiveMinuteDue.length === 0) {
        return;
      }

      if (oneHourDue.length > 0) {
        await this.processReminderBatch({
          appointments: oneHourDue,
          reminderPath: 'emailReminder.oneHour',
          reminderType: 'one_hour',
          usersCollection,
          therapistsCollection,
          appointmentsCollection
        });
      }

      if (fiveMinuteDue.length > 0) {
        await this.processReminderBatch({
          appointments: fiveMinuteDue,
          reminderPath: 'emailReminder.fiveMinutes',
          reminderType: 'five_minutes',
          usersCollection,
          therapistsCollection,
          appointmentsCollection
        });
      }
    } catch (error) {
      logger.error('❌ Reminder scheduler error:', error.message);
    }
  }

  /**
     * Manually trigger a reminder check (useful for testing)
     */
  async triggerNow() {
    logger.info('🔔 Manually triggering reminder check...');
    await this.sendUpcomingReminders();
  }
}

module.exports = new ReminderScheduler();

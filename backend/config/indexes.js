const { getDB } = require('./database');
const logger = require('../utils/logger');

/**
 * Create database indexes for better query performance
 */
const createIndexes = async () => {
  try {
    const db = getDB();

    // Users collection indexes
    await db.collection('users').createIndex(
      { email: 1 },
      { unique: true, name: 'email_unique' }
    );

    await db.collection('users').createIndex(
      { phone: 1 },
      { sparse: true, name: 'phone_index' }
    );

    await db.collection('users').createIndex(
      { createdAt: -1 },
      { name: 'created_at_index' }
    );

    // Transactions collection indexes
    await db.collection('transactions').createIndex(
      { email: 1, createdAt: -1 },
      { name: 'email_created_index' }
    );

    await db.collection('transactions').createIndex(
      { type: 1 },
      { name: 'type_index' }
    );

    await db.collection('transactions').createIndex(
      { createdAt: -1 },
      { name: 'transaction_created_index' }
    );

    // Previous calls collection indexes
    await db.collection('previousCalls').createIndex(
      { email: 1, date: -1 },
      { name: 'email_date_index' }
    );

    // Favorites collection indexes
    await db.collection('favorites').createIndex(
      { email: 1 },
      { unique: true, name: 'email_favorites_unique' }
    );

    // Appointments collection indexes
    // Prevent double-booking at the database level: a therapist can hold only one
    // active appointment per (date, timeSlot). Partial filter on `active: true`
    // lets a slot be re-booked once it is cancelled/completed (active: false), and
    // skips legacy docs without the field so the index build won't fail on them.
    await db.collection('appointments').createIndex(
      { therapistId: 1, date: 1, timeSlot: 1 },
      {
        unique: true,
        partialFilterExpression: { active: true },
        name: 'unique_active_slot'
      }
    );

    // Fast lookups for booked-slot / conflict queries.
    await db.collection('appointments').createIndex(
      { therapistId: 1, date: 1, status: 1 },
      { name: 'therapist_date_status_index' }
    );

    // Moods collection: one entry per user per calendar day.
    await db.collection('moods').createIndex(
      { userId: 1, dateKey: 1 },
      { unique: true, name: 'user_day_unique' }
    );

    logger.info('✅ Database indexes created successfully');
  } catch (error) {
    logger.error('Error creating database indexes:', error);
    throw error;
  }
};

module.exports = { createIndexes };

const { getDB } = require('../config/database');
const { ObjectId } = require('mongodb');

/**
 * Mood entry:
 * {
 *   userId: ObjectId,
 *   level: Number,     // 0..4 -> 0 Great, 1 Good, 2 Okay, 3 Low, 4 Struggling
 *   dateKey: String,   // 'YYYY-MM-DD' (local day) — one entry per user per day
 *   date: Date,        // local midnight of that day
 *   createdAt: Date,
 *   updatedAt: Date
 * }
 */

// Local-time 'YYYY-MM-DD' for a given Date.
function toDateKey(d) {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

class MoodModel {
  getCollection() {
    return getDB().collection('moods');
  }

  /**
   * Record (or overwrite) today's mood for a user. One entry per calendar day —
   * re-logging on the same day updates the level instead of adding a duplicate.
   */
  async logToday(userId, level) {
    const collection = this.getCollection();
    const now = new Date();
    const dateKey = toDateKey(now);
    const dayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    const result = await collection.findOneAndUpdate(
      { userId: new ObjectId(userId), dateKey },
      {
        $set: { level, date: dayStart, updatedAt: now },
        $setOnInsert: { userId: new ObjectId(userId), dateKey, createdAt: now }
      },
      { upsert: true, returnDocument: 'after' }
    );

    return result;
  }

  /**
   * Return mood entries for the last `days` calendar days (including today),
   * oldest first.
   */
  async getRecent(userId, days = 14) {
    const collection = this.getCollection();
    const now = new Date();
    const since = new Date(now.getFullYear(), now.getMonth(), now.getDate() - (days - 1));
    const sinceKey = toDateKey(since);

    return await collection
      .find({ userId: new ObjectId(userId), dateKey: { $gte: sinceKey } })
      .sort({ dateKey: 1 })
      .toArray();
  }
}

module.exports = new MoodModel();
module.exports.toDateKey = toDateKey;

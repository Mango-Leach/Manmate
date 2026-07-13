const { getDB } = require('../config/database');

/**
 * Transcript document schema (stored in `transcripts` collection)
 * {
 *   sessionId: String,
 *   callId: String,
 *   speaker: String,
 *   text: String,
 *   confidence: Number,
 *   processor: String, // 'whisper'|'sarvam'|'offline'
 *   model: String,
 *   createdAt: Date
 * }
 */

class TranscriptModel {
  constructor() {
    this.collectionName = 'transcripts';
  }

  getCollection() {
    const db = getDB();
    return db.collection(this.collectionName);
  }

  async createIndexes() {
    const collection = this.getCollection();
    await collection.createIndex({ sessionId: 1 });
    await collection.createIndex({ callId: 1 });
  }

  async insert(doc) {
    const collection = this.getCollection();
    const record = {
      ...doc,
      createdAt: new Date(),
    };
    const result = await collection.insertOne(record);
    return { ...record, _id: result.insertedId };
  }

  async findBySession(sessionId) {
    const collection = this.getCollection();
    return await collection.find({ sessionId }).sort({ createdAt: 1 }).toArray();
  }
}

module.exports = new TranscriptModel();

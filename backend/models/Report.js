const { getDB } = require('../config/database');

/**
 * Report schema (stored in 'reports' collection):
 * {
 *   reporterEmail: String,
 *   reporterName:  String,
 *   reportedUser:  String,   // peer's display name
 *   sessionId:     String,   // call room ID
 *   reason:        String,   // selected reason label
 *   details:       String,   // optional free-text
 *   status:        String,   // 'pending' | 'reviewed' | 'dismissed'
 *   createdAt:     Date,
 * }
 */

function getReportsCollection() {
  return getDB().collection('reports');
}

module.exports = { getReportsCollection };

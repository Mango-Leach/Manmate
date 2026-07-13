const Mood = require('../models/Mood');
const logger = require('../utils/logger');

// POST /api/moods  { level: 0..4 }
exports.logMood = async (req, res) => {
  try {
    const userId = req.user.id;
    const { level } = req.body;

    if (!Number.isInteger(level) || level < 0 || level > 4) {
      return res.status(400).json({
        success: false,
        error: 'Mood level must be an integer between 0 and 4'
      });
    }

    const entry = await Mood.logToday(userId, level);

    res.status(200).json({
      success: true,
      data: entry,
      message: 'Mood logged'
    });
  } catch (error) {
    logger.error('Error logging mood:', error);
    res.status(500).json({ success: false, error: 'Server Error' });
  }
};

// GET /api/moods?days=14
exports.getMoodHistory = async (req, res) => {
  try {
    const userId = req.user.id;
    const parsed = parseInt(req.query.days, 10);
    const days = Number.isInteger(parsed) && parsed > 0 && parsed <= 90 ? parsed : 14;

    const entries = await Mood.getRecent(userId, days);

    res.status(200).json({
      success: true,
      data: {
        days,
        entries: entries.map(e => ({ dateKey: e.dateKey, level: e.level, date: e.date }))
      }
    });
  } catch (error) {
    logger.error('Error fetching mood history:', error);
    res.status(500).json({ success: false, error: 'Server Error' });
  }
};

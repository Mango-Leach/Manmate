const express = require('express');
const router = express.Router();
const moodController = require('../controllers/moodController');
const { authenticate } = require('../middleware/auth');

router.post('/', authenticate, moodController.logMood);
router.get('/', authenticate, moodController.getMoodHistory);

module.exports = router;

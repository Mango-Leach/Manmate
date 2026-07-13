const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const { createReport } = require('../controllers/reportController');

// Any authenticated user can file a report
router.post('/', authenticate, createReport);

module.exports = router;

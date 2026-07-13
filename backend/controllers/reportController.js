const { getReportsCollection } = require('../models/Report');
const { ObjectId } = require('mongodb');
const logger = require('../utils/logger');
const emailService = require('../services/emailService');

const VALID_REASONS = [
  'Harassment or bullying',
  'Threatening or violent language',
  'Sexual or inappropriate content',
  'Spam or misleading behaviour',
  'Impersonation',
  'Other',
];

const createReport = async (req, res) => {
  try {
    const { reportedUser, reportedEmail, reason, details, sessionId } = req.body;

    if (!reportedUser || !reason) {
      return res.status(400).json({ success: false, error: 'reportedUser and reason are required' });
    }

    if (!VALID_REASONS.includes(reason)) {
      return res.status(400).json({ success: false, error: 'Invalid reason' });
    }

    const reports = getReportsCollection();
    const doc = {
      reporterEmail: req.user?.email || 'unknown',
      reporterName: req.user?.name || 'Unknown',
      reportedUser: String(reportedUser).trim(),
      reportedEmail: reportedEmail ? String(reportedEmail).trim() : null,
      sessionId: sessionId || null,
      reason,
      details: details ? String(details).trim().slice(0, 1000) : '',
      status: 'pending',
      warningSent: false,
      createdAt: new Date(),
    };

    await reports.insertOne(doc);
    logger.info(`Report filed by ${doc.reporterEmail} against ${doc.reportedUser}: ${reason}`);
    return res.status(201).json({ success: true });
  } catch (err) {
    logger.error('createReport error:', err);
    return res.status(500).json({ success: false, error: 'Failed to save report' });
  }
};

const getReports = async (req, res) => {
  try {
    const reports = getReportsCollection();
    const { status, limit = 50, offset = 0 } = req.query;
    const filter = status ? { status } : {};
    const items = await reports
      .find(filter)
      .sort({ createdAt: -1 })
      .skip(Number(offset))
      .limit(Number(limit))
      .toArray();
    const total = await reports.countDocuments(filter);
    return res.json({ success: true, data: { reports: items, total } });
  } catch (err) {
    logger.error('getReports error:', err);
    return res.status(500).json({ success: false, error: 'Failed to fetch reports' });
  }
};

const updateReportStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    if (!['pending', 'warned', 'dismissed', 'suspended'].includes(status)) {
      return res.status(400).json({ success: false, error: 'Invalid status' });
    }
    const reports = getReportsCollection();
    await reports.updateOne({ _id: new ObjectId(id) }, { $set: { status, updatedAt: new Date() } });
    return res.json({ success: true });
  } catch (err) {
    logger.error('updateReportStatus error:', err);
    return res.status(500).json({ success: false, error: 'Failed to update report' });
  }
};

const sendWarning = async (req, res) => {
  try {
    const { id } = req.params;
    const reports = getReportsCollection();
    const report = await reports.findOne({ _id: new ObjectId(id) });
    if (!report) return res.status(404).json({ success: false, error: 'Report not found' });

    let toEmail = report.reportedEmail || null;

    // If email wasn't captured at report time, look up the user by name in the DB
    if (!toEmail && report.reportedUser) {
      const db = require('../config/database').getDB();
      const found = await db.collection('users').findOne(
        { name: { $regex: new RegExp(`^${report.reportedUser.trim()}`, 'i') } },
        { projection: { email: 1 } }
      );
      toEmail = found?.email || null;
    }

    if (!toEmail) return res.status(400).json({ success: false, error: `Could not find an email for "${report.reportedUser}". They may not have a registered account.` });

    await emailService.sendWarningEmail({
      toEmail,
      toName: report.reportedUser,
      reason: report.reason,
      sessionId: report.sessionId,
    });

    await reports.updateOne(
      { _id: new ObjectId(id) },
      { $set: { warningSent: true, warningSentAt: new Date(), status: 'warned' } }
    );

    logger.info(`Warning email sent to ${toEmail} for report ${id}`);
    return res.json({ success: true });
  } catch (err) {
    logger.error('sendWarning error:', err);
    return res.status(500).json({ success: false, error: 'Failed to send warning email' });
  }
};

const suspendUser = async (req, res) => {
  try {
    const { id } = req.params;
    const reports = getReportsCollection();
    const report = await reports.findOne({ _id: new ObjectId(id) });
    if (!report) return res.status(404).json({ success: false, error: 'Report not found' });

    // Resolve the target email
    let targetEmail = report.reportedEmail || null;
    if (!targetEmail && report.reportedUser) {
      const db = require('../config/database').getDB();
      const found = await db.collection('users').findOne(
        { name: { $regex: new RegExp(`^${report.reportedUser.trim()}`, 'i') } },
        { projection: { email: 1 } }
      );
      targetEmail = found?.email || null;
    }
    if (!targetEmail) {
      return res.status(400).json({ success: false, error: `Could not find an account for "${report.reportedUser}" to suspend.` });
    }

    const db = require('../config/database').getDB();
    const result = await db.collection('users').updateOne(
      { email: targetEmail.toLowerCase() },
      { $set: { isSuspended: true, suspendedAt: new Date(), suspendedReason: report.reason } }
    );
    if (result.matchedCount === 0) {
      return res.status(404).json({ success: false, error: 'User account not found.' });
    }

    await reports.updateOne(
      { _id: new ObjectId(id) },
      { $set: { status: 'suspended', suspendedAt: new Date() } }
    );

    logger.info(`User ${targetEmail} suspended for report ${id}: ${report.reason}`);
    return res.json({ success: true, suspendedEmail: targetEmail });
  } catch (err) {
    logger.error('suspendUser error:', err);
    return res.status(500).json({ success: false, error: 'Failed to suspend user' });
  }
};

const unsuspendUser = async (req, res) => {
  try {
    const { id } = req.params;
    const reports = getReportsCollection();
    const report = await reports.findOne({ _id: new ObjectId(id) });
    if (!report) return res.status(404).json({ success: false, error: 'Report not found' });

    let targetEmail = report.reportedEmail || null;
    if (!targetEmail && report.reportedUser) {
      const db = require('../config/database').getDB();
      const found = await db.collection('users').findOne(
        { name: { $regex: new RegExp(`^${report.reportedUser.trim()}`, 'i') } },
        { projection: { email: 1 } }
      );
      targetEmail = found?.email || null;
    }
    if (!targetEmail) {
      return res.status(400).json({ success: false, error: `Could not find an account for "${report.reportedUser}".` });
    }

    const db = require('../config/database').getDB();
    await db.collection('users').updateOne(
      { email: targetEmail.toLowerCase() },
      { $set: { isSuspended: false }, $unset: { suspendedAt: '', suspendedReason: '' } }
    );

    await reports.updateOne(
      { _id: new ObjectId(id) },
      { $set: { status: 'warned', unsuspendedAt: new Date() } }
    );

    logger.info(`User ${targetEmail} unsuspended for report ${id}`);
    return res.json({ success: true });
  } catch (err) {
    logger.error('unsuspendUser error:', err);
    return res.status(500).json({ success: false, error: 'Failed to unsuspend user' });
  }
};

module.exports = { createReport, getReports, updateReportStatus, sendWarning, suspendUser, unsuspendUser };

const UserModel = require('../models/User');
const { getDB } = require('../config/database');
const logger = require('../utils/logger');
const AppError = require('../utils/AppError');

/**
 * Get all listeners with their stats
 * GET /api/admin/listeners
 */
const getListeners = async (req, res, next) => {
  try {
    res.set('Cache-Control', 'no-store');
    const db = getDB();
    const users = db.collection('users');

    const listeners = await users
      .find({ role: 'listener' })
      .project({ _id: 1, name: 1, email: 1, isAvailable: 1, listenerProfile: 1, createdAt: 1 })
      .toArray();

    // Aggregate call stats from callLogs for each listener — this is the source of truth
    // (listenerProfile totals may be stale for listeners who had calls before the $inc fix)
    const emails = listeners.map(l => l.email?.toLowerCase()).filter(Boolean);
    const logAgg = await db.collection('callLogs').aggregate([
      { $match: { listenerEmail: { $in: emails } } },
      {
        $group: {
          _id: '$listenerEmail',
          totalCalls: { $sum: 1 },
          totalMinutes: { $sum: '$durationMinutes' },
        },
      },
    ]).toArray();

    const logMap = {};
    logAgg.forEach(r => { logMap[r._id] = r; });

    const formattedListeners = listeners.map((listener) => {
      const email = listener.email?.toLowerCase();
      const log = logMap[email] || {};
      return {
        id: listener._id.toString(),
        name: listener.name,
        email: listener.email,
        isAvailable: listener.isAvailable || false,
        // Prefer callLogs aggregate (always accurate); fall back to profile field
        totalCalls: log.totalCalls ?? listener.listenerProfile?.totalCalls ?? 0,
        totalMinutes: log.totalMinutes ?? listener.listenerProfile?.totalMinutes ?? 0,
        rating: listener.listenerProfile?.rating || 0,
        specialties: listener.listenerProfile?.specialties || [],
        bio: listener.listenerProfile?.bio || '',
        costPerMin: listener.listenerProfile?.costPerMin || 0,
        createdAt: listener.createdAt,
      };
    });

    res.json({
      success: true,
      data: {
        listeners: formattedListeners,
        total: formattedListeners.length,
      },
    });
  } catch (error) {
    logger.error('Error fetching listeners:', error);
    next(new AppError('Failed to fetch listeners', 500));
  }
};

/**
 * Add a new listener
 * POST /api/admin/listeners
 */
const addListener = async (req, res, next) => {
  try {
    const { name, specialties, bio } = req.body;
    const email = String(req.body.email || '').trim().toLowerCase();
    const costPerMin = req.body.costPerMin === undefined || req.body.costPerMin === ''
      ? 0
      : Number(req.body.costPerMin);

    if (!name || !email) {
      return next(new AppError('Name and email are required', 400));
    }
    if (!Number.isFinite(costPerMin) || costPerMin < 0) {
      return next(new AppError('Cost per minute must be zero or greater', 400));
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return next(new AppError('Enter a valid email address', 400));
    }

    // Check if user already exists
    const existingUser = await UserModel.findByEmail(email);
    let listener;
    if (existingUser && !['client', 'listener'].includes(existingUser.role)) {
      return next(new AppError(`This email already belongs to a ${existingUser.role} account`, 409));
    }

    const listenerProfile = {
      specialties: Array.isArray(specialties) ? specialties : [],
      bio: bio || '',
      totalCalls: existingUser?.listenerProfile?.totalCalls || 0,
      totalMinutes: existingUser?.listenerProfile?.totalMinutes || 0,
      rating: existingUser?.listenerProfile?.rating || 0,
      costPerMin,
    };

    if (existingUser) {
      // Promote clients when needed; for an existing listener update their
      // editable profile fields while preserving online state and call history.
      const userUpdates = { name, listenerProfile };
      if (existingUser.role !== 'listener') {
        userUpdates.role = 'listener';
        userUpdates.isAvailable = false;
      }
      listener = await UserModel.update(email, userUpdates);
      logger.info(`Listener profile saved by admin: ${email}`);
    } else {
      // Create new listener
      listener = await UserModel.create({
        name,
        email,
        role: 'listener',
        emailVerified: true,
        isAvailable: false,
        listenerProfile: {
          specialties: specialties || [],
          bio: bio || '',
          totalCalls: 0,
          totalMinutes: 0,
          rating: 0,
          costPerMin,
        },
      });

      logger.info(`New listener created by admin: ${email}`);
    }

    res.status(201).json({
      success: true,
      message: existingUser?.role === 'listener' ? 'Listener updated successfully' : existingUser ? 'User upgraded to listener successfully' : 'Listener created successfully',
      data: {
        listener: {
          id: listener._id.toString(),
          name: listener.name,
          email: listener.email,
          isAvailable: listener.isAvailable,
          totalCalls: listener.listenerProfile?.totalCalls || 0,
          rating: listener.listenerProfile?.rating || 0,
          specialties: listener.listenerProfile?.specialties || [],
          bio: listener.listenerProfile?.bio || '',
          costPerMin: listener.listenerProfile?.costPerMin || 0,
        },
      },
    });
  } catch (error) {
    logger.error('Error creating listener:', error);
    next(new AppError('Failed to create listener', 500));
  }
};

/**
 * Update listener details
 * PUT /api/admin/listeners/:id
 */
const updateListener = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { name, specialties, bio, isAvailable } = req.body;
    const { ObjectId } = require('mongodb');
    if (!ObjectId.isValid(id)) return next(new AppError('Invalid listener ID', 400));

    const updates = {};
    if (name !== undefined) {
      if (typeof name !== 'string' || !name.trim()) return next(new AppError('Name cannot be empty', 400));
      updates.name = name.trim();
    }
    if (typeof isAvailable === 'boolean') updates.isAvailable = isAvailable;
    if (specialties !== undefined) updates['listenerProfile.specialties'] = Array.isArray(specialties)
      ? specialties
      : String(specialties).split(',').map(value => value.trim()).filter(Boolean);
    if (bio !== undefined) updates['listenerProfile.bio'] = bio;
    if (req.body.costPerMin !== undefined) {
      const costPerMin = Number(req.body.costPerMin);
      if (!Number.isFinite(costPerMin) || costPerMin < 0) return next(new AppError('Cost per minute must be zero or greater', 400));
      updates['listenerProfile.costPerMin'] = costPerMin;
    }

    const db = getDB();
    const users = db.collection('users');

    const result = await users.findOneAndUpdate(
      { _id: new ObjectId(id), role: 'listener' },
      { $set: { ...updates, updatedAt: new Date() } },
      { returnDocument: 'after' }
    );

    const updatedListener = result?.value ?? result;
    if (!updatedListener) {
      return next(new AppError('Listener not found', 404));
    }

    logger.info(`Listener updated by admin: ${id}`);

    res.json({
      success: true,
      message: 'Listener updated successfully',
      data: {
        listener: {
          id: updatedListener._id.toString(),
          name: updatedListener.name,
          email: updatedListener.email,
          isAvailable: updatedListener.isAvailable,
          totalCalls: updatedListener.listenerProfile?.totalCalls || 0,
          totalMinutes: updatedListener.listenerProfile?.totalMinutes || 0,
          rating: updatedListener.listenerProfile?.rating || 0,
          specialties: updatedListener.listenerProfile?.specialties || [],
          bio: updatedListener.listenerProfile?.bio || '',
          costPerMin: updatedListener.listenerProfile?.costPerMin ?? 0,
        },
      },
    });
  } catch (error) {
    logger.error('Error updating listener:', error);
    next(new AppError('Failed to update listener', 500));
  }
};

/**
 * Delete a listener
 * DELETE /api/admin/listeners/:id
 */
const deleteListener = async (req, res, next) => {
  try {
    const { id } = req.params;

    const db = getDB();
    const users = db.collection('users');
    const { ObjectId } = require('mongodb');

    const result = await users.deleteOne({
      _id: new ObjectId(id),
      role: 'listener',
    });

    if (result.deletedCount === 0) {
      return next(new AppError('Listener not found', 404));
    }

    logger.info(`Listener deleted by admin: ${id}`);

    res.json({
      success: true,
      message: 'Listener deleted successfully',
    });
  } catch (error) {
    logger.error('Error deleting listener:', error);
    next(new AppError('Failed to delete listener', 500));
  }
};

/**
 * Get analytics for a specific listener
 * GET /api/admin/listeners/:id/analytics
 */
const getListenerAnalytics = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { from, to } = req.query;

    const db = getDB();
    const users = db.collection('users');
    const { ObjectId } = require('mongodb');

    const listener = await users.findOne(
      { _id: new ObjectId(id), role: 'listener' },
      { projection: { name: 1, email: 1, isAvailable: 1, listenerProfile: 1, createdAt: 1 } }
    );

    if (!listener) {
      return next(new AppError('Listener not found', 404));
    }

    const costPerMin = listener.listenerProfile?.costPerMin || 0;
    const rating = listener.listenerProfile?.rating || 0;
    const listenerEmail = listener.email?.toLowerCase();

    // Always aggregate from callLogs — the only reliable source of truth
    const matchStage = { listenerEmail };
    const isFiltered = !!(from || to);
    if (isFiltered) {
      const dateFilter = {};
      if (from) dateFilter.$gte = new Date(from);
      if (to) dateFilter.$lte = new Date(to);
      matchStage.startedAt = dateFilter;
    }

    const agg = await db.collection('callLogs').aggregate([
      { $match: matchStage },
      {
        $group: {
          _id: null,
          totalCalls: { $sum: 1 },
          totalMinutes: { $sum: '$durationMinutes' },
          avgDuration: { $avg: '$durationMinutes' },
        },
      },
    ]).toArray();

    const totalCalls = agg[0]?.totalCalls || 0;
    const totalMinutes = agg[0]?.totalMinutes || 0;
    const avgDuration = agg[0] ? parseFloat((agg[0].avgDuration || 0).toFixed(1)) : 0;

    const estimatedEarnings = totalMinutes * costPerMin;

    res.json({
      success: true,
      data: {
        analytics: {
          id: listener._id.toString(),
          name: listener.name,
          email: listener.email,
          isAvailable: listener.isAvailable || false,
          totalCalls,
          totalMinutes,
          totalHours: parseFloat((totalMinutes / 60).toFixed(1)),
          avgDuration,
          rating,
          estimatedEarnings,
          payRatePerMinute: costPerMin,
          costPerMin,
          joinedAt: listener.createdAt,
          specialties: listener.listenerProfile?.specialties || [],
          bio: listener.listenerProfile?.bio || '',
          isFiltered,
        },
      },
    });
  } catch (error) {
    logger.error('Error fetching listener analytics:', error);
    next(new AppError('Failed to fetch listener analytics', 500));
  }
};

/**
 * Get admin dashboard statistics
 * GET /api/admin/stats
 */
const getStats = async (req, res, next) => {
  try {
    const db = getDB();
    const users = db.collection('users');
    const callLogs = db.collection('callLogs');

    const [totalUsers, totalListeners, onlineListeners, callAgg] = await Promise.all([
      users.countDocuments({ role: 'client' }),
      users.countDocuments({ role: 'listener' }),
      users.countDocuments({ role: 'listener', isAvailable: true }),
      // Aggregate directly from callLogs — always accurate regardless of profile field state
      callLogs.aggregate([
        {
          $group: {
            _id: null,
            totalCalls: { $sum: 1 },
            totalMinutes: { $sum: '$durationMinutes' },
          },
        },
      ]).toArray(),
    ]);

    const totalCalls = callAgg[0]?.totalCalls || 0;
    const totalMinutes = callAgg[0]?.totalMinutes || 0;

    res.json({
      success: true,
      data: {
        totalUsers,
        totalListeners,
        onlineListeners,
        totalCalls,
        totalMinutes,
      },
    });
  } catch (error) {
    logger.error('Error fetching stats:', error);
    next(new AppError('Failed to fetch statistics', 500));
  }
};

/**
 * Get platform settings (commissionPct, etc.)
 * GET /api/admin/settings
 */
const getAdminSettings = async (req, res, next) => {
  try {
    const db = getDB();
    const doc = await db.collection('adminSettings').findOne({ _id: 'platform' });
    res.json({
      success: true,
      data: {
        commissionPct: doc?.commissionPct ?? 0,
        therapistCommissionPct: doc?.therapistCommissionPct ?? 0,
      },
    });
  } catch (error) {
    logger.error('Error fetching admin settings:', error);
    next(new AppError('Failed to fetch settings', 500));
  }
};

/**
 * Save platform settings
 * POST /api/admin/settings
 */
const saveAdminSettings = async (req, res, next) => {
  try {
    const updates = {};

    if (req.body.commissionPct !== undefined) {
      const v = parseFloat(req.body.commissionPct);
      if (isNaN(v) || v < 0 || v > 100) return next(new AppError('Listener commission must be 0–100', 400));
      updates.commissionPct = v;
    }

    if (req.body.therapistCommissionPct !== undefined) {
      const v = parseFloat(req.body.therapistCommissionPct);
      if (isNaN(v) || v < 0 || v > 100) return next(new AppError('Therapist commission must be 0–100', 400));
      updates.therapistCommissionPct = v;
    }

    if (Object.keys(updates).length === 0) return next(new AppError('No valid fields to update', 400));

    const db = getDB();
    await db.collection('adminSettings').updateOne(
      { _id: 'platform' },
      { $set: { ...updates, updatedAt: new Date() } },
      { upsert: true }
    );

    logger.info('Platform settings updated:', updates);
    res.json({ success: true, data: updates });
  } catch (error) {
    logger.error('Error saving admin settings:', error);
    next(new AppError('Failed to save settings', 500));
  }
};

/**
 * Set the same costPerMin for ALL listeners at once
 * PATCH /api/admin/listeners/bulk-rate
 */
const setAllListenersRate = async (req, res, next) => {
  try {
    const costPerMin = parseFloat(req.body.costPerMin);
    if (isNaN(costPerMin) || costPerMin < 0) {
      return next(new AppError('Invalid rate value', 400));
    }

    const db = getDB();
    const users = db.collection('users');

    const result = await users.updateMany(
      { role: 'listener' },
      { $set: { 'listenerProfile.costPerMin': costPerMin, updatedAt: new Date() } }
    );

    logger.info(`Bulk rate update: ₹${costPerMin}/min applied to ${result.modifiedCount} listeners`);

    res.json({
      success: true,
      message: `Rate updated for ${result.modifiedCount} listener${result.modifiedCount !== 1 ? 's' : ''}`,
      data: { costPerMin, updatedCount: result.modifiedCount },
    });
  } catch (error) {
    logger.error('Error setting bulk listener rate:', error);
    next(new AppError('Failed to update listener rates', 500));
  }
};

/**
 * Diagnostic endpoint — verify callLogs data exists
 * GET /api/admin/diagnostics
 */
const getDiagnostics = async (req, res, next) => {
  try {
    const db = getDB();
    const callLogs = db.collection('callLogs');

    const [totalCount, recent, perListener] = await Promise.all([
      callLogs.countDocuments(),
      callLogs.find().sort({ endedAt: -1 }).limit(5)
        .project({ listenerEmail: 1, clientEmail: 1, durationMinutes: 1, startedAt: 1, endedAt: 1 })
        .toArray(),
      callLogs.aggregate([
        { $group: { _id: '$listenerEmail', calls: { $sum: 1 }, minutes: { $sum: '$durationMinutes' } } },
        { $sort: { calls: -1 } },
      ]).toArray(),
    ]);

    res.json({
      success: true,
      data: {
        callLogsTotal: totalCount,
        recentLogs: recent,
        perListener,
      },
    });
  } catch (error) {
    logger.error('Error fetching diagnostics:', error);
    next(new AppError('Failed to fetch diagnostics', 500));
  }
};

/**
 * Admin-only transcript browser
 * GET /api/admin/transcripts?sessionId=&speaker=&limit=&page=
 */
const getTranscripts = async (req, res, next) => {
  try {
    const { sessionId, speaker, limit = '25', page = '1' } = req.query;
    const parsedLimit = Math.min(100, Math.max(1, parseInt(limit, 10) || 25));
    const parsedPage = Math.max(1, parseInt(page, 10) || 1);

    const filter = {};
    if (sessionId) filter.sessionId = sessionId.trim();
    if (speaker) filter.speaker = speaker.trim();

    const db = getDB();
    const collection = db.collection('transcripts');

    const [total, transcripts] = await Promise.all([
      collection.countDocuments(filter),
      collection.find(filter)
        .sort({ createdAt: -1 })
        .skip((parsedPage - 1) * parsedLimit)
        .limit(parsedLimit)
        .toArray(),
    ]);

    res.json({
      success: true,
      data: {
        transcripts: transcripts.map((item) => ({
          id: item._id.toString(),
          sessionId: item.sessionId,
          callId: item.callId || null,
          speaker: item.speaker,
          text: item.text,
          confidence: item.confidence || 0,
          processor: item.processor || 'whisper',
          model: item.model || null,
          audioPath: item.audioPath || item.filePath || item.debugFile || null,
          createdAt: item.createdAt,
        })),
        total,
        page: parsedPage,
        limit: parsedLimit,
      },
    });
  } catch (error) {
    logger.error('Error fetching admin transcripts:', error);
    next(new AppError('Failed to fetch transcripts', 500));
  }
};

/**
 * Merge all speaker segments for a session into a time-ordered conversation
 * GET /api/admin/transcripts/session/:sessionId/conversation
 */
const getSessionConversation = async (req, res, next) => {
  try {
    const { sessionId } = req.params;
    if (!sessionId) return next(new AppError('sessionId is required', 400));

    const db = getDB();
    const transcripts = await db.collection('transcripts')
      .find({ sessionId })
      .sort({ createdAt: 1 })
      .toArray();

    const allSegments = [];
    for (const t of transcripts) {
      const speaker = t.speaker || 'unknown';
      if (Array.isArray(t.segments) && t.segments.length > 0) {
        for (const seg of t.segments) {
          allSegments.push({
            speaker,
            start: typeof seg.start === 'number' ? seg.start : null,
            end: typeof seg.end === 'number' ? seg.end : null,
            text: seg.text || '',
          });
        }
      } else if (t.text) {
        // Older records without segments — show as a single block
        allSegments.push({ speaker, start: null, end: null, text: t.text });
      }
    }

    // Sort by start time; segments without timestamps (old data) go last
    allSegments.sort((a, b) => {
      if (a.start === null && b.start === null) return 0;
      if (a.start === null) return 1;
      if (b.start === null) return -1;
      return a.start - b.start;
    });

    const participants = [...new Set(transcripts.map(t => t.speaker || 'unknown'))];

    res.json({
      success: true,
      data: {
        sessionId,
        participants,
        conversation: allSegments,
        transcriptCount: transcripts.length,
      },
    });
  } catch (error) {
    logger.error('Error fetching session conversation:', error);
    next(new AppError('Failed to fetch conversation', 500));
  }
};

/**
 * Frontend-driven call log (backup when socket-side logging fails)
 * POST /api/admin/log-call
 */
const logCallFromFrontend = async (req, res, next) => {
  try {
    const { listenerEmail, clientEmail, durationSeconds, sessionType, listenerName, counterpart } = req.body;

    // 'peer' sessions are logged against the client's own history (peer's display
    // name only); 'listener' sessions additionally roll up into listener stats.
    // 'ai' sessions are voice calls with Serenity (ElevenLabs agent) — no listener.
    const isPeer = counterpart === 'peer';
    const isAi = counterpart === 'ai';
    if (!durationSeconds) {
      return next(new AppError('durationSeconds is required', 400));
    }
    if (!isPeer && !isAi && !listenerEmail) {
      return next(new AppError('listenerEmail is required', 400));
    }
    if ((isPeer || isAi) && !clientEmail) {
      return next(new AppError('clientEmail is required for peer/ai sessions', 400));
    }

    // 'chat' or 'call' — defaults to 'call' for older clients that don't send it
    const type = sessionType === 'chat' ? 'chat' : 'call';
    const durationMinutes = Math.max(1, Math.round(durationSeconds / 60));
    const db = getDB();
    const clientLc = clientEmail ? clientEmail.toLowerCase() : null;

    // Only insert if no recent log exists for this pair (within last 2 minutes) to avoid double-logging
    const cutoff = new Date(Date.now() - 2 * 60 * 1000);
    const dedupFilter = (isPeer || isAi)
      ? { counterpart, clientEmail: clientLc, endedAt: { $gte: cutoff } }
      : { listenerEmail: listenerEmail.toLowerCase(), clientEmail: clientLc, endedAt: { $gte: cutoff } };
    const existing = await db.collection('callLogs').findOne(dedupFilter);

    if (existing) {
      return res.json({ success: true, message: 'Session already logged by server', skipped: true });
    }

    await db.collection('callLogs').insertOne({
      listenerEmail: (isPeer || isAi) ? null : listenerEmail.toLowerCase(),
      listenerName: isAi ? 'Serenity' : (listenerName || null),
      counterpart: isPeer ? 'peer' : (isAi ? 'ai' : 'listener'),
      clientEmail: clientLc,
      type,
      durationMinutes,
      startedAt: new Date(Date.now() - durationSeconds * 1000),
      endedAt: new Date(),
      source: 'frontend-backup',
    });

    // Roll up listener stats only for listener sessions
    if (!isPeer && !isAi) {
      await db.collection('users').updateOne(
        { email: listenerEmail.toLowerCase() },
        {
          $inc: { 'listenerProfile.totalCalls': 1, 'listenerProfile.totalMinutes': durationMinutes },
          $set: { updatedAt: new Date() },
        }
      );
    }

    logger.info(`Frontend backup session log: ${isPeer ? 'peer' : `listener=${listenerEmail}`} type=${type} dur=${durationMinutes}min`);
    res.json({ success: true, message: 'Session logged via frontend backup', durationMinutes });
  } catch (error) {
    logger.error('Error logging call from frontend:', error);
    next(new AppError('Failed to log call', 500));
  }
};

// Return the authenticated client's own session history (listener chat & calls)
const getClientCallHistory = async (req, res, next) => {
  try {
    const email = (req.user?.email || '').toLowerCase();
    if (!email) {
      return next(new AppError('Authentication required', 401));
    }

    const db = getDB();
    const logs = await db.collection('callLogs')
      .find({ clientEmail: email })
      .sort({ endedAt: -1 })
      .limit(30)
      .toArray();

    res.json({ success: true, data: logs });
  } catch (error) {
    logger.error('Error fetching client call history:', error);
    next(new AppError('Failed to fetch call history', 500));
  }
};

module.exports = {
  getListeners,
  addListener,
  updateListener,
  deleteListener,
  getStats,
  getListenerAnalytics,
  setAllListenersRate,
  getAdminSettings,
  saveAdminSettings,
  getDiagnostics,
  getTranscripts,
  getSessionConversation,
  logCallFromFrontend,
  getClientCallHistory,
};

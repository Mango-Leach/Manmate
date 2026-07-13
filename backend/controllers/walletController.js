const { getDB } = require('../config/database');
const logger = require('../utils/logger');

// Get wallet balance
const getWalletBalance = async (req, res, next) => {
  try {
    const db = getDB();
    const usersCollection = db.collection('users');
    const normalizedEmail = decodeURIComponent(req.params.email).toLowerCase();

    const user = await usersCollection.findOne(
      { email: normalizedEmail },
      { projection: { walletBalance: 1 } }
    );

    res.json({
      success: true,
      balance: user?.walletBalance || 0,
    });
  } catch (error) {
    next(error);
  }
};

// Update wallet balance
const updateWalletBalance = async (req, res, next) => {
  try {
    const db = getDB();
    const usersCollection = db.collection('users');
    const normalizedEmail = decodeURIComponent(req.params.email).toLowerCase();
    const { amount } = req.body;

    if (typeof amount !== 'number' || !Number.isFinite(amount) || amount < 0) {
      return res.status(400).json({
        success: false,
        error: 'Amount must be a non-negative number',
      });
    }

    const result = await usersCollection.findOneAndUpdate(
      { email: normalizedEmail },
      {
        $set: { walletBalance: amount, updatedAt: new Date() },
        $setOnInsert: { createdAt: new Date() },
      },
      { upsert: true, returnDocument: 'after' }
    );

    res.json({
      success: true,
      balance: result?.walletBalance || 0,
    });
  } catch (error) {
    next(error);
  }
};

// Atomically deduct amount from wallet; returns 402 if balance is insufficient
const deductWalletBalance = async (req, res, next) => {
  try {
    const db = getDB();
    const usersCollection = db.collection('users');
    const transactionsCollection = db.collection('transactions');
    const normalizedEmail = decodeURIComponent(req.params.email).toLowerCase();
    const { amount, description } = req.body;

    if (typeof amount !== 'number' || amount <= 0) {
      return res.status(400).json({ success: false, error: 'Invalid amount' });
    }

    logger.info(`[Billing] deduct ₹${amount} from ${normalizedEmail}`);

    // 1) Try a full deduction — atomic guard ensures the balance can never go
    //    below zero, even under concurrent requests.
    const result = await usersCollection.findOneAndUpdate(
      { email: normalizedEmail, walletBalance: { $gte: amount } },
      { $inc: { walletBalance: -amount }, $set: { updatedAt: new Date() } },
      { returnDocument: 'after' }
    );

    if (result) {
      logger.info(`[Billing] deduct success — new balance: ${result.walletBalance}`);
      await transactionsCollection.insertOne({
        userEmail: normalizedEmail,
        type: 'debit',
        amount,
        description: description || `Session charge ₹${amount}/min`,
        timestamp: new Date(),
      });
      return res.json({ success: true, balance: result.walletBalance, depleted: result.walletBalance <= 0 });
    }

    // 2) Balance is smaller than the requested chunk. Instead of leaving a
    //    stranded fractional remainder (or ever going negative), atomically
    //    drain whatever is left down to exactly ₹0 and tell the caller the
    //    wallet is depleted so the session stops right at zero.
    const drained = await usersCollection.findOneAndUpdate(
      { email: normalizedEmail, walletBalance: { $gt: 0, $lt: amount } },
      [{ $set: { walletBalance: 0, updatedAt: '$$NOW' } }],
      { returnDocument: 'before' }
    );

    if (drained && drained.walletBalance > 0) {
      const drainedAmount = Math.round(drained.walletBalance * 10000) / 10000;
      logger.info(`[Billing] partial deduct — drained remaining ₹${drainedAmount} from ${normalizedEmail}; balance now 0`);
      await transactionsCollection.insertOne({
        userEmail: normalizedEmail,
        type: 'debit',
        amount: drainedAmount,
        description: description || `Session charge (final) ₹${drainedAmount}`,
        timestamp: new Date(),
      });
      return res.json({ success: true, balance: 0, depleted: true });
    }

    // 3) Nothing left (or user not found / balance already ≤ 0).
    const user = await usersCollection.findOne({ email: normalizedEmail }, { projection: { walletBalance: 1 } });
    logger.warn(`[Billing] deduct failed for ${normalizedEmail} — balance: ${user?.walletBalance ?? 'user not found'}, needed: ${amount}`);
    // Self-heal: if a legacy negative balance exists in the DB, clamp it to 0.
    if (user && typeof user.walletBalance === 'number' && user.walletBalance < 0) {
      await usersCollection.updateOne({ email: normalizedEmail }, { $set: { walletBalance: 0, updatedAt: new Date() } });
    }
    return res.status(402).json({ success: false, error: 'insufficient_funds', balance: 0, depleted: true });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getWalletBalance,
  updateWalletBalance,
  deductWalletBalance,
};









const Razorpay = require('razorpay');
const crypto = require('crypto');
const { getDB } = require('../config/database');
const logger = require('../utils/logger');
const emailService = require('../services/emailService');

const hasRazorpayCredentials = Boolean(process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET);

const getRazorpayClient = () => {
  if (!hasRazorpayCredentials) {
    return null;
  }

  return new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET,
  });
};

// POST /api/users/razorpay/create-order
// Body: { amount: number }  (amount in ₹)
const createOrder = async (req, res, next) => {
  try {
    const { amount } = req.body;

    if (!amount || typeof amount !== 'number' || amount <= 0) {
      logger.warn('Invalid amount provided to create-order:', amount);
      return res.status(400).json({ success: false, error: 'Invalid amount' });
    }

    if (!hasRazorpayCredentials) {
      logger.error('Razorpay credentials missing in environment');
      return res.status(500).json({ success: false, error: 'Payment gateway not configured' });
    }

    const razorpay = getRazorpayClient();

    const options = {
      amount: Math.round(amount * 100), // Razorpay needs paise (₹1 = 100 paise)
      currency: 'INR',
      receipt: `rcpt_${Date.now()}`,
    };

    logger.info(`Creating Razorpay order for amount: ₹${amount}`);
    const order = await razorpay.orders.create(options);

    logger.info(`Order created successfully: ${order.id}`);
    res.json({
      success: true,
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,
      key: process.env.RAZORPAY_KEY_ID,
    });
  } catch (error) {
    logger.error('Razorpay create-order error:', error.message, error.response?.data);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to create order',
      details: process.env.NODE_ENV === 'development' ? error.response?.data : undefined
    });
  }
};

// POST /api/users/razorpay/verify
// Body: { razorpay_order_id, razorpay_payment_id, razorpay_signature, amount, email }
const verifyPayment = async (req, res, next) => {
  try {
    const {
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
      amount,
      email,
    } = req.body;

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature || !amount || !email) {
      logger.warn('Missing payment verification fields');
      return res.status(400).json({ success: false, error: 'Missing required fields' });
    }

    // 1. Verify HMAC-SHA256 signature
    const expectedSignature = crypto
      .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
      .update(`${razorpay_order_id}|${razorpay_payment_id}`)
      .digest('hex');

    if (expectedSignature !== razorpay_signature) {
      logger.warn(`Invalid payment signature for order ${razorpay_order_id}`);
      return res.status(400).json({ success: false, error: 'Invalid payment signature' });
    }

    const db = getDB();
    const usersCollection = db.collection('users');
    const transactionsCollection = db.collection('transactions');

    const decodedEmail = decodeURIComponent(email).toLowerCase();

    // 2. Increment wallet balance atomically
    const updatedUser = await usersCollection.findOneAndUpdate(
      { email: decodedEmail },
      {
        $inc: { walletBalance: amount },
        $set: { updatedAt: new Date() },
      },
      { returnDocument: 'after' }
    );

    if (!updatedUser) {
      logger.warn(`User not found for email: ${decodedEmail}`);
      return res.status(404).json({ success: false, error: 'User not found' });
    }

    // 3. Record transaction
    await transactionsCollection.insertOne({
      userEmail: decodedEmail,
      type: 'credit',
      amount,
      description: 'Wallet top-up via Razorpay',
      razorpay_order_id,
      razorpay_payment_id,
      timestamp: new Date(),
    });

    logger.info(`Payment verified successfully for ${decodedEmail}: ₹${amount}`);

    emailService.sendWalletRecharge({
      clientEmail: decodedEmail,
      clientName: updatedUser?.name || updatedUser?.displayName,
      amount,
      newBalance: updatedUser?.walletBalance ?? 0,
      paymentId: razorpay_payment_id,
    }).catch((err) => logger.error('Failed to send wallet recharge email:', err));

    res.json({
      success: true,
      newBalance: updatedUser?.walletBalance ?? 0,
    });
  } catch (error) {
    logger.error('Razorpay verify-payment error:', error.message);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to verify payment'
    });
  }
};

module.exports = { createOrder, verifyPayment };

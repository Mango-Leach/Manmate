const express = require('express');
const router = express.Router();
const { getUser, createOrUpdateUser } = require('../controllers/userController');
const { getWalletBalance, updateWalletBalance, deductWalletBalance } = require('../controllers/walletController');
const { getTransactions, addTransaction } = require('../controllers/transactionController');
const { getFavorites, updateFavorites } = require('../controllers/favoriteController');
const { getPreviousCalls, updatePreviousCalls } = require('../controllers/previousCallsController');
const { createOrder, verifyPayment } = require('../controllers/razorpayController');
const { authenticate } = require('../middleware/auth');
const { requireSelfOrAdmin, requireAdmin } = require('../middleware/roleAuth');

// Razorpay payment routes (require authentication) — registered before the
// /:email routes so "razorpay" is never treated as an email parameter.
router.post('/razorpay/create-order', authenticate, createOrder);
router.post('/razorpay/verify', authenticate, verifyPayment);

// All /:email routes are self-scoped: a user may only read/write their own
// document (admins may access any). This closes the previous hole where
// anyone could read or set any user's wallet balance unauthenticated.
router.get('/:email', authenticate, requireSelfOrAdmin, getUser);
router.post('/:email', authenticate, requireSelfOrAdmin, createOrUpdateUser);

// Wallet routes
router.get('/:email/wallet', authenticate, requireSelfOrAdmin, getWalletBalance);
// Raw "set balance" is an admin-only operation — regular top-ups must go
// through the verified Razorpay flow, and debits through /wallet/deduct.
router.put('/:email/wallet', authenticate, requireAdmin, updateWalletBalance);
router.post('/:email/wallet/deduct', authenticate, requireSelfOrAdmin, deductWalletBalance);

// Transaction routes
router.get('/:email/transactions', authenticate, requireSelfOrAdmin, getTransactions);
router.post('/:email/transactions', authenticate, requireSelfOrAdmin, addTransaction);

// Favorites routes
router.get('/:email/favorites', authenticate, requireSelfOrAdmin, getFavorites);
router.put('/:email/favorites', authenticate, requireSelfOrAdmin, updateFavorites);

// Previous calls routes
router.get('/:email/previous-calls', authenticate, requireSelfOrAdmin, getPreviousCalls);
router.put('/:email/previous-calls', authenticate, requireSelfOrAdmin, updatePreviousCalls);

module.exports = router;

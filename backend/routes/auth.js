const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const googleAuthController = require('../controllers/googleAuthController');
const { loginLimiter, otpLimiter, registerLimiter } = require('../middleware/rateLimiter');
const { authenticate } = require('../middleware/auth');

// Google OAuth
router.get('/google', googleAuthController.initiateGoogleAuth);
router.get('/google/callback', googleAuthController.handleGoogleCallback);

// Registration
router.post('/register', registerLimiter, authController.register);

// Login with password
router.post('/login', loginLimiter, authController.login);

// OTP-based authentication
router.post('/send-otp', authController.sendOTP);
router.post('/verify-otp', loginLimiter, authController.verifyOTP);

// Email verification
router.post('/verify-email', authController.verifyEmail);
router.post('/resend-verification', otpLimiter, authController.resendVerification);

// External Provider Login Handlers (Bypassing external googleapi)
// No IP-based rate limiter here — this is a server-to-server call from the
// Next.js frontend. All production users share the same origin IP so a
// per-IP limiter would block legitimate logins after just a few attempts.
router.post('/google-login', authController.googleLoginPost);

// Mobile OTP login via Fast2SMS
router.post('/send-mobile-otp', authController.sendMobileOTP);
router.post('/verify-mobile-otp', loginLimiter, authController.verifyMobileOTP);

// Complete profile after mobile-OTP signup (collect Name / Display Name)
router.post('/complete-profile', authenticate, authController.completeProfile);

// Password reset
router.post('/forgot-password', otpLimiter, authController.forgotPassword);
router.post('/reset-password', authController.resetPassword);

module.exports = router;

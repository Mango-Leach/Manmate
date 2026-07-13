const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const axios = require('axios');
const UserModel = require('../models/User');
const otpService = require('../services/otpService');
const emailService = require('../services/emailService');
const { generateToken } = require('../middleware/auth');
const AppError = require('../utils/AppError');
const logger = require('../utils/logger');

/**
 * Register new user with email and password
 */
const register = async (req, res, next) => {
  try {
    const { name, email, password, phone } = req.body;

    // Validate input
    if (!name || !email || !password) {
      throw new AppError('Name, email, and password are required', 400);
    }

    // Check if user already exists
    const existingUser = await UserModel.findByEmail(email);

    // If user exists and has a password, they're already registered
    if (existingUser && existingUser.password) {
      throw new AppError('User with this email already exists', 409);
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 12);

    // Generate email verification token
    const emailVerificationToken = crypto.randomBytes(32).toString('hex');

    let user;

    // If user was pre-created by admin (listener without password), update them
    if (existingUser && !existingUser.password) {
      await UserModel.update(email, {
        name,
        phone,
        password: hashedPassword,
        provider: 'local',
        emailVerificationToken,
        // Preserve the role (listener) that was set by admin
      });

      // Fetch the updated user to ensure we have all fields
      user = await UserModel.findByEmail(email);
      logger.info(`Listener completed registration: ${email}`);
    } else {
      // Create new user
      user = await UserModel.create({
        name,
        email,
        phone,
        password: hashedPassword,
        provider: 'local',
        emailVerificationToken,
      });
    }

    // Send verification email
    try {
      await emailService.sendEmailVerification(email, emailVerificationToken);
    } catch (emailError) {
      logger.error('Failed to send verification email:', emailError);
      // Don't fail registration if email fails
    }

    // Generate JWT token
    const token = generateToken({
      userId: user._id.toString(),
      email: user.email,
      name: user.name,
      role: user.role,
    });

    logger.info(`User registered: ${email}`);

    res.status(201).json({
      success: true,
      message: 'Registration successful. Please check your email to verify your account.',
      data: {
        user: {
          id: user._id.toString(),
          name: user.name,
          email: user.email,
          phone: user.phone,
          emailVerified: user.emailVerified,
          role: user.role,
        },
        token,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Login with email and password
 */
const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    // Validate input
    if (!email || !password) {
      throw new AppError('Email and password are required', 400);
    }

    // Check if account is locked
    const isLocked = await UserModel.isLocked(email);
    if (isLocked) {
      throw new AppError('Account is temporarily locked due to too many failed login attempts. Please try again in 15 minutes.', 423);
    }

    // Find user
    const user = await UserModel.findByEmail(email);
    if (!user || !user.password) {
      await UserModel.incrementLoginAttempts(email);
      throw new AppError('Invalid email or password', 401);
    }

    // Block suspended accounts
    if (user.isSuspended) {
      return res.status(403).json({ success: false, suspended: true, message: 'Your account has been suspended due to a violation of our community standards. Please contact support to appeal.' });
    }

    // Verify password
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      await UserModel.incrementLoginAttempts(email);
      throw new AppError('Invalid email or password', 401);
    }

    // Reset login attempts on successful login
    await UserModel.resetLoginAttempts(email);

    // Generate JWT token
    const token = generateToken({
      userId: user._id.toString(),
      email: user.email,
      name: user.name,
      role: user.role,
    });

    logger.info(`User logged in: ${email}`);

    res.json({
      success: true,
      message: 'Login successful',
      data: {
        user: {
          id: user._id.toString(),
          name: user.name,
          email: user.email,
          phone: user.phone,
          emailVerified: user.emailVerified,
          role: user.role,
        },
        token,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Send OTP to email for passwordless login
 */
const sendOTP = async (req, res, next) => {
  try {
    const { email } = req.body;

    if (!email) {
      throw new AppError('Email is required', 400);
    }

    // Send OTP
    const result = await otpService.sendOTP(email);

    res.json({
      success: true,
      message: result.message,
      data: {
        expiresIn: result.expiresIn,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Verify OTP and login/register user
 */
const verifyOTP = async (req, res, next) => {
  try {
    const { email, code, name, phone } = req.body;

    if (!email || !code) {
      throw new AppError('Email and OTP code are required', 400);
    }

    // Verify OTP
    await otpService.verifyOTPCode(email, code);

    // Find or create user
    let user = await UserModel.findByEmail(email);

    // Block suspended accounts before issuing a token
    if (user?.isSuspended) {
      return res.status(403).json({ success: false, suspended: true, message: 'Your account has been suspended due to a violation of our community standards. Please contact support to appeal.' });
    }

    if (!user) {
      // Create new user if doesn't exist
      if (!name) {
        throw new AppError('Name is required for new users', 400);
      }

      user = await UserModel.create({
        name,
        email,
        phone,
        provider: 'otp',
        emailVerified: true, // Email is verified via OTP
      });

      logger.info(`New user created via OTP: ${email}`);
    } else {
      // Update existing user (could be listener pre-created by admin)
      const updates = { emailVerified: true };

      // If user was pre-created by admin without name, add it
      if (!user.name && name) {
        updates.name = name;
      }
      if (!user.phone && phone) {
        updates.phone = phone;
      }
      // Set provider if not set
      if (!user.provider) {
        updates.provider = 'otp';
      }

      user = await UserModel.update(email, updates);

      // Re-fetch user if update returned null (shouldn't happen, but safety check)
      if (!user) {
        user = await UserModel.findByEmail(email);
        if (!user) {
          throw new AppError('User not found after update', 500);
        }
      }

      // Ensure role has a default value
      if (!user.role) {
        user.role = 'client';
      }

      if (user.role === 'listener') {
        logger.info(`Listener logged in via OTP: ${email}`);
      }
      if (user.role === 'therapist') {
        logger.info(`Therapist logged in via OTP: ${email}`);
      }
    }

    // Reset login attempts
    await UserModel.resetLoginAttempts(email);

    // Ensure user has all required fields
    if (!user.role) {
      user.role = 'client';
    }

    // Generate JWT token with full user object (matching Google OAuth pattern)
    const token = generateToken({
      userId: user._id.toString(),
      email: user.email,
      name: user.name,
      phone: user.phone || '',
      role: user.role || 'client',
      emailVerified: user.emailVerified,
      provider: user.provider || 'otp',
      picture: user.picture || '',
    });

    logger.info(`User logged in via OTP: ${email}`);

    res.json({
      success: true,
      message: 'OTP verified successfully',
      data: {
        user: {
          id: user._id.toString(),
          name: user.name,
          email: user.email,
          phone: user.phone || '',
          emailVerified: user.emailVerified,
          role: user.role || 'client',
          provider: user.provider || 'otp',
          picture: user.picture || '',
        },
        token,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Verify email address with token
 */
const verifyEmail = async (req, res, next) => {
  try {
    const { token } = req.body;

    if (!token) {
      throw new AppError('Verification token is required', 400);
    }

    // Find user with this token
    const db = require('../config/database').getDB();
    const user = await db.collection('users').findOne({
      emailVerificationToken: token,
    });

    if (!user) {
      throw new AppError('Invalid or expired verification token', 400);
    }

    // Update user
    await UserModel.update(user.email, {
      emailVerified: true,
      emailVerificationToken: null,
    });

    logger.info(`Email verified: ${user.email}`);

    res.json({
      success: true,
      message: 'Email verified successfully',
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Request password reset
 */
const forgotPassword = async (req, res, next) => {
  try {
    const { email } = req.body;

    if (!email) {
      throw new AppError('Email is required', 400);
    }

    const user = await UserModel.findByEmail(email);
    if (!user) {
      // Don't reveal if user exists
      res.json({
        success: true,
        message: 'If an account exists with this email, a password reset link has been sent.',
      });
      return;
    }

    // Generate reset token
    const resetToken = crypto.randomBytes(32).toString('hex');
    const resetExpires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    // Save token
    await UserModel.update(email, {
      passwordResetToken: resetToken,
      passwordResetExpires: resetExpires,
    });

    // Send email
    try {
      await emailService.sendPasswordReset(email, resetToken);
    } catch (emailError) {
      logger.error('Failed to send password reset email:', emailError);
      throw new AppError('Failed to send password reset email', 500);
    }

    logger.info(`Password reset requested: ${email}`);

    res.json({
      success: true,
      message: 'If an account exists with this email, a password reset link has been sent.',
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Reset password with token
 */
const resetPassword = async (req, res, next) => {
  try {
    const { token, password } = req.body;

    if (!token || !password) {
      throw new AppError('Token and new password are required', 400);
    }

    // Find user with valid token
    const db = require('../config/database').getDB();
    const user = await db.collection('users').findOne({
      passwordResetToken: token,
      passwordResetExpires: { $gt: new Date() },
    });

    if (!user) {
      throw new AppError('Invalid or expired reset token', 400);
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(password, 12);

    // Update user
    await UserModel.update(user.email, {
      password: hashedPassword,
      passwordResetToken: null,
      passwordResetExpires: null,
      loginAttempts: 0,
      lockUntil: null,
    });

    logger.info(`Password reset: ${user.email}`);

    res.json({
      success: true,
      message: 'Password reset successful. You can now login with your new password.',
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Resend verification email
 */
const resendVerification = async (req, res, next) => {
  try {
    const { email } = req.body;

    if (!email) {
      throw new AppError('Email is required', 400);
    }

    const user = await UserModel.findByEmail(email);
    if (!user) {
      throw new AppError('User not found', 404);
    }

    if (user.emailVerified) {
      throw new AppError('Email is already verified', 400);
    }

    // Generate new token
    const emailVerificationToken = crypto.randomBytes(32).toString('hex');
    await UserModel.update(email, { emailVerificationToken });

    // Send email
    await emailService.sendEmailVerification(email, emailVerificationToken);

    res.json({
      success: true,
      message: 'Verification email sent',
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Handle Google Login from Frontend API Route
 */
const googleLoginPost = async (req, res, next) => {
  try {
    const { email, name, picture } = req.body;

    if (!email) {
      throw new AppError('Email is required for Google login', 400);
    }

    logger.info(`[Google Login] Received email from Google: ${email}`);

    // Find or create user
    let user = await UserModel.findByEmail(email);

    if (!user) {
      logger.info(`[Google Login] No user found in DB for: ${email} — creating new user with role: client`);
      // Create new user
      user = await UserModel.create({
        name: name || 'Google User',
        email,
        provider: 'google',
        picture,
        emailVerified: true, // Google emails are pre-verified
      });
      logger.info(`New user created via Google POST: ${email}`);
    } else {
      logger.info(`[Google Login] Found user in DB: ${email}, current role: ${user.role}`);
      // Update existing user with Google info (merge accounts)
      const updates = {
        emailVerified: true, // Google emails are verified
      };

      // Update provider only if it was OTP or not set
      if (!user.provider || user.provider === 'otp') {
        updates.provider = 'google';
      }

      // Update picture if not set or if logging in with Google
      if (!user.picture || user.provider === 'google') {
        updates.picture = picture;
      }

      // Update name if not set
      if (!user.name || user.name === email) {
        if (name) updates.name = name;
      }

      await UserModel.update(email, updates);

      // Re-fetch user to make sure we have the full synced object (for roles)
      const refreshedUser = await UserModel.findByEmail(email);
      if (refreshedUser) {
        user = refreshedUser;
      }
      logger.info(`[Google Login] After re-fetch, user role: ${user.role}`);

      logger.info(`User logged in via Google POST: ${email}`);
    }

    logger.info(`[Google Login] Final role being put into JWT: ${user.role || 'client'}`);

    // Generate JWT token with full user object
    const token = generateToken({
      userId: user._id.toString(),
      email: user.email,
      name: user.name,
      phone: user.phone || '',
      role: user.role || 'client',
      emailVerified: user.emailVerified,
      provider: user.provider || 'google',
      picture: user.picture || '',
    });

    res.json({
      success: true,
      message: 'Google login successful',
      data: {
        user: {
          id: user._id.toString(),
          name: user.name,
          email: user.email,
          phone: user.phone || '',
          emailVerified: user.emailVerified,
          role: user.role || 'client',
          provider: user.provider || 'google',
          picture: user.picture || '',
        },
        token,
      },
    });
  } catch (error) {
    next(error);
  }
};

// In-memory OTP store: phone -> { otp, expiresAt, attempts, sentAt }
const mobileOtpStore = new Map();

const RESEND_COOLDOWN_SECONDS = 60;

/**
 * Step 1 — Generate OTP and send via Fast2SMS
 */
const sendMobileOTP = async (req, res, next) => {
  try {
    const { phone } = req.body;

    if (!phone || !/^\d{10}$/.test(phone)) {
      throw new AppError('Enter a valid 10-digit mobile number', 400);
    }

    // Enforce cooldown to prevent Fast2SMS spam detection
    const existing = mobileOtpStore.get(phone);
    if (existing?.sentAt) {
      const elapsed = Math.floor((Date.now() - existing.sentAt) / 1000);
      const remaining = RESEND_COOLDOWN_SECONDS - elapsed;
      if (remaining > 0) {
        return res.status(429).json({
          success: false,
          message: `Please wait ${remaining} second${remaining !== 1 ? 's' : ''} before requesting another OTP.`,
          retryAfter: remaining,
        });
      }
    }

    const otp = String(Math.floor(100000 + Math.random() * 900000));
    const sentAt = Date.now();
    const expiresAt = sentAt + 5 * 60 * 1000;

    // Send via Fast2SMS OTP route
    const response = await axios.post(
      'https://www.fast2sms.com/dev/bulkV2',
      {
        route: 'otp',
        variables_values: otp,
        flash: 0,
        numbers: phone,
      },
      {
        headers: {
          authorization: process.env.FAST2SMS_API_KEY,
          'Content-Type': 'application/json',
        },
        timeout: 10000,
      }
    );

    if (!response.data?.return) {
      logger.error('Fast2SMS send-otp failed:', response.data);
      throw new AppError('Could not send OTP. Please try again.', 400);
    }

    mobileOtpStore.set(phone, { otp, expiresAt, sentAt, attempts: 0 });
    logger.info(`Mobile OTP sent via Fast2SMS to +91${phone}`);

    res.json({ success: true, message: 'OTP sent to your mobile number' });
  } catch (error) {
    if (error.response) {
      logger.error('Fast2SMS error:', error.response.data);
      const msg = Array.isArray(error.response.data?.message)
        ? error.response.data.message[0]
        : error.response.data?.message || 'Could not send OTP. Please try again.';
      return next(new AppError(msg, 400));
    }
    next(error);
  }
};

/**
 * Step 2 — Verify OTP, then find/create user and return JWT
 */
const verifyMobileOTP = async (req, res, next) => {
  try {
    const { phone, otp } = req.body;

    if (!phone || !/^\d{10}$/.test(phone)) {
      throw new AppError('Enter a valid 10-digit mobile number', 400);
    }
    if (!otp || !/^\d{6}$/.test(otp)) {
      throw new AppError('Enter the 6-digit OTP sent to your mobile', 400);
    }

    const record = mobileOtpStore.get(phone);

    if (!record) {
      throw new AppError('No OTP found. Please request a new one.', 400);
    }
    if (Date.now() > record.expiresAt) {
      mobileOtpStore.delete(phone);
      throw new AppError('OTP has expired. Please request a new one.', 400);
    }
    if (record.attempts >= 5) {
      mobileOtpStore.delete(phone);
      throw new AppError('Too many incorrect attempts. Please request a new OTP.', 400);
    }
    if (record.otp !== otp) {
      record.attempts += 1;
      throw new AppError('Incorrect OTP. Please try again.', 400);
    }

    // OTP valid — clean up
    mobileOtpStore.delete(phone);

    const fullPhone = `+91${phone}`;

    // Find existing user by phone, or create a new one
    let user = await UserModel.findByPhone(fullPhone);

    if (!user) {
      const syntheticEmail = `91${phone}@phone.stressreliefchat`;
      const existingByEmail = await UserModel.findByEmail(syntheticEmail);
      if (existingByEmail) {
        user = existingByEmail;
        if (!user.phone) {
          await UserModel.update(syntheticEmail, { phone: fullPhone, phoneVerified: true });
          user = await UserModel.findByEmail(syntheticEmail);
        }
      } else {
        user = await UserModel.create({
          name: 'Member',
          email: syntheticEmail,
          phone: fullPhone,
          provider: 'phone',
          phoneVerified: true,
          emailVerified: false,
        });
        logger.info(`New user created via mobile OTP: ${fullPhone}`);
      }
    } else if (!user.phoneVerified) {
      await UserModel.update(user.email, { phoneVerified: true });
      user = await UserModel.findByEmail(user.email);
    }

    await UserModel.resetLoginAttempts(user.email);

    const token = generateToken({
      userId: user._id.toString(),
      email: user.email,
      name: user.name,
      phone: user.phone || fullPhone,
      role: user.role || 'client',
      emailVerified: user.emailVerified || false,
      provider: user.provider || 'phone',
      picture: user.picture || '',
    });

    logger.info(`User logged in via mobile OTP: ${fullPhone}`);

    // Mobile OTP has no name source (unlike email/Google login), so a freshly
    // created account carries the placeholder "Member". Tell the frontend it
    // must collect the user's Name and Display Name before proceeding.
    const needsProfile = !user.name || user.name === 'Member';

    res.json({
      success: true,
      message: 'Mobile OTP verified',
      data: {
        needsProfile,
        user: {
          id: user._id.toString(),
          name: user.name,
          email: user.email,
          phone: user.phone || fullPhone,
          role: user.role || 'client',
          provider: user.provider || 'phone',
          picture: user.picture || '',
        },
        token,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/auth/complete-profile  (authenticated)
 * Saves the user's Name and Display Name after a mobile-OTP signup, where no
 * name source exists. Returns a refreshed user object and a new JWT (so the
 * token's embedded name is no longer the "Member" placeholder).
 */
const completeProfile = async (req, res, next) => {
  try {
    const { name, displayName } = req.body;

    const cleanName = typeof name === 'string' ? name.trim() : '';
    const cleanDisplayName = typeof displayName === 'string' ? displayName.trim() : '';

    if (cleanName.length < 2 || cleanName.length > 100) {
      throw new AppError('Name must be between 2 and 100 characters', 400);
    }
    if (!/[a-zA-Z]/.test(cleanName)) {
      throw new AppError('Name must contain letters', 400);
    }
    if (cleanDisplayName && (cleanDisplayName.length < 2 || cleanDisplayName.length > 50)) {
      throw new AppError('Display name must be between 2 and 50 characters', 400);
    }

    const email = req.user.email;
    const existing = await UserModel.findByEmail(email);
    if (!existing) {
      throw new AppError('User not found', 404);
    }

    await UserModel.update(email, {
      name: cleanName,
      displayName: cleanDisplayName || cleanName,
      // `listenerName` is the field the rest of the app reads as the public
      // display name (profile page, chat sessions) — keep it in sync.
      listenerName: cleanDisplayName || cleanName,
    });

    const user = await UserModel.findByEmail(email);

    const token = generateToken({
      userId: user._id.toString(),
      email: user.email,
      name: user.name,
      phone: user.phone || '',
      role: user.role || 'client',
      emailVerified: user.emailVerified || false,
      provider: user.provider || 'phone',
      picture: user.picture || '',
    });

    logger.info(`Profile completed for ${email}: name="${cleanName}"`);

    res.json({
      success: true,
      message: 'Profile updated',
      data: {
        user: {
          id: user._id.toString(),
          name: user.name,
          email: user.email,
          phone: user.phone || '',
          role: user.role || 'client',
          provider: user.provider || 'phone',
          picture: user.picture || '',
        },
        token,
      },
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  register,
  login,
  sendOTP,
  verifyOTP,
  verifyEmail,
  forgotPassword,
  resetPassword,
  resendVerification,
  googleLoginPost,
  sendMobileOTP,
  verifyMobileOTP,
  completeProfile,
};

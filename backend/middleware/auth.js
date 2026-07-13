const jwt = require('jsonwebtoken');
const AppError = require('../utils/AppError');
const logger = require('../utils/logger');
const UserModel = require('../models/User');

// Secret key for JWT — MUST come from the environment in production. A
// predictable fallback secret would let anyone forge admin tokens.
if (!process.env.JWT_SECRET && process.env.NODE_ENV === 'production') {
  // Fail fast rather than boot with a known secret.
  throw new Error('JWT_SECRET environment variable is required in production');
}
if (!process.env.JWT_SECRET) {
  logger.warn('⚠️  JWT_SECRET not set — using an insecure development-only fallback. Set JWT_SECRET in .env.');
}
const JWT_SECRET = process.env.JWT_SECRET || 'dev-only-insecure-secret';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';

/**
 * Generate JWT token
 */
const generateToken = (payload) => {
  return jwt.sign(payload, JWT_SECRET, {
    expiresIn: JWT_EXPIRES_IN,
  });
};

/**
 * Verify JWT token
 */
const verifyToken = (token) => {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (error) {
    throw new AppError('Invalid or expired token', 401);
  }
};

/**
 * Authentication middleware
 * Protects routes by requiring a valid JWT token
 */
const authenticate = async (req, res, next) => {
  try {
    // Get token from header
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new AppError('No token provided. Please login to access this resource.', 401);
    }

    const token = authHeader.split(' ')[1];

    // Verify token
    const decoded = verifyToken(token);

    // Fetch current role from DB so role changes (e.g. therapist deleted) take effect immediately
    const dbUser = await UserModel.findByEmail(decoded.email);
    if (!dbUser) {
      throw new AppError('User no longer exists', 401);
    }
    if (dbUser.isSuspended) {
      throw new AppError('Your account has been suspended due to a violation of community standards.', 403);
    }

    // Attach user info to request, using DB role (not stale token role)
    // Add `id` as an alias for `userId` so controllers can use req.user.id
    req.user = { ...decoded, id: decoded.userId, role: dbUser.role };

    logger.info(`User authenticated: ${decoded.email || decoded.userId}`);
    next();
  } catch (error) {
    if (error instanceof AppError) {
      next(error);
    } else {
      next(new AppError('Authentication failed', 401));
    }
  }
};

/**
 * Optional authentication middleware
 * Does not block request if no token, but attaches user if token is valid
 */
const optionalAuth = (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.split(' ')[1];
      const decoded = verifyToken(token);
      req.user = decoded;
    }

    next();
  } catch (error) {
    // Silently fail for optional auth
    next();
  }
};

module.exports = {
  authenticate,
  optionalAuth,
  generateToken,
  verifyToken,
};

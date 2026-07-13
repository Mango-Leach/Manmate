const AppError = require('../utils/AppError');
const logger = require('../utils/logger');

/**
 * Middleware to check if user has required role(s)
 * Usage: requireRole('admin') or requireRole('admin', 'listener')
 */
const requireRole = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      logger.warn('Unauthorized access attempt - no user');
      return res.status(401).json({
        success: false,
        message: 'Authentication required',
      });
    }

    const userRole = req.user.role || 'client';

    if (!allowedRoles.includes(userRole)) {
      logger.warn(`Forbidden access attempt by ${req.user.email} with role ${userRole}`);
      return res.status(403).json({
        success: false,
        message: 'You do not have permission to access this resource',
      });
    }

    next();
  };
};

/**
 * Middleware to check if user is admin
 */
const requireAdmin = requireRole('admin');

/**
 * Middleware to check if user is listener or admin
 */
const requireListener = requireRole('listener', 'admin');

/**
 * Middleware to check if user is therapist or admin
 */
const requireTherapist = requireRole('therapist', 'admin');

/**
 * Middleware for routes scoped to /api/users/:email/…
 * Allows access only when the authenticated user is acting on their own
 * account (email param matches token email) or is an admin.
 */
const requireSelfOrAdmin = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ success: false, message: 'Authentication required' });
  }
  const paramEmail = decodeURIComponent(req.params.email || '').toLowerCase().trim();
  const tokenEmail = (req.user.email || '').toLowerCase().trim();
  if (req.user.role === 'admin' || (paramEmail && paramEmail === tokenEmail)) {
    return next();
  }
  logger.warn(`Forbidden self-scope access: ${tokenEmail} tried to access ${paramEmail}`);
  return res.status(403).json({
    success: false,
    message: 'You do not have permission to access this resource',
  });
};

module.exports = {
  requireRole,
  requireAdmin,
  requireListener,
  requireTherapist,
  requireSelfOrAdmin,
};

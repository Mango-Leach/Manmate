const { body, param, query, validationResult } = require('express-validator');
const AppError = require('../utils/AppError');
const { validateCity, validateBio, validateListenerName } = require('../utils/profileValidators');

/**
 * Validation middleware to check for validation errors
 */
const validate = (req, res, next) => {
  const errors = validationResult(req);

  if (!errors.isEmpty()) {
    const errorMessages = errors.array().map(err => ({
      field: err.param,
      message: err.msg,
    }));

    return next(new AppError('Validation failed', 400, true, errorMessages));
  }

  next();
};

/**
 * Validation rules for user creation/update
 */
const userValidation = [
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Please provide a valid email address'),
  body('name')
    .optional()
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage('Name must be between 2 and 100 characters'),
  body('phone')
    .optional()
    .trim()
    .matches(/^[0-9]{10}$/)
    .withMessage('Phone number must be 10 digits'),
  validate,
];

/**
 * Validation rules for wallet operations
 */
const walletValidation = [
  body('amount')
    .isFloat({ min: 0.01 })
    .withMessage('Amount must be a positive number'),
  body('type')
    .optional()
    .isIn(['credit', 'debit'])
    .withMessage('Type must be either credit or debit'),
  validate,
];

/**
 * Validation rules for transactions
 */
const transactionValidation = [
  body('amount')
    .isFloat({ min: 0.01 })
    .withMessage('Amount must be a positive number'),
  body('type')
    .isIn(['payment', 'refund', 'wallet_credit', 'wallet_debit'])
    .withMessage('Invalid transaction type'),
  body('description')
    .trim()
    .isLength({ min: 1, max: 500 })
    .withMessage('Description is required and must be less than 500 characters'),
  validate,
];

/**
 * Validation rules for email parameter
 */
const emailParamValidation = [
  param('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Please provide a valid email address'),
  validate,
];

/**
 * Reusable middleware: validates free-text profile fields (city, bio, listenerName).
 * Uses pure helper functions from utils/profileValidators so the same rules can be
 * imported and reused by Listener and Therapist route chains without duplication.
 *
 * Skips any field that is absent or empty — existing profiles are never affected.
 */
const validateProfileFields = (req, res, next) => {
  const { city, bio, listenerName } = req.body;

  const cityResult = validateCity(city);
  if (!cityResult.valid) return next(new AppError(cityResult.message, 400));

  const bioResult = validateBio(bio);
  if (!bioResult.valid) return next(new AppError(bioResult.message, 400));

  const nameResult = validateListenerName(listenerName);
  if (!nameResult.valid) return next(new AppError(nameResult.message, 400));

  next();
};

/**
 * Reusable middleware: rejects requests where `dob` (date of birth) is a future date.
 * Safe to reuse across Member, Listener, and Therapist profile update routes.
 *
 * Accepts:  YYYY-MM-DD strings (HTML date input format) or any value parseable by Date()
 * Skips:    requests that do not include a `dob` field at all (no dob = no error)
 */
const validateDobNotFuture = (req, res, next) => {
  const { dob } = req.body;

  // Only validate when dob is explicitly provided in the payload
  if (dob === undefined || dob === null || dob === '') return next();

  const dobDate = new Date(dob);

  // Reject unparseable strings
  if (isNaN(dobDate.getTime())) {
    return next(new AppError('Invalid date of birth.', 400));
  }

  // Compare against today at midnight (UTC) so time-of-day differences are irrelevant
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  if (dobDate > today) {
    return next(new AppError('Date of birth cannot be in the future.', 400));
  }

  next();
};

/**
 * Sanitize user input to prevent XSS and injection attacks
 */
const sanitizeInput = (req, res, next) => {
  // Remove any HTML tags from string inputs
  const sanitizeString = (str) => {
    if (typeof str !== 'string') return str;
    return str.replace(/<[^>]*>/g, '').trim();
  };

  // Sanitize body
  if (req.body) {
    Object.keys(req.body).forEach(key => {
      if (typeof req.body[key] === 'string') {
        req.body[key] = sanitizeString(req.body[key]);
      }
    });
  }

  // Sanitize query parameters
  if (req.query) {
    Object.keys(req.query).forEach(key => {
      if (typeof req.query[key] === 'string') {
        req.query[key] = sanitizeString(req.query[key]);
      }
    });
  }

  next();
};

module.exports = {
  validate,
  userValidation,
  walletValidation,
  transactionValidation,
  emailParamValidation,
  sanitizeInput,
  validateDobNotFuture,
  validateProfileFields,
};

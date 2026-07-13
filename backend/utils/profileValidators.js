/**
 * profileValidators.js
 *
 * Pure, reusable validation helpers for user-facing profile fields.
 * Each function accepts a raw field value and returns { valid, message }.
 *
 * Design goals:
 *  - No Express/HTTP dependency — safe to import anywhere (middleware, controllers, tests)
 *  - Skip validation (return valid) when the field is absent, null, or empty string
 *    → existing profiles with no value for a field are never affected
 *  - Regex defined once here; imported by the Express middleware layer
 *  - Mirror rules are kept in sync in frontend/lib/profileValidators.ts
 *
 * Reuse across modules:
 *  Member  → backend/middleware/validator.js → validateProfileFields middleware
 *  Listener → add validateProfileFields to listener profile PUT route when ready
 *  Therapist → add validateProfileFields to therapist profile PUT route when ready
 */

/**
 * Regex: letters (incl. accented/Indic-latin range U+00C0–U+024F), spaces,
 * hyphens, dots, and apostrophes.
 * Covers: "New Delhi", "St. Louis", "O'Brien City", "Thiruvananthapuram", etc.
 */
const CITY_REGEX = /^[A-Za-z\u00C0-\u024F\s\-.']+$/;
const CITY_MAX   = 100;

/**
 * Bio / listenerName must contain at least one alphanumeric character.
 * Rejects pure-symbol strings (@@@, ###$$$, @@cdecefc) while allowing
 * normal sentences, emojis mixed with text, punctuation, numbers, etc.
 */
const HAS_ALPHANUM_REGEX = /[A-Za-z0-9]/;
const BIO_MAX            = 500;
const LISTENER_NAME_MAX  = 60;

// ---------------------------------------------------------------------------

/**
 * Validate a city name.
 * @param {*} value - raw request body value
 * @returns {{ valid: boolean, message: string }}
 */
function validateCity(value) {
  if (value === undefined || value === null || value === '') {
    return { valid: true, message: '' };
  }

  const str = String(value).trim();

  if (str.length > CITY_MAX) {
    return { valid: false, message: `City must be at most ${CITY_MAX} characters.` };
  }

  if (!CITY_REGEX.test(str)) {
    return {
      valid: false,
      message: 'City must contain only letters, spaces, hyphens, dots, or apostrophes.',
    };
  }

  return { valid: true, message: '' };
}

/**
 * Validate a bio / about-me text.
 * @param {*} value - raw request body value
 * @returns {{ valid: boolean, message: string }}
 */
function validateBio(value) {
  if (value === undefined || value === null || value === '') {
    return { valid: true, message: '' };
  }

  const str = String(value).trim();

  if (str.length > BIO_MAX) {
    return { valid: false, message: `Bio must be at most ${BIO_MAX} characters.` };
  }

  if (!HAS_ALPHANUM_REGEX.test(str)) {
    return { valid: false, message: 'Bio must contain at least one letter or number.' };
  }

  return { valid: true, message: '' };
}

/**
 * Validate a display / listener name.
 * @param {*} value - raw request body value
 * @returns {{ valid: boolean, message: string }}
 */
function validateListenerName(value) {
  if (value === undefined || value === null || value === '') {
    return { valid: true, message: '' };
  }

  const str = String(value).trim();

  if (str.length > LISTENER_NAME_MAX) {
    return { valid: false, message: `Display name must be at most ${LISTENER_NAME_MAX} characters.` };
  }

  if (!HAS_ALPHANUM_REGEX.test(str)) {
    return {
      valid: false,
      message: 'Display name must contain at least one letter or number.',
    };
  }

  return { valid: true, message: '' };
}

module.exports = { validateCity, validateBio, validateListenerName };

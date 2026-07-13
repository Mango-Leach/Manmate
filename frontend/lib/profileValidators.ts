/**
 * profileValidators.ts
 *
 * Pure, reusable validation helpers for user-facing profile fields.
 * Mirrors the rules in backend/utils/profileValidators.js so client-side
 * and server-side validation never drift apart.
 */

export interface ValidationResult {
  valid: boolean;
  message: string;
}

const CITY_REGEX = /^[A-Za-zÀ-ɏ\s\-.']+$/;
const CITY_MAX = 100;

const HAS_ALPHANUM_REGEX = /[A-Za-z0-9]/;
const BIO_MAX = 500;
const LISTENER_NAME_MAX = 60;

export function validateCity(value: string): ValidationResult {
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

export function validateBio(value: string): ValidationResult {
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

export function validateListenerName(value: string): ValidationResult {
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

import type { ValidationResult, PasswordStrength } from '../types';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Validates an email address format
 */
export function validateEmail(email: string): ValidationResult {
  if (!email || !EMAIL_REGEX.test(email)) {
    return {
      valid: false,
      error: 'Please enter a valid email address',
    };
  }
  return { valid: true };
}

/**
 * Validates password meets minimum requirements:
 * - At least 8 characters
 * - At least one uppercase letter
 * - At least one lowercase letter
 * - At least one number
 */
export function validatePassword(password: string): ValidationResult {
  if (password.length < 8) {
    return {
      valid: false,
      error: 'Password must be at least 8 characters',
    };
  }

  if (!/[A-Z]/.test(password)) {
    return {
      valid: false,
      error: 'Password must contain at least one uppercase letter',
    };
  }

  if (!/[a-z]/.test(password)) {
    return {
      valid: false,
      error: 'Password must contain at least one lowercase letter',
    };
  }

  if (!/\d/.test(password)) {
    return {
      valid: false,
      error: 'Password must contain at least one number',
    };
  }

  return { valid: true };
}

/**
 * Calculates password strength score (0-4) with feedback
 */
export function validatePasswordStrength(password: string): PasswordStrength {
  let score = 0;

  // Very weak: too short
  if (password.length < 6) {
    return { score: 0, feedback: 'Too short' };
  }

  // Base score for length
  if (password.length >= 8) score++;
  if (password.length >= 12) score++;

  // Check for character variety
  if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score++;
  if (/\d/.test(password)) score++;
  if (/[^a-zA-Z\d]/.test(password)) score++;

  // Cap at 4
  score = Math.min(score, 4);

  // Ensure minimum score of 1 for 6+ char passwords
  if (score === 0 && password.length >= 6) score = 1;

  const feedbackMap: Record<number, string> = {
    0: 'Too short',
    1: 'Weak',
    2: 'Fair',
    3: 'Good',
    4: 'Strong',
  };

  return {
    score,
    feedback: feedbackMap[score],
  };
}

/**
 * Validates that a value is not empty
 */
export function validateRequired(
  value: string,
  fieldName?: string
): ValidationResult {
  if (!value || !value.trim()) {
    return {
      valid: false,
      error: fieldName ? `${fieldName} is required` : 'This field is required',
    };
  }
  return { valid: true };
}

/**
 * Validates minimum length
 */
export function validateMinLength(
  value: string,
  minLength: number
): ValidationResult {
  if (value.length < minLength) {
    return {
      valid: false,
      error: `Must be at least ${minLength} characters`,
    };
  }
  return { valid: true };
}

/**
 * Validates maximum length
 */
export function validateMaxLength(
  value: string,
  maxLength: number
): ValidationResult {
  if (value.length > maxLength) {
    return {
      valid: false,
      error: `Must be at most ${maxLength} characters`,
    };
  }
  return { valid: true };
}

/**
 * Validates that two values match (e.g., password confirmation)
 */
export function validateMatch(
  value: string,
  matchValue: string,
  fieldName?: string
): ValidationResult {
  if (value !== matchValue) {
    return {
      valid: false,
      error: fieldName ? `${fieldName} do not match` : 'Values do not match',
    };
  }
  return { valid: true };
}

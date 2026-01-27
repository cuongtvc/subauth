import type { ValidationResult } from '../types';
import { cn } from '../utils/classes';
import { validateEmail } from '../utils/validation';

export const RESEND_VERIFICATION_FORM_CLASS = 'subauth-resend-verification-form';

export interface ResendVerificationFormConfig {
  loading?: boolean;
  success?: boolean;
  error?: string;
}

export interface ResendVerificationFormState {
  email: string;
  loading: boolean;
  success: boolean;
  error?: string;
  validationError?: string;
}

/**
 * Generates the class names for the resend verification form
 */
export function getResendVerificationFormClasses(
  config: ResendVerificationFormConfig,
  className?: string
): string {
  const { loading = false, success = false, error } = config;

  return cn(RESEND_VERIFICATION_FORM_CLASS, className, {
    'subauth-resend-verification-form--loading': loading,
    'subauth-resend-verification-form--success': success,
    'subauth-resend-verification-form--error': !!error,
  });
}

/**
 * Validates the resend verification form data
 */
export function validateResendVerificationForm(email: string): ValidationResult {
  return validateEmail(email);
}

/**
 * Creates initial state for the resend verification form
 */
export function createResendVerificationFormState(): ResendVerificationFormState {
  return {
    email: '',
    loading: false,
    success: false,
    error: undefined,
    validationError: undefined,
  };
}

/**
 * Default messages for the resend verification form
 */
export const RESEND_VERIFICATION_MESSAGES = {
  title: 'Resend verification email',
  description: 'Enter your email address and we\'ll send you a new verification link.',
  submitButton: 'Resend verification email',
  submitButtonLoading: 'Sending...',
  successMessage: 'If an unverified account exists with that email, we\'ve sent a new verification link.',
  backToLoginText: 'Already verified?',
  backToLoginLink: 'Sign in',
} as const;
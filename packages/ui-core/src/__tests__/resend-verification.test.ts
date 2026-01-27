import { describe, it, expect } from 'vitest';
import {
  getResendVerificationFormClasses,
  validateResendVerificationForm,
  createResendVerificationFormState,
  RESEND_VERIFICATION_FORM_CLASS,
  RESEND_VERIFICATION_MESSAGES,
} from '../forms/resend-verification';

describe('getResendVerificationFormClasses', () => {
  it('should return base class by default', () => {
    const classes = getResendVerificationFormClasses({});
    expect(classes).toContain(RESEND_VERIFICATION_FORM_CLASS);
  });

  it('should apply loading class when loading', () => {
    const classes = getResendVerificationFormClasses({ loading: true });
    expect(classes).toContain('subauth-resend-verification-form--loading');
  });

  it('should apply success class when success', () => {
    const classes = getResendVerificationFormClasses({ success: true });
    expect(classes).toContain('subauth-resend-verification-form--success');
  });

  it('should apply error class when error is provided', () => {
    const classes = getResendVerificationFormClasses({ error: 'Some error' });
    expect(classes).toContain('subauth-resend-verification-form--error');
  });

  it('should not apply error class when error is undefined', () => {
    const classes = getResendVerificationFormClasses({});
    expect(classes).not.toContain('subauth-resend-verification-form--error');
  });

  it('should include custom className', () => {
    const classes = getResendVerificationFormClasses({}, 'custom-class');
    expect(classes).toContain('custom-class');
  });

  it('should combine multiple states correctly', () => {
    const classes = getResendVerificationFormClasses({
      loading: true,
      error: 'Error',
    });
    expect(classes).toContain(RESEND_VERIFICATION_FORM_CLASS);
    expect(classes).toContain('subauth-resend-verification-form--loading');
    expect(classes).toContain('subauth-resend-verification-form--error');
  });
});

describe('validateResendVerificationForm', () => {
  it('should return valid for correct email', () => {
    const result = validateResendVerificationForm('user@example.com');
    expect(result.valid).toBe(true);
  });

  it('should return invalid for empty email', () => {
    const result = validateResendVerificationForm('');
    expect(result.valid).toBe(false);
  });

  it('should return invalid for malformed email', () => {
    const result = validateResendVerificationForm('invalid-email');
    expect(result.valid).toBe(false);
  });

  it('should provide error message for invalid email', () => {
    const result = validateResendVerificationForm('invalid');
    expect(result.error).toBeDefined();
  });
});

describe('createResendVerificationFormState', () => {
  it('should return initial state with empty email', () => {
    const state = createResendVerificationFormState();
    expect(state.email).toBe('');
  });

  it('should return initial state with loading false', () => {
    const state = createResendVerificationFormState();
    expect(state.loading).toBe(false);
  });

  it('should return initial state with success false', () => {
    const state = createResendVerificationFormState();
    expect(state.success).toBe(false);
  });

  it('should return initial state with no error', () => {
    const state = createResendVerificationFormState();
    expect(state.error).toBeUndefined();
  });

  it('should return initial state with no validation error', () => {
    const state = createResendVerificationFormState();
    expect(state.validationError).toBeUndefined();
  });
});

describe('RESEND_VERIFICATION_MESSAGES', () => {
  it('should have title message', () => {
    expect(RESEND_VERIFICATION_MESSAGES.title).toBe('Resend verification email');
  });

  it('should have description message', () => {
    expect(RESEND_VERIFICATION_MESSAGES.description).toBeDefined();
    expect(typeof RESEND_VERIFICATION_MESSAGES.description).toBe('string');
  });

  it('should have submit button text', () => {
    expect(RESEND_VERIFICATION_MESSAGES.submitButton).toBe('Resend verification email');
  });

  it('should have loading button text', () => {
    expect(RESEND_VERIFICATION_MESSAGES.submitButtonLoading).toBe('Sending...');
  });

  it('should have success message', () => {
    expect(RESEND_VERIFICATION_MESSAGES.successMessage).toBeDefined();
    expect(RESEND_VERIFICATION_MESSAGES.successMessage).toContain('unverified account');
  });

  it('should have back to login text', () => {
    expect(RESEND_VERIFICATION_MESSAGES.backToLoginText).toBe('Already verified?');
  });

  it('should have back to login link text', () => {
    expect(RESEND_VERIFICATION_MESSAGES.backToLoginLink).toBe('Sign in');
  });
});
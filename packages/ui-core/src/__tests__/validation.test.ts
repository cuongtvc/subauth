import { describe, it, expect } from 'vitest';
import {
  validateEmail,
  validatePassword,
  validatePasswordStrength,
  validateRequired,
  validateMinLength,
  validateMaxLength,
  validateMatch,
} from '../utils/validation';

describe('validateEmail', () => {
  it('should return valid for correct email formats', () => {
    expect(validateEmail('user@example.com').valid).toBe(true);
    expect(validateEmail('user.name@example.com').valid).toBe(true);
    expect(validateEmail('user+tag@example.com').valid).toBe(true);
    expect(validateEmail('user@subdomain.example.com').valid).toBe(true);
  });

  it('should return invalid for incorrect email formats', () => {
    expect(validateEmail('').valid).toBe(false);
    expect(validateEmail('user').valid).toBe(false);
    expect(validateEmail('user@').valid).toBe(false);
    expect(validateEmail('@example.com').valid).toBe(false);
    expect(validateEmail('user@example').valid).toBe(false);
    expect(validateEmail('user example.com').valid).toBe(false);
  });

  it('should provide an error message for invalid emails', () => {
    const result = validateEmail('invalid');
    expect(result.valid).toBe(false);
    expect(result.error).toBe('Please enter a valid email address');
  });
});

describe('validatePassword', () => {
  it('should return valid for passwords meeting requirements', () => {
    expect(validatePassword('Password1!').valid).toBe(true);
    expect(validatePassword('SecurePass123').valid).toBe(true);
    expect(validatePassword('MyP@ssw0rd').valid).toBe(true);
  });

  it('should require minimum 8 characters', () => {
    const result = validatePassword('Pass1!');
    expect(result.valid).toBe(false);
    expect(result.error).toContain('8 characters');
  });

  it('should require at least one uppercase letter', () => {
    const result = validatePassword('password1!');
    expect(result.valid).toBe(false);
    expect(result.error).toContain('uppercase');
  });

  it('should require at least one lowercase letter', () => {
    const result = validatePassword('PASSWORD1!');
    expect(result.valid).toBe(false);
    expect(result.error).toContain('lowercase');
  });

  it('should require at least one number', () => {
    const result = validatePassword('Password!');
    expect(result.valid).toBe(false);
    expect(result.error).toContain('number');
  });
});

describe('validatePasswordStrength', () => {
  it('should return score 0 for very weak passwords', () => {
    expect(validatePasswordStrength('').score).toBe(0);
    expect(validatePasswordStrength('a').score).toBe(0);
    expect(validatePasswordStrength('abc').score).toBe(0);
  });

  it('should return score 1 for weak passwords', () => {
    const result = validatePasswordStrength('password');
    expect(result.score).toBe(1);
    expect(result.feedback).toBe('Weak');
  });

  it('should return score 2 for fair passwords', () => {
    const result = validatePasswordStrength('Passwo1');
    expect(result.score).toBe(2);
    expect(result.feedback).toBe('Fair');
  });

  it('should return score 3 for good passwords', () => {
    const result = validatePasswordStrength('Password1');
    expect(result.score).toBe(3);
    expect(result.feedback).toBe('Good');
  });

  it('should return score 4 for strong passwords', () => {
    const result = validatePasswordStrength('Password1!');
    expect(result.score).toBe(4);
    expect(result.feedback).toBe('Strong');
  });
});

describe('validateRequired', () => {
  it('should return valid for non-empty values', () => {
    expect(validateRequired('hello').valid).toBe(true);
    expect(validateRequired('  hello  ').valid).toBe(true);
  });

  it('should return invalid for empty or whitespace values', () => {
    expect(validateRequired('').valid).toBe(false);
    expect(validateRequired('   ').valid).toBe(false);
  });

  it('should provide custom field name in error', () => {
    const result = validateRequired('', 'Email');
    expect(result.error).toBe('Email is required');
  });

  it('should use default field name if not provided', () => {
    const result = validateRequired('');
    expect(result.error).toBe('This field is required');
  });
});

describe('validateMinLength', () => {
  it('should return valid for values meeting minimum length', () => {
    expect(validateMinLength('hello', 3).valid).toBe(true);
    expect(validateMinLength('hello', 5).valid).toBe(true);
  });

  it('should return invalid for values below minimum length', () => {
    expect(validateMinLength('hi', 3).valid).toBe(false);
  });

  it('should provide error message with length requirement', () => {
    const result = validateMinLength('hi', 5);
    expect(result.error).toBe('Must be at least 5 characters');
  });
});

describe('validateMaxLength', () => {
  it('should return valid for values within maximum length', () => {
    expect(validateMaxLength('hello', 10).valid).toBe(true);
    expect(validateMaxLength('hello', 5).valid).toBe(true);
  });

  it('should return invalid for values exceeding maximum length', () => {
    expect(validateMaxLength('hello world', 5).valid).toBe(false);
  });

  it('should provide error message with length requirement', () => {
    const result = validateMaxLength('hello world', 5);
    expect(result.error).toBe('Must be at most 5 characters');
  });
});

describe('validateMatch', () => {
  it('should return valid when values match', () => {
    expect(validateMatch('password', 'password').valid).toBe(true);
  });

  it('should return invalid when values do not match', () => {
    expect(validateMatch('password', 'different').valid).toBe(false);
  });

  it('should provide custom field name in error', () => {
    const result = validateMatch('pass1', 'pass2', 'Passwords');
    expect(result.error).toBe('Passwords do not match');
  });

  it('should use default message if field name not provided', () => {
    const result = validateMatch('a', 'b');
    expect(result.error).toBe('Values do not match');
  });
});

import { describe, it, expect } from 'vitest';
import {
  getInputClasses,
  INPUT_BASE_CLASS,
} from '../components/input';

describe('getInputClasses', () => {
  it('should return base class by default', () => {
    const classes = getInputClasses({});
    expect(classes).toContain(INPUT_BASE_CLASS);
  });

  it('should apply error class when error is present', () => {
    const classes = getInputClasses({ error: 'Invalid input' });
    expect(classes).toContain('subauth-input--error');
  });

  it('should apply disabled class when disabled', () => {
    const classes = getInputClasses({ disabled: true });
    expect(classes).toContain('subauth-input--disabled');
  });

  it('should not have error class when no error', () => {
    const classes = getInputClasses({});
    expect(classes).not.toContain('subauth-input--error');
  });

  it('should combine error and disabled classes', () => {
    const classes = getInputClasses({ error: 'Error', disabled: true });
    expect(classes).toContain('subauth-input--error');
    expect(classes).toContain('subauth-input--disabled');
  });
});

import { describe, it, expect } from 'vitest';
import {
  getButtonClasses,
  BUTTON_BASE_CLASS,
  BUTTON_VARIANT_CLASSES,
  BUTTON_SIZE_CLASSES,
} from '../components/button';

describe('getButtonClasses', () => {
  it('should return base class by default', () => {
    const classes = getButtonClasses({});
    expect(classes).toContain(BUTTON_BASE_CLASS);
  });

  it('should include primary variant by default', () => {
    const classes = getButtonClasses({});
    expect(classes).toContain(BUTTON_VARIANT_CLASSES.primary);
  });

  it('should apply secondary variant', () => {
    const classes = getButtonClasses({ variant: 'secondary' });
    expect(classes).toContain(BUTTON_VARIANT_CLASSES.secondary);
  });

  it('should apply outline variant', () => {
    const classes = getButtonClasses({ variant: 'outline' });
    expect(classes).toContain(BUTTON_VARIANT_CLASSES.outline);
  });

  it('should apply ghost variant', () => {
    const classes = getButtonClasses({ variant: 'ghost' });
    expect(classes).toContain(BUTTON_VARIANT_CLASSES.ghost);
  });

  it('should apply danger variant', () => {
    const classes = getButtonClasses({ variant: 'danger' });
    expect(classes).toContain(BUTTON_VARIANT_CLASSES.danger);
  });

  it('should apply medium size by default', () => {
    const classes = getButtonClasses({});
    expect(classes).toContain(BUTTON_SIZE_CLASSES.md);
  });

  it('should apply small size', () => {
    const classes = getButtonClasses({ size: 'sm' });
    expect(classes).toContain(BUTTON_SIZE_CLASSES.sm);
  });

  it('should apply large size', () => {
    const classes = getButtonClasses({ size: 'lg' });
    expect(classes).toContain(BUTTON_SIZE_CLASSES.lg);
  });

  it('should apply disabled class when disabled', () => {
    const classes = getButtonClasses({ disabled: true });
    expect(classes).toContain('subauth-button--disabled');
  });

  it('should apply loading class when loading', () => {
    const classes = getButtonClasses({ loading: true });
    expect(classes).toContain('subauth-button--loading');
  });

  it('should apply full-width class when fullWidth', () => {
    const classes = getButtonClasses({ fullWidth: true });
    expect(classes).toContain('subauth-button--full-width');
  });

  it('should combine multiple options correctly', () => {
    const classes = getButtonClasses({
      variant: 'danger',
      size: 'lg',
      loading: true,
      fullWidth: true,
    });
    expect(classes).toContain(BUTTON_BASE_CLASS);
    expect(classes).toContain(BUTTON_VARIANT_CLASSES.danger);
    expect(classes).toContain(BUTTON_SIZE_CLASSES.lg);
    expect(classes).toContain('subauth-button--loading');
    expect(classes).toContain('subauth-button--full-width');
  });
});

import type { ButtonConfig, ButtonVariant, ButtonSize } from '../types';
import { cn } from '../utils/classes';

export const BUTTON_BASE_CLASS = 'subauth-button';

export const BUTTON_VARIANT_CLASSES: Record<ButtonVariant, string> = {
  primary: 'subauth-button--primary',
  secondary: 'subauth-button--secondary',
  outline: 'subauth-button--outline',
  ghost: 'subauth-button--ghost',
  danger: 'subauth-button--danger',
};

export const BUTTON_SIZE_CLASSES: Record<ButtonSize, string> = {
  sm: 'subauth-button--sm',
  md: 'subauth-button--md',
  lg: 'subauth-button--lg',
};

/**
 * Generates the class names for a button based on configuration
 */
export function getButtonClasses(config: ButtonConfig): string {
  const {
    variant = 'primary',
    size = 'md',
    disabled = false,
    loading = false,
    fullWidth = false,
  } = config;

  return cn(
    BUTTON_BASE_CLASS,
    BUTTON_VARIANT_CLASSES[variant],
    BUTTON_SIZE_CLASSES[size],
    {
      'subauth-button--disabled': disabled,
      'subauth-button--loading': loading,
      'subauth-button--full-width': fullWidth,
    }
  );
}

/**
 * Creates button attributes for vanilla JS usage
 */
export function getButtonAttributes(config: ButtonConfig): Record<string, string | boolean | undefined> {
  const { disabled = false, loading = false, type = 'button' } = config;

  return {
    type,
    class: getButtonClasses(config),
    disabled: disabled || loading || undefined,
    'aria-disabled': disabled || loading ? 'true' : undefined,
    'aria-busy': loading ? 'true' : undefined,
  };
}

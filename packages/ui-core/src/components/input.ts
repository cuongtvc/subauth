import type { InputConfig } from '../types';
import { cn } from '../utils/classes';

export const INPUT_BASE_CLASS = 'subauth-input';

/**
 * Generates the class names for an input based on configuration
 */
export function getInputClasses(config: InputConfig): string {
  const { error, disabled = false } = config;

  return cn(INPUT_BASE_CLASS, {
    'subauth-input--error': !!error,
    'subauth-input--disabled': disabled,
  });
}

/**
 * Creates input attributes for vanilla JS usage
 */
export function getInputAttributes(
  config: InputConfig
): Record<string, string | boolean | undefined> {
  const {
    type = 'text',
    placeholder,
    disabled = false,
    required = false,
    error,
  } = config;

  return {
    type,
    class: getInputClasses(config),
    placeholder,
    disabled: disabled || undefined,
    required: required || undefined,
    'aria-invalid': error ? 'true' : undefined,
    'aria-describedby': error ? 'error-message' : undefined,
  };
}

/**
 * Gets the error message element ID for accessibility
 */
export function getInputErrorId(inputId: string): string {
  return `${inputId}-error`;
}

/**
 * Gets the label ID for accessibility
 */
export function getInputLabelId(inputId: string): string {
  return `${inputId}-label`;
}

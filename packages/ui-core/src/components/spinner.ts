import type { SpinnerConfig, SpinnerSize } from '../types';
import { cn } from '../utils/classes';

export const SPINNER_BASE_CLASS = 'subauth-spinner';

export const SPINNER_SIZE_CLASSES: Record<SpinnerSize, string> = {
  sm: 'subauth-spinner--sm',
  md: 'subauth-spinner--md',
  lg: 'subauth-spinner--lg',
};

/**
 * Generates the class names for a spinner based on configuration
 */
export function getSpinnerClasses(config: SpinnerConfig): string {
  const { size = 'md' } = config;

  return cn(SPINNER_BASE_CLASS, SPINNER_SIZE_CLASSES[size]);
}

/**
 * Creates spinner attributes for vanilla JS usage
 */
export function getSpinnerAttributes(
  config: SpinnerConfig
): Record<string, string | boolean | undefined> {
  return {
    class: getSpinnerClasses(config),
    role: 'status',
    'aria-label': 'Loading',
  };
}

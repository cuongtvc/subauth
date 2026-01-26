import type { AlertConfig, AlertVariant } from '../types';
import { cn } from '../utils/classes';

export const ALERT_BASE_CLASS = 'subauth-alert';

export const ALERT_VARIANT_CLASSES: Record<AlertVariant, string> = {
  info: 'subauth-alert--info',
  success: 'subauth-alert--success',
  warning: 'subauth-alert--warning',
  error: 'subauth-alert--error',
};

/**
 * Generates the class names for an alert based on configuration
 */
export function getAlertClasses(config: AlertConfig): string {
  const { variant = 'info', dismissible = false } = config;

  return cn(ALERT_BASE_CLASS, ALERT_VARIANT_CLASSES[variant], {
    'subauth-alert--dismissible': dismissible,
  });
}

/**
 * Creates alert attributes for vanilla JS usage
 */
export function getAlertAttributes(
  config: AlertConfig
): Record<string, string | boolean | undefined> {
  const { variant = 'info' } = config;

  const roleMap: Record<AlertVariant, string> = {
    info: 'status',
    success: 'status',
    warning: 'alert',
    error: 'alert',
  };

  return {
    class: getAlertClasses(config),
    role: roleMap[variant],
    'aria-live': variant === 'error' || variant === 'warning' ? 'assertive' : 'polite',
  };
}

import type { CardConfig, CardPadding, CardShadow } from '../types';
import { cn } from '../utils/classes';

export const CARD_BASE_CLASS = 'subauth-card';

export const CARD_PADDING_CLASSES: Record<CardPadding, string> = {
  none: 'subauth-card--padding-none',
  sm: 'subauth-card--padding-sm',
  md: 'subauth-card--padding-md',
  lg: 'subauth-card--padding-lg',
};

export const CARD_SHADOW_CLASSES: Record<CardShadow, string> = {
  none: 'subauth-card--shadow-none',
  sm: 'subauth-card--shadow-sm',
  md: 'subauth-card--shadow-md',
  lg: 'subauth-card--shadow-lg',
};

/**
 * Generates the class names for a card based on configuration
 */
export function getCardClasses(config: CardConfig): string {
  const { padding = 'md', shadow = 'md' } = config;

  return cn(
    CARD_BASE_CLASS,
    CARD_PADDING_CLASSES[padding],
    CARD_SHADOW_CLASSES[shadow]
  );
}

/**
 * Creates card attributes for vanilla JS usage
 */
export function getCardAttributes(
  config: CardConfig
): Record<string, string | boolean | undefined> {
  return {
    class: getCardClasses(config),
  };
}

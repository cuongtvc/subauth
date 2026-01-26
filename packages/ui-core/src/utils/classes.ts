type ClassValue =
  | string
  | number
  | boolean
  | undefined
  | null
  | ClassValue[]
  | { [key: string]: boolean | undefined | null };

/**
 * Utility function for conditionally joining class names together.
 * Similar to clsx/classnames but lightweight.
 */
export function cn(...inputs: ClassValue[]): string {
  const classes: string[] = [];

  for (const input of inputs) {
    if (!input) continue;

    if (typeof input === 'string') {
      const trimmed = input.trim();
      if (trimmed) classes.push(trimmed);
    } else if (typeof input === 'number') {
      classes.push(String(input));
    } else if (Array.isArray(input)) {
      const nested = cn(...input);
      if (nested) classes.push(nested);
    } else if (typeof input === 'object') {
      for (const [key, value] of Object.entries(input)) {
        if (value) {
          const trimmed = key.trim();
          if (trimmed) classes.push(trimmed);
        }
      }
    }
  }

  return classes.join(' ');
}

/**
 * Alias for cn - for those who prefer the classNames naming convention
 */
export const classNames = cn;

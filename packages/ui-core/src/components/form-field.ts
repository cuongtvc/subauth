import type { FormFieldConfig } from '../types';
import { cn } from '../utils/classes';

export const FORM_FIELD_BASE_CLASS = 'subauth-form-field';

/**
 * Generates the class names for a form field based on configuration
 */
export function getFormFieldClasses(config: FormFieldConfig): string {
  const { error, required = false } = config;

  return cn(FORM_FIELD_BASE_CLASS, {
    'subauth-form-field--error': !!error,
    'subauth-form-field--required': required,
  });
}

/**
 * Generates class names for the form field label
 */
export function getLabelClasses(config: FormFieldConfig): string {
  const { required = false } = config;

  return cn('subauth-label', {
    'subauth-label--required': required,
  });
}

/**
 * Generates class names for the form field error message
 */
export function getErrorClasses(): string {
  return 'subauth-error';
}

/**
 * Generates class names for the form field help text
 */
export function getHelpTextClasses(): string {
  return 'subauth-help-text';
}

/**
 * Creates a unique ID for form field elements
 */
export function createFieldId(baseName: string): {
  fieldId: string;
  labelId: string;
  errorId: string;
  helpId: string;
} {
  const fieldId = `subauth-field-${baseName}`;
  return {
    fieldId,
    labelId: `${fieldId}-label`,
    errorId: `${fieldId}-error`,
    helpId: `${fieldId}-help`,
  };
}

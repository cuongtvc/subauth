// Button types
export type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
export type ButtonSize = 'sm' | 'md' | 'lg';

export interface ButtonConfig {
  variant?: ButtonVariant;
  size?: ButtonSize;
  disabled?: boolean;
  loading?: boolean;
  fullWidth?: boolean;
  type?: 'button' | 'submit' | 'reset';
}

// Input types
export type InputType = 'text' | 'email' | 'password' | 'number' | 'tel' | 'url';

export interface InputConfig {
  type?: InputType;
  placeholder?: string;
  disabled?: boolean;
  required?: boolean;
  error?: string;
  label?: string;
}

// Alert types
export type AlertVariant = 'info' | 'success' | 'warning' | 'error';

export interface AlertConfig {
  variant?: AlertVariant;
  dismissible?: boolean;
  title?: string;
}

// Spinner types
export type SpinnerSize = 'sm' | 'md' | 'lg';

export interface SpinnerConfig {
  size?: SpinnerSize;
}

// FormField types
export interface FormFieldConfig {
  label: string;
  error?: string;
  required?: boolean;
  helpText?: string;
}

// Card types
export type CardPadding = 'none' | 'sm' | 'md' | 'lg';
export type CardShadow = 'none' | 'sm' | 'md' | 'lg';

export interface CardConfig {
  padding?: CardPadding;
  shadow?: CardShadow;
}

// Validation types
export interface ValidationResult {
  valid: boolean;
  error?: string;
}

export interface PasswordStrength {
  score: number; // 0-4
  feedback: string;
}

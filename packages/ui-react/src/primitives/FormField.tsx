import React, { forwardRef, useId } from 'react';
import { cn } from '@subauth/ui-core';
import { Label } from './Label';
import { Input } from './Input';
import type { InputType } from '@subauth/ui-core';

export interface FormFieldProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label: string;
  type?: InputType;
  error?: string;
  helpText?: string;
}

export const FormField = forwardRef<HTMLInputElement, FormFieldProps>(
  (
    {
      label,
      type = 'text',
      error,
      helpText,
      required = false,
      className,
      id: providedId,
      ...props
    },
    ref
  ) => {
    const generatedId = useId();
    const id = providedId ?? generatedId;
    const errorId = `${id}-error`;
    const helpId = `${id}-help`;

    return (
      <div className={cn('subauth-form-field', { 'subauth-form-field--error': !!error }, className)}>
        <Label htmlFor={id} required={required}>
          {label}
        </Label>
        <Input
          ref={ref}
          id={id}
          type={type}
          error={error}
          required={required}
          aria-describedby={error ? errorId : helpText ? helpId : undefined}
          {...props}
        />
        {error && (
          <span id={errorId} className="subauth-error" role="alert">
            {error}
          </span>
        )}
        {helpText && !error && (
          <span id={helpId} className="subauth-help-text">
            {helpText}
          </span>
        )}
      </div>
    );
  }
);

FormField.displayName = 'FormField';

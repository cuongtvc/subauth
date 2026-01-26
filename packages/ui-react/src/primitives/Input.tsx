import React, { forwardRef } from 'react';
import { getInputClasses, cn, type InputType } from '@subauth/ui-core';

export interface InputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type'> {
  type?: InputType;
  error?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ type = 'text', error, disabled = false, className, ...props }, ref) => {
    const inputClasses = getInputClasses({ type, error, disabled });

    return (
      <input
        ref={ref}
        type={type}
        disabled={disabled}
        className={cn(inputClasses, className)}
        aria-invalid={error ? 'true' : undefined}
        {...props}
      />
    );
  }
);

Input.displayName = 'Input';

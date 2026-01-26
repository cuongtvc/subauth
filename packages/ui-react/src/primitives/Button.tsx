import React, { forwardRef } from 'react';
import { getButtonClasses, cn, type ButtonVariant, type ButtonSize } from '@subauth/ui-core';

export interface ButtonProps extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'type'> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  fullWidth?: boolean;
  type?: 'button' | 'submit' | 'reset';
  children: React.ReactNode;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant = 'primary',
      size = 'md',
      loading = false,
      fullWidth = false,
      disabled = false,
      type = 'button',
      className,
      children,
      ...props
    },
    ref
  ) => {
    const buttonClasses = getButtonClasses({
      variant,
      size,
      loading,
      fullWidth,
      disabled,
    });

    return (
      <button
        ref={ref}
        type={type}
        disabled={disabled || loading}
        className={cn(buttonClasses, className)}
        aria-busy={loading}
        {...props}
      >
        {children}
      </button>
    );
  }
);

Button.displayName = 'Button';

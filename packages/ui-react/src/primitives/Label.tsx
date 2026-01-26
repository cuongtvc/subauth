import React, { forwardRef } from 'react';
import { cn } from '@subauth/ui-core';

export interface LabelProps extends React.LabelHTMLAttributes<HTMLLabelElement> {
  required?: boolean;
  children: React.ReactNode;
}

export const Label = forwardRef<HTMLLabelElement, LabelProps>(
  ({ required = false, className, children, ...props }, ref) => {
    return (
      <label
        ref={ref}
        className={cn('subauth-label', { 'subauth-label--required': required }, className)}
        {...props}
      >
        {children}
      </label>
    );
  }
);

Label.displayName = 'Label';

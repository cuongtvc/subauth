import React, { forwardRef } from 'react';
import { getSpinnerClasses, cn, type SpinnerSize } from '@subauth/ui-core';

export interface SpinnerProps extends React.HTMLAttributes<HTMLDivElement> {
  size?: SpinnerSize;
}

export const Spinner = forwardRef<HTMLDivElement, SpinnerProps>(
  ({ size = 'md', className, ...props }, ref) => {
    const spinnerClasses = getSpinnerClasses({ size });

    return (
      <div
        ref={ref}
        role="status"
        aria-label="Loading"
        className={cn(spinnerClasses, className)}
        {...props}
      >
        <span className="subauth-sr-only">Loading...</span>
      </div>
    );
  }
);

Spinner.displayName = 'Spinner';

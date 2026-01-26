import React, { forwardRef, useState } from 'react';
import { getAlertClasses, cn, type AlertVariant } from '@subauth/ui-core';

export interface AlertProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: AlertVariant;
  title?: string;
  dismissible?: boolean;
  onDismiss?: () => void;
  children: React.ReactNode;
}

export const Alert = forwardRef<HTMLDivElement, AlertProps>(
  (
    {
      variant = 'info',
      title,
      dismissible = false,
      onDismiss,
      className,
      children,
      ...props
    },
    ref
  ) => {
    const [dismissed, setDismissed] = useState(false);

    if (dismissed) {
      return null;
    }

    const alertClasses = getAlertClasses({ variant, dismissible, title });
    const isUrgent = variant === 'error' || variant === 'warning';

    const handleDismiss = () => {
      setDismissed(true);
      onDismiss?.();
    };

    return (
      <div
        ref={ref}
        role={isUrgent ? 'alert' : 'status'}
        aria-live={isUrgent ? 'assertive' : 'polite'}
        className={cn(alertClasses, className)}
        {...props}
      >
        <div>
          {title && <div className="subauth-alert-title">{title}</div>}
          <div className="subauth-alert-description">{children}</div>
        </div>
        {dismissible && (
          <button
            type="button"
            className="subauth-alert-dismiss"
            onClick={handleDismiss}
            aria-label="Dismiss"
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 16 16"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M4 4l8 8M12 4l-8 8" />
            </svg>
          </button>
        )}
      </div>
    );
  }
);

Alert.displayName = 'Alert';

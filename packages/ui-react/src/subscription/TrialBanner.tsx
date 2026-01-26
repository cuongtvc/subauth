import { cn } from '@subauth/ui-core';
import { Alert } from '../primitives/Alert';
import { Button } from '../primitives/Button';

export interface TrialBannerProps {
  daysRemaining: number;
  onUpgrade?: () => void;
  onDismiss?: () => void;
  className?: string;
}

export function TrialBanner({
  daysRemaining,
  onUpgrade,
  onDismiss,
  className,
}: TrialBannerProps) {
  const getMessage = () => {
    if (daysRemaining <= 0) {
      return 'Your trial has ended.';
    }
    if (daysRemaining === 1) {
      return 'Your trial ends tomorrow.';
    }
    return `${daysRemaining} days remaining in your trial.`;
  };

  const variant = daysRemaining <= 3 ? 'warning' : 'info';

  return (
    <Alert
      variant={variant}
      dismissible={!!onDismiss}
      onDismiss={onDismiss}
      className={cn('subauth-trial-banner', className)}
    >
      <div className="subauth-flex subauth-justify-between subauth-items-center subauth-gap-md">
        <span>{getMessage()}</span>
        {onUpgrade && (
          <Button variant="primary" size="sm" onClick={onUpgrade}>
            Upgrade now
          </Button>
        )}
      </div>
    </Alert>
  );
}

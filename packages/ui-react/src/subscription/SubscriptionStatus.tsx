import React from 'react';
import { cn } from '@subauth/ui-core';
import { Card, CardContent } from '../primitives/Card';
import { Button } from '../primitives/Button';
import { Alert } from '../primitives/Alert';

export type SubscriptionStatusType = 'active' | 'trialing' | 'past_due' | 'canceled' | 'paused' | 'none';

export interface SubscriptionStatusProps {
  status: SubscriptionStatusType;
  planName?: string;
  renewsAt?: Date;
  canceledAt?: Date;
  trialEndsAt?: Date;
  onManage?: () => void;
  onUpgrade?: () => void;
  onResume?: () => void;
  className?: string;
}

export function SubscriptionStatus({
  status,
  planName,
  renewsAt,
  canceledAt,
  trialEndsAt,
  onManage,
  onUpgrade,
  onResume,
  className,
}: SubscriptionStatusProps) {
  const getStatusBadge = () => {
    const badges: Record<SubscriptionStatusType, { label: string; variant: string }> = {
      active: { label: 'Active', variant: 'success' },
      trialing: { label: 'Trial', variant: 'info' },
      past_due: { label: 'Past Due', variant: 'warning' },
      canceled: { label: 'Canceled', variant: 'error' },
      paused: { label: 'Paused', variant: 'warning' },
      none: { label: 'No Plan', variant: 'muted' },
    };
    return badges[status];
  };

  const badge = getStatusBadge();

  const formatDate = (date: Date) => {
    return new Intl.DateTimeFormat('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    }).format(date);
  };

  return (
    <Card padding="md" className={cn('subauth-subscription-status', className)}>
      <CardContent>
        <div className="subauth-flex subauth-justify-between subauth-items-center">
          <div>
            <div className="subauth-flex subauth-items-center subauth-gap-sm">
              {planName && (
                <span className="subauth-subscription-plan-name">{planName}</span>
              )}
              <span className={`subauth-status-badge subauth-status-badge--${badge.variant}`}>
                {badge.label}
              </span>
            </div>

            {status === 'active' && renewsAt && (
              <p className="subauth-text-sm subauth-text-muted">
                Renews on {formatDate(renewsAt)}
              </p>
            )}

            {status === 'trialing' && trialEndsAt && (
              <p className="subauth-text-sm subauth-text-muted">
                Trial ends on {formatDate(trialEndsAt)}
              </p>
            )}

            {status === 'canceled' && canceledAt && (
              <p className="subauth-text-sm subauth-text-muted">
                Access until {formatDate(canceledAt)}
              </p>
            )}
          </div>

          <div className="subauth-flex subauth-gap-sm">
            {status === 'canceled' && onResume && (
              <Button variant="primary" size="sm" onClick={onResume}>
                Resume
              </Button>
            )}
            {status === 'none' && onUpgrade && (
              <Button variant="primary" size="sm" onClick={onUpgrade}>
                Upgrade
              </Button>
            )}
            {status !== 'none' && onManage && (
              <Button variant="outline" size="sm" onClick={onManage}>
                Manage
              </Button>
            )}
          </div>
        </div>

        {status === 'past_due' && (
          <Alert variant="warning" className="subauth-subscription-alert">
            Your payment is past due. Please update your payment method to avoid service interruption.
          </Alert>
        )}
      </CardContent>
    </Card>
  );
}

import React from 'react';
import { cn } from '@subauth/ui-core';
import { Card } from '../primitives/Card';
import { Button } from '../primitives/Button';
import { FeatureList } from './FeatureList';

export interface PricingCardProps {
  name: string;
  description?: string;
  price: number;
  interval: 'month' | 'year';
  currency?: string;
  features: string[];
  onSelect: () => void;
  loading?: boolean;
  highlighted?: boolean;
  badge?: string;
  current?: boolean;
  buttonText?: string;
  className?: string;
}

export function PricingCard({
  name,
  description,
  price,
  interval,
  currency = '$',
  features,
  onSelect,
  loading = false,
  highlighted = false,
  badge,
  current = false,
  buttonText,
  className,
}: PricingCardProps) {
  const defaultButtonText = current ? 'Current plan' : 'Get started';

  return (
    <Card
      padding="lg"
      shadow={highlighted ? 'lg' : 'md'}
      className={cn(
        'subauth-pricing-card',
        { 'subauth-pricing-card--highlighted': highlighted },
        className
      )}
    >
      {badge && (
        <div className="subauth-pricing-badge">{badge}</div>
      )}

      <div className="subauth-pricing-header">
        <h3 className="subauth-pricing-name">{name}</h3>
        {description && (
          <p className="subauth-pricing-description">{description}</p>
        )}
      </div>

      <div className="subauth-pricing-price">
        <span className="subauth-pricing-currency">{currency}</span>
        <span className="subauth-pricing-amount">{price}</span>
        <span className="subauth-pricing-interval">/{interval}</span>
      </div>

      <FeatureList features={features} />

      <Button
        onClick={onSelect}
        loading={loading}
        disabled={current}
        variant={highlighted ? 'primary' : 'outline'}
        fullWidth
      >
        {buttonText ?? defaultButtonText}
      </Button>
    </Card>
  );
}

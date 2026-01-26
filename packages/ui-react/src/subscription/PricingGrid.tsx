import React from 'react';
import { cn } from '@subauth/ui-core';
import { PricingCard, type PricingCardProps } from './PricingCard';

export interface PricingPlan extends Omit<PricingCardProps, 'onSelect'> {
  id: string;
}

export interface PricingGridProps {
  plans: PricingPlan[];
  onSelectPlan: (planId: string) => void;
  loadingPlanId?: string;
  currentPlanId?: string;
  className?: string;
}

export function PricingGrid({
  plans,
  onSelectPlan,
  loadingPlanId,
  currentPlanId,
  className,
}: PricingGridProps) {
  return (
    <div className={cn('subauth-pricing-grid', className)}>
      {plans.map((plan) => (
        <PricingCard
          key={plan.id}
          {...plan}
          onSelect={() => onSelectPlan(plan.id)}
          loading={loadingPlanId === plan.id}
          current={currentPlanId === plan.id}
        />
      ))}
    </div>
  );
}

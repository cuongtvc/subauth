import React, { useMemo, useState, useEffect } from 'react';
import { cn } from '@subauth/ui-core';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../primitives/Card';

/**
 * Get the plan parameter from the current URL search params.
 */
function getPlanFromUrl(): string | undefined {
  if (typeof window === 'undefined') return undefined;
  const params = new URLSearchParams(window.location.search);
  return params.get('plan') ?? undefined;
}

export interface AuthLayoutProps {
  title: string;
  /** Static description (takes precedence over auto-detection) */
  description?: string;
  /** Default description when no plan is detected */
  defaultDescription?: string;
  /** Description template for pro trial, use {trialDays} as placeholder */
  proTrialDescription?: string;
  /** Number of trial days to display (if not provided and subscriptionApiUrl is set, fetches from API) */
  trialDays?: number;
  /** Plan override (if not provided, reads from URL ?plan=) */
  plan?: string;
  /** URL to fetch subscription config (including trialDays) from */
  subscriptionApiUrl?: string;
  children: React.ReactNode;
  logo?: React.ReactNode;
  footer?: React.ReactNode;
  className?: string;
}

export function AuthLayout({
  title,
  description,
  defaultDescription,
  proTrialDescription,
  trialDays: trialDaysProp,
  plan: planProp,
  subscriptionApiUrl,
  children,
  logo,
  footer,
  className,
}: AuthLayoutProps) {
  const [fetchedTrialDays, setFetchedTrialDays] = useState<number | undefined>(undefined);

  // Fetch trialDays from API if subscriptionApiUrl is provided and trialDays prop is not
  useEffect(() => {
    if (subscriptionApiUrl && trialDaysProp === undefined) {
      fetch(subscriptionApiUrl)
        .then(res => res.json())
        .then(data => {
          if (data.success && data.data?.trialDays !== undefined) {
            setFetchedTrialDays(data.data.trialDays);
          }
        })
        .catch(() => {
          // Silently fail, will use default description
        });
    }
  }, [subscriptionApiUrl, trialDaysProp]);

  // Use prop if provided, otherwise use fetched value
  const trialDays = trialDaysProp ?? fetchedTrialDays;

  // Determine effective plan (prop takes precedence over URL)
  const effectivePlan = useMemo(() => {
    if (planProp !== undefined) return planProp;
    return getPlanFromUrl();
  }, [planProp]);

  // Compute the effective description
  const effectiveDescription = useMemo(() => {
    // If explicit description is provided, use it
    if (description) return description;

    // If plan is 'pro' and we have a pro trial description template
    if (effectivePlan === 'pro' && proTrialDescription && trialDays !== undefined) {
      return proTrialDescription.replace('{trialDays}', String(trialDays));
    }

    // Fall back to default description
    return defaultDescription;
  }, [description, effectivePlan, proTrialDescription, trialDays, defaultDescription]);
  return (
    <div
      className={cn('subauth-auth-layout', className)}
      style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 'var(--subauth-spacing-md)',
        backgroundColor: 'var(--subauth-muted)',
      }}
    >
      <div style={{ width: '100%', maxWidth: '400px' }}>
        {logo && (
          <div
            className="subauth-flex subauth-justify-center"
            style={{ marginBottom: 'var(--subauth-spacing-lg)' }}
          >
            {logo}
          </div>
        )}

        <Card padding="lg" shadow="lg">
          <CardHeader>
            <CardTitle>{title}</CardTitle>
            {effectiveDescription && <CardDescription>{effectiveDescription}</CardDescription>}
          </CardHeader>
          <CardContent>{children}</CardContent>
        </Card>

        {footer && (
          <div
            className="subauth-text-center subauth-text-sm subauth-text-muted"
            style={{ marginTop: 'var(--subauth-spacing-md)' }}
          >
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}

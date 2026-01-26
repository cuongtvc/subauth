import React from 'react';
import { cn } from '@subauth/ui-core';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../primitives/Card';

export interface AuthLayoutProps {
  title: string;
  description?: string;
  children: React.ReactNode;
  logo?: React.ReactNode;
  footer?: React.ReactNode;
  className?: string;
}

export function AuthLayout({
  title,
  description,
  children,
  logo,
  footer,
  className,
}: AuthLayoutProps) {
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
            {description && <CardDescription>{description}</CardDescription>}
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

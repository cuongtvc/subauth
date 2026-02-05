import { useState, useEffect } from 'react';
import { cn } from '@subauth/ui-core';
import type { AuthClient } from '@subauth/client';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '../primitives/Card';
import { Button } from '../primitives/Button';
import { Alert } from '../primitives/Alert';
import { Spinner } from '../primitives/Spinner';

export interface VerifyEmailCardProps {
  status?: 'verifying' | 'success' | 'error' | 'expired';
  authClient?: AuthClient;
  token?: string;
  onResend?: () => void;
  onContinue?: () => void;
  resendLoading?: boolean;
  email?: string;
  error?: string;
  className?: string;
}

const defaultOnContinue = () => {
  window.location.pathname = '/login';
};

const defaultOnResend = () => {
  window.location.pathname = '/resend-verification';
};

export function VerifyEmailCard({
  status: statusProp,
  authClient,
  token,
  onResend: onResendProp,
  onContinue: onContinueProp,
  resendLoading = false,
  email,
  error: errorProp,
  className,
}: VerifyEmailCardProps) {
  const [internalStatus, setInternalStatus] = useState<'verifying' | 'success' | 'error' | 'expired'>('verifying');
  const [internalError, setInternalError] = useState<string | null>(null);

  const status = statusProp ?? internalStatus;
  const error = errorProp ?? internalError;
  const onContinue = onContinueProp ?? (authClient ? defaultOnContinue : undefined);
  const onResend = onResendProp ?? (authClient ? defaultOnResend : undefined);

  useEffect(() => {
    if (authClient && token && !statusProp) {
      const verify = async () => {
        try {
          await authClient.verifyEmail(token);
          setInternalStatus('success');
        } catch (err) {
          setInternalStatus('error');
          setInternalError(err instanceof Error ? err.message : 'Verification failed');
        }
      };
      verify();
    }
  }, [authClient, token, statusProp]);
  return (
    <Card padding="lg" shadow="md" className={cn('subauth-verify-email-card', className)}>
      <CardHeader>
        <CardTitle>
          {status === 'verifying' && 'Verifying your email...'}
          {status === 'success' && 'Email verified!'}
          {status === 'error' && 'Verification failed'}
          {status === 'expired' && 'Link expired'}
        </CardTitle>
        {email && status !== 'success' && (
          <CardDescription>
            {status === 'verifying' && `Verifying ${email}`}
            {status === 'error' && `Unable to verify ${email}`}
            {status === 'expired' && `The verification link for ${email} has expired`}
          </CardDescription>
        )}
      </CardHeader>

      <CardContent>
        {status === 'verifying' && (
          <div className="subauth-flex subauth-justify-center" style={{ padding: 'var(--subauth-spacing-md)' }}>
            <Spinner size="lg" />
          </div>
        )}

        {status === 'success' && (
          <Alert variant="success">
            Your email has been verified successfully. You can now access all features.
          </Alert>
        )}

        {status === 'error' && error && (
          <Alert variant="error">{error}</Alert>
        )}

        {status === 'expired' && (
          <Alert variant="warning">
            Your verification link has expired. Please request a new one.
          </Alert>
        )}
      </CardContent>

      <CardFooter>
        {status === 'success' && onContinue && (
          <Button onClick={onContinue} fullWidth>
            Continue
          </Button>
        )}

        {(status === 'error' || status === 'expired') && onResend && (
          <Button onClick={onResend} loading={resendLoading} fullWidth>
            Resend verification email
          </Button>
        )}
      </CardFooter>
    </Card>
  );
}

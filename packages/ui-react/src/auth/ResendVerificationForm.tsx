import React, { useState } from 'react';
import {
  validateEmail,
  cn,
  RESEND_VERIFICATION_MESSAGES,
} from '@subauth/ui-core';
import type { AuthClient } from '@subauth/client';
import { FormField } from '../primitives/FormField';
import { Button } from '../primitives/Button';
import { Alert } from '../primitives/Alert';
import { useAuthClientLoading } from '../hooks/useAuthClientLoading';

export interface ResendVerificationFormProps {
  onSubmit?: (data: { email: string }) => void | Promise<void>;
  authClient?: AuthClient;
  onSuccess?: () => void | Promise<void>;
  loading?: boolean;
  error?: string;
  success?: boolean;
  onBackToLogin?: () => void;
  className?: string;
}

const defaultOnBackToLogin = () => {
  window.location.pathname = '/login';
};

export function ResendVerificationForm({
  onSubmit: onSubmitProp,
  authClient,
  onSuccess,
  loading: loadingProp,
  error,
  success: successProp,
  onBackToLogin = defaultOnBackToLogin,
  className,
}: ResendVerificationFormProps) {
  const [email, setEmail] = useState('');
  const [errors, setErrors] = useState<{ email?: string }>({});
  const [internalSuccess, setInternalSuccess] = useState(false);

  const authClientLoading = useAuthClientLoading(authClient);
  const loading = loadingProp ?? authClientLoading;
  const success = successProp ?? internalSuccess;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const emailResult = validateEmail(email);
    if (!emailResult.valid) {
      setErrors({ email: emailResult.error });
      return;
    }

    setErrors({});
    if (onSubmitProp) {
      await onSubmitProp({ email });
    } else if (authClient) {
      try {
        await authClient.resendVerificationEmail(email);
      } catch {
        // Ignore errors - always show success to prevent email enumeration
      } finally {
        setInternalSuccess(true);
        if (onSuccess) {
          await onSuccess();
        }
      }
    }
  };

  if (success) {
    return (
      <div className={cn('subauth-resend-verification-form', className)}>
        <Alert variant="success">
          {RESEND_VERIFICATION_MESSAGES.successMessage}
        </Alert>
        {onBackToLogin && (
          <p className="subauth-text-center subauth-text-sm" style={{ marginTop: 'var(--subauth-spacing-md)' }}>
            <button type="button" onClick={onBackToLogin} className="subauth-link">
              {RESEND_VERIFICATION_MESSAGES.backToLoginLink}
            </button>
          </p>
        )}
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className={cn('subauth-resend-verification-form', className)} noValidate>
      {error && (
        <Alert variant="error" className="subauth-form-field">
          {error}
        </Alert>
      )}

      <p className="subauth-text-sm subauth-text-muted subauth-form-field">
        {RESEND_VERIFICATION_MESSAGES.description}
      </p>

      <FormField
        label="Email"
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        error={errors.email}
        required
        autoComplete="email"
      />

      <Button type="submit" loading={loading} fullWidth>
        {RESEND_VERIFICATION_MESSAGES.submitButton}
      </Button>

      {onBackToLogin && (
        <p className="subauth-text-center subauth-text-sm subauth-text-muted" style={{ marginTop: 'var(--subauth-spacing-md)' }}>
          {RESEND_VERIFICATION_MESSAGES.backToLoginText}{' '}
          <button type="button" onClick={onBackToLogin} className="subauth-link">
            {RESEND_VERIFICATION_MESSAGES.backToLoginLink}
          </button>
        </p>
      )}
    </form>
  );
}
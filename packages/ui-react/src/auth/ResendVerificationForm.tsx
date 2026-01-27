import React, { useState } from 'react';
import {
  validateEmail,
  cn,
  RESEND_VERIFICATION_MESSAGES,
} from '@subauth/ui-core';
import { FormField } from '../primitives/FormField';
import { Button } from '../primitives/Button';
import { Alert } from '../primitives/Alert';

export interface ResendVerificationFormProps {
  onSubmit: (data: { email: string }) => void | Promise<void>;
  loading?: boolean;
  error?: string;
  success?: boolean;
  onBackToLogin?: () => void;
  className?: string;
}

export function ResendVerificationForm({
  onSubmit,
  loading = false,
  error,
  success = false,
  onBackToLogin,
  className,
}: ResendVerificationFormProps) {
  const [email, setEmail] = useState('');
  const [errors, setErrors] = useState<{ email?: string }>({});

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const emailResult = validateEmail(email);
    if (!emailResult.valid) {
      setErrors({ email: emailResult.error });
      return;
    }

    setErrors({});
    await onSubmit({ email });
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
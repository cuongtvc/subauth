import React, { useState } from 'react';
import { validateEmail, cn } from '@subauth/ui-core';
import { FormField } from '../primitives/FormField';
import { Button } from '../primitives/Button';
import { Alert } from '../primitives/Alert';

export interface ForgotPasswordFormProps {
  onSubmit: (data: { email: string }) => void | Promise<void>;
  loading?: boolean;
  error?: string;
  success?: boolean;
  onBackToLogin?: () => void;
  className?: string;
}

export function ForgotPasswordForm({
  onSubmit,
  loading = false,
  error,
  success = false,
  onBackToLogin,
  className,
}: ForgotPasswordFormProps) {
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
      <div className={cn('subauth-forgot-password-form', className)}>
        <Alert variant="success">
          If an account exists with that email, we've sent password reset instructions.
        </Alert>
        {onBackToLogin && (
          <p className="subauth-text-center subauth-text-sm" style={{ marginTop: 'var(--subauth-spacing-md)' }}>
            <button type="button" onClick={onBackToLogin} className="subauth-link">
              Back to sign in
            </button>
          </p>
        )}
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className={cn('subauth-forgot-password-form', className)} noValidate>
      {error && (
        <Alert variant="error" className="subauth-form-field">
          {error}
        </Alert>
      )}

      <p className="subauth-text-sm subauth-text-muted subauth-form-field">
        Enter your email address and we'll send you a link to reset your password.
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
        Send reset link
      </Button>

      {onBackToLogin && (
        <p className="subauth-text-center subauth-text-sm subauth-text-muted" style={{ marginTop: 'var(--subauth-spacing-md)' }}>
          <button type="button" onClick={onBackToLogin} className="subauth-link">
            Back to sign in
          </button>
        </p>
      )}
    </form>
  );
}

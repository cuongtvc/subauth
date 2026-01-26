import React, { useState } from 'react';
import { validatePassword, validateMatch, cn } from '@subauth/ui-core';
import { FormField } from '../primitives/FormField';
import { Button } from '../primitives/Button';
import { Alert } from '../primitives/Alert';

export interface ResetPasswordFormProps {
  onSubmit: (data: { password: string }) => void | Promise<void>;
  loading?: boolean;
  error?: string;
  success?: boolean;
  onBackToLogin?: () => void;
  className?: string;
}

export function ResetPasswordForm({
  onSubmit,
  loading = false,
  error,
  success = false,
  onBackToLogin,
  className,
}: ResetPasswordFormProps) {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [errors, setErrors] = useState<{ password?: string; confirmPassword?: string }>({});

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const newErrors: typeof errors = {};

    const passwordResult = validatePassword(password);
    if (!passwordResult.valid) {
      newErrors.password = passwordResult.error;
    }

    const matchResult = validateMatch(password, confirmPassword, 'Passwords');
    if (!matchResult.valid) {
      newErrors.confirmPassword = matchResult.error;
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    setErrors({});
    await onSubmit({ password });
  };

  if (success) {
    return (
      <div className={cn('subauth-reset-password-form', className)}>
        <Alert variant="success">
          Your password has been reset successfully.
        </Alert>
        {onBackToLogin && (
          <p className="subauth-text-center subauth-text-sm" style={{ marginTop: 'var(--subauth-spacing-md)' }}>
            <button type="button" onClick={onBackToLogin} className="subauth-link">
              Sign in with your new password
            </button>
          </p>
        )}
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className={cn('subauth-reset-password-form', className)} noValidate>
      {error && (
        <Alert variant="error" className="subauth-form-field">
          {error}
        </Alert>
      )}

      <FormField
        label="New Password"
        type="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        error={errors.password}
        required
        autoComplete="new-password"
        helpText="At least 8 characters with uppercase, lowercase, and number"
      />

      <FormField
        label="Confirm New Password"
        type="password"
        value={confirmPassword}
        onChange={(e) => setConfirmPassword(e.target.value)}
        error={errors.confirmPassword}
        required
        autoComplete="new-password"
      />

      <Button type="submit" loading={loading} fullWidth>
        Reset password
      </Button>
    </form>
  );
}

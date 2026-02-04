import React, { useState } from 'react';
import { validateEmail, validateRequired, cn } from '@subauth/ui-core';
import type { AuthClient, User, AuthTokens } from '@subauth/client';
import { FormField } from '../primitives/FormField';
import { Button } from '../primitives/Button';
import { Alert } from '../primitives/Alert';
import { useAuthClientLoading } from '../hooks/useAuthClientLoading';

export interface LoginFormProps {
  onSubmit?: (data: { email: string; password: string }) => void | Promise<void>;
  authClient?: AuthClient;
  onSuccess?: (result: { user: User; tokens: AuthTokens }) => void | Promise<void>;
  loading?: boolean;
  error?: string;
  onForgotPassword?: () => void;
  onSignUp?: () => void;
  onResendVerification?: () => void;
  className?: string;
}

export function LoginForm({
  onSubmit: onSubmitProp,
  authClient,
  onSuccess,
  loading: loadingProp,
  error,
  onForgotPassword,
  onSignUp,
  onResendVerification,
  className,
}: LoginFormProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});
  const [apiError, setApiError] = useState<string | null>(null);

  const authClientLoading = useAuthClientLoading(authClient);
  const loading = loadingProp ?? authClientLoading;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const newErrors: { email?: string; password?: string } = {};

    const emailResult = validateEmail(email);
    if (!emailResult.valid) {
      newErrors.email = emailResult.error;
    }

    const passwordResult = validateRequired(password, 'Password');
    if (!passwordResult.valid) {
      newErrors.password = passwordResult.error;
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    setErrors({});
    if (onSubmitProp) {
      await onSubmitProp({ email, password });
    } else if (authClient) {
      try {
        const result = await authClient.login({ email, password });
        if (onSuccess) {
          await onSuccess(result);
        }
      } catch (err) {
        setApiError(err instanceof Error ? err.message : 'Login failed');
      }
    }
  };

  return (
    <form onSubmit={handleSubmit} className={cn('subauth-login-form', className)} noValidate>
      {(error || apiError) && (
        <Alert variant="error" className="subauth-form-field">
          {error || apiError}
        </Alert>
      )}

      <FormField
        label="Email"
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        error={errors.email}
        required
        autoComplete="email"
      />

      <FormField
        label="Password"
        type="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        error={errors.password}
        required
        autoComplete="current-password"
      />

      {onForgotPassword && (
        <div className="subauth-text-sm subauth-form-field">
          <button
            type="button"
            onClick={onForgotPassword}
            className="subauth-link"
          >
            Forgot password?
          </button>
        </div>
      )}

      <Button type="submit" loading={loading} fullWidth>
        Sign in
      </Button>

      {onSignUp && (
        <p className="subauth-text-center subauth-text-sm subauth-text-muted" style={{ marginTop: 'var(--subauth-spacing-md)' }}>
          Don't have an account?{' '}
          <button type="button" onClick={onSignUp} className="subauth-link">
            Sign up
          </button>
        </p>
      )}

      {onResendVerification && (
        <p className="subauth-text-center subauth-text-sm subauth-text-muted" style={{ marginTop: 'var(--subauth-spacing-md)' }}>
          Didn't receive verification email?{' '}
          <button type="button" onClick={onResendVerification} className="subauth-link">
            Resend verification
          </button>
        </p>
      )}
    </form>
  );
}

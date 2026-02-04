import React, { useState } from 'react';
import { validateEmail, validatePassword, validateMatch, cn } from '@subauth/ui-core';
import type { AuthClient } from '@subauth/client';
import { FormField } from '../primitives/FormField';
import { Button } from '../primitives/Button';
import { Alert } from '../primitives/Alert';
import { useAuthClientLoading } from '../hooks/useAuthClientLoading';

export interface RegisterFormProps {
  onSubmit?: (data: { email: string; password: string; name?: string }) => void | Promise<void>;
  authClient?: AuthClient;
  loading?: boolean;
  error?: string;
  onSignIn?: () => void;
  showNameField?: boolean;
  className?: string;
}

export function RegisterForm({
  onSubmit: onSubmitProp,
  authClient,
  loading: loadingProp,
  error,
  onSignIn,
  showNameField = false,
  className,
}: RegisterFormProps) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [errors, setErrors] = useState<{
    name?: string;
    email?: string;
    password?: string;
    confirmPassword?: string;
  }>({});

  const authClientLoading = useAuthClientLoading(authClient);
  const loading = loadingProp ?? authClientLoading;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const newErrors: typeof errors = {};

    const emailResult = validateEmail(email);
    if (!emailResult.valid) {
      newErrors.email = emailResult.error;
    }

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
    if (onSubmitProp) {
      await onSubmitProp({ email, password, name: showNameField ? name : undefined });
    } else if (authClient) {
      await authClient.register({ email, password });
    }
  };

  return (
    <form onSubmit={handleSubmit} className={cn('subauth-register-form', className)} noValidate>
      {error && (
        <Alert variant="error" className="subauth-form-field">
          {error}
        </Alert>
      )}

      {showNameField && (
        <FormField
          label="Name"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          error={errors.name}
          autoComplete="name"
        />
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
        autoComplete="new-password"
        helpText="At least 8 characters with uppercase, lowercase, and number"
      />

      <FormField
        label="Confirm Password"
        type="password"
        value={confirmPassword}
        onChange={(e) => setConfirmPassword(e.target.value)}
        error={errors.confirmPassword}
        required
        autoComplete="new-password"
      />

      <Button type="submit" loading={loading} fullWidth>
        Create account
      </Button>

      {onSignIn && (
        <p className="subauth-text-center subauth-text-sm subauth-text-muted" style={{ marginTop: 'var(--subauth-spacing-md)' }}>
          Already have an account?{' '}
          <button type="button" onClick={onSignIn} className="subauth-link">
            Sign in
          </button>
        </p>
      )}
    </form>
  );
}

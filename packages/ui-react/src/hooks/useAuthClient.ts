import { useState, useEffect, useCallback, useMemo } from 'react';
import { AuthClient, type AuthClientConfig, type AuthState } from '@subauth/client';

export interface UseAuthClientOptions extends AuthClientConfig {
  storage?: Storage;
}

export interface UseAuthClientReturn {
  client: AuthClient;
  state: AuthState;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string) => Promise<void>;
  logout: () => void;
  verifyEmail: (token: string) => Promise<void>;
  resendVerificationEmail: (email: string) => Promise<void>;
  requestPasswordReset: (email: string) => Promise<void>;
  resetPassword: (token: string, newPassword: string) => Promise<void>;
  refreshUser: () => Promise<void>;
  error: Error | null;
  clearError: () => void;
}

export function useAuthClient(options: UseAuthClientOptions): UseAuthClientReturn {
  const { storage = typeof localStorage !== 'undefined' ? localStorage : undefined, ...config } =
    options;

  const client = useMemo(() => {
    if (!storage) {
      throw new Error('Storage is required for AuthClient');
    }
    return new AuthClient(config, storage);
  }, [config.baseUrl]);

  const [state, setState] = useState<AuthState>(() => client.getState());
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const unsubscribe = client.subscribe((newState) => {
      setState(newState);
    });

    return unsubscribe;
  }, [client]);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  const login = useCallback(
    async (email: string, password: string) => {
      try {
        setError(null);
        await client.login({ email, password });
      } catch (err) {
        const error = err instanceof Error ? err : new Error('Login failed');
        setError(error);
        throw error;
      }
    },
    [client]
  );

  const register = useCallback(
    async (email: string, password: string) => {
      try {
        setError(null);
        await client.register({ email, password });
      } catch (err) {
        const error = err instanceof Error ? err : new Error('Registration failed');
        setError(error);
        throw error;
      }
    },
    [client]
  );

  const logout = useCallback(() => {
    client.logout();
    setError(null);
  }, [client]);

  const verifyEmail = useCallback(
    async (token: string) => {
      try {
        setError(null);
        await client.verifyEmail(token);
      } catch (err) {
        const error = err instanceof Error ? err : new Error('Verification failed');
        setError(error);
        throw error;
      }
    },
    [client]
  );

  const resendVerificationEmail = useCallback(
    async (email: string) => {
      try {
        setError(null);
        await client.resendVerificationEmail(email);
      } catch (err) {
        const error = err instanceof Error ? err : new Error('Failed to resend verification');
        setError(error);
        throw error;
      }
    },
    [client]
  );

  const requestPasswordReset = useCallback(
    async (email: string) => {
      try {
        setError(null);
        await client.requestPasswordReset(email);
      } catch (err) {
        const error = err instanceof Error ? err : new Error('Failed to request password reset');
        setError(error);
        throw error;
      }
    },
    [client]
  );

  const resetPassword = useCallback(
    async (token: string, newPassword: string) => {
      try {
        setError(null);
        await client.resetPassword(token, newPassword);
      } catch (err) {
        const error = err instanceof Error ? err : new Error('Failed to reset password');
        setError(error);
        throw error;
      }
    },
    [client]
  );

  const refreshUser = useCallback(async () => {
    try {
      setError(null);
      await client.getCurrentUser();
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Failed to refresh user');
      setError(error);
      throw error;
    }
  }, [client]);

  return {
    client,
    state,
    login,
    register,
    logout,
    verifyEmail,
    resendVerificationEmail,
    requestPasswordReset,
    resetPassword,
    refreshUser,
    error,
    clearError,
  };
}

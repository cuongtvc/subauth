import { createContext, useContext, type ReactNode } from 'react';
import { useAuthClient, type UseAuthClientOptions, type UseAuthClientReturn } from './useAuthClient';

const AuthContext = createContext<UseAuthClientReturn | null>(null);

export function useAuth(): UseAuthClientReturn {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

export interface AuthProviderProps extends UseAuthClientOptions {
  children: ReactNode;
}

export function AuthProvider({ children, ...options }: AuthProviderProps) {
  const auth = useAuthClient(options);

  return <AuthContext.Provider value={auth}>{children}</AuthContext.Provider>;
}
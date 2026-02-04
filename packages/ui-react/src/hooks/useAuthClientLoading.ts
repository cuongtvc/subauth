import { useState, useEffect } from 'react';
import type { AuthClient } from '@subauth/client';

export function useAuthClientLoading(authClient?: AuthClient): boolean {
  const [isLoading, setIsLoading] = useState(
    authClient?.getState().isLoading ?? false
  );

  useEffect(() => {
    if (!authClient) return;
    return authClient.subscribe((state) => {
      setIsLoading(state.isLoading);
    });
  }, [authClient]);

  return isLoading;
}
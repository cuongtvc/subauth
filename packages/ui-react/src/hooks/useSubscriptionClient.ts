import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  SubscriptionClient,
  type SubscriptionClientConfig,
  type SubscriptionState,
  type TrialInfo,
} from '@subauth/client';

export interface UseSubscriptionClientOptions extends SubscriptionClientConfig {
  storage?: Storage;
}

export interface UseSubscriptionClientReturn {
  state: SubscriptionState;
  trialInfo: TrialInfo | null;
  refresh: () => Promise<void>;
  hasPlan: (planId: string) => boolean;
  isSubscribed: boolean;
  isPastDue: boolean;
  isTrialing: boolean;
  error: Error | null;
  clearError: () => void;
}

export function useSubscriptionClient(
  options: UseSubscriptionClientOptions
): UseSubscriptionClientReturn {
  const {
    storage = typeof localStorage !== 'undefined' ? localStorage : undefined,
    ...config
  } = options;

  const client = useMemo(() => {
    if (!storage) {
      throw new Error('Storage is required for SubscriptionClient');
    }
    return new SubscriptionClient(config, storage);
  }, [config.baseUrl]);

  const [state, setState] = useState<SubscriptionState>(() => client.getState());
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

  const refresh = useCallback(async () => {
    try {
      setError(null);
      await client.getSubscription();
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Failed to refresh subscription');
      setError(error);
      throw error;
    }
  }, [client]);

  const trialInfo = useMemo(() => {
    return client.getTrialInfo();
  }, [client, state.subscription]);

  const hasPlan = useCallback(
    (planId: string) => {
      return client.hasPlan(planId);
    },
    [client, state.subscription]
  );

  const isSubscribed = useMemo(() => {
    return client.isSubscriptionValid();
  }, [client, state.subscription]);

  const isPastDue = useMemo(() => {
    return state.subscription?.status === 'past_due';
  }, [state.subscription]);

  const isTrialing = useMemo(() => {
    return state.subscription?.status === 'trialing';
  }, [state.subscription]);

  return {
    state,
    trialInfo,
    refresh,
    hasPlan,
    isSubscribed,
    isPastDue,
    isTrialing,
    error,
    clearError,
  };
}

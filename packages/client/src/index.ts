export { AuthClient } from './auth-client';
export { SubscriptionClient } from './subscription-client';

export type {
  AuthClientConfig,
  AuthState,
  AuthStateListener,
  SubscriptionClientConfig,
  SubscriptionState,
  SubscriptionStateListener,
  TrialInfo,
} from './types';

// Re-export core types for convenience
export * from '@authpaddle/core';

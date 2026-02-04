export { AuthClient } from './auth-client';
export { SubscriptionClient } from './subscription-client';

export type {
  AuthClientConfig,
  AuthState,
  AuthStateListener,
  RegisterResult,
  SubscriptionClientConfig,
  SubscriptionState,
  SubscriptionStateListener,
  TrialInfo,
} from './types';

// Re-export core types for convenience
export * from '@subauth/core';

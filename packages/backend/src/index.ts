export { AuthService } from './auth-service';
export type { AuthServiceConfig, TokenValidationResult } from './auth-service';

export { SubscriptionService } from './subscription-service';
export type { SubscriptionServiceConfig, TrialInfo } from './subscription-service';

// Re-export core types for convenience
export * from '@authpaddle/core';

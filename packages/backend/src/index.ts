export { AuthService } from './auth-service';
export type { AuthServiceConfig, TokenValidationResult } from './auth-service';

export { SubscriptionService } from './subscription-service';
export type { SubscriptionServiceConfig, TrialInfo } from './subscription-service';

// Framework-agnostic handlers
export {
  createAuthHandlers,
  createSubscriptionHandlers,
  createAdminHandlers,
  type AuthHandlersConfig,
  type SubscriptionHandlersConfig,
  type AdminHandlersConfig,
  type AuthRequest,
  type AuthResponse,
  type Handler,
} from './handlers';

// Re-export core types for convenience
export * from '@subauth/core';

import type { AuthRequest, AuthResponse } from './types';
import { SubscriptionService, type SubscriptionServiceConfig } from '../subscription-service';
import { AuthService } from '../auth-service';
import { SubscriptionError, type AuthConfig, type Subscription } from '@subauth/core';

export interface SubscriptionHandlersConfig extends SubscriptionServiceConfig {
  authConfig: AuthConfig;
  /**
   * Function to derive tier from subscription planId.
   * Default: extracts tier prefix from planId (e.g., PRO_MONTHLY -> PRO)
   */
  planToTier?: (planId: string) => string;
}

/**
 * Default function to derive tier from planId.
 * Extracts the tier prefix (e.g., PRO_MONTHLY -> PRO, TEAM_YEARLY -> TEAM)
 */
function defaultPlanToTier(planId: string): string {
  const upperPlanId = planId.toUpperCase();
  if (upperPlanId.startsWith('TEAM')) return 'TEAM';
  if (upperPlanId.startsWith('PRO')) return 'PRO';
  return 'FREE';
}

/**
 * Check if a subscription is valid (active or in valid trial).
 */
function isSubscriptionValid(subscription: Subscription | null): boolean {
  if (!subscription) return false;

  if (subscription.status === 'active') return true;

  if (subscription.status === 'trialing') {
    if (!subscription.trialEndDate) return true; // No end date means valid
    return subscription.trialEndDate > new Date();
  }

  return false;
}

/**
 * Derive tier from subscription.
 */
function deriveTierFromSubscription(
  subscription: Subscription | null,
  planToTier: (planId: string) => string
): string {
  if (!subscription || !isSubscriptionValid(subscription)) {
    return 'FREE';
  }
  return planToTier(subscription.planId);
}

export function createSubscriptionHandlers(config: SubscriptionHandlersConfig) {
  const subscriptionService = new SubscriptionService(config);

  // Create a minimal auth service just for token validation
  const authService = new AuthService({
    auth: config.authConfig,
    database: config.database,
    email: {
      async sendVerificationEmail() {},
      async sendPasswordResetEmail() {},
    },
  });

  // Helper to extract token from Authorization header
  function extractToken(headers: Record<string, string | undefined>): string | null {
    const auth = headers.authorization || headers.Authorization;
    if (!auth || !auth.startsWith('Bearer ')) {
      return null;
    }
    return auth.slice(7);
  }

  // Helper to get user from token
  async function getUserFromToken(headers: Record<string, string | undefined>) {
    const token = extractToken(headers);
    if (!token) return null;
    return authService.getUserFromToken(token);
  }

  return {
    async getPlans(_request: AuthRequest): Promise<AuthResponse> {
      const plans = subscriptionService.getPlans();
      return {
        status: 200,
        body: { plans },
      };
    },

    async createCheckout(request: AuthRequest): Promise<AuthResponse> {
      try {
        const user = await getUserFromToken(request.headers);
        if (!user) {
          return {
            status: 401,
            body: { error: 'UNAUTHORIZED', message: 'Authentication required' },
          };
        }

        const { priceId } = request.body as { priceId?: string };
        if (!priceId) {
          return {
            status: 400,
            body: { error: 'VALIDATION_ERROR', message: 'Price ID is required' },
          };
        }

        const result = await subscriptionService.createCheckout({
          userId: user.id,
          email: user.email,
          priceId,
          successUrl: `${config.authConfig.baseUrl}/subscription/success`,
          cancelUrl: `${config.authConfig.baseUrl}/subscription/cancel`,
        });

        return {
          status: 200,
          body: { url: result.url, sessionId: result.sessionId },
        };
      } catch (error) {
        if (error instanceof SubscriptionError) {
          return {
            status: error.statusCode,
            body: { error: error.code, message: error.message },
          };
        }
        return {
          status: 500,
          body: { error: 'INTERNAL_ERROR', message: 'An unexpected error occurred' },
        };
      }
    },

    async getSubscription(request: AuthRequest): Promise<AuthResponse> {
      try {
        const user = await getUserFromToken(request.headers);
        if (!user) {
          return {
            status: 401,
            body: { error: 'UNAUTHORIZED', message: 'Authentication required' },
          };
        }

        const subscription = await subscriptionService.getSubscription(user.id);
        const planToTier = config.planToTier ?? defaultPlanToTier;
        const tier = deriveTierFromSubscription(subscription, planToTier);

        // Get full user from database to check for provider customer ID
        const fullUser = await config.database.getUserById(user.id);
        const hasProviderCustomerId = !!fullUser?.providerCustomerId;

        return {
          status: 200,
          body: { subscription, tier, hasProviderCustomerId },
        };
      } catch (error) {
        return {
          status: 500,
          body: { error: 'INTERNAL_ERROR', message: 'An unexpected error occurred' },
        };
      }
    },

    async cancelSubscription(request: AuthRequest): Promise<AuthResponse> {
      try {
        const user = await getUserFromToken(request.headers);
        if (!user) {
          return {
            status: 401,
            body: { error: 'UNAUTHORIZED', message: 'Authentication required' },
          };
        }

        await subscriptionService.cancelSubscription(user.id);
        const subscription = await subscriptionService.getSubscription(user.id);

        return {
          status: 200,
          body: { subscription },
        };
      } catch (error) {
        if (error instanceof SubscriptionError) {
          return {
            status: error.statusCode,
            body: { error: error.code, message: error.message },
          };
        }
        return {
          status: 500,
          body: { error: 'INTERNAL_ERROR', message: 'An unexpected error occurred' },
        };
      }
    },

    async resumeSubscription(request: AuthRequest): Promise<AuthResponse> {
      try {
        const user = await getUserFromToken(request.headers);
        if (!user) {
          return {
            status: 401,
            body: { error: 'UNAUTHORIZED', message: 'Authentication required' },
          };
        }

        await subscriptionService.resumeSubscription(user.id);
        const subscription = await subscriptionService.getSubscription(user.id);

        return {
          status: 200,
          body: { subscription },
        };
      } catch (error) {
        if (error instanceof SubscriptionError) {
          return {
            status: error.statusCode,
            body: { error: error.code, message: error.message },
          };
        }
        return {
          status: 500,
          body: { error: 'INTERNAL_ERROR', message: 'An unexpected error occurred' },
        };
      }
    },

    async webhook(request: AuthRequest, rawPayload: string | Buffer): Promise<AuthResponse> {
      try {
        const signature =
          request.headers['x-webhook-signature'] ||
          request.headers['stripe-signature'] ||
          request.headers['paddle-signature'] ||
          '';

        if (!subscriptionService.verifyWebhook(rawPayload, signature)) {
          return {
            status: 401,
            body: { error: 'INVALID_SIGNATURE', message: 'Invalid webhook signature' },
          };
        }

        await subscriptionService.handleWebhook(rawPayload, signature);

        return {
          status: 200,
          body: { received: true },
        };
      } catch (error) {
        if (error instanceof SubscriptionError) {
          return {
            status: error.statusCode,
            body: { error: error.code, message: error.message },
          };
        }
        return {
          status: 500,
          body: { error: 'INTERNAL_ERROR', message: 'An unexpected error occurred' },
        };
      }
    },
  };
}

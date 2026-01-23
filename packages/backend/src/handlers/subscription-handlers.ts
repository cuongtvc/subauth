import type { AuthRequest, AuthResponse } from './types';
import { SubscriptionService, type SubscriptionServiceConfig } from '../subscription-service';
import { AuthService } from '../auth-service';
import { SubscriptionError, type AuthConfig, type DatabaseAdapter, type EmailAdapter } from '@subauth/core';

export interface SubscriptionHandlersConfig extends SubscriptionServiceConfig {
  authConfig: AuthConfig;
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

        return {
          status: 200,
          body: { subscription },
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

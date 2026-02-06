import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import type { AuthTokenPayload, DatabaseAdapter, Subscription } from '@subauth/core';

declare global {
  namespace Express {
    interface Request {
      user?: AuthTokenPayload;
      subscription?: Subscription | null;
    }
  }
}

export interface AuthMiddlewareConfig {
  jwtSecret: string;
  /** Database adapter for querying subscriptions. Required for requireValidSubscription and DB-based requireTier. */
  database?: DatabaseAdapter;
  /** Map plan IDs to tier names. Default: derives tier from planId (PRO_MONTHLY -> PRO) */
  planToTier?: (planId: string) => string;
}

/**
 * Default function to derive tier from planId.
 * Extracts the tier name from plan IDs like "PRO_MONTHLY" -> "PRO"
 */
function defaultPlanToTier(planId: string): string {
  if (!planId) return 'FREE';
  // Handle formats like "PRO_MONTHLY", "TEAM_YEARLY", "PRO", "TEAM"
  const upperPlanId = planId.toUpperCase();
  if (upperPlanId.startsWith('TEAM')) return 'TEAM';
  if (upperPlanId.startsWith('PRO')) return 'PRO';
  return 'FREE';
}

/**
 * Check if a subscription is valid (active or in valid trial period).
 */
function isSubscriptionValid(subscription: Subscription | null): {
  valid: boolean;
  reason?: 'no_subscription' | 'cancelled' | 'past_due' | 'trial_expired' | 'paused';
} {
  if (!subscription) {
    return { valid: false, reason: 'no_subscription' };
  }

  // Check subscription status
  if (subscription.status === 'canceled') {
    return { valid: false, reason: 'cancelled' };
  }

  if (subscription.status === 'past_due') {
    return { valid: false, reason: 'past_due' };
  }

  if (subscription.status === 'paused') {
    return { valid: false, reason: 'paused' };
  }

  // Check if trial has expired
  if (subscription.status === 'trialing' && subscription.trialEndDate) {
    const now = new Date();
    if (subscription.trialEndDate <= now) {
      return { valid: false, reason: 'trial_expired' };
    }
  }

  // Active or valid trial
  return { valid: true };
}

export function createAuthMiddleware(config: AuthMiddlewareConfig) {
  const { jwtSecret, database, planToTier = defaultPlanToTier } = config;

  /**
   * Authenticate user from JWT token.
   * Attaches decoded user to req.user.
   */
  function authenticate(req: Request, res: Response, next: NextFunction): void {
    const authHeader = req.headers.authorization;

    if (!authHeader?.startsWith('Bearer ')) {
      res.status(401).json({ success: false, error: 'Missing authorization token' });
      return;
    }

    const token = authHeader.split(' ')[1];

    try {
      const decoded = jwt.verify(token, jwtSecret) as AuthTokenPayload;
      req.user = decoded;
      next();
    } catch (error) {
      if (error instanceof jwt.TokenExpiredError) {
        res.status(401).json({ success: false, error: 'Token expired' });
        return;
      }
      res.status(401).json({ success: false, error: 'Invalid token' });
    }
  }

  /**
   * Require a valid subscription (active or in trial).
   * Queries subscription from database and attaches to req.subscription.
   * Must be called after authenticate middleware.
   * Returns a promise for testing purposes (Express ignores the return value).
   */
  function requireValidSubscription(req: Request, res: Response, next: NextFunction): void | Promise<void> {
    if (!req.user) {
      res.status(401).json({ success: false, error: 'Not authenticated' });
      return;
    }

    if (!database) {
      res.status(500).json({ success: false, error: 'Database adapter not configured for subscription checks' });
      return;
    }

    return database.getSubscriptionByUserId(req.user.userId)
      .then((subscription) => {
        req.subscription = subscription;

        const { valid, reason } = isSubscriptionValid(subscription);

        if (!valid) {
          const messages: Record<string, string> = {
            no_subscription: 'No active subscription found. Please subscribe to continue.',
            cancelled: 'Your subscription has been cancelled. Please subscribe to continue.',
            past_due: 'Your subscription payment is past due. Please update your payment method.',
            trial_expired: 'Your trial has expired. Please subscribe to continue.',
            paused: 'Your subscription is paused. Please resume to continue.',
          };

          res.status(403).json({
            success: false,
            error: reason,
            message: messages[reason!] || 'Subscription required',
          });
          return;
        }

        next();
      })
      .catch((error) => {
        console.error('Error checking subscription:', error);
        res.status(500).json({ success: false, error: 'Failed to verify subscription' });
      });
  }

  /**
   * Require a minimum tier level.
   *
   * Queries subscription from database to determine tier from planId.
   * Must be called after authenticate middleware.
   * Returns a promise for testing purposes (Express ignores the return value).
   *
   * @param minTier - Minimum tier required (e.g., 'PRO', 'TEAM')
   * @param tierOrder - Custom tier hierarchy. Default: { FREE: 0, PRO: 1, TEAM: 2 }
   */
  function requireTier(
    minTier: string,
    tierOrder: Record<string, number> = { FREE: 0, PRO: 1, TEAM: 2 }
  ) {
    return (req: Request, res: Response, next: NextFunction): void | Promise<void> => {
      if (!req.user) {
        res.status(401).json({ success: false, error: 'Not authenticated' });
        return;
      }

      if (!database) {
        res.status(500).json({ success: false, error: 'Database adapter not configured for tier checks' });
        return;
      }

      // DB-based tier check
      // Use cached subscription if available (from requireValidSubscription)
      const getSubscription = req.subscription !== undefined
        ? Promise.resolve(req.subscription)
        : database.getSubscriptionByUserId(req.user.userId);

      return getSubscription
        .then((subscription) => {
          req.subscription = subscription;

          // Determine tier from subscription
          let userTier = 'FREE';
          if (subscription) {
            const { valid } = isSubscriptionValid(subscription);
            if (valid) {
              userTier = planToTier(subscription.planId);
            }
          }

          const userTierLevel = tierOrder[userTier] ?? 0;
          const minTierLevel = tierOrder[minTier] ?? 0;

          if (userTierLevel < minTierLevel) {
            res.status(403).json({
              success: false,
              error: 'insufficient_tier',
              message: `This feature requires ${minTier} tier or higher`,
              currentTier: userTier,
              requiredTier: minTier,
            });
            return;
          }

          next();
        })
        .catch((error) => {
          console.error('Error checking tier:', error);
          res.status(500).json({ success: false, error: 'Failed to verify tier' });
        });
    };
  }

  /**
   * Require admin privileges.
   * Checks isAdmin flag from JWT payload.
   */
  function requireAdmin(req: Request, res: Response, next: NextFunction): void {
    if (!req.user) {
      res.status(401).json({ success: false, error: 'Not authenticated' });
      return;
    }

    if (!req.user.isAdmin) {
      res.status(403).json({ success: false, error: 'Admin access required' });
      return;
    }

    next();
  }

  return {
    authenticate,
    requireValidSubscription,
    requireTier,
    requireAdmin,
  };
}

export type AuthMiddleware = ReturnType<typeof createAuthMiddleware>;
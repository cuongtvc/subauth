import { Router, json, raw, Request, Response, NextFunction } from 'express';
import { PrismaAdapter } from '@subauth/adapter-prisma';
import { SESEmailAdapter } from '@subauth/adapter-ses';
import { PaddlePaymentAdapter } from '@subauth/adapter-paddle';
import { createAuthHandlers, createSubscriptionHandlers, createAdminHandlers } from '@subauth/backend';
import type { Plan } from '@subauth/core';

// ============================================
// CONFIGURATION TYPES
// ============================================

/**
 * Database configuration - just the Prisma client instance
 */
export interface DatabaseConfig {
  /** Prisma client instance */
  prisma: any;
}

/**
 * Email configuration - AWS SES credentials
 */
export interface EmailConfig {
  /** AWS access key ID (optional - uses default credential chain if not provided) */
  accessKeyId?: string;
  /** AWS secret access key (optional - uses default credential chain if not provided) */
  secretAccessKey?: string;
  /** AWS region (e.g., 'us-east-1') */
  region: string;
  /** Verified sender email address */
  from: string;
  /** Optional reply-to email address */
  replyTo?: string;
}

/**
 * Payment configuration - Paddle credentials (optional)
 */
export interface PaymentConfig {
  /** Paddle API key */
  apiKey: string;
  /** Paddle webhook secret */
  webhookSecret: string;
  /** Environment: 'sandbox' or 'production' */
  environment?: 'sandbox' | 'production';
}

/**
 * JWT configuration
 */
export interface JwtConfig {
  /** Secret key for signing JWTs */
  secret: string;
  /** Access token expiration (e.g., '15m', '1h', '7d'). Default: '1h' */
  expiresIn?: string;
  /** Refresh token expiration (e.g., '30d'). Default: '30d' */
  refreshTokenExpiresIn?: string;
}

/**
 * Subscription configuration (optional)
 */
export interface SubscriptionConfig {
  /** Available plans */
  plans: Plan[];
  /** Trial days for new subscriptions */
  trialDays?: number;
}

/**
 * Main configuration for SubAuth Express integration.
 * Only credentials are required - everything else has sensible defaults.
 */
export interface SubAuthConfig {
  /** Database configuration */
  database: DatabaseConfig;
  /** Email configuration (AWS SES) */
  email: EmailConfig;
  /** Payment configuration (Paddle) - optional */
  payment?: PaymentConfig;
  /** JWT configuration */
  jwt: JwtConfig;
  /** Base URL for email links (e.g., 'https://myapp.com') */
  baseUrl: string;
  /** Application name for emails */
  appName?: string;
  /** Require email verification before login */
  requireEmailVerification?: boolean;
  /** Verification token expiration in milliseconds (default: 24 hours) */
  verificationTokenExpiresIn?: number;
  /** Password reset token expiration in milliseconds (default: 1 hour) */
  passwordResetTokenExpiresIn?: number;
  /** Minimum password length (default: 8) */
  passwordMinLength?: number;
  /** Subscription configuration - only needed if using payment */
  subscription?: SubscriptionConfig;
  /** Custom claims callback for JWT */
  getCustomClaims?: (userId: string) => Promise<Record<string, unknown>>;
}

/**
 * SubAuth instance returned by createSubAuth
 */
export interface SubAuthInstance {
  /** Express router with all auth (and optionally subscription) routes mounted */
  router: Router;
  /** Express router with admin routes (requires authenticate + requireAdmin middleware) */
  adminRouter: Router;
  /** Direct access to auth handlers if needed */
  authHandlers: ReturnType<typeof createAuthHandlers>;
  /** Direct access to subscription handlers if payment is configured */
  subscriptionHandlers?: ReturnType<typeof createSubscriptionHandlers>;
  /** Direct access to admin handlers */
  adminHandlers: ReturnType<typeof createAdminHandlers>;
  /** Database adapter */
  databaseAdapter: PrismaAdapter;
  /** Email adapter */
  emailAdapter: SESEmailAdapter;
  /** Payment adapter (if configured) */
  paymentAdapter?: PaddlePaymentAdapter;
}

// ============================================
// MAIN FACTORY FUNCTION
// ============================================

/**
 * Create a fully configured SubAuth instance with Express router.
 *
 * @example
 * ```typescript
 * import express from 'express';
 * import { PrismaClient } from '@prisma/client';
 * import { createSubAuth } from '@subauth/express';
 *
 * const app = express();
 * const prisma = new PrismaClient();
 *
 * const subauth = createSubAuth({
 *   database: { prisma },
 *   email: {
 *     accessKeyId: process.env.AWS_ACCESS_KEY_ID,
 *     secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
 *     region: 'us-east-1',
 *     from: 'noreply@myapp.com'
 *   },
 *   jwt: { secret: process.env.JWT_SECRET! },
 *   baseUrl: 'https://myapp.com'
 * });
 *
 * app.use('/auth', subauth.router);
 * // That's it! All routes are now available:
 * // POST /auth/register
 * // POST /auth/login
 * // POST /auth/logout
 * // POST /auth/refresh
 * // GET  /auth/me
 * // POST /auth/verify-email/:token
 * // POST /auth/resend-verification
 * // POST /auth/forgot-password
 * // POST /auth/reset-password
 * // POST /auth/change-password
 * ```
 */
export function createSubAuth(config: SubAuthConfig): SubAuthInstance {
  // Create database adapter
  const databaseAdapter = new PrismaAdapter({
    models: config.database.prisma,
  });

  // Create email adapter
  const emailAdapter = new SESEmailAdapter({
    accessKeyId: config.email.accessKeyId,
    secretAccessKey: config.email.secretAccessKey,
    region: config.email.region,
    fromEmail: config.email.from,
    replyToEmail: config.email.replyTo,
    appName: config.appName,
  });

  // Create payment adapter if configured
  let paymentAdapter: PaddlePaymentAdapter | undefined;
  if (config.payment) {
    paymentAdapter = new PaddlePaymentAdapter({
      apiKey: config.payment.apiKey,
      webhookSecret: config.payment.webhookSecret,
      environment: config.payment.environment,
    });
  }

  // Build auth config
  const authConfig = {
    jwtSecret: config.jwt.secret,
    jwtExpiresIn: config.jwt.expiresIn ?? '1h',
    refreshTokenExpiresIn: config.jwt.refreshTokenExpiresIn ?? '30d',
    verificationTokenExpiresIn: config.verificationTokenExpiresIn ?? 24 * 60 * 60 * 1000,
    passwordResetTokenExpiresIn: config.passwordResetTokenExpiresIn ?? 60 * 60 * 1000,
    baseUrl: config.baseUrl,
    passwordMinLength: config.passwordMinLength ?? 8,
  };

  // Create auth handlers
  const authHandlers = createAuthHandlers({
    auth: authConfig,
    database: databaseAdapter,
    email: emailAdapter,
    requireEmailVerification: config.requireEmailVerification,
    getCustomClaims: config.getCustomClaims,
  });

  // Create subscription handlers if payment is configured
  let subscriptionHandlers: ReturnType<typeof createSubscriptionHandlers> | undefined;
  if (paymentAdapter && config.subscription) {
    subscriptionHandlers = createSubscriptionHandlers({
      authConfig,
      database: databaseAdapter,
      email: emailAdapter,
      payment: paymentAdapter,
      plans: config.subscription.plans,
      trialDays: config.subscription.trialDays,
    });
  }

  // Create admin handlers
  const adminHandlers = createAdminHandlers({
    auth: authConfig,
    database: databaseAdapter,
    email: emailAdapter,
  });

  // Create Express routers
  const router = createRouter(authHandlers, subscriptionHandlers);
  const adminRouter = createAdminRouter(adminHandlers);

  return {
    router,
    adminRouter,
    authHandlers,
    subscriptionHandlers,
    adminHandlers,
    databaseAdapter,
    emailAdapter,
    paymentAdapter,
  };
}

// ============================================
// ROUTER CREATION
// ============================================

/**
 * Create auth router with all authentication routes.
 * Use this when you want to mount auth routes separately and handle
 * middleware yourself, similar to createAdminRouter.
 *
 * @example
 * ```typescript
 * import { Router } from 'express';
 * import { createAuthRouter } from '@subauth/express';
 * import { authHandlers } from './lib/subauth';
 *
 * const router = Router();
 * router.use('/', createAuthRouter(authHandlers));
 *
 * export { router as authRouter };
 * ```
 */
function createAuthRouter(
  authHandlers: ReturnType<typeof createAuthHandlers>
): Router {
  const router = Router();

  // JSON body parser
  router.use(json());

  // POST /register
  router.post('/register', asyncHandler(async (req, res) => {
    const result = await authHandlers.register({
      method: req.method,
      path: req.path,
      body: req.body,
      headers: flattenHeaders(req.headers),
      params: req.params,
    });
    res.status(result.status).json(result.body);
  }));

  // POST /login
  router.post('/login', asyncHandler(async (req, res) => {
    const result = await authHandlers.login({
      method: req.method,
      path: req.path,
      body: req.body,
      headers: flattenHeaders(req.headers),
      params: req.params,
    });
    res.status(result.status).json(result.body);
  }));

  // POST /logout
  router.post('/logout', asyncHandler(async (req, res) => {
    const result = await authHandlers.logout({
      method: req.method,
      path: req.path,
      body: req.body,
      headers: flattenHeaders(req.headers),
      params: req.params,
    });
    res.status(result.status).json(result.body);
  }));

  // POST /refresh
  router.post('/refresh', asyncHandler(async (req, res) => {
    const result = await authHandlers.refresh({
      method: req.method,
      path: req.path,
      body: req.body,
      headers: flattenHeaders(req.headers),
      params: req.params,
    });
    res.status(result.status).json(result.body);
  }));

  // GET /me
  router.get('/me', asyncHandler(async (req, res) => {
    const result = await authHandlers.getMe({
      method: req.method,
      path: req.path,
      body: req.body,
      headers: flattenHeaders(req.headers),
      params: req.params,
    });
    res.status(result.status).json(result.body);
  }));

  // POST /verify-email/:token
  router.post('/verify-email/:token', asyncHandler(async (req, res) => {
    const result = await authHandlers.verifyEmail({
      method: req.method,
      path: req.path,
      body: req.body,
      headers: flattenHeaders(req.headers),
      params: req.params,
    });
    res.status(result.status).json(result.body);
  }));

  // POST /resend-verification
  router.post('/resend-verification', asyncHandler(async (req, res) => {
    const result = await authHandlers.resendVerification({
      method: req.method,
      path: req.path,
      body: req.body,
      headers: flattenHeaders(req.headers),
      params: req.params,
    });
    res.status(result.status).json(result.body);
  }));

  // POST /forgot-password
  router.post('/forgot-password', asyncHandler(async (req, res) => {
    const result = await authHandlers.forgotPassword({
      method: req.method,
      path: req.path,
      body: req.body,
      headers: flattenHeaders(req.headers),
      params: req.params,
    });
    res.status(result.status).json(result.body);
  }));

  // POST /reset-password
  router.post('/reset-password', asyncHandler(async (req, res) => {
    const result = await authHandlers.resetPassword({
      method: req.method,
      path: req.path,
      body: req.body,
      headers: flattenHeaders(req.headers),
      params: req.params,
    });
    res.status(result.status).json(result.body);
  }));

  // POST /change-password
  router.post('/change-password', asyncHandler(async (req, res) => {
    const result = await authHandlers.changePassword({
      method: req.method,
      path: req.path,
      body: req.body,
      headers: flattenHeaders(req.headers),
      params: req.params,
    });
    res.status(result.status).json(result.body);
  }));

  return router;
}

/**
 * Create combined router with auth routes and optional subscription routes.
 * Used internally by createSubAuth.
 */
function createRouter(
  authHandlers: ReturnType<typeof createAuthHandlers>,
  subscriptionHandlers?: ReturnType<typeof createSubscriptionHandlers>
): Router {
  const router = Router();

  // Mount auth routes
  router.use('/', createAuthRouter(authHandlers));

  // ============================================
  // SUBSCRIPTION ROUTES (if configured)
  // ============================================

  if (subscriptionHandlers) {
    // GET /plans
    router.get('/plans', asyncHandler(async (req, res) => {
      const result = await subscriptionHandlers.getPlans({
        method: req.method,
        path: req.path,
        body: req.body,
        headers: flattenHeaders(req.headers),
        params: req.params,
      });
      res.status(result.status).json(result.body);
    }));

    // POST /checkout
    router.post('/checkout', asyncHandler(async (req, res) => {
      const result = await subscriptionHandlers.createCheckout({
        method: req.method,
        path: req.path,
        body: req.body,
        headers: flattenHeaders(req.headers),
        params: req.params,
      });
      res.status(result.status).json(result.body);
    }));

    // GET /subscription
    router.get('/subscription', asyncHandler(async (req, res) => {
      const result = await subscriptionHandlers.getSubscription({
        method: req.method,
        path: req.path,
        body: req.body,
        headers: flattenHeaders(req.headers),
        params: req.params,
      });
      res.status(result.status).json(result.body);
    }));

    // POST /subscription/cancel
    router.post('/subscription/cancel', asyncHandler(async (req, res) => {
      const result = await subscriptionHandlers.cancelSubscription({
        method: req.method,
        path: req.path,
        body: req.body,
        headers: flattenHeaders(req.headers),
        params: req.params,
      });
      res.status(result.status).json(result.body);
    }));

    // POST /subscription/resume
    router.post('/subscription/resume', asyncHandler(async (req, res) => {
      const result = await subscriptionHandlers.resumeSubscription({
        method: req.method,
        path: req.path,
        body: req.body,
        headers: flattenHeaders(req.headers),
        params: req.params,
      });
      res.status(result.status).json(result.body);
    }));

    // POST /webhook - needs raw body for signature verification
    router.post('/webhook', raw({ type: 'application/json' }), asyncHandler(async (req, res) => {
      const rawBody = req.body as Buffer;
      const result = await subscriptionHandlers.webhook(
        {
          method: req.method,
          path: req.path,
          body: JSON.parse(rawBody.toString()),
          headers: flattenHeaders(req.headers),
          params: req.params,
        },
        rawBody
      );
      res.status(result.status).json(result.body);
    }));
  }

  return router;
}

/**
 * Create admin router.
 * NOTE: Authentication and admin authorization should be handled by middleware
 * before these routes (e.g., authenticate + requireAdmin from createAuthMiddleware).
 */
function createAdminRouter(
  adminHandlers: ReturnType<typeof createAdminHandlers>
): Router {
  const router = Router();

  // JSON body parser
  router.use(json());

  // GET /users - List users with pagination and search
  router.get('/users', asyncHandler(async (req, res) => {
    const result = await adminHandlers.listUsers({
      method: 'GET',
      path: '/admin/users',
      body: req.body,
      headers: flattenHeaders(req.headers),
      params: req.params,
      query: req.query as Record<string, string>,
    });
    res.status(result.status).json(result.body);
  }));

  // PATCH /users/:userId/tier - Update user tier
  router.patch('/users/:userId/tier', asyncHandler(async (req, res) => {
    const result = await adminHandlers.updateUserTier({
      method: 'PATCH',
      path: `/admin/users/${req.params.userId}/tier`,
      body: req.body,
      headers: flattenHeaders(req.headers),
      params: req.params,
      query: req.query as Record<string, string>,
    });
    res.status(result.status).json(result.body);
  }));

  return router;
}

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Flatten Express headers to simple string record
 */
function flattenHeaders(headers: Request['headers']): Record<string, string | undefined> {
  const result: Record<string, string | undefined> = {};
  for (const [key, value] of Object.entries(headers)) {
    result[key] = Array.isArray(value) ? value[0] : value;
  }
  return result;
}

/**
 * Async handler wrapper for Express routes
 */
function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<void>
): (req: Request, res: Response, next: NextFunction) => void {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

// ============================================
// RE-EXPORTS
// ============================================

export type { Plan, PlanPrice, User, Subscription, AuthTokens, AuthTokenPayload } from '@subauth/core';

// Middleware exports
export { createAuthMiddleware } from './middleware/auth';
export type { AuthMiddlewareConfig, AuthMiddleware } from './middleware/auth';

export { createErrorMiddleware } from './middleware/error';
export type { AppError, ErrorMiddleware } from './middleware/error';

// Router factory exports - useful when you want to mount routes separately
// Can be omitted when using createSubAuth (which includes routers)
export { createAuthRouter, createAdminRouter };
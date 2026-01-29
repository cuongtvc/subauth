import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock all dependencies before importing the module under test
vi.mock('@subauth/adapter-prisma', () => ({
  PrismaAdapter: vi.fn().mockImplementation(() => ({
    createUser: vi.fn(),
    getUserById: vi.fn(),
    getUserByEmail: vi.fn(),
  })),
}));

vi.mock('@subauth/adapter-ses', () => ({
  SESEmailAdapter: vi.fn().mockImplementation(() => ({
    sendVerificationEmail: vi.fn(),
    sendPasswordResetEmail: vi.fn(),
  })),
}));

vi.mock('@subauth/adapter-paddle', () => ({
  PaddlePaymentAdapter: vi.fn().mockImplementation(() => ({
    createCheckoutSession: vi.fn(),
    verifyWebhookSignature: vi.fn(),
  })),
}));

vi.mock('@subauth/backend', () => ({
  createAuthHandlers: vi.fn().mockImplementation(() => ({
    register: vi.fn().mockResolvedValue({ status: 201, body: { user: {}, tokens: {} } }),
    login: vi.fn().mockResolvedValue({ status: 200, body: { user: {}, tokens: {} } }),
    logout: vi.fn().mockResolvedValue({ status: 200, body: { success: true } }),
    refresh: vi.fn().mockResolvedValue({ status: 200, body: { tokens: {} } }),
    getMe: vi.fn().mockResolvedValue({ status: 200, body: { user: {} } }),
    verifyEmail: vi.fn().mockResolvedValue({ status: 200, body: { user: {} } }),
    resendVerification: vi.fn().mockResolvedValue({ status: 200, body: { success: true } }),
    forgotPassword: vi.fn().mockResolvedValue({ status: 200, body: { success: true } }),
    resetPassword: vi.fn().mockResolvedValue({ status: 200, body: { success: true } }),
    changePassword: vi.fn().mockResolvedValue({ status: 200, body: { success: true } }),
  })),
  createSubscriptionHandlers: vi.fn().mockImplementation(() => ({
    getPlans: vi.fn().mockResolvedValue({ status: 200, body: { plans: [] } }),
    createCheckout: vi.fn().mockResolvedValue({ status: 200, body: { url: 'http://checkout' } }),
    getSubscription: vi.fn().mockResolvedValue({ status: 200, body: { subscription: null } }),
    cancelSubscription: vi.fn().mockResolvedValue({ status: 200, body: { subscription: {} } }),
    resumeSubscription: vi.fn().mockResolvedValue({ status: 200, body: { subscription: {} } }),
    webhook: vi.fn().mockResolvedValue({ status: 200, body: { received: true } }),
  })),
}));

// Import after mocks are set up
import { createSubAuth } from '../index';
import type { SubAuthConfig } from '../index';
import { PrismaAdapter } from '@subauth/adapter-prisma';
import { SESEmailAdapter } from '@subauth/adapter-ses';
import { PaddlePaymentAdapter } from '@subauth/adapter-paddle';
import { createAuthHandlers, createSubscriptionHandlers } from '@subauth/backend';

// ============================================
// TEST HELPERS
// ============================================

function createMinimalConfig(): SubAuthConfig {
  return {
    database: { prisma: {} },
    email: {
      region: 'us-east-1',
      from: 'test@example.com',
    },
    jwt: { secret: 'test-secret' },
    baseUrl: 'https://example.com',
  };
}

function createFullConfig(): SubAuthConfig {
  return {
    database: { prisma: {} },
    email: {
      accessKeyId: 'AKIAXXXXXXXX',
      secretAccessKey: 'secret',
      region: 'us-east-1',
      from: 'test@example.com',
      replyTo: 'support@example.com',
    },
    payment: {
      apiKey: 'paddle-api-key',
      webhookSecret: 'paddle-webhook-secret',
      environment: 'sandbox',
    },
    jwt: {
      secret: 'test-secret',
      expiresIn: '15m',
      refreshTokenExpiresIn: '30d',
    },
    baseUrl: 'https://example.com',
    appName: 'Test App',
    requireEmailVerification: true,
    subscription: {
      plans: [
        {
          id: 'pro',
          name: 'Pro',
          prices: [{ id: 'price_pro_monthly', amount: 1000, currency: 'USD', interval: 'month' }],
        },
      ],
      trialDays: 14,
    },
  };
}

// ============================================
// TESTS: createSubAuth factory function
// ============================================

describe('createSubAuth', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('with minimal config (auth only)', () => {
    it('should create a SubAuth instance with only required credentials', () => {
      const config = createMinimalConfig();
      const subauth = createSubAuth(config);

      expect(subauth).toBeDefined();
      expect(subauth.router).toBeDefined();
      expect(subauth.authHandlers).toBeDefined();
      expect(subauth.databaseAdapter).toBeDefined();
      expect(subauth.emailAdapter).toBeDefined();
    });

    it('should not create payment adapter when payment config is not provided', () => {
      const config = createMinimalConfig();
      const subauth = createSubAuth(config);

      expect(subauth.paymentAdapter).toBeUndefined();
      expect(subauth.subscriptionHandlers).toBeUndefined();
    });

    it('should create PrismaAdapter with prisma instance', () => {
      const config = createMinimalConfig();
      createSubAuth(config);

      expect(PrismaAdapter).toHaveBeenCalledWith({
        models: config.database.prisma,
      });
    });

    it('should create SESEmailAdapter with email config', () => {
      const config = createMinimalConfig();
      createSubAuth(config);

      expect(SESEmailAdapter).toHaveBeenCalledWith(
        expect.objectContaining({
          region: 'us-east-1',
          fromEmail: 'test@example.com',
        })
      );
    });

    it('should create auth handlers with default expiry values', () => {
      const config = createMinimalConfig();
      createSubAuth(config);

      expect(createAuthHandlers).toHaveBeenCalledWith(
        expect.objectContaining({
          auth: expect.objectContaining({
            jwtExpiresIn: '1h',
            refreshTokenExpiresIn: '30d',
          }),
        })
      );
    });
  });

  describe('with full config (auth + subscriptions)', () => {
    it('should create payment adapter when payment config is provided', () => {
      const config = createFullConfig();
      const subauth = createSubAuth(config);

      expect(subauth.paymentAdapter).toBeDefined();
      expect(PaddlePaymentAdapter).toHaveBeenCalledWith({
        apiKey: 'paddle-api-key',
        webhookSecret: 'paddle-webhook-secret',
        environment: 'sandbox',
      });
    });

    it('should create subscription handlers when payment and subscription config are provided', () => {
      const config = createFullConfig();
      const subauth = createSubAuth(config);

      expect(subauth.subscriptionHandlers).toBeDefined();
      expect(createSubscriptionHandlers).toHaveBeenCalledWith(
        expect.objectContaining({
          plans: config.subscription!.plans,
          trialDays: 14,
        })
      );
    });

    it('should pass custom JWT config', () => {
      const config = createFullConfig();
      createSubAuth(config);

      expect(createAuthHandlers).toHaveBeenCalledWith(
        expect.objectContaining({
          auth: expect.objectContaining({
            jwtExpiresIn: '15m',
            refreshTokenExpiresIn: '30d',
          }),
        })
      );
    });

    it('should pass requireEmailVerification option', () => {
      const config = createFullConfig();
      createSubAuth(config);

      expect(createAuthHandlers).toHaveBeenCalledWith(
        expect.objectContaining({
          requireEmailVerification: true,
        })
      );
    });

    it('should pass appName to email adapter', () => {
      const config = createFullConfig();
      createSubAuth(config);

      expect(SESEmailAdapter).toHaveBeenCalledWith(
        expect.objectContaining({
          appName: 'Test App',
        })
      );
    });
  });
});

// ============================================
// TESTS: Express Router
// ============================================

describe('SubAuth Express Router', () => {
  describe('router structure', () => {
    it('should return an Express router', () => {
      const config = createMinimalConfig();
      const subauth = createSubAuth(config);

      // Router should be a function (Express router)
      expect(typeof subauth.router).toBe('function');
    });

    it('should have auth routes registered', () => {
      const config = createMinimalConfig();
      const subauth = createSubAuth(config);

      // Check router stack for expected routes
      const routes = getRouterPaths(subauth.router);

      expect(routes).toContain('POST /register');
      expect(routes).toContain('POST /login');
      expect(routes).toContain('POST /logout');
      expect(routes).toContain('POST /refresh');
      expect(routes).toContain('GET /me');
      expect(routes).toContain('POST /verify-email/:token');
      expect(routes).toContain('POST /resend-verification');
      expect(routes).toContain('POST /forgot-password');
      expect(routes).toContain('POST /reset-password');
      expect(routes).toContain('POST /change-password');
    });

    it('should not have subscription routes when payment is not configured', () => {
      const config = createMinimalConfig();
      const subauth = createSubAuth(config);

      const routes = getRouterPaths(subauth.router);

      expect(routes).not.toContain('GET /plans');
      expect(routes).not.toContain('POST /checkout');
      expect(routes).not.toContain('GET /subscription');
      expect(routes).not.toContain('POST /webhook');
    });

    it('should have subscription routes when payment is configured', () => {
      const config = createFullConfig();
      const subauth = createSubAuth(config);

      const routes = getRouterPaths(subauth.router);

      expect(routes).toContain('GET /plans');
      expect(routes).toContain('POST /checkout');
      expect(routes).toContain('GET /subscription');
      expect(routes).toContain('POST /subscription/cancel');
      expect(routes).toContain('POST /subscription/resume');
      expect(routes).toContain('POST /webhook');
    });
  });
});

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Extract route paths from Express router for testing
 */
function getRouterPaths(router: any): string[] {
  const paths: string[] = [];

  if (router.stack) {
    for (const layer of router.stack) {
      if (layer.route) {
        const methods = Object.keys(layer.route.methods)
          .filter(m => layer.route.methods[m])
          .map(m => m.toUpperCase());
        for (const method of methods) {
          paths.push(`${method} ${layer.route.path}`);
        }
      }
    }
  }

  return paths;
}
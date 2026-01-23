import { describe, it, expect, beforeEach } from 'vitest';
import type {
  DatabaseAdapter,
  PaymentAdapter,
  User,
  Subscription,
  Plan,
  CheckoutSession,
  WebhookEvent,
  SubscriptionConfig,
} from '@subauth/core';

// Import will fail until we implement - that's TDD!
import { createSubscriptionHandlers } from '../handlers/subscription-handlers';
import { createAuthHandlers } from '../handlers/auth-handlers';
import type { AuthRequest, AuthResponse } from '../handlers/types';

// ============================================
// MOCK HELPERS
// ============================================

function createMockDatabaseAdapter(): DatabaseAdapter {
  const users = new Map<string, User & { passwordHash: string; providerCustomerId?: string }>();
  const subscriptions = new Map<string, Subscription>();
  const verificationTokens = new Map<string, { userId: string; expiresAt: Date }>();
  let userIdCounter = 1;
  let subIdCounter = 1;

  return {
    async createUser(email: string, passwordHash: string): Promise<User> {
      const existing = Array.from(users.values()).find(u => u.email === email);
      if (existing) throw new Error('User exists');

      const user: User & { passwordHash: string } = {
        id: String(userIdCounter++),
        email,
        passwordHash,
        emailVerified: false,
        createdAt: new Date(),
      };
      users.set(user.id, user);
      return { id: user.id, email: user.email, emailVerified: user.emailVerified, createdAt: user.createdAt };
    },

    async getUserById(id: string): Promise<User | null> {
      const user = users.get(id);
      if (!user) return null;
      return { id: user.id, email: user.email, emailVerified: user.emailVerified, createdAt: user.createdAt };
    },

    async getUserByEmail(email: string): Promise<User | null> {
      const user = Array.from(users.values()).find(u => u.email === email);
      if (!user) return null;
      return { id: user.id, email: user.email, emailVerified: user.emailVerified, createdAt: user.createdAt };
    },

    async updateUser(id: string, updates: Partial<User>): Promise<User> {
      const user = users.get(id);
      if (!user) throw new Error('User not found');
      Object.assign(user, updates);
      return { id: user.id, email: user.email, emailVerified: user.emailVerified, createdAt: user.createdAt };
    },

    async getPasswordHash(userId: string): Promise<string | null> {
      return users.get(userId)?.passwordHash ?? null;
    },

    async setPasswordHash(userId: string, hash: string): Promise<void> {
      const user = users.get(userId);
      if (user) user.passwordHash = hash;
    },

    async setVerificationToken(userId: string, token: string, expiresAt: Date): Promise<void> {
      verificationTokens.set(token, { userId, expiresAt });
    },

    async getUserByVerificationToken(token: string): Promise<User | null> {
      const data = verificationTokens.get(token);
      if (!data || data.expiresAt < new Date()) return null;
      return this.getUserById(data.userId);
    },

    async clearVerificationToken(userId: string): Promise<void> {
      for (const [token, data] of verificationTokens) {
        if (data.userId === userId) verificationTokens.delete(token);
      }
    },

    async setPasswordResetToken() {},
    async getUserByPasswordResetToken() { return null; },
    async clearPasswordResetToken() {},

    async createSubscription(sub: Omit<Subscription, 'id' | 'createdAt' | 'updatedAt'>): Promise<Subscription> {
      const subscription: Subscription = {
        ...sub,
        id: String(subIdCounter++),
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      subscriptions.set(subscription.id, subscription);
      return subscription;
    },

    async getSubscriptionByUserId(userId: string): Promise<Subscription | null> {
      return Array.from(subscriptions.values()).find(s => s.userId === userId) ?? null;
    },

    async getSubscriptionByProviderId(providerSubscriptionId: string): Promise<Subscription | null> {
      return Array.from(subscriptions.values()).find(s => s.providerSubscriptionId === providerSubscriptionId) ?? null;
    },

    async updateSubscription(id: string, updates: Partial<Subscription>): Promise<Subscription> {
      const sub = subscriptions.get(id);
      if (!sub) throw new Error('Subscription not found');
      Object.assign(sub, updates, { updatedAt: new Date() });
      return sub;
    },

    async createTransaction() {
      return { id: '1', userId: '1', amount: 100, currency: 'USD', status: 'completed' as const, providerTransactionId: 'tx_1', createdAt: new Date() };
    },

    async getTransactionByProviderId() { return null; },

    async setProviderCustomerId(userId: string, providerId: string): Promise<void> {
      const user = users.get(userId);
      if (user) user.providerCustomerId = providerId;
    },

    async getUserByProviderCustomerId(providerId: string): Promise<User | null> {
      const user = Array.from(users.values()).find(u => u.providerCustomerId === providerId);
      if (!user) return null;
      return { id: user.id, email: user.email, emailVerified: user.emailVerified, createdAt: user.createdAt };
    },
  };
}

function createMockPaymentAdapter(providerName: string = 'stripe'): PaymentAdapter {
  return {
    providerName,

    async createCheckoutSession(params): Promise<CheckoutSession> {
      return {
        url: `https://${providerName}.com/checkout/session_123`,
        sessionId: 'session_123',
      };
    },

    async createCustomerPortalSession() {
      return { url: 'https://stripe.com/portal/session_456' };
    },

    async cancelSubscription() {},
    async resumeSubscription() {},
    async updateSubscription() {},

    verifyWebhookSignature(_payload: string | Buffer, signature: string): boolean {
      return signature === 'valid-signature';
    },

    parseWebhookEvent(payload: string | Buffer): WebhookEvent {
      const data = JSON.parse(typeof payload === 'string' ? payload : payload.toString());
      return {
        type: data.type,
        provider: providerName,
        data: data.data,
        rawEvent: data,
      };
    },
  };
}

function createTestPlans(): Plan[] {
  return [
    {
      id: 'basic',
      name: 'Basic',
      features: ['Feature 1', 'Feature 2'],
      prices: [
        { id: 'price_basic_monthly', amount: 999, currency: 'USD', billingCycle: 'monthly' },
        { id: 'price_basic_annual', amount: 9999, currency: 'USD', billingCycle: 'annual' },
      ],
    },
    {
      id: 'plus',
      name: 'Plus',
      features: ['Feature 1', 'Feature 2', 'Feature 3'],
      prices: [
        { id: 'price_plus_monthly', amount: 1999, currency: 'USD', billingCycle: 'monthly' },
        { id: 'price_plus_annual', amount: 19999, currency: 'USD', billingCycle: 'annual' },
      ],
    },
  ];
}

function createTestSubscriptionConfig(): SubscriptionConfig {
  return { trialDays: 7, plans: createTestPlans() };
}

// ============================================
// GET PLANS HANDLER TESTS
// ============================================

describe('Subscription Handlers - Get Plans', () => {
  let handlers: ReturnType<typeof createSubscriptionHandlers>;

  beforeEach(() => {
    handlers = createSubscriptionHandlers({
      database: createMockDatabaseAdapter(),
      payment: createMockPaymentAdapter(),
      config: createTestSubscriptionConfig(),
      authConfig: {
        jwtSecret: 'test-secret',
        jwtExpiresIn: '7d',
        verificationTokenExpiresIn: 86400000,
        passwordResetTokenExpiresIn: 3600000,
        baseUrl: 'http://localhost:3000',
      },
    });
  });

  it('should return plans with 200', async () => {
    const request: AuthRequest = {
      method: 'GET',
      path: '/plans',
      body: {},
      headers: {},
    };

    const response = await handlers.getPlans(request);

    expect(response.status).toBe(200);
    expect(response.body.plans).toBeDefined();
    expect(response.body.plans).toHaveLength(2);
  });
});

// ============================================
// CREATE CHECKOUT HANDLER TESTS
// ============================================

describe('Subscription Handlers - Create Checkout', () => {
  let handlers: ReturnType<typeof createSubscriptionHandlers>;
  let authHandlers: ReturnType<typeof createAuthHandlers>;
  let db: DatabaseAdapter;
  let token: string;

  beforeEach(async () => {
    db = createMockDatabaseAdapter();
    const authConfig = {
      jwtSecret: 'test-secret',
      jwtExpiresIn: '7d',
      verificationTokenExpiresIn: 86400000,
      passwordResetTokenExpiresIn: 3600000,
      baseUrl: 'http://localhost:3000',
    };

    authHandlers = createAuthHandlers({
      auth: authConfig,
      database: db,
      email: { async sendVerificationEmail() {}, async sendPasswordResetEmail() {} },
    });

    handlers = createSubscriptionHandlers({
      database: db,
      payment: createMockPaymentAdapter(),
      config: createTestSubscriptionConfig(),
      authConfig,
    });

    // Register a user
    const registerResponse = await authHandlers.register({
      method: 'POST',
      path: '/register',
      body: { email: 'test@example.com', password: 'securePassword123' },
      headers: {},
    });
    token = registerResponse.body.tokens.accessToken;
  });

  it('should create checkout and return 200', async () => {
    const request: AuthRequest = {
      method: 'POST',
      path: '/checkout',
      body: { priceId: 'price_basic_monthly' },
      headers: { authorization: `Bearer ${token}` },
    };

    const response = await handlers.createCheckout(request);

    expect(response.status).toBe(200);
    expect(response.body.url).toBeDefined();
    expect(response.body.sessionId).toBeDefined();
  });

  it('should return 400 for invalid price ID', async () => {
    const request: AuthRequest = {
      method: 'POST',
      path: '/checkout',
      body: { priceId: 'invalid_price' },
      headers: { authorization: `Bearer ${token}` },
    };

    const response = await handlers.createCheckout(request);

    expect(response.status).toBe(400);
  });

  it('should return 401 without auth token', async () => {
    const request: AuthRequest = {
      method: 'POST',
      path: '/checkout',
      body: { priceId: 'price_basic_monthly' },
      headers: {},
    };

    const response = await handlers.createCheckout(request);

    expect(response.status).toBe(401);
  });

  it('should return 400 for user with active subscription', async () => {
    // Create active subscription
    const user = await db.getUserByEmail('test@example.com');
    await db.createSubscription({
      userId: user!.id,
      planId: 'basic',
      priceId: 'price_basic_monthly',
      status: 'active',
      billingCycle: 'monthly',
      currentPeriodStart: new Date(),
      currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      cancelAtPeriodEnd: false,
      providerSubscriptionId: 'sub_123',
      providerCustomerId: 'cus_123',
    });

    const request: AuthRequest = {
      method: 'POST',
      path: '/checkout',
      body: { priceId: 'price_plus_monthly' },
      headers: { authorization: `Bearer ${token}` },
    };

    const response = await handlers.createCheckout(request);

    expect(response.status).toBe(400);
  });
});

// ============================================
// GET SUBSCRIPTION HANDLER TESTS
// ============================================

describe('Subscription Handlers - Get Subscription', () => {
  let handlers: ReturnType<typeof createSubscriptionHandlers>;
  let authHandlers: ReturnType<typeof createAuthHandlers>;
  let db: DatabaseAdapter;
  let token: string;

  beforeEach(async () => {
    db = createMockDatabaseAdapter();
    const authConfig = {
      jwtSecret: 'test-secret',
      jwtExpiresIn: '7d',
      verificationTokenExpiresIn: 86400000,
      passwordResetTokenExpiresIn: 3600000,
      baseUrl: 'http://localhost:3000',
    };

    authHandlers = createAuthHandlers({
      auth: authConfig,
      database: db,
      email: { async sendVerificationEmail() {}, async sendPasswordResetEmail() {} },
    });

    handlers = createSubscriptionHandlers({
      database: db,
      payment: createMockPaymentAdapter(),
      config: createTestSubscriptionConfig(),
      authConfig,
    });

    const registerResponse = await authHandlers.register({
      method: 'POST',
      path: '/register',
      body: { email: 'test@example.com', password: 'securePassword123' },
      headers: {},
    });
    token = registerResponse.body.tokens.accessToken;
  });

  it('should return subscription with 200', async () => {
    const user = await db.getUserByEmail('test@example.com');
    await db.createSubscription({
      userId: user!.id,
      planId: 'basic',
      priceId: 'price_basic_monthly',
      status: 'active',
      billingCycle: 'monthly',
      currentPeriodStart: new Date(),
      currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      cancelAtPeriodEnd: false,
      providerSubscriptionId: 'sub_123',
      providerCustomerId: 'cus_123',
    });

    const request: AuthRequest = {
      method: 'GET',
      path: '/subscription',
      body: {},
      headers: { authorization: `Bearer ${token}` },
    };

    const response = await handlers.getSubscription(request);

    expect(response.status).toBe(200);
    expect(response.body.subscription).toBeDefined();
    expect(response.body.subscription.planId).toBe('basic');
  });

  it('should return null subscription if none exists', async () => {
    const request: AuthRequest = {
      method: 'GET',
      path: '/subscription',
      body: {},
      headers: { authorization: `Bearer ${token}` },
    };

    const response = await handlers.getSubscription(request);

    expect(response.status).toBe(200);
    expect(response.body.subscription).toBeNull();
  });

  it('should return 401 without auth token', async () => {
    const request: AuthRequest = {
      method: 'GET',
      path: '/subscription',
      body: {},
      headers: {},
    };

    const response = await handlers.getSubscription(request);

    expect(response.status).toBe(401);
  });
});

// ============================================
// CANCEL SUBSCRIPTION HANDLER TESTS
// ============================================

describe('Subscription Handlers - Cancel', () => {
  let handlers: ReturnType<typeof createSubscriptionHandlers>;
  let authHandlers: ReturnType<typeof createAuthHandlers>;
  let db: DatabaseAdapter;
  let token: string;

  beforeEach(async () => {
    db = createMockDatabaseAdapter();
    const authConfig = {
      jwtSecret: 'test-secret',
      jwtExpiresIn: '7d',
      verificationTokenExpiresIn: 86400000,
      passwordResetTokenExpiresIn: 3600000,
      baseUrl: 'http://localhost:3000',
    };

    authHandlers = createAuthHandlers({
      auth: authConfig,
      database: db,
      email: { async sendVerificationEmail() {}, async sendPasswordResetEmail() {} },
    });

    handlers = createSubscriptionHandlers({
      database: db,
      payment: createMockPaymentAdapter(),
      config: createTestSubscriptionConfig(),
      authConfig,
    });

    const registerResponse = await authHandlers.register({
      method: 'POST',
      path: '/register',
      body: { email: 'test@example.com', password: 'securePassword123' },
      headers: {},
    });
    token = registerResponse.body.tokens.accessToken;

    const user = await db.getUserByEmail('test@example.com');
    await db.createSubscription({
      userId: user!.id,
      planId: 'basic',
      priceId: 'price_basic_monthly',
      status: 'active',
      billingCycle: 'monthly',
      currentPeriodStart: new Date(),
      currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      cancelAtPeriodEnd: false,
      providerSubscriptionId: 'sub_123',
      providerCustomerId: 'cus_123',
    });
  });

  it('should cancel subscription and return 200', async () => {
    const request: AuthRequest = {
      method: 'POST',
      path: '/cancel',
      body: {},
      headers: { authorization: `Bearer ${token}` },
    };

    const response = await handlers.cancelSubscription(request);

    expect(response.status).toBe(200);
    expect(response.body.subscription.cancelAtPeriodEnd).toBe(true);
  });

  it('should return 401 without auth token', async () => {
    const request: AuthRequest = {
      method: 'POST',
      path: '/cancel',
      body: {},
      headers: {},
    };

    const response = await handlers.cancelSubscription(request);

    expect(response.status).toBe(401);
  });
});

// ============================================
// RESUME SUBSCRIPTION HANDLER TESTS
// ============================================

describe('Subscription Handlers - Resume', () => {
  let handlers: ReturnType<typeof createSubscriptionHandlers>;
  let authHandlers: ReturnType<typeof createAuthHandlers>;
  let db: DatabaseAdapter;
  let token: string;

  beforeEach(async () => {
    db = createMockDatabaseAdapter();
    const authConfig = {
      jwtSecret: 'test-secret',
      jwtExpiresIn: '7d',
      verificationTokenExpiresIn: 86400000,
      passwordResetTokenExpiresIn: 3600000,
      baseUrl: 'http://localhost:3000',
    };

    authHandlers = createAuthHandlers({
      auth: authConfig,
      database: db,
      email: { async sendVerificationEmail() {}, async sendPasswordResetEmail() {} },
    });

    handlers = createSubscriptionHandlers({
      database: db,
      payment: createMockPaymentAdapter(),
      config: createTestSubscriptionConfig(),
      authConfig,
    });

    const registerResponse = await authHandlers.register({
      method: 'POST',
      path: '/register',
      body: { email: 'test@example.com', password: 'securePassword123' },
      headers: {},
    });
    token = registerResponse.body.tokens.accessToken;

    const user = await db.getUserByEmail('test@example.com');
    await db.createSubscription({
      userId: user!.id,
      planId: 'basic',
      priceId: 'price_basic_monthly',
      status: 'active',
      billingCycle: 'monthly',
      currentPeriodStart: new Date(),
      currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      cancelAtPeriodEnd: true,
      providerSubscriptionId: 'sub_123',
      providerCustomerId: 'cus_123',
    });
  });

  it('should resume subscription and return 200', async () => {
    const request: AuthRequest = {
      method: 'POST',
      path: '/resume',
      body: {},
      headers: { authorization: `Bearer ${token}` },
    };

    const response = await handlers.resumeSubscription(request);

    expect(response.status).toBe(200);
    expect(response.body.subscription.cancelAtPeriodEnd).toBe(false);
  });
});

// ============================================
// WEBHOOK HANDLER TESTS
// ============================================

describe('Subscription Handlers - Webhook', () => {
  let handlers: ReturnType<typeof createSubscriptionHandlers>;
  let db: DatabaseAdapter;

  beforeEach(async () => {
    db = createMockDatabaseAdapter();

    handlers = createSubscriptionHandlers({
      database: db,
      payment: createMockPaymentAdapter(),
      config: createTestSubscriptionConfig(),
      authConfig: {
        jwtSecret: 'test-secret',
        jwtExpiresIn: '7d',
        verificationTokenExpiresIn: 86400000,
        passwordResetTokenExpiresIn: 3600000,
        baseUrl: 'http://localhost:3000',
      },
    });

    // Create a user with provider customer ID
    const user = await db.createUser('test@example.com', 'hash');
    await db.setProviderCustomerId(user.id, 'cus_123');
  });

  it('should handle valid webhook and return 200', async () => {
    const payload = JSON.stringify({
      type: 'subscription.created',
      data: {
        subscriptionId: 'sub_new',
        customerId: 'cus_123',
        priceId: 'price_basic_monthly',
        status: 'active',
        currentPeriodStart: new Date().toISOString(),
        currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      },
    });

    const request: AuthRequest = {
      method: 'POST',
      path: '/webhook',
      body: JSON.parse(payload),
      headers: { 'x-webhook-signature': 'valid-signature' },
    };

    const response = await handlers.webhook(request, payload);

    expect(response.status).toBe(200);
  });

  it('should return 401 for invalid signature', async () => {
    const payload = JSON.stringify({
      type: 'subscription.created',
      data: {},
    });

    const request: AuthRequest = {
      method: 'POST',
      path: '/webhook',
      body: JSON.parse(payload),
      headers: { 'x-webhook-signature': 'invalid-signature' },
    };

    const response = await handlers.webhook(request, payload);

    expect(response.status).toBe(401);
  });
});

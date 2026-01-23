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
} from '@authpaddle/core';

// Import will fail until we implement - that's TDD!
import { SubscriptionService } from '../subscription-service';

// ============================================
// MOCK HELPERS
// ============================================

function createMockDatabaseAdapter(): DatabaseAdapter {
  const users = new Map<string, User & { passwordHash: string; providerCustomerId?: string }>();
  const subscriptions = new Map<string, Subscription>();
  let userIdCounter = 1;
  let subIdCounter = 1;

  return {
    async createUser(email: string, passwordHash: string): Promise<User> {
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

    async setVerificationToken() {},
    async getUserByVerificationToken() { return null; },
    async clearVerificationToken() {},
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

function createMockPaymentAdapter(providerName: string = 'mock'): PaymentAdapter & {
  checkoutCalls: unknown[];
  cancelCalls: unknown[];
} {
  const checkoutCalls: unknown[] = [];
  const cancelCalls: unknown[] = [];

  return {
    providerName,
    checkoutCalls,
    cancelCalls,

    async createCheckoutSession(params): Promise<CheckoutSession> {
      checkoutCalls.push(params);
      return {
        url: `https://${providerName}.com/checkout/session_123`,
        sessionId: 'session_123',
      };
    },

    async createCustomerPortalSession() {
      return { url: `https://${providerName}.com/portal/session_456` };
    },

    async cancelSubscription(subscriptionId: string, cancelAtPeriodEnd?: boolean) {
      cancelCalls.push({ subscriptionId, cancelAtPeriodEnd });
    },

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

function createTestConfig(): SubscriptionConfig {
  return { trialDays: 7, plans: createTestPlans() };
}

// ============================================
// CHECKOUT FLOW TESTS
// ============================================

describe('SubscriptionService - Checkout Flow', () => {
  let service: SubscriptionService;
  let db: DatabaseAdapter;
  let payment: PaymentAdapter & { checkoutCalls: unknown[] };
  let testUser: User;

  beforeEach(async () => {
    db = createMockDatabaseAdapter();
    payment = createMockPaymentAdapter('stripe');
    service = new SubscriptionService({ database: db, payment, config: createTestConfig() });
    testUser = await db.createUser('test@example.com', 'hash');
  });

  it('should create checkout session for valid price', async () => {
    const result = await service.createCheckout({
      userId: testUser.id,
      email: testUser.email,
      priceId: 'price_basic_monthly',
      successUrl: 'http://localhost/success',
      cancelUrl: 'http://localhost/cancel',
    });

    expect(result.url).toBeDefined();
    expect(result.sessionId).toBe('session_123');
    expect(payment.checkoutCalls).toHaveLength(1);
  });

  it('should throw error for invalid price ID', async () => {
    await expect(
      service.createCheckout({
        userId: testUser.id,
        email: testUser.email,
        priceId: 'invalid_price',
        successUrl: 'http://localhost/success',
        cancelUrl: 'http://localhost/cancel',
      })
    ).rejects.toThrow();
  });

  it('should block checkout for user with active subscription', async () => {
    await db.createSubscription({
      userId: testUser.id,
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

    await expect(
      service.createCheckout({
        userId: testUser.id,
        email: testUser.email,
        priceId: 'price_plus_monthly',
        successUrl: 'http://localhost/success',
        cancelUrl: 'http://localhost/cancel',
      })
    ).rejects.toThrow();
  });

  it('should allow checkout for user with trial subscription', async () => {
    await db.createSubscription({
      userId: testUser.id,
      planId: 'basic',
      priceId: 'price_basic_monthly',
      status: 'trialing',
      billingCycle: 'monthly',
      currentPeriodStart: new Date(),
      currentPeriodEnd: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      cancelAtPeriodEnd: false,
      trialEndDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      providerSubscriptionId: '',
      providerCustomerId: '',
    });

    const result = await service.createCheckout({
      userId: testUser.id,
      email: testUser.email,
      priceId: 'price_plus_monthly',
      successUrl: 'http://localhost/success',
      cancelUrl: 'http://localhost/cancel',
    });

    expect(result.url).toBeDefined();
  });
});

// ============================================
// SUBSCRIPTION MANAGEMENT TESTS
// ============================================

describe('SubscriptionService - Management', () => {
  let service: SubscriptionService;
  let db: DatabaseAdapter;
  let payment: PaymentAdapter & { cancelCalls: unknown[] };
  let testUser: User;

  beforeEach(async () => {
    db = createMockDatabaseAdapter();
    payment = createMockPaymentAdapter('stripe');
    service = new SubscriptionService({ database: db, payment, config: createTestConfig() });
    testUser = await db.createUser('test@example.com', 'hash');

    await db.createSubscription({
      userId: testUser.id,
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

  it('should get subscription by user ID', async () => {
    const subscription = await service.getSubscription(testUser.id);
    expect(subscription).toBeDefined();
    expect(subscription!.userId).toBe(testUser.id);
  });

  it('should cancel subscription at period end', async () => {
    await service.cancelSubscription(testUser.id);

    expect(payment.cancelCalls).toHaveLength(1);
    const updated = await service.getSubscription(testUser.id);
    expect(updated!.cancelAtPeriodEnd).toBe(true);
  });

  it('should check if subscription is valid', async () => {
    expect(await service.isSubscriptionValid(testUser.id)).toBe(true);
  });

  it('should return invalid for expired subscription', async () => {
    const sub = await service.getSubscription(testUser.id);
    await db.updateSubscription(sub!.id, {
      currentPeriodEnd: new Date(Date.now() - 1000),
      status: 'canceled',
    });

    expect(await service.isSubscriptionValid(testUser.id)).toBe(false);
  });
});

// ============================================
// WEBHOOK HANDLING TESTS
// ============================================

describe('SubscriptionService - Webhooks', () => {
  let service: SubscriptionService;
  let db: DatabaseAdapter;
  let payment: PaymentAdapter;
  let testUser: User;

  beforeEach(async () => {
    db = createMockDatabaseAdapter();
    payment = createMockPaymentAdapter('stripe');
    service = new SubscriptionService({ database: db, payment, config: createTestConfig() });
    testUser = await db.createUser('test@example.com', 'hash');
    await db.setProviderCustomerId(testUser.id, 'cus_123');
  });

  it('should verify valid webhook signature', () => {
    expect(service.verifyWebhook('payload', 'valid-signature')).toBe(true);
  });

  it('should reject invalid webhook signature', () => {
    expect(service.verifyWebhook('payload', 'invalid')).toBe(false);
  });

  it('should handle subscription.created webhook', async () => {
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

    await service.handleWebhook(payload, 'valid-signature');

    const subscription = await service.getSubscription(testUser.id);
    expect(subscription).toBeDefined();
    expect(subscription!.providerSubscriptionId).toBe('sub_new');
  });

  it('should handle subscription.canceled webhook', async () => {
    await db.createSubscription({
      userId: testUser.id,
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

    const payload = JSON.stringify({
      type: 'subscription.canceled',
      data: { subscriptionId: 'sub_123', status: 'canceled' },
    });

    await service.handleWebhook(payload, 'valid-signature');

    const subscription = await service.getSubscription(testUser.id);
    expect(subscription!.status).toBe('canceled');
  });

  it('should throw error for invalid signature', async () => {
    await expect(
      service.handleWebhook('{}', 'invalid')
    ).rejects.toThrow();
  });
});

// ============================================
// TRIAL TESTS
// ============================================

describe('SubscriptionService - Trials', () => {
  let service: SubscriptionService;
  let db: DatabaseAdapter;
  let testUser: User;

  beforeEach(async () => {
    db = createMockDatabaseAdapter();
    service = new SubscriptionService({
      database: db,
      payment: createMockPaymentAdapter('stripe'),
      config: createTestConfig(),
    });
    testUser = await db.createUser('test@example.com', 'hash');
  });

  it('should create trial subscription', async () => {
    const subscription = await service.createTrialSubscription(testUser.id, 'basic');

    expect(subscription.status).toBe('trialing');
    expect(subscription.trialEndDate).toBeDefined();
  });

  it('should set correct trial duration', async () => {
    const subscription = await service.createTrialSubscription(testUser.id, 'basic');
    const expectedEnd = Date.now() + 7 * 24 * 60 * 60 * 1000;

    expect(Math.abs(subscription.trialEndDate!.getTime() - expectedEnd)).toBeLessThan(1000);
  });

  it('should not create trial if user has subscription', async () => {
    await service.createTrialSubscription(testUser.id, 'basic');

    await expect(
      service.createTrialSubscription(testUser.id, 'plus')
    ).rejects.toThrow();
  });
});

// ============================================
// MULTI-PROVIDER TESTS
// ============================================

describe('SubscriptionService - Multi-Provider', () => {
  let db: DatabaseAdapter;

  beforeEach(() => {
    db = createMockDatabaseAdapter();
  });

  it('should work with Stripe', async () => {
    const service = new SubscriptionService({
      database: db,
      payment: createMockPaymentAdapter('stripe'),
      config: createTestConfig(),
    });

    const user = await db.createUser('test@example.com', 'hash');
    const checkout = await service.createCheckout({
      userId: user.id,
      email: user.email,
      priceId: 'price_basic_monthly',
      successUrl: 'http://localhost/success',
      cancelUrl: 'http://localhost/cancel',
    });

    expect(checkout.url).toContain('stripe.com');
    expect(service.providerName).toBe('stripe');
  });

  it('should work with Paddle', async () => {
    const service = new SubscriptionService({
      database: db,
      payment: createMockPaymentAdapter('paddle'),
      config: createTestConfig(),
    });

    const user = await db.createUser('test@example.com', 'hash');
    const checkout = await service.createCheckout({
      userId: user.id,
      email: user.email,
      priceId: 'price_basic_monthly',
      successUrl: 'http://localhost/success',
      cancelUrl: 'http://localhost/cancel',
    });

    expect(checkout.url).toContain('paddle.com');
    expect(service.providerName).toBe('paddle');
  });

  it('should work with LemonSqueezy', async () => {
    const service = new SubscriptionService({
      database: db,
      payment: createMockPaymentAdapter('lemonsqueezy'),
      config: createTestConfig(),
    });

    const user = await db.createUser('test@example.com', 'hash');
    const checkout = await service.createCheckout({
      userId: user.id,
      email: user.email,
      priceId: 'price_basic_monthly',
      successUrl: 'http://localhost/success',
      cancelUrl: 'http://localhost/cancel',
    });

    expect(checkout.url).toContain('lemonsqueezy.com');
    expect(service.providerName).toBe('lemonsqueezy');
  });
});

// ============================================
// PLANS TESTS
// ============================================

describe('SubscriptionService - Plans', () => {
  let service: SubscriptionService;

  beforeEach(() => {
    service = new SubscriptionService({
      database: createMockDatabaseAdapter(),
      payment: createMockPaymentAdapter('stripe'),
      config: createTestConfig(),
    });
  });

  it('should return all plans', () => {
    const plans = service.getPlans();
    expect(plans).toHaveLength(2);
  });

  it('should get plan by ID', () => {
    const plan = service.getPlan('basic');
    expect(plan).toBeDefined();
    expect(plan!.name).toBe('Basic');
  });

  it('should validate price ID', () => {
    expect(service.isPriceValid('price_basic_monthly')).toBe(true);
    expect(service.isPriceValid('invalid')).toBe(false);
  });

  it('should get plan from price ID', () => {
    const plan = service.getPlanFromPriceId('price_plus_annual');
    expect(plan!.id).toBe('plus');
  });
});

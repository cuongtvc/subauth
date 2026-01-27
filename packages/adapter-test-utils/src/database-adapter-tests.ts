import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import type { DatabaseAdapter } from '@subauth/core';

/**
 * Options for creating shared database adapter tests.
 */
export interface DatabaseAdapterTestOptions {
  /**
   * Name of the adapter (used in test descriptions).
   */
  name: string;

  /**
   * Factory function that returns the adapter instance to test.
   */
  createAdapter: () => DatabaseAdapter;

  /**
   * Function to reset database state between tests.
   * Should delete all data from tables in the correct order (transactions, subscriptions, users).
   */
  cleanup: () => Promise<void>;

  /**
   * Function to close connections after all tests.
   */
  teardown: () => Promise<void>;

  /**
   * Optional setup function to run before all tests.
   * Use this to create tables or perform other initialization.
   */
  setup?: () => Promise<void>;
}

/**
 * Creates a shared test suite for DatabaseAdapter implementations.
 * These tests verify the behavioral contract of the DatabaseAdapter interface.
 *
 * Usage:
 * ```typescript
 * createDatabaseAdapterTests({
 *   name: 'PostgreSQL',
 *   createAdapter: () => adapter,
 *   cleanup: async () => { await pool.query('DELETE FROM users'); },
 *   teardown: async () => { await adapter.close(); },
 * });
 * ```
 */
export function createDatabaseAdapterTests(options: DatabaseAdapterTestOptions): void {
  const { name, createAdapter, cleanup, teardown, setup } = options;

  describe(`${name} Adapter - DatabaseAdapter Contract`, () => {
    let adapter: DatabaseAdapter;

    beforeAll(async () => {
      if (setup) {
        await setup();
      }
      adapter = createAdapter();
    });

    afterAll(async () => {
      await teardown();
    });

    beforeEach(async () => {
      await cleanup();
    });

    // ============================================
    // USER OPERATIONS
    // ============================================

    describe('User Operations', () => {
      it('should create and retrieve a user', async () => {
        const user = await adapter.createUser('test@example.com', 'hashed_password');

        expect(user.email).toBe('test@example.com');
        expect(user.emailVerified).toBe(false);
        expect(user.id).toBeDefined();

        const retrieved = await adapter.getUserById(user.id);
        expect(retrieved).toEqual(user);
      });

      it('should find user by email', async () => {
        const user = await adapter.createUser('find@example.com', 'hashed');

        const found = await adapter.getUserByEmail('find@example.com');
        expect(found?.id).toBe(user.id);
      });

      it('should update user', async () => {
        const user = await adapter.createUser('update@example.com', 'hashed');

        const updated = await adapter.updateUser(user.id, { emailVerified: true });
        expect(updated.emailVerified).toBe(true);
      });

      it('should return null for non-existent user', async () => {
        const user = await adapter.getUserById('99999');
        expect(user).toBeNull();
      });
    });

    // ============================================
    // PASSWORD OPERATIONS
    // ============================================

    describe('Password Operations', () => {
      it('should get and set password hash', async () => {
        const user = await adapter.createUser('pass@example.com', 'initial_hash');

        const hash = await adapter.getPasswordHash(user.id);
        expect(hash).toBe('initial_hash');

        await adapter.setPasswordHash(user.id, 'new_hash');

        const newHash = await adapter.getPasswordHash(user.id);
        expect(newHash).toBe('new_hash');
      });
    });

    // ============================================
    // VERIFICATION TOKEN OPERATIONS
    // ============================================

    describe('Verification Token Operations', () => {
      it('should set and retrieve user by verification token', async () => {
        const user = await adapter.createUser('verify@example.com', 'hashed');
        const futureDate = new Date(Date.now() + 3600000); // 1 hour from now

        await adapter.setVerificationToken(user.id, 'verify_token', futureDate);

        const found = await adapter.getUserByVerificationToken('verify_token');
        expect(found?.id).toBe(user.id);
      });

      it('should not find user with expired token', async () => {
        const user = await adapter.createUser('expired@example.com', 'hashed');
        // Use 7 days ago to avoid any clock skew issues with Docker containers
        const pastDate = new Date(Date.now() - 7 * 24 * 3600000);

        await adapter.setVerificationToken(user.id, 'expired_token', pastDate);

        const found = await adapter.getUserByVerificationToken('expired_token');
        expect(found).toBeNull();
      });

      it('should clear verification token', async () => {
        const user = await adapter.createUser('clear@example.com', 'hashed');
        const futureDate = new Date(Date.now() + 3600000);

        await adapter.setVerificationToken(user.id, 'clear_token', futureDate);
        await adapter.clearVerificationToken(user.id);

        const found = await adapter.getUserByVerificationToken('clear_token');
        expect(found).toBeNull();
      });
    });

    // ============================================
    // PASSWORD RESET TOKEN OPERATIONS
    // ============================================

    describe('Password Reset Token Operations', () => {
      it('should set and retrieve user by password reset token', async () => {
        const user = await adapter.createUser('reset@example.com', 'hashed');
        const futureDate = new Date(Date.now() + 3600000);

        await adapter.setPasswordResetToken(user.id, 'reset_token', futureDate);

        const found = await adapter.getUserByPasswordResetToken('reset_token');
        expect(found?.id).toBe(user.id);
      });

      it('should clear password reset token', async () => {
        const user = await adapter.createUser('clearreset@example.com', 'hashed');
        const futureDate = new Date(Date.now() + 3600000);

        await adapter.setPasswordResetToken(user.id, 'clear_reset', futureDate);
        await adapter.clearPasswordResetToken(user.id);

        const found = await adapter.getUserByPasswordResetToken('clear_reset');
        expect(found).toBeNull();
      });
    });

    // ============================================
    // SUBSCRIPTION OPERATIONS
    // ============================================

    describe('Subscription Operations', () => {
      it('should create and retrieve subscription', async () => {
        const user = await adapter.createUser('sub@example.com', 'hashed');

        const subscription = await adapter.createSubscription({
          userId: user.id,
          planId: 'plan_basic',
          priceId: 'price_monthly',
          status: 'active',
          billingCycle: 'monthly',
          currentPeriodStart: new Date('2024-01-01'),
          currentPeriodEnd: new Date('2024-02-01'),
          cancelAtPeriodEnd: false,
          providerSubscriptionId: 'sub_123',
          providerCustomerId: 'cus_123',
        });

        expect(subscription.planId).toBe('plan_basic');
        expect(subscription.status).toBe('active');

        const found = await adapter.getSubscriptionByUserId(user.id);
        expect(found?.id).toBe(subscription.id);
      });

      it('should find subscription by provider ID', async () => {
        const user = await adapter.createUser('subprov@example.com', 'hashed');

        const subscription = await adapter.createSubscription({
          userId: user.id,
          planId: 'plan_plus',
          priceId: 'price_annual',
          status: 'trialing',
          billingCycle: 'annual',
          currentPeriodStart: new Date('2024-01-01'),
          currentPeriodEnd: new Date('2025-01-01'),
          cancelAtPeriodEnd: false,
          providerSubscriptionId: 'sub_provider_456',
          providerCustomerId: 'cus_456',
        });

        const found = await adapter.getSubscriptionByProviderId('sub_provider_456');
        expect(found?.id).toBe(subscription.id);
      });

      it('should update subscription', async () => {
        const user = await adapter.createUser('subup@example.com', 'hashed');

        const subscription = await adapter.createSubscription({
          userId: user.id,
          planId: 'plan_basic',
          priceId: 'price_monthly',
          status: 'active',
          billingCycle: 'monthly',
          currentPeriodStart: new Date('2024-01-01'),
          currentPeriodEnd: new Date('2024-02-01'),
          cancelAtPeriodEnd: false,
          providerSubscriptionId: 'sub_update',
          providerCustomerId: 'cus_update',
        });

        const updated = await adapter.updateSubscription(subscription.id, {
          status: 'canceled',
          cancelAtPeriodEnd: true,
        });

        expect(updated.status).toBe('canceled');
        expect(updated.cancelAtPeriodEnd).toBe(true);
      });
    });

    // ============================================
    // TRANSACTION OPERATIONS
    // ============================================

    describe('Transaction Operations', () => {
      it('should create and retrieve transaction', async () => {
        const user = await adapter.createUser('txn@example.com', 'hashed');

        const transaction = await adapter.createTransaction({
          userId: user.id,
          amount: 1999,
          currency: 'USD',
          status: 'completed',
          providerTransactionId: 'txn_123',
        });

        expect(transaction.amount).toBe(1999);
        expect(transaction.status).toBe('completed');

        const found = await adapter.getTransactionByProviderId('txn_123');
        expect(found?.id).toBe(transaction.id);
      });
    });

    // ============================================
    // PROVIDER CUSTOMER ID OPERATIONS
    // ============================================

    describe('Provider Customer ID Operations', () => {
      it('should set and get user by provider customer ID', async () => {
        const user = await adapter.createUser('cust@example.com', 'hashed');

        await adapter.setProviderCustomerId(user.id, 'cus_paddle_789');

        const found = await adapter.getUserByProviderCustomerId('cus_paddle_789');
        expect(found?.id).toBe(user.id);
      });
    });
  });
}

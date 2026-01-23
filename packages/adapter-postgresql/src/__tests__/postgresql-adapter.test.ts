import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { PostgreSQLAdapter } from '../index';
import type { Pool, PoolClient, QueryResult } from 'pg';
import type { User, Subscription, Transaction } from '@subauth/core';

// Mock pg module
vi.mock('pg', () => {
  const mockQuery = vi.fn();
  const mockRelease = vi.fn();
  const mockConnect = vi.fn();
  const mockEnd = vi.fn();

  return {
    Pool: vi.fn(() => ({
      query: mockQuery,
      connect: mockConnect,
      end: mockEnd,
    })),
  };
});

describe('PostgreSQLAdapter', () => {
  let adapter: PostgreSQLAdapter;
  let mockPool: {
    query: ReturnType<typeof vi.fn>;
    connect: ReturnType<typeof vi.fn>;
    end: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    vi.clearAllMocks();

    // Create adapter with test config
    adapter = new PostgreSQLAdapter({
      host: 'localhost',
      port: 5432,
      database: 'test_db',
      user: 'test_user',
      password: 'test_pass',
    });

    // Get mock pool reference
    mockPool = (adapter as any).pool;
  });

  afterEach(async () => {
    await adapter.close();
  });

  // ============================================
  // USER OPERATIONS
  // ============================================

  describe('User Operations', () => {
    describe('createUser', () => {
      it('should create a user and return user object', async () => {
        const mockUser: User = {
          id: '1',
          email: 'test@example.com',
          emailVerified: false,
          createdAt: new Date('2024-01-01'),
        };

        mockPool.query.mockResolvedValueOnce({
          rows: [{
            id: '1',
            email: 'test@example.com',
            email_verified: false,
            created_at: new Date('2024-01-01'),
          }],
        });

        const result = await adapter.createUser('test@example.com', 'hashed_password');

        expect(mockPool.query).toHaveBeenCalledWith(
          expect.stringContaining('INSERT INTO users'),
          ['test@example.com', 'hashed_password']
        );
        expect(result).toEqual(mockUser);
      });

      it('should throw error if user creation fails', async () => {
        mockPool.query.mockRejectedValueOnce(new Error('Duplicate email'));

        await expect(adapter.createUser('test@example.com', 'hashed'))
          .rejects.toThrow('Duplicate email');
      });
    });

    describe('getUserById', () => {
      it('should return user when found', async () => {
        mockPool.query.mockResolvedValueOnce({
          rows: [{
            id: '1',
            email: 'test@example.com',
            email_verified: true,
            created_at: new Date('2024-01-01'),
          }],
        });

        const result = await adapter.getUserById('1');

        expect(mockPool.query).toHaveBeenCalledWith(
          expect.stringContaining('SELECT'),
          ['1']
        );
        expect(result?.id).toBe('1');
        expect(result?.emailVerified).toBe(true);
      });

      it('should return null when user not found', async () => {
        mockPool.query.mockResolvedValueOnce({ rows: [] });

        const result = await adapter.getUserById('999');

        expect(result).toBeNull();
      });
    });

    describe('getUserByEmail', () => {
      it('should return user when found by email', async () => {
        mockPool.query.mockResolvedValueOnce({
          rows: [{
            id: '1',
            email: 'test@example.com',
            email_verified: false,
            created_at: new Date('2024-01-01'),
          }],
        });

        const result = await adapter.getUserByEmail('test@example.com');

        expect(mockPool.query).toHaveBeenCalledWith(
          expect.stringContaining('email'),
          ['test@example.com']
        );
        expect(result?.email).toBe('test@example.com');
      });

      it('should return null when email not found', async () => {
        mockPool.query.mockResolvedValueOnce({ rows: [] });

        const result = await adapter.getUserByEmail('notfound@example.com');

        expect(result).toBeNull();
      });
    });

    describe('updateUser', () => {
      it('should update user fields and return updated user', async () => {
        mockPool.query.mockResolvedValueOnce({
          rows: [{
            id: '1',
            email: 'updated@example.com',
            email_verified: true,
            created_at: new Date('2024-01-01'),
          }],
        });

        const result = await adapter.updateUser('1', {
          email: 'updated@example.com',
          emailVerified: true,
        });

        expect(mockPool.query).toHaveBeenCalledWith(
          expect.stringContaining('UPDATE users'),
          expect.arrayContaining(['1'])
        );
        expect(result.email).toBe('updated@example.com');
        expect(result.emailVerified).toBe(true);
      });

      it('should throw error if user not found', async () => {
        mockPool.query.mockResolvedValueOnce({ rows: [] });

        await expect(adapter.updateUser('999', { emailVerified: true }))
          .rejects.toThrow('User not found');
      });
    });
  });

  // ============================================
  // PASSWORD OPERATIONS
  // ============================================

  describe('Password Operations', () => {
    describe('getPasswordHash', () => {
      it('should return password hash for user', async () => {
        mockPool.query.mockResolvedValueOnce({
          rows: [{ password_hash: 'hashed_password_123' }],
        });

        const result = await adapter.getPasswordHash('1');

        expect(mockPool.query).toHaveBeenCalledWith(
          expect.stringContaining('password_hash'),
          ['1']
        );
        expect(result).toBe('hashed_password_123');
      });

      it('should return null if user not found', async () => {
        mockPool.query.mockResolvedValueOnce({ rows: [] });

        const result = await adapter.getPasswordHash('999');

        expect(result).toBeNull();
      });
    });

    describe('setPasswordHash', () => {
      it('should update password hash for user', async () => {
        mockPool.query.mockResolvedValueOnce({ rows: [] });

        await adapter.setPasswordHash('1', 'new_hashed_password');

        expect(mockPool.query).toHaveBeenCalledWith(
          expect.stringContaining('UPDATE users'),
          expect.arrayContaining(['1', 'new_hashed_password'])
        );
      });
    });
  });

  // ============================================
  // VERIFICATION TOKEN OPERATIONS
  // ============================================

  describe('Verification Token Operations', () => {
    describe('setVerificationToken', () => {
      it('should set verification token for user', async () => {
        const expiresAt = new Date('2024-01-02');
        mockPool.query.mockResolvedValueOnce({ rows: [] });

        await adapter.setVerificationToken('1', 'verify_token_123', expiresAt);

        expect(mockPool.query).toHaveBeenCalledWith(
          expect.stringContaining('verification_token'),
          expect.arrayContaining(['1', 'verify_token_123', expiresAt])
        );
      });
    });

    describe('getUserByVerificationToken', () => {
      it('should return user when token is valid and not expired', async () => {
        mockPool.query.mockResolvedValueOnce({
          rows: [{
            id: '1',
            email: 'test@example.com',
            email_verified: false,
            created_at: new Date('2024-01-01'),
          }],
        });

        const result = await adapter.getUserByVerificationToken('verify_token_123');

        expect(mockPool.query).toHaveBeenCalledWith(
          expect.stringContaining('verification_token'),
          ['verify_token_123']
        );
        expect(result?.id).toBe('1');
      });

      it('should return null when token not found or expired', async () => {
        mockPool.query.mockResolvedValueOnce({ rows: [] });

        const result = await adapter.getUserByVerificationToken('expired_token');

        expect(result).toBeNull();
      });
    });

    describe('clearVerificationToken', () => {
      it('should clear verification token for user', async () => {
        mockPool.query.mockResolvedValueOnce({ rows: [] });

        await adapter.clearVerificationToken('1');

        expect(mockPool.query).toHaveBeenCalledWith(
          expect.stringContaining('UPDATE users'),
          expect.arrayContaining(['1'])
        );
      });
    });
  });

  // ============================================
  // PASSWORD RESET TOKEN OPERATIONS
  // ============================================

  describe('Password Reset Token Operations', () => {
    describe('setPasswordResetToken', () => {
      it('should set password reset token for user', async () => {
        const expiresAt = new Date('2024-01-02');
        mockPool.query.mockResolvedValueOnce({ rows: [] });

        await adapter.setPasswordResetToken('1', 'reset_token_123', expiresAt);

        expect(mockPool.query).toHaveBeenCalledWith(
          expect.stringContaining('password_reset_token'),
          expect.arrayContaining(['1', 'reset_token_123', expiresAt])
        );
      });
    });

    describe('getUserByPasswordResetToken', () => {
      it('should return user when reset token is valid and not expired', async () => {
        mockPool.query.mockResolvedValueOnce({
          rows: [{
            id: '1',
            email: 'test@example.com',
            email_verified: true,
            created_at: new Date('2024-01-01'),
          }],
        });

        const result = await adapter.getUserByPasswordResetToken('reset_token_123');

        expect(mockPool.query).toHaveBeenCalledWith(
          expect.stringContaining('password_reset_token'),
          ['reset_token_123']
        );
        expect(result?.id).toBe('1');
      });

      it('should return null when reset token not found or expired', async () => {
        mockPool.query.mockResolvedValueOnce({ rows: [] });

        const result = await adapter.getUserByPasswordResetToken('expired_token');

        expect(result).toBeNull();
      });
    });

    describe('clearPasswordResetToken', () => {
      it('should clear password reset token for user', async () => {
        mockPool.query.mockResolvedValueOnce({ rows: [] });

        await adapter.clearPasswordResetToken('1');

        expect(mockPool.query).toHaveBeenCalledWith(
          expect.stringContaining('UPDATE users'),
          expect.arrayContaining(['1'])
        );
      });
    });
  });

  // ============================================
  // SUBSCRIPTION OPERATIONS
  // ============================================

  describe('Subscription Operations', () => {
    const mockSubscriptionInput = {
      userId: '1',
      planId: 'plan_basic',
      priceId: 'price_monthly',
      status: 'active' as const,
      billingCycle: 'monthly' as const,
      currentPeriodStart: new Date('2024-01-01'),
      currentPeriodEnd: new Date('2024-02-01'),
      cancelAtPeriodEnd: false,
      providerSubscriptionId: 'sub_123',
      providerCustomerId: 'cus_123',
    };

    describe('createSubscription', () => {
      it('should create subscription and return full subscription object', async () => {
        mockPool.query.mockResolvedValueOnce({
          rows: [{
            id: '1',
            user_id: '1',
            plan_id: 'plan_basic',
            price_id: 'price_monthly',
            status: 'active',
            billing_cycle: 'monthly',
            current_period_start: new Date('2024-01-01'),
            current_period_end: new Date('2024-02-01'),
            cancel_at_period_end: false,
            trial_end_date: null,
            provider_subscription_id: 'sub_123',
            provider_customer_id: 'cus_123',
            created_at: new Date('2024-01-01'),
            updated_at: new Date('2024-01-01'),
          }],
        });

        const result = await adapter.createSubscription(mockSubscriptionInput);

        expect(mockPool.query).toHaveBeenCalledWith(
          expect.stringContaining('INSERT INTO subscriptions'),
          expect.any(Array)
        );
        expect(result.id).toBe('1');
        expect(result.status).toBe('active');
        expect(result.providerSubscriptionId).toBe('sub_123');
      });
    });

    describe('getSubscriptionByUserId', () => {
      it('should return subscription for user', async () => {
        mockPool.query.mockResolvedValueOnce({
          rows: [{
            id: '1',
            user_id: '1',
            plan_id: 'plan_basic',
            price_id: 'price_monthly',
            status: 'active',
            billing_cycle: 'monthly',
            current_period_start: new Date('2024-01-01'),
            current_period_end: new Date('2024-02-01'),
            cancel_at_period_end: false,
            trial_end_date: null,
            provider_subscription_id: 'sub_123',
            provider_customer_id: 'cus_123',
            created_at: new Date('2024-01-01'),
            updated_at: new Date('2024-01-01'),
          }],
        });

        const result = await adapter.getSubscriptionByUserId('1');

        expect(mockPool.query).toHaveBeenCalledWith(
          expect.stringContaining('user_id'),
          ['1']
        );
        expect(result?.userId).toBe('1');
      });

      it('should return null if user has no subscription', async () => {
        mockPool.query.mockResolvedValueOnce({ rows: [] });

        const result = await adapter.getSubscriptionByUserId('999');

        expect(result).toBeNull();
      });
    });

    describe('getSubscriptionByProviderId', () => {
      it('should return subscription by provider subscription ID', async () => {
        mockPool.query.mockResolvedValueOnce({
          rows: [{
            id: '1',
            user_id: '1',
            plan_id: 'plan_basic',
            price_id: 'price_monthly',
            status: 'active',
            billing_cycle: 'monthly',
            current_period_start: new Date('2024-01-01'),
            current_period_end: new Date('2024-02-01'),
            cancel_at_period_end: false,
            trial_end_date: null,
            provider_subscription_id: 'sub_123',
            provider_customer_id: 'cus_123',
            created_at: new Date('2024-01-01'),
            updated_at: new Date('2024-01-01'),
          }],
        });

        const result = await adapter.getSubscriptionByProviderId('sub_123');

        expect(mockPool.query).toHaveBeenCalledWith(
          expect.stringContaining('provider_subscription_id'),
          ['sub_123']
        );
        expect(result?.providerSubscriptionId).toBe('sub_123');
      });

      it('should return null if provider subscription not found', async () => {
        mockPool.query.mockResolvedValueOnce({ rows: [] });

        const result = await adapter.getSubscriptionByProviderId('sub_unknown');

        expect(result).toBeNull();
      });
    });

    describe('updateSubscription', () => {
      it('should update subscription and return updated object', async () => {
        mockPool.query.mockResolvedValueOnce({
          rows: [{
            id: '1',
            user_id: '1',
            plan_id: 'plan_basic',
            price_id: 'price_monthly',
            status: 'canceled',
            billing_cycle: 'monthly',
            current_period_start: new Date('2024-01-01'),
            current_period_end: new Date('2024-02-01'),
            cancel_at_period_end: true,
            trial_end_date: null,
            provider_subscription_id: 'sub_123',
            provider_customer_id: 'cus_123',
            created_at: new Date('2024-01-01'),
            updated_at: new Date('2024-01-15'),
          }],
        });

        const result = await adapter.updateSubscription('1', {
          status: 'canceled',
          cancelAtPeriodEnd: true,
        });

        expect(mockPool.query).toHaveBeenCalledWith(
          expect.stringContaining('UPDATE subscriptions'),
          expect.arrayContaining(['1'])
        );
        expect(result.status).toBe('canceled');
        expect(result.cancelAtPeriodEnd).toBe(true);
      });

      it('should throw error if subscription not found', async () => {
        mockPool.query.mockResolvedValueOnce({ rows: [] });

        await expect(adapter.updateSubscription('999', { status: 'canceled' }))
          .rejects.toThrow('Subscription not found');
      });
    });
  });

  // ============================================
  // TRANSACTION OPERATIONS
  // ============================================

  describe('Transaction Operations', () => {
    describe('createTransaction', () => {
      it('should create transaction and return transaction object', async () => {
        mockPool.query.mockResolvedValueOnce({
          rows: [{
            id: '1',
            user_id: '1',
            subscription_id: 'sub_1',
            amount: 1999,
            currency: 'USD',
            status: 'completed',
            provider_transaction_id: 'txn_123',
            created_at: new Date('2024-01-01'),
          }],
        });

        const result = await adapter.createTransaction({
          userId: '1',
          subscriptionId: 'sub_1',
          amount: 1999,
          currency: 'USD',
          status: 'completed',
          providerTransactionId: 'txn_123',
        });

        expect(mockPool.query).toHaveBeenCalledWith(
          expect.stringContaining('INSERT INTO transactions'),
          expect.any(Array)
        );
        expect(result.id).toBe('1');
        expect(result.amount).toBe(1999);
        expect(result.providerTransactionId).toBe('txn_123');
      });
    });

    describe('getTransactionByProviderId', () => {
      it('should return transaction by provider transaction ID', async () => {
        mockPool.query.mockResolvedValueOnce({
          rows: [{
            id: '1',
            user_id: '1',
            subscription_id: 'sub_1',
            amount: 1999,
            currency: 'USD',
            status: 'completed',
            provider_transaction_id: 'txn_123',
            created_at: new Date('2024-01-01'),
          }],
        });

        const result = await adapter.getTransactionByProviderId('txn_123');

        expect(mockPool.query).toHaveBeenCalledWith(
          expect.stringContaining('provider_transaction_id'),
          ['txn_123']
        );
        expect(result?.providerTransactionId).toBe('txn_123');
      });

      it('should return null if transaction not found', async () => {
        mockPool.query.mockResolvedValueOnce({ rows: [] });

        const result = await adapter.getTransactionByProviderId('txn_unknown');

        expect(result).toBeNull();
      });
    });
  });

  // ============================================
  // PROVIDER CUSTOMER ID OPERATIONS
  // ============================================

  describe('Provider Customer ID Operations', () => {
    describe('setProviderCustomerId', () => {
      it('should set provider customer ID for user', async () => {
        mockPool.query.mockResolvedValueOnce({ rows: [] });

        await adapter.setProviderCustomerId('1', 'cus_abc123');

        expect(mockPool.query).toHaveBeenCalledWith(
          expect.stringContaining('UPDATE users'),
          expect.arrayContaining(['1', 'cus_abc123'])
        );
      });
    });

    describe('getUserByProviderCustomerId', () => {
      it('should return user by provider customer ID', async () => {
        mockPool.query.mockResolvedValueOnce({
          rows: [{
            id: '1',
            email: 'test@example.com',
            email_verified: true,
            created_at: new Date('2024-01-01'),
          }],
        });

        const result = await adapter.getUserByProviderCustomerId('cus_abc123');

        expect(mockPool.query).toHaveBeenCalledWith(
          expect.stringContaining('provider_customer_id'),
          ['cus_abc123']
        );
        expect(result?.id).toBe('1');
      });

      it('should return null if provider customer ID not found', async () => {
        mockPool.query.mockResolvedValueOnce({ rows: [] });

        const result = await adapter.getUserByProviderCustomerId('cus_unknown');

        expect(result).toBeNull();
      });
    });
  });

  // ============================================
  // CONNECTION MANAGEMENT
  // ============================================

  describe('Connection Management', () => {
    describe('close', () => {
      it('should close the pool connection', async () => {
        await adapter.close();

        expect(mockPool.end).toHaveBeenCalled();
      });
    });
  });
});

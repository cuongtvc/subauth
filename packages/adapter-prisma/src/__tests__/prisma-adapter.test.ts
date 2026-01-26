import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PrismaAdapter, type PrismaAdapterConfig } from '../index';
import type { User, Subscription, Transaction } from '@subauth/core';

/**
 * Mock types that simulate Prisma's generated client types.
 * The adapter should work with any Prisma schema that provides these model operations.
 */
interface MockUserModel {
  create: ReturnType<typeof vi.fn>;
  findUnique: ReturnType<typeof vi.fn>;
  findFirst: ReturnType<typeof vi.fn>;
  update: ReturnType<typeof vi.fn>;
}

interface MockSubscriptionModel {
  create: ReturnType<typeof vi.fn>;
  findUnique: ReturnType<typeof vi.fn>;
  findFirst: ReturnType<typeof vi.fn>;
  update: ReturnType<typeof vi.fn>;
}

interface MockTransactionModel {
  create: ReturnType<typeof vi.fn>;
  findUnique: ReturnType<typeof vi.fn>;
  findFirst: ReturnType<typeof vi.fn>;
}

interface MockVerificationTokenModel {
  create: ReturnType<typeof vi.fn>;
  findUnique: ReturnType<typeof vi.fn>;
  delete: ReturnType<typeof vi.fn>;
  deleteMany: ReturnType<typeof vi.fn>;
}

interface MockPasswordResetTokenModel {
  create: ReturnType<typeof vi.fn>;
  findUnique: ReturnType<typeof vi.fn>;
  delete: ReturnType<typeof vi.fn>;
  deleteMany: ReturnType<typeof vi.fn>;
}

function createMockModels() {
  return {
    user: {
      create: vi.fn(),
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      update: vi.fn(),
    } as MockUserModel,
    subscription: {
      create: vi.fn(),
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      update: vi.fn(),
    } as MockSubscriptionModel,
    transaction: {
      create: vi.fn(),
      findUnique: vi.fn(),
      findFirst: vi.fn(),
    } as MockTransactionModel,
    verificationToken: {
      create: vi.fn(),
      findUnique: vi.fn(),
      delete: vi.fn(),
      deleteMany: vi.fn(),
    } as MockVerificationTokenModel,
    passwordResetToken: {
      create: vi.fn(),
      findUnique: vi.fn(),
      delete: vi.fn(),
      deleteMany: vi.fn(),
    } as MockPasswordResetTokenModel,
  };
}

describe('PrismaAdapter', () => {
  let adapter: PrismaAdapter;
  let mockModels: ReturnType<typeof createMockModels>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockModels = createMockModels();

    const config: PrismaAdapterConfig = {
      models: mockModels,
      fieldMappings: {
        user: {
          id: 'id',
          email: 'email',
          emailVerified: 'emailVerified',
          passwordHash: 'passwordHash',
          providerCustomerId: 'providerCustomerId',
          createdAt: 'createdAt',
        },
        subscription: {
          id: 'id',
          userId: 'userId',
          planId: 'planId',
          priceId: 'priceId',
          status: 'status',
          billingCycle: 'billingCycle',
          currentPeriodStart: 'currentPeriodStart',
          currentPeriodEnd: 'currentPeriodEnd',
          cancelAtPeriodEnd: 'cancelAtPeriodEnd',
          trialEndDate: 'trialEndDate',
          providerSubscriptionId: 'providerSubscriptionId',
          providerCustomerId: 'providerCustomerId',
          createdAt: 'createdAt',
          updatedAt: 'updatedAt',
        },
      },
    };

    adapter = new PrismaAdapter(config);
  });

  // ============================================
  // USER OPERATIONS
  // ============================================

  describe('User Operations', () => {
    describe('createUser', () => {
      it('should create a user and return user object', async () => {
        const mockDbUser = {
          id: 'user_1',
          email: 'test@example.com',
          emailVerified: false,
          createdAt: new Date('2024-01-01'),
        };

        mockModels.user.create.mockResolvedValueOnce(mockDbUser);

        const result = await adapter.createUser('test@example.com', 'hashed_password');

        expect(mockModels.user.create).toHaveBeenCalledWith({
          data: {
            email: 'test@example.com',
            passwordHash: 'hashed_password',
          },
        });
        expect(result).toEqual({
          id: 'user_1',
          email: 'test@example.com',
          emailVerified: false,
          createdAt: mockDbUser.createdAt,
        });
      });

      it('should throw error if user creation fails', async () => {
        mockModels.user.create.mockRejectedValueOnce(new Error('Unique constraint failed'));

        await expect(adapter.createUser('test@example.com', 'hashed'))
          .rejects.toThrow('Unique constraint failed');
      });
    });

    describe('getUserById', () => {
      it('should return user when found', async () => {
        const mockDbUser = {
          id: 'user_1',
          email: 'test@example.com',
          emailVerified: true,
          createdAt: new Date('2024-01-01'),
        };

        mockModels.user.findUnique.mockResolvedValueOnce(mockDbUser);

        const result = await adapter.getUserById('user_1');

        expect(mockModels.user.findUnique).toHaveBeenCalledWith({
          where: { id: 'user_1' },
        });
        expect(result?.id).toBe('user_1');
        expect(result?.emailVerified).toBe(true);
      });

      it('should return null when user not found', async () => {
        mockModels.user.findUnique.mockResolvedValueOnce(null);

        const result = await adapter.getUserById('nonexistent');

        expect(result).toBeNull();
      });
    });

    describe('getUserByEmail', () => {
      it('should return user when found by email', async () => {
        const mockDbUser = {
          id: 'user_1',
          email: 'test@example.com',
          emailVerified: false,
          createdAt: new Date('2024-01-01'),
        };

        mockModels.user.findUnique.mockResolvedValueOnce(mockDbUser);

        const result = await adapter.getUserByEmail('test@example.com');

        expect(mockModels.user.findUnique).toHaveBeenCalledWith({
          where: { email: 'test@example.com' },
        });
        expect(result?.email).toBe('test@example.com');
      });

      it('should return null when email not found', async () => {
        mockModels.user.findUnique.mockResolvedValueOnce(null);

        const result = await adapter.getUserByEmail('notfound@example.com');

        expect(result).toBeNull();
      });
    });

    describe('updateUser', () => {
      it('should update user fields and return updated user', async () => {
        const mockDbUser = {
          id: 'user_1',
          email: 'test@example.com',
          emailVerified: true,
          createdAt: new Date('2024-01-01'),
        };

        mockModels.user.update.mockResolvedValueOnce(mockDbUser);

        const result = await adapter.updateUser('user_1', { emailVerified: true });

        expect(mockModels.user.update).toHaveBeenCalledWith({
          where: { id: 'user_1' },
          data: { emailVerified: true },
        });
        expect(result.emailVerified).toBe(true);
      });

      it('should throw error if user not found', async () => {
        mockModels.user.update.mockRejectedValueOnce(new Error('Record not found'));

        await expect(adapter.updateUser('nonexistent', { emailVerified: true }))
          .rejects.toThrow('Record not found');
      });
    });
  });

  // ============================================
  // PASSWORD OPERATIONS
  // ============================================

  describe('Password Operations', () => {
    describe('getPasswordHash', () => {
      it('should return password hash for user', async () => {
        mockModels.user.findUnique.mockResolvedValueOnce({
          passwordHash: 'hashed_password_123',
        });

        const result = await adapter.getPasswordHash('user_1');

        expect(mockModels.user.findUnique).toHaveBeenCalledWith({
          where: { id: 'user_1' },
          select: { passwordHash: true },
        });
        expect(result).toBe('hashed_password_123');
      });

      it('should return null if user not found', async () => {
        mockModels.user.findUnique.mockResolvedValueOnce(null);

        const result = await adapter.getPasswordHash('nonexistent');

        expect(result).toBeNull();
      });
    });

    describe('setPasswordHash', () => {
      it('should update password hash for user', async () => {
        mockModels.user.update.mockResolvedValueOnce({});

        await adapter.setPasswordHash('user_1', 'new_hashed_password');

        expect(mockModels.user.update).toHaveBeenCalledWith({
          where: { id: 'user_1' },
          data: { passwordHash: 'new_hashed_password' },
        });
      });
    });
  });

  // ============================================
  // VERIFICATION TOKEN OPERATIONS (Separate Table)
  // ============================================

  describe('Verification Token Operations', () => {
    describe('setVerificationToken', () => {
      it('should delete existing tokens and create new one', async () => {
        const expiresAt = new Date('2024-01-02');
        mockModels.verificationToken.deleteMany.mockResolvedValueOnce({ count: 1 });
        mockModels.verificationToken.create.mockResolvedValueOnce({});

        await adapter.setVerificationToken('user_1', 'verify_token_123', expiresAt);

        expect(mockModels.verificationToken.deleteMany).toHaveBeenCalledWith({
          where: { userId: 'user_1' },
        });
        expect(mockModels.verificationToken.create).toHaveBeenCalledWith({
          data: {
            token: 'verify_token_123',
            userId: 'user_1',
            expiresAt,
          },
        });
      });
    });

    describe('getUserByVerificationToken', () => {
      it('should return user when token is valid and not expired', async () => {
        const futureDate = new Date(Date.now() + 86400000); // 24 hours from now
        mockModels.verificationToken.findUnique.mockResolvedValueOnce({
          token: 'verify_token_123',
          userId: 'user_1',
          expiresAt: futureDate,
          user: {
            id: 'user_1',
            email: 'test@example.com',
            emailVerified: false,
            createdAt: new Date('2024-01-01'),
          },
        });

        const result = await adapter.getUserByVerificationToken('verify_token_123');

        expect(mockModels.verificationToken.findUnique).toHaveBeenCalledWith({
          where: { token: 'verify_token_123' },
          include: { user: true },
        });
        expect(result?.id).toBe('user_1');
      });

      it('should return null when token not found', async () => {
        mockModels.verificationToken.findUnique.mockResolvedValueOnce(null);

        const result = await adapter.getUserByVerificationToken('nonexistent');

        expect(result).toBeNull();
      });

      it('should return null when token is expired', async () => {
        const pastDate = new Date(Date.now() - 86400000); // 24 hours ago
        mockModels.verificationToken.findUnique.mockResolvedValueOnce({
          token: 'expired_token',
          userId: 'user_1',
          expiresAt: pastDate,
          user: {
            id: 'user_1',
            email: 'test@example.com',
            emailVerified: false,
            createdAt: new Date('2024-01-01'),
          },
        });

        const result = await adapter.getUserByVerificationToken('expired_token');

        expect(result).toBeNull();
      });
    });

    describe('clearVerificationToken', () => {
      it('should delete verification tokens for user', async () => {
        mockModels.verificationToken.deleteMany.mockResolvedValueOnce({ count: 1 });

        await adapter.clearVerificationToken('user_1');

        expect(mockModels.verificationToken.deleteMany).toHaveBeenCalledWith({
          where: { userId: 'user_1' },
        });
      });
    });
  });

  // ============================================
  // PASSWORD RESET TOKEN OPERATIONS (Separate Table)
  // ============================================

  describe('Password Reset Token Operations', () => {
    describe('setPasswordResetToken', () => {
      it('should delete existing tokens and create new one', async () => {
        const expiresAt = new Date('2024-01-02');
        mockModels.passwordResetToken.deleteMany.mockResolvedValueOnce({ count: 1 });
        mockModels.passwordResetToken.create.mockResolvedValueOnce({});

        await adapter.setPasswordResetToken('user_1', 'reset_token_123', expiresAt);

        expect(mockModels.passwordResetToken.deleteMany).toHaveBeenCalledWith({
          where: { userId: 'user_1' },
        });
        expect(mockModels.passwordResetToken.create).toHaveBeenCalledWith({
          data: {
            token: 'reset_token_123',
            userId: 'user_1',
            expiresAt,
          },
        });
      });
    });

    describe('getUserByPasswordResetToken', () => {
      it('should return user when reset token is valid and not expired', async () => {
        const futureDate = new Date(Date.now() + 3600000); // 1 hour from now
        mockModels.passwordResetToken.findUnique.mockResolvedValueOnce({
          token: 'reset_token_123',
          userId: 'user_1',
          expiresAt: futureDate,
          user: {
            id: 'user_1',
            email: 'test@example.com',
            emailVerified: true,
            createdAt: new Date('2024-01-01'),
          },
        });

        const result = await adapter.getUserByPasswordResetToken('reset_token_123');

        expect(mockModels.passwordResetToken.findUnique).toHaveBeenCalledWith({
          where: { token: 'reset_token_123' },
          include: { user: true },
        });
        expect(result?.id).toBe('user_1');
      });

      it('should return null when reset token not found', async () => {
        mockModels.passwordResetToken.findUnique.mockResolvedValueOnce(null);

        const result = await adapter.getUserByPasswordResetToken('nonexistent');

        expect(result).toBeNull();
      });

      it('should return null when reset token is expired', async () => {
        const pastDate = new Date(Date.now() - 3600000); // 1 hour ago
        mockModels.passwordResetToken.findUnique.mockResolvedValueOnce({
          token: 'expired_token',
          userId: 'user_1',
          expiresAt: pastDate,
          user: {
            id: 'user_1',
            email: 'test@example.com',
            emailVerified: true,
            createdAt: new Date('2024-01-01'),
          },
        });

        const result = await adapter.getUserByPasswordResetToken('expired_token');

        expect(result).toBeNull();
      });
    });

    describe('clearPasswordResetToken', () => {
      it('should delete password reset tokens for user', async () => {
        mockModels.passwordResetToken.deleteMany.mockResolvedValueOnce({ count: 1 });

        await adapter.clearPasswordResetToken('user_1');

        expect(mockModels.passwordResetToken.deleteMany).toHaveBeenCalledWith({
          where: { userId: 'user_1' },
        });
      });
    });
  });

  // ============================================
  // SUBSCRIPTION OPERATIONS
  // ============================================

  describe('Subscription Operations', () => {
    const mockSubscriptionInput = {
      userId: 'user_1',
      planId: 'plan_pro',
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
        const mockDbSubscription = {
          id: 'sub_1',
          ...mockSubscriptionInput,
          trialEndDate: null,
          createdAt: new Date('2024-01-01'),
          updatedAt: new Date('2024-01-01'),
        };

        mockModels.subscription.create.mockResolvedValueOnce(mockDbSubscription);

        const result = await adapter.createSubscription(mockSubscriptionInput);

        expect(mockModels.subscription.create).toHaveBeenCalledWith({
          data: mockSubscriptionInput,
        });
        expect(result.id).toBe('sub_1');
        expect(result.status).toBe('active');
        expect(result.providerSubscriptionId).toBe('sub_123');
      });
    });

    describe('getSubscriptionByUserId', () => {
      it('should return subscription for user', async () => {
        const mockDbSubscription = {
          id: 'sub_1',
          ...mockSubscriptionInput,
          trialEndDate: null,
          createdAt: new Date('2024-01-01'),
          updatedAt: new Date('2024-01-01'),
        };

        mockModels.subscription.findUnique.mockResolvedValueOnce(mockDbSubscription);

        const result = await adapter.getSubscriptionByUserId('user_1');

        expect(mockModels.subscription.findUnique).toHaveBeenCalledWith({
          where: { userId: 'user_1' },
        });
        expect(result?.userId).toBe('user_1');
      });

      it('should return null if user has no subscription', async () => {
        mockModels.subscription.findUnique.mockResolvedValueOnce(null);

        const result = await adapter.getSubscriptionByUserId('nonexistent');

        expect(result).toBeNull();
      });
    });

    describe('getSubscriptionByProviderId', () => {
      it('should return subscription by provider subscription ID', async () => {
        const mockDbSubscription = {
          id: 'sub_1',
          ...mockSubscriptionInput,
          trialEndDate: null,
          createdAt: new Date('2024-01-01'),
          updatedAt: new Date('2024-01-01'),
        };

        mockModels.subscription.findUnique.mockResolvedValueOnce(mockDbSubscription);

        const result = await adapter.getSubscriptionByProviderId('sub_123');

        expect(mockModels.subscription.findUnique).toHaveBeenCalledWith({
          where: { providerSubscriptionId: 'sub_123' },
        });
        expect(result?.providerSubscriptionId).toBe('sub_123');
      });

      it('should return null if provider subscription not found', async () => {
        mockModels.subscription.findUnique.mockResolvedValueOnce(null);

        const result = await adapter.getSubscriptionByProviderId('nonexistent');

        expect(result).toBeNull();
      });
    });

    describe('updateSubscription', () => {
      it('should update subscription and return updated object', async () => {
        const mockDbSubscription = {
          id: 'sub_1',
          ...mockSubscriptionInput,
          status: 'canceled',
          cancelAtPeriodEnd: true,
          trialEndDate: null,
          createdAt: new Date('2024-01-01'),
          updatedAt: new Date('2024-01-15'),
        };

        mockModels.subscription.update.mockResolvedValueOnce(mockDbSubscription);

        const result = await adapter.updateSubscription('sub_1', {
          status: 'canceled',
          cancelAtPeriodEnd: true,
        });

        expect(mockModels.subscription.update).toHaveBeenCalledWith({
          where: { id: 'sub_1' },
          data: {
            status: 'canceled',
            cancelAtPeriodEnd: true,
          },
        });
        expect(result.status).toBe('canceled');
        expect(result.cancelAtPeriodEnd).toBe(true);
      });

      it('should throw error if subscription not found', async () => {
        mockModels.subscription.update.mockRejectedValueOnce(new Error('Record not found'));

        await expect(adapter.updateSubscription('nonexistent', { status: 'canceled' }))
          .rejects.toThrow('Record not found');
      });
    });
  });

  // ============================================
  // TRANSACTION OPERATIONS
  // ============================================

  describe('Transaction Operations', () => {
    describe('createTransaction', () => {
      it('should create transaction and return transaction object', async () => {
        const mockDbTransaction = {
          id: 'txn_1',
          userId: 'user_1',
          subscriptionId: 'sub_1',
          amount: 1999,
          currency: 'USD',
          status: 'completed',
          providerTransactionId: 'txn_123',
          createdAt: new Date('2024-01-01'),
        };

        mockModels.transaction.create.mockResolvedValueOnce(mockDbTransaction);

        const result = await adapter.createTransaction({
          userId: 'user_1',
          subscriptionId: 'sub_1',
          amount: 1999,
          currency: 'USD',
          status: 'completed',
          providerTransactionId: 'txn_123',
        });

        expect(mockModels.transaction.create).toHaveBeenCalled();
        expect(result.id).toBe('txn_1');
        expect(result.amount).toBe(1999);
        expect(result.providerTransactionId).toBe('txn_123');
      });
    });

    describe('getTransactionByProviderId', () => {
      it('should return transaction by provider transaction ID', async () => {
        const mockDbTransaction = {
          id: 'txn_1',
          userId: 'user_1',
          subscriptionId: 'sub_1',
          amount: 1999,
          currency: 'USD',
          status: 'completed',
          providerTransactionId: 'txn_123',
          createdAt: new Date('2024-01-01'),
        };

        mockModels.transaction.findFirst.mockResolvedValueOnce(mockDbTransaction);

        const result = await adapter.getTransactionByProviderId('txn_123');

        expect(mockModels.transaction.findFirst).toHaveBeenCalledWith({
          where: { providerTransactionId: 'txn_123' },
        });
        expect(result?.providerTransactionId).toBe('txn_123');
      });

      it('should return null if transaction not found', async () => {
        mockModels.transaction.findFirst.mockResolvedValueOnce(null);

        const result = await adapter.getTransactionByProviderId('nonexistent');

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
        mockModels.user.update.mockResolvedValueOnce({});

        await adapter.setProviderCustomerId('user_1', 'cus_abc123');

        expect(mockModels.user.update).toHaveBeenCalledWith({
          where: { id: 'user_1' },
          data: { providerCustomerId: 'cus_abc123' },
        });
      });
    });

    describe('getUserByProviderCustomerId', () => {
      it('should return user by provider customer ID', async () => {
        const mockDbUser = {
          id: 'user_1',
          email: 'test@example.com',
          emailVerified: true,
          createdAt: new Date('2024-01-01'),
        };

        mockModels.user.findFirst.mockResolvedValueOnce(mockDbUser);

        const result = await adapter.getUserByProviderCustomerId('cus_abc123');

        expect(mockModels.user.findFirst).toHaveBeenCalledWith({
          where: { providerCustomerId: 'cus_abc123' },
        });
        expect(result?.id).toBe('user_1');
      });

      it('should return null if provider customer ID not found', async () => {
        mockModels.user.findFirst.mockResolvedValueOnce(null);

        const result = await adapter.getUserByProviderCustomerId('nonexistent');

        expect(result).toBeNull();
      });
    });
  });
});

// ============================================
// FIELD MAPPING TESTS
// ============================================

describe('PrismaAdapter with Custom Field Mappings', () => {
  it('should support snake_case field mappings', async () => {
    const mockModels = createMockModels();

    const config: PrismaAdapterConfig = {
      models: mockModels,
      fieldMappings: {
        user: {
          id: 'id',
          email: 'email',
          emailVerified: 'email_verified', // snake_case
          passwordHash: 'password_hash',   // snake_case
          providerCustomerId: 'provider_customer_id', // snake_case
          createdAt: 'created_at',         // snake_case
        },
      },
    };

    const adapter = new PrismaAdapter(config);

    mockModels.user.create.mockResolvedValueOnce({
      id: 'user_1',
      email: 'test@example.com',
      email_verified: false,
      created_at: new Date('2024-01-01'),
    });

    const result = await adapter.createUser('test@example.com', 'hashed');

    // The adapter should map snake_case fields back to camelCase in the result
    expect(result.emailVerified).toBe(false);
    expect(result.createdAt).toEqual(new Date('2024-01-01'));
  });
});

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BaseAdapter } from '../index';
import type { User, Subscription, Transaction } from '@subauth/core';

/**
 * Concrete implementation of BaseAdapter for testing.
 * All abstract methods are mocked to verify the base class logic.
 */
class TestAdapter extends BaseAdapter {
  // Mock functions to track calls
  public mockDeleteVerificationTokensByUserId = vi.fn<[string], Promise<void>>();
  public mockInsertVerificationToken = vi.fn<[string, string, Date], Promise<void>>();
  public mockUpdateUserVerificationToken = vi.fn<[string, string, Date], Promise<void>>();
  public mockGetUserByVerificationTokenFromTable = vi.fn<[string], Promise<User | null>>();
  public mockGetUserByVerificationTokenFromUser = vi.fn<[string], Promise<User | null>>();
  public mockDeleteVerificationTokenByUserId = vi.fn<[string], Promise<void>>();
  public mockClearUserVerificationToken = vi.fn<[string], Promise<void>>();

  public mockDeletePasswordResetTokensByUserId = vi.fn<[string], Promise<void>>();
  public mockInsertPasswordResetToken = vi.fn<[string, string, Date], Promise<void>>();
  public mockUpdateUserPasswordResetToken = vi.fn<[string, string, Date], Promise<void>>();
  public mockGetUserByPasswordResetTokenFromTable = vi.fn<[string], Promise<User | null>>();
  public mockGetUserByPasswordResetTokenFromUser = vi.fn<[string], Promise<User | null>>();
  public mockDeletePasswordResetTokenByUserId = vi.fn<[string], Promise<void>>();
  public mockClearUserPasswordResetToken = vi.fn<[string], Promise<void>>();

  // Implement abstract methods for token operations
  protected async deleteVerificationTokensByUserId(userId: string): Promise<void> {
    return this.mockDeleteVerificationTokensByUserId(userId);
  }

  protected async insertVerificationToken(token: string, userId: string, expiresAt: Date): Promise<void> {
    return this.mockInsertVerificationToken(token, userId, expiresAt);
  }

  protected async updateUserVerificationToken(userId: string, token: string, expiresAt: Date): Promise<void> {
    return this.mockUpdateUserVerificationToken(userId, token, expiresAt);
  }

  protected async getUserByVerificationTokenFromTable(token: string): Promise<User | null> {
    return this.mockGetUserByVerificationTokenFromTable(token);
  }

  protected async getUserByVerificationTokenFromUser(token: string): Promise<User | null> {
    return this.mockGetUserByVerificationTokenFromUser(token);
  }

  protected async deleteVerificationTokenByUserId(userId: string): Promise<void> {
    return this.mockDeleteVerificationTokenByUserId(userId);
  }

  protected async clearUserVerificationToken(userId: string): Promise<void> {
    return this.mockClearUserVerificationToken(userId);
  }

  // Implement abstract methods for password reset token operations
  protected async deletePasswordResetTokensByUserId(userId: string): Promise<void> {
    return this.mockDeletePasswordResetTokensByUserId(userId);
  }

  protected async insertPasswordResetToken(token: string, userId: string, expiresAt: Date): Promise<void> {
    return this.mockInsertPasswordResetToken(token, userId, expiresAt);
  }

  protected async updateUserPasswordResetToken(userId: string, token: string, expiresAt: Date): Promise<void> {
    return this.mockUpdateUserPasswordResetToken(userId, token, expiresAt);
  }

  protected async getUserByPasswordResetTokenFromTable(token: string): Promise<User | null> {
    return this.mockGetUserByPasswordResetTokenFromTable(token);
  }

  protected async getUserByPasswordResetTokenFromUser(token: string): Promise<User | null> {
    return this.mockGetUserByPasswordResetTokenFromUser(token);
  }

  protected async deletePasswordResetTokenByUserId(userId: string): Promise<void> {
    return this.mockDeletePasswordResetTokenByUserId(userId);
  }

  protected async clearUserPasswordResetToken(userId: string): Promise<void> {
    return this.mockClearUserPasswordResetToken(userId);
  }

  // Other required abstract methods (not relevant for token tests)
  async createUser(email: string, passwordHash: string): Promise<User> {
    throw new Error('Not implemented');
  }
  async getUserById(id: string): Promise<User | null> {
    throw new Error('Not implemented');
  }
  async getUserByEmail(email: string): Promise<User | null> {
    throw new Error('Not implemented');
  }
  async updateUser(id: string, updates: Partial<User>): Promise<User> {
    throw new Error('Not implemented');
  }
  async getPasswordHash(userId: string): Promise<string | null> {
    throw new Error('Not implemented');
  }
  async setPasswordHash(userId: string, hash: string): Promise<void> {
    throw new Error('Not implemented');
  }
  async createSubscription(subscription: Omit<Subscription, 'id' | 'createdAt' | 'updatedAt'>): Promise<Subscription> {
    throw new Error('Not implemented');
  }
  async getSubscriptionByUserId(userId: string): Promise<Subscription | null> {
    throw new Error('Not implemented');
  }
  async getSubscriptionByProviderId(providerSubscriptionId: string): Promise<Subscription | null> {
    throw new Error('Not implemented');
  }
  async updateSubscription(id: string, updates: Partial<Subscription>): Promise<Subscription> {
    throw new Error('Not implemented');
  }
  async createTransaction(transaction: Omit<Transaction, 'id' | 'createdAt'>): Promise<Transaction> {
    throw new Error('Not implemented');
  }
  async getTransactionByProviderId(providerTransactionId: string): Promise<Transaction | null> {
    throw new Error('Not implemented');
  }
  async setProviderCustomerId(userId: string, providerId: string): Promise<void> {
    throw new Error('Not implemented');
  }
  async getUserByProviderCustomerId(providerId: string): Promise<User | null> {
    throw new Error('Not implemented');
  }
}

describe('BaseAdapter', () => {
  // ============================================
  // VERIFICATION TOKEN OPERATIONS
  // ============================================

  describe('Verification Token Operations', () => {
    describe('with separateTokenTables: true (default)', () => {
      let adapter: TestAdapter;

      beforeEach(() => {
        adapter = new TestAdapter({ separateTokenTables: true });
      });

      describe('setVerificationToken', () => {
        it('should delete existing tokens and insert new token', async () => {
          const expiresAt = new Date('2024-01-02');

          await adapter.setVerificationToken('user-1', 'token-123', expiresAt);

          expect(adapter.mockDeleteVerificationTokensByUserId).toHaveBeenCalledWith('user-1');
          expect(adapter.mockInsertVerificationToken).toHaveBeenCalledWith('token-123', 'user-1', expiresAt);
          expect(adapter.mockUpdateUserVerificationToken).not.toHaveBeenCalled();
        });

        it('should call delete before insert', async () => {
          const callOrder: string[] = [];
          adapter.mockDeleteVerificationTokensByUserId.mockImplementation(async () => {
            callOrder.push('delete');
          });
          adapter.mockInsertVerificationToken.mockImplementation(async () => {
            callOrder.push('insert');
          });

          await adapter.setVerificationToken('user-1', 'token-123', new Date());

          expect(callOrder).toEqual(['delete', 'insert']);
        });
      });

      describe('getUserByVerificationToken', () => {
        it('should query the token table', async () => {
          const mockUser: User = {
            id: 'user-1',
            email: 'test@example.com',
            emailVerified: false,
            createdAt: new Date(),
          };
          adapter.mockGetUserByVerificationTokenFromTable.mockResolvedValue(mockUser);

          const result = await adapter.getUserByVerificationToken('token-123');

          expect(adapter.mockGetUserByVerificationTokenFromTable).toHaveBeenCalledWith('token-123');
          expect(adapter.mockGetUserByVerificationTokenFromUser).not.toHaveBeenCalled();
          expect(result).toEqual(mockUser);
        });

        it('should return null when token not found', async () => {
          adapter.mockGetUserByVerificationTokenFromTable.mockResolvedValue(null);

          const result = await adapter.getUserByVerificationToken('invalid-token');

          expect(result).toBeNull();
        });
      });

      describe('clearVerificationToken', () => {
        it('should delete from token table', async () => {
          await adapter.clearVerificationToken('user-1');

          expect(adapter.mockDeleteVerificationTokenByUserId).toHaveBeenCalledWith('user-1');
          expect(adapter.mockClearUserVerificationToken).not.toHaveBeenCalled();
        });
      });
    });

    describe('with separateTokenTables: false', () => {
      let adapter: TestAdapter;

      beforeEach(() => {
        adapter = new TestAdapter({ separateTokenTables: false });
      });

      describe('setVerificationToken', () => {
        it('should update user table directly', async () => {
          const expiresAt = new Date('2024-01-02');

          await adapter.setVerificationToken('user-1', 'token-123', expiresAt);

          expect(adapter.mockUpdateUserVerificationToken).toHaveBeenCalledWith('user-1', 'token-123', expiresAt);
          expect(adapter.mockDeleteVerificationTokensByUserId).not.toHaveBeenCalled();
          expect(adapter.mockInsertVerificationToken).not.toHaveBeenCalled();
        });
      });

      describe('getUserByVerificationToken', () => {
        it('should query the user table', async () => {
          const mockUser: User = {
            id: 'user-1',
            email: 'test@example.com',
            emailVerified: false,
            createdAt: new Date(),
          };
          adapter.mockGetUserByVerificationTokenFromUser.mockResolvedValue(mockUser);

          const result = await adapter.getUserByVerificationToken('token-123');

          expect(adapter.mockGetUserByVerificationTokenFromUser).toHaveBeenCalledWith('token-123');
          expect(adapter.mockGetUserByVerificationTokenFromTable).not.toHaveBeenCalled();
          expect(result).toEqual(mockUser);
        });
      });

      describe('clearVerificationToken', () => {
        it('should update user table to clear token', async () => {
          await adapter.clearVerificationToken('user-1');

          expect(adapter.mockClearUserVerificationToken).toHaveBeenCalledWith('user-1');
          expect(adapter.mockDeleteVerificationTokenByUserId).not.toHaveBeenCalled();
        });
      });
    });
  });

  // ============================================
  // PASSWORD RESET TOKEN OPERATIONS
  // ============================================

  describe('Password Reset Token Operations', () => {
    describe('with separateTokenTables: true (default)', () => {
      let adapter: TestAdapter;

      beforeEach(() => {
        adapter = new TestAdapter({ separateTokenTables: true });
      });

      describe('setPasswordResetToken', () => {
        it('should delete existing tokens and insert new token', async () => {
          const expiresAt = new Date('2024-01-02');

          await adapter.setPasswordResetToken('user-1', 'reset-token-123', expiresAt);

          expect(adapter.mockDeletePasswordResetTokensByUserId).toHaveBeenCalledWith('user-1');
          expect(adapter.mockInsertPasswordResetToken).toHaveBeenCalledWith('reset-token-123', 'user-1', expiresAt);
          expect(adapter.mockUpdateUserPasswordResetToken).not.toHaveBeenCalled();
        });

        it('should call delete before insert', async () => {
          const callOrder: string[] = [];
          adapter.mockDeletePasswordResetTokensByUserId.mockImplementation(async () => {
            callOrder.push('delete');
          });
          adapter.mockInsertPasswordResetToken.mockImplementation(async () => {
            callOrder.push('insert');
          });

          await adapter.setPasswordResetToken('user-1', 'reset-token-123', new Date());

          expect(callOrder).toEqual(['delete', 'insert']);
        });
      });

      describe('getUserByPasswordResetToken', () => {
        it('should query the token table', async () => {
          const mockUser: User = {
            id: 'user-1',
            email: 'test@example.com',
            emailVerified: true,
            createdAt: new Date(),
          };
          adapter.mockGetUserByPasswordResetTokenFromTable.mockResolvedValue(mockUser);

          const result = await adapter.getUserByPasswordResetToken('reset-token-123');

          expect(adapter.mockGetUserByPasswordResetTokenFromTable).toHaveBeenCalledWith('reset-token-123');
          expect(adapter.mockGetUserByPasswordResetTokenFromUser).not.toHaveBeenCalled();
          expect(result).toEqual(mockUser);
        });

        it('should return null when token not found', async () => {
          adapter.mockGetUserByPasswordResetTokenFromTable.mockResolvedValue(null);

          const result = await adapter.getUserByPasswordResetToken('invalid-token');

          expect(result).toBeNull();
        });
      });

      describe('clearPasswordResetToken', () => {
        it('should delete from token table', async () => {
          await adapter.clearPasswordResetToken('user-1');

          expect(adapter.mockDeletePasswordResetTokenByUserId).toHaveBeenCalledWith('user-1');
          expect(adapter.mockClearUserPasswordResetToken).not.toHaveBeenCalled();
        });
      });
    });

    describe('with separateTokenTables: false', () => {
      let adapter: TestAdapter;

      beforeEach(() => {
        adapter = new TestAdapter({ separateTokenTables: false });
      });

      describe('setPasswordResetToken', () => {
        it('should update user table directly', async () => {
          const expiresAt = new Date('2024-01-02');

          await adapter.setPasswordResetToken('user-1', 'reset-token-123', expiresAt);

          expect(adapter.mockUpdateUserPasswordResetToken).toHaveBeenCalledWith('user-1', 'reset-token-123', expiresAt);
          expect(adapter.mockDeletePasswordResetTokensByUserId).not.toHaveBeenCalled();
          expect(adapter.mockInsertPasswordResetToken).not.toHaveBeenCalled();
        });
      });

      describe('getUserByPasswordResetToken', () => {
        it('should query the user table', async () => {
          const mockUser: User = {
            id: 'user-1',
            email: 'test@example.com',
            emailVerified: true,
            createdAt: new Date(),
          };
          adapter.mockGetUserByPasswordResetTokenFromUser.mockResolvedValue(mockUser);

          const result = await adapter.getUserByPasswordResetToken('reset-token-123');

          expect(adapter.mockGetUserByPasswordResetTokenFromUser).toHaveBeenCalledWith('reset-token-123');
          expect(adapter.mockGetUserByPasswordResetTokenFromTable).not.toHaveBeenCalled();
          expect(result).toEqual(mockUser);
        });
      });

      describe('clearPasswordResetToken', () => {
        it('should update user table to clear token', async () => {
          await adapter.clearPasswordResetToken('user-1');

          expect(adapter.mockClearUserPasswordResetToken).toHaveBeenCalledWith('user-1');
          expect(adapter.mockDeletePasswordResetTokenByUserId).not.toHaveBeenCalled();
        });
      });
    });
  });

  // ============================================
  // DEFAULT CONFIGURATION
  // ============================================

  describe('Default Configuration', () => {
    it('should default separateTokenTables to true', async () => {
      const adapter = new TestAdapter(); // No config provided

      await adapter.setVerificationToken('user-1', 'token', new Date());

      // Should use separate table methods
      expect(adapter.mockDeleteVerificationTokensByUserId).toHaveBeenCalled();
      expect(adapter.mockInsertVerificationToken).toHaveBeenCalled();
      expect(adapter.mockUpdateUserVerificationToken).not.toHaveBeenCalled();
    });
  });
});
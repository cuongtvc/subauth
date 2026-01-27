import type {
  DatabaseAdapter,
  User,
  Subscription,
  Transaction,
} from '@subauth/core';

/**
 * Configuration options for BaseAdapter.
 */
export interface BaseAdapterConfig {
  /**
   * Whether to store tokens in separate tables (default: true).
   * - true: Tokens stored in dedicated verification_tokens/password_reset_tokens tables
   * - false: Tokens stored as columns on the users table
   */
  separateTokenTables?: boolean;
}

/**
 * Abstract base class for SubAuth database adapters.
 * Provides shared logic for token operations with configurable storage strategy.
 *
 * Subclasses must implement the abstract methods for their specific database.
 */
export abstract class BaseAdapter implements DatabaseAdapter {
  protected readonly separateTokenTables: boolean;

  constructor(config: BaseAdapterConfig = {}) {
    this.separateTokenTables = config.separateTokenTables ?? true;
  }

  // ============================================
  // ABSTRACT METHODS - Must be implemented by subclasses
  // ============================================

  // User operations
  abstract createUser(email: string, passwordHash: string): Promise<User>;
  abstract getUserById(id: string): Promise<User | null>;
  abstract getUserByEmail(email: string): Promise<User | null>;
  abstract updateUser(id: string, updates: Partial<User>): Promise<User>;

  // Password operations
  abstract getPasswordHash(userId: string): Promise<string | null>;
  abstract setPasswordHash(userId: string, hash: string): Promise<void>;

  // Subscription operations
  abstract createSubscription(subscription: Omit<Subscription, 'id' | 'createdAt' | 'updatedAt'>): Promise<Subscription>;
  abstract getSubscriptionByUserId(userId: string): Promise<Subscription | null>;
  abstract getSubscriptionByProviderId(providerSubscriptionId: string): Promise<Subscription | null>;
  abstract updateSubscription(id: string, updates: Partial<Subscription>): Promise<Subscription>;

  // Transaction operations
  abstract createTransaction(transaction: Omit<Transaction, 'id' | 'createdAt'>): Promise<Transaction>;
  abstract getTransactionByProviderId(providerTransactionId: string): Promise<Transaction | null>;

  // Provider customer ID operations
  abstract setProviderCustomerId(userId: string, providerId: string): Promise<void>;
  abstract getUserByProviderCustomerId(providerId: string): Promise<User | null>;

  // ============================================
  // ABSTRACT METHODS FOR TOKEN OPERATIONS
  // Subclasses implement these for their specific database
  // ============================================

  // Verification token - separate table operations
  protected abstract deleteVerificationTokensByUserId(userId: string): Promise<void>;
  protected abstract insertVerificationToken(token: string, userId: string, expiresAt: Date): Promise<void>;
  protected abstract getUserByVerificationTokenFromTable(token: string): Promise<User | null>;
  protected abstract deleteVerificationTokenByUserId(userId: string): Promise<void>;

  // Verification token - user table operations
  protected abstract updateUserVerificationToken(userId: string, token: string, expiresAt: Date): Promise<void>;
  protected abstract getUserByVerificationTokenFromUser(token: string): Promise<User | null>;
  protected abstract clearUserVerificationToken(userId: string): Promise<void>;

  // Password reset token - separate table operations
  protected abstract deletePasswordResetTokensByUserId(userId: string): Promise<void>;
  protected abstract insertPasswordResetToken(token: string, userId: string, expiresAt: Date): Promise<void>;
  protected abstract getUserByPasswordResetTokenFromTable(token: string): Promise<User | null>;
  protected abstract deletePasswordResetTokenByUserId(userId: string): Promise<void>;

  // Password reset token - user table operations
  protected abstract updateUserPasswordResetToken(userId: string, token: string, expiresAt: Date): Promise<void>;
  protected abstract getUserByPasswordResetTokenFromUser(token: string): Promise<User | null>;
  protected abstract clearUserPasswordResetToken(userId: string): Promise<void>;

  // ============================================
  // VERIFICATION TOKEN OPERATIONS
  // ============================================

  async setVerificationToken(userId: string, token: string, expiresAt: Date): Promise<void> {
    if (this.separateTokenTables) {
      await this.deleteVerificationTokensByUserId(userId);
      await this.insertVerificationToken(token, userId, expiresAt);
    } else {
      await this.updateUserVerificationToken(userId, token, expiresAt);
    }
  }

  async getUserByVerificationToken(token: string): Promise<User | null> {
    if (this.separateTokenTables) {
      return this.getUserByVerificationTokenFromTable(token);
    } else {
      return this.getUserByVerificationTokenFromUser(token);
    }
  }

  async clearVerificationToken(userId: string): Promise<void> {
    if (this.separateTokenTables) {
      await this.deleteVerificationTokenByUserId(userId);
    } else {
      await this.clearUserVerificationToken(userId);
    }
  }

  // ============================================
  // PASSWORD RESET TOKEN OPERATIONS
  // ============================================

  async setPasswordResetToken(userId: string, token: string, expiresAt: Date): Promise<void> {
    if (this.separateTokenTables) {
      await this.deletePasswordResetTokensByUserId(userId);
      await this.insertPasswordResetToken(token, userId, expiresAt);
    } else {
      await this.updateUserPasswordResetToken(userId, token, expiresAt);
    }
  }

  async getUserByPasswordResetToken(token: string): Promise<User | null> {
    if (this.separateTokenTables) {
      return this.getUserByPasswordResetTokenFromTable(token);
    } else {
      return this.getUserByPasswordResetTokenFromUser(token);
    }
  }

  async clearPasswordResetToken(userId: string): Promise<void> {
    if (this.separateTokenTables) {
      await this.deletePasswordResetTokenByUserId(userId);
    } else {
      await this.clearUserPasswordResetToken(userId);
    }
  }
}
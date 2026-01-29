import { BaseAdapter } from '@subauth/adapter-base';
import type {
  User,
  Subscription,
  Transaction,
  SubscriptionStatus,
  BillingCycle,
} from '@subauth/core';

// ============================================
// TYPE DEFINITIONS
// ============================================

/**
 * Generic Prisma model interface for CRUD operations.
 * These match Prisma's generated client method signatures.
 */
export interface PrismaModelOperations<T, CreateInput, WhereUnique, WhereInput, UpdateInput> {
  create(args: { data: CreateInput }): Promise<T>;
  findUnique(args: { where: WhereUnique; select?: Record<string, boolean>; include?: Record<string, boolean> }): Promise<T | null>;
  findFirst?(args: { where: WhereInput }): Promise<T | null>;
  update(args: { where: WhereUnique; data: UpdateInput }): Promise<T>;
  delete?(args: { where: WhereUnique }): Promise<T>;
  deleteMany?(args: { where: WhereInput }): Promise<{ count: number }>;
}

/**
 * Prisma model delegates expected by the adapter.
 */
export interface PrismaModels {
  user: {
    create(args: { data: Record<string, unknown> }): Promise<Record<string, unknown>>;
    findUnique(args: { where: Record<string, unknown>; select?: Record<string, boolean>; include?: Record<string, boolean> }): Promise<Record<string, unknown> | null>;
    findFirst(args: { where: Record<string, unknown> }): Promise<Record<string, unknown> | null>;
    findMany(args: {
      where?: Record<string, unknown>;
      select?: Record<string, boolean>;
      orderBy?: Record<string, string>;
      skip?: number;
      take?: number;
    }): Promise<Record<string, unknown>[]>;
    count(args: { where?: Record<string, unknown> }): Promise<number>;
    update(args: { where: Record<string, unknown>; data: Record<string, unknown> }): Promise<Record<string, unknown>>;
  };
  subscription?: {
    create(args: { data: Record<string, unknown> }): Promise<Record<string, unknown>>;
    findUnique(args: { where: Record<string, unknown> }): Promise<Record<string, unknown> | null>;
    findFirst?(args: { where: Record<string, unknown> }): Promise<Record<string, unknown> | null>;
    update(args: { where: Record<string, unknown>; data: Record<string, unknown> }): Promise<Record<string, unknown>>;
  };
  transaction?: {
    create(args: { data: Record<string, unknown> }): Promise<Record<string, unknown>>;
    findFirst(args: { where: Record<string, unknown> }): Promise<Record<string, unknown> | null>;
  };
  verificationToken?: {
    create(args: { data: Record<string, unknown> }): Promise<Record<string, unknown>>;
    findUnique(args: { where: Record<string, unknown>; include?: Record<string, boolean> }): Promise<Record<string, unknown> | null>;
    delete?(args: { where: Record<string, unknown> }): Promise<Record<string, unknown>>;
    deleteMany(args: { where: Record<string, unknown> }): Promise<{ count: number }>;
  };
  passwordResetToken?: {
    create(args: { data: Record<string, unknown> }): Promise<Record<string, unknown>>;
    findUnique(args: { where: Record<string, unknown>; include?: Record<string, boolean> }): Promise<Record<string, unknown> | null>;
    delete?(args: { where: Record<string, unknown> }): Promise<Record<string, unknown>>;
    deleteMany(args: { where: Record<string, unknown> }): Promise<{ count: number }>;
  };
  refreshToken?: {
    create(args: { data: Record<string, unknown> }): Promise<Record<string, unknown>>;
    findUnique(args: { where: Record<string, unknown> }): Promise<Record<string, unknown> | null>;
    delete?(args: { where: Record<string, unknown> }): Promise<Record<string, unknown>>;
    deleteMany(args: { where: Record<string, unknown> }): Promise<{ count: number }>;
  };
}

/**
 * Field mappings to support different Prisma schema conventions.
 * Maps standard SubAuth field names to your actual Prisma schema field names.
 */
export interface FieldMappings {
  user?: {
    id?: string;
    email?: string;
    emailVerified?: string;
    passwordHash?: string;
    providerCustomerId?: string;
    createdAt?: string;
    tier?: string;
    isAdmin?: string;
    // Token fields if stored on user table
    verificationToken?: string;
    verificationTokenExpires?: string;
    passwordResetToken?: string;
    passwordResetTokenExpires?: string;
  };
  subscription?: {
    id?: string;
    userId?: string;
    planId?: string;
    priceId?: string;
    status?: string;
    billingCycle?: string;
    currentPeriodStart?: string;
    currentPeriodEnd?: string;
    cancelAtPeriodEnd?: string;
    trialEndDate?: string;
    providerSubscriptionId?: string;
    providerCustomerId?: string;
    createdAt?: string;
    updatedAt?: string;
  };
  verificationToken?: {
    token?: string;
    userId?: string;
    expiresAt?: string;
  };
  passwordResetToken?: {
    token?: string;
    userId?: string;
    expiresAt?: string;
  };
  refreshToken?: {
    token?: string;
    userId?: string;
    expiresAt?: string;
  };
  transaction?: {
    id?: string;
    userId?: string;
    subscriptionId?: string;
    amount?: string;
    currency?: string;
    status?: string;
    providerTransactionId?: string;
    createdAt?: string;
  };
}

/**
 * Configuration for the Prisma adapter.
 */
export interface PrismaAdapterConfig {
  /** Prisma model delegates or a PrismaClient instance */
  models: PrismaModels;
  /** Optional field mappings for custom schema conventions */
  fieldMappings?: FieldMappings;
  /** Whether tokens are stored in separate tables (default: true) */
  separateTokenTables?: boolean;
}

// ============================================
// DEFAULT FIELD MAPPINGS
// ============================================

const defaultUserFields = {
  id: 'id',
  email: 'email',
  emailVerified: 'emailVerified',
  passwordHash: 'passwordHash',
  providerCustomerId: 'providerCustomerId',
  createdAt: 'createdAt',
  tier: 'tier',
  isAdmin: 'isAdmin',
  verificationToken: 'verificationToken',
  verificationTokenExpires: 'verificationTokenExpires',
  passwordResetToken: 'passwordResetToken',
  passwordResetTokenExpires: 'passwordResetTokenExpires',
};

const defaultSubscriptionFields = {
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
};

const defaultTokenFields = {
  token: 'token',
  userId: 'userId',
  expiresAt: 'expiresAt',
};

const defaultTransactionFields = {
  id: 'id',
  userId: 'userId',
  subscriptionId: 'subscriptionId',
  amount: 'amount',
  currency: 'currency',
  status: 'status',
  providerTransactionId: 'providerTransactionId',
  createdAt: 'createdAt',
};

// ============================================
// PRISMA ADAPTER IMPLEMENTATION
// ============================================

/**
 * Prisma-based implementation of the SubAuth DatabaseAdapter interface.
 *
 * Supports flexible Prisma schemas with configurable field mappings
 * and two token storage strategies:
 * - Separate tables (default): Tokens stored in dedicated tables
 * - User table: Tokens stored as columns on the user table
 *
 * @example
 * ```typescript
 * import { PrismaClient } from '@prisma/client';
 * import { PrismaAdapter } from '@subauth/adapter-prisma';
 *
 * const prisma = new PrismaClient();
 *
 * const adapter = new PrismaAdapter({
 *   models: prisma,
 *   fieldMappings: {
 *     user: {
 *       emailVerified: 'email_verified', // Map to snake_case
 *       passwordHash: 'password_hash',
 *     },
 *   },
 * });
 * ```
 */
export class PrismaAdapter extends BaseAdapter {
  private models: PrismaModels;
  private userFields: Required<NonNullable<FieldMappings['user']>>;
  private subscriptionFields: Required<NonNullable<FieldMappings['subscription']>>;
  private verificationTokenFields: Required<NonNullable<FieldMappings['verificationToken']>>;
  private passwordResetTokenFields: Required<NonNullable<FieldMappings['passwordResetToken']>>;
  private refreshTokenFields: Required<NonNullable<FieldMappings['refreshToken']>>;
  private transactionFields: Required<NonNullable<FieldMappings['transaction']>>;

  constructor(config: PrismaAdapterConfig) {
    super({ separateTokenTables: config.separateTokenTables });
    this.models = config.models;

    // Merge field mappings with defaults
    this.userFields = { ...defaultUserFields, ...config.fieldMappings?.user };
    this.subscriptionFields = { ...defaultSubscriptionFields, ...config.fieldMappings?.subscription };
    this.verificationTokenFields = { ...defaultTokenFields, ...config.fieldMappings?.verificationToken };
    this.passwordResetTokenFields = { ...defaultTokenFields, ...config.fieldMappings?.passwordResetToken };
    this.refreshTokenFields = { ...defaultTokenFields, ...config.fieldMappings?.refreshToken };
    this.transactionFields = { ...defaultTransactionFields, ...config.fieldMappings?.transaction };
  }

  // ============================================
  // HELPER METHODS
  // ============================================

  private mapDbUserToUser(dbUser: Record<string, unknown>): User {
    const user: User = {
      id: String(dbUser[this.userFields.id]),
      email: String(dbUser[this.userFields.email]),
      emailVerified: Boolean(dbUser[this.userFields.emailVerified]),
      createdAt: dbUser[this.userFields.createdAt] as Date,
    };

    // Include optional fields if present
    if (dbUser[this.userFields.tier] !== undefined && dbUser[this.userFields.tier] !== null) {
      user.tier = String(dbUser[this.userFields.tier]);
    }
    if (dbUser[this.userFields.isAdmin] !== undefined && dbUser[this.userFields.isAdmin] !== null) {
      user.isAdmin = Boolean(dbUser[this.userFields.isAdmin]);
    }

    return user;
  }

  private mapDbSubscriptionToSubscription(dbSub: Record<string, unknown>): Subscription {
    return {
      id: String(dbSub[this.subscriptionFields.id]),
      userId: String(dbSub[this.subscriptionFields.userId]),
      planId: String(dbSub[this.subscriptionFields.planId]),
      priceId: String(dbSub[this.subscriptionFields.priceId]),
      status: dbSub[this.subscriptionFields.status] as SubscriptionStatus,
      billingCycle: dbSub[this.subscriptionFields.billingCycle] as BillingCycle,
      currentPeriodStart: dbSub[this.subscriptionFields.currentPeriodStart] as Date,
      currentPeriodEnd: dbSub[this.subscriptionFields.currentPeriodEnd] as Date,
      cancelAtPeriodEnd: Boolean(dbSub[this.subscriptionFields.cancelAtPeriodEnd]),
      trialEndDate: dbSub[this.subscriptionFields.trialEndDate] as Date | undefined,
      providerSubscriptionId: String(dbSub[this.subscriptionFields.providerSubscriptionId]),
      providerCustomerId: String(dbSub[this.subscriptionFields.providerCustomerId]),
      createdAt: dbSub[this.subscriptionFields.createdAt] as Date,
      updatedAt: dbSub[this.subscriptionFields.updatedAt] as Date,
    };
  }

  private mapDbTransactionToTransaction(dbTxn: Record<string, unknown>): Transaction {
    return {
      id: String(dbTxn[this.transactionFields.id]),
      userId: String(dbTxn[this.transactionFields.userId]),
      subscriptionId: dbTxn[this.transactionFields.subscriptionId]
        ? String(dbTxn[this.transactionFields.subscriptionId])
        : undefined,
      amount: Number(dbTxn[this.transactionFields.amount]),
      currency: String(dbTxn[this.transactionFields.currency]),
      status: dbTxn[this.transactionFields.status] as Transaction['status'],
      providerTransactionId: String(dbTxn[this.transactionFields.providerTransactionId]),
      createdAt: dbTxn[this.transactionFields.createdAt] as Date,
    };
  }

  // ============================================
  // USER OPERATIONS
  // ============================================

  async createUser(email: string, passwordHash: string): Promise<User> {
    const dbUser = await this.models.user.create({
      data: {
        [this.userFields.email]: email,
        [this.userFields.passwordHash]: passwordHash,
      },
    });

    return this.mapDbUserToUser(dbUser);
  }

  async getUserById(id: string): Promise<User | null> {
    const dbUser = await this.models.user.findUnique({
      where: { [this.userFields.id]: id },
    });

    return dbUser ? this.mapDbUserToUser(dbUser) : null;
  }

  async getUserByEmail(email: string): Promise<User | null> {
    const dbUser = await this.models.user.findUnique({
      where: { [this.userFields.email]: email },
    });

    return dbUser ? this.mapDbUserToUser(dbUser) : null;
  }

  async updateUser(id: string, updates: Partial<User>): Promise<User> {
    const data: Record<string, unknown> = {};

    if (updates.email !== undefined) {
      data[this.userFields.email] = updates.email;
    }
    if (updates.emailVerified !== undefined) {
      data[this.userFields.emailVerified] = updates.emailVerified;
    }
    if (updates.tier !== undefined) {
      data[this.userFields.tier] = updates.tier;
    }
    if (updates.isAdmin !== undefined) {
      data[this.userFields.isAdmin] = updates.isAdmin;
    }

    const dbUser = await this.models.user.update({
      where: { [this.userFields.id]: id },
      data,
    });

    return this.mapDbUserToUser(dbUser);
  }

  async listUsers(options: {
    page?: number;
    limit?: number;
    search?: string;
  }): Promise<{ users: User[]; total: number }> {
    const { page = 1, limit = 20, search = '' } = options;
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = {};
    if (search) {
      where[this.userFields.email] = {
        contains: search,
        mode: 'insensitive',
      };
    }

    const [dbUsers, total] = await Promise.all([
      this.models.user.findMany({
        where,
        orderBy: { [this.userFields.createdAt]: 'desc' },
        skip,
        take: limit,
      }),
      this.models.user.count({ where }),
    ]);

    return {
      users: dbUsers.map(dbUser => this.mapDbUserToUser(dbUser)),
      total,
    };
  }

  // ============================================
  // PASSWORD OPERATIONS
  // ============================================

  async getPasswordHash(userId: string): Promise<string | null> {
    const dbUser = await this.models.user.findUnique({
      where: { [this.userFields.id]: userId },
      select: { [this.userFields.passwordHash]: true },
    });

    return dbUser ? String(dbUser[this.userFields.passwordHash]) : null;
  }

  async setPasswordHash(userId: string, hash: string): Promise<void> {
    await this.models.user.update({
      where: { [this.userFields.id]: userId },
      data: { [this.userFields.passwordHash]: hash },
    });
  }

  // ============================================
  // VERIFICATION TOKEN OPERATIONS (Protected methods for BaseAdapter)
  // ============================================

  // Separate table operations
  protected async deleteVerificationTokensByUserId(userId: string): Promise<void> {
    if (this.models.verificationToken) {
      await this.models.verificationToken.deleteMany({
        where: { [this.verificationTokenFields.userId]: userId },
      });
    }
  }

  protected async insertVerificationToken(token: string, userId: string, expiresAt: Date): Promise<void> {
    if (this.models.verificationToken) {
      await this.models.verificationToken.create({
        data: {
          [this.verificationTokenFields.token]: token,
          [this.verificationTokenFields.userId]: userId,
          [this.verificationTokenFields.expiresAt]: expiresAt,
        },
      });
    }
  }

  protected async getUserByVerificationTokenFromTable(token: string): Promise<User | null> {
    if (!this.models.verificationToken) {
      return null;
    }

    const dbToken = await this.models.verificationToken.findUnique({
      where: { [this.verificationTokenFields.token]: token },
      include: { user: true },
    });

    if (!dbToken) {
      return null;
    }

    // Check expiration
    const expiresAt = dbToken[this.verificationTokenFields.expiresAt] as Date;
    if (expiresAt < new Date()) {
      return null;
    }

    const dbUser = dbToken.user as Record<string, unknown>;
    return this.mapDbUserToUser(dbUser);
  }

  protected async deleteVerificationTokenByUserId(userId: string): Promise<void> {
    if (this.models.verificationToken) {
      await this.models.verificationToken.deleteMany({
        where: { [this.verificationTokenFields.userId]: userId },
      });
    }
  }

  // User table operations (legacy mode)
  protected async updateUserVerificationToken(userId: string, token: string, expiresAt: Date): Promise<void> {
    await this.models.user.update({
      where: { [this.userFields.id]: userId },
      data: {
        [this.userFields.verificationToken]: token,
        [this.userFields.verificationTokenExpires]: expiresAt,
      },
    });
  }

  protected async getUserByVerificationTokenFromUser(token: string): Promise<User | null> {
    const dbUser = await this.models.user.findFirst({
      where: {
        [this.userFields.verificationToken]: token,
      },
    });

    if (!dbUser) {
      return null;
    }

    // Check expiration
    const expiresAt = dbUser[this.userFields.verificationTokenExpires] as Date | null;
    if (!expiresAt || expiresAt < new Date()) {
      return null;
    }

    return this.mapDbUserToUser(dbUser);
  }

  protected async clearUserVerificationToken(userId: string): Promise<void> {
    await this.models.user.update({
      where: { [this.userFields.id]: userId },
      data: {
        [this.userFields.verificationToken]: null,
        [this.userFields.verificationTokenExpires]: null,
      },
    });
  }

  // ============================================
  // PASSWORD RESET TOKEN OPERATIONS (Protected methods for BaseAdapter)
  // ============================================

  // Separate table operations
  protected async deletePasswordResetTokensByUserId(userId: string): Promise<void> {
    if (this.models.passwordResetToken) {
      await this.models.passwordResetToken.deleteMany({
        where: { [this.passwordResetTokenFields.userId]: userId },
      });
    }
  }

  protected async insertPasswordResetToken(token: string, userId: string, expiresAt: Date): Promise<void> {
    if (this.models.passwordResetToken) {
      await this.models.passwordResetToken.create({
        data: {
          [this.passwordResetTokenFields.token]: token,
          [this.passwordResetTokenFields.userId]: userId,
          [this.passwordResetTokenFields.expiresAt]: expiresAt,
        },
      });
    }
  }

  protected async getUserByPasswordResetTokenFromTable(token: string): Promise<User | null> {
    if (!this.models.passwordResetToken) {
      return null;
    }

    const dbToken = await this.models.passwordResetToken.findUnique({
      where: { [this.passwordResetTokenFields.token]: token },
      include: { user: true },
    });

    if (!dbToken) {
      return null;
    }

    // Check expiration
    const expiresAt = dbToken[this.passwordResetTokenFields.expiresAt] as Date;
    if (expiresAt < new Date()) {
      return null;
    }

    const dbUser = dbToken.user as Record<string, unknown>;
    return this.mapDbUserToUser(dbUser);
  }

  protected async deletePasswordResetTokenByUserId(userId: string): Promise<void> {
    if (this.models.passwordResetToken) {
      await this.models.passwordResetToken.deleteMany({
        where: { [this.passwordResetTokenFields.userId]: userId },
      });
    }
  }

  // User table operations (legacy mode)
  protected async updateUserPasswordResetToken(userId: string, token: string, expiresAt: Date): Promise<void> {
    await this.models.user.update({
      where: { [this.userFields.id]: userId },
      data: {
        [this.userFields.passwordResetToken]: token,
        [this.userFields.passwordResetTokenExpires]: expiresAt,
      },
    });
  }

  protected async getUserByPasswordResetTokenFromUser(token: string): Promise<User | null> {
    const dbUser = await this.models.user.findFirst({
      where: {
        [this.userFields.passwordResetToken]: token,
      },
    });

    if (!dbUser) {
      return null;
    }

    // Check expiration
    const expiresAt = dbUser[this.userFields.passwordResetTokenExpires] as Date | null;
    if (!expiresAt || expiresAt < new Date()) {
      return null;
    }

    return this.mapDbUserToUser(dbUser);
  }

  protected async clearUserPasswordResetToken(userId: string): Promise<void> {
    await this.models.user.update({
      where: { [this.userFields.id]: userId },
      data: {
        [this.userFields.passwordResetToken]: null,
        [this.userFields.passwordResetTokenExpires]: null,
      },
    });
  }

  // ============================================
  // REFRESH TOKEN OPERATIONS (Protected methods for BaseAdapter)
  // ============================================

  protected async insertRefreshToken(userId: string, token: string, expiresAt: Date): Promise<void> {
    if (this.models.refreshToken) {
      await this.models.refreshToken.create({
        data: {
          [this.refreshTokenFields.token]: token,
          [this.refreshTokenFields.userId]: userId,
          [this.refreshTokenFields.expiresAt]: expiresAt,
        },
      });
    }
  }

  protected async getRefreshTokenFromTable(token: string): Promise<{ userId: string; expiresAt: Date } | null> {
    if (!this.models.refreshToken) {
      return null;
    }

    const dbToken = await this.models.refreshToken.findUnique({
      where: { [this.refreshTokenFields.token]: token },
    });

    if (!dbToken) {
      return null;
    }

    // Check expiration
    const expiresAt = dbToken[this.refreshTokenFields.expiresAt] as Date;
    if (expiresAt < new Date()) {
      return null;
    }

    return {
      userId: String(dbToken[this.refreshTokenFields.userId]),
      expiresAt,
    };
  }

  protected async deleteRefreshTokenFromTable(token: string): Promise<void> {
    if (this.models.refreshToken) {
      await this.models.refreshToken.deleteMany({
        where: { [this.refreshTokenFields.token]: token },
      });
    }
  }

  protected async deleteAllRefreshTokensByUserId(userId: string): Promise<void> {
    if (this.models.refreshToken) {
      await this.models.refreshToken.deleteMany({
        where: { [this.refreshTokenFields.userId]: userId },
      });
    }
  }

  // ============================================
  // SUBSCRIPTION OPERATIONS
  // ============================================

  async createSubscription(
    subscription: Omit<Subscription, 'id' | 'createdAt' | 'updatedAt'>
  ): Promise<Subscription> {
    if (!this.models.subscription) {
      throw new Error('Subscription model not configured');
    }

    const data: Record<string, unknown> = {
      [this.subscriptionFields.userId]: subscription.userId,
      [this.subscriptionFields.planId]: subscription.planId,
      [this.subscriptionFields.priceId]: subscription.priceId,
      [this.subscriptionFields.status]: subscription.status,
      [this.subscriptionFields.billingCycle]: subscription.billingCycle,
      [this.subscriptionFields.currentPeriodStart]: subscription.currentPeriodStart,
      [this.subscriptionFields.currentPeriodEnd]: subscription.currentPeriodEnd,
      [this.subscriptionFields.cancelAtPeriodEnd]: subscription.cancelAtPeriodEnd,
      [this.subscriptionFields.providerSubscriptionId]: subscription.providerSubscriptionId,
      [this.subscriptionFields.providerCustomerId]: subscription.providerCustomerId,
    };

    if (subscription.trialEndDate) {
      data[this.subscriptionFields.trialEndDate] = subscription.trialEndDate;
    }

    const dbSub = await this.models.subscription.create({ data });

    return this.mapDbSubscriptionToSubscription(dbSub);
  }

  async getSubscriptionByUserId(userId: string): Promise<Subscription | null> {
    if (!this.models.subscription) {
      return null;
    }

    const dbSub = await this.models.subscription.findUnique({
      where: { [this.subscriptionFields.userId]: userId },
    });

    return dbSub ? this.mapDbSubscriptionToSubscription(dbSub) : null;
  }

  async getSubscriptionByProviderId(providerSubscriptionId: string): Promise<Subscription | null> {
    if (!this.models.subscription) {
      return null;
    }

    const dbSub = await this.models.subscription.findUnique({
      where: { [this.subscriptionFields.providerSubscriptionId]: providerSubscriptionId },
    });

    return dbSub ? this.mapDbSubscriptionToSubscription(dbSub) : null;
  }

  async updateSubscription(id: string, updates: Partial<Subscription>): Promise<Subscription> {
    if (!this.models.subscription) {
      throw new Error('Subscription model not configured');
    }

    const data: Record<string, unknown> = {};

    if (updates.planId !== undefined) {
      data[this.subscriptionFields.planId] = updates.planId;
    }
    if (updates.priceId !== undefined) {
      data[this.subscriptionFields.priceId] = updates.priceId;
    }
    if (updates.status !== undefined) {
      data[this.subscriptionFields.status] = updates.status;
    }
    if (updates.billingCycle !== undefined) {
      data[this.subscriptionFields.billingCycle] = updates.billingCycle;
    }
    if (updates.currentPeriodStart !== undefined) {
      data[this.subscriptionFields.currentPeriodStart] = updates.currentPeriodStart;
    }
    if (updates.currentPeriodEnd !== undefined) {
      data[this.subscriptionFields.currentPeriodEnd] = updates.currentPeriodEnd;
    }
    if (updates.cancelAtPeriodEnd !== undefined) {
      data[this.subscriptionFields.cancelAtPeriodEnd] = updates.cancelAtPeriodEnd;
    }
    if (updates.trialEndDate !== undefined) {
      data[this.subscriptionFields.trialEndDate] = updates.trialEndDate;
    }
    if (updates.providerSubscriptionId !== undefined) {
      data[this.subscriptionFields.providerSubscriptionId] = updates.providerSubscriptionId;
    }
    if (updates.providerCustomerId !== undefined) {
      data[this.subscriptionFields.providerCustomerId] = updates.providerCustomerId;
    }

    const dbSub = await this.models.subscription.update({
      where: { [this.subscriptionFields.id]: id },
      data,
    });

    return this.mapDbSubscriptionToSubscription(dbSub);
  }

  // ============================================
  // TRANSACTION OPERATIONS
  // ============================================

  async createTransaction(
    transaction: Omit<Transaction, 'id' | 'createdAt'>
  ): Promise<Transaction> {
    if (!this.models.transaction) {
      throw new Error('Transaction model not configured');
    }

    const data: Record<string, unknown> = {
      [this.transactionFields.userId]: transaction.userId,
      [this.transactionFields.amount]: transaction.amount,
      [this.transactionFields.currency]: transaction.currency,
      [this.transactionFields.status]: transaction.status,
      [this.transactionFields.providerTransactionId]: transaction.providerTransactionId,
    };

    if (transaction.subscriptionId) {
      data[this.transactionFields.subscriptionId] = transaction.subscriptionId;
    }

    const dbTxn = await this.models.transaction.create({ data });

    return this.mapDbTransactionToTransaction(dbTxn);
  }

  async getTransactionByProviderId(providerTransactionId: string): Promise<Transaction | null> {
    if (!this.models.transaction) {
      return null;
    }

    const dbTxn = await this.models.transaction.findFirst({
      where: { [this.transactionFields.providerTransactionId]: providerTransactionId },
    });

    return dbTxn ? this.mapDbTransactionToTransaction(dbTxn) : null;
  }

  // ============================================
  // PROVIDER CUSTOMER ID OPERATIONS
  // ============================================

  async setProviderCustomerId(userId: string, providerId: string): Promise<void> {
    await this.models.user.update({
      where: { [this.userFields.id]: userId },
      data: { [this.userFields.providerCustomerId]: providerId },
    });
  }

  async getUserByProviderCustomerId(providerId: string): Promise<User | null> {
    const dbUser = await this.models.user.findFirst({
      where: { [this.userFields.providerCustomerId]: providerId },
    });

    return dbUser ? this.mapDbUserToUser(dbUser) : null;
  }
}

// ============================================
// EXPORTS
// ============================================

export type { DatabaseAdapter, User, Subscription, Transaction } from '@subauth/core';

import { Pool, PoolConfig } from 'pg';
import { BaseAdapter, BaseAdapterConfig } from '@subauth/adapter-base';
import type {
  User,
  Subscription,
  Transaction,
  SubscriptionStatus,
  BillingCycle,
} from '@subauth/core';

// Database row types (snake_case from PostgreSQL)
interface UserRow {
  id: string;
  email: string;
  email_verified: boolean;
  created_at: Date;
}

interface SubscriptionRow {
  id: string;
  user_id: string;
  plan_id: string;
  price_id: string;
  status: SubscriptionStatus;
  billing_cycle: BillingCycle;
  current_period_start: Date;
  current_period_end: Date;
  cancel_at_period_end: boolean;
  trial_end_date: Date | null;
  provider_subscription_id: string;
  provider_customer_id: string;
  created_at: Date;
  updated_at: Date;
}

interface TransactionRow {
  id: string;
  user_id: string;
  subscription_id: string | null;
  amount: number;
  currency: string;
  status: 'pending' | 'completed' | 'failed' | 'refunded';
  provider_transaction_id: string;
  created_at: Date;
}

// Configuration options for the adapter
export interface PostgreSQLAdapterConfig extends PoolConfig, BaseAdapterConfig {
  // Additional configuration can be added here
}

/**
 * PostgreSQL implementation of the DatabaseAdapter interface.
 * Extends BaseAdapter for shared token operation logic.
 */
export class PostgreSQLAdapter extends BaseAdapter {
  private pool: Pool;

  constructor(config: PostgreSQLAdapterConfig) {
    super(config);
    this.pool = new Pool(config);
  }

  /**
   * Close the database connection pool.
   * Should be called when shutting down the application.
   */
  async close(): Promise<void> {
    await this.pool.end();
  }

  // ============================================
  // HELPER METHODS
  // ============================================

  private mapUserRow(row: UserRow): User {
    return {
      id: String(row.id),
      email: row.email,
      emailVerified: row.email_verified,
      createdAt: row.created_at,
    };
  }

  private mapSubscriptionRow(row: SubscriptionRow): Subscription {
    return {
      id: String(row.id),
      userId: String(row.user_id),
      planId: row.plan_id,
      priceId: row.price_id,
      status: row.status,
      billingCycle: row.billing_cycle,
      currentPeriodStart: row.current_period_start,
      currentPeriodEnd: row.current_period_end,
      cancelAtPeriodEnd: row.cancel_at_period_end,
      trialEndDate: row.trial_end_date ?? undefined,
      providerSubscriptionId: row.provider_subscription_id,
      providerCustomerId: row.provider_customer_id,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  private mapTransactionRow(row: TransactionRow): Transaction {
    return {
      id: String(row.id),
      userId: String(row.user_id),
      subscriptionId: row.subscription_id ? String(row.subscription_id) : undefined,
      amount: row.amount,
      currency: row.currency,
      status: row.status,
      providerTransactionId: row.provider_transaction_id,
      createdAt: row.created_at,
    };
  }

  // ============================================
  // USER OPERATIONS
  // ============================================

  async createUser(email: string, passwordHash: string): Promise<User> {
    const sql = `
      INSERT INTO users (email, password_hash)
      VALUES ($1, $2)
      RETURNING id, email, email_verified, created_at
    `;
    const result = await this.pool.query<UserRow>(sql, [email, passwordHash]);
    return this.mapUserRow(result.rows[0]);
  }

  async getUserById(id: string): Promise<User | null> {
    const sql = `
      SELECT id, email, email_verified, created_at
      FROM users
      WHERE id = $1
    `;
    const result = await this.pool.query<UserRow>(sql, [id]);
    if (result.rows.length === 0) {
      return null;
    }
    return this.mapUserRow(result.rows[0]);
  }

  async getUserByEmail(email: string): Promise<User | null> {
    const sql = `
      SELECT id, email, email_verified, created_at
      FROM users
      WHERE email = $1
    `;
    const result = await this.pool.query<UserRow>(sql, [email]);
    if (result.rows.length === 0) {
      return null;
    }
    return this.mapUserRow(result.rows[0]);
  }

  async updateUser(id: string, updates: Partial<User>): Promise<User> {
    const setClauses: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    if (updates.email !== undefined) {
      setClauses.push('email = $' + paramIndex++);
      values.push(updates.email);
    }
    if (updates.emailVerified !== undefined) {
      setClauses.push('email_verified = $' + paramIndex++);
      values.push(updates.emailVerified);
    }

    if (setClauses.length === 0) {
      const user = await this.getUserById(id);
      if (!user) {
        throw new Error('User not found');
      }
      return user;
    }

    values.push(id);
    const sql = `
      UPDATE users
      SET ` + setClauses.join(', ') + `
      WHERE id = $` + paramIndex + `
      RETURNING id, email, email_verified, created_at
    `;
    const result = await this.pool.query<UserRow>(sql, values);
    if (result.rows.length === 0) {
      throw new Error('User not found');
    }
    return this.mapUserRow(result.rows[0]);
  }

  // ============================================
  // PASSWORD OPERATIONS
  // ============================================

  async getPasswordHash(userId: string): Promise<string | null> {
    const sql = `
      SELECT password_hash
      FROM users
      WHERE id = $1
    `;
    const result = await this.pool.query<{ password_hash: string }>(sql, [userId]);
    if (result.rows.length === 0) {
      return null;
    }
    return result.rows[0].password_hash;
  }

  async setPasswordHash(userId: string, hash: string): Promise<void> {
    const sql = `
      UPDATE users
      SET password_hash = $2
      WHERE id = $1
    `;
    await this.pool.query(sql, [userId, hash]);
  }

  // ============================================
  // VERIFICATION TOKEN OPERATIONS (Protected methods for BaseAdapter)
  // ============================================

  // Separate table operations
  protected async deleteVerificationTokensByUserId(userId: string): Promise<void> {
    const sql = `DELETE FROM verification_tokens WHERE user_id = $1`;
    await this.pool.query(sql, [userId]);
  }

  protected async insertVerificationToken(token: string, userId: string, expiresAt: Date): Promise<void> {
    const sql = `
      INSERT INTO verification_tokens (token, user_id, expires_at)
      VALUES ($1, $2, $3)
    `;
    await this.pool.query(sql, [token, userId, expiresAt]);
  }

  protected async getUserByVerificationTokenFromTable(token: string): Promise<User | null> {
    const sql = `
      SELECT u.id, u.email, u.email_verified, u.created_at
      FROM users u
      JOIN verification_tokens vt ON u.id = vt.user_id
      WHERE vt.token = $1 AND vt.expires_at > NOW()
    `;
    const result = await this.pool.query<UserRow>(sql, [token]);
    if (result.rows.length === 0) {
      return null;
    }
    return this.mapUserRow(result.rows[0]);
  }

  protected async deleteVerificationTokenByUserId(userId: string): Promise<void> {
    const sql = `DELETE FROM verification_tokens WHERE user_id = $1`;
    await this.pool.query(sql, [userId]);
  }

  // User table operations (legacy mode)
  protected async updateUserVerificationToken(userId: string, token: string, expiresAt: Date): Promise<void> {
    const sql = `
      UPDATE users
      SET verification_token = $2, verification_token_expires = $3
      WHERE id = $1
    `;
    await this.pool.query(sql, [userId, token, expiresAt]);
  }

  protected async getUserByVerificationTokenFromUser(token: string): Promise<User | null> {
    const sql = `
      SELECT id, email, email_verified, created_at
      FROM users
      WHERE verification_token = $1
        AND verification_token_expires > NOW()
    `;
    const result = await this.pool.query<UserRow>(sql, [token]);
    if (result.rows.length === 0) {
      return null;
    }
    return this.mapUserRow(result.rows[0]);
  }

  protected async clearUserVerificationToken(userId: string): Promise<void> {
    const sql = `
      UPDATE users
      SET verification_token = NULL, verification_token_expires = NULL
      WHERE id = $1
    `;
    await this.pool.query(sql, [userId]);
  }

  // ============================================
  // PASSWORD RESET TOKEN OPERATIONS (Protected methods for BaseAdapter)
  // ============================================

  // Separate table operations
  protected async deletePasswordResetTokensByUserId(userId: string): Promise<void> {
    const sql = `DELETE FROM password_reset_tokens WHERE user_id = $1`;
    await this.pool.query(sql, [userId]);
  }

  protected async insertPasswordResetToken(token: string, userId: string, expiresAt: Date): Promise<void> {
    const sql = `
      INSERT INTO password_reset_tokens (token, user_id, expires_at)
      VALUES ($1, $2, $3)
    `;
    await this.pool.query(sql, [token, userId, expiresAt]);
  }

  protected async getUserByPasswordResetTokenFromTable(token: string): Promise<User | null> {
    const sql = `
      SELECT u.id, u.email, u.email_verified, u.created_at
      FROM users u
      JOIN password_reset_tokens prt ON u.id = prt.user_id
      WHERE prt.token = $1 AND prt.expires_at > NOW()
    `;
    const result = await this.pool.query<UserRow>(sql, [token]);
    if (result.rows.length === 0) {
      return null;
    }
    return this.mapUserRow(result.rows[0]);
  }

  protected async deletePasswordResetTokenByUserId(userId: string): Promise<void> {
    const sql = `DELETE FROM password_reset_tokens WHERE user_id = $1`;
    await this.pool.query(sql, [userId]);
  }

  // User table operations (legacy mode)
  protected async updateUserPasswordResetToken(userId: string, token: string, expiresAt: Date): Promise<void> {
    const sql = `
      UPDATE users
      SET password_reset_token = $2, password_reset_token_expires = $3
      WHERE id = $1
    `;
    await this.pool.query(sql, [userId, token, expiresAt]);
  }

  protected async getUserByPasswordResetTokenFromUser(token: string): Promise<User | null> {
    const sql = `
      SELECT id, email, email_verified, created_at
      FROM users
      WHERE password_reset_token = $1
        AND password_reset_token_expires > NOW()
    `;
    const result = await this.pool.query<UserRow>(sql, [token]);
    if (result.rows.length === 0) {
      return null;
    }
    return this.mapUserRow(result.rows[0]);
  }

  protected async clearUserPasswordResetToken(userId: string): Promise<void> {
    const sql = `
      UPDATE users
      SET password_reset_token = NULL, password_reset_token_expires = NULL
      WHERE id = $1
    `;
    await this.pool.query(sql, [userId]);
  }

  // ============================================
  // REFRESH TOKEN OPERATIONS (Protected methods for BaseAdapter)
  // ============================================

  protected async insertRefreshToken(userId: string, token: string, expiresAt: Date): Promise<void> {
    const sql = `
      INSERT INTO refresh_tokens (token, user_id, expires_at)
      VALUES ($1, $2, $3)
    `;
    await this.pool.query(sql, [token, userId, expiresAt]);
  }

  protected async getRefreshTokenFromTable(token: string): Promise<{ userId: string; expiresAt: Date } | null> {
    const sql = `
      SELECT user_id, expires_at
      FROM refresh_tokens
      WHERE token = $1 AND expires_at > NOW()
    `;
    const result = await this.pool.query<{ user_id: string; expires_at: Date }>(sql, [token]);
    if (result.rows.length === 0) {
      return null;
    }
    return {
      userId: String(result.rows[0].user_id),
      expiresAt: result.rows[0].expires_at,
    };
  }

  protected async deleteRefreshTokenFromTable(token: string): Promise<void> {
    const sql = `DELETE FROM refresh_tokens WHERE token = $1`;
    await this.pool.query(sql, [token]);
  }

  protected async deleteAllRefreshTokensByUserId(userId: string): Promise<void> {
    const sql = `DELETE FROM refresh_tokens WHERE user_id = $1`;
    await this.pool.query(sql, [userId]);
  }

  // ============================================
  // SUBSCRIPTION OPERATIONS
  // ============================================

  async createSubscription(
    subscription: Omit<Subscription, 'id' | 'createdAt' | 'updatedAt'>
  ): Promise<Subscription> {
    const sql = `
      INSERT INTO subscriptions (
        user_id, plan_id, price_id, status, billing_cycle,
        current_period_start, current_period_end, cancel_at_period_end,
        trial_end_date, provider_subscription_id, provider_customer_id
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      RETURNING
        id, user_id, plan_id, price_id, status, billing_cycle,
        current_period_start, current_period_end, cancel_at_period_end,
        trial_end_date, provider_subscription_id, provider_customer_id,
        created_at, updated_at
    `;
    const result = await this.pool.query<SubscriptionRow>(sql, [
      subscription.userId,
      subscription.planId,
      subscription.priceId,
      subscription.status,
      subscription.billingCycle,
      subscription.currentPeriodStart,
      subscription.currentPeriodEnd,
      subscription.cancelAtPeriodEnd,
      subscription.trialEndDate ?? null,
      subscription.providerSubscriptionId,
      subscription.providerCustomerId,
    ]);
    return this.mapSubscriptionRow(result.rows[0]);
  }

  async getSubscriptionByUserId(userId: string): Promise<Subscription | null> {
    const sql = `
      SELECT
        id, user_id, plan_id, price_id, status, billing_cycle,
        current_period_start, current_period_end, cancel_at_period_end,
        trial_end_date, provider_subscription_id, provider_customer_id,
        created_at, updated_at
      FROM subscriptions
      WHERE user_id = $1
      ORDER BY created_at DESC
      LIMIT 1
    `;
    const result = await this.pool.query<SubscriptionRow>(sql, [userId]);
    if (result.rows.length === 0) {
      return null;
    }
    return this.mapSubscriptionRow(result.rows[0]);
  }

  async getSubscriptionByProviderId(providerSubscriptionId: string): Promise<Subscription | null> {
    const sql = `
      SELECT
        id, user_id, plan_id, price_id, status, billing_cycle,
        current_period_start, current_period_end, cancel_at_period_end,
        trial_end_date, provider_subscription_id, provider_customer_id,
        created_at, updated_at
      FROM subscriptions
      WHERE provider_subscription_id = $1
      ORDER BY created_at DESC
      LIMIT 1
    `;
    const result = await this.pool.query<SubscriptionRow>(sql, [providerSubscriptionId]);
    if (result.rows.length === 0) {
      return null;
    }
    return this.mapSubscriptionRow(result.rows[0]);
  }

  async updateSubscription(id: string, updates: Partial<Subscription>): Promise<Subscription> {
    const setClauses: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    if (updates.planId !== undefined) {
      setClauses.push('plan_id = $' + paramIndex++);
      values.push(updates.planId);
    }
    if (updates.priceId !== undefined) {
      setClauses.push('price_id = $' + paramIndex++);
      values.push(updates.priceId);
    }
    if (updates.status !== undefined) {
      setClauses.push('status = $' + paramIndex++);
      values.push(updates.status);
    }
    if (updates.billingCycle !== undefined) {
      setClauses.push('billing_cycle = $' + paramIndex++);
      values.push(updates.billingCycle);
    }
    if (updates.currentPeriodStart !== undefined) {
      setClauses.push('current_period_start = $' + paramIndex++);
      values.push(updates.currentPeriodStart);
    }
    if (updates.currentPeriodEnd !== undefined) {
      setClauses.push('current_period_end = $' + paramIndex++);
      values.push(updates.currentPeriodEnd);
    }
    if (updates.cancelAtPeriodEnd !== undefined) {
      setClauses.push('cancel_at_period_end = $' + paramIndex++);
      values.push(updates.cancelAtPeriodEnd);
    }
    if (updates.trialEndDate !== undefined) {
      setClauses.push('trial_end_date = $' + paramIndex++);
      values.push(updates.trialEndDate);
    }
    if (updates.providerSubscriptionId !== undefined) {
      setClauses.push('provider_subscription_id = $' + paramIndex++);
      values.push(updates.providerSubscriptionId);
    }
    if (updates.providerCustomerId !== undefined) {
      setClauses.push('provider_customer_id = $' + paramIndex++);
      values.push(updates.providerCustomerId);
    }

    setClauses.push('updated_at = NOW()');

    values.push(id);
    const sql = `
      UPDATE subscriptions
      SET ` + setClauses.join(', ') + `
      WHERE id = $` + paramIndex + `
      RETURNING
        id, user_id, plan_id, price_id, status, billing_cycle,
        current_period_start, current_period_end, cancel_at_period_end,
        trial_end_date, provider_subscription_id, provider_customer_id,
        created_at, updated_at
    `;
    const result = await this.pool.query<SubscriptionRow>(sql, values);
    if (result.rows.length === 0) {
      throw new Error('Subscription not found');
    }
    return this.mapSubscriptionRow(result.rows[0]);
  }

  // ============================================
  // TRANSACTION OPERATIONS
  // ============================================

  async createTransaction(
    transaction: Omit<Transaction, 'id' | 'createdAt'>
  ): Promise<Transaction> {
    const sql = `
      INSERT INTO transactions (
        user_id, subscription_id, amount, currency, status, provider_transaction_id
      )
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING
        id, user_id, subscription_id, amount, currency, status,
        provider_transaction_id, created_at
    `;
    const result = await this.pool.query<TransactionRow>(sql, [
      transaction.userId,
      transaction.subscriptionId ?? null,
      transaction.amount,
      transaction.currency,
      transaction.status,
      transaction.providerTransactionId,
    ]);
    return this.mapTransactionRow(result.rows[0]);
  }

  async getTransactionByProviderId(providerTransactionId: string): Promise<Transaction | null> {
    const sql = `
      SELECT
        id, user_id, subscription_id, amount, currency, status,
        provider_transaction_id, created_at
      FROM transactions
      WHERE provider_transaction_id = $1
    `;
    const result = await this.pool.query<TransactionRow>(sql, [providerTransactionId]);
    if (result.rows.length === 0) {
      return null;
    }
    return this.mapTransactionRow(result.rows[0]);
  }

  // ============================================
  // PROVIDER CUSTOMER ID OPERATIONS
  // ============================================

  async setProviderCustomerId(userId: string, providerId: string): Promise<void> {
    const sql = `
      UPDATE users
      SET provider_customer_id = $2
      WHERE id = $1
    `;
    await this.pool.query(sql, [userId, providerId]);
  }

  async getUserByProviderCustomerId(providerId: string): Promise<User | null> {
    const sql = `
      SELECT id, email, email_verified, created_at
      FROM users
      WHERE provider_customer_id = $1
    `;
    const result = await this.pool.query<UserRow>(sql, [providerId]);
    if (result.rows.length === 0) {
      return null;
    }
    return this.mapUserRow(result.rows[0]);
  }
}

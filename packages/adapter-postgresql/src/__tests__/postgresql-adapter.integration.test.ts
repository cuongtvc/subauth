import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { PostgreSQLAdapter } from '../index';
import { Pool } from 'pg';

/**
 * Integration tests for PostgreSQLAdapter.
 * These tests require a running PostgreSQL instance.
 * 
 * Set environment variables before running:
 * - TEST_DB_HOST (default: localhost)
 * - TEST_DB_PORT (default: 5432)
 * - TEST_DB_NAME (default: subauth_test)
 * - TEST_DB_USER (default: postgres)
 * - TEST_DB_PASSWORD (default: postgres)
 * 
 */

const config = {
  host: process.env.TEST_DB_HOST || 'localhost',
  port: parseInt(process.env.TEST_DB_PORT || '5432'),
  database: process.env.TEST_DB_NAME || 'subauth_test',
  user: process.env.TEST_DB_USER || 'postgres',
  password: process.env.TEST_DB_PASSWORD || 'postgres',
};

describe('PostgreSQLAdapter Integration Tests', () => {
  let adapter: PostgreSQLAdapter;
  let pool: Pool;

  beforeAll(async () => {
    pool = new Pool(config);
    
    // Create tables
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        email VARCHAR(255) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        email_verified BOOLEAN DEFAULT FALSE,
        verification_token VARCHAR(255) UNIQUE,
        verification_token_expires TIMESTAMP,
        password_reset_token VARCHAR(255) UNIQUE,
        password_reset_token_expires TIMESTAMP,
        provider_customer_id VARCHAR(255) UNIQUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS subscriptions (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        plan_id VARCHAR(255) NOT NULL,
        price_id VARCHAR(255) NOT NULL,
        status VARCHAR(50) NOT NULL,
        billing_cycle VARCHAR(50) NOT NULL,
        current_period_start TIMESTAMP NOT NULL,
        current_period_end TIMESTAMP NOT NULL,
        cancel_at_period_end BOOLEAN DEFAULT FALSE,
        trial_end_date TIMESTAMP,
        provider_subscription_id VARCHAR(255),
        provider_customer_id VARCHAR(255),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS transactions (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        subscription_id INTEGER REFERENCES subscriptions(id) ON DELETE SET NULL,
        amount INTEGER NOT NULL,
        currency VARCHAR(10) NOT NULL,
        status VARCHAR(50) NOT NULL,
        provider_transaction_id VARCHAR(255) UNIQUE NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS verification_tokens (
        token VARCHAR(255) PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        expires_at TIMESTAMP NOT NULL
      )
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS password_reset_tokens (
        token VARCHAR(255) PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        expires_at TIMESTAMP NOT NULL
      )
    `);

    adapter = new PostgreSQLAdapter(config);
  });

  afterAll(async () => {
    await adapter.close();

    // Clean up tables
    await pool.query('DROP TABLE IF EXISTS transactions CASCADE');
    await pool.query('DROP TABLE IF EXISTS subscriptions CASCADE');
    await pool.query('DROP TABLE IF EXISTS verification_tokens CASCADE');
    await pool.query('DROP TABLE IF EXISTS password_reset_tokens CASCADE');
    await pool.query('DROP TABLE IF EXISTS users CASCADE');
    await pool.end();
  });

  beforeEach(async () => {
    // Clean data before each test
    await pool.query('DELETE FROM transactions');
    await pool.query('DELETE FROM subscriptions');
    await pool.query('DELETE FROM verification_tokens');
    await pool.query('DELETE FROM password_reset_tokens');
    await pool.query('DELETE FROM users');
  });

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
      // Use 7 days ago to avoid clock skew issues with Docker containers
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

  describe('Provider Customer ID Operations', () => {
    it('should set and get user by provider customer ID', async () => {
      const user = await adapter.createUser('cust@example.com', 'hashed');
      
      await adapter.setProviderCustomerId(user.id, 'cus_paddle_789');
      
      const found = await adapter.getUserByProviderCustomerId('cus_paddle_789');
      expect(found?.id).toBe(user.id);
    });
  });
});

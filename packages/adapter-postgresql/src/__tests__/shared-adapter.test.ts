import { describe } from 'vitest';
import { createDatabaseAdapterTests } from '@subauth/adapter-test-utils';
import { PostgreSQLAdapter } from '../index';
import { Pool } from 'pg';
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql';

/**
 * Shared adapter tests for PostgreSQLAdapter using Testcontainers.
 * These tests verify that the adapter implements the DatabaseAdapter contract correctly.
 *
 * Prerequisites: Docker must be running
 *
 * Run with: TEST_INTEGRATION=true pnpm test
 */

const isIntegrationTest = process.env.TEST_INTEGRATION === 'true';

describe.skipIf(!isIntegrationTest)('PostgreSQLAdapter - Shared Contract Tests', () => {
  let container: StartedPostgreSqlContainer;
  let pool: Pool;
  let adapter: PostgreSQLAdapter;

  const setup = async () => {
    // Start PostgreSQL container
    container = await new PostgreSqlContainer('postgres:16-alpine')
      .withDatabase('subauth_test')
      .withUsername('postgres')
      .withPassword('postgres')
      .start();

    const config = {
      host: container.getHost(),
      port: container.getPort(),
      database: container.getDatabase(),
      user: container.getUsername(),
      password: container.getPassword(),
    };

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

    adapter = new PostgreSQLAdapter(config);
  };

  const cleanup = async () => {
    await pool.query('DELETE FROM transactions');
    await pool.query('DELETE FROM subscriptions');
    await pool.query('DELETE FROM users');
  };

  const teardown = async () => {
    await adapter.close();
    await pool.end();
    await container.stop();
  };

  createDatabaseAdapterTests({
    name: 'PostgreSQL',
    createAdapter: () => adapter,
    setup,
    cleanup,
    teardown,
  });
});

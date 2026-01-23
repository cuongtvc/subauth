-- AuthPaddle PostgreSQL Schema
-- This schema provides the database structure for the @authpaddle/adapter-postgresql package.

-- ============================================
-- USERS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  email_verified BOOLEAN DEFAULT FALSE,
  
  -- Verification token for email verification
  verification_token VARCHAR(255) UNIQUE,
  verification_token_expires TIMESTAMP,
  
  -- Password reset token
  password_reset_token VARCHAR(255) UNIQUE,
  password_reset_token_expires TIMESTAMP,
  
  -- Provider customer ID (Paddle, Stripe, etc.)
  provider_customer_id VARCHAR(255) UNIQUE,
  
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for users table
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_verification_token ON users(verification_token);
CREATE INDEX IF NOT EXISTS idx_users_password_reset_token ON users(password_reset_token);
CREATE INDEX IF NOT EXISTS idx_users_provider_customer_id ON users(provider_customer_id);

-- ============================================
-- SUBSCRIPTIONS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS subscriptions (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  
  -- Plan and pricing
  plan_id VARCHAR(255) NOT NULL,
  price_id VARCHAR(255) NOT NULL,
  
  -- Status tracking
  status VARCHAR(50) NOT NULL CHECK(status IN ('trialing', 'active', 'canceled', 'past_due', 'paused', 'incomplete')),
  billing_cycle VARCHAR(50) NOT NULL CHECK(billing_cycle IN ('monthly', 'annual', 'one_time')),
  
  -- Period dates
  current_period_start TIMESTAMP NOT NULL,
  current_period_end TIMESTAMP NOT NULL,
  cancel_at_period_end BOOLEAN DEFAULT FALSE,
  trial_end_date TIMESTAMP,
  
  -- Provider IDs (Paddle, Stripe subscription ID)
  provider_subscription_id VARCHAR(255),
  provider_customer_id VARCHAR(255),
  
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for subscriptions table
CREATE INDEX IF NOT EXISTS idx_subscriptions_user_id ON subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_provider_subscription_id ON subscriptions(provider_subscription_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_provider_customer_id ON subscriptions(provider_customer_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON subscriptions(status);

-- ============================================
-- TRANSACTIONS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS transactions (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  subscription_id INTEGER REFERENCES subscriptions(id) ON DELETE SET NULL,
  
  -- Transaction details
  amount INTEGER NOT NULL, -- Amount in cents
  currency VARCHAR(10) NOT NULL,
  status VARCHAR(50) NOT NULL CHECK(status IN ('pending', 'completed', 'failed', 'refunded')),
  
  -- Provider transaction ID
  provider_transaction_id VARCHAR(255) UNIQUE NOT NULL,
  
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for transactions table
CREATE INDEX IF NOT EXISTS idx_transactions_user_id ON transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_transactions_subscription_id ON transactions(subscription_id);
CREATE INDEX IF NOT EXISTS idx_transactions_provider_transaction_id ON transactions(provider_transaction_id);
CREATE INDEX IF NOT EXISTS idx_transactions_status ON transactions(status);

-- ============================================
-- TRIGGER: Auto-update updated_at
-- ============================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply trigger to subscriptions
DROP TRIGGER IF EXISTS update_subscriptions_updated_at ON subscriptions;
CREATE TRIGGER update_subscriptions_updated_at
  BEFORE UPDATE ON subscriptions
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

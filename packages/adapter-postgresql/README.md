# @authpaddle/adapter-postgresql

PostgreSQL adapter for AuthPaddle - a pure TypeScript implementation of the `DatabaseAdapter` interface.

## Installation

```bash
npm install @authpaddle/adapter-postgresql pg
# or
pnpm add @authpaddle/adapter-postgresql pg
```

## Quick Start

```typescript
import { PostgreSQLAdapter } from '@authpaddle/adapter-postgresql';
import { AuthService } from '@authpaddle/backend';

// Create the adapter
const dbAdapter = new PostgreSQLAdapter({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME || 'myapp',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
  max: 20, // Max pool connections
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

// Use with AuthPaddle services
const authService = new AuthService({
  database: dbAdapter,
  // ... other config
});
```

## Database Setup

Run the provided SQL schema to create the required tables:

```bash
psql -U postgres -d myapp -f node_modules/@authpaddle/adapter-postgresql/sql/schema.sql
```

Or copy and run the SQL from `sql/schema.sql`.

### Required Tables

The adapter requires these tables:

1. **users** - User accounts with authentication tokens
2. **subscriptions** - Subscription records with provider IDs
3. **transactions** - Payment transaction records

## Configuration

The adapter accepts all standard `pg.Pool` configuration options:

```typescript
interface PostgreSQLAdapterConfig {
  host?: string;
  port?: number;
  database?: string;
  user?: string;
  password?: string;
  connectionString?: string;
  max?: number;                    // Max pool size (default: 10)
  idleTimeoutMillis?: number;      // Close idle clients after ms
  connectionTimeoutMillis?: number; // Timeout for new connections
  ssl?: boolean | object;          // SSL configuration
}
```

## API Reference

The adapter implements all `DatabaseAdapter` interface methods:

### User Operations

```typescript
// Create a new user
const user = await adapter.createUser('user@example.com', 'hashed_password');

// Get user by ID
const user = await adapter.getUserById('123');

// Get user by email
const user = await adapter.getUserByEmail('user@example.com');

// Update user
const updated = await adapter.updateUser('123', { emailVerified: true });
```

### Password Operations

```typescript
// Get password hash for verification
const hash = await adapter.getPasswordHash('user_id');

// Set new password hash
await adapter.setPasswordHash('user_id', 'new_hashed_password');
```

### Email Verification

```typescript
// Set verification token
await adapter.setVerificationToken('user_id', 'token', expiresAt);

// Get user by verification token
const user = await adapter.getUserByVerificationToken('token');

// Clear verification token
await adapter.clearVerificationToken('user_id');
```

### Password Reset

```typescript
// Set password reset token
await adapter.setPasswordResetToken('user_id', 'token', expiresAt);

// Get user by reset token
const user = await adapter.getUserByPasswordResetToken('token');

// Clear reset token
await adapter.clearPasswordResetToken('user_id');
```

### Subscriptions

```typescript
// Create subscription
const subscription = await adapter.createSubscription({
  userId: '123',
  planId: 'plan_basic',
  priceId: 'price_monthly',
  status: 'active',
  billingCycle: 'monthly',
  currentPeriodStart: new Date(),
  currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
  cancelAtPeriodEnd: false,
  providerSubscriptionId: 'sub_xxx',
  providerCustomerId: 'cus_xxx',
});

// Get subscription by user ID
const subscription = await adapter.getSubscriptionByUserId('123');

// Get subscription by provider ID (Paddle/Stripe subscription ID)
const subscription = await adapter.getSubscriptionByProviderId('sub_xxx');

// Update subscription
const updated = await adapter.updateSubscription('sub_id', {
  status: 'canceled',
  cancelAtPeriodEnd: true,
});
```

### Transactions

```typescript
// Create transaction
const transaction = await adapter.createTransaction({
  userId: '123',
  subscriptionId: 'sub_id',
  amount: 1999,
  currency: 'USD',
  status: 'completed',
  providerTransactionId: 'txn_xxx',
});

// Get transaction by provider ID
const transaction = await adapter.getTransactionByProviderId('txn_xxx');
```

### Provider Customer ID

```typescript
// Set provider customer ID (Paddle/Stripe customer ID)
await adapter.setProviderCustomerId('user_id', 'cus_xxx');

// Get user by provider customer ID
const user = await adapter.getUserByProviderCustomerId('cus_xxx');
```

### Connection Management

```typescript
// Close the connection pool (call on app shutdown)
await adapter.close();
```

## Testing

### Unit Tests

```bash
pnpm test
```

### Integration Tests

Integration tests require a running PostgreSQL instance:

```bash
# Set environment variables
export TEST_INTEGRATION=true
export TEST_DB_HOST=localhost
export TEST_DB_PORT=5432
export TEST_DB_NAME=authpaddle_test
export TEST_DB_USER=postgres
export TEST_DB_PASSWORD=postgres

# Create test database
createdb authpaddle_test

# Run tests
pnpm test
```

## License

MIT

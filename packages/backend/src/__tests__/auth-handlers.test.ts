import { describe, it, expect, beforeEach } from 'vitest';
import type {
  DatabaseAdapter,
  EmailAdapter,
  User,
  AuthConfig,
} from '@subauth/core';

// Import will fail until we implement - that's TDD!
import { createAuthHandlers } from '../handlers/auth-handlers';
import type { AuthRequest, AuthResponse } from '../handlers/types';

// ============================================
// MOCK HELPERS
// ============================================

function createMockDatabaseAdapter(): DatabaseAdapter {
  const users = new Map<string, User & { passwordHash: string }>();
  const verificationTokens = new Map<string, { userId: string; expiresAt: Date }>();
  const passwordResetTokens = new Map<string, { userId: string; expiresAt: Date }>();
  let idCounter = 1;

  return {
    async createUser(email: string, passwordHash: string): Promise<User> {
      const existing = Array.from(users.values()).find(u => u.email === email);
      if (existing) throw new Error('User exists');

      const user: User & { passwordHash: string } = {
        id: String(idCounter++),
        email,
        passwordHash,
        emailVerified: false,
        createdAt: new Date(),
      };
      users.set(user.id, user);
      return { id: user.id, email: user.email, emailVerified: user.emailVerified, createdAt: user.createdAt };
    },

    async getUserById(id: string): Promise<User | null> {
      const user = users.get(id);
      if (!user) return null;
      return { id: user.id, email: user.email, emailVerified: user.emailVerified, createdAt: user.createdAt };
    },

    async getUserByEmail(email: string): Promise<User | null> {
      const user = Array.from(users.values()).find(u => u.email === email);
      if (!user) return null;
      return { id: user.id, email: user.email, emailVerified: user.emailVerified, createdAt: user.createdAt };
    },

    async updateUser(id: string, updates: Partial<User>): Promise<User> {
      const user = users.get(id);
      if (!user) throw new Error('User not found');
      Object.assign(user, updates);
      return { id: user.id, email: user.email, emailVerified: user.emailVerified, createdAt: user.createdAt };
    },

    async getPasswordHash(userId: string): Promise<string | null> {
      return users.get(userId)?.passwordHash ?? null;
    },

    async setPasswordHash(userId: string, hash: string): Promise<void> {
      const user = users.get(userId);
      if (user) user.passwordHash = hash;
    },

    async setVerificationToken(userId: string, token: string, expiresAt: Date): Promise<void> {
      verificationTokens.set(token, { userId, expiresAt });
    },

    async getUserByVerificationToken(token: string): Promise<User | null> {
      const data = verificationTokens.get(token);
      if (!data || data.expiresAt < new Date()) return null;
      return this.getUserById(data.userId);
    },

    async clearVerificationToken(userId: string): Promise<void> {
      for (const [token, data] of verificationTokens) {
        if (data.userId === userId) verificationTokens.delete(token);
      }
    },

    async setPasswordResetToken(userId: string, token: string, expiresAt: Date): Promise<void> {
      passwordResetTokens.set(token, { userId, expiresAt });
    },

    async getUserByPasswordResetToken(token: string): Promise<User | null> {
      const data = passwordResetTokens.get(token);
      if (!data || data.expiresAt < new Date()) return null;
      return this.getUserById(data.userId);
    },

    async clearPasswordResetToken(userId: string): Promise<void> {
      for (const [token, data] of passwordResetTokens) {
        if (data.userId === userId) passwordResetTokens.delete(token);
      }
    },

    // Subscription stubs
    async createSubscription() { throw new Error('Not implemented'); },
    async getSubscriptionByUserId() { return null; },
    async getSubscriptionByProviderId() { return null; },
    async updateSubscription() { throw new Error('Not implemented'); },
    async createTransaction() { throw new Error('Not implemented'); },
    async getTransactionByProviderId() { return null; },
    async setProviderCustomerId() {},
    async getUserByProviderCustomerId() { return null; },
  };
}

function createMockEmailAdapter(): EmailAdapter {
  return {
    async sendVerificationEmail() {},
    async sendPasswordResetEmail() {},
  };
}

function createTestConfig(): AuthConfig {
  return {
    jwtSecret: 'test-secret-key',
    jwtExpiresIn: '7d',
    verificationTokenExpiresIn: 24 * 60 * 60 * 1000,
    passwordResetTokenExpiresIn: 60 * 60 * 1000,
    baseUrl: 'http://localhost:3000',
    passwordMinLength: 8,
  };
}

// ============================================
// REGISTER HANDLER TESTS
// ============================================

describe('Auth Handlers - Register', () => {
  let handlers: ReturnType<typeof createAuthHandlers>;
  let db: DatabaseAdapter;

  beforeEach(() => {
    db = createMockDatabaseAdapter();
    handlers = createAuthHandlers({
      auth: createTestConfig(),
      database: db,
      email: createMockEmailAdapter(),
    });
  });

  it('should register user and return 201', async () => {
    const request: AuthRequest = {
      method: 'POST',
      path: '/register',
      body: { email: 'test@example.com', password: 'securePassword123' },
      headers: {},
    };

    const response = await handlers.register(request);

    expect(response.status).toBe(201);
    expect(response.body.user).toBeDefined();
    expect(response.body.user.email).toBe('test@example.com');
    expect(response.body.tokens).toBeDefined();
    expect(response.body.tokens.accessToken).toBeDefined();
  });

  it('should return 400 for invalid email', async () => {
    const request: AuthRequest = {
      method: 'POST',
      path: '/register',
      body: { email: 'not-an-email', password: 'securePassword123' },
      headers: {},
    };

    const response = await handlers.register(request);

    expect(response.status).toBe(400);
    expect(response.body.error).toBeDefined();
  });

  it('should return 400 for weak password', async () => {
    const request: AuthRequest = {
      method: 'POST',
      path: '/register',
      body: { email: 'test@example.com', password: 'short' },
      headers: {},
    };

    const response = await handlers.register(request);

    expect(response.status).toBe(400);
    expect(response.body.error).toBeDefined();
  });

  it('should return 409 for existing user', async () => {
    await db.createUser('test@example.com', 'hash');

    const request: AuthRequest = {
      method: 'POST',
      path: '/register',
      body: { email: 'test@example.com', password: 'securePassword123' },
      headers: {},
    };

    const response = await handlers.register(request);

    expect(response.status).toBe(409);
  });

  it('should return 400 for missing email', async () => {
    const request: AuthRequest = {
      method: 'POST',
      path: '/register',
      body: { password: 'securePassword123' },
      headers: {},
    };

    const response = await handlers.register(request);

    expect(response.status).toBe(400);
  });

  it('should return 400 for missing password', async () => {
    const request: AuthRequest = {
      method: 'POST',
      path: '/register',
      body: { email: 'test@example.com' },
      headers: {},
    };

    const response = await handlers.register(request);

    expect(response.status).toBe(400);
  });
});

// ============================================
// LOGIN HANDLER TESTS
// ============================================

describe('Auth Handlers - Login', () => {
  let handlers: ReturnType<typeof createAuthHandlers>;
  let db: DatabaseAdapter;

  beforeEach(async () => {
    db = createMockDatabaseAdapter();
    handlers = createAuthHandlers({
      auth: createTestConfig(),
      database: db,
      email: createMockEmailAdapter(),
    });

    // Register a user first
    await handlers.register({
      method: 'POST',
      path: '/register',
      body: { email: 'test@example.com', password: 'securePassword123' },
      headers: {},
    });
  });

  it('should login and return 200', async () => {
    const request: AuthRequest = {
      method: 'POST',
      path: '/login',
      body: { email: 'test@example.com', password: 'securePassword123' },
      headers: {},
    };

    const response = await handlers.login(request);

    expect(response.status).toBe(200);
    expect(response.body.user).toBeDefined();
    expect(response.body.tokens.accessToken).toBeDefined();
  });

  it('should return 401 for wrong password', async () => {
    const request: AuthRequest = {
      method: 'POST',
      path: '/login',
      body: { email: 'test@example.com', password: 'wrongPassword' },
      headers: {},
    };

    const response = await handlers.login(request);

    expect(response.status).toBe(401);
  });

  it('should return 401 for non-existent user', async () => {
    const request: AuthRequest = {
      method: 'POST',
      path: '/login',
      body: { email: 'nonexistent@example.com', password: 'anyPassword' },
      headers: {},
    };

    const response = await handlers.login(request);

    expect(response.status).toBe(401);
  });

  it('should work with case-insensitive email', async () => {
    const request: AuthRequest = {
      method: 'POST',
      path: '/login',
      body: { email: 'TEST@EXAMPLE.COM', password: 'securePassword123' },
      headers: {},
    };

    const response = await handlers.login(request);

    expect(response.status).toBe(200);
  });
});

// ============================================
// GET ME HANDLER TESTS
// ============================================

describe('Auth Handlers - Get Me', () => {
  let handlers: ReturnType<typeof createAuthHandlers>;
  let token: string;

  beforeEach(async () => {
    const db = createMockDatabaseAdapter();
    handlers = createAuthHandlers({
      auth: createTestConfig(),
      database: db,
      email: createMockEmailAdapter(),
    });

    const registerResponse = await handlers.register({
      method: 'POST',
      path: '/register',
      body: { email: 'test@example.com', password: 'securePassword123' },
      headers: {},
    });
    token = registerResponse.body.tokens.accessToken;
  });

  it('should return current user with valid token', async () => {
    const request: AuthRequest = {
      method: 'GET',
      path: '/me',
      body: {},
      headers: { authorization: `Bearer ${token}` },
    };

    const response = await handlers.getMe(request);

    expect(response.status).toBe(200);
    expect(response.body.user).toBeDefined();
    expect(response.body.user.email).toBe('test@example.com');
  });

  it('should return 401 without token', async () => {
    const request: AuthRequest = {
      method: 'GET',
      path: '/me',
      body: {},
      headers: {},
    };

    const response = await handlers.getMe(request);

    expect(response.status).toBe(401);
  });

  it('should return 401 with invalid token', async () => {
    const request: AuthRequest = {
      method: 'GET',
      path: '/me',
      body: {},
      headers: { authorization: 'Bearer invalid-token' },
    };

    const response = await handlers.getMe(request);

    expect(response.status).toBe(401);
  });
});

// ============================================
// VERIFY EMAIL HANDLER TESTS
// ============================================

describe('Auth Handlers - Verify Email', () => {
  let handlers: ReturnType<typeof createAuthHandlers>;
  let db: DatabaseAdapter;

  beforeEach(async () => {
    db = createMockDatabaseAdapter();
    handlers = createAuthHandlers({
      auth: createTestConfig(),
      database: db,
      email: createMockEmailAdapter(),
    });
  });

  it('should verify email with valid token', async () => {
    // Register first to create verification token
    await handlers.register({
      method: 'POST',
      path: '/register',
      body: { email: 'test@example.com', password: 'securePassword123' },
      headers: {},
    });

    // Get the token from the database (in real scenario it would come from email)
    const user = await db.getUserByEmail('test@example.com');
    // We need to get the token - let's set one manually for testing
    await db.setVerificationToken(user!.id, 'test-verify-token', new Date(Date.now() + 86400000));

    const request: AuthRequest = {
      method: 'GET',
      path: '/verify-email/test-verify-token',
      body: {},
      headers: {},
      params: { token: 'test-verify-token' },
    };

    const response = await handlers.verifyEmail(request);

    expect(response.status).toBe(200);
    expect(response.body.user.emailVerified).toBe(true);
  });

  it('should return 400 for invalid token', async () => {
    const request: AuthRequest = {
      method: 'GET',
      path: '/verify-email/invalid-token',
      body: {},
      headers: {},
      params: { token: 'invalid-token' },
    };

    const response = await handlers.verifyEmail(request);

    expect(response.status).toBe(400);
  });
});

// ============================================
// PASSWORD RESET HANDLER TESTS
// ============================================

describe('Auth Handlers - Password Reset', () => {
  let handlers: ReturnType<typeof createAuthHandlers>;
  let db: DatabaseAdapter;

  beforeEach(async () => {
    db = createMockDatabaseAdapter();
    handlers = createAuthHandlers({
      auth: createTestConfig(),
      database: db,
      email: createMockEmailAdapter(),
    });

    await handlers.register({
      method: 'POST',
      path: '/register',
      body: { email: 'test@example.com', password: 'securePassword123' },
      headers: {},
    });
  });

  it('should request password reset and return 200', async () => {
    const request: AuthRequest = {
      method: 'POST',
      path: '/forgot-password',
      body: { email: 'test@example.com' },
      headers: {},
    };

    const response = await handlers.forgotPassword(request);

    expect(response.status).toBe(200);
  });

  it('should return 200 even for non-existent user (security)', async () => {
    const request: AuthRequest = {
      method: 'POST',
      path: '/forgot-password',
      body: { email: 'nonexistent@example.com' },
      headers: {},
    };

    const response = await handlers.forgotPassword(request);

    expect(response.status).toBe(200);
  });

  it('should reset password with valid token', async () => {
    const user = await db.getUserByEmail('test@example.com');
    await db.setPasswordResetToken(user!.id, 'reset-token', new Date(Date.now() + 3600000));

    const request: AuthRequest = {
      method: 'POST',
      path: '/reset-password',
      body: { token: 'reset-token', newPassword: 'newSecurePassword456' },
      headers: {},
    };

    const response = await handlers.resetPassword(request);

    expect(response.status).toBe(200);

    // Verify can login with new password
    const loginResponse = await handlers.login({
      method: 'POST',
      path: '/login',
      body: { email: 'test@example.com', password: 'newSecurePassword456' },
      headers: {},
    });
    expect(loginResponse.status).toBe(200);
  });

  it('should return 400 for invalid reset token', async () => {
    const request: AuthRequest = {
      method: 'POST',
      path: '/reset-password',
      body: { token: 'invalid-token', newPassword: 'newSecurePassword456' },
      headers: {},
    };

    const response = await handlers.resetPassword(request);

    expect(response.status).toBe(400);
  });
});

// ============================================
// CHANGE PASSWORD HANDLER TESTS
// ============================================

describe('Auth Handlers - Change Password', () => {
  let handlers: ReturnType<typeof createAuthHandlers>;
  let token: string;

  beforeEach(async () => {
    const db = createMockDatabaseAdapter();
    handlers = createAuthHandlers({
      auth: createTestConfig(),
      database: db,
      email: createMockEmailAdapter(),
    });

    const registerResponse = await handlers.register({
      method: 'POST',
      path: '/register',
      body: { email: 'test@example.com', password: 'securePassword123' },
      headers: {},
    });
    token = registerResponse.body.tokens.accessToken;
  });

  it('should change password with valid current password', async () => {
    const request: AuthRequest = {
      method: 'POST',
      path: '/change-password',
      body: { currentPassword: 'securePassword123', newPassword: 'newSecurePassword456' },
      headers: { authorization: `Bearer ${token}` },
    };

    const response = await handlers.changePassword(request);

    expect(response.status).toBe(200);

    // Verify can login with new password
    const loginResponse = await handlers.login({
      method: 'POST',
      path: '/login',
      body: { email: 'test@example.com', password: 'newSecurePassword456' },
      headers: {},
    });
    expect(loginResponse.status).toBe(200);
  });

  it('should return 401 for wrong current password', async () => {
    const request: AuthRequest = {
      method: 'POST',
      path: '/change-password',
      body: { currentPassword: 'wrongPassword', newPassword: 'newSecurePassword456' },
      headers: { authorization: `Bearer ${token}` },
    };

    const response = await handlers.changePassword(request);

    expect(response.status).toBe(401);
  });

  it('should return 401 without auth token', async () => {
    const request: AuthRequest = {
      method: 'POST',
      path: '/change-password',
      body: { currentPassword: 'securePassword123', newPassword: 'newSecurePassword456' },
      headers: {},
    };

    const response = await handlers.changePassword(request);

    expect(response.status).toBe(401);
  });
});

// ============================================
// RESEND VERIFICATION HANDLER TESTS
// ============================================

describe('Auth Handlers - Resend Verification', () => {
  let handlers: ReturnType<typeof createAuthHandlers>;

  beforeEach(async () => {
    const db = createMockDatabaseAdapter();
    handlers = createAuthHandlers({
      auth: createTestConfig(),
      database: db,
      email: createMockEmailAdapter(),
    });

    await handlers.register({
      method: 'POST',
      path: '/register',
      body: { email: 'test@example.com', password: 'securePassword123' },
      headers: {},
    });
  });

  it('should resend verification email and return 200', async () => {
    const request: AuthRequest = {
      method: 'POST',
      path: '/resend-verification',
      body: { email: 'test@example.com' },
      headers: {},
    };

    const response = await handlers.resendVerification(request);

    expect(response.status).toBe(200);
  });

  it('should return 200 for non-existent user (security)', async () => {
    const request: AuthRequest = {
      method: 'POST',
      path: '/resend-verification',
      body: { email: 'nonexistent@example.com' },
      headers: {},
    };

    const response = await handlers.resendVerification(request);

    expect(response.status).toBe(200);
  });
});

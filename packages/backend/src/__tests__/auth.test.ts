import { describe, it, expect, beforeEach, vi } from 'vitest';
import type {
  DatabaseAdapter,
  EmailAdapter,
  User,
  AuthConfig,
} from '@subauth/core';

// Import will fail until we implement - that's TDD!
import { AuthService } from '../auth-service';

// ============================================
// TEST HELPERS - Mock Adapters
// ============================================

function createMockDatabaseAdapter(): DatabaseAdapter {
  const users = new Map<string, User & { passwordHash: string }>();
  const verificationTokens = new Map<string, { userId: string; expiresAt: Date }>();
  const passwordResetTokens = new Map<string, { userId: string; expiresAt: Date }>();
  const refreshTokens = new Map<string, { userId: string; expiresAt: Date }>();
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
      const user = users.get(userId);
      return user?.passwordHash ?? null;
    },

    async setPasswordHash(userId: string, hash: string): Promise<void> {
      const user = users.get(userId);
      if (user) user.passwordHash = hash;
    },

    async setVerificationToken(userId: string, token: string, expiresAt: Date): Promise<void> {
      // Delete existing tokens for this user (like real adapters do)
      for (const [existingToken, data] of verificationTokens) {
        if (data.userId === userId) verificationTokens.delete(existingToken);
      }
      verificationTokens.set(token, { userId, expiresAt });
    },

    async getUserByVerificationToken(token: string): Promise<User | null> {
      const data = verificationTokens.get(token);
      if (!data) return null;
      if (data.expiresAt < new Date()) return null;
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
      if (!data) return null;
      if (data.expiresAt < new Date()) return null;
      return this.getUserById(data.userId);
    },

    async clearPasswordResetToken(userId: string): Promise<void> {
      for (const [token, data] of passwordResetTokens) {
        if (data.userId === userId) passwordResetTokens.delete(token);
      }
    },

    async createRefreshToken(userId: string, token: string, expiresAt: Date): Promise<void> {
      refreshTokens.set(token, { userId, expiresAt });
    },

    async getRefreshToken(token: string): Promise<{ userId: string; expiresAt: Date } | null> {
      const data = refreshTokens.get(token);
      if (!data) return null;
      if (data.expiresAt < new Date()) return null;
      return data;
    },

    async deleteRefreshToken(token: string): Promise<void> {
      refreshTokens.delete(token);
    },

    async deleteAllRefreshTokens(userId: string): Promise<void> {
      for (const [token, data] of refreshTokens) {
        if (data.userId === userId) refreshTokens.delete(token);
      }
    },

    // Subscription methods (not needed for auth tests, stub them)
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

function createMockEmailAdapter(): EmailAdapter & { calls: { method: string; args: unknown[] }[] } {
  const adapter = {
    calls: [] as { method: string; args: unknown[] }[],
    async sendVerificationEmail(email: string, token: string, verifyUrl: string) {
      adapter.calls.push({ method: 'sendVerificationEmail', args: [email, token, verifyUrl] });
    },
    async sendPasswordResetEmail(email: string, token: string, resetUrl: string) {
      adapter.calls.push({ method: 'sendPasswordResetEmail', args: [email, token, resetUrl] });
    },
  };
  return adapter;
}

function createTestConfig(overrides?: Partial<AuthConfig>): AuthConfig {
  return {
    jwtSecret: 'test-secret-key-for-testing-only',
    jwtExpiresIn: '7d',
    verificationTokenExpiresIn: 24 * 60 * 60 * 1000, // 24 hours
    passwordResetTokenExpiresIn: 60 * 60 * 1000, // 1 hour
    baseUrl: 'http://localhost:3000',
    passwordMinLength: 8,
    ...overrides,
  };
}

// ============================================
// REGISTER FLOW TESTS
// ============================================

describe('AuthService - Register Flow', () => {
  let authService: AuthService;
  let db: DatabaseAdapter;
  let email: EmailAdapter & { calls: { method: string; args: unknown[] }[] };
  let config: AuthConfig;

  beforeEach(() => {
    db = createMockDatabaseAdapter();
    email = createMockEmailAdapter();
    config = createTestConfig();
    authService = new AuthService({ auth: config, database: db, email });
  });

  it('should register a new user with valid email and password', async () => {
    const result = await authService.register({
      email: 'test@example.com',
      password: 'securePassword123',
    });

    expect(result.user).toBeDefined();
    expect(result.user.email).toBe('test@example.com');
    expect(result.user.emailVerified).toBe(false);
    expect(result.user.id).toBeDefined();
  });

  it('should return auth tokens on registration', async () => {
    const result = await authService.register({
      email: 'test@example.com',
      password: 'securePassword123',
    });

    expect(result.tokens).toBeDefined();
    expect(result.tokens.accessToken).toBeDefined();
    expect(typeof result.tokens.accessToken).toBe('string');
    expect(result.tokens.expiresAt).toBeInstanceOf(Date);
    expect(result.tokens.expiresAt.getTime()).toBeGreaterThan(Date.now());
  });

  it('should send verification email on registration', async () => {
    await authService.register({
      email: 'test@example.com',
      password: 'securePassword123',
    });

    expect(email.calls).toHaveLength(1);
    expect(email.calls[0].method).toBe('sendVerificationEmail');
    expect(email.calls[0].args[0]).toBe('test@example.com');
    expect(email.calls[0].args[1]).toBeDefined(); // token
    expect(email.calls[0].args[2]).toContain('http://localhost:3000'); // verify URL
  });

  it('should throw error if user already exists', async () => {
    await authService.register({
      email: 'test@example.com',
      password: 'securePassword123',
    });

    await expect(
      authService.register({
        email: 'test@example.com',
        password: 'anotherPassword123',
      })
    ).rejects.toThrow();
  });

  it('should throw error for weak password (too short)', async () => {
    await expect(
      authService.register({
        email: 'test@example.com',
        password: 'short',
      })
    ).rejects.toThrow();
  });

  it('should throw error for invalid email format', async () => {
    await expect(
      authService.register({
        email: 'not-an-email',
        password: 'securePassword123',
      })
    ).rejects.toThrow();
  });

  it('should hash the password (not store plaintext)', async () => {
    await authService.register({
      email: 'test@example.com',
      password: 'securePassword123',
    });

    const user = await db.getUserByEmail('test@example.com');
    const storedHash = await db.getPasswordHash(user!.id);

    expect(storedHash).toBeDefined();
    expect(storedHash).not.toBe('securePassword123');
    expect(storedHash!.length).toBeGreaterThan(20); // bcrypt hashes are long
  });

  it('should normalize email to lowercase', async () => {
    const result = await authService.register({
      email: 'Test@EXAMPLE.com',
      password: 'securePassword123',
    });

    expect(result.user.email).toBe('test@example.com');
  });
});

// ============================================
// EMAIL VERIFICATION TESTS
// ============================================

describe('AuthService - Email Verification Flow', () => {
  let authService: AuthService;
  let db: DatabaseAdapter;
  let email: EmailAdapter & { calls: { method: string; args: unknown[] }[] };
  let config: AuthConfig;

  beforeEach(() => {
    db = createMockDatabaseAdapter();
    email = createMockEmailAdapter();
    config = createTestConfig();
    authService = new AuthService({ auth: config, database: db, email });
  });

  it('should verify email with valid token', async () => {
    await authService.register({
      email: 'test@example.com',
      password: 'securePassword123',
    });

    // Get the token from the email call
    const token = email.calls[0].args[1] as string;

    const result = await authService.verifyEmail({ token });

    expect(result.user.emailVerified).toBe(true);
  });

  it('should throw error for invalid verification token', async () => {
    await expect(
      authService.verifyEmail({ token: 'invalid-token' })
    ).rejects.toThrow();
  });

  it('should throw error for expired verification token', async () => {
    // Use a config with very short token expiry
    const shortExpiryConfig = createTestConfig({
      verificationTokenExpiresIn: 1, // 1 millisecond
    });
    authService = new AuthService({ auth: shortExpiryConfig, database: db, email });

    await authService.register({
      email: 'test@example.com',
      password: 'securePassword123',
    });

    const token = email.calls[0].args[1] as string;

    // Wait for token to expire
    await new Promise(resolve => setTimeout(resolve, 10));

    await expect(
      authService.verifyEmail({ token })
    ).rejects.toThrow();
  });

  it('should allow resending verification email', async () => {
    await authService.register({
      email: 'test@example.com',
      password: 'securePassword123',
    });

    await authService.resendVerificationEmail('test@example.com');

    expect(email.calls).toHaveLength(2);
    expect(email.calls[1].method).toBe('sendVerificationEmail');
  });

  it('should not resend verification for already verified user', async () => {
    await authService.register({
      email: 'test@example.com',
      password: 'securePassword123',
    });

    const token = email.calls[0].args[1] as string;
    await authService.verifyEmail({ token });

    await expect(
      authService.resendVerificationEmail('test@example.com')
    ).rejects.toThrow();
  });

  it('should not resend verification for non-existent user', async () => {
    // Should not reveal whether user exists (security)
    // Either throw generic error or succeed silently
    const result = authService.resendVerificationEmail('nonexistent@example.com');
    // Should not throw - to prevent user enumeration
    await expect(result).resolves.not.toThrow();
  });

  it('should generate a new token when resending verification email', async () => {
    await authService.register({
      email: 'test@example.com',
      password: 'securePassword123',
    });

    const firstToken = email.calls[0].args[1] as string;

    await authService.resendVerificationEmail('test@example.com');

    const secondToken = email.calls[1].args[1] as string;

    // New token should be different from the original
    expect(secondToken).not.toBe(firstToken);
  });

  it('should invalidate old token when resending verification email', async () => {
    await authService.register({
      email: 'test@example.com',
      password: 'securePassword123',
    });

    const firstToken = email.calls[0].args[1] as string;

    await authService.resendVerificationEmail('test@example.com');

    const secondToken = email.calls[1].args[1] as string;

    // Old token should no longer work
    await expect(
      authService.verifyEmail({ token: firstToken })
    ).rejects.toThrow();

    // New token should work
    const result = await authService.verifyEmail({ token: secondToken });
    expect(result.user.emailVerified).toBe(true);
  });

  it('should normalize email when resending verification', async () => {
    await authService.register({
      email: 'test@example.com',
      password: 'securePassword123',
    });

    // Resend with different case
    await authService.resendVerificationEmail('TEST@EXAMPLE.COM');

    expect(email.calls).toHaveLength(2);
    expect(email.calls[1].args[0]).toBe('test@example.com');
  });

  it('should include correct verify URL when resending', async () => {
    await authService.register({
      email: 'test@example.com',
      password: 'securePassword123',
    });

    await authService.resendVerificationEmail('test@example.com');

    const verifyUrl = email.calls[1].args[2] as string;
    const token = email.calls[1].args[1] as string;

    expect(verifyUrl).toBe(`http://localhost:3000/verify-email/${token}`);
  });
});

// ============================================
// LOGIN FLOW TESTS
// ============================================

describe('AuthService - Login Flow', () => {
  let authService: AuthService;
  let db: DatabaseAdapter;
  let email: EmailAdapter & { calls: { method: string; args: unknown[] }[] };
  let config: AuthConfig;

  beforeEach(async () => {
    db = createMockDatabaseAdapter();
    email = createMockEmailAdapter();
    config = createTestConfig();
    authService = new AuthService({ auth: config, database: db, email });

    // Register a test user
    await authService.register({
      email: 'test@example.com',
      password: 'securePassword123',
    });
  });

  it('should login with valid credentials', async () => {
    const result = await authService.login({
      email: 'test@example.com',
      password: 'securePassword123',
    });

    expect(result.user).toBeDefined();
    expect(result.user.email).toBe('test@example.com');
    expect(result.tokens.accessToken).toBeDefined();
  });

  it('should throw error for wrong password', async () => {
    await expect(
      authService.login({
        email: 'test@example.com',
        password: 'wrongPassword',
      })
    ).rejects.toThrow();
  });

  it('should throw error for non-existent user', async () => {
    await expect(
      authService.login({
        email: 'nonexistent@example.com',
        password: 'anyPassword',
      })
    ).rejects.toThrow();
  });

  it('should work with case-insensitive email', async () => {
    const result = await authService.login({
      email: 'TEST@EXAMPLE.COM',
      password: 'securePassword123',
    });

    expect(result.user.email).toBe('test@example.com');
  });

  it('should optionally require email verification for login', async () => {
    // Create service that requires verification
    const strictService = new AuthService({
      auth: config,
      database: db,
      email,
      requireEmailVerification: true,
    });

    await expect(
      strictService.login({
        email: 'test@example.com',
        password: 'securePassword123',
      })
    ).rejects.toThrow(); // Should fail because email not verified
  });

  it('should allow login without verification when not required', async () => {
    const result = await authService.login({
      email: 'test@example.com',
      password: 'securePassword123',
    });

    expect(result.user.emailVerified).toBe(false);
    expect(result.tokens.accessToken).toBeDefined();
  });
});

// ============================================
// TOKEN VALIDATION TESTS
// ============================================

describe('AuthService - Token Validation', () => {
  let authService: AuthService;
  let db: DatabaseAdapter;
  let email: EmailAdapter & { calls: { method: string; args: unknown[] }[] };
  let config: AuthConfig;

  beforeEach(async () => {
    db = createMockDatabaseAdapter();
    email = createMockEmailAdapter();
    config = createTestConfig();
    authService = new AuthService({ auth: config, database: db, email });
  });

  it('should validate a valid JWT token', async () => {
    const { tokens } = await authService.register({
      email: 'test@example.com',
      password: 'securePassword123',
    });

    const result = await authService.validateToken(tokens.accessToken);

    expect(result.valid).toBe(true);
    expect(result.userId).toBeDefined();
  });

  it('should reject an invalid JWT token', async () => {
    const result = await authService.validateToken('invalid-token');

    expect(result.valid).toBe(false);
    expect(result.userId).toBeUndefined();
  });

  it('should reject an expired JWT token', async () => {
    // Create service with very short token expiry
    const shortExpiryConfig = createTestConfig({ jwtExpiresIn: '1ms' });
    const shortExpiryService = new AuthService({
      auth: shortExpiryConfig,
      database: db,
      email,
    });

    const { tokens } = await shortExpiryService.register({
      email: 'test@example.com',
      password: 'securePassword123',
    });

    // Wait for token to expire
    await new Promise(resolve => setTimeout(resolve, 10));

    const result = await shortExpiryService.validateToken(tokens.accessToken);

    expect(result.valid).toBe(false);
  });

  it('should get user from valid token', async () => {
    const { tokens } = await authService.register({
      email: 'test@example.com',
      password: 'securePassword123',
    });

    const user = await authService.getUserFromToken(tokens.accessToken);

    expect(user).toBeDefined();
    expect(user!.email).toBe('test@example.com');
  });
});

// ============================================
// PASSWORD RESET TESTS
// ============================================

describe('AuthService - Password Reset Flow', () => {
  let authService: AuthService;
  let db: DatabaseAdapter;
  let email: EmailAdapter & { calls: { method: string; args: unknown[] }[] };
  let config: AuthConfig;

  beforeEach(async () => {
    db = createMockDatabaseAdapter();
    email = createMockEmailAdapter();
    config = createTestConfig();
    authService = new AuthService({ auth: config, database: db, email });

    // Register a test user
    await authService.register({
      email: 'test@example.com',
      password: 'securePassword123',
    });
    email.calls.length = 0; // Clear registration email
  });

  it('should send password reset email', async () => {
    await authService.requestPasswordReset({ email: 'test@example.com' });

    expect(email.calls).toHaveLength(1);
    expect(email.calls[0].method).toBe('sendPasswordResetEmail');
    expect(email.calls[0].args[0]).toBe('test@example.com');
  });

  it('should not reveal if user exists when requesting reset', async () => {
    // Should not throw for non-existent user (security)
    await expect(
      authService.requestPasswordReset({ email: 'nonexistent@example.com' })
    ).resolves.not.toThrow();

    // But should not send email
    expect(email.calls).toHaveLength(0);
  });

  it('should reset password with valid token', async () => {
    await authService.requestPasswordReset({ email: 'test@example.com' });
    const resetToken = email.calls[0].args[1] as string;

    await authService.resetPassword({
      token: resetToken,
      newPassword: 'newSecurePassword456',
    });

    // Should be able to login with new password
    const result = await authService.login({
      email: 'test@example.com',
      password: 'newSecurePassword456',
    });
    expect(result.tokens.accessToken).toBeDefined();
  });

  it('should not allow login with old password after reset', async () => {
    await authService.requestPasswordReset({ email: 'test@example.com' });
    const resetToken = email.calls[0].args[1] as string;

    await authService.resetPassword({
      token: resetToken,
      newPassword: 'newSecurePassword456',
    });

    await expect(
      authService.login({
        email: 'test@example.com',
        password: 'securePassword123',
      })
    ).rejects.toThrow();
  });

  it('should throw error for invalid reset token', async () => {
    await expect(
      authService.resetPassword({
        token: 'invalid-token',
        newPassword: 'newSecurePassword456',
      })
    ).rejects.toThrow();
  });

  it('should throw error for expired reset token', async () => {
    const shortExpiryConfig = createTestConfig({
      passwordResetTokenExpiresIn: 1, // 1 millisecond
    });
    authService = new AuthService({ auth: shortExpiryConfig, database: db, email });

    // Re-register user with new service
    await authService.register({
      email: 'test2@example.com',
      password: 'securePassword123',
    });
    email.calls.length = 0;

    await authService.requestPasswordReset({ email: 'test2@example.com' });
    const resetToken = email.calls[0].args[1] as string;

    // Wait for token to expire
    await new Promise(resolve => setTimeout(resolve, 10));

    await expect(
      authService.resetPassword({
        token: resetToken,
        newPassword: 'newSecurePassword456',
      })
    ).rejects.toThrow();
  });

  it('should invalidate reset token after use', async () => {
    await authService.requestPasswordReset({ email: 'test@example.com' });
    const resetToken = email.calls[0].args[1] as string;

    await authService.resetPassword({
      token: resetToken,
      newPassword: 'newSecurePassword456',
    });

    // Second use should fail
    await expect(
      authService.resetPassword({
        token: resetToken,
        newPassword: 'anotherPassword789',
      })
    ).rejects.toThrow();
  });
});

// ============================================
// CHANGE PASSWORD TESTS
// ============================================

describe('AuthService - Change Password', () => {
  let authService: AuthService;
  let db: DatabaseAdapter;
  let email: EmailAdapter & { calls: { method: string; args: unknown[] }[] };
  let config: AuthConfig;
  let userId: string;

  beforeEach(async () => {
    db = createMockDatabaseAdapter();
    email = createMockEmailAdapter();
    config = createTestConfig();
    authService = new AuthService({ auth: config, database: db, email });

    const result = await authService.register({
      email: 'test@example.com',
      password: 'securePassword123',
    });
    userId = result.user.id;
  });

  it('should change password with correct current password', async () => {
    await authService.changePassword(userId, {
      currentPassword: 'securePassword123',
      newPassword: 'newSecurePassword456',
    });

    // Should login with new password
    const result = await authService.login({
      email: 'test@example.com',
      password: 'newSecurePassword456',
    });
    expect(result.tokens.accessToken).toBeDefined();
  });

  it('should throw error for wrong current password', async () => {
    await expect(
      authService.changePassword(userId, {
        currentPassword: 'wrongPassword',
        newPassword: 'newSecurePassword456',
      })
    ).rejects.toThrow();
  });

  it('should throw error for weak new password', async () => {
    await expect(
      authService.changePassword(userId, {
        currentPassword: 'securePassword123',
        newPassword: 'weak',
      })
    ).rejects.toThrow();
  });
});

// ============================================
// REFRESH TOKEN TESTS
// ============================================

describe('AuthService - Refresh Token Flow', () => {
  let authService: AuthService;
  let db: DatabaseAdapter;
  let email: EmailAdapter & { calls: { method: string; args: unknown[] }[] };
  let config: AuthConfig;

  beforeEach(() => {
    db = createMockDatabaseAdapter();
    email = createMockEmailAdapter();
    config = createTestConfig({
      refreshTokenExpiresIn: '7d',
    });
    authService = new AuthService({ auth: config, database: db, email });
  });

  it('should generate refresh token on login', async () => {
    await authService.register({
      email: 'test@example.com',
      password: 'securePassword123',
    });

    const result = await authService.login({
      email: 'test@example.com',
      password: 'securePassword123',
    });

    expect(result.tokens.refreshToken).toBeDefined();
    expect(typeof result.tokens.refreshToken).toBe('string');
  });

  it('should generate refresh token on registration', async () => {
    const result = await authService.register({
      email: 'test@example.com',
      password: 'securePassword123',
    });

    expect(result.tokens.refreshToken).toBeDefined();
    expect(typeof result.tokens.refreshToken).toBe('string');
  });

  it('should refresh access token with valid refresh token', async () => {
    const registerResult = await authService.register({
      email: 'test@example.com',
      password: 'securePassword123',
    });

    const refreshToken = registerResult.tokens.refreshToken!;

    const refreshResult = await authService.refreshAccessToken(refreshToken);

    expect(refreshResult.accessToken).toBeDefined();
    // New access token should be valid
    const validation = await authService.validateToken(refreshResult.accessToken);
    expect(validation.valid).toBe(true);
    expect(refreshResult.expiresAt.getTime()).toBeGreaterThan(Date.now());
  });

  it('should implement token rotation (return new refresh token)', async () => {
    const registerResult = await authService.register({
      email: 'test@example.com',
      password: 'securePassword123',
    });

    const originalRefreshToken = registerResult.tokens.refreshToken!;

    const refreshResult = await authService.refreshAccessToken(originalRefreshToken);

    expect(refreshResult.refreshToken).toBeDefined();
    expect(refreshResult.refreshToken).not.toBe(originalRefreshToken);
  });

  it('should invalidate old refresh token after rotation', async () => {
    const registerResult = await authService.register({
      email: 'test@example.com',
      password: 'securePassword123',
    });

    const originalRefreshToken = registerResult.tokens.refreshToken!;

    // Use the refresh token
    await authService.refreshAccessToken(originalRefreshToken);

    // Old token should no longer work
    await expect(
      authService.refreshAccessToken(originalRefreshToken)
    ).rejects.toThrow();
  });

  it('should reject expired refresh token', async () => {
    const shortExpiryConfig = createTestConfig({
      refreshTokenExpiresIn: '1ms',
    });
    authService = new AuthService({ auth: shortExpiryConfig, database: db, email });

    const registerResult = await authService.register({
      email: 'test@example.com',
      password: 'securePassword123',
    });

    const refreshToken = registerResult.tokens.refreshToken!;

    // Wait for token to expire
    await new Promise(resolve => setTimeout(resolve, 10));

    await expect(
      authService.refreshAccessToken(refreshToken)
    ).rejects.toThrow();
  });

  it('should reject invalid refresh token', async () => {
    await expect(
      authService.refreshAccessToken('invalid-token')
    ).rejects.toThrow();
  });

  it('should revoke single refresh token', async () => {
    const registerResult = await authService.register({
      email: 'test@example.com',
      password: 'securePassword123',
    });

    const refreshToken = registerResult.tokens.refreshToken!;

    await authService.revokeRefreshToken(refreshToken);

    await expect(
      authService.refreshAccessToken(refreshToken)
    ).rejects.toThrow();
  });

  it('should revoke all refresh tokens for user', async () => {
    const registerResult = await authService.register({
      email: 'test@example.com',
      password: 'securePassword123',
    });

    const userId = registerResult.user.id;

    // Login again to create another refresh token
    const loginResult = await authService.login({
      email: 'test@example.com',
      password: 'securePassword123',
    });

    const refreshToken1 = registerResult.tokens.refreshToken!;
    const refreshToken2 = loginResult.tokens.refreshToken!;

    await authService.revokeAllRefreshTokens(userId);

    // Both tokens should be invalid
    await expect(
      authService.refreshAccessToken(refreshToken1)
    ).rejects.toThrow();

    await expect(
      authService.refreshAccessToken(refreshToken2)
    ).rejects.toThrow();
  });

  it('should store refresh token in database on login', async () => {
    await authService.register({
      email: 'test@example.com',
      password: 'securePassword123',
    });

    const loginResult = await authService.login({
      email: 'test@example.com',
      password: 'securePassword123',
    });

    const refreshToken = loginResult.tokens.refreshToken!;
    const storedToken = await db.getRefreshToken(refreshToken);

    expect(storedToken).not.toBeNull();
    expect(storedToken?.userId).toBe(loginResult.user.id);
  });
});

// ============================================
// CUSTOM JWT CLAIMS TESTS
// ============================================

describe('AuthService - Custom JWT Claims', () => {
  let db: DatabaseAdapter;
  let email: EmailAdapter & { calls: { method: string; args: unknown[] }[] };
  let config: AuthConfig;

  beforeEach(() => {
    db = createMockDatabaseAdapter();
    email = createMockEmailAdapter();
    config = createTestConfig({
      refreshTokenExpiresIn: '7d',
    });
  });

  it('should include custom claims in access token on registration', async () => {
    const authService = new AuthService({
      auth: config,
      database: db,
      email,
      getCustomClaims: async (userId: string) => ({
        tier: 'PRO',
        isAdmin: true,
      }),
    });

    const result = await authService.register({
      email: 'test@example.com',
      password: 'securePassword123',
    });

    // Decode the token to check claims
    const decoded = JSON.parse(
      Buffer.from(result.tokens.accessToken.split('.')[1], 'base64').toString()
    );

    expect(decoded.tier).toBe('PRO');
    expect(decoded.isAdmin).toBe(true);
    expect(decoded.userId).toBe(result.user.id);
  });

  it('should include custom claims in access token on login', async () => {
    const authService = new AuthService({
      auth: config,
      database: db,
      email,
      getCustomClaims: async (userId: string) => ({
        tier: 'TEAM',
        isAdmin: false,
        customField: 'custom-value',
      }),
    });

    await authService.register({
      email: 'test@example.com',
      password: 'securePassword123',
    });

    const result = await authService.login({
      email: 'test@example.com',
      password: 'securePassword123',
    });

    const decoded = JSON.parse(
      Buffer.from(result.tokens.accessToken.split('.')[1], 'base64').toString()
    );

    expect(decoded.tier).toBe('TEAM');
    expect(decoded.isAdmin).toBe(false);
    expect(decoded.customField).toBe('custom-value');
  });

  it('should include custom claims in access token on refresh', async () => {
    let callCount = 0;
    const authService = new AuthService({
      auth: config,
      database: db,
      email,
      getCustomClaims: async (userId: string) => {
        callCount++;
        // Return different tier on refresh to prove it's called fresh
        return {
          tier: callCount === 1 ? 'FREE' : 'PRO',
          isAdmin: callCount > 1,
        };
      },
    });

    const registerResult = await authService.register({
      email: 'test@example.com',
      password: 'securePassword123',
    });

    const refreshToken = registerResult.tokens.refreshToken!;
    const refreshResult = await authService.refreshAccessToken(refreshToken);

    const decoded = JSON.parse(
      Buffer.from(refreshResult.accessToken.split('.')[1], 'base64').toString()
    );

    // Should have updated claims from second call
    expect(decoded.tier).toBe('PRO');
    expect(decoded.isAdmin).toBe(true);
  });

  it('should work without custom claims callback', async () => {
    const authService = new AuthService({
      auth: config,
      database: db,
      email,
      // No getCustomClaims provided
    });

    const result = await authService.register({
      email: 'test@example.com',
      password: 'securePassword123',
    });

    const decoded = JSON.parse(
      Buffer.from(result.tokens.accessToken.split('.')[1], 'base64').toString()
    );

    expect(decoded.userId).toBeDefined();
    expect(decoded.tier).toBeUndefined();
    expect(decoded.isAdmin).toBeUndefined();
  });

  it('should not allow custom claims to override userId', async () => {
    const authService = new AuthService({
      auth: config,
      database: db,
      email,
      getCustomClaims: async (userId: string) => ({
        userId: 'hacked-user-id', // Attempt to override
        tier: 'PRO',
      }),
    });

    const result = await authService.register({
      email: 'test@example.com',
      password: 'securePassword123',
    });

    const decoded = JSON.parse(
      Buffer.from(result.tokens.accessToken.split('.')[1], 'base64').toString()
    );

    // userId should be the real one, not the hacked one
    expect(decoded.userId).toBe(result.user.id);
    expect(decoded.userId).not.toBe('hacked-user-id');
    expect(decoded.tier).toBe('PRO');
  });

  it('should automatically include tier and isAdmin from user in token', async () => {
    // Create a mock adapter that returns users with tier and isAdmin
    const usersWithTier = new Map<string, User & { passwordHash: string; tier?: string; isAdmin?: boolean }>();
    const verificationTokens = new Map<string, { userId: string; expiresAt: Date }>();
    const passwordResetTokens = new Map<string, { userId: string; expiresAt: Date }>();
    const refreshTokens = new Map<string, { userId: string; expiresAt: Date }>();
    let idCounter = 1;

    const dbWithTier: DatabaseAdapter = {
      async createUser(email: string, passwordHash: string): Promise<User> {
        const user = {
          id: String(idCounter++),
          email,
          passwordHash,
          emailVerified: false,
          createdAt: new Date(),
          tier: 'PRO', // Default tier for new users
          isAdmin: true, // Default isAdmin for new users
        };
        usersWithTier.set(user.id, user);
        return { id: user.id, email: user.email, emailVerified: user.emailVerified, createdAt: user.createdAt, tier: user.tier, isAdmin: user.isAdmin };
      },
      async getUserById(id: string): Promise<User | null> {
        const user = usersWithTier.get(id);
        if (!user) return null;
        return { id: user.id, email: user.email, emailVerified: user.emailVerified, createdAt: user.createdAt, tier: user.tier, isAdmin: user.isAdmin };
      },
      async getUserByEmail(email: string): Promise<User | null> {
        const user = Array.from(usersWithTier.values()).find(u => u.email === email);
        if (!user) return null;
        return { id: user.id, email: user.email, emailVerified: user.emailVerified, createdAt: user.createdAt, tier: user.tier, isAdmin: user.isAdmin };
      },
      async updateUser(id: string, updates: Partial<User>): Promise<User> {
        const user = usersWithTier.get(id);
        if (!user) throw new Error('User not found');
        Object.assign(user, updates);
        return { id: user.id, email: user.email, emailVerified: user.emailVerified, createdAt: user.createdAt, tier: user.tier, isAdmin: user.isAdmin };
      },
      async getPasswordHash(userId: string): Promise<string | null> {
        return usersWithTier.get(userId)?.passwordHash ?? null;
      },
      async setPasswordHash(userId: string, hash: string): Promise<void> {
        const user = usersWithTier.get(userId);
        if (user) user.passwordHash = hash;
      },
      async setVerificationToken(userId: string, token: string, expiresAt: Date): Promise<void> {
        for (const [t, d] of verificationTokens) if (d.userId === userId) verificationTokens.delete(t);
        verificationTokens.set(token, { userId, expiresAt });
      },
      async getUserByVerificationToken(token: string): Promise<User | null> {
        const data = verificationTokens.get(token);
        if (!data || data.expiresAt < new Date()) return null;
        return this.getUserById(data.userId);
      },
      async clearVerificationToken(userId: string): Promise<void> {
        for (const [t, d] of verificationTokens) if (d.userId === userId) verificationTokens.delete(t);
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
        for (const [t, d] of passwordResetTokens) if (d.userId === userId) passwordResetTokens.delete(t);
      },
      async createRefreshToken(userId: string, token: string, expiresAt: Date): Promise<void> {
        refreshTokens.set(token, { userId, expiresAt });
      },
      async getRefreshToken(token: string): Promise<{ userId: string; expiresAt: Date } | null> {
        const data = refreshTokens.get(token);
        if (!data || data.expiresAt < new Date()) return null;
        return data;
      },
      async deleteRefreshToken(token: string): Promise<void> {
        refreshTokens.delete(token);
      },
      async deleteAllRefreshTokens(userId: string): Promise<void> {
        for (const [t, d] of refreshTokens) if (d.userId === userId) refreshTokens.delete(t);
      },
      async createSubscription() { throw new Error('Not implemented'); },
      async getSubscriptionByUserId() { return null; },
      async getSubscriptionByProviderId() { return null; },
      async updateSubscription() { throw new Error('Not implemented'); },
      async createTransaction() { throw new Error('Not implemented'); },
      async getTransactionByProviderId() { return null; },
      async setProviderCustomerId() {},
      async getUserByProviderCustomerId() { return null; },
    };

    const authService = new AuthService({
      auth: config,
      database: dbWithTier,
      email,
    });

    const result = await authService.register({
      email: 'test@example.com',
      password: 'securePassword123',
    });

    const decoded = JSON.parse(
      Buffer.from(result.tokens.accessToken.split('.')[1], 'base64').toString()
    );

    expect(decoded.tier).toBe('PRO');
    expect(decoded.isAdmin).toBe(true);
    expect(decoded.userId).toBe(result.user.id);
  });
});

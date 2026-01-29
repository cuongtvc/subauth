import { describe, it, expect, beforeEach } from 'vitest';
import type { DatabaseAdapter, User } from '@subauth/core';

import { createAdminHandlers } from '../handlers/admin-handlers';
import type { AuthRequest } from '../handlers/types';

// ============================================
// MOCK HELPERS
// ============================================

interface UserWithPassword extends User {
  passwordHash: string;
}

function createMockDatabaseAdapter(): DatabaseAdapter & {
  _users: Map<string, UserWithPassword>;
} {
  const users = new Map<string, UserWithPassword>();
  const refreshTokens = new Map<string, { userId: string; expiresAt: Date }>();
  let idCounter = 1;

  return {
    _users: users,

    async createUser(email: string, passwordHash: string): Promise<User> {
      const existing = Array.from(users.values()).find(u => u.email === email);
      if (existing) throw new Error('User exists');

      const user: UserWithPassword = {
        id: String(idCounter++),
        email,
        passwordHash,
        emailVerified: false,
        createdAt: new Date(),
        tier: 'FREE',
        isAdmin: false,
      };
      users.set(user.id, user);
      return {
        id: user.id,
        email: user.email,
        emailVerified: user.emailVerified,
        createdAt: user.createdAt,
        tier: user.tier,
        isAdmin: user.isAdmin,
      };
    },

    async getUserById(id: string): Promise<User | null> {
      const user = users.get(id);
      if (!user) return null;
      return {
        id: user.id,
        email: user.email,
        emailVerified: user.emailVerified,
        createdAt: user.createdAt,
        tier: user.tier,
        isAdmin: user.isAdmin,
      };
    },

    async getUserByEmail(email: string): Promise<User | null> {
      const user = Array.from(users.values()).find(u => u.email === email);
      if (!user) return null;
      return {
        id: user.id,
        email: user.email,
        emailVerified: user.emailVerified,
        createdAt: user.createdAt,
        tier: user.tier,
        isAdmin: user.isAdmin,
      };
    },

    async updateUser(id: string, updates: Partial<User>): Promise<User> {
      const user = users.get(id);
      if (!user) throw new Error('User not found');
      Object.assign(user, updates);
      return {
        id: user.id,
        email: user.email,
        emailVerified: user.emailVerified,
        createdAt: user.createdAt,
        tier: user.tier,
        isAdmin: user.isAdmin,
      };
    },

    async listUsers(options: {
      page?: number;
      limit?: number;
      search?: string;
    }): Promise<{ users: User[]; total: number }> {
      const { page = 1, limit = 20, search = '' } = options;
      let allUsers = Array.from(users.values()).map(u => ({
        id: u.id,
        email: u.email,
        emailVerified: u.emailVerified,
        createdAt: u.createdAt,
        tier: u.tier,
        isAdmin: u.isAdmin,
      }));

      if (search) {
        allUsers = allUsers.filter(u =>
          u.email.toLowerCase().includes(search.toLowerCase())
        );
      }

      allUsers.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

      const total = allUsers.length;
      const skip = (page - 1) * limit;
      const paginatedUsers = allUsers.slice(skip, skip + limit);

      return { users: paginatedUsers, total };
    },

    // Stubs for required interface methods
    async getPasswordHash() { return null; },
    async setPasswordHash() {},
    async setVerificationToken() {},
    async getUserByVerificationToken() { return null; },
    async clearVerificationToken() {},
    async setPasswordResetToken() {},
    async getUserByPasswordResetToken() { return null; },
    async clearPasswordResetToken() {},
    async createRefreshToken() {},
    async getRefreshToken() { return null; },
    async deleteRefreshToken() {},
    async deleteAllRefreshTokens() {},
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

function createMockEmailAdapter() {
  return {
    async sendVerificationEmail() {},
    async sendPasswordResetEmail() {},
  };
}

function createTestConfig() {
  return {
    jwtSecret: 'test-secret-key-for-admin-handlers',
    jwtExpiresIn: '7d',
    refreshTokenExpiresIn: '7d',
    verificationTokenExpiresIn: 24 * 60 * 60 * 1000,
    passwordResetTokenExpiresIn: 60 * 60 * 1000,
    baseUrl: 'http://localhost:3000',
    passwordMinLength: 8,
  };
}

// ============================================
// LIST USERS HANDLER TESTS
// ============================================

describe('Admin Handlers - List Users', () => {
  let handlers: ReturnType<typeof createAdminHandlers>;
  let db: DatabaseAdapter & { _users: Map<string, UserWithPassword> };

  beforeEach(async () => {
    db = createMockDatabaseAdapter();
    handlers = createAdminHandlers({
      auth: createTestConfig(),
      database: db,
      email: createMockEmailAdapter(),
    });

    // Create test users
    await db.createUser('alice@example.com', 'hash');
    await db.createUser('bob@example.com', 'hash');
    await db.createUser('charlie@example.com', 'hash');
    await db.createUser('admin@example.com', 'hash');
    await db.createUser('user@example.com', 'hash');
  });

  it('should return users list with pagination', async () => {
    const request: AuthRequest = {
      method: 'GET',
      path: '/admin/users',
      body: {},
      headers: {},
      query: {},
    };

    const response = await handlers.listUsers(request);

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data).toBeDefined();
    expect(response.body.data.users).toBeInstanceOf(Array);
    expect(response.body.data.users.length).toBe(5);
    expect(response.body.data.pagination).toBeDefined();
    expect(response.body.data.pagination.total).toBe(5);
  });

  it('should support pagination with page and limit', async () => {
    const request: AuthRequest = {
      method: 'GET',
      path: '/admin/users',
      body: {},
      headers: {},
      query: { page: '1', limit: '2' },
    };

    const response = await handlers.listUsers(request);

    expect(response.status).toBe(200);
    expect(response.body.data.users.length).toBe(2);
    expect(response.body.data.pagination.page).toBe(1);
    expect(response.body.data.pagination.limit).toBe(2);
    expect(response.body.data.pagination.total).toBe(5);
    expect(response.body.data.pagination.totalPages).toBe(3);
  });

  it('should return second page correctly', async () => {
    const request: AuthRequest = {
      method: 'GET',
      path: '/admin/users',
      body: {},
      headers: {},
      query: { page: '2', limit: '2' },
    };

    const response = await handlers.listUsers(request);

    expect(response.status).toBe(200);
    expect(response.body.data.users.length).toBe(2);
    expect(response.body.data.pagination.page).toBe(2);
  });

  it('should support search by email', async () => {
    const request: AuthRequest = {
      method: 'GET',
      path: '/admin/users',
      body: {},
      headers: {},
      query: { search: 'alice' },
    };

    const response = await handlers.listUsers(request);

    expect(response.status).toBe(200);
    expect(response.body.data.users.length).toBe(1);
    expect(response.body.data.users[0].email).toBe('alice@example.com');
  });

  it('should return empty list when search has no matches', async () => {
    const request: AuthRequest = {
      method: 'GET',
      path: '/admin/users',
      body: {},
      headers: {},
      query: { search: 'nonexistent' },
    };

    const response = await handlers.listUsers(request);

    expect(response.status).toBe(200);
    expect(response.body.data.users.length).toBe(0);
    expect(response.body.data.pagination.total).toBe(0);
  });

  it('should return user fields without password hash', async () => {
    const request: AuthRequest = {
      method: 'GET',
      path: '/admin/users',
      body: {},
      headers: {},
      query: {},
    };

    const response = await handlers.listUsers(request);

    expect(response.status).toBe(200);
    const user = response.body.data.users[0];
    expect(user.id).toBeDefined();
    expect(user.email).toBeDefined();
    expect(user.tier).toBeDefined();
    expect(user.isAdmin).toBeDefined();
    expect(user.emailVerified).toBeDefined();
    expect(user.createdAt).toBeDefined();
    expect((user as Record<string, unknown>).passwordHash).toBeUndefined();
  });

  it('should use default pagination when not specified', async () => {
    const request: AuthRequest = {
      method: 'GET',
      path: '/admin/users',
      body: {},
      headers: {},
      query: {},
    };

    const response = await handlers.listUsers(request);

    expect(response.status).toBe(200);
    expect(response.body.data.pagination.page).toBe(1);
    expect(response.body.data.pagination.limit).toBe(20);
  });
});

// ============================================
// UPDATE USER TIER HANDLER TESTS
// ============================================

describe('Admin Handlers - Update User Tier', () => {
  let handlers: ReturnType<typeof createAdminHandlers>;
  let db: DatabaseAdapter & { _users: Map<string, UserWithPassword> };
  let targetUserId: string;

  beforeEach(async () => {
    db = createMockDatabaseAdapter();
    handlers = createAdminHandlers({
      auth: createTestConfig(),
      database: db,
      email: createMockEmailAdapter(),
    });

    // Create target user to update
    const targetUser = await db.createUser('target@example.com', 'hash');
    targetUserId = targetUser.id;
  });

  it('should return 400 when tier is missing', async () => {
    const request: AuthRequest = {
      method: 'PATCH',
      path: `/admin/users/${targetUserId}/tier`,
      body: {},
      headers: {},
      params: { userId: targetUserId },
    };

    const response = await handlers.updateUserTier(request);

    expect(response.status).toBe(400);
    expect(response.body.error).toBe('VALIDATION_ERROR');
  });

  it('should return 400 when tier is invalid', async () => {
    const request: AuthRequest = {
      method: 'PATCH',
      path: `/admin/users/${targetUserId}/tier`,
      body: { tier: 'INVALID_TIER' },
      headers: {},
      params: { userId: targetUserId },
    };

    const response = await handlers.updateUserTier(request);

    expect(response.status).toBe(400);
    expect(response.body.error).toBe('VALIDATION_ERROR');
    expect(response.body.message).toContain('Invalid tier');
  });

  it('should return 404 when user not found', async () => {
    const request: AuthRequest = {
      method: 'PATCH',
      path: '/admin/users/nonexistent-id/tier',
      body: { tier: 'PRO' },
      headers: {},
      params: { userId: 'nonexistent-id' },
    };

    const response = await handlers.updateUserTier(request);

    expect(response.status).toBe(404);
    expect(response.body.error).toBe('USER_NOT_FOUND');
  });

  it('should update user tier to PRO', async () => {
    const request: AuthRequest = {
      method: 'PATCH',
      path: `/admin/users/${targetUserId}/tier`,
      body: { tier: 'PRO' },
      headers: {},
      params: { userId: targetUserId },
    };

    const response = await handlers.updateUserTier(request);

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.user).toBeDefined();
    expect(response.body.data.user.tier).toBe('PRO');
    expect(response.body.data.user.id).toBe(targetUserId);
  });

  it('should update user tier to TEAM', async () => {
    const request: AuthRequest = {
      method: 'PATCH',
      path: `/admin/users/${targetUserId}/tier`,
      body: { tier: 'TEAM' },
      headers: {},
      params: { userId: targetUserId },
    };

    const response = await handlers.updateUserTier(request);

    expect(response.status).toBe(200);
    expect(response.body.data.user.tier).toBe('TEAM');
  });

  it('should update user tier to FREE', async () => {
    // First set to PRO
    await db.updateUser(targetUserId, { tier: 'PRO' });

    const request: AuthRequest = {
      method: 'PATCH',
      path: `/admin/users/${targetUserId}/tier`,
      body: { tier: 'FREE' },
      headers: {},
      params: { userId: targetUserId },
    };

    const response = await handlers.updateUserTier(request);

    expect(response.status).toBe(200);
    expect(response.body.data.user.tier).toBe('FREE');
  });

  it('should persist the tier change in database', async () => {
    const request: AuthRequest = {
      method: 'PATCH',
      path: `/admin/users/${targetUserId}/tier`,
      body: { tier: 'TEAM' },
      headers: {},
      params: { userId: targetUserId },
    };

    await handlers.updateUserTier(request);

    const user = await db.getUserById(targetUserId);
    expect(user?.tier).toBe('TEAM');
  });

  it('should return user without password hash', async () => {
    const request: AuthRequest = {
      method: 'PATCH',
      path: `/admin/users/${targetUserId}/tier`,
      body: { tier: 'PRO' },
      headers: {},
      params: { userId: targetUserId },
    };

    const response = await handlers.updateUserTier(request);

    expect(response.status).toBe(200);
    const user = response.body.data.user;
    expect((user as Record<string, unknown>).passwordHash).toBeUndefined();
  });
});
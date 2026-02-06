import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import type { DatabaseAdapter, Subscription } from '@subauth/core';
import { createAuthMiddleware } from '../middleware/auth';
import { createErrorMiddleware } from '../middleware/error';

// ============================================
// TEST HELPERS
// ============================================

const JWT_SECRET = 'test-secret-key';

function createMockDatabaseAdapter(subscription: Subscription | null = null): DatabaseAdapter {
  return {
    getSubscriptionByUserId: vi.fn().mockResolvedValue(subscription),
    // Other methods not needed for these tests
  } as unknown as DatabaseAdapter;
}

function createMockSubscription(overrides: Partial<Subscription> = {}): Subscription {
  return {
    id: 'sub_123',
    userId: 'user_123',
    planId: 'PRO_MONTHLY',
    priceId: 'price_123',
    status: 'active',
    billingCycle: 'monthly',
    currentPeriodStart: new Date(),
    currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    cancelAtPeriodEnd: false,
    providerSubscriptionId: 'paddle_sub_123',
    providerCustomerId: 'paddle_cus_123',
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

function createMockRequest(overrides: Partial<Request> = {}): Request {
  return {
    headers: {},
    ...overrides,
  } as Request;
}

function createMockResponse(): Response & { _status: number; _json: unknown } {
  const res = {
    _status: 200,
    _json: null as unknown,
    status(code: number) {
      this._status = code;
      return this;
    },
    json(data: unknown) {
      this._json = data;
      return this;
    },
  };
  return res as Response & { _status: number; _json: unknown };
}

function createMockNext(): NextFunction & { called: boolean; error?: Error } {
  const next = vi.fn() as NextFunction & { called: boolean; error?: Error };
  next.called = false;
  return next;
}

function createValidToken(payload: object, expiresIn = '1h'): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn });
}

function createExpiredToken(payload: object): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '-1h' });
}

// ============================================
// TESTS: createAuthMiddleware
// ============================================

describe('createAuthMiddleware', () => {
  const middleware = createAuthMiddleware({ jwtSecret: JWT_SECRET });

  describe('authenticate', () => {
    it('should return 401 when authorization header is missing', () => {
      const req = createMockRequest();
      const res = createMockResponse();
      const next = createMockNext();

      middleware.authenticate(req, res, next);

      expect(res._status).toBe(401);
      expect(res._json).toEqual({ success: false, error: 'Missing authorization token' });
      expect(next).not.toHaveBeenCalled();
    });

    it('should return 401 when authorization header does not start with Bearer', () => {
      const req = createMockRequest({
        headers: { authorization: 'Basic abc123' },
      });
      const res = createMockResponse();
      const next = createMockNext();

      middleware.authenticate(req, res, next);

      expect(res._status).toBe(401);
      expect(res._json).toEqual({ success: false, error: 'Missing authorization token' });
      expect(next).not.toHaveBeenCalled();
    });

    it('should return 401 when token is invalid', () => {
      const req = createMockRequest({
        headers: { authorization: 'Bearer invalid-token' },
      });
      const res = createMockResponse();
      const next = createMockNext();

      middleware.authenticate(req, res, next);

      expect(res._status).toBe(401);
      expect(res._json).toEqual({ success: false, error: 'Invalid token' });
      expect(next).not.toHaveBeenCalled();
    });

    it('should return 401 when token is expired', () => {
      const token = createExpiredToken({ userId: '123', email: 'test@test.com' });
      const req = createMockRequest({
        headers: { authorization: `Bearer ${token}` },
      });
      const res = createMockResponse();
      const next = createMockNext();

      middleware.authenticate(req, res, next);

      expect(res._status).toBe(401);
      expect(res._json).toEqual({ success: false, error: 'Token expired' });
      expect(next).not.toHaveBeenCalled();
    });

    it('should attach user to request and call next when token is valid', () => {
      const payload = { userId: '123', email: 'test@test.com', tier: 'PRO', isAdmin: false };
      const token = createValidToken(payload);
      const req = createMockRequest({
        headers: { authorization: `Bearer ${token}` },
      });
      const res = createMockResponse();
      const next = createMockNext();

      middleware.authenticate(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(req.user).toBeDefined();
      expect(req.user?.userId).toBe('123');
      expect(req.user?.email).toBe('test@test.com');
      expect(req.user?.tier).toBe('PRO');
      expect(req.user?.isAdmin).toBe(false);
    });

    it('should handle tokens with custom claims', () => {
      const payload = { userId: '123', email: 'test@test.com', customField: 'custom-value' };
      const token = createValidToken(payload);
      const req = createMockRequest({
        headers: { authorization: `Bearer ${token}` },
      });
      const res = createMockResponse();
      const next = createMockNext();

      middleware.authenticate(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(req.user?.customField).toBe('custom-value');
    });
  });

  describe('requireTier', () => {
    it('should return 401 when user is not authenticated', () => {
      const database = createMockDatabaseAdapter();
      const middlewareWithDb = createAuthMiddleware({ jwtSecret: JWT_SECRET, database });

      const req = createMockRequest();
      const res = createMockResponse();
      const next = createMockNext();

      middlewareWithDb.requireTier('PRO')(req, res, next);

      expect(res._status).toBe(401);
      expect(res._json).toEqual({ success: false, error: 'Not authenticated' });
      expect(next).not.toHaveBeenCalled();
    });

    it('should return 500 when database adapter is not configured', () => {
      const req = createMockRequest();
      req.user = { userId: '123', email: 'test@test.com', exp: 0, iat: 0 };
      const res = createMockResponse();
      const next = createMockNext();

      middleware.requireTier('PRO')(req, res, next);

      expect(res._status).toBe(500);
      expect((res._json as any).error).toBe('Database adapter not configured for tier checks');
    });
  });

  describe('requireAdmin', () => {
    it('should return 401 when user is not authenticated', () => {
      const req = createMockRequest();
      const res = createMockResponse();
      const next = createMockNext();

      middleware.requireAdmin(req, res, next);

      expect(res._status).toBe(401);
      expect(res._json).toEqual({ success: false, error: 'Not authenticated' });
      expect(next).not.toHaveBeenCalled();
    });

    it('should return 403 when user is not an admin', () => {
      const req = createMockRequest();
      req.user = { userId: '123', email: 'test@test.com', isAdmin: false, exp: 0, iat: 0 };
      const res = createMockResponse();
      const next = createMockNext();

      middleware.requireAdmin(req, res, next);

      expect(res._status).toBe(403);
      expect(res._json).toEqual({ success: false, error: 'Admin access required' });
      expect(next).not.toHaveBeenCalled();
    });

    it('should return 403 when isAdmin is undefined', () => {
      const req = createMockRequest();
      req.user = { userId: '123', email: 'test@test.com', exp: 0, iat: 0 };
      const res = createMockResponse();
      const next = createMockNext();

      middleware.requireAdmin(req, res, next);

      expect(res._status).toBe(403);
      expect(res._json).toEqual({ success: false, error: 'Admin access required' });
      expect(next).not.toHaveBeenCalled();
    });

    it('should call next when user is an admin', () => {
      const req = createMockRequest();
      req.user = { userId: '123', email: 'test@test.com', isAdmin: true, exp: 0, iat: 0 };
      const res = createMockResponse();
      const next = createMockNext();

      middleware.requireAdmin(req, res, next);

      expect(next).toHaveBeenCalled();
    });
  });

  describe('requireValidSubscription (DB-based)', () => {
    it('should return 401 when user is not authenticated', async () => {
      const database = createMockDatabaseAdapter();
      const middlewareWithDb = createAuthMiddleware({ jwtSecret: JWT_SECRET, database });

      const req = createMockRequest();
      const res = createMockResponse();
      const next = createMockNext();

      await middlewareWithDb.requireValidSubscription(req, res, next);

      expect(res._status).toBe(401);
      expect(res._json).toEqual({ success: false, error: 'Not authenticated' });
      expect(next).not.toHaveBeenCalled();
    });

    it('should return 500 when database adapter is not configured', async () => {
      const middlewareNoDb = createAuthMiddleware({ jwtSecret: JWT_SECRET });

      const req = createMockRequest();
      req.user = { userId: '123', email: 'test@test.com', exp: 0, iat: 0 };
      const res = createMockResponse();
      const next = createMockNext();

      await middlewareNoDb.requireValidSubscription(req, res, next);

      expect(res._status).toBe(500);
      expect((res._json as any).error).toContain('Database adapter not configured');
    });

    it('should return 403 when user has no subscription', async () => {
      const database = createMockDatabaseAdapter(null);
      const middlewareWithDb = createAuthMiddleware({ jwtSecret: JWT_SECRET, database });

      const req = createMockRequest();
      req.user = { userId: '123', email: 'test@test.com', exp: 0, iat: 0 };
      const res = createMockResponse();
      const next = createMockNext();

      await middlewareWithDb.requireValidSubscription(req, res, next);

      expect(res._status).toBe(403);
      expect((res._json as any).error).toBe('no_subscription');
    });

    it('should return 403 when subscription is cancelled', async () => {
      const subscription = createMockSubscription({ status: 'canceled' });
      const database = createMockDatabaseAdapter(subscription);
      const middlewareWithDb = createAuthMiddleware({ jwtSecret: JWT_SECRET, database });

      const req = createMockRequest();
      req.user = { userId: '123', email: 'test@test.com', exp: 0, iat: 0 };
      const res = createMockResponse();
      const next = createMockNext();

      await middlewareWithDb.requireValidSubscription(req, res, next);

      expect(res._status).toBe(403);
      expect((res._json as any).error).toBe('cancelled');
    });

    it('should return 403 when subscription is past_due', async () => {
      const subscription = createMockSubscription({ status: 'past_due' });
      const database = createMockDatabaseAdapter(subscription);
      const middlewareWithDb = createAuthMiddleware({ jwtSecret: JWT_SECRET, database });

      const req = createMockRequest();
      req.user = { userId: '123', email: 'test@test.com', exp: 0, iat: 0 };
      const res = createMockResponse();
      const next = createMockNext();

      await middlewareWithDb.requireValidSubscription(req, res, next);

      expect(res._status).toBe(403);
      expect((res._json as any).error).toBe('past_due');
    });

    it('should return 403 when trial has expired', async () => {
      const subscription = createMockSubscription({
        status: 'trialing',
        trialEndDate: new Date(Date.now() - 1000), // expired
      });
      const database = createMockDatabaseAdapter(subscription);
      const middlewareWithDb = createAuthMiddleware({ jwtSecret: JWT_SECRET, database });

      const req = createMockRequest();
      req.user = { userId: '123', email: 'test@test.com', exp: 0, iat: 0 };
      const res = createMockResponse();
      const next = createMockNext();

      await middlewareWithDb.requireValidSubscription(req, res, next);

      expect(res._status).toBe(403);
      expect((res._json as any).error).toBe('trial_expired');
    });

    it('should call next when subscription is active', async () => {
      const subscription = createMockSubscription({ status: 'active' });
      const database = createMockDatabaseAdapter(subscription);
      const middlewareWithDb = createAuthMiddleware({ jwtSecret: JWT_SECRET, database });

      const req = createMockRequest();
      req.user = { userId: '123', email: 'test@test.com', exp: 0, iat: 0 };
      const res = createMockResponse();
      const next = createMockNext();

      await middlewareWithDb.requireValidSubscription(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(req.subscription).toEqual(subscription);
    });

    it('should call next when trial is still valid', async () => {
      const subscription = createMockSubscription({
        status: 'trialing',
        trialEndDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days from now
      });
      const database = createMockDatabaseAdapter(subscription);
      const middlewareWithDb = createAuthMiddleware({ jwtSecret: JWT_SECRET, database });

      const req = createMockRequest();
      req.user = { userId: '123', email: 'test@test.com', exp: 0, iat: 0 };
      const res = createMockResponse();
      const next = createMockNext();

      await middlewareWithDb.requireValidSubscription(req, res, next);

      expect(next).toHaveBeenCalled();
    });

    it('should attach subscription to request', async () => {
      const subscription = createMockSubscription();
      const database = createMockDatabaseAdapter(subscription);
      const middlewareWithDb = createAuthMiddleware({ jwtSecret: JWT_SECRET, database });

      const req = createMockRequest();
      req.user = { userId: '123', email: 'test@test.com', exp: 0, iat: 0 };
      const res = createMockResponse();
      const next = createMockNext();

      await middlewareWithDb.requireValidSubscription(req, res, next);

      expect(req.subscription).toBe(subscription);
    });
  });

  describe('requireTier (DB-based)', () => {
    it('should derive tier from planId and allow access when sufficient', async () => {
      const subscription = createMockSubscription({ planId: 'PRO_MONTHLY', status: 'active' });
      const database = createMockDatabaseAdapter(subscription);
      const middlewareWithDb = createAuthMiddleware({ jwtSecret: JWT_SECRET, database });

      const req = createMockRequest();
      req.user = { userId: '123', email: 'test@test.com', exp: 0, iat: 0 };
      const res = createMockResponse();
      const next = createMockNext();

      await middlewareWithDb.requireTier('PRO')(req, res, next);

      expect(next).toHaveBeenCalled();
    });

    it('should return 403 when tier is insufficient', async () => {
      const subscription = createMockSubscription({ planId: 'PRO_MONTHLY', status: 'active' });
      const database = createMockDatabaseAdapter(subscription);
      const middlewareWithDb = createAuthMiddleware({ jwtSecret: JWT_SECRET, database });

      const req = createMockRequest();
      req.user = { userId: '123', email: 'test@test.com', exp: 0, iat: 0 };
      const res = createMockResponse();
      const next = createMockNext();

      await middlewareWithDb.requireTier('TEAM')(req, res, next);

      expect(res._status).toBe(403);
      expect((res._json as any).error).toBe('insufficient_tier');
    });

    it('should treat user as FREE tier when no subscription', async () => {
      const database = createMockDatabaseAdapter(null);
      const middlewareWithDb = createAuthMiddleware({ jwtSecret: JWT_SECRET, database });

      const req = createMockRequest();
      req.user = { userId: '123', email: 'test@test.com', exp: 0, iat: 0 };
      const res = createMockResponse();
      const next = createMockNext();

      await middlewareWithDb.requireTier('PRO')(req, res, next);

      expect(res._status).toBe(403);
      expect((res._json as any).currentTier).toBe('FREE');
    });

    it('should treat user as FREE tier when subscription is invalid', async () => {
      const subscription = createMockSubscription({ planId: 'PRO_MONTHLY', status: 'canceled' });
      const database = createMockDatabaseAdapter(subscription);
      const middlewareWithDb = createAuthMiddleware({ jwtSecret: JWT_SECRET, database });

      const req = createMockRequest();
      req.user = { userId: '123', email: 'test@test.com', exp: 0, iat: 0 };
      const res = createMockResponse();
      const next = createMockNext();

      await middlewareWithDb.requireTier('PRO')(req, res, next);

      expect(res._status).toBe(403);
      expect((res._json as any).currentTier).toBe('FREE');
    });

    it('should derive TEAM tier from TEAM_YEARLY planId', async () => {
      const subscription = createMockSubscription({ planId: 'TEAM_YEARLY', status: 'active' });
      const database = createMockDatabaseAdapter(subscription);
      const middlewareWithDb = createAuthMiddleware({ jwtSecret: JWT_SECRET, database });

      const req = createMockRequest();
      req.user = { userId: '123', email: 'test@test.com', exp: 0, iat: 0 };
      const res = createMockResponse();
      const next = createMockNext();

      await middlewareWithDb.requireTier('TEAM')(req, res, next);

      expect(next).toHaveBeenCalled();
    });

    it('should use cached subscription from requireValidSubscription', async () => {
      const subscription = createMockSubscription({ planId: 'PRO_MONTHLY', status: 'active' });
      const database = createMockDatabaseAdapter(subscription);
      const middlewareWithDb = createAuthMiddleware({ jwtSecret: JWT_SECRET, database });

      const req = createMockRequest();
      req.user = { userId: '123', email: 'test@test.com', exp: 0, iat: 0 };
      req.subscription = subscription; // Already cached
      const res = createMockResponse();
      const next = createMockNext();

      await middlewareWithDb.requireTier('PRO')(req, res, next);

      expect(next).toHaveBeenCalled();
      // Should not query DB again since subscription is cached
      expect(database.getSubscriptionByUserId).not.toHaveBeenCalled();
    });

    it('should support custom planToTier function', async () => {
      const subscription = createMockSubscription({ planId: 'premium_plan', status: 'active' });
      const database = createMockDatabaseAdapter(subscription);
      const customPlanToTier = (planId: string) => planId === 'premium_plan' ? 'PREMIUM' : 'BASIC';
      const middlewareWithDb = createAuthMiddleware({
        jwtSecret: JWT_SECRET,
        database,
        planToTier: customPlanToTier,
      });

      const req = createMockRequest();
      req.user = { userId: '123', email: 'test@test.com', exp: 0, iat: 0 };
      const res = createMockResponse();
      const next = createMockNext();

      await middlewareWithDb.requireTier('PREMIUM', { BASIC: 0, PREMIUM: 1 })(req, res, next);

      expect(next).toHaveBeenCalled();
    });
  });
});

// ============================================
// TESTS: createErrorMiddleware
// ============================================

describe('createErrorMiddleware', () => {
  const { errorHandler, createError } = createErrorMiddleware();

  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  describe('errorHandler', () => {
    it('should return 500 for generic errors', () => {
      const error = new Error('Something went wrong');
      const req = createMockRequest();
      const res = createMockResponse();
      const next = createMockNext();

      errorHandler(error, req, res, next);

      expect(res._status).toBe(500);
      expect(res._json).toEqual({ success: false, error: 'Internal server error' });
    });

    it('should use statusCode from operational errors', () => {
      const error = createError('Not found', 404);
      const req = createMockRequest();
      const res = createMockResponse();
      const next = createMockNext();

      errorHandler(error, req, res, next);

      expect(res._status).toBe(404);
      expect(res._json).toEqual({ success: false, error: 'Not found' });
    });

    it('should expose message for operational errors', () => {
      const error = createError('Custom error message', 400);
      const req = createMockRequest();
      const res = createMockResponse();
      const next = createMockNext();

      errorHandler(error, req, res, next);

      expect(res._json).toEqual({ success: false, error: 'Custom error message' });
    });

    it('should hide message for non-operational errors', () => {
      const error = new Error('Sensitive database error');
      const req = createMockRequest();
      const res = createMockResponse();
      const next = createMockNext();

      errorHandler(error, req, res, next);

      expect(res._json).toEqual({ success: false, error: 'Internal server error' });
    });

    it('should log all errors', () => {
      const error = new Error('Test error');
      const req = createMockRequest();
      const res = createMockResponse();
      const next = createMockNext();

      errorHandler(error, req, res, next);

      expect(console.error).toHaveBeenCalled();
    });
  });

  describe('createError', () => {
    it('should create an operational error with status code', () => {
      const error = createError('Bad request', 400);

      expect(error.message).toBe('Bad request');
      expect(error.statusCode).toBe(400);
      expect(error.isOperational).toBe(true);
    });

    it('should create errors that are instanceof Error', () => {
      const error = createError('Test', 500);

      expect(error).toBeInstanceOf(Error);
    });
  });
});
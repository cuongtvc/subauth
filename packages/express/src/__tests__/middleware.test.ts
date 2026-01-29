import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { createAuthMiddleware } from '../middleware/auth';
import { createErrorMiddleware } from '../middleware/error';

// ============================================
// TEST HELPERS
// ============================================

const JWT_SECRET = 'test-secret-key';

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
      const req = createMockRequest();
      const res = createMockResponse();
      const next = createMockNext();

      middleware.requireTier('PRO')(req, res, next);

      expect(res._status).toBe(401);
      expect(res._json).toEqual({ success: false, error: 'Not authenticated' });
      expect(next).not.toHaveBeenCalled();
    });

    it('should return 403 when user tier is below required tier', () => {
      const req = createMockRequest();
      req.user = { userId: '123', email: 'test@test.com', tier: 'FREE', isAdmin: false, exp: 0, iat: 0 };
      const res = createMockResponse();
      const next = createMockNext();

      middleware.requireTier('PRO')(req, res, next);

      expect(res._status).toBe(403);
      expect(res._json).toEqual({ success: false, error: 'This feature requires PRO tier or higher' });
      expect(next).not.toHaveBeenCalled();
    });

    it('should call next when user tier equals required tier', () => {
      const req = createMockRequest();
      req.user = { userId: '123', email: 'test@test.com', tier: 'PRO', isAdmin: false, exp: 0, iat: 0 };
      const res = createMockResponse();
      const next = createMockNext();

      middleware.requireTier('PRO')(req, res, next);

      expect(next).toHaveBeenCalled();
    });

    it('should call next when user tier is above required tier', () => {
      const req = createMockRequest();
      req.user = { userId: '123', email: 'test@test.com', tier: 'TEAM', isAdmin: false, exp: 0, iat: 0 };
      const res = createMockResponse();
      const next = createMockNext();

      middleware.requireTier('PRO')(req, res, next);

      expect(next).toHaveBeenCalled();
    });

    it('should default to FREE tier when user has no tier', () => {
      const req = createMockRequest();
      req.user = { userId: '123', email: 'test@test.com', exp: 0, iat: 0 };
      const res = createMockResponse();
      const next = createMockNext();

      middleware.requireTier('FREE')(req, res, next);

      expect(next).toHaveBeenCalled();
    });

    it('should support custom tier ordering', () => {
      const customTierOrder = { BASIC: 0, STANDARD: 1, PREMIUM: 2 };
      const req = createMockRequest();
      req.user = { userId: '123', email: 'test@test.com', tier: 'STANDARD', exp: 0, iat: 0 };
      const res = createMockResponse();
      const next = createMockNext();

      middleware.requireTier('PREMIUM', customTierOrder)(req, res, next);

      expect(res._status).toBe(403);
      expect(next).not.toHaveBeenCalled();
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
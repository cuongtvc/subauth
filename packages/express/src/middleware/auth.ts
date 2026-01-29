import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import type { AuthTokenPayload } from '@subauth/core';

declare global {
  namespace Express {
    interface Request {
      user?: AuthTokenPayload;
    }
  }
}

export interface AuthMiddlewareConfig {
  jwtSecret: string;
}

export function createAuthMiddleware(config: AuthMiddlewareConfig) {
  const { jwtSecret } = config;

  function authenticate(req: Request, res: Response, next: NextFunction): void {
    const authHeader = req.headers.authorization;

    if (!authHeader?.startsWith('Bearer ')) {
      res.status(401).json({ success: false, error: 'Missing authorization token' });
      return;
    }

    const token = authHeader.split(' ')[1];

    try {
      const decoded = jwt.verify(token, jwtSecret) as AuthTokenPayload;
      req.user = decoded;
      next();
    } catch (error) {
      if (error instanceof jwt.TokenExpiredError) {
        res.status(401).json({ success: false, error: 'Token expired' });
        return;
      }
      res.status(401).json({ success: false, error: 'Invalid token' });
    }
  }

  function requireTier(
    minTier: string,
    tierOrder: Record<string, number> = { FREE: 0, PRO: 1, TEAM: 2 }
  ) {
    return (req: Request, res: Response, next: NextFunction): void => {
      if (!req.user) {
        res.status(401).json({ success: false, error: 'Not authenticated' });
        return;
      }

      const userTier = req.user.tier ?? 'FREE';
      const userTierLevel = tierOrder[userTier] ?? 0;
      const minTierLevel = tierOrder[minTier] ?? 0;

      if (userTierLevel < minTierLevel) {
        res.status(403).json({
          success: false,
          error: `This feature requires ${minTier} tier or higher`,
        });
        return;
      }

      next();
    };
  }

  function requireAdmin(req: Request, res: Response, next: NextFunction): void {
    if (!req.user) {
      res.status(401).json({ success: false, error: 'Not authenticated' });
      return;
    }

    if (!req.user.isAdmin) {
      res.status(403).json({ success: false, error: 'Admin access required' });
      return;
    }

    next();
  }

  return {
    authenticate,
    requireTier,
    requireAdmin,
  };
}

export type AuthMiddleware = ReturnType<typeof createAuthMiddleware>;
import type { AuthRequest, AuthResponse } from './types';
import { AuthService, type AuthServiceConfig } from '../auth-service';
import { AuthError } from '@subauth/core';

export interface AuthHandlersConfig extends AuthServiceConfig {}

export function createAuthHandlers(config: AuthHandlersConfig) {
  const authService = new AuthService(config);

  // Helper to extract token from Authorization header
  function extractToken(headers: Record<string, string | undefined>): string | null {
    const auth = headers.authorization || headers.Authorization;
    if (!auth || !auth.startsWith('Bearer ')) {
      return null;
    }
    return auth.slice(7);
  }

  // Helper to get user ID from token
  async function getUserIdFromToken(headers: Record<string, string | undefined>): Promise<string | null> {
    const token = extractToken(headers);
    if (!token) return null;

    const result = await authService.validateToken(token);
    return result.valid ? result.userId ?? null : null;
  }

  return {
    async register(request: AuthRequest): Promise<AuthResponse> {
      try {
        const { email, password } = request.body as { email?: string; password?: string };

        if (!email || !password) {
          return {
            status: 400,
            body: { error: 'VALIDATION_ERROR', message: 'Email and password are required' },
          };
        }

        const result = await authService.register({ email, password });

        return {
          status: 201,
          body: {
            user: result.user,
            tokens: result.tokens,
          },
        };
      } catch (error) {
        if (error instanceof AuthError) {
          return {
            status: error.statusCode,
            body: { error: error.code, message: error.message },
          };
        }
        return {
          status: 500,
          body: { error: 'INTERNAL_ERROR', message: 'An unexpected error occurred' },
        };
      }
    },

    async login(request: AuthRequest): Promise<AuthResponse> {
      try {
        const { email, password } = request.body as { email?: string; password?: string };

        if (!email || !password) {
          return {
            status: 400,
            body: { error: 'VALIDATION_ERROR', message: 'Email and password are required' },
          };
        }

        const result = await authService.login({ email, password });

        return {
          status: 200,
          body: {
            user: result.user,
            tokens: result.tokens,
          },
        };
      } catch (error) {
        if (error instanceof AuthError) {
          return {
            status: error.statusCode,
            body: { error: error.code, message: error.message },
          };
        }
        return {
          status: 500,
          body: { error: 'INTERNAL_ERROR', message: 'An unexpected error occurred' },
        };
      }
    },

    async getMe(request: AuthRequest): Promise<AuthResponse> {
      try {
        const token = extractToken(request.headers);
        if (!token) {
          return {
            status: 401,
            body: { error: 'UNAUTHORIZED', message: 'Authentication required' },
          };
        }

        const user = await authService.getUserFromToken(token);
        if (!user) {
          return {
            status: 401,
            body: { error: 'UNAUTHORIZED', message: 'Invalid or expired token' },
          };
        }

        return {
          status: 200,
          body: { user },
        };
      } catch (error) {
        return {
          status: 500,
          body: { error: 'INTERNAL_ERROR', message: 'An unexpected error occurred' },
        };
      }
    },

    async verifyEmail(request: AuthRequest): Promise<AuthResponse> {
      try {
        const token = request.params?.token;
        if (!token) {
          return {
            status: 400,
            body: { error: 'VALIDATION_ERROR', message: 'Token is required' },
          };
        }

        const result = await authService.verifyEmail({ token });

        return {
          status: 200,
          body: { user: result.user },
        };
      } catch (error) {
        if (error instanceof AuthError) {
          return {
            status: error.statusCode,
            body: { error: error.code, message: error.message },
          };
        }
        return {
          status: 500,
          body: { error: 'INTERNAL_ERROR', message: 'An unexpected error occurred' },
        };
      }
    },

    async resendVerification(request: AuthRequest): Promise<AuthResponse> {
      try {
        const { email } = request.body as { email?: string };

        if (!email) {
          return {
            status: 400,
            body: { error: 'VALIDATION_ERROR', message: 'Email is required' },
          };
        }

        await authService.resendVerificationEmail(email);

        return {
          status: 200,
          body: { success: true },
        };
      } catch (error) {
        // Always return 200 for security (don't reveal user existence)
        return {
          status: 200,
          body: { success: true },
        };
      }
    },

    async forgotPassword(request: AuthRequest): Promise<AuthResponse> {
      try {
        const { email } = request.body as { email?: string };

        if (!email) {
          return {
            status: 400,
            body: { error: 'VALIDATION_ERROR', message: 'Email is required' },
          };
        }

        await authService.requestPasswordReset({ email });

        return {
          status: 200,
          body: { success: true },
        };
      } catch (error) {
        // Always return 200 for security (don't reveal user existence)
        return {
          status: 200,
          body: { success: true },
        };
      }
    },

    async resetPassword(request: AuthRequest): Promise<AuthResponse> {
      try {
        const { token, newPassword } = request.body as { token?: string; newPassword?: string };

        if (!token || !newPassword) {
          return {
            status: 400,
            body: { error: 'VALIDATION_ERROR', message: 'Token and new password are required' },
          };
        }

        await authService.resetPassword({ token, newPassword });

        return {
          status: 200,
          body: { success: true },
        };
      } catch (error) {
        if (error instanceof AuthError) {
          return {
            status: error.statusCode,
            body: { error: error.code, message: error.message },
          };
        }
        return {
          status: 500,
          body: { error: 'INTERNAL_ERROR', message: 'An unexpected error occurred' },
        };
      }
    },

    async changePassword(request: AuthRequest): Promise<AuthResponse> {
      try {
        const userId = await getUserIdFromToken(request.headers);
        if (!userId) {
          return {
            status: 401,
            body: { error: 'UNAUTHORIZED', message: 'Authentication required' },
          };
        }

        const { currentPassword, newPassword } = request.body as {
          currentPassword?: string;
          newPassword?: string;
        };

        if (!currentPassword || !newPassword) {
          return {
            status: 400,
            body: { error: 'VALIDATION_ERROR', message: 'Current and new passwords are required' },
          };
        }

        await authService.changePassword(userId, { currentPassword, newPassword });

        return {
          status: 200,
          body: { success: true },
        };
      } catch (error) {
        if (error instanceof AuthError) {
          return {
            status: error.statusCode,
            body: { error: error.code, message: error.message },
          };
        }
        return {
          status: 500,
          body: { error: 'INTERNAL_ERROR', message: 'An unexpected error occurred' },
        };
      }
    },
  };
}

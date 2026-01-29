import type { AuthRequest, AuthResponse } from './types';
import type { SubAuthConfig } from '@subauth/core';

export interface AdminHandlersConfig extends SubAuthConfig {}

const VALID_TIERS = ['FREE', 'PRO', 'TEAM'] as const;

/**
 * Creates admin handlers for user management.
 *
 * IMPORTANT: These handlers assume authentication and admin authorization
 * has already been verified by middleware (e.g., Express authenticate + requireAdmin).
 */
export function createAdminHandlers(config: AdminHandlersConfig) {
  const { database } = config;

  return {
    async listUsers(request: AuthRequest): Promise<AuthResponse> {
      try {
        const page = parseInt(request.query?.page || '1', 10);
        const limit = parseInt(request.query?.limit || '20', 10);
        const search = request.query?.search || '';

        const { users, total } = await database.listUsers!({ page, limit, search });

        return {
          status: 200,
          body: {
            success: true,
            data: {
              users,
              pagination: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit),
              },
            },
          },
        };
      } catch (error) {
        return {
          status: 500,
          body: { error: 'INTERNAL_ERROR', message: 'An unexpected error occurred' },
        };
      }
    },

    async updateUserTier(request: AuthRequest): Promise<AuthResponse> {
      try {
        const userId = request.params?.userId;
        const { tier } = request.body as { tier?: string };

        if (!tier) {
          return {
            status: 400,
            body: { error: 'VALIDATION_ERROR', message: 'Tier is required' },
          };
        }

        if (!VALID_TIERS.includes(tier as typeof VALID_TIERS[number])) {
          return {
            status: 400,
            body: { error: 'VALIDATION_ERROR', message: 'Invalid tier. Must be FREE, PRO, or TEAM' },
          };
        }

        const existingUser = await database.getUserById(userId!);
        if (!existingUser) {
          return {
            status: 404,
            body: { error: 'USER_NOT_FOUND', message: 'User not found' },
          };
        }

        const updatedUser = await database.updateUser(userId!, { tier });

        return {
          status: 200,
          body: {
            success: true,
            data: {
              user: {
                id: updatedUser.id,
                email: updatedUser.email,
                tier: updatedUser.tier,
                isAdmin: updatedUser.isAdmin,
                emailVerified: updatedUser.emailVerified,
                createdAt: updatedUser.createdAt,
              },
            },
          },
        };
      } catch (error) {
        return {
          status: 500,
          body: { error: 'INTERNAL_ERROR', message: 'An unexpected error occurred' },
        };
      }
    },
  };
}
import { describe, it, expect, beforeEach, vi, type Mock } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { ReactNode } from 'react';
import { AuthProvider, useAuth } from '../hooks/AuthProvider';

function createWrapper(props: Parameters<typeof AuthProvider>[0] = {}) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return <AuthProvider {...props}>{children}</AuthProvider>;
  };
}

describe('AuthProvider', () => {
  let mockFetch: Mock;

  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();

    mockFetch = vi.fn();
    global.fetch = mockFetch;
  });

  describe('useAuth without provider', () => {
    it('should throw error when used outside AuthProvider', () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      expect(() => {
        renderHook(() => useAuth());
      }).toThrow('useAuth must be used within an AuthProvider');

      consoleSpy.mockRestore();
    });
  });

  describe('useAuth with provider', () => {
    it('should return unauthenticated state initially', () => {
      const { result } = renderHook(() => useAuth(), { wrapper: createWrapper() });

      expect(result.current.state.isAuthenticated).toBe(false);
      expect(result.current.state.user).toBeNull();
      expect(result.current.error).toBeNull();
    });

    it('should return authenticated state when token exists in localStorage', () => {
      localStorage.setItem('auth_token', 'test-access-token');
      localStorage.setItem('auth_user', JSON.stringify({ id: 'user-123', email: 'test@example.com' }));

      const { result } = renderHook(() => useAuth(), { wrapper: createWrapper() });

      expect(result.current.state.isAuthenticated).toBe(true);
      expect(result.current.state.user?.email).toBe('test@example.com');
    });

    it('should update state on successful login', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            user: { id: 'user-123', email: 'test@example.com' },
            tokens: {
              accessToken: 'access-token-123',
              refreshToken: 'refresh-token-123',
              expiresAt: new Date(Date.now() + 86400000).toISOString(),
            },
          }),
      });

      const { result } = renderHook(() => useAuth(), { wrapper: createWrapper() });

      await act(async () => {
        await result.current.login('test@example.com', 'password123');
      });

      expect(result.current.state.isAuthenticated).toBe(true);
      expect(result.current.state.user?.email).toBe('test@example.com');
    });

    it('should call onLoginSuccess callback after login', async () => {
      const onLoginSuccess = vi.fn();

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            user: { id: 'user-123', email: 'test@example.com' },
            tokens: {
              accessToken: 'access-token',
              refreshToken: 'refresh-token',
              expiresAt: new Date(Date.now() + 86400000).toISOString(),
            },
          }),
      });

      const { result } = renderHook(() => useAuth(), {
        wrapper: createWrapper({ onLoginSuccess }),
      });

      await act(async () => {
        await result.current.login('test@example.com', 'password123');
      });

      expect(onLoginSuccess).toHaveBeenCalled();
    });

    it('should clear state on logout', async () => {
      localStorage.setItem('auth_token', 'token');
      localStorage.setItem('auth_user', JSON.stringify({ id: 'user-123' }));

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ success: true }),
      });

      const { result } = renderHook(() => useAuth(), { wrapper: createWrapper() });

      expect(result.current.state.isAuthenticated).toBe(true);

      act(() => {
        result.current.logout();
      });

      await waitFor(() => {
        expect(result.current.state.isAuthenticated).toBe(false);
      });
      expect(result.current.state.user).toBeNull();
    });
  });
});
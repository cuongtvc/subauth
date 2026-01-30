import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// Import will fail until we implement - that's TDD!
import { AuthClient } from '../auth-client';
import type { AuthClientConfig, AuthState } from '../types';

// ============================================
// MOCK SETUP
// ============================================

function createMockFetch() {
  return vi.fn();
}

function createMockStorage(): Storage {
  const store = new Map<string, string>();
  return {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => { store.set(key, value); },
    removeItem: (key: string) => { store.delete(key); },
    clear: () => { store.clear(); },
    key: (index: number) => Array.from(store.keys())[index] ?? null,
    get length() { return store.size; },
  };
}

function createTestConfig(overrides?: Partial<AuthClientConfig>): AuthClientConfig {
  return {
    baseUrl: 'http://localhost:3000',
    tokenStorageKey: 'auth_token',
    userStorageKey: 'auth_user',
    ...overrides,
  };
}

function mockSuccessResponse(data: unknown) {
  return Promise.resolve({
    ok: true,
    status: 200,
    json: () => Promise.resolve(data),
  });
}

function mockErrorResponse(status: number, error: unknown) {
  return Promise.resolve({
    ok: false,
    status,
    json: () => Promise.resolve(error),
  });
}

// ============================================
// AUTH CLIENT - INITIALIZATION TESTS
// ============================================

describe('AuthClient - Initialization', () => {
  let storage: Storage;
  let mockFetch: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    storage = createMockStorage();
    mockFetch = createMockFetch();
    vi.stubGlobal('fetch', mockFetch);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('should initialize with default state (not authenticated)', () => {
    const client = new AuthClient(createTestConfig(), storage);
    const state = client.getState();

    expect(state.isAuthenticated).toBe(false);
    expect(state.user).toBeNull();
    expect(state.token).toBeNull();
    expect(state.isLoading).toBe(false);
  });

  it('should restore state from storage on init', () => {
    storage.setItem('auth_token', 'stored_token');
    storage.setItem('auth_user', JSON.stringify({ id: '1', email: 'test@example.com' }));

    const client = new AuthClient(createTestConfig(), storage);
    const state = client.getState();

    expect(state.isAuthenticated).toBe(true);
    expect(state.token).toBe('stored_token');
    expect(state.user?.email).toBe('test@example.com');
  });

  it('should handle corrupted storage gracefully', () => {
    storage.setItem('auth_user', 'not-valid-json');

    const client = new AuthClient(createTestConfig(), storage);
    const state = client.getState();

    expect(state.isAuthenticated).toBe(false);
    expect(state.user).toBeNull();
  });

  it('should use custom storage keys', () => {
    storage.setItem('custom_token', 'my_token');
    storage.setItem('custom_user', JSON.stringify({ id: '1', email: 'test@example.com' }));

    const client = new AuthClient(
      createTestConfig({ tokenStorageKey: 'custom_token', userStorageKey: 'custom_user' }),
      storage
    );

    expect(client.getState().token).toBe('my_token');
  });
});

// ============================================
// AUTH CLIENT - REGISTER TESTS
// ============================================

describe('AuthClient - Register', () => {
  let client: AuthClient;
  let storage: Storage;
  let mockFetch: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    storage = createMockStorage();
    mockFetch = createMockFetch();
    vi.stubGlobal('fetch', mockFetch);
    client = new AuthClient(createTestConfig(), storage);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('should register user and update state', async () => {
    mockFetch.mockReturnValueOnce(mockSuccessResponse({
      user: { id: '1', email: 'test@example.com', emailVerified: false },
      tokens: { accessToken: 'new_token', expiresAt: new Date(Date.now() + 86400000).toISOString() },
    }));

    const result = await client.register({ email: 'test@example.com', password: 'password123' });

    expect(result.user.email).toBe('test@example.com');
    expect(client.getState().isAuthenticated).toBe(true);
    expect(client.getState().token).toBe('new_token');
  });

  it('should persist token to storage after register', async () => {
    mockFetch.mockReturnValueOnce(mockSuccessResponse({
      user: { id: '1', email: 'test@example.com', emailVerified: false },
      tokens: { accessToken: 'new_token', expiresAt: new Date(Date.now() + 86400000).toISOString() },
    }));

    await client.register({ email: 'test@example.com', password: 'password123' });

    expect(storage.getItem('auth_token')).toBe('new_token');
  });

  it('should call correct endpoint with correct payload', async () => {
    mockFetch.mockReturnValueOnce(mockSuccessResponse({
      user: { id: '1', email: 'test@example.com', emailVerified: false },
      tokens: { accessToken: 'token', expiresAt: new Date().toISOString() },
    }));

    await client.register({ email: 'test@example.com', password: 'password123' });

    expect(mockFetch).toHaveBeenCalledWith(
      'http://localhost:3000/auth/register',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ email: 'test@example.com', password: 'password123' }),
      })
    );
  });

  it('should throw error on registration failure', async () => {
    mockFetch.mockReturnValueOnce(mockErrorResponse(400, { code: 'USER_EXISTS', message: 'User already exists' }));

    await expect(
      client.register({ email: 'test@example.com', password: 'password123' })
    ).rejects.toThrow();
  });

  it('should not update state on registration failure', async () => {
    mockFetch.mockReturnValueOnce(mockErrorResponse(400, { code: 'USER_EXISTS' }));

    try {
      await client.register({ email: 'test@example.com', password: 'password123' });
    } catch {}

    expect(client.getState().isAuthenticated).toBe(false);
  });
});

// ============================================
// AUTH CLIENT - LOGIN TESTS
// ============================================

describe('AuthClient - Login', () => {
  let client: AuthClient;
  let storage: Storage;
  let mockFetch: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    storage = createMockStorage();
    mockFetch = createMockFetch();
    vi.stubGlobal('fetch', mockFetch);
    client = new AuthClient(createTestConfig(), storage);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('should login user and update state', async () => {
    mockFetch.mockReturnValueOnce(mockSuccessResponse({
      user: { id: '1', email: 'test@example.com', emailVerified: true },
      tokens: { accessToken: 'login_token', expiresAt: new Date(Date.now() + 86400000).toISOString() },
    }));

    const result = await client.login({ email: 'test@example.com', password: 'password123' });

    expect(result.user.email).toBe('test@example.com');
    expect(client.getState().isAuthenticated).toBe(true);
    expect(client.getState().token).toBe('login_token');
  });

  it('should throw error for invalid credentials', async () => {
    mockFetch.mockReturnValueOnce(mockErrorResponse(401, { code: 'INVALID_CREDENTIALS' }));

    await expect(
      client.login({ email: 'test@example.com', password: 'wrong' })
    ).rejects.toThrow();
  });

  it('should persist token to storage after login', async () => {
    mockFetch.mockReturnValueOnce(mockSuccessResponse({
      user: { id: '1', email: 'test@example.com', emailVerified: true },
      tokens: { accessToken: 'login_token', expiresAt: new Date().toISOString() },
    }));

    await client.login({ email: 'test@example.com', password: 'password123' });

    expect(storage.getItem('auth_token')).toBe('login_token');
  });
});

// ============================================
// AUTH CLIENT - LOGOUT TESTS
// ============================================

describe('AuthClient - Logout', () => {
  let client: AuthClient;
  let storage: Storage;
  let mockFetch: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    storage = createMockStorage();
    mockFetch = createMockFetch();
    vi.stubGlobal('fetch', mockFetch);

    // Start with authenticated user
    storage.setItem('auth_token', 'existing_token');
    storage.setItem('auth_user', JSON.stringify({ id: '1', email: 'test@example.com' }));
    client = new AuthClient(createTestConfig(), storage);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('should clear state on logout', async () => {
    mockFetch.mockReturnValueOnce(mockSuccessResponse({ success: true }));

    await client.logout();

    const state = client.getState();
    expect(state.isAuthenticated).toBe(false);
    expect(state.user).toBeNull();
    expect(state.token).toBeNull();
  });

  it('should clear storage on logout', async () => {
    mockFetch.mockReturnValueOnce(mockSuccessResponse({ success: true }));

    await client.logout();

    expect(storage.getItem('auth_token')).toBeNull();
    expect(storage.getItem('auth_user')).toBeNull();
  });

  it('should work even if not authenticated', async () => {
    const freshClient = new AuthClient(createTestConfig(), createMockStorage());

    await expect(freshClient.logout()).resolves.not.toThrow();
    expect(freshClient.getState().isAuthenticated).toBe(false);
  });
});

// ============================================
// AUTH CLIENT - STATE SUBSCRIPTION TESTS
// ============================================

describe('AuthClient - State Subscriptions', () => {
  let client: AuthClient;
  let storage: Storage;
  let mockFetch: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    storage = createMockStorage();
    mockFetch = createMockFetch();
    vi.stubGlobal('fetch', mockFetch);
    client = new AuthClient(createTestConfig(), storage);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('should notify subscribers on login', async () => {
    const listener = vi.fn();
    client.subscribe(listener);

    mockFetch.mockReturnValueOnce(mockSuccessResponse({
      user: { id: '1', email: 'test@example.com', emailVerified: true },
      tokens: { accessToken: 'token', expiresAt: new Date().toISOString() },
    }));

    await client.login({ email: 'test@example.com', password: 'password123' });

    expect(listener).toHaveBeenCalled();
    const lastCall = listener.mock.calls[listener.mock.calls.length - 1][0] as AuthState;
    expect(lastCall.isAuthenticated).toBe(true);
  });

  it('should notify subscribers on logout', async () => {
    storage.setItem('auth_token', 'token');
    storage.setItem('auth_user', JSON.stringify({ id: '1', email: 'test@example.com' }));
    client = new AuthClient(createTestConfig(), storage);

    mockFetch.mockReturnValueOnce(mockSuccessResponse({ success: true }));

    const listener = vi.fn();
    client.subscribe(listener);

    await client.logout();

    expect(listener).toHaveBeenCalled();
    const lastCall = listener.mock.calls[listener.mock.calls.length - 1][0] as AuthState;
    expect(lastCall.isAuthenticated).toBe(false);
  });

  it('should allow unsubscribing', async () => {
    const listener = vi.fn();
    const unsubscribe = client.subscribe(listener);

    unsubscribe();

    mockFetch.mockReturnValueOnce(mockSuccessResponse({
      user: { id: '1', email: 'test@example.com', emailVerified: true },
      tokens: { accessToken: 'token', expiresAt: new Date().toISOString() },
    }));

    await client.login({ email: 'test@example.com', password: 'password123' });

    expect(listener).not.toHaveBeenCalled();
  });

  it('should support multiple subscribers', async () => {
    const listener1 = vi.fn();
    const listener2 = vi.fn();

    client.subscribe(listener1);
    client.subscribe(listener2);

    mockFetch.mockReturnValueOnce(mockSuccessResponse({
      user: { id: '1', email: 'test@example.com', emailVerified: true },
      tokens: { accessToken: 'token', expiresAt: new Date().toISOString() },
    }));

    await client.login({ email: 'test@example.com', password: 'password123' });

    expect(listener1).toHaveBeenCalled();
    expect(listener2).toHaveBeenCalled();
  });
});

// ============================================
// AUTH CLIENT - TOKEN REFRESH TESTS
// ============================================

describe('AuthClient - Token Handling', () => {
  let client: AuthClient;
  let storage: Storage;
  let mockFetch: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    storage = createMockStorage();
    mockFetch = createMockFetch();
    vi.stubGlobal('fetch', mockFetch);
    client = new AuthClient(createTestConfig(), storage);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('should include token in authenticated requests', async () => {
    storage.setItem('auth_token', 'my_token');
    client = new AuthClient(createTestConfig(), storage);

    mockFetch.mockReturnValueOnce(mockSuccessResponse({ data: 'ok' }));

    await client.fetchWithAuth('/api/protected');

    expect(mockFetch).toHaveBeenCalledWith(
      'http://localhost:3000/api/protected',
      expect.objectContaining({
        headers: expect.objectContaining({
          'Authorization': 'Bearer my_token',
        }),
      })
    );
  });

  it('should not include token for unauthenticated requests', async () => {
    mockFetch.mockReturnValueOnce(mockSuccessResponse({ data: 'ok' }));

    await client.fetchWithAuth('/api/public', { skipAuth: true });

    const headers = mockFetch.mock.calls[0][1]?.headers as Record<string, string>;
    expect(headers['Authorization']).toBeUndefined();
  });

  it('should handle 401 response by logging out', async () => {
    storage.setItem('auth_token', 'expired_token');
    storage.setItem('auth_user', JSON.stringify({ id: '1', email: 'test@example.com' }));
    client = new AuthClient(createTestConfig(), storage);

    mockFetch.mockReturnValueOnce(mockErrorResponse(401, { code: 'TOKEN_EXPIRED' }));

    try {
      await client.fetchWithAuth('/api/protected');
    } catch {}

    expect(client.getState().isAuthenticated).toBe(false);
  });

  it('should call onTokenExpired callback when configured', async () => {
    const onTokenExpired = vi.fn();
    storage.setItem('auth_token', 'expired_token');
    client = new AuthClient(createTestConfig({ onTokenExpired }), storage);

    mockFetch.mockReturnValueOnce(mockErrorResponse(401, { code: 'TOKEN_EXPIRED' }));

    try {
      await client.fetchWithAuth('/api/protected');
    } catch {}

    expect(onTokenExpired).toHaveBeenCalled();
  });
});

// ============================================
// AUTH CLIENT - EMAIL VERIFICATION TESTS
// ============================================

describe('AuthClient - Email Verification', () => {
  let client: AuthClient;
  let mockFetch: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockFetch = createMockFetch();
    vi.stubGlobal('fetch', mockFetch);
    client = new AuthClient(createTestConfig(), createMockStorage());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('should verify email with token', async () => {
    mockFetch.mockReturnValueOnce(mockSuccessResponse({
      user: { id: '1', email: 'test@example.com', emailVerified: true },
    }));

    const result = await client.verifyEmail('verification_token');

    expect(result.user.emailVerified).toBe(true);
    expect(mockFetch).toHaveBeenCalledWith(
      'http://localhost:3000/auth/verify-email/verification_token',
      expect.objectContaining({ method: 'GET' })
    );
  });

  it('should resend verification email', async () => {
    mockFetch.mockReturnValueOnce(mockSuccessResponse({ success: true }));

    await client.resendVerificationEmail('test@example.com');

    expect(mockFetch).toHaveBeenCalledWith(
      'http://localhost:3000/auth/resend-verification',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ email: 'test@example.com' }),
      })
    );
  });
});

// ============================================
// AUTH CLIENT - PASSWORD RESET TESTS
// ============================================

describe('AuthClient - Password Reset', () => {
  let client: AuthClient;
  let mockFetch: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockFetch = createMockFetch();
    vi.stubGlobal('fetch', mockFetch);
    client = new AuthClient(createTestConfig(), createMockStorage());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('should request password reset', async () => {
    mockFetch.mockReturnValueOnce(mockSuccessResponse({ success: true }));

    await client.requestPasswordReset('test@example.com');

    expect(mockFetch).toHaveBeenCalledWith(
      'http://localhost:3000/auth/forgot-password',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ email: 'test@example.com' }),
      })
    );
  });

  it('should reset password with token', async () => {
    mockFetch.mockReturnValueOnce(mockSuccessResponse({ success: true }));

    await client.resetPassword('reset_token', 'new_password');

    expect(mockFetch).toHaveBeenCalledWith(
      'http://localhost:3000/auth/reset-password',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ token: 'reset_token', newPassword: 'new_password' }),
      })
    );
  });
});

// ============================================
// AUTH CLIENT - GET CURRENT USER TESTS
// ============================================

describe('AuthClient - Get Current User', () => {
  let client: AuthClient;
  let storage: Storage;
  let mockFetch: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    storage = createMockStorage();
    mockFetch = createMockFetch();
    vi.stubGlobal('fetch', mockFetch);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('should fetch and update current user', async () => {
    storage.setItem('auth_token', 'valid_token');
    client = new AuthClient(createTestConfig(), storage);

    mockFetch.mockReturnValueOnce(mockSuccessResponse({
      user: { id: '1', email: 'updated@example.com', emailVerified: true },
      subscription: { planId: 'basic', status: 'active' },
    }));

    const result = await client.getCurrentUser();

    expect(result.user.email).toBe('updated@example.com');
    expect(client.getState().user?.email).toBe('updated@example.com');
  });

  it('should throw if not authenticated', async () => {
    client = new AuthClient(createTestConfig(), storage);

    await expect(client.getCurrentUser()).rejects.toThrow();
  });
});

// ============================================
// AUTH CLIENT - REFRESH TOKEN TESTS
// ============================================

describe('AuthClient - Refresh Token Support', () => {
  let client: AuthClient;
  let storage: Storage;
  let mockFetch: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    storage = createMockStorage();
    mockFetch = createMockFetch();
    vi.stubGlobal('fetch', mockFetch);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('should store refresh token on login', async () => {
    client = new AuthClient(createTestConfig(), storage);

    mockFetch.mockReturnValueOnce(mockSuccessResponse({
      user: { id: '1', email: 'test@example.com', emailVerified: true },
      tokens: {
        accessToken: 'access_token',
        refreshToken: 'refresh_token',
        expiresAt: new Date(Date.now() + 86400000).toISOString(),
      },
    }));

    await client.login({ email: 'test@example.com', password: 'password123' });

    expect(client.getState().refreshToken).toBe('refresh_token');
    expect(storage.getItem('auth_refresh_token')).toBe('refresh_token');
  });

  it('should restore refresh token from storage on init', () => {
    storage.setItem('auth_token', 'stored_token');
    storage.setItem('auth_refresh_token', 'stored_refresh_token');
    storage.setItem('auth_user', JSON.stringify({ id: '1', email: 'test@example.com' }));

    client = new AuthClient(createTestConfig(), storage);
    const state = client.getState();

    expect(state.refreshToken).toBe('stored_refresh_token');
  });

  it('should use custom refresh token storage key', () => {
    storage.setItem('auth_token', 'token');
    storage.setItem('custom_refresh', 'my_refresh_token');
    storage.setItem('auth_user', JSON.stringify({ id: '1', email: 'test@example.com' }));

    client = new AuthClient(
      createTestConfig({ refreshTokenStorageKey: 'custom_refresh' }),
      storage
    );

    expect(client.getState().refreshToken).toBe('my_refresh_token');
  });

  it('should clear refresh token on logout', async () => {
    storage.setItem('auth_token', 'token');
    storage.setItem('auth_refresh_token', 'refresh_token');
    storage.setItem('auth_user', JSON.stringify({ id: '1', email: 'test@example.com' }));
    client = new AuthClient(createTestConfig(), storage);

    mockFetch.mockReturnValueOnce(mockSuccessResponse({ success: true }));

    await client.logout();

    expect(client.getState().refreshToken).toBeNull();
    expect(storage.getItem('auth_refresh_token')).toBeNull();
  });

  it('should auto-refresh token on 401 response', async () => {
    storage.setItem('auth_token', 'expired_token');
    storage.setItem('auth_refresh_token', 'valid_refresh_token');
    storage.setItem('auth_user', JSON.stringify({ id: '1', email: 'test@example.com' }));
    client = new AuthClient(createTestConfig(), storage);

    // First call returns 401
    mockFetch.mockReturnValueOnce(mockErrorResponse(401, { code: 'TOKEN_EXPIRED' }));

    // Refresh token call succeeds
    mockFetch.mockReturnValueOnce(mockSuccessResponse({
      tokens: {
        accessToken: 'new_access_token',
        refreshToken: 'new_refresh_token',
        expiresAt: new Date(Date.now() + 86400000).toISOString(),
      },
    }));

    // Retry with new token succeeds
    mockFetch.mockReturnValueOnce(mockSuccessResponse({ data: 'success' }));

    const response = await client.fetchWithAuth('/api/protected');
    const data = await response.json();

    expect(data.data).toBe('success');
    expect(client.getState().token).toBe('new_access_token');
    expect(client.getState().refreshToken).toBe('new_refresh_token');
  });

  it('should logout if refresh token fails', async () => {
    storage.setItem('auth_token', 'expired_token');
    storage.setItem('auth_refresh_token', 'invalid_refresh_token');
    storage.setItem('auth_user', JSON.stringify({ id: '1', email: 'test@example.com' }));
    client = new AuthClient(createTestConfig(), storage);

    // First call returns 401
    mockFetch.mockReturnValueOnce(mockErrorResponse(401, { code: 'TOKEN_EXPIRED' }));

    // Refresh token call fails
    mockFetch.mockReturnValueOnce(mockErrorResponse(401, { code: 'INVALID_REFRESH_TOKEN' }));

    await client.fetchWithAuth('/api/protected');

    expect(client.getState().isAuthenticated).toBe(false);
    expect(client.getState().token).toBeNull();
    expect(client.getState().refreshToken).toBeNull();
  });

  it('should call logout API with refresh token', async () => {
    storage.setItem('auth_token', 'token');
    storage.setItem('auth_refresh_token', 'refresh_token');
    storage.setItem('auth_user', JSON.stringify({ id: '1', email: 'test@example.com' }));
    client = new AuthClient(createTestConfig(), storage);

    mockFetch.mockReturnValueOnce(mockSuccessResponse({ success: true }));

    await client.logout();

    expect(mockFetch).toHaveBeenCalledWith(
      'http://localhost:3000/auth/logout',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          'Authorization': 'Bearer token',
        }),
        body: JSON.stringify({ refreshToken: 'refresh_token' }),
      })
    );
  });
});

// ============================================
// AUTH CLIENT - CALLBACK TESTS
// ============================================

describe('AuthClient - Callbacks', () => {
  let storage: Storage;
  let mockFetch: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    storage = createMockStorage();
    mockFetch = createMockFetch();
    vi.stubGlobal('fetch', mockFetch);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('should call onLoginSuccess callback after successful login', async () => {
    const onLoginSuccess = vi.fn();
    const client = new AuthClient(createTestConfig({ onLoginSuccess }), storage);

    const mockUser = { id: '1', email: 'test@example.com', emailVerified: true };
    const mockTokens = {
      accessToken: 'access_token',
      refreshToken: 'refresh_token',
      expiresAt: new Date(Date.now() + 86400000).toISOString(),
    };

    mockFetch.mockReturnValueOnce(mockSuccessResponse({
      user: mockUser,
      tokens: mockTokens,
    }));

    await client.login({ email: 'test@example.com', password: 'password123' });

    expect(onLoginSuccess).toHaveBeenCalledWith({
      user: mockUser,
      tokens: expect.objectContaining({
        accessToken: 'access_token',
        refreshToken: 'refresh_token',
      }),
    });
  });

  it('should call onLoginSuccess callback after successful register', async () => {
    const onLoginSuccess = vi.fn();
    const client = new AuthClient(createTestConfig({ onLoginSuccess }), storage);

    mockFetch.mockReturnValueOnce(mockSuccessResponse({
      user: { id: '1', email: 'test@example.com', emailVerified: false },
      tokens: {
        accessToken: 'access_token',
        refreshToken: 'refresh_token',
        expiresAt: new Date(Date.now() + 86400000).toISOString(),
      },
    }));

    await client.register({ email: 'test@example.com', password: 'password123' });

    expect(onLoginSuccess).toHaveBeenCalled();
  });

  it('should not call onLoginSuccess callback on failed login', async () => {
    const onLoginSuccess = vi.fn();
    const client = new AuthClient(createTestConfig({ onLoginSuccess }), storage);

    mockFetch.mockReturnValueOnce(mockErrorResponse(401, { code: 'INVALID_CREDENTIALS' }));

    try {
      await client.login({ email: 'test@example.com', password: 'wrong' });
    } catch {}

    expect(onLoginSuccess).not.toHaveBeenCalled();
  });

  it('should call onLogoutSuccess callback after logout', async () => {
    const onLogoutSuccess = vi.fn();
    storage.setItem('auth_token', 'token');
    storage.setItem('auth_refresh_token', 'refresh_token');
    storage.setItem('auth_user', JSON.stringify({ id: '1', email: 'test@example.com' }));

    const client = new AuthClient(createTestConfig({ onLogoutSuccess }), storage);

    mockFetch.mockReturnValueOnce(mockSuccessResponse({ success: true }));

    await client.logout();

    expect(onLogoutSuccess).toHaveBeenCalled();
  });

  it('should call onLogoutSuccess even if logout API fails', async () => {
    const onLogoutSuccess = vi.fn();
    storage.setItem('auth_token', 'token');
    storage.setItem('auth_user', JSON.stringify({ id: '1', email: 'test@example.com' }));

    const client = new AuthClient(createTestConfig({ onLogoutSuccess }), storage);

    mockFetch.mockReturnValueOnce(mockErrorResponse(500, { error: 'Server error' }));

    await client.logout();

    expect(onLogoutSuccess).toHaveBeenCalled();
  });
});

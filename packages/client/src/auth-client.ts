import type { AuthClientConfig, AuthState, AuthStateListener } from './types';
import type { User, AuthTokens, RegisterInput, LoginInput } from '@subauth/core';

export class AuthClient {
  private config: AuthClientConfig;
  private storage: Storage;
  private state: AuthState;
  private listeners: Set<AuthStateListener> = new Set();

  constructor(config: AuthClientConfig, storage: Storage) {
    this.config = {
      tokenStorageKey: 'auth_token',
      refreshTokenStorageKey: 'auth_refresh_token',
      userStorageKey: 'auth_user',
      ...config,
    };
    this.storage = storage;

    // Initialize state from storage
    this.state = this.loadStateFromStorage();
  }

  private loadStateFromStorage(): AuthState {
    try {
      const token = this.storage.getItem(this.config.tokenStorageKey!);
      const refreshToken = this.storage.getItem(this.config.refreshTokenStorageKey!);
      const userJson = this.storage.getItem(this.config.userStorageKey!);

      if (token) {
        let user: User | null = null;
        if (userJson) {
          try {
            user = JSON.parse(userJson) as User;
          } catch {
            // Invalid user JSON, continue with null user
          }
        }
        return {
          user,
          token,
          refreshToken,
          isAuthenticated: true,
          isLoading: false,
        };
      }
    } catch {
      // Corrupted storage, clear it
      this.clearStorage();
    }

    return {
      user: null,
      token: null,
      refreshToken: null,
      isAuthenticated: false,
      isLoading: false,
    };
  }

  private saveStateToStorage(user: User, token: string, refreshToken?: string): void {
    this.storage.setItem(this.config.tokenStorageKey!, token);
    this.storage.setItem(this.config.userStorageKey!, JSON.stringify(user));
    if (refreshToken) {
      this.storage.setItem(this.config.refreshTokenStorageKey!, refreshToken);
    }
  }

  private clearStorage(): void {
    this.storage.removeItem(this.config.tokenStorageKey!);
    this.storage.removeItem(this.config.refreshTokenStorageKey!);
    this.storage.removeItem(this.config.userStorageKey!);
  }

  private setState(newState: Partial<AuthState>): void {
    this.state = { ...this.state, ...newState };
    this.notifyListeners();
  }

  private notifyListeners(): void {
    for (const listener of this.listeners) {
      listener(this.state);
    }
  }

  getState(): AuthState {
    return { ...this.state };
  }

  subscribe(listener: AuthStateListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  async register(input: RegisterInput): Promise<{ user: User; tokens: AuthTokens }> {
    this.setState({ isLoading: true });

    try {
      const response = await fetch(`${this.config.baseUrl}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || error.code || 'Registration failed');
      }

      const data = await response.json();
      const { user, tokens } = data;

      // Parse expiresAt if string
      const parsedTokens: AuthTokens = {
        ...tokens,
        expiresAt: new Date(tokens.expiresAt),
      };

      // Save to storage and update state
      this.saveStateToStorage(user, tokens.accessToken, tokens.refreshToken);
      this.setState({
        user,
        token: tokens.accessToken,
        refreshToken: tokens.refreshToken || null,
        isAuthenticated: true,
        isLoading: false,
      });

      // Call onLoginSuccess callback
      if (this.config.onLoginSuccess) {
        await this.config.onLoginSuccess({ user, tokens: parsedTokens });
      }

      return { user, tokens: parsedTokens };
    } catch (error) {
      this.setState({ isLoading: false });
      throw error;
    }
  }

  async login(input: LoginInput): Promise<{ user: User; tokens: AuthTokens }> {
    this.setState({ isLoading: true });

    try {
      const response = await fetch(`${this.config.baseUrl}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || error.code || 'Login failed');
      }

      const data = await response.json();
      const { user, tokens } = data;

      const parsedTokens: AuthTokens = {
        ...tokens,
        expiresAt: new Date(tokens.expiresAt),
      };

      // Save to storage and update state
      this.saveStateToStorage(user, tokens.accessToken, tokens.refreshToken);
      this.setState({
        user,
        token: tokens.accessToken,
        refreshToken: tokens.refreshToken || null,
        isAuthenticated: true,
        isLoading: false,
      });

      // Call onLoginSuccess callback
      if (this.config.onLoginSuccess) {
        await this.config.onLoginSuccess({ user, tokens: parsedTokens });
      }

      return { user, tokens: parsedTokens };
    } catch (error) {
      this.setState({ isLoading: false });
      throw error;
    }
  }

  async logout(): Promise<void> {
    // Call logout API with refresh token
    if (this.state.token) {
      try {
        await fetch(`${this.config.baseUrl}/auth/logout`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${this.state.token}`,
          },
          body: JSON.stringify({ refreshToken: this.state.refreshToken }),
        });
      } catch {
        // Ignore logout API errors
      }
    }

    this.clearStorage();
    this.setState({
      user: null,
      token: null,
      refreshToken: null,
      isAuthenticated: false,
      isLoading: false,
    });

    // Call onLogoutSuccess callback
    if (this.config.onLogoutSuccess) {
      await this.config.onLogoutSuccess();
    }
  }

  private async refreshAccessToken(): Promise<boolean> {
    if (!this.state.refreshToken) {
      return false;
    }

    try {
      const response = await fetch(`${this.config.baseUrl}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken: this.state.refreshToken }),
      });

      if (!response.ok) {
        return false;
      }

      const data = await response.json();
      const { tokens } = data;

      // Update storage and state with new tokens
      this.storage.setItem(this.config.tokenStorageKey!, tokens.accessToken);
      if (tokens.refreshToken) {
        this.storage.setItem(this.config.refreshTokenStorageKey!, tokens.refreshToken);
      }

      this.setState({
        token: tokens.accessToken,
        refreshToken: tokens.refreshToken || this.state.refreshToken,
      });

      return true;
    } catch {
      return false;
    }
  }

  async fetchWithAuth(
    path: string,
    options?: RequestInit & { skipAuth?: boolean }
  ): Promise<Response> {
    const { skipAuth, ...fetchOptions } = options || {};

    const makeRequest = async (token: string | null) => {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        ...(fetchOptions.headers as Record<string, string>),
      };

      if (!skipAuth && token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      return fetch(`${this.config.baseUrl}${path}`, {
        ...fetchOptions,
        headers,
      });
    };

    let response = await makeRequest(this.state.token);

    // Handle 401 - try to refresh token
    if (response.status === 401 && this.state.refreshToken) {
      const refreshed = await this.refreshAccessToken();

      if (refreshed) {
        // Retry with new token
        response = await makeRequest(this.state.token);
      } else {
        // Refresh failed, clear state
        this.clearStorage();
        this.setState({
          user: null,
          token: null,
          refreshToken: null,
          isAuthenticated: false,
          isLoading: false,
        });

        if (this.config.onTokenExpired) {
          this.config.onTokenExpired();
        }
      }
    } else if (response.status === 401) {
      // No refresh token, just logout
      this.clearStorage();
      this.setState({
        user: null,
        token: null,
        refreshToken: null,
        isAuthenticated: false,
        isLoading: false,
      });

      if (this.config.onTokenExpired) {
        this.config.onTokenExpired();
      }
    }

    return response;
  }

  async verifyEmail(token: string): Promise<{ user: User }> {
    const response = await fetch(`${this.config.baseUrl}/auth/verify-email/${token}`, {
      method: 'GET',
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Verification failed');
    }

    const data = await response.json();

    // Update state if user is logged in
    if (this.state.isAuthenticated && this.state.user?.id === data.user.id) {
      this.saveStateToStorage(data.user, this.state.token!);
      this.setState({ user: data.user });
    }

    return data;
  }

  async resendVerificationEmail(email: string): Promise<void> {
    const response = await fetch(`${this.config.baseUrl}/auth/resend-verification`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to resend verification');
    }
  }

  async requestPasswordReset(email: string): Promise<void> {
    const response = await fetch(`${this.config.baseUrl}/auth/forgot-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to request password reset');
    }
  }

  async resetPassword(token: string, newPassword: string): Promise<void> {
    const response = await fetch(`${this.config.baseUrl}/auth/reset-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, newPassword }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to reset password');
    }
  }

  async getCurrentUser(): Promise<{ user: User; subscription?: unknown }> {
    if (!this.state.isAuthenticated) {
      throw new Error('Not authenticated');
    }

    const response = await this.fetchWithAuth('/auth/me');

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to get current user');
    }

    const data = await response.json();

    // Update state
    this.saveStateToStorage(data.user, this.state.token!);
    this.setState({ user: data.user });

    return data;
  }
}

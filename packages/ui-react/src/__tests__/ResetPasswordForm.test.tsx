import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ResetPasswordForm } from '../auth/ResetPasswordForm';
import { AuthClient } from '@subauth/client';

// Mock AuthClient
vi.mock('@subauth/client', () => ({
  AuthClient: vi.fn(),
}));

describe('ResetPasswordForm', () => {
  it('should render password fields', () => {
    render(<ResetPasswordForm onSubmit={vi.fn()} />);

    expect(screen.getByLabelText('New Password')).toBeInTheDocument();
    expect(screen.getByLabelText('Confirm New Password')).toBeInTheDocument();
  });

  it('should render submit button', () => {
    render(<ResetPasswordForm onSubmit={vi.fn()} />);

    expect(screen.getByRole('button', { name: /reset password/i })).toBeInTheDocument();
  });

  it('should show validation error for weak password', async () => {
    render(<ResetPasswordForm onSubmit={vi.fn()} />);
    const user = userEvent.setup();

    await user.type(screen.getByLabelText('New Password'), 'weak');
    await user.type(screen.getByLabelText('Confirm New Password'), 'weak');
    await user.click(screen.getByRole('button', { name: /reset password/i }));

    await waitFor(() => {
      expect(screen.getByText(/at least 8 characters/i)).toBeInTheDocument();
    });
  });

  it('should show validation error for mismatched passwords', async () => {
    render(<ResetPasswordForm onSubmit={vi.fn()} />);
    const user = userEvent.setup();

    await user.type(screen.getByLabelText('New Password'), 'Password123');
    await user.type(screen.getByLabelText('Confirm New Password'), 'Password456');
    await user.click(screen.getByRole('button', { name: /reset password/i }));

    await waitFor(() => {
      expect(screen.getByText(/do not match/i)).toBeInTheDocument();
    });
  });

  it('should call onSubmit with password when form is valid', async () => {
    const onSubmit = vi.fn();
    render(<ResetPasswordForm onSubmit={onSubmit} />);
    const user = userEvent.setup();

    await user.type(screen.getByLabelText('New Password'), 'Password123');
    await user.type(screen.getByLabelText('Confirm New Password'), 'Password123');
    await user.click(screen.getByRole('button', { name: /reset password/i }));

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledWith({ password: 'Password123' });
    });
  });

  it('should show loading state when loading prop is true', () => {
    render(<ResetPasswordForm onSubmit={vi.fn()} loading />);

    const button = screen.getByRole('button', { name: /reset password/i });
    expect(button).toBeDisabled();
  });

  it('should display error message when error prop is provided', () => {
    render(<ResetPasswordForm onSubmit={vi.fn()} error="Token expired" />);

    expect(screen.getByText(/token expired/i)).toBeInTheDocument();
  });

  it('should show success message when success prop is true', () => {
    render(<ResetPasswordForm onSubmit={vi.fn()} success />);

    expect(screen.getByText(/password has been reset/i)).toBeInTheDocument();
  });

  it('should call onBackToLogin when sign in link is clicked in success state', async () => {
    const onBackToLogin = vi.fn();
    render(<ResetPasswordForm onSubmit={vi.fn()} success onBackToLogin={onBackToLogin} />);
    const user = userEvent.setup();

    await user.click(screen.getByText(/sign in/i));

    expect(onBackToLogin).toHaveBeenCalled();
  });

  // Tests for authClient integration
  it('should use authClient.resetPassword when authClient and token are provided', async () => {
    const mockResetPassword = vi.fn().mockResolvedValue(undefined);
    const mockAuthClient = {
      resetPassword: mockResetPassword,
      getState: vi.fn().mockReturnValue({ isLoading: false }),
      subscribe: vi.fn().mockReturnValue(() => {}),
    } as unknown as AuthClient;

    render(<ResetPasswordForm authClient={mockAuthClient} token="test-token" />);
    const user = userEvent.setup();

    await user.type(screen.getByLabelText('New Password'), 'Password123');
    await user.type(screen.getByLabelText('Confirm New Password'), 'Password123');
    await user.click(screen.getByRole('button', { name: /reset password/i }));

    await waitFor(() => {
      expect(mockResetPassword).toHaveBeenCalledWith('test-token', 'Password123');
    });
  });

  it('should use authClient.getState().isLoading for loading state when authClient is provided', () => {
    const mockAuthClient = {
      resetPassword: vi.fn(),
      getState: vi.fn().mockReturnValue({ isLoading: true }),
      subscribe: vi.fn().mockReturnValue(() => {}),
    } as unknown as AuthClient;

    render(<ResetPasswordForm authClient={mockAuthClient} token="test-token" />);

    const button = screen.getByRole('button', { name: /reset password/i });
    expect(button).toBeDisabled();
  });

  it('should call onSuccess after successful reset via authClient', async () => {
    const mockResetPassword = vi.fn().mockResolvedValue(undefined);
    const mockOnSuccess = vi.fn();
    const mockAuthClient = {
      resetPassword: mockResetPassword,
      getState: vi.fn().mockReturnValue({ isLoading: false }),
      subscribe: vi.fn().mockReturnValue(() => {}),
    } as unknown as AuthClient;

    render(<ResetPasswordForm authClient={mockAuthClient} token="test-token" onSuccess={mockOnSuccess} />);
    const user = userEvent.setup();

    await user.type(screen.getByLabelText('New Password'), 'Password123');
    await user.type(screen.getByLabelText('Confirm New Password'), 'Password123');
    await user.click(screen.getByRole('button', { name: /reset password/i }));

    await waitFor(() => {
      expect(mockOnSuccess).toHaveBeenCalled();
    });
  });

  it('should display error when authClient.resetPassword fails', async () => {
    const mockResetPassword = vi.fn().mockRejectedValue(new Error('Token expired'));
    const mockAuthClient = {
      resetPassword: mockResetPassword,
      getState: vi.fn().mockReturnValue({ isLoading: false }),
      subscribe: vi.fn().mockReturnValue(() => {}),
    } as unknown as AuthClient;

    render(<ResetPasswordForm authClient={mockAuthClient} token="test-token" />);
    const user = userEvent.setup();

    await user.type(screen.getByLabelText('New Password'), 'Password123');
    await user.type(screen.getByLabelText('Confirm New Password'), 'Password123');
    await user.click(screen.getByRole('button', { name: /reset password/i }));

    await waitFor(() => {
      expect(screen.getByText(/token expired/i)).toBeInTheDocument();
    });
  });

  it('should navigate to /login by default when back to login is clicked with authClient', async () => {
    const mockAuthClient = {
      resetPassword: vi.fn(),
      getState: vi.fn().mockReturnValue({ isLoading: false }),
      subscribe: vi.fn().mockReturnValue(() => {}),
    } as unknown as AuthClient;

    render(<ResetPasswordForm authClient={mockAuthClient} token="test-token" success />);
    const user = userEvent.setup();

    await user.click(screen.getByText(/sign in/i));

    expect(window.location.pathname).toBe('/login');
  });

  it('should use loading prop over authClient.getState().isLoading when both are provided', () => {
    const mockAuthClient = {
      resetPassword: vi.fn(),
      getState: vi.fn().mockReturnValue({ isLoading: true }),
      subscribe: vi.fn().mockReturnValue(() => {}),
    } as unknown as AuthClient;

    render(<ResetPasswordForm authClient={mockAuthClient} token="test-token" loading={false} />);

    const button = screen.getByRole('button', { name: /reset password/i });
    expect(button).not.toBeDisabled();
  });

  describe('missing token behavior', () => {
    it('should show invalid link error when authClient is provided but token is missing', () => {
      const mockAuthClient = {
        resetPassword: vi.fn(),
        getState: vi.fn().mockReturnValue({ isLoading: false }),
        subscribe: vi.fn().mockReturnValue(() => {}),
      } as unknown as AuthClient;

      render(<ResetPasswordForm authClient={mockAuthClient} />);

      expect(screen.getByText(/invalid or missing/i)).toBeInTheDocument();
      expect(screen.queryByLabelText('New Password')).not.toBeInTheDocument();
    });

    it('should show request new link button when token is missing', () => {
      const mockAuthClient = {
        resetPassword: vi.fn(),
        getState: vi.fn().mockReturnValue({ isLoading: false }),
        subscribe: vi.fn().mockReturnValue(() => {}),
      } as unknown as AuthClient;

      render(<ResetPasswordForm authClient={mockAuthClient} />);

      expect(screen.getByRole('button', { name: /request a new reset link/i })).toBeInTheDocument();
    });

    it('should navigate to /forgot-password by default when request new link is clicked', async () => {
      const mockAuthClient = {
        resetPassword: vi.fn(),
        getState: vi.fn().mockReturnValue({ isLoading: false }),
        subscribe: vi.fn().mockReturnValue(() => {}),
      } as unknown as AuthClient;

      render(<ResetPasswordForm authClient={mockAuthClient} />);
      const user = userEvent.setup();

      await user.click(screen.getByRole('button', { name: /request a new reset link/i }));

      expect(window.location.pathname).toBe('/forgot-password');
    });

    it('should use custom onRequestNewLink when provided', async () => {
      const mockOnRequestNewLink = vi.fn();
      const mockAuthClient = {
        resetPassword: vi.fn(),
        getState: vi.fn().mockReturnValue({ isLoading: false }),
        subscribe: vi.fn().mockReturnValue(() => {}),
      } as unknown as AuthClient;

      render(<ResetPasswordForm authClient={mockAuthClient} onRequestNewLink={mockOnRequestNewLink} />);
      const user = userEvent.setup();

      await user.click(screen.getByRole('button', { name: /request a new reset link/i }));

      expect(mockOnRequestNewLink).toHaveBeenCalled();
    });

    it('should show form normally when token is empty string but onSubmit is provided', () => {
      render(<ResetPasswordForm onSubmit={vi.fn()} token="" />);

      expect(screen.getByLabelText('New Password')).toBeInTheDocument();
      expect(screen.queryByText(/invalid or missing/i)).not.toBeInTheDocument();
    });
  });

  describe('URL token retrieval', () => {
    const originalLocation = window.location;

    beforeEach(() => {
      // @ts-expect-error - mocking window.location
      delete window.location;
      window.location = { ...originalLocation, search: '' };
    });

    afterEach(() => {
      window.location = originalLocation;
    });

    it('should read token from URL when token prop is not provided', async () => {
      window.location.search = '?token=url-token-123';
      const mockResetPassword = vi.fn().mockResolvedValue(undefined);
      const mockAuthClient = {
        resetPassword: mockResetPassword,
        getState: vi.fn().mockReturnValue({ isLoading: false }),
        subscribe: vi.fn().mockReturnValue(() => {}),
      } as unknown as AuthClient;

      render(<ResetPasswordForm authClient={mockAuthClient} />);
      const user = userEvent.setup();

      // Form should be shown (token was read from URL)
      expect(screen.getByLabelText('New Password')).toBeInTheDocument();

      await user.type(screen.getByLabelText('New Password'), 'Password123');
      await user.type(screen.getByLabelText('Confirm New Password'), 'Password123');
      await user.click(screen.getByRole('button', { name: /reset password/i }));

      await waitFor(() => {
        expect(mockResetPassword).toHaveBeenCalledWith('url-token-123', 'Password123');
      });
    });

    it('should prefer token prop over URL token when both are provided', async () => {
      window.location.search = '?token=url-token';
      const mockResetPassword = vi.fn().mockResolvedValue(undefined);
      const mockAuthClient = {
        resetPassword: mockResetPassword,
        getState: vi.fn().mockReturnValue({ isLoading: false }),
        subscribe: vi.fn().mockReturnValue(() => {}),
      } as unknown as AuthClient;

      render(<ResetPasswordForm authClient={mockAuthClient} token="prop-token" />);
      const user = userEvent.setup();

      await user.type(screen.getByLabelText('New Password'), 'Password123');
      await user.type(screen.getByLabelText('Confirm New Password'), 'Password123');
      await user.click(screen.getByRole('button', { name: /reset password/i }));

      await waitFor(() => {
        expect(mockResetPassword).toHaveBeenCalledWith('prop-token', 'Password123');
      });
    });

    it('should show error UI when no token in URL and no token prop', () => {
      window.location.search = '';
      const mockAuthClient = {
        resetPassword: vi.fn(),
        getState: vi.fn().mockReturnValue({ isLoading: false }),
        subscribe: vi.fn().mockReturnValue(() => {}),
      } as unknown as AuthClient;

      render(<ResetPasswordForm authClient={mockAuthClient} />);

      expect(screen.getByText(/invalid or missing/i)).toBeInTheDocument();
    });
  });

  describe('default onSuccess behavior', () => {
    it('should call default onSuccess with setTimeout when no onSuccess provided', async () => {
      const setTimeoutSpy = vi.spyOn(global, 'setTimeout');
      const mockResetPassword = vi.fn().mockResolvedValue(undefined);
      const mockAuthClient = {
        resetPassword: mockResetPassword,
        getState: vi.fn().mockReturnValue({ isLoading: false }),
        subscribe: vi.fn().mockReturnValue(() => {}),
      } as unknown as AuthClient;

      render(<ResetPasswordForm authClient={mockAuthClient} token="test-token" />);
      const user = userEvent.setup();

      await user.type(screen.getByLabelText('New Password'), 'Password123');
      await user.type(screen.getByLabelText('Confirm New Password'), 'Password123');
      await user.click(screen.getByRole('button', { name: /reset password/i }));

      // Wait for success state
      await waitFor(() => {
        expect(screen.getByText(/password has been reset/i)).toBeInTheDocument();
      });

      // Verify setTimeout was called with 3000ms delay for the default onSuccess
      expect(setTimeoutSpy).toHaveBeenCalledWith(expect.any(Function), 3000);
      setTimeoutSpy.mockRestore();
    });

    it('should use custom onSuccess instead of default when provided', async () => {
      const mockResetPassword = vi.fn().mockResolvedValue(undefined);
      const mockOnSuccess = vi.fn();
      const mockAuthClient = {
        resetPassword: mockResetPassword,
        getState: vi.fn().mockReturnValue({ isLoading: false }),
        subscribe: vi.fn().mockReturnValue(() => {}),
      } as unknown as AuthClient;

      render(<ResetPasswordForm authClient={mockAuthClient} token="test-token" onSuccess={mockOnSuccess} />);
      const user = userEvent.setup();

      await user.type(screen.getByLabelText('New Password'), 'Password123');
      await user.type(screen.getByLabelText('Confirm New Password'), 'Password123');
      await user.click(screen.getByRole('button', { name: /reset password/i }));

      await waitFor(() => {
        expect(mockOnSuccess).toHaveBeenCalled();
      });

      // Verify custom onSuccess was called
      expect(mockOnSuccess).toHaveBeenCalledTimes(1);
    });
  });
});
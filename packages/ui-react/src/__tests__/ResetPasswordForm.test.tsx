import { describe, it, expect, vi } from 'vitest';
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
});
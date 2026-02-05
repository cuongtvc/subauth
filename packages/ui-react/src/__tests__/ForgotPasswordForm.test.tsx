import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ForgotPasswordForm } from '../auth/ForgotPasswordForm';
import { AuthClient } from '@subauth/client';

// Mock AuthClient
vi.mock('@subauth/client', () => ({
  AuthClient: vi.fn(),
}));

describe('ForgotPasswordForm', () => {
  it('should render email field', () => {
    render(<ForgotPasswordForm onSubmit={vi.fn()} />);

    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
  });

  it('should render submit button', () => {
    render(<ForgotPasswordForm onSubmit={vi.fn()} />);

    expect(screen.getByRole('button', { name: /send reset link/i })).toBeInTheDocument();
  });

  it('should show validation error for invalid email', async () => {
    render(<ForgotPasswordForm onSubmit={vi.fn()} />);
    const user = userEvent.setup();

    await user.type(screen.getByLabelText(/email/i), 'invalid-email');
    await user.click(screen.getByRole('button', { name: /send reset link/i }));

    await waitFor(() => {
      expect(screen.getByText(/valid email/i)).toBeInTheDocument();
    });
  });

  it('should call onSubmit with email when form is valid', async () => {
    const onSubmit = vi.fn();
    render(<ForgotPasswordForm onSubmit={onSubmit} />);
    const user = userEvent.setup();

    await user.type(screen.getByLabelText(/email/i), 'test@example.com');
    await user.click(screen.getByRole('button', { name: /send reset link/i }));

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledWith({
        email: 'test@example.com',
      });
    });
  });

  it('should show loading state when loading prop is true', () => {
    render(<ForgotPasswordForm onSubmit={vi.fn()} loading />);

    const button = screen.getByRole('button', { name: /send reset link/i });
    expect(button).toBeDisabled();
  });

  it('should display error message when error prop is provided', () => {
    render(<ForgotPasswordForm onSubmit={vi.fn()} error="Something went wrong" />);

    expect(screen.getByText(/something went wrong/i)).toBeInTheDocument();
  });

  it('should show success message when success prop is true', () => {
    render(<ForgotPasswordForm onSubmit={vi.fn()} success />);

    expect(screen.getByText(/if an account exists/i)).toBeInTheDocument();
  });

  it('should render back to login link when onBackToLogin is provided', () => {
    render(<ForgotPasswordForm onSubmit={vi.fn()} onBackToLogin={vi.fn()} />);

    expect(screen.getByText(/back to sign in/i)).toBeInTheDocument();
  });

  it('should call onBackToLogin when back to login link is clicked', async () => {
    const onBackToLogin = vi.fn();
    render(<ForgotPasswordForm onSubmit={vi.fn()} onBackToLogin={onBackToLogin} />);
    const user = userEvent.setup();

    await user.click(screen.getByText(/back to sign in/i));

    expect(onBackToLogin).toHaveBeenCalled();
  });

  // Tests for authClient integration
  it('should use authClient.requestPasswordReset when authClient is provided', async () => {
    const mockRequestPasswordReset = vi.fn().mockResolvedValue(undefined);
    const mockAuthClient = {
      requestPasswordReset: mockRequestPasswordReset,
      getState: vi.fn().mockReturnValue({ isLoading: false }),
      subscribe: vi.fn().mockReturnValue(() => {}),
    } as unknown as AuthClient;

    render(<ForgotPasswordForm authClient={mockAuthClient} />);
    const user = userEvent.setup();

    await user.type(screen.getByLabelText(/email/i), 'test@example.com');
    await user.click(screen.getByRole('button', { name: /send reset link/i }));

    await waitFor(() => {
      expect(mockRequestPasswordReset).toHaveBeenCalledWith('test@example.com');
    });
  });

  it('should use authClient.getState().isLoading for loading state when authClient is provided', () => {
    const mockAuthClient = {
      requestPasswordReset: vi.fn(),
      getState: vi.fn().mockReturnValue({ isLoading: true }),
      subscribe: vi.fn().mockReturnValue(() => {}),
    } as unknown as AuthClient;

    render(<ForgotPasswordForm authClient={mockAuthClient} />);

    const button = screen.getByRole('button', { name: /send reset link/i });
    expect(button).toBeDisabled();
  });

  it('should call onSuccess after successful request via authClient', async () => {
    const mockRequestPasswordReset = vi.fn().mockResolvedValue(undefined);
    const mockOnSuccess = vi.fn();
    const mockAuthClient = {
      requestPasswordReset: mockRequestPasswordReset,
      getState: vi.fn().mockReturnValue({ isLoading: false }),
      subscribe: vi.fn().mockReturnValue(() => {}),
    } as unknown as AuthClient;

    render(<ForgotPasswordForm authClient={mockAuthClient} onSuccess={mockOnSuccess} />);
    const user = userEvent.setup();

    await user.type(screen.getByLabelText(/email/i), 'test@example.com');
    await user.click(screen.getByRole('button', { name: /send reset link/i }));

    await waitFor(() => {
      expect(mockOnSuccess).toHaveBeenCalled();
    });
  });

  it('should show success state after request via authClient even when error occurs', async () => {
    const mockRequestPasswordReset = vi.fn().mockRejectedValue(new Error('Network error'));
    const mockAuthClient = {
      requestPasswordReset: mockRequestPasswordReset,
      getState: vi.fn().mockReturnValue({ isLoading: false }),
      subscribe: vi.fn().mockReturnValue(() => {}),
    } as unknown as AuthClient;

    render(<ForgotPasswordForm authClient={mockAuthClient} />);
    const user = userEvent.setup();

    await user.type(screen.getByLabelText(/email/i), 'test@example.com');
    await user.click(screen.getByRole('button', { name: /send reset link/i }));

    // Should show success to prevent email enumeration
    await waitFor(() => {
      expect(screen.getByText(/if an account exists/i)).toBeInTheDocument();
    });
  });

  it('should navigate to /login by default when back to login is clicked with authClient', async () => {
    const mockAuthClient = {
      requestPasswordReset: vi.fn(),
      getState: vi.fn().mockReturnValue({ isLoading: false }),
      subscribe: vi.fn().mockReturnValue(() => {}),
    } as unknown as AuthClient;

    render(<ForgotPasswordForm authClient={mockAuthClient} />);
    const user = userEvent.setup();

    await user.click(screen.getByText(/back to sign in/i));

    expect(window.location.pathname).toBe('/login');
  });

  it('should use loading prop over authClient.getState().isLoading when both are provided', () => {
    const mockAuthClient = {
      requestPasswordReset: vi.fn(),
      getState: vi.fn().mockReturnValue({ isLoading: true }),
      subscribe: vi.fn().mockReturnValue(() => {}),
    } as unknown as AuthClient;

    render(<ForgotPasswordForm authClient={mockAuthClient} loading={false} />);

    const button = screen.getByRole('button', { name: /send reset link/i });
    expect(button).not.toBeDisabled();
  });

  it('should show back to login link in success state when onBackToLogin is provided', () => {
    render(<ForgotPasswordForm onSubmit={vi.fn()} success onBackToLogin={vi.fn()} />);

    expect(screen.getByText(/back to sign in/i)).toBeInTheDocument();
  });
});
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { LoginForm } from '../auth/LoginForm';
import { AuthClient } from '@subauth/client';

// Mock AuthClient
vi.mock('@subauth/client', () => ({
  AuthClient: vi.fn(),
}));

describe('LoginForm', () => {
  it('should render email and password fields', () => {
    render(<LoginForm onSubmit={vi.fn()} />);

    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/password/i)).toBeInTheDocument();
  });

  it('should render submit button', () => {
    render(<LoginForm onSubmit={vi.fn()} />);

    expect(screen.getByRole('button', { name: /sign in/i })).toBeInTheDocument();
  });

  it('should show validation error for invalid email', async () => {
    render(<LoginForm onSubmit={vi.fn()} />);
    const user = userEvent.setup();

    await user.type(screen.getByLabelText(/email/i), 'invalid-email');
    await user.click(screen.getByRole('button', { name: /sign in/i }));

    await waitFor(() => {
      expect(screen.getByText(/valid email/i)).toBeInTheDocument();
    });
  });

  it('should show validation error for empty password', async () => {
    render(<LoginForm onSubmit={vi.fn()} />);
    const user = userEvent.setup();

    await user.type(screen.getByLabelText(/email/i), 'test@example.com');
    await user.click(screen.getByRole('button', { name: /sign in/i }));

    await waitFor(() => {
      expect(screen.getByText(/password is required/i)).toBeInTheDocument();
    });
  });

  it('should call onSubmit with email and password when form is valid', async () => {
    const onSubmit = vi.fn();
    render(<LoginForm onSubmit={onSubmit} />);
    const user = userEvent.setup();

    await user.type(screen.getByLabelText(/email/i), 'test@example.com');
    await user.type(screen.getByLabelText(/password/i), 'password123');
    await user.click(screen.getByRole('button', { name: /sign in/i }));

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledWith({
        email: 'test@example.com',
        password: 'password123',
      });
    });
  });

  it('should show loading state when loading prop is true', () => {
    render(<LoginForm onSubmit={vi.fn()} loading />);

    const button = screen.getByRole('button', { name: /sign in/i });
    expect(button).toBeDisabled();
  });

  it('should display error message when error prop is provided', () => {
    render(<LoginForm onSubmit={vi.fn()} error="Invalid credentials" />);

    expect(screen.getByText(/invalid credentials/i)).toBeInTheDocument();
  });

  it('should render forgot password link by default', () => {
    render(<LoginForm onSubmit={vi.fn()} />);

    expect(screen.getByText(/forgot password/i)).toBeInTheDocument();
  });

  it('should render sign up link by default', () => {
    render(<LoginForm onSubmit={vi.fn()} />);

    expect(screen.getByText(/sign up/i)).toBeInTheDocument();
  });

  it('should render resend verification link by default', () => {
    render(<LoginForm onSubmit={vi.fn()} />);

    expect(screen.getByText(/resend verification/i)).toBeInTheDocument();
  });

  it('should navigate to /forgot-password by default when forgot password link is clicked', async () => {
    render(<LoginForm onSubmit={vi.fn()} />);
    const user = userEvent.setup();

    await user.click(screen.getByText(/forgot password/i));

    expect(window.location.pathname).toBe('/forgot-password');
  });

  it('should navigate to /register by default when sign up link is clicked', async () => {
    render(<LoginForm onSubmit={vi.fn()} />);
    const user = userEvent.setup();

    await user.click(screen.getByText(/sign up/i));

    expect(window.location.pathname).toBe('/register');
  });

  it('should navigate to /resend-verification by default when resend verification link is clicked', async () => {
    render(<LoginForm onSubmit={vi.fn()} />);
    const user = userEvent.setup();

    await user.click(screen.getByText(/resend verification/i));

    expect(window.location.pathname).toBe('/resend-verification');
  });

  it('should use custom onForgotPassword when provided', async () => {
    const onForgotPassword = vi.fn();
    render(<LoginForm onSubmit={vi.fn()} onForgotPassword={onForgotPassword} />);
    const user = userEvent.setup();

    await user.click(screen.getByText(/forgot password/i));

    expect(onForgotPassword).toHaveBeenCalled();
  });

  it('should use custom onSignUp when provided', async () => {
    const onSignUp = vi.fn();
    render(<LoginForm onSubmit={vi.fn()} onSignUp={onSignUp} />);
    const user = userEvent.setup();

    await user.click(screen.getByText(/sign up/i));

    expect(onSignUp).toHaveBeenCalled();
  });

  it('should call onResendVerification when resend verification link is clicked', async () => {
    const onResendVerification = vi.fn();
    render(<LoginForm onSubmit={vi.fn()} onResendVerification={onResendVerification} />);
    const user = userEvent.setup();

    await user.click(screen.getByText(/resend verification/i));

    expect(onResendVerification).toHaveBeenCalled();
  });

  it('should use authClient.login as default onSubmit when authClient is provided', async () => {
    const mockLogin = vi.fn().mockResolvedValue({ user: {}, tokens: {} });
    const mockAuthClient = {
      login: mockLogin,
      getState: vi.fn().mockReturnValue({ isLoading: false }),
      subscribe: vi.fn().mockReturnValue(() => {}),
    } as unknown as AuthClient;

    render(<LoginForm authClient={mockAuthClient} />);
    const user = userEvent.setup();

    await user.type(screen.getByLabelText(/email/i), 'test@example.com');
    await user.type(screen.getByLabelText(/password/i), 'password123');
    await user.click(screen.getByRole('button', { name: /sign in/i }));

    await waitFor(() => {
      expect(mockLogin).toHaveBeenCalledWith({
        email: 'test@example.com',
        password: 'password123',
      });
    });
  });

  it('should use authClient.getState().isLoading for loading state when authClient is provided and loading prop is not set', () => {
    const mockAuthClient = {
      login: vi.fn(),
      getState: vi.fn().mockReturnValue({ isLoading: true }),
      subscribe: vi.fn().mockReturnValue(() => {}),
    } as unknown as AuthClient;

    render(<LoginForm authClient={mockAuthClient} />);

    const button = screen.getByRole('button', { name: /sign in/i });
    expect(button).toBeDisabled();
  });

  it('should call onSuccess with result when login succeeds via authClient', async () => {
    const mockLoginResult = { user: { id: '1', email: 'test@example.com' }, tokens: {} };
    const mockLogin = vi.fn().mockResolvedValue(mockLoginResult);
    const mockOnSuccess = vi.fn();
    const mockAuthClient = {
      login: mockLogin,
      getState: vi.fn().mockReturnValue({ isLoading: false }),
      subscribe: vi.fn().mockReturnValue(() => {}),
    } as unknown as AuthClient;

    render(<LoginForm authClient={mockAuthClient} onSuccess={mockOnSuccess} />);
    const user = userEvent.setup();

    await user.type(screen.getByLabelText(/email/i), 'test@example.com');
    await user.type(screen.getByLabelText(/password/i), 'password123');
    await user.click(screen.getByRole('button', { name: /sign in/i }));

    await waitFor(() => {
      expect(mockOnSuccess).toHaveBeenCalledWith(mockLoginResult);
    });
  });

  it('should navigate to /dashboard by default when login succeeds via authClient', async () => {
    const mockLoginResult = { user: { id: '1', email: 'test@example.com' }, tokens: {} };
    const mockLogin = vi.fn().mockResolvedValue(mockLoginResult);
    const mockAuthClient = {
      login: mockLogin,
      getState: vi.fn().mockReturnValue({ isLoading: false }),
      subscribe: vi.fn().mockReturnValue(() => {}),
    } as unknown as AuthClient;

    render(<LoginForm authClient={mockAuthClient} />);
    const user = userEvent.setup();

    await user.type(screen.getByLabelText(/email/i), 'test@example.com');
    await user.type(screen.getByLabelText(/password/i), 'password123');
    await user.click(screen.getByRole('button', { name: /sign in/i }));

    await waitFor(() => {
      expect(window.location.pathname).toBe('/dashboard');
    });
  });

  it('should display error message when authClient.login throws', async () => {
    const mockLogin = vi.fn().mockRejectedValue(new Error('Invalid credentials'));
    const mockAuthClient = {
      login: mockLogin,
      getState: vi.fn().mockReturnValue({ isLoading: false }),
      subscribe: vi.fn().mockReturnValue(() => {}),
    } as unknown as AuthClient;

    render(<LoginForm authClient={mockAuthClient} />);
    const user = userEvent.setup();

    await user.type(screen.getByLabelText(/email/i), 'test@example.com');
    await user.type(screen.getByLabelText(/password/i), 'password123');
    await user.click(screen.getByRole('button', { name: /sign in/i }));

    await waitFor(() => {
      expect(screen.getByText(/invalid credentials/i)).toBeInTheDocument();
    });
  });

  it('should display generic error when authClient.login throws non-Error', async () => {
    const mockLogin = vi.fn().mockRejectedValue('something went wrong');
    const mockAuthClient = {
      login: mockLogin,
      getState: vi.fn().mockReturnValue({ isLoading: false }),
      subscribe: vi.fn().mockReturnValue(() => {}),
    } as unknown as AuthClient;

    render(<LoginForm authClient={mockAuthClient} />);
    const user = userEvent.setup();

    await user.type(screen.getByLabelText(/email/i), 'test@example.com');
    await user.type(screen.getByLabelText(/password/i), 'password123');
    await user.click(screen.getByRole('button', { name: /sign in/i }));

    await waitFor(() => {
      expect(screen.getByText(/login failed/i)).toBeInTheDocument();
    });
  });

  it('should use loading prop over authClient.getState().isLoading when both are provided', () => {
    const mockAuthClient = {
      login: vi.fn(),
      getState: vi.fn().mockReturnValue({ isLoading: true }),
      subscribe: vi.fn().mockReturnValue(() => {}),
    } as unknown as AuthClient;

    render(<LoginForm authClient={mockAuthClient} loading={false} />);

    const button = screen.getByRole('button', { name: /sign in/i });
    expect(button).not.toBeDisabled();
  });
});

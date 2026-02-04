import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { RegisterForm } from '../auth/RegisterForm';
import { AuthClient, RegisterResult } from '@subauth/client';

// Mock AuthClient
vi.mock('@subauth/client', () => ({
  AuthClient: vi.fn(),
}));

describe('RegisterForm', () => {
  it('should render email, password, and confirm password fields', () => {
    render(<RegisterForm onSubmit={vi.fn()} />);

    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^password$/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/confirm password/i)).toBeInTheDocument();
  });

  it('should render submit button', () => {
    render(<RegisterForm onSubmit={vi.fn()} />);

    expect(screen.getByRole('button', { name: /create account/i })).toBeInTheDocument();
  });

  it('should call onSubmit with email and password when form is valid', async () => {
    const onSubmit = vi.fn();
    render(<RegisterForm onSubmit={onSubmit} />);
    const user = userEvent.setup();

    await user.type(screen.getByLabelText(/email/i), 'test@example.com');
    await user.type(screen.getByLabelText(/^password$/i), 'Password123');
    await user.type(screen.getByLabelText(/confirm password/i), 'Password123');
    await user.click(screen.getByRole('button', { name: /create account/i }));

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledWith({
        email: 'test@example.com',
        password: 'Password123',
        name: undefined,
      });
    });
  });

  it('should use authClient.register as default onSubmit when authClient is provided', async () => {
    const mockRegisterResult: RegisterResult = {
      message: 'Registration successful. Please check your email.',
      requiresEmailVerification: true,
    };
    const mockRegister = vi.fn().mockResolvedValue(mockRegisterResult);
    const mockAuthClient = {
      register: mockRegister,
      getState: vi.fn().mockReturnValue({ isLoading: false }),
      subscribe: vi.fn().mockReturnValue(() => {}),
    } as unknown as AuthClient;

    render(<RegisterForm authClient={mockAuthClient} />);
    const user = userEvent.setup();

    await user.type(screen.getByLabelText(/email/i), 'test@example.com');
    await user.type(screen.getByLabelText(/^password$/i), 'Password123');
    await user.type(screen.getByLabelText(/confirm password/i), 'Password123');
    await user.click(screen.getByRole('button', { name: /create account/i }));

    await waitFor(() => {
      expect(mockRegister).toHaveBeenCalledWith({
        email: 'test@example.com',
        password: 'Password123',
      });
    });
  });

  it('should call onSuccess with RegisterResult when registration succeeds via authClient', async () => {
    const mockRegisterResult: RegisterResult = {
      message: 'Registration successful. Please check your email.',
      requiresEmailVerification: true,
    };
    const mockRegister = vi.fn().mockResolvedValue(mockRegisterResult);
    const mockOnSuccess = vi.fn();
    const mockAuthClient = {
      register: mockRegister,
      getState: vi.fn().mockReturnValue({ isLoading: false }),
      subscribe: vi.fn().mockReturnValue(() => {}),
    } as unknown as AuthClient;

    render(<RegisterForm authClient={mockAuthClient} onSuccess={mockOnSuccess} />);
    const user = userEvent.setup();

    await user.type(screen.getByLabelText(/email/i), 'test@example.com');
    await user.type(screen.getByLabelText(/^password$/i), 'Password123');
    await user.type(screen.getByLabelText(/confirm password/i), 'Password123');
    await user.click(screen.getByRole('button', { name: /create account/i }));

    await waitFor(() => {
      expect(mockOnSuccess).toHaveBeenCalledWith(mockRegisterResult);
    });
  });

  it('should show success message when registration succeeds and no onSuccess provided', async () => {
    const mockRegisterResult: RegisterResult = {
      message: 'Registration successful. Please check your email to verify your account.',
      requiresEmailVerification: true,
    };
    const mockRegister = vi.fn().mockResolvedValue(mockRegisterResult);
    const mockAuthClient = {
      register: mockRegister,
      getState: vi.fn().mockReturnValue({ isLoading: false }),
      subscribe: vi.fn().mockReturnValue(() => {}),
    } as unknown as AuthClient;

    render(<RegisterForm authClient={mockAuthClient} />);
    const user = userEvent.setup();

    await user.type(screen.getByLabelText(/email/i), 'test@example.com');
    await user.type(screen.getByLabelText(/^password$/i), 'Password123');
    await user.type(screen.getByLabelText(/confirm password/i), 'Password123');
    await user.click(screen.getByRole('button', { name: /create account/i }));

    await waitFor(() => {
      expect(screen.getByText(/please check your email/i)).toBeInTheDocument();
    });
  });

  it('should hide form fields after successful registration when showing success message', async () => {
    const mockRegisterResult: RegisterResult = {
      message: 'Registration successful.',
      requiresEmailVerification: true,
    };
    const mockRegister = vi.fn().mockResolvedValue(mockRegisterResult);
    const mockAuthClient = {
      register: mockRegister,
      getState: vi.fn().mockReturnValue({ isLoading: false }),
      subscribe: vi.fn().mockReturnValue(() => {}),
    } as unknown as AuthClient;

    render(<RegisterForm authClient={mockAuthClient} />);
    const user = userEvent.setup();

    await user.type(screen.getByLabelText(/email/i), 'test@example.com');
    await user.type(screen.getByLabelText(/^password$/i), 'Password123');
    await user.type(screen.getByLabelText(/confirm password/i), 'Password123');
    await user.click(screen.getByRole('button', { name: /create account/i }));

    await waitFor(() => {
      expect(screen.queryByLabelText(/email/i)).not.toBeInTheDocument();
      expect(screen.queryByLabelText(/^password$/i)).not.toBeInTheDocument();
    });
  });

  it('should show validation error for invalid email', async () => {
    render(<RegisterForm onSubmit={vi.fn()} />);
    const user = userEvent.setup();

    await user.type(screen.getByLabelText(/email/i), 'invalid-email');
    await user.click(screen.getByRole('button', { name: /create account/i }));

    await waitFor(() => {
      expect(screen.getByText(/valid email/i)).toBeInTheDocument();
    });
  });

  it('should show validation error when passwords do not match', async () => {
    render(<RegisterForm onSubmit={vi.fn()} />);
    const user = userEvent.setup();

    await user.type(screen.getByLabelText(/email/i), 'test@example.com');
    await user.type(screen.getByLabelText(/^password$/i), 'Password123');
    await user.type(screen.getByLabelText(/confirm password/i), 'DifferentPassword123');
    await user.click(screen.getByRole('button', { name: /create account/i }));

    await waitFor(() => {
      expect(screen.getByText(/passwords do not match/i)).toBeInTheDocument();
    });
  });

  it('should show loading state when loading prop is true', () => {
    render(<RegisterForm onSubmit={vi.fn()} loading />);

    const button = screen.getByRole('button', { name: /create account/i });
    expect(button).toBeDisabled();
  });

  it('should display error message when error prop is provided', () => {
    render(<RegisterForm onSubmit={vi.fn()} error="Registration failed" />);

    expect(screen.getByText(/registration failed/i)).toBeInTheDocument();
  });

  it('should render sign in link when onSignIn is provided', () => {
    render(<RegisterForm onSubmit={vi.fn()} onSignIn={vi.fn()} />);

    expect(screen.getByText(/sign in/i)).toBeInTheDocument();
  });

  it('should use authClient.getState().isLoading for loading state when authClient is provided and loading prop is not set', () => {
    const mockAuthClient = {
      register: vi.fn(),
      getState: vi.fn().mockReturnValue({ isLoading: true }),
      subscribe: vi.fn().mockReturnValue(() => {}),
    } as unknown as AuthClient;

    render(<RegisterForm authClient={mockAuthClient} />);

    const button = screen.getByRole('button', { name: /create account/i });
    expect(button).toBeDisabled();
  });

  it('should use loading prop over authClient.getState().isLoading when both are provided', () => {
    const mockAuthClient = {
      register: vi.fn(),
      getState: vi.fn().mockReturnValue({ isLoading: true }),
      subscribe: vi.fn().mockReturnValue(() => {}),
    } as unknown as AuthClient;

    render(<RegisterForm authClient={mockAuthClient} loading={false} />);

    const button = screen.getByRole('button', { name: /create account/i });
    expect(button).not.toBeDisabled();
  });
});
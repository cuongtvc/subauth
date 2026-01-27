import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ResendVerificationForm } from '../auth/ResendVerificationForm';

describe('ResendVerificationForm', () => {
  it('should render email field', () => {
    render(<ResendVerificationForm onSubmit={vi.fn()} />);

    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
  });

  it('should render submit button with correct text', () => {
    render(<ResendVerificationForm onSubmit={vi.fn()} />);

    expect(screen.getByRole('button', { name: /resend verification email/i })).toBeInTheDocument();
  });

  it('should show validation error for invalid email', async () => {
    render(<ResendVerificationForm onSubmit={vi.fn()} />);
    const user = userEvent.setup();

    await user.type(screen.getByLabelText(/email/i), 'invalid-email');
    await user.click(screen.getByRole('button', { name: /resend verification email/i }));

    await waitFor(() => {
      expect(screen.getByText(/valid email/i)).toBeInTheDocument();
    });
  });

  it('should call onSubmit with email when form is valid', async () => {
    const onSubmit = vi.fn();
    render(<ResendVerificationForm onSubmit={onSubmit} />);
    const user = userEvent.setup();

    await user.type(screen.getByLabelText(/email/i), 'test@example.com');
    await user.click(screen.getByRole('button', { name: /resend verification email/i }));

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledWith({ email: 'test@example.com' });
    });
  });

  it('should show loading state when loading prop is true', () => {
    render(<ResendVerificationForm onSubmit={vi.fn()} loading />);

    const button = screen.getByRole('button', { name: /resend verification email/i });
    expect(button).toBeDisabled();
  });

  it('should display error message when error prop is provided', () => {
    render(<ResendVerificationForm onSubmit={vi.fn()} error="Something went wrong" />);

    expect(screen.getByText(/something went wrong/i)).toBeInTheDocument();
  });

  it('should show success message when success prop is true', () => {
    render(<ResendVerificationForm onSubmit={vi.fn()} success />);

    expect(screen.getByText(/unverified account/i)).toBeInTheDocument();
  });

  it('should hide form fields when success is true', () => {
    render(<ResendVerificationForm onSubmit={vi.fn()} success />);

    expect(screen.queryByLabelText(/email/i)).not.toBeInTheDocument();
  });

  it('should render back to login link when onBackToLogin is provided', () => {
    render(<ResendVerificationForm onSubmit={vi.fn()} onBackToLogin={vi.fn()} />);

    expect(screen.getByText(/sign in/i)).toBeInTheDocument();
  });

  it('should call onBackToLogin when sign in link is clicked', async () => {
    const onBackToLogin = vi.fn();
    render(<ResendVerificationForm onSubmit={vi.fn()} onBackToLogin={onBackToLogin} />);
    const user = userEvent.setup();

    await user.click(screen.getByText(/sign in/i));

    expect(onBackToLogin).toHaveBeenCalled();
  });

  it('should show back to login link in success state', () => {
    render(<ResendVerificationForm onSubmit={vi.fn()} success onBackToLogin={vi.fn()} />);

    expect(screen.getByText(/sign in/i)).toBeInTheDocument();
  });
});
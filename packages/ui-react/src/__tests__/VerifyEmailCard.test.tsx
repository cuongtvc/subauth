import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { VerifyEmailCard } from '../auth/VerifyEmailCard';
import { AuthClient } from '@subauth/client';

// Mock AuthClient
vi.mock('@subauth/client', () => ({
  AuthClient: vi.fn(),
}));

describe('VerifyEmailCard', () => {
  it('should show verifying state', () => {
    render(<VerifyEmailCard status="verifying" />);

    expect(screen.getByText(/verifying your email/i)).toBeInTheDocument();
  });

  it('should show success state', () => {
    render(<VerifyEmailCard status="success" />);

    expect(screen.getByText(/email verified/i)).toBeInTheDocument();
  });

  it('should show error state', () => {
    render(<VerifyEmailCard status="error" error="Invalid token" />);

    expect(screen.getByText(/verification failed/i)).toBeInTheDocument();
    expect(screen.getByText(/invalid token/i)).toBeInTheDocument();
  });

  it('should show expired state', () => {
    render(<VerifyEmailCard status="expired" />);

    expect(screen.getByText(/link expired/i)).toBeInTheDocument();
  });

  it('should call onContinue when continue button is clicked', async () => {
    const onContinue = vi.fn();
    render(<VerifyEmailCard status="success" onContinue={onContinue} />);
    const user = userEvent.setup();

    await user.click(screen.getByRole('button', { name: /continue/i }));

    expect(onContinue).toHaveBeenCalled();
  });

  it('should call onResend when resend button is clicked in error state', async () => {
    const onResend = vi.fn();
    render(<VerifyEmailCard status="error" error="Failed" onResend={onResend} />);
    const user = userEvent.setup();

    await user.click(screen.getByRole('button', { name: /resend/i }));

    expect(onResend).toHaveBeenCalled();
  });

  // Tests for authClient integration
  it('should auto-verify when authClient and token are provided', async () => {
    const mockVerifyEmail = vi.fn().mockResolvedValue(undefined);
    const mockAuthClient = {
      verifyEmail: mockVerifyEmail,
      getState: vi.fn().mockReturnValue({ isLoading: false }),
      subscribe: vi.fn().mockReturnValue(() => {}),
    } as unknown as AuthClient;

    render(<VerifyEmailCard authClient={mockAuthClient} token="test-token" />);

    await waitFor(() => {
      expect(mockVerifyEmail).toHaveBeenCalledWith('test-token');
    });
  });

  it('should show success state after successful verification via authClient', async () => {
    const mockVerifyEmail = vi.fn().mockResolvedValue(undefined);
    const mockAuthClient = {
      verifyEmail: mockVerifyEmail,
      getState: vi.fn().mockReturnValue({ isLoading: false }),
      subscribe: vi.fn().mockReturnValue(() => {}),
    } as unknown as AuthClient;

    render(<VerifyEmailCard authClient={mockAuthClient} token="test-token" />);

    await waitFor(() => {
      expect(screen.getByText(/email verified/i)).toBeInTheDocument();
    });
  });

  it('should show error state when verification via authClient fails', async () => {
    const mockVerifyEmail = vi.fn().mockRejectedValue(new Error('Invalid token'));
    const mockAuthClient = {
      verifyEmail: mockVerifyEmail,
      getState: vi.fn().mockReturnValue({ isLoading: false }),
      subscribe: vi.fn().mockReturnValue(() => {}),
    } as unknown as AuthClient;

    render(<VerifyEmailCard authClient={mockAuthClient} token="test-token" />);

    await waitFor(() => {
      expect(screen.getByText(/verification failed/i)).toBeInTheDocument();
      expect(screen.getByText(/invalid token/i)).toBeInTheDocument();
    });
  });

  it('should navigate to /login by default when continue is clicked with authClient', async () => {
    const mockAuthClient = {
      verifyEmail: vi.fn().mockResolvedValue(undefined),
      getState: vi.fn().mockReturnValue({ isLoading: false }),
      subscribe: vi.fn().mockReturnValue(() => {}),
    } as unknown as AuthClient;

    render(<VerifyEmailCard authClient={mockAuthClient} token="test-token" />);
    const user = userEvent.setup();

    await waitFor(() => {
      expect(screen.getByText(/email verified/i)).toBeInTheDocument();
    });

    await user.click(screen.getByRole('button', { name: /continue/i }));

    expect(window.location.pathname).toBe('/login');
  });

  it('should navigate to /resend-verification by default when resend is clicked with authClient', async () => {
    const mockVerifyEmail = vi.fn().mockRejectedValue(new Error('Invalid token'));
    const mockAuthClient = {
      verifyEmail: mockVerifyEmail,
      getState: vi.fn().mockReturnValue({ isLoading: false }),
      subscribe: vi.fn().mockReturnValue(() => {}),
    } as unknown as AuthClient;

    render(<VerifyEmailCard authClient={mockAuthClient} token="test-token" />);
    const user = userEvent.setup();

    await waitFor(() => {
      expect(screen.getByText(/verification failed/i)).toBeInTheDocument();
    });

    await user.click(screen.getByRole('button', { name: /resend/i }));

    expect(window.location.pathname).toBe('/resend-verification');
  });
});
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { AuthLayout } from '../auth/AuthLayout';

// Mock fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Mock window.location for URL-based plan detection
const originalLocation = window.location;

describe('AuthLayout', () => {
  beforeEach(() => {
    delete (window as { location?: Location }).location;
    window.location = { ...originalLocation, search: '' };
  });

  afterEach(() => {
    window.location = originalLocation;
  });

  it('should render title and description', () => {
    render(
      <AuthLayout title="Test Title" description="Test description">
        <div>Content</div>
      </AuthLayout>
    );

    expect(screen.getByText('Test Title')).toBeInTheDocument();
    expect(screen.getByText('Test description')).toBeInTheDocument();
  });

  it('should render children', () => {
    render(
      <AuthLayout title="Test">
        <div data-testid="child-content">Child Content</div>
      </AuthLayout>
    );

    expect(screen.getByTestId('child-content')).toBeInTheDocument();
  });

  it('should render logo when provided', () => {
    render(
      <AuthLayout title="Test" logo={<div data-testid="logo">Logo</div>}>
        <div>Content</div>
      </AuthLayout>
    );

    expect(screen.getByTestId('logo')).toBeInTheDocument();
  });

  it('should render footer when provided', () => {
    render(
      <AuthLayout title="Test" footer={<div data-testid="footer">Footer</div>}>
        <div>Content</div>
      </AuthLayout>
    );

    expect(screen.getByTestId('footer')).toBeInTheDocument();
  });
});

describe('AuthLayout - Trial Days Feature', () => {
  beforeEach(() => {
    delete (window as { location?: Location }).location;
    window.location = { ...originalLocation, search: '' };
  });

  afterEach(() => {
    window.location = originalLocation;
  });

  it('should show default description when no plan in URL', () => {
    window.location.search = '';

    render(
      <AuthLayout
        title="Create your account"
        defaultDescription="Get started for free"
        proTrialDescription="Start your {trialDays}-day Pro trial"
        trialDays={14}
      >
        <div>Form</div>
      </AuthLayout>
    );

    expect(screen.getByText('Get started for free')).toBeInTheDocument();
  });

  it('should show pro trial description when plan=pro in URL', () => {
    window.location.search = '?plan=pro';

    render(
      <AuthLayout
        title="Create your account"
        defaultDescription="Get started for free"
        proTrialDescription="Start your {trialDays}-day Pro trial"
        trialDays={14}
      >
        <div>Form</div>
      </AuthLayout>
    );

    expect(screen.getByText('Start your 14-day Pro trial')).toBeInTheDocument();
  });

  it('should use configured trialDays in description', () => {
    window.location.search = '?plan=pro';

    render(
      <AuthLayout
        title="Create your account"
        defaultDescription="Get started for free"
        proTrialDescription="Start your {trialDays}-day Pro trial"
        trialDays={7}
      >
        <div>Form</div>
      </AuthLayout>
    );

    expect(screen.getByText('Start your 7-day Pro trial')).toBeInTheDocument();
  });

  it('should use description prop when provided (override auto-detection)', () => {
    window.location.search = '?plan=pro';

    render(
      <AuthLayout
        title="Create your account"
        description="Custom description"
        defaultDescription="Get started for free"
        proTrialDescription="Start your {trialDays}-day Pro trial"
        trialDays={14}
      >
        <div>Form</div>
      </AuthLayout>
    );

    expect(screen.getByText('Custom description')).toBeInTheDocument();
  });

  it('should handle plan prop override URL plan', () => {
    window.location.search = '?plan=free';

    render(
      <AuthLayout
        title="Create your account"
        plan="pro"
        defaultDescription="Get started for free"
        proTrialDescription="Start your {trialDays}-day Pro trial"
        trialDays={14}
      >
        <div>Form</div>
      </AuthLayout>
    );

    expect(screen.getByText('Start your 14-day Pro trial')).toBeInTheDocument();
  });
});

describe('AuthLayout - Auto-fetch Trial Days', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete (window as { location?: Location }).location;
    window.location = { ...originalLocation, search: '' };
  });

  afterEach(() => {
    window.location = originalLocation;
  });

  it('should fetch trialDays from API when subscriptionApiUrl is provided', async () => {
    window.location.search = '?plan=pro';
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        success: true,
        data: { plans: [], trialDays: 14 },
      }),
    });

    render(
      <AuthLayout
        title="Create your account"
        defaultDescription="Get started for free"
        proTrialDescription="Start your {trialDays}-day Pro trial"
        subscriptionApiUrl="/api/subscription/plans"
      >
        <div>Form</div>
      </AuthLayout>
    );

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith('/api/subscription/plans');
    });

    await waitFor(() => {
      expect(screen.getByText('Start your 14-day Pro trial')).toBeInTheDocument();
    });
  });

  it('should use trialDays from API response', async () => {
    window.location.search = '?plan=pro';
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        success: true,
        data: { plans: [], trialDays: 7 },
      }),
    });

    render(
      <AuthLayout
        title="Create your account"
        defaultDescription="Get started for free"
        proTrialDescription="Start your {trialDays}-day Pro trial"
        subscriptionApiUrl="/api/subscription/plans"
      >
        <div>Form</div>
      </AuthLayout>
    );

    await waitFor(() => {
      expect(screen.getByText('Start your 7-day Pro trial')).toBeInTheDocument();
    });
  });

  it('should use trialDays prop over API when both provided', async () => {
    window.location.search = '?plan=pro';
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        success: true,
        data: { plans: [], trialDays: 7 },
      }),
    });

    render(
      <AuthLayout
        title="Create your account"
        defaultDescription="Get started for free"
        proTrialDescription="Start your {trialDays}-day Pro trial"
        trialDays={30}
        subscriptionApiUrl="/api/subscription/plans"
      >
        <div>Form</div>
      </AuthLayout>
    );

    // Should use prop value immediately, not wait for API
    expect(screen.getByText('Start your 30-day Pro trial')).toBeInTheDocument();
  });

  it('should show default description while loading when plan=pro', async () => {
    window.location.search = '?plan=pro';
    // Never resolves to simulate loading
    mockFetch.mockImplementation(() => new Promise(() => {}));

    render(
      <AuthLayout
        title="Create your account"
        defaultDescription="Get started for free"
        proTrialDescription="Start your {trialDays}-day Pro trial"
        subscriptionApiUrl="/api/subscription/plans"
      >
        <div>Form</div>
      </AuthLayout>
    );

    // Should show default while loading
    expect(screen.getByText('Get started for free')).toBeInTheDocument();
  });

  it('should handle API error gracefully', async () => {
    window.location.search = '?plan=pro';
    mockFetch.mockRejectedValue(new Error('Network error'));

    render(
      <AuthLayout
        title="Create your account"
        defaultDescription="Get started for free"
        proTrialDescription="Start your {trialDays}-day Pro trial"
        subscriptionApiUrl="/api/subscription/plans"
      >
        <div>Form</div>
      </AuthLayout>
    );

    // Should fall back to default description on error
    await waitFor(() => {
      expect(screen.getByText('Get started for free')).toBeInTheDocument();
    });
  });
});
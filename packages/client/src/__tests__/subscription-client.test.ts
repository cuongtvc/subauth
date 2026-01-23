import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// Import will fail until we implement - that's TDD!
import { SubscriptionClient } from '../subscription-client';
import type { SubscriptionClientConfig, SubscriptionState } from '../types';

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

function createTestConfig(overrides?: Partial<SubscriptionClientConfig>): SubscriptionClientConfig {
  return {
    baseUrl: 'http://localhost:3000',
    tokenStorageKey: 'auth_token',
    subscriptionStorageKey: 'subscription',
    refreshIntervalMs: 30 * 60 * 1000, // 30 minutes
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
  const response = {
    ok: false,
    status,
    json: () => Promise.resolve(error),
    clone: () => response,
  };
  return Promise.resolve(response);
}

// ============================================
// SUBSCRIPTION CLIENT - INITIALIZATION TESTS
// ============================================

describe('SubscriptionClient - Initialization', () => {
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

  it('should initialize with no subscription', () => {
    const client = new SubscriptionClient(createTestConfig(), storage);
    const state = client.getState();

    expect(state.subscription).toBeNull();
    expect(state.isLoading).toBe(false);
  });

  it('should restore subscription from storage', () => {
    storage.setItem('subscription', JSON.stringify({
      id: 'sub_1',
      planId: 'basic',
      status: 'active',
    }));

    const client = new SubscriptionClient(createTestConfig(), storage);
    const state = client.getState();

    expect(state.subscription).toBeDefined();
    expect(state.subscription?.planId).toBe('basic');
  });

  it('should handle corrupted storage gracefully', () => {
    storage.setItem('subscription', 'not-valid-json');

    const client = new SubscriptionClient(createTestConfig(), storage);
    expect(client.getState().subscription).toBeNull();
  });
});

// ============================================
// SUBSCRIPTION CLIENT - GET PLANS TESTS
// ============================================

describe('SubscriptionClient - Get Plans', () => {
  let client: SubscriptionClient;
  let mockFetch: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockFetch = createMockFetch();
    vi.stubGlobal('fetch', mockFetch);
    client = new SubscriptionClient(createTestConfig(), createMockStorage());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('should fetch available plans', async () => {
    mockFetch.mockReturnValueOnce(mockSuccessResponse({
      plans: [
        { id: 'basic', name: 'Basic', prices: [{ id: 'price_1', amount: 999 }] },
        { id: 'plus', name: 'Plus', prices: [{ id: 'price_2', amount: 1999 }] },
      ],
    }));

    const plans = await client.getPlans();

    expect(plans).toHaveLength(2);
    expect(plans[0].id).toBe('basic');
    expect(mockFetch).toHaveBeenCalledWith(
      'http://localhost:3000/subscription/plans',
      expect.objectContaining({ method: 'GET' })
    );
  });

  it('should cache plans', async () => {
    mockFetch.mockReturnValueOnce(mockSuccessResponse({
      plans: [{ id: 'basic', name: 'Basic', prices: [] }],
    }));

    await client.getPlans();
    await client.getPlans();

    expect(mockFetch).toHaveBeenCalledTimes(1);
  });
});

// ============================================
// SUBSCRIPTION CLIENT - CHECKOUT TESTS
// ============================================

describe('SubscriptionClient - Checkout', () => {
  let client: SubscriptionClient;
  let storage: Storage;
  let mockFetch: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    storage = createMockStorage();
    storage.setItem('auth_token', 'valid_token');
    mockFetch = createMockFetch();
    vi.stubGlobal('fetch', mockFetch);
    client = new SubscriptionClient(createTestConfig(), storage);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('should create checkout session', async () => {
    mockFetch.mockReturnValueOnce(mockSuccessResponse({
      url: 'https://checkout.stripe.com/session_123',
      sessionId: 'session_123',
    }));

    const result = await client.createCheckout('price_basic_monthly');

    expect(result.url).toContain('checkout');
    expect(result.sessionId).toBe('session_123');
  });

  it('should include auth token in checkout request', async () => {
    mockFetch.mockReturnValueOnce(mockSuccessResponse({
      url: 'https://checkout.example.com',
      sessionId: 'session_123',
    }));

    await client.createCheckout('price_basic_monthly');

    expect(mockFetch).toHaveBeenCalledWith(
      'http://localhost:3000/subscription/checkout',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          'Authorization': 'Bearer valid_token',
        }),
      })
    );
  });

  it('should throw if not authenticated', async () => {
    const unauthClient = new SubscriptionClient(createTestConfig(), createMockStorage());

    await expect(
      unauthClient.createCheckout('price_basic_monthly')
    ).rejects.toThrow();
  });

  it('should throw for already subscribed user', async () => {
    mockFetch.mockReturnValueOnce(mockErrorResponse(400, { code: 'ALREADY_SUBSCRIBED' }));

    await expect(
      client.createCheckout('price_basic_monthly')
    ).rejects.toThrow();
  });
});

// ============================================
// SUBSCRIPTION CLIENT - GET SUBSCRIPTION TESTS
// ============================================

describe('SubscriptionClient - Get Subscription', () => {
  let client: SubscriptionClient;
  let storage: Storage;
  let mockFetch: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    storage = createMockStorage();
    storage.setItem('auth_token', 'valid_token');
    mockFetch = createMockFetch();
    vi.stubGlobal('fetch', mockFetch);
    client = new SubscriptionClient(createTestConfig(), storage);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('should fetch current subscription', async () => {
    mockFetch.mockReturnValueOnce(mockSuccessResponse({
      subscription: {
        id: 'sub_1',
        planId: 'basic',
        status: 'active',
        currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      },
    }));

    const subscription = await client.getSubscription();

    expect(subscription).toBeDefined();
    expect(subscription!.planId).toBe('basic');
  });

  it('should update state after fetching', async () => {
    mockFetch.mockReturnValueOnce(mockSuccessResponse({
      subscription: { id: 'sub_1', planId: 'plus', status: 'active' },
    }));

    await client.getSubscription();

    expect(client.getState().subscription?.planId).toBe('plus');
  });

  it('should persist subscription to storage', async () => {
    mockFetch.mockReturnValueOnce(mockSuccessResponse({
      subscription: { id: 'sub_1', planId: 'basic', status: 'active' },
    }));

    await client.getSubscription();

    const stored = JSON.parse(storage.getItem('subscription')!);
    expect(stored.planId).toBe('basic');
  });

  it('should return null if no subscription', async () => {
    mockFetch.mockReturnValueOnce(mockSuccessResponse({ subscription: null }));

    const subscription = await client.getSubscription();

    expect(subscription).toBeNull();
  });
});

// ============================================
// SUBSCRIPTION CLIENT - CANCEL/RESUME TESTS
// ============================================

describe('SubscriptionClient - Cancel/Resume', () => {
  let client: SubscriptionClient;
  let storage: Storage;
  let mockFetch: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    storage = createMockStorage();
    storage.setItem('auth_token', 'valid_token');
    storage.setItem('subscription', JSON.stringify({
      id: 'sub_1',
      planId: 'basic',
      status: 'active',
      cancelAtPeriodEnd: false,
    }));
    mockFetch = createMockFetch();
    vi.stubGlobal('fetch', mockFetch);
    client = new SubscriptionClient(createTestConfig(), storage);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('should cancel subscription', async () => {
    mockFetch.mockReturnValueOnce(mockSuccessResponse({
      subscription: { id: 'sub_1', planId: 'basic', status: 'active', cancelAtPeriodEnd: true },
    }));

    await client.cancelSubscription();

    expect(mockFetch).toHaveBeenCalledWith(
      'http://localhost:3000/subscription/cancel',
      expect.objectContaining({ method: 'POST' })
    );
    expect(client.getState().subscription?.cancelAtPeriodEnd).toBe(true);
  });

  it('should resume subscription', async () => {
    storage.setItem('subscription', JSON.stringify({
      id: 'sub_1',
      planId: 'basic',
      status: 'active',
      cancelAtPeriodEnd: true,
    }));
    client = new SubscriptionClient(createTestConfig(), storage);

    mockFetch.mockReturnValueOnce(mockSuccessResponse({
      subscription: { id: 'sub_1', planId: 'basic', status: 'active', cancelAtPeriodEnd: false },
    }));

    await client.resumeSubscription();

    expect(mockFetch).toHaveBeenCalledWith(
      'http://localhost:3000/subscription/resume',
      expect.objectContaining({ method: 'POST' })
    );
    expect(client.getState().subscription?.cancelAtPeriodEnd).toBe(false);
  });
});

// ============================================
// SUBSCRIPTION CLIENT - VALIDITY CHECKS TESTS
// ============================================

describe('SubscriptionClient - Validity Checks', () => {
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

  it('should return true for active subscription', () => {
    storage.setItem('subscription', JSON.stringify({
      id: 'sub_1',
      status: 'active',
      currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    }));

    const client = new SubscriptionClient(createTestConfig(), storage);
    expect(client.isSubscriptionValid()).toBe(true);
  });

  it('should return false for canceled subscription', () => {
    storage.setItem('subscription', JSON.stringify({
      id: 'sub_1',
      status: 'canceled',
      currentPeriodEnd: new Date(Date.now() - 1000).toISOString(),
    }));

    const client = new SubscriptionClient(createTestConfig(), storage);
    expect(client.isSubscriptionValid()).toBe(false);
  });

  it('should return false for expired subscription', () => {
    storage.setItem('subscription', JSON.stringify({
      id: 'sub_1',
      status: 'active',
      currentPeriodEnd: new Date(Date.now() - 1000).toISOString(),
    }));

    const client = new SubscriptionClient(createTestConfig(), storage);
    expect(client.isSubscriptionValid()).toBe(false);
  });

  it('should return true for valid trial', () => {
    storage.setItem('subscription', JSON.stringify({
      id: 'sub_1',
      status: 'trialing',
      trialEndDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    }));

    const client = new SubscriptionClient(createTestConfig(), storage);
    expect(client.isSubscriptionValid()).toBe(true);
  });

  it('should return false for expired trial', () => {
    storage.setItem('subscription', JSON.stringify({
      id: 'sub_1',
      status: 'trialing',
      trialEndDate: new Date(Date.now() - 1000).toISOString(),
    }));

    const client = new SubscriptionClient(createTestConfig(), storage);
    expect(client.isSubscriptionValid()).toBe(false);
  });

  it('should return false for no subscription', () => {
    const client = new SubscriptionClient(createTestConfig(), storage);
    expect(client.isSubscriptionValid()).toBe(false);
  });

  it('should check plan type', () => {
    storage.setItem('subscription', JSON.stringify({
      id: 'sub_1',
      planId: 'plus',
      status: 'active',
      currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    }));

    const client = new SubscriptionClient(createTestConfig(), storage);
    expect(client.hasPlan('plus')).toBe(true);
    expect(client.hasPlan('basic')).toBe(false);
  });
});

// ============================================
// SUBSCRIPTION CLIENT - STATE SUBSCRIPTION TESTS
// ============================================

describe('SubscriptionClient - State Subscriptions', () => {
  let client: SubscriptionClient;
  let storage: Storage;
  let mockFetch: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    storage = createMockStorage();
    storage.setItem('auth_token', 'valid_token');
    mockFetch = createMockFetch();
    vi.stubGlobal('fetch', mockFetch);
    client = new SubscriptionClient(createTestConfig(), storage);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('should notify subscribers on subscription change', async () => {
    const listener = vi.fn();
    client.subscribe(listener);

    mockFetch.mockReturnValueOnce(mockSuccessResponse({
      subscription: { id: 'sub_1', planId: 'basic', status: 'active' },
    }));

    await client.getSubscription();

    expect(listener).toHaveBeenCalled();
    const lastCall = listener.mock.calls[listener.mock.calls.length - 1][0] as SubscriptionState;
    expect(lastCall.subscription?.planId).toBe('basic');
  });

  it('should allow unsubscribing', async () => {
    const listener = vi.fn();
    const unsubscribe = client.subscribe(listener);

    unsubscribe();

    mockFetch.mockReturnValueOnce(mockSuccessResponse({
      subscription: { id: 'sub_1', planId: 'basic', status: 'active' },
    }));

    await client.getSubscription();

    expect(listener).not.toHaveBeenCalled();
  });
});

// ============================================
// SUBSCRIPTION CLIENT - TRIAL INFO TESTS
// ============================================

describe('SubscriptionClient - Trial Info', () => {
  let storage: Storage;

  beforeEach(() => {
    storage = createMockStorage();
  });

  it('should return trial info for trialing subscription', () => {
    const trialEnd = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000); // 3 days from now
    storage.setItem('subscription', JSON.stringify({
      id: 'sub_1',
      status: 'trialing',
      trialEndDate: trialEnd.toISOString(),
    }));

    const client = new SubscriptionClient(createTestConfig(), storage);
    const trialInfo = client.getTrialInfo();

    expect(trialInfo).toBeDefined();
    expect(trialInfo!.isTrialing).toBe(true);
    expect(trialInfo!.daysRemaining).toBe(3);
  });

  it('should return null for non-trialing subscription', () => {
    storage.setItem('subscription', JSON.stringify({
      id: 'sub_1',
      status: 'active',
    }));

    const client = new SubscriptionClient(createTestConfig(), storage);
    expect(client.getTrialInfo()).toBeNull();
  });

  it('should return expired trial info', () => {
    storage.setItem('subscription', JSON.stringify({
      id: 'sub_1',
      status: 'trialing',
      trialEndDate: new Date(Date.now() - 1000).toISOString(),
    }));

    const client = new SubscriptionClient(createTestConfig(), storage);
    const trialInfo = client.getTrialInfo();

    expect(trialInfo!.isTrialing).toBe(true);
    expect(trialInfo!.daysRemaining).toBe(0);
    expect(trialInfo!.isExpired).toBe(true);
  });
});

// ============================================
// SUBSCRIPTION CLIENT - SUBSCRIPTION EXPIRED CALLBACK TESTS
// ============================================

describe('SubscriptionClient - Expired Callback', () => {
  let storage: Storage;
  let mockFetch: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    storage = createMockStorage();
    storage.setItem('auth_token', 'valid_token');
    mockFetch = createMockFetch();
    vi.stubGlobal('fetch', mockFetch);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('should call onSubscriptionExpired when receiving 403 with subscription_expired', async () => {
    const onExpired = vi.fn();
    const client = new SubscriptionClient(
      createTestConfig({ onSubscriptionExpired: onExpired }),
      storage
    );

    mockFetch.mockReturnValueOnce(mockErrorResponse(403, { code: 'SUBSCRIPTION_EXPIRED' }));

    try {
      await client.fetchWithSubscription('/api/protected');
    } catch {}

    expect(onExpired).toHaveBeenCalled();
  });

  it('should not call onSubscriptionExpired for other 403 errors', async () => {
    const onExpired = vi.fn();
    const client = new SubscriptionClient(
      createTestConfig({ onSubscriptionExpired: onExpired }),
      storage
    );

    mockFetch.mockReturnValueOnce(mockErrorResponse(403, { code: 'FORBIDDEN' }));

    try {
      await client.fetchWithSubscription('/api/protected');
    } catch {}

    expect(onExpired).not.toHaveBeenCalled();
  });
});

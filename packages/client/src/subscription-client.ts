import type {
  SubscriptionClientConfig,
  SubscriptionState,
  SubscriptionStateListener,
  TrialInfo,
} from './types';
import type { Subscription, Plan, CheckoutSession } from '@subauth/core';

export class SubscriptionClient {
  private config: SubscriptionClientConfig;
  private storage: Storage;
  private state: SubscriptionState;
  private listeners: Set<SubscriptionStateListener> = new Set();
  private plansCache: Plan[] | null = null;

  constructor(config: SubscriptionClientConfig, storage: Storage) {
    this.config = {
      tokenStorageKey: 'auth_token',
      subscriptionStorageKey: 'subscription',
      refreshIntervalMs: 30 * 60 * 1000,
      ...config,
    };
    this.storage = storage;

    // Initialize state from storage
    this.state = this.loadStateFromStorage();
  }

  private loadStateFromStorage(): SubscriptionState {
    try {
      const subJson = this.storage.getItem(this.config.subscriptionStorageKey!);
      if (subJson) {
        const subscription = JSON.parse(subJson) as Subscription;
        return {
          subscription,
          isLoading: false,
        };
      }
    } catch {
      // Corrupted storage
    }

    return {
      subscription: null,
      isLoading: false,
    };
  }

  private saveSubscriptionToStorage(subscription: Subscription | null): void {
    if (subscription) {
      this.storage.setItem(this.config.subscriptionStorageKey!, JSON.stringify(subscription));
    } else {
      this.storage.removeItem(this.config.subscriptionStorageKey!);
    }
  }

  private setState(newState: Partial<SubscriptionState>): void {
    this.state = { ...this.state, ...newState };
    this.notifyListeners();
  }

  private notifyListeners(): void {
    for (const listener of this.listeners) {
      listener(this.state);
    }
  }

  private getToken(): string | null {
    return this.storage.getItem(this.config.tokenStorageKey!);
  }

  getState(): SubscriptionState {
    return { ...this.state };
  }

  subscribe(listener: SubscriptionStateListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  async getPlans(): Promise<Plan[]> {
    // Return cached plans if available
    if (this.plansCache) {
      return this.plansCache;
    }

    const response = await fetch(`${this.config.baseUrl}/subscription/plans`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to fetch plans');
    }

    const data = await response.json();
    this.plansCache = data.plans;
    return data.plans;
  }

  async createCheckout(priceId: string): Promise<CheckoutSession> {
    const token = this.getToken();
    if (!token) {
      throw new Error('Not authenticated');
    }

    const response = await fetch(`${this.config.baseUrl}/subscription/checkout`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({ priceId }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || error.code || 'Failed to create checkout');
    }

    const data = await response.json();
    return {
      url: data.url,
      sessionId: data.sessionId,
    };
  }

  async getSubscription(): Promise<Subscription | null> {
    const token = this.getToken();
    if (!token) {
      return null;
    }

    this.setState({ isLoading: true });

    try {
      const response = await fetch(`${this.config.baseUrl}/subscription`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to fetch subscription');
      }

      const data = await response.json();
      const subscription = data.subscription || null;

      this.saveSubscriptionToStorage(subscription);
      this.setState({ subscription, isLoading: false });

      return subscription;
    } catch (error) {
      this.setState({ isLoading: false });
      throw error;
    }
  }

  async cancelSubscription(): Promise<void> {
    const token = this.getToken();
    if (!token) {
      throw new Error('Not authenticated');
    }

    const response = await fetch(`${this.config.baseUrl}/subscription/cancel`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to cancel subscription');
    }

    const data = await response.json();
    const subscription = data.subscription;

    this.saveSubscriptionToStorage(subscription);
    this.setState({ subscription });
  }

  async resumeSubscription(): Promise<void> {
    const token = this.getToken();
    if (!token) {
      throw new Error('Not authenticated');
    }

    const response = await fetch(`${this.config.baseUrl}/subscription/resume`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to resume subscription');
    }

    const data = await response.json();
    const subscription = data.subscription;

    this.saveSubscriptionToStorage(subscription);
    this.setState({ subscription });
  }

  isSubscriptionValid(): boolean {
    const subscription = this.state.subscription;
    if (!subscription) {
      return false;
    }

    // Check status
    if (subscription.status === 'canceled' || subscription.status === 'past_due') {
      return false;
    }

    // Check if trial
    if (subscription.status === 'trialing') {
      if (!subscription.trialEndDate) {
        return false;
      }
      return new Date(subscription.trialEndDate) > new Date();
    }

    // Check if active and not expired
    if (subscription.status === 'active') {
      return new Date(subscription.currentPeriodEnd) > new Date();
    }

    return false;
  }

  hasPlan(planId: string): boolean {
    if (!this.isSubscriptionValid()) {
      return false;
    }

    return this.state.subscription?.planId === planId;
  }

  getTrialInfo(): TrialInfo | null {
    const subscription = this.state.subscription;
    if (!subscription || subscription.status !== 'trialing' || !subscription.trialEndDate) {
      return null;
    }

    const trialEndDate = new Date(subscription.trialEndDate);
    const now = new Date();
    const msRemaining = trialEndDate.getTime() - now.getTime();
    const daysRemaining = Math.max(0, Math.ceil(msRemaining / (24 * 60 * 60 * 1000)));
    const isExpired = msRemaining <= 0;

    return {
      isTrialing: true,
      daysRemaining,
      trialEndDate,
      isExpired,
    };
  }

  async fetchWithSubscription(path: string, options?: RequestInit): Promise<Response> {
    const token = this.getToken();

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(options?.headers as Record<string, string>),
    };

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const response = await fetch(`${this.config.baseUrl}${path}`, {
      ...options,
      headers,
    });

    // Handle 403 with subscription_expired
    if (response.status === 403) {
      try {
        const clonedResponse = response.clone();
        const error = await clonedResponse.json();
        if (error.code === 'SUBSCRIPTION_EXPIRED' && this.config.onSubscriptionExpired) {
          this.config.onSubscriptionExpired();
        }
      } catch {
        // Ignore JSON parse errors
      }
    }

    return response;
  }
}

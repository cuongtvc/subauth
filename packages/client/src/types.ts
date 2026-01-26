import type { User, Subscription } from '@subauth/core';

export interface AuthClientConfig {
  baseUrl: string;
  tokenStorageKey?: string;
  userStorageKey?: string;
  onTokenExpired?: () => void;
}

export interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
}

export interface SubscriptionClientConfig {
  baseUrl: string;
  tokenStorageKey?: string;
  subscriptionStorageKey?: string;
  refreshIntervalMs?: number;
  onSubscriptionExpired?: () => void;
}

export interface SubscriptionState {
  subscription: Subscription | null;
  isLoading: boolean;
}

export interface TrialInfo {
  isTrialing: boolean;
  daysRemaining: number;
  trialEndDate: Date;
  isExpired: boolean;
}

export type AuthStateListener = (state: AuthState) => void;
export type SubscriptionStateListener = (state: SubscriptionState) => void;

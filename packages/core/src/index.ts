// Core types and interfaces for authpaddle
// TDD: These will be implemented as tests require them

// ============================================
// USER & AUTH TYPES
// ============================================

export interface User {
  id: string;
  email: string;
  emailVerified: boolean;
  createdAt: Date;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken?: string;
  expiresAt: Date;
}

export interface RegisterInput {
  email: string;
  password: string;
}

export interface LoginInput {
  email: string;
  password: string;
}

export interface AuthResult {
  user: User;
  tokens: AuthTokens;
}

export interface VerifyEmailInput {
  token: string;
}

export interface PasswordResetRequestInput {
  email: string;
}

export interface PasswordResetInput {
  token: string;
  newPassword: string;
}

// ============================================
// SUBSCRIPTION & PAYMENT TYPES
// ============================================

export type SubscriptionStatus =
  | 'trialing'
  | 'active'
  | 'canceled'
  | 'past_due'
  | 'paused'
  | 'incomplete';

export type BillingCycle = 'monthly' | 'annual' | 'one_time';

export interface Plan {
  id: string;
  name: string;
  description?: string;
  features: string[];
  prices: PlanPrice[];
}

export interface PlanPrice {
  id: string;
  amount: number; // in cents
  currency: string;
  billingCycle: BillingCycle;
}

export interface Subscription {
  id: string;
  userId: string;
  planId: string;
  priceId: string;
  status: SubscriptionStatus;
  billingCycle: BillingCycle;
  currentPeriodStart: Date;
  currentPeriodEnd: Date;
  cancelAtPeriodEnd: boolean;
  trialEndDate?: Date;
  providerSubscriptionId: string; // Paddle/Stripe subscription ID
  providerCustomerId: string; // Paddle/Stripe customer ID
  createdAt: Date;
  updatedAt: Date;
}

export interface Transaction {
  id: string;
  userId: string;
  subscriptionId?: string;
  amount: number;
  currency: string;
  status: 'pending' | 'completed' | 'failed' | 'refunded';
  providerTransactionId: string;
  createdAt: Date;
}

export interface CheckoutSession {
  url: string;
  sessionId: string;
}

export interface CustomerPortalSession {
  url: string;
}

// ============================================
// ADAPTER INTERFACES
// ============================================

// Database adapter - to be implemented by consumers
export interface DatabaseAdapter {
  // User operations
  createUser(email: string, passwordHash: string): Promise<User>;
  getUserById(id: string): Promise<User | null>;
  getUserByEmail(email: string): Promise<User | null>;
  updateUser(id: string, updates: Partial<User>): Promise<User>;

  // Password operations
  getPasswordHash(userId: string): Promise<string | null>;
  setPasswordHash(userId: string, hash: string): Promise<void>;

  // Verification token operations
  setVerificationToken(userId: string, token: string, expiresAt: Date): Promise<void>;
  getUserByVerificationToken(token: string): Promise<User | null>;
  clearVerificationToken(userId: string): Promise<void>;

  // Password reset token operations
  setPasswordResetToken(userId: string, token: string, expiresAt: Date): Promise<void>;
  getUserByPasswordResetToken(token: string): Promise<User | null>;
  clearPasswordResetToken(userId: string): Promise<void>;

  // Subscription operations
  createSubscription(subscription: Omit<Subscription, 'id' | 'createdAt' | 'updatedAt'>): Promise<Subscription>;
  getSubscriptionByUserId(userId: string): Promise<Subscription | null>;
  getSubscriptionByProviderId(providerSubscriptionId: string): Promise<Subscription | null>;
  updateSubscription(id: string, updates: Partial<Subscription>): Promise<Subscription>;

  // Transaction operations
  createTransaction(transaction: Omit<Transaction, 'id' | 'createdAt'>): Promise<Transaction>;
  getTransactionByProviderId(providerTransactionId: string): Promise<Transaction | null>;

  // Customer ID mapping
  setProviderCustomerId(userId: string, providerId: string): Promise<void>;
  getUserByProviderCustomerId(providerId: string): Promise<User | null>;
}

// Email adapter - to be implemented by consumers
export interface EmailAdapter {
  sendVerificationEmail(email: string, token: string, verifyUrl: string): Promise<void>;
  sendPasswordResetEmail(email: string, token: string, resetUrl: string): Promise<void>;
  sendSubscriptionConfirmation?(email: string, subscription: Subscription): Promise<void>;
  sendSubscriptionCanceled?(email: string, subscription: Subscription): Promise<void>;
}

// Payment adapter - generic interface for Paddle, Stripe, etc.
export interface PaymentAdapter {
  readonly providerName: string; // 'paddle', 'stripe', 'lemonsqueezy', etc.

  // Checkout
  createCheckoutSession(params: {
    userId: string;
    email: string;
    priceId: string;
    successUrl: string;
    cancelUrl: string;
    metadata?: Record<string, string>;
  }): Promise<CheckoutSession>;

  // Customer portal (for self-service management)
  createCustomerPortalSession?(params: {
    customerId: string;
    returnUrl: string;
  }): Promise<CustomerPortalSession>;

  // Subscription management
  cancelSubscription(subscriptionId: string, cancelAtPeriodEnd?: boolean): Promise<void>;
  resumeSubscription?(subscriptionId: string): Promise<void>;
  updateSubscription?(subscriptionId: string, newPriceId: string): Promise<void>;

  // Webhook handling
  verifyWebhookSignature(payload: string | Buffer, signature: string): boolean;
  parseWebhookEvent(payload: string | Buffer): WebhookEvent;

  // Plan/Price management
  getPlans?(): Promise<Plan[]>;
  getPrices?(planId: string): Promise<PlanPrice[]>;
}

// ============================================
// WEBHOOK TYPES
// ============================================

export type WebhookEventType =
  | 'subscription.created'
  | 'subscription.updated'
  | 'subscription.canceled'
  | 'subscription.activated'
  | 'subscription.past_due'
  | 'subscription.paused'
  | 'transaction.completed'
  | 'transaction.failed'
  | 'transaction.refunded';

export interface WebhookEvent {
  type: WebhookEventType;
  provider: string;
  data: {
    subscriptionId?: string;
    customerId?: string;
    email?: string;
    priceId?: string;
    status?: SubscriptionStatus;
    currentPeriodStart?: Date;
    currentPeriodEnd?: Date;
    cancelAtPeriodEnd?: boolean;
    transactionId?: string;
    amount?: number;
    currency?: string;
    metadata?: Record<string, string>;
  };
  rawEvent: unknown; // Original event from provider
}

// ============================================
// CONFIGURATION
// ============================================

export interface AuthConfig {
  jwtSecret: string;
  jwtExpiresIn: string; // e.g., '7d', '1h'
  refreshTokenExpiresIn?: string;
  verificationTokenExpiresIn: number; // milliseconds
  passwordResetTokenExpiresIn: number; // milliseconds
  baseUrl: string; // for email links
  passwordMinLength?: number; // default 8
}

export interface SubscriptionConfig {
  trialDays?: number; // default 0 (no trial)
  plans: Plan[];
}

export interface AuthPaddleConfig {
  auth: AuthConfig;
  subscription?: SubscriptionConfig;
  database: DatabaseAdapter;
  email: EmailAdapter;
  payment?: PaymentAdapter;
}

// ============================================
// ERROR TYPES
// ============================================

export class AuthError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode: number = 400
  ) {
    super(message);
    this.name = 'AuthError';
  }
}

export class SubscriptionError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode: number = 400
  ) {
    super(message);
    this.name = 'SubscriptionError';
  }
}

export const AuthErrorCodes = {
  USER_EXISTS: 'USER_EXISTS',
  INVALID_CREDENTIALS: 'INVALID_CREDENTIALS',
  USER_NOT_FOUND: 'USER_NOT_FOUND',
  EMAIL_NOT_VERIFIED: 'EMAIL_NOT_VERIFIED',
  INVALID_TOKEN: 'INVALID_TOKEN',
  TOKEN_EXPIRED: 'TOKEN_EXPIRED',
  WEAK_PASSWORD: 'WEAK_PASSWORD',
} as const;

export const SubscriptionErrorCodes = {
  SUBSCRIPTION_NOT_FOUND: 'SUBSCRIPTION_NOT_FOUND',
  SUBSCRIPTION_EXPIRED: 'SUBSCRIPTION_EXPIRED',
  SUBSCRIPTION_CANCELED: 'SUBSCRIPTION_CANCELED',
  ALREADY_SUBSCRIBED: 'ALREADY_SUBSCRIBED',
  INVALID_PLAN: 'INVALID_PLAN',
  PAYMENT_FAILED: 'PAYMENT_FAILED',
  WEBHOOK_VERIFICATION_FAILED: 'WEBHOOK_VERIFICATION_FAILED',
} as const;

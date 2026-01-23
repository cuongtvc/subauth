import {
  SubscriptionError,
  SubscriptionErrorCodes,
  type DatabaseAdapter,
  type PaymentAdapter,
  type SubscriptionConfig,
  type Subscription,
  type Plan,
  type CheckoutSession,
  type WebhookEvent,
  type BillingCycle,
  type SubscriptionStatus,
} from '@subauth/core';

export interface SubscriptionServiceConfig {
  database: DatabaseAdapter;
  payment: PaymentAdapter;
  config: SubscriptionConfig;
}

export interface TrialInfo {
  isTrialing: boolean;
  daysRemaining: number;
  trialEndDate: Date;
}

export class SubscriptionService {
  private db: DatabaseAdapter;
  private payment: PaymentAdapter;
  private config: SubscriptionConfig;

  constructor(serviceConfig: SubscriptionServiceConfig) {
    this.db = serviceConfig.database;
    this.payment = serviceConfig.payment;
    this.config = serviceConfig.config;
  }

  get providerName(): string {
    return this.payment.providerName;
  }

  async createCheckout(params: {
    userId: string;
    email: string;
    priceId: string;
    successUrl: string;
    cancelUrl: string;
    metadata?: Record<string, string>;
  }): Promise<CheckoutSession> {
    // Validate price ID
    if (!this.isPriceValid(params.priceId)) {
      throw new SubscriptionError('Invalid price ID', SubscriptionErrorCodes.INVALID_PLAN, 400);
    }

    // Check if user has active subscription (block if so, unless trialing)
    const existingSub = await this.db.getSubscriptionByUserId(params.userId);
    if (existingSub && existingSub.status === 'active') {
      throw new SubscriptionError(
        'User already has an active subscription',
        SubscriptionErrorCodes.ALREADY_SUBSCRIBED,
        400
      );
    }

    // Create checkout session via payment provider
    return this.payment.createCheckoutSession({
      userId: params.userId,
      email: params.email,
      priceId: params.priceId,
      successUrl: params.successUrl,
      cancelUrl: params.cancelUrl,
      metadata: params.metadata,
    });
  }

  async getSubscription(userId: string): Promise<Subscription | null> {
    return this.db.getSubscriptionByUserId(userId);
  }

  async cancelSubscription(userId: string): Promise<void> {
    const subscription = await this.db.getSubscriptionByUserId(userId);
    if (!subscription) {
      throw new SubscriptionError(
        'Subscription not found',
        SubscriptionErrorCodes.SUBSCRIPTION_NOT_FOUND,
        404
      );
    }

    // Cancel via payment provider
    await this.payment.cancelSubscription(subscription.providerSubscriptionId, true);

    // Update local record
    await this.db.updateSubscription(subscription.id, { cancelAtPeriodEnd: true });
  }

  async resumeSubscription(userId: string): Promise<void> {
    const subscription = await this.db.getSubscriptionByUserId(userId);
    if (!subscription) {
      throw new SubscriptionError(
        'Subscription not found',
        SubscriptionErrorCodes.SUBSCRIPTION_NOT_FOUND,
        404
      );
    }

    // Resume via payment provider if supported
    if (this.payment.resumeSubscription) {
      await this.payment.resumeSubscription(subscription.providerSubscriptionId);
    }

    // Update local record
    await this.db.updateSubscription(subscription.id, { cancelAtPeriodEnd: false });
  }

  async isSubscriptionValid(userId: string): Promise<boolean> {
    const subscription = await this.db.getSubscriptionByUserId(userId);
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

  async hasPlan(userId: string, planId: string): Promise<boolean> {
    const subscription = await this.db.getSubscriptionByUserId(userId);
    if (!subscription) {
      return false;
    }

    const isValid = await this.isSubscriptionValid(userId);
    if (!isValid) {
      return false;
    }

    return subscription.planId === planId;
  }

  async createTrialSubscription(userId: string, planId: string): Promise<Subscription> {
    // Check if user already has subscription
    const existing = await this.db.getSubscriptionByUserId(userId);
    if (existing) {
      throw new SubscriptionError(
        'User already has a subscription',
        SubscriptionErrorCodes.ALREADY_SUBSCRIBED,
        400
      );
    }

    // Validate plan
    const plan = this.getPlan(planId);
    if (!plan) {
      throw new SubscriptionError('Invalid plan', SubscriptionErrorCodes.INVALID_PLAN, 400);
    }

    // Calculate trial end date
    const trialDays = this.config.trialDays ?? 0;
    const trialEndDate = new Date(Date.now() + trialDays * 24 * 60 * 60 * 1000);

    // Get first price for the plan
    const firstPrice = plan.prices[0];

    // Create trial subscription
    const subscription = await this.db.createSubscription({
      userId,
      planId,
      priceId: firstPrice.id,
      status: 'trialing',
      billingCycle: firstPrice.billingCycle,
      currentPeriodStart: new Date(),
      currentPeriodEnd: trialEndDate,
      trialEndDate,
      cancelAtPeriodEnd: false,
      providerSubscriptionId: '',
      providerCustomerId: '',
    });

    return subscription;
  }

  async getTrialInfo(userId: string): Promise<TrialInfo | null> {
    const subscription = await this.db.getSubscriptionByUserId(userId);
    if (!subscription || subscription.status !== 'trialing' || !subscription.trialEndDate) {
      return null;
    }

    const trialEndDate = new Date(subscription.trialEndDate);
    const now = new Date();
    const msRemaining = trialEndDate.getTime() - now.getTime();
    const daysRemaining = Math.max(0, Math.ceil(msRemaining / (24 * 60 * 60 * 1000)));

    return {
      isTrialing: true,
      daysRemaining,
      trialEndDate,
    };
  }

  verifyWebhook(payload: string | Buffer, signature: string): boolean {
    return this.payment.verifyWebhookSignature(payload, signature);
  }

  async handleWebhook(payload: string | Buffer, signature: string): Promise<void> {
    // Verify signature
    if (!this.verifyWebhook(payload, signature)) {
      throw new SubscriptionError(
        'Invalid webhook signature',
        SubscriptionErrorCodes.WEBHOOK_VERIFICATION_FAILED,
        401
      );
    }

    // Parse event
    const event = this.payment.parseWebhookEvent(payload);

    // Handle event by type
    switch (event.type) {
      case 'subscription.created':
        await this.handleSubscriptionCreated(event);
        break;
      case 'subscription.updated':
        await this.handleSubscriptionUpdated(event);
        break;
      case 'subscription.canceled':
        await this.handleSubscriptionCanceled(event);
        break;
      case 'subscription.activated':
        await this.handleSubscriptionUpdated(event);
        break;
      default:
        // Ignore unhandled events
        break;
    }
  }

  private async handleSubscriptionCreated(event: WebhookEvent): Promise<void> {
    const { subscriptionId, customerId, priceId, status, currentPeriodStart, currentPeriodEnd } =
      event.data;

    if (!subscriptionId || !customerId) {
      return;
    }

    // Check if subscription already exists (idempotency)
    const existingSub = await this.db.getSubscriptionByProviderId(subscriptionId);
    if (existingSub) {
      return;
    }

    // Find user by provider customer ID
    const user = await this.db.getUserByProviderCustomerId(customerId);
    if (!user) {
      return;
    }

    // Get plan from price ID
    const plan = priceId ? this.getPlanFromPriceId(priceId) : null;
    const planPrice = plan?.prices.find((p) => p.id === priceId);

    // Create subscription record
    await this.db.createSubscription({
      userId: user.id,
      planId: plan?.id ?? 'unknown',
      priceId: priceId ?? '',
      status: (status as SubscriptionStatus) ?? 'active',
      billingCycle: (planPrice?.billingCycle as BillingCycle) ?? 'monthly',
      currentPeriodStart: currentPeriodStart ? new Date(currentPeriodStart) : new Date(),
      currentPeriodEnd: currentPeriodEnd ? new Date(currentPeriodEnd) : new Date(),
      cancelAtPeriodEnd: false,
      providerSubscriptionId: subscriptionId,
      providerCustomerId: customerId,
    });
  }

  private async handleSubscriptionUpdated(event: WebhookEvent): Promise<void> {
    const { subscriptionId, status, cancelAtPeriodEnd, priceId } = event.data;

    if (!subscriptionId) {
      return;
    }

    const subscription = await this.db.getSubscriptionByProviderId(subscriptionId);
    if (!subscription) {
      return;
    }

    const updates: Partial<Subscription> = {};

    if (status !== undefined) {
      updates.status = status as SubscriptionStatus;
    }

    if (cancelAtPeriodEnd !== undefined) {
      updates.cancelAtPeriodEnd = cancelAtPeriodEnd;
    }

    if (priceId !== undefined) {
      const plan = this.getPlanFromPriceId(priceId);
      if (plan) {
        updates.planId = plan.id;
        updates.priceId = priceId;
      }
    }

    if (Object.keys(updates).length > 0) {
      await this.db.updateSubscription(subscription.id, updates);
    }
  }

  private async handleSubscriptionCanceled(event: WebhookEvent): Promise<void> {
    const { subscriptionId } = event.data;

    if (!subscriptionId) {
      return;
    }

    const subscription = await this.db.getSubscriptionByProviderId(subscriptionId);
    if (!subscription) {
      return;
    }

    await this.db.updateSubscription(subscription.id, { status: 'canceled' });
  }

  getPlans(): Plan[] {
    return this.config.plans;
  }

  getPlan(planId: string): Plan | null {
    return this.config.plans.find((p) => p.id === planId) ?? null;
  }

  isPriceValid(priceId: string): boolean {
    for (const plan of this.config.plans) {
      if (plan.prices.some((p) => p.id === priceId)) {
        return true;
      }
    }
    return false;
  }

  getPlanFromPriceId(priceId: string): Plan | null {
    for (const plan of this.config.plans) {
      if (plan.prices.some((p) => p.id === priceId)) {
        return plan;
      }
    }
    return null;
  }
}

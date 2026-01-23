import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  PaddlePaymentAdapter,
  PaddlePaymentAdapterConfig,
  PaddlePaymentError,
  PaddlePaymentErrorCodes,
} from '../index';
import type { WebhookEvent } from '@authpaddle/core';

// Mock @paddle/paddle-node-sdk module
vi.mock('@paddle/paddle-node-sdk', () => {
  const mockSubscriptionsCancel = vi.fn();
  const mockSubscriptionsUpdate = vi.fn();
  const mockTransactionsCreate = vi.fn();
  const mockWebhooksIsSignatureValid = vi.fn();

  return {
    Paddle: vi.fn(() => ({
      subscriptions: {
        cancel: mockSubscriptionsCancel,
        update: mockSubscriptionsUpdate,
      },
      transactions: {
        create: mockTransactionsCreate,
      },
      webhooks: {
        isSignatureValid: mockWebhooksIsSignatureValid,
      },
    })),
    Environment: {
      sandbox: 'sandbox',
      production: 'production',
    },
  };
});

describe('PaddlePaymentAdapter', () => {
  let adapter: PaddlePaymentAdapter;
  let mockPaddleClient: {
    subscriptions: {
      cancel: ReturnType<typeof vi.fn>;
      update: ReturnType<typeof vi.fn>;
    };
    transactions: {
      create: ReturnType<typeof vi.fn>;
    };
    webhooks: {
      isSignatureValid: ReturnType<typeof vi.fn>;
    };
  };
  const defaultConfig: PaddlePaymentAdapterConfig = {
    apiKey: 'test_api_key_12345',
    environment: 'sandbox',
    webhookSecret: 'whsec_test_secret',
  };

  beforeEach(() => {
    vi.clearAllMocks();

    adapter = new PaddlePaymentAdapter(defaultConfig);

    // Get mock Paddle client reference
    mockPaddleClient = (adapter as any).paddleClient;
  });

  // ============================================
  // CONFIGURATION TESTS
  // ============================================

  describe('Configuration', () => {
    it('should create adapter with minimal config', () => {
      const minimalAdapter = new PaddlePaymentAdapter({
        apiKey: 'api_key_123',
        webhookSecret: 'whsec_123',
      });

      expect(minimalAdapter).toBeInstanceOf(PaddlePaymentAdapter);
    });

    it('should create adapter with full config', () => {
      const fullAdapter = new PaddlePaymentAdapter({
        apiKey: 'api_key_123',
        environment: 'production',
        webhookSecret: 'whsec_123',
        checkoutBaseUrl: 'https://checkout.example.com',
      });

      expect(fullAdapter).toBeInstanceOf(PaddlePaymentAdapter);
    });

    it('should default to sandbox environment when not specified', () => {
      const sandboxAdapter = new PaddlePaymentAdapter({
        apiKey: 'api_key_123',
        webhookSecret: 'whsec_123',
      });

      expect(sandboxAdapter).toBeInstanceOf(PaddlePaymentAdapter);
      // Environment should be sandbox by default
      expect((sandboxAdapter as any).config.environment).toBe('sandbox');
    });

    it('should throw PaddlePaymentError when apiKey is missing', () => {
      expect(
        () =>
          new PaddlePaymentAdapter({
            apiKey: '',
            webhookSecret: 'whsec_123',
          })
      ).toThrow(PaddlePaymentError);

      expect(
        () =>
          new PaddlePaymentAdapter({
            apiKey: '',
            webhookSecret: 'whsec_123',
          })
      ).toThrow('Paddle API key is required');
    });

    it('should throw PaddlePaymentError when webhookSecret is missing', () => {
      expect(
        () =>
          new PaddlePaymentAdapter({
            apiKey: 'api_key_123',
            webhookSecret: '',
          })
      ).toThrow(PaddlePaymentError);

      expect(
        () =>
          new PaddlePaymentAdapter({
            apiKey: 'api_key_123',
            webhookSecret: '',
          })
      ).toThrow('Paddle webhook secret is required');
    });

    it('should have providerName set to "paddle"', () => {
      expect(adapter.providerName).toBe('paddle');
    });
  });

  // ============================================
  // CREATE CHECKOUT SESSION TESTS
  // ============================================

  describe('createCheckoutSession', () => {
    it('should create checkout session with required parameters', async () => {
      mockPaddleClient.transactions.create.mockResolvedValueOnce({
        id: 'txn_01h1234567890',
        checkout: {
          url: 'https://checkout.paddle.com/checkout/01h1234567890',
        },
      });

      const result = await adapter.createCheckoutSession({
        userId: 'user_123',
        email: 'user@example.com',
        priceId: 'pri_01h1234567890',
        successUrl: 'https://app.com/success',
        cancelUrl: 'https://app.com/cancel',
      });

      expect(result).toEqual({
        url: 'https://checkout.paddle.com/checkout/01h1234567890',
        sessionId: 'txn_01h1234567890',
      });

      expect(mockPaddleClient.transactions.create).toHaveBeenCalledWith({
        items: [
          {
            priceId: 'pri_01h1234567890',
            quantity: 1,
          },
        ],
        customData: {
          userId: 'user_123',
          email: 'user@example.com',
        },
        checkout: {
          url: 'https://app.com/success',
        },
      });
    });

    it('should include metadata in custom_data when provided', async () => {
      mockPaddleClient.transactions.create.mockResolvedValueOnce({
        id: 'txn_01h1234567890',
        checkout: {
          url: 'https://checkout.paddle.com/checkout/01h1234567890',
        },
      });

      await adapter.createCheckoutSession({
        userId: 'user_123',
        email: 'user@example.com',
        priceId: 'pri_01h1234567890',
        successUrl: 'https://app.com/success',
        cancelUrl: 'https://app.com/cancel',
        metadata: {
          planId: 'plan_pro',
          source: 'upgrade_modal',
        },
      });

      expect(mockPaddleClient.transactions.create).toHaveBeenCalledWith(
        expect.objectContaining({
          customData: {
            userId: 'user_123',
            email: 'user@example.com',
            planId: 'plan_pro',
            source: 'upgrade_modal',
          },
        })
      );
    });

    it('should throw PaddlePaymentError when Paddle API fails', async () => {
      mockPaddleClient.transactions.create.mockRejectedValueOnce(
        new Error('Paddle API error')
      );

      await expect(
        adapter.createCheckoutSession({
          userId: 'user_123',
          email: 'user@example.com',
          priceId: 'pri_01h1234567890',
          successUrl: 'https://app.com/success',
          cancelUrl: 'https://app.com/cancel',
        })
      ).rejects.toThrow(PaddlePaymentError);
    });

    it('should throw PaddlePaymentError with CHECKOUT_FAILED code on failure', async () => {
      mockPaddleClient.transactions.create.mockRejectedValueOnce(
        new Error('Invalid price ID')
      );

      try {
        await adapter.createCheckoutSession({
          userId: 'user_123',
          email: 'user@example.com',
          priceId: 'invalid_price',
          successUrl: 'https://app.com/success',
          cancelUrl: 'https://app.com/cancel',
        });
        expect.fail('Should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(PaddlePaymentError);
        expect((error as PaddlePaymentError).code).toBe(
          PaddlePaymentErrorCodes.CHECKOUT_FAILED
        );
      }
    });

    it('should use custom checkoutBaseUrl when configured', async () => {
      const customUrlAdapter = new PaddlePaymentAdapter({
        apiKey: 'api_key_123',
        webhookSecret: 'whsec_123',
        checkoutBaseUrl: 'https://custom-checkout.example.com',
      });

      const mockClient = (customUrlAdapter as any).paddleClient;
      mockClient.transactions.create.mockResolvedValueOnce({
        id: 'txn_01h1234567890',
        checkout: {
          url: 'https://custom-checkout.example.com/checkout/01h1234567890',
        },
      });

      const result = await customUrlAdapter.createCheckoutSession({
        userId: 'user_123',
        email: 'user@example.com',
        priceId: 'pri_01h1234567890',
        successUrl: 'https://app.com/success',
        cancelUrl: 'https://app.com/cancel',
      });

      expect(result.url).toContain('custom-checkout.example.com');
    });
  });

  // ============================================
  // CANCEL SUBSCRIPTION TESTS
  // ============================================

  describe('cancelSubscription', () => {
    it('should cancel subscription immediately by default', async () => {
      mockPaddleClient.subscriptions.cancel.mockResolvedValueOnce({});

      await adapter.cancelSubscription('sub_01h1234567890');

      expect(mockPaddleClient.subscriptions.cancel).toHaveBeenCalledWith(
        'sub_01h1234567890',
        { effectiveFrom: 'immediately' }
      );
    });

    it('should cancel subscription at period end when cancelAtPeriodEnd is true', async () => {
      mockPaddleClient.subscriptions.cancel.mockResolvedValueOnce({});

      await adapter.cancelSubscription('sub_01h1234567890', true);

      expect(mockPaddleClient.subscriptions.cancel).toHaveBeenCalledWith(
        'sub_01h1234567890',
        { effectiveFrom: 'next_billing_period' }
      );
    });

    it('should throw PaddlePaymentError when cancellation fails', async () => {
      mockPaddleClient.subscriptions.cancel.mockRejectedValueOnce(
        new Error('Subscription not found')
      );

      await expect(
        adapter.cancelSubscription('sub_invalid')
      ).rejects.toThrow(PaddlePaymentError);
    });

    it('should throw with SUBSCRIPTION_CANCEL_FAILED code on failure', async () => {
      mockPaddleClient.subscriptions.cancel.mockRejectedValueOnce(
        new Error('Cannot cancel')
      );

      try {
        await adapter.cancelSubscription('sub_01h1234567890');
        expect.fail('Should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(PaddlePaymentError);
        expect((error as PaddlePaymentError).code).toBe(
          PaddlePaymentErrorCodes.SUBSCRIPTION_CANCEL_FAILED
        );
      }
    });
  });

  // ============================================
  // RESUME SUBSCRIPTION TESTS
  // ============================================

  describe('resumeSubscription', () => {
    it('should resume subscription by clearing scheduled change', async () => {
      mockPaddleClient.subscriptions.update.mockResolvedValueOnce({});

      await adapter.resumeSubscription!('sub_01h1234567890');

      expect(mockPaddleClient.subscriptions.update).toHaveBeenCalledWith(
        'sub_01h1234567890',
        { scheduledChange: null }
      );
    });

    it('should throw PaddlePaymentError when resume fails', async () => {
      mockPaddleClient.subscriptions.update.mockRejectedValueOnce(
        new Error('Cannot resume')
      );

      await expect(
        adapter.resumeSubscription!('sub_01h1234567890')
      ).rejects.toThrow(PaddlePaymentError);
    });

    it('should throw with SUBSCRIPTION_RESUME_FAILED code on failure', async () => {
      mockPaddleClient.subscriptions.update.mockRejectedValueOnce(
        new Error('Resume error')
      );

      try {
        await adapter.resumeSubscription!('sub_01h1234567890');
        expect.fail('Should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(PaddlePaymentError);
        expect((error as PaddlePaymentError).code).toBe(
          PaddlePaymentErrorCodes.SUBSCRIPTION_RESUME_FAILED
        );
      }
    });
  });

  // ============================================
  // UPDATE SUBSCRIPTION TESTS
  // ============================================

  describe('updateSubscription', () => {
    it('should update subscription with new price ID', async () => {
      mockPaddleClient.subscriptions.update.mockResolvedValueOnce({});

      await adapter.updateSubscription!('sub_01h1234567890', 'pri_new_price');

      expect(mockPaddleClient.subscriptions.update).toHaveBeenCalledWith(
        'sub_01h1234567890',
        {
          items: [
            {
              priceId: 'pri_new_price',
              quantity: 1,
            },
          ],
          prorationBillingMode: 'prorated_immediately',
        }
      );
    });

    it('should throw PaddlePaymentError when update fails', async () => {
      mockPaddleClient.subscriptions.update.mockRejectedValueOnce(
        new Error('Invalid price')
      );

      await expect(
        adapter.updateSubscription!('sub_01h1234567890', 'pri_invalid')
      ).rejects.toThrow(PaddlePaymentError);
    });

    it('should throw with SUBSCRIPTION_UPDATE_FAILED code on failure', async () => {
      mockPaddleClient.subscriptions.update.mockRejectedValueOnce(
        new Error('Update error')
      );

      try {
        await adapter.updateSubscription!('sub_01h1234567890', 'pri_new');
        expect.fail('Should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(PaddlePaymentError);
        expect((error as PaddlePaymentError).code).toBe(
          PaddlePaymentErrorCodes.SUBSCRIPTION_UPDATE_FAILED
        );
      }
    });
  });

  // ============================================
  // WEBHOOK SIGNATURE VERIFICATION TESTS
  // ============================================

  describe('verifyWebhookSignature', () => {
    it('should return true for valid signature', () => {
      mockPaddleClient.webhooks.isSignatureValid.mockReturnValueOnce(true);

      const payload = JSON.stringify({ event_type: 'subscription.created' });
      const signature = 'ts=1234567890;h1=abc123def456';

      const result = adapter.verifyWebhookSignature(payload, signature);

      expect(result).toBe(true);
      expect(mockPaddleClient.webhooks.isSignatureValid).toHaveBeenCalledWith(
        payload,
        'whsec_test_secret',
        signature
      );
    });

    it('should return false for invalid signature', () => {
      mockPaddleClient.webhooks.isSignatureValid.mockReturnValueOnce(false);

      const payload = JSON.stringify({ event_type: 'subscription.created' });
      const signature = 'invalid_signature';

      const result = adapter.verifyWebhookSignature(payload, signature);

      expect(result).toBe(false);
    });

    it('should handle Buffer payload', () => {
      mockPaddleClient.webhooks.isSignatureValid.mockReturnValueOnce(true);

      const payload = Buffer.from(
        JSON.stringify({ event_type: 'subscription.created' })
      );
      const signature = 'ts=1234567890;h1=abc123def456';

      const result = adapter.verifyWebhookSignature(payload, signature);

      expect(result).toBe(true);
      expect(mockPaddleClient.webhooks.isSignatureValid).toHaveBeenCalledWith(
        payload.toString('utf8'),
        'whsec_test_secret',
        signature
      );
    });

    it('should return false when signature verification throws', () => {
      mockPaddleClient.webhooks.isSignatureValid.mockImplementationOnce(() => {
        throw new Error('Verification failed');
      });

      const payload = JSON.stringify({ event_type: 'subscription.created' });
      const signature = 'malformed_signature';

      const result = adapter.verifyWebhookSignature(payload, signature);

      expect(result).toBe(false);
    });
  });

  // ============================================
  // WEBHOOK EVENT PARSING TESTS
  // ============================================

  describe('parseWebhookEvent', () => {
    it('should parse subscription.created event', () => {
      const paddleEvent = {
        event_type: 'subscription.created',
        data: {
          id: 'sub_01h1234567890',
          customer_id: 'ctm_01h1234567890',
          status: 'active',
          items: [
            {
              price: {
                id: 'pri_01h1234567890',
              },
            },
          ],
          current_billing_period: {
            starts_at: '2024-01-01T00:00:00Z',
            ends_at: '2024-02-01T00:00:00Z',
          },
          scheduled_change: null,
          custom_data: {
            email: 'user@example.com',
            userId: 'user_123',
          },
        },
      };

      const result = adapter.parseWebhookEvent(JSON.stringify(paddleEvent));

      expect(result.type).toBe('subscription.created');
      expect(result.provider).toBe('paddle');
      expect(result.data.subscriptionId).toBe('sub_01h1234567890');
      expect(result.data.customerId).toBe('ctm_01h1234567890');
      expect(result.data.status).toBe('active');
      expect(result.data.priceId).toBe('pri_01h1234567890');
      expect(result.data.email).toBe('user@example.com');
      expect(result.data.currentPeriodStart).toBeInstanceOf(Date);
      expect(result.data.currentPeriodEnd).toBeInstanceOf(Date);
      expect(result.data.cancelAtPeriodEnd).toBe(false);
      expect(result.rawEvent).toEqual(paddleEvent);
    });

    it('should parse subscription.updated event', () => {
      const paddleEvent = {
        event_type: 'subscription.updated',
        data: {
          id: 'sub_01h1234567890',
          customer_id: 'ctm_01h1234567890',
          status: 'active',
          items: [
            {
              price: {
                id: 'pri_01h1234567890',
              },
            },
          ],
          current_billing_period: {
            starts_at: '2024-01-01T00:00:00Z',
            ends_at: '2024-02-01T00:00:00Z',
          },
          scheduled_change: {
            action: 'cancel',
          },
        },
      };

      const result = adapter.parseWebhookEvent(JSON.stringify(paddleEvent));

      expect(result.type).toBe('subscription.updated');
      expect(result.data.cancelAtPeriodEnd).toBe(true);
    });

    it('should parse subscription.canceled event', () => {
      const paddleEvent = {
        event_type: 'subscription.canceled',
        data: {
          id: 'sub_01h1234567890',
          customer_id: 'ctm_01h1234567890',
          status: 'canceled',
          items: [
            {
              price: {
                id: 'pri_01h1234567890',
              },
            },
          ],
          current_billing_period: {
            starts_at: '2024-01-01T00:00:00Z',
            ends_at: '2024-02-01T00:00:00Z',
          },
        },
      };

      const result = adapter.parseWebhookEvent(JSON.stringify(paddleEvent));

      expect(result.type).toBe('subscription.canceled');
      expect(result.data.status).toBe('canceled');
    });

    it('should parse subscription.activated event', () => {
      const paddleEvent = {
        event_type: 'subscription.activated',
        data: {
          id: 'sub_01h1234567890',
          customer_id: 'ctm_01h1234567890',
          status: 'active',
          items: [
            {
              price: {
                id: 'pri_01h1234567890',
              },
            },
          ],
          current_billing_period: {
            starts_at: '2024-01-01T00:00:00Z',
            ends_at: '2024-02-01T00:00:00Z',
          },
        },
      };

      const result = adapter.parseWebhookEvent(JSON.stringify(paddleEvent));

      expect(result.type).toBe('subscription.activated');
    });

    it('should parse subscription.past_due event', () => {
      const paddleEvent = {
        event_type: 'subscription.past_due',
        data: {
          id: 'sub_01h1234567890',
          customer_id: 'ctm_01h1234567890',
          status: 'past_due',
          items: [
            {
              price: {
                id: 'pri_01h1234567890',
              },
            },
          ],
          current_billing_period: {
            starts_at: '2024-01-01T00:00:00Z',
            ends_at: '2024-02-01T00:00:00Z',
          },
        },
      };

      const result = adapter.parseWebhookEvent(JSON.stringify(paddleEvent));

      expect(result.type).toBe('subscription.past_due');
      expect(result.data.status).toBe('past_due');
    });

    it('should parse subscription.paused event', () => {
      const paddleEvent = {
        event_type: 'subscription.paused',
        data: {
          id: 'sub_01h1234567890',
          customer_id: 'ctm_01h1234567890',
          status: 'paused',
          items: [
            {
              price: {
                id: 'pri_01h1234567890',
              },
            },
          ],
          current_billing_period: {
            starts_at: '2024-01-01T00:00:00Z',
            ends_at: '2024-02-01T00:00:00Z',
          },
        },
      };

      const result = adapter.parseWebhookEvent(JSON.stringify(paddleEvent));

      expect(result.type).toBe('subscription.paused');
      expect(result.data.status).toBe('paused');
    });

    it('should parse transaction.completed event', () => {
      const paddleEvent = {
        event_type: 'transaction.completed',
        data: {
          id: 'txn_01h1234567890',
          subscription_id: 'sub_01h1234567890',
          customer_id: 'ctm_01h1234567890',
          details: {
            totals: {
              total: '999',
            },
          },
          currency_code: 'USD',
          custom_data: {
            email: 'user@example.com',
          },
        },
      };

      const result = adapter.parseWebhookEvent(JSON.stringify(paddleEvent));

      expect(result.type).toBe('transaction.completed');
      expect(result.data.transactionId).toBe('txn_01h1234567890');
      expect(result.data.subscriptionId).toBe('sub_01h1234567890');
      expect(result.data.amount).toBe(999);
      expect(result.data.currency).toBe('USD');
    });

    it('should parse transaction.failed event', () => {
      const paddleEvent = {
        event_type: 'transaction.payment_failed',
        data: {
          id: 'txn_01h1234567890',
          subscription_id: 'sub_01h1234567890',
          customer_id: 'ctm_01h1234567890',
          details: {
            totals: {
              total: '999',
            },
          },
          currency_code: 'USD',
        },
      };

      const result = adapter.parseWebhookEvent(JSON.stringify(paddleEvent));

      expect(result.type).toBe('transaction.failed');
    });

    it('should parse transaction.refunded event', () => {
      const paddleEvent = {
        event_type: 'adjustment.created',
        data: {
          id: 'adj_01h1234567890',
          transaction_id: 'txn_01h1234567890',
          action: 'refund',
          totals: {
            total: '-999',
          },
          currency_code: 'USD',
        },
      };

      const result = adapter.parseWebhookEvent(JSON.stringify(paddleEvent));

      expect(result.type).toBe('transaction.refunded');
      expect(result.data.transactionId).toBe('txn_01h1234567890');
    });

    it('should handle Buffer payload', () => {
      const paddleEvent = {
        event_type: 'subscription.created',
        data: {
          id: 'sub_01h1234567890',
          customer_id: 'ctm_01h1234567890',
          status: 'active',
          items: [{ price: { id: 'pri_01h1234567890' } }],
          current_billing_period: {
            starts_at: '2024-01-01T00:00:00Z',
            ends_at: '2024-02-01T00:00:00Z',
          },
        },
      };

      const result = adapter.parseWebhookEvent(
        Buffer.from(JSON.stringify(paddleEvent))
      );

      expect(result.type).toBe('subscription.created');
    });

    it('should throw PaddlePaymentError for invalid JSON', () => {
      expect(() => adapter.parseWebhookEvent('invalid json')).toThrow(
        PaddlePaymentError
      );
    });

    it('should throw with WEBHOOK_PARSE_FAILED code for invalid JSON', () => {
      try {
        adapter.parseWebhookEvent('not valid json');
        expect.fail('Should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(PaddlePaymentError);
        expect((error as PaddlePaymentError).code).toBe(
          PaddlePaymentErrorCodes.WEBHOOK_PARSE_FAILED
        );
      }
    });

    it('should throw PaddlePaymentError for unsupported event type', () => {
      const paddleEvent = {
        event_type: 'unknown.event',
        data: {},
      };

      expect(() =>
        adapter.parseWebhookEvent(JSON.stringify(paddleEvent))
      ).toThrow(PaddlePaymentError);
    });

    it('should include metadata from custom_data', () => {
      const paddleEvent = {
        event_type: 'subscription.created',
        data: {
          id: 'sub_01h1234567890',
          customer_id: 'ctm_01h1234567890',
          status: 'active',
          items: [{ price: { id: 'pri_01h1234567890' } }],
          current_billing_period: {
            starts_at: '2024-01-01T00:00:00Z',
            ends_at: '2024-02-01T00:00:00Z',
          },
          custom_data: {
            userId: 'user_123',
            email: 'user@example.com',
            planId: 'plan_pro',
          },
        },
      };

      const result = adapter.parseWebhookEvent(JSON.stringify(paddleEvent));

      expect(result.data.metadata).toEqual({
        userId: 'user_123',
        email: 'user@example.com',
        planId: 'plan_pro',
      });
    });

    it('should handle missing optional fields gracefully', () => {
      const paddleEvent = {
        event_type: 'subscription.created',
        data: {
          id: 'sub_01h1234567890',
          customer_id: 'ctm_01h1234567890',
          status: 'active',
          items: [{ price: { id: 'pri_01h1234567890' } }],
          // Missing current_billing_period, custom_data, etc.
        },
      };

      const result = adapter.parseWebhookEvent(JSON.stringify(paddleEvent));

      expect(result.type).toBe('subscription.created');
      expect(result.data.currentPeriodStart).toBeUndefined();
      expect(result.data.currentPeriodEnd).toBeUndefined();
      expect(result.data.email).toBeUndefined();
    });
  });

  // ============================================
  // STATUS MAPPING TESTS
  // ============================================

  describe('Status Mapping', () => {
    it('should map Paddle "trialing" status to core "trialing"', () => {
      const paddleEvent = {
        event_type: 'subscription.created',
        data: {
          id: 'sub_01h1234567890',
          customer_id: 'ctm_01h1234567890',
          status: 'trialing',
          items: [{ price: { id: 'pri_01h1234567890' } }],
          current_billing_period: {
            starts_at: '2024-01-01T00:00:00Z',
            ends_at: '2024-02-01T00:00:00Z',
          },
        },
      };

      const result = adapter.parseWebhookEvent(JSON.stringify(paddleEvent));

      expect(result.data.status).toBe('trialing');
    });

    it('should map Paddle "active" status to core "active"', () => {
      const paddleEvent = {
        event_type: 'subscription.created',
        data: {
          id: 'sub_01h1234567890',
          customer_id: 'ctm_01h1234567890',
          status: 'active',
          items: [{ price: { id: 'pri_01h1234567890' } }],
          current_billing_period: {
            starts_at: '2024-01-01T00:00:00Z',
            ends_at: '2024-02-01T00:00:00Z',
          },
        },
      };

      const result = adapter.parseWebhookEvent(JSON.stringify(paddleEvent));

      expect(result.data.status).toBe('active');
    });

    it('should map Paddle "canceled" status to core "canceled"', () => {
      const paddleEvent = {
        event_type: 'subscription.canceled',
        data: {
          id: 'sub_01h1234567890',
          customer_id: 'ctm_01h1234567890',
          status: 'canceled',
          items: [{ price: { id: 'pri_01h1234567890' } }],
          current_billing_period: {
            starts_at: '2024-01-01T00:00:00Z',
            ends_at: '2024-02-01T00:00:00Z',
          },
        },
      };

      const result = adapter.parseWebhookEvent(JSON.stringify(paddleEvent));

      expect(result.data.status).toBe('canceled');
    });

    it('should map Paddle "past_due" status to core "past_due"', () => {
      const paddleEvent = {
        event_type: 'subscription.past_due',
        data: {
          id: 'sub_01h1234567890',
          customer_id: 'ctm_01h1234567890',
          status: 'past_due',
          items: [{ price: { id: 'pri_01h1234567890' } }],
          current_billing_period: {
            starts_at: '2024-01-01T00:00:00Z',
            ends_at: '2024-02-01T00:00:00Z',
          },
        },
      };

      const result = adapter.parseWebhookEvent(JSON.stringify(paddleEvent));

      expect(result.data.status).toBe('past_due');
    });

    it('should map Paddle "paused" status to core "paused"', () => {
      const paddleEvent = {
        event_type: 'subscription.paused',
        data: {
          id: 'sub_01h1234567890',
          customer_id: 'ctm_01h1234567890',
          status: 'paused',
          items: [{ price: { id: 'pri_01h1234567890' } }],
          current_billing_period: {
            starts_at: '2024-01-01T00:00:00Z',
            ends_at: '2024-02-01T00:00:00Z',
          },
        },
      };

      const result = adapter.parseWebhookEvent(JSON.stringify(paddleEvent));

      expect(result.data.status).toBe('paused');
    });
  });

  // ============================================
  // ERROR HANDLING TESTS
  // ============================================

  describe('Error Handling', () => {
    it('PaddlePaymentError should have correct name property', () => {
      const error = new PaddlePaymentError(
        'Test error',
        PaddlePaymentErrorCodes.API_ERROR
      );
      expect(error.name).toBe('PaddlePaymentError');
    });

    it('PaddlePaymentError should have code property', () => {
      const error = new PaddlePaymentError(
        'Test error',
        PaddlePaymentErrorCodes.INVALID_CONFIG
      );
      expect(error.code).toBe(PaddlePaymentErrorCodes.INVALID_CONFIG);
    });

    it('PaddlePaymentError should have optional originalError property', () => {
      const original = new Error('Original');
      const error = new PaddlePaymentError(
        'Test error',
        PaddlePaymentErrorCodes.API_ERROR,
        original
      );
      expect(error.originalError).toBe(original);
    });

    it('PaddlePaymentError should be instanceof Error', () => {
      const error = new PaddlePaymentError(
        'Test',
        PaddlePaymentErrorCodes.API_ERROR
      );
      expect(error).toBeInstanceOf(Error);
    });
  });

  // ============================================
  // PAYMENTADAPTER INTERFACE COMPLIANCE TESTS
  // ============================================

  describe('PaymentAdapter Interface Compliance', () => {
    it('should have providerName property', () => {
      expect(typeof adapter.providerName).toBe('string');
      expect(adapter.providerName).toBe('paddle');
    });

    it('should implement createCheckoutSession method', () => {
      expect(typeof adapter.createCheckoutSession).toBe('function');
    });

    it('should implement cancelSubscription method', () => {
      expect(typeof adapter.cancelSubscription).toBe('function');
    });

    it('should implement optional resumeSubscription method', () => {
      expect(typeof adapter.resumeSubscription).toBe('function');
    });

    it('should implement optional updateSubscription method', () => {
      expect(typeof adapter.updateSubscription).toBe('function');
    });

    it('should implement verifyWebhookSignature method', () => {
      expect(typeof adapter.verifyWebhookSignature).toBe('function');
    });

    it('should implement parseWebhookEvent method', () => {
      expect(typeof adapter.parseWebhookEvent).toBe('function');
    });

    it('createCheckoutSession should return Promise<CheckoutSession>', async () => {
      mockPaddleClient.transactions.create.mockResolvedValueOnce({
        id: 'txn_01h1234567890',
        checkout: {
          url: 'https://checkout.paddle.com/checkout/01h1234567890',
        },
      });

      const result = await adapter.createCheckoutSession({
        userId: 'user_123',
        email: 'user@example.com',
        priceId: 'pri_01h1234567890',
        successUrl: 'https://app.com/success',
        cancelUrl: 'https://app.com/cancel',
      });

      expect(result).toHaveProperty('url');
      expect(result).toHaveProperty('sessionId');
    });

    it('cancelSubscription should return Promise<void>', async () => {
      mockPaddleClient.subscriptions.cancel.mockResolvedValueOnce({});

      const result = await adapter.cancelSubscription('sub_01h1234567890');

      expect(result).toBeUndefined();
    });

    it('verifyWebhookSignature should return boolean', () => {
      mockPaddleClient.webhooks.isSignatureValid.mockReturnValueOnce(true);

      const result = adapter.verifyWebhookSignature('payload', 'signature');

      expect(typeof result).toBe('boolean');
    });

    it('parseWebhookEvent should return WebhookEvent', () => {
      const paddleEvent = {
        event_type: 'subscription.created',
        data: {
          id: 'sub_01h1234567890',
          customer_id: 'ctm_01h1234567890',
          status: 'active',
          items: [{ price: { id: 'pri_01h1234567890' } }],
          current_billing_period: {
            starts_at: '2024-01-01T00:00:00Z',
            ends_at: '2024-02-01T00:00:00Z',
          },
        },
      };

      const result = adapter.parseWebhookEvent(JSON.stringify(paddleEvent));

      expect(result).toHaveProperty('type');
      expect(result).toHaveProperty('provider');
      expect(result).toHaveProperty('data');
      expect(result).toHaveProperty('rawEvent');
    });
  });
});

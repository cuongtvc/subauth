import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  SESEmailAdapter,
  SESEmailAdapterConfig,
  SESEmailError,
  SESEmailErrorCodes,
  VerificationEmailContext,
  PasswordResetEmailContext,
  SubscriptionConfirmationEmailContext,
  SubscriptionCanceledEmailContext,
} from '../index';
import type { Subscription } from '@authpaddle/core';

// Mock @aws-sdk/client-ses module
vi.mock('@aws-sdk/client-ses', () => {
  const mockSend = vi.fn();
  const mockDestroy = vi.fn();

  return {
    SESClient: vi.fn(() => ({
      send: mockSend,
      destroy: mockDestroy,
    })),
    SendEmailCommand: vi.fn((params) => params),
  };
});

describe('SESEmailAdapter', () => {
  let adapter: SESEmailAdapter;
  let mockSESClient: { send: ReturnType<typeof vi.fn>; destroy: ReturnType<typeof vi.fn> };
  const defaultConfig: SESEmailAdapterConfig = {
    region: 'us-east-1',
    fromEmail: 'noreply@example.com',
    appName: 'TestApp',
  };

  beforeEach(() => {
    vi.clearAllMocks();

    adapter = new SESEmailAdapter(defaultConfig);

    // Get mock SES client reference
    mockSESClient = (adapter as any).sesClient;
  });

  // ============================================
  // CONFIGURATION TESTS
  // ============================================

  describe('Configuration', () => {
    it('should create adapter with minimal config', () => {
      const minimalAdapter = new SESEmailAdapter({
        region: 'us-west-2',
        fromEmail: 'test@domain.com',
      });

      expect(minimalAdapter).toBeInstanceOf(SESEmailAdapter);
    });

    it('should create adapter with full config including credentials', () => {
      const fullAdapter = new SESEmailAdapter({
        region: 'eu-west-1',
        fromEmail: 'test@domain.com',
        accessKeyId: 'AKIA...',
        secretAccessKey: 'secret...',
        appName: 'MyApp',
      });

      expect(fullAdapter).toBeInstanceOf(SESEmailAdapter);
    });

    it('should use default appName when not provided', async () => {
      const noAppNameAdapter = new SESEmailAdapter({
        region: 'us-east-1',
        fromEmail: 'noreply@test.com',
      });

      const mockClient = (noAppNameAdapter as any).sesClient;
      mockClient.send.mockResolvedValueOnce({});

      await noAppNameAdapter.sendVerificationEmail(
        'user@test.com',
        'token123',
        'https://app.com/verify/token123'
      );

      // The email should still be sent with default app name in subject
      expect(mockClient.send).toHaveBeenCalled();
    });

    it('should throw SESEmailError when region is missing', () => {
      expect(() => new SESEmailAdapter({
        region: '',
        fromEmail: 'test@domain.com',
      })).toThrow(SESEmailError);

      expect(() => new SESEmailAdapter({
        region: '',
        fromEmail: 'test@domain.com',
      })).toThrow('AWS region is required');
    });

    it('should throw SESEmailError when fromEmail is missing', () => {
      expect(() => new SESEmailAdapter({
        region: 'us-east-1',
        fromEmail: '',
      })).toThrow(SESEmailError);

      expect(() => new SESEmailAdapter({
        region: 'us-east-1',
        fromEmail: '',
      })).toThrow('From email address is required');
    });

    it('should create adapter with custom endpoint for localstack', () => {
      const localstackAdapter = new SESEmailAdapter({
        region: 'us-east-1',
        fromEmail: 'test@domain.com',
        endpoint: 'http://localhost:4566',
      });

      expect(localstackAdapter).toBeInstanceOf(SESEmailAdapter);
    });

    it('should create adapter with replyToEmail', () => {
      const replyToAdapter = new SESEmailAdapter({
        region: 'us-east-1',
        fromEmail: 'noreply@domain.com',
        replyToEmail: 'support@domain.com',
      });

      expect(replyToAdapter).toBeInstanceOf(SESEmailAdapter);
    });
  });

  // ============================================
  // DESTROY METHOD TESTS
  // ============================================

  describe('destroy', () => {
    it('should call destroy on SES client', () => {
      adapter.destroy();

      expect(mockSESClient.destroy).toHaveBeenCalled();
    });
  });

  // ============================================
  // REPLY-TO TESTS
  // ============================================

  describe('Reply-To Configuration', () => {
    it('should include ReplyToAddresses when replyToEmail is set', async () => {
      const replyToAdapter = new SESEmailAdapter({
        region: 'us-east-1',
        fromEmail: 'noreply@domain.com',
        replyToEmail: 'support@domain.com',
      });

      const mockClient = (replyToAdapter as any).sesClient;
      mockClient.send.mockResolvedValueOnce({});

      await replyToAdapter.sendVerificationEmail(
        'user@test.com',
        'token',
        'https://url'
      );

      const sentCommand = mockClient.send.mock.calls[0][0];
      expect(sentCommand.ReplyToAddresses).toEqual(['support@domain.com']);
    });

    it('should not include ReplyToAddresses when replyToEmail is not set', async () => {
      mockSESClient.send.mockResolvedValueOnce({});

      await adapter.sendVerificationEmail(
        'user@test.com',
        'token',
        'https://url'
      );

      const sentCommand = mockSESClient.send.mock.calls[0][0];
      expect(sentCommand.ReplyToAddresses).toBeUndefined();
    });
  });

  // ============================================
  // CUSTOM TEMPLATES TESTS
  // ============================================

  describe('Custom Templates', () => {
    it('should use custom verification template when provided', async () => {
      const customTemplate = (context: VerificationEmailContext) => ({
        subject: `Custom Verify - ${context.appName}`,
        html: `<h1>Custom HTML ${context.verifyUrl}</h1>`,
        text: `Custom Text ${context.verifyUrl}`,
      });

      const customAdapter = new SESEmailAdapter({
        region: 'us-east-1',
        fromEmail: 'noreply@test.com',
        appName: 'CustomApp',
        templates: {
          verification: customTemplate,
        },
      });

      const mockClient = (customAdapter as any).sesClient;
      mockClient.send.mockResolvedValueOnce({});

      await customAdapter.sendVerificationEmail(
        'user@test.com',
        'token123',
        'https://app.com/verify/token123'
      );

      const sentCommand = mockClient.send.mock.calls[0][0];
      expect(sentCommand.Message.Subject.Data).toBe('Custom Verify - CustomApp');
      expect(sentCommand.Message.Body.Html.Data).toContain('Custom HTML');
      expect(sentCommand.Message.Body.Text.Data).toContain('Custom Text');
    });

    it('should use custom password reset template when provided', async () => {
      const customTemplate = (context: PasswordResetEmailContext) => ({
        subject: `Custom Reset - ${context.appName}`,
        html: `<h1>Reset at ${context.resetUrl}</h1>`,
        text: `Reset at ${context.resetUrl}`,
      });

      const customAdapter = new SESEmailAdapter({
        region: 'us-east-1',
        fromEmail: 'noreply@test.com',
        templates: {
          passwordReset: customTemplate,
        },
      });

      const mockClient = (customAdapter as any).sesClient;
      mockClient.send.mockResolvedValueOnce({});

      await customAdapter.sendPasswordResetEmail(
        'user@test.com',
        'token123',
        'https://app.com/reset/token123'
      );

      const sentCommand = mockClient.send.mock.calls[0][0];
      expect(sentCommand.Message.Subject.Data).toContain('Custom Reset');
    });

    it('should use custom subscription confirmation template when provided', async () => {
      const customTemplate = (context: SubscriptionConfirmationEmailContext) => ({
        subject: `Welcome to ${context.appName}!`,
        html: `<h1>Plan: ${context.subscription.planId}</h1>`,
        text: `Plan: ${context.subscription.planId}`,
      });

      const customAdapter = new SESEmailAdapter({
        region: 'us-east-1',
        fromEmail: 'noreply@test.com',
        appName: 'MyApp',
        templates: {
          subscriptionConfirmation: customTemplate,
        },
      });

      const mockClient = (customAdapter as any).sesClient;
      mockClient.send.mockResolvedValueOnce({});

      const subscription: Subscription = {
        id: 'sub_1',
        userId: 'user_1',
        planId: 'plan_premium',
        priceId: 'price_1',
        status: 'active',
        billingCycle: 'monthly',
        currentPeriodStart: new Date(),
        currentPeriodEnd: new Date(),
        cancelAtPeriodEnd: false,
        providerSubscriptionId: 'sub_123',
        providerCustomerId: 'cus_123',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      await customAdapter.sendSubscriptionConfirmation!('user@test.com', subscription);

      const sentCommand = mockClient.send.mock.calls[0][0];
      expect(sentCommand.Message.Subject.Data).toBe('Welcome to MyApp!');
      expect(sentCommand.Message.Body.Html.Data).toContain('plan_premium');
    });

    it('should use custom subscription canceled template when provided', async () => {
      const customTemplate = (context: SubscriptionCanceledEmailContext) => ({
        subject: `Goodbye from ${context.appName}`,
        html: `<h1>Sorry to see you go</h1>`,
        text: `Sorry to see you go`,
      });

      const customAdapter = new SESEmailAdapter({
        region: 'us-east-1',
        fromEmail: 'noreply@test.com',
        appName: 'MyApp',
        templates: {
          subscriptionCanceled: customTemplate,
        },
      });

      const mockClient = (customAdapter as any).sesClient;
      mockClient.send.mockResolvedValueOnce({});

      const subscription: Subscription = {
        id: 'sub_1',
        userId: 'user_1',
        planId: 'plan_premium',
        priceId: 'price_1',
        status: 'canceled',
        billingCycle: 'monthly',
        currentPeriodStart: new Date(),
        currentPeriodEnd: new Date(),
        cancelAtPeriodEnd: true,
        providerSubscriptionId: 'sub_123',
        providerCustomerId: 'cus_123',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      await customAdapter.sendSubscriptionCanceled!('user@test.com', subscription);

      const sentCommand = mockClient.send.mock.calls[0][0];
      expect(sentCommand.Message.Subject.Data).toBe('Goodbye from MyApp');
    });

    it('should pass email address in template context', async () => {
      let receivedContext: VerificationEmailContext | null = null;

      const customTemplate = (context: VerificationEmailContext) => {
        receivedContext = context;
        return {
          subject: 'Test',
          html: '<p>Test</p>',
          text: 'Test',
        };
      };

      const customAdapter = new SESEmailAdapter({
        region: 'us-east-1',
        fromEmail: 'noreply@test.com',
        appName: 'TestApp',
        templates: {
          verification: customTemplate,
        },
      });

      const mockClient = (customAdapter as any).sesClient;
      mockClient.send.mockResolvedValueOnce({});

      await customAdapter.sendVerificationEmail(
        'user@example.com',
        'my-token',
        'https://app.com/verify'
      );

      expect(receivedContext).not.toBeNull();
      expect(receivedContext!.email).toBe('user@example.com');
      expect(receivedContext!.token).toBe('my-token');
      expect(receivedContext!.verifyUrl).toBe('https://app.com/verify');
      expect(receivedContext!.appName).toBe('TestApp');
    });
  });

  // ============================================
  // SEND VERIFICATION EMAIL TESTS
  // ============================================

  describe('sendVerificationEmail', () => {
    it('should send verification email with correct parameters', async () => {
      mockSESClient.send.mockResolvedValueOnce({ MessageId: 'msg-123' });

      await adapter.sendVerificationEmail(
        'user@example.com',
        'verify-token-abc',
        'https://app.com/verify/verify-token-abc'
      );

      expect(mockSESClient.send).toHaveBeenCalledTimes(1);
      const sentCommand = mockSESClient.send.mock.calls[0][0];

      expect(sentCommand.Source).toBe('noreply@example.com');
      expect(sentCommand.Destination.ToAddresses).toEqual(['user@example.com']);
      expect(sentCommand.Message.Subject.Data).toContain('Verify');
      expect(sentCommand.Message.Subject.Data).toContain('TestApp');
    });

    it('should include verification URL in HTML body', async () => {
      mockSESClient.send.mockResolvedValueOnce({});
      const verifyUrl = 'https://app.com/verify/token123';

      await adapter.sendVerificationEmail('user@test.com', 'token123', verifyUrl);

      const sentCommand = mockSESClient.send.mock.calls[0][0];
      expect(sentCommand.Message.Body.Html.Data).toContain(verifyUrl);
    });

    it('should include verification URL in plain text body', async () => {
      mockSESClient.send.mockResolvedValueOnce({});
      const verifyUrl = 'https://app.com/verify/token123';

      await adapter.sendVerificationEmail('user@test.com', 'token123', verifyUrl);

      const sentCommand = mockSESClient.send.mock.calls[0][0];
      expect(sentCommand.Message.Body.Text.Data).toContain(verifyUrl);
    });

    it('should use UTF-8 charset for email content', async () => {
      mockSESClient.send.mockResolvedValueOnce({});

      await adapter.sendVerificationEmail(
        'user@test.com',
        'token123',
        'https://app.com/verify/token123'
      );

      const sentCommand = mockSESClient.send.mock.calls[0][0];
      expect(sentCommand.Message.Subject.Charset).toBe('UTF-8');
      expect(sentCommand.Message.Body.Html.Charset).toBe('UTF-8');
      expect(sentCommand.Message.Body.Text.Charset).toBe('UTF-8');
    });

    it('should throw SESEmailError when SES fails to send', async () => {
      mockSESClient.send.mockRejectedValueOnce(new Error('SES service error'));

      await expect(
        adapter.sendVerificationEmail('user@test.com', 'token', 'https://url')
      ).rejects.toThrow(SESEmailError);
    });

    it('should include token expiration info in email body', async () => {
      mockSESClient.send.mockResolvedValueOnce({});

      await adapter.sendVerificationEmail(
        'user@test.com',
        'token123',
        'https://app.com/verify/token123'
      );

      const sentCommand = mockSESClient.send.mock.calls[0][0];
      // Should mention expiration in the email
      expect(sentCommand.Message.Body.Html.Data).toMatch(/expire|24|hour/i);
      expect(sentCommand.Message.Body.Text.Data).toMatch(/expire|24|hour/i);
    });
  });

  // ============================================
  // SEND PASSWORD RESET EMAIL TESTS
  // ============================================

  describe('sendPasswordResetEmail', () => {
    it('should send password reset email with correct parameters', async () => {
      mockSESClient.send.mockResolvedValueOnce({ MessageId: 'msg-456' });

      await adapter.sendPasswordResetEmail(
        'user@example.com',
        'reset-token-xyz',
        'https://app.com/reset/reset-token-xyz'
      );

      expect(mockSESClient.send).toHaveBeenCalledTimes(1);
      const sentCommand = mockSESClient.send.mock.calls[0][0];

      expect(sentCommand.Source).toBe('noreply@example.com');
      expect(sentCommand.Destination.ToAddresses).toEqual(['user@example.com']);
      expect(sentCommand.Message.Subject.Data).toContain('Reset');
      expect(sentCommand.Message.Subject.Data).toContain('Password');
    });

    it('should include reset URL in HTML body', async () => {
      mockSESClient.send.mockResolvedValueOnce({});
      const resetUrl = 'https://app.com/reset/token456';

      await adapter.sendPasswordResetEmail('user@test.com', 'token456', resetUrl);

      const sentCommand = mockSESClient.send.mock.calls[0][0];
      expect(sentCommand.Message.Body.Html.Data).toContain(resetUrl);
    });

    it('should include reset URL in plain text body', async () => {
      mockSESClient.send.mockResolvedValueOnce({});
      const resetUrl = 'https://app.com/reset/token456';

      await adapter.sendPasswordResetEmail('user@test.com', 'token456', resetUrl);

      const sentCommand = mockSESClient.send.mock.calls[0][0];
      expect(sentCommand.Message.Body.Text.Data).toContain(resetUrl);
    });

    it('should throw SESEmailError when SES fails to send', async () => {
      mockSESClient.send.mockRejectedValueOnce(new Error('SES rate limit exceeded'));

      await expect(
        adapter.sendPasswordResetEmail('user@test.com', 'token', 'https://url')
      ).rejects.toThrow(SESEmailError);
    });

    it('should mention shorter expiration time for reset links', async () => {
      mockSESClient.send.mockResolvedValueOnce({});

      await adapter.sendPasswordResetEmail(
        'user@test.com',
        'token123',
        'https://app.com/reset/token123'
      );

      const sentCommand = mockSESClient.send.mock.calls[0][0];
      // Password reset links typically expire in 1 hour
      expect(sentCommand.Message.Body.Html.Data).toMatch(/expire|1|hour/i);
      expect(sentCommand.Message.Body.Text.Data).toMatch(/expire|1|hour/i);
    });

    it('should include security warning about not requesting reset', async () => {
      mockSESClient.send.mockResolvedValueOnce({});

      await adapter.sendPasswordResetEmail(
        'user@test.com',
        'token123',
        'https://app.com/reset/token123'
      );

      const sentCommand = mockSESClient.send.mock.calls[0][0];
      // Should mention what to do if user didn't request the reset
      expect(sentCommand.Message.Body.Html.Data).toMatch(/didn.*request|ignore/i);
    });
  });

  // ============================================
  // SEND SUBSCRIPTION CONFIRMATION EMAIL TESTS
  // ============================================

  describe('sendSubscriptionConfirmation', () => {
    const mockSubscription: Subscription = {
      id: 'sub_1',
      userId: 'user_1',
      planId: 'plan_pro',
      priceId: 'price_monthly',
      status: 'active',
      billingCycle: 'monthly',
      currentPeriodStart: new Date('2024-01-01'),
      currentPeriodEnd: new Date('2024-02-01'),
      cancelAtPeriodEnd: false,
      providerSubscriptionId: 'stripe_sub_123',
      providerCustomerId: 'cus_123',
      createdAt: new Date('2024-01-01'),
      updatedAt: new Date('2024-01-01'),
    };

    it('should send subscription confirmation email', async () => {
      mockSESClient.send.mockResolvedValueOnce({ MessageId: 'msg-789' });

      await adapter.sendSubscriptionConfirmation!('user@example.com', mockSubscription);

      expect(mockSESClient.send).toHaveBeenCalledTimes(1);
      const sentCommand = mockSESClient.send.mock.calls[0][0];

      expect(sentCommand.Source).toBe('noreply@example.com');
      expect(sentCommand.Destination.ToAddresses).toEqual(['user@example.com']);
      expect(sentCommand.Message.Subject.Data).toContain('Subscription');
    });

    it('should include plan information in email body', async () => {
      mockSESClient.send.mockResolvedValueOnce({});

      await adapter.sendSubscriptionConfirmation!('user@test.com', mockSubscription);

      const sentCommand = mockSESClient.send.mock.calls[0][0];
      expect(sentCommand.Message.Body.Html.Data).toContain(mockSubscription.planId);
    });

    it('should include billing cycle in email body', async () => {
      mockSESClient.send.mockResolvedValueOnce({});

      await adapter.sendSubscriptionConfirmation!('user@test.com', mockSubscription);

      const sentCommand = mockSESClient.send.mock.calls[0][0];
      expect(sentCommand.Message.Body.Html.Data).toMatch(/monthly|billing/i);
    });

    it('should throw SESEmailError when SES fails', async () => {
      mockSESClient.send.mockRejectedValueOnce(new Error('Network error'));

      await expect(
        adapter.sendSubscriptionConfirmation!('user@test.com', mockSubscription)
      ).rejects.toThrow(SESEmailError);
    });

    it('should handle trial subscriptions', async () => {
      mockSESClient.send.mockResolvedValueOnce({});

      const trialSubscription: Subscription = {
        ...mockSubscription,
        status: 'trialing',
        trialEndDate: new Date('2024-01-08'),
      };

      await adapter.sendSubscriptionConfirmation!('user@test.com', trialSubscription);

      const sentCommand = mockSESClient.send.mock.calls[0][0];
      expect(sentCommand.Message.Body.Html.Data).toMatch(/trial/i);
    });
  });

  // ============================================
  // SEND SUBSCRIPTION CANCELED EMAIL TESTS
  // ============================================

  describe('sendSubscriptionCanceled', () => {
    const mockCanceledSubscription: Subscription = {
      id: 'sub_1',
      userId: 'user_1',
      planId: 'plan_pro',
      priceId: 'price_monthly',
      status: 'canceled',
      billingCycle: 'monthly',
      currentPeriodStart: new Date('2024-01-01'),
      currentPeriodEnd: new Date('2024-02-01'),
      cancelAtPeriodEnd: true,
      providerSubscriptionId: 'stripe_sub_123',
      providerCustomerId: 'cus_123',
      createdAt: new Date('2024-01-01'),
      updatedAt: new Date('2024-01-15'),
    };

    it('should send subscription canceled email', async () => {
      mockSESClient.send.mockResolvedValueOnce({ MessageId: 'msg-999' });

      await adapter.sendSubscriptionCanceled!('user@example.com', mockCanceledSubscription);

      expect(mockSESClient.send).toHaveBeenCalledTimes(1);
      const sentCommand = mockSESClient.send.mock.calls[0][0];

      expect(sentCommand.Source).toBe('noreply@example.com');
      expect(sentCommand.Destination.ToAddresses).toEqual(['user@example.com']);
      expect(sentCommand.Message.Subject.Data).toContain('Cancel');
    });

    it('should include access end date when cancelAtPeriodEnd is true', async () => {
      mockSESClient.send.mockResolvedValueOnce({});

      await adapter.sendSubscriptionCanceled!('user@test.com', mockCanceledSubscription);

      const sentCommand = mockSESClient.send.mock.calls[0][0];
      // Should mention when access will end
      expect(sentCommand.Message.Body.Html.Data).toMatch(/access|end|February|2024-02-01/i);
    });

    it('should include resubscription information', async () => {
      mockSESClient.send.mockResolvedValueOnce({});

      await adapter.sendSubscriptionCanceled!('user@test.com', mockCanceledSubscription);

      const sentCommand = mockSESClient.send.mock.calls[0][0];
      // Should mention how to resubscribe
      expect(sentCommand.Message.Body.Html.Data).toMatch(/resubscribe|re-subscribe|resume/i);
    });

    it('should throw SESEmailError when SES fails', async () => {
      mockSESClient.send.mockRejectedValueOnce(new Error('Credentials expired'));

      await expect(
        adapter.sendSubscriptionCanceled!('user@test.com', mockCanceledSubscription)
      ).rejects.toThrow(SESEmailError);
    });
  });

  // ============================================
  // EMAIL TEMPLATE TESTS
  // ============================================

  describe('Email Templates', () => {
    it('should generate valid HTML structure', async () => {
      mockSESClient.send.mockResolvedValueOnce({});

      await adapter.sendVerificationEmail(
        'user@test.com',
        'token',
        'https://app.com/verify/token'
      );

      const sentCommand = mockSESClient.send.mock.calls[0][0];
      const htmlBody = sentCommand.Message.Body.Html.Data;

      expect(htmlBody).toContain('<!DOCTYPE html>');
      expect(htmlBody).toContain('<html');
      expect(htmlBody).toContain('</html>');
      expect(htmlBody).toContain('<body');
      expect(htmlBody).toContain('</body>');
    });

    it('should include app name in email content', async () => {
      const customAppAdapter = new SESEmailAdapter({
        region: 'us-east-1',
        fromEmail: 'noreply@custom.com',
        appName: 'CustomBrand',
      });

      const mockClient = (customAppAdapter as any).sesClient;
      mockClient.send.mockResolvedValueOnce({});

      await customAppAdapter.sendVerificationEmail(
        'user@test.com',
        'token',
        'https://app.com/verify/token'
      );

      const sentCommand = mockClient.send.mock.calls[0][0];
      expect(sentCommand.Message.Subject.Data).toContain('CustomBrand');
      expect(sentCommand.Message.Body.Html.Data).toContain('CustomBrand');
    });

    it('should generate both HTML and plain text versions', async () => {
      mockSESClient.send.mockResolvedValueOnce({});

      await adapter.sendPasswordResetEmail(
        'user@test.com',
        'token',
        'https://app.com/reset/token'
      );

      const sentCommand = mockSESClient.send.mock.calls[0][0];
      expect(sentCommand.Message.Body.Html).toBeDefined();
      expect(sentCommand.Message.Body.Text).toBeDefined();
      expect(sentCommand.Message.Body.Html.Data.length).toBeGreaterThan(0);
      expect(sentCommand.Message.Body.Text.Data.length).toBeGreaterThan(0);
    });

    it('should include clickable button in HTML email', async () => {
      mockSESClient.send.mockResolvedValueOnce({});

      await adapter.sendVerificationEmail(
        'user@test.com',
        'token',
        'https://app.com/verify/token'
      );

      const sentCommand = mockSESClient.send.mock.calls[0][0];
      const htmlBody = sentCommand.Message.Body.Html.Data;

      // Should have a styled button link
      expect(htmlBody).toMatch(/<a[^>]*href="https:\/\/app\.com\/verify\/token"[^>]*>/);
    });
  });

  // ============================================
  // ERROR HANDLING TESTS
  // ============================================

  describe('Error Handling', () => {
    it('should wrap errors in SESEmailError with SEND_FAILED code', async () => {
      mockSESClient.send.mockRejectedValueOnce(new Error('Generic error'));

      try {
        await adapter.sendVerificationEmail('user@test.com', 'token', 'https://url');
        expect.fail('Should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(SESEmailError);
        expect((error as SESEmailError).code).toBe(SESEmailErrorCodes.SEND_FAILED);
      }
    });

    it('should map MessageRejected errors to MESSAGE_REJECTED code', async () => {
      const sesError = new Error('Invalid email address');
      (sesError as any).name = 'MessageRejected';
      mockSESClient.send.mockRejectedValueOnce(sesError);

      try {
        await adapter.sendVerificationEmail('invalid-email', 'token', 'https://url');
        expect.fail('Should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(SESEmailError);
        expect((error as SESEmailError).code).toBe(SESEmailErrorCodes.MESSAGE_REJECTED);
        expect((error as SESEmailError).originalError).toBe(sesError);
      }
    });

    it('should map CredentialsProviderError to CREDENTIALS_ERROR code', async () => {
      const credError = new Error('Missing credentials');
      (credError as any).name = 'CredentialsProviderError';
      mockSESClient.send.mockRejectedValueOnce(credError);

      try {
        await adapter.sendVerificationEmail('user@test.com', 'token', 'https://url');
        expect.fail('Should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(SESEmailError);
        expect((error as SESEmailError).code).toBe(SESEmailErrorCodes.CREDENTIALS_ERROR);
      }
    });

    it('should map Throttling errors to RATE_LIMIT_EXCEEDED code', async () => {
      const rateLimitError = new Error('Rate exceeded');
      (rateLimitError as any).name = 'Throttling';
      mockSESClient.send.mockRejectedValueOnce(rateLimitError);

      try {
        await adapter.sendPasswordResetEmail('user@test.com', 'token', 'https://url');
        expect.fail('Should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(SESEmailError);
        expect((error as SESEmailError).code).toBe(SESEmailErrorCodes.RATE_LIMIT_EXCEEDED);
      }
    });

    it('should preserve original error in SESEmailError', async () => {
      const originalError = new Error('Original error message');
      mockSESClient.send.mockRejectedValueOnce(originalError);

      try {
        await adapter.sendVerificationEmail('user@test.com', 'token', 'https://url');
        expect.fail('Should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(SESEmailError);
        expect((error as SESEmailError).originalError).toBe(originalError);
        expect((error as SESEmailError).message).toBe('Original error message');
      }
    });
  });

  // ============================================
  // SESEMAIL ERROR CLASS TESTS
  // ============================================

  describe('SESEmailError', () => {
    it('should have correct name property', () => {
      const error = new SESEmailError('Test error', SESEmailErrorCodes.SEND_FAILED);
      expect(error.name).toBe('SESEmailError');
    });

    it('should have code property', () => {
      const error = new SESEmailError('Test error', SESEmailErrorCodes.INVALID_CONFIG);
      expect(error.code).toBe(SESEmailErrorCodes.INVALID_CONFIG);
    });

    it('should have optional originalError property', () => {
      const original = new Error('Original');
      const error = new SESEmailError('Test error', SESEmailErrorCodes.SEND_FAILED, original);
      expect(error.originalError).toBe(original);
    });

    it('should be instanceof Error', () => {
      const error = new SESEmailError('Test', SESEmailErrorCodes.SEND_FAILED);
      expect(error).toBeInstanceOf(Error);
    });
  });

  // ============================================
  // IMPLEMENTS EMAILADAPTER INTERFACE TESTS
  // ============================================

  describe('EmailAdapter Interface Compliance', () => {
    it('should implement sendVerificationEmail method', () => {
      expect(typeof adapter.sendVerificationEmail).toBe('function');
    });

    it('should implement sendPasswordResetEmail method', () => {
      expect(typeof adapter.sendPasswordResetEmail).toBe('function');
    });

    it('should implement optional sendSubscriptionConfirmation method', () => {
      expect(typeof adapter.sendSubscriptionConfirmation).toBe('function');
    });

    it('should implement optional sendSubscriptionCanceled method', () => {
      expect(typeof adapter.sendSubscriptionCanceled).toBe('function');
    });

    it('sendVerificationEmail should return Promise<void>', async () => {
      mockSESClient.send.mockResolvedValueOnce({});

      const result = await adapter.sendVerificationEmail(
        'user@test.com',
        'token',
        'https://url'
      );

      expect(result).toBeUndefined();
    });

    it('sendPasswordResetEmail should return Promise<void>', async () => {
      mockSESClient.send.mockResolvedValueOnce({});

      const result = await adapter.sendPasswordResetEmail(
        'user@test.com',
        'token',
        'https://url'
      );

      expect(result).toBeUndefined();
    });
  });
});

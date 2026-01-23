import { SESClient, SendEmailCommand } from '@aws-sdk/client-ses';
import type { EmailAdapter, Subscription } from '@authpaddle/core';

// ============================================
// ERROR TYPES
// ============================================

/**
 * Custom error class for SES-related errors
 */
export class SESEmailError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly originalError?: Error
  ) {
    super(message);
    this.name = 'SESEmailError';
  }
}

export const SESEmailErrorCodes = {
  SEND_FAILED: 'SEND_FAILED',
  INVALID_CONFIG: 'INVALID_CONFIG',
  CREDENTIALS_ERROR: 'CREDENTIALS_ERROR',
  RATE_LIMIT_EXCEEDED: 'RATE_LIMIT_EXCEEDED',
  MESSAGE_REJECTED: 'MESSAGE_REJECTED',
} as const;

// ============================================
// TEMPLATE TYPES
// ============================================

/**
 * Context for verification email templates
 */
export interface VerificationEmailContext {
  appName: string;
  verifyUrl: string;
  token: string;
  email: string;
}

/**
 * Context for password reset email templates
 */
export interface PasswordResetEmailContext {
  appName: string;
  resetUrl: string;
  token: string;
  email: string;
}

/**
 * Context for subscription confirmation email templates
 */
export interface SubscriptionConfirmationEmailContext {
  appName: string;
  subscription: Subscription;
  email: string;
}

/**
 * Context for subscription canceled email templates
 */
export interface SubscriptionCanceledEmailContext {
  appName: string;
  subscription: Subscription;
  email: string;
}

/**
 * Email template generator function type
 */
export type EmailTemplateGenerator<T> = (context: T) => { html: string; text: string; subject: string };

/**
 * Custom email templates configuration
 */
export interface CustomEmailTemplates {
  verification?: EmailTemplateGenerator<VerificationEmailContext>;
  passwordReset?: EmailTemplateGenerator<PasswordResetEmailContext>;
  subscriptionConfirmation?: EmailTemplateGenerator<SubscriptionConfirmationEmailContext>;
  subscriptionCanceled?: EmailTemplateGenerator<SubscriptionCanceledEmailContext>;
}

// ============================================
// CONFIGURATION TYPES
// ============================================

/**
 * Configuration options for the SES Email Adapter
 */
export interface SESEmailAdapterConfig {
  /** AWS region (e.g., 'us-east-1') */
  region: string;
  /** Email address to send from (must be verified in SES) */
  fromEmail: string;
  /** AWS access key ID (optional - uses default credential chain if not provided) */
  accessKeyId?: string;
  /** AWS secret access key (optional - uses default credential chain if not provided) */
  secretAccessKey?: string;
  /** Application name to use in email subjects and content */
  appName?: string;
  /** Reply-to email address (optional) */
  replyToEmail?: string;
  /** Custom email templates (optional) */
  templates?: CustomEmailTemplates;
  /** Custom SES endpoint (optional - useful for local testing with localstack) */
  endpoint?: string;
}

// ============================================
// ADAPTER IMPLEMENTATION
// ============================================

/**
 * AWS SES implementation of the EmailAdapter interface.
 * Provides email sending capabilities for authentication and subscription events.
 */
export class SESEmailAdapter implements EmailAdapter {
  private sesClient: SESClient;
  private fromEmail: string;
  private appName: string;
  private replyToEmail?: string;
  private templates?: CustomEmailTemplates;

  constructor(config: SESEmailAdapterConfig) {
    this.validateConfig(config);

    const clientConfig: ConstructorParameters<typeof SESClient>[0] = {
      region: config.region,
    };

    // Set custom endpoint if provided (useful for localstack testing)
    if (config.endpoint) {
      clientConfig.endpoint = config.endpoint;
    }

    // Only set credentials if both are provided
    if (config.accessKeyId && config.secretAccessKey) {
      clientConfig.credentials = {
        accessKeyId: config.accessKeyId,
        secretAccessKey: config.secretAccessKey,
      };
    }

    this.sesClient = new SESClient(clientConfig);
    this.fromEmail = config.fromEmail;
    this.appName = config.appName || 'Our Service';
    this.replyToEmail = config.replyToEmail;
    this.templates = config.templates;
  }

  /**
   * Validate configuration options
   */
  private validateConfig(config: SESEmailAdapterConfig): void {
    if (!config.region) {
      throw new SESEmailError(
        'AWS region is required',
        SESEmailErrorCodes.INVALID_CONFIG
      );
    }
    if (!config.fromEmail) {
      throw new SESEmailError(
        'From email address is required',
        SESEmailErrorCodes.INVALID_CONFIG
      );
    }
  }

  /**
   * Destroy the adapter and clean up resources.
   * Should be called when shutting down the application.
   */
  destroy(): void {
    this.sesClient.destroy();
  }

  // ============================================
  // REQUIRED EMAILADAPTER METHODS
  // ============================================

  async sendVerificationEmail(
    email: string,
    token: string,
    verifyUrl: string
  ): Promise<void> {
    const context: VerificationEmailContext = {
      appName: this.appName,
      verifyUrl,
      token,
      email,
    };

    if (this.templates?.verification) {
      const { html, text, subject } = this.templates.verification(context);
      await this.sendEmail(email, subject, html, text);
    } else {
      const subject = `Verify Your Email - ${this.appName}`;
      const htmlBody = this.generateVerificationEmailHtml(verifyUrl);
      const textBody = this.generateVerificationEmailText(verifyUrl);
      await this.sendEmail(email, subject, htmlBody, textBody);
    }
  }

  async sendPasswordResetEmail(
    email: string,
    token: string,
    resetUrl: string
  ): Promise<void> {
    const context: PasswordResetEmailContext = {
      appName: this.appName,
      resetUrl,
      token,
      email,
    };

    if (this.templates?.passwordReset) {
      const { html, text, subject } = this.templates.passwordReset(context);
      await this.sendEmail(email, subject, html, text);
    } else {
      const subject = `Reset Your Password - ${this.appName}`;
      const htmlBody = this.generatePasswordResetEmailHtml(resetUrl);
      const textBody = this.generatePasswordResetEmailText(resetUrl);
      await this.sendEmail(email, subject, htmlBody, textBody);
    }
  }

  // ============================================
  // OPTIONAL EMAILADAPTER METHODS
  // ============================================

  async sendSubscriptionConfirmation(
    email: string,
    subscription: Subscription
  ): Promise<void> {
    const context: SubscriptionConfirmationEmailContext = {
      appName: this.appName,
      subscription,
      email,
    };

    if (this.templates?.subscriptionConfirmation) {
      const { html, text, subject } = this.templates.subscriptionConfirmation(context);
      await this.sendEmail(email, subject, html, text);
    } else {
      const subject = `Subscription Confirmed - ${this.appName}`;
      const htmlBody = this.generateSubscriptionConfirmationHtml(subscription);
      const textBody = this.generateSubscriptionConfirmationText(subscription);
      await this.sendEmail(email, subject, htmlBody, textBody);
    }
  }

  async sendSubscriptionCanceled(
    email: string,
    subscription: Subscription
  ): Promise<void> {
    const context: SubscriptionCanceledEmailContext = {
      appName: this.appName,
      subscription,
      email,
    };

    if (this.templates?.subscriptionCanceled) {
      const { html, text, subject } = this.templates.subscriptionCanceled(context);
      await this.sendEmail(email, subject, html, text);
    } else {
      const subject = `Subscription Canceled - ${this.appName}`;
      const htmlBody = this.generateSubscriptionCanceledHtml(subscription);
      const textBody = this.generateSubscriptionCanceledText(subscription);
      await this.sendEmail(email, subject, htmlBody, textBody);
    }
  }

  // ============================================
  // PRIVATE HELPER METHODS
  // ============================================

  private async sendEmail(
    to: string,
    subject: string,
    htmlBody: string,
    textBody: string
  ): Promise<void> {
    const command = new SendEmailCommand({
      Source: this.fromEmail,
      Destination: {
        ToAddresses: [to],
      },
      ReplyToAddresses: this.replyToEmail ? [this.replyToEmail] : undefined,
      Message: {
        Subject: {
          Data: subject,
          Charset: 'UTF-8',
        },
        Body: {
          Html: {
            Data: htmlBody,
            Charset: 'UTF-8',
          },
          Text: {
            Data: textBody,
            Charset: 'UTF-8',
          },
        },
      },
    });

    try {
      await this.sesClient.send(command);
    } catch (error) {
      throw this.mapSESError(error as Error);
    }
  }

  /**
   * Map AWS SES errors to SESEmailError
   */
  private mapSESError(error: Error): SESEmailError {
    const errorName = (error as any).name || '';

    if (errorName === 'MessageRejected') {
      return new SESEmailError(
        error.message,
        SESEmailErrorCodes.MESSAGE_REJECTED,
        error
      );
    }
    if (errorName === 'Throttling' || errorName === 'LimitExceededException') {
      return new SESEmailError(
        error.message,
        SESEmailErrorCodes.RATE_LIMIT_EXCEEDED,
        error
      );
    }
    if (errorName === 'CredentialsProviderError' || errorName === 'InvalidSignatureException') {
      return new SESEmailError(
        error.message,
        SESEmailErrorCodes.CREDENTIALS_ERROR,
        error
      );
    }

    return new SESEmailError(
      error.message,
      SESEmailErrorCodes.SEND_FAILED,
      error
    );
  }

  // ============================================
  // DEFAULT EMAIL TEMPLATE GENERATORS
  // ============================================

  private generateVerificationEmailHtml(verifyUrl: string): string {
    return `
<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8">
    <style>
      body {
        font-family: Arial, sans-serif;
        line-height: 1.6;
        color: #333;
        max-width: 600px;
        margin: 0 auto;
        padding: 20px;
      }
      .container {
        background-color: #f9f9f9;
        border-radius: 8px;
        padding: 30px;
        border: 1px solid #e0e0e0;
      }
      .header {
        text-align: center;
        margin-bottom: 30px;
      }
      .header h1 {
        color: #2c3e50;
        margin: 0;
      }
      .content {
        background-color: white;
        padding: 25px;
        border-radius: 6px;
      }
      .button {
        display: inline-block;
        padding: 12px 30px;
        background-color: #27ae60;
        color: #ffffff !important;
        text-decoration: none;
        border-radius: 5px;
        margin: 20px 0;
        font-weight: bold;
      }
      .button:hover {
        background-color: #229954;
        color: #ffffff !important;
      }
      .footer {
        margin-top: 30px;
        text-align: center;
        font-size: 12px;
        color: #7f8c8d;
      }
      .link {
        color: #3498db;
        word-break: break-all;
      }
      .info-box {
        background-color: #d1ecf1;
        border: 1px solid #17a2b8;
        border-radius: 5px;
        padding: 15px;
        margin: 20px 0;
        color: #0c5460;
      }
    </style>
  </head>
  <body>
    <div class="container">
      <div class="header">
        <h1>Verify Your Email</h1>
      </div>
      <div class="content">
        <p>Hello,</p>
        <p>Welcome to ${this.appName}!</p>
        <p>Thank you for registering. To complete your registration and activate your account, please verify your email address by clicking the button below:</p>

        <div style="text-align: center;">
          <a href="${verifyUrl}" class="button">Verify Email Address</a>
        </div>

        <p>Or copy and paste this link into your browser:</p>
        <p class="link">${verifyUrl}</p>

        <div class="info-box">
          <strong>This verification link will expire in 24 hours.</strong>
        </div>

        <p>If you didn't create an account with ${this.appName}, you can safely ignore this email. No account will be created without email verification.</p>
      </div>
      <div class="footer">
        <p>This is an automated message, please do not reply to this email.</p>
      </div>
    </div>
  </body>
</html>
    `.trim();
  }

  private generateVerificationEmailText(verifyUrl: string): string {
    return `
Hello,

Welcome to ${this.appName}!

Thank you for registering. To complete your registration and activate your account, please verify your email address by clicking the link below:

${verifyUrl}

IMPORTANT: This verification link will expire in 24 hours.

If you didn't create an account with ${this.appName}, you can safely ignore this email. No account will be created without email verification.

---
This is an automated message, please do not reply to this email.
    `.trim();
  }

  private generatePasswordResetEmailHtml(resetUrl: string): string {
    return `
<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8">
    <style>
      body {
        font-family: Arial, sans-serif;
        line-height: 1.6;
        color: #333;
        max-width: 600px;
        margin: 0 auto;
        padding: 20px;
      }
      .container {
        background-color: #f9f9f9;
        border-radius: 8px;
        padding: 30px;
        border: 1px solid #e0e0e0;
      }
      .header {
        text-align: center;
        margin-bottom: 30px;
      }
      .header h1 {
        color: #2c3e50;
        margin: 0;
      }
      .content {
        background-color: white;
        padding: 25px;
        border-radius: 6px;
      }
      .button {
        display: inline-block;
        padding: 12px 30px;
        background-color: #e74c3c;
        color: #ffffff !important;
        text-decoration: none;
        border-radius: 5px;
        margin: 20px 0;
        font-weight: bold;
      }
      .button:hover {
        background-color: #c0392b;
        color: #ffffff !important;
      }
      .footer {
        margin-top: 30px;
        text-align: center;
        font-size: 12px;
        color: #7f8c8d;
      }
      .link {
        color: #3498db;
        word-break: break-all;
      }
      .warning {
        background-color: #fff3cd;
        border: 1px solid #ffc107;
        border-radius: 5px;
        padding: 10px;
        margin: 15px 0;
        color: #856404;
      }
    </style>
  </head>
  <body>
    <div class="container">
      <div class="header">
        <h1>Reset Your Password</h1>
      </div>
      <div class="content">
        <p>Hello,</p>
        <p>We received a request to reset your password for your ${this.appName} account. Click the button below to create a new password:</p>

        <div style="text-align: center;">
          <a href="${resetUrl}" class="button">Reset Password</a>
        </div>

        <p>Or copy and paste this link into your browser:</p>
        <p class="link">${resetUrl}</p>

        <div class="warning">
          <strong>This link will expire in 1 hour.</strong>
        </div>

        <p>If you didn't request a password reset, you can safely ignore this email. Your password will not be changed.</p>
      </div>
      <div class="footer">
        <p>This is an automated message, please do not reply to this email.</p>
      </div>
    </div>
  </body>
</html>
    `.trim();
  }

  private generatePasswordResetEmailText(resetUrl: string): string {
    return `
Hello,

We received a request to reset your password for your ${this.appName} account. Click the link below to create a new password:

${resetUrl}

This link will expire in 1 hour.

If you didn't request a password reset, you can safely ignore this email. Your password will not be changed.

---
This is an automated message, please do not reply to this email.
    `.trim();
  }

  private generateSubscriptionConfirmationHtml(subscription: Subscription): string {
    const isTrialing = subscription.status === 'trialing';
    const trialInfo = isTrialing && subscription.trialEndDate
      ? `<div class="info-box">
          <strong>Your trial ends on ${subscription.trialEndDate.toLocaleDateString()}.</strong>
        </div>`
      : '';

    return `
<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8">
    <style>
      body {
        font-family: Arial, sans-serif;
        line-height: 1.6;
        color: #333;
        max-width: 600px;
        margin: 0 auto;
        padding: 20px;
      }
      .container {
        background-color: #f9f9f9;
        border-radius: 8px;
        padding: 30px;
        border: 1px solid #e0e0e0;
      }
      .header {
        text-align: center;
        margin-bottom: 30px;
      }
      .header h1 {
        color: #27ae60;
        margin: 0;
      }
      .content {
        background-color: white;
        padding: 25px;
        border-radius: 6px;
      }
      .details {
        background-color: #f8f9fa;
        border-radius: 5px;
        padding: 15px;
        margin: 20px 0;
      }
      .details p {
        margin: 5px 0;
      }
      .footer {
        margin-top: 30px;
        text-align: center;
        font-size: 12px;
        color: #7f8c8d;
      }
      .info-box {
        background-color: #d1ecf1;
        border: 1px solid #17a2b8;
        border-radius: 5px;
        padding: 15px;
        margin: 20px 0;
        color: #0c5460;
      }
    </style>
  </head>
  <body>
    <div class="container">
      <div class="header">
        <h1>${isTrialing ? 'Trial Started!' : 'Subscription Confirmed!'}</h1>
      </div>
      <div class="content">
        <p>Hello,</p>
        <p>Thank you for ${isTrialing ? 'starting your trial with' : 'subscribing to'} ${this.appName}!</p>

        <div class="details">
          <p><strong>Plan:</strong> ${subscription.planId}</p>
          <p><strong>Billing Cycle:</strong> ${subscription.billingCycle}</p>
          <p><strong>Status:</strong> ${subscription.status}</p>
          <p><strong>Current Period:</strong> ${subscription.currentPeriodStart.toLocaleDateString()} - ${subscription.currentPeriodEnd.toLocaleDateString()}</p>
        </div>

        ${trialInfo}

        <p>You now have full access to all the features included in your plan. If you have any questions, please don't hesitate to contact our support team.</p>
      </div>
      <div class="footer">
        <p>This is an automated message, please do not reply to this email.</p>
      </div>
    </div>
  </body>
</html>
    `.trim();
  }

  private generateSubscriptionConfirmationText(subscription: Subscription): string {
    const isTrialing = subscription.status === 'trialing';
    const trialInfo = isTrialing && subscription.trialEndDate
      ? `\nYour trial ends on ${subscription.trialEndDate.toLocaleDateString()}.\n`
      : '';

    return `
Hello,

Thank you for ${isTrialing ? 'starting your trial with' : 'subscribing to'} ${this.appName}!

Subscription Details:
- Plan: ${subscription.planId}
- Billing Cycle: ${subscription.billingCycle}
- Status: ${subscription.status}
- Current Period: ${subscription.currentPeriodStart.toLocaleDateString()} - ${subscription.currentPeriodEnd.toLocaleDateString()}
${trialInfo}
You now have full access to all the features included in your plan. If you have any questions, please don't hesitate to contact our support team.

---
This is an automated message, please do not reply to this email.
    `.trim();
  }

  private generateSubscriptionCanceledHtml(subscription: Subscription): string {
    const accessEndDate = subscription.currentPeriodEnd.toLocaleDateString();

    return `
<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8">
    <style>
      body {
        font-family: Arial, sans-serif;
        line-height: 1.6;
        color: #333;
        max-width: 600px;
        margin: 0 auto;
        padding: 20px;
      }
      .container {
        background-color: #f9f9f9;
        border-radius: 8px;
        padding: 30px;
        border: 1px solid #e0e0e0;
      }
      .header {
        text-align: center;
        margin-bottom: 30px;
      }
      .header h1 {
        color: #e74c3c;
        margin: 0;
      }
      .content {
        background-color: white;
        padding: 25px;
        border-radius: 6px;
      }
      .warning {
        background-color: #fff3cd;
        border: 1px solid #ffc107;
        border-radius: 5px;
        padding: 15px;
        margin: 20px 0;
        color: #856404;
      }
      .info-box {
        background-color: #d1ecf1;
        border: 1px solid #17a2b8;
        border-radius: 5px;
        padding: 15px;
        margin: 20px 0;
        color: #0c5460;
      }
      .footer {
        margin-top: 30px;
        text-align: center;
        font-size: 12px;
        color: #7f8c8d;
      }
    </style>
  </head>
  <body>
    <div class="container">
      <div class="header">
        <h1>Subscription Canceled</h1>
      </div>
      <div class="content">
        <p>Hello,</p>
        <p>We're sorry to see you go. Your ${this.appName} subscription has been canceled.</p>

        <div class="warning">
          <strong>Your access will end on ${accessEndDate}.</strong>
          <p>You can continue to use all features until this date.</p>
        </div>

        <div class="info-box">
          <strong>Want to come back?</strong>
          <p>You can resubscribe or resume your subscription at any time from your account settings.</p>
        </div>

        <p>If you canceled by mistake or have any questions, please contact our support team. We're here to help!</p>
      </div>
      <div class="footer">
        <p>This is an automated message, please do not reply to this email.</p>
      </div>
    </div>
  </body>
</html>
    `.trim();
  }

  private generateSubscriptionCanceledText(subscription: Subscription): string {
    const accessEndDate = subscription.currentPeriodEnd.toLocaleDateString();

    return `
Hello,

We're sorry to see you go. Your ${this.appName} subscription has been canceled.

Your access will end on ${accessEndDate}. You can continue to use all features until this date.

Want to come back?
You can resubscribe or resume your subscription at any time from your account settings.

If you canceled by mistake or have any questions, please contact our support team. We're here to help!

---
This is an automated message, please do not reply to this email.
    `.trim();
  }
}

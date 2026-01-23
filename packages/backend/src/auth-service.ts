import * as bcrypt from 'bcryptjs';
import * as jwt from 'jsonwebtoken';
import * as crypto from 'crypto';
import {
  AuthError,
  AuthErrorCodes,
  type DatabaseAdapter,
  type EmailAdapter,
  type AuthConfig,
  type User,
  type AuthTokens,
  type RegisterInput,
  type LoginInput,
  type VerifyEmailInput,
  type PasswordResetRequestInput,
  type PasswordResetInput,
} from '@authpaddle/core';

export interface AuthServiceConfig {
  auth: AuthConfig;
  database: DatabaseAdapter;
  email: EmailAdapter;
  requireEmailVerification?: boolean;
}

export interface TokenValidationResult {
  valid: boolean;
  userId?: string;
}

const SALT_ROUNDS = 10;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export class AuthService {
  private config: AuthConfig;
  private db: DatabaseAdapter;
  private emailAdapter: EmailAdapter;
  private requireEmailVerification: boolean;

  constructor(serviceConfig: AuthServiceConfig) {
    this.config = serviceConfig.auth;
    this.db = serviceConfig.database;
    this.emailAdapter = serviceConfig.email;
    this.requireEmailVerification = serviceConfig.requireEmailVerification ?? false;
  }

  async register(input: RegisterInput): Promise<{ user: User; tokens: AuthTokens }> {
    const email = input.email.toLowerCase().trim();

    // Validate email format
    if (!EMAIL_REGEX.test(email)) {
      throw new AuthError('Invalid email format', AuthErrorCodes.INVALID_CREDENTIALS, 400);
    }

    // Validate password strength
    const minLength = this.config.passwordMinLength ?? 8;
    if (input.password.length < minLength) {
      throw new AuthError(
        `Password must be at least ${minLength} characters`,
        AuthErrorCodes.WEAK_PASSWORD,
        400
      );
    }

    // Check if user exists
    const existingUser = await this.db.getUserByEmail(email);
    if (existingUser) {
      throw new AuthError('User already exists', AuthErrorCodes.USER_EXISTS, 409);
    }

    // Hash password
    const passwordHash = await bcrypt.hash(input.password, SALT_ROUNDS);

    // Create user
    const user = await this.db.createUser(email, passwordHash);

    // Generate and store verification token
    const verificationToken = this.generateToken();
    const verificationExpiry = new Date(Date.now() + this.config.verificationTokenExpiresIn);
    await this.db.setVerificationToken(user.id, verificationToken, verificationExpiry);

    // Send verification email
    const verifyUrl = `${this.config.baseUrl}/verify-email/${verificationToken}`;
    await this.emailAdapter.sendVerificationEmail(email, verificationToken, verifyUrl);

    // Generate auth tokens
    const tokens = this.generateAuthTokens(user.id);

    return { user, tokens };
  }

  async login(input: LoginInput): Promise<{ user: User; tokens: AuthTokens }> {
    const email = input.email.toLowerCase().trim();

    // Find user
    const user = await this.db.getUserByEmail(email);
    if (!user) {
      throw new AuthError('Invalid credentials', AuthErrorCodes.INVALID_CREDENTIALS, 401);
    }

    // Verify password
    const passwordHash = await this.db.getPasswordHash(user.id);
    if (!passwordHash) {
      throw new AuthError('Invalid credentials', AuthErrorCodes.INVALID_CREDENTIALS, 401);
    }

    const isValid = await bcrypt.compare(input.password, passwordHash);
    if (!isValid) {
      throw new AuthError('Invalid credentials', AuthErrorCodes.INVALID_CREDENTIALS, 401);
    }

    // Check email verification if required
    if (this.requireEmailVerification && !user.emailVerified) {
      throw new AuthError('Email not verified', AuthErrorCodes.EMAIL_NOT_VERIFIED, 403);
    }

    // Generate auth tokens
    const tokens = this.generateAuthTokens(user.id);

    return { user, tokens };
  }

  async verifyEmail(input: VerifyEmailInput): Promise<{ user: User }> {
    const user = await this.db.getUserByVerificationToken(input.token);
    if (!user) {
      throw new AuthError('Invalid or expired token', AuthErrorCodes.INVALID_TOKEN, 400);
    }

    // Mark email as verified
    const updatedUser = await this.db.updateUser(user.id, { emailVerified: true });

    // Clear verification token
    await this.db.clearVerificationToken(user.id);

    return { user: updatedUser };
  }

  async resendVerificationEmail(email: string): Promise<void> {
    const normalizedEmail = email.toLowerCase().trim();
    const user = await this.db.getUserByEmail(normalizedEmail);

    // Silently return if user doesn't exist (security - don't reveal user existence)
    if (!user) {
      return;
    }

    // Don't resend if already verified
    if (user.emailVerified) {
      throw new AuthError('Email already verified', AuthErrorCodes.INVALID_TOKEN, 400);
    }

    // Generate new verification token
    const verificationToken = this.generateToken();
    const verificationExpiry = new Date(Date.now() + this.config.verificationTokenExpiresIn);
    await this.db.setVerificationToken(user.id, verificationToken, verificationExpiry);

    // Send verification email
    const verifyUrl = `${this.config.baseUrl}/verify-email/${verificationToken}`;
    await this.emailAdapter.sendVerificationEmail(normalizedEmail, verificationToken, verifyUrl);
  }

  async requestPasswordReset(input: PasswordResetRequestInput): Promise<void> {
    const email = input.email.toLowerCase().trim();
    const user = await this.db.getUserByEmail(email);

    // Silently return if user doesn't exist (security - don't reveal user existence)
    if (!user) {
      return;
    }

    // Generate reset token
    const resetToken = this.generateToken();
    const resetExpiry = new Date(Date.now() + this.config.passwordResetTokenExpiresIn);
    await this.db.setPasswordResetToken(user.id, resetToken, resetExpiry);

    // Send reset email
    const resetUrl = `${this.config.baseUrl}/reset-password/${resetToken}`;
    await this.emailAdapter.sendPasswordResetEmail(email, resetToken, resetUrl);
  }

  async resetPassword(input: PasswordResetInput): Promise<void> {
    const user = await this.db.getUserByPasswordResetToken(input.token);
    if (!user) {
      throw new AuthError('Invalid or expired token', AuthErrorCodes.INVALID_TOKEN, 400);
    }

    // Validate password strength
    const minLength = this.config.passwordMinLength ?? 8;
    if (input.newPassword.length < minLength) {
      throw new AuthError(
        `Password must be at least ${minLength} characters`,
        AuthErrorCodes.WEAK_PASSWORD,
        400
      );
    }

    // Hash new password
    const passwordHash = await bcrypt.hash(input.newPassword, SALT_ROUNDS);
    await this.db.setPasswordHash(user.id, passwordHash);

    // Clear reset token
    await this.db.clearPasswordResetToken(user.id);
  }

  async changePassword(
    userId: string,
    input: { currentPassword: string; newPassword: string }
  ): Promise<void> {
    // Verify current password
    const passwordHash = await this.db.getPasswordHash(userId);
    if (!passwordHash) {
      throw new AuthError('User not found', AuthErrorCodes.USER_NOT_FOUND, 404);
    }

    const isValid = await bcrypt.compare(input.currentPassword, passwordHash);
    if (!isValid) {
      throw new AuthError('Invalid current password', AuthErrorCodes.INVALID_CREDENTIALS, 401);
    }

    // Validate new password strength
    const minLength = this.config.passwordMinLength ?? 8;
    if (input.newPassword.length < minLength) {
      throw new AuthError(
        `Password must be at least ${minLength} characters`,
        AuthErrorCodes.WEAK_PASSWORD,
        400
      );
    }

    // Hash and save new password
    const newPasswordHash = await bcrypt.hash(input.newPassword, SALT_ROUNDS);
    await this.db.setPasswordHash(userId, newPasswordHash);
  }

  async validateToken(token: string): Promise<TokenValidationResult> {
    try {
      const decoded = jwt.verify(token, this.config.jwtSecret) as { userId: string };
      return { valid: true, userId: decoded.userId };
    } catch {
      return { valid: false };
    }
  }

  async getUserFromToken(token: string): Promise<User | null> {
    const validation = await this.validateToken(token);
    if (!validation.valid || !validation.userId) {
      return null;
    }
    return this.db.getUserById(validation.userId);
  }

  private generateAuthTokens(userId: string): AuthTokens {
    const expiresIn = this.parseExpiresIn(this.config.jwtExpiresIn);
    const expiresAt = new Date(Date.now() + expiresIn);

    const accessToken = jwt.sign({ userId }, this.config.jwtSecret, {
      expiresIn: this.config.jwtExpiresIn,
    });

    return { accessToken, expiresAt };
  }

  private generateToken(): string {
    return crypto.randomBytes(32).toString('hex');
  }

  private parseExpiresIn(expiresIn: string): number {
    const match = expiresIn.match(/^(\d+)(ms|s|m|h|d)$/);
    if (!match) {
      return 7 * 24 * 60 * 60 * 1000; // Default 7 days
    }

    const value = parseInt(match[1], 10);
    const unit = match[2];

    switch (unit) {
      case 'ms':
        return value;
      case 's':
        return value * 1000;
      case 'm':
        return value * 60 * 1000;
      case 'h':
        return value * 60 * 60 * 1000;
      case 'd':
        return value * 24 * 60 * 60 * 1000;
      default:
        return 7 * 24 * 60 * 60 * 1000;
    }
  }
}

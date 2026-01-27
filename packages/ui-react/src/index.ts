// Re-export core types
export * from '@subauth/ui-core';

// Primitives
export { Button } from './primitives/Button';
export type { ButtonProps } from './primitives/Button';

export { Input } from './primitives/Input';
export type { InputProps } from './primitives/Input';

export { Label } from './primitives/Label';
export type { LabelProps } from './primitives/Label';

export { Alert } from './primitives/Alert';
export type { AlertProps } from './primitives/Alert';

export { Spinner } from './primitives/Spinner';
export type { SpinnerProps } from './primitives/Spinner';

export { Card, CardHeader, CardContent, CardFooter, CardTitle, CardDescription } from './primitives/Card';
export type { CardProps } from './primitives/Card';

export { FormField } from './primitives/FormField';
export type { FormFieldProps } from './primitives/FormField';

// Auth Forms
export { LoginForm } from './auth/LoginForm';
export type { LoginFormProps } from './auth/LoginForm';

export { RegisterForm } from './auth/RegisterForm';
export type { RegisterFormProps } from './auth/RegisterForm';

export { ForgotPasswordForm } from './auth/ForgotPasswordForm';
export type { ForgotPasswordFormProps } from './auth/ForgotPasswordForm';

export { ResendVerificationForm } from './auth/ResendVerificationForm';
export type { ResendVerificationFormProps } from './auth/ResendVerificationForm';

export { ResetPasswordForm } from './auth/ResetPasswordForm';
export type { ResetPasswordFormProps } from './auth/ResetPasswordForm';

export { VerifyEmailCard } from './auth/VerifyEmailCard';
export type { VerifyEmailCardProps } from './auth/VerifyEmailCard';

export { AuthLayout } from './auth/AuthLayout';
export type { AuthLayoutProps } from './auth/AuthLayout';

// Subscription Components
export { PricingCard } from './subscription/PricingCard';
export type { PricingCardProps } from './subscription/PricingCard';

export { PricingGrid } from './subscription/PricingGrid';
export type { PricingGridProps } from './subscription/PricingGrid';

export { SubscriptionStatus } from './subscription/SubscriptionStatus';
export type { SubscriptionStatusProps } from './subscription/SubscriptionStatus';

export { TrialBanner } from './subscription/TrialBanner';
export type { TrialBannerProps } from './subscription/TrialBanner';

export { FeatureList } from './subscription/FeatureList';
export type { FeatureListProps } from './subscription/FeatureList';

// Hooks
export { useAuthClient } from './hooks/useAuthClient';
export { useSubscriptionClient } from './hooks/useSubscriptionClient';

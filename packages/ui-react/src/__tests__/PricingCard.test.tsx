import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { PricingCard } from '../subscription/PricingCard';

describe('PricingCard', () => {
  const defaultProps = {
    name: 'Pro',
    price: 9.99,
    interval: 'month' as const,
    features: ['Feature 1', 'Feature 2', 'Feature 3'],
    onSelect: vi.fn(),
  };

  it('should render plan name', () => {
    render(<PricingCard {...defaultProps} />);
    expect(screen.getByText('Pro')).toBeInTheDocument();
  });

  it('should render price with currency', () => {
    render(<PricingCard {...defaultProps} />);
    expect(screen.getByText('$')).toBeInTheDocument();
    expect(screen.getByText('9.99')).toBeInTheDocument();
    expect(screen.getByText('/month')).toBeInTheDocument();
  });

  it('should render features', () => {
    render(<PricingCard {...defaultProps} />);
    expect(screen.getByText('Feature 1')).toBeInTheDocument();
    expect(screen.getByText('Feature 2')).toBeInTheDocument();
    expect(screen.getByText('Feature 3')).toBeInTheDocument();
  });

  it('should call onSelect when button is clicked', () => {
    const onSelect = vi.fn();
    render(<PricingCard {...defaultProps} onSelect={onSelect} />);

    fireEvent.click(screen.getByRole('button'));
    expect(onSelect).toHaveBeenCalledTimes(1);
  });

  it('should show highlighted style when highlighted prop is true', () => {
    render(<PricingCard {...defaultProps} highlighted />);
    expect(screen.getByText('Pro').closest('.subauth-pricing-card')).toHaveClass(
      'subauth-pricing-card--highlighted'
    );
  });

  it('should show badge when badge prop is provided', () => {
    render(<PricingCard {...defaultProps} badge="Popular" />);
    expect(screen.getByText('Popular')).toBeInTheDocument();
  });

  it('should show description when provided', () => {
    render(<PricingCard {...defaultProps} description="Best for small teams" />);
    expect(screen.getByText('Best for small teams')).toBeInTheDocument();
  });

  it('should handle yearly interval', () => {
    render(<PricingCard {...defaultProps} interval="year" price={99} />);
    expect(screen.getByText('$')).toBeInTheDocument();
    expect(screen.getByText('99')).toBeInTheDocument();
    expect(screen.getByText('/year')).toBeInTheDocument();
  });

  it('should show current indicator when current prop is true', () => {
    render(<PricingCard {...defaultProps} current />);
    expect(screen.getByText(/current plan/i)).toBeInTheDocument();
  });
});

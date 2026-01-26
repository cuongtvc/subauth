import { cn } from '@subauth/ui-core';

export interface FeatureListProps {
  features: string[];
  className?: string;
}

export function FeatureList({ features, className }: FeatureListProps) {
  return (
    <ul className={cn('subauth-feature-list', className)}>
      {features.map((feature, index) => (
        <li key={index} className="subauth-feature-item">
          <svg
            className="subauth-feature-check"
            width="16"
            height="16"
            viewBox="0 0 16 16"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M13.25 4.75L6 12L2.75 8.75" />
          </svg>
          <span>{feature}</span>
        </li>
      ))}
    </ul>
  );
}

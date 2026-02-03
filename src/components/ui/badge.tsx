import { ReactNode } from 'react';
import { PerformanceRating } from '@/types/webinar';

interface BadgeProps {
  children: ReactNode;
  variant?: 'default' | 'success' | 'warning' | 'error' | 'info';
  className?: string;
}

const variantStyles = {
  default: 'bg-gray-100 text-gray-800',
  success: 'bg-green-100 text-green-800',
  warning: 'bg-yellow-100 text-yellow-800',
  error: 'bg-red-100 text-red-800',
  info: 'bg-blue-100 text-blue-800',
};

export function Badge({ children, variant = 'default', className = '' }: BadgeProps) {
  return (
    <span
      className={`
        inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium
        ${variantStyles[variant]}
        ${className}
      `}
    >
      {children}
    </span>
  );
}

interface PerformanceBadgeProps {
  rating: PerformanceRating;
}

const ratingVariants: Record<PerformanceRating, BadgeProps['variant']> = {
  excellent: 'success',
  good: 'info',
  average: 'warning',
  poor: 'error',
};

const ratingLabels: Record<PerformanceRating, string> = {
  excellent: 'Excellent',
  good: 'Good',
  average: 'Average',
  poor: 'Needs Work',
};

export function PerformanceBadge({ rating }: PerformanceBadgeProps) {
  return <Badge variant={ratingVariants[rating]}>{ratingLabels[rating]}</Badge>;
}

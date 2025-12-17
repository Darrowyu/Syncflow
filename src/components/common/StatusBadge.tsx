import React from 'react';

type BadgeVariant = 'success' | 'warning' | 'danger' | 'info' | 'neutral';

interface StatusBadgeProps {
  text: string;
  variant?: BadgeVariant;
  className?: string;
}

const variantStyles: Record<BadgeVariant, string> = {
  success: 'bg-green-100 text-green-600',
  warning: 'bg-amber-100 text-amber-700',
  danger: 'bg-red-100 text-red-600',
  info: 'bg-indigo-50 text-indigo-700',
  neutral: 'bg-slate-100 text-slate-600',
};

export const StatusBadge: React.FC<StatusBadgeProps> = ({ text, variant = 'neutral', className = '' }) => (
  <span className={`px-2 py-0.5 rounded text-xs font-medium ${variantStyles[variant]} ${className}`}>{text}</span>
);

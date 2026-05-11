import { type ReactNode } from 'react';
import { cn } from '@utils/cn';

type BadgeVariant = 'neutral' | 'accent' | 'success' | 'warning' | 'danger';

const variantClass: Record<BadgeVariant, string> = {
  neutral: 'border-white/10 text-ink-200 bg-white/5',
  accent:  'border-accent/40 text-accent-glow bg-accent/10 shadow-glow-sm',
  success: 'border-success/40 text-success bg-success/10',
  warning: 'border-warning/40 text-warning bg-warning/10',
  danger:  'border-danger/40 text-danger bg-danger/10',
};

interface BadgeProps {
  children: ReactNode;
  variant?: BadgeVariant;
  className?: string;
}

export function Badge({ children, variant = 'neutral', className }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[0.7rem] font-medium uppercase tracking-[0.12em]',
        variantClass[variant],
        className,
      )}
    >
      {children}
    </span>
  );
}

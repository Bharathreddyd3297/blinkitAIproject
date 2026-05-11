import { type HTMLAttributes } from 'react';
import { cn } from '@utils/cn';

interface SkeletonProps extends HTMLAttributes<HTMLDivElement> {
  /** Predefined common shapes; you can still override with className. */
  variant?: 'text' | 'avatar' | 'thumb' | 'card' | 'pill';
}

const variantClass: Record<NonNullable<SkeletonProps['variant']>, string> = {
  text:   'h-3 w-full rounded-md',
  avatar: 'h-10 w-10 rounded-full',
  thumb:  'h-32 w-full rounded-2xl',
  card:   'h-56 w-full rounded-3xl',
  pill:   'h-6 w-20 rounded-full',
};

/**
 * Single shimmer primitive. Compose these into bespoke skeletons per page —
 * don't reach for a library, the design system already has its own
 * shimmer keyframe (see globals.css `.skeleton`).
 */
export function Skeleton({ variant = 'text', className, ...rest }: SkeletonProps) {
  return <div className={cn('skeleton', variantClass[variant], className)} {...rest} />;
}

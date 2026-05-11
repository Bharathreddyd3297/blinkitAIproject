import { motion, type HTMLMotionProps } from 'framer-motion';
import { forwardRef, type ReactNode } from 'react';
import { cn } from '@utils/cn';

interface GlassCardProps extends HTMLMotionProps<'div'> {
  children: ReactNode;
  interactive?: boolean;
  intensity?: 'faint' | 'default' | 'strong';
}

const intensityClass: Record<NonNullable<GlassCardProps['intensity']>, string> = {
  faint:   'glass-faint',
  default: 'glass',
  strong:  'glass-strong',
};

export const GlassCard = forwardRef<HTMLDivElement, GlassCardProps>(
  ({ children, interactive, intensity = 'default', className, ...rest }, ref) => (
    <motion.div
      ref={ref}
      whileHover={interactive ? { y: -3 } : undefined}
      transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
      className={cn(
        'rounded-2xl p-5',
        intensityClass[intensity],
        interactive && 'cursor-pointer transition-shadow hover:shadow-glow-sm',
        className,
      )}
      {...rest}
    >
      {children}
    </motion.div>
  ),
);
GlassCard.displayName = 'GlassCard';

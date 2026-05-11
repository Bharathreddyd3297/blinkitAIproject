import { motion } from 'framer-motion';
import { type ReactNode } from 'react';
import { ArrowLeft, ArrowRight } from 'lucide-react';

import { Button } from '@components/primitives/Button';
import { GlassCard } from '@components/primitives/GlassCard';
import { cn } from '@utils/cn';

interface StepShellProps {
  eyebrow: string;
  title: ReactNode;
  description?: ReactNode;
  children: ReactNode;
  /** Footer is custom — most steps use it for forward/back nav. */
  footer?: ReactNode;
  /** Reduce visual weight when the step has its own panels inside. */
  flat?: boolean;
}

/**
 * Shared shell for every checkout step. Animates in with a soft blur-rise
 * (matches the rest of the app's PageTransition), keeps spacing consistent,
 * and exposes a footer slot so each step can choose its own nav buttons.
 *
 * Why not a single big switch in CheckoutPage? Because steps differ in
 * footer layout, validation rules, and what "next" actually does. Sharing
 * the shell while keeping the step components autonomous is simpler.
 */
export function StepShell({
  eyebrow,
  title,
  description,
  children,
  footer,
  flat,
}: StepShellProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12, filter: 'blur(6px)' }}
      animate={{ opacity: 1, y: 0,  filter: 'blur(0px)' }}
      exit={{ opacity: 0, y: -8, filter: 'blur(4px)' }}
      transition={{ duration: 0.42, ease: [0.16, 1, 0.3, 1] }}
      className={cn('flex flex-col gap-6', flat && 'gap-4')}
    >
      <header>
        <p className="eyebrow mb-2">{eyebrow}</p>
        <h2 className="font-display text-2xl font-semibold tracking-tight text-white md:text-3xl">
          {title}
        </h2>
        {description && <p className="mt-2 text-sm text-ink-300">{description}</p>}
      </header>

      {flat ? children : <GlassCard intensity="default" className="p-6 md:p-7">{children}</GlassCard>}

      {footer && <div className="flex items-center justify-between">{footer}</div>}
    </motion.div>
  );
}

/**
 * Standard back/next pair used by most steps. Either button can be hidden
 * by passing `null` for the corresponding handler.
 */
export function StepFooter({
  onBack,
  onNext,
  nextLabel = 'Continue',
  nextDisabled,
  loading,
}: {
  onBack?: (() => void) | null;
  onNext?: (() => void) | null;
  nextLabel?: string;
  nextDisabled?: boolean;
  loading?: boolean;
}) {
  return (
    <>
      {onBack ? (
        <Button variant="ghost" iconLeft={<ArrowLeft size={14} />} onClick={onBack}>
          Back
        </Button>
      ) : (
        <span /* spacer */ />
      )}
      {onNext ? (
        <Button
          iconRight={<ArrowRight size={14} />}
          onClick={onNext}
          disabled={nextDisabled || loading}
        >
          {loading ? 'Processing…' : nextLabel}
        </Button>
      ) : null}
    </>
  );
}

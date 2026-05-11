import { motion } from 'framer-motion';
import { Check } from 'lucide-react';

import { STEP_ORDER, type CheckoutStep } from '@store/slices/checkoutSlice';
import { cn } from '@utils/cn';

const LABELS: Record<CheckoutStep, string> = {
  review:       'Review',
  shipping:     'Shipping',
  delivery:     'Delivery',
  payment:      'Payment',
  confirmation: 'Done',
};

interface CheckoutStepperProps {
  current: CheckoutStep;
}

/**
 * Animated step indicator across the top of the checkout flow.
 *
 * Each node has three states — past (filled with check), current (glowing
 * accent ring), future (subtle border). The connecting line fills with the
 * accent gradient as steps complete; the fill width is animated so users
 * feel the progress, not just see it.
 *
 * On mobile, labels collapse to circles only — staying legible without
 * eating into the actual form area.
 */
export function CheckoutStepper({ current }: CheckoutStepperProps) {
  const idx = STEP_ORDER.indexOf(current);
  const total = STEP_ORDER.length;
  // Don't divide by zero on the edge case of a single step
  const progress = total > 1 ? idx / (total - 1) : 0;

  return (
    <div className="relative">
      {/* Track */}
      <div className="absolute left-4 right-4 top-4 h-[2px] -translate-y-1/2 rounded-full bg-white/8" />

      {/* Filled track */}
      <motion.div
        className="absolute left-4 top-4 h-[2px] -translate-y-1/2 rounded-full bg-gradient-to-r from-neon-cyan via-accent to-neon-magenta shadow-glow-sm"
        style={{ right: `calc(${(1 - progress) * 100}% + 1rem)` }}
        animate={{ right: `calc(${(1 - progress) * 100}% + 1rem)` }}
        transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
      />

      <ol className="relative flex items-start justify-between">
        {STEP_ORDER.map((step, i) => {
          const isPast    = i < idx;
          const isCurrent = i === idx;
          return (
            <li key={step} className="flex flex-1 flex-col items-center">
              <motion.div
                layout
                className={cn(
                  'relative grid h-8 w-8 place-items-center rounded-full border text-[0.7rem] font-semibold transition-colors',
                  isPast    && 'border-accent bg-accent text-white shadow-glow-sm',
                  isCurrent && 'border-accent/70 bg-ink-900 text-white shadow-glow-sm',
                  !isPast && !isCurrent && 'border-white/15 bg-ink-900 text-ink-300',
                )}
              >
                {isCurrent && (
                  <motion.span
                    layoutId="step-active-ring"
                    className="absolute inset-[-3px] rounded-full ring-2 ring-accent/60"
                    transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
                  />
                )}
                <span className="relative">
                  {isPast ? <Check size={13} /> : i + 1}
                </span>
              </motion.div>
              <span
                className={cn(
                  'mt-2 hidden text-[0.7rem] font-medium uppercase tracking-[0.14em] sm:block',
                  isCurrent ? 'text-white' : isPast ? 'text-ink-100' : 'text-ink-300',
                )}
              >
                {LABELS[step]}
              </span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

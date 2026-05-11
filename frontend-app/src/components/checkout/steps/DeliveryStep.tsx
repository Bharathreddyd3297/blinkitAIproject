import { motion } from 'framer-motion';
import { Calendar, CheckCircle2, Truck, Zap } from 'lucide-react';

import { useAppDispatch, useAppSelector } from '@store/hooks';
import {
  DELIVERY_OPTIONS,
  setDelivery,
  type DeliverySpeed,
} from '@store/slices/checkoutSlice';
import { StepFooter, StepShell } from '@components/checkout/StepShell';
import { cn } from '@utils/cn';

interface DeliveryStepProps {
  onBack: () => void;
  onNext: () => void;
}

const ICONS: Record<DeliverySpeed, React.ReactNode> = {
  express:   <Zap size={16} />,
  standard:  <Truck size={16} />,
  scheduled: <Calendar size={16} />,
};

const ACCENTS: Record<DeliverySpeed, string> = {
  express:   'text-neon-cyan',
  standard:  'text-accent-glow',
  scheduled: 'text-neon-magenta',
};

/**
 * Delivery speed selector. Animated radio cards — selected card lifts and
 * gains a glowing ring; the unselected ones stay calm. Active card uses a
 * shared `layoutId` so the highlight animates smoothly between selections.
 */
export function DeliveryStep({ onBack, onNext }: DeliveryStepProps) {
  const dispatch = useAppDispatch();
  const selected = useAppSelector((s) => s.checkout.delivery);

  return (
    <StepShell
      eyebrow="Step 3 · Delivery"
      title="How fast do you want it?"
      description="ETAs come from the order-service. Express uses our nearest-warehouse routing."
      footer={<StepFooter onBack={onBack} onNext={onNext} />}
    >
      <div className="grid gap-3 md:grid-cols-3">
        {DELIVERY_OPTIONS.map((opt) => {
          const active = selected === opt.speed;
          return (
            <motion.button
              key={opt.speed}
              type="button"
              onClick={() => dispatch(setDelivery(opt.speed))}
              whileHover={{ y: -2 }}
              whileTap={{ scale: 0.985 }}
              className={cn(
                'relative overflow-hidden rounded-2xl border p-5 text-left transition',
                active
                  ? 'border-accent/55 bg-white/[0.05] shadow-glow-sm'
                  : 'border-white/10 bg-white/[0.02] hover:border-white/25',
              )}
            >
              {active && (
                <motion.span
                  layoutId="delivery-active-ring"
                  className="pointer-events-none absolute inset-0 rounded-2xl ring-1 ring-accent/50"
                  transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
                />
              )}
              <div className="relative flex items-start justify-between">
                <div className={cn('grid h-9 w-9 place-items-center rounded-xl border border-white/10 bg-ink-900/60', ACCENTS[opt.speed])}>
                  {ICONS[opt.speed]}
                </div>
                {active && <CheckCircle2 size={18} className="text-accent-glow" />}
              </div>
              <p className="mt-4 font-display text-base font-semibold text-white">
                {opt.label}
              </p>
              <p className="mt-1 text-[0.78rem] text-ink-200">{opt.eta}</p>
              <p className="mt-3 text-xs text-ink-300">{opt.description}</p>
              <p className="mt-4 text-[0.72rem] uppercase tracking-[0.14em] text-ink-300">
                {opt.price === 0 ? 'Free' : `₹${opt.price}`}
              </p>
            </motion.button>
          );
        })}
      </div>
    </StepShell>
  );
}

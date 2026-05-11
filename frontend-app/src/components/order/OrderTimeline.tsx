import { motion } from 'framer-motion';
import {
  CheckCircle2,
  CircleDot,
  Clock,
  Package,
  PackageCheck,
  Truck,
  type LucideIcon,
} from 'lucide-react';

import type { OrderStatus } from '@app-types/domain';
import { cn } from '@utils/cn';

const STAGES: {
  key: OrderStatus;
  label: string;
  caption: string;
  icon: LucideIcon;
}[] = [
  { key: 'CONFIRMED',         label: 'Order confirmed',  caption: 'Payment cleared at the gateway',  icon: CheckCircle2 },
  { key: 'PACKED',            label: 'Packed',           caption: 'Sealed and ready',                icon: Package },
  { key: 'OUT_FOR_DELIVERY',  label: 'Out for delivery', caption: 'On the way to your door',         icon: Truck },
  { key: 'DELIVERED',         label: 'Delivered',        caption: 'Enjoy â€” and rate your courier',   icon: PackageCheck },
];

const ORDER_INDEX: Record<OrderStatus, number> = {
  PENDING:           -1,
  CONFIRMED:          0,
  PACKED:             1,
  OUT_FOR_DELIVERY:   2,
  DELIVERED:          3,
  CANCELLED:         -1,
};

interface OrderTimelineProps {
  status: OrderStatus;
  /** Optional ISO timestamps, shown next to each completed stage. */
  timestamps?: Partial<Record<OrderStatus, string>>;
}

/**
 * Vertical timeline of the four real shipping stages.
 *
 * The connecting rail starts as a faint white track. As the status
 * progresses, the active rail (gradient) animates its height down to the
 * current stage. Past stages get a checked badge; the current stage glows;
 * future stages stay quiet.
 *
 * CANCELLED orders short-circuit and render a single danger row instead of
 * the timeline â€” completed stages are meaningless once an order is killed.
 */
export function OrderTimeline({ status, timestamps }: OrderTimelineProps) {
  if (status === 'CANCELLED') {
    return (
      <div className="rounded-2xl border border-danger/40 bg-danger/10 p-4 text-sm text-danger">
        This order was cancelled. No further updates are expected.
      </div>
    );
  }

  const currentIdx = ORDER_INDEX[status];
  // 0 â†’ just confirmed, 3 â†’ delivered. Convert to a fill-height percentage.
  const progress = STAGES.length > 1 ? Math.max(0, currentIdx) / (STAGES.length - 1) : 0;

  return (
    <ol className="relative pl-8">
      {/* Track */}
      <div className="absolute left-[14px] top-1 h-full w-[2px] rounded-full bg-white/8" />
      {/* Filled track */}
      <motion.div
        className="absolute left-[14px] top-1 w-[2px] rounded-full bg-gradient-to-b from-neon-cyan via-accent to-neon-magenta shadow-glow-sm"
        initial={{ height: 0 }}
        animate={{ height: `${progress * 100}%` }}
        transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
      />

      {STAGES.map((stage, i) => {
        const isPast    = i < currentIdx;
        const isCurrent = i === currentIdx;
        const Icon      = stage.icon;
        const ts        = timestamps?.[stage.key];

        return (
          <li key={stage.key} className="relative pb-7 last:pb-0">
            <div
              className={cn(
                'absolute -left-[28px] top-0 grid h-7 w-7 place-items-center rounded-full border bg-ink-900 transition-colors',
                isPast    && 'border-accent text-accent-glow shadow-glow-sm',
                isCurrent && 'border-accent/70 text-white',
                !isPast && !isCurrent && 'border-white/12 text-ink-300',
              )}
            >
              {isCurrent && (
                <motion.span
                  layoutId="order-timeline-active"
                  className="absolute inset-[-4px] rounded-full ring-2 ring-accent/50"
                  transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
                />
              )}
              {isPast ? <CheckCircle2 size={13} /> : isCurrent ? <CircleDot size={13} /> : <Icon size={13} />}
            </div>

            <p className={cn(
              'font-display text-base font-semibold',
              (isPast || isCurrent) ? 'text-white' : 'text-ink-300',
            )}>
              {stage.label}
            </p>
            <p className="text-[0.78rem] text-ink-300">{stage.caption}</p>
            {ts && (
              <p className="mt-1 inline-flex items-center gap-1.5 text-[0.7rem] text-ink-300">
                <Clock size={10} />
                {new Date(ts).toLocaleString(undefined, {
                  weekday: 'short',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </p>
            )}
          </li>
        );
      })}
    </ol>
  );
}

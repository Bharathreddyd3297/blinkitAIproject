import { AnimatePresence, motion } from 'framer-motion';
import { useEffect } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Info,
  ShieldAlert,
  X,
} from 'lucide-react';

import { useAppDispatch, useAppSelector } from '@store/hooks';
import { dismissToast, type Toast } from '@store/slices/uiSlice';
import { cn } from '@utils/cn';

const VARIANT: Record<Toast['variant'], { icon: React.ReactNode; ring: string; bar: string }> = {
  info:    { icon: <Info size={15} />,           ring: 'ring-info/40',    bar: 'bg-info' },
  success: { icon: <CheckCircle2 size={15} />,   ring: 'ring-success/40', bar: 'bg-success' },
  warning: { icon: <AlertTriangle size={15} />,  ring: 'ring-warning/40', bar: 'bg-warning' },
  error:   { icon: <ShieldAlert size={15} />,    ring: 'ring-danger/40',  bar: 'bg-danger' },
};

const DEFAULT_DURATION_MS = 4200;

/**
 * Glass toast host. Mounted once at the layout root; reads from `ui.toasts`.
 * New toasts animate in from the bottom-right, stack neatly, and auto-dismiss
 * after their `durationMs`. The variant bar at the top is the only colour
 * cue — the rest stays dark + glass to match the app aesthetic.
 */
export function Toaster() {
  const toasts = useAppSelector((s) => s.ui.toasts);

  return (
    <div
      aria-live="polite"
      aria-atomic="false"
      className="pointer-events-none fixed bottom-6 right-6 z-[70] flex w-full max-w-sm flex-col gap-3"
    >
      <AnimatePresence initial={false}>
        {toasts.map((t) => (
          <ToastItem key={t.id} toast={t} />
        ))}
      </AnimatePresence>
    </div>
  );
}

function ToastItem({ toast }: { toast: Toast }) {
  const dispatch = useAppDispatch();
  const v = VARIANT[toast.variant];

  useEffect(() => {
    const ms = toast.durationMs ?? DEFAULT_DURATION_MS;
    const id = setTimeout(() => dispatch(dismissToast(toast.id)), ms);
    return () => clearTimeout(id);
  }, [toast.id, toast.durationMs, dispatch]);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 18, scale: 0.96 }}
      animate={{ opacity: 1, y: 0,  scale: 1 }}
      exit={{ opacity: 0, x: 24, transition: { duration: 0.22 } }}
      transition={{ duration: 0.32, ease: [0.16, 1, 0.3, 1] }}
      className={cn(
        'pointer-events-auto relative overflow-hidden rounded-2xl border border-white/10 bg-ink-900/80 p-4 pr-3 backdrop-blur-xl shadow-glass-lg ring-1',
        v.ring,
      )}
    >
      {/* Variant accent bar */}
      <div className={cn('absolute inset-x-0 top-0 h-[2px]', v.bar)} />
      <div className="flex items-start gap-3">
        <div className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-lg border border-white/10 bg-white/[0.04] text-white">
          {v.icon}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-white">{toast.title}</p>
          {toast.message && (
            <p className="mt-0.5 text-[0.78rem] text-ink-200">{toast.message}</p>
          )}
        </div>
        <button
          onClick={() => dispatch(dismissToast(toast.id))}
          className="grid h-7 w-7 shrink-0 place-items-center rounded-lg text-ink-300 transition hover:text-white"
          aria-label="Dismiss"
        >
          <X size={13} />
        </button>
      </div>
    </motion.div>
  );
}

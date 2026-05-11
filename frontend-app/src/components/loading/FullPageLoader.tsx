import { motion } from 'framer-motion';
import { Spinner } from '@components/loading/Spinner';

interface FullPageLoaderProps {
  label?: string;
}

/**
 * Used as the suspense fallback when something blocks the entire screen
 * (e.g. boot-time auth hydration). The animation is intentionally calm —
 * if a user sees this for >300ms it should still feel premium, not panicky.
 */
export function FullPageLoader({ label = 'Loading' }: FullPageLoaderProps) {
  return (
    <div className="fixed inset-0 z-[60] grid place-items-center bg-ink-950/70 backdrop-blur-md">
      <motion.div
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
        className="glass flex items-center gap-4 rounded-2xl px-6 py-5"
      >
        <Spinner size={22} />
        <div>
          <p className="font-display text-sm tracking-wide text-ink-50">{label}</p>
          <p className="text-[0.7rem] uppercase tracking-[0.18em] text-ink-300">
            Securing connection
          </p>
        </div>
      </motion.div>
    </div>
  );
}

import { AnimatePresence, motion } from 'framer-motion';
import { useEffect, useState } from 'react';
import { ShieldAlert, ShieldCheck } from 'lucide-react';

import { Button } from '@components/primitives/Button';

interface PaymentProcessingOverlayProps {
  status: 'processing' | 'failed' | 'idle' | 'succeeded';
  errorMessage?: string | null;
  onRetry?: () => void;
  onCancel?: () => void;
}

/**
 * Full-screen cinematic overlay during payment.
 *
 * Three phases:
 *   - processing: pulsing concentric rings + animated status copy
 *   - failed:     calm error card with retry / cancel
 *   - succeeded:  not rendered here — the orchestrator advances to the
 *                 confirmation step with its own celebration UX
 */
export function PaymentProcessingOverlay({
  status,
  errorMessage,
  onRetry,
  onCancel,
}: PaymentProcessingOverlayProps) {
  return (
    <AnimatePresence>
      {(status === 'processing' || status === 'failed') && (
        <motion.div
          key="payment-overlay"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
          className="fixed inset-0 z-[80] grid place-items-center bg-ink-950/72 backdrop-blur-md"
          role="status"
          aria-live="polite"
        >
          <motion.div
            initial={{ y: 16, scale: 0.96 }}
            animate={{ y: 0,  scale: 1 }}
            exit={{ y: 8, scale: 0.97 }}
            transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
            className="glass-strong w-[min(92vw,460px)] rounded-3xl p-8 text-center"
          >
            {status === 'processing' ? <Processing /> : <Failed message={errorMessage} onRetry={onRetry} onCancel={onCancel} />}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function Processing() {
  return (
    <>
      <div className="relative mx-auto h-24 w-24">
        {[0, 0.4, 0.8].map((delay) => (
          <motion.span
            key={delay}
            className="absolute inset-0 rounded-full ring-1 ring-accent/55"
            initial={{ scale: 0.4, opacity: 0.7 }}
            animate={{ scale: 1.4, opacity: 0 }}
            transition={{ duration: 1.6, repeat: Infinity, ease: 'easeOut', delay }}
          />
        ))}
        <motion.div
          className="absolute inset-3 grid place-items-center rounded-full border border-accent/45 bg-accent/15 text-accent-glow shadow-glow"
          animate={{ rotate: 360 }}
          transition={{ duration: 5, ease: 'linear', repeat: Infinity }}
        >
          <ShieldCheck size={26} />
        </motion.div>
      </div>

      <h2 className="mt-7 font-display text-xl font-semibold text-white">Securing payment</h2>
      <CyclingStatus />
      <p className="mt-6 text-[0.7rem] uppercase tracking-[0.18em] text-ink-300">
        TLS 1.3 · Tokenised · Audit-logged
      </p>
    </>
  );
}

const CYCLE = [
  'Tokenising card at the gateway…',
  'Confirming with the payment-service…',
  'Reserving inventory…',
  'Finalising order…',
];

/**
 * Cycles through reassuring status copy while the payment processes.
 * Single state index, single interval — simpler than orchestrating
 * stacked animations and cheaper to render.
 */
function CyclingStatus() {
  const [idx, setIdx] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setIdx((i) => (i + 1) % CYCLE.length), 1200);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="relative mt-2 h-5 overflow-hidden">
      <AnimatePresence mode="wait">
        <motion.span
          key={CYCLE[idx]}
          initial={{ y: 14, opacity: 0 }}
          animate={{ y: 0,  opacity: 1 }}
          exit={{ y: -14, opacity: 0 }}
          transition={{ duration: 0.32, ease: [0.16, 1, 0.3, 1] }}
          className="absolute inset-x-0 text-sm text-ink-200"
        >
          {CYCLE[idx]}
        </motion.span>
      </AnimatePresence>
    </div>
  );
}

function Failed({
  message,
  onRetry,
  onCancel,
}: {
  message?: string | null;
  onRetry?: () => void;
  onCancel?: () => void;
}) {
  return (
    <>
      <div className="mx-auto grid h-16 w-16 place-items-center rounded-2xl border border-danger/40 bg-danger/10 text-danger shadow-[0_0_28px_rgba(255,93,108,0.45)]">
        <ShieldAlert size={24} />
      </div>
      <h2 className="mt-5 font-display text-xl font-semibold text-white">Payment didn't go through</h2>
      <p className="mt-2 text-sm text-ink-300">
        {message ?? 'The payment-service rejected the transaction. No money has been moved.'}
      </p>
      <div className="mt-6 flex flex-col gap-2.5">
        {onRetry && <Button onClick={onRetry} fullWidth>Try again</Button>}
        {onCancel && (
          <Button variant="ghost" onClick={onCancel} fullWidth>
            Choose a different method
          </Button>
        )}
      </div>
      <p className="mt-5 text-[0.7rem] uppercase tracking-[0.18em] text-ink-300">
        Your cart is preserved. Try another method.
      </p>
    </>
  );
}

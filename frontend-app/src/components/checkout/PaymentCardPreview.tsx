import { motion } from 'framer-motion';
import { type CardDetails } from '@store/slices/checkoutSlice';
import { cn } from '@utils/cn';

interface PaymentCardPreviewProps {
  card: CardDetails;
}

/**
 * Live preview of the credit card the user is filling in.
 *
 * The card itself uses a animated mesh gradient background and a
 * `[transform-style:preserve-3d]` flip-ready container so we can later
 * animate to a CVC view on focus. For now, the digits + name + expiry
 * update in real time as the user types — that's the magic moment.
 */
export function PaymentCardPreview({ card }: PaymentCardPreviewProps) {
  const formatted = (card.number.replace(/\s+/g, '').match(/.{1,4}/g) ?? []).join(' ').padEnd(19, '•');
  const groups = formatted.split(' ').slice(0, 4);

  // Crude "brand" detection just for the badge — the real brand comes from
  // the gateway response, this is purely cosmetic.
  const brand = detectBrand(card.number);

  return (
    <motion.div
      initial={{ opacity: 0, y: 12, rotateX: -10 }}
      animate={{ opacity: 1, y: 0,  rotateX: 0 }}
      transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
      className="relative aspect-[1.6/1] w-full overflow-hidden rounded-3xl border border-white/10 bg-ink-900 p-6 shadow-glass-lg"
      style={{ perspective: 1200 }}
    >
      {/* Animated gradient backdrop */}
      <div className="absolute inset-0 bg-mesh bg-[length:200%_200%] animate-gradient-pan opacity-90" />
      <div className="absolute inset-0 bg-gradient-to-br from-ink-950/55 via-transparent to-transparent" />

      {/* Faint radial glow */}
      <div className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-accent/35 blur-3xl" />

      <div className="relative flex h-full flex-col">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2.5">
            <div className="grid h-8 w-10 place-items-center rounded-md border border-white/15 bg-gradient-to-br from-warning/80 to-warning/30 text-[0.65rem] font-semibold text-ink-950">
              EMV
            </div>
            <span className="text-[0.7rem] uppercase tracking-[0.2em] text-white/80">
              Blinkit · Card
            </span>
          </div>
          <span className={cn('font-display text-sm font-semibold', brand.text)}>
            {brand.label}
          </span>
        </div>

        <div className="mt-auto">
          <div className="flex items-center justify-between font-mono text-lg tracking-[0.25em] text-white">
            {groups.map((g, i) => (
              <span key={i} className="tabular-nums">{g}</span>
            ))}
          </div>

          <div className="mt-5 flex items-end justify-between gap-4">
            <div className="min-w-0">
              <p className="text-[0.65rem] uppercase tracking-[0.18em] text-white/60">
                Cardholder
              </p>
              <p className="mt-1 truncate font-mono text-sm uppercase tracking-wider text-white">
                {card.cardholder || 'YOUR NAME'}
              </p>
            </div>
            <div>
              <p className="text-[0.65rem] uppercase tracking-[0.18em] text-white/60">
                Expires
              </p>
              <p className="mt-1 font-mono text-sm tracking-wider text-white">
                {card.expiry || 'MM/YY'}
              </p>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

function detectBrand(number: string): { label: string; text: string } {
  const n = number.replace(/\s+/g, '');
  if (/^4/.test(n))         return { label: 'VISA',       text: 'text-white' };
  if (/^(5[1-5]|2[2-7])/.test(n)) return { label: 'MASTERCARD', text: 'text-warning' };
  if (/^3[47]/.test(n))     return { label: 'AMEX',       text: 'text-info' };
  if (/^6/.test(n))         return { label: 'DISCOVER',   text: 'text-success' };
  return { label: 'CARD', text: 'text-white/70' };
}

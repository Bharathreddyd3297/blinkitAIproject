import { AnimatePresence, motion } from 'framer-motion';
import { useMemo } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  Banknote,
  CreditCard,
  Lock,
  ShieldCheck,
  Smartphone,
  Wallet,
} from 'lucide-react';

import { useAppDispatch, useAppSelector } from '@store/hooks';
import {
  isCardValid,
  isUpiValid,
  setCard,
  setPaymentMethod,
  setUpiId,
  type PaymentMethod,
} from '@store/slices/checkoutSlice';
import { Input } from '@components/primitives/Input';
import { Button } from '@components/primitives/Button';
import { PaymentCardPreview } from '@components/checkout/PaymentCardPreview';
import { StepShell } from '@components/checkout/StepShell';
import { formatMoney } from '@utils/format';
import { cn } from '@utils/cn';

interface PaymentStepProps {
  onBack: () => void;
  onPay: () => void;
  loading: boolean;
}

const METHODS: {
  key: PaymentMethod;
  label: string;
  caption: string;
  icon: React.ReactNode;
}[] = [
  { key: 'card',   label: 'Credit / Debit card', caption: 'Visa, MC, Amex, RuPay',     icon: <CreditCard size={16} /> },
  { key: 'upi',    label: 'UPI',                 caption: 'GPay, PhonePe, Paytm, BHIM', icon: <Smartphone size={16} /> },
  { key: 'wallet', label: 'Wallet',              caption: 'Blinkit pay, Amazon pay',    icon: <Wallet size={16} /> },
  { key: 'cod',    label: 'Cash on delivery',    caption: 'Pay when it arrives',         icon: <Banknote size={16} /> },
];

/**
 * Step 4. The cinematic centrepiece.
 *
 * Method tabs across the top, animated method-specific UI below — for cards
 * the live preview slides in alongside the form. We never claim to handle
 * a real card processor; the gateway points to a payment-service simulator.
 *
 * Validity gates the "Pay" button per method:
 *   - card: Luhn-ish digit count + expiry + CVC
 *   - upi:  VPA shape
 *   - wallet/cod: always valid
 */
export function PaymentStep({ onBack, onPay, loading }: PaymentStepProps) {
  const dispatch = useAppDispatch();
  const method   = useAppSelector((s) => s.checkout.paymentMethod);
  const card     = useAppSelector((s) => s.checkout.card);
  const upiId    = useAppSelector((s) => s.checkout.upiId);
  const cart     = useAppSelector((s) => s.cart.cart);

  const canPay = useMemo(() => {
    if (method === 'card')   return isCardValid(card);
    if (method === 'upi')    return isUpiValid(upiId);
    return true; // wallet, cod
  }, [method, card, upiId]);

  const total = cart ? formatMoney(cart.total) : '—';

  return (
    <StepShell
      eyebrow="Step 4 · Payment"
      title="Choose how to pay."
      description="Payments flow through the gateway to the payment-service. Card data never touches the frontend after submission."
      footer={
        <>
          <Button variant="ghost" iconLeft={<ArrowLeft size={14} />} onClick={onBack} disabled={loading}>
            Back
          </Button>
          <Button
            iconRight={<ArrowRight size={14} />}
            onClick={onPay}
            disabled={!canPay || loading}
          >
            {loading ? 'Processing…' : `Pay ${total}`}
          </Button>
        </>
      }
    >
      {/* Method picker */}
      <div className="grid gap-2.5 sm:grid-cols-2">
        {METHODS.map((m) => {
          const active = method === m.key;
          return (
            <motion.button
              key={m.key}
              type="button"
              onClick={() => dispatch(setPaymentMethod(m.key))}
              whileTap={{ scale: 0.985 }}
              className={cn(
                'relative flex items-center gap-3 rounded-2xl border p-3.5 text-left transition',
                active
                  ? 'border-accent/55 bg-white/[0.05] shadow-glow-sm'
                  : 'border-white/10 bg-white/[0.02] hover:border-white/25',
              )}
            >
              <div className={cn(
                'grid h-9 w-9 place-items-center rounded-xl border border-white/10',
                active ? 'bg-accent/20 text-accent-glow' : 'bg-ink-900/60 text-ink-200',
              )}>
                {m.icon}
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-display text-sm font-semibold text-white">{m.label}</p>
                <p className="text-[0.7rem] text-ink-300">{m.caption}</p>
              </div>
              {active && (
                <motion.span
                  layoutId="payment-method-pill"
                  className="absolute inset-0 rounded-2xl ring-1 ring-accent/45"
                  transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
                />
              )}
            </motion.button>
          );
        })}
      </div>

      {/* Method-specific UI */}
      <div className="mt-6">
        <AnimatePresence mode="wait">
          {method === 'card' && (
            <motion.div
              key="card-form"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.32, ease: [0.16, 1, 0.3, 1] }}
              className="grid gap-6 lg:grid-cols-2"
            >
              <PaymentCardPreview card={card} />

              <div className="space-y-4">
                <Input
                  name="cardholder"
                  label="Cardholder name"
                  placeholder="As shown on card"
                  autoComplete="cc-name"
                  value={card.cardholder}
                  onChange={(e) => dispatch(setCard({ cardholder: e.target.value.toUpperCase() }))}
                />
                <Input
                  name="cc-number"
                  label="Card number"
                  placeholder="4242 4242 4242 4242"
                  inputMode="numeric"
                  autoComplete="cc-number"
                  value={card.number}
                  onChange={(e) => dispatch(setCard({ number: formatCardNumber(e.target.value) }))}
                />
                <div className="grid grid-cols-2 gap-3">
                  <Input
                    name="cc-exp"
                    label="Expiry"
                    placeholder="MM/YY"
                    inputMode="numeric"
                    autoComplete="cc-exp"
                    value={card.expiry}
                    onChange={(e) => dispatch(setCard({ expiry: formatExpiry(e.target.value) }))}
                  />
                  <Input
                    name="cc-csc"
                    label="CVC"
                    placeholder="•••"
                    inputMode="numeric"
                    type="password"
                    autoComplete="cc-csc"
                    value={card.cvc}
                    onChange={(e) => dispatch(setCard({ cvc: e.target.value.replace(/\D/g, '').slice(0, 4) }))}
                  />
                </div>
                <SecurityNote />
              </div>
            </motion.div>
          )}

          {method === 'upi' && (
            <motion.div
              key="upi-form"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.32, ease: [0.16, 1, 0.3, 1] }}
              className="grid gap-6 lg:grid-cols-[1fr_1.2fr]"
            >
              <UpiArt />
              <div className="space-y-4">
                <Input
                  name="vpa"
                  label="UPI ID"
                  placeholder="you@bank"
                  value={upiId}
                  onChange={(e) => dispatch(setUpiId(e.target.value))}
                  iconLeft={<Smartphone size={14} />}
                />
                <p className="text-xs text-ink-300">
                  We'll send a collect request to your UPI app. Approve it to confirm
                  the payment — the payment-service watches for the signed callback
                  through the gateway.
                </p>
                <SecurityNote />
              </div>
            </motion.div>
          )}

          {method === 'wallet' && (
            <motion.div
              key="wallet-form"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.32, ease: [0.16, 1, 0.3, 1] }}
              className="space-y-3"
            >
              <p className="text-sm text-ink-300">Choose your wallet</p>
              <div className="grid gap-2.5 sm:grid-cols-3">
                {['Blinkit Pay', 'Amazon Pay', 'Mobikwik'].map((w, i) => (
                  <motion.div
                    key={w}
                    whileHover={{ y: -2 }}
                    className={cn(
                      'rounded-2xl border p-4 transition',
                      i === 0
                        ? 'border-accent/55 bg-white/[0.05] shadow-glow-sm'
                        : 'border-white/10 bg-white/[0.02] hover:border-white/25',
                    )}
                  >
                    <Wallet size={14} className="text-accent-glow" />
                    <p className="mt-2 font-display text-sm text-white">{w}</p>
                    <p className="text-[0.7rem] text-ink-300">Linked to your account</p>
                  </motion.div>
                ))}
              </div>
              <SecurityNote />
            </motion.div>
          )}

          {method === 'cod' && (
            <motion.div
              key="cod"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.32, ease: [0.16, 1, 0.3, 1] }}
              className="rounded-2xl border border-white/10 bg-white/[0.02] p-5"
            >
              <div className="flex items-center gap-2">
                <Banknote size={15} className="text-success" />
                <p className="font-display text-base font-semibold text-white">
                  Pay when it arrives
                </p>
              </div>
              <p className="mt-2 text-sm text-ink-300">
                Hand over <span className="font-mono text-ink-100">{total}</span> in cash to
                the delivery partner. They carry change up to ₹500 and a UPI QR
                if you change your mind on the doorstep.
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </StepShell>
  );
}

// =============================================================================
// Helpers
// =============================================================================

function formatCardNumber(raw: string): string {
  return raw
    .replace(/\D/g, '')
    .slice(0, 19)
    .match(/.{1,4}/g)
    ?.join(' ') ?? '';
}

function formatExpiry(raw: string): string {
  const digits = raw.replace(/\D/g, '').slice(0, 4);
  if (digits.length < 3) return digits;
  return `${digits.slice(0, 2)}/${digits.slice(2)}`;
}

function SecurityNote() {
  return (
    <div className="flex items-center gap-2 rounded-xl border border-white/8 bg-white/[0.02] px-3 py-2 text-[0.7rem] text-ink-300">
      <ShieldCheck size={12} className="text-success" />
      Encrypted in transit · TLS 1.3 · Tokenised at the gateway
      <Lock size={11} className="ml-auto text-ink-300" />
    </div>
  );
}

function UpiArt() {
  return (
    <div className="grid place-items-center rounded-3xl border border-white/10 bg-mesh bg-[length:200%_200%] p-10 animate-gradient-pan">
      <div className="rounded-2xl border border-white/15 bg-ink-950/50 p-5 backdrop-blur-md">
        <div className="grid h-32 w-32 grid-cols-7 grid-rows-7 gap-[2px]">
          {/* Decorative pseudo-QR — purely cosmetic, never scanned. */}
          {Array.from({ length: 49 }).map((_, i) => {
            const filled = (i * 7 + (i % 3)) % 4 === 0 || i === 0 || i === 6 || i === 42;
            return (
              <div
                key={i}
                className={cn(
                  'rounded-[2px]',
                  filled ? 'bg-white' : 'bg-transparent',
                )}
              />
            );
          })}
        </div>
        <p className="mt-3 text-center text-[0.65rem] uppercase tracking-[0.18em] text-ink-300">
          Scan or enter VPA
        </p>
      </div>
    </div>
  );
}

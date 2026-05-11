import { motion } from 'framer-motion';
import { ShieldCheck, Truck, Zap } from 'lucide-react';

import { useAppSelector } from '@store/hooks';
import { DELIVERY_OPTIONS } from '@store/slices/checkoutSlice';
import { GlassCard } from '@components/primitives/GlassCard';
import { formatMoney } from '@utils/format';

/**
 * Sticky order summary that lives next to every checkout step.
 *
 * Subtotal animates whenever it changes — Framer's `layout` prop makes the
 * row re-position smoothly when discount/tax lines toggle on. The whole
 * panel is glass so it sits comfortably over any backdrop.
 */
export function CheckoutSummary() {
  const cart     = useAppSelector((s) => s.cart.cart);
  const delivery = useAppSelector((s) => s.checkout.delivery);
  const items    = cart?.items ?? [];
  const itemCount = items.reduce((acc, i) => acc + i.quantity, 0);

  const deliveryOption = DELIVERY_OPTIONS.find((d) => d.speed === delivery);

  return (
    <GlassCard intensity="strong" className="h-fit lg:sticky lg:top-24">
      <div className="flex items-center justify-between">
        <p className="eyebrow">Order summary</p>
        <span className="text-[0.72rem] uppercase tracking-[0.14em] text-ink-300">
          {itemCount} item{itemCount === 1 ? '' : 's'}
        </span>
      </div>

      {/* Item thumbs */}
      <div className="mt-4 space-y-2.5">
        {items.length === 0 ? (
          <p className="text-sm text-ink-300">No items in your cart yet.</p>
        ) : (
          items.slice(0, 4).map((item) => (
            <motion.div
              key={item.productId}
              layout
              className="flex items-center gap-3 rounded-xl border border-white/8 bg-white/[0.02] p-2"
            >
              <div className="h-10 w-10 shrink-0 overflow-hidden rounded-lg border border-white/8 bg-ink-900/60">
                {item.imageUrl && (
                  <img src={item.imageUrl} alt="" className="h-full w-full object-cover" />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="line-clamp-1 text-sm text-white">{item.name}</p>
                <p className="text-[0.7rem] text-ink-300">
                  {item.quantity} × {formatMoney(item.unitPrice)}
                </p>
              </div>
              <p className="font-display text-xs font-semibold text-white">
                {formatMoney({
                  amount: item.unitPrice.amount * item.quantity,
                  currency: item.unitPrice.currency,
                })}
              </p>
            </motion.div>
          ))
        )}
        {items.length > 4 && (
          <p className="text-center text-[0.7rem] text-ink-300">
            + {items.length - 4} more
          </p>
        )}
      </div>

      <div className="hairline my-5" />

      {/* Cost rows */}
      <div className="space-y-2.5 text-sm">
        <Row label="Subtotal" value={cart ? formatMoney(cart.subtotal) : '—'} />
        {cart?.discount && cart.discount.amount > 0 && (
          <Row label="Discount" value={`− ${formatMoney(cart.discount)}`} muted />
        )}
        {cart?.tax && cart.tax.amount > 0 && (
          <Row label="Tax" value={formatMoney(cart.tax)} muted />
        )}
        <Row label={deliveryOption ? deliveryOption.label : 'Delivery'} value="Free" muted />
      </div>

      <div className="hairline my-5" />

      <motion.div layout className="flex items-baseline justify-between">
        <span className="text-sm text-ink-100">Total</span>
        <motion.span
          key={cart?.total.amount}
          initial={{ opacity: 0.4, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="font-display text-xl font-semibold text-white"
        >
          {cart ? formatMoney(cart.total) : '—'}
        </motion.span>
      </motion.div>

      {/* Trust strip */}
      <div className="mt-5 grid grid-cols-3 gap-2 text-[0.65rem] text-ink-300">
        <Trust icon={<ShieldCheck size={11} className="text-success" />} label="Gateway" />
        <Trust icon={<Truck      size={11} className="text-accent-glow" />} label="Tracked" />
        <Trust icon={<Zap        size={11} className="text-neon-cyan" />} label="Instant" />
      </div>
    </GlassCard>
  );
}

function Row({
  label,
  value,
  muted,
}: { label: string; value: string; muted?: boolean }) {
  return (
    <motion.div layout className="flex items-center justify-between">
      <span className={muted ? 'text-ink-300' : 'text-ink-100'}>{label}</span>
      <span className="text-ink-100">{value}</span>
    </motion.div>
  );
}

function Trust({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <div className="flex items-center justify-center gap-1.5 rounded-lg border border-white/8 bg-white/[0.02] py-1.5 uppercase tracking-[0.12em]">
      {icon}
      <span>{label}</span>
    </div>
  );
}

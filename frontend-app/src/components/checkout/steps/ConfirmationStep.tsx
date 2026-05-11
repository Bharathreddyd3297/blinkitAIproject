import { motion } from 'framer-motion';
import { Link, useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import {
  ArrowRight,
  CheckCircle2,
  ChevronRight,
  Clock,
  MapPin,
  Package,
  Sparkles,
} from 'lucide-react';

import { useAppDispatch, useAppSelector } from '@store/hooks';
import { resetCheckout } from '@store/slices/checkoutSlice';
import { fetchCart } from '@store/slices/cartSlice';
import { recommendationService } from '@services/recommendationService';
import { cartService } from '@services/cartService';
import type { Recommendation } from '@app-types/domain';
import { paths } from '@routes/paths';
import { Button } from '@components/primitives/Button';
import { GlassCard } from '@components/primitives/GlassCard';
import { Confetti } from '@components/visuals/Confetti';
import { RecommendationCarousel } from '@components/product/RecommendationCarousel';
import { formatMoney } from '@utils/format';

/**
 * Step 5 â€” final cinematic moment. Confetti, success card, order details,
 * and post-purchase AI recommendations.
 *
 * IMPORTANT: We clear the cart on mount (best-effort) so the next visit to
 * /products doesn't show the just-purchased items as still in the basket.
 * If the network call fails we don't block the celebration UI.
 */
export function ConfirmationStep() {
  const order  = useAppSelector((s) => s.checkout.placedOrder);
  const address = useAppSelector((s) => s.checkout.address);
  const dispatch = useAppDispatch();
  const navigate = useNavigate();

  const [related, setRelated] = useState<Recommendation[]>([]);
  const [relLoading, setRl]   = useState(true);

  // Fire-and-forget cart clear, then refetch so cart drawer reflects empty.
  useEffect(() => {
    let cancelled = false;
    cartService.clear().finally(() => {
      if (!cancelled) dispatch(fetchCart());
    });
    return () => { cancelled = true; };
  }, [dispatch]);

  // Post-purchase recommendations seeded by the first item in the order.
  useEffect(() => {
    if (!order || order.items.length === 0) {
      setRl(false);
      return;
    }
    let cancelled = false;
    recommendationService
      .similar(order.items[0].productId, 8)
      .then((r) => { if (!cancelled) setRelated(r); })
      .finally(() => { if (!cancelled) setRl(false); });
    return () => { cancelled = true; };
  }, [order]);

  if (!order) {
    // Defensive fallback â€” if someone landed here without an order, send
    // them home rather than leaving a half-rendered confirmation page.
    return (
      <div className="grid place-items-center py-20">
        <p className="text-ink-200">No order to display.</p>
        <Link to={paths.home} className="mt-4 inline-block">
          <Button>Back to home</Button>
        </Link>
      </div>
    );
  }

  const eta = order.estimatedDelivery
    ? new Date(order.estimatedDelivery).toLocaleString(undefined, {
        weekday: 'short',
        hour: '2-digit',
        minute: '2-digit',
      })
    : null;

  const onTrack = () => {
    dispatch(resetCheckout());
    navigate(paths.orderDetail(order.id));
  };
  const onContinue = () => {
    dispatch(resetCheckout());
    navigate(paths.products);
  };

  return (
    <div className="relative">
      <Confetti />

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
        className="space-y-8"
      >
        {/* Hero card */}
        <GlassCard intensity="strong" className="relative overflow-hidden p-8 text-center md:p-12">
          <div className="pointer-events-none absolute inset-0 bg-mesh bg-[length:200%_200%] animate-gradient-pan opacity-50" />
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-transparent to-ink-950/40" />

          <div className="relative">
            <motion.div
              initial={{ scale: 0.6, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: 0.6, ease: [0.34, 1.56, 0.64, 1] }}
              className="mx-auto grid h-20 w-20 place-items-center rounded-full border border-success/45 bg-success/15 text-success shadow-[0_0_56px_rgba(61,220,151,0.5)]"
            >
              <CheckCircle2 size={36} />
            </motion.div>

            <p className="eyebrow mt-6 justify-center">Order confirmed</p>
            <h1 className="mt-2 font-display text-3xl font-semibold tracking-tight text-balance md:text-5xl">
              <span className="text-gradient">Thank you, {address.fullName.split(' ')[0] || 'friend'}.</span>
            </h1>
            <p className="mx-auto mt-3 max-w-md text-pretty text-ink-200">
              We've routed your order through the gateway. The order-service has it,
              the payment-service has confirmed, and the courier is on their way.
            </p>

            <div className="mx-auto mt-6 grid max-w-xl gap-3 sm:grid-cols-3">
              <SummaryStat icon={<Package size={14} />}        label="Order #"  value={order.id.slice(-8).toUpperCase()} />
              <SummaryStat icon={<Clock size={14} />}          label="ETA"      value={eta ?? 'â€”'} />
              <SummaryStat icon={<Sparkles size={14} />}       label="Total"    value={formatMoney(order.total)} />
            </div>

            <div className="mt-8 flex flex-wrap justify-center gap-3">
              <Button onClick={onTrack} iconLeft={<MapPin size={14} />} iconRight={<ChevronRight size={14} />}>
                Track this order
              </Button>
              <Button onClick={onContinue} variant="ghost" iconRight={<ArrowRight size={14} />}>
                Continue shopping
              </Button>
            </div>
          </div>
        </GlassCard>

        {/* Order details â€” items + ship-to */}
        <div className="grid gap-5 lg:grid-cols-[1.4fr_1fr]">
          <GlassCard>
            <p className="eyebrow mb-3">In your order</p>
            <ul className="space-y-2.5">
              {order.items.map((it) => (
                <li
                  key={it.productId}
                  className="flex items-center gap-3 rounded-xl border border-white/8 bg-white/[0.02] p-2.5"
                >
                  <div className="h-12 w-12 shrink-0 overflow-hidden rounded-lg border border-white/8 bg-ink-900/60">
                    {it.imageUrl && <img src={it.imageUrl} alt="" className="h-full w-full object-cover" />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="line-clamp-1 text-sm text-white">{it.name}</p>
                    <p className="text-[0.7rem] text-ink-300">
                      {it.quantity} Ã— {formatMoney(it.unitPrice)}
                    </p>
                  </div>
                  <p className="font-display text-sm font-semibold text-white">
                    {formatMoney({ amount: it.unitPrice.amount * it.quantity, currency: it.unitPrice.currency })}
                  </p>
                </li>
              ))}
            </ul>
          </GlassCard>

          <GlassCard>
            <p className="eyebrow mb-3">Delivering to</p>
            <p className="font-display text-base font-semibold text-white">{address.fullName}</p>
            <p className="mt-0.5 text-sm text-ink-200">{address.phone}</p>
            <p className="mt-3 text-sm text-ink-300">
              {address.street}
              {address.landmark ? `, ${address.landmark}` : ''}<br />
              {address.city}, {address.state} {address.postalCode}<br />
              {address.country}
            </p>
            {order.trackingId && (
              <p className="mt-4 inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 font-mono text-[0.7rem] uppercase tracking-[0.14em] text-ink-200">
                <MapPin size={11} className="text-accent-glow" />
                {order.trackingId}
              </p>
            )}
          </GlassCard>
        </div>

        {/* Post-purchase recs */}
        <RecommendationCarousel
          title="You might also love"
          description="Curated by the AI service from what people bought together with this order."
          recommendations={related}
          loading={relLoading}
          emphasize
        />
      </motion.div>
    </div>
  );
}

function SummaryStat({
  icon,
  label,
  value,
}: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/8 bg-white/[0.02] p-3.5">
      <div className="flex items-center justify-center gap-1.5 text-[0.7rem] uppercase tracking-[0.14em] text-ink-300">
        {icon}
        {label}
      </div>
      <p className="mt-1.5 font-display text-base font-semibold text-white">{value}</p>
    </div>
  );
}

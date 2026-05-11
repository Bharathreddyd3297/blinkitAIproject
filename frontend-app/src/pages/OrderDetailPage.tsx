import { Link, useParams } from 'react-router-dom';
import { useEffect, useState } from 'react';
import {
  ArrowLeft,
  ChevronRight,
  Clock,
  Copy,
  HelpCircle,
  Package,
  ShieldCheck,
} from 'lucide-react';

import { orderService } from '@services/orderService';
import { recommendationService } from '@services/recommendationService';
import type { Order, OrderStatus, Recommendation } from '@app-types/domain';
import { paths } from '@routes/paths';
import { Container } from '@components/primitives/Container';
import { GlassCard } from '@components/primitives/GlassCard';
import { Badge } from '@components/primitives/Badge';
import { Button } from '@components/primitives/Button';
import { Spinner } from '@components/loading/Spinner';
import { OrderTimeline } from '@components/order/OrderTimeline';
import { RecommendationCarousel } from '@components/product/RecommendationCarousel';
import { Reveal } from '@animations/Reveal';
import { useToast } from '@hooks/useToast';
import { formatMoney, formatRelative } from '@utils/format';

const STATUS_VARIANT: Record<OrderStatus, 'neutral' | 'accent' | 'success' | 'warning' | 'danger'> = {
  PENDING:           'warning',
  CONFIRMED:         'accent',
  PACKED:            'accent',
  OUT_FOR_DELIVERY:  'accent',
  DELIVERED:         'success',
  CANCELLED:         'danger',
};

const STATUS_LABEL: Record<OrderStatus, string> = {
  PENDING:           'Pending',
  CONFIRMED:         'Confirmed',
  PACKED:            'Packed',
  OUT_FOR_DELIVERY:  'Out for delivery',
  DELIVERED:         'Delivered',
  CANCELLED:         'Cancelled',
};

/**
 * Order tracking page. Centrepiece is the animated `<OrderTimeline>`; the
 * rest of the page wraps it with item list, ship-to card, payment summary,
 * tracking ID, and a final post-purchase recommendation strip.
 */
export default function OrderDetailPage() {
  const { id } = useParams<{ id: string }>();
  const toast = useToast();

  const [order, setOrder]     = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [related, setRelated] = useState<Recommendation[]>([]);
  const [relLoading, setRl]   = useState(true);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    setLoading(true);
    orderService
      .get(id)
      .then((o) => { if (!cancelled) setOrder(o); })
      .catch(() => { if (!cancelled) setOrder(null); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [id]);

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

  if (loading) {
    return (
      <Container className="grid place-items-center py-32">
        <Spinner />
      </Container>
    );
  }

  if (!order) {
    return (
      <Container className="grid place-items-center py-32 text-center">
        <p className="font-display text-xl text-white">Order not found</p>
        <p className="mt-2 text-sm text-ink-300">It may have been cancelled or expired.</p>
        <Link to={paths.orders} className="mt-5 inline-block">
          <Button iconLeft={<ArrowLeft size={14} />}>Back to orders</Button>
        </Link>
      </Container>
    );
  }

  const eta = order.estimatedDelivery ? new Date(order.estimatedDelivery) : null;
  const etaLabel = eta
    ? eta.toLocaleString(undefined, { weekday: 'short', hour: '2-digit', minute: '2-digit' })
    : null;

  return (
    <div>
      <Container className="pt-10">
        {/* Breadcrumb */}
        <nav className="mb-6 flex items-center gap-1.5 text-xs text-ink-300">
          <Link to={paths.home} className="transition hover:text-white">Home</Link>
          <ChevronRight size={12} />
          <Link to={paths.orders} className="transition hover:text-white">Orders</Link>
          <ChevronRight size={12} />
          <span className="font-mono text-ink-100">{order.id.slice(-8).toUpperCase()}</span>
        </nav>

        {/* Header */}
        <div className="mb-10 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="eyebrow mb-2">Order tracking</p>
            <h1 className="font-display text-3xl font-semibold tracking-tight md:text-4xl">
              <span className="text-gradient">#{order.id.slice(-8).toUpperCase()}</span>
            </h1>
            <p className="mt-2 text-sm text-ink-300">
              Placed {formatRelative(order.placedAt)}
            </p>
          </div>
          <Badge variant={STATUS_VARIANT[order.status]}>
            {STATUS_LABEL[order.status]}
          </Badge>
        </div>

        {/* Main grid: timeline + details */}
        <div className="grid gap-6 lg:grid-cols-[1.3fr_1fr]">
          <GlassCard intensity="default" className="p-7">
            <div className="mb-7 flex flex-wrap items-end justify-between gap-3">
              <div>
                <p className="eyebrow mb-2">Live progress</p>
                <h2 className="font-display text-xl font-semibold text-white">
                  {etaLabel ? `Arriving by ${etaLabel}` : 'Tracking will update here'}
                </h2>
              </div>
              {order.trackingId && (
                <button
                  onClick={() => {
                    navigator.clipboard?.writeText(order.trackingId!).catch(() => {});
                    toast.success('Tracking ID copied');
                  }}
                  className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 font-mono text-[0.7rem] uppercase tracking-[0.14em] text-ink-200 transition hover:border-white/25 hover:text-white"
                >
                  <Copy size={11} />
                  {order.trackingId}
                </button>
              )}
            </div>

            <OrderTimeline status={order.status} />

            <div className="mt-8 grid gap-3 sm:grid-cols-3">
              <Stat icon={<Clock size={13} />}        label="ETA"      value={etaLabel ?? 'â€”'} />
              <Stat icon={<Package size={13} />}      label="Items"    value={String(order.items.reduce((a, i) => a + i.quantity, 0))} />
              <Stat icon={<ShieldCheck size={13} />}  label="Total"    value={formatMoney(order.total)} />
            </div>
          </GlassCard>

          <GlassCard intensity="strong" className="h-fit space-y-5 lg:sticky lg:top-24">
            <div>
              <p className="eyebrow mb-2">Items</p>
              <ul className="space-y-2">
                {order.items.map((it) => (
                  <li
                    key={it.productId}
                    className="flex items-center gap-3 rounded-xl border border-white/8 bg-white/[0.02] p-2"
                  >
                    <div className="h-10 w-10 shrink-0 overflow-hidden rounded-lg border border-white/8 bg-ink-900/60">
                      {it.imageUrl && <img src={it.imageUrl} alt="" className="h-full w-full object-cover" />}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="line-clamp-1 text-sm text-white">{it.name}</p>
                      <p className="text-[0.7rem] text-ink-300">
                        {it.quantity} Ã— {formatMoney(it.unitPrice)}
                      </p>
                    </div>
                    <p className="font-display text-xs font-semibold text-white">
                      {formatMoney({
                        amount: it.unitPrice.amount * it.quantity,
                        currency: it.unitPrice.currency,
                      })}
                    </p>
                  </li>
                ))}
              </ul>
            </div>

            <div className="hairline" />

            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <p className="text-[0.7rem] uppercase tracking-[0.14em] text-ink-300">Subtotal</p>
                <p className="mt-1 text-ink-100">{formatMoney(order.total)}</p>
              </div>
              <div>
                <p className="text-[0.7rem] uppercase tracking-[0.14em] text-ink-300">Total</p>
                <p className="mt-1 font-display font-semibold text-white">{formatMoney(order.total)}</p>
              </div>
            </div>

            <div className="hairline" />

            <button className="flex w-full items-center justify-between text-sm text-ink-200 transition hover:text-white">
              <span className="inline-flex items-center gap-2">
                <HelpCircle size={14} className="text-accent-glow" />
                Need help with this order?
              </span>
              <ChevronRight size={14} />
            </button>
          </GlassCard>
        </div>

        {/* Post-purchase recs */}
        <Reveal className="mt-16">
          <RecommendationCarousel
            title="Reorder these soon"
            description="AI-similar to what you ordered â€” handy when this delivery runs out."
            recommendations={related}
            loading={relLoading}
          />
        </Reveal>

        <div className="mt-10">
          <Link to={paths.orders} className="inline-flex items-center gap-1.5 text-sm text-ink-300 transition hover:text-white">
            <ArrowLeft size={14} />
            Back to orders
          </Link>
        </div>
      </Container>
    </div>
  );
}

function Stat({
  icon,
  label,
  value,
}: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-xl border border-white/8 bg-white/[0.02] p-3">
      <div className="flex items-center gap-1.5 text-[0.7rem] uppercase tracking-[0.14em] text-ink-300">
        {icon}
        {label}
      </div>
      <p className="mt-1 font-display text-base font-semibold text-white">{value}</p>
    </div>
  );
}


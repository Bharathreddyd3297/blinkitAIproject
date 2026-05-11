import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, ChevronRight, Package } from 'lucide-react';

import { useAppDispatch, useAppSelector } from '@store/hooks';
import { fetchOrders } from '@store/slices/ordersSlice';
import { PageHeader } from '@pages/_shared/PageHeader';
import { Container } from '@components/primitives/Container';
import { GlassCard } from '@components/primitives/GlassCard';
import { Badge } from '@components/primitives/Badge';
import { Button } from '@components/primitives/Button';
import { Stagger, StaggerItem } from '@animations/Stagger';
import { paths } from '@routes/paths';
import { formatMoney, formatRelative } from '@utils/format';
import type { Order, OrderStatus } from '@app-types/domain';

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
  OUT_FOR_DELIVERY:  'On its way',
  DELIVERED:         'Delivered',
  CANCELLED:         'Cancelled',
};

export default function OrdersPage() {
  const dispatch = useAppDispatch();
  const orders   = useAppSelector((s) => s.orders.list);
  const status   = useAppSelector((s) => s.orders.status);

  useEffect(() => { dispatch(fetchOrders()); }, [dispatch]);

  const isLoading = status === 'loading' && orders.length === 0;

  return (
    <div>
      <PageHeader
        eyebrow="Activity"
        title={<>Your <span className="text-gradient">orders.</span></>}
        description="Lifecycle tracked end-to-end by the order-service. Status updates stream over the gateway."
      />
      <Container>
        {isLoading ? (
          <Stagger className="grid gap-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <StaggerItem key={i}>
                <GlassCard className="h-24 animate-pulse">
                  <span aria-hidden />
                </GlassCard>
              </StaggerItem>
            ))}
          </Stagger>
        ) : orders.length === 0 ? (
          <GlassCard className="grid place-items-center py-20 text-center">
            <div className="grid h-12 w-12 place-items-center rounded-2xl border border-white/10 bg-white/[0.04] text-ink-200">
              <Package size={18} />
            </div>
            <p className="mt-4 font-display text-lg text-white">No orders yet</p>
            <p className="mt-1 max-w-sm text-sm text-ink-300">
              Place your first order and it will show up here, fully tracked.
            </p>
            <Link to={paths.products} className="mt-5 inline-block">
              <Button iconRight={<ArrowRight size={14} />}>Explore catalog</Button>
            </Link>
          </GlassCard>
        ) : (
          <Stagger className="grid gap-4">
            {orders.map((order) => (
              <StaggerItem key={order.id}>
                <OrderRow order={order} />
              </StaggerItem>
            ))}
          </Stagger>
        )}
      </Container>
    </div>
  );
}

function OrderRow({ order }: { order: Order }) {
  const itemCount = order.items.reduce((a, i) => a + i.quantity, 0);
  const previewItems = order.items.slice(0, 3);

  return (
    <Link to={paths.orderDetail(order.id)} className="block group">
      <GlassCard interactive className="flex items-center gap-5 p-5">
        {/* Stacked thumbs */}
        <div className="relative flex shrink-0">
          {previewItems.map((it, i) => (
            <div
              key={it.productId}
              className="-ml-3 h-12 w-12 overflow-hidden rounded-xl border border-white/10 bg-ink-900/60 shadow-soft first:ml-0"
              style={{ zIndex: previewItems.length - i }}
            >
              {it.imageUrl && <img src={it.imageUrl} alt="" className="h-full w-full object-cover" />}
            </div>
          ))}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-display text-base font-semibold text-white">
              #{order.id.slice(-8).toUpperCase()}
            </p>
            <Badge variant={STATUS_VARIANT[order.status]}>{STATUS_LABEL[order.status]}</Badge>
          </div>
          <p className="mt-1 line-clamp-1 text-sm text-ink-300">
            {itemCount} item{itemCount === 1 ? '' : 's'} Â· {previewItems.map((i) => i.name).join(', ')}
            {order.items.length > 3 ? ` + ${order.items.length - 3} more` : ''}
          </p>
          <p className="mt-1 text-[0.72rem] text-ink-300">
            Placed {formatRelative(order.placedAt)}
          </p>
        </div>

        <div className="hidden flex-col items-end gap-1 sm:flex">
          <p className="font-display text-lg font-semibold text-white">
            {formatMoney(order.total)}
          </p>
          {order.estimatedDelivery && (
            <p className="text-[0.7rem] uppercase tracking-[0.14em] text-ink-300">
              ETA{' '}
              {new Date(order.estimatedDelivery).toLocaleTimeString(undefined, {
                hour: '2-digit',
                minute: '2-digit',
              })}
            </p>
          )}
        </div>

        <ChevronRight
          size={16}
          className="text-ink-300 transition group-hover:translate-x-0.5 group-hover:text-white"
        />
      </GlassCard>
    </Link>
  );
}

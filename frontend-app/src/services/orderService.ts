import { api } from '@services/api';
import { mapOrder } from '@services/mappers';
import type { CartItem, Money, Order, Paginated } from '@app-types/domain';
import { mockOrders, withMockFallback } from '@utils/mock';

/**
 * Talks to the gateway's `/api/orders` surface (order-service).
 *
 * Backend op map:
 *   - POST  /api/orders/checkout       — orchestrates cart -> products -> persist
 *   - GET   /api/orders                — list user orders (newest first)
 *   - GET   /api/orders/history        — full history
 *   - GET   /api/orders/{id}           — owner-checked
 *   - PATCH /api/orders/{id}/status    — set status (used for cancellation)
 *
 * The frontend's `PlaceOrderPayload` carries cart + delivery + payment intent
 * fields that the backend does not currently consume; checkout is parameter-less
 * server-side (pulls the user's cart by JWT). We POST without a body and
 * surface the resulting Order to the UI.
 */

export interface PlaceOrderPayload {
  items: CartItem[];
  total: Money;
  paymentMethodId: string;
  paymentIntentId: string;
  addressId?: string;
  shippingAddress?: {
    fullName: string;
    phone: string;
    street: string;
    landmark?: string;
    city: string;
    state: string;
    postalCode: string;
    country: string;
  };
  delivery: {
    speed: 'express' | 'standard' | 'scheduled';
    etaMinutes: number;
  };
}

const buildMockOrder = (payload: PlaceOrderPayload): Order => {
  const id = `ord_${Date.now().toString(36).toUpperCase()}_${Math.floor(Math.random() * 9999)
    .toString()
    .padStart(4, '0')}`;
  return {
    id,
    status: 'CONFIRMED',
    items: payload.items,
    total: payload.total,
    placedAt: new Date().toISOString(),
    estimatedDelivery: new Date(Date.now() + payload.delivery.etaMinutes * 60_000).toISOString(),
    trackingId: `BLK-${id.slice(-6)}`,
  };
};

const intoListPage = (orders: Order[]): Paginated<Order> => ({
  items: orders,
  page: 1,
  pageSize: orders.length,
  total: orders.length,
});

export const orderService = {
  list: (_page = 1, _pageSize = 10) =>
    withMockFallback(
      async () => {
        const list = await api.get<unknown[]>('/orders');
        return intoListPage(list.map((o) => mapOrder(o as Parameters<typeof mapOrder>[0])));
      },
      () => mockOrders,
    ),

  history: () =>
    withMockFallback(
      async () => {
        const list = await api.get<unknown[]>('/orders/history');
        return list.map((o) => mapOrder(o as Parameters<typeof mapOrder>[0]));
      },
      () => mockOrders.items,
    ),

  get: (id: string) =>
    withMockFallback(
      () => api.get<unknown>(`/orders/${id}`).then((o) => mapOrder(o as Parameters<typeof mapOrder>[0])),
      () => {
        const o = mockOrders.items.find((x) => x.id === id);
        if (!o) throw { status: 404, message: 'Order not found' };
        return o;
      },
    ),

  /**
   * Place a new order. Backend orchestrator: pulls the cart from cart-service,
   * validates each item with product-service, persists order + items, then
   * decrements inventory using its internal SERVICE JWT. The frontend payload
   * is currently advisory — server is the source of truth.
   */
  place: (payload: PlaceOrderPayload) =>
    withMockFallback(
      async () => {
        const created = await api.post<unknown>('/orders/checkout');
        return mapOrder(created as Parameters<typeof mapOrder>[0]);
      },
      () => {
        const order = buildMockOrder(payload);
        mockOrders.items.unshift(order);
        mockOrders.total += 1;
        return order;
      },
    ),

  /**
   * Cancellation maps to status patching on the backend
   * (`PATCH /api/orders/{id}/status` with `{status: 'CANCELLED'}`).
   */
  cancel: (id: string) =>
    withMockFallback(
      () => api.patch<unknown>(`/orders/${id}/status`, { status: 'CANCELLED' })
              .then((o) => mapOrder(o as Parameters<typeof mapOrder>[0])),
      () => {
        const order = mockOrders.items.find((o) => o.id === id);
        if (!order) throw { status: 404, message: 'Order not found' };
        order.status = 'CANCELLED';
        return order;
      },
    ),
};

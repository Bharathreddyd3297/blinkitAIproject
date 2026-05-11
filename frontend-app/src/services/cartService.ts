import { api } from '@services/api';
import { mapCart } from '@services/mappers';
import type { Cart, CartItem } from '@app-types/domain';
import { mockProducts, withMockFallback } from '@utils/mock';

/**
 * Talks to the gateway's `/api/cart` surface (cart-service).
 *
 * Backend cart is keyed by JWT-extracted userId — no cartId is sent in URLs.
 * Backend ops:
 *   - GET    /api/cart                    — returns CartResponse
 *   - POST   /api/cart/add                — body {productId, quantity}
 *   - DELETE /api/cart/{cartItemId}       — owner-checked
 *   - DELETE /api/cart/clear              — wipes the user's cart
 *
 * Note: backend cart APIs identify a cart line by its server-side cart_item.id
 * (a Long). The frontend currently keys items by productId. We resolve
 * productId -> cartItemId at call time by reading the latest cart, then issue
 * the DELETE/PATCH against that line. If the lookup fails (race or stale
 * state) we surface the 404 to the UI rather than silently no-op.
 *
 * Mock fallback only fires on `status === 0` (network unreachable). Any 4xx
 * surfaces normally.
 */

const localCart: Cart = {
  id: 'cart_local',
  items: [],
  subtotal: { amount: 0, currency: 'INR' },
  total:    { amount: 0, currency: 'INR' },
  updatedAt: new Date().toISOString(),
};

const recomputeLocal = () => {
  const subtotal = localCart.items.reduce(
    (acc, i) => acc + i.unitPrice.amount * i.quantity,
    0,
  );
  localCart.subtotal = { amount: subtotal, currency: 'INR' };
  localCart.total    = { amount: subtotal, currency: 'INR' };
  localCart.updatedAt = new Date().toISOString();
};

const localAdd = (productId: string, quantity: number): Cart => {
  const product = mockProducts.find((p) => p.id === productId);
  if (!product) throw { status: 404, message: 'Product not found' };
  const existing = localCart.items.find((i) => i.productId === productId);
  if (existing) {
    existing.quantity += quantity;
  } else {
    const item: CartItem = {
      productId: product.id,
      name:      product.name,
      imageUrl:  product.imageUrl,
      unitPrice: product.price,
      quantity,
    };
    localCart.items.push(item);
  }
  recomputeLocal();
  return structuredClone(localCart);
};

const localRemove = (productId: string): Cart => {
  localCart.items = localCart.items.filter((i) => i.productId !== productId);
  recomputeLocal();
  return structuredClone(localCart);
};

const localClear = (): Cart => {
  localCart.items = [];
  recomputeLocal();
  return structuredClone(localCart);
};

interface BackendCartItemRaw {
  id: number;
  productId: number;
}

const findCartItemId = async (productId: string): Promise<number | null> => {
  // backend returns CartResponse {userId, items:[{id, productId, ...}], ...}
  const cart = await api.get<{ items?: BackendCartItemRaw[] }>('/cart');
  const match = (cart.items ?? []).find((it) => String(it.productId) === productId);
  return match ? match.id : null;
};

export const cartService = {
  get: () =>
    withMockFallback(
      () => api.get<unknown>('/cart').then((c) => mapCart(c as Parameters<typeof mapCart>[0])),
      () => structuredClone(localCart),
    ),

  addItem: (productId: string, quantity = 1) =>
    withMockFallback(
      async () => {
        await api.post('/cart/add', { productId: Number(productId), quantity });
        // Backend `/cart/add` returns just the created cart_item; refetch the
        // whole cart so the UI gets full subtotals and a consistent shape.
        const cart = await api.get<unknown>('/cart');
        return mapCart(cart as Parameters<typeof mapCart>[0]);
      },
      () => localAdd(productId, quantity),
    ),

  /**
   * Set the absolute quantity of a productId in the cart.
   * Implemented as remove-then-add since backend has no PATCH-by-product.
   */
  updateItem: (productId: string, quantity: number) =>
    withMockFallback(
      async () => {
        const id = await findCartItemId(productId);
        if (id !== null) {
          await api.delete(`/cart/${id}`);
        }
        if (quantity > 0) {
          await api.post('/cart/add', { productId: Number(productId), quantity });
        }
        const cart = await api.get<unknown>('/cart');
        return mapCart(cart as Parameters<typeof mapCart>[0]);
      },
      () => {
        const i = localCart.items.find((x) => x.productId === productId);
        if (!i) throw { status: 404, message: 'Item not in cart' };
        if (quantity <= 0) localCart.items = localCart.items.filter((x) => x.productId !== productId);
        else i.quantity = quantity;
        recomputeLocal();
        return structuredClone(localCart);
      },
    ),

  removeItem: (productId: string) =>
    withMockFallback(
      async () => {
        const id = await findCartItemId(productId);
        if (id === null) throw { status: 404, message: 'Item not in cart' };
        await api.delete(`/cart/${id}`);
        const cart = await api.get<unknown>('/cart');
        return mapCart(cart as Parameters<typeof mapCart>[0]);
      },
      () => localRemove(productId),
    ),

  clear: () =>
    withMockFallback(
      async () => {
        await api.delete('/cart/clear');
        return mapCart({ userId: -1, items: [], totalItems: 0, totalAmount: 0 } as Parameters<typeof mapCart>[0]);
      },
      () => localClear(),
    ),
};

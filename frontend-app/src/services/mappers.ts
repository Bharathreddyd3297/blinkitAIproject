/**
 * Backend DTO → frontend domain mappers.
 *
 * The backend speaks `Long`s, `BigDecimal`s, snake-case enums, and Spring's
 * `Page<T>` shape. The frontend domain (see `types/domain.ts`) speaks string
 * IDs, `Money` objects, and lowercase tags. These mappers are the only place
 * those translations live; service files call them and never touch the raw
 * backend DTOs directly.
 *
 * Keep these total functions — they must never throw on missing optional
 * fields. Backend evolves; the mapper soaks the change so the UI doesn't.
 */

import type {
  AuthSession,
  Cart,
  CartItem,
  Money,
  Order,
  OrderStatus,
  Paginated,
  Product,
  Recommendation,
  Role,
  User,
} from '@app-types/domain';

const INR = 'INR';

const inr = (amount: number | string | null | undefined): Money => ({
  amount: typeof amount === 'string' ? Number(amount) : (amount ?? 0),
  currency: INR,
});

const slugify = (s: string): string =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');

// =============================================================================
// Auth
// =============================================================================

interface BackendUser {
  id: number;
  name: string;
  email: string;
  role: 'USER' | 'ADMIN' | 'SERVICE' | string;
}

interface BackendLoginResponse {
  accessToken: string;
  tokenType: string;
  expiresIn: number; // seconds
  user: BackendUser;
}

interface BackendSignupResponse {
  id: number;
  name: string;
  email: string;
  role: string;
  message?: string;
}

const mapRole = (role: string | undefined): Role => {
  switch ((role ?? '').toUpperCase()) {
    case 'ADMIN':   return 'ADMIN';
    case 'SUPPORT': return 'SUPPORT';
    case 'USER':
    default:        return 'CUSTOMER';
  }
};

export const mapUser = (u: BackendUser): User => ({
  id:    String(u.id),
  email: u.email,
  name:  u.name,
  roles: [mapRole(u.role)],
});

export const mapLoginResponse = (r: BackendLoginResponse): AuthSession => ({
  token: r.accessToken,
  expiresAt: Date.now() + (r.expiresIn ?? 0) * 1000,
  user: mapUser(r.user),
});

export const mapSignupResponse = (r: BackendSignupResponse): User => ({
  id:    String(r.id),
  email: r.email,
  name:  r.name,
  roles: [mapRole(r.role)],
});

// =============================================================================
// Catalog
// =============================================================================

interface BackendProduct {
  id: number;
  name: string;
  category: string;
  price: number;
  stock: number;
  imageUrl?: string | null;
  description?: string | null;
  inStock?: boolean;
}

interface BackendPage<T> {
  content: T[];
  totalElements: number;
  totalPages: number;
  page: number;          // 0-indexed page number
  size: number;          // page size
  last?: boolean;
  first?: boolean;
}

export const mapProduct = (p: BackendProduct): Product => ({
  id:        String(p.id),
  slug:      slugify(p.name),
  name:      p.name,
  description: p.description ?? undefined,
  category:  p.category,
  imageUrl:  p.imageUrl ?? undefined,
  price:     inr(p.price),
  inStock:   p.inStock ?? p.stock > 0,
  reviewsCount: 0,
});

export const mapProductPage = (p: BackendPage<BackendProduct>): Paginated<Product> => ({
  items:    (p.content ?? []).map(mapProduct),
  page:     (p.page ?? 0) + 1,                       // backend is 0-indexed; frontend is 1-indexed
  pageSize: p.size ?? (p.content?.length ?? 0),
  total:    p.totalElements ?? (p.content?.length ?? 0),
});

// =============================================================================
// Cart
// =============================================================================

interface BackendCartItem {
  id: number;
  productId: number;
  productName: string;
  quantity: number;
  price: number;
  totalPrice: number;
  createdAt?: string;
  updatedAt?: string;
}

interface BackendCartResponse {
  userId: number;
  items: BackendCartItem[];
  totalItems: number;
  totalAmount: number;
}

export const mapCartItem = (it: BackendCartItem): CartItem => ({
  productId: String(it.productId),
  name:      it.productName,
  quantity:  it.quantity,
  unitPrice: inr(it.price),
});

export const mapCart = (c: BackendCartResponse): Cart => ({
  id:        `cart_user_${c.userId}`,
  items:     (c.items ?? []).map(mapCartItem),
  subtotal:  inr(c.totalAmount),
  total:     inr(c.totalAmount),
  updatedAt: new Date().toISOString(),
});

// =============================================================================
// Orders
// =============================================================================

interface BackendOrderItem {
  id: number;
  productId: number;
  productName: string;
  quantity: number;
  price: number;
  totalPrice: number;
}

interface BackendOrder {
  orderId: number;
  userId: number;
  status: string;
  totalAmount: number;
  items: BackendOrderItem[];
  createdAt: string;
  updatedAt: string;
}

const mapOrderStatus = (s: string): OrderStatus => {
  switch ((s ?? '').toUpperCase()) {
    case 'CREATED':         return 'PENDING';
    case 'PAYMENT_PENDING': return 'PENDING';
    case 'PAID':            return 'CONFIRMED';
    case 'DELIVERED':       return 'DELIVERED';
    case 'CANCELLED':
    case 'FAILED':          return 'CANCELLED';
    default:                return 'PENDING';
  }
};

export const mapOrder = (o: BackendOrder): Order => ({
  id:       String(o.orderId),
  status:   mapOrderStatus(o.status),
  items:    (o.items ?? []).map((i) => ({
    productId: String(i.productId),
    name:      i.productName,
    quantity:  i.quantity,
    unitPrice: inr(i.price),
  })),
  total:    inr(o.totalAmount),
  placedAt: o.createdAt,
});

// =============================================================================
// Recommendations
// =============================================================================

interface BackendRecommendationItem {
  id: number;
  name: string;
  category: string;
  price: number;
  imageUrl?: string | null;
  score: number;
  reason?: string | null;
}

export const mapRecommendation = (r: BackendRecommendationItem): Recommendation => ({
  product: {
    id:       String(r.id),
    slug:     slugify(r.name),
    name:     r.name,
    category: r.category,
    imageUrl: r.imageUrl ?? undefined,
    price:    inr(r.price),
    inStock:  true,
  },
  score:  r.score,
  reason: r.reason ?? undefined,
});

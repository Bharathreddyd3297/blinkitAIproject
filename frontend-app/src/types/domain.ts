/**
 * Domain types shared across the frontend.
 *
 * These mirror the contracts exposed by the API gateway. Keep them aligned
 * with the backend OpenAPI / proto definitions — drift here causes silent
 * runtime breakage that TypeScript can't catch at the network boundary.
 */

// =============================================================================
// Auth
// =============================================================================

export type Role = 'CUSTOMER' | 'ADMIN' | 'SUPPORT';

export interface User {
  id: string;
  email: string;
  name: string;
  avatarUrl?: string;
  roles: Role[];
  createdAt?: string;
}

export interface AuthSession {
  token: string;
  refreshToken?: string;
  expiresAt?: number; // epoch ms
  user: User;
}

export interface LoginPayload {
  email: string;
  password: string;
}

export interface RegisterPayload {
  name: string;
  email: string;
  password: string;
}

// =============================================================================
// Catalog
// =============================================================================

export interface Money {
  amount: number;
  currency: string; // ISO-4217, e.g. INR
}

export interface Product {
  id: string;
  slug: string;
  name: string;
  description?: string;
  brand?: string;
  category: string;
  imageUrl?: string;
  gallery?: string[];
  price: Money;
  compareAtPrice?: Money;
  rating?: number;
  reviewsCount?: number;
  inStock: boolean;
  tags?: string[];
}

export interface ProductFilters {
  q?: string;
  category?: string;
  minPrice?: number;
  maxPrice?: number;
  sort?: 'relevance' | 'price-asc' | 'price-desc' | 'new' | 'popular';
  page?: number;
  pageSize?: number;
}

// =============================================================================
// Cart
// =============================================================================

export interface CartItem {
  productId: string;
  name: string;
  imageUrl?: string;
  unitPrice: Money;
  quantity: number;
}

export interface Cart {
  id: string;
  items: CartItem[];
  subtotal: Money;
  discount?: Money;
  tax?: Money;
  total: Money;
  updatedAt: string;
}

// =============================================================================
// Orders
// =============================================================================

export type OrderStatus =
  | 'PENDING'
  | 'CONFIRMED'
  | 'PACKED'
  | 'OUT_FOR_DELIVERY'
  | 'DELIVERED'
  | 'CANCELLED';

export interface Order {
  id: string;
  status: OrderStatus;
  items: CartItem[];
  total: Money;
  placedAt: string;
  estimatedDelivery?: string;
  trackingId?: string;
}

// =============================================================================
// Recommendations
// =============================================================================

export interface Recommendation {
  product: Product;
  score: number;     // 0..1 — how confident the model is
  reason?: string;   // human-readable rationale
}

// =============================================================================
// API envelope
// =============================================================================

export interface ApiError {
  status: number;
  message: string;
  code?: string;
  details?: Record<string, unknown>;
}

export interface Paginated<T> {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
}

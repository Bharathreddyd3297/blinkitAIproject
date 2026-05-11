/**
 * Single source of truth for route paths.
 *
 * Resist the urge to write `to="/products"` literals scattered across the
 * codebase — typo'd Links are a real source of dead-end navigation. Import
 * from here so the compiler keeps you honest.
 */
export const paths = {
  home:            '/',
  login:           '/login',
  register:        '/register',
  products:        '/products',
  productDetail:   (slug: string) => `/products/${slug}`,
  cart:            '/cart',
  orders:          '/orders',
  orderDetail:     (id: string) => `/orders/${id}`,
  checkout:        '/checkout',
  recommendations: '/recommendations',
  account:         '/account',
  admin:           '/admin',
} as const;

/**
 * Mock content used as a graceful fallback when the gateway is unreachable.
 *
 * The rule: never let the frontend look broken. If product-service returns a
 * network error (status 0), we render this curated catalog instead. The user
 * still sees a premium experience; the only thing they don't see is *their*
 * data. Service modules call `withMockFallback(fetch, mock)` to wire it up.
 *
 * NOTE: Keep this file pure data. No backend endpoints, no localStorage â€”
 * just believable content shaped exactly like the API contracts in
 * `types/domain.ts`. If the contract drifts, this file must drift with it.
 */

import type {
  Cart,
  Order,
  Paginated,
  Product,
  Recommendation,
} from '@app-types/domain';

const inr = (amount: number) => ({ amount, currency: 'INR' });

// =============================================================================
// Categories
// =============================================================================

export const mockCategories: { slug: string; label: string; accent: string; gradient: string }[] = [
  { slug: 'fresh',        label: 'Fresh produce',  accent: '#a8ff60', gradient: 'from-[#a8ff60] to-[#22e2ff]' },
  { slug: 'pantry',       label: 'Pantry essentials', accent: '#ffb347', gradient: 'from-[#ffb347] to-[#ff52d9]' },
  { slug: 'beverages',    label: 'Beverages',      accent: '#22e2ff', gradient: 'from-[#22e2ff] to-[#9b6bff]' },
  { slug: 'snacks',       label: 'Snacks & sweets',accent: '#ff52d9', gradient: 'from-[#ff52d9] to-[#9b6bff]' },
  { slug: 'household',    label: 'Household',      accent: '#9b6bff', gradient: 'from-[#9b6bff] to-[#22e2ff]' },
  { slug: 'personal-care',label: 'Personal care',  accent: '#b794ff', gradient: 'from-[#b794ff] to-[#ff52d9]' },
];

// =============================================================================
// Products
// =============================================================================

export const mockProducts: Product[] = [
  {
    id:    'p_001',
    slug:  'organic-alphonso-mangoes',
    name:  'Organic Alphonso Mangoes',
    description: 'Hand-picked Ratnagiri Alphonsos â€” the original king of mangoes. Box of six.',
    brand: 'Aamrai',
    category: 'fresh',
    imageUrl: 'https://images.unsplash.com/photo-1601493700631-2b16ec4b4716?w=900&q=80&auto=format&fit=crop',
    price: inr(799),
    compareAtPrice: inr(999),
    rating: 4.8, reviewsCount: 1284,
    inStock: true,
    tags: ['Bestseller', 'Organic'],
  },
  {
    id:    'p_002',
    slug:  'cold-brew-arabica',
    name:  'Cold Brew Arabica',
    description: '24-hour slow-extracted single-origin coffee. Smooth, low acid, never bitter.',
    brand: 'Blue Tokai',
    category: 'beverages',
    imageUrl: 'https://images.unsplash.com/photo-1517701550927-30cf4ba1dba5?w=900&q=80&auto=format&fit=crop',
    price: inr(349),
    rating: 4.6, reviewsCount: 412,
    inStock: true,
    tags: ['New'],
  },
  {
    id:    'p_003',
    slug:  'himalayan-pink-salt',
    name:  'Himalayan Pink Salt',
    description: 'Stone-milled, mineral-rich salt sourced from ancient Punjab beds. 1kg jar.',
    brand: 'Tata Salt Lite',
    category: 'pantry',
    imageUrl: 'https://images.unsplash.com/photo-1604908176997-125f25cc6f3d?w=900&q=80&auto=format&fit=crop',
    price: inr(189),
    rating: 4.4, reviewsCount: 822,
    inStock: true,
  },
  {
    id:    'p_004',
    slug:  'dark-chocolate-truffle-box',
    name:  'Dark Chocolate Truffle Box',
    description: '70% Madagascar single-origin. 12 hand-rolled truffles, gift-ready packaging.',
    brand: 'Mason & Co.',
    category: 'snacks',
    imageUrl: 'https://images.unsplash.com/photo-1548907040-4baa42d10919?w=900&q=80&auto=format&fit=crop',
    price: inr(549),
    compareAtPrice: inr(699),
    rating: 4.9, reviewsCount: 2034,
    inStock: true,
    tags: ['Editor pick', 'Vegan'],
  },
  {
    id:    'p_005',
    slug:  'matcha-ceremonial-grade',
    name:  'Ceremonial Matcha',
    description: 'Stone-ground Uji matcha. Vibrant umami, no bitter aftertaste. 30g tin.',
    brand: 'Sencha House',
    category: 'beverages',
    imageUrl: 'https://images.unsplash.com/photo-1536782376847-5c9d14d97cc0?w=900&q=80&auto=format&fit=crop',
    price: inr(1299),
    rating: 4.7, reviewsCount: 156,
    inStock: true,
    tags: ['Premium'],
  },
  {
    id:    'p_006',
    slug:  'aged-sourdough-loaf',
    name:  'Aged Sourdough Loaf',
    description: '36-hour cold ferment. Crackling crust, open crumb, naturally leavened.',
    brand: 'Theo & Co.',
    category: 'pantry',
    imageUrl: 'https://images.unsplash.com/photo-1509440159596-0249088772ff?w=900&q=80&auto=format&fit=crop',
    price: inr(279),
    rating: 4.5, reviewsCount: 298,
    inStock: false,
  },
  {
    id:    'p_007',
    slug:  'avocado-pack',
    name:  'Hass Avocados (Pack of 4)',
    description: 'Ripened just enough â€” buttery smooth, perfect on toast within 24 hours.',
    brand: 'Westlands',
    category: 'fresh',
    imageUrl: 'https://images.unsplash.com/photo-1601039641847-7857b994d704?w=900&q=80&auto=format&fit=crop',
    price: inr(449),
    rating: 4.3, reviewsCount: 511,
    inStock: true,
    tags: ['Trending'],
  },
  {
    id:    'p_008',
    slug:  'sparkling-water-yuzu',
    name:  'Yuzu Sparkling Water',
    description: 'Japanese yuzu citrus, naturally carbonated, zero sweeteners. 6-pack.',
    brand: 'Kombu',
    category: 'beverages',
    imageUrl: 'https://images.unsplash.com/photo-1622543925917-763c34d1a86e?w=900&q=80&auto=format&fit=crop',
    price: inr(399),
    rating: 4.2, reviewsCount: 87,
    inStock: true,
  },
  {
    id:    'p_009',
    slug:  'truffle-pasta-sauce',
    name:  'Truffle Pasta Sauce',
    description: 'Italian black summer truffle, slow-simmered with cream and parmesan.',
    brand: 'Casa Verde',
    category: 'pantry',
    imageUrl: 'https://images.unsplash.com/photo-1604152135912-04a022e23696?w=900&q=80&auto=format&fit=crop',
    price: inr(699),
    rating: 4.6, reviewsCount: 184,
    inStock: true,
    tags: ['Limited'],
  },
  {
    id:    'p_010',
    slug:  'oat-milk-barista',
    name:  'Oat Milk â€” Barista Edition',
    description: 'Foam-friendly, plant-forward. Pairs beautifully with espresso. 1L.',
    brand: 'OatBar',
    category: 'beverages',
    imageUrl: 'https://images.unsplash.com/photo-1576186726115-4d51596775d1?w=900&q=80&auto=format&fit=crop',
    price: inr(229),
    rating: 4.4, reviewsCount: 932,
    inStock: true,
  },
  {
    id:    'p_011',
    slug:  'sea-salt-caramel-gelato',
    name:  'Sea Salt Caramel Gelato',
    description: 'Slow-churned, ribbons of salted caramel through Madagascar vanilla base.',
    brand: 'Naturale',
    category: 'snacks',
    imageUrl: 'https://images.unsplash.com/photo-1488477181946-6428a0291777?w=900&q=80&auto=format&fit=crop',
    price: inr(459),
    rating: 4.7, reviewsCount: 1108,
    inStock: true,
    tags: ['Bestseller'],
  },
  {
    id:    'p_012',
    slug:  'lavender-honey-200g',
    name:  'Lavender Honey',
    description: 'Single-source raw honey from Provence lavender fields. Floral, never crystallised.',
    brand: 'Maison Apis',
    category: 'pantry',
    imageUrl: 'https://images.unsplash.com/photo-1587049352846-4a222e784d38?w=900&q=80&auto=format&fit=crop',
    price: inr(899),
    rating: 4.8, reviewsCount: 244,
    inStock: true,
    tags: ['Premium'],
  },
];

// =============================================================================
// Pagination + recommendation views over the catalog
// =============================================================================

export const paginatedMockProducts = (page = 1, pageSize = 12): Paginated<Product> => {
  const start = (page - 1) * pageSize;
  return {
    items:    mockProducts.slice(start, start + pageSize),
    page,
    pageSize,
    total:    mockProducts.length,
  };
};

const reasons = [
  'Frequently bought with your last order',
  'Trending in your area',
  'Matches your taste profile',
  'Highly rated by similar shoppers',
  'On sale â€” picked for you',
  'New from a brand you follow',
];

export const mockForYouRecommendations: Recommendation[] = mockProducts
  .slice(0, 8)
  .map((p, i) => ({
    product: p,
    score: 0.62 + ((i * 0.041) % 0.36),
    reason: reasons[i % reasons.length],
  }));

export const mockTrendingRecommendations: Recommendation[] = [...mockProducts]
  .sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0))
  .slice(0, 8)
  .map((p, i) => ({ product: p, score: 0.92 - i * 0.03, reason: 'Trending across Blinkit' }));

export const mockSimilarRecommendations = (productId: string): Recommendation[] =>
  mockProducts
    .filter((p) => p.id !== productId)
    .slice(0, 6)
    .map((p, i) => ({ product: p, score: 0.88 - i * 0.05, reason: 'Vector-similar to this product' }));

// =============================================================================
// Cart + Order skeletons (used by demo state when the cart-service is down)
// =============================================================================

export const emptyMockCart: Cart = {
  id: 'cart_demo',
  items: [],
  subtotal: inr(0),
  total:    inr(0),
  updatedAt: new Date().toISOString(),
};

export const mockOrders: Paginated<Order> = {
  items: [
    {
      id: 'ord_2406_1182',
      status: 'OUT_FOR_DELIVERY',
      items: [
        { productId: 'p_001', name: mockProducts[0].name, imageUrl: mockProducts[0].imageUrl, unitPrice: mockProducts[0].price, quantity: 1 },
        { productId: 'p_004', name: mockProducts[3].name, imageUrl: mockProducts[3].imageUrl, unitPrice: mockProducts[3].price, quantity: 2 },
      ],
      total: inr(799 + 549 * 2),
      placedAt: new Date(Date.now() - 1000 * 60 * 35).toISOString(),
      estimatedDelivery: new Date(Date.now() + 1000 * 60 * 12).toISOString(),
      trackingId: 'BLK-90X14',
    },
    {
      id: 'ord_2405_0341',
      status: 'DELIVERED',
      items: [
        { productId: 'p_010', name: mockProducts[9].name, imageUrl: mockProducts[9].imageUrl, unitPrice: mockProducts[9].price, quantity: 3 },
      ],
      total: inr(229 * 3),
      placedAt: new Date(Date.now() - 1000 * 60 * 60 * 36).toISOString(),
    },
  ],
  page: 1, pageSize: 10, total: 2,
};

// =============================================================================
// Address book â€” used by the checkout shipping step when the user has saved
// addresses. The structure mirrors what an /addresses endpoint would return.
// =============================================================================

export interface MockAddress {
  id: string;
  label: string;          // "Home", "Office"
  fullName: string;
  phone: string;
  street: string;
  landmark?: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
}

export const mockAddresses: MockAddress[] = [
  {
    id: 'addr_home',
    label: 'Home',
    fullName: 'Bharath Reddy',
    phone: '+91 98765 43210',
    street: '4th Floor, Prestige Atlanta, 100 Feet Rd',
    landmark: 'Opp. Cubbon Park metro',
    city: 'Bengaluru',
    state: 'Karnataka',
    postalCode: '560001',
    country: 'India',
  },
  {
    id: 'addr_office',
    label: 'Office',
    fullName: 'Bharath Reddy',
    phone: '+91 98765 43210',
    street: 'Embassy Tech Village, Outer Ring Rd',
    city: 'Bengaluru',
    state: 'Karnataka',
    postalCode: '560103',
    country: 'India',
  },
];

// =============================================================================
// Payment intent simulation â€” the real payment-service exposes these endpoints
// behind the gateway. We mirror the same shape so the UI runs identically
// against either source.
// =============================================================================

export interface MockPaymentIntent {
  id: string;
  clientSecret: string;
  amount: number;
  currency: string;
  status: 'requires_confirmation' | 'requires_action' | 'succeeded' | 'failed';
}

let intentCounter = 0;
export const createMockPaymentIntent = (amount: number): MockPaymentIntent => {
  intentCounter += 1;
  const id = `pi_demo_${Date.now().toString(36)}_${intentCounter}`;
  return {
    id,
    clientSecret: `${id}_secret_${Math.random().toString(36).slice(2, 10)}`,
    amount,
    currency: 'INR',
    status: 'requires_confirmation',
  };
};

/**
 * Simulate the payment confirmation roundtrip. Most calls succeed; a small
 * randomised slice fails so the failure UX gets exercised in demos. Caller
 * can opt out of randomness by passing `forceSucceed: true`.
 */
export const confirmMockPaymentIntent = async (
  intentId: string,
  forceSucceed = false,
): Promise<MockPaymentIntent> => {
  // Pretend the gateway is doing real work â€” keeps the cinematic processing
  // overlay visible long enough to feel polished, not jittery.
  await new Promise((r) => setTimeout(r, 1400 + Math.random() * 600));
  const failed = !forceSucceed && Math.random() < 0.06;
  return {
    id: intentId,
    clientSecret: `${intentId}_secret`,
    amount: 0,
    currency: 'INR',
    status: failed ? 'failed' : 'succeeded',
  };
};

// =============================================================================
// Helper: try real fetcher, fall back to mock on a network failure.
// We only fall back on network-level failures (status 0). 4xx/5xx are real
// backend responses and should bubble up so the UI can show a real error.
// =============================================================================

import type { ApiError } from '@app-types/domain';

export async function withMockFallback<T>(
  fetcher: () => Promise<T>,
  fallback: () => T | Promise<T>,
): Promise<T> {
  try {
    return await fetcher();
  } catch (err) {
    const apiErr = err as ApiError;
    if (apiErr && apiErr.status === 0) return await fallback();
    throw err;
  }
}

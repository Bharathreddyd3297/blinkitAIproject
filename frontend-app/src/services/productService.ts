import { api } from '@services/api';
import { mapProduct, mapProductPage } from '@services/mappers';
import type { Paginated, Product, ProductFilters } from '@app-types/domain';
import {
  mockCategories,
  mockProducts,
  paginatedMockProducts,
  withMockFallback,
} from '@utils/mock';

/**
 * Talks to the gateway's `/api/products` surface (product-service).
 *
 * Backend pagination is 0-indexed (`page=0&size=12`); the frontend domain
 * uses 1-indexed pages. The mapper bridges both. Every list call returns a
 * `Paginated<Product>` whose `items` are already in frontend `Product` shape
 * (slug derived from name, price as `Money`).
 *
 * Mock fallback only fires when the gateway is unreachable
 * (`status === 0`); 4xx errors propagate so the UI can surface them.
 */

const toBackendPageParams = (filters: ProductFilters) => {
  const page     = (filters.page ?? 1) - 1;       // 1-indexed → 0-indexed
  const size     = filters.pageSize ?? 12;
  const params: Record<string, string | number> = { page, size };
  if (filters.q)        params.name     = filters.q;
  if (filters.category && filters.category !== 'all') params.category = filters.category;
  return params;
};

const applyMockFilters = (filters: ProductFilters = {}): Paginated<Product> => {
  let list = [...mockProducts];
  if (filters.q) {
    const q = filters.q.toLowerCase();
    list = list.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.brand?.toLowerCase().includes(q) ||
        p.category.toLowerCase().includes(q),
    );
  }
  if (filters.category && filters.category !== 'all') {
    list = list.filter((p) => p.category === filters.category);
  }
  if (filters.minPrice !== undefined) list = list.filter((p) => p.price.amount >= filters.minPrice!);
  if (filters.maxPrice !== undefined) list = list.filter((p) => p.price.amount <= filters.maxPrice!);
  switch (filters.sort) {
    case 'price-asc':  list.sort((a, b) => a.price.amount - b.price.amount); break;
    case 'price-desc': list.sort((a, b) => b.price.amount - a.price.amount); break;
    case 'popular':    list.sort((a, b) => (b.reviewsCount ?? 0) - (a.reviewsCount ?? 0)); break;
    default: break;
  }
  const page     = filters.page     ?? 1;
  const pageSize = filters.pageSize ?? 12;
  const start    = (page - 1) * pageSize;
  return { items: list.slice(start, start + pageSize), page, pageSize, total: list.length };
};

export const productService = {
  list: (filters: ProductFilters = {}) =>
    withMockFallback(
      () => api.get<unknown>('/products', { params: toBackendPageParams(filters) })
              .then((page) => mapProductPage(page as Parameters<typeof mapProductPage>[0])),
      () => applyMockFilters(filters),
    ),

  getBySlug: (slug: string) =>
    // Backend has no slug endpoint — search by name keyword and pick the first match.
    withMockFallback(
      async () => {
        const page = await api.get<unknown>('/products', {
          params: { name: slug.replace(/-/g, ' '), size: 1 },
        });
        const mapped = mapProductPage(page as Parameters<typeof mapProductPage>[0]);
        if (mapped.items.length === 0) {
          throw { status: 404, message: 'Product not found' };
        }
        return mapped.items[0];
      },
      () => {
        const product = mockProducts.find((p) => p.slug === slug);
        if (!product) throw { status: 404, message: 'Product not found' };
        return product;
      },
    ),

  getById: (id: string) =>
    withMockFallback(
      () => api.get<unknown>(`/products/${id}`).then((p) => mapProduct(p as Parameters<typeof mapProduct>[0])),
      () => {
        const product = mockProducts.find((p) => p.id === id);
        if (!product) throw { status: 404, message: 'Product not found' };
        return product;
      },
    ),

  search: (q: string, pageSize = 12) =>
    withMockFallback(
      () => api.get<unknown>('/products', { params: { name: q, size: pageSize } })
              .then((page) => mapProductPage(page as Parameters<typeof mapProductPage>[0])),
      () => applyMockFilters({ q, pageSize, page: 1 }),
    ),

  /**
   * Backend has no dedicated /categories endpoint — derive distinct categories
   * from the catalogue. The mock fallback list is used when the gateway is down.
   */
  categories: () =>
    withMockFallback(
      async () => {
        const page = await api.get<unknown>('/products', { params: { size: 100 } });
        const mapped = mapProductPage(page as Parameters<typeof mapProductPage>[0]);
        return Array.from(new Set(mapped.items.map((p) => p.category)));
      },
      () => mockCategories.map((c) => c.slug),
    ),

  paginated: (page = 1, pageSize = 12) => paginatedMockProducts(page, pageSize),
};

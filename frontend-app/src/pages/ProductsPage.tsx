import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Search, Sparkles } from 'lucide-react';

import { PageHeader } from '@pages/_shared/PageHeader';
import { Container } from '@components/primitives/Container';
import { Input } from '@components/primitives/Input';
import { Button } from '@components/primitives/Button';
import { GlassCard } from '@components/primitives/GlassCard';
import { ProductFilters } from '@components/product/ProductFilters';
import { ProductGrid } from '@components/product/ProductGrid';
import { useAppDispatch, useAppSelector } from '@store/hooks';
import {
  fetchProducts,
  setFilters,
} from '@store/slices/productsSlice';
import { setSearchOverlayOpen } from '@store/slices/uiSlice';
import type { ProductFilters as Filters } from '@app-types/domain';

/**
 * Catalog page.
 *
 * Filter state is synced both to the Redux slice (so the catalog stays warm
 * across navigation) and to URL search params (so a category link from the
 * homepage / a shared URL lands on the right view). The URL is the source
 * of truth on first paint; user actions update both.
 */
export default function ProductsPage() {
  const dispatch = useAppDispatch();
  const [params, setParams] = useSearchParams();
  const products      = useAppSelector((s) => s.products.list);
  const status        = useAppSelector((s) => s.products.status);
  const pagination    = useAppSelector((s) => s.products.pagination);

  // Inline search input (lives next to the strip, distinct from cmd+k overlay).
  const [inlineQ, setInlineQ] = useState(params.get('q') ?? '');

  // Read filters from URL on every render â€” cheap, stays in sync with browser back/forward.
  const filtersFromUrl: Filters = useMemo(() => ({
    q:        params.get('q') ?? undefined,
    category: params.get('category') ?? undefined,
    sort:     (params.get('sort') as Filters['sort']) ?? 'relevance',
    page:     Number(params.get('page') ?? '1'),
    pageSize: 12,
  }), [params]);

  // Push filter changes into the slice + the URL.
  useEffect(() => {
    dispatch(setFilters(filtersFromUrl));
    dispatch(fetchProducts(filtersFromUrl));
  }, [dispatch, filtersFromUrl]);

  const onChangeFilters = (next: Partial<Filters>) => {
    const merged = { ...filtersFromUrl, ...next };
    const out = new URLSearchParams();
    if (merged.q && merged.q !== '')   out.set('q',        merged.q);
    if (merged.category)                out.set('category', merged.category);
    if (merged.sort && merged.sort !== 'relevance') out.set('sort', merged.sort);
    if (merged.page && merged.page > 1) out.set('page',     String(merged.page));
    setParams(out, { replace: false });
  };

  const onInlineSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onChangeFilters({ q: inlineQ.trim() || undefined, page: 1 });
  };

  const totalPages = Math.max(1, Math.ceil(pagination.total / pagination.pageSize));
  const isLoading  = status === 'loading';

  return (
    <div>
      <PageHeader
        eyebrow="Catalog"
        title={<>Browse the entire <span className="text-gradient">marketplace.</span></>}
        description="The product service streams here through the gateway â€” AI-ranked, Redis-cached, and personalised when you sign in."
        actions={
          <Button
            variant="ghost"
            iconLeft={<Sparkles size={14} />}
            onClick={() => dispatch(setSearchOverlayOpen(true))}
          >
            Open search Â· âŒ˜K
          </Button>
        }
      />

      <Container>
        {/* Inline search */}
        <form onSubmit={onInlineSubmit} className="mb-6">
          <Input
            value={inlineQ}
            onChange={(e) => setInlineQ(e.target.value)}
            placeholder="Search products, brands, categoriesâ€¦"
            iconLeft={<Search size={14} />}
          />
        </form>

        {/* Filters + sort */}
        <div className="mb-8">
          <ProductFilters value={filtersFromUrl} onChange={onChangeFilters} />
        </div>

        {/* Result count */}
        <div className="mb-4 flex items-center justify-between text-xs text-ink-300">
          <span>
            {isLoading
              ? 'Loading catalogâ€¦'
              : `${pagination.total.toLocaleString()} products`}
          </span>
          <span className="font-mono">
            Page {pagination.page} of {totalPages}
          </span>
        </div>

        {/* Grid */}
        <ProductGrid
          products={products}
          loading={isLoading && products.length === 0}
          skeletonCount={12}
          emptyState={
            <GlassCard className="grid place-items-center py-20 text-center">
              <p className="font-display text-lg text-white">No matching products</p>
              <p className="mt-1 max-w-sm text-sm text-ink-300">
                Try clearing a filter or searching with a broader keyword.
              </p>
              <Button
                variant="ghost"
                className="mt-5"
                onClick={() => setParams(new URLSearchParams())}
              >
                Reset filters
              </Button>
            </GlassCard>
          }
        />

        {/* Pagination */}
        {!isLoading && totalPages > 1 && (
          <div className="mt-12 flex items-center justify-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              disabled={pagination.page <= 1}
              onClick={() => onChangeFilters({ page: pagination.page - 1 })}
            >
              Previous
            </Button>
            <span className="px-4 font-mono text-xs text-ink-300">
              {pagination.page} / {totalPages}
            </span>
            <Button
              variant="ghost"
              size="sm"
              disabled={pagination.page >= totalPages}
              onClick={() => onChangeFilters({ page: pagination.page + 1 })}
            >
              Next
            </Button>
          </div>
        )}
      </Container>
    </div>
  );
}

import type { Product, Recommendation } from '@app-types/domain';
import { ProductCard } from '@components/product/ProductCard';
import { ProductCardSkeleton } from '@components/loading/ProductCardSkeleton';
import { Stagger, StaggerItem } from '@animations/Stagger';
import { cn } from '@utils/cn';

interface ProductGridProps {
  products?: Product[];
  recommendations?: Recommendation[];
  loading?: boolean;
  skeletonCount?: number;
  emptyState?: React.ReactNode;
  className?: string;
  /** Tighter grid for sidebars / detail pages. */
  density?: 'comfortable' | 'compact';
}

const densityClass: Record<NonNullable<ProductGridProps['density']>, string> = {
  comfortable: 'grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4',
  compact:     'grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-4',
};

/**
 * Generic product grid. Pass either `products` (plain catalog) or
 * `recommendations` (catalog + AI score). When loading, shows skeletons that
 * match the same grid density so the layout doesn't shift on hydration.
 */
export function ProductGrid({
  products,
  recommendations,
  loading,
  skeletonCount = 8,
  emptyState,
  className,
  density = 'comfortable',
}: ProductGridProps) {
  if (loading) {
    return (
      <div className={cn('grid', densityClass[density], className)}>
        {Array.from({ length: skeletonCount }).map((_, i) => (
          <ProductCardSkeleton key={i} />
        ))}
      </div>
    );
  }

  // Recommendation rendering takes precedence â€” it carries the AI metadata.
  if (recommendations && recommendations.length > 0) {
    return (
      <Stagger className={cn('grid', densityClass[density], className)}>
        {recommendations.map((r) => (
          <StaggerItem key={r.product.id}>
            <ProductCard product={r.product} aiScore={r.score} aiReason={r.reason} />
          </StaggerItem>
        ))}
      </Stagger>
    );
  }

  if (!products || products.length === 0) {
    return <>{emptyState}</>;
  }

  return (
    <Stagger className={cn('grid', densityClass[density], className)}>
      {products.map((p) => (
        <StaggerItem key={p.id}>
          <ProductCard product={p} />
        </StaggerItem>
      ))}
    </Stagger>
  );
}

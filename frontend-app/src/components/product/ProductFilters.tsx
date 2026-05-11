import { motion } from 'framer-motion';
import type { ProductFilters as Filters } from '@app-types/domain';
import { mockCategories } from '@utils/mock';
import { cn } from '@utils/cn';

interface ProductFiltersProps {
  value: Filters;
  onChange: (next: Partial<Filters>) => void;
}

const SORTS: { value: NonNullable<Filters['sort']>; label: string }[] = [
  { value: 'relevance',  label: 'Relevance' },
  { value: 'new',        label: 'New' },
  { value: 'popular',    label: 'Popular' },
  { value: 'price-asc',  label: 'Price â†‘' },
  { value: 'price-desc', label: 'Price â†“' },
];

/**
 * Horizontal filter strip â€” category chips on the left, sort pills on the
 * right. Active selections animate via shared layoutId, mirroring the
 * navbar's active-pill effect for visual consistency.
 */
export function ProductFilters({ value, onChange }: ProductFiltersProps) {
  return (
    <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
      <div className="no-scrollbar flex gap-2 overflow-x-auto pb-1">
        <Chip
          active={!value.category || value.category === 'all'}
          layoutId="filter-category"
          onClick={() => onChange({ category: undefined, page: 1 })}
        >
          All
        </Chip>
        {mockCategories.map((c) => (
          <Chip
            key={c.slug}
            active={value.category === c.slug}
            layoutId="filter-category"
            onClick={() => onChange({ category: c.slug, page: 1 })}
          >
            {c.label}
          </Chip>
        ))}
      </div>

      <div className="flex items-center gap-2">
        <span className="hidden text-[0.7rem] uppercase tracking-[0.18em] text-ink-300 md:inline">
          Sort
        </span>
        <div className="no-scrollbar flex gap-1 overflow-x-auto rounded-full border border-white/10 bg-white/[0.02] p-1">
          {SORTS.map((s) => {
            const active = (value.sort ?? 'relevance') === s.value;
            return (
              <button
                key={s.value}
                onClick={() => onChange({ sort: s.value, page: 1 })}
                className={cn(
                  'relative rounded-full px-3 py-1.5 text-xs font-medium transition',
                  active ? 'text-white' : 'text-ink-200 hover:text-white',
                )}
              >
                {active && (
                  <motion.span
                    layoutId="filter-sort"
                    className="absolute inset-0 rounded-full bg-white/[0.08] shadow-glow-sm"
                    transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
                  />
                )}
                <span className="relative">{s.label}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function Chip({
  children,
  active,
  layoutId,
  onClick,
}: {
  children: React.ReactNode;
  active: boolean;
  layoutId?: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'relative shrink-0 rounded-full border px-3.5 py-2 text-xs font-medium transition',
        active
          ? 'border-accent/50 text-white'
          : 'border-white/10 text-ink-200 hover:border-white/25 hover:text-white',
      )}
    >
      {active && (
        <motion.span
          layoutId={layoutId}
          className="absolute inset-0 rounded-full bg-accent/15 shadow-glow-sm"
          transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
        />
      )}
      <span className="relative">{children}</span>
    </button>
  );
}

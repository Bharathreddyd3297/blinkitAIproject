import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Plus, Sparkles } from 'lucide-react';

import type { Recommendation } from '@app-types/domain';
import { recommendationService } from '@services/recommendationService';
import { useAppDispatch, useAppSelector } from '@store/hooks';
import { addCartItem } from '@store/slices/cartSlice';
import { useToast } from '@hooks/useToast';
import { formatMoney } from '@utils/format';
import { cn } from '@utils/cn';

interface CartUpsellsProps {
  /** Compact horizontal scroll for the cart drawer; vertical for the cart page. */
  layout?: 'drawer' | 'page';
  className?: string;
}

/**
 * AI upsell strip rendered inside both the cart drawer and the cart page.
 *
 * The seed for similarity is the first product in the cart. This is a real
 * call to the recommendation-service (with mock fallback). We keep the strip
 * narrow on purpose â€” the goal is "one tasteful nudge", not a wall of ads.
 */
export function CartUpsells({ layout = 'drawer', className }: CartUpsellsProps) {
  const dispatch = useAppDispatch();
  const toast = useToast();
  const cart = useAppSelector((s) => s.cart.cart);
  const seed = cart?.items[0]?.productId;

  const [recs, setRecs] = useState<Recommendation[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!seed) { setRecs([]); return; }
    let cancelled = false;
    setLoading(true);
    recommendationService
      .similar(seed, layout === 'drawer' ? 4 : 6)
      .then((r) => { if (!cancelled) setRecs(r); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [seed, layout]);

  if (!seed || (recs.length === 0 && !loading)) return null;

  const onAdd = async (productId: string, name: string) => {
    try {
      await dispatch(addCartItem({ productId, quantity: 1 })).unwrap();
      toast.success(`${name} added`, 'Subtotal updated');
    } catch {
      toast.error('Could not add', 'Please try again in a moment');
    }
  };

  return (
    <div className={cn(layout === 'page' ? 'mt-8' : 'mt-6', className)}>
      <div className="mb-3 flex items-center gap-2">
        <Sparkles size={13} className="text-accent-glow" />
        <p className="text-[0.7rem] uppercase tracking-[0.18em] text-ink-300">
          Frequently bought together
        </p>
      </div>

      <div
        className={cn(
          layout === 'drawer'
            ? 'no-scrollbar flex gap-2.5 overflow-x-auto snap-x snap-mandatory mask-fade-x'
            : 'grid gap-3 sm:grid-cols-2 lg:grid-cols-3',
        )}
      >
        {(loading ? Array.from({ length: 4 }) : recs).map((r, i) => {
          const rec = (r as Recommendation | undefined);
          return (
            <motion.div
              key={rec?.product.id ?? `s-${i}`}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1], delay: i * 0.04 }}
              className={cn(
                'group relative flex shrink-0 snap-start gap-3 rounded-2xl border border-white/8 bg-white/[0.02] p-2.5',
                layout === 'drawer' ? 'w-[220px]' : 'w-full',
              )}
            >
              {rec ? (
                <>
                  <div className="h-14 w-14 shrink-0 overflow-hidden rounded-xl border border-white/8 bg-ink-900/60">
                    {rec.product.imageUrl && (
                      <img src={rec.product.imageUrl} alt="" className="h-full w-full object-cover" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="line-clamp-2 text-[0.78rem] text-white">{rec.product.name}</p>
                    <p className="mt-1 font-display text-xs font-semibold text-white">
                      {formatMoney(rec.product.price)}
                    </p>
                  </div>
                  <button
                    onClick={() => onAdd(rec.product.id, rec.product.name)}
                    className="grid h-8 w-8 shrink-0 place-items-center self-center rounded-full border border-white/15 bg-ink-900/80 text-white transition hover:border-accent/55 hover:shadow-glow-sm"
                    aria-label={`Add ${rec.product.name}`}
                  >
                    <Plus size={14} />
                  </button>
                </>
              ) : (
                <>
                  <div className="h-14 w-14 shrink-0 rounded-xl bg-white/5 animate-pulse" />
                  <div className="flex-1 space-y-1.5">
                    <div className="h-3 w-3/4 rounded bg-white/5 animate-pulse" />
                    <div className="h-3 w-1/3 rounded bg-white/5 animate-pulse" />
                  </div>
                </>
              )}
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}

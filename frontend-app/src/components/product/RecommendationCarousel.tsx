import { useRef } from 'react';
import { motion } from 'framer-motion';
import { ChevronLeft, ChevronRight, Sparkles } from 'lucide-react';

import type { Recommendation } from '@app-types/domain';
import { ProductCard } from '@components/product/ProductCard';
import { ProductCardSkeleton } from '@components/loading/ProductCardSkeleton';
import { cn } from '@utils/cn';

interface RecommendationCarouselProps {
  title: string;
  description?: string;
  recommendations: Recommendation[];
  loading?: boolean;
  emphasize?: boolean;
}

/**
 * Horizontal-scroll carousel of AI-ranked products.
 *
 * Why a manual scroller and not a carousel library? Native scroll-snap is
 * smoother on touch, doesn't fight the browser's momentum, and ships zero
 * extra bytes. We add discrete prev/next chevrons that animate the scroll
 * by one card-width â€” that's the only reason we keep a ref.
 */
export function RecommendationCarousel({
  title,
  description,
  recommendations,
  loading,
  emphasize,
}: RecommendationCarouselProps) {
  const scrollerRef = useRef<HTMLDivElement>(null);

  const scrollBy = (dir: 1 | -1) => {
    const el = scrollerRef.current;
    if (!el) return;
    const card = el.querySelector('[data-rec-card]') as HTMLElement | null;
    const w = card ? card.getBoundingClientRect().width + 20 /* gap */ : 320;
    el.scrollBy({ left: dir * w * 2, behavior: 'smooth' });
  };

  return (
    <section
      className={cn(
        'relative overflow-hidden rounded-3xl border border-white/10 p-6 md:p-8',
        emphasize
          ? 'bg-mesh bg-[length:200%_200%] animate-gradient-pan shadow-glow-sm'
          : 'bg-white/[0.02]',
      )}
    >
      {emphasize && <div className="absolute inset-0 bg-gradient-to-br from-ink-950/65 to-transparent" />}

      <div className="relative mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="eyebrow mb-2">
            <Sparkles size={12} /> AI ranked
          </p>
          <h2 className="font-display text-2xl font-semibold tracking-tight text-white">{title}</h2>
          {description && <p className="mt-1 max-w-xl text-sm text-ink-300">{description}</p>}
        </div>
        <div className="flex gap-1.5">
          <CarouselButton onClick={() => scrollBy(-1)} aria-label="Scroll back">
            <ChevronLeft size={16} />
          </CarouselButton>
          <CarouselButton onClick={() => scrollBy(1)} aria-label="Scroll forward">
            <ChevronRight size={16} />
          </CarouselButton>
        </div>
      </div>

      <motion.div
        ref={scrollerRef}
        className="no-scrollbar relative flex snap-x snap-mandatory gap-5 overflow-x-auto pb-2 mask-fade-x"
        // The carousel itself is dragable on touch â€” scroll-snap handles the rest.
        style={{ scrollPaddingInline: '4px' }}
      >
        {loading
          ? Array.from({ length: 6 }).map((_, i) => (
              <div
                key={i}
                data-rec-card
                className="w-[260px] shrink-0 snap-start sm:w-[280px]"
              >
                <ProductCardSkeleton />
              </div>
            ))
          : recommendations.map((r) => (
              <div
                key={r.product.id}
                data-rec-card
                className="w-[260px] shrink-0 snap-start sm:w-[280px]"
              >
                <ProductCard product={r.product} aiScore={r.score} aiReason={r.reason} />
              </div>
            ))}
      </motion.div>
    </section>
  );
}

function CarouselButton(props: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...props}
      className="grid h-9 w-9 place-items-center rounded-xl border border-white/10 bg-white/[0.04] text-ink-100 transition hover:border-white/25 hover:bg-white/[0.08] hover:text-white"
    />
  );
}

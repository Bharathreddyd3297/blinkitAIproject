import { motion, useMotionValue, useSpring, useTransform } from 'framer-motion';
import { Link } from 'react-router-dom';
import { Plus, Sparkles, Star } from 'lucide-react';
import { type MouseEvent, useState } from 'react';

import type { Product } from '@app-types/domain';
import { paths } from '@routes/paths';
import { useAppDispatch } from '@store/hooks';
import { addCartItem } from '@store/slices/cartSlice';
import { setCartDrawerOpen } from '@store/slices/uiSlice';
import { useToast } from '@hooks/useToast';
import { useReducedMotion } from '@hooks/useReducedMotion';
import { PriceTag } from '@components/product/PriceTag';
import { StockPill } from '@components/product/StockPill';
import { Badge } from '@components/primitives/Badge';
import { cn } from '@utils/cn';

interface ProductCardProps {
  product: Product;
  /** Optional 0..1 AI score to render the recommendation indicator. */
  aiScore?: number;
  /** Optional rationale string surfaced from the recommendation service. */
  aiReason?: string;
  className?: string;
}

/**
 * Premium product card.
 *
 * Behaviour:
 *   - 3D tilt on hover, driven by a spring (skipped under reduced-motion).
 *   - Image scales subtly on hover â€” never crops on layout.
 *   - Add-to-cart fires optimistically, opens the drawer, then toasts.
 *   - Falls back to a calm hover lift if the user prefers reduced motion.
 *
 * The whole card is one Link to the detail page; the add-to-cart button
 * stops propagation so it doesn't navigate away from the listing.
 */
export function ProductCard({ product, aiScore, aiReason, className }: ProductCardProps) {
  const dispatch = useAppDispatch();
  const toast = useToast();
  const reducedMotion = useReducedMotion();
  const [adding, setAdding] = useState(false);

  // ---- Tilt math ----------------------------------------------------------
  const tiltX = useMotionValue(0);
  const tiltY = useMotionValue(0);
  // Stiffer spring + lower damping = "premium glass", not "wobbly toy".
  const rx = useSpring(useTransform(tiltY, [-50, 50], [6, -6]),  { stiffness: 220, damping: 18 });
  const ry = useSpring(useTransform(tiltX, [-50, 50], [-6, 6]),  { stiffness: 220, damping: 18 });

  const onMouseMove = (e: MouseEvent<HTMLDivElement>) => {
    if (reducedMotion) return;
    const rect = e.currentTarget.getBoundingClientRect();
    tiltX.set(e.clientX - rect.left - rect.width / 2);
    tiltY.set(e.clientY - rect.top  - rect.height / 2);
  };
  const onMouseLeave = () => { tiltX.set(0); tiltY.set(0); };

  // ---- Actions ------------------------------------------------------------
  const onAdd = async (e: MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!product.inStock || adding) return;
    setAdding(true);
    try {
      await dispatch(addCartItem({ productId: product.id, quantity: 1 })).unwrap();
      dispatch(setCartDrawerOpen(true));
      toast.success(`${product.name} added`, 'Open the cart to checkout when ready');
    } catch {
      toast.error('Could not add to cart', 'Please try again in a moment');
    } finally {
      setAdding(false);
    }
  };

  return (
    <motion.div
      className={cn('group relative', className)}
      style={{ perspective: 900 }}
      onMouseMove={onMouseMove}
      onMouseLeave={onMouseLeave}
      whileHover={{ y: reducedMotion ? 0 : -4 }}
      transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
    >
      <motion.div
        style={{
          rotateX: reducedMotion ? 0 : rx,
          rotateY: reducedMotion ? 0 : ry,
          transformStyle: 'preserve-3d',
        }}
        className="relative h-full"
      >
        <Link
          to={paths.productDetail(product.slug)}
          className="block h-full focus-visible:outline-none"
          aria-label={`${product.name} â€” view details`}
        >
          <div
            className={cn(
              'card card-interactive sheen relative flex h-full flex-col overflow-hidden p-3.5',
              !product.inStock && 'opacity-80',
            )}
          >
            {/* Image */}
            <div className="relative mb-4 aspect-[4/3] w-full overflow-hidden rounded-2xl border border-white/5 bg-ink-900/50">
              {product.imageUrl ? (
                <motion.img
                  src={product.imageUrl}
                  alt={product.name}
                  loading="lazy"
                  className="h-full w-full object-cover"
                  whileHover={{ scale: reducedMotion ? 1 : 1.06 }}
                  transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
                />
              ) : (
                <div className="grid h-full place-items-center text-ink-300">No image</div>
              )}

              {/* Top-left: AI score */}
              {aiScore !== undefined && (
                <div
                  className="absolute left-3 top-3 flex items-center gap-1.5 rounded-full border border-accent/40 bg-ink-900/60 px-2 py-1 text-[0.65rem] font-semibold uppercase tracking-[0.14em] text-accent-glow shadow-glow-sm backdrop-blur"
                  title={aiReason ?? `AI confidence ${Math.round(aiScore * 100)}%`}
                >
                  <Sparkles size={10} />
                  AI Â· {Math.round(aiScore * 100)}%
                </div>
              )}

              {/* Top-right: tags */}
              {product.tags && product.tags.length > 0 && (
                <div className="absolute right-3 top-3">
                  <Badge variant="accent">{product.tags[0]}</Badge>
                </div>
              )}

              {/* Bottom-right: add to cart */}
              <motion.button
                onClick={onAdd}
                disabled={!product.inStock || adding}
                whileTap={{ scale: 0.92 }}
                className={cn(
                  'absolute bottom-3 right-3 inline-flex h-9 w-9 items-center justify-center rounded-full border border-white/20 bg-ink-900/80 text-white shadow-glow-sm backdrop-blur transition',
                  'hover:border-white/40 hover:bg-ink-900',
                  'disabled:cursor-not-allowed disabled:opacity-50',
                )}
                aria-label={`Add ${product.name} to cart`}
              >
                <Plus size={16} className={adding ? 'animate-pulse' : ''} />
              </motion.button>
            </div>

            {/* Body */}
            <div className="flex flex-1 flex-col">
              {product.brand && (
                <p className="text-[0.7rem] font-medium uppercase tracking-[0.16em] text-ink-300">
                  {product.brand}
                </p>
              )}
              <h3 className="mt-1 line-clamp-2 font-display text-[0.95rem] font-semibold leading-snug text-white">
                {product.name}
              </h3>

              {product.rating !== undefined && (
                <div className="mt-2 flex items-center gap-1.5 text-xs text-ink-300">
                  <Star size={12} className="fill-warning text-warning" />
                  <span className="text-ink-100">{product.rating.toFixed(1)}</span>
                  <span className="text-ink-400">Â·</span>
                  <span>{product.reviewsCount?.toLocaleString() ?? 0} reviews</span>
                </div>
              )}

              <div className="mt-auto flex items-end justify-between pt-4">
                <PriceTag price={product.price} compareAtPrice={product.compareAtPrice} />
                <StockPill inStock={product.inStock} />
              </div>
            </div>
          </div>
        </Link>
      </motion.div>
    </motion.div>
  );
}

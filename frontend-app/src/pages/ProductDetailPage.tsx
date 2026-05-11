import { motion } from 'framer-motion';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useEffect, useState } from 'react';
import {
  ArrowLeft,
  Bot,
  CheckCircle2,
  ChevronRight,
  Heart,
  Minus,
  Plus,
  Share2,
  ShoppingBag,
  Star,
  Truck,
} from 'lucide-react';

import type { Product, Recommendation } from '@app-types/domain';
import { productService } from '@services/productService';
import { recommendationService } from '@services/recommendationService';
import { useAppDispatch } from '@store/hooks';
import { addCartItem } from '@store/slices/cartSlice';
import { setCartDrawerOpen } from '@store/slices/uiSlice';
import { useToast } from '@hooks/useToast';
import { paths } from '@routes/paths';
import { Container } from '@components/primitives/Container';
import { Button } from '@components/primitives/Button';
import { Badge } from '@components/primitives/Badge';
import { GlassCard } from '@components/primitives/GlassCard';
import { PriceTag } from '@components/product/PriceTag';
import { StockPill } from '@components/product/StockPill';
import { RecommendationCarousel } from '@components/product/RecommendationCarousel';
import { Reveal } from '@animations/Reveal';
import { cn } from '@utils/cn';

/**
 * Premium product detail page.
 *
 * Layout: hero image-card on the left, info panel on the right. Below the
 * fold: trust signals (delivery, return, secure), then an AI-recommended
 * "Frequently bought with this" carousel from the recommendation-service.
 *
 * Loading is graceful â€” skeleton silhouette of the hero + info, then the
 * real layout swaps in. We never render an empty page.
 */
export default function ProductDetailPage() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const toast = useToast();

  const [product, setProduct]       = useState<Product | null>(null);
  const [activeImage, setActive]    = useState(0);
  const [qty, setQty]               = useState(1);
  const [adding, setAdding]         = useState(false);
  const [related, setRelated]       = useState<Recommendation[]>([]);
  const [relatedLoading, setRl]     = useState(true);

  // Hydrate product
  useEffect(() => {
    if (!slug) return;
    let cancelled = false;
    setProduct(null);
    productService
      .getBySlug(slug)
      .then((p) => { if (!cancelled) setProduct(p); })
      .catch(() => { if (!cancelled) navigate(paths.products, { replace: true }); });
    return () => { cancelled = true; };
  }, [slug, navigate]);

  // Hydrate "similar" recs once we have a product id
  useEffect(() => {
    if (!product) return;
    let cancelled = false;
    setRl(true);
    recommendationService
      .similar(product.id, 8)
      .then((r) => { if (!cancelled) setRelated(r); })
      .finally(() => { if (!cancelled) setRl(false); });
    return () => { cancelled = true; };
  }, [product]);

  const gallery = product?.gallery && product.gallery.length > 0
    ? product.gallery
    : product?.imageUrl ? [product.imageUrl] : [];

  const onAdd = async () => {
    if (!product || !product.inStock || adding) return;
    setAdding(true);
    try {
      await dispatch(addCartItem({ productId: product.id, quantity: qty })).unwrap();
      dispatch(setCartDrawerOpen(true));
      toast.success(`${product.name} added`, `${qty} Ã— in your cart`);
    } catch {
      toast.error('Could not add to cart', 'Please try again in a moment');
    } finally {
      setAdding(false);
    }
  };

  if (!product) {
    return <DetailSkeleton />;
  }

  return (
    <div>
      <Container className="pt-10">
        {/* Breadcrumb */}
        <nav className="mb-6 flex items-center gap-1.5 text-xs text-ink-300">
          <Link to={paths.home} className="transition hover:text-white">Home</Link>
          <ChevronRight size={12} />
          <Link to={paths.products} className="transition hover:text-white">Catalog</Link>
          <ChevronRight size={12} />
          <Link
            to={`${paths.products}?category=${product.category}`}
            className="capitalize transition hover:text-white"
          >
            {product.category.replace('-', ' ')}
          </Link>
          <ChevronRight size={12} />
          <span className="truncate text-ink-100">{product.name}</span>
        </nav>

        {/* Hero */}
        <div className="grid gap-10 lg:grid-cols-[1.1fr_1fr] lg:gap-14">
          {/* Gallery */}
          <div>
            <motion.div
              key={gallery[activeImage]}
              initial={{ opacity: 0, scale: 1.02 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
              className="relative aspect-square overflow-hidden rounded-3xl border border-white/10 bg-ink-900/40"
            >
              {gallery[activeImage] ? (
                <img
                  src={gallery[activeImage]}
                  alt={product.name}
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="grid h-full place-items-center text-ink-300">No image</div>
              )}
              <div className="pointer-events-none absolute inset-0 bg-gradient-to-tr from-ink-950/40 via-transparent to-transparent" />
              {product.tags && product.tags.length > 0 && (
                <div className="absolute left-4 top-4 flex flex-wrap gap-2">
                  {product.tags.slice(0, 3).map((t, i) => (
                    <Badge key={t} variant={i === 0 ? 'accent' : 'neutral'}>{t}</Badge>
                  ))}
                </div>
              )}
            </motion.div>

            {/* Thumbs */}
            {gallery.length > 1 && (
              <div className="mt-4 flex gap-2 overflow-x-auto no-scrollbar">
                {gallery.map((src, i) => (
                  <button
                    key={src + i}
                    onClick={() => setActive(i)}
                    className={cn(
                      'h-20 w-20 shrink-0 overflow-hidden rounded-xl border transition',
                      i === activeImage
                        ? 'border-accent/60 shadow-glow-sm'
                        : 'border-white/10 hover:border-white/30',
                    )}
                    aria-label={`View image ${i + 1}`}
                  >
                    <img src={src} alt="" className="h-full w-full object-cover" />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Info */}
          <div className="flex flex-col">
            {product.brand && (
              <p className="text-[0.72rem] font-medium uppercase tracking-[0.18em] text-ink-300">
                {product.brand}
              </p>
            )}
            <h1 className="mt-2 font-display text-4xl font-semibold leading-tight tracking-tight text-balance text-white md:text-5xl">
              {product.name}
            </h1>

            {product.rating !== undefined && (
              <div className="mt-3 flex items-center gap-2 text-sm text-ink-200">
                <span className="inline-flex items-center gap-1">
                  <Star size={14} className="fill-warning text-warning" />
                  <span className="font-semibold text-white">{product.rating.toFixed(1)}</span>
                </span>
                <span className="text-ink-400">Â·</span>
                <span>{product.reviewsCount?.toLocaleString() ?? 0} reviews</span>
              </div>
            )}

            <p className="mt-5 text-pretty text-base text-ink-200">
              {product.description}
            </p>

            <div className="mt-6 flex items-end gap-4">
              <PriceTag price={product.price} compareAtPrice={product.compareAtPrice} size="lg" />
              <StockPill inStock={product.inStock} />
            </div>

            {/* Quantity + add */}
            <div className="mt-7 flex items-center gap-3">
              <div className="inline-flex items-center rounded-2xl border border-white/10 bg-white/[0.03]">
                <QtyButton onClick={() => setQty((q) => Math.max(1, q - 1))} aria-label="Decrease quantity">
                  <Minus size={14} />
                </QtyButton>
                <span className="min-w-10 text-center font-mono text-sm text-white">{qty}</span>
                <QtyButton onClick={() => setQty((q) => Math.min(99, q + 1))} aria-label="Increase quantity">
                  <Plus size={14} />
                </QtyButton>
              </div>

              <Button
                size="lg"
                onClick={onAdd}
                disabled={!product.inStock || adding}
                iconLeft={<ShoppingBag size={15} />}
              >
                {adding ? 'Addingâ€¦' : product.inStock ? 'Add to cart' : 'Sold out'}
              </Button>

              <button
                className="grid h-11 w-11 place-items-center rounded-xl border border-white/10 text-ink-200 transition hover:border-white/25 hover:text-white"
                aria-label="Save for later"
                onClick={() => toast.info('Saved for later', 'Find it again in your wishlist')}
              >
                <Heart size={15} />
              </button>
              <button
                className="grid h-11 w-11 place-items-center rounded-xl border border-white/10 text-ink-200 transition hover:border-white/25 hover:text-white"
                aria-label="Share"
                onClick={() => {
                  navigator.clipboard?.writeText(window.location.href).catch(() => {});
                  toast.success('Link copied', 'Share it anywhere');
                }}
              >
                <Share2 size={15} />
              </button>
            </div>

            {/* Trust strip */}
            <div className="mt-8 grid gap-3 sm:grid-cols-3">
              <Trust icon={<Truck size={14} />}      label="Free delivery" hint="Orders over â‚¹499" />
              <Trust icon={<CheckCircle2 size={14} />} label="Easy returns"  hint="7 days, no questions" />
              <Trust icon={<Bot size={14} />}         label="AI-curated"     hint="Personalised matches" />
            </div>
          </div>
        </div>

        {/* AI carousel */}
        <Reveal className="mt-24">
          <RecommendationCarousel
            title="Frequently bought with this"
            description="Vector-similar products ranked by the recommendation-service."
            recommendations={related}
            loading={relatedLoading}
            emphasize
          />
        </Reveal>
      </Container>
    </div>
  );
}

// =============================================================================

function QtyButton(props: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...props}
      className="grid h-11 w-11 place-items-center rounded-2xl text-ink-100 transition hover:text-white"
    />
  );
}

function Trust({
  icon,
  label,
  hint,
}: {
  icon: React.ReactNode;
  label: string;
  hint: string;
}) {
  return (
    <GlassCard intensity="faint" className="p-3.5">
      <div className="flex items-center gap-2.5">
        <div className="grid h-7 w-7 place-items-center rounded-lg border border-white/10 bg-white/[0.04] text-accent-glow">
          {icon}
        </div>
        <div>
          <p className="text-sm text-white">{label}</p>
          <p className="text-[0.7rem] text-ink-300">{hint}</p>
        </div>
      </div>
    </GlassCard>
  );
}

function DetailSkeleton() {
  return (
    <Container className="pt-10">
      <div className="grid gap-10 lg:grid-cols-[1.1fr_1fr] lg:gap-14">
        <div className="aspect-square animate-pulse rounded-3xl border border-white/10 bg-white/[0.03]" />
        <div className="space-y-4">
          <div className="h-3 w-24 animate-pulse rounded bg-white/5" />
          <div className="h-10 w-3/4 animate-pulse rounded bg-white/5" />
          <div className="h-4 w-1/3 animate-pulse rounded bg-white/5" />
          <div className="h-20 animate-pulse rounded bg-white/5" />
          <div className="h-12 w-1/2 animate-pulse rounded bg-white/5" />
          <div className="grid grid-cols-3 gap-3">
            <div className="h-14 animate-pulse rounded-xl bg-white/5" />
            <div className="h-14 animate-pulse rounded-xl bg-white/5" />
            <div className="h-14 animate-pulse rounded-xl bg-white/5" />
          </div>
        </div>
      </div>
      <div className="mt-12 flex justify-start">
        <Link to={paths.products} className="text-sm text-ink-300 hover:text-white">
          <ArrowLeft size={14} className="mr-1 inline" />
          Back to catalog
        </Link>
      </div>
    </Container>
  );
}

import { Link } from 'react-router-dom';
import { ArrowRight, ShoppingBag, Sparkles, Trash2 } from 'lucide-react';
import { AnimatePresence } from 'framer-motion';
import { useEffect } from 'react';

import { PageHeader } from '@pages/_shared/PageHeader';
import { Container } from '@components/primitives/Container';
import { GlassCard } from '@components/primitives/GlassCard';
import { Button } from '@components/primitives/Button';
import { CartLineItem } from '@components/cart/CartLineItem';
import { CartUpsells } from '@components/cart/CartUpsells';
import { Spinner } from '@components/loading/Spinner';
import { paths } from '@routes/paths';
import { useAppDispatch, useAppSelector } from '@store/hooks';
import { fetchCart } from '@store/slices/cartSlice';
import { cartService } from '@services/cartService';
import { useToast } from '@hooks/useToast';
import { formatMoney } from '@utils/format';

/**
 * Full-page cart view. The drawer is the primary cart UX, but the page
 * exists for users arriving via a deep link, /cart bookmark, or who simply
 * prefer a non-overlay view. The two surfaces share the cart slice and the
 * `<CartLineItem>` primitive, so they stay perfectly in sync.
 */
export default function CartPage() {
  const dispatch = useAppDispatch();
  const cart = useAppSelector((s) => s.cart.cart);
  const status = useAppSelector((s) => s.cart.status);
  const toast = useToast();

  useEffect(() => {
    if (!cart) dispatch(fetchCart());
  }, [cart, dispatch]);

  const onClear = async () => {
    await cartService.clear();
    dispatch(fetchCart());
    toast.info('Cart cleared', 'Your selection was removed');
  };

  const isLoading = status === 'loading' && !cart;

  return (
    <div>
      <PageHeader
        eyebrow="Cart"
        title="Your selection."
        description="Sub-100ms read paths, Redis-cached. Items sync the moment you change them."
        actions={
          cart && cart.items.length > 0 ? (
            <Button variant="ghost" iconLeft={<Trash2 size={14} />} onClick={onClear}>
              Clear cart
            </Button>
          ) : undefined
        }
      />
      <Container>
        <div className="grid gap-6 lg:grid-cols-[1.7fr_1fr]">
          <div className="space-y-3">
            {isLoading ? (
              <GlassCard className="grid place-items-center py-20">
                <Spinner />
              </GlassCard>
            ) : !cart || cart.items.length === 0 ? (
              <GlassCard className="grid place-items-center py-20 text-center">
                <ShoppingBag size={28} className="text-ink-300" />
                <h2 className="mt-4 font-display text-xl font-semibold">Cart is empty</h2>
                <p className="mt-2 max-w-sm text-sm text-ink-300">
                  Browse the catalog and add products. The cart-service syncs your
                  selection across every device, instantly.
                </p>
                <Link to={paths.products} className="mt-6">
                  <Button iconRight={<ArrowRight size={14} />}>Explore catalog</Button>
                </Link>
              </GlassCard>
            ) : (
              <>
                <AnimatePresence initial={false}>
                  {cart.items.map((item) => (
                    <CartLineItem key={item.productId} item={item} />
                  ))}
                </AnimatePresence>
                <CartUpsells layout="page" />
              </>
            )}
          </div>

          <GlassCard intensity="strong" className="h-fit lg:sticky lg:top-24">
            <h3 className="font-display text-lg font-semibold">Order summary</h3>
            <p className="mt-1 text-sm text-ink-300">
              {cart && cart.items.length > 0
                ? `${cart.items.reduce((a, i) => a + i.quantity, 0)} items in cart`
                : 'No items yet'}
            </p>
            <div className="hairline my-5" />
            <div className="space-y-3 text-sm">
              <Row label="Subtotal" value={cart ? formatMoney(cart.subtotal) : '—'} />
              <Row label="Discount" value={cart?.discount ? `− ${formatMoney(cart.discount)}` : '—'} muted />
              <Row label="Tax"      value={cart?.tax      ? formatMoney(cart.tax) : '—'} muted />
            </div>
            <div className="hairline my-5" />
            <Row label="Total" value={cart ? formatMoney(cart.total) : '—'} emphasize />
            <Link to={paths.checkout} className="mt-5 inline-block w-full">
              <Button
                fullWidth
                size="lg"
                iconLeft={<Sparkles size={14} />}
                disabled={!cart || cart.items.length === 0}
              >
                Proceed to checkout
              </Button>
            </Link>
            <p className="mt-3 text-center text-[0.7rem] uppercase tracking-[0.16em] text-ink-300">
              Secured by gateway · TLS 1.3
            </p>
          </GlassCard>
        </div>
      </Container>
    </div>
  );
}

function Row({
  label,
  value,
  emphasize,
  muted,
}: {
  label: string;
  value: string;
  emphasize?: boolean;
  muted?: boolean;
}) {
  return (
    <div className="flex items-center justify-between">
      <span className={muted ? 'text-ink-300' : emphasize ? 'text-ink-100' : 'text-ink-300'}>
        {label}
      </span>
      <span className={emphasize ? 'font-display text-lg text-white' : 'text-ink-100'}>
        {value}
      </span>
    </div>
  );
}

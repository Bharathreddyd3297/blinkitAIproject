import { AnimatePresence, motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { useEffect } from 'react';
import { ArrowRight, ShoppingBag, Sparkles, X } from 'lucide-react';

import { useAppDispatch, useAppSelector } from '@store/hooks';
import { fetchCart } from '@store/slices/cartSlice';
import { setCartDrawerOpen } from '@store/slices/uiSlice';
import { CartLineItem } from '@components/cart/CartLineItem';
import { CartUpsells } from '@components/cart/CartUpsells';
import { Button } from '@components/primitives/Button';
import { Spinner } from '@components/loading/Spinner';
import { formatMoney } from '@utils/format';
import { paths } from '@routes/paths';

/**
 * Slide-in cart drawer.
 *
 * Mounts at the layout root so any component can dispatch `setCartDrawerOpen`
 * to surface it. We fetch the cart on first open (then keep it warm — the
 * cart slice doesn't refetch unless the user manually triggers it). On
 * close we don't clear state — the cart should feel instant when reopened.
 */
export function CartDrawer() {
  const dispatch = useAppDispatch();
  const open    = useAppSelector((s) => s.ui.cartDrawerOpen);
  const cart    = useAppSelector((s) => s.cart.cart);
  const status  = useAppSelector((s) => s.cart.status);

  useEffect(() => {
    if (open && !cart) dispatch(fetchCart());
  }, [open, cart, dispatch]);

  // Lock body scroll while the drawer is open.
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, [open]);

  const close = () => dispatch(setCartDrawerOpen(false));
  const itemCount = cart?.items.reduce((acc, i) => acc + i.quantity, 0) ?? 0;
  const isLoading = status === 'loading' && !cart;

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            key="cart-scrim"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
            onClick={close}
            className="fixed inset-0 z-40 bg-ink-950/55 backdrop-blur-sm"
          />
          <motion.aside
            key="cart-panel"
            role="dialog"
            aria-label="Cart"
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
            className="fixed right-0 top-0 z-50 flex h-full w-full max-w-[440px] flex-col border-l border-white/10 bg-ink-900/85 backdrop-blur-2xl"
          >
            {/* Header */}
            <header className="flex items-center justify-between border-b border-white/8 p-5">
              <div>
                <p className="eyebrow mb-1.5">Your selection</p>
                <h2 className="font-display text-xl font-semibold text-white">
                  Cart{itemCount > 0 && ` · ${itemCount} item${itemCount === 1 ? '' : 's'}`}
                </h2>
              </div>
              <button
                onClick={close}
                className="grid h-9 w-9 place-items-center rounded-xl border border-white/10 text-ink-200 transition hover:border-white/25 hover:text-white"
                aria-label="Close cart"
              >
                <X size={15} />
              </button>
            </header>

            {/* Body */}
            <div className="flex-1 overflow-y-auto p-5">
              {isLoading ? (
                <div className="grid h-full place-items-center">
                  <Spinner />
                </div>
              ) : !cart || cart.items.length === 0 ? (
                <EmptyState onClose={close} />
              ) : (
                <>
                  <motion.div layout className="space-y-3">
                    <AnimatePresence initial={false}>
                      {cart.items.map((item) => (
                        <CartLineItem key={item.productId} item={item} />
                      ))}
                    </AnimatePresence>
                  </motion.div>
                  <CartUpsells layout="drawer" />
                </>
              )}
            </div>

            {/* Footer */}
            {cart && cart.items.length > 0 && (
              <footer className="border-t border-white/8 p-5">
                <div className="space-y-2 text-sm">
                  <Row label="Subtotal" value={formatMoney(cart.subtotal)} />
                  {cart.discount && cart.discount.amount > 0 && (
                    <Row label="Discount" value={`− ${formatMoney(cart.discount)}`} muted />
                  )}
                  {cart.tax && cart.tax.amount > 0 && (
                    <Row label="Tax" value={formatMoney(cart.tax)} muted />
                  )}
                  <div className="hairline my-3" />
                  <Row label="Total" value={formatMoney(cart.total)} emphasize />
                </div>
                <Link to={paths.checkout} onClick={close} className="mt-5 inline-block w-full">
                  <Button fullWidth size="lg" iconLeft={<Sparkles size={14} />} iconRight={<ArrowRight size={14} />}>
                    Checkout
                  </Button>
                </Link>
                <p className="mt-2 text-center text-[0.65rem] uppercase tracking-[0.16em] text-ink-300">
                  Secured by gateway · TLS 1.3
                </p>
              </footer>
            )}
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}

function Row({
  label,
  value,
  muted,
  emphasize,
}: {
  label: string;
  value: string;
  muted?: boolean;
  emphasize?: boolean;
}) {
  return (
    <div className="flex items-center justify-between">
      <span className={muted ? 'text-ink-300' : 'text-ink-100'}>{label}</span>
      <span className={emphasize ? 'font-display text-lg font-semibold text-white' : 'text-ink-100'}>
        {value}
      </span>
    </div>
  );
}

function EmptyState({ onClose }: { onClose: () => void }) {
  return (
    <div className="grid h-full place-items-center text-center">
      <div>
        <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl border border-white/10 bg-white/[0.04] text-ink-200">
          <ShoppingBag size={20} />
        </div>
        <h3 className="mt-4 font-display text-lg font-semibold text-white">Your cart is empty</h3>
        <p className="mx-auto mt-2 max-w-xs text-sm text-ink-300">
          Add something gorgeous and the cart-service syncs it across every device.
        </p>
        <Link to={paths.products} onClick={onClose} className="mt-5 inline-block">
          <Button iconRight={<ArrowRight size={14} />}>Explore catalog</Button>
        </Link>
      </div>
    </div>
  );
}

import { Link } from 'react-router-dom';
import { AnimatePresence } from 'framer-motion';
import { ArrowRight, ShoppingBag } from 'lucide-react';

import { useAppSelector } from '@store/hooks';
import { CartLineItem } from '@components/cart/CartLineItem';
import { Button } from '@components/primitives/Button';
import { paths } from '@routes/paths';
import { StepFooter, StepShell } from '@components/checkout/StepShell';

interface CartReviewStepProps {
  onNext: () => void;
}

/**
 * First step. Lets the user adjust quantities one last time before going
 * into address entry. We reuse `<CartLineItem>` so the UX is identical to
 * the cart drawer / cart page — no surprises mid-flow.
 */
export function CartReviewStep({ onNext }: CartReviewStepProps) {
  const cart = useAppSelector((s) => s.cart.cart);
  const items = cart?.items ?? [];

  return (
    <StepShell
      eyebrow="Step 1 · Review"
      title="Confirm your basket."
      description="Quantities sync instantly with the cart-service. Adjust anything before we lock the order."
      flat
      footer={
        <StepFooter
          onBack={null}
          onNext={items.length > 0 ? onNext : undefined}
          nextDisabled={items.length === 0}
        />
      }
    >
      {items.length === 0 ? (
        <div className="grid place-items-center rounded-3xl border border-white/10 bg-white/[0.02] p-14 text-center">
          <div className="grid h-12 w-12 place-items-center rounded-2xl border border-white/10 bg-white/[0.04] text-ink-200">
            <ShoppingBag size={18} />
          </div>
          <p className="mt-4 font-display text-lg text-white">Your cart is empty</p>
          <p className="mt-1 text-sm text-ink-300">
            Add products before continuing to checkout.
          </p>
          <Link to={paths.products} className="mt-5 inline-block">
            <Button iconRight={<ArrowRight size={14} />}>Explore catalog</Button>
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          <AnimatePresence initial={false}>
            {items.map((item) => (
              <CartLineItem key={item.productId} item={item} />
            ))}
          </AnimatePresence>
        </div>
      )}
    </StepShell>
  );
}

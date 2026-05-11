import { motion } from 'framer-motion';
import { Minus, Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';

import type { CartItem } from '@app-types/domain';
import { useAppDispatch } from '@store/hooks';
import { removeCartItem, updateCartItem } from '@store/slices/cartSlice';
import { formatMoney } from '@utils/format';
import { cn } from '@utils/cn';

interface CartLineItemProps {
  item: CartItem;
}

/**
 * Single cart line. Optimistic-feeling UI is achieved by keeping a local
 * `pending` flag for the +/- buttons so the user sees immediate response
 * even if the gateway is slow. The slice is the source of truth â€” if the
 * dispatch fails, the next render will reflect the rolled-back quantity.
 */
export function CartLineItem({ item }: CartLineItemProps) {
  const dispatch = useAppDispatch();
  const [pending, setPending] = useState(false);

  const change = async (next: number) => {
    if (pending) return;
    setPending(true);
    try {
      if (next <= 0) {
        await dispatch(removeCartItem(item.productId)).unwrap();
      } else {
        await dispatch(updateCartItem({ productId: item.productId, quantity: next })).unwrap();
      }
    } finally {
      setPending(false);
    }
  };

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: 80, transition: { duration: 0.22 } }}
      transition={{ duration: 0.32, ease: [0.16, 1, 0.3, 1] }}
      className="flex gap-3 rounded-2xl border border-white/8 bg-white/[0.02] p-3"
    >
      <div className="h-16 w-16 shrink-0 overflow-hidden rounded-xl border border-white/8 bg-ink-900/60">
        {item.imageUrl ? (
          <img src={item.imageUrl} alt={item.name} className="h-full w-full object-cover" loading="lazy" />
        ) : (
          <div className="grid h-full place-items-center text-[0.6rem] uppercase text-ink-300">No image</div>
        )}
      </div>

      <div className="flex flex-1 flex-col">
        <div className="flex items-start justify-between gap-3">
          <p className="line-clamp-2 text-sm text-white">{item.name}</p>
          <button
            onClick={() => change(0)}
            className="grid h-7 w-7 shrink-0 place-items-center rounded-lg text-ink-300 transition hover:bg-danger/10 hover:text-danger"
            aria-label="Remove from cart"
          >
            <Trash2 size={13} />
          </button>
        </div>
        <p className="mt-0.5 text-xs text-ink-300">{formatMoney(item.unitPrice)} each</p>

        <div className="mt-3 flex items-center justify-between">
          <div className="inline-flex items-center rounded-full border border-white/10 bg-white/[0.03]">
            <QtyButton onClick={() => change(item.quantity - 1)} disabled={pending} aria-label="Decrease quantity">
              <Minus size={12} />
            </QtyButton>
            <span className={cn(
              'min-w-7 text-center font-mono text-xs text-ink-100 transition',
              pending && 'opacity-60',
            )}>
              {item.quantity}
            </span>
            <QtyButton onClick={() => change(item.quantity + 1)} disabled={pending} aria-label="Increase quantity">
              <Plus size={12} />
            </QtyButton>
          </div>
          <p className="font-display text-sm font-semibold text-white">
            {formatMoney({
              amount: item.unitPrice.amount * item.quantity,
              currency: item.unitPrice.currency,
            })}
          </p>
        </div>
      </div>
    </motion.div>
  );
}

function QtyButton(props: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...props}
      className={cn(
        'grid h-7 w-7 place-items-center rounded-full text-ink-200 transition',
        'hover:text-white disabled:cursor-not-allowed disabled:opacity-50',
      )}
    />
  );
}

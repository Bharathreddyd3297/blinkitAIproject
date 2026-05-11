import type { Money } from '@app-types/domain';
import { formatMoney } from '@utils/format';
import { cn } from '@utils/cn';

interface PriceTagProps {
  price: Money;
  compareAtPrice?: Money;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const sizeClass: Record<NonNullable<PriceTagProps['size']>, string> = {
  sm: 'text-sm',
  md: 'text-base',
  lg: 'text-2xl',
};

/**
 * Money display with strikethrough compare-at when there's a discount.
 *
 * The discount badge is computed inline rather than passed in â€” the source
 * of truth for "is there a discount?" should be the prices themselves.
 */
export function PriceTag({ price, compareAtPrice, size = 'md', className }: PriceTagProps) {
  const hasDiscount = !!compareAtPrice && compareAtPrice.amount > price.amount;
  const discountPct = hasDiscount
    ? Math.round(((compareAtPrice!.amount - price.amount) / compareAtPrice!.amount) * 100)
    : 0;

  return (
    <div className={cn('inline-flex items-baseline gap-2', className)}>
      <span className={cn('font-display font-semibold text-white', sizeClass[size])}>
        {formatMoney(price)}
      </span>
      {hasDiscount && (
        <>
          <span className="text-xs text-ink-400 line-through">{formatMoney(compareAtPrice)}</span>
          <span className="rounded-full border border-success/40 bg-success/10 px-1.5 py-0.5 text-[0.65rem] font-semibold text-success">
            {discountPct}% off
          </span>
        </>
      )}
    </div>
  );
}

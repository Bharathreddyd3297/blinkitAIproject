import { cn } from '@utils/cn';

interface StockPillProps {
  inStock: boolean;
  className?: string;
}

/**
 * Tiny status dot + label. The pulsing dot is purely decorative — drives
 * attention without flickering on the user's eyes (1.6s loop).
 */
export function StockPill({ inStock, className }: StockPillProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[0.65rem] font-medium uppercase tracking-[0.14em]',
        inStock
          ? 'border-success/40 bg-success/10 text-success'
          : 'border-danger/40 bg-danger/10 text-danger',
        className,
      )}
    >
      <span
        className={cn(
          'h-1.5 w-1.5 rounded-full',
          inStock ? 'bg-success animate-pulse-glow' : 'bg-danger',
        )}
      />
      {inStock ? 'In stock' : 'Sold out'}
    </span>
  );
}

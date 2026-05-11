import { cn } from '@utils/cn';

interface LogoProps {
  className?: string;
  showWordmark?: boolean;
}

/**
 * Inline-SVG brand mark + wordmark. We render it as SVG (not <img>) so the
 * gradients participate in the same hover/glow treatments as everything
 * else, and so the mark can scale to any size without rasterizing.
 */
export function Logo({ className, showWordmark = true }: LogoProps) {
  return (
    <div className={cn('inline-flex items-center gap-2.5 select-none', className)}>
      <svg
        viewBox="0 0 64 64"
        className="h-8 w-8 drop-shadow-[0_0_18px_rgba(155,107,255,0.55)]"
        aria-hidden
      >
        <defs>
          <linearGradient id="lg-mark" x1="0" y1="0" x2="64" y2="64" gradientUnits="userSpaceOnUse">
            <stop offset="0"     stopColor="#22e2ff" />
            <stop offset="0.55"  stopColor="#9b6bff" />
            <stop offset="1"     stopColor="#ff52d9" />
          </linearGradient>
        </defs>
        <rect width="64" height="64" rx="14" fill="#0d1024" />
        <path
          d="M22 14h12c8 0 14 6 14 14 0 5-3 9-7 11 5 2 8 6 8 12 0 8-6 13-14 13H22V14Zm6 6v14h7c4 0 7-3 7-7s-3-7-7-7h-7Zm0 20v18h8c5 0 8-4 8-9s-3-9-8-9h-8Z"
          fill="url(#lg-mark)"
        />
      </svg>
      {showWordmark && (
        <span className="font-display text-[1.05rem] font-semibold tracking-tight text-ink-50">
          Blinkit
        </span>
      )}
    </div>
  );
}

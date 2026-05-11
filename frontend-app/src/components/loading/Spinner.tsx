import { cn } from '@utils/cn';

interface SpinnerProps {
  size?: number;
  className?: string;
}

/**
 * Conic-gradient spinner — premium, no SVG required, GPU-friendly.
 * The `mask` carves out the inner circle to leave a glowing arc.
 */
export function Spinner({ size = 24, className }: SpinnerProps) {
  return (
    <span
      className={cn(
        'inline-block animate-spin rounded-full',
        '[background:conic-gradient(from_0deg,transparent_0%,rgba(155,107,255,0.85)_70%,#ffffff_100%)]',
        '[mask:radial-gradient(circle_at_center,transparent_55%,#000_56%)]',
        '[-webkit-mask:radial-gradient(circle_at_center,transparent_55%,#000_56%)]',
        className,
      )}
      style={{ width: size, height: size }}
      aria-label="Loading"
      role="status"
    />
  );
}

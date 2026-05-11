import { forwardRef, type InputHTMLAttributes, type ReactNode } from 'react';
import { cn } from '@utils/cn';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  hint?: string;
  error?: string;
  iconLeft?: ReactNode;
}

/**
 * Field input with floating label aesthetic + optional leading icon.
 * Errors render below; hints are shown only when there's no error.
 */
export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, hint, error, iconLeft, className, id, ...rest }, ref) => {
    const inputId = id ?? rest.name ?? crypto.randomUUID();
    return (
      <div className="space-y-1.5">
        {label && (
          <label
            htmlFor={inputId}
            className="block text-[0.72rem] font-medium uppercase tracking-[0.14em] text-ink-300"
          >
            {label}
          </label>
        )}
        <div
          className={cn(
            'group flex items-center gap-2.5 rounded-xl border border-white/10 bg-white/[0.03] px-3.5 py-2.5 transition',
            'focus-within:border-accent/60 focus-within:bg-white/[0.05] focus-within:shadow-glow-sm',
            error && 'border-danger/60',
          )}
        >
          {iconLeft && <span className="text-ink-300">{iconLeft}</span>}
          <input
            id={inputId}
            ref={ref}
            className={cn(
              'w-full bg-transparent text-sm text-ink-50 placeholder:text-ink-400 focus:outline-none',
              className,
            )}
            {...rest}
          />
        </div>
        {error ? (
          <p className="text-xs text-danger">{error}</p>
        ) : hint ? (
          <p className="text-xs text-ink-300">{hint}</p>
        ) : null}
      </div>
    );
  },
);
Input.displayName = 'Input';

import { motion, type HTMLMotionProps } from 'framer-motion';
import { forwardRef, type ReactNode } from 'react';
import { cn } from '@utils/cn';

type ButtonVariant = 'primary' | 'ghost' | 'outline' | 'subtle';
type ButtonSize = 'sm' | 'md' | 'lg';

interface ButtonProps extends Omit<HTMLMotionProps<'button'>, 'children'> {
  children: ReactNode;
  variant?: ButtonVariant;
  size?: ButtonSize;
  iconLeft?: ReactNode;
  iconRight?: ReactNode;
  fullWidth?: boolean;
}

const variantClasses: Record<ButtonVariant, string> = {
  primary: 'btn btn-primary sheen',
  ghost:   'btn btn-ghost',
  outline: 'btn btn-outline',
  subtle:  'btn text-ink-200 hover:text-white',
};

const sizeClasses: Record<ButtonSize, string> = {
  sm: 'text-xs px-3 py-2 rounded-lg',
  md: 'text-sm px-4 py-2.5 rounded-xl',
  lg: 'text-base px-5 py-3 rounded-2xl',
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    { children, variant = 'primary', size = 'md', iconLeft, iconRight, fullWidth, className, ...rest },
    ref,
  ) => (
    <motion.button
      ref={ref}
      whileHover={{ y: -1 }}
      whileTap={{ scale: 0.98 }}
      transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
      className={cn(
        variantClasses[variant],
        sizeClasses[size],
        fullWidth && 'w-full',
        className,
      )}
      {...rest}
    >
      {iconLeft  && <span className="-ml-0.5 grid place-items-center">{iconLeft}</span>}
      <span>{children}</span>
      {iconRight && <span className="-mr-0.5 grid place-items-center">{iconRight}</span>}
    </motion.button>
  ),
);
Button.displayName = 'Button';

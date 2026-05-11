import { forwardRef, type HTMLAttributes, type ReactNode } from 'react';
import { cn } from '@utils/cn';

interface ContainerProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
  /** `wide` removes the max-width cap for hero sections that need to bleed. */
  size?: 'default' | 'wide' | 'narrow';
}

const sizes: Record<NonNullable<ContainerProps['size']>, string> = {
  default: 'max-w-[1280px]',
  wide:    'max-w-[1480px]',
  narrow:  'max-w-[920px]',
};

export const Container = forwardRef<HTMLDivElement, ContainerProps>(
  ({ children, className, size = 'default', ...rest }, ref) => (
    <div
      ref={ref}
      className={cn(
        'mx-auto w-full px-5 md:px-8 xl:px-10',
        sizes[size],
        className,
      )}
      {...rest}
    >
      {children}
    </div>
  ),
);
Container.displayName = 'Container';

import { motion, type HTMLMotionProps } from 'framer-motion';
import { forwardRef, type ReactNode } from 'react';
import { staggerContainer, staggerItem } from '@animations/variants';

interface StaggerProps extends Omit<HTMLMotionProps<'div'>, 'variants'> {
  children: ReactNode;
  stagger?: number;
  delay?: number;
}

export const Stagger = forwardRef<HTMLDivElement, StaggerProps>(
  ({ children, stagger = 0.07, delay = 0.05, ...rest }, ref) => (
    <motion.div
      ref={ref}
      variants={staggerContainer(stagger, delay)}
      initial="initial"
      whileInView="enter"
      viewport={{ once: true, amount: 0.25 }}
      {...rest}
    >
      {children}
    </motion.div>
  ),
);
Stagger.displayName = 'Stagger';

interface StaggerItemProps extends Omit<HTMLMotionProps<'div'>, 'variants'> {
  children: ReactNode;
}

export const StaggerItem = forwardRef<HTMLDivElement, StaggerItemProps>(
  ({ children, ...rest }, ref) => (
    <motion.div ref={ref} variants={staggerItem} {...rest}>
      {children}
    </motion.div>
  ),
);
StaggerItem.displayName = 'StaggerItem';

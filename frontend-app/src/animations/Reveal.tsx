import { motion, type HTMLMotionProps } from 'framer-motion';
import { type ReactNode } from 'react';
import { scrollReveal } from '@animations/variants';

interface RevealProps extends Omit<HTMLMotionProps<'div'>, 'variants' | 'initial' | 'whileInView'> {
  children: ReactNode;
  delay?: number;
  amount?: number; // 0..1 viewport intersection threshold
  once?: boolean;
}

/**
 * Drop-in scroll-reveal wrapper. Use anywhere you want content to
 * fade-and-rise into view as the user scrolls.
 *
 *   <Reveal delay={0.1}><h2>Featured</h2></Reveal>
 */
export function Reveal({
  children,
  delay = 0,
  amount = 0.2,
  once = true,
  ...rest
}: RevealProps) {
  return (
    <motion.div
      initial="hidden"
      whileInView="visible"
      viewport={{ once, amount }}
      variants={scrollReveal}
      transition={{ delay }}
      {...rest}
    >
      {children}
    </motion.div>
  );
}

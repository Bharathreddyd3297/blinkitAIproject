import { motion } from 'framer-motion';
import { type ReactNode } from 'react';
import { useLocation } from 'react-router-dom';

import { pageTransition } from '@animations/variants';

interface PageTransitionProps {
  children: ReactNode;
}

/**
 * Wraps a route's content so navigation between pages animates with the
 * same cinematic fade-blur-rise. Keying off `location.pathname` is what
 * makes Framer Motion run the exit/enter cycle instead of just diffing.
 */
export function PageTransition({ children }: PageTransitionProps) {
  const location = useLocation();
  return (
    <motion.div
      key={location.pathname}
      variants={pageTransition}
      initial="initial"
      animate="enter"
      exit="exit"
      className="relative"
    >
      {children}
    </motion.div>
  );
}

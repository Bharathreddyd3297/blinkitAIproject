import type { Variants } from 'framer-motion';

/**
 * Centralised Framer Motion variants. Keeping motion in one place prevents
 * the "every component invents its own easing curve" smell — and lets us tune
 * the entire app's feel from a single file.
 *
 * NOTE: We type the cubic-bezier tuples with `as const` rather than
 * `Transition['ease']` because Framer Motion 11 dropped that public type;
 * the runtime still accepts `[number, number, number, number]`.
 */

export const easeOutExpo    = [0.16, 1, 0.3, 1] as const;
export const easeInOutExpo  = [0.87, 0, 0.13, 1] as const;
export const easeSpringSoft = [0.34, 1.56, 0.64, 1] as const;

// ---------- Page transitions ----------

export const pageTransition: Variants = {
  initial: { opacity: 0, y: 14, filter: 'blur(8px)' },
  enter: {
    opacity: 1,
    y: 0,
    filter: 'blur(0px)',
    transition: { duration: 0.55, ease: easeOutExpo },
  },
  exit: {
    opacity: 0,
    y: -8,
    filter: 'blur(6px)',
    transition: { duration: 0.32, ease: easeInOutExpo },
  },
};

// ---------- Fade ----------

export const fadeIn: Variants = {
  initial: { opacity: 0 },
  enter:   { opacity: 1, transition: { duration: 0.5, ease: easeOutExpo } },
};

export const fadeUp: Variants = {
  initial: { opacity: 0, y: 18 },
  enter:   { opacity: 1, y: 0, transition: { duration: 0.65, ease: easeOutExpo } },
};

export const fadeDown: Variants = {
  initial: { opacity: 0, y: -18 },
  enter:   { opacity: 1, y: 0, transition: { duration: 0.65, ease: easeOutExpo } },
};

export const scaleIn: Variants = {
  initial: { opacity: 0, scale: 0.96 },
  enter:   { opacity: 1, scale: 1, transition: { duration: 0.55, ease: easeOutExpo } },
};

// ---------- Hover micro-interactions ----------

export const hoverLift = {
  rest:  { y: 0,  scale: 1,    transition: { duration: 0.25, ease: easeOutExpo } },
  hover: { y: -3, scale: 1.015, transition: { duration: 0.25, ease: easeOutExpo } },
  tap:   { scale: 0.985, transition: { duration: 0.15 } },
} as const;

export const hoverGlow = {
  rest:  { boxShadow: '0 0 0 0 rgba(155, 107, 255, 0)' },
  hover: { boxShadow: '0 0 28px 2px rgba(155, 107, 255, 0.5)' },
} as const;

// ---------- Stagger ----------

export const staggerContainer = (stagger = 0.07, delayChildren = 0.05): Variants => ({
  initial: {},
  enter: {
    transition: {
      staggerChildren: stagger,
      delayChildren,
    },
  },
});

export const staggerItem: Variants = {
  initial: { opacity: 0, y: 18 },
  enter:   { opacity: 1, y: 0, transition: { duration: 0.55, ease: easeOutExpo } },
};

// ---------- Scroll reveal (intersection-driven) ----------

export const scrollReveal: Variants = {
  hidden:  { opacity: 0, y: 24 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.7, ease: easeOutExpo } },
};

// ---------- Drawer / sheet ----------

export const slideInRight: Variants = {
  initial: { x: '100%' },
  enter:   { x: 0,     transition: { duration: 0.4, ease: easeOutExpo } },
  exit:    { x: '100%', transition: { duration: 0.3, ease: easeInOutExpo } },
};

export const slideInLeft: Variants = {
  initial: { x: '-100%' },
  enter:   { x: 0,      transition: { duration: 0.4, ease: easeOutExpo } },
  exit:    { x: '-100%', transition: { duration: 0.3, ease: easeInOutExpo } },
};

// ---------- Hero / display copy ----------

export const heroTextContainer: Variants = {
  initial: {},
  enter: {
    transition: { staggerChildren: 0.08, delayChildren: 0.1 },
  },
};

export const heroTextLine: Variants = {
  initial: { opacity: 0, y: 28, filter: 'blur(10px)' },
  enter: {
    opacity: 1,
    y: 0,
    filter: 'blur(0px)',
    transition: { duration: 0.85, ease: easeOutExpo },
  },
};

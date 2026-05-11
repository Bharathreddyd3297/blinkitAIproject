import { useMediaQuery } from '@hooks/useMediaQuery';

/**
 * Returns true when the user has requested reduced motion at the OS level.
 *
 * Use this to short-circuit ambient animations (particles, parallax, hero
 * loops) — accessibility, but it also helps battery life on low-power devices.
 */
export const useReducedMotion = () =>
  useMediaQuery('(prefers-reduced-motion: reduce)');

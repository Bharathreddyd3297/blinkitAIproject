/**
 * Design tokens consumed by JS / R3F / SVG runtime code.
 *
 * Tailwind reads its own tokens from tailwind.config.js. This module is for
 * places where Tailwind classes don't reach: Three.js materials, dynamic
 * inline styles, computed gradients, etc. Keep these values in sync with
 * tailwind.config.js — they describe the same visual system.
 */

export const tokens = {
  color: {
    bg:           '#070818',
    bgElevated:   '#0d1024',
    fg:           '#dde2ee',
    fgMuted:      '#8b93ad',
    fgSubtle:     '#5e6886',
    accent:       '#9b6bff',
    accentSoft:   '#7a5bff',
    accentGlow:   '#b794ff',
    neonCyan:     '#22e2ff',
    neonViolet:   '#9b6bff',
    neonMagenta:  '#ff52d9',
    neonLime:     '#a8ff60',
    neonAmber:    '#ffb347',
    success:      '#3ddc97',
    warning:      '#ffb347',
    danger:       '#ff5d6c',
  },
  motion: {
    easeOutExpo:    [0.16, 1, 0.3, 1] as const,
    easeInOutExpo:  [0.87, 0, 0.13, 1] as const,
    easeSpringSoft: [0.34, 1.56, 0.64, 1] as const,
    duration: {
      fast:    180,
      base:    260,
      slow:    420,
      slower:  680,
      epic:    900,
    },
  },
  layout: {
    navHeight:    72,
    containerMax: 1280,
  },
  glass: {
    bg:        'rgba(13, 16, 36, 0.55)',
    bgStrong:  'rgba(13, 16, 36, 0.75)',
    border:    'rgba(255, 255, 255, 0.10)',
    blur:      18,
  },
} as const;

export type Tokens = typeof tokens;

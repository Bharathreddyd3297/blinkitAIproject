/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // Premium futuristic palette — dark canvas with neon accents
        ink: {
          50:  '#f5f7fb',
          100: '#dde2ee',
          200: '#b8bfd2',
          300: '#8b93ad',
          400: '#5e6886',
          500: '#3a4361',
          600: '#252c46',
          700: '#161b30',
          800: '#0d1024',
          900: '#070818',
          950: '#03040d',
        },
        neon: {
          cyan:    '#22e2ff',
          violet:  '#9b6bff',
          magenta: '#ff52d9',
          lime:    '#a8ff60',
          amber:   '#ffb347',
        },
        accent: {
          DEFAULT: '#9b6bff',
          soft:    '#7a5bff',
          glow:    '#b794ff',
        },
        surface: {
          DEFAULT: 'rgba(255, 255, 255, 0.04)',
          raised:  'rgba(255, 255, 255, 0.06)',
          elevated:'rgba(255, 255, 255, 0.08)',
        },
        // NOTE: not using `border` here — Tailwind's `borderColor` defaults to
        // `colors`, so a top-level `border` key shadows the default border-color
        // utility. Use the `hairline-*` keys below for our custom border tokens.
        hairline: {
          subtle:  'rgba(255, 255, 255, 0.08)',
          DEFAULT: 'rgba(255, 255, 255, 0.12)',
          strong:  'rgba(255, 255, 255, 0.18)',
        },
        success: '#3ddc97',
        warning: '#ffb347',
        danger:  '#ff5d6c',
        info:    '#22e2ff',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'sans-serif'],
        display: ['"Space Grotesk"', 'Inter', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'SFMono-Regular', 'monospace'],
      },
      fontSize: {
        '2xs': ['0.6875rem', { lineHeight: '1rem', letterSpacing: '0.04em' }],
        xs:    ['0.75rem',   { lineHeight: '1.1rem', letterSpacing: '0.02em' }],
        sm:    ['0.875rem',  { lineHeight: '1.35rem' }],
        base:  ['1rem',      { lineHeight: '1.55rem' }],
        lg:    ['1.125rem',  { lineHeight: '1.7rem' }],
        xl:    ['1.25rem',   { lineHeight: '1.85rem' }],
        '2xl': ['1.5rem',    { lineHeight: '2rem',  letterSpacing: '-0.01em' }],
        '3xl': ['1.875rem',  { lineHeight: '2.3rem',letterSpacing: '-0.015em' }],
        '4xl': ['2.5rem',    { lineHeight: '2.8rem',letterSpacing: '-0.02em' }],
        '5xl': ['3.5rem',    { lineHeight: '3.6rem',letterSpacing: '-0.025em' }],
        '6xl': ['4.5rem',    { lineHeight: '4.6rem',letterSpacing: '-0.03em' }],
        '7xl': ['6rem',      { lineHeight: '6rem',  letterSpacing: '-0.035em' }],
      },
      spacing: {
        // 4-pt rhythm extended for hero / sectional layouts
        '4.5': '1.125rem',
        '18':  '4.5rem',
        '22':  '5.5rem',
        '30':  '7.5rem',
        '34':  '8.5rem',
        '38':  '9.5rem',
        '128': '32rem',
        '144': '36rem',
      },
      borderRadius: {
        xs: '0.25rem',
        '4xl': '2rem',
        '5xl': '2.5rem',
        '6xl': '3rem',
        pill: '9999px',
      },
      boxShadow: {
        'glow-sm':       '0 0 12px 0 rgba(155, 107, 255, 0.35)',
        'glow':          '0 0 28px 2px rgba(155, 107, 255, 0.45)',
        'glow-lg':       '0 0 48px 6px rgba(155, 107, 255, 0.55)',
        'glow-cyan':     '0 0 28px 2px rgba(34, 226, 255, 0.55)',
        'glow-magenta':  '0 0 28px 2px rgba(255, 82, 217, 0.5)',
        'glass':         '0 10px 30px -12px rgba(0, 0, 0, 0.55), inset 0 1px 0 0 rgba(255, 255, 255, 0.08)',
        'glass-lg':      '0 24px 60px -20px rgba(0, 0, 0, 0.6), inset 0 1px 0 0 rgba(255, 255, 255, 0.1)',
        'inner-glow':    'inset 0 0 20px 0 rgba(155, 107, 255, 0.25)',
        'soft':          '0 4px 24px -6px rgba(0, 0, 0, 0.4)',
        'lifted':        '0 18px 40px -16px rgba(0, 0, 0, 0.55)',
      },
      backdropBlur: {
        xs: '2px',
        '2xl': '32px',
        '3xl': '48px',
      },
      backgroundImage: {
        'gradient-radial':  'radial-gradient(circle at center, var(--tw-gradient-stops))',
        'gradient-conic':   'conic-gradient(from 180deg at 50% 50%, var(--tw-gradient-stops))',
        'aurora':
          'radial-gradient(at 20% 20%, rgba(155, 107, 255, 0.35) 0px, transparent 50%), ' +
          'radial-gradient(at 80% 0%, rgba(34, 226, 255, 0.25) 0px, transparent 50%), ' +
          'radial-gradient(at 50% 100%, rgba(255, 82, 217, 0.22) 0px, transparent 50%)',
        'mesh':
          'linear-gradient(120deg, rgba(155,107,255,0.18), rgba(34,226,255,0.12) 40%, rgba(255,82,217,0.16) 80%)',
        'sheen':
          'linear-gradient(110deg, transparent 30%, rgba(255,255,255,0.18) 50%, transparent 70%)',
        'grid-faint':
          'linear-gradient(rgba(255,255,255,0.04) 1px, transparent 1px), ' +
          'linear-gradient(90deg, rgba(255,255,255,0.04) 1px, transparent 1px)',
      },
      backgroundSize: {
        // NOTE: don't reuse keys from `backgroundImage` — Tailwind generates
        // both as `bg-<key>` utilities and they clash. Use arbitrary values
        // (e.g. `[background-size:48px_48px]`) for the grid sizing instead.
        'sheen': '200% 100%',
      },
      transitionTimingFunction: {
        'out-expo':    'cubic-bezier(0.16, 1, 0.3, 1)',
        'in-out-expo': 'cubic-bezier(0.87, 0, 0.13, 1)',
        'spring-soft': 'cubic-bezier(0.34, 1.56, 0.64, 1)',
      },
      transitionDuration: {
        250: '250ms',
        400: '400ms',
        600: '600ms',
        900: '900ms',
      },
      animation: {
        'fade-in':       'fade-in 0.6s ease-out both',
        'fade-up':       'fade-up 0.7s cubic-bezier(0.16, 1, 0.3, 1) both',
        'pulse-glow':    'pulse-glow 2.6s ease-in-out infinite',
        'float':         'float 6s ease-in-out infinite',
        'shimmer':       'shimmer 2.4s linear infinite',
        'aurora-shift':  'aurora-shift 18s ease-in-out infinite',
        'gradient-pan':  'gradient-pan 8s ease infinite',
        'spin-slow':     'spin 18s linear infinite',
      },
      keyframes: {
        'fade-in': {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        'fade-up': {
          '0%': { opacity: '0', transform: 'translateY(16px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'pulse-glow': {
          '0%, 100%': { boxShadow: '0 0 18px 0 rgba(155, 107, 255, 0.35)' },
          '50%':       { boxShadow: '0 0 36px 4px rgba(155, 107, 255, 0.65)' },
        },
        'float': {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%':       { transform: 'translateY(-10px)' },
        },
        'shimmer': {
          '0%':   { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
        'aurora-shift': {
          '0%, 100%': { transform: 'translate3d(0,0,0) scale(1)' },
          '50%':       { transform: 'translate3d(2%, -3%, 0) scale(1.06)' },
        },
        'gradient-pan': {
          '0%, 100%': { backgroundPosition: '0% 50%' },
          '50%':       { backgroundPosition: '100% 50%' },
        },
      },
    },
  },
  plugins: [],
};

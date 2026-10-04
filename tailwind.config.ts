import type { Config } from 'tailwindcss';

// Theme values come from CSS variables in src/theme/tokens.css (docs/UI_DESIGN.md → DESIGN TOKENS).
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      // Layout breakpoints from docs/UI_DESIGN.md → Responsive.
      screens: { mid: '900px', wide: '1200px' },
      colors: {
        bg: 'var(--bg)',
        panel: 'var(--panel)',
        'panel-raised': 'var(--panel-raised)',
        'panel-sunken': 'var(--panel-sunken)',
        graphite: 'var(--graphite)',
        'graphite-2': 'var(--graphite-2)',
        ink: 'var(--ink)',
        'ink-soft': 'var(--ink-soft)',
        'ink-inverse': 'var(--ink-inverse)',
        'led-on': 'var(--led-on)',
        'led-green': 'var(--led-green)',
        'led-amber': 'var(--led-amber)',
        'led-red': 'var(--led-red)',
        'lcd-bg': 'var(--lcd-bg)',
        'lcd-text': 'var(--lcd-text)',
      },
      boxShadow: {
        raised: 'var(--shadow-raised)',
        pressed: 'var(--shadow-pressed)',
        sunken: 'var(--shadow-sunken)',
      },
      borderRadius: {
        lg: 'var(--r-lg)',
        md: 'var(--r-md)',
        sm: 'var(--r-sm)',
        pad: 'var(--r-pad)',
      },
      fontFamily: {
        ui: 'var(--font-ui)',
        display: 'var(--font-display)',
        hand: 'var(--font-hand)',
      },
      spacing: {
        s1: 'var(--s1)',
        s2: 'var(--s2)',
        s3: 'var(--s3)',
        s4: 'var(--s4)',
        s5: 'var(--s5)',
        s6: 'var(--s6)',
      },
      transitionDuration: {
        fast: 'var(--t-fast)',
        base: 'var(--t-base)',
      },
      transitionTimingFunction: {
        pocket: 'var(--ease)',
      },
    },
  },
  plugins: [],
} satisfies Config;

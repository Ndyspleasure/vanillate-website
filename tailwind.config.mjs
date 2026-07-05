/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/**/*.{astro,html,js,jsx,md,mdx,svelte,ts,tsx,vue}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // Brand tokens Vanillate Studio
        ink: {
          950: '#0B0A0E', // Deepest bg (dark mode)
          900: '#111015',
          800: '#1A1820',
          700: '#26232E',
          600: '#3A3644',
        },
        cream: {
          50: '#FBF8F1',  // Body text on dark / bg on light
          100: '#F5EFE0', // Primary cream (vanilla nod)
          200: '#E8DFC7',
          300: '#C9BE9E',
        },
        amber: {
          400: '#F3C158',
          500: '#E8B84A', // Signature accent
          600: '#C99A2E',
        },
        teal: {
          400: '#6BC3B8',
          500: '#4FA89D', // Secondary accent
        },
      },
      fontFamily: {
        display: ['"Bricolage Grotesque"', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'monospace'],
      },
      letterSpacing: {
        tightest: '-0.04em',
      },
      maxWidth: {
        prose: '68ch',
      },
      animation: {
        'aurora-slow': 'aurora 18s ease-in-out infinite',
        'fade-up': 'fadeUp 0.6s ease-out both',
      },
      keyframes: {
        aurora: {
          '0%, 100%': { transform: 'translate(0, 0) scale(1)' },
          '50%': { transform: 'translate(2%, -2%) scale(1.05)' },
        },
        fadeUp: {
          from: { opacity: '0', transform: 'translateY(12px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
      },
    },
  },
  plugins: [],
};

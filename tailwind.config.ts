import type { Config } from 'tailwindcss';

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        display: ['Outfit', 'Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        mono: ['ui-monospace', 'SFMono-Regular', 'Cascadia Code', 'Consolas', 'monospace'],
      },
      colors: {
        hub: {
          bg: '#05070A',
          surface: '#0C1117',
          card: '#111820',
          border: '#1C2536',
          accent: '#6BA3FF',
          'accent-light': '#9DC4FF',
          success: '#4AE6A0',
          warning: '#D4AF37',
          danger: '#f87171',
        },
      },
      transitionTimingFunction: {
        soft: 'cubic-bezier(.22, .61, .36, 1)',
        spring: 'cubic-bezier(.34, 1.4, .64, 1)',
      },
      animation: {
        'fade-in': 'fadeIn 0.25s cubic-bezier(.22, .61, .36, 1)',
        'slide-up': 'slideUp 0.35s cubic-bezier(.22, .61, .36, 1)',
        'pulse-slow': 'pulse 3s ease-in-out infinite',
      },
      keyframes: {
        fadeIn: { '0%': { opacity: '0' }, '100%': { opacity: '1' } },
        slideUp: { '0%': { opacity: '0', transform: 'translateY(8px)' }, '100%': { opacity: '1', transform: 'translateY(0)' } },
      },
    },
  },
  plugins: [],
} satisfies Config;

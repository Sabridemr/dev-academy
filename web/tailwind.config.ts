import type { Config } from 'tailwindcss';

/**
 * Tasarım sistemi: renkler CSS değişkenlerinden gelir (globals.css), böylece
 * açık/koyu tema yalnızca değişkenleri değiştirerek uygulanır ve içerik SVG'leri
 * aynı değişkenleri (--da-*) paylaşır. `*-fg` tonları ilgili rengin üzerine ya da
 * metin olarak kullanılacak kontrastlı sürümüdür.
 */
const rgb = (name: string) => `rgb(var(--da-${name}-rgb) / <alpha-value>)`;

const config: Config = {
  darkMode: 'class',
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        bg: rgb('bg'),
        fg: rgb('fg'),
        muted: rgb('muted'),
        surface: rgb('surface'),
        elevated: rgb('elevated'),
        border: rgb('border'),
        primary: { DEFAULT: rgb('primary'), fg: rgb('primary-fg') },
        accent: { DEFAULT: rgb('accent'), fg: rgb('accent-fg') },
        success: { DEFAULT: rgb('success'), fg: rgb('success-fg') },
        warning: { DEFAULT: rgb('warning'), fg: rgb('warning-fg') },
        danger: { DEFAULT: rgb('danger'), fg: rgb('danger-fg') },
      },
      fontFamily: {
        sans: ['var(--font-sans)', 'system-ui', 'sans-serif'],
        mono: ['var(--font-mono)', 'ui-monospace', 'monospace'],
      },
      borderRadius: {
        xl: '0.875rem',
        '2xl': '1.25rem',
        '3xl': '1.75rem',
      },
      boxShadow: {
        card: '0 1px 2px rgb(0 0 0 / 0.06), 0 6px 20px rgb(0 0 0 / 0.06)',
        pop: '0 4px 12px rgb(0 0 0 / 0.12), 0 16px 48px rgb(0 0 0 / 0.18)',
        glow: '0 0 0 1px rgb(var(--da-glow-rgb) / 0.25), 0 8px 24px -8px rgb(var(--da-glow-rgb) / 0.55)',
      },
      maxWidth: {
        prose: '72ch',
      },
      minWidth: {
        5: '1.25rem',
      },
      keyframes: {
        'fade-up': {
          from: { opacity: '0', transform: 'translateY(8px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        shimmer: {
          from: { backgroundPosition: '200% 0' },
          to: { backgroundPosition: '-200% 0' },
        },
      },
      animation: {
        'fade-up': 'fade-up 0.4s cubic-bezier(0.2, 0, 0, 1) both',
        shimmer: 'shimmer 1.6s linear infinite',
      },
    },
  },
  plugins: [],
};

export default config;

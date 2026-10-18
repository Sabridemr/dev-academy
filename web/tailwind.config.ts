import type { Config } from 'tailwindcss';

/**
 * Tasarım sistemi: renkler CSS değişkenlerinden gelir (globals.css), böylece
 * açık/koyu tema yalnızca değişkenleri değiştirerek uygulanır ve içerik SVG'leri
 * aynı değişkenleri (--da-*) paylaşır.
 */
const config: Config = {
  darkMode: 'class',
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        bg: 'rgb(var(--da-bg-rgb) / <alpha-value>)',
        fg: 'rgb(var(--da-fg-rgb) / <alpha-value>)',
        muted: 'rgb(var(--da-muted-rgb) / <alpha-value>)',
        surface: 'rgb(var(--da-surface-rgb) / <alpha-value>)',
        elevated: 'rgb(var(--da-elevated-rgb) / <alpha-value>)',
        border: 'rgb(var(--da-border-rgb) / <alpha-value>)',
        primary: 'rgb(var(--da-primary-rgb) / <alpha-value>)',
        accent: 'rgb(var(--da-accent-rgb) / <alpha-value>)',
        success: 'rgb(var(--da-success-rgb) / <alpha-value>)',
        warning: 'rgb(var(--da-warning-rgb) / <alpha-value>)',
        danger: 'rgb(var(--da-danger-rgb) / <alpha-value>)',
      },
      fontFamily: {
        sans: ['var(--font-sans)', 'system-ui', 'sans-serif'],
        mono: ['var(--font-mono)', 'ui-monospace', 'monospace'],
      },
      borderRadius: {
        xl: '0.875rem',
        '2xl': '1.25rem',
      },
      boxShadow: {
        card: '0 1px 2px rgb(0 0 0 / 0.04), 0 4px 16px rgb(0 0 0 / 0.04)',
      },
      maxWidth: {
        prose: '72ch',
      },
    },
  },
  plugins: [],
};

export default config;

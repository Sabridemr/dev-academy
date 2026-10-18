import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

export function formatDuration(seconds: number, locale: string): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.round((seconds % 3600) / 60);
  if (locale === 'tr') return h > 0 ? `${h} sa ${m} dk` : `${m} dk`;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

/** İçerik renk anahtarlarını (primary, danger ...) CSS değişkenine çevirir; hex ise olduğu gibi döner */
export function themeColor(value: string | undefined, fallback = 'var(--da-primary)'): string {
  if (!value) return fallback;
  if (value.startsWith('#') || value.startsWith('rgb') || value.startsWith('var(')) return value;
  return `var(--da-${value})`;
}

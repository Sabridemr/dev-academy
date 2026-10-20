import type { Locale } from '@devacademy/shared';
import { en } from '@/i18n/messages/en';
import { tr, type Messages } from '@/i18n/messages/tr';
import type { MessageKey } from '@/i18n';

/**
 * Sunucu bileşenleri için çeviri. '@/i18n' bir istemci modülüdür ('use client'); değerleri sunucuda
 * kullanılamaz, bu yüzden sözlükler doğrudan içe aktarılır (tip yalnızca derleme zamanında gelir).
 */
const DICTS: Record<Locale, Messages> = { tr, en };

export function serverT(locale: Locale) {
  const messages = DICTS[locale] ?? tr;
  return (key: MessageKey, params?: Record<string, string | number>): string => {
    const value = key
      .split('.')
      .reduce<unknown>(
        (acc, part) =>
          acc && typeof acc === 'object' ? (acc as Record<string, unknown>)[part] : undefined,
        messages,
      );
    if (typeof value !== 'string') return key;
    return params
      ? value.replace(/\{(\w+)\}/g, (_, n: string) =>
          params[n] !== undefined ? String(params[n]) : `{${n}}`,
        )
      : value;
  };
}

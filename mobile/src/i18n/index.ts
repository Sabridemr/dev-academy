import { useCallback, useMemo } from 'react';
import { t as tLocalized, type Locale, type LocalizedString } from '@devacademy/shared';
import { useSettings } from '@/stores/settings';
import { tr, type Messages } from './messages/tr';
import { en } from './messages/en';

/**
 * Hafif i18n katmanı (web ile aynı anahtar yapısı).
 * - t('lesson.next', { count: 3 }) → sözlükten çeviri, {param} yer tutucuları
 * - tl(localizedString) → içerikten gelen { tr, en } metni aktif dile çözer
 */
export const MESSAGES: Record<Locale, Messages> = { tr, en };

type Leaves<T, P extends string = ''> = T extends string
  ? P
  : T extends readonly unknown[]
    ? P
    : { [K in keyof T & string]: Leaves<T[K], P extends '' ? K : `${P}.${K}`> }[keyof T & string];
export type MessageKey = Leaves<Messages>;
export type TranslateParams = Record<string, string | number>;

export function translate(messages: Messages, key: string, params?: TranslateParams): string {
  const value = key
    .split('.')
    .reduce<unknown>(
      (acc, part) =>
        acc && typeof acc === 'object' ? (acc as Record<string, unknown>)[part] : undefined,
      messages,
    );
  if (typeof value !== 'string') return key;
  if (!params) return value;
  return value.replace(/\{(\w+)\}/g, (_, name: string) =>
    params[name] !== undefined ? String(params[name]) : `{${name}}`,
  );
}

/** React dışı kod (bildirim metinleri vb.) için anlık çeviri */
export function translateNow(key: MessageKey, params?: TranslateParams): string {
  return translate(MESSAGES[useSettings.getState().locale], key, params);
}

export interface I18n {
  locale: Locale;
  messages: Messages;
  setLocale: (locale: Locale) => void;
  t: (key: MessageKey, params?: TranslateParams) => string;
  tl: (value: LocalizedString | undefined | null) => string;
}

export function useI18n(): I18n {
  const locale = useSettings((s) => s.locale);
  const setLocale = useSettings((s) => s.setLocale);
  const messages = MESSAGES[locale];
  const t = useCallback(
    (key: MessageKey, params?: TranslateParams) => translate(messages, key, params),
    [messages],
  );
  const tl = useCallback(
    (value: LocalizedString | undefined | null) => tLocalized(value, locale),
    [locale],
  );
  return useMemo(
    () => ({ locale, messages, setLocale, t, tl }),
    [locale, messages, setLocale, t, tl],
  );
}

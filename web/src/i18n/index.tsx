'use client';

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import {
  DEFAULT_LOCALE,
  isLocale,
  t as tLocalized,
  type Locale,
  type LocalizedString,
} from '@devacademy/shared';
import { tr, type Messages } from './messages/tr';
import { en } from './messages/en';

/**
 * Hafif i18n katmanı: mesaj sözlükleri tipli, anahtar yolu ("lesson.next") ile erişilir,
 * {param} yer tutucuları desteklenir. Dil seçimi çerezde tutulur (SSR ile tutarlı ilk boyama).
 */
export const MESSAGES: Record<Locale, Messages> = { tr, en };
export const LOCALE_COOKIE = 'da_locale';

type Leaves<T, P extends string = ''> = T extends string
  ? P
  : T extends readonly unknown[]
    ? P
    : { [K in keyof T & string]: Leaves<T[K], P extends '' ? K : `${P}.${K}`> }[keyof T & string];
export type MessageKey = Leaves<Messages>;

export function translate(
  messages: Messages,
  key: string,
  params?: Record<string, string | number>,
): string {
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

interface I18nContextValue {
  locale: Locale;
  messages: Messages;
  setLocale: (l: Locale) => void;
  t: (key: MessageKey, params?: Record<string, string | number>) => string;
  /** İçerikten gelen yerelleştirilmiş metni çözer */
  tl: (value: LocalizedString | undefined | null) => string;
}

const I18nContext = createContext<I18nContextValue | null>(null);

export function I18nProvider({
  initialLocale,
  children,
}: {
  initialLocale?: string;
  children: ReactNode;
}) {
  const [locale, setLocaleState] = useState<Locale>(
    initialLocale && isLocale(initialLocale) ? initialLocale : DEFAULT_LOCALE,
  );

  const setLocale = useCallback((l: Locale) => {
    setLocaleState(l);
    document.cookie = `${LOCALE_COOKIE}=${l}; path=/; max-age=31536000; samesite=lax`;
    document.documentElement.lang = l;
  }, []);

  const value = useMemo<I18nContextValue>(() => {
    const messages = MESSAGES[locale];
    return {
      locale,
      messages,
      setLocale,
      t: (key, params) => translate(messages, key, params),
      tl: (v) => tLocalized(v, locale),
    };
  }, [locale, setLocale]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nContextValue {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error('useI18n yalnızca I18nProvider içinde kullanılabilir');
  return ctx;
}

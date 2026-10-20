import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import { DEFAULT_LOCALE, isLocale, type Locale } from '@devacademy/shared';
import { LOCALE_COOKIE } from '@/i18n';

/** Sunucu bileşenlerinde dil çerezinden locale okur (generateMetadata için) */
export async function serverLocale(): Promise<Locale> {
  const v = (await cookies()).get(LOCALE_COOKIE)?.value;
  return v && isLocale(v) ? v : DEFAULT_LOCALE;
}

/** İki dilli statik sayfa başlığı */
export async function localizedMetadata(titles: Record<Locale, string>): Promise<Metadata> {
  const locale = await serverLocale();
  return { title: titles[locale] };
}

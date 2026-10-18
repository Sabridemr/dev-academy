import { z } from 'zod';

/**
 * Desteklenen diller. Varsayılan Türkçe; İngilizce hazır.
 * Yeni bir dil eklemek için buraya kodu ekleyip web/mobile mesaj dosyalarını oluşturmak yeterli.
 */
export const SUPPORTED_LOCALES = ['tr', 'en'] as const;
export type Locale = (typeof SUPPORTED_LOCALES)[number];
export const DEFAULT_LOCALE: Locale = 'tr';

/**
 * Yerelleştirilmiş metin: Türkçe zorunlu, diğer diller isteğe bağlı.
 * İçerik dosyalarında düz string de kabul edilir (Türkçe kabul edilir).
 */
export const LocalizedStringSchema = z.union([
  z.string(),
  z
    .object({
      tr: z.string(),
      en: z.string().optional(),
    })
    .strict(),
]);
export type LocalizedString = z.infer<typeof LocalizedStringSchema>;

/** Yerelleştirilmiş metni istenen dile çözer; yoksa Türkçeye düşer. */
export function t(value: LocalizedString | undefined | null, locale: Locale = DEFAULT_LOCALE): string {
  if (value === undefined || value === null) return '';
  if (typeof value === 'string') return value;
  return value[locale] ?? value.tr;
}

/** Yerelleştirilmiş metni normalize edip her zaman obje formunda döner. */
export function toLocalizedObject(value: LocalizedString): { tr: string; en?: string } {
  return typeof value === 'string' ? { tr: value } : value;
}

export function isLocale(value: string): value is Locale {
  return (SUPPORTED_LOCALES as readonly string[]).includes(value);
}

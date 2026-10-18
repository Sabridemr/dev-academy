import type { Prisma } from '@prisma/client';
import type { LocalizedString } from '@devacademy/shared';

/** Prisma Json alanını LocalizedString olarak okur. */
export function asLocalized(value: Prisma.JsonValue | null | undefined): LocalizedString {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'object' && !Array.isArray(value) && typeof (value as { tr?: unknown }).tr === 'string') {
    const v = value as { tr: string; en?: string };
    return { tr: v.tr, en: v.en };
  }
  return String(value);
}

/** LocalizedString'i Prisma Json'a yazılabilir biçime çevirir. */
export function toJsonLocalized(value: LocalizedString): Prisma.InputJsonValue {
  return typeof value === 'string' ? value : { tr: value.tr, ...(value.en ? { en: value.en } : {}) };
}

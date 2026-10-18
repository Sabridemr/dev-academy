import { isApiError } from '@/lib/api';
import type { MessageKey } from '@/i18n';

/** Hata nesnesini kullanıcıya gösterilecek i18n anahtarına çevirir */
export function errorMessageKey(error: unknown): MessageKey {
  if (!isApiError(error)) return 'errors.unknown';
  switch (error.code) {
    case 'offline':
      return 'offline.unavailable';
    case 'network':
      return 'errors.network';
    case 'unauthorized':
      return 'errors.unauthorized';
    case 'not_found':
      return 'errors.notFound';
    case 'server':
      return 'errors.server';
    default:
      return 'errors.unknown';
  }
}

/** Doğrulama hatalarında sunucu mesajını, diğerlerinde i18n mesajını döner */
export function errorText(error: unknown, t: (key: MessageKey) => string): string {
  if (isApiError(error) && (error.code === 'validation' || error.code === 'forbidden') && error.message) return error.message;
  return t(errorMessageKey(error));
}

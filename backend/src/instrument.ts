/**
 * Sentry başlatma: main.ts'de diğer tüm import'lardan ÖNCE yüklenir (Sentry'nin NestJS kurulumu,
 * HTTP/Nest enstrümantasyonunun modüller yüklenmeden kancalanması için). SENTRY_DSN yoksa no-op.
 */
import { initSentry, readSentryEnv } from './common/sentry/sentry';

initSentry(readSentryEnv());

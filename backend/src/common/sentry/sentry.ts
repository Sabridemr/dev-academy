import { existsSync, readFileSync } from 'node:fs';
import { parseEnv } from 'node:util';
import type * as SentryNest from '@sentry/nestjs';
import { SentryEnvSchema } from '../../config/env';

/** Yalnızca initSentry DSN ile çağrıldığında dolar; aksi halde @sentry/nestjs hiç yüklenmez */
let sentry: typeof SentryNest | undefined;

/** ConfigModule ile aynı dosyalar ve öncelik: önce gerçek ortam, sonra .env, sonra .env.local */
export function readSentryEnv(
  env: NodeJS.ProcessEnv = process.env,
  files: string[] = ['.env', '.env.local'],
): Record<string, string | undefined> {
  const merged: Record<string, string | undefined> = {};
  for (const file of [...files].reverse()) {
    if (!existsSync(file)) continue;
    try {
      Object.assign(merged, parseEnv(readFileSync(file, 'utf8')));
    } catch {
      /* okunamayan dosya: ConfigModule zaten hatayı raporlar */
    }
  }
  return { ...merged, ...env };
}

/**
 * SENTRY_DSN verilmişse Sentry'yi başlatır (NestJS ve HTTP için OpenTelemetry enstrümantasyonu dahil).
 * Uygulama modülleri yüklenmeden önce çağrılmalıdır (bkz. src/instrument.ts).
 * DSN yoksa ya da geçersizse hiçbir şey yapmaz; geçersiz DSN'i ConfigModule açılışta raporlar.
 */
export function initSentry(raw: Record<string, string | undefined>): boolean {
  if (sentry) return true;
  const parsed = SentryEnvSchema.safeParse(raw);
  if (!parsed.success || !parsed.data.SENTRY_DSN) return false;
  // DSN yokken paket yüklenmesin diye statik import yerine koşullu require
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const mod = require('@sentry/nestjs') as typeof SentryNest;
  mod.init({
    dsn: parsed.data.SENTRY_DSN,
    environment: parsed.data.NODE_ENV,
    tracesSampleRate: parsed.data.SENTRY_TRACES_SAMPLE_RATE,
    sendDefaultPii: false,
  });
  sentry = mod;
  return true;
}

export function isSentryEnabled(): boolean {
  return sentry !== undefined;
}

/** Sunucu hatasını (5xx) Sentry'ye gönderir; Sentry kapalıysa no-op. */
export function captureServerError(
  exception: unknown,
  context: { requestId?: string; method?: string; route?: string; status: number },
): void {
  if (!sentry) return;
  const s = sentry;
  s.withScope((scope) => {
    if (context.requestId) scope.setTag('request_id', context.requestId);
    scope.setTag('http.status_code', String(context.status));
    if (context.method) scope.setTag('http.method', context.method);
    if (context.route) scope.setTag('http.route', context.route);
    s.captureException(exception);
  });
}

/** Yalnızca testler için: modül durumunu sıfırlar */
export function resetSentryForTests(): void {
  sentry = undefined;
}

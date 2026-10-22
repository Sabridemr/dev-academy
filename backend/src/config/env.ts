import { z } from 'zod';

/**
 * Ortam değişkenleri tek yerde, zod ile doğrulanır.
 * Eksik ya da hatalı bir değişken uygulamanın açılışında anlaşılır bir hatayla durmasını sağlar.
 */
export const EnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(4000),
  API_PREFIX: z.string().default('api/v1'),
  CORS_ORIGINS: z.string().default('http://localhost:3000'),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),

  DATABASE_URL: z.string().url(),
  REDIS_URL: z.string().default('redis://localhost:6379'),

  JWT_ACCESS_SECRET: z.string().min(32, 'JWT_ACCESS_SECRET en az 32 karakter olmalı'),
  JWT_ACCESS_TTL: z.coerce.number().int().positive().default(900),
  JWT_REFRESH_TTL: z.coerce
    .number()
    .int()
    .positive()
    .default(60 * 60 * 24 * 30),
  /** Web refresh çerezi: web ve API farklı "site"lardaysa (ör. iki ayrı alan adı) 'none' gerekir */
  REFRESH_COOKIE_SAMESITE: z.enum(['lax', 'strict', 'none']).default('lax'),
  GOOGLE_CLIENT_IDS: z.string().default(''),
  APPLE_CLIENT_IDS: z.string().default(''),

  S3_ENDPOINT: z.string().optional(),
  S3_REGION: z.string().default('eu-central-1'),
  S3_BUCKET: z.string().default('devacademy-media'),
  S3_ACCESS_KEY: z.string().optional(),
  S3_SECRET_KEY: z.string().optional(),
  S3_PUBLIC_URL: z.string().optional(),

  EXPO_PUSH_URL: z.string().url().default('https://exp.host/--/api/v2/push/send'),
  SMTP_URL: z.string().optional(),
  MAIL_FROM: z.string().default('DevAcademy <no-reply@devacademy.local>'),
  /** E-postadaki bağlantıların (şifre sıfırlama, e-posta doğrulama) işaret ettiği web istemcisi */
  WEB_URL: z
    .string()
    .url()
    .default('http://localhost:3000')
    .transform((u) => u.replace(/\/+$/, '')),

  RATE_LIMIT_TTL: z.coerce.number().int().positive().default(60),
  RATE_LIMIT_MAX: z.coerce.number().int().positive().default(120),

  CONTENT_DIR: z.string().default('../content'),

  /** Prometheus /metrics uç noktası ve sayaçlar; 'false' ile tamamen kapatılır (uç nokta 404 döner) */
  METRICS_ENABLED: z
    .string()
    .default('true')
    .transform((v) => !['false', '0', 'no', 'off'].includes(v.trim().toLowerCase())),
  /** Verilmezse Sentry hiç yüklenmez. Boş dize (compose'da `${SENTRY_DSN:-}`) verilmemiş sayılır. */
  SENTRY_DSN: z.preprocess((v) => (v === '' ? undefined : v), z.string().url().optional()),
  SENTRY_TRACES_SAMPLE_RATE: z.coerce.number().min(0).max(1).default(0.1),
  // SEED_ADMIN_EMAIL / SEED_ADMIN_PASSWORD yalnızca prisma/seed.ts okur (üretimde şifre zorunlu);
  // uygulama kullanmadığı için zayıf bir varsayılanla burada tutulmaz.
});

export type Env = z.infer<typeof EnvSchema>;

/** Sentry, ConfigModule'den önce (instrument.ts) başlatıldığı için yalnızca kendi alanlarını doğrular */
export const SentryEnvSchema = EnvSchema.pick({
  NODE_ENV: true,
  SENTRY_DSN: true,
  SENTRY_TRACES_SAMPLE_RATE: true,
});

export function validateEnv(raw: Record<string, unknown>): Env {
  const parsed = EnvSchema.safeParse(raw);
  if (!parsed.success) {
    const details = parsed.error.issues
      .map((i) => `  - ${i.path.join('.')}: ${i.message}`)
      .join('\n');
    throw new Error(`Ortam değişkenleri geçersiz:\n${details}`);
  }
  return parsed.data;
}

export function corsOrigins(env: Env): string[] {
  return env.CORS_ORIGINS.split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

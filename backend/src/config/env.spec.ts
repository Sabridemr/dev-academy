import { corsOrigins, validateEnv } from './env';

describe('validateEnv', () => {
  const base = {
    DATABASE_URL: 'postgresql://u:p@localhost:5432/db',
    JWT_ACCESS_SECRET: 'a'.repeat(32),
  };

  it('geçerli ortamı varsayılanlarla doldurur', () => {
    const env = validateEnv(base);
    expect(env.PORT).toBe(4000);
    expect(env.API_PREFIX).toBe('api/v1');
  });

  it('kısa JWT sırrını reddeder', () => {
    expect(() => validateEnv({ ...base, JWT_ACCESS_SECRET: 'kisa' })).toThrow(/JWT_ACCESS_SECRET/);
  });

  it('CORS listesini ayrıştırır', () => {
    expect(
      corsOrigins(validateEnv({ ...base, CORS_ORIGINS: 'http://a.com, http://b.com,' })),
    ).toEqual(['http://a.com', 'http://b.com']);
  });

  it('izleme varsayılanları: metrikler açık, Sentry kapalı', () => {
    const env = validateEnv(base);
    expect(env.METRICS_ENABLED).toBe(true);
    expect(env.SENTRY_DSN).toBeUndefined();
    expect(env.SENTRY_TRACES_SAMPLE_RATE).toBe(0.1);
  });

  it("METRICS_ENABLED='false' metrikleri kapatır, boş SENTRY_DSN verilmemiş sayılır", () => {
    const env = validateEnv({ ...base, METRICS_ENABLED: 'false', SENTRY_DSN: '' });
    expect(env.METRICS_ENABLED).toBe(false);
    expect(env.SENTRY_DSN).toBeUndefined();
  });

  it('geçersiz SENTRY_DSN reddedilir', () => {
    expect(() => validateEnv({ ...base, SENTRY_DSN: 'dsn-degil' })).toThrow(/SENTRY_DSN/);
  });
});

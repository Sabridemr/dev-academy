import { corsOrigins, validateEnv } from './env';

describe('validateEnv', () => {
  const base = { DATABASE_URL: 'postgresql://u:p@localhost:5432/db', JWT_ACCESS_SECRET: 'a'.repeat(32), JWT_REFRESH_SECRET: 'b'.repeat(32) };

  it('geçerli ortamı varsayılanlarla doldurur', () => {
    const env = validateEnv(base);
    expect(env.PORT).toBe(4000);
    expect(env.API_PREFIX).toBe('api/v1');
  });

  it('kısa JWT sırrını reddeder', () => {
    expect(() => validateEnv({ ...base, JWT_ACCESS_SECRET: 'kisa' })).toThrow(/JWT_ACCESS_SECRET/);
  });

  it('CORS listesini ayrıştırır', () => {
    expect(corsOrigins(validateEnv({ ...base, CORS_ORIGINS: 'http://a.com, http://b.com,' }))).toEqual(['http://a.com', 'http://b.com']);
  });
});

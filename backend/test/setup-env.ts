/**
 * E2E test ortamı. Varsayılan olarak yerel devacademy_test veritabanını kullanır;
 * CI'da DATABASE_URL / REDIS_URL ortam değişkenleriyle ezilir.
 * Testten önce: DATABASE_URL=<test db> pnpm prisma migrate deploy && pnpm prisma:seed
 */
process.env.NODE_ENV = 'test';
process.env.DATABASE_URL ??= 'postgresql://devacademy:devacademy@localhost:5432/devacademy_test?schema=public';
process.env.REDIS_URL ??= 'redis://localhost:6379/1';
process.env.JWT_ACCESS_SECRET ??= 'test-access-secret-test-access-secret-0123';
process.env.LOG_LEVEL = 'silent';
process.env.RATE_LIMIT_MAX ??= '10000';
process.env.SEED_ADMIN_EMAIL ??= 'admin@devacademy.local';
process.env.SEED_ADMIN_PASSWORD ??= 'Admin123!';

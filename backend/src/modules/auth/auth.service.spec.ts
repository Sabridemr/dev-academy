import { UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { AuthService, hashToken, toProfile } from './auth.service';

/** Prisma'nın yalnızca kullanılan kısımlarını taklit eden bellek içi sahte nesne */
function createPrismaMock() {
  const tokens: Record<string, { id: string; userId: string; tokenHash: string; family: string; revokedAt: Date | null; expiresAt: Date }> = {};
  const user = { id: 'u1', email: 'a@b.c', displayName: 'A', avatarUrl: null, role: 'student', locale: 'tr', selectedPathId: null, createdAt: new Date('2026-01-01'), deletedAt: null };
  let seq = 0;
  return {
    tokens,
    refreshToken: {
      create: jest.fn(async ({ data }) => {
        const id = `t${++seq}`;
        tokens[data.tokenHash] = { id, revokedAt: null, ...data };
        return tokens[data.tokenHash];
      }),
      findUnique: jest.fn(async ({ where }) => (tokens[where.tokenHash] ? { ...tokens[where.tokenHash], user } : null)),
      update: jest.fn(async ({ where, data }) => {
        const t = Object.values(tokens).find((x) => x.id === where.id)!;
        Object.assign(t, data);
        return t;
      }),
      updateMany: jest.fn(async ({ where, data }) => {
        let count = 0;
        for (const t of Object.values(tokens)) {
          if ((where.family === undefined || t.family === where.family) && t.revokedAt === null) {
            Object.assign(t, data);
            count++;
          }
        }
        return { count };
      }),
    },
  };
}

function createService() {
  const prisma = createPrismaMock();
  const config = { get: (k: string) => ({ JWT_ACCESS_TTL: 900, JWT_REFRESH_TTL: 3600, JWT_ACCESS_SECRET: 'x'.repeat(32) })[k] };
  const service = new AuthService(prisma as never, new JwtService({}), config as never, {} as never);
  return { service, prisma };
}

describe('AuthService', () => {
  it('hashToken deterministik SHA-256 üretir ve ham token saklanmaz', () => {
    expect(hashToken('abc')).toBe(hashToken('abc'));
    expect(hashToken('abc')).toHaveLength(64);
    expect(hashToken('abc')).not.toContain('abc');
  });

  it('toProfile hassas alanları dışarıda bırakır', () => {
    const profile = toProfile({ id: 'u1', email: 'a@b.c', passwordHash: 'secret', displayName: 'A', avatarUrl: null, role: 'student', locale: 'tr', selectedPathId: null, createdAt: new Date('2026-01-01') } as never);
    expect(profile).not.toHaveProperty('passwordHash');
    expect(profile.createdAt).toBe('2026-01-01T00:00:00.000Z');
  });

  it('refresh token rotasyonu: eski token iptal edilir, yenisi üretilir', async () => {
    const { service, prisma } = createService();
    const first = await (service as unknown as { createTokens: (u: unknown, f: string, m: unknown) => Promise<{ refreshToken: string }> }).createTokens({ id: 'u1', email: 'a@b.c', role: 'student' }, 'fam-1', {});
    const second = await service.refresh(first.refreshToken, {});
    expect(second.refreshToken).not.toBe(first.refreshToken);
    expect(prisma.tokens[hashToken(first.refreshToken)].revokedAt).not.toBeNull();
    expect(prisma.tokens[hashToken(second.refreshToken)].revokedAt).toBeNull();
  });

  it('iptal edilmiş token yeniden kullanılırsa tüm aile iptal edilir', async () => {
    const { service, prisma } = createService();
    const first = await (service as unknown as { createTokens: (u: unknown, f: string, m: unknown) => Promise<{ refreshToken: string }> }).createTokens({ id: 'u1', email: 'a@b.c', role: 'student' }, 'fam-2', {});
    const second = await service.refresh(first.refreshToken, {});
    await expect(service.refresh(first.refreshToken, {})).rejects.toBeInstanceOf(UnauthorizedException);
    expect(prisma.tokens[hashToken(second.refreshToken)].revokedAt).not.toBeNull();
  });

  it('bilinmeyen refresh token reddedilir', async () => {
    const { service } = createService();
    await expect(service.refresh('yok-boyle-bir-token', {})).rejects.toBeInstanceOf(UnauthorizedException);
  });
});

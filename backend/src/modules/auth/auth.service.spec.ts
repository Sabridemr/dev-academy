import { BadRequestException, ConflictException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { AuthService, hashToken, toProfile } from './auth.service';

/** Prisma'nın yalnızca kullanılan kısımlarını taklit eden bellek içi sahte nesne */
function createPrismaMock() {
  const tokens: Record<
    string,
    {
      id: string;
      userId: string;
      tokenHash: string;
      family: string;
      revokedAt: Date | null;
      expiresAt: Date;
    }
  > = {};
  const user = {
    id: 'u1',
    email: 'a@b.c',
    displayName: 'A',
    avatarUrl: null,
    role: 'student',
    locale: 'tr',
    selectedPathId: null,
    createdAt: new Date('2026-01-01'),
    deletedAt: null,
  };
  let seq = 0;
  return {
    tokens,
    refreshToken: {
      create: jest.fn(async ({ data }) => {
        const id = `t${++seq}`;
        tokens[data.tokenHash] = { id, revokedAt: null, ...data };
        return tokens[data.tokenHash];
      }),
      findUnique: jest.fn(async ({ where }) =>
        tokens[where.tokenHash] ? { ...tokens[where.tokenHash], user } : null,
      ),
      update: jest.fn(async ({ where, data }) => {
        const t = Object.values(tokens).find((x) => x.id === where.id)!;
        Object.assign(t, data);
        return t;
      }),
      updateMany: jest.fn(async ({ where, data }) => {
        let count = 0;
        for (const t of Object.values(tokens)) {
          if (
            (where.family === undefined || t.family === where.family) &&
            (where.id === undefined || t.id === where.id) &&
            t.revokedAt === null
          ) {
            Object.assign(t, data);
            count++;
          }
        }
        return { count };
      }),
    },
  };
}

type Identity = {
  providerUserId: string;
  email?: string;
  emailVerified?: boolean;
  name?: string;
  picture?: string;
};

function createService(
  opts: {
    identity?: Identity;
    users?: Record<string, unknown>[];
    accounts?: Record<string, unknown>[];
  } = {},
) {
  const base = createPrismaMock();
  const users = opts.users ?? [];
  const accounts = opts.accounts ?? [];
  const prisma = {
    ...base,
    user: {
      findUnique: jest.fn(
        async ({ where }) =>
          users.find((u) => (where.email ? u.email === where.email : u.id === where.id)) ?? null,
      ),
      findUniqueOrThrow: jest.fn(async ({ where }) => {
        const u = users.find((x) => x.id === where.id);
        if (!u) throw new Error('not found');
        return u;
      }),
      create: jest.fn(async ({ data }) => {
        const u = {
          id: `u${users.length + 100}`,
          role: 'student',
          locale: 'tr',
          selectedPathId: null,
          createdAt: new Date(),
          deletedAt: null,
          ...data,
        };
        users.push(u);
        return u;
      }),
      update: jest.fn(async ({ data }) => data),
    },
    oAuthAccount: {
      findUnique: jest.fn(
        async ({ where }) =>
          accounts.find((a) => a.providerUserId === where.provider_providerUserId.providerUserId) ??
          null,
      ),
      create: jest.fn(async ({ data }) => data),
    },
  };
  const config = {
    get: (k: string) =>
      ({ JWT_ACCESS_TTL: 900, JWT_REFRESH_TTL: 3600, JWT_ACCESS_SECRET: 'x'.repeat(32) })[k],
  };
  const oauth = { verify: jest.fn(async () => opts.identity) };
  const service = new AuthService(
    prisma as never,
    new JwtService({}),
    config as never,
    oauth as never,
  );
  return { service, prisma };
}

const userRow = (over: Record<string, unknown> = {}) => ({
  id: 'u1',
  email: 'a@b.c',
  displayName: 'A',
  avatarUrl: null,
  role: 'student',
  locale: 'tr',
  selectedPathId: null,
  createdAt: new Date('2026-01-01'),
  deletedAt: null,
  passwordHash: 'h',
  ...over,
});

describe('AuthService', () => {
  it('hashToken deterministik SHA-256 üretir ve ham token saklanmaz', () => {
    expect(hashToken('abc')).toBe(hashToken('abc'));
    expect(hashToken('abc')).toHaveLength(64);
    expect(hashToken('abc')).not.toContain('abc');
  });

  it('toProfile hassas alanları dışarıda bırakır', () => {
    const profile = toProfile({
      id: 'u1',
      email: 'a@b.c',
      passwordHash: 'secret',
      displayName: 'A',
      avatarUrl: null,
      role: 'student',
      locale: 'tr',
      selectedPathId: null,
      createdAt: new Date('2026-01-01'),
    } as never);
    expect(profile).not.toHaveProperty('passwordHash');
    expect(profile.createdAt).toBe('2026-01-01T00:00:00.000Z');
  });

  it('refresh token rotasyonu: eski token iptal edilir, yenisi üretilir', async () => {
    const { service, prisma } = createService();
    const first = await (
      service as unknown as {
        createTokens: (u: unknown, f: string, m: unknown) => Promise<{ refreshToken: string }>;
      }
    ).createTokens({ id: 'u1', email: 'a@b.c', role: 'student' }, 'fam-1', {});
    const second = await service.refresh(first.refreshToken, {});
    expect(second.refreshToken).not.toBe(first.refreshToken);
    expect(prisma.tokens[hashToken(first.refreshToken)].revokedAt).not.toBeNull();
    expect(prisma.tokens[hashToken(second.refreshToken)].revokedAt).toBeNull();
  });

  it('iptal edilmiş token yeniden kullanılırsa tüm aile iptal edilir', async () => {
    const { service, prisma } = createService();
    const first = await (
      service as unknown as {
        createTokens: (u: unknown, f: string, m: unknown) => Promise<{ refreshToken: string }>;
      }
    ).createTokens({ id: 'u1', email: 'a@b.c', role: 'student' }, 'fam-2', {});
    const second = await service.refresh(first.refreshToken, {});
    await expect(service.refresh(first.refreshToken, {})).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
    expect(prisma.tokens[hashToken(second.refreshToken)].revokedAt).not.toBeNull();
  });

  it('bilinmeyen refresh token reddedilir', async () => {
    const { service } = createService();
    await expect(service.refresh('yok-boyle-bir-token', {})).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('aynı token ile eş zamanlı iki refresh: yalnızca biri başarılı olur, tek geçerli zincir kalır', async () => {
    const { service, prisma } = createService();
    const first = await (
      service as unknown as {
        createTokens: (u: unknown, f: string, m: unknown) => Promise<{ refreshToken: string }>;
      }
    ).createTokens({ id: 'u1', email: 'a@b.c', role: 'student' }, 'fam-3', {});
    const results = await Promise.allSettled([
      service.refresh(first.refreshToken, {}),
      service.refresh(first.refreshToken, {}),
    ]);
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    const rejected = results.find((r) => r.status === 'rejected') as PromiseRejectedResult;
    expect(rejected.reason).toBeInstanceOf(UnauthorizedException);
    const live = Object.values(prisma.tokens).filter(
      (x) => x.family === 'fam-3' && x.revokedAt === null,
    );
    expect(live).toHaveLength(1);
  });

  describe('oauthLogin', () => {
    const dto = { provider: 'google' as const, idToken: 'id-token' };

    it('silinmiş kullanıcının bağlı hesabıyla girişi reddeder', async () => {
      const { service } = createService({
        identity: { providerUserId: 'g1', email: 'a@b.c', emailVerified: true },
        accounts: [{ providerUserId: 'g1', user: userRow({ deletedAt: new Date() }) }],
      });
      await expect(service.oauthLogin(dto, {})).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it('doğrulanmamış e-posta ile mevcut hesaba bağlanmaz', async () => {
      const { service, prisma } = createService({
        identity: { providerUserId: 'g2', email: 'a@b.c', emailVerified: false },
        users: [userRow()],
      });
      await expect(service.oauthLogin(dto, {})).rejects.toBeInstanceOf(ConflictException);
      expect(prisma.oAuthAccount.create).not.toHaveBeenCalled();
    });

    it('doğrulanmış e-posta ile mevcut hesaba bağlanır, yeni kullanıcı açmaz', async () => {
      const { service, prisma } = createService({
        identity: { providerUserId: 'g3', email: 'A@b.c', emailVerified: true },
        users: [userRow()],
      });
      const res = await service.oauthLogin(dto, {});
      expect(res.user.id).toBe('u1');
      expect(prisma.user.create).not.toHaveBeenCalled();
      expect(prisma.oAuthAccount.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ userId: 'u1', providerUserId: 'g3' }),
      });
    });
  });

  it('şifresi olmayan (sosyal girişli) hesapta şifre değiştirme reddedilir', async () => {
    const { service, prisma } = createService({ users: [userRow({ passwordHash: null })] });
    await expect(service.changePassword('u1', 'x', 'yeni-sifre-123')).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(prisma.user.update).not.toHaveBeenCalled();
  });
});

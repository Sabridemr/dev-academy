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
  const resets: {
    id: string;
    userId: string;
    tokenHash: string;
    purpose: 'reset' | 'verify';
    expiresAt: Date;
    usedAt: Date | null;
  }[] = [];
  const prisma = {
    ...base,
    resets,
    $transaction: jest.fn(async (ops: Promise<unknown>[]) => Promise.all(ops)),
    passwordReset: {
      deleteMany: jest.fn(async ({ where }) => {
        const before = resets.length;
        for (let i = resets.length - 1; i >= 0; i--)
          if (
            resets[i].userId === where.userId &&
            resets[i].purpose === where.purpose &&
            !resets[i].usedAt
          )
            resets.splice(i, 1);
        return { count: before - resets.length };
      }),
      create: jest.fn(async ({ data }) => {
        const row = { id: `r${resets.length + 1}`, usedAt: null, ...data };
        resets.push(row);
        return row;
      }),
      findUnique: jest.fn(async ({ where }) => {
        const r = resets.find((x) => x.tokenHash === where.tokenHash);
        return r ? { ...r, user: { deletedAt: null } } : null;
      }),
      updateMany: jest.fn(async ({ where, data }) => {
        const r = resets.find(
          (x) => x.id === where.id && x.usedAt === null && x.expiresAt > where.expiresAt.gt,
        );
        if (!r) return { count: 0 };
        Object.assign(r, data);
        return { count: 1 };
      }),
    },
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
      update: jest.fn(async ({ where, data }) => {
        const u = users.find((x) => x.id === where.id);
        if (u) Object.assign(u, data);
        return u ?? data;
      }),
      updateMany: jest.fn(async () => ({ count: 1 })),
      delete: jest.fn(async ({ where }) => {
        const i = users.findIndex((u) => u.id === where.id);
        return i >= 0 ? users.splice(i, 1)[0] : null;
      }),
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
      ({
        JWT_ACCESS_TTL: 900,
        JWT_REFRESH_TTL: 3600,
        JWT_ACCESS_SECRET: 'x'.repeat(32),
        WEB_URL: 'https://web.test',
      })[k],
  };
  const oauth = { verify: jest.fn(async () => opts.identity) };
  const authState = { revokeAccessTokens: jest.fn(async () => undefined) };
  const notifications = {
    sendEmail: jest.fn(async (_to: string, _subject: string, _text: string) => undefined),
  };
  const service = new AuthService(
    prisma as never,
    new JwtService({}),
    config as never,
    oauth as never,
    { acquireLock: async () => true } as never,
    authState as never,
    notifications as never,
  );
  return { service, prisma, authState, notifications };
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

    it('eski (soft-delete) kapatılmış hesabın kalıntısını silip yeni hesap açar', async () => {
      const legacy = userRow({ id: 'eski', email: 'deleted_eski@x', deletedAt: new Date() });
      const { service, prisma } = createService({
        identity: { providerUserId: 'g1', email: 'yeni@b.c', emailVerified: true },
        users: [legacy],
        accounts: [{ providerUserId: 'g1', userId: 'eski', user: legacy }],
      });
      const res = await service.oauthLogin(dto, {});
      expect(prisma.user.delete).toHaveBeenCalledWith({ where: { id: 'eski' } });
      expect(res.user.id).not.toBe('eski');
      expect(prisma.user.create).toHaveBeenCalled();
    });

    it('doğrulanmamış e-posta ile mevcut hesaba bağlanmaz', async () => {
      const { service, prisma } = createService({
        identity: { providerUserId: 'g2', email: 'a@b.c', emailVerified: false },
        users: [userRow()],
      });
      await expect(service.oauthLogin(dto, {})).rejects.toBeInstanceOf(ConflictException);
      expect(prisma.oAuthAccount.create).not.toHaveBeenCalled();
    });

    it('e-postası doğrulanmamış şifreli hesaba bağlanmaz (pre-account hijack)', async () => {
      const { service, prisma } = createService({
        identity: { providerUserId: 'g4', email: 'a@b.c', emailVerified: true },
        users: [userRow({ emailVerifiedAt: null })],
      });
      await expect(service.oauthLogin(dto, {})).rejects.toBeInstanceOf(ConflictException);
      expect(prisma.oAuthAccount.create).not.toHaveBeenCalled();
    });

    it('yeni kullanıcıyı bağlı hesabıyla tek yazımda oluşturur', async () => {
      const { service, prisma } = createService({
        identity: { providerUserId: 'g5', email: 'yeni@b.c', emailVerified: true },
      });
      await service.oauthLogin(dto, {});
      expect(prisma.user.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          email: 'yeni@b.c',
          oauthAccounts: { create: expect.objectContaining({ providerUserId: 'g5' }) },
        }),
      });
      expect(prisma.oAuthAccount.create).not.toHaveBeenCalled();
    });

    it('doğrulanmış e-posta ile mevcut hesaba bağlanır, yeni kullanıcı açmaz', async () => {
      const { service, prisma } = createService({
        identity: { providerUserId: 'g3', email: 'A@b.c', emailVerified: true },
        users: [userRow({ emailVerifiedAt: new Date('2026-01-02') })],
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

  it('tüm cihazlardan çıkış access token’ları da geçersiz kılar', async () => {
    const { service, authState } = createService({ users: [userRow()] });
    await service.logout(undefined, 'u1', true);
    expect(authState.revokeAccessTokens).toHaveBeenCalledWith('u1');
  });

  describe('şifre sıfırlama ve e-posta doğrulama', () => {
    const tokenFromMail = (text: string) => {
      const m = text.match(/token=([A-Za-z0-9_%-]+)/);
      return decodeURIComponent(m![1]);
    };

    it('kayıtlı olmayan e-posta için sessizce döner, e-posta gönderilmez', async () => {
      const { service, notifications, prisma } = createService({ users: [userRow()] });
      await expect(service.forgotPassword('yok@b.c')).resolves.toBeUndefined();
      expect(notifications.sendEmail).not.toHaveBeenCalled();
      expect(prisma.resets).toHaveLength(0);
    });

    it('sıfırlama bağlantısı WEB_URL ile gönderilir; yalnızca token özeti saklanır, 1 saat geçerli', async () => {
      const { service, notifications, prisma } = createService({ users: [userRow()] });
      await service.forgotPassword('  A@B.C ');
      expect(notifications.sendEmail).toHaveBeenCalledTimes(1);
      const [to, , text] = notifications.sendEmail.mock.calls[0];
      expect(to).toBe('a@b.c');
      expect(text).toContain('https://web.test/reset-password?token=');
      const token = tokenFromMail(text);
      expect(Buffer.from(token, 'base64url')).toHaveLength(32);
      expect(prisma.resets).toHaveLength(1);
      expect(prisma.resets[0].tokenHash).toBe(hashToken(token));
      expect(prisma.resets[0].tokenHash).not.toContain(token);
      const ttl = prisma.resets[0].expiresAt.getTime() - Date.now();
      expect(ttl).toBeGreaterThan(59 * 60 * 1000);
      expect(ttl).toBeLessThanOrEqual(60 * 60 * 1000);

      // Yeni istek önceki bağlantıyı geçersiz kılar
      await service.forgotPassword('a@b.c');
      expect(prisma.resets).toHaveLength(1);
      expect(prisma.resets[0].tokenHash).not.toBe(hashToken(token));
    });

    it('şifreyi günceller, oturumları kapatır; token ikinci kez kullanılamaz', async () => {
      const users: Record<string, unknown>[] = [userRow({ emailVerifiedAt: null })];
      const { service, notifications, authState } = createService({ users });
      await service.forgotPassword('a@b.c');
      const token = tokenFromMail(notifications.sendEmail.mock.calls[0][2]);
      await service.resetPassword(token, 'YeniSifre123!');
      const argon2 = await import('argon2');
      expect(await argon2.verify(users[0].passwordHash as string, 'YeniSifre123!')).toBe(true);
      expect(users[0].emailVerifiedAt).toBeInstanceOf(Date);
      expect(authState.revokeAccessTokens).toHaveBeenCalledWith('u1');
      await expect(service.resetPassword(token, 'BaskaSifre123!')).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });

    it('süresi dolmuş, bilinmeyen ya da başka amaçlı token reddedilir', async () => {
      const { service, notifications, prisma } = createService({ users: [userRow()] });
      await expect(service.resetPassword('x'.repeat(43), 'YeniSifre123!')).rejects.toBeInstanceOf(
        BadRequestException,
      );
      await service.requestEmailVerification('u1');
      const verifyToken = tokenFromMail(notifications.sendEmail.mock.calls[0][2]);
      expect(notifications.sendEmail.mock.calls[0][2]).toContain('/verify-email?token=');
      await expect(service.resetPassword(verifyToken, 'YeniSifre123!')).rejects.toBeInstanceOf(
        BadRequestException,
      );
      prisma.resets[0].expiresAt = new Date(Date.now() - 1000);
      await expect(service.verifyEmail(verifyToken)).rejects.toBeInstanceOf(BadRequestException);
    });

    it('doğrulanmış e-posta için yeni doğrulama bağlantısı gönderilmez', async () => {
      const { service, notifications } = createService({
        users: [userRow({ emailVerifiedAt: new Date() })],
      });
      await service.requestEmailVerification('u1');
      expect(notifications.sendEmail).not.toHaveBeenCalled();
    });
  });
});

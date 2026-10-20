import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron, CronExpression } from '@nestjs/schedule';
import { JwtService } from '@nestjs/jwt';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import * as argon2 from 'argon2';
import type {
  AuthResponse,
  AuthTokens,
  LoginDto,
  OAuthLoginDto,
  RegisterDto,
  UserProfile,
} from '@devacademy/shared';
import type { TokenPurpose, User } from '@prisma/client';
import { AuthStateService } from '../../common/auth/auth-state.service';
import { PrismaService } from '../../common/prisma/prisma.service';
import { RedisService } from '../../common/redis/redis.service';
import type { Env } from '../../config/env';
import { NotificationsService } from '../notifications/notifications.service';
import { OAuthVerifierService } from './oauth-verifier.service';

/** Zamanlama eşitlemesi için sahte hash (kayıtlı olmayan e-postalarda doğrulanır) */
const DUMMY_HASH = argon2.hash(randomBytes(16).toString('hex'), { type: argon2.argon2id });

/** Şifre sıfırlama bağlantısı 1 saat, e-posta doğrulama bağlantısı 24 saat geçerli */
const TOKEN_TTL_MS: Record<TokenPurpose, number> = {
  reset: 60 * 60 * 1000,
  verify: 24 * 60 * 60 * 1000,
};

const MAIL = {
  tr: {
    reset: {
      subject: 'DevAcademy şifre sıfırlama',
      body: (link: string) =>
        `Şifreni sıfırlamak için bağlantıyı aç (1 saat geçerli):\n${link}\n\nBu isteği sen yapmadıysan bu e-postayı yok sayabilirsin.`,
    },
    verify: {
      subject: 'DevAcademy e-posta doğrulama',
      body: (link: string) =>
        `E-posta adresini doğrulamak için bağlantıyı aç (24 saat geçerli):\n${link}`,
    },
  },
  en: {
    reset: {
      subject: 'Reset your DevAcademy password',
      body: (link: string) =>
        `Open this link to reset your password (valid for 1 hour):\n${link}\n\nIf you didn't request this, you can ignore this email.`,
    },
    verify: {
      subject: 'Verify your DevAcademy email',
      body: (link: string) => `Open this link to verify your email (valid for 24 hours):\n${link}`,
    },
  },
} as const;

const INVALID_LINK = 'Bağlantı geçersiz ya da süresi dolmuş';

export interface SessionMeta {
  userAgent?: string;
  ip?: string;
}

/**
 * Kimlik doğrulama: e-posta/şifre (argon2id), Google/Apple ID token, JWT access + döndürülen refresh token.
 * Refresh token'lar yalnızca SHA-256 özetiyle saklanır; her yenilemede eski token iptal edilip yenisi üretilir
 * (rotation). Çalınmış bir token yeniden kullanılırsa tüm "aile" iptal edilir.
 */
@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService<Env, true>,
    private readonly oauth: OAuthVerifierService,
    private readonly redis: RedisService,
    private readonly authState: AuthStateService,
    private readonly notifications: NotificationsService,
  ) {}

  /**
   * Süresi bir günden uzun süre önce dolmuş refresh token'ları siler (tablo sınırsız büyümesin).
   * Süresi dolmuş token zaten reddedilir; yeniden kullanım tespiti için yalnızca geçerli süredekiler gerekir.
   */
  @Cron(CronExpression.EVERY_DAY_AT_3AM)
  async purgeExpiredRefreshTokens(): Promise<number> {
    const day = new Date().toISOString().slice(0, 10);
    if (!(await this.redis.acquireLock(`lock:purge-refresh:${day}`, 23 * 60 * 60 * 1000))) return 0;
    const { count } = await this.prisma.refreshToken.deleteMany({
      where: { expiresAt: { lt: new Date(Date.now() - 24 * 60 * 60 * 1000) } },
    });
    if (count) this.logger.log(`${count} süresi dolmuş refresh token silindi`);
    return count;
  }

  async register(dto: RegisterDto, meta: SessionMeta): Promise<AuthResponse> {
    const email = dto.email.toLowerCase().trim();
    const existing = await this.prisma.user.findUnique({ where: { email } });
    if (existing) throw new ConflictException('Bu e-posta ile kayıtlı bir hesap var');
    const passwordHash = await argon2.hash(dto.password, { type: argon2.argon2id });
    const user = await this.prisma.user.create({
      data: { email, passwordHash, displayName: dto.displayName.trim(), locale: dto.locale },
    });
    return this.issueSession(user, meta);
  }

  async login(dto: LoginDto, meta: SessionMeta): Promise<AuthResponse> {
    const email = dto.email.toLowerCase().trim();
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user || !user.passwordHash || user.deletedAt) {
      // Kullanıcı yokken de bir argon2 doğrulaması yap: yanıt süresi e-postanın kayıtlı olup olmadığını sızdırmasın
      await argon2.verify(await DUMMY_HASH, dto.password).catch(() => false);
      throw new UnauthorizedException('E-posta ya da şifre hatalı');
    }
    const ok = await argon2.verify(user.passwordHash, dto.password);
    if (!ok) throw new UnauthorizedException('E-posta ya da şifre hatalı');
    return this.issueSession(user, meta);
  }

  async oauthLogin(dto: OAuthLoginDto, meta: SessionMeta): Promise<AuthResponse> {
    const identity = await this.oauth.verify(dto.provider, dto.idToken);
    const existingAccount = await this.prisma.oAuthAccount.findUnique({
      where: {
        provider_providerUserId: {
          provider: dto.provider,
          providerUserId: identity.providerUserId,
        },
      },
      include: { user: true },
    });
    if (existingAccount && !existingAccount.user.deletedAt)
      return this.issueSession(existingAccount.user, meta);
    if (existingAccount) {
      // Eski (soft-delete) kapatılmış hesap: kişi aynı sağlayıcıyla geri dönebilsin diye kalıntıyı tamamen sil
      await this.prisma.user.delete({ where: { id: existingAccount.userId } });
    }

    // Aynı e-posta ile hesap varsa yalnızca sağlayıcı e-postayı doğrulamışsa bağla; yoksa yeni kullanıcı oluştur.
    // E-postası doğrulanmamış şifreli hesaba bağlanmaz: aksi halde kurbanın e-postasıyla önceden kayıt olan
    // biri, kurban sosyal girişle geldiğinde aynı hesaba kendi şifresiyle erişmeye devam eder (pre-account hijack).
    const email = identity.email?.toLowerCase();
    const account = {
      provider: dto.provider,
      providerUserId: identity.providerUserId,
      email: identity.email ?? null,
    };
    if (email) {
      const byEmail = await this.prisma.user.findUnique({ where: { email } });
      if (byEmail) {
        if (byEmail.deletedAt) throw new UnauthorizedException('Hesap kapatılmış');
        if (!identity.emailVerified || (byEmail.passwordHash && !byEmail.emailVerifiedAt))
          throw new ConflictException(
            'Bu e-posta ile kayıtlı bir hesap var; e-posta ve şifre ile giriş yapın',
          );
        await this.prisma.oAuthAccount.create({ data: { ...account, userId: byEmail.id } });
        return this.issueSession(byEmail, meta);
      }
    }
    // Kullanıcı ve bağlı hesap tek yazımda oluşur; ikinci adım başarısız olursa yetim kullanıcı kalmaz
    const user: User = await this.prisma.user.create({
      data: {
        email: email ?? `${dto.provider}_${identity.providerUserId}@users.devacademy.local`,
        displayName: dto.displayName?.trim() || identity.name || email?.split('@')[0] || 'Öğrenci',
        avatarUrl: identity.picture ?? null,
        emailVerifiedAt: identity.emailVerified ? new Date() : null,
        oauthAccounts: { create: account },
      },
    });
    return this.issueSession(user, meta);
  }

  async refresh(rawToken: string, meta: SessionMeta): Promise<AuthTokens> {
    const tokenHash = hashToken(rawToken);
    const stored = await this.prisma.refreshToken.findUnique({
      where: { tokenHash },
      include: { user: true },
    });
    if (!stored) throw new UnauthorizedException('Geçersiz refresh token');

    if (stored.revokedAt) {
      // Yeniden kullanım tespiti: aileyi tamamen iptal et
      this.logger.warn(
        `Refresh token yeniden kullanımı tespit edildi (user=${stored.userId}); aile iptal ediliyor`,
      );
      await this.prisma.refreshToken.updateMany({
        where: { family: stored.family, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      throw new UnauthorizedException('Oturum geçersiz kılındı, lütfen tekrar giriş yapın');
    }
    if (stored.expiresAt < new Date())
      throw new UnauthorizedException('Refresh token süresi dolmuş');
    if (stored.user.deletedAt) throw new UnauthorizedException('Hesap kapatılmış');

    // Koşullu iptal: aynı token ile eş zamanlı iki istekten yalnızca biri kazanır
    const { count } = await this.prisma.refreshToken.updateMany({
      where: { id: stored.id, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    if (count === 0) {
      // Yarışı kaybeden istek yeni token almaz; ailede tek geçerli zincir kalır
      this.logger.warn(`Eş zamanlı refresh tespit edildi (user=${stored.userId})`);
      throw new UnauthorizedException('Refresh token zaten kullanıldı');
    }
    return this.createTokens(stored.user, stored.family, meta);
  }

  async logout(rawToken: string | undefined, userId: string, everywhere = false): Promise<void> {
    if (everywhere) {
      await this.prisma.refreshToken.updateMany({
        where: { userId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      // Diğer cihazlardaki access token'lar da süresini beklemeden geçersiz olur
      await this.authState.revokeAccessTokens(userId);
      return;
    }
    if (!rawToken) return;
    const tokenHash = hashToken(rawToken);
    await this.prisma.refreshToken.updateMany({
      where: { tokenHash, userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  async changePassword(
    userId: string,
    currentPassword: string,
    newPassword: string,
  ): Promise<void> {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    // Sosyal girişli hesaplarda şifre yok; yalnızca access token ile kalıcı şifre atanmasına izin verilmez
    if (!user.passwordHash)
      throw new BadRequestException(
        'Bu hesabın şifresi yok (sosyal giriş); şifre belirleme desteklenmiyor',
      );
    const ok = await argon2.verify(user.passwordHash, currentPassword);
    if (!ok) throw new UnauthorizedException('Mevcut şifre hatalı');
    const passwordHash = await argon2.hash(newPassword, { type: argon2.argon2id });
    await this.prisma.user.update({ where: { id: userId }, data: { passwordHash } });
    await this.prisma.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    await this.authState.revokeAccessTokens(userId);
  }

  /* ------------------------ Şifre sıfırlama / doğrulama ------------------------ */

  /**
   * Şifre sıfırlama bağlantısı gönderir. Yanıt kullanıcının var olup olmadığını sızdırmaz: çağıran her
   * durumda 204 döner ve e-posta beklenmeden (arka planda) gönderilir, yanıt süresi de eşitlenir.
   */
  async forgotPassword(rawEmail: string): Promise<void> {
    const email = rawEmail.toLowerCase().trim();
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user || user.deletedAt) return;
    const token = await this.createOneTimeToken(user.id, 'reset');
    this.sendTokenMail(user, 'reset', token);
  }

  /** Sıfırlama token'ı tek kullanımlıktır; şifre güncellenir ve tüm oturumlar kapatılır */
  async resetPassword(rawToken: string, newPassword: string): Promise<void> {
    const userId = await this.consumeOneTimeToken(rawToken, 'reset');
    const passwordHash = await argon2.hash(newPassword, { type: argon2.argon2id });
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    await this.prisma.user.update({
      where: { id: userId },
      // Bağlantı e-postaya gittiğine göre adres de doğrulanmış olur
      data: { passwordHash, emailVerifiedAt: user.emailVerifiedAt ?? new Date() },
    });
    await this.prisma.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    await this.authState.revokeAccessTokens(userId);
  }

  /** Oturumlu kullanıcıya doğrulama bağlantısı gönderir (zaten doğrulanmışsa bir şey yapmaz) */
  async requestEmailVerification(userId: string): Promise<void> {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    if (user.emailVerifiedAt) return;
    const token = await this.createOneTimeToken(user.id, 'verify');
    this.sendTokenMail(user, 'verify', token);
  }

  async verifyEmail(rawToken: string): Promise<void> {
    const userId = await this.consumeOneTimeToken(rawToken, 'verify');
    await this.prisma.user.updateMany({
      where: { id: userId, emailVerifiedAt: null },
      data: { emailVerifiedAt: new Date() },
    });
  }

  /**
   * Rastgele 32 bayt (base64url) token üretir; yalnızca SHA-256 özeti saklanır. Aynı amaçla verilmiş
   * önceki kullanılmamış token'lar silinir (her zaman en son gönderilen bağlantı geçerli).
   */
  private async createOneTimeToken(userId: string, purpose: TokenPurpose): Promise<string> {
    const token = randomBytes(32).toString('base64url');
    await this.prisma.$transaction([
      this.prisma.passwordReset.deleteMany({ where: { userId, purpose, usedAt: null } }),
      this.prisma.passwordReset.create({
        data: {
          userId,
          purpose,
          tokenHash: hashToken(token),
          expiresAt: new Date(Date.now() + TOKEN_TTL_MS[purpose]),
        },
      }),
    ]);
    return token;
  }

  /** Token'ı koşullu olarak kullanılmış işaretler: eş zamanlı iki istekten yalnızca biri kazanır */
  private async consumeOneTimeToken(rawToken: string, purpose: TokenPurpose): Promise<string> {
    const stored = await this.prisma.passwordReset.findUnique({
      where: { tokenHash: hashToken(rawToken) },
      include: { user: { select: { deletedAt: true } } },
    });
    if (!stored || stored.purpose !== purpose || stored.user.deletedAt)
      throw new BadRequestException(INVALID_LINK);
    const { count } = await this.prisma.passwordReset.updateMany({
      where: { id: stored.id, usedAt: null, expiresAt: { gt: new Date() } },
      data: { usedAt: new Date() },
    });
    if (count === 0) throw new BadRequestException(INVALID_LINK);
    return stored.userId;
  }

  private sendTokenMail(user: User, purpose: TokenPurpose, token: string): void {
    const path = purpose === 'reset' ? 'reset-password' : 'verify-email';
    const link = `${this.config.get('WEB_URL')}/${path}?token=${encodeURIComponent(token)}`;
    const mail = MAIL[user.locale][purpose];
    // Beklenmez: SMTP gecikmesi e-postanın kayıtlı olup olmadığını sızdırmasın (sendEmail hatayı loglar)
    void this.notifications.sendEmail(user.email, mail.subject, mail.body(link));
  }

  /* ----------------------------- yardımcılar ----------------------------- */

  private async issueSession(user: User, meta: SessionMeta): Promise<AuthResponse> {
    const tokens = await this.createTokens(user, randomUUID(), meta);
    return { user: toProfile(user), tokens };
  }

  private async createTokens(user: User, family: string, meta: SessionMeta): Promise<AuthTokens> {
    const accessTtl = this.config.get('JWT_ACCESS_TTL');
    const refreshTtl = this.config.get('JWT_REFRESH_TTL');
    const accessToken = await this.jwt.signAsync(
      { sub: user.id, email: user.email, role: user.role, type: 'access' },
      { secret: this.config.get('JWT_ACCESS_SECRET'), expiresIn: accessTtl },
    );
    const refreshToken = randomBytes(48).toString('base64url');
    await this.prisma.refreshToken.create({
      data: {
        userId: user.id,
        tokenHash: hashToken(refreshToken),
        family,
        userAgent: meta.userAgent?.slice(0, 255),
        ip: meta.ip,
        expiresAt: new Date(Date.now() + refreshTtl * 1000),
      },
    });
    return { accessToken, refreshToken, expiresIn: accessTtl, tokenType: 'Bearer' };
  }
}

export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export function toProfile(user: User): UserProfile {
  return {
    id: user.id,
    email: user.email,
    displayName: user.displayName,
    avatarUrl: user.avatarUrl,
    role: user.role,
    locale: user.locale,
    selectedPathId: user.selectedPathId,
    createdAt: user.createdAt.toISOString(),
  };
}

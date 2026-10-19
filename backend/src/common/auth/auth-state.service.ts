import { Injectable } from '@nestjs/common';
import type { UserRole } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';

export interface ActiveUserState {
  role: UserRole;
  /** ms; bu andan önce verilmiş (iat) access token'lar reddedilir */
  tokensValidAfter: number | null;
}

type CachedState = ({ active: true } & ActiveUserState) | { active: false };

/** Kısa önbellek: her istekte veritabanına gitmeden silinmiş/rolü değişmiş kullanıcı en geç bu sürede fark edilir */
const CACHE_TTL_SECONDS = 30;
const key = (userId: string) => `auth:user:${userId}`;

/**
 * Access token'ın imzası geçerli olsa da kullanıcının güncel durumu: silinmiş mi, rolü ne, oturumları
 * toplu kapatıldı mı. JWT 15 dk geçerli olduğundan bu kontrol olmadan silinen kullanıcı ya da yetkisi
 * alınan editör token süresi bitene kadar erişmeye devam ederdi.
 */
@Injectable()
export class AuthStateService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  async get(userId: string): Promise<ActiveUserState | null> {
    const cached = await this.redis.getJson<CachedState>(key(userId));
    if (cached) return cached.active ? toState(cached) : null;
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { role: true, deletedAt: true, tokensValidAfter: true },
    });
    const state: CachedState =
      !user || user.deletedAt
        ? { active: false }
        : {
            active: true,
            role: user.role,
            tokensValidAfter: user.tokensValidAfter?.getTime() ?? null,
          };
    await this.redis.setJson(key(userId), state, CACHE_TTL_SECONDS);
    return state.active ? toState(state) : null;
  }

  /** `iat` (saniye) bu kullanıcı için hâlâ geçerli mi */
  static isIssuedAfterRevocation(state: ActiveUserState, iatSeconds: number | undefined): boolean {
    if (!state.tokensValidAfter) return true;
    return (iatSeconds ?? 0) * 1000 >= state.tokensValidAfter;
  }

  /**
   * Şu ana kadar verilmiş tüm access token'ları geçersiz kılar. JWT `iat` saniye hassasiyetinde olduğundan
   * an saniyeye yuvarlanır: aynı saniyede yeniden giriş yapan kullanıcının yeni token'ı reddedilmez.
   */
  async revokeAccessTokens(userId: string): Promise<void> {
    const at = new Date(Math.floor(Date.now() / 1000) * 1000);
    await this.prisma.user.update({ where: { id: userId }, data: { tokensValidAfter: at } });
    await this.invalidate(userId);
  }

  async invalidate(userId: string): Promise<void> {
    await this.redis.del(key(userId));
  }
}

function toState(s: { role: UserRole; tokensValidAfter: number | null }): ActiveUserState {
  return { role: s.role, tokensValidAfter: s.tokensValidAfter };
}

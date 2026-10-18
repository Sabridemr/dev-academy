import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OAuth2Client } from 'google-auth-library';
import { createRemoteJWKSet, jwtVerify } from 'jose';
import type { Env } from '../../config/env';

export interface OAuthIdentity {
  providerUserId: string;
  email?: string;
  emailVerified: boolean;
  name?: string;
  picture?: string;
}

/**
 * Google ve Apple ID token doğrulaması. İstemci (web/mobil) sağlayıcıdan aldığı ID token'ı
 * backend'e gönderir; biz imzayı ve audience'ı doğrularız.
 */
@Injectable()
export class OAuthVerifierService {
  private readonly googleClient = new OAuth2Client();
  private readonly appleJwks = createRemoteJWKSet(new URL('https://appleid.apple.com/auth/keys'));

  constructor(private readonly config: ConfigService<Env, true>) {}

  async verify(provider: 'google' | 'apple', idToken: string): Promise<OAuthIdentity> {
    return provider === 'google' ? this.verifyGoogle(idToken) : this.verifyApple(idToken);
  }

  private audiences(key: 'GOOGLE_CLIENT_IDS' | 'APPLE_CLIENT_IDS'): string[] {
    const raw: string = this.config.get(key);
    return raw
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
  }

  private async verifyGoogle(idToken: string): Promise<OAuthIdentity> {
    const audience = this.audiences('GOOGLE_CLIENT_IDS');
    if (audience.length === 0) throw new UnauthorizedException('Google girişi yapılandırılmamış');
    try {
      const ticket = await this.googleClient.verifyIdToken({ idToken, audience });
      const payload = ticket.getPayload();
      if (!payload?.sub) throw new Error('payload yok');
      return {
        providerUserId: payload.sub,
        email: payload.email,
        emailVerified: Boolean(payload.email_verified),
        name: payload.name,
        picture: payload.picture,
      };
    } catch {
      throw new UnauthorizedException('Google kimliği doğrulanamadı');
    }
  }

  private async verifyApple(idToken: string): Promise<OAuthIdentity> {
    const audience = this.audiences('APPLE_CLIENT_IDS');
    if (audience.length === 0) throw new UnauthorizedException('Apple girişi yapılandırılmamış');
    try {
      const { payload } = await jwtVerify(idToken, this.appleJwks, { issuer: 'https://appleid.apple.com', audience });
      if (!payload.sub) throw new Error('sub yok');
      return {
        providerUserId: payload.sub,
        email: typeof payload.email === 'string' ? payload.email : undefined,
        emailVerified: payload.email_verified === true || payload.email_verified === 'true',
      };
    } catch {
      throw new UnauthorizedException('Apple kimliği doğrulanamadı');
    }
  }
}

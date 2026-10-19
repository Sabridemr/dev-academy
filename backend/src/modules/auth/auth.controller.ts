import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  Res,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { CookieOptions, Request, Response } from 'express';
import { z } from 'zod';
import { LoginSchema, OAuthLoginSchema, RefreshSchema, RegisterSchema } from '@devacademy/shared';
import type {
  AuthResponse,
  AuthTokens,
  LoginDto,
  OAuthLoginDto,
  RefreshDto,
  RegisterDto,
} from '@devacademy/shared';
import { CurrentUser, Public, type AuthUser } from '../../common/auth/decorators';
import { zodBody } from '../../common/pipes/zod-validation.pipe';
import { ApiZodBody } from '../../common/swagger/zod-openapi';
import type { Env } from '../../config/env';
import { AuthService, type SessionMeta } from './auth.service';

const ChangePasswordSchema = z.object({
  currentPassword: z.string().min(1).max(128),
  newPassword: z.string().min(8).max(128),
});
const LogoutSchema = z.object({
  refreshToken: z.string().optional(),
  everywhere: z.boolean().default(false),
});

function meta(req: Request): SessionMeta {
  return { userAgent: req.headers['user-agent'], ip: req.ip };
}

/** Web refresh token çerezi (httpOnly: JavaScript, dolayısıyla XSS okuyamaz) */
const REFRESH_COOKIE = 'da_rt';

/** Web istemcisi `X-Auth-Mode: cookie` gönderir; özel başlık CORS preflight'ı zorunlu kılar (CSRF'e karşı) */
function cookieMode(req: Request): boolean {
  return req.headers['x-auth-mode'] === 'cookie';
}

function readCookie(req: Request, name: string): string | undefined {
  for (const part of (req.headers.cookie ?? '').split(';')) {
    const [k, ...v] = part.trim().split('=');
    if (k === name) return decodeURIComponent(v.join('='));
  }
  return undefined;
}

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly config: ConfigService<Env, true>,
  ) {}

  private cookieOptions(): CookieOptions {
    const sameSite = this.config.get('REFRESH_COOKIE_SAMESITE');
    return {
      httpOnly: true,
      secure: this.config.get('NODE_ENV') === 'production' || sameSite === 'none',
      sameSite,
      path: `/${this.config.get('API_PREFIX')}/auth`,
    };
  }

  /** Çerez modunda refresh token çereze yazılır ve gövdeden çıkarılır */
  private deliverTokens(req: Request, res: Response, tokens: AuthTokens): AuthTokens {
    if (!cookieMode(req)) return tokens;
    res.cookie(REFRESH_COOKIE, tokens.refreshToken, {
      ...this.cookieOptions(),
      maxAge: this.config.get('JWT_REFRESH_TTL') * 1000,
    });
    return { ...tokens, refreshToken: '' };
  }

  private deliver(req: Request, res: Response, out: AuthResponse): AuthResponse {
    return { ...out, tokens: this.deliverTokens(req, res, out.tokens) };
  }

  private refreshTokenFrom(req: Request, bodyToken?: string): string | undefined {
    return bodyToken ?? (cookieMode(req) ? readCookie(req, REFRESH_COOKIE) : undefined);
  }

  @Public()
  @Post('register')
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @ApiOperation({ summary: 'E-posta ile kayıt' })
  @ApiZodBody(RegisterSchema)
  async register(
    @Body(zodBody(RegisterSchema)) dto: RegisterDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<AuthResponse> {
    return this.deliver(req, res, await this.auth.register(dto, meta(req)));
  }

  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @ApiOperation({ summary: 'E-posta/şifre ile giriş' })
  @ApiZodBody(LoginSchema)
  async login(
    @Body(zodBody(LoginSchema)) dto: LoginDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<AuthResponse> {
    return this.deliver(req, res, await this.auth.login(dto, meta(req)));
  }

  @Public()
  @Post('oauth')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @ApiOperation({ summary: 'Google / Apple ID token ile giriş' })
  @ApiZodBody(OAuthLoginSchema)
  async oauth(
    @Body(zodBody(OAuthLoginSchema)) dto: OAuthLoginDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<AuthResponse> {
    return this.deliver(req, res, await this.auth.oauthLogin(dto, meta(req)));
  }

  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @ApiOperation({ summary: 'Refresh token ile yeni token çifti (rotation; web: httpOnly çerez)' })
  @ApiZodBody(RefreshSchema)
  async refresh(
    @Body(zodBody(RefreshSchema)) dto: RefreshDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<AuthTokens> {
    const token = this.refreshTokenFrom(req, dto.refreshToken);
    if (!token) throw new UnauthorizedException('Refresh token yok');
    return this.deliverTokens(req, res, await this.auth.refresh(token, meta(req)));
  }

  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Çıkış (tek cihaz ya da tüm cihazlar)' })
  @ApiZodBody(LogoutSchema)
  async logout(
    @Body(zodBody(LogoutSchema)) dto: z.infer<typeof LogoutSchema>,
    @CurrentUser() user: AuthUser,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<void> {
    await this.auth.logout(this.refreshTokenFrom(req, dto.refreshToken), user.id, dto.everywhere);
    if (cookieMode(req)) res.clearCookie(REFRESH_COOKIE, this.cookieOptions());
  }

  @Post('change-password')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Şifre değiştir (tüm oturumları kapatır)' })
  @ApiZodBody(ChangePasswordSchema)
  async changePassword(
    @Body(zodBody(ChangePasswordSchema)) dto: z.infer<typeof ChangePasswordSchema>,
    @CurrentUser() user: AuthUser,
  ): Promise<void> {
    await this.auth.changePassword(user.id, dto.currentPassword, dto.newPassword);
  }
}

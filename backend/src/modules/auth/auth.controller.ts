import { Body, Controller, HttpCode, HttpStatus, Post, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { Request } from 'express';
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

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Public()
  @Post('register')
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @ApiOperation({ summary: 'E-posta ile kayıt' })
  @ApiZodBody(RegisterSchema)
  register(
    @Body(zodBody(RegisterSchema)) dto: RegisterDto,
    @Req() req: Request,
  ): Promise<AuthResponse> {
    return this.auth.register(dto, meta(req));
  }

  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @ApiOperation({ summary: 'E-posta/şifre ile giriş' })
  @ApiZodBody(LoginSchema)
  login(@Body(zodBody(LoginSchema)) dto: LoginDto, @Req() req: Request): Promise<AuthResponse> {
    return this.auth.login(dto, meta(req));
  }

  @Public()
  @Post('oauth')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @ApiOperation({ summary: 'Google / Apple ID token ile giriş' })
  @ApiZodBody(OAuthLoginSchema)
  oauth(
    @Body(zodBody(OAuthLoginSchema)) dto: OAuthLoginDto,
    @Req() req: Request,
  ): Promise<AuthResponse> {
    return this.auth.oauthLogin(dto, meta(req));
  }

  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @ApiOperation({ summary: 'Refresh token ile yeni token çifti (rotation)' })
  @ApiZodBody(RefreshSchema)
  refresh(@Body(zodBody(RefreshSchema)) dto: RefreshDto, @Req() req: Request): Promise<AuthTokens> {
    return this.auth.refresh(dto.refreshToken, meta(req));
  }

  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Çıkış (tek cihaz ya da tüm cihazlar)' })
  @ApiZodBody(LogoutSchema)
  async logout(
    @Body(zodBody(LogoutSchema)) dto: z.infer<typeof LogoutSchema>,
    @CurrentUser() user: AuthUser,
  ): Promise<void> {
    await this.auth.logout(dto.refreshToken, user.id, dto.everywhere);
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

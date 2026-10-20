import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { RegisterPushTokenSchema, UpdateProfileSchema } from '@devacademy/shared';
import type { RegisterPushTokenDto, UpdateProfileDto } from '@devacademy/shared';
import { CurrentUser, type AuthUser } from '../../common/auth/decorators';
import { zodBody } from '../../common/pipes/zod-validation.pipe';
import { ApiZodBody } from '../../common/swagger/zod-openapi';
import { UsersService, type MeProfile } from './users.service';

@ApiTags('users')
@ApiBearerAuth()
@Controller('users')
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get('me')
  @ApiOperation({ summary: 'Oturum açmış kullanıcının profili' })
  me(@CurrentUser() user: AuthUser): Promise<MeProfile> {
    return this.users.getProfile(user.id);
  }

  @Patch('me')
  @ApiOperation({
    summary: 'Profil güncelle (ad, avatar, dil, öğrenme yolu, hatırlatma saati, günlük hedef)',
  })
  @ApiZodBody(UpdateProfileSchema)
  update(@CurrentUser() user: AuthUser, @Body(zodBody(UpdateProfileSchema)) dto: UpdateProfileDto) {
    return this.users.updateProfile(user.id, dto);
  }

  @Delete('me')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Hesabı ve kişisel verileri kalıcı olarak sil' })
  async remove(@CurrentUser() user: AuthUser): Promise<void> {
    await this.users.eraseAccount(user.id);
  }

  @Post('me/push-tokens')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Push bildirim token’ı kaydet (Expo / web push)' })
  @ApiZodBody(RegisterPushTokenSchema)
  async registerPush(
    @CurrentUser() user: AuthUser,
    @Body(zodBody(RegisterPushTokenSchema)) dto: RegisterPushTokenDto,
  ): Promise<void> {
    await this.users.registerPushToken(user.id, dto);
  }

  @Delete('me/push-tokens/:token')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Push bildirim token’ını kaldır (çıkışta)' })
  async unregisterPush(
    @CurrentUser() user: AuthUser,
    @Param('token') token: string,
  ): Promise<void> {
    await this.users.unregisterPushToken(user.id, token);
  }
}

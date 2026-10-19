import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import type { RegisterPushTokenDto, UpdateProfileDto, UserProfile } from '@devacademy/shared';
import { AuthStateService } from '../../common/auth/auth-state.service';
import { PrismaService } from '../../common/prisma/prisma.service';
import { RealtimeGateway } from '../realtime/realtime.gateway';
import { toProfile } from '../auth/auth.service';

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly authState: AuthStateService,
    private readonly realtime: RealtimeGateway,
  ) {}

  async getProfile(
    userId: string,
  ): Promise<UserProfile & { reminderHour: number | null; timezone: string }> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user || user.deletedAt) throw new NotFoundException('Kullanıcı bulunamadı');
    return { ...toProfile(user), reminderHour: user.reminderHour, timezone: user.timezone };
  }

  async updateProfile(userId: string, dto: UpdateProfileDto) {
    if (dto.selectedPathId) {
      const path = await this.prisma.learningPath.findUnique({ where: { id: dto.selectedPathId } });
      if (!path) throw new NotFoundException('Öğrenme yolu bulunamadı');
    }
    const user = await this.prisma.user.update({
      where: { id: userId },
      data: {
        displayName: dto.displayName,
        avatarUrl: dto.avatarUrl,
        locale: dto.locale,
        selectedPathId: dto.selectedPathId,
        reminderHour: dto.reminderHour,
        timezone: dto.timezone,
      },
    });
    return { ...toProfile(user), reminderHour: user.reminderHour, timezone: user.timezone };
  }

  /**
   * Hesabı ve kişisel verileri kalıcı olarak siler (KVKK/GDPR silme hakkı): ilerleme, denemeler, notlar,
   * yer imleri, tekrar kartları, rozetler, OAuth bağlantıları ve token'lar cascade ile gider; yazdığı
   * ders/sahne sürümleri yazarsız kalır. Aynı Google/Apple hesabıyla daha sonra yeniden kayıt olunabilir.
   */
  async eraseAccount(userId: string): Promise<void> {
    await this.prisma.user.delete({ where: { id: userId } });
    await this.authState.invalidate(userId);
    this.realtime.disconnectUser(userId);
  }

  async registerPushToken(userId: string, dto: RegisterPushTokenDto): Promise<void> {
    // Başka bir hesaba kayıtlı token'ı devralmak, o kullanıcının bildirimlerini çalmak demektir
    const existing = await this.prisma.pushToken.findUnique({ where: { token: dto.token } });
    if (existing && existing.userId !== userId)
      throw new ConflictException('Bu cihaz token’ı başka bir hesaba kayıtlı');
    await this.prisma.pushToken.upsert({
      where: { token: dto.token },
      update: {
        userId,
        platform: dto.platform,
        deviceName: dto.deviceName,
        lastSeenAt: new Date(),
      },
      create: { userId, token: dto.token, platform: dto.platform, deviceName: dto.deviceName },
    });
  }

  /** Çıkışta cihaz token'ını bırak; aynı cihazda sonraki hesap kaydedebilsin */
  async unregisterPushToken(userId: string, token: string): Promise<void> {
    await this.prisma.pushToken.deleteMany({ where: { userId, token } });
  }
}

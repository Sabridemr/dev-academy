import { Controller, Get, Header, Param } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { CertificateDto } from '@devacademy/shared';
import { CurrentUser, Public, type AuthUser } from '../../common/auth/decorators';
import { CertificatesService } from './certificates.service';

@ApiTags('certificates')
@ApiBearerAuth()
@Controller('certificates')
export class CertificatesController {
  constructor(private readonly certificates: CertificatesService) {}

  @Get()
  @ApiOperation({ summary: 'Kullanıcının sertifikaları (modül ve öğrenme yolu)' })
  list(@CurrentUser() user: AuthUser): Promise<CertificateDto[]> {
    return this.certificates.listMine(user.id);
  }

  @Public()
  @Get('public/:publicId')
  @Header('Cache-Control', 'public, max-age=300')
  @ApiOperation({ summary: 'Herkese açık sertifika doğrulama (ad, hedef, tarih, ders sayısı)' })
  getPublic(@Param('publicId') publicId: string): Promise<CertificateDto> {
    return this.certificates.getPublic(publicId);
  }
}

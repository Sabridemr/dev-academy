import { Controller, Get, NotFoundException, Param, Req, Res } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import { Public } from '../../common/auth/decorators';
import { PrismaService } from '../../common/prisma/prisma.service';

/** `<sha256>.<ext>`: içerik özetiyle adreslenir, dosya değişirse adres de değişir */
const ASSET_NAME = /^([a-f0-9]{64})\.(png|jpg|webp)$/;

/**
 * Ders görselleri. Adres içerikten türediği için yanıt sonsuza dek önbelleklenebilir (immutable).
 * Bir ders sayfası onlarca görsel yükleyebildiğinden genel hız sınırına takılmaz.
 */
@ApiTags('content')
@Controller('assets')
@SkipThrottle()
export class AssetsController {
  constructor(private readonly prisma: PrismaService) {}

  @Public()
  @Get(':name')
  @ApiOperation({ summary: 'Ders görseli (içerik özetiyle adreslenir, kalıcı önbellek)' })
  async get(@Param('name') name: string, @Req() req: Request, @Res() res: Response): Promise<void> {
    const match = ASSET_NAME.exec(name);
    if (!match) throw new NotFoundException('Görsel bulunamadı');
    const etag = `"${match[1]}"`;
    const cache = 'public, max-age=31536000, immutable';
    if (req.headers['if-none-match'] === etag) {
      res.status(304).set({ ETag: etag, 'Cache-Control': cache }).end();
      return;
    }
    const asset = await this.prisma.contentAsset.findUnique({
      where: { id: match[1] },
      select: { mime: true, bytes: true },
    });
    if (!asset) throw new NotFoundException('Görsel bulunamadı');
    res
      .status(200)
      .set({
        'Content-Type': asset.mime,
        'Content-Length': String(asset.bytes.length),
        'Cache-Control': cache,
        ETag: etag,
        'X-Content-Type-Options': 'nosniff',
      })
      .end(Buffer.from(asset.bytes));
  }
}

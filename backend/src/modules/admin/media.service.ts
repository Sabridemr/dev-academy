import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { randomUUID } from 'node:crypto';
import type { Env } from '../../config/env';

const ALLOWED = new Map<string, string>([
  ['image/svg+xml', 'svg'],
  ['image/png', 'png'],
  ['image/jpeg', 'jpg'],
  ['image/webp', 'webp'],
  ['application/json', 'json'],
  ['video/mp4', 'mp4'],
]);

/**
 * S3 uyumlu depolama (MinIO / AWS S3) için ön imzalı yükleme URL'leri.
 * Editör tarayıcıdan doğrudan bucket'a yükler; API yalnızca izin üretir.
 */
@Injectable()
export class MediaService {
  private readonly logger = new Logger(MediaService.name);
  private readonly client: S3Client | null;

  constructor(private readonly config: ConfigService<Env, true>) {
    const accessKeyId = config.get('S3_ACCESS_KEY');
    const secretAccessKey = config.get('S3_SECRET_KEY');
    if (!accessKeyId || !secretAccessKey) {
      this.client = null;
      this.logger.warn('S3 kimlik bilgileri yok; medya yükleme devre dışı');
    } else {
      this.client = new S3Client({
        region: config.get('S3_REGION'),
        endpoint: config.get('S3_ENDPOINT') || undefined,
        forcePathStyle: Boolean(config.get('S3_ENDPOINT')),
        credentials: { accessKeyId, secretAccessKey },
      });
    }
  }

  async presignUpload(contentType: string, folder = 'uploads'): Promise<{ uploadUrl: string; publicUrl: string; key: string; expiresIn: number }> {
    if (!this.client) throw new BadRequestException('Medya depolama yapılandırılmamış');
    const ext = ALLOWED.get(contentType);
    if (!ext) throw new BadRequestException(`Desteklenmeyen içerik türü: ${contentType}`);
    const safeFolder = folder.replace(/[^a-z0-9/_-]/gi, '').slice(0, 64) || 'uploads';
    const key = `${safeFolder}/${new Date().toISOString().slice(0, 10)}/${randomUUID()}.${ext}`;
    const bucket = this.config.get('S3_BUCKET');
    const uploadUrl = await getSignedUrl(this.client, new PutObjectCommand({ Bucket: bucket, Key: key, ContentType: contentType }), { expiresIn: 300 });
    const base = this.config.get('S3_PUBLIC_URL') || `${this.config.get('S3_ENDPOINT') ?? ''}/${bucket}`;
    return { uploadUrl, publicUrl: `${base}/${key}`, key, expiresIn: 300 };
  }
}

import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { S3Client } from '@aws-sdk/client-s3';
import { createPresignedPost } from '@aws-sdk/s3-presigned-post';
import { randomUUID } from 'node:crypto';
import type { Env } from '../../config/env';

/**
 * İzin verilen türler ve azami boyutları. SVG bilerek yok: bucket origin'inde açılan bir SVG
 * script çalıştırabilir (stored XSS). Ders diyagramları içerik deposundan gelir ve istemcide temizlenir.
 */
const ALLOWED = new Map<string, { ext: string; maxBytes: number }>([
  ['image/png', { ext: 'png', maxBytes: 5 * 1024 * 1024 }],
  ['image/jpeg', { ext: 'jpg', maxBytes: 5 * 1024 * 1024 }],
  ['image/webp', { ext: 'webp', maxBytes: 5 * 1024 * 1024 }],
  ['application/json', { ext: 'json', maxBytes: 1024 * 1024 }],
  ['video/mp4', { ext: 'mp4', maxBytes: 100 * 1024 * 1024 }],
]);
const EXPIRES_IN = 300;

/**
 * S3 uyumlu depolama (MinIO / AWS S3) için ön imzalı yükleme formu (presigned POST).
 * Editör tarayıcıdan doğrudan bucket'a `multipart/form-data` ile yükler: `fields` aynen eklenir, dosya
 * en sona `file` alanı olarak konur. PUT yerine POST kullanılır çünkü yalnızca POST politikası
 * içerik türünü ve boyut aralığını (content-length-range) depolama tarafında zorlayabilir.
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

  async presignUpload(
    contentType: string,
    folder = 'uploads',
  ): Promise<{
    uploadUrl: string;
    fields: Record<string, string>;
    publicUrl: string;
    key: string;
    maxBytes: number;
    expiresIn: number;
  }> {
    if (!this.client) throw new BadRequestException('Medya depolama yapılandırılmamış');
    const rule = ALLOWED.get(contentType);
    if (!rule) throw new BadRequestException(`Desteklenmeyen içerik türü: ${contentType}`);
    const safeFolder =
      folder
        .replace(/[^a-z0-9/_-]/gi, '')
        .split('/')
        .filter(Boolean)
        .join('/')
        .slice(0, 64) || 'uploads';
    const key = `${safeFolder}/${new Date().toISOString().slice(0, 10)}/${randomUUID()}.${rule.ext}`;
    const bucket = this.config.get('S3_BUCKET');
    const { url, fields } = await createPresignedPost(this.client, {
      Bucket: bucket,
      Key: key,
      Fields: { 'Content-Type': contentType },
      Conditions: [
        ['content-length-range', 1, rule.maxBytes],
        ['eq', '$Content-Type', contentType],
      ],
      Expires: EXPIRES_IN,
    });
    const base =
      this.config.get('S3_PUBLIC_URL') || `${this.config.get('S3_ENDPOINT') ?? ''}/${bucket}`;
    return {
      uploadUrl: url,
      fields,
      publicUrl: `${base}/${key}`,
      key,
      maxBytes: rule.maxBytes,
      expiresIn: EXPIRES_IN,
    };
  }
}

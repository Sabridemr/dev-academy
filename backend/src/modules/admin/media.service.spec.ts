import { BadRequestException } from '@nestjs/common';
import { MediaService } from './media.service';

function createService(env: Record<string, string | undefined> = {}) {
  const values: Record<string, string | undefined> = {
    S3_ACCESS_KEY: 'key',
    S3_SECRET_KEY: 'secret',
    S3_REGION: 'us-east-1',
    S3_ENDPOINT: 'http://localhost:9000',
    S3_BUCKET: 'devacademy',
    S3_PUBLIC_URL: 'https://cdn.example.com',
    ...env,
  };
  return new MediaService({ get: (k: string) => values[k] } as never);
}

const decodePolicy = (fields: Record<string, string>) =>
  JSON.parse(Buffer.from(fields.Policy, 'base64').toString('utf8')) as {
    conditions: unknown[];
  };

describe('MediaService', () => {
  it('SVG yüklemesini reddeder (stored XSS)', async () => {
    await expect(createService().presignUpload('image/svg+xml')).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('depolama yapılandırılmamışsa reddeder', async () => {
    await expect(
      createService({ S3_ACCESS_KEY: undefined }).presignUpload('image/png'),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('boyut ve içerik türünü politikada zorlayan presigned POST üretir', async () => {
    const res = await createService().presignUpload('image/png', '../avatars');
    expect(res.key).toMatch(/^avatars\/\d{4}-\d{2}-\d{2}\/[0-9a-f-]{36}\.png$/);
    expect(res.publicUrl).toBe(`https://cdn.example.com/${res.key}`);
    expect(res.fields['Content-Type']).toBe('image/png');
    expect(res.maxBytes).toBe(5 * 1024 * 1024);
    const { conditions } = decodePolicy(res.fields);
    expect(conditions).toContainEqual(['content-length-range', 1, res.maxBytes]);
    expect(conditions).toContainEqual(['eq', '$Content-Type', 'image/png']);
  });
});

import { cache } from 'react';
import type { CertificateDto } from '@devacademy/shared';
import { ApiError, serverApi } from '@/lib/api';

/** Herkese açık sertifika (anonim uç). 404 → null; diğer hatalar yukarı fırlatılır. */
export const getPublicCertificate = cache(
  async (publicId: string): Promise<CertificateDto | null> => {
    if (!/^[A-Za-z0-9_-]{6,128}$/.test(publicId)) return null;
    try {
      return await serverApi<CertificateDto>(
        `/certificates/public/${encodeURIComponent(publicId)}`,
        300,
      );
    } catch (err) {
      if (err instanceof ApiError && (err.status === 404 || err.status === 400)) return null;
      throw err;
    }
  },
);

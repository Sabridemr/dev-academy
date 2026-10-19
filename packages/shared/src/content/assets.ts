/**
 * Ders görselleri (raster). Ders klasöründeki png/jpg/webp dosyaları seed sırasında veritabanına
 * alınır ve API'den `GET <API_URL>/assets/<sha256>.<ext>` ile sunulur; dosya içeriği değişmedikçe
 * adres de değişmez (sonsuza dek önbelleklenebilir).
 */
export const RASTER_IMAGE_TYPES = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  webp: 'image/webp',
} as const;

export type RasterExtension = keyof typeof RASTER_IMAGE_TYPES;

/** Ders içi görsel yolunun öneki (API taban adresine göre) */
export const CONTENT_ASSET_PREFIX = '/assets/';

export function rasterExtension(file: string): RasterExtension | null {
  const ext = file.split('.').pop()?.toLowerCase();
  return ext && ext in RASTER_IMAGE_TYPES ? (ext as RasterExtension) : null;
}

/** Blok src'sini istemcinin yükleyebileceği tam adrese çevirir (API yolu → API tabanı + yol) */
export function resolveAssetUrl(src: string, apiBaseUrl: string): string {
  return src.startsWith(CONTENT_ASSET_PREFIX) ? `${apiBaseUrl.replace(/\/$/, '')}${src}` : src;
}

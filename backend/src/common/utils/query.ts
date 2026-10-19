/**
 * Sorgu dizesindeki tamsayıyı [min, max] aralığına sıkıştırır; eksik ya da geçersizse varsayılan döner.
 * Negatif `limit`/`page` Prisma'ya negatif take/skip olarak gidip 500 üretmesin.
 */
export function clampInt(
  raw: string | undefined,
  fallback: number,
  min: number,
  max: number,
): number {
  const n = Number.parseInt(raw ?? '', 10);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

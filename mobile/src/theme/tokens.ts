/**
 * TASARIM TOKEN'LARI
 * ------------------
 * web/src/app/globals.css içindeki --da-* değişkenlerinin birebir karşılığı.
 * Diyagram SVG'leri ve sahne çizimleri bu anahtarları kullanır (bkz. utils/svgTheme.ts).
 */
export interface ThemeColors {
  bg: string;
  fg: string;
  muted: string;
  surface: string;
  elevated: string;
  border: string;
  primary: string;
  accent: string;
  success: string;
  warning: string;
  danger: string;
  /** Birincil buton üzerindeki metin */
  onPrimary: string;
}

export type ColorKey = keyof ThemeColors;

export const lightColors: ThemeColors = {
  bg: '#F8FAFC', // 248 250 252
  fg: '#0F172A', // 15 23 42
  muted: '#64748B', // 100 116 139
  surface: '#FFFFFF',
  elevated: '#F1F5F9', // 241 245 249
  border: '#E2E8F0', // 226 232 240
  primary: '#6366F1', // 99 102 241
  accent: '#F59E0B', // 245 158 11
  success: '#10B981', // 16 185 129
  warning: '#EAB308', // 234 179 8
  danger: '#EF4444', // 239 68 68
  onPrimary: '#FFFFFF',
};

export const darkColors: ThemeColors = {
  bg: '#0B0F19', // 11 15 25
  fg: '#E2E8F0', // 226 232 240
  muted: '#94A3B8', // 148 163 184
  surface: '#111827', // 17 24 39
  elevated: '#1E293B', // 30 41 59
  border: '#334155', // 51 65 85
  primary: '#818CF8', // 129 140 248
  accent: '#FBBF24', // 251 191 36
  success: '#34D399', // 52 211 153
  warning: '#FACC15', // 250 204 21
  danger: '#F87171', // 248 113 113
  onPrimary: '#0B0F19',
};

export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 } as const;
export const radius = { sm: 8, md: 12, lg: 16, pill: 999 } as const;
export const fontSize = { xs: 12, sm: 14, md: 16, lg: 18, xl: 22, xxl: 28 } as const;

/* ------------------------------ Renk yardımcıları ------------------------------ */

function parseHex(hex: string): [number, number, number] | null {
  const m = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return null;
  let h = m[1];
  if (h.length === 3)
    h = h
      .split('')
      .map((c) => c + c)
      .join('');
  const n = parseInt(h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function toHex(r: number, g: number, b: number): string {
  return `#${[r, g, b]
    .map((v) =>
      Math.round(Math.max(0, Math.min(255, v)))
        .toString(16)
        .padStart(2, '0'),
    )
    .join('')}`.toUpperCase();
}

/**
 * CSS color-mix(in srgb, a p%, b) karşılığı — RN SVG color-mix desteklemez.
 * @param weight a renginin oranı (0..1)
 */
export function mixColors(a: string, b: string, weight: number): string {
  const ca = parseHex(a);
  const cb = parseHex(b);
  if (!ca || !cb) return a;
  return toHex(
    ca[0] * weight + cb[0] * (1 - weight),
    ca[1] * weight + cb[1] * (1 - weight),
    ca[2] * weight + cb[2] * (1 - weight),
  );
}

/** Hex rengine alfa ekler (#RRGGBBAA) */
export function withAlpha(hex: string, alpha: number): string {
  const c = parseHex(hex);
  if (!c) return hex;
  return `${toHex(c[0], c[1], c[2])}${Math.round(Math.max(0, Math.min(1, alpha)) * 255)
    .toString(16)
    .padStart(2, '0')
    .toUpperCase()}`;
}

/**
 * Sahne/modül renk değeri çözümü (web themeColor karşılığı):
 * "#hex" / "rgb(...)" olduğu gibi, "primary" gibi anahtarlar tema renginden, var(--da-x) de çözülür.
 */
export function resolveThemeColor(
  value: string | undefined,
  colors: ThemeColors,
  fallback: string = colors.primary,
): string {
  if (!value) return fallback;
  if (value.startsWith('#') || value.startsWith('rgb')) return value;
  const varMatch = /^var\(--da-([a-z]+)(?:\s*,\s*([^)]+))?\)$/.exec(value.trim());
  if (varMatch) {
    const key = varMatch[1] as ColorKey;
    return colors[key] ?? varMatch[2]?.trim() ?? fallback;
  }
  return (colors as unknown as Record<string, string>)[value] ?? fallback;
}

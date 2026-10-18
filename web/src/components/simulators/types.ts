/**
 * Tüm interaktif simülatörlerin ortak sözleşmesi.
 * Bir simülatör yalnızca bu prop'ları alır; parametreler ders Markdown'ındaki
 * :::interactive{type="..." key=value} özniteliklerinden gelir.
 */
export interface SimulatorProps {
  /** Ders içeriğinden gelen başlangıç parametreleri (tipsiz; bileşen kendi doğrular, varsayılanlara düşer) */
  params: Record<string, unknown>;
  lessonId?: string;
  /** Kullanıcı simülatörle ilk kez etkileşime girdiğinde çağrılır (rozet takibi) */
  onInteract: () => void;
}

/** params içinden güvenli okuma yardımcıları */
export function numParam(
  params: Record<string, unknown>,
  key: string,
  fallback: number,
  min = -Infinity,
  max = Infinity,
): number {
  const v = params[key];
  const n = typeof v === 'number' ? v : typeof v === 'string' ? Number(v) : NaN;
  return Number.isFinite(n) ? Math.max(min, Math.min(max, n)) : fallback;
}

export function strParam<T extends string>(
  params: Record<string, unknown>,
  key: string,
  fallback: T,
  allowed?: readonly T[],
): T {
  const v = params[key];
  if (typeof v !== 'string') return fallback;
  if (allowed && !allowed.includes(v as T)) return fallback;
  return v as T;
}

export function boolParam(
  params: Record<string, unknown>,
  key: string,
  fallback: boolean,
): boolean {
  const v = params[key];
  if (typeof v === 'boolean') return v;
  if (v === 'true') return true;
  if (v === 'false') return false;
  return fallback;
}

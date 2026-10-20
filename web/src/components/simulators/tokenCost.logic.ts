/**
 * Token maliyeti hesabı. Fiyatlar TEMSİLİ örnek değerlerdir (1M token başına USD); hiçbir gerçek
 * sağlayıcıyı yansıtmaz. Önbellekten okunan girdi token'ı normal fiyatın %10'u sayılır.
 */

export const COST_MODELS = ['small', 'mid', 'large'] as const;
export type CostModel = (typeof COST_MODELS)[number];

export interface ModelPrice {
  /** 1M girdi token başına USD */
  input: number;
  /** 1M çıktı token başına USD */
  output: number;
  /** 1M önbellekten okunan girdi token başına USD */
  cachedInput: number;
  /** Bağlam penceresi (token) */
  context: number;
}

export const PRICES: Record<CostModel, ModelPrice> = {
  small: { input: 0.2, output: 0.8, cachedInput: 0.02, context: 32_000 },
  mid: { input: 3, output: 15, cachedInput: 0.3, context: 128_000 },
  large: { input: 15, output: 75, cachedInput: 1.5, context: 200_000 },
};

export const DAYS_PER_MONTH = 30;

export interface Usage {
  inputTokens: number;
  outputTokens: number;
  requestsPerDay: number;
}

/** Tek istek maliyeti. cachedShare: girdinin önbellekten okunan oranı (0–1) */
export function requestCost(
  model: CostModel,
  inputTokens: number,
  outputTokens: number,
  cachedShare = 0,
): number {
  const p = PRICES[model];
  const c = Math.max(0, Math.min(1, cachedShare));
  const input = inputTokens * ((1 - c) * p.input + c * p.cachedInput);
  return (input + outputTokens * p.output) / 1_000_000;
}

export function dailyCost(model: CostModel, u: Usage, cachedShare = 0): number {
  return requestCost(model, u.inputTokens, u.outputTokens, cachedShare) * u.requestsPerDay;
}

export interface ScenarioOptions {
  /** Girdinin sabit (önbelleğe alınabilir) önek oranı, 0–1 */
  cacheablePrefix: number;
  /** Önbellek isabet oranı, 0–1 */
  cacheHitRate: number;
  /** Küçük modele yönlendirilen isteklerin oranı, 0–1 */
  routedShare: number;
}

export type ScenarioId = 'baseline' | 'cache' | 'routing' | 'both';

export interface Scenario {
  id: ScenarioId;
  daily: number;
  monthly: number;
  /** Taban senaryoya göre tasarruf oranı (0–1) */
  savings: number;
}

/** Taban, önbellek, yönlendirme ve ikisi birlikte senaryolarının maliyetleri */
export function scenarios(model: CostModel, u: Usage, o: ScenarioOptions): Scenario[] {
  const cached = o.cacheablePrefix * o.cacheHitRate;
  const routed = model === 'small' ? 0 : Math.max(0, Math.min(1, o.routedShare));
  const mix = (share: number) =>
    dailyCost(model, u, share) * (1 - routed) + dailyCost('small', u, share) * routed;
  const raw: [ScenarioId, number][] = [
    ['baseline', dailyCost(model, u)],
    ['cache', dailyCost(model, u, cached)],
    ['routing', mix(0)],
    ['both', mix(cached)],
  ];
  const base = raw[0][1];
  return raw.map(([id, daily]) => ({
    id,
    daily,
    monthly: daily * DAYS_PER_MONTH,
    savings: base > 0 ? 1 - daily / base : 0,
  }));
}

/** Bağlam penceresi doluluğu (girdi + çıktı) / pencere; 1'i aşabilir */
export function contextFill(model: CostModel, inputTokens: number, outputTokens: number): number {
  return (inputTokens + outputTokens) / PRICES[model].context;
}

export function formatUsd(v: number, locale: string): string {
  const digits = v < 1 ? 4 : v < 100 ? 2 : 0;
  return new Intl.NumberFormat(locale === 'tr' ? 'tr-TR' : 'en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: digits,
    minimumFractionDigits: Math.min(digits, 2),
  }).format(v);
}

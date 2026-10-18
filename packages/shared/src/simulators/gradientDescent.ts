/**
 * GRADIENT DESCENT SİMÜLATÖRÜ (saf mantık)
 * ----------------------------------------
 * Tek değişkenli lineer regresyon (y = w·x + b) için MSE kaybı ve gradyan adımı.
 * Ayrıca 2B loss yüzeyi örnekleme fonksiyonu (web'de ısı haritası / kontur, mobilde grid).
 */

export interface DataPoint {
  x: number;
  y: number;
}

export interface RegressionParams {
  w: number;
  b: number;
}

export interface GdStep {
  iteration: number;
  params: RegressionParams;
  loss: number;
  gradW: number;
  gradB: number;
}

/** Deterministik rastgele sayı üreteci (mulberry32) — testler ve iki platformda aynı veri için */
export function seededRandom(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let x = a;
    x = Math.imul(x ^ (x >>> 15), x | 1);
    x ^= x + Math.imul(x ^ (x >>> 7), x | 61);
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
}

export function generateLinearData(count = 30, trueW = 2, trueB = 1, noise = 1, seed = 42): DataPoint[] {
  const rnd = seededRandom(seed);
  return Array.from({ length: count }, () => {
    const x = rnd() * 10 - 5;
    const gauss = (rnd() + rnd() + rnd() - 1.5) * 2; // yaklaşık normal
    return { x, y: trueW * x + trueB + gauss * noise };
  });
}

export function mseLoss(data: DataPoint[], p: RegressionParams): number {
  if (data.length === 0) return 0;
  let sum = 0;
  for (const d of data) {
    const err = p.w * d.x + p.b - d.y;
    sum += err * err;
  }
  return sum / data.length;
}

export function gradients(data: DataPoint[], p: RegressionParams): { gradW: number; gradB: number } {
  let gw = 0;
  let gb = 0;
  for (const d of data) {
    const err = p.w * d.x + p.b - d.y;
    gw += 2 * err * d.x;
    gb += 2 * err;
  }
  const n = data.length || 1;
  return { gradW: gw / n, gradB: gb / n };
}

export function gradientStep(data: DataPoint[], p: RegressionParams, learningRate: number, iteration: number): GdStep {
  const { gradW, gradB } = gradients(data, p);
  const params = { w: p.w - learningRate * gradW, b: p.b - learningRate * gradB };
  return { iteration: iteration + 1, params, loss: mseLoss(data, params), gradW, gradB };
}

export function runGradientDescent(data: DataPoint[], start: RegressionParams, learningRate: number, iterations: number): GdStep[] {
  const steps: GdStep[] = [{ iteration: 0, params: start, loss: mseLoss(data, start), gradW: 0, gradB: 0 }];
  let p = start;
  for (let i = 0; i < iterations; i++) {
    const s = gradientStep(data, p, learningRate, i);
    steps.push(s);
    p = s.params;
    if (!Number.isFinite(s.loss) || s.loss > 1e9) break; // ıraksama
  }
  return steps;
}

/** Loss yüzeyini w×b ızgarasında örnekler (ısı haritası için) */
export function sampleLossSurface(
  data: DataPoint[],
  wRange: [number, number],
  bRange: [number, number],
  resolution = 40,
): { w: number[]; b: number[]; loss: number[][]; min: number; max: number } {
  const w = Array.from({ length: resolution }, (_, i) => wRange[0] + ((wRange[1] - wRange[0]) * i) / (resolution - 1));
  const b = Array.from({ length: resolution }, (_, i) => bRange[0] + ((bRange[1] - bRange[0]) * i) / (resolution - 1));
  let min = Number.POSITIVE_INFINITY;
  let max = 0;
  const loss = b.map((bv) =>
    w.map((wv) => {
      const l = mseLoss(data, { w: wv, b: bv });
      if (l < min) min = l;
      if (l > max) max = l;
      return l;
    }),
  );
  return { w, b, loss, min, max };
}

/** Kapalı form çözüm (OLS) — "hedef" göstermek için */
export function closedFormSolution(data: DataPoint[]): RegressionParams {
  const n = data.length;
  if (n === 0) return { w: 0, b: 0 };
  const mx = data.reduce((a, d) => a + d.x, 0) / n;
  const my = data.reduce((a, d) => a + d.y, 0) / n;
  let num = 0;
  let den = 0;
  for (const d of data) {
    num += (d.x - mx) * (d.y - my);
    den += (d.x - mx) * (d.x - mx);
  }
  const w = den === 0 ? 0 : num / den;
  return { w, b: my - w * mx };
}

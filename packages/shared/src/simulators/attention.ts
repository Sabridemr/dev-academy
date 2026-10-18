/**
 * SELF-ATTENTION GÖRSELLEŞTİRİCİ (saf mantık)
 * -------------------------------------------
 * Küçük boyutlu Q/K/V matrisleriyle scaled dot-product attention hesaplar.
 * Token gömmeleri deterministik üretilir (kelime → sabit vektör) ki her platformda aynı ısı haritası çıksın.
 */

import { seededRandom } from './gradientDescent';
import { hashString } from './loadBalancer';

export interface AttentionResult {
  tokens: string[];
  scores: number[][]; // QKᵀ / sqrt(d)
  weights: number[][]; // softmax(scores)
  output: number[][]; // weights · V
  dim: number;
}

export function tokenize(text: string): string[] {
  return text.trim().split(/\s+/).filter(Boolean).slice(0, 12);
}

/** Kelimeden deterministik gömme üretir */
export function embedToken(token: string, dim: number): number[] {
  const rnd = seededRandom(hashString(token.toLowerCase()));
  return Array.from({ length: dim }, () => rnd() * 2 - 1);
}

export function softmax(row: number[]): number[] {
  const max = Math.max(...row);
  const exps = row.map((v) => Math.exp(v - max));
  const sum = exps.reduce((a, b) => a + b, 0) || 1;
  return exps.map((e) => e / sum);
}

function matVec(matrix: number[][], vec: number[]): number[] {
  return matrix.map((row) => row.reduce((a, v, i) => a + v * (vec[i] ?? 0), 0));
}

function makeProjection(seed: number, dim: number): number[][] {
  const rnd = seededRandom(seed);
  return Array.from({ length: dim }, () =>
    Array.from({ length: dim }, () => (rnd() * 2 - 1) * 0.8),
  );
}

/**
 * Self-attention: her token için Q, K, V; weights = softmax(QKᵀ/√d); output = weights·V.
 * `temperature` ile dikkat dağılımının keskinliği değiştirilebilir (eğitim amaçlı).
 */
export function computeSelfAttention(
  text: string,
  dim = 8,
  temperature = 1,
  causal = false,
): AttentionResult {
  const tokens = tokenize(text);
  const embeddings = tokens.map((tk) => embedToken(tk, dim));
  const Wq = makeProjection(11, dim);
  const Wk = makeProjection(22, dim);
  const Wv = makeProjection(33, dim);
  const Q = embeddings.map((e) => matVec(Wq, e));
  const K = embeddings.map((e) => matVec(Wk, e));
  const V = embeddings.map((e) => matVec(Wv, e));
  const scale = Math.sqrt(dim) * Math.max(0.05, temperature);

  const scores = Q.map((q, i) =>
    K.map((k, j) => {
      if (causal && j > i) return Number.NEGATIVE_INFINITY;
      return q.reduce((a, v, d) => a + v * k[d], 0) / scale;
    }),
  );
  const weights = scores.map((row) => softmax(row.map((v) => (Number.isFinite(v) ? v : -1e9))));
  const output = weights.map((row) => {
    const out = new Array(dim).fill(0);
    row.forEach((w, j) => {
      for (let d = 0; d < dim; d++) out[d] += w * V[j][d];
    });
    return out;
  });
  return { tokens, scores, weights, output, dim };
}

/** Bir satırda en çok dikkat edilen k token */
export function topAttended(
  result: AttentionResult,
  rowIndex: number,
  k = 3,
): { token: string; weight: number; index: number }[] {
  const row = result.weights[rowIndex] ?? [];
  return row
    .map((weight, index) => ({ token: result.tokens[index], weight, index }))
    .sort((a, b) => b.weight - a.weight)
    .slice(0, k);
}

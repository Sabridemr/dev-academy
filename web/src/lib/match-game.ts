import type { ConceptSummary, Locale } from '@devacademy/shared';
import { conceptDefinition, conceptTerms } from '@/components/glossary/concept-text';
import { shortDefinition } from '@/lib/term-text';

/**
 * KELİME EŞLEŞTİRME OYUNU — saf mantık (UI'dan bağımsız, test edilebilir).
 * Mobil uygulamadaki (mobile/src/lib/matchGame.ts) kurallarla aynıdır.
 */

export const ROUND_SIZE = 6;
export const MIN_PAIRS = 3;
export const POINTS_CORRECT = 10;
export const POINTS_COMBO = 2; // ardışık doğru başına ek puan
export const POINTS_COMBO_MAX = 6;
export const POINTS_WRONG = 3;

export interface MatchPair {
  id: string;
  term: string;
  definition: string;
}

export interface MatchRound {
  pairs: MatchPair[];
  /** Sağ sütunun (tanımlar) gösterim sırası: pairs indeksleri */
  definitionOrder: number[];
}

export type Rng = () => number;

/** Fisher–Yates; rng enjekte edilebilir (testlerde deterministik) */
export function shuffle<T>(items: readonly T[], rng: Rng = Math.random): T[] {
  const a = [...items];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j]!, a[i]!];
  }
  return a;
}

/**
 * Tur oluşturur. `preferredIds` (dersin kavramları) önceliklidir; sayı azsa kalan boşluk
 * sözlükteki rastgele kavramlarla doldurulur. Aynı terim/tanım tekrar edilmez.
 */
export function buildRound(
  all: readonly ConceptSummary[],
  preferredIds: readonly string[],
  locale: Locale,
  rng: Rng = Math.random,
  size = ROUND_SIZE,
): MatchRound | null {
  const byId = new Map(all.map((c) => [c.id, c]));
  const preferred = shuffle(
    [...new Set(preferredIds)].flatMap((id) => {
      const c = byId.get(id);
      return c ? [c] : [];
    }),
    rng,
  );
  const chosen = preferred.slice(0, size);
  if (chosen.length < size) {
    const taken = new Set(chosen.map((c) => c.id));
    const filler = shuffle(
      all.filter((c) => !taken.has(c.id)),
      rng,
    );
    chosen.push(...filler.slice(0, size - chosen.length));
  }

  const seen = new Set<string>();
  const pairs: MatchPair[] = [];
  for (const c of chosen) {
    const term = conceptTerms(c.term, locale).primary;
    const definition = shortDefinition(conceptDefinition(c.definition, locale));
    if (seen.has(term) || seen.has(definition)) continue;
    seen.add(term);
    seen.add(definition);
    pairs.push({ id: c.id, term, definition });
  }
  if (pairs.length < MIN_PAIRS) return null;

  // Sağ sütun karışık; sıralı (kimlik) dizilim çıkarsa kaydır
  let order = shuffle(
    pairs.map((_, i) => i),
    rng,
  );
  if (order.every((v, i) => v === i)) order = [...order.slice(1), order[0]!];
  return { pairs, definitionOrder: order };
}

export interface ScoreState {
  score: number;
  streak: number;
  mistakes: number;
}

export const INITIAL_SCORE: ScoreState = { score: 0, streak: 0, mistakes: 0 };

/** Doğru: 10 + seri bonusu (2'şer, en çok +6). Yanlış: -3 (0'ın altına inmez), seri sıfırlanır. */
export function applyAnswer(state: ScoreState, correct: boolean): ScoreState {
  if (correct) {
    const bonus = Math.min(state.streak * POINTS_COMBO, POINTS_COMBO_MAX);
    return {
      score: state.score + POINTS_CORRECT + bonus,
      streak: state.streak + 1,
      mistakes: state.mistakes,
    };
  }
  return {
    score: Math.max(0, state.score - POINTS_WRONG),
    streak: 0,
    mistakes: state.mistakes + 1,
  };
}

/** Hatasız oynanışta alınabilecek en yüksek puan */
export function maxScore(pairCount: number): number {
  let s = INITIAL_SCORE;
  for (let i = 0; i < pairCount; i++) s = applyAnswer(s, true);
  return s.score;
}

/** 0–3 yıldız: hatasız 3, 1 hata 2, en çok yarısı kadar hata 1, aksi 0 */
export function stars(mistakes: number, pairCount: number): 0 | 1 | 2 | 3 {
  if (mistakes === 0) return 3;
  if (mistakes <= 1) return 2;
  if (mistakes <= Math.floor(pairCount / 2)) return 1;
  return 0;
}

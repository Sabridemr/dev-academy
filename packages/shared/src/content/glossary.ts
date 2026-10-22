import { z } from 'zod';
import { SLUG_REGEX } from './schema';

/**
 * KAVRAM SÖZLÜĞÜ
 * --------------
 * content/concepts.json: kavram id → terim, kısa tanım, eş adlar ve ilgili kavramlar.
 * Derslerin frontmatter'ındaki ve quiz sorularındaki `concepts` değerleri bu sözlükteki
 * anahtarlara işaret eder (doğrulayıcı eksik kavramı hata sayar).
 */

export const ConceptEntrySchema = z
  .object({
    /** Gösterilen terim; Türkçe ve İngilizce zorunlu */
    term: z.object({ tr: z.string().min(1), en: z.string().min(1) }).strict(),
    /** 1-3 cümlelik tanım; İngilizcesi opsiyonel */
    definition: z.object({ tr: z.string().min(1), en: z.string().min(1).optional() }).strict(),
    /** Kısaltmalar ve eş anlamlılar (aramada kullanılır) */
    aliases: z.array(z.string().min(1)).default([]),
    /** İlgili kavram id'leri (sözlükte var olmalı) */
    related: z.array(z.string().regex(SLUG_REGEX)).default([]),
  })
  .strict();
export type ConceptEntry = z.infer<typeof ConceptEntrySchema>;

export const GlossarySchema = z.record(
  z.string().regex(SLUG_REGEX, 'kavram id kebab-case olmalı'),
  ConceptEntrySchema,
);
export type Glossary = z.infer<typeof GlossarySchema>;

/** Bir kavramın içerikte nerede geçtiği */
export interface ConceptUsage {
  /** Kavramın frontmatter'ında ya da quiz sorusunda geçtiği ders id'leri (ilk görülme sırası) */
  lessons: string[];
  /** Kavramı taşıyan quiz sorusu sayısı */
  questionCount: number;
}

export interface ConceptIndexLesson {
  id: string;
  concepts: readonly string[];
}

export interface ConceptIndexQuiz {
  lessonId: string;
  questions: readonly { concepts: readonly string[] }[];
}

/**
 * Kavram → ders eşlemesi. Saf fonksiyon: seed, doğrulayıcı ve testler aynı sonucu üretir.
 * Quiz'de geçen ama frontmatter'da olmayan kavram da o derse bağlanır.
 */
export function buildConceptIndex(
  lessons: readonly ConceptIndexLesson[],
  quizzes: readonly ConceptIndexQuiz[] = [],
): Map<string, ConceptUsage> {
  const index = new Map<string, ConceptUsage>();
  const entry = (id: string) => {
    let usage = index.get(id);
    if (!usage) {
      usage = { lessons: [], questionCount: 0 };
      index.set(id, usage);
    }
    return usage;
  };
  const addLesson = (usage: ConceptUsage, lessonId: string) => {
    if (!usage.lessons.includes(lessonId)) usage.lessons.push(lessonId);
  };
  for (const lesson of lessons) {
    for (const c of lesson.concepts) addLesson(entry(c), lesson.id);
  }
  for (const quiz of quizzes) {
    for (const q of quiz.questions) {
      for (const c of new Set(q.concepts)) {
        const usage = entry(c);
        usage.questionCount += 1;
        addLesson(usage, quiz.lessonId);
      }
    }
  }
  return index;
}

/** Aramada Türkçe karakter ve büyük/küçük harf farkını yok sayan normalleştirme */
export function normalizeConceptQuery(value: string): string {
  return value
    .toLocaleLowerCase('tr')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/ı/g, 'i')
    .replace(/[-_]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export interface SearchableConcept {
  id: string;
  term: { tr: string; en: string };
  aliases: readonly string[];
  definition?: { tr: string; en?: string };
}

/**
 * Kavram arama puanı (0 = eşleşmedi). Terim/eş ad/id eşleşmesi tanımdakinden önce gelir.
 * Web, mobil ve backend aynı sıralamayı kullanır.
 */
export function conceptSearchScore(concept: SearchableConcept, query: string): number {
  const q = normalizeConceptQuery(query);
  if (!q) return 1;
  const names = [concept.id, concept.term.tr, concept.term.en, ...concept.aliases].map(
    normalizeConceptQuery,
  );
  if (names.some((n) => n === q)) return 4;
  if (names.some((n) => n.startsWith(q))) return 3;
  if (names.some((n) => n.includes(q))) return 2;
  const def = concept.definition
    ? normalizeConceptQuery(`${concept.definition.tr} ${concept.definition.en ?? ''}`)
    : '';
  return def.includes(q) ? 1 : 0;
}

/** Sorguya uyan kavramları puana, eşitlikte terime göre sıralar */
export function searchConcepts<T extends SearchableConcept>(
  concepts: readonly T[],
  query: string,
  locale: 'tr' | 'en' = 'tr',
): T[] {
  return concepts
    .map((c) => ({ c, score: conceptSearchScore(c, query) }))
    .filter((x) => x.score > 0)
    .sort(
      (a, b) =>
        b.score - a.score || a.c.term[locale].localeCompare(b.c.term[locale], locale),
    )
    .map((x) => x.c);
}

/**
 * Alfabetik gruplama için baş harf; rakam ve sembol '#'.
 * Türkçede Ç, Ğ, İ, Ö, Ş, Ü ayrı harftir; İngilizcede aksanlar atılır.
 */
export function conceptInitial(term: string, locale: 'tr' | 'en' = 'tr'): string {
  let first = term.trim().charAt(0).toLocaleUpperCase(locale);
  if (locale === 'en') first = first.normalize('NFD').charAt(0);
  if (/[A-Z]/.test(first) || (locale === 'tr' && /[ÇĞİÖŞÜ]/.test(first))) return first;
  return '#';
}

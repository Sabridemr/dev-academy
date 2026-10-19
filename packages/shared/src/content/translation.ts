import type { LessonBlock } from './schema';

/** Ders gövdesi Markdown'ı taşıyan blok türleri (İngilizcesi `markdownEn`) */
const PROSE_BLOCKS = new Set<LessonBlock['type']>(['text', 'realworld', 'callout']);

/**
 * Dersin gövde metni İngilizceye çevrilmiş mi (tüm metin bloklarında `markdownEn` var mı).
 * İçerik raporu ve istemcilerdeki "henüz İngilizce değil" notu aynı kuralı kullanır.
 */
export function isLessonBodyTranslated(blocks: readonly LessonBlock[]): boolean {
  const prose = blocks.filter((b) => PROSE_BLOCKS.has(b.type));
  return (
    prose.length > 0 && prose.every((b) => Boolean((b as { markdownEn?: string }).markdownEn))
  );
}

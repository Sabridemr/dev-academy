import type { LessonBlock } from './schema';

/**
 * Dersin full-text arama metni (Lesson.searchText). Seed ve admin yayınlama AYNI fonksiyonu kullanır;
 * aksi halde bir ders admin'den yeniden yayınlanınca arama sonuçları değişirdi.
 */
export function buildSearchText(
  blocks: LessonBlock[],
  title: unknown,
  summary: unknown,
  concepts: string[],
  tags: string[] = [],
): string {
  const loc = (v: unknown) =>
    typeof v === 'string'
      ? v
      : v && typeof v === 'object'
        ? Object.values(v as Record<string, string>).join(' ')
        : '';
  const body = blocks
    .map((b) => {
      switch (b.type) {
        case 'text':
        case 'realworld':
        case 'callout':
          return `${b.markdown} ${b.markdownEn ?? ''}`;
        case 'code':
          return loc(b.title);
        case 'diagram':
          return `${loc(b.alt)} ${loc(b.caption)}`;
        case 'trace':
          return `${loc(b.title)} ${loc(b.caption)} ${b.trace?.code ?? ''}`;
        case 'exercise':
          // Çözüm aranabilir metne girmez (arama özeti istemciye döner)
          return `${loc(b.exercise?.title)} ${loc(b.exercise?.prompt)} ${loc(b.instructions)}`;
        case 'interactive':
          return `${b.interactive} ${loc(b.title)} ${loc(b.instructions)}`;
        // Tahmin sorusu ders konusunu anlatır; kaynakça (dış başlıklar) aramayı kirletmesin diye dahil edilmez
        case 'predict':
          return loc(b.prompt);
        case 'resources':
          return '';
        default:
          return '';
      }
    })
    .join('\n');
  const clean = (s: string) =>
    s
      .replace(/[#*_`>|]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  // Gövde başta: arama sonucu özeti (ts_headline) metnin başından üretilir; başlık/etiket listesi
  // yerine ders içeriğinden bir pasaj görünsün. Başlık, özet, kavram ve etiketler yine aranabilir.
  const meta = clean(`${loc(title)} ${loc(summary)} ${concepts.join(' ')} ${tags.join(' ')}`);
  return `${clean(body).slice(0, 200_000 - meta.length - 1)} ${meta}`.trim();
}

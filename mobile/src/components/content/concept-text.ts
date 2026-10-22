import type { ConceptSummary, Locale } from '@devacademy/shared';

/** Gösterilecek terim (seçili dilde) ve farklıysa diğer dildeki karşılığı */
export function conceptTerms(
  term: ConceptSummary['term'],
  locale: Locale,
): { primary: string; secondary: string | null } {
  const primary = locale === 'en' ? term.en : term.tr;
  const secondary = locale === 'en' ? term.tr : term.en;
  return { primary, secondary: secondary === primary ? null : secondary };
}

/** Tanımın İngilizcesi opsiyoneldir; yoksa Türkçesi gösterilir */
export function conceptDefinition(
  definition: ConceptSummary['definition'],
  locale: Locale,
): string {
  return (locale === 'en' ? definition.en : undefined) ?? definition.tr;
}

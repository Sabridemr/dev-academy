'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import { useI18n } from '@/i18n';
import { useConcepts } from '@/lib/hooks';
import { conceptTerms } from './concept-text';

/**
 * Ders başlığının altında "Bu dersteki kavramlar" çipleri; her çip sözlükteki detay sayfasına gider.
 * Terimler sözlük listesinden çözülür; sözlük yüklenmemişse kavram id'si gösterilir.
 */
export function LessonConcepts({ concepts }: { concepts: string[] }) {
  const { t, locale } = useI18n();
  const { data } = useConcepts();
  const terms = useMemo(() => new Map((data ?? []).map((c) => [c.id, c.term])), [data]);
  if (concepts.length === 0) return null;
  return (
    <div className="mt-4">
      <h2 className="t-mono-label mb-2 text-muted">{t('glossary.lessonConcepts')}</h2>
      <ul className="flex flex-wrap gap-1.5">
        {concepts.map((id) => {
          const term = terms.get(id);
          return (
            <li key={id}>
              <Link
                href={`/glossary/${id}`}
                className="chip text-xs hover:border-primary/60 hover:text-fg"
              >
                {term ? conceptTerms(term, locale).primary : id}
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

'use client';

import Link from 'next/link';
import { BookOpen, ChevronLeft, ListChecks } from 'lucide-react';
import type { ConceptDetail } from '@devacademy/shared';
import { useI18n } from '@/i18n';
import { useConcept } from '@/lib/hooks';
import { conceptDefinition, conceptTerms } from './concept-text';

/** Kavram detayı: tanım, diğer adlar, geçtiği dersler ve ilgili kavramlar */
export function ConceptView({ initial }: { initial: ConceptDetail }) {
  const { t, tl, locale } = useI18n();
  const { data } = useConcept(initial.id, initial);
  const concept = data ?? initial;
  const { primary, secondary } = conceptTerms(concept.term, locale);

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <Link
        href="/glossary"
        className="mb-6 inline-flex items-center gap-1 text-sm text-muted hover:text-fg"
      >
        <ChevronLeft size={16} /> {t('glossary.back')}
      </Link>
      <header className="mb-8">
        <h1 className="t-h1">{primary}</h1>
        {secondary && <p className="mt-1 text-muted">{secondary}</p>}
        <p className="mt-4 max-w-prose text-lg">{conceptDefinition(concept.definition, locale)}</p>
        {concept.aliases.length > 0 && (
          <p className="mt-3 text-sm text-muted">
            <span className="font-medium">{t('glossary.aliases')}:</span>{' '}
            {concept.aliases.join(', ')}
          </p>
        )}
      </header>

      <section aria-labelledby="concept-lessons" className="mb-8">
        <h2 id="concept-lessons" className="t-h2 mb-3">
          {t('glossary.lessonsTitle')}
        </h2>
        {concept.lessons.length === 0 ? (
          <p className="text-sm text-muted">{t('glossary.noLessons')}</p>
        ) : (
          <ul className="space-y-2">
            {concept.lessons.map((l) => (
              <li key={l.id}>
                <Link
                  href={`/lessons/${l.id}`}
                  className="card flex items-center gap-3 p-3 transition hover:border-primary/60"
                >
                  <BookOpen size={16} className="shrink-0 text-primary" aria-hidden="true" />
                  <span className="t-mono-label shrink-0">{l.moduleCode}</span>
                  <span className="min-w-0 truncate">{tl(l.title)}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
        {concept.questionCount > 0 && (
          <p className="mt-3 flex items-center gap-2 text-sm text-muted">
            <ListChecks size={14} aria-hidden="true" />
            {t('glossary.questionCount', { count: concept.questionCount })}
          </p>
        )}
      </section>

      {concept.related.length > 0 && (
        <section aria-labelledby="concept-related">
          <h2 id="concept-related" className="t-h2 mb-3">
            {t('glossary.relatedTitle')}
          </h2>
          <ul className="flex flex-wrap gap-2">
            {concept.related.map((r) => (
              <li key={r.id}>
                <Link
                  href={`/glossary/${r.id}`}
                  className="chip hover:border-primary/60 hover:text-fg"
                >
                  {conceptTerms(r.term, locale).primary}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

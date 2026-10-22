'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { Search, X } from 'lucide-react';
import {
  conceptInitial,
  searchConcepts,
  type ConceptSummary,
  type Locale,
} from '@devacademy/shared';
import { useI18n } from '@/i18n';
import { useConcepts, useDebounced } from '@/lib/hooks';
import { cn } from '@/lib/utils';
import { EmptyState } from '../ui/EmptyState';
import { SkeletonCard } from '../ui/Skeleton';
import { conceptDefinition, conceptTerms } from './concept-text';

const ALL = '*';

const initialOf = (c: ConceptSummary, locale: Locale) =>
  conceptInitial(conceptTerms(c.term, locale).primary, locale);

/**
 * Kavram sözlüğü: alfabetik gruplar, arama kutusu ve harf süzgeci. Sözlük tek istekte gelir;
 * arama shared `searchConcepts` ile istemcide yapılır (backend `GET /concepts?q=` ile aynı sıralama).
 */
export function GlossaryView({ initial }: { initial?: ConceptSummary[] }) {
  const { t, locale } = useI18n();
  const { data, isLoading, isError, refetch } = useConcepts(initial);
  const [q, setQ] = useState('');
  const [letter, setLetter] = useState(ALL);
  const query = useDebounced(q, 150).trim();

  const sorted = useMemo(
    () =>
      [...(data ?? [])].sort((a, b) =>
        conceptTerms(a.term, locale).primary.localeCompare(
          conceptTerms(b.term, locale).primary,
          locale,
        ),
      ),
    [data, locale],
  );
  const letters = useMemo(() => {
    const set = new Set(sorted.map((c) => initialOf(c, locale)));
    return [...set].sort((a, b) => (a === '#' ? -1 : b === '#' ? 1 : a.localeCompare(b, locale)));
  }, [sorted, locale]);

  const visible = useMemo(() => {
    const base = query ? searchConcepts(sorted, query, locale) : sorted;
    return letter === ALL ? base : base.filter((c) => initialOf(c, locale) === letter);
  }, [sorted, query, letter, locale]);

  // Aramasız görünümde baş harfe göre gruplanır; aramada puan sırası korunur
  const groups = useMemo((): [string, ConceptSummary[]][] => {
    if (query) return [['', visible]];
    const map = new Map<string, ConceptSummary[]>();
    for (const c of visible) {
      const key = initialOf(c, locale);
      map.set(key, [...(map.get(key) ?? []), c]);
    }
    return [...map];
  }, [visible, query, locale]);

  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      <div className="mb-8 max-w-2xl">
        <h1 className="t-h1">{t('glossary.title')}</h1>
        <p className="mt-2 text-muted">{t('glossary.subtitle', { count: sorted.length })}</p>
      </div>

      <div className="sticky top-16 z-10 -mx-4 mb-6 space-y-3 bg-bg/90 px-4 py-3 backdrop-blur">
        <label className="relative block">
          <span className="sr-only">{t('glossary.searchLabel')}</span>
          <Search
            size={16}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted"
            aria-hidden="true"
          />
          <input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={t('glossary.searchPlaceholder')}
            className="input w-full pl-9 pr-9"
          />
          {q && (
            <button
              type="button"
              onClick={() => setQ('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-muted hover:text-fg"
              aria-label={t('common.close')}
            >
              <X size={14} />
            </button>
          )}
        </label>
        <div role="group" aria-label={t('glossary.lettersLabel')} className="flex flex-wrap gap-1">
          {[ALL, ...letters].map((l) => (
            <button
              key={l}
              type="button"
              aria-pressed={letter === l}
              onClick={() => setLetter(l)}
              className={cn(
                'min-w-8 rounded-md px-2 py-1 text-xs font-medium transition',
                letter === l
                  ? 'bg-primary text-primary-fg'
                  : 'text-muted hover:bg-elevated hover:text-fg',
              )}
            >
              {l === ALL ? t('glossary.allLetters') : l}
            </button>
          ))}
        </div>
        <p className="text-xs text-muted" aria-live="polite">
          {t('glossary.resultCount', { count: visible.length })}
        </p>
      </div>

      {isLoading && (
        <div className="grid gap-3 sm:grid-cols-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      )}
      {isError && (
        <EmptyState
          title={t('common.error')}
          action={
            <button type="button" className="btn-ghost" onClick={() => refetch()}>
              {t('common.retry')}
            </button>
          }
        />
      )}
      {data && visible.length === 0 && <EmptyState title={t('glossary.empty')} />}

      <div className="space-y-10">
        {groups.map(([key, items]) => (
          <section key={key || 'results'} aria-labelledby={key ? `letter-${key}` : undefined}>
            {key && (
              <h2 id={`letter-${key}`} className="t-h2 mb-3">
                {key}
              </h2>
            )}
            <ul className="grid gap-3 sm:grid-cols-2">
              {items.map((c) => (
                <li key={c.id}>
                  <ConceptCard concept={c} />
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </div>
  );
}

function ConceptCard({ concept }: { concept: ConceptSummary }) {
  const { t, locale } = useI18n();
  const { primary, secondary } = conceptTerms(concept.term, locale);
  return (
    <Link
      href={`/glossary/${concept.id}`}
      className="card block h-full p-4 transition hover:border-primary/60"
    >
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <h3 className="font-semibold">{primary}</h3>
        {concept.lessonCount > 0 && (
          <span className="text-xs text-muted">
            {t('glossary.lessonCount', { count: concept.lessonCount })}
          </span>
        )}
      </div>
      {secondary && <p className="text-xs text-muted">{secondary}</p>}
      <p className="mt-2 line-clamp-3 text-sm text-muted">
        {conceptDefinition(concept.definition, locale)}
      </p>
    </Link>
  );
}

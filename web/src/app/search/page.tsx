'use client';

import { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { History, Search, X } from 'lucide-react';
import type { SearchResult } from '@devacademy/shared';
import { EmptyState } from '@/components/ui/EmptyState';
import { useI18n } from '@/i18n';
import { useDebounced, useSearch } from '@/lib/hooks';
import { cn } from '@/lib/utils';

const RECENT_KEY = 'da-recent-searches';
const POPULAR = [
  'load balancer',
  'cache',
  'kafka',
  'consistent hashing',
  'transformer',
  'docker',
  'saga',
  'closure',
];
type TypeFilter = 'all' | SearchResult['type'];

function readRecent(): string[] {
  try {
    const raw = localStorage.getItem(RECENT_KEY);
    return raw ? (JSON.parse(raw) as string[]).slice(0, 8) : [];
  } catch {
    return [];
  }
}

function SearchView() {
  const { t, tl } = useI18n();
  const router = useRouter();
  const params = useSearchParams();
  const [q, setQ] = useState(params.get('q') ?? '');
  const [type, setType] = useState<TypeFilter>('all');
  const [recent, setRecent] = useState<string[]>([]);
  const debounced = useDebounced(q, 250);
  const { data, isFetching } = useSearch(debounced);
  const active = debounced.trim().length >= 2;

  useEffect(() => setRecent(readRecent()), []);
  useEffect(() => {
    router.replace(debounced ? `/search?q=${encodeURIComponent(debounced)}` : '/search', {
      scroll: false,
    });
  }, [debounced, router]);
  // Sonuç getiren aramaları hatırla
  useEffect(() => {
    if (!active || !data?.results.length) return;
    const next = [debounced, ...readRecent().filter((r) => r !== debounced)].slice(0, 8);
    try {
      localStorage.setItem(RECENT_KEY, JSON.stringify(next));
    } catch {
      /* gizli mod */
    }
    setRecent(next);
  }, [active, data, debounced]);

  const results = (active ? (data?.results ?? []) : []).filter(
    (r) => type === 'all' || r.type === type,
  );
  const counts = (data?.results ?? []).reduce<Record<string, number>>((acc, r) => {
    acc[r.type] = (acc[r.type] ?? 0) + 1;
    return acc;
  }, {});
  const types: TypeFilter[] = ['all', 'lesson', 'module', 'concept', 'pattern'];

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="t-h1">{t('search.title')}</h1>
      <p className="mb-6 mt-1 text-muted">{t('search.subtitle')}</p>
      <label className="relative block">
        <span className="sr-only">{t('nav.search')}</span>
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-muted" size={18} />
        <input
          autoFocus
          className="input h-12 pl-11 pr-10 text-base"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={t('search.placeholder')}
        />
        {q && (
          <button
            type="button"
            className="btn-icon btn-icon-sm absolute right-2 top-1/2 -translate-y-1/2 border-0 bg-transparent"
            onClick={() => setQ('')}
            aria-label={t('common.close')}
          >
            <X size={14} />
          </button>
        )}
      </label>

      {active && data && (
        <div className="mt-4 flex flex-wrap items-center gap-2" role="tablist">
          {types.map((tp) => {
            const n = tp === 'all' ? data.results.length : (counts[tp] ?? 0);
            if (tp !== 'all' && n === 0) return null;
            return (
              <button
                key={tp}
                type="button"
                role="tab"
                aria-selected={type === tp}
                onClick={() => setType(tp)}
                className={cn(
                  'chip transition',
                  type === tp ? 'chip-primary' : 'hover:bg-elevated',
                )}
              >
                {tp === 'all' ? t('search.all') : t(`search.types.${tp}` as 'search.types.lesson')}{' '}
                <span className="tabular-nums opacity-70">{n}</span>
              </button>
            );
          })}
          <span className="ml-auto text-xs text-muted" aria-live="polite">
            {t('search.results', { count: data.results.length })}
            {isFetching && ' …'}
          </span>
        </div>
      )}

      {!active && (
        <div className="mt-8 space-y-6">
          {recent.length > 0 && (
            <section>
              <div className="mb-2 flex items-center justify-between">
                <p className="t-eyebrow flex items-center gap-1.5">
                  <History size={12} /> {t('search.recent')}
                </p>
                <button
                  type="button"
                  className="btn-link text-xs"
                  onClick={() => {
                    localStorage.removeItem(RECENT_KEY);
                    setRecent([]);
                  }}
                >
                  {t('search.clearRecent')}
                </button>
              </div>
              <div className="flex flex-wrap gap-2">
                {recent.map((r) => (
                  <button
                    key={r}
                    type="button"
                    className="chip hover:bg-elevated"
                    onClick={() => setQ(r)}
                  >
                    {r}
                  </button>
                ))}
              </div>
            </section>
          )}
          <section>
            <p className="t-eyebrow mb-2">{t('search.popular')}</p>
            <div className="flex flex-wrap gap-2">
              {POPULAR.map((p) => (
                <button
                  key={p}
                  type="button"
                  className="chip hover:bg-elevated"
                  onClick={() => setQ(p)}
                >
                  {p}
                </button>
              ))}
            </div>
          </section>
          {q.length > 0 && q.length < 2 && (
            <p className="text-sm text-muted">{t('search.typeToSearch')}</p>
          )}
        </div>
      )}

      {active && data && results.length === 0 && (
        <EmptyState
          icon={Search}
          title={t('search.empty')}
          description={t('search.emptyHint')}
          action={
            <div className="flex flex-wrap justify-center gap-2">
              {POPULAR.slice(0, 5).map((p) => (
                <button
                  key={p}
                  type="button"
                  className="chip hover:bg-elevated"
                  onClick={() => setQ(p)}
                >
                  {p}
                </button>
              ))}
            </div>
          }
        />
      )}

      <ul className="mt-4 space-y-3">
        {results.map((r) => (
          <li key={`${r.type}-${r.id}`}>
            <Link
              href={r.type === 'module' ? `/modules/${r.id}` : `/lessons/${r.id}`}
              className="card card-hover block p-4"
            >
              <span className={cn('chip mb-1', r.type === 'lesson' && 'chip-primary')}>
                {t(`search.types.${r.type}` as 'search.types.lesson')}
              </span>
              <p className="font-semibold">{tl(r.title)}</p>
              {/* ts_headline eşleşmeleri **…** ile işaretler */}
              <p className="mt-1 text-sm text-muted">
                {r.snippet.split(/\*\*(.+?)\*\*/g).map((part, i) =>
                  i % 2 ? (
                    <mark key={i} className="rounded bg-accent/25 px-0.5 text-fg">
                      {part}
                    </mark>
                  ) : (
                    part
                  ),
                )}
              </p>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function SearchPage() {
  return (
    <Suspense>
      <SearchView />
    </Suspense>
  );
}

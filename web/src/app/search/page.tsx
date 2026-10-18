'use client';

import { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Search } from 'lucide-react';
import { useI18n } from '@/i18n';
import { useDebounced, useSearch } from '@/lib/hooks';

function SearchView() {
  const { t, tl } = useI18n();
  const router = useRouter();
  const params = useSearchParams();
  const [q, setQ] = useState(params.get('q') ?? '');
  const debounced = useDebounced(q, 250);
  const { data, isFetching } = useSearch(debounced);

  useEffect(() => {
    router.replace(debounced ? `/search?q=${encodeURIComponent(debounced)}` : '/search', {
      scroll: false,
    });
  }, [debounced, router]);

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <label className="relative block">
        <span className="sr-only">{t('nav.search')}</span>
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" size={18} />
        <input
          autoFocus
          className="input py-3 pl-10 text-base"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={t('search.placeholder')}
        />
      </label>
      {debounced.length >= 2 && data && (
        <p className="mt-4 text-sm text-muted" aria-live="polite">
          {data.results.length
            ? t('search.results', { count: data.results.length })
            : t('search.empty')}{' '}
          {isFetching && '…'}
        </p>
      )}
      <ul className="mt-4 space-y-3">
        {data?.results.map((r) => (
          <li key={`${r.type}-${r.id}`}>
            <Link
              href={r.type === 'module' ? `/modules/${r.id}` : `/lessons/${r.id}`}
              className="card block p-4 hover:border-primary"
            >
              <span className="chip mb-1">
                {t(`search.types.${r.type}` as 'search.types.lesson')}
              </span>
              <p className="font-semibold">{tl(r.title)}</p>
              {/* ts_headline eşleşmeleri **…** ile işaretler */}
              <p className="mt-1 text-sm text-muted">
                {r.snippet.split(/\*\*(.+?)\*\*/g).map((part, i) =>
                  i % 2 ? (
                    <mark key={i} className="rounded bg-accent/30 px-0.5 text-fg">
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

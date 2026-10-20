'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowRight,
  BookOpen,
  CornerDownLeft,
  LayoutDashboard,
  Library,
  Repeat,
  Route,
  Search,
  type LucideIcon,
} from 'lucide-react';
import { useI18n } from '@/i18n';
import { useIsAuthenticated } from '@/lib/auth-store';
import { useCommandPalette } from '@/lib/command-palette-store';
import { useDebounced, useSearch } from '@/lib/hooks';
import { cn } from '@/lib/utils';
import { Dialog } from '../ui/Dialog';

interface Item {
  key: string;
  label: string;
  hint?: string;
  href: string;
  icon?: LucideIcon;
  group: 'nav' | 'result';
}

/**
 * ⌘K / Ctrl+K komut paleti: hızlı gezinme + içerik araması (mevcut /search API'si).
 * Klavye: ↑↓ gez, Enter aç, Esc kapat. Header'daki arama düğmesi de aynı paleti açar.
 */
export function CommandPalette() {
  const { t, tl } = useI18n();
  const router = useRouter();
  const authed = useIsAuthenticated();
  const open = useCommandPalette((s) => s.open);
  const setOpen = useCommandPalette((s) => s.setOpen);
  const toggle = useCommandPalette((s) => s.toggle);
  const [q, setQ] = useState('');
  const [active, setActive] = useState(0);
  const debounced = useDebounced(q, 200);
  const { data, isFetching } = useSearch(debounced);
  const listRef = useRef<HTMLUListElement>(null);

  // Global kısayol
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        toggle();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [toggle]);

  useEffect(() => {
    if (!open) {
      setQ('');
      setActive(0);
    }
  }, [open]);

  const navItems = useMemo<Item[]>(
    () => [
      { key: 'modules', label: t('nav.modules'), href: '/modules', icon: BookOpen, group: 'nav' },
      { key: 'paths', label: t('nav.paths'), href: '/#paths', icon: Route, group: 'nav' },
      ...(authed
        ? [
            {
              key: 'dashboard',
              label: t('nav.dashboard'),
              href: '/dashboard',
              icon: LayoutDashboard,
              group: 'nav' as const,
            },
            {
              key: 'review',
              label: t('nav.review'),
              href: '/review',
              icon: Repeat,
              group: 'nav' as const,
            },
            {
              key: 'library',
              label: t('nav.library'),
              href: '/library',
              icon: Library,
              group: 'nav' as const,
            },
          ]
        : []),
    ],
    [authed, t],
  );

  const searching = debounced.trim().length >= 2;
  const items = useMemo<Item[]>(() => {
    if (!searching) return navItems;
    const results = (data?.results ?? []).slice(0, 8).map<Item>((r) => ({
      key: `${r.type}-${r.id}`,
      label: tl(r.title),
      hint: t(`search.types.${r.type}` as 'search.types.lesson'),
      href: r.type === 'module' ? `/modules/${r.id}` : `/lessons/${r.id}`,
      group: 'result',
    }));
    const filteredNav = navItems.filter((n) => n.label.toLowerCase().includes(q.toLowerCase()));
    return [...results, ...filteredNav];
  }, [searching, navItems, data, q, t, tl]);

  useEffect(() => setActive(0), [items.length, debounced]);

  const go = (item: Item) => {
    setOpen(false);
    router.push(item.href);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActive((a) => Math.min(items.length - 1, a + 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((a) => Math.max(0, a - 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const item = items[active];
      if (item) go(item);
      else if (searching) {
        setOpen(false);
        router.push(`/search?q=${encodeURIComponent(q)}`);
      }
    }
  };

  useEffect(() => {
    listRef.current
      ?.querySelector<HTMLElement>(`[data-index="${active}"]`)
      ?.scrollIntoView({ block: 'nearest' });
  }, [active]);

  return (
    <Dialog
      open={open}
      onClose={() => setOpen(false)}
      size="md"
      bare
      hideClose
      srTitle={t('nav.search')}
    >
      <div className="flex items-center gap-3 border-b border-border px-4">
        <Search size={18} className="shrink-0 text-muted" />
        <input
          data-autofocus
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder={t('palette.placeholder')}
          className="h-14 w-full bg-transparent text-base outline-none placeholder:text-muted/70"
          role="combobox"
          aria-expanded="true"
          aria-controls="palette-list"
          aria-activedescendant={items[active] ? `palette-${items[active].key}` : undefined}
          autoComplete="off"
        />
        <kbd className="kbd hidden sm:inline-flex">Esc</kbd>
      </div>
      <ul
        id="palette-list"
        ref={listRef}
        role="listbox"
        className="max-h-[60vh] overflow-y-auto p-2"
        aria-busy={isFetching}
      >
        {items.length === 0 && (
          <li className="px-3 py-8 text-center text-sm text-muted">{t('palette.empty')}</li>
        )}
        {items.map((item, i) => {
          const showHeading = i === 0 || items[i - 1].group !== item.group;
          const Icon = item.icon ?? ArrowRight;
          return (
            <li key={item.key} role="presentation">
              {showHeading && (
                <p className="t-eyebrow px-3 pb-1 pt-2">
                  {item.group === 'nav' ? t('palette.navigation') : t('palette.results')}
                </p>
              )}
              <button
                type="button"
                id={`palette-${item.key}`}
                role="option"
                aria-selected={i === active}
                data-index={i}
                onMouseEnter={() => setActive(i)}
                onClick={() => go(item)}
                className={cn(
                  'flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm transition',
                  i === active ? 'bg-primary/10 text-fg' : 'text-fg/90 hover:bg-elevated',
                )}
              >
                <span
                  className={cn(
                    'inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg',
                    i === active ? 'bg-primary text-primary-fg' : 'bg-elevated text-muted',
                  )}
                >
                  <Icon size={15} />
                </span>
                <span className="min-w-0 flex-1 truncate">{item.label}</span>
                {item.hint && <span className="chip">{item.hint}</span>}
                {i === active && <CornerDownLeft size={14} className="shrink-0 text-muted" />}
              </button>
            </li>
          );
        })}
        {searching && (data?.results.length ?? 0) > 8 && (
          <li className="px-3 pb-1 pt-2">
            <button
              type="button"
              className="btn-link"
              onClick={() => {
                setOpen(false);
                router.push(`/search?q=${encodeURIComponent(q)}`);
              }}
            >
              {t('palette.allResults')} <ArrowRight size={14} />
            </button>
          </li>
        )}
      </ul>
      <p className="border-t border-border px-4 py-2 text-xs text-muted">{t('palette.hint')}</p>
    </Dialog>
  );
}

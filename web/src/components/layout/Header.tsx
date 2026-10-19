'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  BookOpen,
  Flame,
  Languages,
  LayoutDashboard,
  Library,
  LogOut,
  Menu,
  Moon,
  Repeat,
  Search,
  Shield,
  Sun,
  X,
  GraduationCap,
} from 'lucide-react';
import type { Locale } from '@devacademy/shared';
import { useI18n } from '@/i18n';
import { api } from '@/lib/api';
import { useAuthStore, useIsAuthenticated, useIsEditor } from '@/lib/auth-store';
import { useProgressSummary } from '@/lib/hooks';
import { cn } from '@/lib/utils';

export function Header() {
  const { t, locale, setLocale } = useI18n();
  const pathname = usePathname();
  const router = useRouter();
  const queryClient = useQueryClient();
  const authed = useIsAuthenticated();
  const editor = useIsEditor();
  const user = useAuthStore((s) => s.user);
  const hydrated = useAuthStore((s) => s.hydrated);
  const { data: summary } = useProgressSummary();
  const [open, setOpen] = useState(false);
  const [dark, setDark] = useState(false);

  useEffect(() => setDark(document.documentElement.classList.contains('dark')), []);
  useEffect(() => setOpen(false), [pathname]);

  const toggleTheme = () => {
    const next = !dark;
    setDark(next);
    document.documentElement.classList.toggle('dark', next);
    localStorage.setItem('da-theme', next ? 'dark' : 'light');
  };

  const logout = async () => {
    const { clear } = useAuthStore.getState();
    try {
      // Refresh token httpOnly çerezde; sunucu iptal edip çerezi siler
      await api('/auth/logout', { method: 'POST', body: {} });
    } catch {
      /* oturum zaten geçersiz olabilir */
    }
    clear();
    // Önceki kullanıcının profil/ilerleme/yer imi verisi aynı sekmede sonraki oturuma görünmesin
    queryClient.clear();
    router.push('/');
  };

  const links = [
    { href: '/modules', label: t('nav.modules'), icon: BookOpen },
    ...(authed
      ? [
          { href: '/dashboard', label: t('nav.dashboard'), icon: LayoutDashboard },
          { href: '/review', label: t('nav.review'), icon: Repeat },
          { href: '/library', label: t('nav.library'), icon: Library },
        ]
      : []),
    ...(editor ? [{ href: '/admin', label: t('nav.admin'), icon: Shield }] : []),
  ];

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-bg/80 backdrop-blur">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-2 focus:z-50 focus:rounded focus:bg-surface focus:px-3 focus:py-1"
      >
        {t('nav.skipToContent')}
      </a>
      <div className="mx-auto flex h-14 max-w-7xl items-center gap-4 px-4">
        <Link href="/" className="flex items-center gap-2 font-bold">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-white">
            <GraduationCap size={18} />
          </span>
          <span className="hidden sm:inline">{t('app.name')}</span>
        </Link>
        <nav className="hidden items-center gap-1 md:flex" aria-label="ana menü">
          {links.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className={cn(
                'rounded-lg px-3 py-1.5 text-sm',
                pathname.startsWith(l.href)
                  ? 'bg-elevated font-medium text-fg'
                  : 'text-muted hover:text-fg',
              )}
            >
              {l.label}
            </Link>
          ))}
        </nav>
        <div className="ml-auto flex items-center gap-2">
          <Link href="/search" className="btn-icon" aria-label={t('nav.search')}>
            <Search size={16} />
          </Link>
          {authed && summary && (
            <span className="chip hidden sm:inline-flex" title={t('dashboard.streak')}>
              <Flame size={13} className={summary.activeToday ? 'text-accent' : ''} />{' '}
              {summary.currentStreak}
            </span>
          )}
          <button
            type="button"
            className="btn-icon"
            onClick={() => setLocale((locale === 'tr' ? 'en' : 'tr') as Locale)}
            aria-label={t('common.language')}
            title={t('common.language')}
          >
            <Languages size={16} />
            <span className="sr-only">{locale}</span>
          </button>
          <button
            type="button"
            className="btn-icon"
            onClick={toggleTheme}
            aria-label={dark ? t('theme.light') : t('theme.dark')}
            title={dark ? t('theme.light') : t('theme.dark')}
          >
            {dark ? <Sun size={16} /> : <Moon size={16} />}
          </button>
          {hydrated &&
            (authed ? (
              <div className="hidden items-center gap-2 md:flex">
                <span className="max-w-[140px] truncate text-sm text-muted">
                  {user?.displayName}
                </span>
                <button
                  type="button"
                  className="btn-icon"
                  onClick={logout}
                  aria-label={t('nav.logout')}
                  title={t('nav.logout')}
                >
                  <LogOut size={16} />
                </button>
              </div>
            ) : (
              <div className="hidden items-center gap-2 md:flex">
                <Link href="/login" className="btn-ghost">
                  {t('nav.login')}
                </Link>
                <Link href="/register" className="btn-primary">
                  {t('nav.register')}
                </Link>
              </div>
            ))}
          <button
            type="button"
            className="btn-icon md:hidden"
            onClick={() => setOpen((o) => !o)}
            aria-expanded={open}
            aria-label="menu"
          >
            {open ? <X size={16} /> : <Menu size={16} />}
          </button>
        </div>
      </div>
      {open && (
        <nav className="border-t border-border px-4 py-3 md:hidden" aria-label="mobil menü">
          <ul className="space-y-1">
            {links.map((l) => (
              <li key={l.href}>
                <Link
                  href={l.href}
                  className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm hover:bg-elevated"
                >
                  <l.icon size={16} /> {l.label}
                </Link>
              </li>
            ))}
            <li>
              {authed ? (
                <button
                  type="button"
                  onClick={logout}
                  className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm hover:bg-elevated"
                >
                  <LogOut size={16} /> {t('nav.logout')}
                </button>
              ) : (
                <Link
                  href="/login"
                  className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm hover:bg-elevated"
                >
                  {t('nav.login')}
                </Link>
              )}
            </li>
          </ul>
        </nav>
      )}
    </header>
  );
}

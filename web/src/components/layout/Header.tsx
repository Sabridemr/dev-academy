'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  Award,
  BookOpen,
  BookText,
  BriefcaseBusiness,
  ChevronDown,
  Flame,
  History,
  Languages,
  LayoutDashboard,
  Library,
  LogOut,
  Menu,
  Moon,
  Repeat,
  Search,
  Settings,
  Shield,
  Sun,
  X,
  GraduationCap,
} from 'lucide-react';
import type { Locale } from '@devacademy/shared';
import { useI18n } from '@/i18n';
import { api } from '@/lib/api';
import { useAuthStore, useIsAuthenticated, useIsEditor } from '@/lib/auth-store';
import { useCommandPalette } from '@/lib/command-palette-store';
import { summaryLevel } from '@/lib/gamification';
import { useProgressSummary } from '@/lib/hooks';
import { cn } from '@/lib/utils';
import { applyTheme, resolveTheme, THEME_STORAGE_KEY } from '../providers';

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
  const openPalette = useCommandPalette((s) => s.setOpen);
  const [open, setOpen] = useState(false);
  const [dark, setDark] = useState(true);

  useEffect(() => {
    try {
      setDark(resolveTheme(localStorage.getItem(THEME_STORAGE_KEY)) === 'dark');
    } catch {
      setDark(document.documentElement.classList.contains('dark'));
    }
  }, []);
  useEffect(() => setOpen(false), [pathname]);

  const toggleTheme = () => {
    const next = !dark;
    setDark(next);
    applyTheme(next ? 'dark' : 'light');
  };
  const toggleLocale = () => setLocale((locale === 'tr' ? 'en' : 'tr') as Locale);

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
    { href: '/modules', label: t('nav.modules'), icon: BookOpen, match: ['/modules', '/lessons'] },
    { href: '/glossary', label: t('nav.glossary'), icon: BookText, match: ['/glossary'] },
    ...(authed
      ? [
          {
            href: '/dashboard',
            label: t('nav.dashboard'),
            icon: LayoutDashboard,
            match: ['/dashboard'],
          },
          { href: '/review', label: t('nav.review'), icon: Repeat, match: ['/review'] },
          { href: '/library', label: t('nav.library'), icon: Library, match: ['/library'] },
        ]
      : []),
    ...(editor ? [{ href: '/admin', label: t('nav.admin'), icon: Shield, match: ['/admin'] }] : []),
  ];
  const isActive = (match: string[]) => match.some((m) => pathname.startsWith(m));

  const themeLabel = dark ? t('theme.light') : t('theme.dark');
  const nextLocale = locale === 'tr' ? 'EN' : 'TR';

  return (
    <header className="sticky top-0 z-40 border-b border-border/80 bg-bg/75 backdrop-blur-md">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-2 focus:z-50 focus:rounded focus:bg-surface focus:px-3 focus:py-1"
      >
        {t('nav.skipToContent')}
      </a>
      <div className="mx-auto flex h-16 max-w-7xl items-center gap-3 px-4">
        <Link href="/" className="flex items-center gap-2.5 font-bold">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-primary-fg shadow-glow">
            <GraduationCap size={19} />
          </span>
          <span className="hidden tracking-tight sm:inline">{t('app.name')}</span>
        </Link>
        <nav className="ml-2 hidden items-center gap-1 md:flex" aria-label={t('nav.mainMenu')}>
          {links.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              aria-current={isActive(l.match) ? 'page' : undefined}
              className={cn(
                'rounded-lg px-3 py-1.5 text-sm transition',
                isActive(l.match)
                  ? 'bg-elevated font-medium text-fg'
                  : 'text-muted hover:bg-elevated/60 hover:text-fg',
              )}
            >
              {l.label}
            </Link>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-2">
          {/* Arama: masaüstünde kısayol ipuçlu geniş düğme, mobilde ikon */}
          <button
            type="button"
            onClick={() => openPalette(true)}
            className="btn-ghost hidden h-9 gap-3 pl-3 pr-2 text-muted md:inline-flex"
            aria-label={t('nav.search')}
          >
            <Search size={15} />
            <span className="text-xs">{t('nav.searchHint')}</span>
            <kbd className="kbd">⌘K</kbd>
          </button>
          <button
            type="button"
            onClick={() => openPalette(true)}
            className="btn-icon md:hidden"
            aria-label={t('nav.search')}
          >
            <Search size={16} />
          </button>

          {authed && summary && (
            <Link
              href="/dashboard"
              className={cn(
                'chip hidden h-9 px-3 sm:inline-flex',
                summary.activeToday && 'chip-accent',
              )}
              title={t('nav.streakTitle')}
            >
              <Flame size={14} className={summary.activeToday ? 'text-accent-fg' : ''} />
              <span className="tabular-nums">{summary.currentStreak}</span>
            </Link>
          )}
          {authed && <LevelBadge summary={summary} />}

          <button
            type="button"
            className="btn-icon hidden md:inline-flex"
            onClick={toggleTheme}
            aria-label={themeLabel}
            title={themeLabel}
          >
            {dark ? <Sun size={16} /> : <Moon size={16} />}
          </button>
          <button
            type="button"
            className="btn-ghost hidden h-10 w-10 px-0 font-mono text-xs md:inline-flex"
            onClick={toggleLocale}
            aria-label={`${t('common.language')}: ${locale.toUpperCase()} → ${nextLocale}`}
            title={t('common.language')}
          >
            {locale.toUpperCase()}
          </button>

          {hydrated &&
            (authed && user ? (
              <UserMenu
                name={user.displayName}
                email={user.email}
                avatarUrl={user.avatarUrl}
                onLogout={logout}
                className="hidden md:block"
              />
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
            aria-controls="mobile-menu"
            aria-label={open ? t('nav.closeMenu') : t('nav.openMenu')}
          >
            {open ? <X size={16} /> : <Menu size={16} />}
          </button>
        </div>
      </div>

      {open && (
        <MobileMenu
          onClose={() => setOpen(false)}
          links={links}
          isActive={isActive}
          authed={authed}
          userName={user?.displayName}
          onLogout={logout}
          dark={dark}
          onToggleTheme={toggleTheme}
          localeLabel={`${t('common.language')}: ${locale.toUpperCase()} → ${nextLocale}`}
          onToggleLocale={toggleLocale}
        />
      )}
    </header>
  );
}

/** Seviye rozeti: "Lv N" + seviye içi mini ilerleme çubuğu (XP özeti yoksa çizilmez) */
function LevelBadge({ summary }: { summary: ReturnType<typeof useProgressSummary>['data'] }) {
  const { t, locale } = useI18n();
  const lv = summaryLevel(summary);
  if (!lv) return null;
  const pct = Math.round(lv.progress * 100);
  const title = t('nav.levelTitle', { level: lv.level, xp: lv.xp.toLocaleString(locale) });
  return (
    <Link
      href="/dashboard"
      className="chip chip-primary hidden h-9 flex-col items-stretch justify-center gap-1 px-3 sm:inline-flex"
      title={title}
      aria-label={title}
    >
      <span className="text-xs font-semibold leading-none tabular-nums">
        {t('nav.levelShort', { level: lv.level })}
      </span>
      <span
        className="block h-1 w-10 overflow-hidden rounded-full bg-primary/20"
        aria-hidden="true"
      >
        <span className="block h-full rounded-full bg-primary" style={{ width: `${pct}%` }} />
      </span>
    </Link>
  );
}

/** Avatarlı kullanıcı menüsü: ad/e-posta, panel, dil ve tema kısayolları, çıkış */
function UserMenu({
  name,
  email,
  avatarUrl,
  onLogout,
  className,
}: {
  name: string;
  email: string;
  avatarUrl: string | null;
  onLogout: () => void;
  className?: string;
}) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div ref={root} className={cn('relative', className)}>
      <button
        type="button"
        className="flex h-10 items-center gap-2 rounded-xl border border-border bg-surface pl-1 pr-2 transition hover:bg-elevated"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={t('nav.userMenu')}
      >
        <Avatar name={name} url={avatarUrl} />
        <span className="max-w-[120px] truncate text-sm">{name}</span>
        <ChevronDown size={14} className="text-muted" />
      </button>
      {open && (
        <div
          role="menu"
          className="card absolute right-0 top-12 w-64 animate-fade-up overflow-hidden p-1.5 shadow-pop"
        >
          <div className="px-3 py-2">
            <p className="truncate text-sm font-semibold">{name}</p>
            <p className="truncate text-xs text-muted">{email}</p>
          </div>
          <div className="my-1 border-t border-border" />
          <MenuLink href="/dashboard" icon={LayoutDashboard} label={t('nav.dashboard')} />
          <MenuLink href="/review" icon={Repeat} label={t('nav.review')} />
          <MenuLink href="/library" icon={Library} label={t('nav.library')} />
          <MenuLink href="/history" icon={History} label={t('nav.history')} />
          <MenuLink href="/exam" icon={BriefcaseBusiness} label={t('nav.exam')} />
          <MenuLink href="/certificates" icon={Award} label={t('nav.certificates')} />
          <div className="my-1 border-t border-border" />
          <MenuLink href="/settings" icon={Settings} label={t('nav.settings')} />
          <div className="my-1 border-t border-border" />
          <button
            type="button"
            role="menuitem"
            onClick={onLogout}
            className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-danger-fg hover:bg-danger/10"
          >
            <LogOut size={15} /> {t('nav.logout')}
          </button>
        </div>
      )}
    </div>
  );
}

function MenuLink({
  href,
  icon: Icon,
  label,
}: {
  href: string;
  icon: typeof LayoutDashboard;
  label: string;
}) {
  return (
    <Link
      href={href}
      role="menuitem"
      className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm hover:bg-elevated"
    >
      <Icon size={15} className="text-muted" /> {label}
    </Link>
  );
}

export function Avatar({
  name,
  url,
  size = 28,
}: {
  name: string;
  url?: string | null;
  size?: number;
}) {
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join('');
  if (url)
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={url}
        alt=""
        width={size}
        height={size}
        className="rounded-lg object-cover"
        style={{ width: size, height: size }}
      />
    );
  return (
    <span
      className="inline-flex items-center justify-center rounded-lg bg-primary text-xs font-bold text-primary-fg"
      style={{ width: size, height: size }}
      aria-hidden="true"
    >
      {initials || '?'}
    </span>
  );
}

function MobileMenu({
  onClose,
  links,
  isActive,
  authed,
  userName,
  onLogout,
  dark,
  onToggleTheme,
  localeLabel,
  onToggleLocale,
}: {
  onClose: () => void;
  links: { href: string; label: string; icon: typeof BookOpen; match: string[] }[];
  isActive: (match: string[]) => boolean;
  authed: boolean;
  userName?: string;
  onLogout: () => void;
  dark: boolean;
  onToggleTheme: () => void;
  localeLabel: string;
  onToggleLocale: () => void;
}) {
  const { t, locale } = useI18n();
  const root = useRef<HTMLElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    const onDown = (e: MouseEvent) => {
      const header = root.current?.closest('header');
      if (header && !header.contains(e.target as Node)) onClose();
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('mousedown', onDown);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('mousedown', onDown);
    };
  }, [onClose]);

  return (
    <nav
      id="mobile-menu"
      ref={root}
      className="animate-fade-up border-t border-border px-4 py-3 md:hidden"
      aria-label={t('nav.mobileMenu')}
    >
      <ul className="space-y-1">
        {links.map((l) => (
          <li key={l.href}>
            <Link
              href={l.href}
              aria-current={isActive(l.match) ? 'page' : undefined}
              className={cn(
                'flex items-center gap-2 rounded-lg px-3 py-2.5 text-sm',
                isActive(l.match) ? 'bg-elevated font-medium' : 'hover:bg-elevated',
              )}
            >
              <l.icon size={16} /> {l.label}
            </Link>
          </li>
        ))}
      </ul>
      {authed && (
        <ul className="mt-3 grid grid-cols-2 gap-1 border-t border-border pt-3">
          {[
            { href: '/history', label: t('nav.history'), icon: History },
            { href: '/exam', label: t('nav.exam'), icon: BriefcaseBusiness },
            { href: '/certificates', label: t('nav.certificates'), icon: Award },
          ].map((l) => (
            <li key={l.href}>
              <Link
                href={l.href}
                className="flex items-center gap-2 rounded-lg px-3 py-2.5 text-sm hover:bg-elevated"
              >
                <l.icon size={16} /> {l.label}
              </Link>
            </li>
          ))}
        </ul>
      )}
      <div className="mt-3 flex gap-2 border-t border-border pt-3">
        <button type="button" className="btn-ghost flex-1" onClick={onToggleTheme}>
          {dark ? <Sun size={15} /> : <Moon size={15} />}
          {dark ? t('theme.light') : t('theme.dark')}
        </button>
        <button
          type="button"
          className="btn-ghost flex-1"
          onClick={onToggleLocale}
          aria-label={localeLabel}
        >
          <Languages size={15} /> {locale.toUpperCase()}
        </button>
      </div>
      <div className="mt-3 flex gap-2">
        {authed && (
          <Link href="/settings" className="btn-ghost flex-1">
            <Settings size={15} /> {t('nav.settings')}
          </Link>
        )}
        {authed ? (
          <button type="button" onClick={onLogout} className="btn-ghost flex-1">
            <LogOut size={15} /> {t('nav.logout')}
            {userName && <span className="sr-only"> ({userName})</span>}
          </button>
        ) : (
          <>
            <Link href="/login" className="btn-ghost flex-1">
              {t('nav.login')}
            </Link>
            <Link href="/register" className="btn-primary flex-1">
              {t('nav.register')}
            </Link>
          </>
        )}
      </div>
    </nav>
  );
}

'use client';

import Link from 'next/link';
import { Github, GraduationCap } from 'lucide-react';
import { useI18n } from '@/i18n';
import { useIsAuthenticated } from '@/lib/auth-store';

const REPO_URL = 'https://github.com/Sabridemr/dev-academy';

export function Footer() {
  const { t } = useI18n();
  const authed = useIsAuthenticated();
  const year = new Date().getFullYear();

  const learn = [
    { href: '/modules', label: t('nav.modules') },
    { href: '/#paths', label: t('nav.paths') },
    { href: '/search', label: t('nav.search') },
  ];
  const account = authed
    ? [
        { href: '/dashboard', label: t('nav.dashboard') },
        { href: '/review', label: t('nav.review') },
        { href: '/library', label: t('nav.library') },
      ]
    : [
        { href: '/login', label: t('nav.login') },
        { href: '/register', label: t('nav.register') },
      ];
  const project = [
    { href: REPO_URL, label: t('footer.source'), external: true },
    { href: '/lessons/f-08-devacademy-architecture', label: t('footer.architecture') },
  ];

  return (
    <footer className="mt-24 border-t border-border bg-surface/40">
      <div className="mx-auto grid max-w-7xl gap-10 px-4 py-12 sm:grid-cols-2 lg:grid-cols-[2fr_1fr_1fr_1fr]">
        <div>
          <Link href="/" className="flex items-center gap-2 font-bold">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-fg">
              <GraduationCap size={18} />
            </span>
            {t('app.name')}
          </Link>
          <p className="mt-3 max-w-sm text-sm text-muted">{t('footer.tagline')}</p>
        </div>
        <FooterColumn title={t('footer.learn')} links={learn} />
        <FooterColumn title={t('footer.account')} links={account} />
        <FooterColumn title={t('footer.project')} links={project} />
      </div>
      <div className="border-t border-border">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-4 text-xs text-muted">
          <p>
            © {year} {t('app.name')} · {t('footer.madeWith')}
          </p>
          <a
            href={REPO_URL}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 hover:text-fg"
          >
            <Github size={14} /> GitHub
          </a>
        </div>
      </div>
    </footer>
  );
}

function FooterColumn({
  title,
  links,
}: {
  title: string;
  links: { href: string; label: string; external?: boolean }[];
}) {
  return (
    <div>
      <p className="t-eyebrow mb-3">{title}</p>
      <ul className="space-y-2 text-sm">
        {links.map((l) => (
          <li key={l.href}>
            {l.external ? (
              <a
                href={l.href}
                target="_blank"
                rel="noreferrer"
                className="text-muted hover:text-fg"
              >
                {l.label}
              </a>
            ) : (
              <Link href={l.href} className="text-muted hover:text-fg">
                {l.label}
              </Link>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

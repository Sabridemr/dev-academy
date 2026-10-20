'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import { ArrowRight, Flame, Repeat, Sparkles } from 'lucide-react';
import { useI18n } from '@/i18n';
import { useAuthStore, useIsAuthenticated } from '@/lib/auth-store';
import { useProgressSummary } from '@/lib/hooks';
import { usePrefersReducedMotion } from '@/lib/hooks';
import { SceneShowcase, type ShowcaseScene } from './SceneShowcase';

/** Ana sayfa girişi: misafire pazarlama hero'su, oturumlu kullanıcıya "devam et" şeridi. */
export function Hero({ scenes }: { scenes: ShowcaseScene[] }) {
  const { t } = useI18n();
  const authed = useIsAuthenticated();
  const user = useAuthStore((s) => s.user);
  const { data: summary } = useProgressSummary();
  const reduced = usePrefersReducedMotion();

  return (
    <section className="relative overflow-hidden border-b border-border">
      <div className="bg-grid mask-fade-b absolute inset-0 -z-10 opacity-70" aria-hidden="true" />
      <div className="bg-glow absolute inset-0 -z-10" aria-hidden="true" />
      <div className="mx-auto grid max-w-7xl items-center gap-10 px-4 py-14 lg:grid-cols-[1.05fr_1fr] lg:py-20">
        <motion.div
          initial={reduced ? false : { opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          {authed && user ? (
            <>
              <p className="chip chip-accent mb-4">
                <Sparkles size={12} /> {t('home.welcomeBack', { name: user.displayName })}
              </p>
              <h1 className="t-display">
                {summary?.continueLesson ? t('home.continue') : t('home.start')}
              </h1>
              <p className="mt-4 max-w-xl text-lg text-muted">
                {summary?.continueLesson ? t('home.welcomeHint') : t('home.noContinue')}
              </p>
              <div className="mt-8 flex flex-wrap items-center gap-3">
                <Link
                  href={
                    summary?.continueLesson ? `/lessons/${summary.continueLesson.id}` : '/modules'
                  }
                  className="btn-primary btn-lg"
                >
                  {summary?.continueLesson ? t('home.continue') : t('home.start')}
                  <ArrowRight size={16} />
                </Link>
                <Link href="/dashboard" className="btn-ghost btn-lg">
                  {t('nav.dashboard')}
                </Link>
              </div>
              {summary && (
                <div className="mt-6 flex flex-wrap gap-2">
                  <span className="chip">
                    <Flame size={12} className={summary.activeToday ? 'text-accent-fg' : ''} />
                    {t('home.streakDays', { count: summary.currentStreak })}
                  </span>
                  {summary.dueReviews > 0 && (
                    <Link href="/review" className="chip chip-primary">
                      <Repeat size={12} /> {t('home.dueToday', { count: summary.dueReviews })}
                    </Link>
                  )}
                </div>
              )}
            </>
          ) : (
            <>
              <p className="chip chip-primary mb-5">
                <Sparkles size={12} /> {t('home.eyebrow')}
              </p>
              <h1 className="t-display">
                {t('home.heroTitleA')} <span className="t-gradient">{t('home.heroTitleB')}</span>
              </h1>
              <p className="mt-5 max-w-xl text-lg leading-8 text-muted">
                {t('home.heroSubtitleLong')}
              </p>
              <div className="mt-8 flex flex-wrap items-center gap-3">
                <Link href="/register" className="btn-primary btn-lg">
                  {t('home.start')} <ArrowRight size={16} />
                </Link>
                <Link href="/modules" className="btn-ghost btn-lg">
                  {t('nav.modules')}
                </Link>
              </div>
              <p className="mt-4 text-sm text-muted">{t('home.tryFree')}</p>
            </>
          )}
        </motion.div>
        <motion.div
          initial={reduced ? false : { opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5, delay: 0.1 }}
        >
          <SceneShowcase scenes={scenes} autoPlay />
        </motion.div>
      </div>
    </section>
  );
}

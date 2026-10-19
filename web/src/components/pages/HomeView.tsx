'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import {
  ArrowRight,
  Boxes,
  Brain,
  Briefcase,
  Code2,
  Container,
  Database,
  Layers,
  Network,
  Puzzle,
  Rocket,
  Route,
  Server,
  Terminal,
  type LucideIcon,
} from 'lucide-react';
import type { LearningPathSummary, ModuleSummary } from '@devacademy/shared';
import { useI18n } from '@/i18n';
import { useIsAuthenticated } from '@/lib/auth-store';
import { useProgressSummary } from '@/lib/hooks';
import { SceneShowcase, type ShowcaseScene } from '../home/SceneShowcase';

export const ICONS: Record<string, LucideIcon> = {
  layers: Layers,
  boxes: Boxes,
  puzzle: Puzzle,
  database: Database,
  rocket: Rocket,
  server: Server,
  brain: Brain,
  terminal: Terminal,
  network: Network,
  briefcase: Briefcase,
  route: Route,
  container: Container,
  code: Code2,
};

export function HomeView({
  paths,
  modules,
  scenes = [],
}: {
  paths: LearningPathSummary[];
  modules: ModuleSummary[];
  /** Vitrin animasyonları (sunucuda API'den alınır) */
  scenes?: ShowcaseScene[];
}) {
  const { t, tl } = useI18n();
  const authed = useIsAuthenticated();
  const { data: summary } = useProgressSummary();

  return (
    <div className="mx-auto max-w-7xl px-4 pb-16">
      <section className="grid items-center gap-10 py-12 lg:grid-cols-2 lg:items-start lg:py-20">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="lg:pt-20"
        >
          <p className="chip mb-4">{t('app.tagline')}</p>
          <h1 className="text-4xl font-bold tracking-tight md:text-5xl">{t('home.heroTitle')}</h1>
          <p className="mt-4 max-w-xl text-lg text-muted">{t('home.heroSubtitle')}</p>
          <div className="mt-8 flex flex-wrap gap-3">
            {authed && summary?.continueLesson ? (
              <Link
                href={`/lessons/${summary.continueLesson.id}`}
                className="btn-primary px-5 py-2.5"
              >
                {t('home.continue')} <ArrowRight size={16} />
              </Link>
            ) : (
              <Link href={authed ? '/modules' : '/register'} className="btn-primary px-5 py-2.5">
                {t('home.start')} <ArrowRight size={16} />
              </Link>
            )}
            <Link href="/modules" className="btn-ghost px-5 py-2.5">
              {t('nav.modules')}
            </Link>
          </div>
        </motion.div>
        <SceneShowcase scenes={scenes} />
      </section>

      {paths.length > 0 && (
        <section className="py-8" aria-labelledby="paths-title">
          <h2 id="paths-title" className="mb-4 text-2xl font-semibold">
            {t('home.pathsTitle')}
          </h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {paths.map((p) => {
              const Icon = ICONS[p.icon] ?? Route;
              return (
                <Link
                  key={p.id}
                  href={authed ? `/onboarding?path=${p.id}` : `/register?path=${p.id}`}
                  className="card group p-5 transition hover:-translate-y-0.5 hover:border-primary"
                >
                  <Icon className="mb-3 text-primary" size={22} />
                  <p className="font-semibold">{tl(p.title)}</p>
                  <p className="mt-1 text-sm text-muted">{tl(p.description)}</p>
                  <p className="mt-3 text-xs text-muted">
                    {t('home.modulesCount', { count: p.moduleCount })} ·{' '}
                    {t('home.lessons', { count: p.lessonCount })}
                  </p>
                </Link>
              );
            })}
          </div>
        </section>
      )}

      <section className="py-8" aria-labelledby="modules-title">
        <h2 id="modules-title" className="mb-4 text-2xl font-semibold">
          {t('home.modulesTitle')}
        </h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {modules.map((m) => {
            const Icon = ICONS[m.icon] ?? Layers;
            return (
              <Link
                key={m.id}
                href={`/modules/${m.id}`}
                className="card group flex gap-4 p-5 transition hover:border-primary"
              >
                <span
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-white"
                  style={{ background: m.color }}
                >
                  <Icon size={20} />
                </span>
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-muted">
                    {m.code} · {t('home.lessons', { count: m.lessonCount })}
                  </p>
                  <p className="font-semibold">{tl(m.title)}</p>
                  <p className="mt-1 line-clamp-2 text-sm text-muted">{tl(m.description)}</p>
                </div>
              </Link>
            );
          })}
        </div>
      </section>
    </div>
  );
}

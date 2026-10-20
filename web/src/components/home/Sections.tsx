'use client';

import Link from 'next/link';
import { useState } from 'react';
import {
  ArrowRight,
  Boxes,
  Brain,
  Briefcase,
  Clapperboard,
  Clock,
  Code2,
  Container,
  Database,
  FlaskConical,
  Layers,
  ListChecks,
  Network,
  Puzzle,
  Rocket,
  Route,
  Server,
  Terminal,
  type LucideIcon,
} from 'lucide-react';
import { MODULE_GROUPS, type LearningPathSummary, type ModuleSummary } from '@devacademy/shared';
import { useI18n } from '@/i18n';
import { useIsAuthenticated } from '@/lib/auth-store';
import { cn } from '@/lib/utils';
import { SIMULATORS } from '../simulators/registry';

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

export function SectionHeading({
  id,
  title,
  subtitle,
  action,
}: {
  id: string;
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
      <div className="max-w-2xl">
        <h2 id={id} className="t-h2">
          {title}
        </h2>
        {subtitle && <p className="mt-2 text-muted">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

/** "Üç adımda öğren": izle → dene → pekiştir */
export function HowItWorks() {
  const { t } = useI18n();
  const steps = [
    { icon: Clapperboard, title: t('home.how1Title'), text: t('home.how1Text'), tone: 'primary' },
    { icon: FlaskConical, title: t('home.how2Title'), text: t('home.how2Text'), tone: 'accent' },
    { icon: ListChecks, title: t('home.how3Title'), text: t('home.how3Text'), tone: 'success' },
  ] as const;
  return (
    <section className="mx-auto max-w-7xl px-4 py-16" aria-labelledby="how-title">
      <SectionHeading id="how-title" title={t('home.howTitle')} subtitle={t('home.howSubtitle')} />
      <ol className="grid gap-4 md:grid-cols-3">
        {steps.map((s, i) => (
          <li key={s.title} className="card relative overflow-hidden p-6">
            <span className="t-mono-label absolute right-5 top-5">0{i + 1}</span>
            <span
              className={cn(
                'mb-4 inline-flex h-11 w-11 items-center justify-center rounded-xl',
                s.tone === 'primary' && 'bg-primary/15 text-primary',
                s.tone === 'accent' && 'bg-accent/15 text-accent-fg',
                s.tone === 'success' && 'bg-success/15 text-success-fg',
              )}
            >
              <s.icon size={20} />
            </span>
            <p className="t-h3">{s.title}</p>
            <p className="mt-2 text-sm leading-6 text-muted">{s.text}</p>
          </li>
        ))}
      </ol>
    </section>
  );
}

/** Rakam şeridi: modül/ders/saat/simülatör sayıları (API verisi + simülatör kaydı) */
export function StatsStrip({ modules }: { modules: ModuleSummary[] }) {
  const { t } = useI18n();
  const lessons = modules.reduce((a, m) => a + m.lessonCount, 0);
  const hours = Math.round(modules.reduce((a, m) => a + m.totalMinutes, 0) / 60);
  const sims = Object.keys(SIMULATORS).length;
  const items = [
    { value: modules.length, label: t('home.statsModules') },
    { value: lessons, label: t('home.statsLessons') },
    { value: hours, label: t('home.statsHours') },
    { value: sims, label: t('home.statsSims') },
  ];
  if (!modules.length) return null;
  return (
    <section className="border-y border-border bg-surface/40">
      <dl className="mx-auto grid max-w-7xl grid-cols-2 divide-border px-4 md:grid-cols-4 md:divide-x">
        {items.map((it) => (
          <div key={it.label} className="px-4 py-8 text-center md:text-left">
            <dd className="t-gradient text-4xl font-bold tabular-nums tracking-tight">
              {it.value}
            </dd>
            <dt className="mt-1 text-sm text-muted">{it.label}</dt>
          </div>
        ))}
      </dl>
    </section>
  );
}

const SHOWCASE_SIMS = [
  { type: 'cache', labelKey: 'home.simCache', lessonId: 'a-07-caching', params: { capacity: 4 } },
  {
    type: 'rate-limiter',
    labelKey: 'home.simRateLimiter',
    lessonId: 'a-10-rate-limiting',
    params: {},
  },
  {
    type: 'consistent-hashing',
    labelKey: 'home.simHashing',
    lessonId: 'a-11-consistent-hashing-sharding',
    params: {},
  },
] as const;

/** Canlı simülatör vitrini (hesapsız denenebilir) */
export function SimulatorShowcase() {
  const { t } = useI18n();
  const [index, setIndex] = useState(0);
  const current = SHOWCASE_SIMS[index];
  const Sim = SIMULATORS[current.type];
  return (
    <section className="mx-auto max-w-7xl px-4 py-16" aria-labelledby="sims-title">
      <SectionHeading
        id="sims-title"
        title={t('home.simsTitle')}
        subtitle={t('home.simsSubtitle')}
        action={
          <div role="tablist" aria-label={t('home.simsTitle')} className="flex flex-wrap gap-2">
            {SHOWCASE_SIMS.map((s, i) => (
              <button
                key={s.type}
                type="button"
                role="tab"
                aria-selected={i === index}
                onClick={() => setIndex(i)}
                className={cn(
                  'chip transition',
                  i === index ? 'chip-primary' : 'hover:bg-elevated',
                )}
              >
                {t(s.labelKey)}
              </button>
            ))}
          </div>
        }
      />
      <div role="tabpanel" key={current.type}>
        {Sim && <Sim params={current.params} onInteract={() => undefined} />}
        <Link href={`/lessons/${current.lessonId}`} className="btn-link mt-3">
          {t('home.goToLesson')} <ArrowRight size={14} />
        </Link>
      </div>
    </section>
  );
}

export function PathsSection({ paths }: { paths: LearningPathSummary[] }) {
  const { t, tl } = useI18n();
  if (!paths.length) return null;
  return (
    <section
      className="mx-auto max-w-7xl scroll-mt-20 px-4 py-16"
      id="paths"
      aria-labelledby="paths-title"
    >
      <SectionHeading
        id="paths-title"
        title={t('home.pathsTitle')}
        subtitle={t('home.pathsSubtitle')}
      />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {paths.map((p) => {
          const Icon = ICONS[p.icon] ?? Route;
          return (
            <Link
              key={p.id}
              href={`/paths/${p.id}`}
              className="card card-hover group flex flex-col p-5"
            >
              <span className="mb-4 inline-flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <Icon size={20} />
              </span>
              <p className="font-semibold">{tl(p.title)}</p>
              <p className="mt-1 flex-1 text-sm text-muted">{tl(p.description)}</p>
              <p className="t-mono-label mt-4">
                {t('home.modulesCount', { count: p.moduleCount })} ·{' '}
                {t('home.lessons', { count: p.lessonCount })}
              </p>
            </Link>
          );
        })}
      </div>
    </section>
  );
}

export function ModulesSection({ modules }: { modules: ModuleSummary[] }) {
  const { t } = useI18n();
  const groups = MODULE_GROUPS.map(
    (g) => [g, modules.filter((m) => m.group === g)] as const,
  ).filter(([, items]) => items.length > 0);
  return (
    <section className="mx-auto max-w-7xl px-4 py-16" aria-labelledby="modules-title">
      <SectionHeading
        id="modules-title"
        title={t('home.modulesTitle')}
        subtitle={t('home.modulesSubtitle')}
        action={
          <Link href="/modules" className="btn-ghost">
            {t('home.allModules')} <ArrowRight size={14} />
          </Link>
        }
      />
      <div className="space-y-10">
        {groups.map(([group, items]) => (
          <div key={group}>
            <p className="t-eyebrow mb-3">{t(`module.groups.${group}` as 'module.groups.ai')}</p>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {items.map((m) => (
                <ModuleCard key={m.id} module={m} />
              ))}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

export function ModuleCard({ module: m }: { module: ModuleSummary }) {
  const { t, tl } = useI18n();
  const Icon = ICONS[m.icon] ?? Layers;
  const done = m.completedCount ?? 0;
  const pct = m.lessonCount ? Math.round((done / m.lessonCount) * 100) : 0;
  return (
    <Link
      href={`/modules/${m.id}`}
      className="card card-hover group relative flex gap-4 overflow-hidden p-5"
      style={{ ['--mod' as string]: m.color }}
    >
      <span
        className="absolute inset-x-0 top-0 h-1 opacity-80"
        style={{ background: m.color }}
        aria-hidden="true"
      />
      <span
        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-white shadow-card"
        style={{ background: m.color }}
      >
        <Icon size={20} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="t-mono-label">
          {m.code} · {t('home.lessons', { count: m.lessonCount })}
          {m.totalMinutes > 0 && (
            <>
              {' '}
              · <Clock size={11} className="inline -mt-0.5" /> {Math.round(m.totalMinutes / 60)} sa
            </>
          )}
        </p>
        <p className="mt-0.5 font-semibold leading-snug">{tl(m.title)}</p>
        <p className="mt-1 line-clamp-2 text-sm text-muted">{tl(m.description)}</p>
        {m.completedCount !== undefined && (
          <div className="mt-3 flex items-center gap-2">
            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-elevated">
              <div
                className="h-full rounded-full"
                style={{ width: `${pct}%`, background: m.color }}
              />
            </div>
            <span className="text-xs tabular-nums text-muted">
              {done}/{m.lessonCount}
            </span>
          </div>
        )}
      </div>
    </Link>
  );
}

export function FinalCta() {
  const { t } = useI18n();
  const authed = useIsAuthenticated();
  if (authed) return null;
  return (
    <section className="mx-auto max-w-7xl px-4 pb-8 pt-8">
      <div className="bg-glow relative overflow-hidden rounded-3xl border border-border bg-surface p-8 text-center sm:p-14">
        <div className="bg-dots absolute inset-0 -z-10 opacity-60" aria-hidden="true" />
        <h2 className="t-h1">{t('home.ctaTitle')}</h2>
        <p className="mx-auto mt-3 max-w-xl text-muted">{t('home.ctaText')}</p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Link href="/register" className="btn-primary btn-lg">
            {t('home.ctaButton')} <ArrowRight size={16} />
          </Link>
          <Link href="/modules" className="btn-ghost btn-lg">
            {t('nav.modules')}
          </Link>
        </div>
      </div>
    </section>
  );
}

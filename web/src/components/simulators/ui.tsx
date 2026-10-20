'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { FlaskConical, Maximize2, Minimize2, RotateCcw } from 'lucide-react';
import { useI18n } from '@/i18n';
import { cn } from '@/lib/utils';
import { useSimContext } from './sim-context';

/** Simülatörlerin ortak yerleşim parçaları — tutarlı görünüm için */

export function SimShell({
  title,
  toolbar,
  children,
  aside,
  className,
}: {
  title?: string;
  toolbar?: ReactNode;
  children: ReactNode;
  aside?: ReactNode;
  className?: string;
}) {
  const { t } = useI18n();
  const ctx = useSimContext();
  const root = useRef<HTMLElement>(null);
  const [fullscreen, setFullscreen] = useState(false);
  const heading = ctx.title ?? title;

  useEffect(() => {
    const onChange = () => setFullscreen(document.fullscreenElement === root.current);
    document.addEventListener('fullscreenchange', onChange);
    return () => document.removeEventListener('fullscreenchange', onChange);
  }, []);
  const toggleFullscreen = async () => {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await root.current?.requestFullscreen?.();
    } catch {
      /* desteklenmiyor */
    }
  };

  return (
    <section
      ref={root}
      className={cn(
        'card overflow-hidden',
        fullscreen && 'overflow-auto rounded-none border-0 bg-bg',
        className,
      )}
      aria-label={heading}
    >
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border px-4 py-3">
        <div className="flex min-w-0 items-start gap-3">
          <span className="mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-accent/15 text-accent-fg">
            <FlaskConical size={15} />
          </span>
          <div className="min-w-0">
            {heading && <p className="text-sm font-semibold leading-snug">{heading}</p>}
            <p className="mt-0.5 text-xs text-muted">
              {ctx.goal ? (
                <>
                  <span className="font-medium text-fg/80">{t('sim.goal')}:</span> {ctx.goal}
                </>
              ) : (
                t('sim.hint')
              )}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {toolbar}
          {ctx.onReset && (
            <button
              type="button"
              className="btn-icon btn-icon-sm"
              onClick={ctx.onReset}
              aria-label={t('sim.resetAll')}
              title={t('sim.resetAll')}
            >
              <RotateCcw size={14} />
            </button>
          )}
          <button
            type="button"
            className="btn-icon btn-icon-sm"
            onClick={toggleFullscreen}
            aria-label={fullscreen ? t('player.exitFullscreen') : t('sim.fullscreen')}
            title={fullscreen ? t('player.exitFullscreen') : t('sim.fullscreen')}
          >
            {fullscreen ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
          </button>
        </div>
      </div>
      <div className={cn('bg-dots grid gap-4 p-4', aside ? 'lg:grid-cols-[1fr_280px]' : '')}>
        <div className="min-w-0">{children}</div>
        {aside && <aside className="min-w-0 space-y-4 rounded-xl bg-surface/70 p-3">{aside}</aside>}
      </div>
    </section>
  );
}

export function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: ReactNode;
  tone?: 'success' | 'danger' | 'warning' | 'primary';
}) {
  return (
    <div className="rounded-xl border border-border bg-elevated/50 px-3 py-2">
      <p className="text-xs uppercase tracking-wide text-muted">{label}</p>
      <p
        className={cn(
          'text-lg font-semibold tabular-nums',
          tone === 'success' && 'text-success',
          tone === 'danger' && 'text-danger',
          tone === 'warning' && 'text-warning',
          tone === 'primary' && 'text-primary',
        )}
      >
        {value}
      </p>
    </div>
  );
}

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="label">{label}</span>
      {children}
    </label>
  );
}

export function Range({
  value,
  min,
  max,
  step = 1,
  onChange,
  label,
  format,
}: {
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (v: number) => void;
  label: string;
  format?: (v: number) => string;
}) {
  return (
    <label className="block">
      <span className="label flex justify-between">
        <span>{label}</span>
        <span className="tabular-nums text-fg">{format ? format(value) : value}</span>
      </span>
      <input
        type="range"
        className="w-full accent-[var(--da-primary)]"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
      />
    </label>
  );
}

export function Select<T extends string>({
  value,
  options,
  onChange,
  label,
}: {
  value: T;
  options: { id: T; label: string }[];
  onChange: (v: T) => void;
  label: string;
}) {
  return (
    <Field label={label}>
      <select className="input" value={value} onChange={(e) => onChange(e.target.value as T)}>
        {options.map((o) => (
          <option key={o.id} value={o.id}>
            {o.label}
          </option>
        ))}
      </select>
    </Field>
  );
}

export function LogList({
  items,
  empty = '—',
}: {
  items: { key: string | number; text: ReactNode; tone?: 'success' | 'danger' | 'muted' }[];
  empty?: string;
}) {
  return (
    <ol
      className="max-h-48 space-y-1 overflow-auto rounded-xl border border-border bg-bg/60 p-2 font-mono text-xs leading-5"
      aria-live="polite"
    >
      {items.length === 0 && <li className="text-muted">{empty}</li>}
      {items.map((i) => (
        <li
          key={i.key}
          className={cn(
            i.tone === 'success' && 'text-success',
            i.tone === 'danger' && 'text-danger',
            i.tone === 'muted' && 'text-muted',
          )}
        >
          {i.text}
        </li>
      ))}
    </ol>
  );
}

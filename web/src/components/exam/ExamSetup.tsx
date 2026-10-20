'use client';

import { useState } from 'react';
import { BriefcaseBusiness, Check, Clock, ListChecks, Loader2, Play } from 'lucide-react';
import type { CreateExamDto, ExamDto } from '@devacademy/shared';
import { useI18n } from '@/i18n';
import { ApiError } from '@/lib/api';
import { useAuthStore } from '@/lib/auth-store';
import { useCreateExam, useModules, usePaths } from '@/lib/hooks';
import { cn } from '@/lib/utils';

const COUNTS = [10, 20, 30] as const;
const DURATIONS = [15, 25, 40] as const;
const MAX_MODULES = 20;
type Source = 'all' | 'path' | 'modules';

/** Başlangıç ekranı: soru havuzu (tümü / yol / modüller), soru sayısı ve süre */
export function ExamSetup({ onCreated }: { onCreated: (exam: ExamDto) => void }) {
  const { t, tl } = useI18n();
  const selectedPathId = useAuthStore((s) => s.user?.selectedPathId ?? null);
  const { data: paths } = usePaths();
  const { data: modules } = useModules();
  const create = useCreateExam();
  const [source, setSource] = useState<Source>(selectedPathId ? 'path' : 'all');
  const [pathId, setPathId] = useState<string>(selectedPathId ?? '');
  const [moduleIds, setModuleIds] = useState<string[]>([]);
  const [count, setCount] = useState<number>(20);
  const [minutes, setMinutes] = useState<number>(25);
  const [error, setError] = useState<string | null>(null);

  const effectivePath = pathId || paths?.[0]?.id || '';
  const canStart =
    !create.isPending &&
    (source === 'all' || (source === 'path' && effectivePath) || moduleIds.length > 0);

  const toggleModule = (id: string) =>
    setModuleIds((cur) =>
      cur.includes(id)
        ? cur.filter((x) => x !== id)
        : cur.length >= MAX_MODULES
          ? cur
          : [...cur, id],
    );

  const start = async () => {
    setError(null);
    const dto: CreateExamDto = {
      count,
      durationSec: minutes * 60,
      ...(source === 'path' ? { pathId: effectivePath } : {}),
      ...(source === 'modules' ? { moduleIds } : {}),
    };
    try {
      onCreated(await create.mutateAsync(dto));
    } catch (err) {
      setError(
        err instanceof ApiError && (err.status === 404 || err.status >= 500)
          ? t('exam.unavailable')
          : t('exam.createError'),
      );
    }
  };

  const sources: { id: Source; label: string }[] = [
    { id: 'all', label: t('exam.sourceAll') },
    { id: 'path', label: t('exam.sourcePath') },
    { id: 'modules', label: t('exam.sourceModules') },
  ];

  return (
    <section className="card bg-glow p-6 sm:p-8">
      <h2 className="t-h3 flex items-center gap-2">
        <BriefcaseBusiness size={18} className="text-primary" /> {t('exam.setupTitle')}
      </h2>

      <fieldset className="mt-6">
        <legend className="label">{t('exam.source')}</legend>
        <Segmented value={source} options={sources} onChange={setSource} />
        {source === 'path' && (
          <select
            className="input mt-3 max-w-md"
            value={effectivePath}
            onChange={(e) => setPathId(e.target.value)}
            aria-label={t('exam.pickPath')}
          >
            {paths?.map((p) => (
              <option key={p.id} value={p.id}>
                {tl(p.title)}
              </option>
            ))}
          </select>
        )}
        {source === 'modules' && (
          <div className="mt-3">
            <p className="mb-2 text-xs text-muted">
              {t('exam.pickModules')} · {t('exam.selectedModules', { count: moduleIds.length })}
            </p>
            <div className="flex flex-wrap gap-2" role="group" aria-label={t('exam.pickModules')}>
              {modules
                ?.slice()
                .sort((a, b) => a.order - b.order)
                .map((m) => {
                  const on = moduleIds.includes(m.id);
                  return (
                    <button
                      key={m.id}
                      type="button"
                      aria-pressed={on}
                      onClick={() => toggleModule(m.id)}
                      className={cn(
                        'chip h-8 gap-1.5 px-3 transition',
                        on ? 'chip-primary' : 'hover:border-primary/40',
                      )}
                    >
                      {on ? <Check size={12} /> : <span className="font-mono">{m.code}</span>}
                      {tl(m.title)}
                    </button>
                  );
                })}
            </div>
          </div>
        )}
      </fieldset>

      <div className="mt-6 grid gap-6 sm:grid-cols-2">
        <fieldset>
          <legend className="label flex items-center gap-1">
            <ListChecks size={12} /> {t('exam.count')}
          </legend>
          <Segmented
            value={count}
            options={COUNTS.map((c) => ({ id: c, label: t('exam.questions', { count: c }) }))}
            onChange={setCount}
          />
        </fieldset>
        <fieldset>
          <legend className="label flex items-center gap-1">
            <Clock size={12} /> {t('exam.duration')}
          </legend>
          <Segmented
            value={minutes}
            options={DURATIONS.map((d) => ({ id: d, label: t('exam.minutes', { count: d }) }))}
            onChange={setMinutes}
          />
        </fieldset>
      </div>

      <p className="mt-6 text-sm text-muted">{t('exam.rules')}</p>
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button
          type="button"
          className="btn-primary btn-lg"
          onClick={() => void start()}
          disabled={!canStart}
        >
          {create.isPending ? <Loader2 size={18} className="animate-spin" /> : <Play size={18} />}
          {create.isPending ? t('exam.starting') : t('exam.start')}
        </button>
        {error && (
          <p className="text-sm text-danger-fg" role="alert">
            {error}
          </p>
        )}
      </div>
    </section>
  );
}

function Segmented<T extends string | number>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: { id: T; label: string }[];
  onChange: (v: T) => void;
}) {
  return (
    <div
      className="inline-flex flex-wrap gap-1 rounded-xl border border-border bg-elevated p-1"
      role="radiogroup"
    >
      {options.map((o) => (
        <button
          key={o.id}
          type="button"
          role="radio"
          aria-checked={value === o.id}
          onClick={() => onChange(o.id)}
          className={cn(
            'rounded-lg px-3 py-1.5 text-sm transition',
            value === o.id ? 'bg-surface font-medium shadow-card' : 'text-muted hover:text-fg',
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

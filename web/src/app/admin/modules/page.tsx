'use client';

import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { ChevronDown, Save } from 'lucide-react';
import { MODULE_GROUPS, type ModuleSummary } from '@devacademy/shared';
import { ICONS } from '@/components/home/Sections';
import { Skeleton } from '@/components/ui/Skeleton';
import { useOptionalToast } from '@/components/ui/Toast';
import { useI18n } from '@/i18n';
import { ApiError, api } from '@/lib/api';
import { useModules } from '@/lib/hooks';
import { cn, toLocalizedObject } from '@/lib/utils';

/** Modül editörü: başlık, açıklama, kod, sıra, ikon, renk ve grup (PUT /admin/modules) */
export default function AdminModules() {
  const { t } = useI18n();
  const { data, isLoading } = useModules();
  return (
    <div>
      <h1 className="t-h2">{t('admin.moduleEditor')}</h1>
      <p className="mb-6 mt-1 max-w-2xl text-sm text-muted">{t('admin.moduleEditorHint')}</p>
      {isLoading && (
        <div className="space-y-3" aria-busy="true">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </div>
      )}
      <ul className="space-y-3">
        {data?.map((m) => (
          <ModuleRow key={m.id} module={m} />
        ))}
      </ul>
    </div>
  );
}

function ModuleRow({ module: m }: { module: ModuleSummary }) {
  const { t, tl } = useI18n();
  const qc = useQueryClient();
  const { toast } = useOptionalToast();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    code: m.code,
    order: m.order,
    icon: m.icon,
    color: m.color,
    group: m.group,
    titleTr: toLocalizedObject(m.title).tr,
    titleEn: toLocalizedObject(m.title).en,
    descTr: toLocalizedObject(m.description).tr,
    descEn: toLocalizedObject(m.description).en,
  });
  const Icon = ICONS[form.icon] ?? ICONS.layers;

  const save = async () => {
    setError(null);
    setBusy(true);
    try {
      await api('/admin/modules', {
        method: 'PUT',
        body: {
          id: m.id,
          slug: m.slug,
          code: form.code,
          order: form.order,
          title: { tr: form.titleTr, en: form.titleEn || undefined },
          description: { tr: form.descTr, en: form.descEn || undefined },
          icon: form.icon,
          color: form.color,
          group: form.group,
        },
      });
      await qc.invalidateQueries({ queryKey: ['modules'] });
      toast({ title: t('admin.saved'), tone: 'success' });
    } catch (e) {
      setError(e instanceof ApiError ? (e.body.message ?? t('common.error')) : t('common.error'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <li className="card overflow-hidden">
      <button
        type="button"
        className="flex w-full items-center gap-3 p-4 text-left hover:bg-elevated/50"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
      >
        <span
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-white"
          style={{ background: form.color }}
        >
          <Icon size={16} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-semibold">
            {form.code} · {tl(m.title)}
          </span>
          <span className="block text-xs text-muted">
            {t(`module.groups.${m.group}` as 'module.groups.ai')} ·{' '}
            {t('admin.lessonCount', { count: m.lessonCount })}
          </span>
        </span>
        <ChevronDown size={16} className={cn('text-muted transition', open && 'rotate-180')} />
      </button>
      {open && (
        <div className="grid gap-3 border-t border-border p-4 sm:grid-cols-2 lg:grid-cols-3">
          <Field label={t('admin.code')}>
            <input
              className="input"
              value={form.code}
              maxLength={3}
              onChange={(e) => setForm((f) => ({ ...f, code: e.target.value.toUpperCase() }))}
            />
          </Field>
          <Field label={t('admin.order')}>
            <input
              type="number"
              className="input"
              min={1}
              value={form.order}
              onChange={(e) => setForm((f) => ({ ...f, order: Number(e.target.value) }))}
            />
          </Field>
          <Field label={t('admin.group')}>
            <select
              className="input"
              value={form.group}
              onChange={(e) =>
                setForm((f) => ({ ...f, group: e.target.value as ModuleSummary['group'] }))
              }
            >
              {MODULE_GROUPS.map((g) => (
                <option key={g} value={g}>
                  {t(`module.groups.${g}` as 'module.groups.ai')}
                </option>
              ))}
            </select>
          </Field>
          <Field label={t('admin.icon')}>
            <select
              className="input"
              value={form.icon}
              onChange={(e) => setForm((f) => ({ ...f, icon: e.target.value }))}
            >
              {Object.keys(ICONS).map((k) => (
                <option key={k} value={k}>
                  {k}
                </option>
              ))}
            </select>
          </Field>
          <Field label={t('admin.color')}>
            <div className="flex items-center gap-2">
              <input
                type="color"
                className="h-10 w-12 cursor-pointer rounded-lg border border-border bg-surface"
                value={form.color}
                onChange={(e) => setForm((f) => ({ ...f, color: e.target.value }))}
              />
              <input
                className="input font-mono text-xs"
                value={form.color}
                onChange={(e) => setForm((f) => ({ ...f, color: e.target.value }))}
              />
            </div>
          </Field>
          <Field label={t('admin.titleTr')}>
            <input
              className="input"
              value={form.titleTr}
              onChange={(e) => setForm((f) => ({ ...f, titleTr: e.target.value }))}
            />
          </Field>
          <Field label={t('admin.titleEn')}>
            <input
              className="input"
              value={form.titleEn}
              onChange={(e) => setForm((f) => ({ ...f, titleEn: e.target.value }))}
            />
          </Field>
          <Field label={t('admin.descTr')} className="lg:col-span-2">
            <textarea
              className="input"
              value={form.descTr}
              onChange={(e) => setForm((f) => ({ ...f, descTr: e.target.value }))}
            />
          </Field>
          <Field label={t('admin.descEn')} className="lg:col-span-2">
            <textarea
              className="input"
              value={form.descEn}
              onChange={(e) => setForm((f) => ({ ...f, descEn: e.target.value }))}
            />
          </Field>
          <div className="flex items-end gap-3 sm:col-span-2 lg:col-span-1">
            <button
              type="button"
              className="btn-primary"
              onClick={() => void save()}
              disabled={busy || !form.titleTr || !form.code}
            >
              <Save size={15} /> {t('admin.save')}
            </button>
            {error && (
              <p className="text-sm text-danger-fg" role="alert">
                {error}
              </p>
            )}
          </div>
        </div>
      )}
    </li>
  );
}

function Field({
  label,
  className,
  children,
}: {
  label: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <label className={cn('block', className)}>
      <span className="label">{label}</span>
      {children}
    </label>
  );
}

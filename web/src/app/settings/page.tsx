'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, KeyRound, LogOut, Settings, Trash2, UserRound } from 'lucide-react';
import { isValidTimeZone, t as tLocalized, type Locale } from '@devacademy/shared';
import { RequireAuth } from '@/components/auth/RequireAuth';
import { Dialog } from '@/components/ui/Dialog';
import { Skeleton } from '@/components/ui/Skeleton';
import { useOptionalToast } from '@/components/ui/Toast';
import { useI18n } from '@/i18n';
import { ApiError, api } from '@/lib/api';
import { useAuthStore } from '@/lib/auth-store';
import { useMe, usePaths, useUpdateProfile } from '@/lib/hooks';
import { useAction } from '@/lib/use-action';
import { formatDate } from '@/lib/utils';

const COMMON_TIMEZONES = [
  'Europe/Istanbul',
  'Europe/London',
  'Europe/Berlin',
  'America/New_York',
  'America/Los_Angeles',
  'Asia/Dubai',
  'Asia/Tokyo',
  'Australia/Sydney',
];

function SettingsView() {
  const { t, locale, setLocale } = useI18n();
  const { toast } = useOptionalToast();
  const { data: me, isLoading } = useMe();
  const { data: paths } = usePaths();
  const update = useUpdateProfile();
  const [form, setForm] = useState({
    displayName: '',
    avatarUrl: '',
    locale: 'tr' as Locale,
    timezone: 'Europe/Istanbul',
    reminderHour: null as number | null,
    selectedPathId: null as string | null,
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!me) return;
    setForm({
      displayName: me.displayName,
      avatarUrl: me.avatarUrl ?? '',
      locale: me.locale,
      timezone: me.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone,
      reminderHour: me.reminderHour,
      selectedPathId: me.selectedPathId,
    });
  }, [me]);

  const save = async () => {
    setErrors({});
    if (!isValidTimeZone(form.timezone)) {
      setErrors({ timezone: t('common.error') });
      return;
    }
    try {
      await update.mutateAsync({
        displayName: form.displayName.trim(),
        avatarUrl: form.avatarUrl.trim() ? form.avatarUrl.trim() : null,
        locale: form.locale,
        timezone: form.timezone,
        reminderHour: form.reminderHour,
        selectedPathId: form.selectedPathId,
      });
      if (form.locale !== locale) setLocale(form.locale);
      toast({ title: t('settings.saved'), tone: 'success' });
    } catch (err) {
      if (err instanceof ApiError && err.body.details)
        setErrors(Object.fromEntries(err.body.details.map((d) => [d.path, d.message])));
      else toast({ title: t('common.error'), tone: 'danger' });
    }
  };

  const timezones = Array.from(new Set([form.timezone, ...COMMON_TIMEZONES])).filter(Boolean);

  if (isLoading || !me)
    return (
      <div className="space-y-4" aria-busy="true">
        <Skeleton className="h-48 w-full rounded-2xl" />
        <Skeleton className="h-48 w-full rounded-2xl" />
      </div>
    );

  return (
    <div className="space-y-6">
      <section className="card p-6">
        <h2 className="t-h3 flex items-center gap-2">
          <UserRound size={16} className="text-primary" /> {t('settings.profile')}
        </h2>
        <p className="mt-1 text-xs text-muted">
          {t('settings.memberSince', { date: formatDate(me.createdAt, locale) })}
        </p>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <Field label={t('settings.displayName')} error={errors.displayName}>
            <input
              className="input"
              value={form.displayName}
              maxLength={60}
              onChange={(e) => setForm((f) => ({ ...f, displayName: e.target.value }))}
            />
          </Field>
          <Field label={t('settings.email')} hint={t('settings.emailHint')}>
            <input className="input" value={me.email} disabled />
          </Field>
          <Field label={t('settings.avatarUrl')} error={errors.avatarUrl} className="sm:col-span-2">
            <input
              className="input"
              value={form.avatarUrl}
              placeholder="https://…"
              onChange={(e) => setForm((f) => ({ ...f, avatarUrl: e.target.value }))}
            />
          </Field>
        </div>
      </section>

      <section className="card p-6">
        <h2 className="t-h3 flex items-center gap-2">
          <Settings size={16} className="text-primary" /> {t('settings.preferences')}
        </h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <Field label={t('settings.language')}>
            <select
              className="input"
              value={form.locale}
              onChange={(e) => setForm((f) => ({ ...f, locale: e.target.value as Locale }))}
            >
              <option value="tr">Türkçe</option>
              <option value="en">English</option>
            </select>
          </Field>
          <Field
            label={t('settings.timezone')}
            hint={t('settings.timezoneHint')}
            error={errors.timezone}
          >
            <select
              className="input"
              value={form.timezone}
              onChange={(e) => setForm((f) => ({ ...f, timezone: e.target.value }))}
            >
              {timezones.map((tz) => (
                <option key={tz} value={tz}>
                  {tz}
                </option>
              ))}
            </select>
          </Field>
          <Field label={t('settings.reminder')}>
            <select
              className="input"
              value={form.reminderHour ?? ''}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  reminderHour: e.target.value === '' ? null : Number(e.target.value),
                }))
              }
            >
              <option value="">{t('settings.noReminder')}</option>
              {Array.from({ length: 24 }, (_, h) => (
                <option key={h} value={h}>
                  {String(h).padStart(2, '0')}:00
                </option>
              ))}
            </select>
          </Field>
          <Field label={t('settings.path')}>
            <select
              className="input"
              value={form.selectedPathId ?? ''}
              onChange={(e) => setForm((f) => ({ ...f, selectedPathId: e.target.value || null }))}
            >
              <option value="">{t('settings.noPath')}</option>
              {paths?.map((p) => (
                <option key={p.id} value={p.id}>
                  {tLocalized(p.title, form.locale)}
                </option>
              ))}
            </select>
          </Field>
        </div>
        <div className="mt-5 flex items-center gap-3">
          <button
            type="button"
            className="btn-primary"
            onClick={() => void save()}
            disabled={update.isPending}
          >
            {t('settings.save')}
          </button>
        </div>
      </section>

      <SecuritySection />
      <DangerSection email={me.email} />
    </div>
  );
}

function Field({
  label,
  hint,
  error,
  className,
  children,
}: {
  label: string;
  hint?: string;
  error?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <label className={className}>
      <span className="label">{label}</span>
      {children}
      {error ? (
        <span className="mt-1 block text-xs text-danger">{error}</span>
      ) : (
        hint && <span className="mt-1 block text-xs text-muted">{hint}</span>
      )}
    </label>
  );
}

function SecuritySection() {
  const { t } = useI18n();
  const router = useRouter();
  const qc = useQueryClient();
  const { toast } = useOptionalToast();
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');

  const change = useAction(async () => {
    await api('/auth/change-password', {
      method: 'POST',
      body: { currentPassword: current, newPassword: next },
    });
    setCurrent('');
    setNext('');
    toast({ title: t('settings.passwordChanged'), tone: 'success', duration: 7000 });
  });
  const logoutEverywhere = useAction(async () => {
    try {
      await api('/auth/logout', { method: 'POST', body: { everywhere: true } });
    } finally {
      useAuthStore.getState().clear();
      qc.clear();
      router.push('/');
    }
  });

  return (
    <section className="card p-6">
      <h2 className="t-h3 flex items-center gap-2">
        <KeyRound size={16} className="text-primary" /> {t('settings.security')}
      </h2>
      <form
        className="mt-4 grid gap-4 sm:grid-cols-2"
        onSubmit={(e) => {
          e.preventDefault();
          void change.run();
        }}
      >
        <Field label={t('settings.currentPassword')}>
          <input
            type="password"
            className="input"
            autoComplete="current-password"
            value={current}
            onChange={(e) => setCurrent(e.target.value)}
            required
          />
        </Field>
        <Field label={t('settings.newPassword')} hint={t('settings.newPasswordHint')}>
          <input
            type="password"
            className="input"
            autoComplete="new-password"
            minLength={8}
            value={next}
            onChange={(e) => setNext(e.target.value)}
            required
          />
        </Field>
        <div className="flex flex-wrap items-center gap-3 sm:col-span-2">
          <button
            type="submit"
            className="btn-ghost"
            disabled={change.pending || next.length < 8 || !current}
          >
            {t('settings.changePassword')}
          </button>
          {change.error && (
            <p className="text-sm text-danger" role="alert">
              {change.error}
            </p>
          )}
        </div>
      </form>
      <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-5">
        <div>
          <p className="text-sm font-medium">{t('settings.logoutEverywhere')}</p>
          <p className="text-xs text-muted">{t('settings.logoutEverywhereHint')}</p>
        </div>
        <button
          type="button"
          className="btn-ghost"
          onClick={() => void logoutEverywhere.run()}
          disabled={logoutEverywhere.pending}
        >
          <LogOut size={15} /> {t('settings.logoutEverywhere')}
        </button>
      </div>
    </section>
  );
}

function DangerSection({ email }: { email: string }) {
  const { t } = useI18n();
  const router = useRouter();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [confirm, setConfirm] = useState('');
  const remove = useAction(async () => {
    await api('/users/me', { method: 'DELETE' });
    useAuthStore.getState().clear();
    qc.clear();
    router.push('/');
  });

  return (
    <section className="rounded-2xl border border-danger/40 bg-danger/5 p-6">
      <h2 className="t-h3 flex items-center gap-2 text-danger-fg">
        <AlertTriangle size={16} /> {t('settings.danger')}
      </h2>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-medium">{t('settings.deleteAccount')}</p>
          <p className="max-w-lg text-xs text-muted">{t('settings.deleteAccountHint')}</p>
        </div>
        <button type="button" className="btn-danger" onClick={() => setOpen(true)}>
          <Trash2 size={15} /> {t('settings.deleteAccount')}
        </button>
      </div>
      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title={t('settings.deleteConfirmTitle')}
        size="sm"
      >
        <p className="text-sm text-muted">{t('settings.deleteConfirmText')}</p>
        <input
          className="input mt-3"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          placeholder={email}
          autoComplete="off"
        />
        {remove.error && (
          <p className="mt-2 text-sm text-danger" role="alert">
            {remove.error}
          </p>
        )}
        <div className="mt-4 flex justify-end gap-2">
          <button type="button" className="btn-ghost" onClick={() => setOpen(false)}>
            {t('common.cancel')}
          </button>
          <button
            type="button"
            className="btn-danger"
            disabled={confirm.trim().toLowerCase() !== email.toLowerCase() || remove.pending}
            onClick={() => void remove.run()}
          >
            {t('settings.deleteConfirmButton')}
          </button>
        </div>
      </Dialog>
    </section>
  );
}

export default function SettingsPage() {
  const { t } = useI18n();
  return (
    <RequireAuth>
      <div className="mx-auto max-w-3xl px-4 py-10">
        <div className="mb-8">
          <h1 className="t-h1">{t('settings.title')}</h1>
          <p className="mt-1 text-muted">{t('settings.subtitle')}</p>
        </div>
        <SettingsView />
      </div>
    </RequireAuth>
  );
}

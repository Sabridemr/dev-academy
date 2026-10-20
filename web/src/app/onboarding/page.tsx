'use client';

import { Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Check, Route } from 'lucide-react';
import { RequireAuth } from '@/components/auth/RequireAuth';
import { ICONS } from '@/components/home/Sections';
import { useI18n } from '@/i18n';
import { usePaths, useUpdateProfile } from '@/lib/hooks';
import { cn } from '@/lib/utils';

function Onboarding() {
  const { t, tl } = useI18n();
  const router = useRouter();
  const params = useSearchParams();
  const { data: paths } = usePaths();
  const update = useUpdateProfile();
  const [selected, setSelected] = useState<string | null>(params.get('path'));
  const [hour, setHour] = useState<number | null>(20);

  const save = async () => {
    // Hata update.isError ile aşağıda gösterilir; yakalanmamış promise reddi olmasın
    await update
      .mutateAsync({
        selectedPathId: selected,
        reminderHour: hour,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      })
      .then(() => router.push('/dashboard'))
      .catch(() => undefined);
  };

  return (
    <div className="mx-auto max-w-4xl px-4 py-12">
      <p className="t-eyebrow mb-2">{t('nav.paths')}</p>
      <h1 className="t-h1">{t('onboarding.title')}</h1>
      <p className="mt-2 text-muted">{t('onboarding.subtitle')}</p>
      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3" role="radiogroup">
        {paths?.map((p) => {
          const Icon = ICONS[p.icon] ?? Route;
          const active = selected === p.id;
          return (
            <button
              key={p.id}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => setSelected(p.id)}
              className={cn(
                'card card-hover relative p-5 text-left',
                active ? 'border-primary ring-2 ring-primary/30' : '',
              )}
            >
              {active && <Check className="absolute right-4 top-4 text-primary" size={18} />}
              <Icon className="mb-3 text-primary" />
              <p className="font-semibold">{tl(p.title)}</p>
              <p className="mt-1 text-sm text-muted">{tl(p.description)}</p>
            </button>
          );
        })}
      </div>
      <div className="mt-8 card p-5">
        <label className="label" htmlFor="reminder">
          {t('onboarding.reminder')}
        </label>
        <select
          id="reminder"
          className="input max-w-xs"
          value={hour ?? ''}
          onChange={(e) => setHour(e.target.value === '' ? null : Number(e.target.value))}
        >
          <option value="">{t('onboarding.noReminder')}</option>
          {Array.from({ length: 24 }, (_, h) => (
            <option key={h} value={h}>
              {String(h).padStart(2, '0')}:00
            </option>
          ))}
        </select>
      </div>
      <button
        type="button"
        className="btn-primary btn-lg mt-6"
        disabled={!selected || update.isPending}
        onClick={save}
      >
        {t('onboarding.save')}
      </button>
      {update.isError && (
        <p className="mt-2 text-sm text-danger" role="alert">
          {t('common.error')}
        </p>
      )}
    </div>
  );
}

export default function OnboardingPage() {
  return (
    <RequireAuth>
      <Suspense>
        <Onboarding />
      </Suspense>
    </RequireAuth>
  );
}

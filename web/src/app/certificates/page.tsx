'use client';

import Link from 'next/link';
import { ArrowRight, Award, BookOpen, Copy, ExternalLink, Route } from 'lucide-react';
import type { CertificateDto } from '@devacademy/shared';
import { RequireAuth } from '@/components/auth/RequireAuth';
import { EmptyState } from '@/components/ui/EmptyState';
import { SkeletonCard } from '@/components/ui/Skeleton';
import { useOptionalToast } from '@/components/ui/Toast';
import { useI18n } from '@/i18n';
import { useCertificates } from '@/lib/hooks';
import { formatDate } from '@/lib/utils';

function CertificateList() {
  const { t } = useI18n();
  const { data, isLoading, isError } = useCertificates();

  if (isLoading)
    return (
      <div className="grid gap-4 sm:grid-cols-2" aria-busy="true">
        {Array.from({ length: 4 }).map((_, i) => (
          <SkeletonCard key={i} />
        ))}
      </div>
    );
  if (isError || !data?.length)
    return (
      <EmptyState
        className="card"
        icon={Award}
        title={isError ? t('certificates.error') : t('certificates.empty')}
        description={t('certificates.emptyHint')}
        action={
          <Link href="/modules" className="btn-primary">
            {t('nav.modules')} <ArrowRight size={16} />
          </Link>
        }
      />
    );
  return (
    <ul className="grid gap-4 sm:grid-cols-2">
      {data.map((c) => (
        <CertificateCard key={c.id} cert={c} />
      ))}
    </ul>
  );
}

function CertificateCard({ cert: c }: { cert: CertificateDto }) {
  const { t, tl, locale } = useI18n();
  const { toast } = useOptionalToast();
  const href = `/certificates/${c.publicId}`;
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}${href}`);
      toast({ title: t('certificates.copied'), tone: 'success' });
    } catch {
      toast({ title: t('certificates.copyFailed'), tone: 'danger' });
    }
  };
  const TargetIcon = c.targetType === 'path' ? Route : BookOpen;
  return (
    <li className="card bg-glow relative flex flex-col overflow-hidden p-5">
      <div
        className="absolute inset-x-0 top-0 h-1"
        style={{ background: 'var(--da-gradient)' }}
        aria-hidden="true"
      />
      <div className="flex items-start gap-3">
        <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-warning/15 text-warning-fg">
          <Award size={22} />
        </span>
        <div className="min-w-0">
          <p className="t-eyebrow flex items-center gap-1">
            <TargetIcon size={12} />
            {c.targetType === 'path' ? t('certificates.path') : t('certificates.module')}
          </p>
          <h2 className="t-h3 mt-0.5">{tl(c.title)}</h2>
          <p className="mt-1 text-xs text-muted">
            {t('certificates.issuedAt', { date: formatDate(c.issuedAt, locale) })} ·{' '}
            {t('certificates.lessons', { count: c.lessonCount })}
          </p>
        </div>
      </div>
      <div className="mt-5 flex flex-wrap gap-2">
        <Link href={href} className="btn-primary btn-sm">
          <ExternalLink size={13} /> {t('certificates.view')}
        </Link>
        <button type="button" className="btn-ghost btn-sm" onClick={() => void copy()}>
          <Copy size={13} /> {t('certificates.copyLink')}
        </button>
      </div>
    </li>
  );
}

export default function CertificatesPage() {
  const { t } = useI18n();
  return (
    <RequireAuth>
      <div className="mx-auto max-w-5xl px-4 py-10">
        <div className="mb-8">
          <h1 className="t-h1">{t('certificates.title')}</h1>
          <p className="mt-1 text-muted">{t('certificates.subtitle')}</p>
        </div>
        <CertificateList />
      </div>
    </RequireAuth>
  );
}

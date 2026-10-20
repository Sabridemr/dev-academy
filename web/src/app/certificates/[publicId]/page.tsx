import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Award, BadgeCheck, GraduationCap } from 'lucide-react';
import { t as tl } from '@devacademy/shared';
import { PrintButton } from '@/components/certificates/PrintButton';
import { serverLocale } from '@/lib/metadata';
import { serverT } from '@/lib/server-i18n';
import { getPublicCertificate } from './data';

type Params = { params: Promise<{ publicId: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { publicId } = await params;
  const locale = await serverLocale();
  const t = serverT(locale);
  const cert = await getPublicCertificate(publicId).catch(() => null);
  if (!cert) return { title: t('certificates.notFound'), robots: { index: false } };
  const title = `${tl(cert.title, locale)} · ${cert.userName}`;
  const description = t('certificates.metaDescription', {
    name: cert.userName,
    title: tl(cert.title, locale),
  });
  return {
    title,
    description,
    openGraph: { title, description, type: 'article' },
    twitter: { card: 'summary_large_image', title, description },
  };
}

/** Herkese açık sertifika doğrulama sayfası (sunucu bileşeni; yazdırmaya uygun) */
export default async function PublicCertificatePage({ params }: Params) {
  const { publicId } = await params;
  const locale = await serverLocale();
  const t = serverT(locale);
  const cert = await getPublicCertificate(publicId);
  if (!cert) notFound();

  const title = tl(cert.title, locale);
  const issued = new Date(cert.issuedAt).toLocaleDateString(locale === 'tr' ? 'tr-TR' : 'en-US', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  return (
    <div className="certificate-page mx-auto max-w-4xl px-4 py-10">
      <div className="no-print mb-6 flex flex-wrap items-center justify-between gap-3">
        <p className="chip border-success/40 bg-success/10 text-success-fg">
          <BadgeCheck size={13} /> {t('certificates.verified')}
        </p>
        <PrintButton label={t('certificates.print')} />
      </div>

      <article
        className="certificate-sheet relative overflow-hidden rounded-3xl border-2 border-border bg-surface p-8 text-center shadow-card sm:p-14"
        aria-labelledby="cert-title"
      >
        <div className="bg-glow absolute inset-0 -z-0 opacity-70" aria-hidden="true" />
        <div
          className="absolute inset-3 rounded-[1.25rem] border border-primary/30 sm:inset-5"
          aria-hidden="true"
        />
        <div className="relative">
          <div className="flex items-center justify-center gap-2 font-bold">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-primary-fg">
              <GraduationCap size={19} />
            </span>
            DevAcademy
          </div>
          <p className="t-eyebrow mt-8">{t('certificates.heading')}</p>
          <p className="mt-6 text-sm text-muted">{t('certificates.presentedTo')}</p>
          <h1 id="cert-title" className="t-display mt-3 break-words">
            {cert.userName}
          </h1>
          <p className="mx-auto mt-6 max-w-xl text-lg">
            {t('certificates.completedText', { title, count: cert.lessonCount })}
          </p>
          <div className="mx-auto mt-10 grid max-w-lg gap-6 text-sm sm:grid-cols-2">
            <div>
              <p className="t-eyebrow">{t('certificates.date')}</p>
              <p className="mt-1 font-semibold">
                <time dateTime={cert.issuedAt}>{issued}</time>
              </p>
            </div>
            <div>
              <p className="t-eyebrow">{t('certificates.id')}</p>
              <p className="mt-1 break-all font-mono text-xs font-semibold">{cert.publicId}</p>
            </div>
          </div>
          <span
            className="mx-auto mt-10 flex h-16 w-16 items-center justify-center rounded-full bg-warning/15 text-warning-fg"
            aria-hidden="true"
          >
            <Award size={30} />
          </span>
          <p className="mx-auto mt-6 max-w-md text-xs text-muted">{t('certificates.verifyNote')}</p>
        </div>
      </article>

      <p className="no-print mt-6 text-center">
        <Link href="/" className="btn-link">
          {t('certificates.explore')}
        </Link>
      </p>
    </div>
  );
}

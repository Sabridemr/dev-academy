import { ImageResponse } from 'next/og';
import { t as tl } from '@devacademy/shared';
import { serverLocale } from '@/lib/metadata';
import { serverT } from '@/lib/server-i18n';
import { getPublicCertificate } from './data';

export const alt = 'DevAcademy certificate';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

// ImageResponse CSS değişkenlerini çözemez: koyu tema token'larının sabit karşılıkları
const C = {
  bg: '#0a0f1e',
  surface: '#111a2e',
  border: '#243352',
  fg: '#e6edf7',
  muted: '#8b9bb8',
  primary: '#4f8cff',
  accent: '#22d3ee',
  warning: '#fbbf24',
};

export default async function Image({ params }: { params: Promise<{ publicId: string }> }) {
  const { publicId } = await params;
  const locale = await serverLocale();
  const t = serverT(locale);
  const cert = await getPublicCertificate(publicId).catch(() => null);
  const title = cert ? tl(cert.title, locale) : t('certificates.notFound');

  return new ImageResponse(
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        padding: 64,
        backgroundColor: C.bg,
        backgroundImage:
          'radial-gradient(70% 60% at 15% 0%, rgba(79,140,255,0.35), transparent 70%)',
        color: C.fg,
        fontFamily: 'sans-serif',
        border: `12px solid ${C.surface}`,
      }}
    >
      <div
        style={{ display: 'flex', alignItems: 'center', gap: 16, fontSize: 32, fontWeight: 700 }}
      >
        <div
          style={{
            width: 56,
            height: 56,
            borderRadius: 16,
            background: C.primary,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: C.bg,
            fontSize: 24,
          }}
        >
          DA
        </div>
        DevAcademy
      </div>
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        <div
          style={{
            fontSize: 26,
            letterSpacing: 4,
            textTransform: 'uppercase',
            color: C.accent,
          }}
        >
          {t('certificates.heading')}
        </div>
        <div style={{ fontSize: 76, fontWeight: 800, marginTop: 18, lineHeight: 1.05 }}>
          {cert?.userName ?? '—'}
        </div>
        <div style={{ fontSize: 38, marginTop: 22, color: C.muted, lineHeight: 1.25 }}>{title}</div>
      </div>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          fontSize: 24,
          color: C.muted,
          borderTop: `2px solid ${C.border}`,
          paddingTop: 24,
        }}
      >
        <span>
          {cert
            ? new Date(cert.issuedAt).toLocaleDateString(locale === 'tr' ? 'tr-TR' : 'en-US', {
                day: 'numeric',
                month: 'long',
                year: 'numeric',
              })
            : ''}
        </span>
        <span style={{ color: C.warning }}>
          {cert ? t('certificates.lessons', { count: cert.lessonCount }) : ''}
        </span>
      </div>
    </div>,
    size,
  );
}

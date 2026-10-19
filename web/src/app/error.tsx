'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { useI18n } from '@/i18n';

/** Yakalanmamış render hatası: beyaz ekran yerine tekrar deneme ve ana sayfa bağlantısı */
export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const { t } = useI18n();
  useEffect(() => {
    console.error(error);
  }, [error]);
  return (
    <div className="mx-auto max-w-xl px-4 py-24 text-center" role="alert">
      <p className="text-2xl font-bold text-danger">{t('common.error')}</p>
      {error.digest && <p className="mt-2 text-xs text-muted">#{error.digest}</p>}
      <div className="mt-6 flex justify-center gap-3">
        <button type="button" className="btn-primary" onClick={reset}>
          {t('common.retry')}
        </button>
        <Link href="/" className="btn-ghost">
          DevAcademy
        </Link>
      </div>
    </div>
  );
}

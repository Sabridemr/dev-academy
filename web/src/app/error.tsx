'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { TriangleAlert } from 'lucide-react';
import { useI18n } from '@/i18n';
import { EmptyState } from '@/components/ui/EmptyState';

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
    <div className="mx-auto max-w-xl px-4 py-16" role="alert">
      <EmptyState
        icon={TriangleAlert}
        title={t('common.error')}
        description={t('common.errorHint')}
        action={
          <>
            <button type="button" className="btn-primary" onClick={reset}>
              {t('common.retry')}
            </button>
            <Link href="/" className="btn-ghost">
              {t('common.goHome')}
            </Link>
          </>
        }
      />
      {error.digest && (
        <p className="mt-2 text-center font-mono text-xs text-muted">#{error.digest}</p>
      )}
    </div>
  );
}

'use client';

import Link from 'next/link';
import { WifiOff } from 'lucide-react';
import { EmptyState } from '@/components/ui/EmptyState';
import { useI18n } from '@/i18n';

/** Service worker'ın ağ yokken gösterdiği yedek sayfa (kurulumda önbelleğe alınır) */
export default function OfflinePage() {
  const { t } = useI18n();
  return (
    <div className="mx-auto max-w-xl px-4 py-16">
      <EmptyState
        icon={WifiOff}
        title={t('offline.title')}
        description={t('offline.text')}
        action={
          <>
            <button type="button" className="btn-primary" onClick={() => window.location.reload()}>
              {t('offline.retry')}
            </button>
            <Link href="/" className="btn-ghost">
              {t('common.goHome')}
            </Link>
          </>
        }
      />
    </div>
  );
}

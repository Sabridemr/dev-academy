'use client';

import Link from 'next/link';
import { Compass } from 'lucide-react';
import { useI18n } from '@/i18n';
import { EmptyState } from '@/components/ui/EmptyState';

export default function NotFound() {
  const { t } = useI18n();
  return (
    <div className="mx-auto max-w-xl px-4 py-16">
      <p className="t-display t-gradient text-center">404</p>
      <EmptyState
        icon={Compass}
        title={t('common.notFound')}
        description={t('common.notFoundHint')}
        action={
          <>
            <Link href="/" className="btn-primary">
              {t('common.goHome')}
            </Link>
            <Link href="/modules" className="btn-ghost">
              {t('nav.modules')}
            </Link>
          </>
        }
      />
    </div>
  );
}

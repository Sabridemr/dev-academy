'use client';

import { useEffect, type ReactNode } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { ShieldAlert } from 'lucide-react';
import { useAuthStore, useIsAuthenticated } from '@/lib/auth-store';
import { useI18n } from '@/i18n';
import { EmptyState } from '../ui/EmptyState';
import { Skeleton, SkeletonCard } from '../ui/Skeleton';

/** Oturum gerektiren sayfalar için istemci koruması (localStorage hydrate olana kadar bekler) */
export function RequireAuth({
  children,
  roles,
}: {
  children: ReactNode;
  roles?: ('admin' | 'editor' | 'student')[];
}) {
  const hydrated = useAuthStore((s) => s.hydrated);
  const user = useAuthStore((s) => s.user);
  const authed = useIsAuthenticated();
  const router = useRouter();
  const pathname = usePathname();
  const { t } = useI18n();

  useEffect(() => {
    if (hydrated && !authed) router.replace(`/login?next=${encodeURIComponent(pathname)}`);
  }, [hydrated, authed, router, pathname]);

  if (!hydrated || !authed)
    return (
      <div
        className="mx-auto max-w-6xl px-4 py-10"
        aria-busy="true"
        aria-label={t('common.checkingSession')}
      >
        <Skeleton className="h-9 w-48" />
        <div className="mt-6 grid gap-4 md:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      </div>
    );
  if (roles && user && user.role !== 'admin' && !roles.includes(user.role)) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-16">
        <EmptyState
          icon={ShieldAlert}
          title={t('admin.forbidden')}
          description={t('common.forbiddenHint')}
          action={
            <Link href="/" className="btn-primary">
              {t('common.goHome')}
            </Link>
          }
        />
      </div>
    );
  }
  return <>{children}</>;
}

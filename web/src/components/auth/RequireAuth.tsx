'use client';

import { useEffect, type ReactNode } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useAuthStore, useIsAuthenticated } from '@/lib/auth-store';
import { useI18n } from '@/i18n';

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
    return <div className="mx-auto max-w-4xl px-4 py-16 text-muted">{t('common.loading')}</div>;
  if (roles && user && user.role !== 'admin' && !roles.includes(user.role)) {
    return <div className="mx-auto max-w-4xl px-4 py-16 text-muted">{t('admin.forbidden')}</div>;
  }
  return <>{children}</>;
}

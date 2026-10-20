'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Boxes, Clapperboard, FileText, LayoutDashboard } from 'lucide-react';
import type { ReactNode } from 'react';
import { RequireAuth } from '@/components/auth/RequireAuth';
import { useI18n } from '@/i18n';
import { cn } from '@/lib/utils';

export default function AdminLayout({ children }: { children: ReactNode }) {
  const { t } = useI18n();
  const pathname = usePathname();
  const links = [
    { href: '/admin', label: t('admin.stats'), icon: LayoutDashboard, exact: true },
    { href: '/admin/lessons', label: t('admin.lessons'), icon: FileText },
    { href: '/admin/scenes', label: t('admin.scenes'), icon: Clapperboard },
    { href: '/admin/modules', label: t('admin.modules'), icon: Boxes },
  ];
  return (
    <RequireAuth roles={['editor', 'admin']}>
      <div className="mx-auto grid max-w-[1400px] gap-6 px-4 py-8 lg:grid-cols-[200px_minmax(0,1fr)]">
        <nav className="space-y-1" aria-label={t('admin.title')}>
          <p className="label mb-2">{t('admin.title')}</p>
          {links.map((l) => {
            const active = l.exact ? pathname === l.href : pathname.startsWith(l.href);
            return (
              <Link
                key={l.href}
                href={l.href}
                className={cn(
                  'flex items-center gap-2 rounded-lg px-3 py-2 text-sm',
                  active ? 'bg-elevated font-medium' : 'text-muted hover:text-fg',
                )}
              >
                <l.icon size={16} /> {l.label}
              </Link>
            );
          })}
        </nav>
        <div className="min-w-0">{children}</div>
      </div>
    </RequireAuth>
  );
}

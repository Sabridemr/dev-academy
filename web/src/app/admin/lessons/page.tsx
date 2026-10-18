'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import type { LocalizedString, Paginated } from '@devacademy/shared';
import { useI18n } from '@/i18n';
import { api } from '@/lib/api';

interface Row {
  id: string;
  slug: string;
  moduleId: string;
  order: number;
  title: LocalizedString;
  publishedVersion: number | null;
  draftVersion: number | null;
  updatedAt: string;
}

export default function AdminLessons() {
  const { t, tl } = useI18n();
  const { data, isLoading } = useQuery({ queryKey: ['admin-lessons'], queryFn: () => api<Paginated<Row>>('/admin/lessons?pageSize=200') });
  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold">{t('admin.lessons')}</h1>
      {isLoading && <div className="card h-64 animate-pulse" />}
      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-elevated/60 text-left text-xs uppercase text-muted">
            <tr>
              <th className="px-4 py-2">ID</th>
              <th className="px-4 py-2">{t('admin.lessons')}</th>
              <th className="px-4 py-2">{t('admin.published')}</th>
              <th className="px-4 py-2">{t('admin.draft')}</th>
              <th className="px-4 py-2" />
            </tr>
          </thead>
          <tbody>
            {data?.items.map((r) => (
              <tr key={r.id} className="border-t border-border">
                <td className="px-4 py-2 font-mono text-xs">{r.id}</td>
                <td className="px-4 py-2">{tl(r.title)}</td>
                <td className="px-4 py-2">{r.publishedVersion ? <span className="chip border-success text-success">v{r.publishedVersion}</span> : '—'}</td>
                <td className="px-4 py-2">{r.draftVersion ? <span className="chip border-warning text-warning">v{r.draftVersion}</span> : '—'}</td>
                <td className="px-4 py-2 text-right">
                  <Link href={`/admin/lessons/${r.id}`} className="btn-ghost py-1">
                    {t('admin.edit')}
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

'use client';

import { useQuery } from '@tanstack/react-query';
import { useI18n } from '@/i18n';
import { api } from '@/lib/api';

interface Stats {
  users: number;
  lessons: number;
  published: number;
  scenes: number;
  quizzes: number;
  attempts: number;
  activeToday: number;
}

export default function AdminHome() {
  const { t } = useI18n();
  const { data } = useQuery({
    queryKey: ['admin-stats'],
    queryFn: () => api<Stats>('/admin/stats'),
  });
  const items: [string, number | undefined][] = [
    [t('admin.users'), data?.users],
    [t('admin.lessons'), data?.lessons],
    [t('admin.published'), data?.published],
    [t('admin.scenes'), data?.scenes],
    [t('admin.quizzes'), data?.quizzes],
    [t('admin.attempts'), data?.attempts],
    [t('admin.activeToday'), data?.activeToday],
  ];
  return (
    <div>
      <h1 className="t-h2 mb-6">{t('admin.stats')}</h1>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {items.map(([label, value]) => (
          <div key={label} className="card p-5">
            <p className="label">{label}</p>
            <p className="text-3xl font-bold tabular-nums">{value ?? '—'}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { Plus } from 'lucide-react';
import type { LocalizedString } from '@devacademy/shared';
import { useI18n } from '@/i18n';
import { api } from '@/lib/api';

interface SceneRow {
  id: string;
  lessonId: string | null;
  version: number;
  status: string;
  title: LocalizedString;
  updatedAt: string;
}

export default function AdminScenes() {
  const { t, tl } = useI18n();
  const { data } = useQuery({ queryKey: ['admin-scenes'], queryFn: () => api<SceneRow[]>('/admin/scenes') });
  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold">{t('admin.scenes')}</h1>
        <Link href="/admin/scenes/new" className="btn-primary"><Plus size={14} /> {t('admin.sceneEditor')}</Link>
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        {data?.map((s) => (
          <Link key={s.id} href={`/admin/scenes/${s.id}`} className="card p-4 hover:border-primary">
            <p className="font-mono text-xs text-muted">{s.id} · v{s.version} · {s.status}</p>
            <p className="font-semibold">{tl(s.title)}</p>
            <p className="text-xs text-muted">{s.lessonId}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}

'use client';

import Link from 'next/link';
import { Bookmark, NotebookPen, Trash2 } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { RequireAuth } from '@/components/auth/RequireAuth';
import { useI18n } from '@/i18n';
import { api } from '@/lib/api';
import { useBookmarks, useNotes } from '@/lib/hooks';

function Library() {
  const { t, tl, locale } = useI18n();
  const qc = useQueryClient();
  const { data: bookmarks } = useBookmarks();
  const { data: notes } = useNotes();

  const remove = async (path: string, key: string) => {
    await api(path, { method: 'DELETE' });
    await qc.invalidateQueries({ queryKey: [key] });
  };

  return (
    <div className="mx-auto grid max-w-6xl gap-6 px-4 py-10 lg:grid-cols-2">
      <section className="card p-5">
        <h2 className="mb-4 flex items-center gap-2 font-semibold"><Bookmark size={16} /> {t('library.bookmarks')}</h2>
        {!bookmarks?.length && <p className="text-sm text-muted">{t('library.empty')}</p>}
        <ul className="divide-y divide-border">
          {bookmarks?.map((b) => (
            <li key={b.id} className="flex items-center justify-between gap-2 py-2">
              <Link href={`/lessons/${b.lessonId}${b.blockId ? `#block-${b.blockId}` : ''}`} className="text-sm hover:text-primary">
                {tl(b.lesson.title)}
              </Link>
              <button type="button" className="btn-icon h-8 w-8" onClick={() => remove(`/bookmarks/${b.id}`, 'bookmarks')} aria-label={t('library.delete')}><Trash2 size={14} /></button>
            </li>
          ))}
        </ul>
      </section>
      <section className="card p-5">
        <h2 className="mb-4 flex items-center gap-2 font-semibold"><NotebookPen size={16} /> {t('library.notes')}</h2>
        {!notes?.length && <p className="text-sm text-muted">{t('library.empty')}</p>}
        <ul className="space-y-3">
          {notes?.map((n) => (
            <li key={n.id} className="rounded-xl bg-elevated/60 p-3">
              <p className="whitespace-pre-wrap text-sm">{n.body}</p>
              <div className="mt-2 flex items-center justify-between text-xs text-muted">
                <Link href={`/lessons/${n.lessonId}`} className="hover:text-primary">{n.lessonId}</Link>
                <span>{new Date(n.updatedAt).toLocaleDateString(locale === 'tr' ? 'tr-TR' : 'en-US')}</span>
                <button type="button" onClick={() => remove(`/notes/${n.id}`, 'notes')} className="hover:text-danger">{t('library.delete')}</button>
              </div>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

export default function LibraryPage() {
  return (
    <RequireAuth>
      <Library />
    </RequireAuth>
  );
}

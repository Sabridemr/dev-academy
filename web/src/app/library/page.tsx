'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Bookmark, BookOpen, Download, NotebookPen, Pencil, Trash2 } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import type { NoteDto } from '@devacademy/shared';
import { RequireAuth } from '@/components/auth/RequireAuth';
import { EmptyState } from '@/components/ui/EmptyState';
import { useOptionalToast } from '@/components/ui/Toast';
import { useI18n } from '@/i18n';
import { api } from '@/lib/api';
import { useAction } from '@/lib/use-action';
import { useBookmarks, useNotes } from '@/lib/hooks';
import { formatDate } from '@/lib/utils';

function Library() {
  const { t, tl, locale } = useI18n();
  const qc = useQueryClient();
  const { toast } = useOptionalToast();
  const { data: bookmarks } = useBookmarks();
  const { data: notes } = useNotes();

  const remove = useAction(async (path: string, key: string) => {
    await api(path, { method: 'DELETE' });
    await qc.invalidateQueries({ queryKey: [key] });
  });

  const exportNotes = () => {
    if (!notes?.length) return;
    const md = notes
      .map((n) => {
        const title = n.lesson ? tl(n.lesson.title) : n.lessonId;
        return `## ${title}\n\n${n.body}\n\n_${formatDate(n.updatedAt, locale)}_\n`;
      })
      .join('\n');
    const blob = new Blob([`# DevAcademy — ${t('library.notes')}\n\n${md}`], {
      type: 'text/markdown;charset=utf-8',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'devacademy-notlar.md';
    a.click();
    URL.revokeObjectURL(url);
    toast({ title: t('library.exportNotes'), tone: 'success' });
  };

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <div className="mb-8">
        <h1 className="t-h1">{t('library.title')}</h1>
        <p className="mt-1 text-muted">{t('library.subtitle')}</p>
      </div>
      {remove.error && (
        <p className="mb-4 text-sm text-danger" role="alert">
          {t('common.error')}: {remove.error}
        </p>
      )}
      <div className="grid gap-6 lg:grid-cols-2">
        <section className="card p-5">
          <h2 className="t-h3 mb-4 flex items-center gap-2">
            <Bookmark size={16} className="text-primary" /> {t('library.bookmarks')}
            <span className="chip ml-auto">{bookmarks?.length ?? 0}</span>
          </h2>
          {!bookmarks?.length ? (
            <EmptyState
              compact
              icon={Bookmark}
              title={t('library.empty')}
              description={t('library.noBookmarksHint')}
              action={
                <Link href="/modules" className="btn-ghost btn-sm">
                  <BookOpen size={14} /> {t('library.browseLessons')}
                </Link>
              }
            />
          ) : (
            <ul className="divide-y divide-border">
              {bookmarks.map((b) => (
                <li key={b.id} className="flex items-center justify-between gap-2 py-2.5">
                  <Link
                    href={`/lessons/${b.lessonId}${b.blockId ? `#block-${b.blockId}` : ''}`}
                    className="min-w-0 flex-1 text-sm hover:text-primary"
                  >
                    <span className="block truncate font-medium">{tl(b.lesson.title)}</span>
                    <span className="block text-xs text-muted">
                      {formatDate(b.createdAt, locale)}
                    </span>
                  </Link>
                  <button
                    type="button"
                    className="btn-icon btn-icon-sm"
                    onClick={() => void remove.run(`/bookmarks/${b.id}`, 'bookmarks')}
                    disabled={remove.pending}
                    aria-label={t('library.delete')}
                  >
                    <Trash2 size={14} />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
        <section className="card p-5">
          <h2 className="t-h3 mb-4 flex items-center gap-2">
            <NotebookPen size={16} className="text-accent-fg" /> {t('library.notes')}
            <span className="chip ml-auto">{notes?.length ?? 0}</span>
            {Boolean(notes?.length) && (
              <button type="button" className="btn-ghost btn-sm" onClick={exportNotes}>
                <Download size={13} /> {t('library.exportNotes')}
              </button>
            )}
          </h2>
          {!notes?.length ? (
            <EmptyState
              compact
              icon={NotebookPen}
              title={t('library.empty')}
              description={t('library.noNotesHint')}
            />
          ) : (
            <ul className="space-y-3">
              {notes.map((n) => (
                <NoteItem
                  key={n.id}
                  note={n}
                  onDelete={() => void remove.run(`/notes/${n.id}`, 'notes')}
                  deleting={remove.pending}
                />
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}

function NoteItem({
  note: n,
  onDelete,
  deleting,
}: {
  note: NoteDto;
  onDelete: () => void;
  deleting: boolean;
}) {
  const { t, tl, locale } = useI18n();
  const qc = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(n.body);
  const save = useAction(async () => {
    const body = draft.trim();
    if (!body || body === n.body) {
      setEditing(false);
      return;
    }
    await api(`/notes/${n.id}`, { method: 'PATCH', body: { body } });
    await qc.invalidateQueries({ queryKey: ['notes'] });
    setEditing(false);
  });
  const title = n.lesson ? tl(n.lesson.title) : n.lessonId;

  return (
    <li className="rounded-xl border border-border bg-elevated/40 p-3">
      <Link
        href={`/lessons/${n.lessonId}`}
        className="text-xs font-medium text-primary hover:underline"
      >
        {title}
      </Link>
      {editing ? (
        <div className="mt-2">
          <textarea
            className="input min-h-[80px]"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            maxLength={5000}
            autoFocus
          />
          <div className="mt-2 flex gap-2">
            <button
              type="button"
              className="btn-primary btn-sm"
              onClick={() => void save.run()}
              disabled={save.pending}
            >
              {t('library.save')}
            </button>
            <button
              type="button"
              className="btn-ghost btn-sm"
              onClick={() => {
                setDraft(n.body);
                setEditing(false);
              }}
            >
              {t('library.cancel')}
            </button>
          </div>
          {save.error && (
            <p className="mt-1 text-xs text-danger" role="alert">
              {save.error}
            </p>
          )}
        </div>
      ) : (
        <p className="mt-1 whitespace-pre-wrap text-sm">{n.body}</p>
      )}
      <div className="mt-2 flex items-center justify-between text-xs text-muted">
        <span>{formatDate(n.updatedAt, locale)}</span>
        <span className="flex gap-3">
          {!editing && (
            <button
              type="button"
              onClick={() => setEditing(true)}
              className="inline-flex items-center gap-1 hover:text-fg"
            >
              <Pencil size={12} /> {t('library.edit')}
            </button>
          )}
          <button
            type="button"
            onClick={onDelete}
            disabled={deleting}
            className="inline-flex items-center gap-1 hover:text-danger"
          >
            <Trash2 size={12} /> {t('library.delete')}
          </button>
        </span>
      </div>
    </li>
  );
}

export default function LibraryPage() {
  return (
    <RequireAuth>
      <Library />
    </RequireAuth>
  );
}

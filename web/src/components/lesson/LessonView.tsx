'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { Bookmark, BookmarkCheck, CheckCircle2, ChevronLeft, ChevronRight, Clock, NotebookPen, Trash2 } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import type { LessonDetail } from '@devacademy/shared';
import { useI18n } from '@/i18n';
import { api } from '@/lib/api';
import { useIsAuthenticated } from '@/lib/auth-store';
import { useBookmarks, useLesson, useNotes, useUpdateProgress } from '@/lib/hooks';
import { cn } from '@/lib/utils';
import { BlockRenderer } from './BlockRenderer';
import { slugify } from './Markdown';

/**
 * Ders görüntüleyici: blokları sırayla çizer, görünür olan blokları IntersectionObserver ile izleyip
 * ilerleme yüzdesini sunucuya (debounce ile) yazar; yer imi ve not panelini içerir.
 */
export function LessonView({ initial }: { initial: LessonDetail }) {
  const { t, tl } = useI18n();
  const authed = useIsAuthenticated();
  const { data } = useLesson(initial.id, initial);
  const lesson = data ?? initial;
  const progress = useUpdateProgress(lesson.id);
  const seen = useRef(new Set<string>());
  const startedAt = useRef(Date.now());
  const [percent, setPercent] = useState(lesson.progress?.percent ?? 0);
  const completed = lesson.progress?.status === 'completed' || percent >= 100;

  // Görünen blokları izle
  useEffect(() => {
    const els = document.querySelectorAll<HTMLElement>('[data-block-id]');
    const observer = new IntersectionObserver(
      (entries) => {
        for (const e of entries) if (e.isIntersecting) seen.current.add(e.target.getAttribute('data-block-id')!);
        const p = Math.round((seen.current.size / Math.max(1, lesson.blocks.length)) * 100);
        setPercent((cur) => Math.max(cur, Math.min(p, 95))); // %100'ü yalnızca "tamamla" ya da quiz verir
      },
      { threshold: 0.4 },
    );
    els.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [lesson.blocks.length, lesson.id]);

  // İlerlemeyi 5 sn'de bir ve sayfadan çıkarken kaydet
  const lastSent = useRef(0);
  useEffect(() => {
    if (!authed) return;
    const flush = () => {
      if (percent <= lastSent.current && Date.now() - startedAt.current < 30_000) return;
      const secondsSpent = Math.round((Date.now() - startedAt.current) / 1000);
      startedAt.current = Date.now();
      lastSent.current = percent;
      const lastBlockId = Array.from(seen.current).at(-1);
      progress.mutate({ percent, lastBlockId, secondsSpent });
    };
    const id = setInterval(flush, 5000);
    window.addEventListener('beforeunload', flush);
    return () => {
      clearInterval(id);
      window.removeEventListener('beforeunload', flush);
      flush();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authed, percent]);

  const markComplete = () => {
    setPercent(100);
    progress.mutate({ percent: 100, completed: true, secondsSpent: Math.round((Date.now() - startedAt.current) / 1000) });
    startedAt.current = Date.now();
  };

  const toc = useMemo(
    () =>
      lesson.blocks.flatMap((b) => {
        if (b.type !== 'text') return [];
        return Array.from(b.markdown.matchAll(/^##\s+(.+)$/gm)).map((m) => ({ id: slugify(m[1]), title: m[1] }));
      }),
    [lesson.blocks],
  );

  return (
    <div className="mx-auto grid max-w-7xl gap-8 px-4 py-8 lg:grid-cols-[minmax(0,1fr)_260px]">
      <article className="min-w-0">
        <nav className="mb-4 text-sm text-muted" aria-label="breadcrumb">
          <Link href="/modules" className="hover:text-fg">
            {t('nav.modules')}
          </Link>{' '}
          /{' '}
          <Link href={`/modules/${lesson.module.id}`} className="hover:text-fg">
            {lesson.module.code} · {tl(lesson.module.title)}
          </Link>
        </nav>
        <header className="mb-8">
          <h1 className="text-3xl font-bold tracking-tight md:text-4xl">{tl(lesson.title)}</h1>
          <p className="mt-3 max-w-prose text-lg text-muted">{tl(lesson.summary)}</p>
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <span className="chip">
              <Clock size={12} /> {t('module.minutes', { count: lesson.durationMinutes })}
            </span>
            <span className="chip">{t(`module.level.${lesson.level}` as 'module.level.beginner')}</span>
            {lesson.tags.slice(0, 4).map((tag) => (
              <span key={tag} className="chip">
                #{tag}
              </span>
            ))}
          </div>
        </header>

        <div className="space-y-8">
          {lesson.blocks.map((b) => (
            <div key={b.id} data-block-id={b.id} id={`block-${b.id}`} className="scroll-mt-24">
              <BlockRenderer block={b} lesson={lesson} />
            </div>
          ))}
        </div>

        <footer className="mt-12 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-6">
          {lesson.prev ? (
            <Link href={`/lessons/${lesson.prev.id}`} className="btn-ghost">
              <ChevronLeft size={16} /> {tl(lesson.prev.title)}
            </Link>
          ) : (
            <span />
          )}
          {authed && (
            <button type="button" className={cn(completed ? 'btn-ghost text-success' : 'btn-primary')} onClick={markComplete} disabled={completed}>
              <CheckCircle2 size={16} /> {completed ? t('lesson.completed') : t('lesson.markComplete')}
            </button>
          )}
          {lesson.next ? (
            <Link href={`/lessons/${lesson.next.id}`} className="btn-ghost">
              {tl(lesson.next.title)} <ChevronRight size={16} />
            </Link>
          ) : (
            <span />
          )}
        </footer>
      </article>

      <aside className="space-y-4 lg:sticky lg:top-20 lg:h-fit">
        {authed && (
          <div className="card p-4">
            <p className="label">{t('lesson.progress')}</p>
            <div className="h-2 overflow-hidden rounded-full bg-elevated" role="progressbar" aria-valuenow={percent} aria-valuemin={0} aria-valuemax={100}>
              <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${percent}%` }} />
            </div>
            <p className="mt-1 text-right text-xs text-muted">%{percent}</p>
          </div>
        )}
        {toc.length > 0 && (
          <nav className="card p-4 text-sm" aria-label={t('lesson.onThisPage')}>
            <p className="label">{t('lesson.onThisPage')}</p>
            <ul className="space-y-1.5">
              {toc.map((h) => (
                <li key={h.id}>
                  <a href={`#${h.id}`} className="text-muted hover:text-fg">
                    {h.title}
                  </a>
                </li>
              ))}
            </ul>
          </nav>
        )}
        {authed && <LessonTools lessonId={lesson.id} />}
      </aside>
    </div>
  );
}

function LessonTools({ lessonId }: { lessonId: string }) {
  const { t } = useI18n();
  const qc = useQueryClient();
  const { data: bookmarks } = useBookmarks();
  const { data: notes } = useNotes(lessonId);
  const [draft, setDraft] = useState('');
  const bookmark = bookmarks?.find((b) => b.lessonId === lessonId && !b.blockId);

  const toggleBookmark = async () => {
    if (bookmark) await api(`/bookmarks/${bookmark.id}`, { method: 'DELETE' });
    else await api('/bookmarks', { method: 'POST', body: { lessonId } });
    await qc.invalidateQueries({ queryKey: ['bookmarks'] });
  };
  const saveNote = async () => {
    if (!draft.trim()) return;
    await api('/notes', { method: 'POST', body: { lessonId, body: draft.trim() } });
    setDraft('');
    await qc.invalidateQueries({ queryKey: ['notes'] });
  };
  const deleteNote = async (id: string) => {
    await api(`/notes/${id}`, { method: 'DELETE' });
    await qc.invalidateQueries({ queryKey: ['notes'] });
  };

  return (
    <div className="card space-y-3 p-4">
      <button type="button" className="btn-ghost w-full" onClick={toggleBookmark} aria-pressed={Boolean(bookmark)}>
        {bookmark ? <BookmarkCheck size={16} className="text-primary" /> : <Bookmark size={16} />}
        {bookmark ? t('lesson.bookmarked') : t('lesson.bookmark')}
      </button>
      <div>
        <p className="label flex items-center gap-1">
          <NotebookPen size={12} /> {t('lesson.notes')}
        </p>
        <textarea className="input min-h-[80px]" value={draft} onChange={(e) => setDraft(e.target.value)} placeholder={t('lesson.notePlaceholder')} maxLength={5000} />
        <button type="button" className="btn-primary mt-2 w-full" onClick={saveNote} disabled={!draft.trim()}>
          {t('lesson.saveNote')}
        </button>
        <ul className="mt-3 space-y-2">
          {notes?.map((n) => (
            <li key={n.id} className="group rounded-lg bg-elevated/60 p-2 text-sm">
              <p className="whitespace-pre-wrap">{n.body}</p>
              <button type="button" className="mt-1 inline-flex items-center gap-1 text-xs text-muted hover:text-danger" onClick={() => deleteNote(n.id)}>
                <Trash2 size={12} /> {t('library.delete')}
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

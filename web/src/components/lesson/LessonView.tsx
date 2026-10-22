'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import {
  Bookmark,
  BookmarkCheck,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Circle,
  CircleDot,
  Clapperboard,
  Clock,
  Code2,
  FlaskConical,
  ListChecks,
  ListTree,
  NotebookPen,
  TerminalSquare,
  Trash2,
} from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { isLessonBodyTranslated, type LessonDetail } from '@devacademy/shared';
import { useI18n } from '@/i18n';
import { api } from '@/lib/api';
import { useAction } from '@/lib/use-action';
import { useIsAuthenticated } from '@/lib/auth-store';
import { useBookmarks, useLesson, useModule, useNotes, useUpdateProgress } from '@/lib/hooks';
import { cn, formatPercent } from '@/lib/utils';
import { Dialog } from '../ui/Dialog';
import { useOptionalToast } from '../ui/Toast';
import { LessonConcepts } from '../glossary/LessonConcepts';
import { BlockRenderer } from './BlockRenderer';
import { LessonFinish } from './LessonFinish';
import { markdownHeadingText, slugify } from './Markdown';

interface TocItem {
  id: string;
  title: string;
  kind: 'heading' | 'animation' | 'interactive' | 'quiz' | 'trace' | 'exercise';
}

const BLOCK_ICONS = {
  animation: Clapperboard,
  interactive: FlaskConical,
  quiz: ListChecks,
  trace: Code2,
  exercise: TerminalSquare,
} as const;

/**
 * Ders görüntüleyici. Üç sütun (xl+): modül ders listesi · içerik · içindekiler + araçlar.
 * Görünür blokları IntersectionObserver ile izleyip ilerleme yüzdesini sunucuya (debounce ile) yazar;
 * içindekilerde aktif bölüm vurgulanır; mobilde üstte yapışkan ilerleme çubuğu ve alttan açılan panel vardır.
 */
export function LessonView({ initial }: { initial: LessonDetail }) {
  const { t, tl, locale } = useI18n();
  const authed = useIsAuthenticated();
  const { data } = useLesson(initial.id, initial);
  const lesson = data ?? initial;
  const { data: moduleDetail } = useModule(lesson.module.id);
  const progress = useUpdateProgress(lesson.id);
  const { toast } = useOptionalToast();
  const seen = useRef(new Set<string>());
  const startedAt = useRef(Date.now());
  const [percent, setPercent] = useState(lesson.progress?.percent ?? 0);
  const percentRef = useRef(percent);
  percentRef.current = percent;
  const completed = lesson.progress?.status === 'completed' || percent >= 100;
  const [activeId, setActiveId] = useState<string | null>(null);
  const [sheet, setSheet] = useState<'contents' | 'tools' | null>(null);

  // SSR yanıtı misafir olarak alınır (ilerleme yok); oturumlu veri gelince sunucudaki ilerlemeyi yansıt
  const serverPercent = data?.progress?.percent;
  useEffect(() => {
    if (serverPercent != null) setPercent((cur) => Math.max(cur, serverPercent));
  }, [serverPercent]);

  // Görünen blokları izle (ilerleme)
  useEffect(() => {
    const els = document.querySelectorAll<HTMLElement>('[data-block-id]');
    const observer = new IntersectionObserver(
      (entries) => {
        for (const e of entries)
          if (e.isIntersecting) seen.current.add(e.target.getAttribute('data-block-id')!);
        const p = Math.round((seen.current.size / Math.max(1, lesson.blocks.length)) * 100);
        setPercent((cur) => Math.max(cur, Math.min(p, 95))); // %100'ü yalnızca "tamamla" ya da quiz verir
      },
      { threshold: 0.4 },
    );
    els.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [lesson.blocks.length, lesson.id]);

  const toc = useMemo<TocItem[]>(
    () =>
      lesson.blocks.flatMap((b): TocItem[] => {
        if (b.type === 'text') {
          // Gövdeyle aynı dildeki Markdown ve aynı başlık metni → bağlantılar Markdown'daki id'lerle eşleşir
          const markdown = locale === 'en' && b.markdownEn ? b.markdownEn : b.markdown;
          return Array.from(markdown.matchAll(/^##\s+(.+)$/gm)).map((m) => {
            const title = markdownHeadingText(m[1]);
            return { id: slugify(title), title, kind: 'heading' };
          });
        }
        if (
          b.type === 'animation' ||
          b.type === 'interactive' ||
          b.type === 'quiz' ||
          b.type === 'trace' ||
          b.type === 'exercise'
        ) {
          const label =
            b.type === 'interactive' && b.title
              ? tl(b.title)
              : b.type === 'trace' && b.title
                ? tl(b.title)
                : b.type === 'exercise' && b.exercise
                  ? tl(b.exercise.title)
                  : t(`lesson.blockLabels.${b.type}` as 'lesson.blockLabels.quiz');
          return [{ id: `block-${b.id}`, title: label, kind: b.type }];
        }
        return [];
      }),
    [lesson.blocks, locale, t, tl],
  );

  // Aktif içindekiler maddesi: görünüm alanının üst %30'unu geçen son başlık/blok.
  // Öğeler her ölçümde yeniden sorgulanır; içerik yüksekliği değişince (Shiki, lazy simülatör)
  // ResizeObserver tetikler, scroll olayları rAF ile tek ölçüme indirgenir.
  const tocIds = useMemo(() => toc.map((i) => i.id).join('|'), [toc]);
  useEffect(() => {
    if (!tocIds) return;
    const ids = tocIds.split('|');
    let raf = 0;
    const measure = () => {
      raf = 0;
      const line = window.innerHeight * 0.3;
      let current: string | null = null;
      for (const id of ids) {
        const el = document.getElementById(id);
        if (!el) continue;
        if (el.getBoundingClientRect().top <= line) current = id;
        else break;
      }
      setActiveId(current ?? ids[0] ?? null);
    };
    const schedule = () => {
      if (!raf) raf = requestAnimationFrame(measure);
    };
    measure();
    window.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('resize', schedule);
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(schedule) : null;
    ro?.observe(document.body);
    return () => {
      if (raf) cancelAnimationFrame(raf);
      window.removeEventListener('scroll', schedule);
      window.removeEventListener('resize', schedule);
      ro?.disconnect();
    };
  }, [tocIds, lesson.id]);

  // İlerlemeyi 5 sn'de bir ve sayfa gizlenirken/kapanırken kaydet.
  // Yüzde ref'ten okunur: efekt her yüzde değişiminde yeniden kurulup ekstra istek atmaz.
  const lastSent = useRef(0);
  const mutateRef = useRef(progress.mutate);
  mutateRef.current = progress.mutate;
  useEffect(() => {
    if (!authed) return;
    const build = () => {
      const current = percentRef.current;
      if (current <= lastSent.current && Date.now() - startedAt.current < 30_000) return null;
      const secondsSpent = Math.round((Date.now() - startedAt.current) / 1000);
      startedAt.current = Date.now();
      lastSent.current = current;
      return { percent: current, lastBlockId: Array.from(seen.current).at(-1), secondsSpent };
    };
    const flush = () => {
      const dto = build();
      if (dto) mutateRef.current(dto);
    };
    // Sayfa kapanırken normal fetch iptal edilebilir; keepalive isteği tarayıcı kapansa da tamamlanır
    // (sendBeacon Authorization başlığı taşıyamadığı için kullanılmaz)
    const flushOnLeave = () => {
      const dto = build();
      if (dto)
        void api(`/progress/lessons/${lesson.id}`, {
          method: 'PUT',
          body: dto,
          keepalive: true,
        }).catch(() => undefined);
    };
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') flushOnLeave();
    };
    const id = setInterval(flush, 5000);
    window.addEventListener('pagehide', flushOnLeave);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      clearInterval(id);
      window.removeEventListener('pagehide', flushOnLeave);
      document.removeEventListener('visibilitychange', onVisibility);
      flush();
    };
  }, [authed, lesson.id]);

  const markComplete = () => {
    setPercent(100);
    progress.mutate({
      percent: 100,
      completed: true,
      secondsSpent: Math.round((Date.now() - startedAt.current) / 1000),
    });
    startedAt.current = Date.now();
    toast({ title: t('lesson.completedToast'), description: tl(lesson.title), tone: 'success' });
  };

  const counts = {
    animation: lesson.blocks.filter((b) => b.type === 'animation').length,
    interactive: lesson.blocks.filter((b) => b.type === 'interactive').length,
    quiz: lesson.blocks.filter((b) => b.type === 'quiz').length,
    trace: lesson.blocks.filter((b) => b.type === 'trace').length,
    exercise: lesson.blocks.filter((b) => b.type === 'exercise').length,
  };
  const moduleColor = moduleDetail?.color ?? 'var(--da-primary)';
  const lessonIndex = moduleDetail?.lessons.findIndex((l) => l.id === lesson.id) ?? -1;
  const lessonTotal = moduleDetail?.lessons.length ?? 0;

  const tocNav = (onPick?: () => void) => (
    <nav aria-label={t('lesson.onThisPage')}>
      <ul className="space-y-0.5">
        {toc.map((h) => {
          const Icon = h.kind === 'heading' ? null : BLOCK_ICONS[h.kind];
          const active = activeId === h.id;
          return (
            <li key={h.id}>
              <a
                href={`#${h.id}`}
                onClick={onPick}
                aria-current={active ? 'location' : undefined}
                className={cn(
                  'flex items-center gap-2 rounded-lg border-l-2 py-1.5 pl-3 pr-2 text-sm transition',
                  active
                    ? 'border-primary bg-primary/10 font-medium text-fg'
                    : 'border-transparent text-muted hover:bg-elevated hover:text-fg',
                )}
              >
                {Icon && <Icon size={13} className="shrink-0 text-accent-fg" />}
                <span className="line-clamp-2">{h.title}</span>
              </a>
            </li>
          );
        })}
      </ul>
    </nav>
  );

  return (
    <>
      {/* Mobil/tablet: yapışkan ince ilerleme çubuğu */}
      <div className="sticky top-16 z-30 h-1 bg-elevated xl:hidden" aria-hidden="true">
        <div
          className="h-full transition-[width] duration-300"
          style={{ width: `${percent}%`, background: moduleColor }}
        />
      </div>

      <div className="mx-auto grid max-w-[88rem] gap-8 px-4 py-8 xl:grid-cols-[230px_minmax(0,1fr)_260px]">
        {/* Sol: modül dersleri */}
        <aside className="hidden xl:block">
          <div className="sticky top-24 max-h-[calc(100vh-7rem)] overflow-y-auto pr-2">
            <Link
              href={`/modules/${lesson.module.id}`}
              className="t-eyebrow mb-3 flex items-center gap-1.5 hover:text-fg"
            >
              <ChevronLeft size={13} /> {lesson.module.code} · {tl(lesson.module.title)}
            </Link>
            {moduleDetail ? (
              <ol className="space-y-0.5" aria-label={t('lesson.moduleLessons')}>
                {moduleDetail.lessons.map((l, i) => {
                  const status = l.progress?.status ?? 'not_started';
                  const StatusIcon =
                    status === 'completed'
                      ? CheckCircle2
                      : status === 'in_progress'
                        ? CircleDot
                        : Circle;
                  const current = l.id === lesson.id;
                  return (
                    <li key={l.id}>
                      <Link
                        href={`/lessons/${l.id}`}
                        aria-current={current ? 'page' : undefined}
                        className={cn(
                          'flex items-start gap-2 rounded-lg px-2 py-1.5 text-sm transition',
                          current
                            ? 'bg-elevated font-medium text-fg'
                            : 'text-muted hover:bg-elevated/60 hover:text-fg',
                        )}
                      >
                        <StatusIcon
                          size={14}
                          className={cn(
                            'mt-0.5 shrink-0',
                            status === 'completed'
                              ? 'text-success-fg'
                              : status === 'in_progress' || current
                                ? 'text-primary'
                                : 'text-border',
                          )}
                        />
                        <span className="line-clamp-2">
                          <span className="mr-1 tabular-nums text-muted">{i + 1}.</span>
                          {tl(l.title)}
                        </span>
                      </Link>
                    </li>
                  );
                })}
              </ol>
            ) : null}
          </div>
        </aside>

        {/* Orta: içerik */}
        <article className="min-w-0">
          <nav className="mb-4 text-sm text-muted xl:hidden" aria-label="breadcrumb">
            <Link href="/modules" className="hover:text-fg">
              {t('nav.modules')}
            </Link>{' '}
            <span aria-hidden="true">›</span>{' '}
            <Link href={`/modules/${lesson.module.id}`} className="hover:text-fg">
              {lesson.module.code} · {tl(lesson.module.title)}
            </Link>
          </nav>
          <header className="relative mb-10 border-l-4 pl-5" style={{ borderColor: moduleColor }}>
            {lessonIndex >= 0 && (
              <p className="t-mono-label mb-2" style={{ color: moduleColor }}>
                {t('lesson.lessonOf', { current: lessonIndex + 1, total: lessonTotal })}
              </p>
            )}
            <h1 className="t-h1">{tl(lesson.title)}</h1>
            <p className="mt-3 max-w-prose text-lg text-muted">{tl(lesson.summary)}</p>
            {locale === 'en' && !isLessonBodyTranslated(lesson.blocks) && (
              <p className="mt-3 rounded-lg border border-border bg-elevated/60 px-3 py-2 text-sm text-muted">
                {t('lesson.notTranslated')}
              </p>
            )}
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <span className="chip">
                <Clock size={12} /> {t('module.minutes', { count: lesson.durationMinutes })}
              </span>
              <span className="chip">
                {t(`module.level.${lesson.level}` as 'module.level.beginner')}
              </span>
              {counts.animation > 0 && (
                <span className="chip">
                  <Clapperboard size={12} /> {t('module.animations', { count: counts.animation })}
                </span>
              )}
              {counts.interactive > 0 && (
                <span className="chip">
                  <FlaskConical size={12} />{' '}
                  {t('module.interactives', { count: counts.interactive })}
                </span>
              )}
              {counts.trace > 0 && (
                <span className="chip">
                  <Code2 size={12} /> {t('lesson.blockLabels.trace')}
                </span>
              )}
              {counts.exercise > 0 && (
                <span className="chip">
                  <TerminalSquare size={12} /> {t('lesson.blockLabels.exercise')}
                </span>
              )}
              {counts.quiz > 0 && (
                <span className="chip">
                  <ListChecks size={12} /> {t('module.hasQuiz')}
                </span>
              )}
              {lesson.tags.slice(0, 3).map((tag) => (
                <span key={tag} className="chip hidden sm:inline-flex">
                  #{tag}
                </span>
              ))}
            </div>
            <LessonConcepts concepts={lesson.concepts} />
          </header>

          <div className="space-y-8">
            {lesson.blocks.map((b) => (
              <div key={b.id} data-block-id={b.id} id={`block-${b.id}`} className="scroll-mt-24">
                <BlockRenderer block={b} lesson={lesson} />
              </div>
            ))}
          </div>

          <LessonFinish
            lesson={lesson}
            completed={completed}
            authed={authed}
            pending={progress.isPending}
            onComplete={markComplete}
          />

          <footer className="mt-8 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-6">
            {lesson.prev ? (
              <Link href={`/lessons/${lesson.prev.id}`} className="btn-ghost max-w-full">
                <ChevronLeft size={16} />
                <span className="truncate">{tl(lesson.prev.title)}</span>
              </Link>
            ) : (
              <span />
            )}
            {lesson.next ? (
              <Link href={`/lessons/${lesson.next.id}`} className="btn-ghost max-w-full">
                <span className="truncate">{tl(lesson.next.title)}</span>
                <ChevronRight size={16} />
              </Link>
            ) : (
              <span />
            )}
          </footer>
        </article>

        {/* Sağ: ilerleme, içindekiler, araçlar (xl altında alttan açılır) */}
        <aside className="hidden xl:block">
          <div className="sticky top-24 max-h-[calc(100vh-7rem)] space-y-4 overflow-y-auto pb-4">
            <div className="card p-4">
              <div className="mb-2 flex items-center justify-between">
                <p className="label mb-0">
                  {authed ? t('lesson.progress') : t('lesson.readingProgress')}
                </p>
                <span className="text-xs tabular-nums text-muted">
                  {formatPercent(percent, locale)}
                </span>
              </div>
              <div
                className="h-2 overflow-hidden rounded-full bg-elevated"
                role="progressbar"
                aria-valuenow={percent}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label={t('lesson.progress')}
              >
                <div
                  className="h-full rounded-full transition-all"
                  style={{ width: `${percent}%`, background: moduleColor }}
                />
              </div>
              {completed && (
                <p className="mt-2 flex items-center gap-1 text-xs text-success-fg">
                  <CheckCircle2 size={12} /> {t('lesson.completed')}
                </p>
              )}
            </div>
            {toc.length > 0 && (
              <div className="card p-3">
                <p className="label px-2">{t('lesson.onThisPage')}</p>
                {tocNav()}
              </div>
            )}
            {authed && <LessonTools lessonId={lesson.id} />}
          </div>
        </aside>
      </div>

      {/* Mobil: alttan açılan içindekiler/araçlar */}
      <div className="fixed bottom-4 right-4 z-30 flex gap-2 xl:hidden">
        {toc.length > 0 && (
          <button
            type="button"
            className="btn-ghost shadow-pop"
            onClick={() => setSheet('contents')}
            aria-label={t('lesson.contents')}
          >
            <ListTree size={16} /> <span className="hidden sm:inline">{t('lesson.contents')}</span>
          </button>
        )}
        {authed && (
          <button
            type="button"
            className="btn-primary shadow-pop"
            onClick={() => setSheet('tools')}
            aria-label={t('lesson.tools')}
          >
            <NotebookPen size={16} /> <span className="hidden sm:inline">{t('lesson.tools')}</span>
          </button>
        )}
      </div>
      <Dialog
        open={sheet === 'contents'}
        onClose={() => setSheet(null)}
        title={t('lesson.onThisPage')}
        size="sm"
      >
        {tocNav(() => setSheet(null))}
      </Dialog>
      <Dialog
        open={sheet === 'tools'}
        onClose={() => setSheet(null)}
        title={t('lesson.tools')}
        size="sm"
      >
        {authed && <LessonTools lessonId={lesson.id} bare />}
      </Dialog>
    </>
  );
}

function LessonTools({ lessonId, bare = false }: { lessonId: string; bare?: boolean }) {
  const { t } = useI18n();
  const qc = useQueryClient();
  const { data: bookmarks } = useBookmarks();
  const { data: notes } = useNotes(lessonId);
  const [draft, setDraft] = useState('');
  const bookmark = bookmarks?.find((b) => b.lessonId === lessonId && !b.blockId);

  const toggleBookmark = useAction(async () => {
    if (bookmark) await api(`/bookmarks/${bookmark.id}`, { method: 'DELETE' });
    else await api('/bookmarks', { method: 'POST', body: { lessonId } });
    await qc.invalidateQueries({ queryKey: ['bookmarks'] });
  });
  const saveNote = useAction(async () => {
    if (!draft.trim()) return;
    await api('/notes', { method: 'POST', body: { lessonId, body: draft.trim() } });
    setDraft('');
    await qc.invalidateQueries({ queryKey: ['notes'] });
  });
  const deleteNote = useAction(async (id: string) => {
    await api(`/notes/${id}`, { method: 'DELETE' });
    await qc.invalidateQueries({ queryKey: ['notes'] });
  });
  const actionError = toggleBookmark.error ?? saveNote.error ?? deleteNote.error;

  return (
    <div className={cn('space-y-3', !bare && 'card p-4')}>
      <button
        type="button"
        className="btn-ghost w-full"
        onClick={() => void toggleBookmark.run()}
        disabled={toggleBookmark.pending}
        aria-pressed={Boolean(bookmark)}
      >
        {bookmark ? <BookmarkCheck size={16} className="text-primary" /> : <Bookmark size={16} />}
        {bookmark ? t('lesson.bookmarked') : t('lesson.bookmark')}
      </button>
      <div>
        <p className="label flex items-center gap-1">
          <NotebookPen size={12} /> {t('lesson.notes')}
        </p>
        <textarea
          className="input min-h-[80px]"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder={t('lesson.notePlaceholder')}
          maxLength={5000}
        />
        <button
          type="button"
          className="btn-primary mt-2 w-full"
          onClick={() => void saveNote.run()}
          disabled={!draft.trim() || saveNote.pending}
        >
          {t('lesson.saveNote')}
        </button>
        <ul className="mt-3 space-y-2">
          {notes?.map((n) => (
            <li key={n.id} className="group rounded-lg bg-elevated/60 p-2 text-sm">
              <p className="whitespace-pre-wrap">{n.body}</p>
              <button
                type="button"
                className="mt-1 inline-flex items-center gap-1 text-xs text-muted hover:text-danger"
                onClick={() => void deleteNote.run(n.id)}
                disabled={deleteNote.pending}
              >
                <Trash2 size={12} /> {t('library.delete')}
              </button>
            </li>
          ))}
        </ul>
        {actionError && (
          <p className="mt-2 text-xs text-danger" role="alert">
            {t('common.error')}: {actionError}
          </p>
        )}
      </div>
    </div>
  );
}

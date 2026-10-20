'use client';

import { use, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useQueryClient } from '@tanstack/react-query';
import { Plus, Save, Trash2 } from 'lucide-react';
import {
  QuizQuestionSchema,
  QuizSchema,
  type LocalizedString,
  type QuizPublic,
  type QuizQuestion,
} from '@devacademy/shared';
import { useI18n } from '@/i18n';
import { ApiError, api } from '@/lib/api';
import { useOptionalToast } from '@/components/ui/Toast';
import { Skeleton } from '@/components/ui/Skeleton';
import { cn, toLocalizedObject } from '@/lib/utils';

/** Admin uç noktasının döndürdüğü Prisma satırı (doğru cevaplar dahil) */
interface QuizFull {
  id: string;
  lessonId: string;
  title: LocalizedString;
  passScore: number;
  questions: {
    key: string;
    order: number;
    type: QuizQuestion['type'];
    prompt: LocalizedString;
    options: QuizQuestion['options'];
    correct: string[];
    explanation: LocalizedString;
    difficulty: QuizQuestion['difficulty'];
    concepts: string[];
    archived: boolean;
  }[];
}

const NEW_QUESTION: QuizQuestion = {
  id: 'q-new',
  type: 'single',
  prompt: { tr: 'Soru metni', en: 'Question text' },
  options: [
    { id: 'a', text: { tr: 'Seçenek A', en: 'Option A' } },
    { id: 'b', text: { tr: 'Seçenek B', en: 'Option B' } },
  ],
  correct: ['a'],
  explanation: { tr: 'Açıklama', en: 'Explanation' },
  difficulty: 'medium',
  concepts: [],
};

/**
 * Quiz editörü: dersin quizini (doğru cevaplarla) yükler, başlık/geçme puanı ve soru başına JSON
 * düzenlenir; kaydederken shared QuizSchema ile doğrulanır. Kaldırılan sorular sunucuda arşivlenir.
 */
export default function AdminQuizEditor({ params }: { params: Promise<{ lessonId: string }> }) {
  const { lessonId } = use(params);
  const { t, tl } = useI18n();
  const qc = useQueryClient();
  const { toast } = useOptionalToast();
  const [quizId, setQuizId] = useState('');
  const [title, setTitle] = useState<{ tr: string; en: string }>({ tr: '', en: '' });
  const [passScore, setPassScore] = useState(70);
  const [texts, setTexts] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [exists, setExists] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const pub = await api<QuizPublic>(`/quizzes/by-lesson/${lessonId}`, { anonymous: true });
        const full = await api<QuizFull>(`/admin/quizzes/${pub.id}`);
        if (cancelled) return;
        setExists(true);
        setQuizId(full.id);
        setTitle(toLocalizedObject(full.title));
        setPassScore(full.passScore);
        setTexts(
          full.questions
            .filter((q) => !q.archived)
            .map((q) =>
              JSON.stringify(
                {
                  id: q.key,
                  type: q.type,
                  prompt: q.prompt,
                  options: q.options,
                  correct: q.correct,
                  explanation: q.explanation,
                  difficulty: q.difficulty,
                  concepts: q.concepts,
                } satisfies QuizQuestion,
                null,
                2,
              ),
            ),
        );
      } catch {
        if (cancelled) return;
        setExists(false);
        setQuizId(`${lessonId}-quiz`);
        setTitle({ tr: 'Quiz', en: 'Quiz' });
        setTexts([JSON.stringify({ ...NEW_QUESTION, id: 'q1' }, null, 2)]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [lessonId]);

  const parsed = useMemo(
    () =>
      texts.map((text) => {
        try {
          const r = QuizQuestionSchema.safeParse(JSON.parse(text));
          return r.success
            ? { ok: true as const, q: r.data }
            : {
                ok: false as const,
                error: r.error.issues.map((x) => `${x.path.join('.')}: ${x.message}`).join('; '),
              };
        } catch (e) {
          return { ok: false as const, error: (e as Error).message };
        }
      }),
    [texts],
  );
  const allValid = parsed.every((p) => p.ok) && texts.length > 0;

  const save = async () => {
    setError(null);
    const quiz = QuizSchema.safeParse({
      id: quizId,
      title: { tr: title.tr, en: title.en || undefined },
      passScore,
      questions: parsed.flatMap((p) => (p.ok ? [p.q] : [])),
    });
    if (!quiz.success) {
      setError(quiz.error.issues.map((x) => `${x.path.join('.')}: ${x.message}`).join('; '));
      return;
    }
    setBusy(true);
    try {
      await api('/admin/quizzes', { method: 'PUT', body: { lessonId, quiz: quiz.data } });
      await qc.invalidateQueries({ queryKey: ['quiz', lessonId] });
      setExists(true);
      toast({ title: t('admin.saved'), tone: 'success' });
    } catch (e) {
      setError(
        e instanceof ApiError
          ? [e.body.message, ...(e.body.details?.map((d) => `${d.path}: ${d.message}`) ?? [])]
              .filter(Boolean)
              .join(' · ')
          : t('common.error'),
      );
    } finally {
      setBusy(false);
    }
  };

  if (loading)
    return (
      <div className="space-y-3" aria-busy="true">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-40 w-full" />
      </div>
    );

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="t-eyebrow">
            <Link href={`/admin/lessons/${lessonId}`} className="hover:text-fg">
              {lessonId}
            </Link>
          </p>
          <h1 className="t-h2">{t('admin.quizEditor')}</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted">{t('admin.quizEditorHint')}</p>
        </div>
        <button
          type="button"
          className="btn-primary"
          onClick={() => void save()}
          disabled={!allValid || busy}
        >
          <Save size={15} /> {t('admin.save')}
        </button>
      </div>
      {!exists && (
        <p className="mb-4 rounded-lg border border-warning/40 bg-warning/10 px-3 py-2 text-sm">
          {t('admin.noQuiz')}
        </p>
      )}
      {error && (
        <p className="mb-4 rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger-fg" role="alert">
          {error}
        </p>
      )}

      <div className="card mb-6 grid gap-4 p-5 sm:grid-cols-2">
        <label>
          <span className="label">{t('admin.quizId')}</span>
          <input
            className="input font-mono text-xs"
            value={quizId}
            onChange={(e) => setQuizId(e.target.value)}
            disabled={exists}
          />
        </label>
        <label>
          <span className="label">{t('admin.passScore')}</span>
          <input
            type="number"
            className="input"
            min={0}
            max={100}
            value={passScore}
            onChange={(e) => setPassScore(Number(e.target.value))}
          />
        </label>
        <label>
          <span className="label">{t('admin.titleTr')}</span>
          <input
            className="input"
            value={title.tr}
            onChange={(e) => setTitle((x) => ({ ...x, tr: e.target.value }))}
          />
        </label>
        <label>
          <span className="label">{t('admin.titleEn')}</span>
          <input
            className="input"
            value={title.en}
            onChange={(e) => setTitle((x) => ({ ...x, en: e.target.value }))}
          />
        </label>
      </div>

      <ol className="space-y-4">
        {texts.map((text, i) => {
          const p = parsed[i];
          return (
            <li key={i} className={cn('card p-4', !p.ok && 'border-danger/50')}>
              <div className="mb-2 flex items-center justify-between gap-2">
                <p className="text-sm font-semibold">
                  {t('admin.question')} {i + 1}
                  {p.ok && (
                    <span className="ml-2 text-xs font-normal text-muted">{tl(p.q.prompt)}</span>
                  )}
                </p>
                <div className="flex items-center gap-2">
                  {p.ok ? (
                    <span className="chip border-success/40 text-success-fg">
                      {t('admin.valid')}
                    </span>
                  ) : (
                    <span className="chip border-danger/40 text-danger-fg">
                      {t('admin.invalid')}
                    </span>
                  )}
                  <button
                    type="button"
                    className="btn-icon btn-icon-sm"
                    onClick={() => setTexts((list) => list.filter((_, j) => j !== i))}
                    aria-label={t('admin.remove')}
                    title={t('admin.remove')}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
              <textarea
                className="input min-h-[220px] font-mono text-xs"
                value={text}
                spellCheck={false}
                onChange={(e) =>
                  setTexts((list) => list.map((x, j) => (j === i ? e.target.value : x)))
                }
              />
              {!p.ok && <p className="mt-2 text-xs text-danger-fg">{p.error}</p>}
            </li>
          );
        })}
      </ol>
      <button
        type="button"
        className="btn-ghost mt-4"
        onClick={() =>
          setTexts((list) => [
            ...list,
            JSON.stringify({ ...NEW_QUESTION, id: `q${list.length + 1}` }, null, 2),
          ])
        }
      >
        <Plus size={15} /> {t('admin.addQuestion')}
      </button>
    </div>
  );
}

'use client';

import { use, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Rocket, Save } from 'lucide-react';
import {
  LESSON_BLOCK_TYPES,
  LessonBlockSchema,
  type AdminLessonVersion,
  type LessonBlock,
  type LessonDetail,
  type LocalizedString,
} from '@devacademy/shared';
import { useI18n } from '@/i18n';
import { ApiError, api } from '@/lib/api';
import { BlockRenderer } from '@/components/lesson/BlockRenderer';
import { cn } from '@/lib/utils';

interface VersionFull {
  id: string;
  lessonId: string;
  version: number;
  status: 'draft' | 'published' | 'archived';
  title: LocalizedString;
  summary: LocalizedString;
  durationMinutes: number;
  level: 'beginner' | 'intermediate' | 'advanced';
  tags: string[];
  prerequisites: string[];
  concepts: string[];
  blocks: LessonBlock[];
  lesson: { id: string; slug: string; moduleId: string; order: number };
}

const BLOCK_TEMPLATES: Record<
  (typeof LESSON_BLOCK_TYPES)[number],
  Omit<LessonBlock, 'id' | 'order'>
> = {
  text: { type: 'text', markdown: '## Yeni bölüm\n\nMetin…' },
  diagram: { type: 'diagram', src: 'diagram.svg', alt: 'Diyagram' },
  animation: { type: 'animation', scene: 'scene.json', sceneId: '' },
  interactive: { type: 'interactive', interactive: 'load-balancer', params: {} },
  code: { type: 'code', language: 'ts', code: '// kod', alternatives: [], highlightLines: [] },
  realworld: { type: 'realworld', company: 'Amazon', markdown: 'Gerçek dünya örneği…' },
  // İz içeriği içerik deposunda üretilir (pnpm content:traces); editör yalnızca dosya yolunu tutar
  trace: { type: 'trace', src: 'ornek.trace.json' },
  // Alıştırma içeriği (ve çözümü) içerik deposundaki <ad>.exercise.json'dan seed ile gelir
  exercise: { type: 'exercise', src: 'ornek.exercise.json' },
  callout: { type: 'callout', tone: 'tip', markdown: 'İpucu…' },
  quiz: { type: 'quiz', src: 'quiz.json' },
  next: { type: 'next', lesson: '' },
} as Record<(typeof LESSON_BLOCK_TYPES)[number], Omit<LessonBlock, 'id' | 'order'>>;

/**
 * Ders editörü: yayındaki sürümden taslak türetir, meta + blokları düzenler (blok başına JSON),
 * canlı önizleme gösterir, taslağı kaydeder ve yayınlar. Sürüm geçmişi yan panelde.
 */
export default function AdminLessonEditor({ params }: { params: Promise<{ lessonId: string }> }) {
  const { lessonId } = use(params);
  const { t, tl } = useI18n();
  const qc = useQueryClient();
  const versions = useQuery({
    queryKey: ['admin-versions', lessonId],
    queryFn: () => api<AdminLessonVersion[]>(`/admin/lessons/${lessonId}/versions`),
  });
  const [draft, setDraft] = useState<VersionFull | null>(null);
  const [blockTexts, setBlockTexts] = useState<string[]>([]);
  const [selected, setSelected] = useState(0);
  const [status, setStatus] = useState<{ tone: 'ok' | 'err'; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const [loadError, setLoadError] = useState<string | null>(null);
  const loadedFor = useRef<string | null>(null);

  // Taslağı ders başına BİR kez yükle (yoksa yayındaki sürümden türet). Yayınlama sonrası sürüm listesi
  // yeniden çekilince tekrar fork edilmez; sonraki kaydetme sunucuda yeni taslağı zaten oluşturur.
  useEffect(() => {
    if (!versions.data || loadedFor.current === lessonId) return;
    loadedFor.current = lessonId;
    const list = versions.data;
    void (async () => {
      try {
        let base = list.find((v) => v.status === 'draft');
        if (!base) {
          try {
            base = await api<AdminLessonVersion>(`/admin/lessons/${lessonId}/fork`, {
              method: 'POST',
            });
          } catch {
            base = list[0];
          }
        }
        if (!base) throw new Error(t('common.notFound'));
        const full = await api<VersionFull>(`/admin/versions/${base.id}`);
        setDraft(full);
        setBlockTexts(full.blocks.map((b) => JSON.stringify(b, null, 2)));
      } catch (e) {
        loadedFor.current = null;
        setLoadError((e as Error).message || t('common.error'));
      }
    })();
  }, [versions.data, lessonId, t]);

  const parsedBlocks = useMemo(
    () =>
      blockTexts.map((text, i) => {
        try {
          const r = LessonBlockSchema.safeParse({ ...JSON.parse(text), order: i });
          return r.success
            ? { ok: true as const, block: r.data }
            : {
                ok: false as const,
                error: r.error.issues.map((x) => `${x.path.join('.')}: ${x.message}`).join('; '),
              };
        } catch (e) {
          return { ok: false as const, error: (e as Error).message };
        }
      }),
    [blockTexts],
  );
  const allValid = parsedBlocks.every((b) => b.ok);

  const failure = loadError ?? (versions.isError ? (versions.error as Error).message : null);
  if (!draft && failure)
    return (
      <div className="card p-6 text-sm text-danger" role="alert">
        {t('common.error')}: {failure}
      </div>
    );
  if (!draft) return <div className="card h-64 animate-pulse" />;

  const previewLesson: LessonDetail = {
    id: draft.lesson.id,
    slug: draft.lesson.slug,
    moduleId: draft.lesson.moduleId,
    order: draft.lesson.order,
    title: draft.title,
    summary: draft.summary,
    durationMinutes: draft.durationMinutes,
    level: draft.level,
    tags: draft.tags,
    hasAnimation: false,
    hasInteractive: false,
    hasQuiz: false,
    format: 'standard',
    version: draft.version,
    publishedAt: null,
    blocks: [],
    prerequisites: draft.prerequisites,
    concepts: draft.concepts,
    next: null,
    prev: null,
    module: { id: draft.lesson.moduleId, slug: draft.lesson.moduleId, code: '', title: '' },
  };

  const setMeta = <K extends keyof VersionFull>(key: K, value: VersionFull[K]) =>
    setDraft((d) => (d ? { ...d, [key]: value } : d));
  const titleTr = typeof draft.title === 'string' ? draft.title : draft.title.tr;
  const titleEn = typeof draft.title === 'string' ? '' : (draft.title.en ?? '');

  const save = async (): Promise<boolean> => {
    if (!allValid) return false;
    setBusy(true);
    setStatus(null);
    try {
      await api('/admin/lessons', {
        method: 'PUT',
        body: {
          id: draft.lesson.id,
          slug: draft.lesson.slug,
          moduleId: draft.lesson.moduleId,
          order: draft.lesson.order,
          title: draft.title,
          summary: draft.summary,
          durationMinutes: draft.durationMinutes,
          level: draft.level,
          tags: draft.tags,
          prerequisites: draft.prerequisites,
          concepts: draft.concepts,
          blocks: parsedBlocks.map((b) => (b.ok ? b.block : null)),
        },
      });
      setStatus({ tone: 'ok', text: t('admin.saved') });
      return true;
    } catch (e) {
      setStatus({
        tone: 'err',
        text:
          e instanceof ApiError
            ? `${e.message} ${JSON.stringify(e.body.details ?? '')}`
            : String(e),
      });
      return false;
    } finally {
      setBusy(false);
    }
  };

  const publish = async () => {
    if (!(await save())) return;
    setBusy(true);
    try {
      const r = await api<{ version: number }>(`/admin/lessons/${lessonId}/publish`, {
        method: 'POST',
        body: {},
      });
      setStatus({ tone: 'ok', text: `${t('admin.published')} v${r.version}` });
      await qc.invalidateQueries({ queryKey: ['admin-versions', lessonId] });
      await qc.invalidateQueries({ queryKey: ['admin-lessons'] });
    } catch (e) {
      setStatus({ tone: 'err', text: String((e as Error).message) });
    } finally {
      setBusy(false);
    }
  };

  const addBlock = (type: (typeof LESSON_BLOCK_TYPES)[number]) => {
    const block = {
      id: `${type}-${Date.now().toString(36)}`,
      order: blockTexts.length,
      ...BLOCK_TEMPLATES[type],
    };
    setBlockTexts((b) => [...b, JSON.stringify(block, null, 2)]);
    setSelected(blockTexts.length);
  };
  const moveBlock = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= blockTexts.length) return;
    setBlockTexts((b) => {
      const c = [...b];
      [c[i], c[j]] = [c[j], c[i]];
      return c;
    });
    setSelected(j);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="font-mono text-xs text-muted">
            {lessonId} · v{draft.version} ({draft.status})
          </p>
          <h1 className="text-2xl font-bold">{tl(draft.title)}</h1>
        </div>
        <div className="flex items-center gap-2">
          {status && (
            <span className={cn('text-sm', status.tone === 'ok' ? 'text-success' : 'text-danger')}>
              {status.text}
            </span>
          )}
          <Link href={`/lessons/${lessonId}`} className="btn-ghost" target="_blank">
            {t('admin.preview')}
          </Link>
          <button type="button" className="btn-ghost" onClick={save} disabled={busy || !allValid}>
            <Save size={14} /> {t('admin.save')}
          </button>
          <button
            type="button"
            className="btn-primary"
            onClick={publish}
            disabled={busy || !allValid}
          >
            <Rocket size={14} /> {t('admin.publish')}
          </button>
        </div>
      </div>

      <section className="card grid gap-3 p-4 md:grid-cols-4">
        <label className="md:col-span-2">
          <span className="label">Title (tr)</span>
          <input
            className="input"
            value={titleTr}
            onChange={(e) => setMeta('title', { tr: e.target.value, en: titleEn || undefined })}
          />
        </label>
        <label className="md:col-span-2">
          <span className="label">Title (en)</span>
          <input
            className="input"
            value={titleEn}
            onChange={(e) => setMeta('title', { tr: titleTr, en: e.target.value || undefined })}
          />
        </label>
        <label>
          <span className="label">Duration</span>
          <input
            type="number"
            className="input"
            value={draft.durationMinutes}
            min={1}
            onChange={(e) => setMeta('durationMinutes', Number(e.target.value))}
          />
        </label>
        <label>
          <span className="label">Level</span>
          <select
            className="input"
            value={draft.level}
            onChange={(e) => setMeta('level', e.target.value as VersionFull['level'])}
          >
            <option value="beginner">beginner</option>
            <option value="intermediate">intermediate</option>
            <option value="advanced">advanced</option>
          </select>
        </label>
        <label className="md:col-span-2">
          <span className="label">Tags</span>
          <input
            className="input"
            value={draft.tags.join(', ')}
            onChange={(e) =>
              setMeta(
                'tags',
                e.target.value
                  .split(',')
                  .map((s) => s.trim())
                  .filter(Boolean),
              )
            }
          />
        </label>
        <label className="md:col-span-4">
          <span className="label">Concepts</span>
          <input
            className="input"
            value={draft.concepts.join(', ')}
            onChange={(e) =>
              setMeta(
                'concepts',
                e.target.value
                  .split(',')
                  .map((s) => s.trim())
                  .filter(Boolean),
              )
            }
          />
        </label>
      </section>

      <div className="grid gap-4 xl:grid-cols-2">
        <section className="space-y-2">
          <div className="flex flex-wrap gap-1">
            {LESSON_BLOCK_TYPES.map((type) => (
              <button
                key={type}
                type="button"
                className="chip hover:border-primary"
                onClick={() => addBlock(type)}
              >
                <Plus size={11} /> {type}
              </button>
            ))}
          </div>
          <ol className="space-y-2">
            {blockTexts.map((text, i) => {
              const p = parsedBlocks[i];
              const open = selected === i;
              return (
                <li key={i} className={cn('card overflow-hidden', !p.ok && 'border-danger')}>
                  <div className="flex items-center gap-2 px-3 py-2 text-sm">
                    <button
                      type="button"
                      className="flex-1 text-left font-mono text-xs"
                      onClick={() => setSelected(open ? -1 : i)}
                    >
                      {i + 1}. {p.ok ? `${p.block.type} · ${p.block.id}` : '⚠ invalid'}
                    </button>
                    <button
                      type="button"
                      className="btn-icon h-7 w-7"
                      onClick={() => moveBlock(i, -1)}
                      aria-label="up"
                    >
                      ↑
                    </button>
                    <button
                      type="button"
                      className="btn-icon h-7 w-7"
                      onClick={() => moveBlock(i, 1)}
                      aria-label="down"
                    >
                      ↓
                    </button>
                    <button
                      type="button"
                      className="btn-icon h-7 w-7 text-danger"
                      onClick={() => setBlockTexts((b) => b.filter((_, j) => j !== i))}
                      aria-label="delete"
                    >
                      ×
                    </button>
                  </div>
                  {open && (
                    <div className="border-t border-border">
                      <textarea
                        className="h-72 w-full resize-y bg-bg/60 p-3 font-mono text-xs outline-none"
                        spellCheck={false}
                        value={text}
                        onChange={(e) =>
                          setBlockTexts((b) => b.map((x, j) => (j === i ? e.target.value : x)))
                        }
                      />
                      {!p.ok && <p className="px-3 pb-2 text-xs text-danger">{p.error}</p>}
                    </div>
                  )}
                </li>
              );
            })}
          </ol>
        </section>

        <section className="space-y-4">
          <p className="label">{t('admin.preview')}</p>
          <div className="space-y-6 rounded-2xl border border-dashed border-border p-4">
            {parsedBlocks.map((p, i) =>
              p.ok ? (
                <div key={i}>
                  <BlockRenderer block={p.block} lesson={previewLesson} />
                </div>
              ) : null,
            )}
          </div>
          <div className="card p-4">
            <p className="label">{t('admin.versions')}</p>
            <ul className="space-y-1 text-sm">
              {versions.data?.map((v) => (
                <li key={v.id} className="flex justify-between">
                  <span>
                    v{v.version} · {v.status}
                  </span>
                  <span className="text-muted">
                    {new Date(v.publishedAt ?? v.createdAt).toLocaleString()}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </section>
      </div>
    </div>
  );
}

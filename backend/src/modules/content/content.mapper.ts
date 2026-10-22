import type { Lesson, LessonVersion, Module as ModuleRow, LearningPath, AnimationScene as SceneRow, Prisma } from '@prisma/client';
import { MODULE_GROUPS, stripExerciseSolutions } from '@devacademy/shared';
import type { LessonBlock, LessonDetail, LessonFormat, LessonSummary, ModuleGroup, ModuleSummary, LearningPathSummary, SceneResponse, AnimationScene } from '@devacademy/shared';
import { asLocalized } from '../../common/utils/localized';

/** Prisma satırlarını API DTO'larına çevirir (tek yerde). */

export type LessonWithVersion = Lesson & { publishedVersion: LessonVersion | null };
/** Önceki/sonraki ders bağlantısı için gereken alanlar (blok JSON'u yüklenmez) */
export type NeighborRow = Pick<Lesson, 'id' | 'slug' | 'moduleId'> & { publishedVersion: Pick<LessonVersion, 'title'> | null };

export function blocksOf(version: LessonVersion | null): LessonBlock[] {
  if (!version) return [];
  return Array.isArray(version.blocks) ? (version.blocks as unknown as LessonBlock[]) : [];
}

export function toLessonSummary(lesson: LessonWithVersion): LessonSummary {
  const v = lesson.publishedVersion;
  const blocks = blocksOf(v);
  return {
    id: lesson.id,
    slug: lesson.slug,
    moduleId: lesson.moduleId,
    order: lesson.order,
    title: asLocalized(v?.title),
    summary: asLocalized(v?.summary),
    durationMinutes: v?.durationMinutes ?? 15,
    level: v?.level ?? 'beginner',
    tags: v?.tags ?? [],
    hasAnimation: blocks.some((b) => b.type === 'animation'),
    hasInteractive: blocks.some((b) => b.type === 'interactive'),
    hasQuiz: blocks.some((b) => b.type === 'quiz'),
    format: lessonFormat(blocks),
  };
}

/** PDF'ten aktarılan derslerin sayfa görselleri altyazıdan tanınır ("Sayfa 3 / 11", "PDF sayfa 4 / 20") */
function lessonFormat(blocks: LessonBlock[]): LessonFormat {
  const captions = blocks.flatMap((b) => {
    if (b.type !== 'diagram' || !b.caption) return [];
    return [typeof b.caption === 'string' ? b.caption : b.caption.tr];
  });
  if (captions.some((c) => /^Sayfa \d+ \/ \d+/.test(c))) return 'infographic';
  if (captions.some((c) => /^PDF sayfa \d+ \/ \d+/.test(c))) return 'pdf-guide';
  return 'standard';
}

export function toLessonDetail(
  lesson: LessonWithVersion & { module: ModuleRow },
  neighbors: { prev: NeighborRow | null; next: NeighborRow | null },
): LessonDetail {
  const v = lesson.publishedVersion;
  const ref = (l: NeighborRow | null) =>
    l ? { id: l.id, slug: l.slug, moduleId: l.moduleId, title: asLocalized(l.publishedVersion?.title) } : null;
  return {
    ...toLessonSummary(lesson),
    version: v?.version ?? 0,
    publishedAt: v?.publishedAt?.toISOString() ?? null,
    // Alıştırma çözümleri istemciye gitmez: ayrı uç noktadan (oturumla) istenir
    blocks: stripExerciseSolutions(blocksOf(v)),
    prerequisites: v?.prerequisites ?? [],
    concepts: v?.concepts ?? [],
    next: ref(neighbors.next),
    prev: ref(neighbors.prev),
    module: { id: lesson.module.id, slug: lesson.module.slug, code: lesson.module.code, title: asLocalized(lesson.module.title) },
  };
}

export function toModuleSummary(
  module: ModuleRow & { _count?: { lessons: number } },
  lessonCount?: number,
  totalMinutes = 0,
): ModuleSummary {
  return {
    id: module.id,
    slug: module.slug,
    code: module.code,
    order: module.order,
    title: asLocalized(module.title),
    description: asLocalized(module.description),
    icon: module.icon,
    color: module.color,
    group: (MODULE_GROUPS as readonly string[]).includes(module.group) ? (module.group as ModuleGroup) : 'system-design',
    lessonCount: lessonCount ?? module._count?.lessons ?? 0,
    totalMinutes,
  };
}

export function toPathSummary(path: LearningPath, moduleCount: number, lessonCount: number): LearningPathSummary {
  return {
    id: path.id,
    slug: path.slug,
    title: asLocalized(path.title),
    description: asLocalized(path.description),
    icon: path.icon,
    moduleCount,
    lessonCount,
  };
}

export function toSceneResponse(row: SceneRow): SceneResponse {
  return { id: row.id, version: row.version, updatedAt: row.updatedAt.toISOString(), scene: row.data as unknown as AnimationScene };
}

export function jsonInput(value: unknown): Prisma.InputJsonValue {
  return value as Prisma.InputJsonValue;
}

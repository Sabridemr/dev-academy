import type { Lesson, LessonVersion, Module as ModuleRow, LearningPath, AnimationScene as SceneRow, Prisma } from '@prisma/client';
import type { LessonBlock, LessonDetail, LessonSummary, ModuleSummary, LearningPathSummary, SceneResponse, AnimationScene } from '@devacademy/shared';
import { asLocalized } from '../../common/utils/localized';

/** Prisma satırlarını API DTO'larına çevirir (tek yerde). */

export type LessonWithVersion = Lesson & { publishedVersion: LessonVersion | null };

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
  };
}

export function toLessonDetail(
  lesson: LessonWithVersion & { module: ModuleRow },
  neighbors: { prev: LessonWithVersion | null; next: LessonWithVersion | null },
): LessonDetail {
  const v = lesson.publishedVersion;
  const ref = (l: LessonWithVersion | null) =>
    l ? { id: l.id, slug: l.slug, moduleId: l.moduleId, title: asLocalized(l.publishedVersion?.title) } : null;
  return {
    ...toLessonSummary(lesson),
    version: v?.version ?? 0,
    publishedAt: v?.publishedAt?.toISOString() ?? null,
    blocks: blocksOf(v),
    prerequisites: v?.prerequisites ?? [],
    concepts: v?.concepts ?? [],
    next: ref(neighbors.next),
    prev: ref(neighbors.prev),
    module: { id: lesson.module.id, slug: lesson.module.slug, code: lesson.module.code, title: asLocalized(lesson.module.title) },
  };
}

export function toModuleSummary(module: ModuleRow & { _count?: { lessons: number } }, lessonCount?: number): ModuleSummary {
  return {
    id: module.id,
    slug: module.slug,
    code: module.code,
    order: module.order,
    title: asLocalized(module.title),
    description: asLocalized(module.description),
    icon: module.icon,
    color: module.color,
    lessonCount: lessonCount ?? module._count?.lessons ?? 0,
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

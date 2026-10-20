import type { PrismaClient } from '@prisma/client';

type Db = Pick<PrismaClient, 'learningPathItem' | 'lesson'>;

/**
 * Öğrenme yolundaki yayında derslerin kimlikleri. Yol öğesi ya modülün tamamını (lessonId null)
 * ya da tek bir dersi işaret eder. Yol yoksa null döner.
 */
export async function publishedLessonIdsForPath(db: Db, pathId: string): Promise<string[] | null> {
  const items = await db.learningPathItem.findMany({
    where: { pathId },
    select: { moduleId: true, lessonId: true },
  });
  if (items.length === 0) return null;
  const wholeModules = items.filter((i) => !i.lessonId).map((i) => i.moduleId);
  const singleLessons = items.map((i) => i.lessonId).filter((id): id is string => Boolean(id));
  const lessons = await db.lesson.findMany({
    where: {
      publishedVersionId: { not: null },
      OR: [{ moduleId: { in: wholeModules } }, { id: { in: singleLessons } }],
    },
    select: { id: true },
  });
  return lessons.map((l) => l.id);
}

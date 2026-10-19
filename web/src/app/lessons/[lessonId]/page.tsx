import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import type { LessonDetail } from '@devacademy/shared';
import { t as tl } from '@devacademy/shared';
import { ApiError, serverApi } from '@/lib/api';
import { LessonView } from '@/components/lesson/LessonView';

// Sayfa istek başına render edilir (dil çerezi + CSP nonce'u); API verisi serverApi'nin revalidate
// süresiyle Next Data Cache'te tutulur, yani her istek API'ye gitmez.

async function getLesson(id: string): Promise<LessonDetail> {
  try {
    return await serverApi<LessonDetail>(`/lessons/${id}`, 60);
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) notFound();
    throw err;
  }
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ lessonId: string }>;
}): Promise<Metadata> {
  const { lessonId } = await params;
  try {
    const lesson = await getLesson(lessonId);
    return { title: tl(lesson.title), description: tl(lesson.summary) };
  } catch {
    return { title: 'Ders' };
  }
}

/** Ders sayfası: yayınlanmış içerik sunucuda alınır (ISR), kişisel ilerleme istemcide eklenir. */
export default async function LessonPage({ params }: { params: Promise<{ lessonId: string }> }) {
  const { lessonId } = await params;
  const lesson = await getLesson(lessonId);
  return <LessonView initial={lesson} />;
}

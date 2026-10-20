import { Injectable, NotFoundException } from '@nestjs/common';
import type { LessonFeedbackDto, LessonFeedbackSummary } from '@devacademy/shared';
import { PrismaService } from '../../common/prisma/prisma.service';

type Difficulty = NonNullable<LessonFeedbackDto['difficulty']>;
const DIFFICULTIES: readonly Difficulty[] = ['easy', 'ok', 'hard'];

/** Ders sonu geri bildirimi: beğeni (±1), zorluk oyu ve isteğe bağlı yorum (kullanıcı başına bir kayıt) */
@Injectable()
export class FeedbackService {
  constructor(private readonly prisma: PrismaService) {}

  async upsert(
    userId: string,
    lessonId: string,
    dto: LessonFeedbackDto,
  ): Promise<LessonFeedbackSummary> {
    await this.assertPublished(lessonId);
    const comment = dto.comment?.trim() || null;
    const data = { rating: dto.rating, difficulty: dto.difficulty ?? null, comment };
    await this.prisma.lessonFeedback.upsert({
      where: { userId_lessonId: { userId, lessonId } },
      update: data,
      create: { userId, lessonId, ...data },
    });
    return this.summary(lessonId, userId);
  }

  async summary(lessonId: string, userId?: string): Promise<LessonFeedbackSummary> {
    await this.assertPublished(lessonId);
    const [ratings, difficulties, mine] = await Promise.all([
      this.prisma.lessonFeedback.groupBy({
        by: ['rating'],
        where: { lessonId },
        _count: { _all: true },
      }),
      this.prisma.lessonFeedback.groupBy({
        by: ['difficulty'],
        where: { lessonId, difficulty: { not: null } },
        _count: { _all: true },
      }),
      userId
        ? this.prisma.lessonFeedback.findUnique({
            where: { userId_lessonId: { userId, lessonId } },
          })
        : Promise.resolve(null),
    ]);
    const count = (rating: number) => ratings.find((r) => r.rating === rating)?._count._all ?? 0;
    const difficulty = { easy: 0, ok: 0, hard: 0 };
    for (const d of difficulties)
      if (DIFFICULTIES.includes(d.difficulty as Difficulty))
        difficulty[d.difficulty as Difficulty] = d._count._all;
    const out: LessonFeedbackSummary = { lessonId, up: count(1), down: count(-1), difficulty };
    if (userId) {
      out.mine = mine
        ? {
            rating: mine.rating === -1 ? -1 : 1,
            ...(mine.difficulty ? { difficulty: mine.difficulty as Difficulty } : {}),
            ...(mine.comment ? { comment: mine.comment } : {}),
          }
        : null;
    }
    return out;
  }

  private async assertPublished(lessonId: string): Promise<void> {
    const lesson = await this.prisma.lesson.findFirst({
      where: { id: lessonId, publishedVersionId: { not: null } },
      select: { id: true },
    });
    if (!lesson) throw new NotFoundException('Ders bulunamadı');
  }
}

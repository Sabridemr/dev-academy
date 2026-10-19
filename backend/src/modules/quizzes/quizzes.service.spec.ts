import { NotFoundException } from '@nestjs/common';
import { QuizzesService } from './quizzes.service';

describe('QuizzesService', () => {
  const createService = () => {
    const prisma = { quiz: { findFirst: jest.fn(async () => null) } };
    return { service: new QuizzesService(prisma as never, {} as never), prisma };
  };
  const publicOnly = expect.objectContaining({
    status: 'published',
    lesson: { publishedVersionId: { not: null } },
  });

  it('quizi yalnızca dersi yayındaysa döner', async () => {
    const { service, prisma } = createService();
    await expect(service.getQuiz('q1')).rejects.toBeInstanceOf(NotFoundException);
    await expect(service.getLessonQuiz('l1')).rejects.toBeInstanceOf(NotFoundException);
    for (const [args] of prisma.quiz.findFirst.mock.calls as unknown as [{ where: unknown }][])
      expect(args.where).toEqual(publicOnly);
  });

  it('taslak dersin quizine deneme gönderilemez', async () => {
    const { service, prisma } = createService();
    await expect(service.submit('u1', 'q1', { answers: [] } as never)).rejects.toBeInstanceOf(
      NotFoundException,
    );
    const [[args]] = prisma.quiz.findFirst.mock.calls as unknown as [{ where: unknown }][];
    expect(args.where).toEqual(expect.objectContaining({ id: 'q1' }));
    expect(args.where).toEqual(publicOnly);
  });
});

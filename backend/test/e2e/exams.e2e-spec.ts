import type { INestApplication } from '@nestjs/common';
import { XP_RULES } from '@devacademy/shared';
import { PrismaService } from '../../src/common/prisma/prisma.service';
import { directUser as directUserOf, prefix, useE2eApp, type Http } from './helpers';

describe('DevAcademy API (e2e)', () => {
  const e2e = useE2eApp();
  let app: INestApplication;
  let http: Http;
  const directUser = (tag: string, data?: Parameters<typeof directUserOf>[2]) =>
    directUserOf(app, tag, data);

  beforeAll(() => {
    ({ app, http } = e2e);
  });

  describe('deneme sınavı', () => {
    const moduleId = 'a-system-design-fundamentals';

    async function correctFor(questionIds: string[]) {
      const prisma = app.get(PrismaService);
      const out: { questionId: string; selected: string[] }[] = [];
      for (const id of questionIds) {
        const [quizId, key] = id.split(':');
        const q = await prisma.question.findUniqueOrThrow({
          where: { quizId_key: { quizId, key } },
        });
        out.push({ questionId: id, selected: q.correct });
      }
      return out;
    }

    it('sınav cevapsız sunulur, sahibine özeldir; doğru gönderim geçer ve XP verir', async () => {
      const auth = await directUser('exam');
      const other = await directUser('exam2');
      const exam = await http
        .post(`${prefix}/exams`)
        .set('Authorization', auth)
        .send({ moduleIds: [moduleId], count: 5, durationSec: 600 })
        .expect(201);
      expect(exam.body.questions).toHaveLength(5);
      expect(exam.body.passScore).toBe(70);
      expect(new Set(exam.body.questions.map((q: { id: string }) => q.id)).size).toBe(5);
      for (const q of exam.body.questions) expect(q.moduleId).toBe(moduleId);
      expect(JSON.stringify(exam.body)).not.toContain('"correct');
      expect(JSON.stringify(exam.body)).not.toContain('explanation');

      await http.get(`${prefix}/exams/${exam.body.id}`).set('Authorization', other).expect(404);
      const got = await http
        .get(`${prefix}/exams/${exam.body.id}`)
        .set('Authorization', auth)
        .expect(200);
      expect(got.body.result).toBeNull();

      const ids = exam.body.questions.map((q: { id: string }) => q.id);
      await http
        .post(`${prefix}/exams/${exam.body.id}/submit`)
        .set('Authorization', auth)
        .send({ answers: [{ questionId: 'yok:q1', selected: ['a'] }] })
        .expect(400);
      const res = await http
        .post(`${prefix}/exams/${exam.body.id}/submit`)
        .set('Authorization', auth)
        .send({ answers: await correctFor(ids) })
        .expect(200);
      expect(res.body).toMatchObject({
        examId: exam.body.id,
        score: 100,
        passed: true,
        correctCount: 5,
        totalCount: 5,
        timedOut: false,
        xpEarned: XP_RULES.examPassed,
      });
      expect(res.body.perModule).toEqual([{ moduleId, correct: 5, total: 5 }]);
      expect(res.body.results[0].correctAnswer.length).toBeGreaterThan(0);
      await http
        .post(`${prefix}/exams/${exam.body.id}/submit`)
        .set('Authorization', auth)
        .send({ answers: [] })
        .expect(409);
      const after = await http
        .get(`${prefix}/exams/${exam.body.id}`)
        .set('Authorization', auth)
        .expect(200);
      expect(after.body.result.score).toBe(100);
    });

    it('süre aşımı yine puanlanır; yanlışlar tekrar kartına dönüşür; liste döner', async () => {
      const prisma = app.get(PrismaService);
      const auth = await directUser('examlate');
      const exam = await http
        .post(`${prefix}/exams`)
        .set('Authorization', auth)
        .send({ count: 5, durationSec: 60 })
        .expect(201);
      await prisma.exam.update({
        where: { id: exam.body.id },
        data: { startedAt: new Date(Date.now() - 10 * 60_000) },
      });
      const res = await http
        .post(`${prefix}/exams/${exam.body.id}/submit`)
        .set('Authorization', auth)
        .send({
          answers: exam.body.questions.map((q: { id: string }) => ({
            questionId: q.id,
            selected: ['zzz-yanlis'],
          })),
        })
        .expect(200);
      expect(res.body).toMatchObject({ timedOut: true, passed: false, score: 0, xpEarned: 0 });
      const userId = (await prisma.exam.findUniqueOrThrow({ where: { id: exam.body.id } })).userId;
      expect(await prisma.reviewCard.count({ where: { userId } })).toBe(5);

      const list = await http.get(`${prefix}/exams`).set('Authorization', auth).expect(200);
      expect(list.body).toHaveLength(1);
      expect(list.body[0]).toMatchObject({ id: exam.body.id, questionCount: 5, passed: false });
      await http
        .post(`${prefix}/exams`)
        .set('Authorization', auth)
        .send({ pathId: 'olmayan-yol' })
        .expect(404);
    });
  });
});

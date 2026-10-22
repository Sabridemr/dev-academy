import type { INestApplication } from '@nestjs/common';
import {
  directUser as directUserOf,
  lessonId,
  prefix,
  seedQuizAttempt,
  useE2eApp,
  type Http,
} from './helpers';

describe('DevAcademy API (e2e)', () => {
  const e2e = useE2eApp();
  let app: INestApplication;
  let http: Http;
  const directUser = (tag: string, data?: Parameters<typeof directUserOf>[2]) =>
    directUserOf(app, tag, data);

  beforeAll(async () => {
    ({ app, http } = e2e);
    // Analitik satırı en az bir quiz denemesi bekler (quizAttempts > 0)
    await seedQuizAttempt(e2e);
  });

  describe('ders geri bildirimi + admin analitiği', () => {
    it('geri bildirim upsert edilir, özet ve kendi oyu döner; analitiğe yansır', async () => {
      const auth = await directUser('fb');
      await http
        .post(`${prefix}/lessons/${lessonId}/feedback`)
        .set('Authorization', auth)
        .send({ rating: -1 })
        .expect(200);
      const res = await http
        .post(`${prefix}/lessons/${lessonId}/feedback`)
        .set('Authorization', auth)
        .send({ rating: 1, difficulty: 'hard', comment: '  Harika anlatım  ' })
        .expect(200);
      expect(res.body.mine).toEqual({ rating: 1, difficulty: 'hard', comment: 'Harika anlatım' });
      expect(res.body.up).toBeGreaterThanOrEqual(1);
      expect(res.body.difficulty.hard).toBeGreaterThanOrEqual(1);

      const mine = await http
        .get(`${prefix}/lessons/${lessonId}/feedback`)
        .set('Authorization', auth)
        .expect(200);
      expect(mine.body.mine.rating).toBe(1);
      const anon = await http.get(`${prefix}/lessons/${lessonId}/feedback`).expect(200);
      expect(anon.body).not.toHaveProperty('mine');
      expect(anon.body.up).toBe(res.body.up);

      await http
        .post(`${prefix}/lessons/${lessonId}/feedback`)
        .set('Authorization', auth)
        .send({ rating: 5 })
        .expect(400);
      await http.post(`${prefix}/lessons/${lessonId}/feedback`).send({ rating: 1 }).expect(401);
      await http.get(`${prefix}/lessons/olmayan-ders/feedback`).expect(404);

      await http.get(`${prefix}/admin/analytics`).set('Authorization', auth).expect(403);
      const admin = await directUser('fbadmin', { role: 'admin' });
      const analytics = await http
        .get(`${prefix}/admin/analytics`)
        .set('Authorization', admin)
        .expect(200);
      const row = analytics.body.find((r: { lessonId: string }) => r.lessonId === lessonId);
      expect(row.feedbackUp).toBeGreaterThanOrEqual(1);
      expect(row.hardVotes).toBeGreaterThanOrEqual(1);
      expect(row.started).toBeGreaterThanOrEqual(row.completed);
      expect(row.quizAttempts).toBeGreaterThan(0);
      expect(row.completionRate).toBeGreaterThanOrEqual(0);
      expect(row.completionRate).toBeLessThanOrEqual(1);
    });
  });
});

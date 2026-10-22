import type { INestApplication } from '@nestjs/common';
import { XP_RULES } from '@devacademy/shared';
import { PrismaService } from '../../src/common/prisma/prisma.service';
import {
  createDirectUser,
  directUser as directUserOf,
  lessonId,
  prefix,
  useE2eApp,
  type Http,
} from './helpers';

describe('DevAcademy API (e2e)', () => {
  const e2e = useE2eApp();
  let app: INestApplication;
  let http: Http;
  let accessToken = '';
  const directUser = (tag: string, data?: Parameters<typeof directUserOf>[2]) =>
    directUserOf(app, tag, data);

  beforeAll(async () => {
    ({ app, http } = e2e);
    // Bu dosyanın ortak öğrenci hesabı (eski tek dosyada kayıt testinin açtığı hesabın yerine)
    const user = await createDirectUser(app, 'main');
    accessToken = user.accessToken;
  });

  describe('quiz + progress + spaced repetition', () => {
    it('quiz doğru cevapları sızdırmaz', async () => {
      const res = await http.get(`${prefix}/quizzes/by-lesson/${lessonId}`).expect(200);
      expect(res.body.questions.length).toBeGreaterThanOrEqual(3);
      expect(JSON.stringify(res.body)).not.toContain('"correct"');
      expect(JSON.stringify(res.body)).not.toContain('explanation');
    });

    it('deneme puanlanır, yanlışlar tekrar kartına dönüşür, rozet kazanılabilir', async () => {
      const quiz = await http.get(`${prefix}/quizzes/by-lesson/${lessonId}`).expect(200);
      // q1 doğru (b), diğerleri bilerek yanlış
      const answers = quiz.body.questions.map((q: { id: string; options: { id: string }[] }) => ({
        questionId: q.id,
        selected: [q.id === 'q1' ? 'b' : 'zzz-yanlis'],
      }));
      const res = await http
        .post(`${prefix}/quizzes/${quiz.body.id}/attempts`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ answers, durationMs: 30000 })
        .expect(201);
      expect(res.body.correctCount).toBe(1);
      expect(res.body.passed).toBe(false);
      expect(res.body.results[1].explanation).toBeDefined();
      const reviews = await http
        .get(`${prefix}/progress/reviews`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);
      expect(Array.isArray(reviews.body)).toBe(true);
    });

    it('aynı quiz tekrar çözülünce tekrar kartı çoğalmaz; vadesi gelen kart doğru cevabı içerir', async () => {
      const prisma = app.get(PrismaService);
      const me = await http
        .get(`${prefix}/users/me`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);
      const before = await prisma.reviewCard.count({ where: { userId: me.body.id } });
      const quiz = await http.get(`${prefix}/quizzes/by-lesson/${lessonId}`).expect(200);
      const answers = quiz.body.questions.map((q: { id: string }) => ({
        questionId: q.id,
        selected: [q.id === 'q1' ? 'b' : 'zzz-yanlis'],
      }));
      await http
        .post(`${prefix}/quizzes/${quiz.body.id}/attempts`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ answers })
        .expect(201);
      expect(await prisma.reviewCard.count({ where: { userId: me.body.id } })).toBe(before);

      await prisma.reviewCard.updateMany({
        where: { userId: me.body.id },
        data: { dueAt: new Date(Date.now() - 60_000) },
      });
      const reviews = await http
        .get(`${prefix}/progress/reviews`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);
      expect(reviews.body.length).toBeGreaterThan(0);
      expect(Array.isArray(reviews.body[0].correctAnswer)).toBe(true);
      expect(reviews.body[0].correctAnswer.length).toBeGreaterThan(0);
      expect(reviews.body[0].explanation).toBeDefined();
    });

    it('bilinmeyen soru id’si 400', async () => {
      await http
        .post(`${prefix}/quizzes/a-05-load-balancing-quiz/attempts`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ answers: [{ questionId: 'qX', selected: ['a'] }] })
        .expect(400);
    });

    it('ilerleme güncellenir ve tamamlanınca özet/rozet/seri yansır', async () => {
      await http
        .put(`${prefix}/progress/lessons/${lessonId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ percent: 40, lastBlockId: 'animation-1', secondsSpent: 120 })
        .expect(200);
      const done = await http
        .put(`${prefix}/progress/lessons/${lessonId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ percent: 100, secondsSpent: 300, completed: true })
        .expect(200);
      expect(done.body.status).toBe('completed');
      expect(done.body.newBadges.map((b: { slug: string }) => b.slug)).toContain('first-steps');
      const summary = await http
        .get(`${prefix}/progress/summary`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);
      expect(summary.body.completedLessons).toBe(1);
      expect(summary.body.currentStreak).toBe(1);
      expect(summary.body.activeToday).toBe(true);
      expect(summary.body.totalSecondsSpent).toBe(420);
      expect(summary.body.badges.length).toBeGreaterThanOrEqual(1);
    });

    it('eş zamanlı tamamlamalar aynı rozeti iki kez vermez ve hata döndürmez', async () => {
      const auth = await directUser('badge');
      const [a, b] = await Promise.all([
        http
          .put(`${prefix}/progress/lessons/${lessonId}`)
          .set('Authorization', auth)
          .send({ percent: 100, completed: true }),
        http
          .put(`${prefix}/progress/lessons/${lessonId}`)
          .set('Authorization', auth)
          .send({ percent: 100, completed: true }),
      ]);
      expect([a.status, b.status]).toEqual([200, 200]);
      const summary = await http
        .get(`${prefix}/progress/summary`)
        .set('Authorization', auth)
        .expect(200);
      expect(
        summary.body.badges.filter((x: { slug: string }) => x.slug === 'first-steps'),
      ).toHaveLength(1);
    });

    it('ilerleme geriye düşmez', async () => {
      const res = await http
        .put(`${prefix}/progress/lessons/${lessonId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ percent: 10 })
        .expect(200);
      expect(res.body.percent).toBe(100);
    });

    it('tekrar kartı SM-2 ile değerlendirilir', async () => {
      const reviews = await http
        .get(`${prefix}/progress/reviews`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);
      if (reviews.body.length === 0) return; // kartlar 1 gün sonra due olur
      const graded = await http
        .post(`${prefix}/progress/reviews/${reviews.body[0].id}/grade`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ quality: 5 })
        .expect(201);
      expect(graded.body.repetitions).toBeGreaterThanOrEqual(1);
    });
  });

  describe('motivasyon: XP, günlük hedef, aktivite', () => {
    /** Quizin doğru cevapları (yalnızca test; API sızdırmaz) */
    async function correctAnswers(quizId: string) {
      const qs = await app
        .get(PrismaService)
        .question.findMany({ where: { quizId, archived: false } });
      return qs.map((q) => ({ questionId: q.key, selected: q.correct }));
    }

    it('günlük hedef kaydedilir; ders tamamlama + hedef XP verir, özet ve aktivite yansır', async () => {
      const auth = await directUser('xp');
      const me = await http
        .patch(`${prefix}/users/me`)
        .set('Authorization', auth)
        .send({ dailyGoalMinutes: 5 })
        .expect(200);
      expect(me.body).toMatchObject({
        dailyGoalMinutes: 5,
        streakFreezes: 1,
        emailVerified: false,
      });
      await http
        .patch(`${prefix}/users/me`)
        .set('Authorization', auth)
        .send({ dailyGoalMinutes: 1 })
        .expect(400);

      await http
        .put(`${prefix}/progress/lessons/${lessonId}`)
        .set('Authorization', auth)
        .send({ percent: 100, completed: true, secondsSpent: 400 })
        .expect(200);
      // Aynı ders yeniden tamamlanınca XP verilmez
      await http
        .put(`${prefix}/progress/lessons/${lessonId}`)
        .set('Authorization', auth)
        .send({ percent: 100, completed: true, secondsSpent: 10 })
        .expect(200);

      const expected = XP_RULES.lessonCompleted + XP_RULES.dailyGoalMet;
      const summary = await http
        .get(`${prefix}/progress/summary`)
        .set('Authorization', auth)
        .expect(200);
      expect(summary.body).toMatchObject({
        xp: expected,
        dailyGoalMinutes: 5,
        todaySeconds: 410,
        streakFreezes: 1,
        currentStreak: 1,
      });
      expect(summary.body.level).toMatchObject({ level: 1, xpIntoLevel: expected });

      const xp = await http.get(`${prefix}/progress/xp`).set('Authorization', auth).expect(200);
      expect(xp.body.map((e: { kind: string }) => e.kind).sort()).toEqual([
        'dailyGoalMet',
        'lessonCompleted',
      ]);
      const activity = await http
        .get(`${prefix}/progress/activity?days=30`)
        .set('Authorization', auth)
        .expect(200);
      expect(activity.body).toHaveLength(1);
      expect(activity.body[0]).toMatchObject({ seconds: 410, lessonsCompleted: 1, xp: expected });
      expect(activity.body[0].date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });

    it('quiz ilk geçişte geçme + kusursuz bonusu verir, tekrar çözünce vermez', async () => {
      const auth = await directUser('quizxp');
      const quiz = await http.get(`${prefix}/quizzes/by-lesson/${lessonId}`).expect(200);
      const answers = await correctAnswers(quiz.body.id);
      for (let i = 0; i < 2; i++) {
        const res = await http
          .post(`${prefix}/quizzes/${quiz.body.id}/attempts`)
          .set('Authorization', auth)
          .send({ answers })
          .expect(201);
        expect(res.body.score).toBe(100);
      }
      const summary = await http
        .get(`${prefix}/progress/summary`)
        .set('Authorization', auth)
        .expect(200);
      expect(summary.body.xp).toBe(XP_RULES.quizPassed + XP_RULES.quizPerfectBonus);
      const activity = await http
        .get(`${prefix}/progress/activity`)
        .set('Authorization', auth)
        .expect(200);
      expect(activity.body[0].quizzesPassed).toBe(2);
    });
  });
});

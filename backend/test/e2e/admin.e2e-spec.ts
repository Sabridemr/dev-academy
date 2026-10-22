import type { INestApplication } from '@nestjs/common';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { PrismaService } from '../../src/common/prisma/prisma.service';
import {
  createDirectUser,
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
  let accessToken = '';

  beforeAll(async () => {
    ({ app, http } = e2e);
    // Bu dosyanın ortak öğrenci hesabı (eski tek dosyada kayıt testinin açtığı hesabın yerine)
    const user = await createDirectUser(app, 'main');
    accessToken = user.accessToken;
    // "quizden çıkarılan soru arşivlenir" testi q1 için mevcut deneme cevabı bekler
    await seedQuizAttempt(e2e);
  });

  describe('admin', () => {
    let adminToken = '';
    beforeAll(async () => {
      const res = await http
        .post(`${prefix}/auth/login`)
        .send({ email: process.env.SEED_ADMIN_EMAIL, password: process.env.SEED_ADMIN_PASSWORD })
        .expect(200);
      adminToken = res.body.tokens.accessToken;
    });

    it('öğrenci admin uç noktasına erişemez', async () => {
      await http
        .get(`${prefix}/admin/stats`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(403);
    });

    it('istatistikler', async () => {
      const res = await http
        .get(`${prefix}/admin/stats`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);
      expect(res.body.published).toBeGreaterThanOrEqual(1);
    });

    it('taslak → yayın akışı: yeni sürüm yayınlanır, önceki arşivlenir', async () => {
      const fork = await http
        .post(`${prefix}/admin/lessons/${lessonId}/fork`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(201);
      expect(fork.body.status).toBe('draft');
      const before = await http.get(`${prefix}/lessons/${lessonId}`).expect(200);
      const pub = await http
        .post(`${prefix}/admin/lessons/${lessonId}/publish`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({})
        .expect(201);
      expect(pub.body.version).toBe(fork.body.version);
      const after = await http.get(`${prefix}/lessons/${lessonId}`).expect(200);
      expect(after.body.version).toBe(before.body.version + 1);
      const versions = await http
        .get(`${prefix}/admin/lessons/${lessonId}/versions`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);
      expect(
        versions.body.filter((v: { status: string }) => v.status === 'published'),
      ).toHaveLength(1);
    });

    it('geçersiz sahne reddedilir, geçerli sahne kaydedilir', async () => {
      await http
        .put(`${prefix}/admin/scenes`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ scene: { id: 'Bozuk Sahne' } })
        .expect(400);
      const scene = {
        id: 'e2e-test-scene',
        title: 'E2E',
        a11y: { description: 'Test sahnesi' },
        nodes: [
          { id: 'a', label: 'A', x: 100, y: 100 },
          { id: 'b', label: 'B', x: 300, y: 100 },
        ],
        edges: [{ id: 'ab', from: 'a', to: 'b' }],
        steps: [{ id: 's1', title: 'Adım', narration: 'A → B', packets: [{ edge: 'ab' }] }],
      };
      const res = await http
        .put(`${prefix}/admin/scenes`)
        .query({ publish: 'true' })
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ lessonId, scene })
        .expect(200);
      expect(res.body.status).toBe('published');
      await http.get(`${prefix}/scenes/e2e-test-scene`).expect(200);
      await http
        .delete(`${prefix}/admin/scenes/e2e-test-scene`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(204);
    });

    it('quizden çıkarılan soru arşivlenir: öğrenciye gösterilmez, deneme geçmişi korunur', async () => {
      const prisma = app.get(PrismaService);
      const quizFile = JSON.parse(
        readFileSync(
          resolve(
            __dirname,
            '../../../content/modules/a-system-design-fundamentals/a-05-load-balancing/quiz.json',
          ),
          'utf8',
        ),
      );
      const answersBefore = await prisma.attemptAnswer.count({
        where: { question: { quizId: quizFile.id, key: 'q1' } },
      });
      expect(answersBefore).toBeGreaterThan(0);
      try {
        const trimmed = {
          ...quizFile,
          questions: quizFile.questions.filter((q: { id: string }) => q.id !== 'q1'),
        };
        await http
          .put(`${prefix}/admin/quizzes`)
          .set('Authorization', `Bearer ${adminToken}`)
          .send({ lessonId, quiz: trimmed })
          .expect(200);
        const pub = await http.get(`${prefix}/quizzes/by-lesson/${lessonId}`).expect(200);
        expect(pub.body.questions.map((q: { id: string }) => q.id)).not.toContain('q1');
        expect(
          await prisma.attemptAnswer.count({
            where: { question: { quizId: quizFile.id, key: 'q1' } },
          }),
        ).toBe(answersBefore);
      } finally {
        await http
          .put(`${prefix}/admin/quizzes`)
          .set('Authorization', `Bearer ${adminToken}`)
          .send({ lessonId, quiz: quizFile })
          .expect(200);
      }
      const restored = await http.get(`${prefix}/quizzes/by-lesson/${lessonId}`).expect(200);
      expect(restored.body.questions.map((q: { id: string }) => q.id)).toContain('q1');
    });

    it('yayındaki dersin sırası değişince modül detayı hemen güncellenir', async () => {
      const versions = await http
        .get(`${prefix}/admin/lessons/${lessonId}/versions`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);
      const publishedId = versions.body.find(
        (v: { status: string }) => v.status === 'published',
      ).id;
      const v = (
        await http
          .get(`${prefix}/admin/versions/${publishedId}`)
          .set('Authorization', `Bearer ${adminToken}`)
          .expect(200)
      ).body;
      const dto = {
        id: lessonId,
        slug: v.lesson.slug,
        moduleId: v.lesson.moduleId,
        order: v.lesson.order,
        title: v.title,
        summary: v.summary,
        durationMinutes: v.durationMinutes,
        level: v.level,
        tags: v.tags,
        prerequisites: v.prerequisites,
        concepts: v.concepts,
        blocks: v.blocks,
      };
      await http.get(`${prefix}/modules/${dto.moduleId}`).expect(200); // cache'i ısıt
      try {
        await http
          .put(`${prefix}/admin/lessons`)
          .set('Authorization', `Bearer ${adminToken}`)
          .send({ ...dto, order: 99 })
          .expect(200);
        const mod = await http.get(`${prefix}/modules/${dto.moduleId}`).expect(200);
        expect(mod.body.lessons.find((l: { id: string }) => l.id === lessonId).order).toBe(99);
      } finally {
        await http
          .put(`${prefix}/admin/lessons`)
          .set('Authorization', `Bearer ${adminToken}`)
          .send(dto)
          .expect(200);
      }
    });

    it('yayından kaldırılan dersin quizi ve sahneleri öğrencilere kapanır', async () => {
      const versions = await http
        .get(`${prefix}/admin/lessons/${lessonId}/versions`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);
      const live = versions.body.find((v: { status: string }) => v.status === 'published');
      const quiz = await http.get(`${prefix}/quizzes/by-lesson/${lessonId}`).expect(200);
      await http.get(`${prefix}/scenes/load-balancer-round-robin`).expect(200); // cache'i ısıt
      await http
        .post(`${prefix}/admin/lessons/${lessonId}/unpublish`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(201);
      try {
        await http.get(`${prefix}/quizzes/by-lesson/${lessonId}`).expect(404);
        await http.get(`${prefix}/quizzes/${quiz.body.id}`).expect(404);
        await http
          .post(`${prefix}/quizzes/${quiz.body.id}/attempts`)
          .set('Authorization', `Bearer ${accessToken}`)
          .send({ answers: [] })
          .expect(404);
        await http.get(`${prefix}/scenes/load-balancer-round-robin`).expect(404);
        const scenes = await http.get(`${prefix}/lessons/${lessonId}/scenes`).expect(200);
        expect(scenes.body).toEqual([]);
      } finally {
        await http
          .post(`${prefix}/admin/lessons/${lessonId}/publish`)
          .set('Authorization', `Bearer ${adminToken}`)
          .send({ versionId: live.id })
          .expect(201);
      }
      await http.get(`${prefix}/quizzes/by-lesson/${lessonId}`).expect(200);
      await http.get(`${prefix}/scenes/load-balancer-round-robin`).expect(200);
    });
  });
});

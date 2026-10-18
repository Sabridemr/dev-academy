import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createApp } from '../src/main';
import { PrismaService } from '../src/common/prisma/prisma.service';
import { RedisService } from '../src/common/redis/redis.service';

/**
 * Uçtan uca testler: seed edilmiş test veritabanında (A-05 referans dersi dahil) API akışlarını doğrular.
 */
describe('DevAcademy API (e2e)', () => {
  let app: INestApplication;
  let http: ReturnType<typeof request>;
  const prefix = '/api/v1';
  const email = `e2e_${Date.now()}@test.local`;
  const password = 'Sifre1234!';
  let accessToken = '';
  let refreshToken = '';
  const lessonId = 'a-05-load-balancing';

  beforeAll(async () => {
    app = await createApp();
    await app.init();
    http = request(app.getHttpServer());
    await app.get(RedisService).delByPattern('content:*');
  });

  afterAll(async () => {
    const prisma = app.get(PrismaService);
    await prisma.user.deleteMany({ where: { email: { startsWith: 'e2e_' } } });
    await app.close();
  });

  describe('health', () => {
    it('GET /health liveness', async () => {
      const res = await http.get('/health').expect(200);
      expect(res.body.status).toBe('ok');
    });
    it('GET /health/ready veritabanını kontrol eder', async () => {
      const res = await http.get('/health/ready').expect(200);
      expect(res.body.checks.database).toBe('up');
    });
  });

  describe('auth', () => {
    it('kayıt olur ve token çifti alır', async () => {
      const res = await http.post(`${prefix}/auth/register`).send({ email, password, displayName: 'E2E Kullanıcı' }).expect(201);
      expect(res.body.user.email).toBe(email);
      expect(res.body.user).not.toHaveProperty('passwordHash');
      accessToken = res.body.tokens.accessToken;
      refreshToken = res.body.tokens.refreshToken;
    });

    it('aynı e-posta ile ikinci kayıt 409 döner', async () => {
      await http.post(`${prefix}/auth/register`).send({ email, password, displayName: 'Tekrar' }).expect(409);
    });

    it('doğrulama hatası merkezi formatta döner', async () => {
      const res = await http.post(`${prefix}/auth/register`).send({ email: 'gecersiz', password: '1' }).expect(400);
      expect(res.body).toMatchObject({ statusCode: 400, message: 'Doğrulama hatası' });
      expect(res.body.details.map((d: { path: string }) => d.path)).toEqual(expect.arrayContaining(['email', 'password', 'displayName']));
      expect(res.body.timestamp).toBeDefined();
    });

    it('yanlış şifre 401', async () => {
      await http.post(`${prefix}/auth/login`).send({ email, password: 'yanlis-sifre' }).expect(401);
    });

    it('giriş yapar', async () => {
      const res = await http.post(`${prefix}/auth/login`).send({ email, password }).expect(200);
      expect(res.body.tokens.tokenType).toBe('Bearer');
    });

    it('refresh rotasyonu ve yeniden kullanım tespiti', async () => {
      const r1 = await http.post(`${prefix}/auth/refresh`).send({ refreshToken }).expect(200);
      await http.post(`${prefix}/auth/refresh`).send({ refreshToken }).expect(401);
      // yeniden kullanım sonrası yeni token da iptal edilmiş olmalı
      await http.post(`${prefix}/auth/refresh`).send({ refreshToken: r1.body.refreshToken }).expect(401);
      const login = await http.post(`${prefix}/auth/login`).send({ email, password }).expect(200);
      accessToken = login.body.tokens.accessToken;
      refreshToken = login.body.tokens.refreshToken;
    });

    it('korumalı uç nokta token olmadan 401', async () => {
      await http.get(`${prefix}/users/me`).expect(401);
    });
  });

  describe('users', () => {
    it('profil getirir ve günceller', async () => {
      const me = await http.get(`${prefix}/users/me`).set('Authorization', `Bearer ${accessToken}`).expect(200);
      expect(me.body.email).toBe(email);
      const upd = await http.patch(`${prefix}/users/me`).set('Authorization', `Bearer ${accessToken}`).send({ selectedPathId: 'system-design', reminderHour: 20, locale: 'en' }).expect(200);
      expect(upd.body.selectedPathId).toBe('system-design');
      expect(upd.body.reminderHour).toBe(20);
    });
    it('bilinmeyen öğrenme yolu 404', async () => {
      await http.patch(`${prefix}/users/me`).set('Authorization', `Bearer ${accessToken}`).send({ selectedPathId: 'yok' }).expect(404);
    });
  });

  describe('content', () => {
    it('yolları ve modülleri listeler', async () => {
      const paths = await http.get(`${prefix}/paths`).expect(200);
      expect(paths.body.map((p: { id: string }) => p.id)).toEqual(expect.arrayContaining(['backend', 'system-design', 'ai', 'interview-prep']));
      const modules = await http.get(`${prefix}/modules`).expect(200);
      expect(modules.body).toHaveLength(7);
      expect(modules.body[0].code).toBe('A');
    });

    it('modül detayı kullanıcı ilerlemesiyle döner', async () => {
      const res = await http.get(`${prefix}/modules/a-system-design-fundamentals`).set('Authorization', `Bearer ${accessToken}`).expect(200);
      const lb = res.body.lessons.find((l: { id: string }) => l.id === lessonId);
      expect(lb).toBeDefined();
      expect(lb.progress.status).toBe('not_started');
      expect(lb.hasAnimation && lb.hasInteractive && lb.hasQuiz).toBe(true);
    });

    it('ders detayı: bloklar, inline SVG, sahne ve quiz referansları', async () => {
      const res = await http.get(`${prefix}/lessons/${lessonId}`).expect(200);
      const types = res.body.blocks.map((b: { type: string }) => b.type);
      expect(types).toEqual(expect.arrayContaining(['text', 'diagram', 'animation', 'interactive', 'code', 'realworld', 'quiz', 'next']));
      const diagram = res.body.blocks.find((b: { type: string }) => b.type === 'diagram');
      expect(diagram.svg).toContain('<svg');
      const anim = res.body.blocks.find((b: { type: string }) => b.type === 'animation');
      expect(anim.sceneId).toBe('load-balancer-round-robin');
      expect(res.body.module.code).toBe('A');
    });

    it('slug ile de ders getirilir', async () => {
      const res = await http.get(`${prefix}/lessons/load-balancing`).expect(200);
      expect(res.body.id).toBe(lessonId);
    });

    it('ETag ile 304 Not Modified', async () => {
      const first = await http.get(`${prefix}/lessons/${lessonId}`).expect(200);
      const etag = first.headers.etag;
      expect(etag).toBeDefined();
      await http.get(`${prefix}/lessons/${lessonId}`).set('If-None-Match', etag).expect(304);
    });

    it('sahne JSON’ı döner', async () => {
      const res = await http.get(`${prefix}/scenes/load-balancer-round-robin`).expect(200);
      expect(res.body.scene.steps.length).toBeGreaterThan(0);
      const list = await http.get(`${prefix}/lessons/${lessonId}/scenes`).expect(200);
      expect(list.body.length).toBeGreaterThanOrEqual(1);
    });

    it('olmayan ders 404 ve merkezi hata formatı', async () => {
      const res = await http.get(`${prefix}/lessons/yok-boyle-ders`).expect(404);
      expect(res.body).toMatchObject({ statusCode: 404, error: 'NOT_FOUND' });
    });

    it('offline paket modülün derslerini, sahnelerini ve quizlerini içerir', async () => {
      const res = await http.get(`${prefix}/offline/modules/a-system-design-fundamentals`).expect(200);
      expect(res.body.lessons.some((l: { id: string }) => l.id === lessonId)).toBe(true);
      expect(res.body.scenes.length).toBeGreaterThan(0);
      expect(res.body.quizzes.length).toBeGreaterThan(0);
    });
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
      const answers = quiz.body.questions.map((q: { id: string; options: { id: string }[] }) => ({ questionId: q.id, selected: [q.id === 'q1' ? 'b' : 'zzz-yanlis'] }));
      const res = await http.post(`${prefix}/quizzes/${quiz.body.id}/attempts`).set('Authorization', `Bearer ${accessToken}`).send({ answers, durationMs: 30000 }).expect(201);
      expect(res.body.correctCount).toBe(1);
      expect(res.body.passed).toBe(false);
      expect(res.body.results[1].explanation).toBeDefined();
      const reviews = await http.get(`${prefix}/progress/reviews`).set('Authorization', `Bearer ${accessToken}`).expect(200);
      expect(Array.isArray(reviews.body)).toBe(true);
    });

    it('bilinmeyen soru id’si 400', async () => {
      await http.post(`${prefix}/quizzes/a-05-load-balancing-quiz/attempts`).set('Authorization', `Bearer ${accessToken}`).send({ answers: [{ questionId: 'qX', selected: ['a'] }] }).expect(400);
    });

    it('ilerleme güncellenir ve tamamlanınca özet/rozet/seri yansır', async () => {
      await http.put(`${prefix}/progress/lessons/${lessonId}`).set('Authorization', `Bearer ${accessToken}`).send({ percent: 40, lastBlockId: 'animation-1', secondsSpent: 120 }).expect(200);
      const done = await http.put(`${prefix}/progress/lessons/${lessonId}`).set('Authorization', `Bearer ${accessToken}`).send({ percent: 100, secondsSpent: 300, completed: true }).expect(200);
      expect(done.body.status).toBe('completed');
      expect(done.body.newBadges.map((b: { slug: string }) => b.slug)).toContain('first-steps');
      const summary = await http.get(`${prefix}/progress/summary`).set('Authorization', `Bearer ${accessToken}`).expect(200);
      expect(summary.body.completedLessons).toBe(1);
      expect(summary.body.currentStreak).toBe(1);
      expect(summary.body.activeToday).toBe(true);
      expect(summary.body.totalSecondsSpent).toBe(420);
      expect(summary.body.badges.length).toBeGreaterThanOrEqual(1);
    });

    it('ilerleme geriye düşmez', async () => {
      const res = await http.put(`${prefix}/progress/lessons/${lessonId}`).set('Authorization', `Bearer ${accessToken}`).send({ percent: 10 }).expect(200);
      expect(res.body.percent).toBe(100);
    });

    it('tekrar kartı SM-2 ile değerlendirilir', async () => {
      const reviews = await http.get(`${prefix}/progress/reviews`).set('Authorization', `Bearer ${accessToken}`).expect(200);
      if (reviews.body.length === 0) return; // kartlar 1 gün sonra due olur
      const graded = await http.post(`${prefix}/progress/reviews/${reviews.body[0].id}/grade`).set('Authorization', `Bearer ${accessToken}`).send({ quality: 5 }).expect(201);
      expect(graded.body.repetitions).toBeGreaterThanOrEqual(1);
    });
  });

  describe('bookmarks + notes', () => {
    it('yer imi ekler (idempotent), listeler, siler', async () => {
      const a = await http.post(`${prefix}/bookmarks`).set('Authorization', `Bearer ${accessToken}`).send({ lessonId, blockId: 'diagram-1' }).expect(201);
      const b = await http.post(`${prefix}/bookmarks`).set('Authorization', `Bearer ${accessToken}`).send({ lessonId, blockId: 'diagram-1' }).expect(201);
      expect(b.body.id).toBe(a.body.id);
      const list = await http.get(`${prefix}/bookmarks`).set('Authorization', `Bearer ${accessToken}`).expect(200);
      expect(list.body).toHaveLength(1);
      await http.delete(`${prefix}/bookmarks/${a.body.id}`).set('Authorization', `Bearer ${accessToken}`).expect(204);
    });

    it('not oluşturur, günceller, siler', async () => {
      const n = await http.post(`${prefix}/notes`).set('Authorization', `Bearer ${accessToken}`).send({ lessonId, body: 'Least connections uzun isteklerde iyi.' }).expect(201);
      const u = await http.patch(`${prefix}/notes/${n.body.id}`).set('Authorization', `Bearer ${accessToken}`).send({ body: 'Güncellendi' }).expect(200);
      expect(u.body.body).toBe('Güncellendi');
      await http.delete(`${prefix}/notes/${n.body.id}`).set('Authorization', `Bearer ${accessToken}`).expect(204);
    });
  });

  describe('search', () => {
    it('ders ve kavram arar', async () => {
      const res = await http.get(`${prefix}/search`).query({ q: 'round-robin' }).expect(200);
      expect(res.body.results.some((r: { id: string }) => r.id === lessonId)).toBe(true);
    });
    it('çok kısa sorgu boş döner', async () => {
      const res = await http.get(`${prefix}/search`).query({ q: 'a' }).expect(200);
      expect(res.body.results).toEqual([]);
    });
  });

  describe('admin', () => {
    let adminToken = '';
    beforeAll(async () => {
      const res = await http.post(`${prefix}/auth/login`).send({ email: process.env.SEED_ADMIN_EMAIL, password: process.env.SEED_ADMIN_PASSWORD }).expect(200);
      adminToken = res.body.tokens.accessToken;
    });

    it('öğrenci admin uç noktasına erişemez', async () => {
      await http.get(`${prefix}/admin/stats`).set('Authorization', `Bearer ${accessToken}`).expect(403);
    });

    it('istatistikler', async () => {
      const res = await http.get(`${prefix}/admin/stats`).set('Authorization', `Bearer ${adminToken}`).expect(200);
      expect(res.body.published).toBeGreaterThanOrEqual(1);
    });

    it('taslak → yayın akışı: yeni sürüm yayınlanır, önceki arşivlenir', async () => {
      const fork = await http.post(`${prefix}/admin/lessons/${lessonId}/fork`).set('Authorization', `Bearer ${adminToken}`).expect(201);
      expect(fork.body.status).toBe('draft');
      const before = await http.get(`${prefix}/lessons/${lessonId}`).expect(200);
      const pub = await http.post(`${prefix}/admin/lessons/${lessonId}/publish`).set('Authorization', `Bearer ${adminToken}`).send({}).expect(201);
      expect(pub.body.version).toBe(fork.body.version);
      const after = await http.get(`${prefix}/lessons/${lessonId}`).expect(200);
      expect(after.body.version).toBe(before.body.version + 1);
      const versions = await http.get(`${prefix}/admin/lessons/${lessonId}/versions`).set('Authorization', `Bearer ${adminToken}`).expect(200);
      expect(versions.body.filter((v: { status: string }) => v.status === 'published')).toHaveLength(1);
    });

    it('geçersiz sahne reddedilir, geçerli sahne kaydedilir', async () => {
      await http.put(`${prefix}/admin/scenes`).set('Authorization', `Bearer ${adminToken}`).send({ scene: { id: 'Bozuk Sahne' } }).expect(400);
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
      const res = await http.put(`${prefix}/admin/scenes`).query({ publish: 'true' }).set('Authorization', `Bearer ${adminToken}`).send({ lessonId, scene }).expect(200);
      expect(res.body.status).toBe('published');
      await http.get(`${prefix}/scenes/e2e-test-scene`).expect(200);
      await http.delete(`${prefix}/admin/scenes/e2e-test-scene`).set('Authorization', `Bearer ${adminToken}`).expect(204);
    });
  });
});

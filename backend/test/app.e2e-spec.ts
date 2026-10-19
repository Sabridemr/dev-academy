import type { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import request from 'supertest';
import { CURRICULUM } from '@devacademy/shared';
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

  /** Kayıt uç noktasının hız sınırını tüketmeden test kullanıcısı + access token üretir */
  async function directUser(tag: string): Promise<string> {
    const user = await app
      .get(PrismaService)
      .user.create({ data: { email: `e2e_${tag}_${Date.now()}@test.local`, displayName: tag } });
    const token = await app
      .get(JwtService)
      .signAsync(
        { sub: user.id, email: user.email, role: user.role, type: 'access' },
        { secret: process.env.JWT_ACCESS_SECRET, expiresIn: 900 },
      );
    return `Bearer ${token}`;
  }

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
      const res = await http
        .post(`${prefix}/auth/register`)
        .send({ email, password, displayName: 'E2E Kullanıcı' })
        .expect(201);
      expect(res.body.user.email).toBe(email);
      expect(res.body.user).not.toHaveProperty('passwordHash');
      accessToken = res.body.tokens.accessToken;
      refreshToken = res.body.tokens.refreshToken;
    });

    it('aynı e-posta ile ikinci kayıt 409 döner', async () => {
      await http
        .post(`${prefix}/auth/register`)
        .send({ email, password, displayName: 'Tekrar' })
        .expect(409);
    });

    it('doğrulama hatası merkezi formatta döner', async () => {
      const res = await http
        .post(`${prefix}/auth/register`)
        .send({ email: 'gecersiz', password: '1' })
        .expect(400);
      expect(res.body).toMatchObject({ statusCode: 400, message: 'Doğrulama hatası' });
      expect(res.body.details.map((d: { path: string }) => d.path)).toEqual(
        expect.arrayContaining(['email', 'password', 'displayName']),
      );
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
      await http
        .post(`${prefix}/auth/refresh`)
        .send({ refreshToken: r1.body.refreshToken })
        .expect(401);
      const login = await http.post(`${prefix}/auth/login`).send({ email, password }).expect(200);
      accessToken = login.body.tokens.accessToken;
      refreshToken = login.body.tokens.refreshToken;
    });

    it('korumalı uç nokta token olmadan 401', async () => {
      await http.get(`${prefix}/users/me`).expect(401);
    });

    it('şifre değiştirme mevcut şifreyi zorunlu tutar ve oturumları kapatır', async () => {
      const cpEmail = `e2e_cp_${Date.now()}@test.local`;
      const reg = await http
        .post(`${prefix}/auth/register`)
        .send({ email: cpEmail, password, displayName: 'Şifre' })
        .expect(201);
      const auth = `Bearer ${reg.body.tokens.accessToken}`;
      await http
        .post(`${prefix}/auth/change-password`)
        .set('Authorization', auth)
        .send({ newPassword: 'YeniSifre123!' })
        .expect(400);
      await http
        .post(`${prefix}/auth/change-password`)
        .set('Authorization', auth)
        .send({ currentPassword: 'yanlis-sifre', newPassword: 'YeniSifre123!' })
        .expect(401);
      await http
        .post(`${prefix}/auth/change-password`)
        .set('Authorization', auth)
        .send({ currentPassword: password, newPassword: 'YeniSifre123!' })
        .expect(204);
      await http
        .post(`${prefix}/auth/refresh`)
        .send({ refreshToken: reg.body.tokens.refreshToken })
        .expect(401);
      await http
        .post(`${prefix}/auth/login`)
        .send({ email: cpEmail, password: 'YeniSifre123!' })
        .expect(200);
    });
  });

  describe('web çerez modu (httpOnly refresh token)', () => {
    it('refresh token gövdede değil httpOnly çerezde; yenileme ve çıkış çerezle çalışır', async () => {
      const login = await http
        .post(`${prefix}/auth/login`)
        .set('X-Auth-Mode', 'cookie')
        .send({ email, password })
        .expect(200);
      expect(login.body.tokens.refreshToken).toBe('');
      const setCookie = String(login.headers['set-cookie']);
      expect(setCookie).toMatch(/da_rt=[^;]+/);
      expect(setCookie).toMatch(/HttpOnly/i);
      expect(setCookie).toMatch(/SameSite=Lax/i);
      const cookie = setCookie.match(/da_rt=[^;]+/)![0];

      // Başlıksız istek çerezi kullanmaz (mobil sözleşmesi değişmez)
      await http.post(`${prefix}/auth/refresh`).set('Cookie', cookie).send({}).expect(401);

      const refreshed = await http
        .post(`${prefix}/auth/refresh`)
        .set('X-Auth-Mode', 'cookie')
        .set('Cookie', cookie)
        .send({})
        .expect(200);
      expect(refreshed.body.accessToken).toBeTruthy();
      expect(refreshed.body.refreshToken).toBe('');
      const rotated = String(refreshed.headers['set-cookie']).match(/da_rt=[^;]+/)![0];
      expect(rotated).not.toBe(cookie);

      const out = await http
        .post(`${prefix}/auth/logout`)
        .set('X-Auth-Mode', 'cookie')
        .set('Cookie', rotated)
        .set('Authorization', `Bearer ${refreshed.body.accessToken}`)
        .send({})
        .expect(204);
      expect(String(out.headers['set-cookie'])).toMatch(/da_rt=;/);
      await http
        .post(`${prefix}/auth/refresh`)
        .set('X-Auth-Mode', 'cookie')
        .set('Cookie', rotated)
        .send({})
        .expect(401);
    });
  });

  describe('ders görselleri (/assets)', () => {
    it('görseli doğru türde, kalıcı önbellek başlıklarıyla döner; ETag ile 304; geçersiz ad 404', async () => {
      const png = Buffer.from(
        '89504e470d0a1a0a0000000d49484452000000030000000208060000009d74066a0000000d4944415478da63f8ffff3f0300050001fe4c9a840000000049454e44ae426082',
        'hex',
      );
      const id = createHash('sha256').update(png).digest('hex');
      await app.get(PrismaService).contentAsset.upsert({
        where: { id },
        update: {},
        create: { id, mime: 'image/png', bytes: png, width: 3, height: 2, size: png.length },
      });
      const res = await http.get(`${prefix}/assets/${id}.png`).expect(200);
      expect(res.headers['content-type']).toBe('image/png');
      expect(res.headers['cache-control']).toContain('immutable');
      expect(Buffer.compare(res.body as Buffer, png)).toBe(0);
      await http
        .get(`${prefix}/assets/${id}.png`)
        .set('If-None-Match', res.headers.etag)
        .expect(304);
      await http.get(`${prefix}/assets/${'0'.repeat(64)}.png`).expect(404);
      await http.get(`${prefix}/assets/..%2F..%2Fetc%2Fpasswd`).expect(404);
    });
  });

  describe('users', () => {
    it('profil getirir ve günceller', async () => {
      const me = await http
        .get(`${prefix}/users/me`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);
      expect(me.body.email).toBe(email);
      const upd = await http
        .patch(`${prefix}/users/me`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ selectedPathId: 'system-design', reminderHour: 20, locale: 'en' })
        .expect(200);
      expect(upd.body.selectedPathId).toBe('system-design');
      expect(upd.body.reminderHour).toBe(20);
    });
    it('bilinmeyen öğrenme yolu 404', async () => {
      await http
        .patch(`${prefix}/users/me`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ selectedPathId: 'yok' })
        .expect(404);
    });

    it('geçersiz saat dilimi 400', async () => {
      await http
        .patch(`${prefix}/users/me`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ timezone: 'Nope/Zone' })
        .expect(400);
    });

    it('push token başka hesaba devredilemez; sahibi bırakınca kaydedilebilir', async () => {
      const otherAuth = await directUser('push');
      const token = `ExponentPushToken[e2e-${Date.now()}]`;
      await http
        .post(`${prefix}/users/me/push-tokens`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ token, platform: 'ios' })
        .expect(204);
      await http
        .post(`${prefix}/users/me/push-tokens`)
        .set('Authorization', otherAuth)
        .send({ token, platform: 'ios' })
        .expect(409);
      await http
        .post(`${prefix}/users/me/push-tokens`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ token, platform: 'ios' })
        .expect(204);
      await http
        .delete(`${prefix}/users/me/push-tokens/${encodeURIComponent(token)}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(204);
      await http
        .post(`${prefix}/users/me/push-tokens`)
        .set('Authorization', otherAuth)
        .send({ token, platform: 'ios' })
        .expect(204);
    });
  });

  describe('content', () => {
    it('yolları ve modülleri listeler', async () => {
      const paths = await http.get(`${prefix}/paths`).expect(200);
      expect(paths.body.map((p: { id: string }) => p.id)).toEqual(
        expect.arrayContaining(['backend', 'system-design', 'ai', 'interview-prep']),
      );
      const modules = await http.get(`${prefix}/modules`).expect(200);
      // content/ klasöründeki her modül yayında (müfredatla aynı sayı)
      expect(modules.body).toHaveLength(CURRICULUM.length);
      expect(modules.body[0].code).toBe('A');
    });

    it('modül detayı kullanıcı ilerlemesiyle döner', async () => {
      const res = await http
        .get(`${prefix}/modules/a-system-design-fundamentals`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);
      const lb = res.body.lessons.find((l: { id: string }) => l.id === lessonId);
      expect(lb).toBeDefined();
      expect(lb.progress.status).toBe('not_started');
      expect(lb.hasAnimation && lb.hasInteractive && lb.hasQuiz).toBe(true);
    });

    it('ders detayı: bloklar, inline SVG, sahne ve quiz referansları', async () => {
      const res = await http.get(`${prefix}/lessons/${lessonId}`).expect(200);
      const types = res.body.blocks.map((b: { type: string }) => b.type);
      expect(types).toEqual(
        expect.arrayContaining([
          'text',
          'diagram',
          'animation',
          'interactive',
          'code',
          'realworld',
          'quiz',
          'next',
        ]),
      );
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

    it('token’lı ders yanıtı paylaşılan cache’e düşmez; anonim yanıt public kalır', async () => {
      const authed = await http
        .get(`${prefix}/lessons/${lessonId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);
      expect(authed.headers['cache-control']).toMatch(/private/);
      expect(authed.headers.vary).toMatch(/Authorization/);
      const anon = await http.get(`${prefix}/lessons/${lessonId}`).expect(200);
      expect(anon.headers['cache-control']).toMatch(/public/);
    });

    it('WebSocket CORS yalnızca izinli origin’lere açık', async () => {
      const allowed = await http
        .get('/ws/')
        .query({ EIO: '4', transport: 'polling' })
        .set('Origin', 'http://localhost:3000');
      expect(allowed.headers['access-control-allow-origin']).toBe('http://localhost:3000');
      const denied = await http
        .get('/ws/')
        .query({ EIO: '4', transport: 'polling' })
        .set('Origin', 'http://evil.example');
      expect(denied.headers['access-control-allow-origin']).toBeUndefined();
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
      const res = await http
        .get(`${prefix}/offline/modules/a-system-design-fundamentals`)
        .expect(200);
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

  describe('bookmarks + notes', () => {
    it('yer imi ekler (idempotent), listeler, siler', async () => {
      const a = await http
        .post(`${prefix}/bookmarks`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ lessonId, blockId: 'diagram-1' })
        .expect(201);
      const b = await http
        .post(`${prefix}/bookmarks`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ lessonId, blockId: 'diagram-1' })
        .expect(201);
      expect(b.body.id).toBe(a.body.id);
      const list = await http
        .get(`${prefix}/bookmarks`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);
      expect(list.body).toHaveLength(1);
      await http
        .delete(`${prefix}/bookmarks/${a.body.id}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(204);
    });

    it('ders düzeyinde eş zamanlı yer imleri tek kayıt olur', async () => {
      const [a, b] = await Promise.all(
        [1, 2].map(() =>
          http
            .post(`${prefix}/bookmarks`)
            .set('Authorization', `Bearer ${accessToken}`)
            .send({ lessonId }),
        ),
      );
      expect([a.status, b.status]).toEqual([201, 201]);
      expect(b.body.id).toBe(a.body.id);
      expect(a.body.blockId).toBeNull();
      const list = await http
        .get(`${prefix}/bookmarks`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);
      expect(list.body.filter((x: { blockId: string | null }) => x.blockId === null)).toHaveLength(
        1,
      );
      await http
        .delete(`${prefix}/bookmarks/${a.body.id}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(204);
    });

    it('not oluşturur, günceller, siler', async () => {
      const n = await http
        .post(`${prefix}/notes`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ lessonId, body: 'Least connections uzun isteklerde iyi.' })
        .expect(201);
      const u = await http
        .patch(`${prefix}/notes/${n.body.id}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ body: 'Güncellendi' })
        .expect(200);
      expect(u.body.body).toBe('Güncellendi');
      await http
        .delete(`${prefix}/notes/${n.body.id}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(204);
    });
  });

  describe('search', () => {
    it('ders ve kavram arar', async () => {
      const res = await http.get(`${prefix}/search`).query({ q: 'round-robin' }).expect(200);
      expect(res.body.results.some((r: { id: string }) => r.id === lessonId)).toBe(true);
    });
    it('full-text eşleşmesi yoksa alt dize yedeğiyle bulur', async () => {
      const res = await http.get(`${prefix}/search`).query({ q: 'robi' }).expect(200);
      expect(res.body.results.some((r: { id: string }) => r.id === lessonId)).toBe(true);
    });
    it('modül başlığını büyük/küçük harf duyarsız ve iki dilde arar', async () => {
      const en = await http.get(`${prefix}/search`).query({ q: 'FUNDAMENTALS' }).expect(200);
      expect(
        en.body.results.some(
          (r: { type: string; id: string }) =>
            r.type === 'module' && r.id === 'a-system-design-fundamentals',
        ),
      ).toBe(true);
      const tr = await http.get(`${prefix}/search`).query({ q: 'sistem tasar' }).expect(200);
      expect(
        tr.body.results.some(
          (r: { type: string; id: string }) =>
            r.type === 'module' && r.id === 'a-system-design-fundamentals',
        ),
      ).toBe(true);
    });
    it('çok kısa sorgu boş döner', async () => {
      const res = await http.get(`${prefix}/search`).query({ q: 'a' }).expect(200);
      expect(res.body.results).toEqual([]);
    });
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
            '../../content/modules/a-system-design-fundamentals/a-05-load-balancing/quiz.json',
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

  describe('oturum iptali ve hesap silme', () => {
    // Kayıt uç noktası dakikada 5 istekle sınırlı: tek kullanıcıyla iki senaryo sırayla
    it('tüm cihazlardan çıkış access token’ları hemen geçersiz kılar; hesap silinince veriler gider', async () => {
      const userEmail = `e2e_erase_${Date.now()}@test.local`;
      const reg = await http
        .post(`${prefix}/auth/register`)
        .send({ email: userEmail, password, displayName: 'Silinecek' })
        .expect(201);
      const first = reg.body.tokens as { accessToken: string; refreshToken: string };
      await new Promise((r) => setTimeout(r, 1100)); // iat saniye hassasiyetinde
      await http
        .post(`${prefix}/auth/logout`)
        .set('Authorization', `Bearer ${first.accessToken}`)
        .send({ everywhere: true })
        .expect(204);
      await http
        .get(`${prefix}/users/me`)
        .set('Authorization', `Bearer ${first.accessToken}`)
        .expect(401);

      const login = await http
        .post(`${prefix}/auth/login`)
        .send({ email: userEmail, password })
        .expect(200);
      const second = login.body.tokens as { accessToken: string; refreshToken: string };
      await http
        .post(`${prefix}/bookmarks`)
        .set('Authorization', `Bearer ${second.accessToken}`)
        .send({ lessonId })
        .expect(201);
      await http
        .delete(`${prefix}/users/me`)
        .set('Authorization', `Bearer ${second.accessToken}`)
        .expect(204);
      await http
        .get(`${prefix}/users/me`)
        .set('Authorization', `Bearer ${second.accessToken}`)
        .expect(401);
      await http
        .post(`${prefix}/auth/refresh`)
        .send({ refreshToken: second.refreshToken })
        .expect(401);
      // Hesap gerçekten silindi: aynı bilgilerle giriş artık başarısız
      await http.post(`${prefix}/auth/login`).send({ email: userEmail, password }).expect(401);
    });
  });
});

import type { INestApplication } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { CURRICULUM } from '@devacademy/shared';
import { PrismaService } from '../../src/common/prisma/prisma.service';
import { createDirectUser, lessonId, prefix, useE2eApp, type Http } from './helpers';

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
});

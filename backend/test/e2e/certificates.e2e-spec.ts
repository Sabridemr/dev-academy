import type { INestApplication } from '@nestjs/common';
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

  describe('sertifikalar', () => {
    it('modül bitince sertifika ve modül XP’si; herkese açık doğrulama sayfası', async () => {
      const prisma = app.get(PrismaService);
      const groups = await prisma.lesson.groupBy({
        by: ['moduleId'],
        where: { publishedVersionId: { not: null } },
        _count: { _all: true },
      });
      const smallest = groups.sort((a, b) => a._count._all - b._count._all)[0];
      const lessons = await prisma.lesson.findMany({
        where: { moduleId: smallest.moduleId, publishedVersionId: { not: null } },
        select: { id: true },
      });
      const auth = await directUser('cert');
      for (const l of lessons)
        await http
          .put(`${prefix}/progress/lessons/${l.id}`)
          .set('Authorization', auth)
          .send({ percent: 100, completed: true })
          .expect(200);

      const certs = await http.get(`${prefix}/certificates`).set('Authorization', auth).expect(200);
      const cert = certs.body.find(
        (c: { targetType: string; targetId: string }) =>
          c.targetType === 'module' && c.targetId === smallest.moduleId,
      );
      expect(cert).toBeDefined();
      expect(cert).toMatchObject({ userName: 'cert', lessonCount: lessons.length });
      expect(cert.publicId).toMatch(/^[A-Za-z0-9_-]{16}$/);

      const pub = await http.get(`${prefix}/certificates/public/${cert.publicId}`).expect(200);
      expect(pub.body).toMatchObject({
        id: cert.id,
        userName: 'cert',
        targetId: smallest.moduleId,
      });
      expect(pub.body.title).toBeTruthy();
      await http.get(`${prefix}/certificates/public/yok-boyle-bir-sertifika`).expect(404);
      await http.get(`${prefix}/certificates`).expect(401);

      const xp = await http.get(`${prefix}/progress/xp`).set('Authorization', auth).expect(200);
      expect(xp.body.filter((e: { kind: string }) => e.kind === 'moduleCompleted')).toHaveLength(1);
    });
  });
});

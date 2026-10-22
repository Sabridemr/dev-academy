import type { INestApplication } from '@nestjs/common';
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
});

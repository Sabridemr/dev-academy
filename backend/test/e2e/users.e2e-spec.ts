import type { INestApplication } from '@nestjs/common';
import {
  createDirectUser,
  directUser as directUserOf,
  prefix,
  useE2eApp,
  type Http,
} from './helpers';

describe('DevAcademy API (e2e)', () => {
  const e2e = useE2eApp();
  let app: INestApplication;
  let http: Http;
  let email = '';
  let accessToken = '';
  const directUser = (tag: string, data?: Parameters<typeof directUserOf>[2]) =>
    directUserOf(app, tag, data);

  beforeAll(async () => {
    ({ app, http } = e2e);
    // Bu dosyanın ortak öğrenci hesabı (eski tek dosyada kayıt testinin açtığı hesabın yerine)
    const user = await createDirectUser(app, 'main');
    email = user.email;
    accessToken = user.accessToken;
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
});

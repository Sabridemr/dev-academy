import type { INestApplication } from '@nestjs/common';
import { createHash } from 'node:crypto';
import * as argon2 from 'argon2';
import { PrismaService } from '../../src/common/prisma/prisma.service';
import { NotificationsService } from '../../src/modules/notifications/notifications.service';
import {
  directUser as directUserOf,
  lessonId,
  password,
  prefix,
  useE2eApp,
  type Http,
} from './helpers';

describe('DevAcademy API (e2e)', () => {
  const e2e = useE2eApp();
  let app: INestApplication;
  let http: Http;
  const email = `e2e_${Date.now()}@test.local`;
  let refreshToken = '';
  const directUser = (tag: string, data?: Parameters<typeof directUserOf>[2]) =>
    directUserOf(app, tag, data);

  beforeAll(() => {
    ({ app, http } = e2e);
  });

  describe('auth', () => {
    it('kayıt olur ve token çifti alır', async () => {
      const res = await http
        .post(`${prefix}/auth/register`)
        .send({ email, password, displayName: 'E2E Kullanıcı' })
        .expect(201);
      expect(res.body.user.email).toBe(email);
      expect(res.body.user).not.toHaveProperty('passwordHash');
      expect(res.body.tokens.accessToken).toBeTruthy();
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
      expect(login.body.tokens.accessToken).toBeTruthy();
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

  describe('şifre sıfırlama ve e-posta doğrulama', () => {
    const tokenOf = (text: string) => decodeURIComponent(text.match(/token=([^\s]+)/)![1]);

    it('forgot her zaman 204; bağlantıyla şifre sıfırlanır, oturumlar kapanır, token tek kullanımlık', async () => {
      const mail = jest.spyOn(app.get(NotificationsService), 'sendEmail');
      mail.mockClear();
      // Kayıt/giriş uç noktalarının hız sınırını tüketmemek için kullanıcı ve oturum doğrudan oluşturulur
      const prisma = app.get(PrismaService);
      const resetEmail = `e2e_reset_${Date.now()}@test.local`;
      const user = await prisma.user.create({
        data: {
          email: resetEmail,
          displayName: 'Sıfırla',
          passwordHash: await argon2.hash(password),
        },
      });
      const session = await prisma.refreshToken.create({
        data: {
          userId: user.id,
          tokenHash: createHash('sha256').update(`rt-${user.id}`).digest('hex'),
          family: 'e2e-reset',
          expiresAt: new Date(Date.now() + 3_600_000),
        },
      });

      await http.post(`${prefix}/auth/forgot`).send({ email: 'yok_boyle@test.local' }).expect(204);
      expect(mail).not.toHaveBeenCalled();
      await http
        .post(`${prefix}/auth/forgot`)
        .send({ email: resetEmail.toUpperCase() })
        .expect(204);
      expect(mail).toHaveBeenCalledTimes(1);
      const [to, , text] = mail.mock.calls[0];
      expect(to).toBe(resetEmail);
      expect(text).toContain('http://localhost:3000/reset-password?token=');
      const token = tokenOf(text);

      await http
        .post(`${prefix}/auth/reset`)
        .send({ token: 'x'.repeat(43), newPassword: 'YeniSifre123!' })
        .expect(400);
      await http
        .post(`${prefix}/auth/reset`)
        .send({ token, newPassword: 'YeniSifre123!' })
        .expect(204);
      await http
        .post(`${prefix}/auth/reset`)
        .send({ token, newPassword: 'BaskaSifre123!' })
        .expect(400);
      // Tüm oturumlar kapandı, yeni şifre geçerli, e-posta doğrulanmış sayılır
      expect(
        (await prisma.refreshToken.findUniqueOrThrow({ where: { id: session.id } })).revokedAt,
      ).toBeInstanceOf(Date);
      const updated = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
      expect(await argon2.verify(updated.passwordHash!, 'YeniSifre123!')).toBe(true);
      expect(await argon2.verify(updated.passwordHash!, password)).toBe(false);
      expect(updated.emailVerifiedAt).toBeInstanceOf(Date);
      mail.mockRestore();
    });

    it('e-posta doğrulama bağlantısı istenir ve onaylanır', async () => {
      const mail = jest.spyOn(app.get(NotificationsService), 'sendEmail');
      mail.mockClear();
      const auth = await directUser('verify', { passwordHash: await argon2.hash(password) });
      await http.post(`${prefix}/auth/verify-email/request`).expect(401);
      await http.post(`${prefix}/auth/verify-email/request`).set('Authorization', auth).expect(204);
      expect(mail).toHaveBeenCalledTimes(1);
      const text = mail.mock.calls[0][2];
      expect(text).toContain('/verify-email?token=');
      const token = tokenOf(text);
      // Doğrulama token'ı şifre sıfırlamada kullanılamaz
      await http
        .post(`${prefix}/auth/reset`)
        .send({ token, newPassword: 'YeniSifre123!' })
        .expect(400);
      await http.post(`${prefix}/auth/verify-email`).send({ token }).expect(204);
      await http.post(`${prefix}/auth/verify-email`).send({ token }).expect(400);
      const me = await http.get(`${prefix}/users/me`).set('Authorization', auth).expect(200);
      expect(me.body.emailVerified).toBe(true);
      mail.mockRestore();
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

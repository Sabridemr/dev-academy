import type { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import request from 'supertest';
import { createApp } from '../../src/main';
import { PrismaService } from '../../src/common/prisma/prisma.service';
import { RedisService } from '../../src/common/redis/redis.service';

/**
 * Uçtan uca testlerin ortak kurulumu. Her *.e2e-spec.ts dosyası kendi uygulama örneğini açar,
 * seed edilmiş test veritabanını kullanır ve kendi başına (tek dosya olarak da) çalışabilir.
 */

export const prefix = '/api/v1';
/** Seed edilmiş A-05 referans dersi */
export const lessonId = 'a-05-load-balancing';
export const password = 'Sifre1234!';

export type Http = ReturnType<typeof request>;

export interface E2eContext {
  app: INestApplication;
  http: Http;
}

/**
 * Dosya düzeyinde beforeAll/afterAll kancalarını kaydeder: uygulamayı başlatır, içerik önbelleğini
 * temizler; sonunda `e2e_` önekli test kullanıcılarını silip uygulamayı kapatır.
 * Dönen nesnenin alanları beforeAll çalıştıktan sonra doludur.
 */
export function useE2eApp(): E2eContext {
  const ctx = {} as E2eContext;

  beforeAll(async () => {
    ctx.app = await createApp();
    await ctx.app.init();
    ctx.http = request(ctx.app.getHttpServer());
    await ctx.app.get(RedisService).delByPattern('content:*');
  });

  afterAll(async () => {
    if (!ctx.app) return;
    const prisma = ctx.app.get(PrismaService);
    await prisma.user.deleteMany({ where: { email: { startsWith: 'e2e_' } } });
    await ctx.app.close();
  });

  return ctx;
}

let userSeq = 0;

/**
 * Kayıt uç noktasının hız sınırını tüketmeden test kullanıcısı + access token üretir.
 * E-posta `e2e_` önekiyle başlar; afterAll'da silinir.
 */
export async function createDirectUser(
  app: INestApplication,
  tag: string,
  data: { role?: 'student' | 'admin'; passwordHash?: string } = {},
): Promise<{ id: string; email: string; accessToken: string }> {
  const user = await app.get(PrismaService).user.create({
    data: {
      email: `e2e_${tag}_${Date.now()}_${++userSeq}@test.local`,
      displayName: tag,
      ...data,
    },
  });
  const accessToken = await app
    .get(JwtService)
    .signAsync(
      { sub: user.id, email: user.email, role: user.role, type: 'access' },
      { secret: process.env.JWT_ACCESS_SECRET, expiresIn: 900 },
    );
  return { id: user.id, email: user.email, accessToken };
}

/** createDirectUser kısayolu: `Authorization` başlığına hazır `Bearer …` değeri döner */
export async function directUser(
  app: INestApplication,
  tag: string,
  data: { role?: 'student' | 'admin'; passwordHash?: string } = {},
): Promise<string> {
  return `Bearer ${(await createDirectUser(app, tag, data)).accessToken}`;
}

/**
 * Açık kurulum: referans dersin quizine ayrı bir kullanıcıyla tüm soruları (q1 dahil) yanıtlayan
 * bir deneme gönderir. Deneme geçmişine (attemptAnswer) ya da analitikteki quiz deneme sayısına
 * dayanan testler, eskiden tek dosyada önceki testlerin bıraktığı veriye güveniyordu.
 */
export async function seedQuizAttempt({ app, http }: E2eContext): Promise<void> {
  const auth = await directUser(app, 'attempt');
  const quiz = await http.get(`${prefix}/quizzes/by-lesson/${lessonId}`).expect(200);
  const answers = quiz.body.questions.map((q: { id: string }) => ({
    questionId: q.id,
    selected: [q.id === 'q1' ? 'b' : 'zzz-yanlis'],
  }));
  await http
    .post(`${prefix}/quizzes/${quiz.body.id}/attempts`)
    .set('Authorization', auth)
    .send({ answers })
    .expect(201);
}

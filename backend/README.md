# DevAcademy Backend

NestJS + Prisma (PostgreSQL) + Redis ile REST ve WebSocket API.

## Çalıştırma

```bash
cp .env.example .env              # değerleri düzenleyin (JWT sırları en az 32 karakter)
docker compose up -d postgres redis minio minio-init   # depo kökünden
pnpm --filter @devacademy/shared build
pnpm prisma:migrate               # migration'ları uygula
pnpm prisma:seed                  # content/ klasörünü yükle
pnpm dev                          # http://localhost:4000/api/v1  ·  dokümantasyon: /docs
```

`pnpm prisma:seed` idempotenttir. Hatalı içerik dersleri varsayılan olarak atlanır ve uyarı verilir. CI’da `SEED_STRICT=1` ya da `--strict` ile tüm hatalar seed’i durdurur. Müfredatta olup henüz yazılmamış dersler admin panelinde görünmesi için taslak yer tutucu olarak açılır.

## Ortam değişkenleri

Tam liste ve varsayılanlar: `.env.example`, doğrulama: `src/config/env.ts` (eksik/hatalı değişkende uygulama açılmaz).

| Değişken                                | Açıklama                                                                        |
| --------------------------------------- | ------------------------------------------------------------------------------- |
| `DATABASE_URL`                          | PostgreSQL bağlantısı                                                           |
| `REDIS_URL`                             | Redis (cache, rate limit). Erişilemezse API çalışmaya devam eder, cache atlanır |
| `JWT_ACCESS_SECRET`                     | ≥ 32 karakter (refresh token’lar opak rastgele değerdir, ayrı sır gerekmez)     |
| `JWT_ACCESS_TTL`, `JWT_REFRESH_TTL`     | saniye (varsayılan 15 dk / 30 gün)                                              |
| `GOOGLE_CLIENT_IDS`, `APPLE_CLIENT_IDS` | virgülle ayrılmış audience listeleri (web + iOS + Android istemci kimlikleri)   |
| `S3_*`                                  | S3 uyumlu depolama (MinIO yerelde)                                              |
| `SMTP_URL`, `MAIL_FROM`                 | e-posta hatırlatmaları (boşsa loglanır)                                         |
| `RATE_LIMIT_TTL`, `RATE_LIMIT_MAX`      | genel istek limiti (auth uç noktalarında daha sıkı)                             |
| `CONTENT_DIR`                           | seed için içerik klasörü                                                        |

## Testler

```bash
pnpm test                         # birim testleri (veritabanı gerekmez)

# e2e: gerçek PostgreSQL + Redis (varsayılan: devacademy_test veritabanı, Redis db 1)
export DATABASE_URL=postgresql://devacademy:devacademy@localhost:5432/devacademy_test?schema=public
pnpm exec prisma migrate deploy && pnpm prisma:seed
pnpm test:e2e
```

E2E kapsamı: health, kayıt/giriş/doğrulama hataları, refresh rotasyonu ve yeniden kullanım tespiti, profil, içerik (modül, ders, slug, ETag/304, sahne, offline paket), quiz puanlama ve cevap gizliliği, ilerleme/seri/rozet, yer imi/not, arama, admin yetkisi, taslak → yayın akışı, sahne doğrulaması.

## Hata formatı

Tüm hatalar aynı gövdeyle döner:

```json
{
  "statusCode": 400,
  "error": "BAD_REQUEST",
  "message": "Doğrulama hatası",
  "details": [{ "path": "email", "message": "Invalid email" }],
  "requestId": "6f1c…",
  "timestamp": "2026-10-18T06:00:00.000Z"
}
```

## WebSocket

`/ws` yolunda socket.io. Bağlanırken `auth: { token: <accessToken> }` gönderilirse kullanıcı kendi odasına alınır. Sunucu `event` adıyla şu olayları yayınlar: `progress.updated`, `badge.earned`, `streak.updated`, `content.published`, `simulation.tick`. İstemci `subscribe.lesson`, `simulation.join`, `simulation.input` gönderebilir.

## Yapı

```
src/
  config/          ortam değişkenleri (zod)
  common/          prisma, redis, guard'lar, filtre, ETag, rate limit deposu, zod pipe, OpenAPI yardımcıları
  modules/
    auth/ users/ content/ quizzes/ progress/ library/ search/ admin/
    realtime/ notifications/ health/ offline/
prisma/
  schema.prisma    veri modeli
  migrations/      SQL migration'lar
  seed.ts          içerik yükleyici
test/              e2e testleri
```

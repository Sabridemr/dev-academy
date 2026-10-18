# DevAcademy

Yazılım mühendisliği, sistem tasarımı ve yapay zekâ konularını **görsel, animasyonlu ve interaktif** derslerle öğreten web + mobil platform.

Her ders aynı akışı izler: kısa kavram açıklaması → statik SVG diyagram → adım adım oynatılan animasyon → interaktif simülatör → gerçek dünya örneği (Amazon, Netflix, Uber…) → 3–5 soruluk quiz → bir sonraki adım.

| Katman | Klasör | Teknoloji |
|---|---|---|
| Ortak paket | `packages/shared` | TypeScript, zod — sahne şeması, oynatıcı durum makinesi, API tipleri, simülatör mantığı |
| Backend | `backend/` | NestJS, Prisma, PostgreSQL, Redis, S3, socket.io |
| Web | `web/` | Next.js (App Router), Tailwind, Framer Motion, Shiki, React Flow, TensorFlow.js |
| Mobil | `mobile/` | Expo (React Native), Reanimated, react-native-svg, Lottie, SQLite + MMKV |
| İçerik | `content/` | Markdown + JSON + SVG (7 modül, 49 ders) |

Mimari ayrıntıları için [docs/architecture.md](docs/architecture.md). Projenin kendi mimarisi uygulamada da bir ders olarak anlatılır: **F-08 DevAcademy’nin Kendi Mimarisi**.

## Hızlı başlangıç

Gereksinimler: Node.js ≥ 20, pnpm ≥ 9, Docker (ya da yerel PostgreSQL 16 + Redis 7).

```bash
pnpm install
cp backend/.env.example backend/.env

# Altyapı: PostgreSQL, Redis, MinIO
docker compose up -d postgres redis minio minio-init

# Ortak paketi derle, veritabanını hazırla ve içeriği yükle
pnpm --filter @devacademy/shared build
pnpm db:migrate
pnpm db:seed

# Geliştirme sunucuları (API :4000, web :3000)
pnpm --filter @devacademy/backend dev
pnpm --filter @devacademy/web dev

# Mobil (ayrı terminal) — ayrıntılar mobile/README.md
pnpm --filter @devacademy/mobile start
```

- Web: http://localhost:3000
- API: http://localhost:4000/api/v1 — OpenAPI arayüzü: http://localhost:4000/docs
- Admin hesabı (seed): `admin@devacademy.local` / `Admin123!` → http://localhost:3000/admin

Tam yığını Docker ile çalıştırmak için:

```bash
docker compose --profile app up -d --build
docker compose run --rm seed
```

## Sık kullanılan komutlar

| Komut | Açıklama |
|---|---|
| `pnpm build` | Tüm paketleri derler (Turborepo, bağımlılık sırasıyla) |
| `pnpm test` | Tüm birim testleri |
| `pnpm typecheck` | Tüm paketlerde TypeScript kontrolü |
| `pnpm content:validate` | `content/` klasörünü şemalara göre doğrular, müfredat kapsamını raporlar |
| `pnpm db:migrate` / `pnpm db:seed` | Migration uygular / içeriği yükler (idempotent) |
| `pnpm --filter @devacademy/backend test:e2e` | Gerçek PostgreSQL + Redis ile API uçtan uca testleri |
| `pnpm --filter @devacademy/web test:e2e` | Playwright (masaüstü + mobil görünüm) |

## Animasyon sahnesi şeması

Animasyonlar platformdan bağımsız JSON “sahnelerinden” üretilir (`packages/shared/src/scene/schema.ts`). Bir sahne düğümler, kenarlar ve adımlardan oluşur. Her adım vurgulanan öğeleri, düğüm durumlarını, kenarlar üzerinde hareket eden paketleri, notları ve anlatım metnini tanımlar. Web (SVG + Framer Motion) ve mobil (react-native-svg + Reanimated) aynı JSON’u aynı `playerReducer` / `resolveStepView` / `computePackets` fonksiyonlarıyla oynatır; yalnızca çizim katmanı farklıdır.

- Örnek sahne: [`packages/shared/examples/load-balancer-round-robin.scene.json`](packages/shared/examples/load-balancer-round-robin.scene.json)
- JSON Schema (editör otomatik tamamlama): `packages/shared/schema/animation-scene.schema.json` — `pnpm --filter @devacademy/shared schema:export` ile yeniden üretilir
- Kontroller: oynat/duraklat, adım ileri/geri, hız, açıklamayı göster/gizle, adım çizelgesinden atlama, klavye kısayolları
- Erişilebilirlik: her sahnede zorunlu `a11y.description` ve adım transkripti; `prefers-reduced-motion` açıkken paketler animasyonsuz gösterilir

## İçerik yazmak

İçerik yazım kılavuzu: [content/README.md](content/README.md). Kısaca:

```
content/modules/<modül-id>/<ders-id>/
  lesson.md        frontmatter + Markdown + :::diagram / :::animation / :::interactive / :::code / :::realworld / :::callout / :::quiz / :::next
  scene.json       animasyon sahnesi (birden fazla olabilir: <ad>.scene.json)
  quiz.json        3–5 soru
  diagram.svg      tema uyumlu (CSS değişkenleri) SVG
```

Admin panelinden (web) dersler taslak olarak düzenlenir, sahne editöründe görsel olarak düzenlenir ve yayınlanır; her yayın yeni bir ders sürümü oluşturur.

## Kararlar ve varsayımlar

- **Monorepo + ortak paket**: Sahne şeması, API tipleri ve oyunlaştırma kuralları tek kaynaktan gelir; bir alan değiştiğinde üç katmanda derleme hatası alınır.
- **İçerik Git’te**: Code review, diff ve CI doğrulaması için. Admin paneli aynı veritabanı sürümlerini düzenler; panelde yapılan değişiklikleri `content/` klasörüne geri yazan bir dışa aktarım henüz yoktur.
- **Tek React sürümü**: React Native 0.79, React 19.0.0 gerektirir. `node-linker=hoisted` (Expo/Metro gereği) ile çakışma olmaması için tüm çalışma alanı `pnpm.overrides` ile React 19.0.0’a sabitlenmiştir.
- **Kimlik doğrulama**: Web istemcisi token’ları `localStorage`’da tutar (SPA modeli). Daha yüksek güvenlik için refresh token’ı httpOnly çerezde tutan bir BFF katmanı önerilir. Mobil token’ları `expo-secure-store`’da tutar.
- **Web güvenliği**: İçerik SVG’leri DOMPurify ile temizlenir, sayfalar Content-Security-Policy ile sunulur. CSP’nin `connect-src` değeri build anındaki `NEXT_PUBLIC_API_URL`’den hesaplanır; API adresi değişirse web yeniden build edilmelidir. Swagger (`/docs`) üretimde kapalıdır.
- **Arama**: PostgreSQL full-text (`simple` sözlük) + ILIKE yedeği; içerik ölçeği ayrı bir arama motorunu gerektirmiyor.
- **Bildirimler**: Saatlik zamanlanmış iş, kullanıcının saat dilimine göre hatırlatma saati gelen ve o gün çalışmamış kullanıcılara Expo push (yoksa e-posta) gönderir.

## Lisans

Bu depo eğitim amaçlı bir projedir.

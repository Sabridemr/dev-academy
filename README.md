# DevAcademy

Yazılım mühendisliği, sistem tasarımı ve yapay zekâ konularını **görsel, animasyonlu ve interaktif** derslerle öğreten web + mobil platform.

Her ders aynı akışı izler: kısa kavram açıklaması → statik SVG diyagram → adım adım oynatılan animasyon → interaktif simülatör → gerçek dünya örneği (Amazon, Netflix, Uber…) → 3–6 soruluk quiz → bir sonraki adım.

| Katman      | Klasör            | Teknoloji                                                                               |
| ----------- | ----------------- | --------------------------------------------------------------------------------------- |
| Ortak paket | `packages/shared` | TypeScript, zod — sahne şeması, oynatıcı durum makinesi, API tipleri, simülatör mantığı |
| Backend     | `backend/`        | NestJS, Prisma, PostgreSQL, Redis, S3, socket.io                                        |
| Web         | `web/`            | Next.js (App Router), Tailwind, Framer Motion, Shiki, React Flow, TensorFlow.js         |
| Mobil       | `mobile/`         | Expo (React Native), Reanimated, react-native-svg, Lottie, SQLite + MMKV                |
| İçerik      | `content/`        | Markdown + JSON + SVG (14 modül, 122 ders)                                              |

Mimari ayrıntıları için [docs/architecture.md](docs/architecture.md). Projenin kendi mimarisi uygulamada da bir ders olarak anlatılır: **F-08 DevAcademy’nin Kendi Mimarisi**.

## Hızlı başlangıç

Gereksinimler: Node.js 22–24, pnpm 10 (`corepack enable` ile gelir), Docker (ya da yerel PostgreSQL 16 + Redis 7).

```bash
corepack enable          # pnpm'i package.json'daki sürümle PATH'e ekler (bir kez)
pnpm install
cp backend/.env.example backend/.env   # JWT_ACCESS_SECRET'ı değiştirin (en az 32 karakter)

# Altyapı: PostgreSQL + Redis. `--profile media` MinIO'yu da açar (yalnızca admin medya yükleme için)
docker compose --profile media up -d

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

## Ev sunucusunda (LAN) çalıştırma

Tam yığın Docker'da, mobil uygulama ise sunucudaki Metro'dan telefona yüklenir; internete açılmaz.

```bash
cp .env.example .env            # PUBLIC_HOST=<sunucunun LAN IP'si>, JWT_ACCESS_SECRET'ı değiştirin
docker compose --profile app up -d --build
docker compose run --rm seed    # içeriği yükler (ilk kurulum ve içerik değiştikçe)
```

- Web: `http://<LAN-IP>:3000`, API: `http://<LAN-IP>:4000/api/v1`. `PUBLIC_HOST` değişince `--build` ile web
  imajı yeniden derlenmelidir (API adresi derleme anında gömülür).
- Mobil, native modüller (MMKV, SQLite) kullandığı için **Expo Go'da çalışmaz**; bir kez "development build"
  (expo-dev-client) üretilip telefona kurulur, sonra JS sunucudaki Metro'dan gelir:

```bash
cd mobile && cp .env.example .env    # EXPO_PUBLIC_API_URL=http://<LAN-IP>:4000/api/v1, EXPO_PUBLIC_WEB_URL=http://<LAN-IP>:3000
npx eas-cli login && npx eas-cli build --profile development --platform android   # tek seferlik; APK'yı telefona kurun
pnpm start --lan                     # Metro :8081; telefondaki DevAcademy (Dev) uygulaması QR/adresle bağlanır
```

Telefon ve sunucu aynı ağda olmalı; 3000, 4000 ve 8081 portları sunucu güvenlik duvarında açık olmalıdır.

## Sık kullanılan komutlar

| Komut                                        | Açıklama                                                                 |
| -------------------------------------------- | ------------------------------------------------------------------------ |
| `pnpm build`                                 | Tüm paketleri derler (Turborepo, bağımlılık sırasıyla)                   |
| `pnpm test`                                  | Tüm birim testleri                                                       |
| `pnpm typecheck`                             | Tüm paketlerde TypeScript kontrolü                                       |
| `pnpm content:validate`                      | `content/` klasörünü şemalara göre doğrular, müfredat kapsamını raporlar |
| `pnpm db:migrate` / `pnpm db:seed`           | Migration uygular / içeriği yükler (idempotent)                          |
| `pnpm --filter @devacademy/backend test:e2e` | Gerçek PostgreSQL + Redis ile API uçtan uca testleri                     |
| `pnpm --filter @devacademy/web test:e2e`     | Playwright (masaüstü + mobil görünüm)                                    |

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
  lesson.md        frontmatter + Markdown + :::diagram / :::animation / :::interactive / :::code / :::realworld / :::callout / :::trace / :::quiz / :::next
  scene.json       animasyon sahnesi (birden fazla olabilir: <ad>.scene.json)
  quiz.json        3–6 soru
  diagram.svg      tema uyumlu (CSS değişkenleri) SVG
  x.trace.py       Python kod simülasyonu kaynağı → pnpm content:traces ile x.trace.json
```

Admin panelinden (web) dersler taslak olarak düzenlenir, sahne editöründe görsel olarak düzenlenir ve yayınlanır; her yayın yeni bir ders sürümü oluşturur.

## Kararlar ve varsayımlar

- **Monorepo + ortak paket**: Sahne şeması, API tipleri ve oyunlaştırma kuralları tek kaynaktan gelir; bir alan değiştiğinde üç katmanda derleme hatası alınır.
- **İçerik Git’te**: Code review, diff ve CI doğrulaması için. Admin paneli aynı veritabanı sürümlerini düzenler; panelde yapılan değişiklikleri `content/` klasörüne geri yazan bir dışa aktarım henüz yoktur.
- **Tek React sürümü**: Expo SDK 54 / React Native 0.81, React 19.1.0 gerektirir. `node-linker=hoisted` (Expo/Metro gereği) ile çakışma olmaması için tüm çalışma alanı `pnpm.overrides` ile React 19.1.0’a sabitlenmiştir.
- **Kimlik doğrulama**: Web istemcisi refresh token’ı httpOnly çerezde taşır (`X-Auth-Mode: cookie`), access token yalnızca bellektedir; localStorage’da yalnızca profil durur. Web ve API farklı “site”lardaysa `REFRESH_COOKIE_SAMESITE=none` gerekir. CSP istek başına nonce kullanır (`'unsafe-inline'` yok). Mobil token’ları `expo-secure-store`’da tutar. Access token her istekte kullanıcının güncel durumuna (silinmiş mi, rolü, oturumları kapatıldı mı) göre doğrulanır.
- **Web güvenliği**: İçerik SVG’leri DOMPurify ile temizlenir, sayfalar Content-Security-Policy ile sunulur. CSP’nin `connect-src` değeri build anındaki `NEXT_PUBLIC_API_URL`’den hesaplanır; API adresi değişirse web yeniden build edilmelidir. Swagger (`/docs`) üretimde kapalıdır.
- **Arama**: PostgreSQL full-text (`simple` sözlük) + ILIKE yedeği; içerik ölçeği ayrı bir arama motorunu gerektirmiyor.
- **Bildirimler**: Saatlik zamanlanmış iş, kullanıcının saat dilimine göre hatırlatma saati gelen ve o gün çalışmamış kullanıcılara Expo push (yoksa e-posta) gönderir.

## Lisans

Bu depo eğitim amaçlı bir projedir.

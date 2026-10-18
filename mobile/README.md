# DevAcademy Mobil (iOS + Android)

DevAcademy'nin Expo tabanlı mobil uygulaması. Web ile **aynı animasyon sahnelerini** (aynı JSON, aynı
`playerReducer`) oynatır; dersler, interaktif simülatörler, quizler, aralıklı tekrar, çevrimdışı içerik ve
push bildirimleri içerir.

| Katman | Teknoloji |
| --- | --- |
| Çatı | Expo SDK 53, React Native 0.79 (New Architecture), React 19.0, TypeScript (strict) |
| Gezinme | expo-router 5 (dosya tabanlı; `src/app`) |
| Animasyon | react-native-svg 15 + react-native-reanimated 3.17, Lottie (lottie-react-native 7) |
| Veri | @tanstack/react-query 5, zustand 5 |
| Depolama | expo-sqlite 15 (çevrimdışı içerik), react-native-mmkv 3 (ayarlar, ETag, kuyruk), expo-secure-store (token) |
| Kimlik | E-posta/şifre, Google (expo-auth-session), Apple (expo-apple-authentication, yalnızca iOS) |
| Bildirim | expo-notifications 0.31, expo-device |
| Test | jest-expo + @testing-library/react-native, Detox (e2e) |

---

## 1. Kurulum

Gereksinimler: Node ≥ 20, pnpm ≥ 9, (iOS için) Xcode 16+, (Android için) Android Studio + JDK 17.

```bash
# Depo kökünde (monorepo) — .npmrc içindeki node-linker=hoisted Expo/Metro için zorunludur
pnpm install
pnpm --filter @devacademy/shared build      # shared paketi dist/ üretir (mobil buradan içe aktarır)

cd mobile
cp .env.example .env                        # değişkenleri düzenleyin
```

### Ortam değişkenleri (`mobile/.env`)

| Değişken | Açıklama |
| --- | --- |
| `EXPO_PUBLIC_API_URL` | Backend kök adresi, örn. `http://localhost:4000/api/v1`. Android emülatöründe `http://10.0.2.2:4000/api/v1`, fiziksel cihazda bilgisayarın LAN IP'si. |
| `EXPO_PUBLIC_WEB_URL` | Web uygulaması adresi — mobilde olmayan simülatörler için "Web'de aç" bağlantısı. |
| `EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID` / `..._ANDROID_CLIENT_ID` / `..._WEB_CLIENT_ID` | Google OAuth istemci kimlikleri. Boşsa Google butonu devre dışı görünür. Backend'de `GOOGLE_CLIENT_IDS` aynı kimlikleri içermelidir. |
| `EAS_PROJECT_ID` | Expo push token için EAS proje kimliği (`eas init` sonrası). Boşsa yalnızca yerel hatırlatmalar çalışır. |

`EXPO_PUBLIC_*` değişkenleri derleme anında koda gömülür; gizli anahtar koymayın.

## 2. Çalıştırma

> Uygulama MMKV, SQLite ve Lottie gibi native modüller kullandığı için **Expo Go yerine development
> build** gerekir.

```bash
cd mobile
pnpm ios            # = expo run:ios     → iOS simülatörü (ilk seferde native proje üretilir)
pnpm android        # = expo run:android → Android emülatörü / USB ile bağlı cihaz
pnpm start          # yalnızca Metro (development build yüklüyse)
```

Fiziksel cihaz: `pnpm ios --device` / `pnpm android --device`, ya da EAS ile
`eas build --profile development --platform ios|android` (bkz. `eas.json`).

Diğer komutlar:

```bash
pnpm typecheck      # tsc --noEmit (lint = typecheck)
pnpm test           # jest
pnpm build          # expo export --platform all --output-dir dist  (Metro paket doğrulaması)
pnpm test:e2e       # Detox (iOS simülatörü)
```

## 3. Proje yapısı

```
mobile/
├─ app.config.ts            # Expo yapılandırması (scheme: devacademy, bundle id'ler, eklentiler)
├─ metro.config.js          # Monorepo: watchFolders, nodeModulesPaths, tekil paketler, gray-matter saplaması
├─ assets/animations/       # Lottie kutlama animasyonu (celebration.json)
├─ src/
│  ├─ app/                  # expo-router ekranları
│  │  ├─ (auth)/            # login, register
│  │  ├─ (tabs)/            # index (Ana sayfa), modules, review, library, profile
│  │  ├─ lesson/[id].tsx    # Ders görüntüleyici
│  │  ├─ module/[id].tsx    # Modül + çevrimdışı indirme
│  │  ├─ onboarding.tsx     # Öğrenme yolu + hatırlatma saati
│  │  └─ search.tsx         # Debounce'lu arama
│  ├─ components/
│  │  ├─ scene/             # ScenePlayer + SceneCanvas (animasyon motoru)
│  │  ├─ lesson/            # BlockRenderer, Markdown, Diyagram, Kod, Not
│  │  ├─ interactive/       # Simülatörler + kayıt (registry)
│  │  ├─ quiz/              # QuizView
│  │  └─ celebration/       # Lottie kutlama animasyonu
│  ├─ i18n/                 # tr (varsayılan) + en; useI18n()
│  ├─ theme/                # --da-* token'larının RN karşılığı, açık/koyu tema
│  ├─ lib/                  # api.ts (refresh'li istemci), endpoints.ts, storage.ts, network.ts
│  ├─ offline/              # db.ts (SQLite), sync.ts (ETag senkron), queue.ts (MMKV kuyrukları)
│  ├─ notifications/        # push.ts, bildirim yönlendirmesi
│  └─ stores/               # zustand: session, settings
├─ __tests__/               # birim testleri
└─ e2e/                     # Detox duman testi
```

## 4. Animasyon motoru

`src/components/scene/ScenePlayer.tsx` web oynatıcısıyla aynı sahne JSON'unu `@devacademy/shared` içindeki
`playerReducer`, `resolveStepView`, `computePackets`, `edgeGeometry`, `packetPosition` ile oynatır; yalnızca
çizim katmanı farklıdır:

- Zaman `requestAnimationFrame` ile `TICK` eylemi olarak ilerler (kare başına en fazla 100 ms).
- Düğüm durum geçişleri (dolgu/kontur rengi, kalınlık, opaklık, doluluk çubuğu) Reanimated `withTiming` +
  `useAnimatedProps` ile UI thread'de; düğümler `memo` olduğu için paket karelerinde yeniden çizilmez.
- Düğüm ikonları web'deki lucide ikonlarının vektör verisidir (`nodeIcons.ts`) — iki platform birebir aynı.
- Kontroller: oynat/duraklat, adım geri/ileri, baştan, hız (0.5/1/1.5/2), anlatımı göster/gizle, adım çizelgesi
  ile seek. Kamera adımları viewBox'ı yumuşak geçişle değiştirir.
- Erişilebilirlik: `AccessibilityInfo.isReduceMotionEnabled()` → `SET_REDUCED_MOTION` (paketler animasyonsuz),
  genişletilebilir metin transkripti (`a11y.description` + adım anlatımları), tüm kontrollerde etiketler.
- Ölçek: genişlik ekran genişliği, yükseklik `canvas.height / canvas.width` oranından.

### Lottie

- Quiz geçildiğinde `Celebration` (Lottie, `assets/animations/celebration.json`) oynar; reduced-motion açıksa
  son kare statik gösterilir.
- Daha önce bulunan Rive sarmalayıcısı, depoda hiç `.riv` varlığı olmadığı ve her zaman Lottie'ye düştüğü için
  kaldırıldı (gereksiz native bağımlılık).

## 5. Dersler ve simülatörler

`BlockRenderer` tüm `LessonBlock` türlerini çizer: `text` (Markdown), `diagram` (`block.svg` → `SvgXml`;
`var(--da-x, #yedek)` ifadeleri ve `<style>` sınıf kuralları önce tema renklerine çevrilir —
`utils/svgTheme.ts`), `animation`, `interactive`, `code` (eş aralıklı, basit vurgulama, dil sekmeleri),
`realworld`, `callout`, `quiz`, `next`.

Mobilde gerçek etkileşimli simülatörler (26 türün 8'i): `load-balancer`, `cache`, `rate-limiter`,
`consistent-hashing`, `gradient-descent`, `capacity-estimator` (mantık `@devacademy/shared/simulators`'dan) ile
`request-journey` ve `pipeline` (saf mantık `components/interactive/requestJourney.ts` ve `pipeline.ts`'te).
`request-journey` ders içeriğinde en sık kullanılan simülatördür.
Diğer `InteractiveType` değerleri için başlık/yönergeyi gösteren ve `${EXPO_PUBLIC_WEB_URL}/lessons/<id>`
adresini açan bir yedek kart gösterilir. İlk etkileşimde `POST /progress/interactive` (rozetler için) gönderilir.

İlerleme: kaydırma konumundan görüntülenen blok oranı → yüzde; her %10 artışta, tamamlanınca ve ekrandan
çıkarken `PUT /progress/lessons/:id`. Çevrimdışıysa MMKV kuyruğuna yazılır.

## 6. Çevrimdışı mimari

```
           çevrimiçi                                 çevrimdışı / ağ hatası
UI ── React Query ── networkFirst() ──► API ──X──► SQLite (expo-sqlite) okuma
                              │
"Çevrimdışı için indir" ──► syncModule(moduleId)
        GET /offline/modules/:id  (If-None-Match: <ETag>)
        ├─ 304 → yalnızca synced_at güncellenir
        └─ 200 → OfflineBundle tek transaction ile upsert (lessons, scenes, quizzes, modules)
```

- **SQLite tabloları** (`src/offline/db.ts`): `lessons(id, module_id, json, version, updated_at)`,
  `scenes(id, json, version)`, `quizzes(id, lesson_id, json)`, `modules(id, json, etag, synced_at)`
  (silme kolaylığı için sahne/quiz tablolarında ek `module_id` sütunu vardır). JSON sütunları API DTO'sunu
  aynen saklar; çevrimdışı okuma çevrimiçi yanıtla aynı tipi döner. Şema sürümü `PRAGMA user_version`.
- **ETag**: hem `modules.etag` hem MMKV (`etag.offline.<id>`). Uygulama açılışında (çevrimiçiyse) indirilmiş
  tüm modüller ETag ile tazelenir; Profil → "Şimdi güncelle" de aynı işi yapar.
- **İçerik kancaları** (`src/hooks/content.ts`): NetInfo çevrimdışı diyorsa doğrudan SQLite; çevrimiçiyken
  API, ağ/sunucu hatasında SQLite'a düşer. React Query `onlineManager` NetInfo ile beslenir.
- **Kuyruklar** (`src/offline/queue.ts`, MMKV):
  - İlerleme: ders başına tek kayıt (yüzde = max, süre = toplam, tamamlandı = OR).
  - Quiz denemeleri: doğru cevaplar istemcide olmadığından çevrimdışı puanlanmaz; deneme saklanır,
    "bağlantı gelince değerlendirilecek" mesajı gösterilir ve çevrimiçi olunca gönderilir.
  - Kuyruklar bağlantı geri geldiğinde ve uygulama ön plana döndüğünde boşaltılır.
- **Token'lar** yalnızca SecureStore'da (Keychain/Keystore); MMKV'de token tutulmaz.

## 7. Push bildirimleri

1. `eas init` ile EAS projesi oluşturun ve `EAS_PROJECT_ID` değerini `.env`/EAS ortamına ekleyin.
2. iOS: Apple Developer hesabında Push Notifications yeteneği (EAS credentials bunu otomatik yönetir).
   Android: Firebase projesi oluşturup `google-services.json` dosyasını EAS'a yükleyin (FCM v1).
3. Uygulama oturum açılınca (yalnızca **fiziksel cihazda**) izin ister, Expo push token alır ve
   `POST /users/me/push-tokens` ile kaydeder. Android'de `daily-reminder` kanalı oluşturulur.
4. Yedek olarak kullanıcının hatırlatma saatinde **yerel günlük bildirim** planlanır
   (`scheduleNotificationAsync`, `DAILY` tetikleyici) — push yapılandırılmamış olsa da hatırlatma gelir.
5. Bildirime dokunulunca: `data.lessonId` varsa o ders, yoksa `/progress/summary → continueLesson` açılır.

Test: `npx expo push:send` ya da https://expo.dev/notifications ile token'a mesaj gönderin.

## 8. Kimlik doğrulama

- E-posta/şifre: `POST /auth/login|register`; form doğrulaması shared Zod şemalarıyla.
- Google: `expo-auth-session/providers/google` → `id_token` → `POST /auth/oauth { provider: 'google' }`.
- Apple (iOS): `expo-apple-authentication` → `identityToken` (+ ilk girişte ad) → `POST /auth/oauth`.
- API istemcisi 401'de **tek uçuşlu** refresh yapar: eşzamanlı tüm istekler tek `/auth/refresh` çağrısını
  bekler ve yeni token ile bir kez tekrarlanır; refresh reddedilirse oturum kapanır.

## 9. Testler

```bash
pnpm test           # birim testleri (jest-expo)
```

| Test | Kapsam |
| --- | --- |
| `__tests__/ScenePlayer.test.tsx` | Reducer ile adım ileri/geri, seek, oynatma (TICK), hız, reduced-motion, transkript |
| `__tests__/i18n.test.ts` | Çeviri, parametreler, tr/en anahtar eşitliği, dil değiştirme + MMKV kalıcılığı |
| `__tests__/sync.test.ts` | Sahte SQLite ile upsert/transaction, ETag + 304 akışı, kuyruk birleştirme |
| `__tests__/api.test.ts` | Single-flight refresh, oturum sonlandırma, offline/network hataları, 304 |
| `__tests__/svgTheme.test.ts` | Diyagram SVG'lerinin tema renklerine çevrilmesi |

**Detox (e2e)** — `e2e/smoke.e2e.ts`: giriş → modül → ders → animasyonu oynat.

```bash
npx expo prebuild                         # ios/ ve android/ üretir (git'e eklenmez)
pnpm detox build -c ios.sim.debug
pnpm test:e2e                             # backend çalışıyor ve seed edilmiş olmalı
# Android: pnpm detox build -c android.emu.debug && pnpm test:e2e:android
```

Varsayılan e2e kullanıcısı seed'in yönetici hesabıdır (`admin@devacademy.local` / `Admin123!`);
`E2E_EMAIL` / `E2E_PASSWORD` ile değiştirilebilir.

## 10. Notlar

- `@react-navigation/*` paketleri expo-router 5 ile uyumlu (2025 ortası) sürümlere sabitlenmiştir: daha yeni
  7.x sürümleri expo-router 5'in kullandığı `query-string` bağımlılığını bıraktığı için Metro paketlemesi kırılır.
  `package.json → expo.install.exclude` bu sabitlemeyi `expo install --check` için belgeler.
- `@devacademy/shared` kök giriş noktası Node'a özel `gray-matter` (Markdown ayrıştırıcı) içerir; Metro ve Jest
  bunu `stubs/gray-matter.js` saplamasıyla değiştirir (mobil bu fonksiyonu hiç çağırmaz).
- Monorepo'da web farklı bir React sürümü kullandığından Metro ve Jest `react`'i her zaman mobil projenin
  çözdüğü kopyaya yönlendirir.

# DevAcademy Web

Next.js (App Router) web uygulaması ve admin paneli.

## Çalıştırma

```bash
# API'nin çalıştığını varsayar (backend/README.md)
pnpm --filter @devacademy/shared build
NEXT_PUBLIC_API_URL=http://localhost:4000/api/v1 pnpm dev     # http://localhost:3000
```

| Değişken                                                        | Açıklama                                                                      |
| --------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| `NEXT_PUBLIC_API_URL`                                           | Tarayıcının kullandığı API adresi                                             |
| `API_URL_INTERNAL`                                              | Sunucu tarafı render’ın kullandığı API adresi (Docker ağında farklı olabilir) |
| `NEXT_PUBLIC_GOOGLE_CLIENT_ID`                                  | Google Identity Services istemci kimliği (boşsa buton devre dışı)             |
| `NEXT_PUBLIC_APPLE_CLIENT_ID`, `NEXT_PUBLIC_APPLE_REDIRECT_URI` | Sign in with Apple (boşsa buton devre dışı)                                   |

## Yapı

```
src/
  app/                   sayfalar (ana sayfa, modüller, ders, giriş/kayıt, onboarding, pano, tekrar, kütüphane, arama, admin)
  components/
    scene/               animasyon motoru: ScenePlayer (kontroller, rAF döngüsü) + SceneCanvas (SVG çizim)
    lesson/              ders görüntüleyici ve blok bileşenleri
    simulators/          interaktif simülatörler + registry (lazy-load)
    admin/               görsel sahne editörü
    auth/ layout/ pages/
  i18n/                  tipli mesaj sözlükleri (tr varsayılan, en)
  lib/                   API istemcisi (token yenileme), auth store, React Query hook'ları
```

## Tasarım sistemi

- Renkler `globals.css` içinde `--da-*` CSS değişkenleri olarak tanımlıdır; Tailwind renkleri bu değişkenlere bağlıdır. İçerik SVG’leri aynı değişkenleri kullandığı için açık/koyu temaya otomatik uyar.
- Tema: sistem tercihi + manuel seçim (`localStorage`), ilk boyamadan önce uygulanır (FOUC yok).
- Dil: çerezde tutulur, sunucu render’ı doğru dille başlar. Yeni metinler `src/i18n/messages/tr.ts` ve `en.ts` dosyalarına eklenir; iki sözlüğün anahtar yapısı testle denetlenir.

## Animasyon motoru

`ScenePlayer`, shared paketteki `playerReducer` durum makinesini `requestAnimationFrame` ile ilerletir. `SceneCanvas` her karede `resolveStepView` ve `computePackets` sonuçlarını SVG olarak çizer. Düğüm durum geçişleri Framer Motion ile yumuşatılır. Kamera adımları viewBox’ı canlandırır. `prefers-reduced-motion` açıkken geçişler kapatılır ve paketler doğrudan hedefte gösterilir. Klavye: Boşluk (oynat/duraklat), ←/→ (adım).

## Simülatörler

Her interaktif tür (`load-balancer`, `cache`, `rate-limiter`, `consistent-hashing`, `gradient-descent`, `attention`, `neural-network-playground` …) `src/components/simulators/` altında ayrı bir bileşendir ve `registry.tsx` üzerinden lazy-load edilir. Bileşenler `SimulatorProps` (`params`, `lessonId`, `onInteract`) sözleşmesini uygular. 26 simülatörün 7'si algoritmasını shared paketten alır (`load-balancer`, `cache`, `rate-limiter`, `consistent-hashing`, `gradient-descent`, `attention`, `capacity-estimator`); diğerlerinin mantığı bileşenin içindedir. Her simülatörün kabul ettiği ders parametreleri shared `INTERACTIVE_PARAMS` listesindedir (`simulators/params.test.ts` uyumu denetler).

## Admin paneli

`/admin` (editor/admin rolü): istatistikler, ders listesi, ders taslak editörü (meta + blok JSON düzenleme, canlı önizleme, sürüm geçmişi, yayınlama), görsel animasyon sahnesi editörü (sürükle-bırak düğüm konumlandırma, Shift+tık ile kenar, adım düzenleme, canlı doğrulama ve oynatıcı önizlemesi, JSON sekmesi).

## Testler

```bash
pnpm test        # Vitest + Testing Library
pnpm test:e2e    # Playwright (masaüstü + Pixel 7 görünümü); çalışan API + web gerekir
```

Playwright başka bir Chromium kullanacaksa `PLAYWRIGHT_CHROMIUM_PATH`, var olan bir sunucuya bağlanacaksa `PLAYWRIGHT_BASE_URL` verilebilir.

---
id: f-08-devacademy-architecture
slug: devacademy-architecture
module: f-code-and-infrastructure
order: 8
title:
  tr: "DevAcademy’nin Kendi Mimarisi"
  en: "DevAcademy’s Own Architecture"
summary:
  tr: Bu uygulamanın monorepo, backend, web ve mobil katmanları nasıl çalışıyor?
  en: How this app’s monorepo, backend, web and mobile layers work together.
durationMinutes: 20
level: intermediate
tags: [architecture, monorepo, case-study, nestjs, nextjs, react-native]
prerequisites: [a-07-caching, f-02-code-journey-ci-cd, f-05-physical-request-path]
concepts: [monorepo, shared-schema, content-pipeline, etag, offline-sync, versioned-content]
---

## Kavram: öğrendiklerimizi kendi üzerimizde uygulamak

Bu modül boyunca bir isteğin fiziksel yolunu, kodun pipeline'daki yolculuğunu ve verinin nerede tutulduğunu inceledik. Şimdi aynı soruları **şu an kullandığınız uygulamaya** soralım: DevAcademy nasıl inşa edildi, hangi kararlar neden alındı ve hangi darboğazları önceden düşündük?

DevAcademy üç istemci yüzeyine sahip bir eğitim platformu:

1. **Web** (Next.js) — masaüstü öncelikli, SEO için sunucu tarafı render.
2. **Mobil** (React Native + Expo) — iOS ve Android, çevrimdışı çalışabilen.
3. **Admin paneli** (web içinde) — içerik, animasyon sahnesi ve quiz yönetimi.

Hepsi tek bir **backend API**'ye (NestJS) bağlanır. İçerik ise kodla aynı depoda, `content/` klasöründe **Markdown + JSON** olarak yaşar.

:::diagram{src="diagram.svg" alt="DevAcademy mimarisi: monorepo paketleri, istemciler, API, PostgreSQL, Redis, S3 ve içerik hattı|DevAcademy architecture: monorepo packages, clients, API, PostgreSQL, Redis, S3 and the content pipeline"}
Tek monorepo, ortak `@devacademy/shared` paketi ve iki yönlü içerik hattı.
:::

## Monorepo ve ortak paket

Kod tek bir depoda, **pnpm workspaces + Turborepo** ile yönetiliyor:

| Klasör | Rol | Teknoloji |
|---|---|---|
| `packages/shared` | Ortak tipler, şemalar, saf mantık | TypeScript + zod |
| `backend/` | REST + WebSocket API | NestJS, Prisma, PostgreSQL, Redis |
| `web/` | Web uygulaması + admin | Next.js App Router, Tailwind, Framer Motion |
| `mobile/` | iOS/Android uygulaması | Expo, Reanimated, react-native-svg, SQLite |
| `content/` | Dersler, sahneler, quizler | Markdown + JSON |

Neden monorepo? Çünkü üç katman **aynı sözleşmeyi** paylaşıyor. `packages/shared` içinde:

- **Animasyon sahnesi şeması** (zod) — sahne JSON'unun doğrulanması,
- **Oynatıcı durum makinesi** (`playerReducer`) — oynat/duraklat/adım mantığı,
- **API DTO'ları** — istek/yanıt tipleri; backend doğrulamada, istemciler formlarda aynı zod şemasını kullanıyor,
- **Simülatör mantığı** — load balancer, cache, rate limiter algoritmaları saf fonksiyonlar olarak,
- **Oyunlaştırma** — seri (streak), SM-2 aralıklı tekrar, rozet koşulları.

Bir alan adı değiştiğinde TypeScript derleyicisi üç katmanda birden hata verir. Polyrepo'da bu hata ancak üretimde ortaya çıkardı.

:::callout{tone="tip" title="Bir kez yaz, iki platformda oynat"}
Animasyonlar tek bir JSON sahnesinden üretiliyor. Web bu sahneyi SVG + Framer Motion ile, mobil react-native-svg + Reanimated ile çiziyor; ama **hangi adımda hangi düğümün vurgulanacağını, paketin kenarın neresinde olacağını** iki platform da aynı `resolveStepView` ve `computePackets` fonksiyonlarıyla hesaplıyor. Böylece içerik ekibi bir sahneyi bir kez yazıyor.
:::

## İçeriğin yolculuğu

Aşağıdaki animasyon, bir dersin yazılmasından öğrencinin ekranına kadar izlediği yolu gösteriyor.

:::animation{scene="scene.json"}
İçerik hattı: Markdown → doğrulama → seed → PostgreSQL → Redis → API → web/mobil.
:::

Adımlar:

1. **Yazım**: İçerik yazarı `lesson.md` (frontmatter + `:::diagram`, `:::animation` gibi directive blokları), `scene.json` ve `quiz.json` yazar.
2. **Doğrulama (CI)**: `pnpm content:validate` her dosyayı zod şemalarıyla doğrular; olmayan düğüme referans veren bir kenar, eksik SVG veya hatalı quiz cevabı pull request'i kırmızıya çevirir.
3. **Seed**: `pnpm db:seed` içeriği veritabanına yazar. İdempotenttir: içerik değişmediyse yeni sürüm açmaz (kanonik JSON özeti karşılaştırılır).
4. **Sürümleme**: Her ders `Lesson` + `LessonVersion` olarak tutulur. Admin panelinde düzenlenen içerik önce **taslak** olur; yayınlandığında önceki sürüm **arşive** düşer.
5. **Cache**: Yayınlanmış içerik Redis'te tutulur, yayınlama anında ilgili anahtarlar silinir (cache-aside + açık invalidation).
6. **İstemci cache'i**: API her GET yanıtına **ETag** ekler; istemci `If-None-Match` gönderir, içerik değişmediyse **304** döner.
7. **Mobil offline**: Mobil uygulama bir modülü tek pakette (`/offline/modules/:id`) indirip SQLite'a yazar.

## Kritik tasarım kararları

| Karar | Alternatif | Neden bu? |
|---|---|---|
| Sahneler deklaratif JSON | Her platformda elle kodlanmış animasyon | Tek kaynak, içerik ekibi kod yazmadan animasyon üretir |
| İçerik Git'te (Markdown) | Sadece CMS veritabanı | Code review, diff, geri alma; CI'da doğrulama |
| Ders sürümleme (taslak/yayın/arşiv) | Yerinde güncelleme | Yayındaki içerik editörün yarım işinden etkilenmez |
| Redis cache + ETag | Her istekte DB | İçerik okuma ağırlıklı (okuma/yazma ≫ 1000:1) |
| Refresh token rotation | Uzun ömürlü tek token | Çalınan token yeniden kullanılırsa tüm aile iptal edilir |
| Quiz cevapları sunucuda puanlanır | İstemcide puanlama | Doğru cevaplar istemciye hiç gönderilmez |
| PostgreSQL full-text arama | Elasticsearch | Ölçek küçük; ayrı bir sistem işletmek gereksiz maliyet |

:::code{lang="ts" title="Aynı sahne, iki platform: ortak durum hesaplaması"}
```ts
import { playerReducer, resolveStepView, computePackets, createPlayerState } from '@devacademy/shared';

// Web (ScenePlayer.tsx) ve mobil (ScenePlayer.tsx) bu üç fonksiyonu aynı şekilde çağırır.
let state = createPlayerState(scene);
state = playerReducer(scene, state, { type: 'PLAY' });

function onFrame(deltaMs: number) {
  state = playerReducer(scene, state, { type: 'TICK', deltaMs });
  const view = resolveStepView(scene, state.stepIndex);          // düğüm/kenar durumları
  const packets = computePackets(view.step, state.elapsedMs, state.reducedMotion);
  render(view, packets); // ← yalnızca bu kısım platforma özgü (SVG vs react-native-svg)
}
```
```python
# Aynı fikir Python'da: durum geçişi saf fonksiyon, çizim ayrı katman.
def on_frame(scene, state, delta_ms, render):
    state = player_reducer(scene, state, {"type": "TICK", "deltaMs": delta_ms})
    view = resolve_step_view(scene, state["stepIndex"])
    render(view)
    return state
```
:::

## Darboğazlar ve ölçek

- **Okuma yükü**: Ders içeriği neredeyse hiç değişmez. Redis + ETag + Next.js ISR üçlüsü sayesinde bir ders sayfası çoğu zaman veritabanına hiç dokunmaz.
- **Yazma yükü**: İlerleme güncellemeleri en sık yazma işlemi. İstemci her kaydırmada değil, **5 saniyede bir ve sayfadan çıkarken** toplu gönderir; mobil çevrimdışıyken kuyruğa alır.
- **WebSocket**: Rozet ve ilerleme bildirimleri `user:<id>` odalarına gider. Birden fazla API replikasında socket.io için Redis adapter eklenmelidir (yatay ölçekleme dersini hatırlayın: stateful bağlantılar!).
- **Rate limiting**: Sayaçlar Redis'te tutulur, böylece tüm replikalar aynı limiti görür. Giriş uç noktasında daha sıkı limit vardır (kaba kuvvet saldırılarına karşı).

:::interactive{type="request-journey" layers="client,cdn,gateway,service,cache,db"}
Bir ders isteğinin DevAcademy katmanlarından geçişini izleyin: CDN ve cache isabetlerini açıp kapatarak toplam gecikmenin nasıl değiştiğine bakın.
:::

:::realworld{company="Duolingo"}
Duolingo, milyonlarca günlük kullanıcıya hizmet veren bir öğrenme uygulaması olarak benzer kararlar almıştır: ders içeriği büyük ölçüde statik olduğu için agresif biçimde önbelleğe alınır, kullanıcıya özel veriler (seri, XP, ilerleme) ayrı ve yazma yoğun servislerde tutulur. Seri (streak) özelliğinin saat dilimine göre doğru hesaplanması, ölçekte sanıldığından zor bir problemdir; DevAcademy de seriyi kullanıcının saat dilimindeki tarih anahtarıyla (`YYYY-MM-DD`) hesaplar.
:::

:::callout{tone="info" title="Mülakat özeti"}
"Bir eğitim platformu tasarlayın" sorusunda kilit noktalar: içerik okuma ağırlıklıdır (cache her yerde), kullanıcı ilerlemesi yazma ağırlıklıdır (toplu yazma, kuyruk), içerik sürümlenmelidir (taslak/yayın) ve mobil için çevrimdışı senkron stratejisi gerekir.
:::

:::quiz{src="quiz.json"}
:::

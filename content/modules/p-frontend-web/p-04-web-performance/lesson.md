---
id: p-04-web-performance
slug: web-performance
module: p-frontend-web
order: 4
title:
  tr: "Web Performansı ve Core Web Vitals"
  en: "Web Performance and Core Web Vitals"
summary:
  tr: "LCP, INP ve CLS; bundle boyutu, code splitting, lazy loading, görsel optimizasyonu, önbellek başlıkları ve CDN."
  en: "LCP, INP and CLS; bundle size, code splitting, lazy loading, image optimisation, cache headers and CDNs."
durationMinutes: 35
level: intermediate
tags: [frontend, performance, core-web-vitals, bundle, code-splitting, caching, cdn]
prerequisites: [p-01-browser-rendering-pipeline, a-08-cdn-edge]
concepts: [core-web-vitals, largest-contentful-paint, interaction-to-next-paint, cumulative-layout-shift, bundle-size, code-splitting, lazy-loading, image-optimization, immutable-caching, long-tasks]
---

## Kavram: "hızlı" ne demek?

Bir sayfanın hızını tek bir sayı ile anlatmak zordur. Sunucu 50 ms'de yanıt verse de kullanıcı dört saniye boyunca boş ekrana bakabilir; içerik erkenden görünse de bir butona bastığında hiçbir şey olmayabilir. Google'ın Chrome ekibi bu deneyimi üç kullanıcı odaklı ölçüye indirdi ve **Core Web Vitals** adını verdi:

| Ölçü | Ne ölçer? | "İyi" eşiği |
|---|---|---|
| **LCP** — Largest Contentful Paint | Görünür alandaki en büyük içerik öğesinin (genellikle kahraman görseli ya da başlık) çizildiği an: *yükleniyor mu?* | ≤ 2,5 s |
| **INP** — Interaction to Next Paint | Kullanıcı etkileşimlerinden (tıklama, dokunma, tuş) bir sonraki boyamaya kadar geçen süre, sayfa ömrü boyunca: *tepki veriyor mu?* | ≤ 200 ms |
| **CLS** — Cumulative Layout Shift | Beklenmedik düzen kaymalarının toplamı: *yerinde duruyor mu?* | ≤ 0,1 |

Eşikler, gerçek kullanıcı verisinde (RUM — real user monitoring) sayfa yüklemelerinin **75. yüzdeliği** için değerlendirilir. Yani laboratuvarda hızlı fiber bağlantıyla ölçtüğünüz değer değil, orta seviye bir telefonda yavaş ağdaki kullanıcının yaşadığı önemlidir. INP, 2024'te daha dar kapsamlı FID'nin yerini almıştır.

:::diagram{src="diagram.svg" alt="Core Web Vitals üçlüsü ve her birini iyileştiren teknikler: LCP için kritik yol ve görsel, INP için uzun görevleri bölmek, CLS için boyut ayırmak|The Core Web Vitals trio and the techniques that improve each: critical path and images for LCP, breaking up long tasks for INP, reserving space for CLS"}
Her ölçünün kendine özgü düşmanı vardır: LCP'nin ağ ve kritik yol, INP'nin ana iş parçacığını işgal eden JavaScript, CLS'nin boyutsuz içerik.
:::

## JavaScript: en pahalı bayt

Bir 200 KB'lık JPEG ile 200 KB'lık JavaScript aynı sürede iner, ama maliyetleri aynı değildir. Görsel çözülüp çizilir; JavaScript ise **ayrıştırılır, derlenir ve çalıştırılır** ve bunların hepsi [P-01](/lessons/p-01-browser-rendering-pipeline)'de gördüğümüz ana iş parçacığında olur. Ana iş parçacığı 50 ms'den uzun meşgul kalırsa buna **uzun görev** (long task) denir; bu sırada kullanıcının tıklaması kuyrukta bekler ve INP bozulur. Bu yüzden ilk soru "nasıl hızlandırırım" değil, "bu kodu gerçekten şimdi göndermem gerekiyor mu?" olmalıdır.

- **Bundle analizi:** `@next/bundle-analyzer` ya da `source-map-explorer` ile paketin içinde ne olduğuna bakın. Tarih biçimlendirmek için tüm bir kütüphanenin, ikon için koca bir ikon setinin pakete girmesi sık görülür. Tree shaking'in çalışması için ES modül içe aktarımı kullanın.
- **Code splitting:** tek dev `bundle.js` yerine rota başına parçalar. Ana sayfa, ödeme sayfasının kodunu indirmek zorunda kalmaz. Next.js her rotayı otomatik böler.
- **Lazy loading:** ilk ekranda görünmeyen ağır bileşenleri (grafik kütüphanesi, kod editörü, yorum widget'ı) dinamik `import()` ile, ihtiyaç anında yükleyin. Görseller için `loading="lazy"`.
- **Uzun görevleri bölmek:** büyük bir hesaplamayı parçalara ayırıp aralarda tarayıcıya nefes aldırmak (`await` ile görev sınırı oluşturmak, `scheduler.yield()` destekleniyorsa onu kullanmak) ya da Web Worker'a taşımak.

:::predict{id="lcp-gorsel-gec"}
Kahraman görseli `<img>` etiketi olarak sunucu HTML'inde değil, istemci tarafı JavaScript çalıştıktan sonra DOM'a ekleniyor. LCP'ye en büyük etkisi ne olur? | The hero image is not in the server HTML as an `<img>` tag; it is added to the DOM after client-side JavaScript runs. What is the biggest effect on LCP?
- [ ] Hiç etkisi olmaz; görsel CDN'den geldiği için hızlıdır | No effect; the image is fast because it comes from a CDN
- [x] Görselin indirilmesi, JS inip çalışana kadar başlamaz; LCP en az bundle süresi kadar gecikir | The image download cannot start until the JS has downloaded and run; LCP is delayed by at least the bundle time
- [ ] Yalnızca CLS etkilenir | Only CLS is affected
Açıklama: Tarayıcının ön yükleme tarayıcısı yalnızca HTML'de gördüğü kaynakları erken isteyebilir. JS ile eklenen görsel, bundle'ın indirilmesi, ayrıştırılması ve çalıştırılmasının arkasına sıraya girer. Çözüm: görseli HTML'de vermek ya da `<link rel="preload">` ve `fetchpriority="high"` ile erken istemek. | The browser's preload scanner can only request resources it sees in HTML early. An image added by JS queues behind the bundle's download, parse and execution. The fix is to put the image in the HTML or request it early with `<link rel="preload">` and `fetchpriority="high"`.
:::

:::animation{scene="scene.json"}
Önce tek parça bundle: JS iner, uzun görev çalışır, kahraman görseli ancak sonra istenir ve LCP geç kalır. Sonra parçalı yükleme: görsel HTML'den erken istenir, küçük rota parçası çalışır, LCP öne gelir; yorum widget'ı kaydırınca tembel yüklenir; ikinci ziyarette dosyalar önbellekten gelir.
:::

## Görseller ve düzen kayması

LCP öğesi çoğu sayfada bir görseldir. Görsel optimizasyonu genellikle en yüksek getirili işlerdendir:

- **Modern formatlar** (AVIF, WebP) ve **duyarlı boyutlar** (`srcset`, `sizes`): telefona masaüstü boyutunda görsel göndermeyin.
- **Öncelik:** LCP görseline `fetchpriority="high"` verin, ama ona asla `loading="lazy"` vermeyin; tembel yükleme onu geciktirir.
- **Boyut ayırma:** `<img>`'e `width`/`height` ya da CSS `aspect-ratio` verin. Tarayıcı görsel gelmeden yer ayırır ve içerik zıplamaz; CLS'nin en sık nedeni budur. Reklam ve gömülü içerikler için de sabit yükseklikli kap kullanın; web yazı tipleri için `font-display` ve uyumlu yedek yazı tipi seçin.

Next.js'in `next/image` bileşeni bunların çoğunu (boyut zorunluluğu, `srcset` üretimi, tembel yükleme) varsayılan yapar.

## Önbellek başlıkları ve CDN

En hızlı istek, hiç yapılmayan istektir. [A-08](/lessons/a-08-cdn-edge) dersindeki CDN mantığı frontend varlıkları için şöyle uygulanır:

- Build çıktısındaki dosya adları içerik özeti taşır (`main.3f9a1c.js`). İçerik değişirse ad değişir. Bu yüzden bu dosyalar `Cache-Control: public, max-age=31536000, immutable` ile **bir yıl** önbelleğe alınabilir; ikinci ziyarette tarayıcı ağa hiç çıkmaz.
- HTML ise yeni sürümün adreslerini taşıdığı için kısa ömürlü olmalı (`no-cache` + `ETag` ile yeniden doğrulama ya da kısa `s-maxage`).
- Statik varlıklar kullanıcıya en yakın PoP'tan gelir; RTT kısalır, HTTP/2 ve HTTP/3 ile bağlantı kurulumu ucuzlar.

:::interactive{type="request-journey" layers="browser,dns,tcp,tls,cdn,origin-service:60" rttMs=80}
RTT'yi 80 ms'de bırakıp "İstek gönder" ile bir varlığın origin'e kadar gidişini ve gecikme şelalesini izleyin: DNS, TCP ve TLS her biri ayrı bir gidiş-dönüş maliyetidir. Sonra "CDN hit" kutusunu işaretleyin: içerik özetli bir dosya kenarda önbellekte olduğu için origin'e hiç gidilmez. "HTTP/3 (QUIC)" anahtarını açarak TCP ve TLS el sıkışmasının birleşmesini, "DNS önbellekte" ile tekrar ziyareti görün. RTT kaydırıcısını 200 ms'ye çekin: uzak kullanıcıda her gidiş-dönüşün LCP'ye ne kattığını hissedin.
:::

:::code{lang="tsx" title="Next.js: tembel bileşen ve öncelikli LCP görseli"}
```tsx
import dynamic from 'next/dynamic';
import Image from 'next/image';

// Yorumlar ilk ekranda görünmüyor: ayrı bir parçaya böl, istemcide ihtiyaç anında yükle
const Comments = dynamic(() => import('./Comments'), {
  ssr: false,
  loading: () => <div style={{ minHeight: 320 }} />, // yer ayır: CLS olmasın
});

export default function LessonHero() {
  return (
    <>
      {/* LCP görseli: öncelikli, boyutları belli, tembel DEĞİL */}
      <Image src="/hero.avif" alt="" width={1200} height={630} priority />
      <Comments />
    </>
  );
}
```
:::

:::realworld{company="Netflix"}
Google'ın Chrome ekibinden Addy Osmani'nin Netflix mühendisleriyle birlikte yayımladığı *A Netflix Web Performance Case Study* yazısı, Netflix'in oturum açmamış kullanıcılara gösterilen kayıt (landing) sayfasında yaptığı değişikliği anlatır. Sayfa React ile yazılmıştı; ekip, bu sayfada istemcide çok az etkileşim olduğunu fark edince sunucuda React ile HTML üretmeye devam edip **istemci tarafındaki React'i ve diğer kütüphaneleri sayfadan çıkardı**, kalan birkaç etkileşimi sade JavaScript ile yazdı. Yazıda bu değişiklikle etkileşime hazır olma süresinin (Time to Interactive) yaklaşık yarıya indiği aktarılır. React tamamen terk edilmedi: kullanıcının büyük olasılıkla gideceği sonraki kayıt adımları için React ve ilgili paketler, tarayıcı boştayken önceden getirildi (prefetch). Ders açık: her sayfa aynı JavaScript'i hak etmez. Shopify'ın vitrinler için geliştirdiği React tabanlı **Hydrogen** çatısı da benzer biçimde sunucuda render ve akışlı (streaming) yanıtları performansın temeline koyar.
:::

:::callout{tone="warning" title="Laboratuvar puanı ≠ kullanıcı deneyimi"}
Lighthouse gibi laboratuvar araçları tek bir cihaz ve ağ profilini simüle eder; hata ayıklamak için harikadır. Ama Core Web Vitals değerlendirmesi gerçek kullanıcı verisiyle (Chrome UX Report ya da kendi RUM ölçümünüz) yapılır. İkisini birlikte izleyin.
:::

:::callout{tone="tip" title="Mülakat özeti"}
LCP → kritik yol, sunucu yanıtı ve LCP görselinin erken keşfi; INP → ana iş parçacığını işgal eden JS, uzun görevleri bölmek; CLS → boyut ayırmak. Varlıklar için "içerik özetli ad + immutable + CDN", HTML için "kısa ömür + yeniden doğrulama" deyin.
:::

:::quiz{src="quiz.json"}
:::

:::resources
- [Web Vitals](https://web.dev/articles/vitals) — makale — Chrome ekibi: LCP, INP, CLS ve eşikler
- [Optimize Largest Contentful Paint](https://web.dev/articles/optimize-lcp) — makale
- [Optimize Interaction to Next Paint](https://web.dev/articles/optimize-inp) — makale
- [MDN: Cache-Control](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Cache-Control) — belge — immutable, max-age, s-maxage
:::

:::next{lesson="p-05-browser-security"}
Sırada: hızlı bir sayfa güvenli de olmalı. Same-origin policy, CORS ön uçuş isteği ve bu projenin nonce'lu CSP'si.
:::

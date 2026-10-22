---
id: p-02-csr-ssr-ssg-isr
slug: csr-ssr-ssg-isr
module: p-frontend-web
order: 2
title:
  tr: "CSR, SSR, SSG ve ISR"
  en: "CSR, SSR, SSG and ISR"
summary:
  tr: "HTML kim, ne zaman üretir? Dört render stratejisinde isteğin akışı, TTFB/FCP/TTI ödünleşimleri, hydration ve hydration hataları."
  en: "Who produces the HTML, and when? The request flow in four rendering strategies, TTFB/FCP/TTI trade-offs, hydration and hydration errors."
durationMinutes: 30
level: intermediate
tags: [frontend, rendering, ssr, ssg, isr, nextjs, hydration, performance]
prerequisites: [p-01-browser-rendering-pipeline, a-08-cdn-edge]
concepts: [client-side-rendering, server-side-rendering, static-site-generation, incremental-static-regeneration, hydration, hydration-mismatch, ttfb, first-contentful-paint, time-to-interactive]
---

## Kavram: HTML'i kim, ne zaman üretiyor?

[Önceki derste](/lessons/p-01-browser-rendering-pipeline) tarayıcının eline geçen HTML'i piksele nasıl çevirdiğini gördük. Şimdi bir adım geri gidiyoruz: o HTML nereden geliyor? Bir React ya da Vue uygulamasında aynı bileşen ağacı dört farklı yerde ve zamanda HTML'e dönüştürülebilir. Bu seçim; ilk baytın ne zaman geldiğini, kullanıcının içeriği ne zaman gördüğünü, sayfanın ne zaman tıklanabilir olduğunu ve sunucu faturanızı belirler.

Üç ölçüyü baştan tanımlayalım:

- **TTFB** (Time to First Byte): istek gönderildikten sonra yanıtın ilk baytının gelmesine kadar geçen süre. Sunucunun ne kadar düşündüğünü ve ağın ne kadar uzak olduğunu ölçer.
- **FCP** (First Contentful Paint): ekranda ilk metin ya da görselin çizildiği an.
- **TTI** (Time to Interactive): sayfanın kullanıcı girdisine güvenilir biçimde yanıt verebildiği an. JavaScript indirilip çalışmadan bir buton görünse bile tıklanmaz.

## Dört strateji

**CSR — Client-Side Rendering.** Sunucu neredeyse boş bir HTML kabuğu (`<div id="root"></div>`) ve büyük bir JavaScript paketi gönderir. Tarayıcı paketi indirir, çalıştırır, API'den veriyi çeker ve DOM'u kendisi kurar. Kabuk statik olduğu için CDN'den çok hızlı gelir (iyi TTFB), ama kullanıcı JavaScript bitene kadar boş ekran ya da iskelet görür (geç FCP). Arama motoru botları ve yavaş cihazlar için zayıftır; giriş gerektiren paneller gibi SEO'nun önemsiz olduğu uygulamalarda hâlâ makul bir seçimdir.

**SSR — Server-Side Rendering.** Her istekte sunucu veriyi çeker, bileşenleri HTML'e çevirir ve tam dolu bir sayfa döndürür. Kullanıcı içeriği hemen görür (erken FCP), ama sunucunun düşünme süresi TTFB'ye eklenir ve her istek sunucuda CPU harcar. Kişiye özel ya da çok sık değişen sayfalar için doğaldır.

**SSG — Static Site Generation.** HTML, **build anında** bir kez üretilir ve CDN'e dağıtılır. İstek geldiğinde sunucu hiç çalışmaz; yanıt en yakın PoP'tan gelir ([A-08](/lessons/a-08-cdn-edge)). TTFB ve FCP en iyisidir, maliyet en düşüktür. Bedeli bayatlıktır: içerik değişince yeniden build gerekir; on binlerce sayfalık bir katalogda bu dakikalar sürebilir.

**ISR — Incremental Static Regeneration.** SSG'nin bayatlık sorununa Next.js'in cevabıdır. Sayfa statik olarak sunulur ama bir `revalidate` süresi taşır. Süre dolduktan sonra gelen ilk istek yine eski (bayat) sayfayı hızla alır; arka planda sayfa yeniden üretilir ve önbellek güncellenir. Sonraki istekler taze sürümü görür. Bu, HTTP'deki `stale-while-revalidate` fikrinin sayfa düzeyindeki karşılığıdır.

:::diagram{src="diagram.svg" alt="CSR, SSR, SSG ve ISR stratejilerinde HTML'in üretildiği yer ve zaman ile TTFB, FCP ve TTI karşılaştırması|Where and when HTML is produced in CSR, SSR, SSG and ISR, with a comparison of TTFB, FCP and TTI"}
Aynı bileşen, dört farklı an: tarayıcıda, her istekte sunucuda, build anında ya da build anında üretilip arka planda yenilenerek.
:::

:::animation{scene="scene.json"}
Aynı `/lessons/42` sayfası dört stratejide: CSR'da boş kabuk + JS + API, SSR'da sunucuda render, SSG'de build anında üretilmiş HTML'in CDN'den gelmesi, ISR'da bayat sayfanın sunulup arka planda yenilenmesi.
:::

## Hydration: sunucunun HTML'ine can vermek

SSR, SSG ve ISR'da tarayıcıya gelen HTML **görünür ama ölüdür**: butonlara bağlı olay dinleyicileri yoktur, state yoktur. Tarayıcı JavaScript paketini indirip React'i çalıştırdığında React aynı bileşen ağacını bellekte yeniden kurar, mevcut DOM'la eşleştirir ve olay dinleyicilerini bağlar. Buna **hydration** denir. Hydration bitene kadar sayfa "görünür ama tepkisiz" bir aradadır; FCP ile TTI arasındaki bu boşluk büyük paketlerde saniyeleri bulabilir.

Hydration'ın bir şartı vardır: istemcinin ilk render'ı, sunucunun ürettiği HTML ile **birebir aynı** olmalıdır. Aynı değilse **hydration hatası** (mismatch) oluşur. Tipik nedenler:

- Render sırasında `Date.now()`, `Math.random()` ya da saat dilimine bağlı biçimlendirme kullanmak.
- Sunucuda bulunmayan `window`, `localStorage` gibi tarayıcı API'lerine render içinde dallanmak.
- Geçersiz HTML iç içeliği (`<p>` içinde `<div>`): tarayıcı DOM'u düzeltir, React'in beklediği yapı bozulur.

React bu durumda uyarı verir ve en kötü durumda o alt ağacı istemcide sıfırdan çizer; kullanıcı titreme görür, SSR'ın kazancı kaybolur. Çözüm, tarayıcıya özgü değerleri `useEffect` içinde (hydration'dan sonra) okumaktır.

:::interactive{type="request-journey" layers="browser,dns,cdn,ssr-render:180,db:25" rttMs=40}
"İstek gönder" ile önce SSR'ı izleyin: istek CDN'den geçip `ssr-render` katmanına ve veritabanına kadar iner, toplam gecikme ile şelaledeki sunucu payına bakın. Sonra "CDN hit" kutusunu işaretleyip tekrar gönderin: SSG ya da ISR ile önceden üretilmiş HTML kenardan döner ve arka katmanlara hiç gidilmez. "DNS önbellekte" ve RTT kaydırıcısıyla oynayarak kullanıcının uzaklığının TTFB'ye etkisini görün.
:::

:::code{lang="tsx" title="Next.js App Router: aynı sayfa, farklı stratejiler"}
```tsx
// ISR: sayfa statik sunulur, en fazla 60 sn'de bir arka planda yenilenir
export const revalidate = 60;

export default async function LessonPage({ params }: { params: { id: string } }) {
  // fetch düzeyinde de belirtilebilir: { next: { revalidate: 60 } }
  const lesson = await fetch(`${API}/lessons/${params.id}`, {
    next: { revalidate: 60 },
  }).then((r) => r.json());
  return <LessonView lesson={lesson} />;
}

// SSR'a zorlamak: export const dynamic = 'force-dynamic';
// SSG için: revalidate'i kaldırın ve generateStaticParams ile tüm id'leri build anında üretin.
```
:::

## Bu projede ne oluyor?

[F-08](/lessons/f-08-devacademy-architecture) dersinde DevAcademy'nin ders sayfalarının "Redis + ETag + Next.js ISR" ile veritabanına neredeyse hiç dokunmadığını söylemiştik. Ayrıntıya inince ilginç bir ödünleşim görülür: `web/src/app/lessons/[lessonId]/page.tsx` sayfası istek başına render edilir, çünkü her yanıt yeni bir **CSP nonce'u** ve dil çerezi taşır (nonce'u [P-05](/lessons/p-05-browser-security)'te göreceğiz). Statik bir HTML'e istek başına değişen bir nonce gömülemez. Bu yüzden ISR fikri sayfa yerine **veri** katmanında uygulanır: `serverApi` yardımcı fonksiyonu API yanıtını `next: { revalidate: 60 }` ile Next'in veri önbelleğinde tutar. Sonuç: HTML her istekte üretilir ama API'ye en fazla dakikada bir gidilir. Güvenlik gereksinimi, render stratejisini doğrudan şekillendirmiştir.

:::realworld{company="Airbnb"}
Airbnb mühendislik ekibi 2013'te yayımladığı *Isomorphic JavaScript: The Future of Web Apps* yazısında, tamamen istemcide çalışan tek sayfa uygulamalarının iki temel sorununu anlatır: ilk yüklemede kullanıcının JavaScript inip çalışana kadar boş sayfa görmesi ve arama motorlarının içeriği güvenilir biçimde indeksleyememesi. Ekibin cevabı, aynı uygulama kodunu hem sunucuda hem tarayıcıda çalıştırmaktı: ilk sayfa sunucuda HTML olarak üretiliyor, sonra istemci kodu devralıp sonraki gezinmeleri tarayıcıda yapıyordu. Bunun için Backbone tabanlı açık kaynak **Rendr** kütüphanesini yazdılar. Şirket daha sonra React'e geçtiğinde aynı fikri, sunucu tarafında React bileşenlerini HTML'e çeviren ayrı bir servis olan açık kaynak **Hypernova** ile sürdürdü. Bugün Next.js, Remix ya da Nuxt'un "önce sunucuda render et, sonra hydrate et" modeli, bu erken "isomorfik" denemelerin olgunlaşmış hâlidir.
:::

:::callout{tone="warning" title="Hydration hatasını susturmak çözüm değildir"}
`suppressHydrationWarning` yalnızca tek bir öğenin metin farkını (ör. bir zaman damgası) bilerek kabul etmek içindir. Uyarıyı her yerde susturmak, kullanıcıya sunucudaki ile farklı bir arayüz gösterdiğiniz gerçeğini gizler.
:::

:::callout{tone="tip" title="Mülakat özeti"}
Seçimi verinin değişme sıklığı ve kişiselleşmesi belirler: herkese aynı ve nadiren değişen → SSG; herkese aynı ama dakikalar içinde değişen → ISR; kişiye özel ya da her istekte farklı → SSR; giriş arkasındaki etkileşimli panel → CSR. SSR'ın bedeli TTFB ve sunucu CPU'su, CSR'ınki geç FCP, SSG'ninki bayatlıktır.
:::

:::quiz{src="quiz.json"}
:::

:::resources
- [Rendering on the Web](https://web.dev/articles/rendering-on-the-web) — makale — Chrome ekibi: SSR, CSR, statik render ve hydration ödünleşimleri
- [React: hydrateRoot](https://react.dev/reference/react-dom/client/hydrateRoot) — belge — hydration ve uyumsuzluk hataları
- [Next.js: Incremental Static Regeneration](https://nextjs.org/docs/app/building-your-application/data-fetching/incremental-static-regeneration) — belge
:::

:::next{lesson="p-03-state-management-data-flow"}
Sırada: sayfa hydrate oldu ve artık etkileşimli. Peki veriler nerede yaşıyor? Yerel state, context, store ve sunucu state'i.
:::

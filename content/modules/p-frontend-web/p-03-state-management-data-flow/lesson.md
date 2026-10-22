---
id: p-03-state-management-data-flow
slug: state-management-data-flow
module: p-frontend-web
order: 3
title:
  tr: "State Yönetimi ve Veri Akışı"
  en: "State Management and Data Flow"
summary:
  tr: "Yerel state, yukarı kaldırma, context, store ve sunucu state'i; stale-while-revalidate, cache invalidation ve mutasyon sonrası yeniden fetch."
  en: "Local state, lifting state up, context, stores and server state; stale-while-revalidate, cache invalidation and refetching after a mutation."
durationMinutes: 30
level: intermediate
tags: [frontend, react, state-management, data-fetching, caching, react-query]
prerequisites: [p-02-csr-ssr-ssg-isr]
concepts: [local-state, lifting-state-up, react-context, global-store, unidirectional-data-flow, server-state, stale-while-revalidate, query-invalidation, request-deduplication]
---

## Kavram: "state" tek bir şey değildir

Hydrate olan bir sayfa artık etkileşimlidir: kullanıcı bir akordiyonu açar, bir formu doldurur, bir dersi "tamamlandı" olarak işaretler. Her etkileşim bir **state** (durum) değişikliğidir ve arayüz bu durumun bir fonksiyonudur: `UI = f(state)`. Frontend mimarisindeki tartışmaların çoğu, "bu state nerede yaşamalı?" sorusuna verilen yanlış cevaplardan doğar.

İşe yarayan ilk ayrım şudur: state ya **istemcinin kendisine aittir** ya da **sunucudaki bir verinin kopyasıdır**.

- **İstemci (UI) state'i:** akordiyonun açık olması, seçili sekme, form taslağı, tema tercihi. Doğruluk kaynağı tarayıcıdır; başka kimse değiştirmez.
- **Sunucu state'i:** ders listesi, kullanıcının ilerlemesi, bildirim sayısı. Doğruluk kaynağı sunucudadır; istemcide tuttuğunuz şey bir **önbellektir** ve her an bayatlayabilir. Başka bir sekme, başka bir cihaz ya da başka bir kullanıcı onu siz bakmazken değiştirebilir.

Bu ayrımı yapmadan her şeyi tek bir global store'a koymak, klasik "Redux'ta API yanıtlarını elle senkronize etme" yorgunluğunun kaynağıdır.

## İstemci state'i için merdiven

En basitten başlayıp ancak gerektiğinde bir basamak yukarı çıkın:

1. **Yerel state** (`useState`): yalnızca bir bileşen kullanıyorsa orada kalsın. Akordiyonun açık/kapalı durumu bunun tipik örneğidir.
2. **Yukarı kaldırma** (lifting state up): iki kardeş bileşen aynı değere ihtiyaç duyuyorsa state'i en yakın ortak ataya taşıyın ve prop olarak aşağı verin. Veri yukarıdan aşağı akar, değişiklik istekleri callback'lerle yukarı çıkar: **tek yönlü veri akışı**.
3. **Context:** değer çok derin bir ağaçta, araya giren onlarca bileşen tarafından "taşınmak zorunda" kalıyorsa (prop drilling) context kullanın. Tema, dil ve oturum açmış kullanıcı iyi adaylardır. Dikkat: context değeri değişince onu okuyan **tüm** bileşenler yeniden render olur; sık değişen değerler için uygun değildir.
4. **Store** (Redux, Zustand, Jotai fikri): birçok uzak bileşenin okuyup yazdığı, sık değişen istemci state'i için ayrı bir depo. Bileşenler yalnızca ihtiyaç duydukları dilime (selector) abone olur, böylece gereksiz render'lar önlenir. Redux bunun üstüne "her değişiklik bir eylemdir (action) ve saf bir reducer'dan geçer" disiplinini ekler; bu, zaman yolculuğu ile hata ayıklamayı ve denetlenebilirliği kolaylaştırır.

:::diagram{src="diagram.svg" alt="İstemci state'i için merdiven (yerel, yukarı kaldırma, context, store) ve sunucu state'i için ayrı sorgu önbelleği|The ladder for client state (local, lifted, context, store) and a separate query cache for server state"}
Solda istemci state'i için basamaklar; sağda sunucu state'i, bileşenlerle API arasında duran bir sorgu önbelleği olarak.
:::

Sık unutulan bir state deposu daha vardır: **URL**. Seçili sekme, arama sorgusu, filtreler ve sayfa numarası gibi değerler `?tab=quiz&page=2` biçiminde URL'de tutulursa kullanıcı sayfayı yenilediğinde ya da bağlantıyı bir arkadaşına gönderdiğinde aynı görünüme döner, tarayıcının geri butonu da beklendiği gibi çalışır. Bu değerleri bir store'a koymak, hem paylaşılabilirliği hem de geri/ileri gezinmesini bozar. Form taslakları ise genellikle form kütüphanesinin (ya da yerel state'in) içinde kalmalı; her tuş vuruşunu global bir store'a yazmak, bütün uygulamayı gereksiz yere yeniden render etmenin en kestirme yoludur. Kısacası her değer için "bu bilgi kime ait ve kim tarafından paylaşılmalı?" sorusunu sormak, doğru kabı seçmenin ilk adımıdır.

## Sunucu state'i: aslında bir önbellek problemi

Sunucu verisini istemcide tutmak, [A-07](/lessons/a-07-caching)'de gördüğümüz önbellek problemlerinin aynısını getirir: ne kadar süre taze sayılır, ne zaman geçersiz kılınır, aynı anda gelen istekler birleştirilir mi? React Query (TanStack Query), SWR ve Apollo gibi kütüphaneler tam olarak bu soruları cevaplar. Ortak fikirleri:

- **Sorgu anahtarı:** her veri bir anahtarla (`['progress', userId]`) tanımlanır. Aynı anahtarı isteyen iki bileşen tek bir ağ isteğini paylaşır (**request deduplication**).
- **stale-while-revalidate:** veri belirli bir süre (`staleTime`) taze sayılır. Süre dolunca bileşen yeniden göründüğünde ya da pencere tekrar odaklandığında önce **bayat** veri anında gösterilir, arka planda yeniden istek atılır, yeni veri gelince arayüz sessizce güncellenir. Kullanıcı hiç boş ekran görmez.
- **Invalidation:** bir **mutasyon** (POST/PUT/DELETE) başarılı olunca ilgili anahtarlar "geçersiz" işaretlenir; o veriyi ekranda gösteren bileşenler varsa otomatik olarak yeniden fetch tetiklenir. "DB'ye yaz, önbelleği sil" kuralının istemci tarafındaki karşılığıdır.
- **İyimser güncelleme (optimistic update):** sunucu cevabını beklemeden önbelleği beklenen sonuçla güncelleyip hata olursa geri almak. Beğeni butonları gibi düşük riskli işlemler için hissedilen hızı artırır.

:::animation{scene="scene.json"}
İki bileşen aynı sorguyu paylaşır; veri bayatlayınca önce eski değer gösterilip arka planda yenilenir; "Tamamla" mutasyonu sorguyu geçersiz kılar ve yeniden fetch tetiklenir.
:::

:::interactive{type="cache" capacity=4 policy="lru" writePolicy="cache-aside" ttlSec=10}
A–H anahtarlarını birer sorgu anahtarı gibi düşünün. Bir anahtara tıklamak `useQuery` gibidir: ilk okuma miss olur ve "DB okuma" sayacı artar, ikinci okuma hit olur. Şimdi aynı anahtara "Yaz" ile yeni değer verin: cache-aside politikası veritabanını günceller ve önbellekteki girdiyi siler — bu, mutasyon sonrası `invalidateQueries` çağrısının ta kendisidir. Aynı anahtarı tekrar okuyun: miss alır ve taze değeri getirir. TTL kaydırıcısı `staleTime` gibi davranır; süreyi kısaltıp girdilerin "süresi doldu" olarak düşmesini izleyin.
:::

:::code{lang="tsx" title="TanStack Query: sorgu, mutasyon ve invalidation"}
```tsx
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

function useProgress(userId: string) {
  return useQuery({
    queryKey: ['progress', userId],
    queryFn: () => api.get(`/users/${userId}/progress`),
    staleTime: 30_000, // 30 sn taze; sonra bayat-ama-göster + arka planda yenile
  });
}

function CompleteButton({ userId, lessonId }: { userId: string; lessonId: string }) {
  const qc = useQueryClient();
  const complete = useMutation({
    mutationFn: () => api.post(`/lessons/${lessonId}/complete`),
    // Başarılı mutasyon → ilgili sorgu geçersiz → ekrandaki bileşenler yeniden fetch eder
    onSuccess: () => qc.invalidateQueries({ queryKey: ['progress', userId] }),
  });
  return (
    <button onClick={() => complete.mutate()} disabled={complete.isPending}>
      Tamamla
    </button>
  );
}
```
:::

:::realworld{company="Meta"}
Facebook mühendisleri 2014'teki F8 konferansında yaptıkları *Hacker Way: Rethinking Web App Development at Facebook* konuşmasında, sohbet bildirimleri sayacının kullanıcı mesajları okumuş olsa bile tekrar tekrar yanlış sayı göstermesi gibi inatçı bir hatayı örnek verdi. Sorunun kökü, birbirini çift yönlü güncelleyen model ve görünümlerin oluşturduğu karmaşık bir bağımlılık ağıydı: hangi değişikliğin hangi güncellemeyi tetiklediğini izlemek zorlaşmıştı. Önerdikleri **Flux** mimarisi veriyi tek yönde akıtıyordu: görünüm bir eylem (action) üretir, merkezi bir dağıtıcı (dispatcher) eylemi store'lara iletir, store'lar durumu günceller ve görünümler yeniden çizilir. Redux bu fikri tek bir store ve saf reducer fonksiyonlarıyla sadeleştirdi. Sonraki yıllarda topluluk, API verisini de bu store'lara koymanın önbellek mantığını elle yeniden yazmak anlamına geldiğini fark etti; Vercel'in açık kaynak **SWR** kütüphanesi (adını HTTP'deki `stale-while-revalidate` yönergesinden alır) ve TanStack Query, sunucu state'ini ayrı bir önbellek katmanına taşıyan bu ikinci dalganın örnekleridir.
:::

:::callout{tone="warning" title="Sunucu verisini useEffect + useState ile elle çekmeyin"}
Her bileşende `useEffect` içinde `fetch` yapıp sonucu `useState`'e koymak; yarış koşullarını (eski isteğin yeni istekten sonra dönmesi), tekrarlanan istekleri, yükleme/hata durumlarını ve invalidation'ı sizin çözmenizi gerektirir. Bu, küçük ve hatalı bir sorgu önbelleğini yeniden yazmaktır.
:::

:::callout{tone="tip" title="Mülakat özeti"}
State'i önce sınıflandırın: istemciye mi ait, sunucunun kopyası mı? İstemci state'i için yerel → yukarı kaldırma → context → store merdivenini izleyin. Sunucu state'i için bir sorgu önbelleği kullanın ve şu üç kavramı adıyla söyleyin: deduplication, stale-while-revalidate, mutasyon sonrası invalidation.
:::

:::quiz{src="quiz.json"}
:::

:::resources
- [React: Sharing State Between Components](https://react.dev/learn/sharing-state-between-components) — belge — state'i yukarı kaldırma
- [TanStack Query](https://tanstack.com/query/latest) — belge — sunucu state'i, staleTime ve invalidation
- [SWR](https://swr.vercel.app/) — belge — Vercel'in stale-while-revalidate tabanlı veri çekme kütüphanesi
- [RFC 5861: HTTP Cache-Control Extensions for Stale Content](https://www.rfc-editor.org/rfc/rfc5861) — belge — stale-while-revalidate yönergesinin kaynağı
:::

:::next{lesson="p-04-web-performance"}
Sırada: tüm bu JavaScript'in bir bedeli var. Core Web Vitals, bundle boyutu, code splitting ve sayfanın gerçekten ne kadar hızlı hissettirdiği.
:::

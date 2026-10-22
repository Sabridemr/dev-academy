---
id: b-05-modular-monolith
slug: modular-monolith
module: b-architectures
order: 5
title:
  tr: "Modüler Monolit: Sınırlı Bağlamlar, Tek Dağıtım"
  en: "Modular Monolith: Bounded Contexts, Single Deploy"
summary:
  tr: Mikroservise geçmeden modül sınırları, iç API'ler, sınır ihlalinin CI'da yakalanması ve bir modülün servise ayrılması.
  en: Module boundaries without microservices, internal APIs, catching boundary violations in CI and extracting a module into a service.
durationMinutes: 30
level: intermediate
tags: [architecture, modular-monolith, bounded-context, module-boundaries, monolith]
prerequisites: [b-01-monolith-to-microservices, b-03-serverless-bff-clean-ddd]
concepts: [modular-monolith, bounded-context, module-public-api, module-boundary-enforcement, schema-per-module, in-process-events, single-deployment-unit, service-extraction]
---

## Kavram: tek süreç, çok sınır

b-01'de modüler monoliti monolit ile mikroservis arasındaki "en çok atlanan adım" olarak tanıttık. Bu derste o adımı kendi başına bir mimari olarak ele alıyoruz: nasıl kurulur, sınırlar nasıl korunur ve günün birinde bir modül nasıl ayrı servise çıkarılır.

Modüler monolitin tanımı iki cümledir. **Dağıtım birimi tektir**: bir derleme, bir süreç (ya da aynı imajdan çoğaltılmış replikalar), bir sürüm numarası. **Kod birimi çoktur**: uygulama, her biri bir iş yeteneğine (sipariş, katalog, ödeme) sahip modüllere bölünmüştür ve bu modüller birbirinin içine değil, yalnızca birbirinin **açık arayüzüne** dokunur. İlk cümle size monolitin ucuzluğunu verir: fonksiyon çağrısı hızında iletişim, tek veritabanı transaction'ı, tek bir hata ayıklama oturumu. İkinci cümle mikroservislerin asıl değerini verir: bir ekibin, diğer ekiplerin kodunu okumadan kendi alanını değiştirebilmesi.

Burada ayrım noktası **sınırlı bağlamdır** (bounded context). b-03'te gördüğümüz gibi "ürün" kelimesi katalogda görsel ve açıklama, depoda raf ve ağırlık demektir. Modüler monolitte her bağlam bir modül olur ve kendi modelini taşır. Sipariş modülü katalogdaki `Product` sınıfını import etmez; katalogdan yalnızca ihtiyaç duyduğu küçük bir görünümü (`fiyat`, `para birimi`) ister. Sınır kodun içinde olduğu için onu aşmak tek satırlık bir `import` kadar kolaydır; modüler monolitin bütün mühendisliği bu tek satırı engellemek üzerine kuruludur.

## Bir modülün anatomisi

Her modül üç bölgeden oluşur:

| Bölge | İçerik | Kim erişebilir? |
|---|---|---|
| **Açık API** (`public/`) | Facade sınıfı ya da fonksiyonlar, komut/sorgu DTO'ları, yayınlanan olay tipleri | Tüm modüller |
| **İç kod** (`internal/`) | Alan modeli, use case'ler, repository'ler, yardımcılar | Yalnızca modülün kendisi |
| **Veri** (`schema: orders`) | Modülün tabloları; ayrı bir Postgres şeması ya da tablo öneki | Yalnızca modülün kendisi |

İletişimin iki biçimi vardır. **Senkron iç API çağrısı**, cevaba hemen ihtiyaç olduğunda kullanılır: sipariş modülü fiyatı öğrenmek için `catalog.getPrice(id)` çağırır. **Süreç içi olay**, karşı tarafın ne yapacağını bilmek gerekmediğinde kullanılır: sipariş modülü `OrderPlaced` yayınlar; bildirim ve sadakat modülleri dinler. Olay yolunun bir kuyruk değil, aynı süreçteki bir dağıtıcı (event emitter) olması, transaction ile birlikte düşünülmesini gerektirir: olay ancak transaction commit edildikten sonra dinleyicilere ulaşmalıdır, yoksa geri alınmış bir siparişin bildirimi gider.

Veri sınırı en çok ihmal edilen sınırdır. Kod tarafında her şey düzgün olsa bile, raporlama sorgusu için `orders` ile `products` tablolarını SQL'de JOIN yapmak iki modülü veritabanı seviyesinde birbirine kaynak yapar. Kural basittir: bir modül başka bir modülün tablosunu okumaz, yazmaz, JOIN etmez. Ayrı Postgres şemaları ve modül başına ayrı veritabanı kullanıcısı bu kuralı veritabanının kendisine de zorlatır.

:::diagram{src="diagram.svg" alt="Tek dağıtım birimi içinde üç modül: Orders, Catalog ve Payments; her birinin açık API'si, iç kodu ve kendi veritabanı şeması var; modüller arası izinli oklar açık API'ye, yasak ok iç koda gidiyor; CI'daki sınır denetimi yasak oku yakalıyor|Three modules inside one deployment unit: Orders, Catalog and Payments; each has a public API, internal code and its own database schema; allowed arrows between modules go to the public API, a forbidden arrow goes into internal code; the boundary check in CI catches the forbidden arrow"}
Yeşil oklar izinli (açık API, olay); kırmızı ok bir modülün başka modülün iç koduna ya da tablosuna uzanması. Sınır kodda görünmez olduğu için bir araçla görünür kılınır.
:::

## Sınırı kim koruyor?

Kod incelemesinde "bu import'u kaldır" demek ölçeklenmez. Sınırlar makinede doğrulanmalıdır ve bunun için olgun araçlar vardır:

- **TypeScript/JavaScript**: `dependency-cruiser`, `eslint-plugin-boundaries`, Nx'in `enforce-module-boundaries` kuralı. Paket dışa aktarımlarını (`package.json` içindeki `exports`) yalnızca `public/` klasörüyle sınırlamak da etkili bir derleyici seviyesinde engeldir.
- **Java**: ArchUnit testleri ("`..orders.internal..` paketine yalnızca `..orders..` erişebilir") ve modül sınırlarını doğrulayan Spring Modulith.
- **Ruby**: Shopify'ın açık kaynak aracı Packwerk; her paketin genel API'sini ve bağımlılıklarını bildirir, ihlalleri statik analizle bulur.
- **.NET**: ayrı derlemeler (assembly) ve `internal` erişim belirleyicisi.

Bu denetimler CI'da diğer testlerle aynı yerde çalışır. Büyük ve eski bir kod tabanında başlarken mevcut ihlaller bir "yapılacaklar" listesine kaydedilir ve yalnızca **yeni** ihlaller derlemeyi kırar; böylece sınırlar ekipleri durdurmadan, zamanla sıkılaşır.

NestJS ile yazılmış bu projenin backend'i (f-08) iyi bir başlangıç örneğidir: her özellik bir `@Module`'dür ve modülün `exports` listesi onun açık API'sidir. `QuizzesModule`, `ProgressModule`'ü import eder ve yalnızca dışa aktarılan `ProgressService`'i kullanabilir. Ancak bütün modüller ortak `PrismaService` üzerinden her tabloya erişebildiği için veri sınırı yalnızca bir gelenektir; bir modüler monolit olgunlaştıkça atılacak ilk adım budur.

:::predict{id="modul-sinir-ihlali"}
Sipariş modülündeki bir geliştirici, fiyatı daha hızlı almak için `catalog/internal/product.repository` dosyasını doğrudan import ediyor. Uygulama derleniyor ve testler geçiyor. Bu değişiklik ne zaman sorun çıkarır? | A developer in the orders module imports `catalog/internal/product.repository` directly to get the price faster. The app compiles and tests pass. When does this change cause a problem?
- [ ] Hiçbir zaman; aynı süreçte oldukları için çağrı hatta daha hızlıdır | Never; it is even faster because they share a process
- [ ] Hemen, çünkü TypeScript farklı klasörler arası import'a izin vermez | Immediately, because TypeScript forbids imports across folders
- [x] Katalog ekibi iç kodunu değiştirdiğinde ya da katalog ayrı servise çıkarılmak istendiğinde | When the catalog team changes its internals or catalog needs to be extracted into a service
- [ ] Yalnızca yük testinde, çünkü repository bağlantı havuzunu paylaşır | Only under load testing, because the repository shares the connection pool
Açıklama: Çalışma zamanında hiçbir şey kırılmaz; sorun gizli bağlaşıklıktır. Katalog ekibi artık iç sınıfını özgürce değiştiremez ve katalog servise ayrıldığında bu import'un yerine konacak bir ağ çağrısı yoktur. Bu yüzden ihlal derleme zamanında, CI'daki sınır denetimiyle yakalanmalıdır. | Nothing breaks at runtime; the problem is hidden coupling. The catalog team can no longer change its internal class freely, and when catalog is extracted there is no network call to replace this import with. That is why the violation must be caught at build time by a boundary check in CI.
:::

:::animation{scene="scene.json"}
Tek süreç içinde modüllerin açık API ve olaylarla konuşması, bir sınır ihlalinin CI'da yakalanması ve ödeme modülünün aynı arayüzü koruyarak ayrı servise çıkarılması.
:::

## Tek dağıtımın gerçek maliyeti

Modüler monolit mucize değildir. Tek dağıtım birimi şu bedelleri hâlâ taşır: bütün modüller aynı sürüm treniyle çıkar (bir modüldeki kırmızı test herkesi bekletir), bütün modüller aynı ölçeklenir (yoğun bir arama modülü için bütün uygulama çoğaltılır), bir modüldeki bellek sızıntısı tüm süreci düşürür ve bütün modüller aynı dil ve çalışma zamanı sürümünde kalmak zorundadır.

Bu bedeller çoğu ekip için uzun süre kabul edilebilir düzeydedir; çünkü karşılığında kaybolan şeyler büyüktür: servisler arası ağ hatası yoktur, saga yerine yerel transaction yeter, uçtan uca test tek bir süreci ayağa kaldırmaktır ve "hangi servis hangi sürümde?" sorusu hiç sorulmaz.

:::interactive{type="pipeline" stages="commit,build,boundary-check,unit-test,integration-test,deploy" failureStage="boundary-check" retries=0}
Bu hattı modüler monolitin CI'ı olarak düşünün. Önce hattı olduğu gibi çalıştırın: bütün modüller tek derlemede doğrulanır ve son aşamada **tek bir** sürüm üretime çıkar. Sonra "Hata enjekte et" kutusunu işaretleyin, aşama olarak `boundary-check`'i seçili bırakın ve yeniden çalıştırın: bir modülün başka bir modülün iç koduna uzanması testlere bile gelmeden hattı durdurur, sonraki aşamalar "atlandı" kalır. "Yeniden deneme" değerini artırmak burada işe yaramaz; sınır ihlali geçici bir hata değil, deterministik bir kural ihlalidir. Son aşamadaki filo panelinde dağıtım stratejisini değiştirin: hangi stratejiyi seçerseniz seçin dağıtılan şey bütün modüllerdir.
:::

## Ne zaman bölünür?

Bir modülü ayrı servise çıkarmanın gerekçesi teknik heves değil, ölçülebilir bir sürtünmedir:

1. **Farklı ölçek profili**: Bir modül toplam CPU'nun büyük kısmını tüketiyor ve diğerlerinden bağımsız çoğaltılması gerekiyor.
2. **Farklı dağıtım ritmi**: Bir ekip günde birkaç kez çıkmak istiyor, ortak sürüm treni onu bekletiyor.
3. **Hata izolasyonu**: Bir modülün çökmesi (ör. görsel işleme) ödeme gibi kritik yolları düşürmemeli.
4. **Uyum ve güvenlik**: Kart verisi gibi ayrı denetim kapsamına girmesi gereken veri.
5. **Farklı teknoloji ihtiyacı**: Makine öğrenmesi modeli Python ekosistemi gerektiriyor.

Sınırları baştan iyi korunmuş bir modülde çıkarma işlemi mekaniktir: açık API bir ağ sözleşmesine (REST/gRPC) dönüşür, çağıran taraftaki süreç içi adaptör HTTP adaptörüyle değiştirilir (b-01'deki `CatalogPort` örneği), modülün şeması ayrı veritabanına taşınır ve süreç içi olaylar bir mesaj kuyruğuna (outbox ile, j-01) bağlanır. Sınırları korunmamış bir modülde ise ilk iş, aylarca sürebilecek bir "çözme" projesidir.

:::code{lang="ts" title="Sınırı makinede doğrulamak: dependency-cruiser kuralı + modül başına şema"}
```ts
// .dependency-cruiser.cjs — bir modül başka modülün yalnızca public/ klasörünü import edebilir
module.exports = {
  forbidden: [
    {
      name: 'modul-ic-koduna-erisim-yasak',
      severity: 'error',
      comment: 'Modüller arası iletişim yalnızca açık API (public/) üzerinden yapılır',
      from: { path: '^src/modules/([^/]+)/' },
      to: {
        path: '^src/modules/([^/]+)/',
        pathNot: ['^src/modules/$1/', '^src/modules/[^/]+/public/'], // kendi modülü veya başkasının public/'i
      },
    },
  ],
};

// src/modules/catalog/public/index.ts — katalogun dışarıya açtığı TEK yüz
export interface PriceView { amountMinor: number; currency: string }
export interface CatalogApi { getPrice(productId: string): Promise<PriceView> }

// src/modules/orders/internal/place-order.ts — sipariş, yalnızca açık API'yi bilir
import type { CatalogApi } from '../../catalog/public';
export async function placeOrder(catalog: CatalogApi, productId: string, qty: number) {
  const price = await catalog.getPrice(productId); // bugün fonksiyon çağrısı, yarın HTTP
  return { totalMinor: price.amountMinor * qty, currency: price.currency };
}

// migrations/001_schemas.sql — veri sınırını veritabanı da zorlasın
// CREATE SCHEMA orders;  CREATE SCHEMA catalog;
// CREATE ROLE orders_app; GRANT USAGE ON SCHEMA orders TO orders_app;  -- catalog'a yetki YOK
```
:::

:::realworld{company="Shopify"}
Shopify, ana uygulamasını yıllardır tek bir büyük Ruby on Rails monoliti olarak çalıştırır ve mikroservise bölmek yerine bilinçli olarak modülerleştirmeyi seçtiğini mühendislik blogunda anlatır. 2019 tarihli "Deconstructing the Monolith" yazısında kodu iş alanlarına (ör. ödeme, sipariş, vergi) göre **bileşenlere** ayırdıklarını, her bileşenin bir genel arayüz tanımladığını ve diğer bileşenlerin yalnızca o arayüzden konuşması gerektiğini açıklarlar. 2020'de yayımladıkları yazılar ise bu kuralları denetlemek için geliştirip açık kaynak yaptıkları **Packwerk** aracını tanıtır: paketler bağımlılıklarını ve genel API'lerini bildirir, araç ihlalleri statik analizle bulur ve mevcut ihlaller ayrı bir listeye alınarak yalnızca yenilerin engellenmesi sağlanır. Buradan çıkan ders şudur: araç bağımlılığı görünür kılar ama iyi sınırı kendiliğinden çizmez; asıl iş, alan modelini doğru bölmektir. Ölçeğin öbür ucunda **Uber**, 2020'de yayımladığı DOMA (Domain-Oriented Microservice Architecture) yazısında binlerce mikroservisi alanlar hâlinde gruplayıp her alanı tek bir ağ geçidinin arkasına aldığını anlatır; yani mikroservis dünyası da sonunda "modül sınırı" fikrine geri döner.
:::

:::callout{tone="warning" title="Modüler monolitin üç tuzağı"}
- **Paylaşılan "common" modülü**: Her şeyin konduğu ortak bir klasör, sınırları arka kapıdan deler. Ortak kod yalnızca alan bilgisi taşımayan altyapı olmalıdır (log, saat, para tipi).
- **Döngüsel bağımlılık**: Sipariş katalogu, katalog siparişi çağırıyorsa iki modül aslında bir modüldür ya da biri olayla tersine çevrilmelidir.
- **Veritabanında JOIN**: Raporlama için iki modülün tablosunu birleştirmek, kodda korunan sınırı veride yok eder. Raporlar olaylardan beslenen ayrı bir okuma modelinden (b-07) üretilmelidir.
:::

:::callout{tone="info" title="Mülakat ipuçları"}
- "Mikroservis kullanır mıydınız?" sorusuna modüler monoliti gerekçesiyle önermek olgunluk işaretidir: tek dağıtım, sınırlı bağlam başına modül, makinede doğrulanan sınırlar.
- Ayrılma kriterlerini somut sayın: ölçek profili, dağıtım ritmi, hata izolasyonu, uyum, teknoloji.
- Veri sınırını unutmayın: modül başına şema ve "başkasının tablosuna JOIN yok" kuralı.
:::

:::quiz{src="quiz.json"}
:::

:::resources
- [Deconstructing the Monolith: Designing Software that Maximizes Developer Productivity](https://shopify.engineering/deconstructing-monolith-designing-software-maximizes-developer-productivity) — blog — Shopify'ın bileşen tabanlı modüler monolit yaklaşımı
- [Packwerk](https://github.com/Shopify/packwerk) — depo — Ruby için paket sınırı ve bağımlılık denetimi
- [MonolithFirst](https://martinfowler.com/bliki/MonolithFirst.html) — makale — Martin Fowler: neden monolitle başlamalı
- [Introducing Domain-Oriented Microservice Architecture](https://www.uber.com/blog/microservice-architecture/) — blog — Uber'in mikroservisleri alanlara gruplaması
- [dependency-cruiser](https://github.com/sverweij/dependency-cruiser) — depo — JavaScript/TypeScript bağımlılık kuralları
:::

:::next{lesson="b-06-hexagonal-clean-architecture"}
Sırada: bir modülün ya da servisin içi nasıl düzenlenir? Port ve adaptörler, bağımlılık yönü, use case katmanı ve veritabanını sahteyle değiştirerek test.
:::

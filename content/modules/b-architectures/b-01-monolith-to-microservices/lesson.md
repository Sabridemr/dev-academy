---
id: b-01-monolith-to-microservices
slug: monolith-to-microservices
module: b-architectures
order: 1
title:
  tr: "Monolith → Modüler Monolith → Mikroservis"
  en: "Monolith → Modular Monolith → Microservices"
summary:
  tr: Evrim adımları, ayrıştırma kriterleri, ekip topolojisi.
  en: Evolution steps, decomposition criteria, team topology.
durationMinutes: 30
level: intermediate
tags: [architecture, monolith, microservices, modular-monolith, team-topology]
prerequisites: [a-03-horizontal-vertical-scaling, a-06-api-gateway, a-13-observability-12-factor]
concepts: [monolith, modular-monolith, microservices, bounded-context, decomposition-criteria, conways-law, strangler-fig, distributed-monolith, database-per-service]
---

## Kavram: mimari bir hedef değil, bir evrimdir

"Mikroservis mi, monolit mi?" sorusu yanlış sorudur. Doğru soru şudur: **şu anki ekip büyüklüğü, dağıtım sıklığı ve alan karmaşıklığı için en ucuz mimari hangisi?** Çoğu başarılı sistem aynı yoldan geçer:

1. **Monolith** — tek kod tabanı, tek dağıtım birimi, tek veritabanı. Başlangıçta en hızlı yoldur.
2. **Modüler monolith** — hâlâ tek dağıtım birimi, ama kod içeride **sınırları net modüllere** ayrılmış; modüller birbirinin tablosuna değil, yalnızca açık arayüzüne dokunur.
3. **Mikroservisler** — modüller ayrı süreçlere, ayrı dağıtım birimlerine ve ayrı veritabanlarına taşınır; aralarında ağ üzerinden konuşurlar.

Her adım bir maliyet ekler (ağ gecikmesi, kısmi hata, dağıtık veri tutarlılığı, gözlemlenebilirlik) ve bir maliyet kaldırır (ekiplerin birbirini beklemesi, tek bir hatanın her şeyi düşürmesi, tek teknoloji yığını zorunluluğu). Mimari karar, bu iki maliyet listesini **kendi bağlamınızda** karşılaştırmaktır.

:::diagram{src="diagram.svg" alt="Üç panel: tek kutu monolit ve tek veritabanı; modüller hâlinde bölünmüş modüler monolit; API gateway arkasında ayrı veritabanlı mikroservisler|Three panels: a single-box monolith with one database; a modular monolith split into modules; microservices with their own databases behind an API gateway"}
Soldan sağa evrim: kod sınırları → dağıtım sınırları → veri sınırları.
:::

## Monolith: küçümsenen başlangıç

Monolitin kötü bir şöhreti vardır ama bu haksızdır. Tek süreç içinde fonksiyon çağrısı **nanosaniye** sürer, transaction'lar ACID'dir, tek bir `git clone` ile her şey elinizdedir ve hata ayıklama tek bir stack trace okumaktan ibarettir.

Monolitin asıl sorunu **büyüdükçe** ortaya çıkar:

| Belirti | Kök neden |
|---|---|
| 40 dakikalık build, günde bir dağıtım | Her değişiklik tüm sistemi yeniden derler ve test eder |
| "Kim bu tabloyu değiştirdi?" | Her modül her tabloya doğrudan erişir; şema paylaşılan bir kamu malıdır |
| Bir bellek sızıntısı tüm siteyi düşürür | Tek süreç, tek hata alanı (blast radius) |
| Kampanya günü yalnızca sepet modülü yoğun ama tüm uygulamayı ölçekliyoruz | Ölçekleme birimi = dağıtım birimi |
| Yeni ekip üyesi üç ayda üretken oluyor | Modül sınırları yok; "büyük çamur topu" (big ball of mud) |

Bu belirtiler görülmeden mikroservise geçmek, olmayan bir hastalığa ameliyat olmaktır.

## Modüler monolith: en çok atlanan adım

Modüler monolit, mikroservislerin **kod düzeyindeki disiplinini**, operasyonel maliyetini ödemeden getirir. Kurallar basittir:

- Kod, iş alanına göre modüllere ayrılır: `catalog/`, `orders/`, `payments/`, `shipping/`. Teknik katmana göre değil (`controllers/`, `services/`, `repositories/` **değil**).
- Her modülün bir **public API'si** vardır (bir arayüz veya facade). Başka bir modül yalnızca bu API'yi çağırabilir; iç sınıflara erişim derleme zamanında ya da lint kuralıyla engellenir.
- Her modül **kendi tablolarının sahibidir**. `orders` modülü `products` tablosunu doğrudan sorgulamaz; `catalog` modülünden ister.
- Modüller arası iletişim mümkünse **süreç içi olaylarla** (in-process event bus) gevşetilir.

Bu kurallara uyan bir monolit, ileride bir modülü ayrı servise taşımak istediğinde çok az kod değiştirir çünkü sınır zaten vardır — yalnızca fonksiyon çağrısı ağ çağrısına dönüşür. Shopify, Basecamp ve Stack Overflow büyük trafikleri bu modelle taşıyan bilinen örneklerdir.

:::animation{scene="scene.json"}
Tek bir kutudan modüllere, modüllerden ayrı servislere: sınırların önce kodda, sonra dağıtımda, en son veride ayrışması.
:::

## Mikroservis: sınırlar ağa taşınıyor

Bir modül ayrı servis olduğunda üç şey değişir:

1. **Dağıtım bağımsızlığı** — ödeme ekibi günde on kez, katalog ekibi haftada bir dağıtım yapabilir.
2. **Hata izolasyonu** — öneri servisi çökse de ödeme çalışır (doğru tasarlanırsa; bkz. Circuit Breaker dersi).
3. **Bağımsız ölçekleme ve teknoloji** — arama servisi 30 replika ve Java, faturalandırma 2 replika ve Go olabilir.

Karşılığında yeni problemler satın alırsınız: ağ üzerinden çağrı (gecikme, zaman aşımı, kısmi hata), servisler arası veri tutarlılığı (dağıtık transaction yok — saga gerekir), sözleşme yönetimi (API versiyonlama), dağıtık izleme (trace id'siz hata ayıklamak imkânsız), ve altyapı maliyeti (CI/CD boru hattı, container orkestrasyonu, service mesh).

:::callout{tone="danger" title="Dağıtık monolit: en kötü iki dünya"}
Servisleri ayırdınız ama hepsi **aynı veritabanını** paylaşıyor, birini dağıtmak için diğer üçünü de dağıtmak gerekiyor, bir servis düşünce zincirleme hepsi düşüyor. Buna *distributed monolith* denir: monolitin bağlaşıklığı artı mikroservisin ağ maliyeti. Belirtileri: paylaşılan şema, senkron çağrı zincirleri (A→B→C→D), "release train" ile toplu dağıtım. Çözüm, servis ayırmaktan önce **veri ve sözleşme** sınırlarını ayırmaktır.
:::

## Ayrıştırma kriterleri: sınırı nereden çizmeli?

Servis sınırı çizmenin en güvenilir pusulası **DDD'deki bounded context** kavramıdır: aynı kelimenin ("ürün", "müşteri") farklı anlam taşıdığı yerler ayrı bağlamlardır. Bunun yanında şu kriterlere bakılır:

| Kriter | Soru | Ayrı servis lehine işaret |
|---|---|---|
| İş yeteneği (business capability) | Bu kod hangi iş sürecine hizmet ediyor? | Sipariş alma ve kargo takibi farklı süreçler |
| Değişim hızı | Bu parça ne sıklıkla değişiyor? | Kampanya motoru haftalık, muhasebe yıllık değişiyor |
| Ölçek profili | Yük nerede yoğunlaşıyor? | Arama okuma ağırlıklı, sipariş yazma ağırlıklı |
| Veri sahipliği | Bu tabloyu kim yazıyor? | Tek yazar varsa sınır nettir |
| Ekip | Kim bakımını yapıyor? | İki ekip aynı dosyaları değiştiriyorsa sürtünme var |
| Güvenlik/uyum | Farklı düzenleyici gereksinim var mı? | Kart verisi (PCI-DSS) izole edilmeli |

**Kötü kriterler**: teknik katman (bir "veritabanı servisi"), varlık adı (her tablo bir servis), sınıf büyüklüğü. Bunlar nano-servis enflasyonu ve sohbet eden (chatty) servisler üretir.

:::callout{tone="tip" title="Conway Yasası ve ters Conway manevrası"}
Conway Yasası: *bir organizasyon, kendi iletişim yapısının kopyası olan sistemler üretir.* Üç ekibiniz varsa üç katmanlı bir sistem çıkar. **Ters Conway manevrası**, istediğiniz mimariyi elde etmek için önce ekipleri o sınırlara göre düzenlemektir. "Team Topologies" kitabındaki *stream-aligned team* kavramı tam budur: her ekip uçtan uca bir iş akışına (ör. "ödeme") sahiptir ve o akışın servislerini tek başına dağıtabilir.
:::

## Geçiş stratejisi: Strangler Fig

Büyük patlama (big bang) yeniden yazımı neredeyse hiç işe yaramaz. Bunun yerine **Strangler Fig** kalıbı kullanılır: monolitin önüne bir yönlendirici (API gateway) konur, bir yetenek yeni servise taşınır, gateway o yolu yeni servise yönlendirir; monolit kuruyana kadar bu tekrarlanır. Detayını dağıtık kalıplar dersinde (c-04) göreceğiz. Aşağıdaki kod, bir modüler monolit içinde sınırların nasıl korunduğunu ve bir modülün ayrı servise taşınmasının neden "sadece adaptör değişikliği" olduğunu gösterir.

:::interactive{type="request-journey" scenario="monolith-vs-microservices" stages="gateway,orders,catalog,payments,db" compare=true}
Aynı "sipariş ver" isteğini bir monolitte (süreç içi çağrılar) ve mikroservis mimarisinde (ağ çağrıları) adım adım izleyin. Her durağın gecikmesini ve hata olasılığını değiştirerek toplam p99 gecikmenin ve başarı oranının nasıl değiştiğini karşılaştırın.
:::

:::code{lang="ts" title="Modüler monolitte modül sınırı: port + süreç içi adaptör → HTTP adaptörü"}
```ts
// orders/ports/catalog.port.ts — orders modülünün catalog'dan TEK istediği şey
export interface CatalogPort {
  getPrice(productId: string): Promise<{ amountMinor: number; currency: string }>;
}

// catalog/public/catalog.facade.ts — catalog modülünün dışa açık yüzü
export class CatalogFacade {
  constructor(private readonly repo: ProductRepository) {}
  async getPrice(productId: string) {
    const p = await this.repo.findById(productId);       // kendi tablosunu yalnızca catalog okur
    if (!p) throw new Error(`product not found: ${productId}`);
    return { amountMinor: p.priceMinor, currency: p.currency };
  }
}

// orders/adapters/in-process-catalog.adapter.ts — monolit aşaması: fonksiyon çağrısı
export class InProcessCatalogAdapter implements CatalogPort {
  constructor(private readonly facade: CatalogFacade) {}
  getPrice(productId: string) { return this.facade.getPrice(productId); }
}

// orders/adapters/http-catalog.adapter.ts — mikroservis aşaması: aynı port, ağ çağrısı
export class HttpCatalogAdapter implements CatalogPort {
  constructor(private readonly baseUrl: string) {}
  async getPrice(productId: string) {
    const res = await fetch(`${this.baseUrl}/products/${productId}/price`, {
      signal: AbortSignal.timeout(300),                  // ağa çıkınca zaman aşımı zorunlu
    });
    if (!res.ok) throw new Error(`catalog ${res.status}`);
    return (await res.json()) as { amountMinor: number; currency: string };
  }
}

// orders/application/place-order.ts — iş mantığı hangi adaptörün takılı olduğunu bilmez
export class PlaceOrder {
  constructor(private readonly catalog: CatalogPort) {}
  async execute(cmd: { productId: string; qty: number }) {
    const price = await this.catalog.getPrice(cmd.productId);
    return { total: price.amountMinor * cmd.qty, currency: price.currency };
  }
}
```
```python
from typing import Protocol

class CatalogPort(Protocol):
    def get_price(self, product_id: str) -> dict: ...

class InProcessCatalogAdapter:
    def __init__(self, facade): self.facade = facade
    def get_price(self, product_id):
        return self.facade.get_price(product_id)   # monolit: fonksiyon çağrısı

class HttpCatalogAdapter:
    def __init__(self, base_url, session): self.base_url, self.session = base_url, session
    def get_price(self, product_id):
        r = self.session.get(f"{self.base_url}/products/{product_id}/price", timeout=0.3)
        r.raise_for_status()
        return r.json()                              # mikroservis: aynı port, ağ çağrısı

class PlaceOrder:
    def __init__(self, catalog: CatalogPort): self.catalog = catalog
    def execute(self, product_id, qty):
        price = self.catalog.get_price(product_id)
        return {"total": price["amountMinor"] * qty, "currency": price["currency"]}
```
```java
public interface CatalogPort { Price getPrice(String productId); }

public final class InProcessCatalogAdapter implements CatalogPort {
    private final CatalogFacade facade;
    public InProcessCatalogAdapter(CatalogFacade facade) { this.facade = facade; }
    public Price getPrice(String id) { return facade.getPrice(id); } // monolit
}

public final class HttpCatalogAdapter implements CatalogPort {
    private final HttpClient client; private final String baseUrl;
    public HttpCatalogAdapter(HttpClient c, String baseUrl) { this.client = c; this.baseUrl = baseUrl; }
    public Price getPrice(String id) {
        var req = HttpRequest.newBuilder(URI.create(baseUrl + "/products/" + id + "/price"))
                .timeout(Duration.ofMillis(300)).build();          // mikroservis
        return Json.read(client.send(req, BodyHandlers.ofString()).body(), Price.class);
    }
}

public final class PlaceOrder {
    private final CatalogPort catalog;
    public PlaceOrder(CatalogPort catalog) { this.catalog = catalog; }
    public Total execute(String productId, int qty) {
        var p = catalog.getPrice(productId);
        return new Total(p.amountMinor() * qty, p.currency());
    }
}
```
:::

## Karar matrisi

| Durum | Öneri |
|---|---|
| 1–8 geliştirici, ürün-pazar uyumu arıyor | **Monolith**, ama modül klasörleriyle |
| 8–40 geliştirici, dağıtım kuyruğu oluşmaya başladı | **Modüler monolith**; CI'da modül sınırı testleri |
| Farklı ekipler birbirini bekliyor, farklı ölçek profilleri, farklı uyum gereksinimleri | Sınırı net modülleri **tek tek servise** çıkar |
| Her şeyi aynı anda dağıtıyor ve aynı DB'yi paylaşıyorsunuz | Dağıtık monolit — önce veri sınırlarını düzelt |

:::realworld{company="Amazon"}
Amazon'un 2001'deki **Obidos** uygulaması tek bir devasa C++ monolitiydi; her dağıtım haftalar süren koordinasyon istiyordu. Jeff Bezos'un ünlü "API mandate" notu her ekibin verisini yalnızca servis arayüzüyle dışa açmasını zorunlu kıldı ve **"iki pizza ekibi"** kuralı ekip büyüklüğünü sınırladı — ters Conway manevrasının en bilinen örneği. Sonuç, bugünkü binlerce servislik mimari ve AWS'nin doğuşudur. İlginç bir ters örnek de aynı şirketten: 2023'te Prime Video izleme-kalite ekibi, Step Functions + Lambda ile dağıtılmış bir işlem hattını **tek bir süreçte** birleştirerek maliyeti %90 düşürdüğünü yazdı. Ders: sınırlar iş alanına göre çizilmeli; aynı veri üzerinde çok sık konuşan adımlar aynı süreçte kalmalı.
:::

:::callout{tone="info" title="Mülakat ipuçları"}
- "Mikroservise geçerdim" demeden önce **neden**: hangi belirti, hangi kriter? Dağıtım sıklığı, ekip sayısı ve ölçek profili farkı somut gerekçelerdir.
- Modüler monoliti her zaman bir seçenek olarak masaya koyun; çoğu görüşmeci bunu olgunluk işareti sayar.
- Servis sınırı sorulursa: bounded context + veri sahipliği + ekip. Veritabanı paylaşımına "hayır" diyebilmelisiniz.
- Geçiş sorulursa: Strangler Fig, önce okuma yollarını taşı, çift yazım (dual write) tuzağına dikkat (Outbox kalıbı).
:::

:::quiz{src="quiz.json"}
:::

:::next{lesson="b-02-microservice-communication"}
Sırada: servisler ayrıldıktan sonra nasıl konuşacaklar? Senkron REST/gRPC, asenkron olaylar, saga, CQRS ve event sourcing.
:::

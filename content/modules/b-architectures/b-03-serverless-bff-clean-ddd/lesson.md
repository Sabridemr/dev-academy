---
id: b-03-serverless-bff-clean-ddd
slug: serverless-bff-clean-ddd
module: b-architectures
order: 3
title:
  tr: "Serverless, BFF, Hexagonal/Clean Architecture, DDD"
  en: "Serverless, BFF, Hexagonal/Clean Architecture, DDD"
summary:
  tr: Fonksiyon tabanlı mimari, istemciye özel backend, port-adaptör, bounded context.
  en: Function-based architecture, client-specific backends, ports & adapters, bounded contexts.
durationMinutes: 35
level: advanced
tags: [serverless, faas, bff, hexagonal, clean-architecture, ddd, bounded-context]
prerequisites: [b-01-monolith-to-microservices, a-06-api-gateway]
concepts: [serverless, cold-start, faas, bff, hexagonal-architecture, ports-and-adapters, clean-architecture, dependency-rule, ddd, bounded-context, aggregate, ubiquitous-language, context-map, anti-corruption-layer]
---

## Kavram: dört soru, dört cevap

Bu ders birbirinden bağımsız görünen dört konuyu bir araya getirir çünkü hepsi aynı mimari sorunun farklı ölçeklerdeki cevabıdır: **sınırları nereye çizeriz ve bağımlılıklar hangi yöne akar?**

| Soru | Cevap | Ölçek |
|---|---|---|
| Kodu nerede çalıştıralım, sunucuyu kim yönetsin? | **Serverless / FaaS** | Altyapı |
| Web, mobil ve TV istemcileri aynı API'den nasıl memnun olur? | **BFF** (Backend for Frontend) | Sistem sınırı |
| Bir servisin içi nasıl düzenlenmeli ki çerçeve ve veritabanı değişince iş kuralları yerinde kalsın? | **Hexagonal / Clean Architecture** | Tek servis |
| Servis sınırlarını ve içindeki modeli iş alanına göre nasıl buluruz? | **DDD** (Domain-Driven Design) | Alan modeli |

## Serverless: sunucu var, siz görmüyorsunuz

**Serverless**, sunucunun olmaması değil, sunucuyu **sizin yönetmemenizdir**. En yaygın biçimi **FaaS** (Function as a Service: AWS Lambda, Google Cloud Functions, Cloudflare Workers): kodunuzu bir fonksiyon olarak yüklersiniz; bir olay (HTTP isteği, kuyruk mesajı, dosya yüklemesi, zamanlayıcı) geldiğinde platform bir çalışma ortamı ayağa kaldırır, fonksiyonu çalıştırır, kullanılmadığında ortamı kapatır. Ödeme **çağrı başına ve milisaniye başına**dır; sıfır trafikte sıfır maliyet.

Yönetilen veritabanları (DynamoDB, Aurora Serverless), kuyruklar (SQS) ve nesne depoları (S3) da aynı felsefenin parçasıdır: kapasite planlamadan, yama yapmadan, ölçek düğmesine basmadan kullanılırlar.

### Cold start: ilk isteğin bedeli

Uzun süredir çağrılmayan bir fonksiyon için platformun yeni bir **micro-VM / container** başlatması, runtime'ı (Node, JVM, Python) yüklemesi ve kodunuzun başlatma (init) bloğunu çalıştırması gerekir. Bu **cold start** onlarca milisaniyeden (küçük Node fonksiyonu) birkaç saniyeye (büyük JVM + Spring) kadar sürebilir. Sonraki istekler aynı sıcak ortamı tekrar kullanır (**warm**); eşzamanlı 50 istek gelirse platform 50 ortam başlatır, yani cold start eşzamanlılık arttıkça tekrar görülür.

:::animation{scene="scene.json"}
Cold start ve warm çağrı: ilk istek ortam kurulumunu bekler, sonraki istekler sıcak ortamı kullanır, eşzamanlılık artınca yeni ortamlar ve yeni cold start'lar oluşur.
:::

Hafifletme yolları: küçük paket boyutu (bağımlılıkları budamak), hafif runtime (Node/Go/Rust; JVM'de GraalVM native ya da SnapStart), init bloğunda ağır işleri (DB bağlantı havuzu, SDK istemcileri) **bir kez** yapıp handler dışında tutmak, kritik yollar için **provisioned concurrency** (önceden ısıtılmış N ortam) ve bağlantı yükünü düşürmek için RDS Proxy gibi bağlantı havuzlayıcıları.

| Serverless'ın parladığı yer | Zayıf kaldığı yer |
|---|---|
| Ani ve öngörülemeyen trafik (kampanya, viral) | Sabit, yüksek ve sürekli yük (maliyet container'ı geçer) |
| Olay tetiklemeli işler (görsel işleme, ETL, webhook) | Uzun süreli işlemler (15 dk limiti), WebSocket gibi kalıcı bağlantılar |
| Küçük ekip, düşük operasyon kapasitesi | Çok düşük ve kararlı gecikme gereksinimi (p99 < 20 ms) |
| Glue kodu, zamanlanmış görevler | Yerel geliştirme/test ve vendor lock-in kaygısı yüksek ekipler |

## BFF: her istemciye kendi backend'i

Web sayfası ürün detayında 40 alan ister, mobil 12 alan ve küçük görsel, akıllı TV ise tamamen farklı bir gezinme ağacı. Tek bir "genel amaçlı" API hepsini memnun etmeye çalışınca şişer (over-fetching), ya da istemciler düzinelerce çağrı yapar (under-fetching, chatty client) ve mobil pil tüketir.

**Backend for Frontend**, her istemci türü için ince bir backend katmanı koyar: web-BFF, mobile-BFF, tv-BFF. BFF, arkadaki mikroservisleri **paralel** çağırır, cevapları o istemcinin ekranına göre birleştirir ve biçimlendirir, istemciye özgü auth akışını (çerez vs. token) yönetir. BFF'in sahibi **frontend ekibidir**; backend ekiplerini beklemeden ekran değişikliği yapabilirler.

:::diagram{src="diagram.svg" alt="Web, mobil ve TV istemcileri kendi BFF'lerine bağlanır; her BFF arkadaki ortak mikroservisleri paralel çağırıp istemciye özel yanıt üretir|Web, mobile and TV clients connect to their own BFFs; each BFF calls the shared microservices in parallel and shapes a client-specific response"}
BFF ince kalmalıdır: birleştirme ve biçimlendirme yapar, iş kuralı barındırmaz. İş kuralı BFF'e sızarsa üç kopyası oluşur.
:::

:::callout{tone="warning" title="BFF'in tuzakları"}
- **İş mantığı sızıntısı**: "indirim hesabı" BFF'e girerse web ve mobil farklı fiyat gösterir. Kural, alan servisindedir; BFF sunum yapar.
- **BFF başına çoğaltma**: Ortak kesitler (auth doğrulama, rate limit, logging) API gateway'de, istemciye özel birleştirme BFF'de olmalı.
- **GraphQL alternatifi**: Tek bir GraphQL katmanı, istemcinin istediği alanları seçmesine izin vererek BFF ihtiyacını azaltabilir; ancak federasyon ve sorgu karmaşıklığı limitleri gerektirir. İkisi birlikte de kullanılır: BFF'in kendisi GraphQL sunar.
:::

## Hexagonal / Clean Architecture: bağımlılıklar içeri akar

Bir servisi klasik üç katmanla (controller → service → repository) yazdığınızda iş mantığı ORM'e, HTTP çerçevesine ve mesaj kütüphanesine bağımlı olur: çerçeve yükseltmesi iş kurallarını kırar, birim testi için veritabanı gerekir. **Hexagonal architecture** (Alistair Cockburn, *ports and adapters*) ve **Clean Architecture** (Robert Martin) aynı ilkeyi savunur: **bağımlılık kuralı** — kaynak kodu bağımlılıkları yalnızca **içeri**, iş alanına doğru işaret eder.

- **Domain (çekirdek)**: Varlıklar, değer nesneleri, iş kuralları. Hiçbir çerçeveyi import etmez.
- **Application (use case)**: "Sipariş ver", "iade başlat" gibi akışlar. Port'ları (arayüzleri) tanımlar.
- **Port**: Çekirdeğin dış dünyadan istediği/dış dünyaya sunduğu arayüz. *Driving* (gelen) port: `PlaceOrderUseCase`. *Driven* (giden) port: `OrderRepository`, `PaymentGateway`.
- **Adapter**: Port'u somut teknolojiyle bağlayan kod. REST controller, Kafka consumer (gelen); Postgres repository, Stripe client (giden).

:::diagram{src="hexagonal.svg" alt="Merkezde domain ve use case altıgeni, çevresinde gelen port ve adaptörler (REST, CLI, Kafka) ile giden port ve adaptörler (Postgres, Stripe, e-posta); tüm oklar içeri bakar|A hexagon with domain and use cases at the center, driving ports and adapters (REST, CLI, Kafka) and driven ports and adapters (Postgres, Stripe, email) around it; all arrows point inward"}
Aynı use case'i REST ile de, kuyruktan gelen mesajla da, testte doğrudan da çağırabilirsiniz; Postgres yerine bellek içi repository takmak bir satırdır.
:::

Pratik kazanç: iş kuralları **milisaniyede** test edilir (adaptör yok), teknoloji değişimi çekirdeğe dokunmaz ve b-01'de gördüğümüz "modülü servise çıkarma" işlemi yalnızca bir adaptör değişikliğidir.

:::code{lang="ts" title="Hexagonal: use case + driven port + iki adaptör (Postgres ve bellek içi test)"}
```ts
// domain/order.ts — çerçeve import'u YOK
export class Order {
  private constructor(readonly id: string, readonly lines: { sku: string; qty: number; unitMinor: number }[], public status: 'PENDING' | 'PAID' | 'CANCELLED') {}
  static place(id: string, lines: Order['lines']) {
    if (lines.length === 0) throw new Error('empty order');          // iş kuralı burada yaşar
    return new Order(id, lines, 'PENDING');
  }
  total() { return this.lines.reduce((s, l) => s + l.qty * l.unitMinor, 0); }
  markPaid() { if (this.status !== 'PENDING') throw new Error('invalid transition'); this.status = 'PAID'; }
}

// application/ports.ts — çekirdeğin dış dünyadan İSTEDİĞİ arayüzler (driven ports)
export interface OrderRepository { save(o: Order): Promise<void>; byId(id: string): Promise<Order | null> }
export interface PaymentGateway { charge(orderId: string, amountMinor: number): Promise<{ ok: boolean }> }

// application/place-order.ts — use case (driving port'un kendisi)
export class PlaceOrder {
  constructor(private readonly repo: OrderRepository, private readonly pay: PaymentGateway) {}
  async execute(cmd: { orderId: string; lines: Order['lines'] }) {
    const order = Order.place(cmd.orderId, cmd.lines);
    await this.repo.save(order);
    const res = await this.pay.charge(order.id, order.total());
    if (res.ok) { order.markPaid(); await this.repo.save(order); }
    return { status: order.status };
  }
}

// adapters/out/postgres-order.repo.ts — giden adaptör (üretim)
export class PostgresOrderRepository implements OrderRepository {
  constructor(private readonly sql: Sql) {}
  async save(o: Order) { await this.sql`insert into orders ... on conflict (id) do update set status = ${o.status}`; }
  async byId(id: string) { const r = await this.sql`select * from orders where id = ${id}`; return r[0] ? toDomain(r[0]) : null; }
}

// adapters/out/in-memory-order.repo.ts — giden adaptör (test): DB olmadan ms'de test
export class InMemoryOrderRepository implements OrderRepository {
  private store = new Map<string, Order>();
  async save(o: Order) { this.store.set(o.id, o); }
  async byId(id: string) { return this.store.get(id) ?? null; }
}

// adapters/in/http.ts — gelen adaptör; aynı use case Lambda handler'dan da çağrılabilir
app.post('/orders', async (req, res) => {
  const result = await placeOrder.execute({ orderId: req.body.id, lines: req.body.lines });
  res.status(201).json(result);
});
```
```python
class Order:                                  # domain: çerçeve yok
    def __init__(self, id, lines):
        if not lines: raise ValueError("empty order")
        self.id, self.lines, self.status = id, lines, "PENDING"
    def total(self): return sum(l["qty"] * l["unit_minor"] for l in self.lines)
    def mark_paid(self):
        if self.status != "PENDING": raise ValueError("invalid transition")
        self.status = "PAID"

class OrderRepository(Protocol):             # driven port
    def save(self, o: Order) -> None: ...
class PaymentGateway(Protocol):
    def charge(self, order_id: str, amount_minor: int) -> bool: ...

class PlaceOrder:                             # use case
    def __init__(self, repo: OrderRepository, pay: PaymentGateway): self.repo, self.pay = repo, pay
    def execute(self, order_id, lines):
        order = Order(order_id, lines); self.repo.save(order)
        if self.pay.charge(order.id, order.total()):
            order.mark_paid(); self.repo.save(order)
        return order.status

class InMemoryOrderRepository:                # test adaptörü
    def __init__(self): self.store = {}
    def save(self, o): self.store[o.id] = o
```
```java
public final class Order {                                  // domain: hiçbir framework import'u yok
    private final String id; private final List<Line> lines; private Status status = Status.PENDING;
    private Order(String id, List<Line> lines) { this.id = id; this.lines = lines; }
    public static Order place(String id, List<Line> lines) {
        if (lines.isEmpty()) throw new IllegalArgumentException("empty order");
        return new Order(id, lines);
    }
    public long total() { return lines.stream().mapToLong(l -> l.qty() * l.unitMinor()).sum(); }
    public void markPaid() { if (status != Status.PENDING) throw new IllegalStateException(); status = Status.PAID; }
}

public interface OrderRepository { void save(Order o); Optional<Order> byId(String id); }   // driven port
public interface PaymentGateway { boolean charge(String orderId, long amountMinor); }

public final class PlaceOrder {                             // use case
    private final OrderRepository repo; private final PaymentGateway pay;
    public PlaceOrder(OrderRepository repo, PaymentGateway pay) { this.repo = repo; this.pay = pay; }
    public Status execute(String orderId, List<Line> lines) {
        var order = Order.place(orderId, lines); repo.save(order);
        if (pay.charge(order.id(), order.total())) { order.markPaid(); repo.save(order); }
        return order.status();
    }
}
// JpaOrderRepository (üretim) ve InMemoryOrderRepository (test) aynı port'u implemente eder.
```
:::

## DDD: sınırları iş alanından öğrenmek

**Domain-Driven Design**'ın stratejik tarafı, b-01'deki "sınırı nereden çizeriz?" sorusunun en güçlü cevabıdır.

- **Ubiquitous language (ortak dil)**: Geliştiriciler ve alan uzmanları aynı kelimeleri kullanır ve bu kelimeler kodda sınıf adı olur. "Ürün" kelimesi katalogda *açıklama ve görsel*, depoda *ağırlık ve raf*, muhasebede *vergi kodu* demekse bu **üç farklı model**dir.
- **Bounded context**: Bir modelin ve dilin geçerli olduğu sınır. Her bounded context genellikle bir servis (ya da modüler monolitte bir modül) olur. Aynı gerçek dünya nesnesi her bağlamda farklı bir sınıf olarak modellenir — bu çoğaltma değil, doğruluktur.
- **Context map**: Bağlamlar arası ilişkiler: *customer–supplier*, *conformist* (yukarı akışın modelini olduğu gibi kabul etmek), *anti-corruption layer* (ACL: dış modelin kendi modelinizi kirletmemesi için çeviri katmanı — özellikle legacy sistemlere ve üçüncü taraf API'lere karşı), *shared kernel*, *published language*.

Taktik tarafta **aggregate**, tutarlılık sınırıdır: bir transaction'da değişen nesne kümesi (Sipariş + satırları) tek bir kök (aggregate root) üzerinden değiştirilir. Aggregate'ler arası referans id iledir; aggregate'ler arası tutarlılık nihaidir (saga/olay). Bu kural, b-02'deki saga ihtiyacının ve "aggregate = transaction sınırı = çoğu zaman servis sınırı" sezgisinin kaynağıdır.

:::diagram{src="ddd.svg" alt="Üç bounded context: Catalog, Ordering ve Shipping; her birinde aynı adlı ama farklı alanlara sahip Product sınıfı; aralarında customer-supplier ilişkileri ve legacy ERP'ye karşı anti-corruption layer|Three bounded contexts: Catalog, Ordering and Shipping; each has a Product class with the same name but different fields; customer-supplier relationships between them and an anti-corruption layer towards a legacy ERP"}
Context map: aynı kelime, üç farklı model. Oklar yukarı akış (upstream) → aşağı akış (downstream) yönünü gösterir.
:::

:::interactive{type="request-journey" scenario="bff-serverless" stages="client,bff,lambda-cold,lambda-warm,service,db" showColdStart=true}
Bir mobil isteğinin yolculuğunu izleyin: BFF üç servisi paralel çağırır; servislerden biri serverless ve cold start yaşıyor. Provisioned concurrency'yi açıp kapatarak, paket boyutunu ve runtime'ı değiştirerek p50/p99 gecikme farkını gözlemleyin.
:::

:::realworld{company="Netflix"}
BFF kalıbını adlandıran SoundCloud olsa da en ünlü uygulaması Netflix'tir: 2012'de yayımladıkları "API'nizi istemciye göre optimize edin" yaklaşımında her cihaz ekibi (TV, iOS, Android, web) kendi **istemciye özel endpoint'lerini** yazıyordu; bu uç noktalar arkadaki yüzlerce mikroservisi paralel çağırıp cihazın ihtiyacına göre tek yanıt üretiyordu. Bugün bu katman **GraphQL federasyonu** ile çalışır: her alan servisi kendi şema parçasını yayımlar, federated gateway istemcinin seçtiği alanları birleştirir. Serverless tarafında Netflix, video kodlama boru hattının parçalarını ve operasyonel otomasyonu Lambda'da çalıştırır; ama ana akış servisleri sürekli ve öngörülebilir yük taşıdığı için container'larda kalır — tam da yukarıdaki "sabit yüksek yükte container daha ucuz" kuralının örneği. İç mimaride ise Netflix servislerinin çoğu hexagonal yapıyı açıkça kullanır: 2020'deki mühendislik yazıları, veri kaynağını (REST → gRPC → GraphQL) iş mantığına dokunmadan değiştirebildiklerini anlatır.
:::

:::callout{tone="tip" title="Mülakat ipuçları"}
- Serverless sorulursa önce **yük profilini** sorun: ani ve seyrek mi, sabit ve yüksek mi? Cold start için somut hafifletme sayın (provisioned concurrency, küçük paket, init dışı bağlantı).
- BFF'i "istemci başına ince birleştirme katmanı, frontend ekibinin malı, iş kuralı yok" cümlesiyle tanımlayın; gateway ile farkını söyleyin (gateway ortak kesit, BFF istemciye özel).
- Clean/hexagonal için tek cümle: **bağımlılıklar içeri akar; çekirdek çerçeve bilmez; port arayüz, adaptör teknoloji**.
- DDD'de "aynı kelime farklı anlam → ayrı bounded context" örneği verin; aggregate'i transaction sınırı olarak tanımlayın; legacy entegrasyonunda ACL deyin.
:::

:::quiz{src="quiz.json"}
:::

:::next{lesson="b-04-multi-region-dr"}
Sırada: sistem tek bir bölge çökünce ne olur? Aktif-aktif / aktif-pasif, RPO/RTO ve DNS failover animasyonu.
:::

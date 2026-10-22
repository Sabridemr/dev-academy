---
id: a-17-grpc-graphql-rest
slug: grpc-graphql-rest
module: a-system-design-fundamentals
order: 17
title:
  tr: "gRPC, GraphQL ve REST Karşılaştırması"
  en: "gRPC, GraphQL and REST Compared"
summary:
  tr: Sözleşmeler (OpenAPI, SDL, protobuf), streaming, N+1 problemi ve DataLoader, BFF ile ilişki; hangi durumda hangi API stili.
  en: Contracts (OpenAPI, SDL, protobuf), streaming, the N+1 problem and DataLoader, the relation to BFF; which API style when.
durationMinutes: 30
level: intermediate
tags: [api, rest, graphql, grpc, protobuf, dataloader, bff]
prerequisites: [a-01-client-server-dns-http, a-06-api-gateway]
concepts: [rest, graphql, grpc, protobuf, graphql-schema, n-plus-one, dataloader, streaming-rpc, bff, api-federation]
---

## Kavram: aynı veri, üç farklı sözleşme

Mobil uygulamada bir "sipariş detayı" ekranı düşünün: siparişin durumu, müşterinin adı ve siparişteki ürünlerin ad ve fiyatları. Veri üç ayrı servisten geliyor: sipariş, müşteri ve katalog. Bu veriyi istemciye taşımanın üç yaygın yolu var ve her biri farklı bir soruya iyi cevap veriyor. **REST** "kaynakları HTTP'nin kendi kurallarıyla nasıl sunarım?", **GraphQL** "istemci tam olarak neye ihtiyaç duyduğunu nasıl söyler?", **gRPC** ise "servisler birbirini yerel bir fonksiyon gibi, hızlı ve tip güvenli biçimde nasıl çağırır?" sorusuna cevap verir. Bu derste aynı ekranı üç stille kurup farkları somutlaştıracağız.

## REST: kaynaklar ve HTTP'nin gücü

REST'te her şey bir **kaynaktır** ve bir URL'si vardır: `GET /orders/42`, `GET /customers/7`, `GET /products?ids=11,12,13`. Fiiller (`GET`, `POST`, `PUT`, `DELETE`) ve durum kodları HTTP'den gelir. En büyük gücü HTTP ekosistemiyle doğal uyumudur: `GET` yanıtları tarayıcı, CDN ve gateway tarafından `Cache-Control` ve `ETag` ile önbelleğe alınır ([caching](/lessons/a-07-caching) dersindeki katmanların hepsi bedavaya çalışır), her araç (curl, tarayıcı, log sistemleri) onu anlar. Sözleşme genellikle **OpenAPI** ile yazılır ama zorunlu değildir.

Zayıf yanı, ekranlar zenginleştikçe ortaya çıkar. Sipariş detayı için üç istek gerekir ve ikinci ile üçüncü istek birincinin yanıtına bağlı olduğundan **sıralıdır**: mobil ağda 100 ms RTT ile yalnızca ağ bekleyişi 300 ms'yi bulur (*under-fetching*). Üstelik `GET /products` her ürün için 40 alan döndürürken ekran yalnızca 2 alan kullanır (*over-fetching*).

## GraphQL: istemci ne istediğini söyler

GraphQL'de sunucu bir **şema** (SDL, Schema Definition Language) yayınlar: tipler, alanlar ve aralarındaki ilişkiler. İstemci tek bir uç noktaya (`POST /graphql`) tam olarak istediği şekli gönderir:

```graphql
query {
  order(id: 42) {
    status
    customer { name }
    items { quantity product { name price } }
  }
}
```

Sunucu her alan için bir **resolver** çalıştırır ve yanıtı sorgunun birebir şeklinde döner. Üç istek bire iner, gereksiz alanlar hiç gönderilmez ve şema hem dokümantasyon hem de tip denetimi görevi görür. Farklı ekranları olan web, mobil ve TV istemcilerinin aynı arka uçtan kendi ihtiyacını çekebilmesi GraphQL'in asıl değeridir.

Bedelleri de vardır. Tek uç nokta ve `POST` isteği yüzünden HTTP önbellekleri doğal çalışmaz; *persisted query* (sorguyu önceden kaydedip kimliğiyle `GET` göndermek) bu yüzden yaygındır. İstemci keyfi derinlikte sorgu yazabildiği için sorgu derinliği ve maliyet sınırlaması gerekir ([rate limiting](/lessons/a-10-rate-limiting) burada istek sayısına değil sorgu maliyetine uygulanır). Ve en ünlü tuzak: **N+1 problemi**.

## N+1 problemi ve DataLoader

Resolver'lar alan alan çalışır. `order` resolver'ı siparişi getirir (1 çağrı), ardından `items` içindeki her öğe için `product` resolver'ı **ayrı ayrı** çağrılır: 3 ürün için 3 çağrı, 50 ürün için 50 çağrı. Toplam 1 + N. Her resolver tek başına doğru görünür ama birlikte veritabanını ya da katalog servisini boğarlar.

Çözüm, Facebook'un açık kaynak olarak yayımladığı **DataLoader** desenidir. Resolver'lar ürünü doğrudan getirmek yerine `productLoader.load(id)` çağırır. DataLoader aynı olay döngüsü turunda (tick) gelen tüm anahtarları toplar ve tek bir toplu çağrı yapar: `products.batchGet([11, 12, 13])`. Ayrıca istek süresince aynı anahtarı ikinci kez istemez (istek kapsamlı cache). 1 + N çağrı, 1 + 1'e iner.

:::diagram{src="diagram.svg" alt="REST, GraphQL ve gRPC'nin sözleşme, taşıma, veri biçimi, streaming ve tipik kullanım açısından karşılaştırması|Comparison of REST, GraphQL and gRPC by contract, transport, payload format, streaming and typical use"}
Üç sütun aynı soruları cevaplar: sözleşme nerede yazılır, hangi taşıma ve biçim kullanılır, streaming nasıl yapılır, önbellekleme ne kadar kolaydır ve en çok nerede tercih edilir.
:::

:::predict{id="graphql-n-arti-bir"}
GraphQL sorgusu bir siparişin 50 ürününün adını istiyor. `product` resolver'ı her öğe için katalog servisini doğrudan çağırıyor. Sorgu başına katalog servisine kaç çağrı gider ve bunu ne düzeltir? | A GraphQL query asks for the names of an order's 50 products. The `product` resolver calls the catalog service directly for each item. How many catalog calls happen per query and what fixes it?
- [ ] 1 çağrı; GraphQL tüm alanları otomatik olarak birleştirir | 1 call; GraphQL merges all fields automatically
- [x] 50 çağrı (N+1'in N'i); DataLoader ile aynı turdaki anahtarlar tek bir toplu çağrıda birleşir | 50 calls (the N of N+1); with DataLoader the keys from the same tick are merged into one batch call
- [ ] 51 çağrı; çözümü yanıtı CDN'de önbelleğe almaktır | 51 calls; the fix is caching the response at the CDN
Açıklama: GraphQL motoru resolver'ları alan alan çalıştırır, çağrıları kendiliğinden birleştirmez. `order` resolver'ı sipariş servisine bir çağrı yapar, `product` resolver'ı ise katalog servisine 50 ayrı çağrı yapar; N+1 deseni budur. DataLoader aynı turda gelen 50 anahtarı toplayıp `batchGet` ile tek çağrı yapar. CDN önbelleği tek uç noktalı `POST` sorgularında doğal çalışmaz ve iç çağrı sayısını azaltmaz. | The GraphQL engine runs resolvers field by field and does not merge calls on its own. The `order` resolver makes one call to the order service, while the `product` resolver makes 50 separate calls to the catalog service; that is the N+1 pattern. DataLoader collects the 50 keys arriving in the same tick and makes one `batchGet` call. A CDN cache does not naturally work for single-endpoint `POST` queries and does not reduce internal calls.
:::

:::animation{scene="scene.json"}
Aynı "sipariş + müşteri + ürünler" verisi: REST'te üç sıralı istek, GraphQL'de tek sorgu ve DataLoader ile birleşen resolver çağrıları, gRPC'de ise sözleşmeli ikili çağrı ve ürünlerin server streaming ile tek tek akması.
:::

:::interactive{type="request-journey" stages="client,http-orders,http-customer,http-products" rttMs=80 failureStage="http-customer"}
REST ile sipariş ekranının üç sıralı isteğini izleyin: `http-orders`, `http-customer` ve `http-products` duraklarının her biri bir ağ gidiş-dönüşü (RTT) kadar sürer. RTT kaydırıcısını 20 ms'den (aynı şehirdeki Wi-Fi) 150 ms'ye (zayıf mobil ağ) çekin: toplam gecikme yaklaşık üç katı kadar artar, çünkü istekler birbirini bekler. GraphQL ya da bir BFF bu üç durağı istemci açısından tek bir gidiş-dönüşe indirir; aradaki çağrılar veri merkezi içinde, milisaniyeler içinde yapılır. "Hata enjekte et: http-customer" kutusunu işaretleyin: sipariş geldi ama müşteri gelmedi; istemci yarım bir ekranla ne yapacağına kendisi karar vermek zorunda kalır.
:::

## gRPC: sözleşmeli, ikili ve akışlı

gRPC'de sözleşme bir `.proto` dosyasıdır. Servisler, metotlar ve mesajlar **Protocol Buffers** ile tanımlanır; derleyici her dil için istemci ve sunucu kodu üretir. Mesajlar ikili (binary) olarak kodlanır, alanlar adla değil numarayla taşınır; bu yüzden yükler JSON'dan küçüktür ve ayrıştırması hızlıdır. Taşıma katmanı **HTTP/2**'dir: tek bağlantı üzerinde çok sayıda eşzamanlı çağrı çoğullanır (*multiplexing*).

gRPC'nin dört çağrı biçimi vardır: **unary** (bir istek, bir yanıt), **server streaming** (bir istek, yanıt akışı), **client streaming** (istek akışı, tek yanıt) ve **bidirectional streaming**. Sipariş ekranında katalog servisi ürünleri tek büyük yanıt yerine hazır oldukça tek tek gönderebilir. gRPC ayrıca **deadline** kavramını protokolün parçası yapar: çağıran "bu çağrının 200 ms'si var" der ve süre, alt çağrılara da taşınır.

Zayıf yanları: tarayıcılar gRPC'yi doğrudan konuşamaz (araya gRPC-Web proxy'si gerekir), ikili yük curl ile okunamaz ve hata ayıklama için özel araçlar gerekir; HTTP önbellekleri de işe yaramaz. Bu yüzden gRPC en çok **servisler arası** iç trafikte parlar.

:::code{lang="ts" title="GraphQL resolver'larında N+1'i DataLoader ile çözmek"}
```ts
import DataLoader from 'dataloader';

// İstek başına yeni loader: önbellek yalnızca bu isteğin ömrü kadar yaşar
export function createLoaders(catalog: { batchGet(ids: number[]): Promise<Product[]> }) {
  return {
    product: new DataLoader<number, Product | null>(async (ids) => {
      const rows = await catalog.batchGet([...ids]); // N çağrı yerine tek toplu çağrı
      const byId = new Map(rows.map((p) => [p.id, p]));
      return ids.map((id) => byId.get(id) ?? null); // sıra, anahtar sırasıyla aynı olmalı
    }),
  };
}

export const resolvers = {
  Query: {
    order: (_: unknown, { id }: { id: number }, ctx: Ctx) => ctx.orders.get(id),
  },
  OrderItem: {
    // Her öğe için çağrılır ama aynı turdaki tüm id'ler tek batchGet'te birleşir
    product: (item: { productId: number }, _: unknown, ctx: Ctx) =>
      ctx.loaders.product.load(item.productId),
  },
};

interface Product { id: number; name: string; price: number }
interface Ctx {
  orders: { get(id: number): Promise<unknown> };
  loaders: ReturnType<typeof createLoaders>;
}
```
:::

## Sözleşmenin evrimi: sürümleme

Bir API'yi yayınlamak kolaydır, onu istemcileri bozmadan değiştirmek zordur; üç stil bu soruna farklı cevap verir. REST'te kırıcı değişiklikler genellikle yeni bir sürümle (`/v2/orders` ya da bir başlık) yayınlanır ve eski sürüm bir süre yaşatılır. GraphQL'de tek bir şema evrilir: yeni alanlar eklenir, eski alanlar `@deprecated` ile işaretlenir ve hangi istemcinin hâlâ kullandığı sorgu loglarından izlenerek kaldırılır. gRPC'de geriye uyumluluk alan numaralarına dayanır: yeni alan yeni bir numarayla eklenir, eski istemci tanımadığı alanı yok sayar; silinen bir alanın numarası `reserved` ile kilitlenir ve asla başka bir alana verilmez. Her üç durumda da kural aynıdır: eklemek güvenlidir, anlamı değiştirmek ve silmek planlama ister.

## BFF ile ilişki ve hangi durumda hangisi

[Serverless ve BFF](/lessons/b-03-serverless-bff-clean-ddd) dersinde her istemci tipi için ayrı bir **Backend for Frontend** katmanı görülür: mobil BFF, mobil ekranın ihtiyacını birkaç iç servisten toplayıp tek yanıtta döner. GraphQL bu fikrin genelleştirilmiş hâli gibi düşünülebilir: her ekran için ayrı uç nokta yazmak yerine istemci ihtiyacını sorguyla ifade eder. Pratikte en yaygın mimari üç stili birlikte kullanır: dış dünyaya REST ya da GraphQL, gateway veya BFF'den iç servislere gRPC.

| Durum | Önerilen | Neden |
|---|---|---|
| Herkese açık API, üçüncü taraf geliştiriciler | REST | Evrensel araç desteği, HTTP önbelleği, kolay öğrenme |
| Farklı veri ihtiyaçları olan çok sayıda istemci ve zengin ekranlar | GraphQL | Tek gidiş-dönüş, alan seçimi, şema ile tip güvenliği |
| İç servisler arası, düşük gecikme, çok dilli ekipler | gRPC | Üretilen istemciler, ikili yük, HTTP/2, deadline |
| Gerçek zamanlı akış | gRPC streaming (iç), GraphQL subscription ya da [WebSocket](/lessons/a-14-websocket-realtime) (dış) | Sürekli bağlantı üzerinden olay akışı |

:::realworld{company="Netflix ve Google"}
Netflix teknoloji blogundaki *How Netflix Scales its API with GraphQL Federation* serisi, stüdyo uygulamaları için kurulan tek bir GraphQL API'nin ekip sayısı arttıkça darboğaza dönüştüğünü anlatır. Çözüm **federasyon** oldu: her alan ekibi kendi şema parçasını sunan bir servis (Domain Graph Service) işletiyor, merkezi bir gateway bu parçaları tek bir birleşik grafa dönüştürüp sorguları ilgili servislere dağıtıyor. Böylece istemciler tek bir şema görürken sahiplik ekiplere dağıtılmış oldu. Netflix daha sonra bu servisleri yazmak için kullandığı DGS çerçevesini açık kaynak olarak yayımladı.

gRPC'nin kökeni Google'dır. Google, yıllarca veri merkezlerindeki servisler arası iletişim için **Stubby** adlı iç RPC altyapısını kullandı ve gRPC'yi 2015'te bu deneyimin açık kaynak, HTTP/2 tabanlı halefi olarak duyurdu. Bugün gRPC Cloud Native Computing Foundation (CNCF) bünyesinde geliştirilen bir projedir ve Kubernetes ekosistemindeki pek çok bileşen iç iletişiminde gRPC kullanır.
:::

:::callout{tone="warning" title="GraphQL bir veritabanı sorgu dili değildir"}
GraphQL şeması istemcinin ihtiyacını modellemelidir, tablolarınızı birebir yansıtmamalıdır. Şemayı veritabanından otomatik üretmek ilk gün hızlı görünür ama iç yapıyı dışarıya sızdırır, N+1'i yaygınlaştırır ve şemayı veritabanı değişikliklerine bağımlı kılar. Ayrıca derinlik ve maliyet sınırı olmadan açılan bir GraphQL uç noktası, tek bir sorguyla arka ucu çökertmenin kolay bir yoludur.
:::

:::callout{tone="tip" title="Mülakat özeti"}
- Stili istemciye göre seçin: dış ve herkese açık → REST; çok istemcili zengin ekranlar → GraphQL; servisler arası → gRPC.
- GraphQL dediğiniz anda N+1 ve DataLoader'ı, ardından önbellekleme (persisted query) ve maliyet sınırlamasını söyleyin.
- gRPC için protobuf sözleşmesi, HTTP/2 multiplexing, streaming biçimleri ve deadline yayılımını sayın; tarayıcı için gRPC-Web gerektiğini unutmayın.
:::

:::quiz{src="quiz.json"}
:::

:::resources
- [gRPC: Core concepts, architecture and lifecycle](https://grpc.io/docs/what-is-grpc/core-concepts/) — belge — dört çağrı biçimi ve deadline
- [Protocol Buffers](https://protobuf.dev/) — belge — .proto sözleşmeleri ve ikili kodlama
- [Learn GraphQL](https://graphql.org/learn/) — belge — şema, sorgu ve resolver'lar
- [graphql/dataloader](https://github.com/graphql/dataloader) — depo — toplu yükleme ve istek kapsamlı cache
:::

:::next{lesson="b-01-monolith-to-microservices"}
Modül A tamamlandı. Sırada Modül B: bu yapı taşlarını bir araya getiren mimariler — monolitten modüler monolite, oradan mikroservislere geçişin adımları ve kriterleri.
:::

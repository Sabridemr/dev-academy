---
id: j-04-amazon-mimari-veri-ve-siparis-akisi
slug: amazon-mimari-veri-ve-siparis-akisi
module: j-system-design-notes
order: 4
title:
  tr: "Amazon Ölçeğinde E-Ticaret Sistem Tasarımı: Mimari, Veri ve Sipariş Akışı"
  en: "Amazon-Scale E-Commerce System Design: Architecture, Data and Order Flow"
summary:
  tr: "Amazon ölçeğinde mimariyi, önbellek ve DB ölçeklemeyi, çift satışı önlemeyi ve Saga ile sipariş akışını öğren."
  en: "Learn Amazon-scale architecture, caching and DB scaling, preventing overselling and Saga-based order flow."
durationMinutes: 25
level: advanced
tags: [system-design, microservices, e-commerce, caching, database-scaling, saga]
prerequisites: [e-01-amazon-scale-ecommerce, a-07-caching]
concepts: [monolith-vs-microservices, multi-region, api-gateway, cache-aside, sharding, cap-theorem, atomic-conditional-update, saga-pattern]
---

## 1. Büyüme Yolculuğu

Amazon 1995'te tek bir C++ uygulaması (Obidos) ve tek bir Oracle veritabanıyla başladı. Bugün ise binlerce bağımsız servisten oluşuyor. Bu dönüşüm bir anda olmadı. Her darboğaz çıktığında bir sonraki adım atıldı. Senin backend + frontend + DB yapın tam olarak 1. evrede.

:::diagram{src="sekil-01.png" alt="Kullanıcı sayısı arttıkça dört büyüme evresi: 1. Tek sunucu (~1.000), 2. Ayrık DB (~50.000), 3. Yatay ölçek (~1 milyon), 4. Mikroservis (10 milyon+)|Four growth stages as users increase: 1. Single server (~1,000), 2. Separate DB (~50,000), 3. Horizontal scale (~1 million), 4. Microservices (10 million+)"}
Şekil 1 – Bir e-ticaret sisteminin büyüme evreleri
:::

| Evre | Darboğaz | Çözüm |
|---|---|---|
| 1 → 2 | CPU ve diski uygulama ile DB paylaşıyor | DB'yi ayrı sunucuya ya da yönetilen bir servise (RDS) taşı, otomatik yedek al |
| 2 → 3 | Tek uygulama sunucusu yetmiyor, çökünce site kapanıyor | Load balancer arkasında N adet aynı kod çalışır, uygulama stateless olur, oturum Redis'te tutulur |
| 3 → 4 | Yüzlerce geliştirici aynı kodda çakışıyor, bir hata her şeyi düşürüyor | Alanlara göre bölme (Domain-Driven Design): her ekibin kendi servisi ve kendi DB'si olur |

:::callout{tone="info" title="Kritik kural:"}
3. evrede "her sunucuda aynı kod" geçerlidir. 4. evrede ise her servis ayrı bir koddur, ayrı bir repoda durur ve ayrı ayrı deploy edilir. Frontend artık bir sunucuda çalışmaz; derlenmiş statik dosyalar olarak CDN'de durur.
:::

## 2. Monolitten Mikroservise

:::diagram{src="sekil-02.png" alt="Solda tek DB'ye bağlı Kullanıcı, Ürün, Sepet, Sipariş ve Ödeme modüllerinden oluşan monolit; sağda her biri kendi Postgres ya da Redis veritabanına sahip, API Gateway / Kafka ile haberleşen mikroservisler|On the left a monolith with User, Product, Cart, Order and Payment modules on one DB; on the right microservices each with its own Postgres or Redis, talking through an API Gateway and Kafka"}
Şekil 2 – Monolit ve mikroservis karşılaştırması
:::

2002'de Jeff Bezos "API Mandate" adıyla bilinen bir kural koydu: ekipler birbirlerinin veritabanına doğrudan erişemez, sadece ağ üzerinden API ile konuşabilir. AWS'nin doğuşu da bu kuralın sonucudur. Bir başka ünlü kural "two-pizza team"dir: bir servisin sahibi, iki pizzayla doyabilecek kadar küçük bir ekip olmalıdır.

### Servis sınırları nasıl çizilir?

- **İş alanına göre:** Kullanıcı, Katalog, Fiyat, Stok, Sepet, Sipariş, Ödeme, Kargo, Bildirim, Öneri, Yorum.
- **Veri sahipliği:** Her veri tek bir servise aittir. Sipariş servisi stok tablosunu doğrudan güncellemez; Stok servisine istek gönderir ya da bir olay yayınlar.
- **Haberleşme:** Anında cevap gerekiyorsa senkron (REST/gRPC), gerekmiyorsa asenkron (Kafka/SQS) kullanılır.

:::callout{tone="warning" title="Tuzak:"}
Erken mikroservis bir hatadır. 5 kişilik bir ekip için 30 servis, dağıtık sistemin bütün zorluklarını avantajları olmadan getirir. Doğru başlangıç noktası, modüler bir monolittir.
:::

## 3. Global Altyapı

:::diagram{src="sekil-03.png" alt="İstanbul'daki kullanıcının DNS sorgusu Route 53 GeoDNS / Anycast ile en yakın sağlıklı bölgeye yönlendirilir; eu-central, us-east ve ap-south bölgelerinin her birinde CDN Edge + WAF, Load Balancer, Kubernetes ve 3 AZ'li DB, Cache, Kafka katmanları ve bölgeler arası asenkron replikasyon|A user in Istanbul is routed by Route 53 GeoDNS / Anycast to the nearest healthy region; eu-central, us-east and ap-south each have CDN edge + WAF, load balancer, Kubernetes and 3-AZ DB, cache and Kafka layers with asynchronous cross-region replication"}
Şekil 3 – Çok bölgeli (multi-region) global dağıtım
:::

- **Region:** Coğrafi veri merkezi grubu (Frankfurt, Virginia vb.). Kullanıcı en yakın bölgeye yönlendirilir, böylece gecikme düşer. KVKK/GDPR gereği veri yerelliği de bölge seçimini etkiler.
- **Availability Zone (AZ):** Bir bölge içinde elektriği ve ağı birbirinden bağımsız 3 ya da daha fazla veri merkezi. Her servis en az 3 AZ'ye dağıtılır.
- **Edge / CDN:** Dünyada yüzlerce noktada (PoP) bulunur. Statik içerik kullanıcıya 10-30 ms içinde ulaşır.
- **Aktif-aktif ve aktif-pasif:** Katalog gibi okuma ağırlıklı veri her bölgede aktif olabilir. Stok ve ödeme gibi kritik yazmalar ise genelde ürünün "ev bölgesinde" tek bir kaynakta yapılır.

## 4. Uçtan Uca Mimari

:::diagram{src="sekil-04.png" alt="Yukarıdan aşağıya katmanlar: istemciler, CDN ve WAF, API Gateway / BFF, Kimlik-Katalog-Arama-Fiyat-Sepet-Stok-Sipariş-Ödeme-Kargo-Öneri servisleri, Kafka Event Bus, veri depoları (PostgreSQL, DynamoDB, Redis, Elasticsearch, S3) ve yatay gözlemlenebilirlik katmanı|Top-down layers: clients, CDN and WAF, API Gateway / BFF, Identity-Catalog-Search-Pricing-Cart-Inventory-Order-Payment-Shipping-Recommendation services, Kafka event bus, data stores (PostgreSQL, DynamoDB, Redis, Elasticsearch, S3) and a horizontal observability layer"}
Şekil 4 – Uçtan uca mimari katmanları
:::

| Bileşen | Görev | Örnek teknoloji |
|---|---|---|
| API Gateway / BFF | Tek giriş noktası; auth, rate limit, mobil ve web için ayrı cevap şekli (Backend-for-Frontend) | Kong, AWS API Gateway, Envoy |
| Servis ağı | Servisler arası şifreleme, tekrar deneme, trafik bölme | Istio, Linkerd |
| Konteyner orkestrasyonu | Servis kopyalarını otomatik açıp kapatır, çökeni yeniden başlatır | Kubernetes (EKS) |
| Mesaj kuyruğu | Servisleri birbirinden ayırır, yük patlamalarını emer | Kafka, SQS, RabbitMQ |
| Polyglot veri | Her iş için uygun veritabanı | Postgres, DynamoDB, Redis, Elasticsearch, S3 |

Katmanları tek tek görmeden önce, bu dersin sonunda ayrıntısına gireceğimiz en kritik akışı baştan sona izleyelim: sipariş servisinin stok, ödeme ve olay yayınını saga olarak yönetmesi ve ödeme reddedildiğinde telafi adımlarının çalışması. Animasyondaki koşullu `UPDATE` 8. bölümün, telafi zinciri 9. bölümün konusudur.

:::animation{scene="order-saga.scene.json"}
Stok atomik olarak ayrılır, kart bloke edilir, OrderPlaced yayınlanır; ikinci siparişte ödeme reddedilince stok serbest bırakılır ve sipariş iptal edilir.
:::

## 5. Bir İsteğin Yolculuğu

:::diagram{src="sekil-05.png" alt="Ürün sayfası isteğinin yolu: Tarayıcı, CDN, LB, Gateway, Ürün servisi, Redis (cache HIT ~1 ms) ve DB replika (MISS ise ~10 ms); toplam hedef p99 200 ms altı|Path of a product page request: browser, CDN, LB, gateway, product service, Redis (cache HIT ~1 ms) and DB replica (~10 ms on MISS); target p99 under 200 ms"}
Şekil 5 – Bir ürün sayfası isteğinin yolu
:::

Ürün sayfası tek bir istek gibi görünür ama aslında paralel 20-50 iç çağrıdan oluşur: başlık, fiyat, stok, yorumlar, öneriler, kargo süresi. BFF katmanı bu çağrıları paralel yapar. Kritik olmayan bir parça (örneğin öneriler) zaman aşımına uğrarsa, sayfa o bölüm olmadan döner. Buna **graceful degradation** denir.

## 6. Önbellekleme

:::diagram{src="sekil-10.png" alt="Soldan sağa önbellek katmanları: Tarayıcı cache, CDN edge, Redis, DB buffer ve Disk; sağa gittikçe daha yavaş ve daha pahalı|Cache layers from left to right: browser cache, CDN edge, Redis, DB buffer and disk; slower and more expensive further right"}
Şekil 10 – Çok katmanlı önbellekleme
:::

- **Cache-aside:** Önce Redis'e bakılır. Veri yoksa DB'den okunur ve Redis'e TTL ile yazılır.
- **Invalidation:** Fiyat değişince bir olay yayınlanır ve ilgili cache anahtarı silinir. "Cache invalidation, bilgisayar biliminin en zor iki probleminden biridir."
- **Thundering herd:** Popüler bir anahtarın süresi dolunca binlerce istek aynı anda DB'ye gider. Çözüm: istek birleştirme (single-flight), TTL'e rastgele sapma (jitter) eklemek, süre dolmadan önce yenilemek.
- **Ne cache'lenmez:** Kesin stok sayısı ve ödeme durumu. Bunlar her zaman doğruluk kaynağından (DB) okunur.

## 7. Veritabanı Ölçekleme

:::diagram{src="sekil-09.png" alt="Sipariş servisi yazmaları Primary veritabanına, okumaları üç Read Replica'ya gönderir; veri tek makineye sığmayınca hash(user_id) % N ile dört shard'a bölünür|The order service sends writes to the primary database and reads to three read replicas; when data no longer fits one machine it is split into four shards by hash(user_id) % N"}
Şekil 9 – Veritabanı ölçekleme: replikasyon ve sharding
:::

| Veri | Seçim | Neden |
|---|---|---|
| Sipariş, ödeme, stok | İlişkisel (Postgres/Aurora) | ACID transaction ve güçlü tutarlılık gerekir |
| Sepet, oturum | Key-value (DynamoDB) | Çok yüksek yazma hızı; Amazon'un Dynamo makalesi tam da sepet için yazıldı |
| Ürün katalogu | Doküman DB + Elasticsearch | Esnek ürün özellikleri ve tam metin arama |
| Analitik | Data lake (S3) + Redshift/BigQuery | Raporlama sorguları canlı DB'yi yormamalı |

**CAP teoremi:** Ağ bölündüğünde (Partition) ya tutarlılık (Consistency) ya da erişilebilirlik (Availability) seçilir. Amazon sepeti erişilebilirliği seçer: sepete ekleme hiç reddedilmez, çakışmalar sonradan birleştirilir. Ödeme ve stok ise tutarlılığı seçer.

**Replikasyon gecikmesi:** Kullanıcı siparişi verdikten hemen sonra "Siparişlerim" sayfasını replikadan okursa siparişini göremeyebilir. Çözüm "read-your-writes" kuralıdır: kullanıcının kendi yazdığı veri birkaç saniye boyunca primary'den okunur.

## 8. Son 1 Ürün Problemi (Çift Satışı Önlemek)

:::diagram{src="sekil-06.png" alt="Ali ve Ayşe aynı anda stoğu 1 olan ürüne UPDATE ... WHERE stock>=1 gönderir; satır kilidi sayesinde Ali'nin sorgusu 1 satır günceller, Ayşe'ninki kilit açılınca 0 satır döner ve ürün tükenir; altında yanlış (SELECT sonra UPDATE) ve doğru (tek atomik UPDATE) yaklaşım|Ali and Ayşe both send UPDATE ... WHERE stock>=1 for an item with stock 1; thanks to the row lock Ali's query updates 1 row and Ayşe's returns 0 rows once the lock is released, so the item sells out; below, the wrong approach (SELECT then UPDATE) and the right one (a single atomic UPDATE)"}
Şekil 6 – Son 1 ürün: atomik koşullu güncelleme ile çift satışın önlenmesi
:::

### Yöntemler: basitten ileri seviyeye

| Yöntem | Nasıl | Ne zaman |
|---|---|---|
| Atomik koşullu UPDATE | `WHERE stock >= 1` ile kontrol ve yazma tek sorguda | Çoğu durumda yeterli; varsayılan çözüm |
| Pesimist kilit | `SELECT ... FOR UPDATE` | Birden fazla tablo birlikte güncelleniyorsa |
| İyimser kilit | `WHERE version = 5`; tutmazsa tekrar dene | Çakışmanın nadir olduğu durumlar |
| Redis atomik DECR / Lua | Stok Redis'te tutulur, düşüm tek atomik komutla yapılır | Flash sale: saniyede on binlerce istek |
| Kuyrukla seri işleme | Aynı ürüne gelen istekler aynı Kafka partition'ına gider ve tek tek işlenir | Çok yüksek eşzamanlılık |

:::diagram{src="sekil-07.png" alt="Stok durum makinesi: AVAILABLE (satılabilir) checkout ile RESERVED (15 dk TTL) olur, ödeme OK ile SOLD olur; süre dolarsa ya da ödeme başarısız olursa stok AVAILABLE'a geri döner|Inventory state machine: AVAILABLE becomes RESERVED (15-minute TTL) at checkout and SOLD when payment succeeds; on timeout or failed payment stock returns to AVAILABLE"}
Şekil 7 – Stok rezervasyon durum makinesi
:::

:::code{lang="sql"}
```sql
BEGIN;
UPDATE inventory SET available = available - 1, reserved = reserved + 1
 WHERE sku = 'CAMFISTIGI-1KG' AND available >= 1;      -- 0 satır ise: TÜKENDİ
INSERT INTO reservations(sku, order_id, expires_at) VALUES (..., now() + interval '15 min');
COMMIT;
-- Arka plan işi: süresi dolan rezervasyonları bul → available'a geri ekle
```
:::

:::callout{tone="info" title="İnce noktalar:"}
- Sepete eklemek stok ayırmaz. Ayırma işlemi ödeme adımında yapılır; aksi halde kötü niyetli kullanıcılar stoku kilitleyebilir.
- "Son 3 ürün" yazısı cache'ten gelebilir ve hafif eski olabilir. Bu kabul edilebilir; asıl karar ödeme anında verilir.
- Çoklu depo varsa stok her depo için ayrı satırda tutulur (`sku + warehouse`), böylece kilit çakışması azalır.
- Amazon gibi şirketler bazen bilinçli olarak biraz fazla satış yapar (overbooking) ve tedarikçiden tamamlar. Bu teknik değil, bir iş kararıdır.
:::

## 9. Sipariş ve Ödeme Akışı (Saga)

:::diagram{src="sekil-08.png" alt="Saga akışı: Sipariş oluştur, Stok ayır, Ödeme al, Siparişi onayla, Kargoya ver; ödeme reddedilirse telafi adımları olarak önce stok serbest bırakılır, sonra sipariş iptal edilir|Saga flow: create order, reserve stock, take payment, confirm order, ship; if payment is declined the compensations release stock first and then cancel the order"}
Şekil 8 – Dağıtık sipariş akışı: Saga deseni ve telafi işlemleri
:::

Mikroservislerde servisler arasında tek bir DB transaction'ı olamaz. Bu yüzden her adım kendi yerel transaction'ını yapar ve bir olay yayınlar. Hata olursa telafi adımları çalışır.

### Ödemenin altın kuralları

- **Idempotency key:** Her ödeme isteği benzersiz bir anahtar taşır. Ağ koptuğu için istek tekrar gelirse, aynı sonuç döner ve para ikinci kez çekilmez.
- **Outbox deseni:** Sipariş satırı ve "OrderPlaced" olayı aynı transaction içinde outbox tablosuna yazılır. Ayrı bir işlem bu olayı Kafka'ya taşır. Böylece "DB'ye yazıldı ama olay kayboldu" durumu yaşanmaz.
- **Authorize ve capture:** Kart önce sadece bloke edilir (authorize), para kargoya verilince çekilir (capture).
- **Exactly-once bir illüzyondur:** Gerçekte mesajlar "en az bir kez" teslim edilir. Tüketici tarafı idempotent olmalıdır; işlenen mesaj ID'leri saklanır.
- **Kart verisi asla saklanmaz:** PCI-DSS gereği ödeme sağlayıcısı (iyzico, Stripe, Adyen) token döner, sistem sadece bu token'ı saklar.

## 10. Arama, Öneri ve Fiyat

- **Arama:** Ürün değiştikçe olay yayınlanır ve Elasticsearch indeksi güncellenir (CDC: Change Data Capture, örneğin Debezium). Yazım hatası toleransı, eş anlamlılar (örneğin "çam fıstığı" ve "dolmalık fıstık") ve kişiselleştirilmiş sıralama burada yapılır.
- **Öneri:** "Bunu alanlar şunu da aldı" (item-to-item collaborative filtering) Amazon'un klasik algoritmasıdır. Öneriler gece toplu (batch) olarak hesaplanır ve gerçek zamanlı sinyallerle karıştırılır. Amazon satışlarının önemli bir kısmının önerilerden geldiği sıkça belirtilir.
- **Fiyat:** Fiyat ayrı bir servistir; kampanya, kupon, kademeli toptan fiyat ve döviz gibi kuralları uygular. Sepetteki fiyat, ödeme anında yeniden doğrulanır.

## Dene: cache-aside ile ürün sayfası

:::interactive{type="cache" capacity=6 policy="lru" writePolicy="cache-aside"}
Ürün okumalarını önbelleğe al; kapasiteyi değiştirip hit oranının nasıl değiştiğini ve LRU'nun hangi anahtarları attığını izle.
:::

:::realworld{company="Amazon"}
Bu dersteki büyüme yolculuğu Amazon'un kendi anlattığı hikâyeye dayanır. CTO Werner Vogels, 2006'da ACM Queue'ya verdiği röportajda Amazon'un tek bir büyük uygulama ve onun veritabanıyla başladığını, ölçek ve ekip sayısı arttıkça bunun yüzlerce servise bölündüğünü anlatır. Bu dönüşümde servislere yalnızca arayüzleri üzerinden erişilir, başka bir servisin veritabanına doğrudan bağlanmak yasaktır ve servisi yazan ekip onu canlıda da işletir ("you build it, you run it").

Veri tarafındaki ödünleşim ise 2007'de yayımlanan Dynamo makalesinde açıkça yazılıdır. Makale, alışveriş sepetinin her koşulda yazılabilir kalması gerektiğini söyler: ağ ya da sunucu sorunlarında bile "sepete ekle" reddedilmemelidir. Bunun için Dynamo tutarlılıktan ödün verir; aynı sepetin çakışan sürümleri oluşabilir ve okuma sırasında birleştirilir. Makale bu seçimin bedelini de saklamaz: birleştirme sonucunda silinmiş bir ürün sepette yeniden görünebilir. Ödeme ve stok düşümünde ise böyle bir esneklik kabul edilmez; bu ayrım, dersteki "sepette erişilebilirlik, parada tutarlılık" kuralının kaynağıdır.
:::

:::callout{tone="info" title="İlgili dersler"}
Bu konuyu başka bir açıdan anlatan dersler:

- [Amazon Ölçeğinde E-ticaret vaka çalışması](/lessons/e-01-amazon-scale-ecommerce)
:::

:::quiz{src="quiz.json"}
:::

:::next{lesson="j-05-amazon-dayaniklilik-mesajlasma-ve-isletim"}
:::

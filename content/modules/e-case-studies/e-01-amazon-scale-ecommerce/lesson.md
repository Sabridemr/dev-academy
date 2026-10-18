---
id: e-01-amazon-scale-ecommerce
slug: amazon-scale-ecommerce
module: e-case-studies
order: 1
title:
  tr: Amazon Ölçeğinde E-ticaret
  en: Amazon-Scale E-commerce
summary:
  tr: Katalog, sepet, sipariş, envanter, ödeme, arama, öneri; Black Friday simülasyonu.
  en: Catalog, cart, orders, inventory, payments, search, recommendations; Black Friday simulation.
durationMinutes: 45
level: advanced
tags: [case-study, e-commerce, microservices, scaling, interview]
prerequisites: [a-05-load-balancing, a-07-caching, a-09-message-queues-event-driven, d-06-example-schemas]
concepts: [functional-requirements, capacity-estimation, product-catalog, shopping-cart, order-saga, inventory-reservation, payment-idempotency, search-indexing, recommendations, black-friday-autoscaling]
---

## Vaka: "Amazon'u tasarla"

"Amazon gibi bir e-ticaret sitesi tasarla" sorusu aslında yedi alt sistemin (katalog, sepet, sipariş, envanter, ödeme, arama, öneri) birbirine nasıl bağlandığını ve **her birinin farklı tutarlılık/erişilebilirlik ihtiyacı** olduğunu kavrayıp kavramadığınızı ölçer. Bu modüldeki her vaka aynı şablonu izler: gereksinim → kapasite → mimari → bileşenler → darboğaz → animasyonlu istek yolculuğu. Şablonu bir kez öğrenince mülakatta hangi sistem sorulursa sorulsun aynı iskeleti kullanabilirsiniz.

## 1. Gereksinimler

### Fonksiyonel

- Ürün arama ve kategori gezinme (katalog)
- Ürün detay sayfası: fiyat, stok, yorumlar, "bunu alanlar şunu da aldı"
- Sepete ekle/çıkar; sepet cihazlar arasında senkron kalsın
- Checkout: sipariş oluştur, ödeme al, sipariş durumunu takip et
- Envanter: aynı son ürün iki kişiye satılmasın (**oversell yok**)

### Fonksiyonel olmayan

| Gereksinim | Hedef | Gerekçe |
|---|---|---|
| Erişilebilirlik | Katalog ve sepet için %99.99 | Sepet düşerse satış durur |
| Gecikme | Ürün sayfası p99 < 300 ms, checkout p99 < 1 s | Amazon'un ünlü ölçümü: her 100 ms gecikme ≈ %1 satış kaybı |
| Tutarlılık | Envanter ve ödemede **güçlü**, katalog/öneride **eventual** | Para ve stok yanlış olamaz; yorum sayısı 5 sn geç görünebilir |
| Ölçek | Black Friday'de normalin 10–20 katı | Tepe için tasarla, ortalama için öde |
| Dayanıklılık | Sipariş asla kaybolmaz | Finansal ve yasal kayıt |

Kritik gözlem: sistem **okuma ağırlıklı**dır. Yaklaşık 100 sayfa görüntülemeye karşılık 1 sepet işlemi, 30 sepet işlemine karşılık 1 sipariş düşer (dönüşüm ~%3). Bu oran mimarinin her kararını etkiler: okuma yolunu cache ile ucuzlat, yazma yolunu doğru ve dayanıklı yap.

## 2. Kapasite tahmini

Varsayımlar: 50 M günlük aktif kullanıcı, kullanıcı başına günde 100 sayfa görüntüleme ve 3 yazma (sepet güncelleme, sipariş, yorum); ürün sayfası JSON'u ~20 KB (görseller ayrıca CDN'den), bir yazma kaydı ~2 KB.

- **Okuma QPS** = 50 M × 100 / 86 400 ≈ **58 K**; tepe (×5) ≈ 290 K
- **Yazma QPS** = 50 M × 3 / 86 400 ≈ **1.7 K**; tepe ≈ 8.7 K
- **Günlük yeni veri** = 150 M × 2 KB = 300 GB; 5 yılda ≈ 550 TB, ×3 replika ≈ 1.6 PB
- **Çıkış bant genişliği** = 58 K × 20 KB ≈ 1.2 GB/s — bunun büyük bölümü origin'den değil CDN'den çıkmalı

Sonuç: ~1000 QPS kaldıran uygulama sunucularından tepe için ~300 tane gerekir; ama cache isabet oranı %90 olursa veritabanına yalnızca ~30 K QPS iner. Rakamların kendisi değil, **hangi katmanın ölçeklenmesi gerektiğini göstermesi** önemlidir.

:::interactive{type="capacity-estimator" dau=50000000 readsPerUserPerDay=100 writesPerUserPerDay=3 avgWriteSizeBytes=2000 avgReadSizeBytes=20000 peakMultiplier=5 hotDataRatio=0.2 replicationFactor=3}
DAU'yu 5 M'ye düşürüp 500 M'ye çıkarın; hangi büyüklükler doğrusal artıyor? Tepe çarpanını 20'ye çekip Black Friday senaryosunda kaç uygulama sunucusu gerektiğine bakın.
:::

## 3. Yüksek seviye mimari

:::diagram{src="diagram.svg" alt="E-ticaret mimarisi: CDN ve WAF, yük dengeleyici, API gateway, yedi alan servisi, her servisin kendi veri deposu ve Kafka olay omurgası|E-commerce architecture: CDN and WAF, load balancer, API gateway, seven domain services, a data store per service and a Kafka event backbone"}
Her servis kendi veri deposuna sahiptir (database-per-service); servisler arası senkron çağrılar gateway üzerinden, asenkron akış Kafka üzerinden gider.
:::

Mimari dört katmandan oluşur: **edge** (CDN, WAF, TLS sonlandırma), **giriş** (L4/L7 yük dengeleyici ve API gateway), **alan servisleri** (her biri bağımsız ölçeklenir ve deploy edilir) ve **veri katmanı** (her servisin iş yüküne uygun depo). Servisleri birbirine bağlayan omurga Kafka'dır: sipariş oluşturulunca e-posta, depo, analitik ve arama indeksleyici aynı olayı bağımsız tüketir.

## 4. Bileşenlerin derinleştirilmesi

### Ürün kataloğu
Okuma ağırlıklı, nadiren değişir. Ürün verisi belge biçiminde (DynamoDB/MongoDB) tutulur ve CDN → Redis → DB olmak üzere üç katmanlı cache'lenir. Sık değişen alanlar (fiyat, stok) kataloğa gömülmez; ürün sayfası servisi bunları kısa TTL'li ayrı çağrılarla **kompoze** eder. Böylece 10 K ürünün fiyatı değişince milyonlarca cache girdisini geçersiz kılmanız gerekmez.

### Sepet
Burada en kritik gereksinim erişilebilirliktir — Amazon'un 2007 Dynamo makalesinin çıkış noktası budur. Anahtar `userId`, değer sepet belgesidir; AP tercihli key-value deposunda tutulur. İki cihazdan aynı anda eklenen ürünler çakışırsa **birleştirilir** (union): "yanlışlıkla silmek yerine fazladan ürün göstermek" bilinçli bir iş kararıdır. Misafir sepeti çerezde tutulur, girişte kullanıcının sepetiyle birleştirilir.

### Sipariş servisi
Sipariş bir durum makinesidir: `CREATED → RESERVED → PAID → CONFIRMED → SHIPPED` (ya da `CANCELLED`). İlişkisel bir veritabanında `user_id`'ye göre shard'lanır; her geçiş bir transaction'dır. Diğer servislerle **saga** kalıbıyla konuşur: envanteri rezerve et → ödemeyi al → onayla; herhangi bir adım başarısızsa telafi işlemleri çalışır (rezervasyonu serbest bırak, ödemeyi iade et).

### Envanter
Oversell problemi tek satırlık bir koşullu güncelleme ile çözülür: `UPDATE inventory SET available = available - 1 WHERE sku = ? AND available >= 1`. Etkilenen satır sayısı 0 ise stok yoktur. Rezervasyonun 10 dakikalık TTL'i vardır; ödeme gelmezse stok geri döner. Çok talep gören tek bir SKU (konsol lansmanı gibi) aynı satırda kilit kuyruğu oluşturur; çözüm stoku N kovaya bölmek ya da o SKU'nun isteklerini tek işçili bir kuyruğa almaktır.

### Ödeme
Bir ödeme sağlayıcısı (Stripe, Adyen) ile iki aşamalı çalışır: **authorize** (blokaj) ve **capture** (çekim). İstemci timeout sonrası yeniden denediğinde çift çekim olmaması için her istekte **idempotency key** taşınır. Kart verisi hiç bizim sistemimize girmez (tokenizasyon, PCI-DSS kapsamını daraltır). Ödeme sağlayıcısı dış ve yavaş bir bağımlılıktır: 3 s timeout + circuit breaker şarttır.

### Arama
Katalog veritabanındaki değişiklikler **CDC** (change data capture) ile Kafka'ya, oradan Elasticsearch/OpenSearch'e akar: ters indeks, facet'ler, yazım düzeltme, sıralama. Yeni ürünün aramada 1–2 saniye sonra görünmesi kabul edilebilir — eventual consistency'nin bilinçli kullanıldığı yer burasıdır.

### Öneri
İki aşamalıdır. **Çevrimdışı**: gece çalışan batch iş, item-to-item collaborative filtering ile her ürün için "benzer ürünler" listesini hesaplar ve key-value deposuna yazar. **Çevrimiçi**: ürün sayfası `recs:{productId}` anahtarını milisaniyede okur, oturumdaki son gezilen ürünlerle karıştırır. Öneri servisi düşerse sayfa yine açılır, yalnızca o kutu boş kalır (graceful degradation).

:::code{lang="ts" title="Checkout saga: idempotency anahtarı + koşullu envanter rezervasyonu"}
```ts
interface CheckoutCmd { idempotencyKey: string; userId: string; items: { sku: string; qty: number }[] }

export async function checkout(cmd: CheckoutCmd, deps: Deps): Promise<Order> {
  // 1) Aynı anahtarla daha önce işlendiyse aynı sonucu döndür (çift sipariş yok)
  const prior = await deps.orders.findByIdempotencyKey(cmd.idempotencyKey);
  if (prior) return prior;

  const order = await deps.orders.create({ ...cmd, status: 'CREATED' });
  const reserved: string[] = [];
  try {
    // 2) Her kalem için koşullu güncelleme: stok yoksa 0 satır etkilenir
    for (const it of cmd.items) {
      const ok = await deps.inventory.reserve(it.sku, it.qty, order.id, { ttlSec: 600 });
      if (!ok) throw new OutOfStock(it.sku);
      reserved.push(it.sku);
    }
    await deps.orders.transition(order.id, 'RESERVED');

    // 3) Ödeme: aynı idempotency anahtarı PSP'ye de gider
    const auth = await deps.payments.authorize(order.total, { idempotencyKey: cmd.idempotencyKey, timeoutMs: 3000 });
    await deps.orders.transition(order.id, 'PAID', { paymentId: auth.id });

    // 4) Outbox: olay aynı transaction içinde yazılır, ayrı bir işçi Kafka'ya taşır
    await deps.outbox.append({ type: 'OrderConfirmed', orderId: order.id });
    return deps.orders.transition(order.id, 'CONFIRMED');
  } catch (err) {
    // Telafi (compensation): rezervasyonları bırak, siparişi iptal et
    await Promise.all(reserved.map((sku) => deps.inventory.release(sku, order.id)));
    await deps.orders.transition(order.id, 'CANCELLED', { reason: String(err) });
    throw err;
  }
}
```
```sql
-- inventory.reserve'in çekirdeği: kilitsiz, atomik, oversell'e kapalı
UPDATE inventory
   SET available = available - :qty, reserved = reserved + :qty
 WHERE sku = :sku AND available >= :qty;
-- etkilenen satır = 0 → stok yok
```
:::

## 5. Darboğazlar ve çözümler

| Darboğaz | Belirti | Çözüm |
|---|---|---|
| Sıcak SKU | Tek envanter satırında kilit kuyruğu, p99 patlar | Stoku kovalara böl, kuyruk + tek işçi, kullanıcıya "yaklaşık stok" göster |
| Ürün sayfası fan-out | Bir sayfa = 8 servis çağrısı | Aggregator/BFF, paralel çağrı, kısmi yanıtla devam et |
| Sipariş DB yazması | Tek lider doygunluğa ulaşır | `user_id`'ye göre shard; yan etkileri outbox + Kafka ile asenkronlaştır |
| Cache stampede | TTL dolunca binlerce istek DB'ye iner | Request coalescing, rastgele TTL dağılımı, stale-while-revalidate |
| Yavaş ödeme sağlayıcısı | Checkout gecikmesi dışarıya bağımlı | Timeout, circuit breaker, "siparişiniz alındı, ödeme onayı bekleniyor" durumu |
| Black Friday dalgası | Normalin 10–20 katı istek | Önceden ölçekleme, kuyruklu checkout, sanal bekleme odası |

## 6. İstek yolculuğu: "Satın al" tıklaması

Aşağıdaki animasyon tek bir checkout isteğinin tarayıcıdan veritabanına gidip geri dönüşünü katman katman izler. Her düğüm ayrı bir ölçekleme birimidir; mülakatta "bu istek nereden geçer?" sorusuna bu sırayla cevap verin.

:::animation{scene="scene.json"}
Tarayıcı → CDN → LB → API gateway → sipariş servisi → envanter → ödeme → veritabanı → outbox/Kafka → yanıt.
:::

## 7. Black Friday: trafik dalgası altında

Tepe trafik üç mekanizma ile karşılanır: **autoscaling** (CPU/istek sayısına göre yeni pod'lar), **kuyruk** (checkout isteklerini envanterin kaldırabileceği hızda işlemek için tampon) ve **envanter rezervasyonu** (kuyruktan çıkan her istek koşullu güncelleme ile stok alır; stok bitince kalan istekler anında "tükendi" yanıtı alır).

:::animation{scene="black-friday.scene.json"}
Trafik dalgası → autoscaler yeni pod'lar açar → checkout kuyruğa alınır → işçiler envanteri rezerve eder → stok biter → dalga çekilir.
:::

:::interactive{type="traffic-wave" baselineRps=5000 peakMultiplier=12 rampSeconds=60 autoscale=true scaleUpDelaySeconds=90 queueEnabled=true}
Önce autoscaling'i kapatıp dalgayı gönderin: hata oranı ne oluyor? Sonra autoscaling'i açın ama ölçekleme gecikmesini 3 dakikaya çıkarın. Son olarak kuyruğu etkinleştirin ve gecikme ile hata oranının nasıl takas edildiğini gözlemleyin.
:::

:::interactive{type="request-journey" preset="ecommerce-checkout" layers="browser,cdn,lb,gateway,service,cache,db" showLatency=true}
Her katmanın gecikmesini değiştirin ve toplam p99'un hangi katmana en duyarlı olduğunu bulun; cache isabet oranını %0'a çekince DB'ye düşen yükü izleyin.
:::

:::realworld{company="Amazon"}
Amazon'un alışveriş sepeti, 2007'de yayımlanan **Dynamo** makalesinin ana motivasyonuydu: "Müşteri sepetine ürün ekleyebilmeli — disk bozulsa, ağ bölünse, veri merkezi kasırgaya tutulsa bile." Bu yüzden sepet için her zaman yazılabilir (always-writeable) bir depo tasarlandı; çakışan sürümler vektör saatleriyle saptanıp uygulama katmanında birleştirildi. Aynı felsefe bugün DynamoDB olarak sunuluyor. Prime Day 2024'te DynamoDB tek bir günde zirvede saniyede **146 milyon** isteği karşıladı; sipariş ve ödeme tarafı ise güçlü tutarlılık gerektirdiği için ilişkisel depolar ve saga/outbox kalıplarıyla çalışır. Amazon'un "her servis kendi verisine sahiptir, başka servisin tablosuna doğrudan erişemez" kuralı (2002 Bezos API bildirisi) bu mimarinin temelidir.
:::

:::callout{tone="tip" title="Mülakat ipuçları"}
- İlk 5 dakikayı gereksinimlere ayırın; **okuma/yazma oranını** ve **hangi parçanın güçlü tutarlılık istediğini** açıkça söyleyin. Bu iki cümle, sonraki her kararınızı gerekçelendirir.
- Envanter sorusu geldiğinde "kilit alırım" demeyin; **koşullu güncelleme + TTL'li rezervasyon** deyin, sıcak SKU için kova/kuyruk fikrini ekleyin.
- Ödeme için ilk ağzınızdan çıkan kelime **idempotency** olsun; ikinci kelime circuit breaker.
- Black Friday sorulunca üçlüyü sayın: autoscaling tek başına yetmez (ısınma süresi), kuyruk + bekleme odası + önceden ölçekleme gerekir.
- "Bu sistemde neyi bilinçli olarak eventual bıraktınız?" sorusuna hazır olun: arama indeksi, öneriler, yorum sayıları.
:::

:::quiz{src="quiz.json"}
:::

:::next{lesson="e-02-video-streaming"}
Sırada: yazma yolu bir video dosyası olduğunda ne değişir? Upload, transcoding, CDN ve adaptive bitrate ile Netflix/YouTube vakası.
:::

---
id: j-09-takip-bildirim-ve-kampanyalar
slug: takip-bildirim-ve-kampanyalar
module: j-system-design-notes
order: 9
title:
  tr: "Yemek Siparişi Platformu: Gerçek Zamanlı Takip, Bildirim ve Kupon Sistemleri"
  en: "Food Delivery Platform: Real-Time Tracking, Notification and Coupon Systems"
summary:
  tr: "Canlı sipariş takibi, güvenilir bildirim gönderimi ve kupon doğrulama sistemlerini tasarlamayı öğren."
  en: "Learn to design live order tracking, reliable notification delivery and coupon validation systems."
durationMinutes: 22
level: intermediate
tags: [system-design, food-delivery, real-time, notifications, promotions]
prerequisites: [j-08-sepet-odeme-ve-kurye-atama, e-03-twitter-timeline]
concepts: [websocket, server-sent-events, pubsub, eta, exponential-backoff, dead-letter-queue, coupon-validation]
---

## 11. Gerçek zamanlı takip sistemi

### Amaç

- Kullanıcılara gerçek zamanlı sipariş takibi sağlamak.
- Kuryenin canlı konumunu göstermek.
- Her aşamada sipariş durumunu güncellemek.
- Düşük gecikme ve yüksek doğruluk sağlamak.
- Milyonlarca eşzamanlı kullanıcıyı kaldırmak.

### Temel gereksinimler

- Gerçek zamanlı konum güncellemeleri (5–10 saniyede bir)
- Düşük gecikme (2 saniyenin altında)
- Yoğun saatlerde ölçeklenebilirlik
- Doğru ETA hesaplaması
- Durum değişikliklerinde bildirim
- Ağ hatalarını yönetme (çevrimdışı destek)
- Güvenli ve kimliği doğrulanmış güncellemeler

### Yüksek seviye akış

1. Kurye konumunu gönderir.
2. Konum veritabanında / önbellekte saklanır.
3. Konum WebSocket / PubSub ile kullanıcılara yayınlanır.
4. ETA, harita servisiyle hesaplanır.
5. Kullanıcı uygulaması canlı takibi ve ETA'yı gösterir.

### Sistem mimarisi

| Bileşen | Görevi |
|---|---|
| Tracking Service | Konum güncellemelerini işler |
| Order Service | Sipariş durumunu yönetir |
| Notification Service | Push / uygulama içi bildirim |
| Redis | Gerçek zamanlı konum önbelleği |
| Database (PostgreSQL/MySQL) | Sipariş ve konum geçmişi |
| WebSocket / PubSub | Kullanıcılara gerçek zamanlı güncelleme |
| Map Service (Google Maps) | Mesafe ve ETA |

### Konum güncelleme verisi (kuryeden)

:::code{lang="json"}
```json
{
  "order_id": "ORD12345",
  "partner_id": "DP678",
  "latitude": 41.0082,
  "longitude": 28.9784,
  "timestamp": "2026-09-16T12:30:00Z",
  "speed": 30,
  "status": "IN_TRANSIT"
}
```
:::

Kurye uygulaması bu veriyi her 5–10 saniyede bir gönderir.

### Takip cevabı (kullanıcıya)

:::code{lang="json"}
```json
{
  "order_id": "ORD12345",
  "status": "OUT_FOR_DELIVERY",
  "partner": {
    "name": "Rahul",
    "phone": "+90-5XX-XXX-XX-XX",
    "current_location": { "lat": 41.0082, "lng": 28.9784 }
  },
  "eta_minutes": 12
}
```
:::

Gerçek zamanlı veri kullanıcıya WebSocket veya polling ile gönderilir.

### WebSocket, polling ve SSE

| Yöntem | Nasıl çalışır? | Avantaj | Dezavantaj |
|---|---|---|---|
| Polling | İstemci her X saniyede "yeni bir şey var mı?" diye sorar | Çok basit | Gereksiz istek, gecikme |
| Long polling | İstek, yeni veri gelene kadar açık bekler | Polling'den verimli | Sunucuda çok açık bağlantı |
| SSE (Server-Sent Events) | Sunucudan istemciye tek yönlü akış | Basit, HTTP üzerinde | Tek yönlü |
| WebSocket | Kalıcı, çift yönlü bağlantı | En düşük gecikme | Ölçeklemesi ve yönetimi zor |

**PubSub (yayınla-abone ol):** Birden fazla WebSocket sunucusu olduğunda, kurye konumu A sunucusuna gelir ama kullanıcı B sunucusuna bağlıdır. Redis PubSub veya Kafka, mesajı tüm sunuculara dağıtır; ilgili kullanıcıya bağlı olan sunucu iletir.

### Sipariş takip durumları

| Durum | Anlamı |
|---|---|
| PLACED | Sipariş restoran tarafından onaylandı |
| PREPARING | Restoran siparişi hazırlıyor |
| READY | Sipariş alınmaya hazır |
| PICKED_UP | Kurye siparişi aldı |
| OUT_FOR_DELIVERY | Müşteriye doğru yolda |
| DELIVERED | Başarıyla teslim edildi |
| CANCELLED | Sipariş iptal edildi |

### ETA hesaplama

1. Kuryenin güncel konumunu Redis'ten al.
2. Müşterinin konumunu al.
3. Harita servisi API'sini çağır (ör. Google Maps Distance Matrix).
4. Trafik, mesafe ve geçmiş verileri dikkate al.
5. ETA'yı dakika olarak döndür ve periyodik güncelle.

:::code{lang="text"}
```text
ETA = f(mesafe, trafik, geçmiş süre, anlık yük, hava durumu, …)
```
:::

### Zorluklar ve çözümler

| Zorluk | Çözüm |
|---|---|
| Çok fazla konum güncellemesi | Redis + PubSub, WebSocket |
| Ölçeklenebilirlik | Yatay ölçekleme, yük dengeleyiciler |
| Ağ hataları | Yeniden deneme, çevrimdışı önbellek |
| Doğru ETA | Gerçek zamanlı trafik verisi + makine öğrenmesi |
| Sahte konum / dolandırıcılık | GPS doğrulama, sezgisel kurallar |
| Yüksek veritabanı yazma yükü | Redis önbellek, toplu yazma (batch) |
| Çok kullanıcının takibi | PubSub (Redis / Kafka) |

### Ek özellikler

Kurye konumuyla canlı harita, tahmini varış süresi, kuryeyle iletişim (arama/mesaj), her aşamada bildirim, çoklu durak ve toplu siparişler.

### Metrikler

Konum güncelleme gecikmesi, ETA doğruluğu (gerçekleşen ve tahmin), takip API başarı oranı, aktif takip eden kullanıcı sayısı, sistem çalışma süresi ve hata oranı.

:::callout{tone="tip" title="Senin projen için"}
Kargo ile gönderimde canlı GPS gerekmez. Kargo firmasının webhook'unu veya API'sini kullanarak durumları (KARGOYA_VERİLDİ, TRANSFER_MERKEZİNDE, DAĞITIMDA, TESLİM_EDİLDİ) kaydet ve bayiye e-posta/SMS gönder. Sipariş sayfasında basit bir zaman çizelgesi göstermek yeterli. Kendi aracınla dağıtım yaparsan sürücü telefonundan 30–60 saniyede bir konum göndermek yeterli olur.
:::

## 12. Bildirim sistemi

### Hedefler

- Kullanıcıları sipariş durumu hakkında bilgilendirmek.
- Gerçek zamanlı ve güvenilir bildirimler.
- Birden çok kanal: uygulama içi, push, SMS, e-posta.
- Düşük gecikme ve yüksek teslim oranı.
- Yeniden denemeleri ve hataları yönetmek.
- Kişiselleştirilmiş ve ilgili mesajlar.

### Bildirim türleri

| Tür | Açıklama | Örnek |
|---|---|---|
| In-app | Uygulama içinde gösterilir | "Siparişiniz onaylandı" |
| Push | Mobil bildirim (FCM / APNs) | "Yemeğiniz yola çıktı" |
| SMS | Kısa mesaj (yedek kanal) | Doğrulama kodu veya kritik güncelleme |
| E-posta | Önemli güncellemeler | Fatura / makbuz |
| Webhook | Restoran/iş ortağı sistemlerine bildirim | "Sipariş durumu değişti" |

### Mimari

:::diagram{src="sekil-01.png" alt="Bildirim mimarisi: olay kaynakları, Kafka, Notification Service, kanallar ve kullanıcı|Notification architecture: event sources, Kafka, Notification Service, channels and the user"}
:::

- **Push Service:** FCM / APNs
- **SMS Service:** Twilio vb. (Türkiye'de Netgsm, İleti Merkezi gibi)
- **Email Service:** Amazon SES / SendGrid
- **In-app Service:** Bildirimi veritabanına kaydeder

### Sipariş bildirim akışı

| # | Olay | Gönderilen bildirim |
|---|---|---|
| 1 | Sipariş verildi | "Siparişiniz onaylandı" (push + uygulama içi) |
| 2 | Restoran kabul etti | "Siparişiniz hazırlanıyor" |
| 3 | Sipariş hazır | "Siparişiniz alınmaya hazır" |
| 4 | Yola çıktı | "Siparişiniz yolda" |
| 5 | Yaklaşıyor | "Kurye yakında (5 dk)" |
| 6 | Teslim edildi | "Siparişiniz teslim edildi" |
| 7 | İstisnalar | "Gecikme / iptal / iade" |

### Bildirim olayı örneği

**Kafka olayı:**

:::code{lang="json"}
```json
{
  "event_type": "ORDER_STATUS_CHANGED",
  "order_id": "ORD12345",
  "user_id": "USR67890",
  "status": "OUT_FOR_DELIVERY",
  "timestamp": "2026-09-16T12:35:00Z",
  "metadata": {
    "estimated_delivery": "12:50",
    "delivery_partner_id": "DP456"
  }
}
```
:::

**Uygulama içi bildirim (veritabanı şeması):**

:::code{lang="json"}
```json
{
  "id": "UUID",
  "user_id": "UUID",
  "title": "Siparişiniz yolda",
  "message": "Kurye size doğru geliyor.",
  "type": "ORDER_UPDATE",
  "is_read": false,
  "created_at": "TIMESTAMP"
}
```
:::

### Hata yönetimi

- **Üstel geri çekilme (exponential backoff)** ile yeniden dene: 1 sn, 2 sn, 4 sn, 8 sn...
- Başarısız bildirimleri bir yeniden deneme kuyruğunda sakla.
- Kalıcı hatalar için **Dead Letter Queue (DLQ)** kullan.
- Alternatif kanala geç (ör. push başarısızsa SMS).
- Teslim durumunu izle (gönderildi, teslim edildi, başarısız).
- Hata oranı yükselince alarm ver.

**Exponential backoff neden?** Bir servis aşırı yüklendiği için cevap vermiyorsa, binlerce istemcinin her saniye tekrar denemesi onu tamamen çökertir. Bekleme süresini katlayarak artırmak ve araya rastgele küçük bir fark (jitter) eklemek, yükü yayar.

**Dead Letter Queue:** Belirli sayıda denemeden sonra hâlâ başarısız olan mesajların taşındığı ayrı kuyruktur. Ana kuyruğu tıkamaz; bir geliştirici sonradan inceler.

### Idempotency ve tekrarları önleme

- Benzersiz anahtar kullan: `order_id + status + channel`.
- Aynı durum için birden çok olay gelse de tekrar bildirim gönderme.
- Bildirim geçmişini veritabanında/Redis'te sakla.
- Olay yayınlarken idempotency anahtarı kullan.

Kullanıcıya aynı "Siparişiniz yolda" bildiriminin üç kez gelmesi güveni zedeler.

### Metrikler

Bildirim teslim başarı oranı, push/SMS/e-posta açılma oranı, ortalama teslim gecikmesi, kanala göre hata oranı, yeniden deneme sayısı, kullanıcı etkileşimi (bildirime tıklama).

### En iyi uygulamalar

- Sadece ilgili ve zamanında bildirim gönder.
- Kullanıcının bildirim tercihlerini yönetmesine izin ver.
- Mesajları kısa ve net tut.

:::callout{tone="tip" title="Senin projen için"}
Toptan satışta en önemli kanallar e-posta (sipariş onayı, fatura, kargo takip numarası) ve WhatsApp/SMS'tir (ödeme hatırlatma, kargo çıkışı). Push bildirim şimdilik gerekmez. Bildirimleri bir notifications tablosuna kaydedip arka plan işçisiyle göndermek, e-posta servisi geçici olarak çökse bile hiçbir bildirimin kaybolmamasını sağlar. Ticari ileti göndermek için İYS (İleti Yönetim Sistemi) kaydı ve izin gerektiğini unutma.
:::

## 13. Kupon ve kampanya sistemi

### Hedefler

- Yeni kullanıcı kazanmak ve mevcutları elde tutmak.
- Sipariş sıklığını ve ortalama sepet tutarını artırmak.
- Birden çok kampanya türünü desteklemek (sabit, yüzde, ücretsiz teslimat, cashback).
- Uygunluk, geçerlilik ve dolandırıcılık önleme sağlamak.
- Kişiselleştirilmiş kampanyalar sunmak.

### Kampanya türleri

1. Sabit indirim (ör. 100 TL indirim)
2. Yüzde indirim (ör. %20 indirim)
3. Ücretsiz teslimat
4. Cashback (ör. %10, en fazla 50 TL)
5. Banka kampanyaları (belirli bankanın kartıyla)
6. İlk sipariş kampanyaları
7. Bayram / sezon kampanyaları

### Temel özellikler

- Kupon kodu (ör. ZOMATO100)
- Kampanya türü (sabit / yüzde)
- İndirim değeri
- Minimum sipariş tutarı (MOV — Minimum Order Value)
- Maksimum indirim sınırı
- Geçerlilik süresi (başlangıç ve bitiş tarihi)
- Geçerli restoranlar / şehirler
- Kullanıcı uygunluğu (yeni / mevcut)
- Kullanım limitleri (kullanıcı başına / toplam)
- Birleştirme kuralları (diğer kuponlarla birlikte kullanılabilir mi?)

### Mimari

İstemciler (mobil, web, restoran uygulaması) → API Gateway → **Offer Service**. Offer Service; kuponu doğrular, uygunluğu kontrol eder, indirimi hesaplar, kullanımı takip eder ve siparişe uygular. User Service'ten kullanıcı segmentini alır; Offer DB'de (PostgreSQL) kampanyaları saklar, Redis'te aktif kampanyaları önbelleğe alır, Analytics Service ile kullanım ve dönüşümü izler.

### Örnek kampanya verisi

:::code{lang="json"}
```json
{
  "code": "ZOMATO100",
  "type": "FLAT_DISCOUNT",
  "value": 100,
  "min_order_value": 299,
  "max_discount": 100,
  "start_date": "2026-09-01T00:00:00Z",
  "end_date": "2026-09-30T23:59:59Z",
  "applicable_cities": ["DEL", "BLR", "MUM"],
  "applicable_restaurants": "ALL",
  "user_eligibility": "NEW_USER",
  "usage_limit_per_user": 1,
  "total_usage_limit": 100000,
  "is_active": true
}
```
:::

Kampanya kuralları kodda değil, veritabanında yapılandırma olarak saklanır. Böylece pazarlama ekibi yeni kampanyayı geliştirici olmadan açabilir.

### Kupon doğrulama akışı

1. Kullanıcı kupon kodunu uygular.
2. Kampanya var mı ve aktif mi kontrol edilir.
3. Tarih doğrulanır (süresi dolmamış mı).
4. Kullanıcı uygunluğu kontrol edilir (yeni/mevcut, segment).
5. Minimum sipariş tutarı doğrulanır.
6. Kullanım limitleri kontrol edilir (kullanıcı başına ve toplam).
7. Geçerli şehir / restoran kontrol edilir.
8. İndirim hesaplanır ve uygulanır.
9. Başarı veya hata mesajı döner.

**Doğrulama hata örnekleri:** "Geçersiz kupon kodu", "Kampanyanın süresi doldu", "Minimum sipariş tutarı karşılanmadı", "Bu restoranda geçerli değil", "Kullanım limiti aşıldı", "Bu kampanya için uygun değilsiniz".

### İndirim hesaplama

| Tür | Formül |
|---|---|
| Sabit indirim | indirim = min(kampanya_değeri, sipariş_tutarı − teslimat_ücreti) |
| Yüzde indirim | indirim = min(sipariş_tutarı × p / 100, maks_indirim) |
| Ücretsiz teslimat | teslimat_ücreti = 0 |
| Cashback | cashback = min(sipariş_tutarı × p / 100, maks_cashback) |

Örnek: 600 TL'lik siparişte %20 indirim, en fazla 100 TL:

:::code{lang="text"}
```text
indirim = min(600 × 20 / 100, 100) = min(120, 100) = 100 TL
```
:::

`min` fonksiyonu, indirimin sipariş tutarını veya belirlenen sınırı aşmasını engeller.

### Veritabanı şeması

**offers:** id (UUID, PK), code, type, value, min_order_value, max_discount, start_date, end_date, applicable_cities, applicable_restaurants, user_eligibility, usage_limit_per_user, total_usage_limit, is_active.

**user_offer_usage:** id (UUID, PK), user_id (FK), offer_id (FK), order_id (FK), used_at.

`user_offer_usage` tablosu, "bu kullanıcı bu kuponu kaç kez kullandı?" sorusunu cevaplar. Toplam limit için eşzamanlı kullanıma dikkat edilmelidir; aksi hâlde 100.000 limitli kupon aynı anda gelen isteklerle 100.050 kez kullanılabilir:

:::code{lang="sql"}
```sql
UPDATE offers
SET used_count = used_count + 1
WHERE id = $1 AND used_count < total_usage_limit
RETURNING id;   -- satır dönmezse limit dolmuştur
```
:::

### Kötüye kullanım ve dolandırıcılık önleme

- Kullanıcı başına kullanımı sınırla (ör. 1 kez).
- Cihaz parmak izi (device fingerprinting).
- Kupon paylaşımını hesap düzeyinde doğrulama ile önle.
- Şüpheli aktiviteleri izle (aynı kişinin birden çok hesabı).
- Doğrulama API'sine rate limit uygula (kod deneme saldırılarına karşı).
- Kötüye kullanım kalıplarını kara listeye al.
- İleri seviyede makine öğrenmesi / sezgisel kurallarla dolandırıcılık tespiti.

:::callout{tone="info"}
Aynı kullanıcı kuponu birden fazla kez kullanamamalı.
:::

### Metrikler

Kupon kullanım sayısı, dönüşüm oranı (kampanya gösterildi → kullanıldı), gelir etkisi, sipariş sıklığındaki artış, ortalama sipariş tutarı (AOV — Average Order Value), kampanya sonrası kullanıcı tutma oranı, sahte kullanım oranı.

:::callout{tone="tip" title="Senin projen için"}
Toptan satışta en etkili kampanyalar kupon kodundan çok kademeli indirimlerdir: "10 koli üzeri %5, 50 koli üzeri %10", "5.000 TL üzeri kargo bedava", "Ramazan öncesi kuru meyve kampanyası". Aynı offers tablosu yapısına type = 'TIERED_QUANTITY' türü eklenerek kurulabilir. İlk siparişe özel bayi kuponu yeni bayi kazanmak için iyi bir başlangıçtır.
:::

## Dene: bildirim fan-out

:::interactive{type="fan-out" mode="hybrid" avgFollowers=200 celebrityThreshold=5000}
Kampanya bildiriminin milyonlarca kullanıcıya dağıtımında push (yazarken) ve pull (okurken) modellerini karşılaştır; ünlü hesap eşiğini değiştir.
:::

:::callout{tone="info" title="İlgili dersler"}
Bu konuyu başka bir açıdan anlatan dersler:

- [Twitter/X Timeline Fan-out vaka çalışması](/lessons/e-03-twitter-timeline)
:::

:::quiz{src="quiz.json"}
:::

:::next{lesson="j-10-sadakat-olcekleme-ve-en-iyi-uygulamalar"}
:::

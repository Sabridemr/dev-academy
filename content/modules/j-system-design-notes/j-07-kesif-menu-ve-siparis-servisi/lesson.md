---
id: j-07-kesif-menu-ve-siparis-servisi
slug: kesif-menu-ve-siparis-servisi
module: j-system-design-notes
order: 7
title:
  tr: "Yemek Siparişi Platformu: Restoran Keşfi, Menü ve Sipariş Servisi"
  en: "Food Delivery Platform: Restaurant Discovery, Menu and Order Service"
summary:
  tr: "Elasticsearch ve Redis ile restoran arama, restoran ve menü servisinin veri modeli ve önbellek stratejisi, sipariş servisinin durum makinesi, Saga ve Outbox desenleri."
  en: "Restaurant search with Elasticsearch and Redis, the restaurant and menu service data model and caching strategy, and the order service state machine with the Saga and Outbox patterns."
durationMinutes: 14
level: intermediate
tags: [system-design, food-delivery, search, caching, order-service]
prerequisites: []
concepts: [elasticsearch, cache-aside, ttl, state-machine, saga-pattern, outbox-pattern, idempotency]
---

## 5. Restoran keşfi ve arama

### Hedefler

- Kullanıcının konumuna göre ilgili restoranları göstermek.
- Hızlı, doğru ve kişiselleştirilmiş sonuç vermek.
- Mutfak, puan, teslimat süresi, fiyat ve kampanya filtreleri sunmak.
- Yoğun trafikte düşük gecikme sağlamak (200 ms altı).
- Sadece açık olan ve kullanıcının adresine teslimat yapan restoranları göstermek.

### Arama özellikleri

- Konuma göre arama ("yakınımdakiler")
- Mutfak ve kategori filtreleri
- Sıralama: puan, mesafe, teslimat süresi, fiyat
- Restoran veya yemek adıyla arama
- Kampanya ve indirimleri gösterme
- Sayfalama (pagination) veya sonsuz kaydırma (infinite scroll)
- Sadece açık restoranlar
- Kişiselleştirilmiş öneriler

### Mimari

:::diagram{src="sekil-01.png" alt="Arama mimarisi: Mobil uygulama, API Gateway, Search Service ve Elasticsearch"}
:::

| Bileşen | Görevi |
|---|---|
| Search Service | Otomatik tamamlama ve sonuç sıralama |
| User Service | Konum ve kullanıcı tercihleri |
| Restaurant Service | Restoran verileri |
| Elasticsearch / OpenSearch | Restoran indeksi; tam metin ve coğrafi konum araması |
| Redis | Sık yapılan sorguların ve popüler restoranların önbelleği |
| PostgreSQL / MySQL | Restoran verisinin asıl kaynağı (source of truth) |

**Neden Elasticsearch?** PostgreSQL'de "pizza" kelimesini 10 milyon satır içinde, yazım hatalarını tolere ederek, 5 km yarıçapla ve puana göre sıralı aramak yavaştır. Elasticsearch bu iş için tasarlanmış bir arama motorudur: ters indeks (inverted index), bulanık arama (fuzzy search) ve coğrafi sorguları çok hızlı yapar.

**Source of truth** kavramı: Asıl veri PostgreSQL'dedir. Elasticsearch ve Redis bu verinin kopyalarını tutar. Kopyalar bozulursa asıl kaynaktan yeniden oluşturulur.

### Arama nasıl çalışır?

1. Kullanıcı uygulamayı açar ve konumunu paylaşır.
2. Uygulama; konum, filtreler ve sıralama seçenekleriyle arama isteği gönderir.
3. Search Service, Elasticsearch'te coğrafi konum ve filtrelerle sorgu yapar.
4. Sonuçlar sıralanır (ilgi, puan, teslimat süresi, kampanyalar).
5. En iyi sonuçlar Redis'e önbelleğe alınır.
6. Restoran ayrıntıları Restaurant Service'ten veya veritabanından alınır.
7. Cevap kullanıcıya döner.

### Arama sorgusu akışı (önbellek mantığı)

:::diagram{src="sekil-02.png" alt="Arama sorgusu akışı: Redis önbellek kontrolü, Elasticsearch sorgusu, sıralama ve Redis'e yazma"}
:::

**TTL (Time To Live):** Önbellekteki verinin ne kadar süre geçerli kalacağıdır. 5–10 dakika sonra veri silinir ve bir sonraki istekte tazesi alınır. Bu, hız ile güncellik arasındaki dengeyi sağlar.

### Sıralama faktörleri (ranking)

- Arama sorgusuyla ilgi (ad, mutfak, yemekler)
- Kullanıcıya uzaklık
- Tahmini teslimat süresi
- Restoran puanı ve yorumlar
- Açık/kapalı durumu
- Aktif kampanyalar
- Kullanıcının geçmiş tercihleri (kişiselleştirme)

### Arama indeksindeki veriler

:::code{lang="json"}
```json
{
  "restaurant_id": "R456",
  "name": "Lezzet Durağı",
  "description": "Ev yemekleri ve ızgara",
  "cuisines": ["Türk", "Izgara"],
  "location": { "lat": 41.0082, "lon": 28.9784 },
  "average_rating": 4.6,
  "total_reviews": 1240,
  "delivery_time": 30,
  "cost_for_two": 450,
  "is_open": true
}
```
:::

### Optimizasyonlar

- Konum araması için **GeoHash** kullan.
- Bölgeye göre en popüler restoranları önbelleğe al.
- Popüler sonuçları önceden hesapla (pre-compute).
- Statik resimler için CDN kullan.
- Arama indeksini asenkron güncelle.
- Yazım hatalarını tolere et (fuzzy search: "pizaa" → "pizza").
- Sayfalama veya sonsuz kaydırma kullan.

:::callout{tone="tip" title="Senin projen için"}
Birkaç yüz ürünlük bir katalogda Elasticsearch'e gerek yok. PostgreSQL'in tam metin araması (tsvector) ve pg_trgm eklentisiyle "zeytinyagi" yazan bayi de "Zeytinyağı" ürününü bulur. Kategori sayfalarını Redis'te 5–10 dakika önbelleğe almak yeterli hız sağlar.
:::

## 6. Restoran ve menü servisi

### Sorumluluklar

- Restoranları sisteme almak (onboarding) ve yönetmek.
- Restoran bilgilerini yönetmek: konum, çalışma saatleri, puan.
- Menü, kategori ve ürünleri yönetmek.
- Ürün stok durumu ve fiyatlarını güncellemek.
- Restoran düzeyindeki kampanya ve indirimleri yönetmek.
- Arama servisine restoran verisi sağlamak.
- Gerçek zamanlı güncellemeleri desteklemek (ör. ürün tükendi).

### Restoran kayıt akışı

:::diagram{src="sekil-03.png" alt="Restoran kayıt akışı: kayıt, belge doğrulama, admin onayı ve yayına alma"}
:::

Notlardaki GST (Hindistan vergi kaydı) ve FSSAI (Hindistan gıda güvenliği ruhsatı), Türkiye'de vergi levhası ve işletme kayıt/gıda belgelerine karşılık gelir.

### Veri modeli (ER diyagramı)

:::code{lang="text"}
```text
User (restoran sahibi) 1 ──── N Restaurant 1 ──── N Menu 1 ──── N MenuItem N ──── 1 Category
```
:::

| Tablo | Alanlar |
|---|---|
| User | user_id (PK), name, email, phone, role, created_at |
| Restaurant | restaurant_id (PK), owner_id (FK), name, description, address, location (lat, long), cuisine_type, rating, status (ACTIVE/INACTIVE), created_at, updated_at |
| Menu | menu_id (PK), restaurant_id (FK), name (ör. Ana Menü), description, is_active, created_at |
| MenuItem | item_id (PK), menu_id (FK), name, description, price, image_url, is_veg, is_available, preparation_time, category_id (FK), created_at, updated_at |
| Category | category_id (PK), name (ör. Pide, Pizza), image_url, is_active, created_at |

İlişkiler: Bir sahibin birden çok restoranı olabilir; bir restoranın birden çok menüsü (kahvaltı, öğle, akşam) olabilir; her menüde birden çok ürün vardır. Her ürün bir kategoriye aittir.

**PK (Primary Key):** Satırı benzersiz tanımlayan alan. **FK (Foreign Key):** Başka tablodaki satıra referans veren alan.

### Menü ürünü örneği

:::code{lang="json"}
```json
{
  "item_id": "ITM123",
  "name": "Paneer Butter Masala",
  "description": "Kremalı ve yoğun paneer köri",
  "price": 280,
  "image_url": "https://.../paneer.jpg",
  "is_veg": true,
  "is_available": true,
  "preparation_time": 20,
  "category": "North Indian"
}
```
:::

Menü ürünleri çok sık okunur ama nadiren değişir; bu yüzden Redis ile önbelleğe alınır.

### Temel API'ler

| Metot | Endpoint | Açıklama |
|---|---|---|
| POST | /restaurants | Yeni restoran kaydı |
| GET | /restaurants/{id} | Restoran ayrıntıları |
| PUT | /restaurants/{id} | Restoran bilgisi güncelleme |
| GET | /restaurants/{id}/menu | Menüyü ürünleriyle getir |
| POST | /menu | Yeni menü oluştur |
| POST | /menu/{id}/items | Menüye ürün ekle |
| PUT | /items/{id} | Ürün güncelle (fiyat, stok durumu) |
| GET | /restaurants/search | Restoran arama (arama servisi kullanır) |

### Önbellek stratejisi

- Restoran ayrıntılarını ve menüyü Redis'te tut.
- TTL: 5–15 dakika.
- Menü veya ürün güncellenince önbelleği geçersiz kıl (cache invalidation).
- **Cache-aside** desenini kullan.
- Popüler restoranlara daha uzun TTL ver.
- Menü verisini küçük tut (sadece gerekli alanlar).
- Kafka olaylarıyla arama servisindeki önbelleği de güncelle.

**Cache-aside deseni nasıl çalışır?**

:::code{lang="text"}
```text
1. Uygulama önce Redis'e bakar.
2. Veri varsa (cache hit) → doğrudan döner.
3. Yoksa (cache miss) → veritabanından okur, Redis'e yazar, döner.
4. Veri güncellenince → veritabanına yazar, Redis'teki kaydı siler.
```
:::

:::code{lang="javascript"}
```javascript
async function getMenu(restaurantId) {
  const key = `menu:${restaurantId}`;
  const cached = await redis.get(key);
  if (cached) return JSON.parse(cached);

  const menu = await db.query('SELECT ... WHERE restaurant_id = $1', [restaurantId]);
  await redis.set(key, JSON.stringify(menu), 'EX', 600);  // 10 dakika
  return menu;
}
```
:::

:::callout{tone="info"}
"Bilgisayar biliminde iki zor şey vardır: önbelleği geçersiz kılmak ve bir şeye isim vermek." Önbellek hızlıdır ama bayat (stale) veri gösterme riski taşır.
:::

### Ürün stok durumunu yönetme

- Restoran bir ürünü mevcut / tükendi olarak işaretleyebilir.
- Değişiklik uygulamada anında görünmeli.
- Güncellemeler Kafka ile arama ve diğer servislere iletilir.
- Değişiklikler için denetim kaydı (audit log) tutulur.
- Restoran kapanınca ürünler otomatik olarak satışa kapanır.

### Ek özellikler

Çalışma saatleri, çoklu şube, resimli zengin menü, ürün özelleştirme (ek malzeme), restoran düzeyinde kampanyalar, puan ve yorumlar, menü versiyonlama ve ürünler için **soft delete** (silmek yerine `is_deleted = true` işaretlemek; eski siparişler bozulmaz).

:::callout{tone="tip" title="Senin projen için"}
Restoran yerine tedarikçi veya kendi depon, menü yerine ürün kataloğu düşünülebilir. Category → Product → Variant (250 g, 1 kg, 5 L) yapısı kullan. Variant, menü ürünlerindeki "boyut seçimi"nin karşılığıdır. Ürün silinmesin, is_active = false yapılsın; geçmiş faturalar bozulmaz.
:::

## 7. Sipariş servisi

### Sorumluluklar

- Müşteri siparişlerini oluşturmak ve yönetmek.
- Sipariş durumunu ve geçmişini tutmak.
- Ödeme, restoran ve teslimat arasında tutarlılığı sağlamak.
- İptal, iade ve hataları yönetmek.
- Gerçek zamanlı sipariş durumu sağlamak.
- Diğer servisler için Kafka'ya olay yayınlamak.
- Idempotency ile çift siparişi engellemek.

### Sipariş yaşam döngüsü (state machine)

:::diagram{src="sekil-04.png" alt="Sipariş yaşam döngüsü: CREATED durumundan DELIVERED durumuna geçişler"}
:::

- Ödeme başarısız olursa veya kullanıcı iptal ederse: → **CANCELLED**
- Restoran reddederse veya kurye iptal ederse: → **CANCELLED**

**State machine (durum makinesi)**, bir nesnenin hangi durumlarda olabileceğini ve hangi durumdan hangisine geçebileceğini tanımlar. Örneğin `DELIVERED` olan bir sipariş tekrar `PREPARING` olamaz. Bu kurallar kodda açıkça tanımlanmalıdır:

:::code{lang="javascript"}
```javascript
const transitions = {
  CREATED:             ['PAYMENT_PENDING', 'CANCELLED'],
  PAYMENT_PENDING:     ['CONFIRMED', 'CANCELLED'],
  CONFIRMED:           ['RESTAURANT_ACCEPTED', 'CANCELLED'],
  RESTAURANT_ACCEPTED: ['PREPARING', 'CANCELLED'],
  PREPARING:           ['READY'],
  READY:               ['PICKED_UP'],
  PICKED_UP:           ['DELIVERED'],
};

function canTransition(from, to) {
  return transitions[from]?.includes(to) ?? false;
}
```
:::

### Mimari

Order Service merkezdedir. Müşteri, restoran, kurye uygulamaları ve admin portalı API Gateway üzerinden ona ulaşır. Order Service; Payment Service ile çift yönlü konuşur, Restaurant, Delivery ve Notification servislerine bilgi verir ve Kafka'ya olay yayınlar. Verisini PostgreSQL'deki Order DB'de tutar.

### Sipariş tablosu şeması

| Sütun | Tip | Açıklama |
|---|---|---|
| order_id (PK) | UUID | Benzersiz sipariş kimliği |
| user_id (FK) | UUID | Müşteri |
| restaurant_id (FK) | UUID | Restoran |
| status | VARCHAR | Güncel sipariş durumu |
| total_amount | DECIMAL | Toplam tutar |
| payment_id | UUID | Ödeme referansı |
| delivery_partner_id | UUID | Atanan kurye (boş olabilir) |
| created_at | TIMESTAMP | Oluşturulma zamanı |
| updated_at | TIMESTAMP | Son güncelleme |
| cancellation_reason | VARCHAR | İptal nedeni |

**UUID**, tahmin edilemeyen 128 bitlik benzersiz kimliktir (`550e8400-e29b-41d4-a716-446655440000`). Sıralı ID'lere (1, 2, 3) göre avantajı, dağıtık sistemlerde çakışma olmaması ve dışarıdan sipariş sayısının tahmin edilememesidir.

**DECIMAL**, para için doğru tiptir. FLOAT kullanılırsa 0,1 + 0,2 = 0,30000000000000004 gibi yuvarlama hataları oluşur.

### Sipariş oluşturma akışı

1. Kullanıcı sepete ürün ekler ve "Sipariş Ver"e basar.
2. Order Service sepeti, restoranın açık olup olmadığını ve kullanıcı bilgilerini doğrular.
3. Sipariş `CREATED` durumuyla oluşturulur.
4. Payment Service çağrılarak ödeme başlatılır.
5. Ödeme başarılı olunca durum `CONFIRMED` olur ve Restaurant Service bilgilendirilir.
6. Kafka'ya `order-created` olayı yayınlanır.
7. Hata olursa işlemler geri alınır (rollback).

### Idempotency ve tutarlılık

- Idempotency key kullan (ör. user_id + zaman damgası veya benzersiz istek kimliği).
- Siparişi benzersiz kısıtla (unique constraint) kaydet.
- Veritabanı transaction'ları kullan.
- Yeniden denemeleri düzgün yönet.
- Ödemenin sadece bir kez alınmasını sağla.
- Dağıtık tutarlılık için **Saga deseni** kullan (ödeme, restoran, teslimat).
- Olayları veritabanı commit'inden sonra yayınla (**outbox deseni**).

:::callout{tone="info"}
"Aynı istek birden fazla sipariş oluşturmamalı."
:::

### Saga deseni

Mikroservislerde tek bir veritabanı transaction'ı tüm servisleri kapsayamaz. **Saga**, uzun bir işlemi küçük yerel adımlara böler. Bir adım başarısız olursa, önceki adımları geri alan **telafi işlemleri (compensating transactions)** çalışır.

:::code{lang="text"}
```text
Başarılı akış:
  Sipariş oluştur → Ödeme al → Restoran kabul etti → Kurye atandı

Restoran reddederse (telafi):
  Restoran reddetti → Ödemeyi iade et → Siparişi CANCELLED yap → Kullanıcıya bildir
```
:::

İki türü vardır:

- **Choreography:** Her servis olay dinler ve kendi adımını yapar (merkezi yönetici yok).
- **Orchestration:** Merkezi bir orkestratör (ör. Order Service) hangi adımın ne zaman çalışacağını yönetir.

### Outbox deseni

Sorun: Sipariş veritabanına yazıldı ama Kafka'ya olay gönderilmeden sunucu çöktü. Diğer servisler siparişten habersiz kalır.

Çözüm: Olay, siparişle **aynı transaction içinde** bir `outbox` tablosuna yazılır. Ayrı bir süreç bu tabloyu okuyup Kafka'ya gönderir.

:::code{lang="sql"}
```sql
BEGIN;
  INSERT INTO orders (...) VALUES (...);
  INSERT INTO outbox (event_type, payload) VALUES ('order-created', '{...}');
COMMIT;
-- Ayrı bir işçi süreç outbox tablosunu okuyup Kafka'ya yayınlar.
```
:::

Böylece "veritabanına yazıldı ama olay gitmedi" durumu oluşmaz.

### Olası hata senaryoları

| Senaryo | Çözüm |
|---|---|
| Ödeme başarısız | Sipariş oluşturulmaz veya CANCELLED işaretlenir |
| Restoran siparişi reddeder | Ödeme alındıysa iade edilir |
| Kurye bulunamaz | Başka kuryeyle yeniden denenir |
| Kullanıcı iptal eder | Aşamaya göre iade yapılır |
| Servis çöker | Yeniden deneme, kuyruk ve yedek mekanizmalar |

### Yayınlanan Kafka olayları

`order-created`, `order-confirmed`, `order-cancelled`, `order-picked-up`, `order-delivered`, `order-payment-failed`, `order-refunded`, `order-status-updated`.

Kafka servisleri birbirinden ayırır (decoupling) ve gerçek zamanlı güncellemeleri mümkün kılar.

### Temel metrikler ve tasarım ilkeleri

Metrikler: sipariş oluşturma başarı oranı, iptal oranı, ortalama işlem süresi, restoranın kabul süresi.

İlkeler: yüksek erişilebilirlik ve düşük gecikme, ölçeklenebilirlik ve hata toleransı, olay güdümlü mimari, veri tutarlılığı, gerçek zamanlı güncellemeler.

:::callout{tone="tip" title="Senin projen için"}
Toptan satış sipariş durumları: PENDING_PAYMENT → PAID (veya havalede AWAITING_TRANSFER) → PREPARING → SHIPPED → DELIVERED, ayrıca CANCELLED ve REFUNDED. Outbox desenini tek bir uygulamada da kullanabilirsin: sipariş ile "e-posta gönder" görevi aynı transaction'da kaydedilir, böylece onay e-postası asla kaybolmaz.
:::

## Orijinal PDF sayfaları

:::callout{tone="info" title="Özgün görünüm"}
Bu dersin metni *Sistem Tasarimi Yemek Siparisi* PDF dosyasının 8–15. sayfalarının özgün hâlidir; sayfalar aşağıda PDF'teki görünümüyle yer alır.
:::

:::diagram{src="pdf-sayfa-08.png" alt="Sistem Tasarimi Yemek Siparisi - PDF sayfa 8"}
PDF sayfa 8 / 43
:::

:::diagram{src="pdf-sayfa-09.png" alt="Sistem Tasarimi Yemek Siparisi - PDF sayfa 9"}
PDF sayfa 9 / 43
:::

:::diagram{src="pdf-sayfa-10.png" alt="Sistem Tasarimi Yemek Siparisi - PDF sayfa 10"}
PDF sayfa 10 / 43
:::

:::diagram{src="pdf-sayfa-11.png" alt="Sistem Tasarimi Yemek Siparisi - PDF sayfa 11"}
PDF sayfa 11 / 43
:::

:::diagram{src="pdf-sayfa-12.png" alt="Sistem Tasarimi Yemek Siparisi - PDF sayfa 12"}
PDF sayfa 12 / 43
:::

:::diagram{src="pdf-sayfa-13.png" alt="Sistem Tasarimi Yemek Siparisi - PDF sayfa 13"}
PDF sayfa 13 / 43
:::

:::diagram{src="pdf-sayfa-14.png" alt="Sistem Tasarimi Yemek Siparisi - PDF sayfa 14"}
PDF sayfa 14 / 43
:::

:::diagram{src="pdf-sayfa-15.png" alt="Sistem Tasarimi Yemek Siparisi - PDF sayfa 15"}
PDF sayfa 15 / 43
:::

:::next{lesson="j-08-sepet-odeme-ve-kurye-atama"}
:::

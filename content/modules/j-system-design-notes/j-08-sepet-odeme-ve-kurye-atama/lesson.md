---
id: j-08-sepet-odeme-ve-kurye-atama
slug: sepet-odeme-ve-kurye-atama
module: j-system-design-notes
order: 8
title:
  tr: "Yemek Siparişi Platformu: Sepet, Ödeme ve Kurye Atama"
  en: "Food Delivery Platform: Cart, Payment and Courier Assignment"
summary:
  tr: "Güvenli sepet ve ödeme akışını, webhook doğrulamasını ve puanlamayla kurye atamayı tasarlamayı öğren."
  en: "Learn to design a secure cart and payment flow, webhook verification and score-based courier assignment."
durationMinutes: 13
level: intermediate
tags: [system-design, food-delivery, checkout, payments, courier-assignment]
prerequisites: []
concepts: [shopping-cart, price-calculation, payment-gateway, webhook-signature, reconciliation, redis-geo, assignment-algorithm]
---

## 8. Sepet ve ödeme adımı (checkout)

### Amaç

- Kullanıcının bir restorandan sepete ürün eklemesini sağlamak.
- Sepet ürünlerini yönetmek (ekleme, çıkarma, miktar değiştirme).
- Kampanya, vergi ve teslimat ücretiyle son tutarı hesaplamak.
- Sorunsuz ve güvenli bir ödeme adımı sunmak.
- Veri tutarlılığını sağlamak ve sepetin süresinin dolmasını yönetmek.

### Temel özellikler

- Ürün ekleme / çıkarma, miktar güncelleme
- Gerçek zamanlı fiyat hesaplama
- Kupon ve kampanya uygulama
- Teslimat ücreti, vergiler ve toplam tutarı gösterme
- Giriş yapmış kullanıcının sepetini kalıcı tutma
- Sepet süresinin dolması (ör. 30 dakika)
- Restoranın açık olup olmadığını doğrulama

### Mimari

:::diagram{src="sekil-01.png" alt="Sepet mimarisi: Kullanıcı uygulaması, API Gateway, Cart Service ve Redis"}
:::

Cart Service, **Pricing Service**'i çağırır. Pricing Service; Restaurant Service'ten güncel menü fiyatlarını, User Service'ten kullanıcı ve adres bilgisini, Offer Service'ten kupon ve indirimleri alarak toplamı hesaplar.

### Redis'te sepet verisi

:::code{lang="json"}
```json
{
  "user_id": "U123",
  "restaurant_id": "R456",
  "items": [
    {
      "item_id": "ITM1",
      "name": "Margherita Pizza",
      "price": 249,
      "quantity": 2,
      "customizations": ["Extra Cheese"]
    }
  ],
  "created_at": "2026-09-16T10:00:00Z",
  "expiry": "30 mins"
}
```
:::

Sepet Redis'te tutulur çünkü çok sık okunup yazılır ve geçicidir. Redis bellekte çalıştığı için milisaniyeler içinde cevap verir. TTL özelliği sayesinde süresi dolan sepetler kendiliğinden silinir.

### Checkout akışı

1. Kullanıcı sepetteki ürünleri gözden geçirir.
2. Güncel fiyat ve stok durumu alınır.
3. Kampanya ve kuponlar uygulanır (doğrulanarak).
4. Ürün toplamı + vergiler + teslimat ücreti hesaplanır.
5. Son tutar kullanıcıya gösterilir.
6. Kullanıcı ödemeye geçer (UPI / kart / cüzdan).
7. Ödeme başarılı olunca sipariş oluşturulur.
8. Sepet temizlenir (veya "ödendi" olarak işaretlenir).
9. Kullanıcı sipariş takip ekranına yönlendirilir.

### Fiyat hesaplama örneği

| Kalem | Tutar |
|---|---|
| Ürün toplamı | 498 |
| Restoran paketleme ücreti | 20 |
| Teslimat ücreti | 40 |
| Platform ücreti | 10 |
| Vergiler (GST %5) | 28 |
| İndirim (kupon) | −50 |
| **Genel toplam** | **546** |

Fiyat şunlara göre değişebilir: restoran, mesafe, saat (yoğun saatler), aktif kampanyalar, kullanıcı üyeliği (ör. Zomato Gold).

**Kritik kural:** Fiyat her zaman **sunucuda** hesaplanır. Tarayıcıdan gelen fiyata asla güvenilmez; aksi hâlde kötü niyetli biri isteği değiştirip 1 liraya sipariş verebilir.

### Sepet süresinin dolması

- Sepet Redis'te TTL ile tutulur (ör. 30 dakika).
- Kullanıcı hareketsiz kalırsa sepet otomatik olarak silinir.
- Süre dolmadan önce uyarı gösterilir.
- Süresi dolan sepet Redis'ten kaldırılır.

### Uç durumlar (edge cases)

| Durum | Ne yapılır? |
|---|---|
| Ürün tükendi | Mesaj göster ve ürünü sepetten çıkar |
| Fiyat değişti | Güncel fiyatı göster |
| Restoran kapandı | Sepeti bildirimle temizle |
| Kupon geçersiz / süresi dolmuş | Hata göster |
| Birden çok cihaz | Sepeti senkron tut |

### API'ler

| Metot | Endpoint | Açıklama |
|---|---|---|
| POST | /cart/items | Ürün ekle |
| DELETE | /cart/items/{id} | Ürün çıkar |
| PUT | /cart/items/{id} | Miktar güncelle |
| GET | /cart | Sepeti getir |
| POST | /cart/apply-coupon | Kupon uygula |
| GET | /cart/summary | Sepet özeti |
| POST | /checkout | Ödeme adımını başlat |

:::callout{tone="tip" title="Senin projen için"}
Toptan satışta sepet daha uzun yaşamalı; bayi sepeti bugün hazırlayıp yarın onaylayabilir. Giriş yapmış bayi için sepeti PostgreSQL'de kalıcı tut, misafir kullanıcı için Redis'te 7 gün TTL kullan. Fiyat hesaplamaya minimum sipariş miktarı, koli adedi, bayi fiyat seviyesi, KDV (%1 veya %10 gibi gıda oranları) ve kargo ücreti eşiği ("5.000 TL üzeri kargo ücretsiz") eklenmeli.
:::

## 9. Ödeme sistemi

### Hedefler ve gereksinimler

- Birden çok ödeme yöntemi: UPI, kart, cüzdan, internet bankacılığı, kapıda ödeme.
- Güvenli ve güvenilir işlemler.
- Ödeme hataları, yeniden denemeler ve iadeleri yönetme.
- **Idempotency:** Kullanıcıdan iki kez para çekmemek.
- Kullanıcıya gerçek zamanlı ödeme durumu göstermek.
- Mutabakat (reconciliation) için işlem ayrıntılarını saklamak.
- Kampanya, kupon ve kısmi ödemeyi desteklemek (ör. cüzdan + kart).

### Mimari

:::diagram{src="sekil-02.png" alt="Ödeme mimarisi: İstemci, API Gateway, Payment Service ve ödeme altyapısı arasında çift yönlü iletişim"}
:::

- Order Service, sipariş oluşturunca Payment Service'i çağırır ve ödeme durumunu ondan öğrenir.
- Payment Service, ödeme altyapısında ödemeyi başlatır; sonuç **webhook** ile geri gelir.
- Payment DB (PostgreSQL) işlem kayıtlarını, Redis ise geçici durumu ve idempotency anahtarlarını tutar.

### Ödeme akışı (sequence diagram)

| # | Kimden → kime | Mesaj |
|---|---|---|
| 1 | Kullanıcı → Uygulama | Ödemeyi başlat |
| 2 | Uygulama → Payment Service | Ödeme isteği oluştur |
| 3 | Payment Service → Ödeme altyapısı | Tutar ve sipariş ID ile çağrı |
| 4 | Ödeme altyapısı → Payment Service | Ödeme linki / token döner |
| 5 | Payment Service → Uygulama | Ödeme sayfasına yönlendir |
| 6 | Kullanıcı → Ödeme altyapısı | Ödemeyi tamamla (UPI / kart) |
| 7 | Ödeme altyapısı → Payment Service | Webhook (ödeme durumu) |
| 8 | Payment Service → Order Service | Ödeme durumunu güncelle |
| 9 | Order Service | Siparişi onayla |
| 10 | Uygulama → Kullanıcı | Başarı ekranı |

Önemli nokta: Kart bilgisi hiçbir zaman senin sunucuna gelmez. Kullanıcı kart bilgisini doğrudan ödeme altyapısının sayfasına girer. Bu sayede **PCI DSS** (kart verisi güvenlik standardı) yükünün büyük kısmı ödeme sağlayıcısında kalır.

### Ödeme yöntemleri

| Yöntem | Açıklama | Türkiye karşılığı |
|---|---|---|
| UPI | Hindistan'ın anlık ödeme sistemi (GPay, PhonePe, Paytm) | FAST, QR ile ödeme |
| Kredi / banka kartı | Kart ile ödeme | Kart, taksit |
| Net Banking | İnternet bankacılığı | Havale / EFT |
| Wallet | Uygulama içi cüzdan (Zomato Money) | Uygulama içi bakiye |
| COD | Kapıda ödeme | Kapıda nakit / kart |

### Ödeme durumları

:::diagram{src="sekil-03.png" alt="Ödeme durumları: INITIATED, PROCESSING, SUCCESS ve PROCESSING durumundan FAILED durumuna geçiş"}
:::

Tüm uç durumlar yönetilmeli ve sipariş durumu buna göre güncellenmelidir.

### Veritabanı şeması

**payments**

| Sütun | Tip |
|---|---|
| id | UUID (PK) |
| order_id | UUID (FK) |
| user_id | UUID (FK) |
| amount | DECIMAL |
| method | VARCHAR |
| status | VARCHAR |
| transaction_id | VARCHAR |
| gateway_response | JSON |
| created_at / updated_at | TIMESTAMP |

**payment_refunds**

| Sütun | Tip |
|---|---|
| id | UUID (PK) |
| payment_id | UUID (FK) |
| amount | DECIMAL |
| reason | VARCHAR |
| status | VARCHAR |
| created_at | TIMESTAMP |

`gateway_response` alanı, ödeme altyapısının döndüğü ham cevabı saklar. Bir anlaşmazlık olduğunda veya mutabakat yaparken bu kayıt hayat kurtarır.

### Webhook yönetimi

- Ödeme altyapısı başarı/başarısızlık durumunda webhook gönderir.
- **Webhook imzası doğrulanır** (güvenlik).
- Ödeme durumu veritabanında güncellenir.
- Çift işlemi önlemek için idempotency anahtarı kullanılır.
- Başarılıysa sipariş onaylanır; başarısızsa yeniden denemeye izin verilir.
- Geç gelen webhook'lar yönetilir.
- Tüm webhook olayları denetim için loglanır.

:::code{lang="javascript"}
```javascript
app.post('/webhooks/payment', express.raw({ type: '*/*' }), async (req, res) => {
  const signature = req.header('X-Signature');
  const expected = crypto.createHmac('sha256', process.env.WEBHOOK_SECRET)
                         .update(req.body).digest('hex');
  if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) {
    return res.status(401).end();
  }

  const event = JSON.parse(req.body);
  const inserted = await db.query(
    'INSERT INTO webhook_events (event_id) VALUES ($1) ON CONFLICT DO NOTHING',
    [event.id]
  );
  if (inserted.rowCount === 0) return res.status(200).end();   // daha önce işlendi

  await queue.add('process-payment', event);   // ağır işi kuyruğa at
  res.status(200).end();
});
```
:::

### Hata senaryoları

| Senaryo | Çözüm |
|---|---|
| Ödeme başarısız | Yeniden denemeye izin ver; sipariş PENDING kalsın |
| Kullanıcı uygulamayı kapattı | Durumu webhook ile kontrol et |
| Çift ödeme | Idempotency anahtarı kullan |
| Ödeme altyapısı zaman aşımı | Webhook ile doğrula |
| İade | Ödeme altyapısının API'si ile başlat |
| Kısmi ödeme hatası | İşlemi geri al (rollback) |

### Önemli hususlar

- HTTPS ve güvenli API anahtarları kullan.
- Idempotency anahtarları kullan (order_id + user_id).
- Üstel geri çekilme (exponential backoff) ile yeniden dene.

**Mutabakat (reconciliation):** Her gün kendi ödeme kayıtlarını ödeme altyapısının raporuyla karşılaştırırsın. "Bizde başarılı görünüyor ama sağlayıcıda yok" veya tersi durumlar bu sayede yakalanır.

:::callout{tone="tip" title="Senin projen için"}
Toptan satışta ödeme yöntemleri farklıdır: kredi kartı (iyzico/PayTR), havale/EFT (dekont yükleme ve elle onay), cari hesap/vadeli ödeme (bayi limiti) ve kapıda ödeme. Havale için sipariş AWAITING_TRANSFER durumunda bekler; muhasebe onaylayınca PAID olur. Bayi için kredi limiti tablosu (credit_limit, current_balance) eklemek gerekir.
:::

## 10. Kurye atama sistemi

### Hedefler

- Sipariş için en uygun kuryeyi atamak.
- Teslimat süresini en aza indirmek.
- Kurye kullanım oranını en yükseğe çıkarmak.
- Kurye konumu, müsaitliği, puanı ve iş yükünü dikkate almak.
- Ret veya zaman aşımında yeniden atama yapmak.
- Adil dağıtım sağlamak ve önyargıdan kaçınmak.

### Atamada dikkate alınan faktörler

- Restorana uzaklık (yakın olan daha iyi)
- Müsaitlik (çevrimiçi ve aktif)
- Mevcut iş yükü (devam eden teslimatlar)
- Trafiğe göre tahmini teslimat süresi
- Kurye puanı ve güvenilirliği
- Araç türü (motosiklet, bisiklet, araba)
- Sipariş türü (yemek, market, toplu)
- Bölge ve teslimat yarıçapı
- Geçmiş davranış (kabul oranı, iptaller)

**Puanlama örneği:**

| Faktör | Ağırlık |
|---|---|
| Mesafe | %40 |
| ETA | %20 |
| Kurye puanı | %20 |
| Mevcut iş yükü | %10 |
| Kabul oranı | %10 |

### Mimari

- **Delivery Partner App:** Kurye çevrimiçi/çevrimdışı olur ve GPS konumunu sürekli gönderir.
- **Redis Geo:** Kuryelerin canlı konumlarını GeoHash ile saklar.
- **Restaurant Service:** "Sipariş hazır" olayını gönderir.
- **Delivery Assignment Service:** Yakındaki kuryeleri bulur, sıralama algoritmasını uygular, sipariş isteği gönderir, kabul/ret yönetir, gerekirse yeniden atar.
- **Notification Service:** Kuryelere push bildirimi gönderir.
- **Order Service:** Teslimat durumunu günceller.

### Kurye durumları

:::diagram{src="sekil-04.png" alt="Kurye durumları: OFFLINE, ONLINE, BUSY, ON_BREAK ve DISABLED"}
:::

### Atama akışı

1. Restoran siparişi READY (hazır) olarak işaretler.
2. Yarıçap içindeki müsait kuryeler bulunur.
3. Her kurye için puan hesaplanır.
4. En iyi N kuryeye sipariş isteği gönderilir (ör. 3 kuryeye paralel).
5. İlk kabul eden siparişi alır.
6. Kurye ve sipariş durumu güncellenir.
7. Zaman aşımında (ör. 30 saniye) kimse kabul etmezse arama yarıçapı genişletilir.
8. Yine kabul yoksa daha geniş yarıçapa çıkılır veya teşvik (surge) uygulanır.

### Atama algoritması

1. Redis Geo'dan X km yarıçaptaki tüm çevrimiçi kuryeleri al.
2. Müsaitliğe göre filtrele (meşgul değil, molada değil).
3. Her kurye için puanı hesapla:

:::code{lang="text"}
```text
Puan = w₁ · (1 / mesafe) + w₂ · (1 / ETA) + w₃ · puan + w₄ · kabul oranı − w₅ · mevcut sipariş
```
:::

1. Kuryeleri puana göre büyükten küçüğe sırala.
2. En iyi N kuryeye istek gönder.
3. İlk kabulü bekle (ör. 30 saniye).
4. Cevap yoksa yarıçapı artır veya teşvik sun.

Formülde mesafe ve ETA'nın tersi alınır; çünkü mesafe küçüldükçe puan büyümelidir. Mevcut sipariş sayısı çıkarılır; çünkü meşgul kuryeye daha az iş verilmelidir.

:::code{lang="javascript"}
```javascript
function scorePartner(p, w = { d: 0.4, eta: 0.2, r: 0.2, acc: 0.1, load: 0.1 }) {
  return w.d   * (1 / Math.max(p.distanceKm, 0.1))
       + w.eta * (1 / Math.max(p.etaMin, 1))
       + w.r   * (p.rating / 5)
       + w.acc * p.acceptanceRate
       - w.load * p.currentOrders;
}
```
:::

### Neden Redis Geo?

- Hızlı coğrafi sorgular
- Yarıçap içindeki kuryeleri bulma
- Düşük gecikme
- Gerçek zamanlı konum takibine çok uygun

### Redis Geo örneği

:::code{lang="bash"}
```bash
# Kurye konumunu ekle / güncelle  (önce boylam, sonra enlem)
GEOADD partner_locations 28.9784 41.0082 partner_123

# Restorana 5 km içindeki kuryeleri mesafeleriyle bul
GEOSEARCH partner_locations FROMLONLAT 28.9784 41.0082 BYRADIUS 5 km WITHDIST ASC

# İki nokta arasındaki mesafe
GEODIST partner_locations partner_123 partner_456 km
```
:::

Notlarda `GEORADIUS` komutu kullanılmış; Redis'in yeni sürümlerinde bunun yerine `GEOSEARCH` önerilir.

### Ret ve hata yönetimi

- Kurye reddederse → sıradaki en iyi kuryeye gönder.
- Kimse kabul etmezse → yarıçapı artır.
- Teşvik/surge uygulayarak kurye çek.
- Kabulden sonra çevrimdışı olan kuryeyi yönet.
- Kurye restorana ulaşmakta çok gecikirse yeniden ata.
- Ciddi gecikmede kullanıcıyı bilgilendir.

### Metrikler

Ortalama atama süresi, kurye kabul oranı, kurye kullanım oranı, kurye kaynaklı iptal oranı, ortalama teslimat süresi, yeniden atama sayısı.

:::callout{tone="tip" title="Senin projen için"}
Kendi kuryen yoksa bu bölümün karşılığı kargo firması seçimidir. Aynı puanlama mantığını kullanabilirsin: varış iline göre fiyat, teslim süresi, desi/ağırlık ve hasar oranı ile en uygun kargoyu otomatik seç. İstanbul içi toptan teslimatlar için kendi aracın varsa rota planlama (aynı gün, aynı bölgedeki siparişleri birleştirme) en büyük tasarrufu sağlar.
:::

:::quiz{src="quiz.json"}
:::

## Orijinal PDF sayfaları

:::callout{tone="info" title="Özgün görünüm"}
Bu dersin metni *Sistem Tasarimi Yemek Siparisi* PDF dosyasının 15–23. sayfalarının özgün hâlidir; sayfalar aşağıda PDF'teki görünümüyle yer alır.
:::

:::diagram{src="pdf-sayfa-15.png" alt="Sistem Tasarimi Yemek Siparisi - PDF sayfa 15"}
PDF sayfa 15 / 43
:::

:::diagram{src="pdf-sayfa-16.png" alt="Sistem Tasarimi Yemek Siparisi - PDF sayfa 16"}
PDF sayfa 16 / 43
:::

:::diagram{src="pdf-sayfa-17.png" alt="Sistem Tasarimi Yemek Siparisi - PDF sayfa 17"}
PDF sayfa 17 / 43
:::

:::diagram{src="pdf-sayfa-18.png" alt="Sistem Tasarimi Yemek Siparisi - PDF sayfa 18"}
PDF sayfa 18 / 43
:::

:::diagram{src="pdf-sayfa-19.png" alt="Sistem Tasarimi Yemek Siparisi - PDF sayfa 19"}
PDF sayfa 19 / 43
:::

:::diagram{src="pdf-sayfa-20.png" alt="Sistem Tasarimi Yemek Siparisi - PDF sayfa 20"}
PDF sayfa 20 / 43
:::

:::diagram{src="pdf-sayfa-21.png" alt="Sistem Tasarimi Yemek Siparisi - PDF sayfa 21"}
PDF sayfa 21 / 43
:::

:::diagram{src="pdf-sayfa-22.png" alt="Sistem Tasarimi Yemek Siparisi - PDF sayfa 22"}
PDF sayfa 22 / 43
:::

:::diagram{src="pdf-sayfa-23.png" alt="Sistem Tasarimi Yemek Siparisi - PDF sayfa 23"}
PDF sayfa 23 / 43
:::

:::next{lesson="j-09-takip-bildirim-ve-kampanyalar"}
:::

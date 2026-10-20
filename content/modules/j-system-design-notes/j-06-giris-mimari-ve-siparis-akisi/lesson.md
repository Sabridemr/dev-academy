---
id: j-06-giris-mimari-ve-siparis-akisi
slug: giris-mimari-ve-siparis-akisi
module: j-system-design-notes
order: 6
title:
  tr: "Yemek Siparişi Platformu: Giriş, Yüksek Seviye Mimari ve Sipariş Akışı"
  en: "Food Delivery Platform: Introduction, High-Level Architecture and Order Flow"
summary:
  tr: "Yemek siparişi platformunun gereksinimlerini, mikroservis mimarisini ve uçtan uca sipariş akışını kavra."
  en: "Grasp a food delivery platform's requirements, microservice architecture and end-to-end order flow."
durationMinutes: 20
level: beginner
tags: [system-design, food-delivery, microservices, architecture]
prerequisites: [j-02-system-design-notes-part-1, a-05-load-balancing]
concepts: [functional-requirements, non-functional-requirements, api-gateway, cdn, load-balancer, event-streaming, idempotency]
---

## 1. Bu rehber hakkında

Bu rehber, gönderdiğin 14 sayfalık "Food Delivery App System Design" (Zomato / Swiggy benzeri yemek siparişi uygulaması) notlarının Türkçe ve ayrıntılı anlatımıdır. Notlardaki 2–15. sayfaların hepsi, aynı sırayla işlendi:

1. Yüksek seviye mimari
2. Kullanıcı yolculuğu ve sipariş akışı
3. Restoran keşfi ve arama
4. Restoran ve menü servisi
5. Sipariş servisi
6. Sepet ve ödeme adımı (checkout)
7. Ödeme sistemi
8. Kurye atama
9. Gerçek zamanlı takip
10. Bildirim sistemi
11. Kupon ve kampanya sistemi
12. Sadakat ve davet (referral) sistemi
13. Takip sistemini ölçekleme
14. En iyi uygulamalar, ödünleşimler ve mülakat soruları

Her bölümün sonunda **"Senin projen için"** kutusu var. Bu kutular, anlatılan fikrin toptan gıda e-ticaret sitene (çam fıstığı, incir, baharat, zeytin, zeytinyağı) nasıl uyarlanacağını gösterir. Notlarda fiyatlar Hint rupisi (₹) ile verilmiş; örnekleri anlaşılır olsun diye Türk lirasına (TL) çevirdim.

Notlarda 1. sayfa (giriş ve gereksinimler) yoktu. Bu yüzden ilk bölümde, sistem tasarımı mülakatlarında her zaman ilk yapılan adım olan gereksinim belirlemeyi kısaca ekledim.

## 2. Sistem tasarımına giriş

**System design (sistem tasarımı)**, büyük ölçekli bir yazılımın hangi parçalardan oluşacağını, bu parçaların nasıl haberleşeceğini ve milyonlarca kullanıcıda nasıl ayakta kalacağını planlamaktır. Kıdemli yazılım mülakatlarının en önemli bölümlerinden biridir.

Mülakatta izlenecek sıra:

1. **Gereksinimleri netleştir:** Sistem ne yapacak? (fonksiyonel gereksinimler)
2. **Kalite hedeflerini belirle:** Ne kadar hızlı, ne kadar erişilebilir? (fonksiyonel olmayan gereksinimler)
3. **Ölçeği tahmin et:** Kaç kullanıcı, saniyede kaç istek, ne kadar veri?
4. **Yüksek seviye mimariyi çiz:** Ana servisler ve veri akışı.
5. **Kritik parçaların ayrıntısına in:** Veritabanı şeması, API'ler, algoritmalar.
6. **Darboğazları ve ödünleşimleri tartış:** Ölçekleme, hata senaryoları, alternatifler.

### Yemek siparişi uygulamasının gereksinimleri

**Fonksiyonel gereksinimler:**

- Kullanıcı kayıt olur, giriş yapar, konumunu belirler.
- Yakındaki restoranları arar ve filtreler.
- Menüyü görür, sepete ürün ekler, kupon uygular.
- Ödeme yapar ve siparişi verir.
- Restoran siparişi kabul eder ve hazırlar.
- Sisteme bir kurye atanır.
- Kullanıcı siparişi canlı haritada takip eder, bildirim alır.
- Teslimattan sonra puan ve yorum verir.

**Fonksiyonel olmayan gereksinimler:**

| Hedef | Anlamı |
|---|---|
| Yüksek erişilebilirlik (high availability) | Sistem neredeyse hiç kapanmamalı (%99,99) |
| Düşük gecikme (low latency) | Arama 200 ms altında, takip 2 sn altında |
| Ölçeklenebilirlik (scalability) | Akşam yemeği saatindeki ani yükü kaldırmalı |
| Tutarlılık (consistency) | Ödeme alındıysa sipariş mutlaka oluşmalı |
| Dayanıklılık (fault tolerance) | Bir servis çökse de sistemin geri kalanı çalışmalı |

:::callout{tone="tip" title="Mülakatta böyle söyle"}
Mimariyi çizmeden önce gereksinimleri ve ölçeği soruyorum. Günlük aktif kullanıcı sayısı, eşzamanlı sipariş sayısı ve gecikme hedefi, hangi teknolojileri seçeceğimi doğrudan belirler.
:::

## 3. Yüksek seviye mimari

### Genel bakış

Sistem **mikroservis mimarisi** ile kurulur. Kullanıcılar, restoranlar, siparişler, ödemeler ve teslimat gibi her iş alanı ayrı bir servis tarafından yönetilir. Servisler birbirleriyle iki yolla konuşur:

- **Senkron:** REST veya gRPC ile doğrudan istek-cevap.
- **Asenkron:** Kafka üzerinden olay (event) yayınlayarak.

### Mimari şeması

:::diagram{src="sekil-01.png" alt="Mimari şeması: İstemciler, CDN, Load Balancer, API Gateway ve Mikroservisler arasındaki akış|Architecture diagram: flow between clients, CDN, load balancer, API Gateway and microservices"}
:::

**İstemciler (Clients):** Sistemi kullanan beş farklı uygulama vardır:

| İstemci | Kim kullanır? | Ne yapar? |
|---|---|---|
| Customer App (iOS/Android) | Müşteri | Arama, sipariş, ödeme, takip |
| Web App | Müşteri | Aynı işlemler tarayıcıdan |
| Restaurant Partner App | Restoran | Sipariş kabul, menü yönetimi |
| Delivery Partner App | Kurye | Sipariş alma, konum gönderme |
| Admin Portal | Şirket çalışanı | Onay, raporlama, destek |

**CDN (Content Delivery Network):** Resim, CSS, JavaScript gibi statik dosyaları kullanıcıya en yakın sunucudan dağıtır. Menü fotoğrafları sunucuyu yormadan hızlıca yüklenir.

**Load Balancer (yük dengeleyici):** Gelen trafiği birden çok sunucuya dağıtır. Bir sunucu çökerse trafiği sağlam olanlara yönlendirir.

**API Gateway:** Tüm isteklerin girdiği tek kapıdır. Kimlik doğrulama, rate limiting ve isteği doğru servise yönlendirme işlerini üstlenir.

### Mikroservisler

| Servis | Sorumluluğu |
|---|---|
| User Service | Kullanıcılar, kimlik doğrulama, profiller |
| Restaurant Service | Restoranlar ve menüler |
| Search Service | Arama ve öneriler |
| Order Service | Sipariş yönetimi |
| Payment Service | Ödemeler ve iadeler |
| Delivery Service | Kurye atama ve takip |
| Notification Service | E-posta, SMS, push bildirimleri |
| Rating & Review Service | Puan ve yorumlar |
| Analytics Service | İş analitiği ve raporlar |

### Veritabanları ve depolama

| Depolama | Kullanım amacı |
|---|---|
| Primary DB (PostgreSQL/MySQL) | İşlemsel veriler: sipariş, ödeme, kullanıcı |
| MongoDB | Esnek yapılı veriler: menüler, loglar |
| Redis | Önbellek, oturumlar, gerçek zamanlı veri |
| Object Storage (S3/GCS) | Resimler, menü fotoğrafları |

### Olay akışı (Event Streaming)

**Kafka**, servisler arasında asenkron olay taşır: `order-created`, `payment-success`, `delivery-updates` gibi. Sipariş servisi bir olay yayınlar; bildirim, analitik ve teslimat servisleri bu olayı kendi hızlarında dinler. Böylece servisler birbirine sıkı sıkıya bağlı olmaz.

### Üçüncü taraf servisler

- **Ödeme altyapısı:** Razorpay, Stripe (Türkiye'de iyzico, PayTR)
- **Harita ve konum:** Google Maps
- **SMS ve e-posta:** Twilio, SendGrid
- **Push bildirimi:** FCM (Android), APNs (iOS)

### Neden mikroservis?

1. Her servis bağımsızdır ve ayrı ayrı ölçeklenebilir. Akşam saatlerinde sadece sipariş ve arama servisi büyütülür.
2. Farklı ekipler paralel çalışabilir.
3. **Hata izolasyonu:** Puan servisi çökse bile kullanıcılar sipariş vermeye devam eder.
4. Her servis ayrı deploy edilir ve bakımı kolaydır.

Bedeli: Servisler arası ağ iletişimi, dağıtık veri tutarlılığı, izleme ve deploy karmaşıklığı artar.

### Örnek teknoloji yığını

| Katman | Teknoloji |
|---|---|
| Frontend | React Native (mobil), Next.js (web) |
| Backend | Node.js / Java (Spring Boot) |
| API Gateway | Nginx / AWS API Gateway |
| Veritabanı | PostgreSQL, MongoDB, Redis |
| Mesajlaşma | Apache Kafka |
| Deploy | Docker, Kubernetes |
| Bulut | AWS / GCP |

:::callout{tone="tip" title="Senin projen için"}
Toptan satış sitesi için başlangıçta mikroservis gereksizdir. Tek bir Node.js uygulaması içinde modüllere ayrılmış bir yapı (modular monolith) yeterli: products, orders, payments, customers. PostgreSQL ana veritabanı olarak, Redis de önbellek için kullanılabilir. Trafik büyüdükçe en çok yük alan modül ayrı servise çıkarılır.
:::

## 4. Kullanıcı yolculuğu ve sipariş akışı

### Uçtan uca kullanıcı yolculuğu

:::diagram{src="sekil-02.png" alt="Uçtan uca kullanıcı yolculuğu: uygulamayı açmaktan canlı takibe yedi adım|End-to-end user journey: seven steps from opening the app to live tracking"}
:::

1. **Uygulamayı açma ve giriş:** Kayıt/giriş yapılır, konum GPS ile veya elle belirlenir.
2. **Restoran keşfi:** Arama yapılır; mutfak türü, puan ve mesafeye göre filtrelenir.
3. **Menüye göz atma:** Ürünler incelenir, sepete eklenir, boyut ve ek malzeme gibi seçimler yapılır.
4. **Sipariş ve ödeme:** Sepet gözden geçirilir, kupon uygulanır, ödeme yapılır.
5. **Restoranın kabulü:** Restoran siparişi alır, kabul veya reddeder, hazırlamaya başlar.
6. **Kurye atama:** Yakındaki kurye bulunur, kurye kabul eder, siparişi restorandan alır.
7. **Canlı takip ve teslimat:** Kullanıcı kuryeyi gerçek zamanlı izler, tahmini varış süresini (ETA) görür, siparişi alır ve puan verir.

### Sipariş akışı sıralı diyagramı (sequence diagram)

Notlardaki diyagram, yedi aktör arasındaki mesajları gösteriyor: Müşteri, API Gateway, Order Service, Payment Service, Restaurant Service, Delivery Service, Notification Service.

| Adım | Ne olur? |
|---|---|
| 1. Sipariş verme | Müşteri `POST /orders` gönderir; Gateway, Order Service'e "Sipariş oluştur" der |
| 2. Ödeme | Order Service, Payment Service'te ödemeyi başlatır |
| 3. Sipariş onayı | Payment Service "ödeme başarılı" cevabını döner |
| 4. Restoran kabulü | Order Service siparişi restorana gönderir, restoran kabul eder |
| 5. Kurye atama | Delivery Service yakındaki kuryeyi bulur, kurye atanır |
| 6. Teslim alma ve teslimat | Durum: Pick Up → In Transit → Delivered |
| 7. Sipariş tamamlandı | Durum güncellenir, Notification Service SMS/Push gönderir |

Notun önemli vurgusu: **Her adım asenkron ve olay güdümlüdür (Kafka).** Sipariş servisi, bildirim servisinin işini bitirmesini beklemez; sadece olayı yayınlar.

### Temel API'ler

| Metot | Endpoint | Amaç |
|---|---|---|
| POST | /auth/login | Kullanıcı girişi |
| GET | /restaurants | Yakındaki restoranlar |
| GET | /restaurants/{id}/menu | Menüyü getir |
| POST | /cart/items | Sepete ürün ekle |
| POST | /orders | Sipariş ver |
| POST | /payments | Ödeme yap |
| GET | /orders/{id} | Sipariş durumunu getir |
| GET | /tracking/{id} | Canlı konumu getir |

### Önemli noktalar

- Servisler arasında asenkron iletişim (Kafka) kullan.
- Sipariş akışı **idempotent** olmalı; yeniden denemeler çift sipariş oluşturmamalı.
- Gerçek zamanlı güncellemeler WebSocket ile verilmeli.
- Sipariş her aşamada iptal edilebilmeli ve iptal doğru yönetilmeli.
- Kullanıcıya anlamlı hata mesajları gösterilmeli.
- Tüm sipariş olayları saklanmalı (denetim ve analiz için).

### Başarı metrikleri

- Sipariş verme süresi 2 saniyenin altında
- Sipariş başarı oranı %98'in üzerinde
- Doğru ETA tahmini
- Yüksek kullanıcı memnuniyeti (puan ve yorumlar)
- Güvenilir canlı takip
- Düşük sipariş iptal oranı

:::callout{tone="tip" title="Senin projen için"}
Toptan satışta yolculuk şöyle olur: bayi girişi → kategori ve ürün arama → koli/miktar seçimi (minimum sipariş miktarıyla) → sepet → havale/kart/vadeli ödeme → depo hazırlığı → kargoya teslim → kargo takibi. Kurye atama yerine kargo firması entegrasyonu gelir.
:::

## Dene: bir siparişin yolculuğu

:::interactive{type="request-journey" layers=5 rttMs=30 cacheHitRate=0.4}
İsteğin istemciden gateway, servis ve veritabanına kadar geçtiği katmanları izle; önbellek isabet oranını artırınca toplam gecikmenin nasıl düştüğüne bak.
:::

:::quiz{src="quiz.json"}
:::

:::next{lesson="j-07-kesif-menu-ve-siparis-servisi"}
:::

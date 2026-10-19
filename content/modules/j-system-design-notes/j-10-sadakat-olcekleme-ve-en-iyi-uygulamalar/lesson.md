---
id: j-10-sadakat-olcekleme-ve-en-iyi-uygulamalar
slug: sadakat-olcekleme-ve-en-iyi-uygulamalar
module: j-system-design-notes
order: 10
title:
  tr: "Yemek Siparişi Platformu: Sadakat, Takip Sistemini Ölçekleme ve En İyi Uygulamalar"
  en: "Food Delivery Platform: Loyalty, Scaling the Tracking System and Best Practices"
summary:
  tr: "Sadakat ve davet sistemini kurmayı, canlı takibi milyonlara ölçeklemeyi ve dayanıklılık desenlerini öğren."
  en: "Learn to build loyalty and referral systems, scale live tracking to millions and apply resilience patterns."
durationMinutes: 14
level: advanced
tags: [system-design, food-delivery, loyalty, scalability, real-time]
prerequisites: []
concepts: [referral-program, points-ledger, back-of-the-envelope, geohash, cqrs, circuit-breaker, observability, p95-latency]
---

## 14. Sadakat ve davet sistemi

### Hedefler

- Kullanıcıyı elde tutmak ve tekrar sipariş almak.
- Sadık müşterileri puan, ödül ve özel avantajlarla ödüllendirmek.
- Davet (referral) programıyla yeni kullanıcı kazanmak.
- Sipariş sıklığını ve müşteri yaşam boyu değerini (LTV — Lifetime Value) artırmak.
- Sistemi ölçeklenebilir, şeffaf ve dolandırıcılığa karşı korumalı yapmak.

### Özellikler

1. Her siparişte puan kazanma.
2. Puanları indirim veya ücretsiz ürün için kullanma.
3. Kademeli üyelik (Silver / Gold / Platinum).
4. Davet et ve kazan (arkadaş daveti).
5. Kişiselleştirilmiş kampanyalar ve ödüller.
6. Puan, davet ve ödülleri kullanıcı profilinde gösterme.

### Ödül türleri

Sabit indirim (50 TL), yüzde indirim (%10), ücretsiz teslimat, ücretsiz ürün (ör. tatlı), özel kampanyalar (erken erişim), kademe yükseltme ve cashback, davet bonusu (her başarılı davet için 100 TL).

### Mimari

Mobil ve web uygulaması → API Gateway → **Loyalty Service** (puan, ödül, kademe yönetimi), **Referral Service** (davet ve takip), **Notification Service** (ödül bildirimleri). Veriler PostgreSQL'de, kullanıcı puanları ve kampanyalar Redis'te önbelleklenir.

### Sadakat akışı (kazanma ve harcama)

:::diagram{src="sekil-01.png" alt="Sadakat akışı: sipariş, puan hesaplama, bakiye güncelleme, ödeme adımında puan kullanımı, indirim ve güncelleme"}
:::

### Davet akışı

1. Kullanıcı benzersiz davet kodu/linki alır.
2. Arkadaşlarıyla paylaşır (uygulama veya sosyal medya).
3. Arkadaş kodla kayıt olur.
4. Arkadaş şartları karşılayan ilk siparişini verir.
5. Davet eden ve edilen ödül alır (ör. her biri 100 TL).
6. Başarılı davetler kullanıcı profilinde takip edilir.

Ödülün kayıtta değil **ilk siparişte** verilmesi önemlidir; aksi hâlde sahte hesaplarla ödül toplanabilir.

### Veritabanı şeması

**user_loyalty:** id (UUID, PK), user_id (FK), points (INT), tier (VARCHAR), total_orders (INT), created_at, updated_at.

**referrals:** id (UUID, PK), referrer_id (FK), referred_user_id (FK), code (VARCHAR), status (VARCHAR), reward_amount (DECIMAL), created_at.

Profesyonel bir tasarımda puan bakiyesine ek olarak bir **puan hareketleri (ledger)** tablosu tutulur. Her kazanım ve harcama ayrı satırdır; bakiye bu satırların toplamıdır. Böylece "puanım nereye gitti?" sorusu her zaman cevaplanabilir:

:::code{lang="sql"}
```sql
CREATE TABLE loyalty_transactions (
  id         BIGSERIAL PRIMARY KEY,
  user_id    BIGINT NOT NULL,
  order_id   BIGINT,
  points     INT NOT NULL,          -- +45 kazanım, -100 harcama
  reason     TEXT NOT NULL,         -- 'ORDER_EARN', 'REDEEM', 'EXPIRE'
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```
:::

### Sadakat kademeleri

| Kademe | Kriter | Avantajlar |
|---|---|---|
| Silver | 0–5 sipariş | 1x puan, temel kampanyalar |
| Gold | 6–20 sipariş | 1,5x puan, ücretsiz teslimat, özel kampanyalar |
| Platinum | 21+ sipariş | 2x puan, öncelikli destek, özel ödüller |

### Örnek hesaplamalar

**Puan hesabı:** Sipariş tutarı 450 TL, her 10 TL için 1 puan:

:::code{lang="text"}
```text
Puan = 450 / 10 = 45 puan
```
:::

Gold üyede 1,5 kat: 45 × 1,5 = 67,5 → 67 puan (aşağı yuvarlanır).

**Davet ödülü:** Davet eden → 100 TL, davet edilen → 100 TL (ilk sipariş sonrası).

### Zorluklar ve çözümler

| Zorluk | Çözüm |
|---|---|
| Sahte davetler | Cihaz parmak izi, kimlik doğrulama, sipariş doğrulama |
| Puanların kötüye kullanımı | Son kullanma tarihi, kullanım limitleri |
| Ölçeklenebilirlik | Redis önbellek, asenkron işleme |

### Metrikler

Aktif sadakat kullanıcıları, kazanılan ve harcanan puan oranı, davet dönüşüm oranı, sipariş sıklığındaki artış, müşteri tutma oranı, sadakat programından gelen gelir, engellenen dolandırıcılık girişimleri.

### En iyi uygulamalar

- Kuralları basit ve şeffaf tut.
- İlerlemeyi göster (puan, bir sonraki ödül).
- Zamanında bildirim gönder.

:::callout{tone="tip" title="Senin projen için"}
Bayilerde puan yerine ciroya dayalı kademeler daha anlamlıdır: yıllık 100.000 TL alım → Bronz (%2 iskonto), 500.000 TL → Gümüş (%4), 1.000.000 TL → Altın (%6 + vadeli ödeme). Bu, daha önce tasarladığımız price_tier alanıyla doğrudan bağlanır. Davet sistemi de "yeni bayi getirene ilk siparişinin %3'ü kadar bakiye" şeklinde kurulabilir.
:::

## 15. Takip sistemini ölçekleme

### Problem tanımı

- Milyonlarca kuryeyi gerçek zamanlı takip etmek.
- Konumu birkaç saniyede bir güncellemek.
- Kullanıcılara canlı konumu düşük gecikmeyle göstermek.
- Yüksek eşzamanlılığı ve büyük ölçeği kaldırmak.
- Doğruluk, güvenilirlik ve hata toleransı sağlamak.

### Ölçek varsayımları

| Ölçüt | Değer |
|---|---|
| Kullanıcılar | 10 milyon+ günlük aktif |
| Kuryeler | 500.000+ eşzamanlı |
| Konum güncellemesi | 5–10 saniyede bir |
| Tepe istek | Saniyede 100.000+ güncelleme |
| Okuma / yazma | Okuma (kullanıcı takibi) > yazma (konum güncelleme) |
| Gecikme | 2 saniyenin altında |
| Erişilebilirlik | %99,99 |

**Kaba hesap (back-of-the-envelope):** 500.000 kurye her 5 saniyede bir konum gönderirse:

:::code{lang="text"}
```text
500.000 / 5 = 100.000 güncelleme/saniye
```
:::

Her güncelleme yaklaşık 200 bayt ise saniyede 20 MB, günde yaklaşık 1,7 TB ham veri eder. Bu yüzden her güncellemeyi doğrudan PostgreSQL'e yazmak mümkün değildir; Redis ve Kafka gerekir. Mülakatta bu tür hesapları yüksek sesle yapmak çok olumlu karşılanır.

%99,99 erişilebilirlik, yılda yaklaşık 52 dakika kesinti demektir.

### Temel zorluklar

- Çok sayıda eşzamanlı konum güncellemesi.
- Canlı takip için düşük gecikme.
- Konum verisini verimli saklama ve sorgulama.
- Ölçeklenebilirlik ve hata toleransı.
- Ağ hataları (çevrimdışı kuryeler).
- Kurye uygulamasında pil optimizasyonu.
- Sahte konum / hile önleme.

### Yüksek seviye mimari

:::diagram{src="sekil-02.png" alt="Takip sistemi mimarisi: kurye uygulamasından API Gateway, Location Ingestion Service, Redis, Kafka ve Tracking Service üzerinden kullanıcıya"}
:::

Ek bileşenler: Notification Service (sipariş durumu), veritabanı (PostgreSQL/MongoDB, geçmiş veri), harita API'si (Google Maps) ve analitik (takip, ETA, makine öğrenmesi).

**Ingestion (veri alımı) servisini ayırmanın nedeni:** Yazma yükü (100.000/sn) ile okuma yükü (milyonlarca kullanıcı) çok farklıdır. Ayrı servisler ayrı ayrı ölçeklenir. Bu, **CQRS** (Command Query Responsibility Segregation, yazma ve okumayı ayırma) fikrine dayanır.

### Konum güncelleme akışı

1. Kurye uygulaması GPS konumunu alır.
2. Konum API'ye gönderilir (5–10 saniyede bir).
3. Veri doğrulanır ve zenginleştirilir (gürültü temizlenir).
4. Son konum Redis'e yazılır (GeoHash).
5. Güncelleme olayı Kafka'ya yayınlanır.
6. Tracking Service güncellemeyi WebSocket / PubSub ile kullanıcılara iletir.
7. Veri geçmiş ve analiz için veritabanına kaydedilir.

### Ölçek için optimizasyonlar

1. Yarıçap içi hızlı sorgular için Redis GeoHash kullan.
2. Gerçek zamanlı güncellemeler için polling yerine WebSocket kullan.
3. Gerekirse konum güncellemelerini toplu (batch) işle.
4. Yüksek hacimli veri alımı için Kafka kullan.
5. Hızlı önbellekte sadece son konumu tut.
6. Veriyi şehir/bölgeye göre bölümle (partitioning).
7. Küresel ölçek için CDN / edge sunucular kullan.

**Partitioning / sharding:** İstanbul kuryeleri bir sunucu grubunda, Ankara kuryeleri başka bir grupta tutulur. Bir şehirdeki yoğunluk diğerini etkilemez ve her grup ayrı ölçeklenir.

**Pil optimizasyonu:** Kurye dururken konum sıklığı azaltılır (30 sn), hareket ederken artırılır (5 sn). Böylece hem pil hem sunucu yükü düşer.

### Çevrimdışı durumlar ve hatalar

- Kurye çevrimdışı olursa → zaman damgasıyla "son görülme" olarak işaretle.
- Başarısız güncellemeler için yeniden deneme mekanizması kullan.
- Veriyi kalıcı depolamada (PostgreSQL) sakla.
- Başarısız olaylar için dead letter queue kullan.
- Canlı güncelleme durursa tahmini konumu göster.
- WebSocket kopmalarını ve yeniden bağlanmaları yönet.

### GeoHash örneği

Konum: enlem = 28.5355, boylam = 77.3910 → GeoHash (hassasiyet 6) = `t2h5e6`

**GeoHash nedir?** Dünya haritasını tekrar tekrar ızgaralara bölerek her bölgeye kısa bir metin kodu verir. Kod uzadıkça bölge küçülür:

| Hassasiyet | Yaklaşık hücre boyutu |
|---|---|
| 4 | ~39 km × 20 km |
| 5 | ~4,9 km × 4,9 km |
| 6 | ~1,2 km × 0,6 km |
| 7 | ~153 m × 153 m |

Yakın noktaların GeoHash'leri genellikle aynı önekle başlar. Böylece "5 km içindeki kuryeler" sorgusu, tüm veritabanını taramak yerine birkaç önek eşleştirmesiyle yapılır. Not: Hücre sınırına yakın noktalar için komşu hücreler de sorgulanmalıdır.

### Kullanılan teknolojiler

| Teknoloji | Görevi |
|---|---|
| Kafka | Olay akışı |
| Redis | Gerçek zamanlı önbellek, GeoHash |
| PostgreSQL / MongoDB | Geçmiş veri |
| WebSocket / PubSub | Gerçek zamanlı güncellemeler |
| Google Maps API | Harita ve ETA |
| Kubernetes | Ölçekleme ve deploy |

### İzlenecek metrikler

Konum güncelleme gecikmesi (ortalama ve **p95**), WebSocket bağlantı sayısı, saniyedeki konum güncellemesi, takip API cevap süresi, sistem çalışma süresi ve hata oranı, önbellek isabet oranı (Redis cache hit ratio), kurye uygulaması pil kullanımı, kullanıcı etkileşimi.

**p95 nedir?** İsteklerin %95'inin bu sürenin altında tamamlandığını gösterir. Ortalama yanıltıcı olabilir: 99 istek 50 ms, 1 istek 5 saniye sürerse ortalama 100 ms görünür ama bazı kullanıcılar çok kötü deneyim yaşar. p95 ve p99 bu "kuyruk gecikmesini" (tail latency) gösterir.

### En iyi uygulamalar

Verimli veri yapıları kullan (GeoHash), gerçek zamanlı veriyi önbellekte tut (Redis), düşük gecikme ve yüksek erişilebilirlik için optimize et, gürültülü GPS verisini doğrula ve filtrele, veri gizliliği ve güvenliğini sağla, tepe senaryolar için yük testi yap.

:::callout{tone="tip" title="Senin projen için"}
Bu ölçek sana şu an gerekmez; ama ölçekleme düşüncesi aynıdır. Önce ölç: hangi sayfa yavaş, hangi sorgu çok çalışıyor? Sonra sırayla: veritabanı indeksi → Redis önbelleği → CDN (ürün görselleri) → ağır işleri kuyruğa alma (fatura PDF, e-posta) → okuma replikası. Mikroservis ve Kafka bu listenin en sonundadır.
:::

## 16. En iyi uygulamalar ve sonuç

### En iyi uygulamalar (özet)

- Sahipliği net mikroservisler kullan.
- Ölçek için tasarla (durumsuz servisler).
- Sık erişilen veriyi önbelleğe al (Redis).
- Gerçek zamanlı güncellemeleri WebSocket / PubSub ile yap.
- Kritik API'lerde idempotency sağla (sipariş, ödeme).
- Kritik olmayan işleri asenkron yap (bildirimler, analitik).
- Yeniden deneme, **circuit breaker** ve yedek mekanizmalar kur.
- Her şeyi izle (log, metrik, tracing).
- Veriyi tutarlı tut ve uç durumları yönet.
- Güvenlik en iyi uygulamalarını izle (kimlik doğrulama, rate limiting).
- Veritabanı sorgularını optimize et ve indeks kullan.
- Ölçekte test et (yük ve stres testleri).

**Circuit breaker (devre kesici):** Bir servis sürekli hata veriyorsa, ona istek göndermeyi geçici olarak durdurur ve hemen yedek cevap döner. Elektrik sigortası gibidir: arızalı servisin tüm sistemi aşağı çekmesini engeller.

:::code{lang="text"}
```text
CLOSED (normal) → hata eşiği aşıldı → OPEN (istekler kesilir)
→ bekleme süresi doldu → HALF_OPEN (birkaç deneme isteği)
→ başarılı → CLOSED   /   başarısız → OPEN
```
:::

**Stateless (durumsuz) servis:** Sunucu kullanıcıya ait oturum bilgisini kendi belleğinde tutmaz (Redis'te veya token'da tutulur). Böylece herhangi bir istek herhangi bir sunucuya gidebilir ve sunucu sayısı kolayca artırılıp azaltılabilir.

**Observability (gözlemlenebilirlik)** üç ayağa dayanır:

- **Logs:** Ne oldu? (olay kayıtları)
- **Metrics:** Ne kadar? (istek sayısı, gecikme, hata oranı)
- **Traces:** Nerede yavaşladı? (bir isteğin servisler arasındaki yolculuğu)

### Gerçek dünyadan dersler

1. Konum doğruluğu zordur (GPS sapması, kapalı alanlar).
2. Trafik ve hava durumu ETA'yı ciddi biçimde etkiler.
3. Kurye uygulamasının benimsenmesi şehir/bölgeye göre değişir.
4. Gerçek zamanlı sistemlerin düzgün yedek planları olmalı (çevrimdışı mod).
5. Tepe yükler (bayramlar, maç günleri) otomatik ölçekleme gerektirir.
6. Birden çok servis arasında veri tutarlılığı zordur.
7. Dolandırıcılık ve sahte siparişler gerçek bir sorundur (makine öğrenmesi / sezgisel kurallar gerekir).
8. İyi iletişim (bildirimler) destek taleplerini ciddi biçimde azaltır.

### Temel çıkarımlar

- Gerçek zamanlı sistemler doğru mimari ve teknoloji seçimleri gerektirir.
- Ölçeklenebilirlik, güvenilirlik ve düşük gecikme iyi kullanıcı deneyiminin temelidir.
- Her bileşenin (konum, sipariş, ödeme, bildirim) kendine özgü zorlukları vardır.
- İzleme ve optimizasyon sürekli bir süreçtir.
- Sonuçta mesele kullanıcılar, restoranlar ve kuryeler için gerçek sorunları çözmektir.

### Örnek teknoloji yığını (nihai)

| Katman | Teknoloji |
|---|---|
| Frontend (kullanıcı) | React Native (mobil) |
| Frontend (kurye) | React Native / Flutter |
| Backend | Node.js (NestJS) |
| API Gateway | Nginx / Kong |
| Veritabanı | PostgreSQL / MongoDB |
| Önbellek | Redis |
| Mesaj kuyruğu | Kafka |
| Gerçek zamanlı | WebSocket / PubSub |
| Harita ve konum | Google Maps API |
| Bildirimler | FCM, Twilio, SendGrid |
| Altyapı | Docker, Kubernetes, AWS |
| İzleme | Prometheus, Grafana, ELK |

### Gelecek geliştirmeler

Yapay zekâ tabanlı ETA tahmini, talebe göre dinamik fiyatlama (surge algoritması), makine öğrenmesiyle daha iyi dolandırıcılık tespiti, sesli sipariş takibi, drone/robot teslimat (uzun vadede), çok şehirli ve uluslararası genişleme, sürdürülebilir (çevre dostu) teslimat seçenekleri, kişiselleştirilmiş öneriler, market ve eczane gibi diğer hizmetlerle entegrasyon.

:::quiz{src="quiz.json"}
:::

## Orijinal PDF sayfaları

:::callout{tone="info" title="Özgün görünüm"}
Bu dersin metni *Sistem Tasarimi Yemek Siparisi* PDF dosyasının 31–38. sayfalarının özgün hâlidir; sayfalar aşağıda PDF'teki görünümüyle yer alır.
:::

:::diagram{src="pdf-sayfa-31.png" alt="Sistem Tasarimi Yemek Siparisi - PDF sayfa 31"}
PDF sayfa 31 / 43
:::

:::diagram{src="pdf-sayfa-32.png" alt="Sistem Tasarimi Yemek Siparisi - PDF sayfa 32"}
PDF sayfa 32 / 43
:::

:::diagram{src="pdf-sayfa-33.png" alt="Sistem Tasarimi Yemek Siparisi - PDF sayfa 33"}
PDF sayfa 33 / 43
:::

:::diagram{src="pdf-sayfa-34.png" alt="Sistem Tasarimi Yemek Siparisi - PDF sayfa 34"}
PDF sayfa 34 / 43
:::

:::diagram{src="pdf-sayfa-35.png" alt="Sistem Tasarimi Yemek Siparisi - PDF sayfa 35"}
PDF sayfa 35 / 43
:::

:::diagram{src="pdf-sayfa-36.png" alt="Sistem Tasarimi Yemek Siparisi - PDF sayfa 36"}
PDF sayfa 36 / 43
:::

:::diagram{src="pdf-sayfa-37.png" alt="Sistem Tasarimi Yemek Siparisi - PDF sayfa 37"}
PDF sayfa 37 / 43
:::

:::diagram{src="pdf-sayfa-38.png" alt="Sistem Tasarimi Yemek Siparisi - PDF sayfa 38"}
PDF sayfa 38 / 43
:::

:::next{lesson="j-11-odunlesimler-mulakat-ve-ozet"}
:::

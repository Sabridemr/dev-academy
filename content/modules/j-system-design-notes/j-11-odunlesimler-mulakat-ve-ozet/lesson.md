---
id: j-11-odunlesimler-mulakat-ve-ozet
slug: odunlesimler-mulakat-ve-ozet
module: j-system-design-notes
order: 11
title:
  tr: "Yemek Siparişi Platformu: Ödünleşimler, Mülakat Soruları ve Özet"
  en: "Food Delivery Platform: Trade-offs, Interview Questions and Summary"
summary:
  tr: "SQL/NoSQL, CAP ve tutarlılık ödünleşimlerini mülakatta gerekçeleriyle savunmayı öğren."
  en: "Learn to defend SQL/NoSQL, CAP and consistency trade-offs with clear reasoning in interviews."
durationMinutes: 12
level: intermediate
tags: [system-design, food-delivery, trade-offs, interview-prep]
prerequisites: []
concepts: [sql-vs-nosql, acid, cap-theorem, eventual-consistency, horizontal-scaling, modular-monolith]
---

## 17. Sistem tasarımı ödünleşimleri

Sistem tasarımında "doğru" cevap yoktur; her karar bir şey kazandırır, bir şey kaybettirir. Mülakatta en çok puan getiren şey bu ödünleşimleri (trade-off) açıkça konuşmaktır.

| Karar | Ödünleşim |
|---|---|
| Real-time vs polling | WebSocket = düşük gecikme ama karmaşık · Polling = basit ama yüksek gecikme |
| SQL vs NoSQL | SQL = tutarlılık · NoSQL = esneklik ve ölçek |
| Tek DB vs sharding | Tek DB = basit · Sharding = ölçeklenebilir ama karmaşık |
| Senkron vs asenkron | Senkron = anında sonuç · Asenkron = ölçeklenebilir ama sonunda tutarlı (eventual consistency) |
| Önbellek | Daha hızlı okuma · Bayat veri riski |
| Mikroservis vs monolit | Mikroservis = ölçeklenebilir · Monolit = basit |

### SQL ve NoSQL

|  | SQL (PostgreSQL, MySQL) | NoSQL (MongoDB, Cassandra, Redis) |
|---|---|---|
| Yapı | Tablolar, sabit şema | Doküman, anahtar-değer, geniş sütun |
| İlişkiler | JOIN ile güçlü | Zayıf; veri genelde gömülür |
| Tutarlılık | ACID transaction | Genelde esnek (BASE) |
| Ölçekleme | Dikey (daha güçlü sunucu) + replika | Yatay (daha çok sunucu) |
| Uygun alan | Sipariş, ödeme, stok | Menü, log, oturum, konum |

**ACID:** Atomicity (ya hep ya hiç), Consistency (kurallar korunur), Isolation (eşzamanlı işlemler birbirini bozmaz), Durability (yazılan veri kalıcıdır). Ödeme ve sipariş için vazgeçilmezdir.

### CAP teoremi

Dağıtık bir sistem ağ bölünmesi (Partition) yaşadığında, **Consistency** (herkes aynı veriyi görür) ile **Availability** (her istek cevap alır) arasında seçim yapmak zorundadır.

- **Ödeme ve stok:** Tutarlılık seçilir (CP). Yanlış bakiye göstermektense hata vermek daha iyidir.
- **Restoran listesi ve kurye konumu:** Erişilebilirlik seçilir (AP). Birkaç saniye eski veri göstermek kabul edilebilir.

### Eventual consistency

Asenkron sistemlerde veri tüm servislere aynı anda ulaşmaz; kısa bir süre sonra tutarlı hâle gelir. Örneğin restoran bir ürünü "tükendi" yaptığında arama sonuçlarında birkaç saniye daha görünebilir. Bu, ölçeklenebilirlik için ödenen bedeldir. Bu yüzden ödeme adımında stok mutlaka asıl kaynaktan (veritabanı) tekrar kontrol edilir.

### Dikey ve yatay ölçekleme

- **Dikey (vertical / scale up):** Sunucuya daha çok CPU ve RAM eklemek. Basittir ama bir sınırı vardır.
- **Yatay (horizontal / scale out):** Daha çok sunucu eklemek. Sınırsıza yakındır ama servislerin durumsuz olmasını ve yük dengeleyiciyi gerektirir.

:::callout{tone="tip" title="Mülakatta böyle söyle"}
Ödeme ve sipariş için tutarlılığı seçerim ve PostgreSQL transaction kullanırım. Restoran listesi ve kurye konumu gibi verilerde birkaç saniyelik gecikme kabul edilebilir, bu yüzden önbellek ve asenkron güncelleme kullanırım.
:::

## 18. Mülakat soruları ve örnek cevaplar

Notlardaki 10 sık sorulan mülakat sorusu ve her biri için cevap çerçevesi:

**1. Gerçek zamanlı konum takibi nasıl çalışır?** Kurye uygulaması 5–10 saniyede bir konumu API Gateway üzerinden ingestion servisine gönderir. Konum doğrulanır, Redis'e GeoHash ile yazılır ve Kafka'ya olay olarak yayınlanır. Tracking Service bu olayı dinler ve WebSocket ile o siparişi takip eden kullanıcıya iletir. Geçmiş veri asenkron olarak veritabanına yazılır.

**2. 1 milyon eşzamanlı kullanıcıyı nasıl yönetirsin?** Durumsuz servisler ve yük dengeleyiciyle yatay ölçekleme; Redis önbelleği; statik içerik için CDN; WebSocket sunucularını ayrı ölçekleme ve aralarında PubSub; veriyi şehre göre bölümleme; otomatik ölçekleme (Kubernetes HPA) ve önceden yük testi.

**3. Kurye sipariş ortasında çevrimdışı olursa ne olur?** Son bilinen konum ve zaman damgası "son görülme" olarak gösterilir. Kurye uygulaması güncellemeleri yerelde biriktirip bağlantı gelince gönderir. Belirli süre (ör. 5 dk) sinyal gelmezse operasyon ekibi uyarılır, kullanıcı bilgilendirilir; gerekirse sipariş yeniden atanır.

**4. ETA'yı nasıl hesaplarsın?** Kuryenin canlı konumu (Redis) ve müşteri adresiyle harita servisinden (Distance Matrix) trafik dâhil süre alınır. Buna restoranın hazırlama süresi, geçmiş teslimat verileri, hava durumu ve anlık yük eklenir. İleri seviyede bir makine öğrenmesi modeli bu özelliklerle tahmin yapar ve ETA periyodik güncellenir.

**5. Konumlar için veritabanını nasıl tasarlarsın?** Canlı konum sadece son değeriyle Redis'te (GEOADD) tutulur. Geçmiş konumlar zaman serisi olarak, zamana ve şehre göre bölümlenmiş bir tabloda saklanır (PostgreSQL partitioning, TimescaleDB veya Cassandra). Eski veriler belirli süre sonra arşivlenir.

**6. Sipariş iptallerini nasıl yönetirsin?** Durum makinesi hangi aşamada iptale izin verildiğini belirler. İptal, Saga deseniyle telafi işlemlerini tetikler: ödeme iadesi, restorana bildirim, kurye atamasının kaldırılması, kupon kullanımının geri alınması. İade tutarı aşamaya göre değişir (hazırlanmaya başlandıysa kısmi iade).

**7. Servisler arasında veri tutarlılığını nasıl sağlarsın?** Her servis kendi veritabanına sahiptir. Servisler arası işlemler için Saga deseni; olay kaybını önlemek için outbox deseni; tekrar işlemeyi önlemek için idempotent tüketiciler; anlık tutarlılığın gerekmediği yerlerde eventual consistency ve periyodik mutabakat işleri.

**8. Kupon ve kampanyalarda dolandırıcılığı nasıl önlersin?** Kullanıcı başına limit, cihaz parmak izi, telefon doğrulaması, doğrulama API'sinde rate limit, aynı adres/kart/cihazla açılmış çoklu hesap tespiti, şüpheli davranış skorlaması ve atomik kullanım sayacı.

**9. Gerçek zamanlı bildirim sistemini nasıl tasarlarsın?** Servisler olayları Kafka'ya yayınlar. Notification Service olayları tüketir, kullanıcı tercihlerine göre kanal seçer (push, SMS, e-posta, uygulama içi), şablonla mesajı oluşturur ve gönderir. Üstel geri çekilmeyle yeniden deneme, DLQ, alternatif kanala geçiş ve `order_id + status + channel` ile tekrar önleme yapılır.

**10. Başarıyı ölçmek için hangi metrikleri izlersin?** İş metrikleri: sipariş başarı oranı, ortalama teslimat süresi, iptal oranı, ortalama sipariş tutarı, kullanıcı tutma. Teknik metrikler: p95/p99 gecikme, hata oranı, çalışma süresi, önbellek isabet oranı, Kafka tüketici gecikmesi (consumer lag), WebSocket bağlantı sayısı.

### Ek mülakat soruları

**11. Monolit mi mikroservis mi ile başlarsın?** Küçük ekip ve yeni ürün için modüler monolitle başlarım; iş alanı sınırları netleşip ölçek sorunu ortaya çıkınca en çok yük alan modülü ayırırım.

**12. Kafka yerine neden doğrudan HTTP çağrısı kullanmıyorsun?** HTTP çağrısında çağrılan servis çökerse çağıran da etkilenir. Kafka servisleri ayırır, mesajları kalıcı tutar, tepe yükü tamponlar ve aynı olayı birden çok servisin dinlemesine izin verir.

**13. Redis çökerse ne olur?** Redis bir önbellek olarak kullanıldığı için asıl veri kaybolmaz; istekler veritabanına düşer. Bunu kaldırmak için Redis replikasyonu/Sentinel veya Cluster, veritabanına aşırı yükü önlemek için rate limiting ve kademeli önbellek doldurma kullanılır.

**14. Aynı ürünü son stokta iki kişi aynı anda alırsa?** Stok düşümü atomik yapılır: `UPDATE stock SET qty = qty - 1 WHERE id = $1 AND qty >= 1`. Etkilenen satır yoksa ikinci kullanıcıya "stok tükendi" denir. Alternatif olarak satır kilidi (`SELECT ... FOR UPDATE`) veya ödeme süresince stok rezervasyonu kullanılır.

**15. Bayram gibi tepe yüklere nasıl hazırlanırsın?** Geçmiş verilerle trafik tahmini, önceden yük testi, önceden ölçekleme (pre-scaling), otomatik ölçekleme, kritik olmayan özellikleri kapatma (graceful degradation), kuyruklarla yük tamponlama ve sıkı izleme.

## 19. Senin projen için yol haritası

Bu notlardaki fikirleri toptan gıda e-ticaret sitene aşamalı olarak uygulamak için önerilen sıra:

### Aşama 1: Temel (şimdi)

- Tek Node.js uygulaması (modüler monolit) + PostgreSQL.
- Modüller: auth, products, cart, orders, payments, customers, notifications.
- Sipariş durum makinesi ve idempotency anahtarı.
- iyzico/PayTR ile kart ödemesi + webhook imza doğrulaması; havale için dekont onayı.
- E-posta bildirimleri (sipariş onayı, kargo çıkışı).
- CI/CD ile otomatik test ve deploy.

### Aşama 2: Büyüme

- Redis: kategori sayfası, ürün listesi ve misafir sepeti önbelleği.
- CDN: ürün görselleri.
- Arka plan iş kuyruğu (BullMQ): e-posta, fatura PDF, katalog dışa aktarma.
- Kargo firması entegrasyonu ve takip zaman çizelgesi.
- Kademeli indirimler ve bayi kuponları.
- Ciroya dayalı bayi kademeleri.

### Aşama 3: Ölçek

- PostgreSQL okuma replikası.
- Tam metin arama için gerekirse Meilisearch/Elasticsearch.
- En yoğun modülün (ör. sipariş veya arama) ayrı servise çıkarılması.
- Olay güdümlü iletişim için kuyruk/Kafka.
- Gelişmiş izleme (Grafana, Sentry) ve p95 gecikme takibi.

:::callout{tone="info" title="Ana fikir"}
Zomato/Swiggy mimarisi milyonlarca kullanıcı için tasarlanmıştır. Senin için değerli olan teknolojiler değil, desenlerdir: durum makinesi, idempotency, webhook doğrulama, cache-aside, outbox, kademeli fiyatlama ve doğru metrikleri izlemek. Bunlar küçük bir sistemde de aynı şekilde işe yarar.
:::

## 20. Sonraki adımlar

Notların son bölümündeki öneriler:

- Bu sistemi 10–15 dakikada anlatabilecek şekilde pratik yap.
- Diyagramları (mimari, akış, veritabanı şeması) ezberden çizebil.
- Ödünleşimleri ve alternatifleri tartışmaya hazır ol.
- Gerçek dünya örnekleriyle ilişkilendir (Zomato / Swiggy, Türkiye'de Yemeksepeti / Getir / Trendyol Yemek).
- Sistemi nasıl iyileştirebileceğini düşün.
- Öğrenmeye ve merak etmeye devam et.

:::callout{tone="info"}
"İyi bir takip sistemi sadece teknolojiyle ilgili değildir; insanlarla, güvenle ve her siparişte mutluluk ulaştırmakla ilgilidir."
:::

## 21. Tek sayfalık özet

| Mimari bileşenler |  |
|---|---|
| **CDN** | Statik dosyaları yakından dağıtır |
| **Load Balancer** | Trafiği sunuculara dağıtır |
| **API Gateway** | Kimlik, rate limit, yönlendirme |
| **PostgreSQL** | Sipariş, ödeme: ACID, tutarlılık |
| **Redis** | Önbellek, sepet, GeoHash, PubSub |
| **Elasticsearch** | Tam metin + coğrafi arama |
| **Kafka** | Asenkron olay akışı, servisleri ayırır |
| **WebSocket** | Çift yönlü gerçek zamanlı bağlantı |

| Desenler |  |
|---|---|
| **State machine** | İzin verilen durum geçişleri |
| **Idempotency** | Tekrarlanan istek tek etki yaratır |
| **Saga** | Dağıtık işlem + telafi adımları |
| **Outbox** | Veri ve olay aynı transaction'da |
| **Cache-aside** | Önce önbellek, yoksa DB, sonra önbelleğe yaz |
| **Circuit breaker** | Arızalı servise istekleri geçici kes |
| **Exponential backoff** | Yeniden denemeyi katlayarak geciktir |
| **Dead Letter Queue** | Kalıcı hatalı mesajlar ayrı kuyrukta |
| **GeoHash** | Konumu önekli koda çevir, hızlı yakınlık araması |

| Ödünleşimler |  |
|---|---|
| **WebSocket / Polling** | Düşük gecikme / basitlik |
| **SQL / NoSQL** | Tutarlılık / esneklik ve ölçek |
| **Senkron / Asenkron** | Anında sonuç / ölçek + eventual consistency |
| **Önbellek** | Hız / bayat veri riski |
| **Mikroservis / Monolit** | Bağımsız ölçek / basitlik |
| **CAP** | Ödeme: tutarlılık · Konum: erişilebilirlik |

| Sayılar |
|---|
| Arama < 200 ms · Takip < 2 sn · Konum 5–10 sn'de bir · %99,99 ≈ yılda 52 dk kesinti · 500K kurye / 5 sn = 100K güncelleme/sn · Sepet TTL 30 dk · Menü önbelleği 5–15 dk |

:::quiz{src="quiz.json"}
:::

## Orijinal PDF sayfaları

:::callout{tone="info" title="Özgün görünüm"}
Bu dersin metni *Sistem Tasarimi Yemek Siparisi* PDF dosyasının 38–43. sayfalarının özgün hâlidir; sayfalar aşağıda PDF'teki görünümüyle yer alır.
:::

:::diagram{src="pdf-sayfa-38.png" alt="Sistem Tasarimi Yemek Siparisi - PDF sayfa 38"}
PDF sayfa 38 / 43
:::

:::diagram{src="pdf-sayfa-39.png" alt="Sistem Tasarimi Yemek Siparisi - PDF sayfa 39"}
PDF sayfa 39 / 43
:::

:::diagram{src="pdf-sayfa-40.png" alt="Sistem Tasarimi Yemek Siparisi - PDF sayfa 40"}
PDF sayfa 40 / 43
:::

:::diagram{src="pdf-sayfa-41.png" alt="Sistem Tasarimi Yemek Siparisi - PDF sayfa 41"}
PDF sayfa 41 / 43
:::

:::diagram{src="pdf-sayfa-42.png" alt="Sistem Tasarimi Yemek Siparisi - PDF sayfa 42"}
PDF sayfa 42 / 43
:::

:::diagram{src="pdf-sayfa-43.png" alt="Sistem Tasarimi Yemek Siparisi - PDF sayfa 43"}
PDF sayfa 43 / 43
:::

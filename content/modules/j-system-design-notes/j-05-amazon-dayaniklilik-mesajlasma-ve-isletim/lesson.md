---
id: j-05-amazon-dayaniklilik-mesajlasma-ve-isletim
slug: amazon-dayaniklilik-mesajlasma-ve-isletim
module: j-system-design-notes
order: 5
title:
  tr: "Amazon Ölçeğinde E-Ticaret Sistem Tasarımı: Dayanıklılık, Mesajlaşma ve İşletim"
  en: "Amazon-Scale E-Commerce System Design: Resilience, Messaging and Operations"
summary:
  tr: "Dayanıklılık desenleri, Kafka/RabbitMQ, kapasite hesabı ve Kubernetes ile sistemi ayakta tutmayı öğren."
  en: "Keep systems running with resilience patterns, Kafka/RabbitMQ messaging, capacity math and Kubernetes."
durationMinutes: 12
level: advanced
tags: [system-design, kafka, rabbitmq, kubernetes, observability, reliability]
prerequisites: []
concepts: [circuit-breaker, slo, canary-deploy, capacity-estimation, kafka-partition, dead-letter-queue, service-discovery, hpa]
---

## 11. Güvenilirlik ve Dayanıklılık

| Desen | Ne yapar |
|---|---|
| Timeout + retry (exponential backoff + jitter) | Yavaş servisi sonsuza kadar beklemez; tekrar denemeleri zamana yayar |
| Circuit breaker | Hata oranı yükselen servise bir süre istek göndermez, böylece hata zincirleme yayılmaz |
| Bulkhead | Kaynakları bölmelere ayırır; öneri servisinin yükü ödeme servisini etkilemez |
| Load shedding | Aşırı yükte düşük öncelikli istekleri bilinçli olarak reddeder |
| Chaos engineering | Canlıda bilerek sunucu öldürüp sistemin dayanıklılığını test eder |

**SLO hedefleri:** %99,99 erişilebilirlik yılda yaklaşık 52 dakika kesinti demektir. Ödeme ve sepet için en yüksek hedef konur, öneri servisi için daha düşük bir hedef yeterlidir.

## 12. Güvenlik

- OAuth2 / OpenID Connect; kısa ömürlü JWT erişim token'ı ve yenileme (refresh) token'ı.
- Her yerde TLS; servisler arasında mTLS. Gizli anahtarlar Vault ya da Secrets Manager'da tutulur.
- WAF ile SQL injection ve XSS koruması; bot yönetimi; giriş denemelerine rate limit.
- Kişisel veriler (KVKK/GDPR) şifrelenir, maskelenir ve erişimler denetim kaydına (audit log) yazılır.
- Sahtekarlık tespiti: ML skoru düşük olan siparişler manuel incelemeye düşer.

## 13. DevOps ve Gözlemlenebilirlik

- **CI/CD:** Commit atılır, testler çalışır, Docker imajı oluşturulur, staging ortamına gider, ardından **canary** deploy yapılır (trafiğin %1'i yeni sürüme, sonra %10, sonra %100). Amazon günde binlerce deploy yapar.
- **Feature flag:** Kod canlıya alınır ama özellik kapalı kalır; sonra kademeli olarak açılır.
- **Infrastructure as Code:** Terraform ya da CDK; tüm altyapı kod olarak tutulur.
- **Üç gözlem aracı:** Metrikler (Prometheus/Grafana), loglar (ELK) ve dağıtık izleme (Jaeger/OpenTelemetry). Her istek bir trace ID taşır, böylece 50 servis boyunca takip edilebilir.
- **On-call:** Alarm çaldığında servisin sahibi ekip müdahale eder: "You build it, you run it."

## 14. Kampanya Günü (Black Friday)

- Haftalar önce yük testi yapılır ve kapasite önceden artırılır (pre-scaling), çünkü otomatik ölçekleme ani patlamaya yetişemeyebilir.
- Sanal bekleme odası: Kullanıcılar sıraya alınır ve sisteme kontrollü hızda girer.
- Kampanya stoku Redis'e önceden yüklenir; DB'ye yazma işlemleri kuyruk üzerinden sırayla yapılır.
- Kritik olmayan özellikler (yorum yazma, gelişmiş filtreler) kill switch ile geçici olarak kapatılır.
- Kampanya günü kod dondurulur (code freeze) ve deploy yapılmaz.

## 15. Kapasite Hesabı (Kaba Tahmin)

:::code{lang="text"}
```text
Günlük aktif kullanıcı:      10.000.000
Kullanıcı başı istek:         ~50  → 500 milyon istek/gün
Ortalama QPS:                 500M / 86.400 ≈ 5.800 istek/sn
Tepe (x5–x10):                ~30.000–60.000 istek/sn
Okuma/yazma oranı:            ~100:1 → yazma tepe ≈ 500/sn
Günlük sipariş (%2 dönüşüm):  200.000 sipariş · satır ~2 KB → 400 MB/gün
Bir pod ~500 istek/sn işler   → tepe için ~100+ pod + %30 yedek
```
:::

Bu hesap neyin darboğaz olacağını gösterir: okumalar cache ve CDN ile çözülür, yazmalar ise DB, sharding ve kuyruklarla.

## 16. Mesajlaşma Sistemleri: Kafka, RabbitMQ, SQS

Büyük sistemlerin kan damarı mesaj kuyruklarıdır. Servisler birbirini doğrudan çağırmak yerine mesaj bırakır. Böylece bir servis yavaşlasa ya da çökse bile diğerleri çalışmaya devam eder, ani yük patlamaları kuyrukta birikip sırayla işlenir.

:::diagram{src="sekil-13.png" alt="Dört mesajlaşma deseni: Point-to-point (RabbitMQ, SQS), Pub/Sub (Kafka, SNS), Event sourcing (Kafka log) ve CQRS (Kafka + Elastic)"}
Şekil 13 – Mesajlaşma desenleri
:::

### Apache Kafka: dağıtık commit log

:::diagram{src="sekil-11.png" alt="Sipariş servisi (producer) 3 partition'lı orders topic'ine yazar; P0, P1, P2 partition'ları offset'li kalıcı log tutar; Stok consumer group'unda Stok-1 P0 ve P1'i, Stok-2 P2'yi, E-posta grubunda Mail-1 üç partition'ı da okur"}
Şekil 11 – Kafka: topic, partition, offset ve consumer group
:::

- **Topic:** Olay kategorisi (orders, payments, stock-changes).
- **Partition:** Topic'in paralel parçaları. Ölçek buradan gelir: 30 partition varsa 30 tüketici aynı anda okuyabilir. Sıra sadece partition içinde garanti edilir, bu yüzden aynı siparişin olayları aynı key (order_id) ile gönderilir.
- **Offset:** Mesajın log içindeki sıra numarası. Mesaj okununca silinmez. Tüketici nerede kaldığını offset ile hatırlar; gerekirse geri sarıp geçmiş olayları yeniden işleyebilir (replay).
- **Consumer group:** Aynı gruptaki tüketiciler partition'ları paylaşır. Farklı gruplar (Stok, E-posta, Analitik) aynı olayı birbirinden bağımsız olarak okur.
- **Broker ve replikasyon:** Her partition 3 broker'a kopyalanır (replication.factor=3, min.insync.replicas=2, acks=all). Bir broker çökse de veri kaybolmaz. Koordinasyon için yeni sürümlerde ZooKeeper yerine KRaft kullanılır.
- **Teslimat garantisi:** At-most-once, at-least-once (varsayılan) ve exactly-once (idempotent producer + transaction). Tüketici yine de idempotent yazılmalıdır.
- **Ekosistem:** Kafka Connect + Debezium ile DB değişiklikleri (CDC) olay olarak akar; Kafka Streams / Flink ile gerçek zamanlı işleme yapılır (örneğin anlık sahtekarlık tespiti, canlı satış panosu); Schema Registry (Avro/Protobuf) ile mesaj formatı sürümlenir.
- **Ölçek:** Saniyede milyonlarca mesaj. LinkedIn, Uber, Netflix ve Trendyol gibi şirketlerin olay omurgasıdır.

### RabbitMQ: akıllı yönlendiren mesaj kuyruğu

:::diagram{src="sekil-12.png" alt="Producer mesajı Exchange'e gönderir; exchange routing key'e göre q.email, q.sms ve q.invoice kuyruklarına dağıtır, her kuyruğun consumer'ı ACK verir; 3 denemede başarısız olan mesaj DLQ'ya düşer"}
Şekil 12 – RabbitMQ: exchange, routing key, queue, ACK ve Dead Letter Queue
:::

- **Exchange türleri:** direct (tam eşleşme), topic (`order.*` gibi desenler), fanout (herkese gönder), headers.
- **Queue + ACK:** Tüketici işi bitirince ACK gönderir ve mesaj silinir. ACK gelmezse mesaj başka bir tüketiciye verilir.
- **DLQ (Dead Letter Queue):** Defalarca başarısız olan mesaj ayrı bir kuyruğa düşer ve incelenir. Böylece bozuk bir mesaj tüm kuyruğu kilitlemez.
- **Prefetch, öncelik ve gecikmeli mesaj:** "30 dakika sonra ödenmemişse rezervasyonu iptal et" gibi işler için uygundur.
- **Tipik kullanım:** E-posta/SMS gönderimi, fatura PDF üretimi, görsel küçültme, iş kuyruğu (task queue).

### Karşılaştırma

|  | Kafka | RabbitMQ | AWS SQS / SNS |
|---|---|---|---|
| Model | Kalıcı log, pub/sub | Broker, kuyruk + yönlendirme | Yönetilen kuyruk (SQS) + yayın (SNS) |
| Okununca | Silinmez (retention süresi kadar) | ACK sonrası silinir | Silinir |
| Hız | Milyonlarca msg/sn | On binlerce msg/sn | Neredeyse sınırsız, yönetilen |
| Sıra | Partition içinde garanti | Kuyruk içinde (tek tüketicide) | FIFO kuyrukta garanti |
| Replay | Var | Yok | Yok |
| En iyi olduğu iş | Olay akışı, CDC, analitik, event sourcing | Görev kuyruğu, karmaşık yönlendirme | Operasyon yükü istemeyen ekipler |

:::callout{tone="info" title="Amazon'da nasıl?"}
Amazon kendi ürünleri olan SQS, SNS, Kinesis (Kafka'ya benzer akış servisi) ve EventBridge'i kullanır. Büyük şirketlerde tipik kurulum şudur: **Kafka olay omurgası** (sipariş, stok, ödeme olayları) ve **RabbitMQ/SQS iş kuyrukları** (bildirim, PDF, görsel işleme). Senin projen için başlangıçta RabbitMQ ya da Postgres tabanlı basit bir kuyruk (pg-boss, BullMQ+Redis) yeterlidir. Kafka'ya olay hacmi ve tüketici sayısı arttığında geçilir.
:::

:::callout{tone="warning" title="Mesajlaşmanın tuzakları:"}
Aynı mesaj iki kez gelebilir (idempotent tüketici yaz). Mesajların sırası bozulabilir (key ile partition seç). Zehirli mesajlar kuyruğu tıkayabilir (DLQ kullan). Tüketici gecikmesi (consumer lag) izlenmelidir. DB'ye yazma ile olay yayınlama atomik değildir (Outbox deseni kullan).
:::

## 17. Servisler Arası İletişim ve API'ler

| Protokol | Kullanım |
|---|---|
| REST / JSON | Dış dünyaya açık API'ler, mobil ve web |
| gRPC / Protobuf | Servisler arası hızlı, tip güvenli iç iletişim (HTTP/2) |
| GraphQL | Frontend'in tek istekle ihtiyacı kadar veri alması (BFF katmanında) |
| WebSocket / SSE | Canlı sipariş takibi, bildirim, canlı destek |
| Webhook | Ödeme sağlayıcısı ve kargo firmasının sana durum bildirmesi |

- **Service discovery:** Servisler birbirini IP ile değil isimle bulur (Kubernetes DNS, Consul).
- **API versiyonlama:** `/v1/` ve `/v2/` birlikte yaşar; eski mobil uygulamalar bozulmaz.
- **Load balancer algoritmaları:** Round robin, least connections, consistent hashing (aynı kullanıcı aynı cache düğümüne). L4 (TCP) ve L7 (HTTP, path bazlı yönlendirme) türleri vardır.
- **Sayfalama:** Büyük listelerde OFFSET yerine cursor tabanlı sayfalama kullanılır.

## 18. Konteyner ve Kubernetes

:::diagram{src="sekil-14.png" alt="3 AZ'li Kubernetes cluster: Ingress dış trafiği stok-svc Service'ine iletir, Service üç stok:v2 pod'una dağıtır; HPA CPU yüzde 70'i geçince pod ekler; ConfigMap ve Secret ayar ve şifreleri tutar"}
Şekil 14 – Kubernetes: Ingress, Service, Pod, HPA
:::

- **Docker:** Kod ve bağımlılıklar tek bir imajda paketlenir. "Benim makinemde çalışıyordu" sorunu biter.
- **Kubernetes:** Pod'ları sunuculara dağıtır, çökeni yeniden başlatır, yük artınca HPA ile kopya ekler. Cluster Autoscaler gerekirse yeni sunucu da açar.
- **Deploy stratejileri:** Rolling update, blue-green (iki ortam arasında anlık geçiş), canary.
- **Serverless alternatifi:** AWS Lambda gibi servislerle düzensiz işler (görsel küçültme, webhook işleme) sunucu yönetmeden çalıştırılır.

## 19. Bildirim, Medya ve Diğer Servisler

- **Bildirim servisi:** E-posta (SES/SendGrid), SMS, push (FCM/APNs). Kuyruktan beslenir; şablonlar, kullanıcı tercihleri, gönderim limitleri ve tekrar deneme bu servistedir.
- **Medya:** Satıcı görsel yükler, görsel S3'e gider, bir olay tetiklenir, farklı boyutlar ve WebP/AVIF sürümleri üretilir, sonra CDN'den sunulur. Yükleme, imzalı URL (presigned URL) ile doğrudan S3'e yapılır.
- **Zamanlanmış işler:** Rezervasyon temizliği, günlük raporlar, sepeti terk edenlere hatırlatma (cron, Airflow).
- **Dağıtık kilit ve ID üretimi:** Redis Redlock ya da etcd; çakışmasız sipariş numarası için Snowflake ID ya da UUIDv7.
- **Rate limiting algoritmaları:** Token bucket ve sliding window; sayaçlar Redis'te tutulur.
- **Veri analitiği:** Kafka'dan data lake'e akış; dashboard'lar, A/B testleri ve ML modelleri için kullanılır.

## 20. Senin Projen İçin Yol Haritası

| Aşama | Yapılacaklar |
|---|---|
| Şimdi | Modüler monolit; Postgres; stok için atomik UPDATE ve rezervasyon tablosu; ödemede idempotency key; günlük yedek |
| İlk büyüme | Frontend'i CDN'e al; backend'i stateless yap ve 2+ kopya çalıştır; Redis cache; okuma replikası; Sentry ve Grafana |
| Orta ölçek | Arama için Elasticsearch; e-posta/fatura gibi işleri RabbitMQ/BullMQ kuyruğuna taşı; Docker + Kubernetes; CI/CD |
| Büyük ölçek | Darboğaz olan modülleri (stok, ödeme, arama) servise ayır; Kafka; çoklu AZ, sonra çoklu bölge |

:::callout{tone="info" title="Özet:"}
Amazon'u Amazon yapan tek bir teknoloji değil; bağımsız ekipler, bağımsız servisler, her şeyin ölçülmesi ve "hata olacak" varsayımıyla tasarım yapılmasıdır. Kritik veride (stok, para) tutarlılık, geri kalan her yerde hız ve erişilebilirlik seçilir.
:::

:::quiz{src="quiz.json"}
:::

## Orijinal PDF sayfaları

:::callout{tone="info" title="Özgün görünüm"}
Bu dersin metni *Amazon Sistem Tasarimi* PDF dosyasının 9–14. sayfalarının özgün hâlidir; sayfalar aşağıda PDF'teki görünümüyle yer alır.
:::

:::diagram{src="pdf-sayfa-09.png" alt="Amazon Sistem Tasarimi - PDF sayfa 9"}
PDF sayfa 9 / 14
:::

:::diagram{src="pdf-sayfa-10.png" alt="Amazon Sistem Tasarimi - PDF sayfa 10"}
PDF sayfa 10 / 14
:::

:::diagram{src="pdf-sayfa-11.png" alt="Amazon Sistem Tasarimi - PDF sayfa 11"}
PDF sayfa 11 / 14
:::

:::diagram{src="pdf-sayfa-12.png" alt="Amazon Sistem Tasarimi - PDF sayfa 12"}
PDF sayfa 12 / 14
:::

:::diagram{src="pdf-sayfa-13.png" alt="Amazon Sistem Tasarimi - PDF sayfa 13"}
PDF sayfa 13 / 14
:::

:::diagram{src="pdf-sayfa-14.png" alt="Amazon Sistem Tasarimi - PDF sayfa 14"}
PDF sayfa 14 / 14
:::

:::next{lesson="j-06-giris-mimari-ve-siparis-akisi"}
:::

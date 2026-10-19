---
id: j-03-system-design-with-redis-and-kafka
slug: system-design-with-redis-and-kafka
module: j-system-design-notes
order: 3
title:
  tr: "Redis ve Kafka ile Sistem Tasarımı: Kapsamlı Notlar"
  en: "System Design with Redis & Kafka (Complete Notes)"
summary:
  tr: "Redis önbellekleme ve Kafka olay akışıyla ölçeklenebilir, dayanıklı sistemler tasarlamayı öğren."
  en: "Learn to design scalable, resilient systems with Redis caching and Kafka event streaming."
durationMinutes: 53
level: intermediate
tags: [system-design, redis, kafka, distributed-systems, caching, event-streaming]
prerequisites: []
concepts: [cap-theorem, cache-aside, eviction-policies, consistency-models, consumer-groups, partitions, delivery-guarantees, redis-cluster, log-compaction, dead-letter-queue]
---

:::callout{tone="info" title="Kaynak"}
Bu ders, **TheAgenticAIEngineer** tarafından hazırlanan *System Design with Redis & Kafka (Complete Notes)* not setinin 35 sayfasından oluşur. Sayfalar özgün hâliyle, değiştirilmeden yer alır; tüm hakları yazarına aittir. Kişisel çalışma notu olarak eklenmiştir.
:::

:::diagram{src="sayfa-01.jpg" alt="Kapak: System Design with Redis and Kafka, Complete Notes. İstemci, yük dengeleyici, Redis, Kafka, veritabanı ve servisler şeması; From Fundamentals to Production Systems sloganı."}
Sayfa 1 / 35 · SYSTEM DESIGN WITH REDIS & KAFKA (COMPLETE NOTES)
:::

## SYSTEM DESIGN SYLLABUS

:::diagram{src="sayfa-02.jpg" alt="12 modüllük müfredat: temeller, mimari, ağ, veritabanları, önbellekleme, dağıtık sistemler, mesajlaşma, ölçeklenebilirlik, depolama, güvenlik, gözlemlenebilirlik ve vaka çalışmaları."}
Sayfa 2 / 35 · SYSTEM DESIGN SYLLABUS
:::

## System Design Fundamentals (Part1)

:::diagram{src="sayfa-03.jpg" alt="Sistem tasarımı temelleri 1: tasarım temelleri, fonksiyonel ve fonksiyonel olmayan gereksinimler, ölçeklenebilirlik, erişilebilirlik, güvenilirlik, performans ve gecikme."}
Sayfa 3 / 35 · System Design Fundamentals (Part1)
:::

## System Design Fundamentals (Part2)

:::diagram{src="sayfa-04.jpg" alt="Sistem tasarımı temelleri 2: CAP teoremi ve CA, CP, AP örnekleri, dikey ve yatay ölçekleme, durumsuz ve durumlu sistemler, hangi ölçeklemenin ne zaman seçileceği tablosu."}
Sayfa 4 / 35 · System Design Fundamentals (Part2)
:::

## System Architecture (Part1)

:::diagram{src="sayfa-05.jpg" alt="Sistem mimarisi 1: monolitik mimari, API Gateway ve servis başına veritabanlı mikroservis mimarisi, katmanlı mimari ve istemci-sunucu mimarisi, her biri şemayla."}
Sayfa 5 / 35 · System Architecture (Part1)
:::

## System Architecture (Part2)

:::diagram{src="sayfa-06.jpg" alt="Sistem mimarisi 2: mesaj aracılı olay güdümlü mimari, servis odaklı mimari (SOA), senkron iletişimde istemci yanıt bekler, asenkron iletişimde mesaj kuyruğu kullanılır."}
Sayfa 6 / 35 · System Architecture (Part2)
:::

## Networking Fundamentals

:::diagram{src="sayfa-07.jpg" alt="Ağ temelleri: HTTP ve HTTPS, TCP/IP, DNS, IP adresi ve portlar, yük dengeleyiciler, Nginx gibi reverse proxy, WebSocket kalıcı bağlantısı, REST API ve gRPC karşılaştırması."}
Sayfa 7 / 35 · Networking Fundamentals
:::

## Databases

:::diagram{src="sayfa-08.jpg" alt="Veritabanları: SQL ve NoSQL, B-tree indeksleme, işlemler ve ACID, normalizasyon, replikasyon, sharding, partitioning, okuma replikaları ve kullanım durumuna göre veritabanı seçimi tablosu."}
Sayfa 8 / 35 · Databases
:::

## Caching (Part1)

:::diagram{src="sayfa-09.jpg" alt="Önbellekleme 1: önbellek temelleri, Redis bellek içi anahtar-değer veritabanı ve veri tipleri, Cache-Aside kalıbında okuma akışı (hit ve miss) ve yazma sonrası önbelleği geçersiz kılma."}
Sayfa 9 / 35 · Caching (Part1)
:::

## Caching (Part2)

:::diagram{src="sayfa-10.jpg" alt="Önbellekleme 2: Write-Through ve Write-Back, TTL, LRU, LFU, FIFO ve Random tahliye politikaları, önbellek geçersiz kılma yöntemleri ve Redis Cluster ile dağıtık önbellekleme."}
Sayfa 10 / 35 · Caching (Part2)
:::

## Distributed Systems (Part1)

:::diagram{src="sayfa-11.jpg" alt="Dağıtık sistemler 1: temel kavramlar, güçlü, nihai, nedensel tutarlılık gibi tutarlılık modelleri, lider-takipçi mimarisi ve Paxos, Raft, Zab uzlaşma algoritmaları."}
Sayfa 11 / 35 · Distributed Systems (Part1)
:::

## Distributed Systems (Part2)

:::diagram{src="sayfa-12.jpg" alt="Dağıtık sistemler 2: iki aşamalı commit ve Saga ile dağıtık işlemler, idempotency, hata toleransı, üstel geri çekilmeli retry ve timeout, Closed, Open, Half-Open durumlu circuit breaker."}
Sayfa 12 / 35 · Distributed Systems (Part2)
:::

## Messaging & Event Systems (Part1)

:::diagram{src="sayfa-13.jpg" alt="Mesajlaşma 1: mesaj kuyruğu üretici ile tüketiciyi ayırır, Kafka topic ve partition yapısı, exchange ve kuyruklu RabbitMQ, paralel çalışan üretici ve tüketiciler."}
Sayfa 13 / 35 · Messaging & Event Systems (Part1)
:::

## Messaging & Event Systems (Part2)

:::diagram{src="sayfa-14.jpg" alt="Mesajlaşma 2: Pub/Sub, olay akışı, tüketici grupları, dead letter queue, mesaj sıralaması ve at most once, at least once, exactly once teslim garantileri."}
Sayfa 14 / 35 · Messaging & Event Systems (Part2)
:::

## Module 8: Scalability & Reliability (Part1)

:::diagram{src="sayfa-15.jpg" alt="Ölçeklenebilirlik ve güvenilirlik 1: yük dengeleme algoritmaları, metriklere göre otomatik ölçekleme, Token Bucket gibi algoritmalarla hız sınırlama ve 429 yanıtı, backpressure."}
Sayfa 15 / 35 · Module 8: Scalability & Reliability (Part1)
:::

## Module 8: Scalability & Reliability (Part2)

:::diagram{src="sayfa-16.jpg" alt="Ölçeklenebilirlik ve güvenilirlik 2: replikasyon, aktif-pasif failover, RTO ve RPO ile felaket kurtarma, tam ve artımlı yedekleme, yedek sunuculu yüksek erişilebilirlik."}
Sayfa 16 / 35 · Module 8: Scalability & Reliability (Part2)
:::

## Storage & File Systems (Part1)

:::diagram{src="sayfa-17.jpg" alt="Depolama ve dosya sistemleri 1: düz yapıda nesne depolama (S3, Blob), sunucuya bağlanan sabit boyutlu blok depolama (EBS), klasörlü paylaşımlı dosya depolama (NFS, EFS) ve S3 kavramları."}
Sayfa 17 / 35 · Storage & File Systems (Part1)
:::

## Storage & File Systems (Part2)

:::diagram{src="sayfa-18.jpg" alt="Depolama ve dosya sistemleri 2: uç konumlarda önbellekleyen CDN, paralel parçalı multipart upload, Standard, IA, Glacier, Deep Archive veri yaşam döngüsü ve başarısız parçaları sürdüren büyük dosya yönetimi."}
Sayfa 18 / 35 · Storage & File Systems (Part2)
:::

## Security (Part1)

:::diagram{src="sayfa-19.jpg" alt="Güvenlik 1: önce kimlik doğrulama sonra yetkilendirme, OAuth 2.0 ve OIDC ile Google girişi akışı, header, payload ve signature içeren JWT, rollere izin atayan RBAC (Admin, Editor, Viewer)."}
Sayfa 19 / 35 · Security (Part1)
:::

## Security (Part2)

:::diagram{src="sayfa-20.jpg" alt="Güvenlik 2: API Gateway ve WAF ile API güvenliği, AES ve RSA ile şifreleme, AWS Secrets Manager ve Vault ile gizli bilgi yönetimi, VPC ve firewall ile ağ güvenliği, 429 dönen hız sınırlama."}
Sayfa 20 / 35 · Security (Part2)
:::

## Redis Fundamentals

:::diagram{src="sayfa-21.jpg" alt="Redis temelleri: açık kaynak, bellek içi anahtar-değer deposu, neden Redis, master ve okuma replikaları ile RDB, AOF kalıcılığı, anahtar-değer modeli, komut tablosu ve Redis ile veritabanı karşılaştırması."}
Sayfa 21 / 35 · Redis Fundamentals
:::

## Redis Data Types

:::diagram{src="sayfa-22.jpg" alt="Redis veri tipleri ve örnek komutlar: Strings (SET, GET, INCR), Lists (LPUSH, LRANGE), Sets (SADD), Hashes (HSET, HGETALL), Sorted Sets ile liderlik tablosu (ZADD) ve Streams (XADD, XREADGROUP)."}
Sayfa 22 / 35 · Redis Data Types
:::

## Redis Caching

:::diagram{src="sayfa-23.jpg" alt="Redis ile önbellekleme: önbellek temelleri, Cache-Aside (Lazy Loading), Write-Through, Write-Back (Write-Behind), SET EX ve PERSIST ile TTL, noeviction, allkeys-lru, volatile-ttl gibi tahliye politikaları."}
Sayfa 23 / 35 · Redis Caching
:::

## Redis Advanced Features

:::diagram{src="sayfa-24.jpg" alt="Redis ileri özellikler: kanallarla Pub/Sub, MULTI ve EXEC ile atomik işlemler, Python örnekli pipeline, EVAL ile Lua script'leri, SET NX EX ile dağıtık kilit ve en iyi uygulamalar."}
Sayfa 24 / 35 · Redis Advanced Features
:::

## Redis Persistence & Reliability

:::diagram{src="sayfa-25.jpg" alt="Redis kalıcılık ve güvenilirlik: RDB anlık görüntü (SAVE, BGSAVE), fsync politikalı AOF, REPLICAOF ile replikasyon, master izleyen Redis Sentinel ve replikayı yeni master yapan otomatik failover."}
Sayfa 25 / 35 · Redis Persistence & Reliability
:::

## Redis Scaling

:::diagram{src="sayfa-26.jpg" alt="Redis ölçekleme: çok düğümlü Redis Cluster, CRC16 tabanlı sharding, 0-16383 arası 16384 hash slot, replika terfisiyle yüksek erişilebilirlik ve önbellek, oturum, liderlik tablosu gibi kullanım alanları."}
Sayfa 26 / 35 · Redis Scaling
:::

## Kafka Fundamentals

:::diagram{src="sayfa-27.jpg" alt="Kafka temelleri: dağıtık olay akışı platformu ve neden Kafka, broker küme mimarisi, ZooKeeper veya KRaft, topic'ler, sıralı ve değişmez log olan partition'lar, partitioner kullanan üreticiler, tüketici grupları."}
Sayfa 27 / 35 · Kafka Fundamentals
:::

## Kafka Producer & Consumer

:::diagram{src="sayfa-28.jpg" alt="Kafka üretici ve tüketici: mesaj, partitioner ve ack ile üretici akışı, poll, işle, commit tüketici döngüsü, partition paylaşan tüketici grupları, __consumer_offsets ile offset ve rebalancing."}
Sayfa 28 / 35 · Kafka Producer & Consumer
:::

## Kafka Reliability & Delivery

:::diagram{src="sayfa-29.jpg" alt="Kafka güvenilirlik ve teslim: partition replikasyonu, lider-takipçi ve lider seçimi, acks 0, 1, all tablosu, yalnızca partition içinde sıralama, at-most-once, at-least-once ve exactly-once."}
Sayfa 29 / 35 · Kafka Reliability & Delivery
:::

## Kafka Storage & Management

:::diagram{src="sayfa-30.jpg" alt="Kafka depolama ve yönetim: segment dosyalarında append-only log, zamana ve boyuta göre retention, anahtar başına son değeri tutan log compaction, partition sayısını artırma ve tüketici offset yönetimi."}
Sayfa 30 / 35 · Kafka Storage & Management
:::

## Kafka Advanced

:::diagram{src="sayfa-31.jpg" alt="Kafka ileri konular: üstel geri çekilmeli retry mekanizmaları, başarısız mesajlar için Dead Letter Topic (DLT), serileştirme ve doğrulama hatalarının yönetimi, Kafka Streams ve olay güdümlü mimari."}
Sayfa 31 / 35 · Kafka Advanced
:::

## Kafka in System Design (Part 1)

:::diagram{src="sayfa-32.jpg" alt="Sistem tasarımında Kafka 1: kaynaklardan tüketicilere gerçek zamanlı olay akışı, bir olayı birden çok servisin okuduğu Pub/Sub, saniyede milyonlarca mesajla yüksek verim, broker ekleyerek ölçekleme."}
Sayfa 32 / 35 · Kafka in System Design (Part 1)
:::

## Kafka in System Design (Part 2)

:::diagram{src="sayfa-33.jpg" alt="Sistem tasarımında Kafka 2: replikasyon ve yeni lider seçimiyle hata toleransı, Kafka ile Redis'i birleştiren gerçek zamanlı mimari ve örnek gerçek zamanlı sipariş işleme sistemi."}
Sayfa 33 / 35 · Kafka in System Design (Part 2)
:::

## zomato System Design

:::diagram{src="sayfa-34.jpg" alt="Zomato sistem tasarımı: istemciler, DNS ve yük dengeleyici, API Gateway, kullanıcı, restoran, sipariş, teslimat mikroservisleri, veri katmanı, Kafka olay akışı, gerçek zamanlı işleme ve izleme."}
Sayfa 34 / 35 · zomato System Design
:::

:::diagram{src="sayfa-35.jpg" alt="Kapanış sayfası: PDF'i almak için takip edip yorum yapma çağrısı. TheAgenticAIEngineer logosu, Learn. Build. Automate. Grow. sloganı, PDF simgesi ve AI, LLMs, RAG, Agents konu etiketleri."}
Sayfa 35 / 35 · FOLLOW & COMMENT TO GET THE PDF
:::

:::quiz{src="quiz.json"}
:::

:::next{lesson="j-04-amazon-mimari-veri-ve-siparis-akisi"}
:::

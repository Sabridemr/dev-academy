---
id: j-01-must-know-system-design-patterns
slug: must-know-system-design-patterns
module: j-system-design-notes
order: 1
title:
  tr: "Bilinmesi Gereken 15 Sistem Tasarımı Kalıbı"
  en: "Top 15 Must-Know System Design Patterns"
summary:
  tr: "Load balancer'dan saga'ya 15 temel sistem tasarımı kalıbını ne zaman ve neden kullanacağını öğren."
  en: "Learn when and why to use 15 core system design patterns, from load balancing to sagas."
durationMinutes: 23
level: intermediate
tags: [system-design, backend, distributed-systems, microservices, scalability, interview-prep]
prerequisites: []
concepts: [load-balancer, caching, database-replication, database-sharding, message-queue, event-driven-architecture, api-gateway, circuit-breaker, cqrs, saga-pattern]
---

:::callout{tone="info" title="Kaynak"}
Bu ders, **@abhi_techhub** tarafından hazırlanan *Top 15 Must-Know System Design Patterns* not setinin 15 sayfasından oluşur. Sayfalar özgün hâliyle, değiştirilmeden yer alır; tüm hakları yazarına aittir. Kişisel çalışma notu olarak eklenmiştir.
:::

:::diagram{src="sayfa-01.jpg" alt="Kapak: Top 15 Must-Know System Design Patterns. Internet, load balancer, app sunucuları, cache, veritabanı ve kuyruk şeması; neden öğrenmeli listesi ve 15 konuluk içindekiler."}
Sayfa 1 / 15 · Top 15 Must-Know System Design Patterns
:::

## 1 LOAD BALANCER

:::diagram{src="sayfa-02.jpg" alt="Load Balancer: trafiği birden çok sunucuya dağıtır. Health check, SSL termination, routing. Algoritmalar: Round Robin, Least Connections, IP Hash, Weighted Round Robin. İpucu: AWS ELB, Nginx, HAProxy."}
Sayfa 2 / 15 · 1 LOAD BALANCER
:::

## 2 CACHING

:::diagram{src="sayfa-03.jpg" alt="Caching: sık erişilen veriyi bellekte tutar. Kalıplar: Cache Aside, Read Through, Write Through, Write Back. LRU tahliye politikası. Popüler araçlar: Redis, Memcached, Amazon ElastiCache."}
Sayfa 3 / 15 · 2 CACHING
:::

## 3 DATABASE REPLICATION

:::diagram{src="sayfa-04.jpg" alt="Database Replication: aynı veri birden çok sunucuda. Yazmalar primary'ye, okumalar replikalardan. Senkron (güçlü tutarlılık) ve asenkron (nihai tutarlılık) replikasyon; zorluk: replikasyon gecikmesi."}
Sayfa 4 / 15 · 3 DATABASE REPLICATION
:::

## 4 DATABASE SHARDING

:::diagram{src="sayfa-05.jpg" alt="Database Sharding: büyük veritabanını shard denen parçalara böler. Shard key (user_id, region). Stratejiler: range, hash, directory tabanlı. Zorluklar: shardlar arası join ve yeniden sharding."}
Sayfa 5 / 15 · 4 DATABASE SHARDING
:::

## 5 MESSAGE QUEUE

:::diagram{src="sayfa-06.jpg" alt="Message Queue: producer ile consumer'ı ayırarak asenkron iletişim sağlar. RabbitMQ, Kafka, AWS SQS, Pub/Sub, Redis Streams. Teslim garantileri: at most once, at least once, exactly once. Dead letter queue."}
Sayfa 6 / 15 · 5 MESSAGE QUEUE
:::

## 6 EVENT-DRIVEN ARCHITECTURE

:::diagram{src="sayfa-07.jpg" alt="Event-Driven Architecture: servisler olay üretip tüketir, birbirini doğrudan çağırmaz. Event bus örneği: OrderPlaced olayı ödeme, stok ve bildirim servislerine gider. Domain ve integration olayları."}
Sayfa 7 / 15 · 6 EVENT-DRIVEN ARCHITECTURE
:::

## 7 API GATEWAY

:::diagram{src="sayfa-08.jpg" alt="API Gateway: tüm istemci istekleri için tek giriş noktası. Görevler: kimlik doğrulama, rate limiting, yönlendirme, yanıt birleştirme, izleme. Kong, AWS API Gateway, Apigee. Zorluk: tek hata noktası."}
Sayfa 8 / 15 · 7 API GATEWAY
:::

## 8 CIRCUIT BREAKER

:::diagram{src="sayfa-09.jpg" alt="Circuit Breaker: başarısız olması muhtemel çağrıların tekrarlanmasını engeller. Durumlar: CLOSED, OPEN, HALF-OPEN. Eşik aşılınca devre açılır, zaman aşımı sonrası test edilir. Fail fast, recover fast."}
Sayfa 9 / 15 · 8 CIRCUIT BREAKER
:::

## 9. CQRS (Command Query Responsibility Segregation)

:::diagram{src="sayfa-10.jpg" alt="CQRS: okuma ve yazma işlemlerini ayrı modellere ayırır. Command tarafı normalize Write DB, Query tarafı denormalize Read DB kullanır; olaylarla güncellenir. Kullanım: e-ticaret, bankacılık, raporlama."}
Sayfa 10 / 15 · 9. CQRS (Command Query Responsibility Segregation)
:::

## 10. SAGA PATTERN

:::diagram{src="sayfa-11.jpg" alt="Saga Pattern: mikroservisler arası dağıtık işlemde veri tutarlılığı. Her adım yerel işlem, hata olursa telafi işlemleriyle geri alınır. Türler: Choreography (merkezsiz) ve Orchestration (merkezi)."}
Sayfa 11 / 15 · 10. SAGA PATTERN
:::

## 11. RATE LIMITING

:::diagram{src="sayfa-12.jpg" alt="Rate Limiting: istemci istek hızını sınırlayarak kötüye kullanımı önler. Algoritmalar: Fixed Window Counter, Sliding Window Log, Sliding Window Counter, Token Bucket. Uygulama yeri: API gateway, uygulama, CDN."}
Sayfa 12 / 15 · 11. RATE LIMITING
:::

## 12. DISTRIBUTED LOCK

:::diagram{src="sayfa-15.jpg" alt="Distributed Lock: bir işlemi aynı anda tek örneğin yapmasını sağlar. Redis ile SET NX PX, benzersiz değer (UUID), güvenli bırakma için Lua. TTL şart. Redlock algoritması: çoğunluk (N/2+1) onayı."}
Sayfa 13 / 15 · 12. DISTRIBUTED LOCK
:::

## 13. SERVICE DISCOVERY

:::diagram{src="sayfa-13.jpg" alt="Service Discovery: servislerin dinamik ortamda birbirini bulmasını sağlar. Service registry, kayıt ve heartbeat. Araçlar: Eureka, Consul, Zookeeper. Eureka örnek akışı ve client-side ile server-side keşif."}
Sayfa 14 / 15 · 13. SERVICE DISCOVERY
:::

## 14. CDN (Content Delivery Network)

:::diagram{src="sayfa-14.jpg" alt="CDN: statik içeriği kullanıcıya yakın edge sunuculardan sunar; yoksa origin'den alıp önbelleğe koyar. Ayrıca 9-14 arası kalıplar için özet tablo (System Design Patterns Cheat Sheet) ve hızlı ipuçları."}
Sayfa 15 / 15 · 14. CDN (Content Delivery Network)
:::

:::quiz{src="quiz.json"}
:::

:::next{lesson="j-02-system-design-notes-part-1"}
:::

---
id: a-09-message-queues-event-driven
slug: message-queues-event-driven
module: a-system-design-fundamentals
order: 9
title:
  tr: "Mesaj Kuyrukları ve Event-Driven Mimari"
  en: "Message Queues and Event-Driven Architecture"
summary:
  tr: Kafka, RabbitMQ, SQS; pub/sub, dead-letter queue, idempotency.
  en: Kafka, RabbitMQ, SQS; pub/sub, dead-letter queues, idempotency.
durationMinutes: 30
level: intermediate
tags: [message-queue, kafka, rabbitmq, sqs, event-driven, async]
prerequisites: [a-03-horizontal-vertical-scaling, a-06-api-gateway]
concepts: [message-queue, pub-sub, topic-partition, consumer-group, delivery-guarantees, at-least-once, dead-letter-queue, retry-backoff, idempotency, backpressure, kafka-vs-rabbitmq]
---

## Kavram: işi hemen yapmak zorunda değilsin

Bir sipariş oluşturulduğunda fatura kesilecek, stok düşülecek, e-posta gidecek, öneri modeli güncellenecek. Bunların hepsini HTTP isteğinin içinde senkron yaparsak: (1) kullanıcı dört servisin toplam gecikmesini bekler, (2) e-posta servisi çökerse sipariş de başarısız olur, (3) Black Friday'de dört servis birden aynı anda ezilir.

**Mesaj kuyruğu (message queue)**, üreticinin (producer) işi bir aracıya (broker) bırakıp hemen dönmesini, tüketicinin (consumer) ise işi kendi hızında almasını sağlar. Bu üç şeyi birden kazandırır:

- **Decoupling (ayrıştırma)** — üretici tüketicinin adresini, sayısını, hatta var olup olmadığını bilmez.
- **Buffering (tamponlama)** — ani trafik dalgası kuyrukta birikir; tüketiciler sabit hızda çalışır.
- **Dayanıklılık** — tüketici çökse bile mesaj kaybolmaz; geri gelince kaldığı yerden devam eder.

Bedeli de vardır: **eventual consistency** (sipariş oluştu ama fatura henüz yok), hata ayıklamanın zorlaşması ve "mesaj iki kez işlenirse ne olur?" sorusu. Bu dersin yarısı bu soruya ayrılmıştır.

## İki temel model: kuyruk ve pub/sub

| | **Point-to-point kuyruk** | **Pub/Sub (yayınla/abone ol)** |
|---|---|---|
| Mesajı kim alır? | Rekabet eden tüketicilerden **yalnızca biri** | **Her abone** kendi kopyasını alır |
| Kullanım | İş dağıtımı (görüntü işleme, e-posta gönderimi) | Olay yayını (OrderCreated → fatura, stok, analitik) |
| Örnek | SQS standard queue, RabbitMQ work queue | Kafka topic + consumer group'lar, SNS, RabbitMQ fanout exchange |

Kafka ikisini tek modelde birleştirir: bir **topic** birden çok **consumer group** tarafından bağımsız okunur (pub/sub); grup içindeki tüketiciler ise partition'ları paylaşır (kuyruk).

:::diagram{src="diagram.svg" alt="Üreticiler, partition'lara bölünmüş bir topic, iki bağımsız consumer group ve retry/dead-letter kuyrukları|Producers, a topic split into partitions, two independent consumer groups and retry/dead-letter queues"}
Aynı topic'i iki grup (billing, analytics) bağımsız okur; grup içinde her partition tek bir tüketiciye düşer. Başarısız mesajlar retry topic'ine, oradan da DLQ'ya gider.
:::

## Kafka, RabbitMQ, SQS: hangisi ne zaman?

| | **Apache Kafka** | **RabbitMQ** | **Amazon SQS** |
|---|---|---|---|
| Model | Dağıtık, bölümlenmiş **commit log**; mesajlar tüketilince silinmez | Akıllı broker, **exchange → queue** yönlendirme (AMQP) | Yönetilen kuyruk; sunucu yok |
| Sıralama | Partition içinde garanti | Kuyruk içinde (tek tüketiciyle) | Standard: best-effort; **FIFO**: message group içinde |
| Tekrar okuma (replay) | **Evet** — offset geri alınır, retention gün/hafta | Hayır — ack'lenen mesaj gider | Hayır — silinene kadar görünürlük zaman aşımı |
| Verim | Milyonlarca mesaj/s, sıralı disk yazımı | On binlerce–yüz binlerce/s | Pratikte sınırsız (standard), FIFO: 3.000 msg/s/grup |
| Yönlendirme | Basit (topic + key) | Zengin (routing key, topic, header, fanout) | Basit; SNS ile fan-out |
| Tüketici modeli | Pull, offset istemcide | Push, ack/nack broker'da | Pull, visibility timeout |
| İşletme yükü | Yüksek (self-hosted) / yönetilen (MSK, Confluent) | Orta | Yok |
| İyi olduğu yer | Event streaming, log toplama, CDC, yüksek hacim | Görev kuyrukları, karmaşık yönlendirme, RPC benzeri desenler | AWS içinde hızlı başlangıç, düşük operasyon |

Kısa kural: **"Olayları saklayıp birden çok tüketiciye yeniden oynatmam gerekiyor"** → Kafka. **"İşleri dağıtıp bitince silmem yeterli, yönlendirme kuralları önemli"** → RabbitMQ. **"AWS'deyim, sunucu yönetmek istemiyorum"** → SQS (+ SNS).

## Topic, partition, consumer group

Kafka'da bir topic *N* partition'a bölünür. Üretici mesajı bir **anahtarla** (key) gönderirse `partition = hash(key) mod N` ile hep aynı partition'a düşer; anahtarsız mesajlar round-robin dağılır. Bu iki sonuç doğurur:

1. **Sıralama yalnızca partition içinde** garantidir. Aynı siparişin olayları (`OrderCreated`, `OrderPaid`, `OrderShipped`) `orderId` anahtarıyla aynı partition'a düşer ve sırayla işlenir; farklı siparişler arasında sıra garantisi yoktur ve buna gerek de yoktur.
2. **Paralellik = partition sayısı.** Bir consumer group'ta her partition aynı anda tek bir tüketiciye atanır. 3 partition varsa 4. tüketici boş oturur. Partition sayısı en başta cömert seçilir çünkü sonradan artırmak anahtar→partition eşlemesini bozar.

Her tüketici işlediği son mesajın **offset**'ini commit eder. Tüketici çökerse grup **rebalance** olur, partition başka tüketiciye geçer ve o tüketici son commit edilen offset'ten devam eder — yani commit edilmemiş mesajlar **tekrar** teslim edilir.

:::animation{scene="scene.json"}
Anahtara göre partition seçimi, consumer group ataması, başarısız mesaj → backoff ile retry → dead-letter queue ve tekrar teslimde idempotency kontrolü.
:::

## Teslim garantileri

| Garanti | Nasıl elde edilir? | Sonuç |
|---|---|---|
| **At-most-once** | Offset'i işlemeden *önce* commit et | Mesaj kaybolabilir, asla tekrar etmez (metrik örnekleme, log) |
| **At-least-once** | Offset'i işledikten *sonra* commit et | Mesaj kaybolmaz, **tekrar edebilir** (varsayılan ve en yaygın) |
| **Exactly-once** | Transactional producer + idempotent consumer + offset'i iş sonucuyla aynı transaction'da yaz | Pahalı; genellikle "at-least-once + idempotent tüketici" ile aynı etki, daha ucuz |

Pratik kural: **at-least-once teslimat + idempotent işleme = etkili exactly-once.** Mesaj kuyruğu "tam bir kez teslim" edemez; ama siz "tam bir kez etki" sağlayabilirsiniz.

## Hata yönetimi: retry, backoff, dead-letter queue

Bir tüketici mesajı işleyemediğinde (ödeme servisi 503 döndü) üç seçenek vardır:

1. **Hemen tekrar dene** — geçici ağ hatası için yeterli, ama servis gerçekten çöktüyse kuyruk tıkanır (head-of-line blocking).
2. **Üstel geri çekilme (exponential backoff) ile tekrar dene** — 1 s, 2 s, 4 s, 8 s... ve biraz rastgelelik (jitter). Kafka'da bu genellikle `orders.retry.1m`, `orders.retry.10m` gibi **retry topic'leri** ile, SQS'te `maxReceiveCount` ile, RabbitMQ'da TTL'li ölü-harf değişimiyle yapılır.
3. **Dead-letter queue (DLQ)** — *N* denemeden sonra mesaj ana akıştan çıkarılıp ayrı bir kuyruğa konur. Ana kuyruk akmaya devam eder; DLQ izlenir, alarm üretir, hata düzeltilince mesajlar **yeniden oynatılır** (replay).

:::callout{tone="warning" title="DLQ'ya alarm bağlamadıysanız DLQ yok demektir"}
Dead-letter queue sessizce dolan bir çöp kutusu değil, bir **olay**dır. Boyutu > 0 olduğunda sayfalayan bir alarm ve mesajları inceleyip tekrar kuyruğa atan bir araç olmadan DLQ, kaybolan siparişlerin saklandığı yerden ibaret kalır.
:::

## Idempotency: aynı mesaj iki kez gelirse

At-least-once dünyasında tüketici şu soruyu her zaman sormalıdır: *"Bunu daha önce işledim mi?"* Üç teknik:

- **Idempotency key**: Her mesajın benzersiz bir kimliği (`messageId`, `orderId + eventType`) vardır. Tüketici işlemeden önce bu anahtarı bir depoya (Redis `SET NX`, DB unique index) yazar; yazamıyorsa daha önce işlenmiştir, atlar.
- **Doğal idempotent işlemler**: `UPDATE stock SET qty = 10` idempotenttir, `UPDATE stock SET qty = qty - 1` değildir. Mümkünse "mutlak değer ata" semantiği seçin.
- **Sürüm/koşul kontrolü**: `UPDATE orders SET status='PAID' WHERE id=? AND status='CREATED'` — ikinci çalıştırma 0 satır etkiler.

:::code{lang="ts" title="Idempotent Kafka tüketicisi: Redis SET NX + işle + offset commit"}
```ts
import { Kafka } from "kafkajs";
import Redis from "ioredis";

const redis = new Redis();
const kafka = new Kafka({ clientId: "billing", brokers: ["kafka:9092"] });
const consumer = kafka.consumer({ groupId: "billing" });

const IDEMPOTENCY_TTL_SEC = 7 * 24 * 3600;   // tekrar teslim penceresinden uzun olmalı

interface OrderPaid { eventId: string; orderId: string; amount: number }

async function issueInvoice(evt: OrderPaid) { /* DB'ye fatura yaz, PDF üret ... */ }

await consumer.connect();
await consumer.subscribe({ topic: "orders.paid", fromBeginning: false });

await consumer.run({
  autoCommit: false,                                  // offset'i BİZ, işledikten sonra commit edeceğiz
  eachMessage: async ({ topic, partition, message }) => {
    const evt = JSON.parse(message.value!.toString()) as OrderPaid;
    const key = `idem:billing:${evt.eventId}`;

    // 1) Anahtarı atomik olarak rezerve et; zaten varsa bu mesaj daha önce işlendi
    const reserved = await redis.set(key, "processing", "EX", IDEMPOTENCY_TTL_SEC, "NX");
    if (reserved === null) {
      console.log(`tekrar teslim atlandı: ${evt.eventId}`);
    } else {
      try {
        await issueInvoice(evt);                      // 2) asıl iş
        await redis.set(key, "done", "EX", IDEMPOTENCY_TTL_SEC);
      } catch (err) {
        await redis.del(key);                         // iş başarısız → rezervasyonu bırak, retry işleyebilsin
        throw err;                                    // kafkajs mesajı yeniden dener; N denemeden sonra DLQ'ya yolla
      }
    }

    // 3) Offset'i ancak şimdi commit et (at-least-once)
    await consumer.commitOffsets([{ topic, partition, offset: (BigInt(message.offset) + 1n).toString() }]);
  },
});
```
```python
import json, redis
from confluent_kafka import Consumer

r = redis.Redis()
c = Consumer({"bootstrap.servers": "kafka:9092", "group.id": "billing",
              "enable.auto.commit": False, "auto.offset.reset": "latest"})
c.subscribe(["orders.paid"])
TTL = 7 * 24 * 3600

def issue_invoice(evt): ...

while True:
    msg = c.poll(1.0)
    if msg is None or msg.error():
        continue
    evt = json.loads(msg.value())
    key = f"idem:billing:{evt['eventId']}"
    if r.set(key, "processing", ex=TTL, nx=True):      # ilk kez görüyoruz
        try:
            issue_invoice(evt)
            r.set(key, "done", ex=TTL)
        except Exception:
            r.delete(key)                               # rezervasyonu bırak, retry işlesin
            raise
    else:
        print("tekrar teslim atlandı", evt["eventId"])
    c.commit(msg)                                       # işledikten SONRA commit
```
:::

:::interactive{type="message-queue" producers=2 consumers=2 partitions=3 failureRate=0.15 maxRetries=3}
Üretici hızını artırıp kuyruğun (consumer lag) nasıl büyüdüğünü izleyin; tüketici ekleyince lag'in nasıl eridiğini görün. Hata oranını yükseltin: kaç mesaj retry'dan sonra DLQ'ya düşüyor? Partition sayısından fazla tüketici eklemenin işe yaramadığını doğrulayın.
:::

## Backpressure ve consumer lag

Üretici tüketiciden hızlıysa kuyruk sonsuza kadar büyümez: disk dolar (Kafka retention), bellek biter (RabbitMQ) ya da mesajlar görünmez olur (SQS). İzlenecek metrik **consumer lag**'dir (son üretilen offset − son commit edilen offset). Lag büyüyorsa seçenekler: tüketici (ve partition) sayısını artırmak, toplu işleme (batching), ya da üreticiyi yavaşlatmak (backpressure) — örneğin API'ye 429 döndürmek.

:::realworld{company="Uber"}
Uber'in platformu günde trilyonlarca Kafka mesajı taşır; sürüş olayları, konum güncellemeleri ve ödeme akışları bu omurgadan geçer. Mühendislik ekibi başarısız mesajların ana topic'i tıkamaması için **katmanlı retry topic'leri** (`topic.retry.1`, `topic.retry.2` … her biri artan gecikmeyle) ve en sonda bir **dead-letter topic** kullanır; tüketici bir mesajı işleyemezse mesajı bir sonraki retry topic'ine yazar ve ana akışa hemen döner, böylece sağlıklı mesajlar beklemez. DLQ'daki mesajlar bir kontrol panelinden incelenir, hata giderilince toplu olarak ana topic'e **yeniden yayınlanır**. Ödeme tarafında her olayın benzersiz kimliği idempotency anahtarı olarak kullanılır; aynı ödeme olayı iki kez gelse bile müşteriden iki kez para çekilmez.
:::

:::callout{tone="tip" title="Mülakat özeti"}
- Senkron çağrıyı kuyruğa çevirdiğinizde üç şeyi söyleyin: **neden** (decoupling/buffering), **bedeli** (eventual consistency) ve **tekrar teslimi nasıl ele aldığınız** (idempotency key).
- "Sıralama gerekiyor mu?" sorusuna cevap: *partition key = sıralamanın anlamlı olduğu varlık* (orderId, userId).
- Hata akışı: retry + exponential backoff + jitter → DLQ + alarm + replay. Bunu çizmeden tasarım bitmez.
- Kafka = saklanan log, yeniden oynatılabilir; RabbitMQ/SQS = işlenip silinen görevler.
:::

:::quiz{src="quiz.json"}
:::

:::next{lesson="a-10-rate-limiting"}
Sırada: backpressure'ın en bilinen biçimi — rate limiting. Token bucket'tan sliding window'a, dağıtık sayaçlara kadar istek sınırlama algoritmaları.
:::

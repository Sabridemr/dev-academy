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
durationMinutes: 35
level: intermediate
tags: [system-design, redis, kafka, caching, event-streaming, distributed-systems, interview-prep]
prerequisites: [a-07-caching, a-09-message-queues-event-driven, j-02-system-design-notes-part-1]
concepts: [redis-data-structures, cache-aside, rate-limiter, distributed-lock, redis-persistence, redis-cluster, kafka-partitions, consumer-groups, replication-isr, idempotent-producer, dead-letter-topic, log-compaction, event-driven-order-flow]
---

## Kavram: bellek hızında durum, disk dayanıklılığında olay

Önceki derste bir mülakatın üçüncü ve dördüncü adımında "yapı taşlarını gerekçeyle yerleştirmek" gerektiğini gördük. Bu derste en sık başvurulan iki yapı taşını yakından tanıyacağız. **Redis**, verinin tamamını bellekte tutan ve mikrosaniyeler içinde yanıt veren bir veri yapısı sunucusudur; sıcak veriyi, sayaçları ve kısa ömürlü durumu barındırır. **Kafka**, olayları diske sıralı olarak yazan ve onları birden fazla tüketiciye bağımsız biçimde dağıtan bir olay akışı platformudur; servisleri birbirinden ayırır ve tepe trafiği yumuşatır.

İkisi rakip değil, tamamlayıcıdır: Redis "şu anda ne durumdayız?" sorusuna, Kafka "ne oldu ve kim bundan haberdar olmalı?" sorusuna cevap verir. Dersin sonunda ikisini aynı sipariş akışında birlikte kullanacağız.

## Redis veri yapıları ve tipik kullanımları

Redis'i yalnızca anahtar-değer önbelleği olarak düşünmek, en değerli yanını kaçırmaktır. Her anahtarın bir **veri yapısı** vardır ve bu yapı üzerinde atomik işlemler sunucu tarafında çalışır. Doğru yapıyı seçmek, uygulama kodundan onlarca satır ve bir yarış koşulu eksiltir.

| Yapı | Ne tutar | Tipik komutlar | Sistem tasarımında kullanım |
|---|---|---|---|
| String | Metin, sayı, ikili veri | `SET`, `GET`, `INCR`, `SET NX PX` | Önbellek girdisi, sayaç, dağıtık kilit, oturum belirteci |
| Hash | Alan → değer haritası | `HSET`, `HGET`, `HINCRBY` | Kullanıcı profili, sepet, ürün özeti (tek anahtar, çok alan) |
| List | Sıralı dizi, iki uçtan erişim | `LPUSH`, `RPOP`, `LRANGE` | Basit iş kuyruğu, son N etkinlik |
| Set | Tekil üyeler | `SADD`, `SISMEMBER`, `SINTER` | Takipçi kümesi, etiketler, "bugün görülen" tekilleştirme |
| Sorted Set | Skorla sıralı üyeler | `ZADD`, `ZRANGE`, `ZRANK` | Liderlik tablosu, zaman penceresi, öncelik kuyruğu |
| Stream | Ekle-yalnız kayıt günlüğü | `XADD`, `XREADGROUP`, `XACK` | Hafif olay akışı, tüketici grupları |

Birkaç kullanım kalıbı üzerinden düşünelim:

- **Önbellek**: `product:123` anahtarında ürün JSON'u, 10 dakikalık TTL ile. Okuma/yazma oranı yüksek her veri için ilk aday.
- **Oturum**: `session:<token>` hash'inde kullanıcı kimliği ve roller; sunucular durumsuz kalır, yük dengeleyici dilediği sunucuya yollar.
- **Sayaç**: `INCR views:post:42` tek bir atomik komutla, kilitsiz sayar.
- **Liderlik tablosu**: `ZINCRBY leaderboard 10 user:7` ile puan ekle, `ZREVRANGE leaderboard 0 9` ile ilk onu getir; sıralama Redis'te, uygulamada değil.
- **Rate limiter**: `INCR rl:<kullanıcı>:<dakika>` ve ilk artışta `EXPIRE 60`; sayaç limiti aşınca 429 döndür. Daha pürüzsüz bir kayan pencere için Sorted Set'te zaman damgaları tutulur.
- **Dağıtık kilit**: `SET lock:order:9 <rastgele-değer> NX PX 5000`; yalnızca anahtar yoksa yazılır ve 5 saniye sonra kendiliğinden düşer. Serbest bırakırken değerin kendi değeriniz olduğunu Lua ile doğrulamak, başka birinin kilidini silmenizi engeller.

:::interactive{type="cache" capacity=5 policy="lru" writePolicy="write-through"}
Beş slotlu bir Redis önbelleği düşünün. Anahtarlara tıklayarak okuyun; altıncı farklı anahtarda LRU'nun hangi anahtarı kurban seçtiğini izleyin. "Rastgele 10 okuma" ile hit oranını ölçün, sonra politikayı LFU'ya çevirip aynı trafikte oranın nasıl değiştiğini karşılaştırın. Yazma politikasını write-through'dan cache-aside'a alıp "DB yazma" sayacının ve kirli slotların davranışını gözleyin.
:::

:::code{lang="python" title="Dağıtık kilit: güvenli alma ve bırakma"}
```python
import uuid
import redis

r = redis.Redis()

RELEASE = """
if redis.call('GET', KEYS[1]) == ARGV[1] then
  return redis.call('DEL', KEYS[1])
end
return 0
"""

def acquire(key: str, ttl_ms: int = 5000) -> str | None:
    token = uuid.uuid4().hex
    # NX: yalnızca anahtar yoksa yaz; PX: ms cinsinden otomatik süre
    ok = r.set(key, token, nx=True, px=ttl_ms)
    return token if ok else None

def release(key: str, token: str) -> bool:
    # Lua betiği atomik çalışır: "benim kilidim mi?" ve "sil" arasına kimse giremez
    return bool(r.eval(RELEASE, 1, key, token))

token = acquire("lock:order:9")
if token:
    try:
        ...  # siparişi işle (TTL'den kısa sürmeli)
    finally:
        release("lock:order:9", token)
```
```ts
import { randomUUID } from 'node:crypto';
import Redis from 'ioredis';

const r = new Redis();
const RELEASE = `
if redis.call('GET', KEYS[1]) == ARGV[1] then
  return redis.call('DEL', KEYS[1])
end
return 0`;

export async function acquire(key: string, ttlMs = 5000) {
  const token = randomUUID();
  const ok = await r.set(key, token, 'PX', ttlMs, 'NX'); // yalnızca anahtar yoksa
  return ok === 'OK' ? token : null;
}

export async function release(key: string, token: string) {
  return (await r.eval(RELEASE, 1, key, token)) === 1; // atomik "benimse sil"
}
```
:::

:::callout{tone="warning" title="Kilidin süresi işten kısa olursa"}
TTL, kilidi tutan süreç çökerse sistemin kilitli kalmamasını sağlar; ama iş TTL'den uzun sürerse kilit düşer ve ikinci bir süreç aynı işi paralel yapmaya başlar. Bu yüzden kritik işlerde kilit süresini uzatan bir "kalp atışı" ya da kilidin yanında veritabanında koşullu güncelleme (`UPDATE ... WHERE version = ?`) kullanılır. Tek Redis düğümündeki kilit, failover sırasında da kaybolabilir; mutlak güvence gereken yerde kilidi veritabanına bırakın.
:::

## Kalıcılık: RDB ve AOF

Redis bellekte çalışır ama süreç yeniden başladığında verinin yok olması çoğu senaryoda kabul edilemez. İki kalıcılık mekanizması vardır:

**RDB (snapshot)**, belirli aralıklarla (örneğin "5 dakikada en az 100 değişiklik olduysa") tüm veri setinin sıkıştırılmış bir anlık görüntüsünü diske yazar. Dosya küçüktür, yeniden başlatma hızlıdır ve yedekleme için idealdir; ancak son anlık görüntüden sonraki dakikalar kaybedilebilir.

**AOF (append-only file)**, her yazma komutunu bir günlüğe ekler. `fsync` politikası `everysec` ise en fazla bir saniyelik veri kaybı riski vardır; `always` ise her komutta disk senkronu yapılır ve gecikme artar. Dosya zamanla büyüdüğü için Redis arka planda yeniden yazarak sıkıştırır.

Üretimde yaygın seçim **ikisini birlikte** açmaktır: AOF güncel, RDB taşınabilir yedek sağlar. Yalnızca önbellek olarak kullanılan bir Redis'te kalıcılığı tamamen kapatmak da meşru bir tercihtir; veri zaten veritabanından yeniden üretilebilir.

## Yüksek erişilebilirlik: Sentinel ve Cluster

Tek bir Redis süreci tek hata noktasıdır. İki farklı sorun için iki farklı araç vardır:

**Sentinel**, *erişilebilirlik* sorununu çözer. Bir ana düğüm ve bir ya da daha fazla replika vardır; Sentinel süreçleri ana düğümü izler, erişilemez olduğunda çoğunlukla karar verip bir replikayı ana düğüme terfi ettirir ve istemcilere yeni adresi duyurur. Veri seti hâlâ tek makinenin belleğine sığmalıdır.

**Cluster**, *kapasite* sorununu çözer. Anahtar uzayı 16.384 hash slotuna bölünür ve slotlar düğümlere dağıtılır; her düğümün kendi replikaları vardır, failover kümenin içinde gerçekleşir. Bedeli şudur: farklı slotlardaki anahtarları aynı işlemde kullanamazsınız (hash tag `{user:7}` ile aynı slota zorlanabilir) ve istemcinin yönlendirmeyi (`MOVED`) anlaması gerekir.

Mülakatta "Redis'i nasıl ölçeklersiniz?" sorusuna cevap şudur: önce okuma için replika, erişilebilirlik için Sentinel ya da yönetilen servis, veri bellek sınırını aşınca Cluster.

## Kafka: topic, partition ve offset

Kafka'da her olay bir **topic**'e yazılır. Topic, mantıksal bir isimdir (`orders`); fiziksel saklama birimi ise **partition**'dır. Her partition, diskte ekle-yalnız (append-only) bir günlüktür ve her kaydın partition içinde artan bir **offset**'i vardır. Sıralama garantisi yalnızca **partition içindedir**; aynı siparişin olaylarının sıralı kalmasını istiyorsanız, hepsini aynı anahtarla (`orderId`) üretirsiniz; Kafka anahtarı hash'leyip aynı partition'a düşürür.

Partition sayısı, paralelliğin üst sınırıdır: bir consumer group içinde en fazla partition sayısı kadar consumer çalışabilir. Üç partition'lı bir topic'e beş consumer bağlarsanız ikisi boş bekler. Bu yüzden partition sayısı, beklenen tepe üretim hızı ve tüketicinin işleme süresi düşünülerek baştan seçilir; sonradan artırmak mümkündür ama anahtar → partition eşlemesini bozar.

Kafka kayıtları okunduktan sonra silmez; **retention** süresi (örneğin 7 gün) ya da boyutu dolana kadar tutar. Bu, yeni bir tüketicinin geçmişi baştan okuyabilmesi ve hatalı bir tüketicinin offset'ini geri alıp yeniden işleyebilmesi demektir.

## Producer, consumer ve consumer group

**Producer**, kaydı bir anahtar ve değerle gönderir; `acks` ayarı ne kadar onay bekleyeceğini belirler. `acks=0` onay beklemez, `acks=1` yalnızca lider yazınca döner, `acks=all` senkron replikaların tamamı yazınca döner.

**Consumer**, bir partition'dan offset sırasıyla okur ve işlediği yeri **commit** eder. Commit edilen offset, consumer yeniden başladığında kaldığı yerden devam etmesini sağlar. Commit zamanlaması teslim garantisini belirler: işlemeden önce commit edilirse "en fazla bir kez" (kayıp olabilir), işledikten sonra commit edilirse "en az bir kez" (tekrar olabilir).

**Consumer group**, aynı `group.id` ile çalışan consumer'ların kümesidir. Topic'in partition'ları grup üyelerine paylaştırılır; her partition grup içinde yalnızca bir consumer tarafından okunur. Farklı gruplar ise aynı topic'i **bağımsız** okur ve kendi offset'lerini tutar: envanter servisi ile bildirim servisi aynı `orders` topic'ini birbirinden habersiz tüketir. Bir consumer gruptan ayrılır ya da kalp atışı kesilirse **rebalance** tetiklenir ve partition'lar kalan üyelere yeniden dağıtılır; bu sırada kısa bir duraklama olur ve son commit'ten sonraki kayıtlar yeni sahibi tarafından yeniden okunabilir.

## Replication ve ISR

Her partition'ın bir **lideri** ve yapılandırılan replikasyon faktörü kadar (genelde 3) kopyası vardır; üretim ve tüketim liderden yapılır, takipçiler lideri kopyalar. Lideri yakından takip eden replikalar **ISR** (in-sync replicas) kümesini oluşturur. `acks=all` ile birlikte `min.insync.replicas=2` ayarlandığında bir yazma, en az iki kopyaya ulaşmadan onaylanmaz; lider çökse bile ISR'den seçilen yeni lider veriyi kaybetmez. ISR, iki replikanın altına düşerse Kafka yazmayı reddeder; bu, dayanıklılığı erişilebilirliğe tercih eden bilinçli bir tasarımdır.

## Teslim garantileri: idempotent producer ve exactly-once

Ağ hatasında producer yeniden gönderim yapar; onay gelmemiş ama lider yazmışsa kayıt **çiftlenir**. **Idempotent producer** (`enable.idempotence=true`) her partition için bir üretici kimliği ve sıra numarası taşır; broker aynı sıra numarasını ikinci kez görünce kaydı sessizce atar. Böylece tek bir partition'a yazma "tam olarak bir kez" olur.

Birden fazla partition'a ya da "oku-işle-yaz" zincirine exactly-once vermek için **transaction** API'si kullanılır: consumer offset commit'i ile üretilen kayıtlar aynı işlemde atomik olarak kesinleşir. Bu, Kafka'dan Kafka'ya akışlarda (Kafka Streams) güçlü bir garanti sağlar; ancak akışın sonunda veritabanına yazan ya da e-posta gönderen bir tüketici varsa, garanti Kafka'nın sınırında biter. Pratik kural: **at-least-once + idempotent tüketici**. Tüketici, işlediği olay kimliğini (Redis'te `SET NX` ya da veritabanında tekil kısıt) kaydeder ve aynı olayı ikinci kez görünce atlar.

## Dead letter topic ve log compaction

Bir kayıt bozuk JSON içeriyorsa ya da işlenirken her seferinde aynı hatayı veriyorsa, tüketiciyi sonsuza dek bloke etmemelidir. Birkaç yeniden denemeden sonra kayıt, hata bilgisiyle birlikte bir **dead letter topic**'e (`orders.DLT`) yazılır ve ana akış devam eder. Operasyon ekibi DLT'yi izler, kök nedeni düzeltir ve kayıtları yeniden oynatır. Yeniden denemeler arasında üstel gecikme (backoff) kullanmak, geçici hataların kendiliğinden geçmesine izin verir.

**Log compaction**, retention'ın alternatifidir: Kafka her anahtar için yalnızca **en son değeri** tutar, eski değerleri arka planda temizler. Bu, topic'i bir "değişiklik günlüğü" yerine "güncel durum tablosu" hâline getirir: `product-prices` topic'ini baştan okuyan yeni bir servis her ürünün son fiyatını elde eder, tarihçenin tamamını değil. Kafka'nın kendi `__consumer_offsets` topic'i de bu şekilde çalışır.

## Birlikte: sipariş olayı mimarisi

Şimdi bir e-ticaret sipariş akışında ikisini birleştirelim. Kullanıcı "Siparişi tamamla" dediğinde:

1. **API / sipariş servisi** isteğin `Idempotency-Key` başlığını Redis'te `SET NX` ile kaydeder; aynı anahtar tekrar gelirse önceki yanıtı döner, çift sipariş oluşmaz.
2. Stok için Redis'te `DECRBY stock:sku:42 1` atomik olarak çalışır; sonuç negatifse geri alınır ve kullanıcıya "tükendi" denir. Bu, veritabanına gitmeden milisaniyeler içinde verilen bir ön karardır; kesin stok kaydı yine veritabanındadır.
3. Sipariş veritabanına yazılır ve `OrderCreated` olayı `orders` topic'ine, anahtarı `orderId` olacak şekilde üretilir (`acks=all`, idempotent producer).
4. **Envanter** consumer group'u olayı okur, kalıcı stok düşümünü yapar; **bildirim** grubu aynı olayı bağımsız okuyup SMS/e-posta gönderir; **analitik** grubu veri ambarına yazar. Hiçbiri diğerini beklemez.
5. Her tüketici, işlediği `eventId`'yi Redis'te 24 saatlik TTL ile saklar; rebalance sonrası aynı olay ikinci kez gelirse atlanır.

:::diagram{src="diagram.svg" alt="Sipariş olayı mimarisi: istemci API gateway üzerinden sipariş servisine gelir; sipariş servisi Redis'te idempotency anahtarı ve stok sayacı kullanır, veritabanına yazar ve OrderCreated olayını üç partition'lı Kafka orders topic'ine üretir; envanter, bildirim ve analitik consumer group'ları topic'i bağımsız okur, hatalı kayıtlar dead letter topic'e gider|Order event architecture: a client reaches the order service through the API gateway; the service uses Redis for an idempotency key and a stock counter, writes to the database and produces an OrderCreated event to the three-partition Kafka orders topic; inventory, notification and analytics consumer groups read the topic independently and failing records go to a dead letter topic"}
Redis senkron yolda hızlı kararlar verir, Kafka asenkron yolda servisleri ayrıştırır.
:::

:::animation{scene="scene.json"}
OrderCreated olayının partition'a yazılması, iki consumer group'un bağımsız okuması ve bir consumer düştüğünde rebalance.
:::

:::interactive{type="message-queue" partitions=3 consumers=2 producers=2 failureRate=0.1 idempotent=true}
İki üretici, üç partition ve iki tüketici ile başlayın; "5 mesaj üret" düğmesiyle akışı başlatın ve günlükte yeniden deneme ile ACK kaybı satırlarını bulun. "Idempotent tüketici" kutusunu kapatıp aynı trafiği tekrar üretin: "Çift işleme" sayacının artışı, idempotency anahtarı olmadan at-least-once teslimatın bedelidir. Hata oranını yükseltip "Maks. yeniden deneme" sınırını düşürerek kaç mesajın DLQ'ya gittiğini izleyin.
:::

:::code{lang="python" title="OrderCreated: idempotent producer ve tekilleştiren tüketici"}
```python
import json
import redis
from confluent_kafka import Producer, Consumer

r = redis.Redis()

producer = Producer({
    "bootstrap.servers": "kafka:9092",
    "enable.idempotence": True,   # PID + sıra numarası: broker tekrarları atar
    "acks": "all",                # ISR'deki tüm replikalar yazmadan onay yok
})

def publish_order_created(order: dict) -> None:
    producer.produce(
        "orders",
        key=order["orderId"],     # aynı sipariş → aynı partition → sıralı
        value=json.dumps({"eventId": order["eventId"], **order}),
    )
    producer.flush()

consumer = Consumer({
    "bootstrap.servers": "kafka:9092",
    "group.id": "inventory",      # bildirim servisi farklı group.id kullanır
    "enable.auto.commit": False,  # önce işle, sonra commit: at-least-once
})
consumer.subscribe(["orders"])

while True:
    msg = consumer.poll(1.0)
    if msg is None or msg.error():
        continue
    event = json.loads(msg.value())
    # 24 saatlik tekilleştirme: rebalance sonrası aynı olay gelirse atla
    if not r.set(f"seen:inventory:{event['eventId']}", 1, nx=True, ex=86_400):
        consumer.commit(msg)
        continue
    reserve_stock(event)          # kalıcı stok düşümü (DB)
    consumer.commit(msg)
```
```ts
import { Kafka } from 'kafkajs';
import Redis from 'ioredis';

const kafka = new Kafka({ brokers: ['kafka:9092'] });
const r = new Redis();

const producer = kafka.producer({ idempotent: true }); // acks=-1 (all) ile birlikte zorunlu
export async function publishOrderCreated(order: { orderId: string; eventId: string }) {
  await producer.send({
    topic: 'orders',
    messages: [{ key: order.orderId, value: JSON.stringify(order) }],
  });
}

const consumer = kafka.consumer({ groupId: 'inventory' });
await consumer.subscribe({ topic: 'orders' });
await consumer.run({
  autoCommit: false,
  eachMessage: async ({ message, partition, topic }) => {
    const event = JSON.parse(message.value!.toString());
    const fresh = await r.set(`seen:inventory:${event.eventId}`, 1, 'EX', 86_400, 'NX');
    if (fresh) await reserveStock(event); // tekrar gelen olay atlanır
    await consumer.commitOffsets([{ topic, partition, offset: (Number(message.offset) + 1).toString() }]);
  },
});
```
:::

:::realworld{company="Getir"}
Getir gibi dakikalar içinde teslimat vadeden bir hızlı ticaret uygulamasında, bu dersteki iki yapı taşı tam olarak iki farklı ihtiyaca karşılık gelir. Kullanıcı uygulamayı açtığında bulunduğu bölgedeki deponun ürün listesi ve stok durumu milisaniyeler içinde gelmelidir; bu, bölge bazlı anahtarlarla önbelleklenen ve stok değiştikçe güncellenen Redis'in işidir. Sipariş verildiğinde ise toplama, kurye atama, müşteri bildirimi ve raporlama gibi birbirinden bağımsız işler tetiklenir; bunların birbirini beklememesi ve biri geçici olarak yavaşladığında diğerlerinin etkilenmemesi için olay akışı kullanılır. Kampanya anlarında sipariş yazma hızı aniden yükseldiğinde tüketiciler kendi hızlarında ilerler, kuyruk gecikmesi izlenir ve gerekirse consumer sayısı partition sayısına kadar artırılır. Genel bilgi düzeyindeki bu örnek, Redis'in "şu anki durum", Kafka'nın "olan biten" rolünü somutlaştırır.
:::

:::callout{tone="tip" title="Mülakat özeti"}
- Redis'te **veri yapısını** söyleyin: "önbellek koyarım" değil, "ürünü hash'te, liderlik tablosunu sorted set'te, rate limiter'ı TTL'li sayaçta tutarım".
- Kafka'da üç soruya hazır olun: **sıra** (anahtar → partition), **tekrar** (at-least-once + idempotent tüketici) ve **arıza** (acks=all, ISR, rebalance).
- İkisini birleştirirken sınırı çizin: Redis senkron yolda hızlı karar, Kafka asenkron yolda ayrıştırma; kalıcı gerçek her zaman veritabanında.
:::

:::quiz{src="quiz.json"}
:::

:::next{lesson="j-04-amazon-mimari-veri-ve-siparis-akisi"}
Sırada: bu yapı taşlarının Amazon ölçeğinde bir e-ticaret mimarisinde nasıl bir araya geldiği — veri katmanı, çift satışı önleme ve Saga ile sipariş akışı.
:::

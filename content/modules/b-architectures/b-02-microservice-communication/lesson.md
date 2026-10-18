---
id: b-02-microservice-communication
slug: microservice-communication
module: b-architectures
order: 2
title:
  tr: "Mikroservis İletişimi: Sync/Async, Saga, CQRS, Event Sourcing"
  en: "Microservice Communication: Sync/Async, Saga, CQRS, Event Sourcing"
summary:
  tr: REST/gRPC vs. event; saga koreografi/orkestrasyon; CQRS ve event sourcing.
  en: REST/gRPC vs. events; saga choreography/orchestration; CQRS and event sourcing.
durationMinutes: 35
level: advanced
tags: [microservices, rest, grpc, event-driven, saga, cqrs, event-sourcing, messaging]
prerequisites: [b-01-monolith-to-microservices, a-09-message-queues-event-driven]
concepts: [sync-vs-async, rest-vs-grpc, temporal-coupling, saga, choreography, orchestration, compensating-transaction, cqrs, event-sourcing, idempotency, eventual-consistency]
---

## Kavram: ağ üzerinden konuşmanın bedeli

Monolitte iki modül fonksiyon çağrısıyla konuşurdu: ya sonuç döner ya da istisna fırlar, ikisi de anındadır. Servisler ayrılınca araya **ağ** girer ve üçüncü bir sonuç ortaya çıkar: **bilinmiyor**. İstek gitti mi? İşlendi mi ama yanıt mı kayboldu? Bu belirsizlik, mikroservis iletişimindeki her tasarım kararının kökündedir.

İletişim iki eksende sınıflandırılır:

- **Senkron / asenkron**: Çağıran, yanıtı bekleyip bloklanıyor mu?
- **Bire bir / bire çok**: Mesaj tek bir alıcıya mı (istek-yanıt, komut) yoksa ilgilenen herkese mi (olay) gidiyor?

| | Senkron (istek-yanıt) | Asenkron (mesaj/olay) |
|---|---|---|
| Örnek | REST, gRPC, GraphQL | Kafka, RabbitMQ, SQS, NATS |
| Zamansal bağlaşıklık | **Yüksek**: alıcı o anda ayakta olmalı | **Düşük**: alıcı sonra işleyebilir |
| Gecikme | Düşük, öngörülebilir | Değişken (kuyruk derinliğine bağlı) |
| Hata davranışı | Zincirleme çökme riski | Kuyruk şişer, ama üretici çalışır |
| Tutarlılık | Yanıt anında kesin | Nihai tutarlılık (eventual) |
| Hata ayıklama | Kolay (tek trace) | Zor (dağınık, zamana yayılmış) |
| Uygun olduğu yer | Sorgular, kullanıcı beklerken gereken veri | İş akışları, bildirimler, fan-out, ağır işler |

:::diagram{src="diagram.svg" alt="Üstte senkron REST/gRPC çağrı zinciri ve zaman aşımı; altta broker üzerinden asenkron olay yayını ve birden çok tüketici|Top: a synchronous REST/gRPC call chain with a timeout; bottom: asynchronous event publishing via a broker to multiple consumers"}
Aynı "sipariş verildi" akışı: senkron zincirde en yavaş halka herkesi bekletir; olay modelinde üretici yayınlar ve devam eder.
:::

## Senkron: REST mi gRPC mi?

| | REST (HTTP/JSON) | gRPC (HTTP/2 + Protobuf) |
|---|---|---|
| Sözleşme | OpenAPI (genelde sonradan yazılır) | `.proto` dosyası zorunlu, kod üretilir |
| Yük biçimi | Metin JSON, büyük, okunabilir | İkili, küçük, hızlı serileştirme |
| Akış | İstek-yanıt (SSE ile tek yönlü akış) | Tek/çift yönlü streaming yerleşik |
| Tarayıcı desteği | Doğal | gRPC-Web proxy gerekir |
| Tipik kullanım | Dışa açık API, BFF | Servisler arası dahili çağrılar |

Pratik kural: **dışarıya REST, içeriye gRPC**. Her iki durumda da üç şey zorunludur: **timeout** (yanıt gelmezse kaç ms sonra vazgeçileceği), **retry** yalnızca idempotent işlemler için ve **circuit breaker** (c-04 dersinde).

:::callout{tone="warning" title="Senkron zincir = çarpılan hata olasılıkları"}
A, B'yi; B, C'yi; C, D'yi senkron çağırıyorsa ve her servis %99,9 erişilebilirse, A'nın gördüğü erişilebilirlik 0,999⁴ ≈ **%99,6**'dır; gecikmeler toplanır, zaman aşımları iç içe geçer. Derin senkron zincirler dağıtık monolitin ta kendisidir. Çözüm: zinciri kısaltmak (veri kopyası tutmak), asenkron olaya çevirmek ya da BFF'de paralel çağırmak.
:::

## Asenkron: komut mu, olay mı?

- **Komut (command)**: "Şunu yap." Tek alıcıya gider, gönderen bir sonuç bekler (eşzamansız da olsa). `ChargePayment`.
- **Olay (event)**: "Şu oldu." Geçmiş zamandadır, gönderen kimin dinlediğini bilmez. `OrderPlaced`.

Olaylar servisleri en gevşek bağlar: yeni bir tüketici (ör. sadakat puanı servisi) eklemek için üreticiye dokunulmaz. Bedeli, **nihai tutarlılık** ve **en az bir kez teslim**'dir: aynı olay iki kez gelebilir, bu yüzden tüketiciler **idempotent** olmalıdır (mesaj id'sini işlenenler tablosunda tutmak en yaygın yöntem).

:::interactive{type="message-queue" producers=2 consumers=3 pattern="pub-sub" delivery="at-least-once" failureRate=0.1 showDeadLetter=true}
Üreticiler sipariş olayları yayınlasın. Tüketici sayısını azaltıp kuyruk derinliğinin nasıl büyüdüğünü, hata oranını yükseltip yeniden teslimlerin (redelivery) ve dead-letter kuyruğunun nasıl dolduğunu izleyin. "at-least-once" modunda aynı mesajın iki kez işlendiğini yakalayın.
:::

## Saga: dağıtık transaction'ın yerine geçen şey

Sipariş vermek üç servisi ilgilendirir: Orders siparişi oluşturur, Inventory stoğu ayırır, Payments kartı çeker. Monolitte bu tek bir ACID transaction'dı. Üç ayrı veritabanında bunu yapacak **iki fazlı commit (2PC)** kullanmak pratikte reddedilir: kilitler ağ boyunca tutulur, koordinatör tek hata noktasıdır ve çoğu modern depo (Kafka, DynamoDB, çoğu NoSQL) 2PC desteklemez.

**Saga**, uzun transaction'ı yerel transaction'lar dizisine böler: T1 → T2 → T3. Herhangi bir Tᵢ başarısız olursa, önceki adımlar **telafi edici (compensating) transaction'larla** geri alınır: C₂ → C₁. Telafi, "geri alma" (rollback) değildir — zaten commit edilmiş bir şeyin **iş kuralına göre tersidir**: stok ayırma → stok serbest bırakma, ödeme → iade, sipariş → iptal.

### Koreografi: herkes olayları dinler

Merkezi koordinatör yoktur. Orders `OrderPlaced` yayınlar; Inventory dinler, stoğu ayırır, `StockReserved` yayınlar; Payments dinler, ödemeyi alır. Ödeme başarısız olursa `PaymentFailed` yayınlanır; Inventory bunu dinleyip stoğu serbest bırakır, Orders siparişi iptal eder.

:::animation{scene="scene.json"}
Koreografi saga'sı: olay zinciri ilerler, ödeme reddedilir, her servis kendi telafisini yapar.
:::

### Orkestrasyon: bir yönetici komut verir

Bir **saga orchestrator** (Orders servisi içinde bir durum makinesi ya da Temporal/Step Functions gibi bir motor) her adıma komut gönderir, yanıtı bekler, başarısızlıkta telafi komutlarını **ters sırayla** gönderir. Akış tek yerde okunabilir.

:::animation{scene="saga.scene.json"}
Orkestrasyon saga'sı: orchestrator sırayla komut verir, ödeme başarısız olunca telafileri ters sırada tetikler.
:::

| | Koreografi | Orkestrasyon |
|---|---|---|
| Bağlaşıklık | Çok düşük; servisler birbirini bilmez | Orchestrator herkesi bilir |
| Görünürlük | "Şu an sipariş hangi adımda?" sorusu zor | Durum tek yerde |
| Döngüsel bağımlılık riski | Yüksek (A, B'nin olayını; B, A'nınkini dinler) | Düşük |
| Uygun olduğu yer | 2–4 adımlı basit akışlar | 5+ adım, dallanma, zaman aşımı, insan onayı |

:::code{lang="ts" title="Orkestrasyon saga'sı: adımlar, telafiler ve idempotency anahtarı"}
```ts
type Step = {
  name: string;
  action: (ctx: SagaCtx) => Promise<void>;
  compensate: (ctx: SagaCtx) => Promise<void>;
};
interface SagaCtx { orderId: string; reservationId?: string; paymentId?: string }

export class OrderSaga {
  private readonly steps: Step[] = [
    {
      name: 'reserve-stock',
      action: async (c) => { c.reservationId = await inventory.reserve(c.orderId); },
      compensate: async (c) => { if (c.reservationId) await inventory.release(c.reservationId); },
    },
    {
      name: 'charge-card',
      // idempotency key = orderId: tekrar denemede kart iki kez çekilmez
      action: async (c) => { c.paymentId = await payments.charge(c.orderId, { idempotencyKey: c.orderId }); },
      compensate: async (c) => { if (c.paymentId) await payments.refund(c.paymentId); },
    },
    {
      name: 'confirm-order',
      action: async (c) => orders.confirm(c.orderId),
      compensate: async (c) => orders.cancel(c.orderId, 'saga-failed'),
    },
  ];

  async run(ctx: SagaCtx): Promise<'completed' | 'compensated'> {
    const done: Step[] = [];
    for (const step of this.steps) {
      try {
        await sagaLog.record(ctx.orderId, step.name, 'started');   // durum kalıcı: çökersek kaldığımız yerden devam
        await step.action(ctx);
        await sagaLog.record(ctx.orderId, step.name, 'done');
        done.push(step);
      } catch (err) {
        await sagaLog.record(ctx.orderId, step.name, 'failed');
        for (const s of done.reverse()) {                         // telafiler TERS sırada
          await retryForever(() => s.compensate(ctx));           // telafi başarısız olamaz; olana kadar dene
        }
        return 'compensated';
      }
    }
    return 'completed';
  }
}
```
```python
class OrderSaga:
    def __init__(self, inventory, payments, orders, log):
        self.steps = [
            ("reserve-stock", lambda c: c.__setitem__("reservation_id", inventory.reserve(c["order_id"])),
                              lambda c: inventory.release(c["reservation_id"])),
            ("charge-card",   lambda c: c.__setitem__("payment_id", payments.charge(c["order_id"], idempotency_key=c["order_id"])),
                              lambda c: payments.refund(c["payment_id"])),
            ("confirm-order", lambda c: orders.confirm(c["order_id"]),
                              lambda c: orders.cancel(c["order_id"], "saga-failed")),
        ]
        self.log = log

    def run(self, ctx):
        done = []
        for name, action, compensate in self.steps:
            try:
                self.log.record(ctx["order_id"], name, "started")
                action(ctx)
                self.log.record(ctx["order_id"], name, "done")
                done.append(compensate)
            except Exception:
                self.log.record(ctx["order_id"], name, "failed")
                for comp in reversed(done):          # telafiler ters sırada
                    retry_forever(lambda: comp(ctx))
                return "compensated"
        return "completed"
```
```java
public final class OrderSaga {
    record Step(String name, Consumer<SagaCtx> action, Consumer<SagaCtx> compensate) {}
    private final List<Step> steps = List.of(
        new Step("reserve-stock", c -> c.reservationId = inventory.reserve(c.orderId),
                                  c -> inventory.release(c.reservationId)),
        new Step("charge-card",   c -> c.paymentId = payments.charge(c.orderId, c.orderId /* idempotency key */),
                                  c -> payments.refund(c.paymentId)),
        new Step("confirm-order", c -> orders.confirm(c.orderId),
                                  c -> orders.cancel(c.orderId, "saga-failed")));

    public String run(SagaCtx ctx) {
        Deque<Step> done = new ArrayDeque<>();
        for (Step step : steps) {
            try {
                log.record(ctx.orderId, step.name(), "started");
                step.action().accept(ctx);
                log.record(ctx.orderId, step.name(), "done");
                done.push(step);                       // stack: ters sıra için
            } catch (RuntimeException e) {
                log.record(ctx.orderId, step.name(), "failed");
                while (!done.isEmpty()) Retry.forever(() -> done.pop().compensate().accept(ctx));
                return "compensated";
            }
        }
        return "completed";
    }
}
```
:::

:::callout{tone="danger" title="Saga'nın izolasyonu yoktur"}
ACID'in I'si saga'da kaybolur: ödeme beklerken başka bir kullanıcı "stok yok" görebilir, ya da iptal edilecek bir sipariş kısa süre "onaylandı" görünebilir. Karşı önlemler: **semantik kilit** (kaydı `PENDING` durumunda tutmak), **değiştirilebilir son adım** (geri alması zor olan adımı sona koymak: önce stok, sonra ödeme, en son kargo), **yeniden okuma** (önemli kararlardan önce güncel durumu tekrar sorgulamak).
:::

## CQRS: okuma ve yazma modelini ayırmak

Sipariş yazma modeli normalize ve kural yüklüdür; "müşterinin son 10 siparişi, ürün adları ve kargo durumlarıyla" ekranı ise üç servisin verisini birleştirir. **CQRS (Command Query Responsibility Segregation)**, bu iki ihtiyacı ayırır: komutlar yazma modeline gider, yazma modeli olay yayınlar, bir **projeksiyon** bu olaylardan sorgu için optimize edilmiş bir **okuma modeli** (denormalize tablo, Elasticsearch indeksi, Redis hash) üretir.

Kazanç: her taraf bağımsız ölçeklenir ve şekillenir; servisler arası senkron "join" çağrıları kaybolur. Bedel: okuma modeli bir süre geride kalır (replication lag benzeri) — "siparişi verdim ama listede göremiyorum" deneyimini **kendi yazdığını oku** (read-your-writes) teknikleriyle yönetmek gerekir.

## Event sourcing: durumu değil, olayları saklamak

Klasik modelde `orders` tablosu siparişin **son hâlini** tutar; güncelleme eski değeri siler. Event sourcing'de ise yalnızca olaylar saklanır: `OrderPlaced`, `ItemAdded`, `PaymentCaptured`, `OrderShipped`. Mevcut durum, olayları baştan oynatarak (replay) elde edilir; performans için periyodik **snapshot** alınır.

Kazanç: tam denetim izi (audit), geçmişte herhangi bir anın durumu, hatalı bir projeksiyonu olayları yeniden oynatarak düzeltme, yeni okuma modellerini geçmişten üretme. Bedel: şema evrimi (eski olayları hâlâ okuyabilmek — upcasting), "siparişi sil" gibi işlemlerin karmaşıklığı (GDPR için kripto-silme), ve sorgu için **zorunlu** CQRS.

:::diagram{src="cqrs.svg" alt="Komut tarafı event store'a olay yazar, olaylar projeksiyonla okuma modeline akar, sorgular okuma modelinden karşılanır|The command side appends events to an event store, events flow through a projection into a read model, queries are served from the read model"}
CQRS + event sourcing: event store tek doğruluk kaynağı; okuma modelleri olaylardan türetilen, atılıp yeniden üretilebilen kopyalardır.
:::

:::realworld{company="Uber"}
Uber'in yolculuk akışı klasik bir saga'dır: sürücü eşleştirme, ücret tahmini, ödeme yetkilendirme (pre-auth), yolculuk, tahsilat. Ödeme yetkilendirmesi reddedilirse eşleşme iptal edilir ve sürücü havuza geri döner — telafi işlemidir. Uber, bu tür uzun akışları yönetmek için 2016'da açık kaynak **Cadence** iş akışı motorunu geliştirdi (bugün Temporal olarak devam eder): orchestrator kodu normal bir fonksiyon gibi yazılır, motor her adımın sonucunu **event sourcing** ile kalıcı tutar ve süreç çökse bile akış kaldığı yerden devam eder. Servisler arası iletişimde ise Uber iç çağrılar için gRPC tabanlı kendi RPC çerçevesini (YARPC), olaylar için Kafka'yı kullanır; günde trilyon mesaj mertebesindeki bu olay akışı, sürücü konumlarından faturalamaya kadar onlarca tüketiciyi aynı anda besler.
:::

:::callout{tone="tip" title="Mülakat özeti"}
- "Servisler nasıl konuşur?" sorusuna **kullanıcı bekliyor mu?** ile başlayın: bekliyorsa senkron (REST/gRPC + timeout + circuit breaker), beklemiyorsa olay.
- Dağıtık transaction sorulursa 2PC'yi neden reddettiğinizi söyleyin ve saga'yı telafilerle anlatın; **telafi ≠ rollback** cümlesini kurun.
- Koreografi/orkestrasyon seçimini adım sayısı ve görünürlük ihtiyacıyla gerekçelendirin.
- Her asenkron tasarımda **idempotency** ve **at-least-once** kelimelerini kendiliğinizden söyleyin; çift yazım (dual write) sorusu gelirse Outbox kalıbını (c-04) işaret edin.
- CQRS ve event sourcing'i birlikte anmayın: CQRS tek başına yaygındır, event sourcing daha nadirdir ve CQRS'i zorunlu kılar.
:::

:::quiz{src="quiz.json"}
:::

:::next{lesson="b-03-serverless-bff-clean-ddd"}
Sırada: servisleri nerede ve hangi iç yapıyla çalıştıracağız? Serverless, istemciye özel backend (BFF), hexagonal/clean architecture ve DDD bounded context.
:::

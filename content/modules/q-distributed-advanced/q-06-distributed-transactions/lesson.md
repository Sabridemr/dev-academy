---
id: q-06-distributed-transactions
slug: distributed-transactions
module: q-distributed-advanced
order: 6
title:
  tr: "Dağıtık Transaction'lar: 2PC, Saga, Outbox ve TCC"
  en: "Distributed Transactions: 2PC, Saga, Outbox and TCC"
summary:
  tr: Birden fazla veritabanına ya da servise yayılan işlemler; iki aşamalı commit ve koordinatör çökmesi, saga ile telafi, outbox, idempotency ve TCC.
  en: Operations spanning several databases or services; two-phase commit and coordinator failure, compensation with sagas, the outbox, idempotency and TCC.
durationMinutes: 35
level: advanced
prerequisites: [q-04-consistency-models, j-01-must-know-system-design-patterns]
tags: [distributed-systems, transactions, 2pc, saga, outbox, idempotency, microservices]
concepts: [two-phase-commit, coordinator-failure, in-doubt-transaction, saga-pattern, compensating-transaction, outbox-pattern, idempotency-key, tcc]
---

## Kavram: tek veritabanının konforu bittiğinde

D-03'te ACID transaction'ları gördünüz: tek bir veritabanında "siparişi oluştur, stoğu düş, ödemeyi kaydet" adımları ya hep birlikte olur ya hiç olmaz. Veritabanı bunu tek bir log ve tek bir kilit yöneticisiyle sağlar. Mikroservis mimarisinde (B-01) her servisin kendi veritabanı vardır: sipariş, stok ve ödeme üç ayrı makinede, belki üç ayrı teknolojide durur. Artık "hepsi ya da hiçbiri" kendiliğinden gelmez. Stok düşüldü ama ödeme başarısız olduysa ne olacak? Ödeme çekildi ama sipariş kaydı yazılamadıysa?

Bu derste aynı soruya verilen dört cevabı göreceğiz. İlki atomikliği dağıtık olarak korumaya çalışır (**2PC**). Diğerleri atomikliği bırakıp sonunda tutarlı olmayı hedefler ve hataları iş mantığıyla telafi eder (**saga**, **TCC**). Bu ikinci yaklaşımı güvenilir kılan yapı taşları da **outbox** ve **idempotency**'dir.

## İki aşamalı commit (2PC)

2PC'de bir **koordinatör** ve birden fazla **katılımcı** vardır. Koordinatör genellikle işlemi başlatan servis ya da bir transaction yöneticisidir (XA standardı bu rolü tanımlar).

1. **Prepare (oylama) evresi:** Koordinatör tüm katılımcılara `PREPARE` gönderir. Her katılımcı işlemi yerel olarak commit'e hazır hâle getirir: değişiklikleri ve bir "prepared" kaydını diske yazar, ilgili satırların kilitlerini tutar ve `YES` ya da `NO` oyu verir. `YES` demek bir **sözdür**: "koordinatör ne derse, çöksem bile onu yapabilirim."
2. **Commit evresi:** Herkes `YES` dediyse koordinatör kararı (`COMMIT`) kendi log'una yazar ve katılımcılara gönderir; tek bir `NO` ya da zaman aşımı varsa `ABORT` gönderir. Katılımcılar kararı uygular ve kilitleri bırakır.

Kritik an, koordinatörün kararı log'una yazdığı andır. Bu andan sonra karar geri alınamaz.

:::diagram{src="diagram.svg" alt="Solda 2PC: koordinatör üç katılımcıya prepare gönderir, oyları toplar ve commit gönderir; sağda saga: yerel transaction zinciri ve hata durumunda ters sırada telafi adımları|Left, 2PC: the coordinator sends prepare to three participants, collects votes and sends commit; right, saga: a chain of local transactions and compensations in reverse order on failure"}
2PC atomikliği kilitler ve bir koordinatör kararıyla korur; saga her adımı hemen commit eder ve hatayı ileriye dönük telafiyle düzeltir.
:::

## Koordinatör çökerse: engellenen katılımcılar

2PC'nin bilinen zayıflığı şu senaryodadır: tüm katılımcılar `YES` oyu verdi, koordinatör kararı yazdı ve **kararı gönderemeden çöktü**. Katılımcılar artık "belirsiz" (in-doubt) durumdadır. Kendi başlarına commit edemezler, çünkü başka bir katılımcı `NO` demiş olabilir; abort da edemezler, çünkü koordinatör `COMMIT` kararı vermiş ve bazı katılımcılara iletmiş olabilir. Tek yapabilecekleri **beklemektir**, ve beklerken prepare evresinde aldıkları kilitleri tutarlar. O satırlara dokunmak isteyen her işlem de bekler. Koordinatör dakikalar sonra geri gelirse sistem dakikalarca kısmen kilitli kalır; geri gelmezse bir operatörün elle karar vermesi gerekebilir.

Bu yüzden 2PC'ye **engelleyici (blocking)** protokol denir. Uygulamada iki yönde çare aranır: koordinatörün kararını tek bir makine yerine replike bir log'a (Q-02'deki Raft ya da Paxos) yazmak, ve 2PC'yi yalnızca aynı ekibin yönettiği, düşük gecikmeli veritabanları arasında kullanmak.

:::predict{id="2pc-koordinator-cokusu"}
Üç katılımcı da PREPARE'e YES oyu verdi. Koordinatör COMMIT kararını log'una yazdı ama mesajı göndermeden çöktü. Katılımcılar ne yapabilir? | All three participants voted YES to PREPARE. The coordinator wrote the COMMIT decision to its log but crashed before sending it. What can the participants do?
- [ ] Zaman aşımından sonra kendi başlarına abort ederler | They abort on their own after a timeout
- [ ] Kendi başlarına commit ederler, çünkü herkes YES dedi | They commit on their own because everyone voted YES
- [x] Kilitleri tutarak koordinatörün dönmesini beklemek zorundadırlar | They must wait for the coordinator while holding their locks
Açıklama: Bir katılımcı yalnızca kendi oyunu bilir, diğerlerinin oyunu ve koordinatörün kararını bilmez. Abort ederse, COMMIT'i almış başka bir katılımcıyla çelişebilir; commit ederse, NO oyu vermiş bir katılımcıyla çelişebilir. Bu belirsizlik 2PC'yi engelleyici yapar: kilitler koordinatör dönene kadar tutulur. | A participant only knows its own vote, not the others' votes or the coordinator's decision. If it aborts it may contradict a participant that already received COMMIT; if it commits it may contradict one that voted NO. This uncertainty is what makes 2PC blocking: locks are held until the coordinator returns.
:::

:::animation{scene="scene.json"}
2PC'de prepare ve commit evreleri; koordinatör kararı gönderemeden çökünce katılımcıların kilitli kalması ve geri dönüşte commit; ardından aynı sipariş akışının saga ile yerel commit'ler ve ödeme hatasında ters sırada telafi edilmesi.
:::

## Saga: yerel commit + telafi

**Saga**, uzun bir işlemi her biri **kendi veritabanında hemen commit edilen** yerel transaction'lar zincirine böler: T1 siparişi oluştur, T2 stoğu ayır, T3 ödemeyi al. Bir adım başarısız olursa, önceki adımlar için tanımlanmış **telafi (compensating) transaction**'lar ters sırada çalıştırılır: C2 stoğu serbest bırak, C1 siparişi iptal et. Fikir 1987 tarihli bir veritabanı makalesine dayanır ve J-04'teki Amazon ölçeğinde sipariş akışında gördüğünüz yapının ta kendisidir.

Saga'nın bedeli **izolasyon kaybıdır**. T2 commit edildiği anda stok azalmış görünür, ödeme henüz alınmamıştır; başka bir istek bu ara durumu görebilir. Telafi de "geri alma" değil, ileriye dönük yeni bir işlemdir: gönderilmiş bir e-posta geri çağrılamaz, ancak "siparişiniz iptal edildi" e-postası gönderilebilir. Bu yüzden saga adımları tasarlanırken "sayılabilir" ara durumlar (ör. sipariş durumu `PENDING`) ve semantik kilitler kullanılır.

Saga iki biçimde koordine edilir:

- **Koreografi:** Her servis bir olay yayınlar, bir sonraki servis o olaya tepki verir. Merkez yoktur; az adımlı akışlarda basittir ama akış büyüdükçe izlemesi zorlaşır.
- **Orkestrasyon:** Bir orkestratör (saga yöneticisi) adımları sırayla çağırır ve durumunu kalıcı olarak saklar. Akış tek yerde görünür; Temporal ya da AWS Step Functions gibi iş akışı motorları bu modeli sunar.

## Outbox ve idempotency: sagayı güvenilir kılan iki parça

Saga adımları mesajlarla ilerler ve burada iki klasik tuzak vardır. Birincisi **çift yazma (dual write)**: servis kendi veritabanına yazar, sonra Kafka'ya olay gönderir. İkisi arasında çökerse veritabanı güncellenmiş ama olay kaybolmuştur; ters sırada yaparsa olay gitmiş ama veri yazılmamıştır. **Transactional outbox** (J-01) bunu çözer: iş kaydı ve olay kaydı **aynı yerel transaction** içinde, aynı veritabanındaki bir `outbox` tablosuna yazılır. Ayrı bir aktarıcı (tablo yoklaması ya da Debezium gibi bir CDC aracı) outbox'taki olayları mesaj kuyruğuna taşır. Atomiklik tek veritabanının ACID garantisinden gelir.

İkinci tuzak **tekrar**: aktarıcı bir olayı yayınlayıp kaydı işaretlemeden çökerse olay ikinci kez gider. Mesaj kuyrukları zaten "en az bir kez" teslimat yapar. Bu yüzden her saga adımı **idempotent** olmalıdır (I-03): aynı mesaj ya da aynı istek iki kez işlendiğinde sonuç bir kez işlenmiş gibi olmalıdır. Tipik çözüm, her işleme benzersiz bir anahtar vermek ve işlenen anahtarları, iş verisiyle aynı transaction içinde bir tabloda saklamaktır.

:::code{lang="ts" title="Outbox'a yazma ve idempotent tüketici"}
```ts
// Üretici: iş kaydı ve olay AYNI yerel transaction içinde
export async function placeOrder(db: Db, order: Order) {
  await db.transaction(async (tx) => {
    await tx.insert('orders', { id: order.id, status: 'PENDING', total: order.total });
    await tx.insert('outbox', {
      id: crypto.randomUUID(),
      aggregate_id: order.id,
      type: 'OrderPlaced',
      payload: JSON.stringify(order),
    });
  }); // ikisi birlikte commit olur ya da hiçbiri
}

// Tüketici (stok servisi): aynı olay iki kez gelse de bir kez etki eder
export async function onOrderPlaced(db: Db, eventId: string, order: Order) {
  await db.transaction(async (tx) => {
    const inserted = await tx.insertIgnore('processed_events', { id: eventId });
    if (!inserted) return; // daha önce işlendi → hiçbir şey yapma
    await tx.update('stock', { sku: order.sku }, { reserved: { increment: order.qty } });
  });
}
```
```python
def place_order(db, order):
    with db.transaction() as tx:
        tx.execute("INSERT INTO orders (id, status, total) VALUES (%s, 'PENDING', %s)",
                   (order.id, order.total))
        tx.execute("INSERT INTO outbox (id, aggregate_id, type, payload) VALUES (%s, %s, %s, %s)",
                   (uuid4(), order.id, "OrderPlaced", json.dumps(order.to_dict())))

def on_order_placed(db, event_id, order):
    with db.transaction() as tx:
        cur = tx.execute("INSERT INTO processed_events (id) VALUES (%s) ON CONFLICT DO NOTHING",
                         (event_id,))
        if cur.rowcount == 0:
            return  # tekrar eden olay
        tx.execute("UPDATE stock SET reserved = reserved + %s WHERE sku = %s",
                   (order.qty, order.sku))
```
:::

Simülatörde bu tekrarın etkisini görebilirsiniz: idempotent olmayan bir tüketici, yeniden teslim edilen mesajı ikinci kez işler.

:::interactive{type="message-queue" producers=1 consumers=2 partitions=2 failureRate=0.2 maxRetries=3 idempotent=false}
"Idempotent tüketici" kapalıyken "5 mesaj üret" düğmesine birkaç kez basın ve "Çift işleme" sayacını izleyin: ACK'i kaybolan mesajlar yeniden teslim edilip iki kez işleniyor. Hata oranını artırın; çift işleme nasıl değişiyor? Sonra "Idempotent tüketici" seçeneğini açıp aynı deneyi tekrarlayın: tekrarlar hâlâ geliyor mu, peki çift yan etki oluşuyor mu? Saga adımlarınızın her biri bu tüketici gibi davranmalı.
:::

## TCC: Try-Confirm-Cancel

**TCC**, 2PC'nin iş mantığı düzeyindeki akrabasıdır. Her servis üç işlem sunar: **Try** kaynağı geçici olarak ayırır (ör. koltuğu 10 dakikalığına "rezerve" et), **Confirm** ayrımı kesinleştirir, **Cancel** ayrımı bırakır. Orkestratör önce tüm servislerde Try çağırır; hepsi başarılıysa Confirm, biri başarısızsa Cancel. Fark şudur: ayrımlar veritabanı kilidi değil, iş kaydıdır ve **süresi dolar**. Orkestratör çökerse kaynaklar sonsuza kadar kilitli kalmaz, rezervasyon süresi bitince serbest kalır. Bedeli, her servisin üç ayrı API ve ara durumlar tasarlamasıdır. Otel, uçak ve etkinlik rezervasyonları TCC'nin doğal kullanım alanıdır.

| | **2PC** | **Saga** | **TCC** |
|---|---|---|---|
| Atomiklik | Evet | Hayır, telafi ile sonunda tutarlı | İş düzeyinde, rezervasyonla |
| İzolasyon | Kilitlerle | Yok; ara durumlar görünür | Kısmi; rezerve kaynak başkasına verilmez |
| Koordinatör çökerse | Katılımcılar kilitli bekler | Orkestratör durumundan devam eder | Rezervasyonlar süre dolunca bırakılır |
| Uygun yer | Aynı ekibin veritabanları, kısa işlemler | Mikroservisler arası uzun iş akışları | Kaynak ayırmalı iş akışları |

:::realworld{company="Google Spanner"}
**Google Spanner** dağıtık transaction'larda 2PC kullanır, ama 2PC'nin engelleme sorununu katılımcıları replike ederek hafifletir (OSDI 2012 makalesi). Spanner'da veri, her biri bir Paxos grubu tarafından çoğaltılan parçalara bölünür. Birden fazla gruba dokunan bir transaction'da gruplardan birinin lideri **koordinatör**, diğer grupların liderleri **katılımcı** olur. Prepare kaydı da commit kararı da tek bir makinenin diskine değil, ilgili grubun **Paxos log'una** yazılır. Koordinatör lideri çökerse grup yeni bir lider seçer ve yeni lider kararı log'dan okuyup protokolü sürdürür; yani "koordinatör geri gelene kadar bekle" süresi, bir makinenin onarılma süresi yerine bir lider seçimi süresine iner. Spanner'ın commit zaman damgaları da Q-01'deki TrueTime ile atanır. Kaynak: Corbett ve diğerleri, "Spanner: Google's Globally-Distributed Database".
:::

:::realworld{company="Stripe"}
**Stripe** API'si, ağ hatası sonrası tekrar denenen bir ödeme isteğinin müşteriden iki kez para çekmesini önlemek için **idempotency anahtarlarını** destekler. İstemci her yazma isteğine benzersiz bir `Idempotency-Key` başlığı ekler; Stripe aynı anahtarla gelen tekrar isteğe yeni bir işlem yapmak yerine ilk isteğin sonucunu döndürür. Stripe'ın mühendislik blogundaki "Designing robust and predictable APIs with idempotency" yazısı bu yaklaşımı ve istemci tarafında üstel geri çekilmeyle (exponential backoff) birlikte kullanılmasını anlatır. Saga'nın "ödemeyi al" adımı tam olarak böyle bir dış servise gider: orkestratör adımı yeniden denediğinde aynı anahtarı göndermesi, ödemenin tek kez gerçekleşmesini sağlar.
:::

:::callout{tone="warning" title="Telafi de başarısız olabilir"}
Saga'da telafi adımları da ağ hatası alabilir. Telafiler idempotent olmalı ve başarılı olana kadar yeniden denenmelidir; asla "denedik, olmadı" diye bırakılmamalıdır. Hiç başarılı olamayan telafiler bir ölü mesaj kuyruğuna (DLQ) düşmeli ve insan müdahalesi için alarm üretmelidir.
:::

:::callout{tone="tip" title="Mülakat özeti"}
- 2PC: prepare (oy + kilit) → commit. Koordinatör kararı göndermeden çökerse katılımcılar kilitli bekler (blocking). Spanner: katılımcılar Paxos grupları.
- Saga: yerel commit + ters sırada telafi; izolasyon yok. Koreografi ya da orkestrasyon.
- Outbox: iş kaydı + olay aynı yerel transaction'da; CDC ya da yoklama ile yayınla.
- Idempotency: en az bir kez teslimatta tekrarları zararsız kıl (işlenmiş anahtar tablosu, Idempotency-Key).
- TCC: Try (süreli rezervasyon) → Confirm/Cancel.
:::

:::quiz{src="quiz.json"}
:::

:::resources
- [Pattern: Saga](https://microservices.io/patterns/data/saga.html) — belge — koreografi ve orkestrasyon
- [Pattern: Transactional outbox](https://microservices.io/patterns/data/transactional-outbox.html) — belge — outbox ve mesaj aktarıcı
- [Sagas (Garcia-Molina ve Salem, 1987)](https://www.cs.cornell.edu/andru/cs711/2002fa/reading/sagas.pdf) — bildiri — saga kavramının ilk tanımı
- [Designing robust and predictable APIs with idempotency](https://stripe.com/blog/idempotency) — blog — Stripe'ın idempotency anahtarları
- [Spanner: Google's Globally-Distributed Database (OSDI 2012)](https://www.usenix.org/conference/osdi12/technical-sessions/presentation/corbett) — bildiri — Paxos grupları üzerinde 2PC
:::

:::next{lesson="e-06-classic-interview-systems"}
Modül bitti. Şimdi bu araçları klasik mülakat sistemlerinde kullanın: URL kısaltıcı, rate limiter ve bildirim servisi tasarımında konsensüs, tutarlılık ve idempotency nerede devreye giriyor?
:::

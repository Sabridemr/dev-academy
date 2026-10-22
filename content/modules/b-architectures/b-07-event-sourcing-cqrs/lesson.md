---
id: b-07-event-sourcing-cqrs
slug: event-sourcing-cqrs
module: b-architectures
order: 7
title:
  tr: "Event Sourcing ve CQRS: Olay Deposu, Projeksiyon, Replay"
  en: "Event Sourcing and CQRS: Event Store, Projections, Replay"
summary:
  tr: Olay deposu, projeksiyonlar, replay ve snapshot, okuma/yazma ayrımı, nihai tutarlılık ve ne zaman kullanılmaz.
  en: Event store, projections, replay and snapshots, read/write separation, eventual consistency and when not to use it.
durationMinutes: 35
level: advanced
tags: [architecture, event-sourcing, cqrs, projections, eventual-consistency]
prerequisites: [b-02-microservice-communication, b-06-hexagonal-clean-architecture, j-01-must-know-system-design-patterns]
concepts: [event-sourcing, cqrs, event-store, event-stream, optimistic-concurrency, projection, read-model, replay, snapshot, event-upcasting, eventual-consistency]
---

## Kavram: gerçek, olayların sırasıdır

b-02 ve j-01'de event sourcing'i birkaç paragrafla tanımladık: durumu değil, durumu değiştiren olayları saklamak. Bu derste aynı fikri bir uygulayıcının gözünden açıyoruz: olay deposu nasıl çalışır, bir komut nasıl olaya dönüşür, okuma modelleri nasıl üretilir, yeniden üretilir ve hangi noktada bu düzen gereksiz bir yük olur.

Bir cüzdan düşünün. Klasik modelde `wallets` tablosunda tek bir satır vardır: `balance = 70`. Bu sayının nasıl oluştuğu, hangi işlemin ne zaman yapıldığı, bir hata yüzünden mi yoksa bilinçli bir düzeltmeyle mi değiştiği satırda yazmaz; ayrı bir denetim tablosu tutmadıkça kaybolur. Event sourcing'de ise tablo yoktur, yalnızca bir **olay akışı** (stream) vardır: `WalletOpened`, `MoneyDeposited(100)`, `MoneyWithdrawn(30)`. Bakiye, bu olayları baştan sona katlayarak (fold) hesaplanan bir **türev**dir. Doğruluk kaynağı olaylardır; bakiye onların bir yorumudur.

Bu tersine çevirme iki önemli sonuç doğurur. Birincisi, hiçbir bilgi silinmez: geçmişin herhangi bir anındaki durum yeniden hesaplanabilir ve "bu bakiye nasıl oluştu?" sorusunun cevabı sistemin kendisidir. İkincisi, güncel durumu sorgulamak artık bedava değildir: "bakiyesi 1.000'in üzerinde olan cüzdanlar" sorusunu olay akışlarına soramazsınız. Bu yüzden event sourcing pratikte neredeyse her zaman **CQRS** ile birlikte gelir: yazma tarafı olayları üretir, okuma tarafı o olaylardan sorgulanabilir modeller türetir.

## Olay deposu: ekle, oku, abone ol

Olay deposu (event store) üç işlem sunan, sade bir veritabanıdır:

- **Ekle (append)**: Bir akışın sonuna olay ekler. Olaylar değiştirilmez ve silinmez. Ekleme bir **beklenen sürüm** (expected version) ile yapılır: "bu akış hâlâ 7. olaydaysa 8. olayı ekle". Arada başka biri yazdıysa ekleme reddedilir. Bu, kilitsiz **iyimser eşzamanlılık** kontrolüdür ve aggregate'in tutarlılık sınırını korur.
- **Akışı oku**: Bir aggregate'in (ör. `wallet-42`) olaylarını sırayla döndürür.
- **Abone ol (subscribe)**: Bütün depodaki olayları global sırayla, kaldığı konumdan (checkpoint) itibaren dinlemeyi sağlar. Projeksiyonlar bu akışı kullanır.

EventStoreDB bu işlemler için tasarlanmış özel bir veritabanıdır; Marten ise aynı modeli PostgreSQL üzerine kurar. Kendi deponuzu yazacaksanız bile şema şaşırtıcı derecede küçüktür: `(stream_id, version, global_position, type, data, metadata, created_at)` ve `(stream_id, version)` üzerinde benzersizlik kısıtı.

## Komuttan olaya: karar ve evrim

Yazma tarafının çekirdeği iki saf fonksiyondur:

1. **decide(komut, durum) → olaylar**: İş kuralını uygular. "50 TL çek" komutu, bakiye 70 ise `MoneyWithdrawn(50)` üretir; 30 ise bir hata döner. Karar verilir ama henüz hiçbir şey değişmez.
2. **evolve(durum, olay) → yeni durum**: Bir olayı duruma uygular. Bu fonksiyon asla hata vermez; olay zaten olmuş bir gerçektir.

Bir komut geldiğinde akış okunur, `evolve` ile güncel durum kurulur, `decide` çağrılır ve dönen olaylar beklenen sürümle eklenir. Bu düzen b-06'daki hexagonal yapıya doğal biçimde oturur: `decide` ve `evolve` domain'dir, olay deposu bir sürülen adaptördür.

:::diagram{src="diagram.svg" alt="Solda komut, aggregate'in decide ve evolve fonksiyonları ve wallet-42 akışındaki sürüm numaralı olaylar; ortada global sırayla olay deposu ve sürüm 100'de alınmış bir snapshot; sağda abonelikle beslenen iki projeksiyon: bakiye okuma modeli ve sonradan replay ile kurulan şüpheli işlem okuma modeli; altta sorgu tarafı ve nihai tutarlılık gecikmesi|On the left a command, the aggregate's decide and evolve functions and versioned events in the wallet-42 stream; in the middle the event store in global order and a snapshot taken at version 100; on the right two projections fed by a subscription: the balance read model and a suspicious-activity read model built later via replay; at the bottom the query side and the eventual-consistency lag"}
Yazma yolu (solda) yalnızca olay ekler; okuma yolu (sağda) olaylardan türetilir. Okuma modelleri atılıp yeniden üretilebilir; olaylar asla.
:::

## Projeksiyonlar ve okuma modelleri

**Projeksiyon**, olay akışını dinleyip bir okuma modelini güncelleyen koddur: `MoneyWithdrawn` gelince `wallet_balances` tablosunda ilgili satırın bakiyesini düşürür. Okuma modeli herhangi bir biçimde olabilir: denormalize bir Postgres tablosu, Elasticsearch indeksi, Redis hash'i. Aynı olaylardan birden fazla model türetilebilir; her ekran kendi ihtiyacına göre şekillenmiş bir modele sahip olabilir.

Projeksiyonun iki çalışma biçimi vardır. **Satır içi (inline)** projeksiyon, olay ile aynı transaction'da güncellenir; okuma modeli her zaman günceldir ama yazma yavaşlar ve iki depo aynı veritabanında olmak zorundadır. **Asenkron** projeksiyon, abonelikle ayrı bir süreçte çalışır; yazma hızlıdır ama okuma modeli bir süre geride kalır. Bu gecikme **nihai tutarlılığın** somut hâlidir.

Asenkron projeksiyon en az bir kez teslim alır; aynı olay iki kez gelebilir. Bu yüzden projeksiyon **idempotent** olmalıdır: işlediği son global konumu (checkpoint) okuma modeliyle aynı transaction'da saklar ve daha eski bir konumu tekrar uygulamaz.

:::predict{id="projeksiyon-gecikmesi"}
Kullanıcı 50 TL çekti, komut başarılı döndü ve hemen bakiye ekranını açtı. Bakiye asenkron bir projeksiyondan okunuyor. Ne görebilir? | The user withdrew 50 TRY, the command returned success, and they immediately opened the balance screen. The balance is read from an asynchronous projection. What might they see?
- [ ] Her zaman yeni bakiyeyi; komut başarılıysa okuma modeli de güncellenmiştir | Always the new balance; if the command succeeded, the read model is updated too
- [x] Kısa bir süre eski bakiyeyi; projeksiyon olayı henüz işlememiş olabilir | The old balance for a short while; the projection may not have processed the event yet
- [ ] Bir hata; olay işlenene kadar okuma modeli kilitlidir | An error; the read model is locked until the event is processed
- [ ] Bakiyenin iki katını; olay iki kez teslim edilir | Double the balance; the event is delivered twice
Açıklama: Yazma tarafı olayı ekleyip başarı döner; projeksiyon onu milisaniyeler, yoğunlukta saniyeler sonra işler. Bu pencerede eski değer görünür. Çözüm, komutun döndürdüğü sürümü okuma tarafına iletip projeksiyon o konuma ulaşana kadar beklemek ya da kullanıcının kendi değişikliğini istemcide iyimser biçimde göstermektir. İdempotent projeksiyon çift teslimde bakiyeyi iki kez düşürmez. | The write side appends the event and returns success; the projection processes it milliseconds, under load seconds, later. In that window the old value is visible. The fix is to pass the version returned by the command to the read side and wait until the projection reaches it, or to show the user's own change optimistically on the client. An idempotent projection does not deduct twice on redelivery.
:::

:::animation{scene="scene.json"}
Komutun olaya dönüşmesi, iyimser eşzamanlılık çakışması, projeksiyonun okuma modelini geriden gelerek güncellemesi, snapshot ve replay ile sıfırdan yeni bir projeksiyon kurulması.
:::

## Replay ve snapshot

Event sourcing'in en güçlü kozu **replay**'dir. Yeni bir ekran mı gerekiyor, ör. "son bir saatte üçten fazla çekim yapan cüzdanlar"? Yeni bir projeksiyon yazılır, global konum 0'dan başlatılır ve bütün geçmiş olaylar ona oynatılır. Projeksiyon güncel konuma yetiştiğinde canlı akışa geçer. Hatalı bir projeksiyon için de aynı yol kullanılır: okuma modeli silinir, kod düzeltilir, olaylar yeniden oynatılır. Büyük depolarda bu işlem saatler sürebilir; bu yüzden yeni model genellikle eskisinin yanında kurulur ve yetişince trafik ona çevrilir (mavi-yeşil projeksiyon).

**Snapshot** ise yazma tarafının performans aracıdır. Binlerce olaylı bir akışı her komutta baştan katlamak pahalıdır; her N olayda bir hesaplanmış durum kaydedilir ve yükleme "snapshot + sonrasındaki olaylar" olarak yapılır. Snapshot bir önbellektir, doğruluk kaynağı değildir: `evolve` değişirse eski snapshot'lar atılır ve olaylardan yeniden üretilir. Çoğu akış kısa ömürlüdür; snapshot'ı ölçmeden eklemek gereksiz karmaşıklıktır.

:::interactive{type="message-queue" producers=2 consumers=2 partitions=3 failureRate=0.1 maxRetries=3 idempotent=false}
Üreticileri olay deposunun aboneliği, tüketicileri projeksiyonlar olarak düşünün. "Başlat" ile olay akışını başlatın ve "Kuyruk gecikmesi (lag)" değerini izleyin: bu sayı, okuma modelinin yazma tarafının ne kadar gerisinde olduğunu, yani nihai tutarlılık penceresini gösterir. Tüketici sayısını 1'e indirin ve gecikmenin büyüdüğünü görün; replay sırasında bir projeksiyonun yaşadığı tam da budur. Sonra "Çift işleme" sayacına bakın: idempotent olmayan bir projeksiyon, ACK'i kaybolan bir olayı ikinci kez uygular ve bakiyeyi iki kez düşürür. "Idempotent tüketici" kutusunu işaretleyin; checkpoint ile korunan projeksiyon tekrarları atlar.
:::

:::code{lang="ts" title="decide/evolve + iyimser eşzamanlılık + idempotent projeksiyon"}
```ts
type WalletEvent =
  | { type: 'WalletOpened'; walletId: string }
  | { type: 'MoneyDeposited'; amount: number }
  | { type: 'MoneyWithdrawn'; amount: number };
type Wallet = { balance: number; open: boolean };
const initial: Wallet = { balance: 0, open: false };

// evolve: olay zaten olmuştur, asla hata vermez
const evolve = (s: Wallet, e: WalletEvent): Wallet => {
  switch (e.type) {
    case 'WalletOpened': return { ...s, open: true };
    case 'MoneyDeposited': return { ...s, balance: s.balance + e.amount };
    case 'MoneyWithdrawn': return { ...s, balance: s.balance - e.amount };
  }
};

// decide: iş kuralı burada; sonuç olaylardır, durum değişikliği değil
const decideWithdraw = (s: Wallet, amount: number): WalletEvent[] => {
  if (!s.open) throw new Error('cüzdan kapalı');
  if (s.balance < amount) throw new Error('yetersiz bakiye');
  return [{ type: 'MoneyWithdrawn', amount }];
};

// komut işleyici: oku → kur → karar ver → beklenen sürümle ekle
async function withdraw(store: EventStore, walletId: string, amount: number) {
  const { events, version } = await store.readStream(`wallet-${walletId}`);
  const state = events.reduce(evolve, initial);
  const newEvents = decideWithdraw(state, amount);
  // arada başka bir yazma olduysa WrongExpectedVersion fırlatır → komut yeniden denenir
  return store.append(`wallet-${walletId}`, newEvents, { expectedVersion: version });
}

// asenkron projeksiyon: checkpoint okuma modeliyle AYNI transaction'da
async function project(db: Sql, e: StoredEvent<WalletEvent>) {
  await db.begin(async (tx) => {
    const [cp] = await tx`select position from checkpoints where name = 'balances' for update`;
    if (e.globalPosition <= cp.position) return;                  // tekrar teslim: atla
    if (e.data.type === 'MoneyWithdrawn')
      await tx`update wallet_balances set balance = balance - ${e.data.amount} where id = ${e.streamId}`;
    if (e.data.type === 'MoneyDeposited')
      await tx`update wallet_balances set balance = balance + ${e.data.amount} where id = ${e.streamId}`;
    await tx`update checkpoints set position = ${e.globalPosition} where name = 'balances'`;
  });
}
```
```python
from functools import reduce

def evolve(state, event):
    t = event["type"]
    if t == "WalletOpened":   return {**state, "open": True}
    if t == "MoneyDeposited": return {**state, "balance": state["balance"] + event["amount"]}
    if t == "MoneyWithdrawn": return {**state, "balance": state["balance"] - event["amount"]}
    return state

def decide_withdraw(state, amount):
    if not state["open"]: raise ValueError("cüzdan kapalı")
    if state["balance"] < amount: raise ValueError("yetersiz bakiye")
    return [{"type": "MoneyWithdrawn", "amount": amount}]

def withdraw(store, wallet_id, amount):
    events, version = store.read_stream(f"wallet-{wallet_id}")
    state = reduce(evolve, events, {"balance": 0, "open": False})
    new_events = decide_withdraw(state, amount)
    return store.append(f"wallet-{wallet_id}", new_events, expected_version=version)
```
:::

## Şema evrimi ve unutulma hakkı

Olaylar sonsuza kadar yaşar, ama kod değişir. `MoneyWithdrawn` olayına yıllar sonra `currency` alanı eklemek gerektiğinde eski olaylar yeniden yazılmaz. Bunun yerine okuma sırasında eski sürümü yeni şekle dönüştüren bir **upcaster** yazılır (`currency` yoksa `TRY` varsay) ya da yeni bir olay tipi (`MoneyWithdrawnV2`) tanıtılır. Alan silmek ve anlam değiştirmek ise neredeyse her zaman yeni bir olay tipi gerektirir.

Silinemeyen olaylar kişisel veriyle çatışır. Yaygın çözüm **kripto-silme**dir (crypto-shredding): kişisel alanlar kişiye özel bir anahtarla şifrelenir; silme talebinde anahtar yok edilir ve olaylar okunamaz hâle gelir. Kişisel veriyi olaylara hiç koymayıp ayrı, silinebilir bir depoda tutmak da bir seçenektir.

:::realworld{company="EventStoreDB ve Marten"}
Event sourcing için en çok başvurulan iki açık kaynak araç, bu dersteki kavramları adlarıyla taşır. **EventStoreDB**, CQRS ve event sourcing terimlerini yaygınlaştıran Greg Young'ın kurucuları arasında olduğu Event Store şirketinin veritabanıdır (şirket ve ürün 2024 sonunda Kurrent adını aldı). Belgeleri, akışlara beklenen sürümle ekleme yapmayı, `$all` adlı global akışa ve tek akışlara **abonelikleri**, abonelikte konum (checkpoint) saklamayı ve projeksiyonları temel kavramlar olarak anlatır. **Marten** ise .NET dünyasında PostgreSQL'i hem belge deposu hem olay deposu olarak kullanan bir kütüphanedir. Belgelerinde projeksiyonların üç yaşam döngüsü ayrıştırılır: olayla aynı transaction'da güncellenen **inline**, arka plandaki bir daemon tarafından işlenen **async** ve sorgu anında olaylardan hesaplanan **live** projeksiyonlar. Marten ayrıca bir projeksiyonu sıfırdan yeniden kurmayı (rebuild) ve olay şemasını sürümlerken eski olayları dönüştürmeyi (upcasting) belgeler. İki aracın da öne çıkardığı ortak ders şudur: olay deposu yalnızca bir veritabanı seçimi değil, okuma modellerinin nasıl üretileceğine ve ne kadar geride kalabileceğine dair bir tasarım kararıdır.
:::

:::callout{tone="warning" title="Ne zaman kullanılmaz?"}
- **Basit CRUD**: Profil ayarları, içerik yönetimi gibi geçmişin sorulmadığı alanlarda olaylar, projeksiyonlar ve şema evrimi yalnızca yük getirir.
- **Bütün sistemi event sourcing yapmak**: Kalıp bir sınırlı bağlam içinde uygulanır, sistem genelinde değil. Denetim izi gereken çekirdek alan (ödeme, defter, stok hareketi) adaydır; geri kalanı klasik kalabilir.
- **İç olayları dış sözleşme yapmak**: Aggregate'in iç olayları (`MoneyWithdrawn`) sık değişir. Diğer servislere ayrı ve kararlı **entegrasyon olayları** yayınlayın; yoksa her iç değişiklik herkesi kırar.
- **Nihai tutarlılığa hazır olmayan ürün**: Her ekranın yazdıktan hemen sonra güncel olması şartsa, asenkron projeksiyonların gecikmesi ürün tasarımıyla çatışır.
:::

:::callout{tone="info" title="Mülakat ipuçları"}
- Event sourcing ve CQRS'i ayırın: CQRS tek başına yaygındır; event sourcing CQRS'i neredeyse zorunlu kılar.
- Yazma yolunu tek cümleyle anlatın: "akışı oku, evolve ile durumu kur, decide ile olayları üret, beklenen sürümle ekle."
- Okuma tarafında projeksiyon, checkpoint, idempotency ve gecikme kelimelerini kullanın; replay ile yeni okuma modeli kurmayı örnekleyin.
:::

:::quiz{src="quiz.json"}
:::

:::resources
- [Event Sourcing](https://martinfowler.com/eaaDev/EventSourcing.html) — makale — Martin Fowler
- [CQRS Documents](https://cqrs.files.wordpress.com/2010/11/cqrs_documents.pdf) — makale — Greg Young
- [Marten: Event Store](https://martendb.io/events/) — belge — PostgreSQL üzerinde olay deposu ve projeksiyonlar
- [Event Sourcing pattern](https://learn.microsoft.com/en-us/azure/architecture/patterns/event-sourcing) — belge — Azure Architecture Center
- [CQRS pattern](https://learn.microsoft.com/en-us/azure/architecture/patterns/cqrs) — belge — Azure Architecture Center
:::

:::next{lesson="b-08-saga-distributed-workflows"}
Sırada: birden fazla servise yayılan iş akışları. Uçuş, otel ve araç rezervasyonunu bir orkestratörle yürütmek, zaman aşımları ve telafi işlemleri.
:::

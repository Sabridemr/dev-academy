---
id: b-08-saga-distributed-workflows
slug: saga-distributed-workflows
module: b-architectures
order: 8
title:
  tr: "Saga ve Dağıtık İş Akışları: Telafi, Zaman Aşımı, Orkestratör"
  en: "Sagas and Distributed Workflows: Compensation, Timeouts, Orchestrators"
summary:
  tr: Koreografi ve orkestrasyon, telafi işlemleri, zaman aşımı, Temporal/Step Functions, idempotency ve outbox ile ilişki.
  en: Choreography and orchestration, compensating actions, timeouts, Temporal/Step Functions, and how idempotency and the outbox fit in.
durationMinutes: 35
level: advanced
tags: [architecture, saga, workflow, orchestration, compensation, temporal, idempotency]
prerequisites: [b-02-microservice-communication, b-07-event-sourcing-cqrs, i-03-api-ve-rest-api-tasarim-guvenlik-ve-idempotency]
concepts: [saga-pattern, saga-orchestration, saga-choreography, compensating-transaction, pivot-transaction, saga-timeout, durable-execution, idempotency-key, transactional-outbox]
---

## Kavram: uzun süren, birden fazla sahibi olan bir iş

b-02'de saga'yı tanımladık ve j-04'te bir sipariş akışında gördük: yerel transaction'lar zinciri, başarısızlıkta ters sırada telafi. Bu derste aynı kalıbı bir uygulayıcı gibi ele alıyoruz ve sipariş yerine farklı bir örnek kullanıyoruz: **seyahat rezervasyonu**. Kullanıcı tek bir "Tatili rezerve et" düğmesine basar; arkada üç bağımsız sistem çalışır: havayolunun uçuş servisi, otel envanteri ve araç kiralama. Her birinin kendi veritabanı vardır, bazıları başka şirketlere aittir ve hiçbiri sizin transaction'ınıza katılmaz.

Bu örneği öğretici kılan üç özellik vardır. Birincisi, adımlar **gerçek dünyada** etki bırakır: bir uçuş koltuğu tutulduğunda başka biri onu satın alamaz. İkincisi, adımlar **yavaş ve belirsizdir**: dış bir API saniyelerce cevap vermeyebilir ve zaman aşımı, işlemin yapılıp yapılmadığını söylemez. Üçüncüsü, telafinin bir **bedeli** olabilir: bazı biletlerin iptali ücretlidir, bazı otel tutmaları belirli bir süre sonra kendiliğinden düşer. Saga tasarımı bu üç gerçeğin etrafında yapılır.

## Adımları sınıflandırmak: telafi edilebilir, dönüm noktası, tekrarlanabilir

Bir saga'nın adımları üç türe ayrılır (Chris Richardson'ın microservices.io'da kullandığı terimlerle):

| Tür | Anlamı | Seyahat örneği |
|---|---|---|
| **Telafi edilebilir** | Başarılı olsa da sonradan bir telafi işlemiyle geri alınabilir | Uçuş koltuğunu tutmak (iptal: tutmayı bırak), otel ve araç tutmak |
| **Dönüm noktası (pivot)** | Başarılı olursa saga artık geri dönmez; ileri gitmek zorundadır | Karttan tahsilat |
| **Tekrarlanabilir** | Pivot'tan sonra gelir; başarısız olamaz, başarılı olana kadar yeniden denenir | Biletlerin kesilmesi, onay e-postası |

Bu ayrım **adım sırasını** belirler. Geri alınması kolay ve ucuz adımlar başa, geri alınamayan adım ortaya, mutlaka tamamlanması gerekenler sona konur. Ödemeyi ilk adım yapmak, otel bulunamadığında para iadesi gibi pahalı ve kullanıcıyı rahatsız eden bir telafi gerektirir. Tutma (hold) ile kesinleştirme (confirm) ayrımı da aynı amaca hizmet eder: önce her şey geçici olarak tutulur, pivot geçilince hepsi kesinleştirilir.

**Telafi bir geri alma değildir.** Veritabanı rollback'i hiçbir şey olmamış gibi yapar; telafi ise olmuş bir şeyin iş kuralına göre tersini yapan **yeni** bir işlemdir. Bu yüzden telafinin kendisi de tasarlanmalıdır: idempotent olmalı (aynı iptal iki kez gelirse ikinci kez ücret kesmemeli), başarısız olursa yeniden denenebilmeli ve iş kuralı gereği reddedilemez olmalıdır. Bir telafi kalıcı olarak başarısız olursa saga otomatik olarak düzelemez; bu durumda alarm üretilir ve bir insan devreye girer.

:::diagram{src="diagram.svg" alt="Orkestratörün yönettiği seyahat saga'sı: üstte ileri adımlar uçuş tut, otel tut, araç tut, karttan tahsil et (pivot), biletleri kes; altta ters sırada telafiler araç iptal, otel iptal, uçuş iptal; otel adımında zaman aşımı ve aynı idempotency anahtarıyla yeniden deneme; orkestratör durumunu outbox ile aynı transaction'da kaydediyor|A travel saga run by an orchestrator: forward steps on top reserve flight, reserve hotel, reserve car, charge card (pivot), issue tickets; compensations in reverse below cancel car, cancel hotel, cancel flight; a timeout and a retry with the same idempotency key at the hotel step; the orchestrator saves its state in the same transaction as the outbox"}
Kesikli çizginin solundaki her adımın altında bir telafisi vardır; pivot geçildikten sonra saga yalnızca ileri gider.
:::

## Zaman aşımı: hata değil, belirsizlik

Otel servisine `ReserveHotel` gönderildi ve 10 saniye içinde cevap gelmedi. Üç olasılık vardır: istek otele hiç ulaşmadı; otel odayı tuttu ama cevap yolda kayboldu; otel hâlâ çalışıyor. Zaman aşımı bunlardan hangisinin olduğunu söylemez. Bu yüzden saga'da zaman aşımı **başarısızlık** olarak değil, **sonucu bilinmeyen** bir adım olarak ele alınır.

Güvenli tepki, aynı isteği **aynı idempotency anahtarıyla** yeniden göndermektir (i-03). Anahtar `trip-77:hotel` gibi saga kimliği ve adım adından türetilir; otel servisi bu anahtarı daha önce gördüyse ikinci bir oda tutmaz, ilk sonucu döndürür. Yeniden denemeler üstel geri çekilmeyle (backoff) sınırlandırılır. Bunun yanında iki zaman sınırı daha vardır: adımın toplam süresi (tüm denemeler dahil) ve saga'nın toplam süresi. Uçuş tutmaları çoğu zaman belirli bir süre geçerlidir; saga bu süreyi aşacaksa tamamlanmayı beklemek yerine telafiye geçmek daha doğrudur.

:::predict{id="saga-otel-hatasi"}
Uçuş başarıyla tutuldu, otel "müsait oda yok" cevabı verdi, araç adımı henüz hiç çalışmadı. Orkestratör ne yapmalı? | The flight was held successfully, the hotel answered "no availability", and the car step never ran. What should the orchestrator do?
- [ ] Bütün adımlar için telafi göndermek: araç, otel ve uçuş iptali | Send compensations for every step: cancel car, hotel and flight
- [x] Yalnızca tamamlanmış adımları ters sırayla telafi etmek: bu durumda yalnızca uçuş iptali | Compensate only completed steps in reverse order: here only cancel the flight
- [ ] Otel adımını başarılı olana kadar sonsuza dek yeniden denemek | Retry the hotel step forever until it succeeds
- [ ] Hiçbir şey yapmamak; uçuş tutması zaten kendiliğinden düşer | Do nothing; the flight hold will expire on its own anyway
Açıklama: Telafi yalnızca gerçekten tamamlanmış adımlar için anlamlıdır ve ters sırayla uygulanır. "Müsait oda yok" geçici değil iş kuralı kaynaklı bir sonuçtur, yeniden denemek işe yaramaz. Tutmanın kendiliğinden düşmesine güvenmek, koltuğu süre boyunca başkalarına kapatır ve sistemi belirsiz bırakır. | Compensation only makes sense for steps that actually completed, and runs in reverse order. "No availability" is a business outcome rather than a transient failure, so retrying is pointless. Relying on the hold expiring keeps the seat away from others for that time and leaves the system in an ambiguous state.
:::

:::animation{scene="scene.json"}
Orkestratörün uçuş ve otel adımlarını yürütmesi, otelde zaman aşımı ve aynı anahtarla yeniden deneme, "müsait oda yok" sonrası telafiye geçiş, orkestratörün çöküp olay geçmişinden kaldığı yerden devam etmesi ve uçuşun yeniden denenen bir telafiyle iptali.
:::

## Koreografi mi, orkestrasyon mu?

b-02'deki karşılaştırma burada somutlaşır. **Koreografide** uçuş servisi `FlightHeld` yayınlar, otel servisi bunu dinleyip oda tutar ve `HotelHeld` yayınlar, araç servisi de onu dinler. Otel başarısız olursa `HotelFailed` yayınlanır ve uçuş servisi bunu dinleyip kendini iptal eder. Üç adımlık bir akışta bu çalışır; ama "seyahat şu an hangi adımda?" sorusunun cevabı üç servisin günlüklerine dağılmıştır, yeni bir adım eklemek birden fazla servisi değiştirmeyi gerektirir ve havayolu gibi dış sistemler sizin olaylarınızı dinlemez.

**Orkestrasyonda** tek bir bileşen akışın sahibidir: hangi adımın çalıştığını, hangisinin tamamlandığını, hangi telafinin bekleyen olduğunu bilir ve bunu kalıcı olarak saklar. Dış sistemler yalnızca kendilerine gönderilen komutlara cevap verir. Seyahat gibi dış bağımlılıkları, zaman aşımları ve telafi bedelleri olan akışlarda orkestrasyon neredeyse her zaman doğru seçimdir. Koreografi ise iç servisler arasında, az adımlı ve sahibi belli olmayan "bilgilendirme" akışlarında (ör. sipariş verildi, sadakat puanı ekle) parlar.

## Orkestratörün durumu: veritabanı + outbox ya da dayanıklı yürütme

Orkestratör çökerse saga yarım kalmamalıdır. İki yaygın yol vardır.

**Kendi durum makineniz.** Saga'nın durumu (`STARTED`, `FLIGHT_HELD`, `COMPENSATING`...) bir tabloda tutulur. Her geçişte durum güncellemesi ve bir sonraki adımın komutu **aynı transaction'da** yazılır: komut bir outbox tablosuna girer, ayrı bir süreç onu kuyruğa taşır (j-01). Böylece "durum değişti ama komut kayboldu" ya da "komut gitti ama durum kaydedilmedi" olmaz. Katılımcılar komutları en az bir kez alacağı için her biri idempotent olmalıdır.

**Dayanıklı yürütme motoru.** Uber'in geliştirdiği Cadence ve onun devamı olan Temporal, orkestratörü sıradan bir fonksiyon gibi yazmanıza izin verir. Motor, fonksiyonun yaptığı her dış çağrının sonucunu bir **olay geçmişine** kaydeder (b-07'deki event sourcing'in aynısı). Süreç çökerse başka bir işçi geçmişi yeniden oynatarak fonksiyonu kaldığı satıra getirir; tamamlanmış adımlar tekrar çalıştırılmaz, sonuçları geçmişten okunur. Bunun koşulu, iş akışı kodunun **deterministik** olmasıdır: saat, rastgelelik ve G/Ç doğrudan değil, motorun sağladığı API'lerle kullanılır. AWS Step Functions aynı fikri JSON ile tanımlanan bir durum makinesiyle sunar: her durumun `Retry` ve `Catch` alanları vardır ve `Catch` bir telafi durumuna yönlendirilerek saga kurulur.

:::interactive{type="pipeline" stages="reserve-flight,reserve-hotel,reserve-car,charge-card,issue-tickets" failureStage="reserve-hotel" retries=2}
Hattı bir saga orkestratörünün ileri adımları olarak düşünün. Önce olduğu gibi çalıştırın: beş adım sırayla yeşile döner. Sonra "Hata enjekte et" kutusunu işaretleyin, aşama olarak `reserve-hotel`'i bırakın ve yeniden çalıştırın: günlükte otel adımının iki kez yeniden denendiğini (aynı idempotency anahtarıyla yapılması gereken denemeler) ve sonra başarısız olduğunu izleyin; `reserve-car` ve sonrası "atlandı" kalır. Dikkat edin: `reserve-flight` hâlâ yeşil. Simülatör bir CI hattı gibi orada durur, ama gerçek bir saga'da bu yeşil adım **açık bir taahhüttür** ve orkestratörün ona `CancelFlight` telafisi göndermesi gerekir. "Yeniden deneme"yi 0'a çekip tekrar deneyin: geçici bir zaman aşımı, yeniden deneme olmadan bütün rezervasyonu gereksiz yere iptal ettirir. Son aşamadaki filo paneli bu deney için anlamlı değildir; `issue-tickets` adımını, pivot'tan sonra gelen ve başarılı olana kadar yeniden denenen adım olarak okuyun.
:::

:::code{lang="ts" title="Temporal TypeScript SDK ile seyahat saga'sı: telafi yığını ve yeniden deneme politikası"}
```ts
import { proxyActivities, CancellationScope } from '@temporalio/workflow';
import type * as activities from './activities';

// İleri adımlar: geçici hatalarda üstel geri çekilmeyle yeniden dene, iş kuralı hatasında DENEME
const { reserveFlight, reserveHotel, reserveCar, chargeCard, issueTickets } = proxyActivities<typeof activities>({
  startToCloseTimeout: '10 seconds',                 // tek denemenin zaman aşımı
  retry: {
    initialInterval: '1 second',
    backoffCoefficient: 2,
    maximumAttempts: 4,
    nonRetryableErrorTypes: ['NoAvailability', 'CardDeclined'],
  },
});

// Telafiler: başarısız olamazlar, sınırsız yeniden denenirler (her biri idempotent olmalı)
const { cancelFlight, cancelHotel, cancelCar } = proxyActivities<typeof activities>({
  startToCloseTimeout: '30 seconds',
  retry: { initialInterval: '5 seconds', backoffCoefficient: 2, maximumInterval: '10 minutes' },
});

export async function bookTrip(trip: { id: string; userId: string }) {
  const compensations: Array<() => Promise<void>> = [];
  const key = (step: string) => `${trip.id}:${step}`; // idempotency anahtarı: saga + adım
  try {
    const flight = await reserveFlight(trip, key('flight'));
    compensations.unshift(() => cancelFlight(flight.pnr, key('cancel-flight')));

    const hotel = await reserveHotel(trip, key('hotel'));
    compensations.unshift(() => cancelHotel(hotel.ref, key('cancel-hotel')));

    const car = await reserveCar(trip, key('car'));
    compensations.unshift(() => cancelCar(car.ref, key('cancel-car')));

    await chargeCard(trip, key('charge'));           // pivot: bundan sonra geri dönüş yok
    compensations.length = 0;
    await issueTickets(trip, key('tickets'));         // tekrarlanabilir adım
    return { status: 'CONFIRMED', pnr: flight.pnr };
  } catch (err) {
    // İptal edilen bir iş akışında bile telafiler tamamlanmalı
    await CancellationScope.nonCancellable(async () => {
      for (const compensate of compensations) await compensate(); // ters sırada
    });
    throw err;
  }
}
```
:::

:::realworld{company="Uber ve Temporal"}
Uber, şirket içindeki uzun süren, çok adımlı iş akışlarını yönetmek için **Cadence** adlı bir iş akışı motoru geliştirdi ve açık kaynak olarak yayımladı. Cadence'ın temel fikri, orkestrasyon kodunu bir durum makinesi tablosu olarak değil, sıradan bir fonksiyon olarak yazdırmak ve bu fonksiyonun ilerleyişini motorun tuttuğu bir olay geçmişiyle dayanıklı hâle getirmektir. Cadence'ı geliştiren mühendislerden Maxim Fateev ve Samar Abbas, 2019'da Cadence'ın çatalı olarak **Temporal**'ı kurdu. Temporal belgeleri, iş akışı (workflow) ve aktivite (activity) ayrımını bu dersteki gibi anlatır: aktiviteler dış dünyaya dokunan, yeniden denenebilir adımlardır; iş akışı kodu deterministik olmalıdır, çünkü işçi çöktüğünde geçmiş yeniden oynatılarak kaldığı yerden sürdürülür. Temporal'ın örnek depolarında saga kalıbı, bu derstekine benzer bir seyahat rezervasyonu senaryosu ve telafi listesiyle de gösterilir. Benzer bir yaklaşımı AWS, Step Functions ile sunar: durum makinesinin her adımı için `Retry` ve `Catch` tanımlanır ve hata yakalandığında akış iptal adımlarına yönlendirilir. Bu araçların ortak dersi, saga mantığını servislere dağıtmak yerine, durumu kalıcı olarak tutan ve yeniden denemeyi platform düzeyinde çözen tek bir yerde toplamanın akışı hem okunur hem dayanıklı kıldığıdır.
:::

:::callout{tone="warning" title="Saga tasarımında sık hatalar"}
- **Telafiyi sonradan düşünmek**: Her telafi edilebilir adımın iptal API'si, ileri adımla birlikte tasarlanmalıdır. Dış sağlayıcının iptal desteği yoksa o adım pivot'tan sonraya taşınmalıdır.
- **Zaman aşımını hata saymak**: Sonucu bilinmeyen bir adım için telafi göndermeden önce aynı anahtarla yeniden deneyin ya da durumunu sorgulayın; aksi hâlde hiç tutulmamış bir rezervasyonu iptal etmeye çalışırsınız ya da tutulmuş olanı unutursunuz.
- **Anahtarsız yeniden deneme**: Idempotency anahtarı olmayan bir yeniden deneme iki oda, iki tahsilat demektir.
- **Durum ve komutu ayrı yazmak**: Orkestratör durumu ve gönderilecek komut outbox ile aynı transaction'da yazılmazsa çökme anında saga takılır.
:::

:::callout{tone="info" title="Mülakat ipuçları"}
- Adımları sınıflandırarak başlayın: telafi edilebilir, pivot, tekrarlanabilir; sırayı buna göre kurun.
- Zaman aşımının belirsizlik olduğunu ve cevabın aynı idempotency anahtarıyla yeniden deneme olduğunu söyleyin.
- Orkestratörün durumunun nasıl kalıcı olduğunu açıklayın: veritabanı + outbox ya da Temporal/Step Functions gibi dayanıklı yürütme.
:::

:::quiz{src="quiz.json"}
:::

:::resources
- [Pattern: Saga](https://microservices.io/patterns/data/saga.html) — makale — Chris Richardson, microservices.io
- [Sagas (Garcia-Molina ve Salem, 1987)](https://www.cs.cornell.edu/andru/cs711/2002fa/reading/sagas.pdf) — akademik makale — saga kavramını tanıtan özgün çalışma
- [Temporal documentation](https://docs.temporal.io/) — belge — iş akışı, aktivite, yeniden deneme politikaları
- [Cadence](https://cadenceworkflow.io/) — belge — Uber'in açık kaynak iş akışı motoru
:::

:::next{lesson="c-01-creational-patterns"}
Mimariler modülü burada bitiyor. Sırada tasarım kalıpları: nesne üretimini soyutlayan creational kalıplar — Singleton'dan Prototype'a UML, animasyon ve üç dilde kod.
:::

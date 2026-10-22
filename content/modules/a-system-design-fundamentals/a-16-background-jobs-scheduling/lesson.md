---
id: a-16-background-jobs-scheduling
slug: background-jobs-scheduling
module: a-system-design-fundamentals
order: 16
title:
  tr: "Arka Plan İşleri ve Zamanlanmış Görevler"
  en: "Background Jobs and Scheduled Tasks"
summary:
  tr: Kuyruk işçileri, at-least-once teslim ve idempotent işler, retry/backoff/DLQ, cron ve dağıtık kilit, uzun işlerin ilerleme bildirimi.
  en: Queue workers, at-least-once delivery and idempotent jobs, retry/backoff/DLQ, cron and distributed locks, progress reporting for long jobs.
durationMinutes: 30
level: intermediate
tags: [background-jobs, workers, retry, backoff, dlq, cron, distributed-lock, redis]
prerequisites: [a-04-stateless-stateful-sessions, a-09-message-queues-event-driven]
concepts: [background-jobs, at-least-once, idempotent-jobs, exponential-backoff, dead-letter-queue, cron-jobs, distributed-lock, job-progress, graceful-shutdown]
---

## Kavram: kullanıcıyı bekletmeyen iş

Kullanıcı sipariş verdi. Siparişi veritabanına yazmak 20 ms sürüyor; makbuz PDF'i oluşturmak, e-posta göndermek, depoya bildirim atmak ve analitik olayı yazmak ise birkaç saniye sürebiliyor ve bunların her biri dış bir servise bağlı. Bütün bunları HTTP isteğinin içinde yaparsak yanıt yavaşlar, e-posta sağlayıcısındaki bir aksaklık sipariş vermeyi bozar ve kullanıcı "tekrar dene" dediğinde aynı işler ikinci kez yapılır.

**Arka plan işi (background job)**, yanıt için şart olmayan işi istekten ayırıp bir kuyruğa bırakmaktır. API yalnızca "işi kaydettim" der (`202 Accepted` ya da siparişin kendisiyle `201`), ayrı süreçlerde çalışan **işçiler (worker)** kuyruktan işleri alıp yapar. Bu ayrım üç şey kazandırır: kullanıcıya hızlı yanıt, dış servislerin hatalarına karşı yeniden deneme imkânı ve işçi sayısını API'den bağımsız ölçekleyebilme. [Mesaj kuyrukları](/lessons/a-09-message-queues-event-driven) dersindeki teslim garantileri burada doğrudan iş garantilerine dönüşür.

## İşin yaşam döngüsü

Sidekiq, BullMQ, Celery ya da SQS tabanlı bir sistem olsun, bir iş hemen her yerde aynı durumlardan geçer:

1. **Kuyruğa alındı (enqueued):** İş tipi, parametreleri ve bir kimlikle kuyruğa yazılır.
2. **Rezerve edildi (reserved / in-flight):** Bir işçi işi alır; iş başka işçilere görünmez olur ama silinmez. İşçi belirli süre içinde onay (ACK) vermezse iş yeniden görünür hâle gelir (SQS'teki *visibility timeout*).
3. **Başarılı:** İşçi ACK verir, iş silinir.
4. **Başarısız → yeniden deneme:** İş gecikmeli bir kümeye konur ve süre dolunca tekrar kuyruğa girer.
5. **Ölü (dead):** Deneme sınırı aşılınca iş **dead-letter queue (DLQ)**'ya taşınır ve bir insan bakana kadar orada bekler.

:::diagram{src="diagram.svg" alt="Arka plan işinin durum makinesi ve cron işinin dağıtık kilitle tek replikada çalışması|State machine of a background job and a cron job running on a single replica via a distributed lock"}
Sol: iş durumları ve geçişleri (kuyruk → rezerve → başarılı; hata → gecikmeli deneme → tekrar kuyruk; sınır aşılınca DLQ). Sağ: üç replikada aynı anda tetiklenen saatlik iş; `SET NX PX` kilidini yalnızca biri alır.
:::

## At-least-once ve idempotent işler

Kuyruk sistemlerinin neredeyse hepsi **at-least-once** teslim eder: bir iş en az bir kez çalışır ama iki kez de çalışabilir. En klasik senaryo şudur: işçi e-postayı gönderir, ACK vermeden hemen önce çöker (deploy, bellek taşması, ağ kopması). Kuyruk işi tamamlanmamış sayar ve başka bir işçiye verir; müşteri iki makbuz alır. Ödeme gibi işlerde bunun bedeli çok daha ağırdır.

Çözüm, "tam olarak bir kez çalıştırmak" değil, **etkiyi bir kez üretmektir**: işler **idempotent** tasarlanır. Yaygın teknikler:

- **İdempotency anahtarı:** İşin doğal bir anahtarı olur (`receipt:order-42`). İşçi, işe başlamadan önce bu anahtarın "tamamlandı" olarak kaydedilip kaydedilmediğine bakar; iş bitince kaydı yazar. Ödeme sağlayıcılarının çoğu bu anahtarı API düzeyinde de kabul eder.
- **Koşullu yazma:** `UPDATE orders SET status='shipped' WHERE id=42 AND status='paid'` ikinci çalıştırmada hiçbir satırı etkilemez.
- **Doğal olarak idempotent işlemler:** "Sayaç +1" yerine "değeri 5 yap", "e-posta gönder" yerine "gönderilmemişse gönder".

Bir tuzak daha: işi veritabanı transaction'ı **commit olmadan** kuyruğa atarsanız, işçi siparişi henüz göremeyebilir ya da transaction geri alınırsa hiç var olmayan bir sipariş için e-posta gider. İşi commit'ten sonra kuyruğa almak ya da **transactional outbox** deseniyle aynı transaction'da bir tabloya yazıp oradan yayınlamak gerekir.

## Retry, backoff ve DLQ

Geçici hatalar (zaman aşımı, `503`, rate limit) yeniden denemeyle çoğunlukla düzelir; kalıcı hatalar (geçersiz e-posta adresi, silinmiş kayıt) düzelmez. İyi bir politika bu ikisini ayırır: kalıcı hatada hemen DLQ'ya gönderir, geçici hatada **üstel geri çekilme** ile tekrar dener: 15 s, 30 s, 1 dk, 2 dk… ve her bekleme süresine rastgele bir **jitter** ekler. Jitter olmazsa, aynı anda düşen bir dış servis için birikmiş binlerce iş aynı saniyede tekrar denenir ve servisi yeniden düşürür.

Deneme sınırı aşılan iş DLQ'ya gider. DLQ bir çöp kutusu değil, **gözlem ve kurtarma** alanıdır: boyutu için alarm kurulur, hatanın nedeni düzeltildikten sonra işler tek tıkla yeniden kuyruğa alınabilir (*replay*). Bu ancak işler idempotent olduğunda güvenlidir.

:::predict{id="is-ack-kaybi"}
Bir işçi müşteriye makbuz e-postasını başarıyla gönderdi, ama ACK vermeden hemen önce süreci bir deploy ile sonlandırıldı. İş idempotent tasarlanmamış. Ne olur? | A worker successfully sent the receipt email, but its process was killed by a deploy right before it could ACK. The job is not idempotent. What happens?
- [ ] Hiçbir şey; e-posta gittiği için iş tamamlanmış sayılır | Nothing; the email was sent so the job counts as complete
- [x] Rezervasyon süresi dolunca iş tekrar görünür, başka bir işçi alır ve müşteri ikinci bir e-posta alır | The reservation times out, the job becomes visible again, another worker takes it and the customer gets a second email
- [ ] İş doğrudan DLQ'ya düşer | The job goes straight to the DLQ
- [ ] Kuyruk e-postanın gönderildiğini sağlayıcıdan sorgulayıp işi atlar | The queue asks the provider whether the email was sent and skips the job
Açıklama: Kuyruk yalnızca ACK'i görür; işin yan etkisinden haberi yoktur. ACK gelmediği için iş tamamlanmamış sayılır ve at-least-once garantisi gereği yeniden teslim edilir. Bu bir hata değil, deneme hakkı tüketen normal bir yeniden teslimdir; DLQ yalnızca deneme sınırı aşılınca devreye girer. Çift e-postayı engellemenin yolu, işçinin `receipt:order-42` gibi bir idempotency anahtarını kontrol etmesidir. | The queue only sees the ACK; it knows nothing about the job's side effects. Without an ACK the job is incomplete and is redelivered under the at-least-once guarantee. This is a normal redelivery, not a dead letter; the DLQ is used only after the retry limit. The way to prevent a duplicate email is for the worker to check an idempotency key such as `receipt:order-42`.
:::

:::animation{scene="scene.json"}
Bir makbuz işi kuyruğa girer, işçi alır ve dış servis hatası alır; iş backoff ile iki kez daha denenir ve DLQ'ya düşer. Sorun giderilince iş DLQ'dan yeniden oynatılır; ACK kaybından sonra gelen tekrar teslim idempotency anahtarıyla atlanır.
:::

:::interactive{type="message-queue" producers=1 consumers=2 partitions=2 failureRate=0.3 maxRetries=3 idempotent=false}
"Başlat" ile işleri üretin ve günlükte yeniden deneme satırlarını izleyin. "Hata oranı"nı yükseltip "Maks. yeniden deneme"yi 1'e düşürün: kaç iş "deneme sınırı aşıldı → DLQ" satırıyla ölü kuyruğa düşüyor? Sınırı tekrar 3'e çıkarıp farkı görün. Ardından "Çift işleme" sayacına bakın: "işlendi ama ACK kayboldu" satırlarından sonra aynı iş ikinci kez yapılıyor. "Idempotent tüketici (tekrarları ayıkla)" kutusunu işaretleyip aynı trafiği tekrarlayın; tekrar eden işlerin idempotency anahtarıyla atlandığını doğrulayın. Son olarak "Tüketici sayısı"nı artırıp kuyruk gecikmesinin (lag) nasıl eridiğine bakın.
:::

## Cron ve dağıtık kilit

Zamanlanmış görevler ("her saat hatırlatma gönder", "her gece süresi dolmuş token'ları sil") ilk bakışta kuyruktan bağımsızdır, ama yatay ölçeklemede ilginç bir sorun yaratır: uygulamayı üç replika çalıştırırsanız, her replikadaki zamanlayıcı aynı anda tetiklenir ve kullanıcı üç hatırlatma alır.

Bu projenin backend'i bu sorunu gerçek bir örnekle çözüyor. `NotificationsService` içindeki saatlik iş, NestJS'in `@Cron(CronExpression.EVERY_HOUR)` dekoratörüyle **her replikada** tetikleniyor. İşin ilk satırı Redis'te saat damgalı bir kilit almaya çalışıyor: `SET lock:reminders:2026-10-22T14 <pid> PX 3300000 NX`. `NX` "yalnızca anahtar yoksa yaz" demektir; Redis tek iş parçacıklı olduğu için bu komutu aynı anda gönderen replikalardan yalnızca biri `OK` alır, diğerleri `null` alıp sessizce çıkar. `PX` ile verilen 55 dakikalık ömür, kilidin bir sonraki saatin işini engellemeden kendiliğinden düşmesini sağlar; anahtardaki saat damgası ise her saatin ayrı bir kilit olmasını garanti eder. Gece çalışan refresh token temizliği de aynı yöntemle günlük bir kilit kullanıyor.

Bu tasarımın bilinçli bedelleri vardır. Kilidi alan replika iş ortasında çökerse o saatin hatırlatmaları gönderilmez: kopya bildirimden kaçınmak için "en fazla bir kez" seçilmiştir. Kod ayrıca kullanıcı başına hata yakalama yapar, böylece tek bir bozuk kayıt tüm işi durdurmaz. Kritik işlerde kilit tek başına yetmez: süreç uzun bir GC duraklamasına girer ve kilidin süresi dolarsa iki süreç aynı anda kilidi tuttuğunu sanabilir. Bunun için kilit her alınışında artan bir **fencing token** üretir ve veriyi yazan sistem eski token'la gelen yazmaları reddeder.

:::code{lang="ts" title="Saatlik iş: her replikada tetiklenir, Redis kilidini yalnızca biri alır (bu projenin deseni)"}
```ts
import { Cron, CronExpression } from '@nestjs/schedule';
import type { Redis } from 'ioredis';

export class RemindersJob {
  constructor(private readonly redis: Redis) {}

  /** Dağıtık tek seferlik kilit: SET NX PX — yalnızca bir replika 'OK' alır */
  private async acquireLock(key: string, ttlMs: number): Promise<boolean> {
    return (await this.redis.set(key, String(process.pid), 'PX', ttlMs, 'NX')) === 'OK';
  }

  @Cron(CronExpression.EVERY_HOUR)
  async run(): Promise<void> {
    const hourKey = new Date().toISOString().slice(0, 13); // ör. 2026-10-22T14
    if (!(await this.acquireLock(`lock:reminders:${hourKey}`, 55 * 60 * 1000))) return;

    for (const user of await this.dueUsers()) {
      try {
        await this.send(user); // tek kullanıcının hatası tüm işi durdurmasın
      } catch (err) {
        console.warn('hatırlatma gönderilemedi', user.id, err);
      }
    }
  }

  private async dueUsers(): Promise<{ id: string }[]> {
    return []; // hatırlatma saati gelmiş kullanıcılar
  }
  private async send(_user: { id: string }): Promise<void> {}
}
```
:::

## Uzun işler: ilerleme, iptal ve kapanış

Bir CSV içe aktarma ya da toplu e-posta işi dakikalarca sürebilir. Bu tür işler için üç şey tasarlanmalıdır. **İlerleme:** İş bir durum kaydı tutar (`queued`, `running 42%`, `done`, `failed`); istemci bunu bir uç noktadan sorgular ya da [WebSocket](/lessons/a-14-websocket-realtime) üzerinden anlık alır. **Parçalama ve checkpoint:** İş tek dev bir işlem yerine küçük parçalara bölünür ve her parçadan sonra kaldığı yeri (imleç) kaydeder; yeniden başlarsa baştan değil oradan devam eder. **Zarif kapanış:** Deploy sırasında süreç `SIGTERM` aldığında yeni iş almayı bırakır, elindeki parçayı bitirir ya da checkpoint'ini yazar ve işi kuyruğa geri bırakır.

:::realworld{company="Shopify ve Sidekiq"}
Sidekiq'in resmi belgelerindeki hata yönetimi sayfası, olgun bir retry politikasının nasıl göründüğünü anlatır: başarısız işler, her denemede belirgin şekilde uzayan ve rastgelelik eklenmiş bir üstel geri çekilmeyle yeniden denenir; varsayılan olarak 25 deneme yaklaşık üç haftaya yayılır. Deneme hakkı biten iş "Dead" kümesine taşınır ve web arayüzünden incelenip yeniden çalıştırılabilir. Belge aynı zamanda işlerin idempotent ve tekrar çalıştırılmaya dayanıklı yazılması gerektiğini açıkça vurgular.

Shopify, uzun süren arka plan işleri için açık kaynak **job-iteration** kütüphanesini yayımladı. Kütüphanenin çıkış noktası, sık deploy edilen ve süreçleri kısa ömürlü olan bir altyapıda saatler süren işlerin sürekli kesintiye uğramasıdır. Çözüm, işi bir koleksiyon üzerinde iterasyon olarak tanımlamak ve her adımdan sonra imleci kaydetmektir: süreç durdurulduğunda iş kaldığı imleçten kuyruğa geri döner ve başka bir işçide devam eder. Bu, dersteki "parçalama + checkpoint + zarif kapanış" üçlüsünün üretimdeki karşılığıdır.
:::

:::callout{tone="warning" title="Kilit, idempotency'nin yerini tutmaz"}
Dağıtık kilit "aynı anda iki kez çalışmasın" sorununu büyük ölçüde çözer ama "iki kez çalışırsa zarar vermesin" sorununu çözmez. Kilidin süresi dolabilir, Redis düşebilir, kilit sahibi duraklayabilir. Para, stok ya da bildirim gibi yan etkileri olan işlerde kilidi bir optimizasyon, idempotency'yi ise asıl güvence olarak görün.
:::

:::callout{tone="tip" title="Mülakat özeti"}
- "Bunu arka plana alırım" dediğinizde dört soruyu cevaplayın: teslim garantisi (at-least-once), idempotency anahtarı, retry politikası (backoff + jitter + sınır), DLQ ve alarm.
- Cron + çok replika = kopya çalışma; çözüm olarak dağıtık kilit ya da tek bir zamanlayıcının kuyruğa iş bırakmasını önerin.
- Uzun işler için ilerleme kaydı, checkpoint ve `SIGTERM` ile zarif kapanışı söyleyin.
:::

:::quiz{src="quiz.json"}
:::

:::resources
- [Sidekiq Wiki: Error Handling](https://github.com/sidekiq/sidekiq/wiki/Error-Handling) — belge — otomatik retry, backoff ve Dead kümesi
- [Shopify/job-iteration](https://github.com/Shopify/job-iteration) — depo — kesintiye dayanıklı, kaldığı yerden devam eden işler
- [Timeouts, retries, and backoff with jitter](https://aws.amazon.com/builders-library/timeouts-retries-and-backoff-with-jitter/) — makale — Amazon Builders' Library
- [How to do distributed locking](https://martin.kleppmann.com/2016/02/08/how-to-do-distributed-locking.html) — blog — Martin Kleppmann; fencing token ve kilit tuzakları
- [Redis: SET](https://redis.io/docs/latest/commands/set/) — belge — NX ve PX seçenekleri
:::

:::next{lesson="a-17-grpc-graphql-rest"}
Sırada: API stilleri. Aynı veriyi REST, GraphQL ve gRPC ile taşımak; sözleşmeler, streaming, N+1 problemi ve hangi durumda hangisinin seçileceği.
:::

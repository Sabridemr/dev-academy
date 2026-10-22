---
id: a-14-websocket-realtime
slug: websocket-realtime
module: a-system-design-fundamentals
order: 14
title:
  tr: "WebSocket ve Gerçek Zamanlı Sistemler"
  en: "WebSockets and Real-Time Systems"
summary:
  tr: Polling → long polling → SSE → WebSocket; bağlantı yaşam döngüsü, Redis pub/sub ile yatay ölçekleme, yeniden bağlanma, kaçan mesajlar ve presence.
  en: Polling → long polling → SSE → WebSocket; connection lifecycle, horizontal scaling with Redis pub/sub, reconnection, missed messages and presence.
durationMinutes: 30
level: intermediate
tags: [websocket, realtime, sse, pubsub, redis, socketio, presence]
prerequisites: [a-01-client-server-dns-http, a-04-stateless-stateful-sessions, a-09-message-queues-event-driven]
concepts: [polling, long-polling, server-sent-events, websocket, connection-lifecycle, pubsub-fanout, redis-adapter, reconnect-backoff, missed-messages, presence]
---

## Kavram: sunucunun konuşmaya başlayabilmesi

HTTP'nin temel sözleşmesi "istemci sorar, sunucu cevaplar"dır. Sohbet mesajı, canlı skor, sipariş durumu, bir arkadaşın çevrimiçi olması ya da bir rozetin kazanılması gibi olaylarda ise bilgiyi ilk bilen sunucudur; istemcinin ne zaman soracağını bilmesi mümkün değildir. **Gerçek zamanlı sistem**, olayın sunucuda oluştuğu an ile kullanıcının ekranında göründüğü an arasındaki süreyi saniyenin altına indirmeye çalışan sistemdir. Bunun için dört teknik sırayla gelişti ve her biri bir öncekinin zayıflığını kapattı.

## Polling'den WebSocket'e dört basamak

**1. Kısa polling (short polling).** İstemci her *N* saniyede bir `GET /notifications?since=…` gönderir. Uygulaması en basit yöntemdir ve her proxy, load balancer ve CDN ile sorunsuz çalışır. Bedeli iki yönlüdür: yanıtların çoğu "yeni bir şey yok" olduğu için sunucu boşa iş yapar, olay ise ortalama *N/2* saniye gecikir. Aralığı kısaltmak gecikmeyi düşürür ama yükü doğrudan artırır.

**2. Long polling.** İstemci isteği gönderir; sunucu yeni olay yoksa yanıtı hemen döndürmez, bir olay oluşana ya da zaman aşımı (ör. 30 sn) dolana kadar bağlantıyı açık tutar. Olay gelince yanıt döner ve istemci hemen yeni bir istek açar. Gecikme neredeyse sıfıra iner ve boş yanıtlar ortadan kalkar. Ancak her olaydan sonra yeni bir HTTP isteği kurulur, başlıklar yeniden gönderilir ve iki istek arasındaki kısa boşlukta oluşan olayların kaybolmaması için `since` imleci dikkatle yönetilmelidir.

**3. Server-Sent Events (SSE).** İstemci tek bir HTTP isteği açar, sunucu `Content-Type: text/event-stream` ile yanıtı hiç kapatmadan satır satır olay yazar. Tarayıcıdaki `EventSource` API'si koptuğunda otomatik olarak yeniden bağlanır ve son aldığı olayın kimliğini `Last-Event-ID` başlığıyla sunucuya bildirir; bu, kaçan olayların telafisi için hazır bir mekanizmadır. SSE **tek yönlüdür** (sunucudan istemciye) ve düz HTTP olduğu için kurumsal proxy'lerden kolay geçer. Bildirim akışı, canlı skor ya da LLM yanıtlarının parça parça gönderilmesi gibi işler için çoğu zaman yeterlidir.

**4. WebSocket.** Bağlantı bir HTTP isteğiyle başlar (`Upgrade: websocket`), sunucu `101 Switching Protocols` ile yanıt verir ve aynı TCP bağlantısı üzerinde **çift yönlü**, çerçeve (frame) tabanlı bir kanal açılır (RFC 6455). Her mesaj yalnızca birkaç baytlık bir çerçeve başlığı taşır; HTTP başlıkları tekrar gönderilmez. Sohbet, çok oyunculu oyun, ortak belge düzenleme ve istemcinin de sık mesaj gönderdiği her senaryo için doğru araçtır.

:::diagram{src="diagram.svg" alt="Kısa polling, long polling, SSE ve WebSocket için istemci-sunucu zaman çizelgeleri|Client-server timelines for short polling, long polling, SSE and WebSocket"}
Aynı üç olayın dört teknikte istemciye ulaşması: polling'de olaylar bir sonraki sorguyu bekler, long polling'de her olaydan sonra yeni istek açılır, SSE ve WebSocket'te ise tek bağlantı açık kalır.
:::

## Bağlantı yaşam döngüsü

Bir WebSocket bağlantısı dört evreden geçer: **el sıkışma** (HTTP upgrade; kimlik doğrulama bu aşamada token ile yapılır), **açık** (iki yönlü mesajlaşma), **canlılık kontrolü** ve **kapanış**. Canlılık kontrolü sanıldığından önemlidir: mobil ağlarda ve NAT cihazlarında boşta kalan TCP bağlantıları sessizce düşürülür ve iki taraf da bunu fark etmez. Bu yüzden belirli aralıklarla ping/pong (heartbeat) gönderilir; cevap gelmeyen bağlantı kapatılır ve kaynakları serbest bırakılır.

Asıl mimari sonuç şudur: WebSocket bağlantısı **stateful**'dur. [Stateless ve stateful oturumlar](/lessons/a-04-stateless-stateful-sessions) dersinde HTTP isteklerinin herhangi bir replikaya gidebildiğini gördük. Açık bir soket ise belirli bir sunucu sürecine bağlıdır; o süreç yeniden başlarsa bağlantı kopar. Ölçekleme, deploy ve hata senaryolarının hepsi bu gerçek etrafında tasarlanır. Bir sunucunun aynı anda tutabileceği bağlantı sayısını da çoğu zaman CPU değil bellek ve dosya tanımlayıcı sınırı belirler; bu yüzden bağlantı katmanı genellikle iş mantığından ayrı ölçeklenir.

## Yatay ölçeklemede pub/sub: Redis adapter

İki API replikası düşünün. Kullanıcı A'nın soketi replika 1'de, kullanıcı B'nin soketi replika 2'de açık. A "kanal:42" odasına bir mesaj gönderdiğinde replika 1 mesajı yalnızca **kendi belleğindeki** soketlere iletebilir; B'nin soketinden haberi yoktur. Çözüm, replikalar arasında bir **pub/sub** omurgası kurmaktır: her replika olayı ortak bir kanala yayınlar (`PUBLISH`), her replika bu kanala abonedir (`SUBSCRIBE`) ve mesajı kendi yerel soketlerine dağıtır.

Bu projenin kendisi tam olarak bunu yapıyor: backend socket.io kullanıyor ve `@socket.io/redis-adapter` bağlı. Bir replikadan yayınlanan ilerleme, seri ya da rozet olayı, Redis pub/sub üzerinden kullanıcının soketinin bağlı olduğu replikaya ulaşıyor. [DevAcademy mimarisi](/lessons/f-08-devacademy-architecture) dersindeki "stateful bağlantılar" notu bu dersin pratik karşılığıdır.

:::predict{id="ws-kopan-baglanti"}
B'nin bağlı olduğu replika 2 deploy sırasında yeniden başlatıldı. Tam o birkaç saniyede A yeni bir mesaj gönderdi ve olay Redis pub/sub'a yayınlandı. B yeniden bağlandığında bu mesaja ne olur? | Replica 2, which B was connected to, restarted during a deploy. In those few seconds A sent a new message and the event was published to Redis pub/sub. What happens to that message when B reconnects?
- [ ] Redis mesajı B yeniden bağlanana kadar saklar ve otomatik teslim eder | Redis keeps the message until B reconnects and delivers it automatically
- [x] Mesaj B için kaybolur; telafi için kalıcı bir kaynaktan "son gördüğüm olaydan sonrası" sorgulanmalıdır | The message is lost for B; it must be recovered by querying a durable source for everything after the last event seen
- [ ] socket.io mesajı replika 2'nin belleğinde tutar ve yeniden başlatmadan sonra gönderir | socket.io keeps the message in replica 2's memory and sends it after the restart
Açıklama: Redis pub/sub "ateşle ve unut" çalışır: o anda dinlemeyen aboneler için mesaj saklanmaz ve yeniden başlatılan sürecin belleği zaten silinmiştir. Bu yüzden önemli olaylar kalıcı bir depoya (veritabanı tablosu, Redis Streams, Kafka) sıra numarasıyla yazılır; istemci yeniden bağlanırken son gördüğü sıra numarasını gönderir ve aradaki olayları ister. | Redis pub/sub is fire-and-forget: nothing is stored for subscribers that are not listening at that moment, and the restarted process has lost its memory anyway. So important events are written to a durable store (a database table, Redis Streams, Kafka) with a sequence number; on reconnect the client sends the last sequence it saw and asks for the gap.
:::

:::animation{scene="scene.json"}
İki API replikası, Redis pub/sub ile birbirinin soketlerine olay taşır; replika 2 düşünce B'nin bağlantısı kopar, B backoff ile yeniden bağlanır ve son sıra numarasından itibaren kaçan olayı alır.
:::

:::interactive{type="request-journey" stages="sender,ws-gateway-a,pubsub-bus:2,ws-gateway-b,websocket-recipient" rttMs=60 slowService="none" failureStage="ws-gateway-b"}
Bir olayın gönderen istemciden replika A'ya, pub/sub veri yoluna, replika B'ye ve oradan alıcının açık soketine yolculuğunu izleyin. "Yavaş katman" seçiminde `ws-gateway-b`'yi seçin: binlerce bağlantı taşıyan aşırı yüklü bir replika, olayın yalnızca o replikadaki kullanıcılara geç ulaşmasına yol açar. "Hata enjekte et: ws-gateway-b" kutusunu işaretleyip tekrar gönderin: olay pub/sub'a kadar gelir ama alıcıya ulaşmaz — yeniden bağlanma ve sıra numarasıyla telafinin neden gerektiğini burada görürsünüz. RTT kaydırıcısını büyütünce şelalede en çok alıcının soketi (`websocket-recipient`) ve ilk sıçrama uzar; replikalar arası trafik veri merkezi içinde kaldığı için neredeyse değişmez.
:::

## Yeniden bağlanma ve kaçan mesajlar

Bağlantılar kopacak; tasarım bunu varsayar. Doğru bir yeniden bağlanma stratejisinin üç parçası vardır:

1. **Üstel geri çekilme ve jitter.** Bir replika düştüğünde on binlerce istemci aynı saniyede yeniden bağlanmaya çalışırsa kalan replikalar bu dalgayla devrilir. Bekleme süresi her denemede katlanır (1 s, 2 s, 4 s… bir üst sınırla) ve rastgele bir pay eklenir.
2. **Sıra numarası ile telafi.** Her olay kalıcı bir kaynaktan artan bir `seq` ile çıkar. İstemci son işlediği `seq` değerini saklar ve yeniden bağlanırken gönderir; sunucu aradaki olayları sırayla yollar. SSE'nin `Last-Event-ID`'si ve Discord gateway'inin "resume" işlemi aynı fikrin uygulamalarıdır.
3. **Tam yeniden senkronizasyon.** Kopukluk çok uzun sürdüyse ya da sunucu geçmişi artık tutmuyorsa (ör. yalnızca son 10 dakikayı tutuyorsa), istemci durumu REST üzerinden baştan yükler ve canlı akışa oradan bağlanır.

Deploy sırasında bağlantıları aniden kesmek yerine replikalar **drain** edilir: yeni bağlantı kabul edilmez, mevcut istemcilere "yeniden bağlan" sinyali gönderilir ve bağlantılar kademeli olarak başka replikalara taşınır.

## Presence: kim çevrimiçi?

"Çevrimiçi" göstergesi basit görünür ama dağıtık bir problemdir. Yaygın yöntem, heartbeat geldikçe yenilenen kısa ömürlü bir anahtar tutmaktır (`SET presence:user:7 replica-2 EX 60`). Heartbeat kesilirse anahtar kendiliğinden düşer ve kullanıcı çevrimdışı görünür. Bir kullanıcının birden fazla cihazı olabileceği için presence bağlantı başına değil kullanıcı başına toplanır. Büyük odalarda her presence değişikliğini herkese anında yaymak trafiği patlatır; bu yüzden değişiklikler toplanıp birkaç saniyede bir gönderilir ya da yalnızca ekranda görünen kullanıcılar için abone olunur.

:::code{lang="ts" title="socket.io + Redis adapter: replikalar arası yayın ve sıra numarasıyla telafi"}
```ts
import { createServer } from 'node:http';
import { Server } from 'socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import { Redis } from 'ioredis';

const pub = new Redis(process.env.REDIS_URL!);
const sub = pub.duplicate();
const io = new Server(createServer(), { pingInterval: 25_000, pingTimeout: 20_000 });
io.adapter(createAdapter(pub, sub)); // emit'ler Redis pub/sub ile tüm replikalara gider

io.on('connection', async (socket) => {
  const userId = await authenticate(socket.handshake.auth.token); // el sıkışmada kimlik
  socket.join(`user:${userId}`);

  // Telafi: istemci son gördüğü sıra numarasını gönderir, aradaki olaylar kalıcı depodan gelir
  const lastSeq = Number(socket.handshake.auth.lastSeq ?? 0);
  for (const ev of await eventsAfter(userId, lastSeq)) socket.emit('event', ev);
});

/** Olay önce kalıcı depoya (seq ile) yazılır, sonra canlı yayına çıkar */
export async function notify(userId: string, payload: unknown) {
  const ev = await saveEvent(userId, payload); // { seq, payload }
  io.to(`user:${userId}`).emit('event', ev); // soket hangi replikada olursa olsun ulaşır
}
```
:::

:::realworld{company="Slack ve Discord"}
Slack mühendislik blogundaki *Real-time Messaging* yazısı, mesajların istemcilere nasıl ulaştığını anlatır. Kullanıcıların WebSocket bağlantılarını **gateway sunucuları** tutar; her kanal ise consistent hashing ile bir **channel sunucusuna** eşlenir. Bir mesaj gönderildiğinde channel sunucusu onu o kanala abone olan gateway sunucularına dağıtır, gateway'ler de kendi bağlantılarına iletir. Bu, dersteki "bağlantıyı tutan katman" ile "olayı dağıtan katman" ayrımının büyük ölçekli bir örneğidir. Slack, WebSocket trafiğini Envoy'a taşıma sürecini de ayrı bir yazıda paylaşmıştır.

Discord'un geliştirici belgelerindeki **Gateway** sözleşmesi, yeniden bağlanmanın nasıl tasarlanacağını açıkça gösterir: istemci sunucunun bildirdiği aralıkla heartbeat gönderir; bağlantı koparsa yeni oturum açmak yerine oturum kimliği ve son aldığı olayın sıra numarasıyla **resume** ister ve sunucu aradaki olayları yeniden oynatır. Discord, gateway katmanını Elixir ile nasıl ölçeklediğini *How Discord Scaled Elixir to 5,000,000 Concurrent Users* yazısında anlatmıştır.
:::

:::callout{tone="warning" title="Her şeye WebSocket gerekmez"}
Olaylar yalnızca sunucudan istemciye akıyorsa önce SSE'yi düşünün: düz HTTP olduğu için load balancer, kimlik doğrulama ve gözlemleme altyapınızla doğal çalışır ve yeniden bağlanma tarayıcıda hazırdır. Dakikada bir değişen bir pano için ise 30 saniyelik kısa polling çoğu zaman en ucuz ve en dayanıklı çözümdür. Bu projenin mobil uygulamasının WebSocket kullanmaması da bilinçli bir sadelik tercihidir.
:::

:::callout{tone="tip" title="Mülakat özeti"}
- Teknik seçimini yön ve sıklıkla gerekçelendirin: tek yön ve seyrek → polling/SSE; çift yön ve sık → WebSocket.
- "Bağlantılar stateful" deyin ve hemen ardından replikalar arası pub/sub'ı (Redis, NATS, Kafka) çizin.
- Kopma senaryosunu kendiliğinizden açın: backoff + jitter, sıra numarasıyla telafi, deploy'da drain.
:::

:::quiz{src="quiz.json"}
:::

:::resources
- [RFC 6455: The WebSocket Protocol](https://datatracker.ietf.org/doc/html/rfc6455) — belge — el sıkışma, çerçeveler, ping/pong ve kapanış
- [HTML Standard: Server-sent events](https://html.spec.whatwg.org/multipage/server-sent-events.html) — belge — EventSource ve Last-Event-ID
- [Socket.IO: Redis adapter](https://socket.io/docs/v4/redis-adapter/) — belge — çok replikalı yayın
- [Slack Engineering: Real-time Messaging](https://slack.engineering/real-time-messaging/) — blog — gateway ve channel sunucuları
- [Discord: Gateway](https://discord.com/developers/docs/events/gateway) — belge — heartbeat, resume ve sıra numaraları
:::

:::next{lesson="a-15-search-systems"}
Sırada: arama sistemleri. Bir arama kutusunun arkasındaki ters indeks, BM25 ile sıralama ve PostgreSQL full-text'in ne zaman yettiği.
:::

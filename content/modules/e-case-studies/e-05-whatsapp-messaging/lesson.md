---
id: e-05-whatsapp-messaging
slug: whatsapp-messaging
module: e-case-studies
order: 5
title:
  tr: "WhatsApp: Mesaj Teslimi, Online Durum, Uçtan Uca Şifreleme"
  en: "WhatsApp: Message Delivery, Presence, End-to-End Encryption"
summary:
  tr: Teslim garantileri, presence, Signal protokolü kavramsal.
  en: Delivery guarantees, presence, the Signal protocol conceptually.
durationMinutes: 40
level: advanced
tags: [case-study, messaging, websocket, encryption, real-time, interview]
prerequisites: [a-01-client-server-dns-http, a-09-message-queues-event-driven, a-12-replication, e-04-uber-geo-matching]
concepts: [connection-servers, per-user-message-queue, delivery-receipts, presence-heartbeat, group-fan-out, end-to-end-encryption, double-ratchet, offline-delivery]
---

## Vaka: "WhatsApp'ı tasarla"

Mesajlaşma, önceki vakaların tersine **küçük ama çok sayıda ve kaybolmaması gereken** yazmalardan oluşur. Bir mesaj 100–200 bayttır, ama günde 100 milyarı gönderilir, her biri *tam olarak bir kez* ve *sırayla* teslim edilmelidir ve sunucu içeriği okuyamamalıdır. Üç alt problem vardır: milyonlarca **kalıcı bağlantıyı** tutmak, çevrimiçi/çevrimdışı tüm durumlarda **teslim garantisi** vermek ve bunu **uçtan uca şifreli** yapmak.

## 1. Gereksinimler

### Fonksiyonel
- Birebir ve grup mesajı (metin, medya); gönderildi ✓, teslim edildi ✓✓, okundu (mavi ✓✓)
- Çevrimdışı alıcıya mesaj bekletme ve bağlanınca teslim
- Presence: "çevrimiçi", "son görülme", "yazıyor…"
- Uçtan uca şifreleme: sunucu düz metni asla görmez
- Çoklu cihaz, medya paylaşımı, sesli/görüntülü arama (bu derste kapsam dışı)

### Fonksiyonel olmayan

| Gereksinim | Hedef | Gerekçe |
|---|---|---|
| Teslim gecikmesi | Çevrimiçi alıcıya < 500 ms | Sohbet hissi |
| Teslim garantisi | En az bir kez taşıma + istemcide tekilleştirme → tam olarak bir kez etkisi | Mesaj kaybı güveni yok eder |
| Sıra | Aynı sohbette gönderen sırası korunur | Cevap sorudan önce görünemez |
| Erişilebilirlik | %99.99+; bağlantı kopması saniyeler içinde onarılır | Kullanıcılar sürekli ağ değiştirir |
| Gizlilik | Sunucuda yalnızca şifreli metin, teslim sonrası silinir | Ürünün çekirdek vaadi |
| Ölçek | 2 Mia kullanıcı, 100 Mia mesaj/gün | Sunucu başına milyonlarca bağlantı |

## 2. Kapasite tahmini

Varsayımlar: 1.5 Mia DAU; kullanıcı başına günde ~70 mesaj gönderimi ve ~100 alım/senkron olayı; mesaj ~200 B (şifreli yük + başlık); eşzamanlı bağlı kullanıcı ~%30.

- **Mesaj hızı** = 100 Mia / 86 400 ≈ **1.16 M mesaj/s**; tepe (yılbaşı gecesi) 3–5×
- **Eşzamanlı bağlantı** = ~450 M WebSocket; sunucu başına 1–2 M bağlantı (Erlang/FreeBSD ayarıyla) → **birkaç yüz bağlantı sunucusu**
- **Bant genişliği** = 1.16 M × 200 B ≈ 230 MB/s — önemsiz; **darboğaz bayt değil bağlantı ve yönlendirme**
- **Çevrimdışı depolama**: mesajlar yalnızca teslim edilene kadar tutulur (en fazla 30 gün); herhangi bir anda ~%10 bekliyorsa ≈ 10 Mia × 200 B ≈ **2 TB** — şaşırtıcı derecede küçük
- **Presence trafiği**: her bağlantı 30 s'de bir heartbeat → 15 M heartbeat/s; durum değişimi abone olan kişilere fan-out edilir

Ders: depolama ve bant genişliği ucuz; pahalı olan **durum** (hangi kullanıcı hangi sunucuda, hangi mesaj hangi aşamada) ve bunu kayıpsız tutmaktır.

:::interactive{type="capacity-estimator" dau=1500000000 readsPerUserPerDay=100 writesPerUserPerDay=70 avgWriteSizeBytes=200 avgReadSizeBytes=200 peakMultiplier=4 hotDataRatio=0.1 replicationFactor=3}
Egress ve depolama sayılarının video vakasına göre ne kadar küçük olduğuna dikkat edin. Sonra tepe çarpanını 1'den 5'e çekin: yılbaşı gecesi mesaj hızı bir yönlendirici sunucunun (~50 K mesaj/s) kaç katı? Bu hesap, bağlantı ve yönlendirme katmanının neden ayrı ölçeklendiğini gösterir.
:::

## 3. Yüksek seviye mimari

:::diagram{src="diagram.svg" alt="WhatsApp mimarisi: istemciler ve kalıcı bağlantı sunucuları, oturum kayıt servisi, mesaj yönlendirici, kullanıcı başına çevrimdışı kuyruk, push bildirim köprüsü, presence servisi, anahtar sunucusu ve medya deposu|WhatsApp architecture: clients and persistent connection servers, session registry, message router, per-user offline queue, push notification bridge, presence service, key server and media store"}
Sunucular yalnızca şifreli yükü taşır; anahtarlar cihazlarda üretilir, sunucu sadece açık anahtar paketlerini dağıtır.
:::

## 4. Bileşenlerin derinleştirilmesi

### Bağlantı sunucuları
Her istemci tek bir **kalıcı bağlantı** açar (WebSocket ya da özel protokol; WhatsApp XMPP türevi FunXMPP + Noise ile başladı). Bağlantı sunucusu durumsuza yakındır: yalnızca "bu soket şu kullanıcıya ait" bilgisini tutar ve bunu **oturum kayıt servisine** (session registry: `userId → connServerId, deviceId, lastSeen`) yazar. Sunucu düşerse istemciler jitter'lı yeniden bağlanır, kayıt güncellenir, bekleyen mesajlar yeniden teslim edilir. Bağlantı başına kilobaytlarla ölçülen bellek, sunucu başına milyonlarca bağlantıyı mümkün kılar.

### Mesaj yönlendirici ve kullanıcı başına kuyruk
Mesaj gelince yönlendirici alıcının kaydına bakar. **Çevrimiçiyse** doğrudan alıcının bağlantı sunucusuna iletilir; **değilse** alıcının kalıcı **çevrimdışı kuyruğuna** yazılır (Cassandra/Mnesia benzeri, `recipientId` ile bölümlenmiş, zaman sıralı) ve APNs/FCM üzerinden "yeni mesajın var" uyandırma bildirimi gider — içerik asla push sağlayıcısına verilmez. Alıcı bağlanınca kuyruk sırayla boşaltılır ve **cihaz onayı gelince silinir**. Sunucu tarafı durağan depolama yalnızca teslim edilmemiş mesajlar içindir.

### Teslim durumları: ✓, ✓✓, mavi ✓✓
Üç onay üç farklı taraftan gelir:

| İşaret | Anlamı | Kim üretir | Kayıp senaryosu |
|---|---|---|---|
| ✓ | Sunucu mesajı kalıcı aldı | Yönlendirici (kuyruğa yazdıktan sonra) | ✓ yoksa gönderen cihaz yeniden gönderir (aynı `msgId`) |
| ✓✓ | Alıcı **cihazı** aldı | Alıcı istemci → sunucu → gönderen | Sunucu silmeyi bu onaya kadar erteler |
| Mavi ✓✓ | Alıcı okudu | Alıcı istemci (kullanıcı kapatabilir) | Yalnızca UX; teslim garantisiyle ilgisizdir |

Garanti **en az bir kez** taşımadır: her mesajın istemci üretimi `msgId`'si vardır; alıcı aynı id'yi ikinci kez görürse atar (idempotent teslim). Sıra, gönderen başına artan sayaç ve tek kuyrukla korunur.

### Presence ve heartbeat
İstemci 30 saniyede bir heartbeat yollar; iki heartbeat kaçarsa bağlantı sunucusu kullanıcıyı çevrimdışı sayar ve `lastSeen` yazar. "Çevrimiçi" bilgisi **abonelik** modeliyle dağıtılır: Alice, Bob'un sohbet ekranını açınca Bob'un presence'ına abone olur; Bob'un durumu değişince yalnızca o anda abone olanlara (genelde birkaç kişi) fan-out edilir. 1.5 Mia kullanıcı için tüm rehbere yayın yapılmaz — bu küçük karar presence trafiğini binlerce kat azaltır. "Yazıyor…" aynı kanaldan, kalıcı depoya yazılmadan geçer.

### Grup mesajları
Grup mesajı sunucuda **fan-out** edilir: gönderen mesajı bir kez yollar, yönlendirici üyelik listesini (en fazla ~1 024 üye) alıp her üye için ayrı teslim yolu işletir — çevrimiçiler anında, diğerleri kuyruğa. Şifreleme grup için tek tek değildir: **Sender Keys** ile gönderen her gruba özel bir zincir anahtarı dağıtır (her üyeye birebir oturum üzerinden bir kez), sonraki mesajlar bir kez şifrelenir. Üye çıkınca anahtar yenilenir.

### Uçtan uca şifreleme: Signal protokolü (kavramsal)
İki aşama vardır. **Oturum kurulumu (X3DH)**: Her cihaz kayıt olurken bir kimlik anahtarı, imzalı bir ön anahtar ve bir deste tek kullanımlık ön anahtar üretip *açık* yarılarını anahtar sunucusuna yükler. Alice, Bob çevrimdışıyken bile onun paketini indirir ve üç-dört Diffie-Hellman birleşimiyle paylaşılan bir gizli türetir; sunucu özel anahtarları hiç görmez. **Double Ratchet**: Bu gizliden iki "çark" döner. *Simetrik çark*: her mesaj için zincir anahtarı KDF ile ilerler ve tek kullanımlık mesaj anahtarı üretir — bir anahtar ele geçse önceki mesajlar açılamaz (forward secrecy). *DH çarkı*: her yön değişiminde yeni geçici DH anahtarı değiş tokuş edilir ve zincirler yeniden tohumlanır — ele geçirilen durum gelecekteki mesajları da açamaz (post-compromise security). Sunucu yalnızca şifreli yük ve başlık (alıcı, sayaç, DH açık anahtarı) görür.

:::code{lang="ts" title="Yönlendirici: çevrimiçi/çevrimdışı teslim, ✓ ve ✓✓ onayları, idempotent silme"}
```ts
type Receipt = 'SERVER_ACK' | 'DELIVERED' | 'READ';

export async function routeMessage(msg: EncryptedMessage, deps: Deps) {
  // 1) Önce kalıcı yaz: ✓ yalnızca dayanıklı kayıttan sonra verilir
  await deps.offlineQueue.append(msg.to, msg);              // key: (recipientId, msgId) → idempotent
  await deps.connections.send(msg.from, { type: 'receipt', msgId: msg.id, state: 'SERVER_ACK' as Receipt });

  // 2) Alıcı çevrimiçi mi? Oturum kaydına bak (userId → bağlantı sunucusu)
  const session = await deps.registry.lookup(msg.to);
  if (session) {
    await deps.connections.sendVia(session.connServer, msg.to, msg);   // doğrudan it
  } else {
    await deps.push.wake(msg.to);                                       // içeriksiz uyandırma (APNs/FCM)
  }
}

/** Alıcı cihaz mesajı aldığını bildirdiğinde çağrılır. */
export async function onDelivered(recipientId: string, msgId: string, deps: Deps) {
  const msg = await deps.offlineQueue.take(recipientId, msgId);       // yoksa (tekrar onay) sessizce dön
  if (!msg) return;
  await deps.offlineQueue.delete(recipientId, msgId);                  // sunucu kopyası silinir
  await deps.connections.send(msg.from, { type: 'receipt', msgId, state: 'DELIVERED' as Receipt });
}

/** Alıcı yeniden bağlanınca bekleyen mesajlar sırayla itilir (sıra: gönderen sayacı). */
export async function drainOnConnect(userId: string, connServer: string, deps: Deps) {
  await deps.registry.register(userId, connServer);
  for await (const pending of deps.offlineQueue.scan(userId)) {
    await deps.connections.sendVia(connServer, userId, pending);       // cihaz zaten gördüyse msgId ile atar
  }
}
```
```python
async def route_message(msg, deps):
    await deps.offline_queue.append(msg.to, msg)                       # idempotent: (recipient, msg_id)
    await deps.connections.send(msg.sender, receipt(msg.id, "SERVER_ACK"))   # ✓
    session = await deps.registry.lookup(msg.to)
    if session:
        await deps.connections.send_via(session.conn_server, msg.to, msg)
    else:
        await deps.push.wake(msg.to)                                   # içeriksiz push

async def on_delivered(recipient_id, msg_id, deps):
    msg = await deps.offline_queue.take(recipient_id, msg_id)
    if msg is None:
        return                                                         # tekrar gelen onay
    await deps.offline_queue.delete(recipient_id, msg_id)
    await deps.connections.send(msg.sender, receipt(msg_id, "DELIVERED"))    # ✓✓
```
:::

## 5. Darboğazlar ve çözümler

| Darboğaz | Belirti | Çözüm |
|---|---|---|
| Bağlantı sunucusu düşmesi | 1–2 M kullanıcı aynı anda yeniden bağlanır (thundering herd) | Jitter'lı exponential backoff, kayıt servisine toplu yazma, sunucuyu durumsuz tutma |
| Oturum kaydı sıcak noktası | Her mesajda bir arama | Bellek içi, `userId` ile bölümlenmiş, bağlantı sunucusunda kısa TTL'li yerel cache |
| Yılbaşı zirvesi | Mesaj hızı 5× | Yönlendiriciyi yatay ölçekle, önce kalıcı yaz sonra ilet (kuyruk tamponu), medya yüklemesini ayrı yol |
| Büyük grup fan-out | 1 024 üye × her mesaj | Sunucu tarafı fan-out işçileri, Sender Keys ile tek şifreleme, üyelik listesi cache |
| Presence yayını | Her durum değişimi rehbere yayın | Abonelik modeli: yalnızca açık sohbetlere, kısa TTL |
| Çift teslim | Yeniden bağlanmada aynı mesaj iki kez | İstemci üretimi `msgId`, alıcıda tekilleştirme, onaya kadar silme |
| Anahtar sunucusu tükenmesi | Tek kullanımlık ön anahtarlar biter | İstemci düşük sayıda yeniler; bitince imzalı ön anahtarla devam (biraz daha zayıf ama çalışır) |

## 6. İstek yolculuğu: "Gönder" tıklaması

:::animation{scene="scene.json"}
Anahtar paketi → cihazda şifreleme → bağlantı sunucusu → yönlendirici (kalıcı yaz, ✓) → oturum kaydı → çevrimdışı kuyruk + push → alıcı bağlanır, teslim (✓✓), sunucu kopyası silinir → okundu → presence aboneliği.
:::

:::interactive{type="request-journey" preset="chat-message" layers="sender,connection-server,router,session-registry,offline-store,push,connection-server,recipient" showAcks=true recipientOnline=false}
Alıcıyı çevrimiçi/çevrimdışı yapıp ✓ ve ✓✓ onaylarının hangi adımda üretildiğini izleyin. Bağlantı sunucusunun gecikmesini artırın: hangi onay gecikir, hangisi gecikmez? Sonra yönlendirici adımında "kalıcı yazmadan önce ilet" seçeneğini açıp çökme anında mesajın nasıl kaybolabildiğine bakın.
:::

:::realworld{company="WhatsApp"}
WhatsApp'ın mühendislik efsanesi küçüklüğüdür: 2015'te **50 mühendis 900 M kullanıcıya** hizmet veriyordu. Bunu mümkün kılan, FreeBSD üzerinde ince ayarlanmış **Erlang** bağlantı sunucularıydı; 2012'de tek sunucuda **2 M eşzamanlı TCP bağlantısı** rekoru paylaşıldı. Erlang'ın hafif süreçleri bağlantı başına birkaç KB bellek harcar ve bir sürecin çökmesi diğerlerini etkilemez. Mesajlar yalnızca teslim edilene kadar sunucuda tutulur (en fazla 30 gün), sonra silinir; medya dosyaları ayrı bir şifreli blob deposunda yaşar ve alıcıya yalnızca anahtar + URL gider. 2016'da Open Whisper Systems ile **Signal protokolü** tüm kullanıcılara açıldı: X3DH ile çevrimdışı oturum kurulumu, Double Ratchet ile mesaj başına anahtar, gruplar için Sender Keys. 2020'de günde **100 milyar** mesaj taşındığı duyuruldu; yılbaşı gecesi zirvesi normalin birkaç katıdır ve bu yüzden yönlendirme katmanı bağlantı katmanından bağımsız ölçeklenir.
:::

:::callout{tone="tip" title="Mülakat ipuçları"}
- Açılışta "bayt değil, bağlantı ve durum problemi" deyin; depolama tahmininizin küçük çıkması doğrudur, nedenini (teslim sonrası silme) açıklayın.
- Bağlantı sunucusu ile yönlendiriciyi **ayrı** çizin; "kullanıcı hangi sunucuda?" sorusuna oturum kaydı ile cevap verin.
- Teslim garantisi sorusunda üç onayın **farklı taraflardan** geldiğini söyleyin ve "en az bir kez + msgId ile tekilleştirme" formülünü verin; sunucunun ✓'yi kalıcı yazmadan vermediğini vurgulayın.
- Presence'ta abonelik modelini önerin; "herkese yayın" tuzağına düşmeyin.
- E2E için iki cümle yeterlidir: X3DH ile çevrimdışı oturum kurulumu, Double Ratchet ile mesaj başına anahtar (forward secrecy + post-compromise security). Gruplar için Sender Keys'i eklerseniz artı puan.
- Çoklu cihaz sorulursa: her cihaz ayrı bir oturum (ayrı anahtar çifti); gönderen her cihaza ayrı şifreler.
:::

:::quiz{src="quiz.json"}
:::

:::next{lesson="e-06-classic-interview-systems"}
Sırada: vaka şablonunu üç klasik mülakat sorusuna hızlıca uygulama — URL kısaltıcı, rate limiter servisi ve notification servisi.
:::

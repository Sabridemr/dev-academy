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
durationMinutes: 30
level: intermediate
tags: [system-design, distributed-systems, patterns, scalability, resilience, microservices, interview-prep]
prerequisites: [a-05-load-balancing, a-07-caching, a-09-message-queues-event-driven, a-11-consistent-hashing-sharding, a-12-replication]
concepts: [load-balancer, caching, cdn, database-replication, database-sharding, consistent-hashing, message-queue, pub-sub, rate-limiting, circuit-breaker, api-gateway, cqrs, event-sourcing, saga-pattern, idempotency, outbox]
---

## Kavram: kalıp, bir problemin adlandırılmış çözümüdür

Sistem tasarımında "kalıp" (pattern), aynı problemle defalarca karşılaşan mühendislerin üzerinde uzlaştığı, adı olan bir çözümdür. Adının olması önemlidir: "önbellek koyarız" demek, ekibin tamamına aynı anda bir dizi ödünleşimi (bellek maliyeti, bayat veri, geçersiz kılma) hatırlatır. Bu ders, bir isteğin istemciden veritabanına ve oradan geri dönerken karşılaşabileceği 15 kalıbı tek bir harita üzerinde toplar. Her biri için kısa bir açıklama, **ne zaman kullan / ne zaman kullanma** çifti ve kalıbı derinlemesine işleyen platform dersine bağlantı var.

Kalıpları beş aileye ayırarak okumak kolaylaştırır:

1. **Trafik dağıtımı**: load balancing, API gateway, rate limiting
2. **Veriyi yakına getirme**: caching, CDN
3. **Veritabanını büyütme**: replication, sharding, consistent hashing
4. **Asenkron iletişim**: message queue, pub/sub
5. **Dayanıklılık ve tutarlılık**: circuit breaker, CQRS, event sourcing, saga, idempotency ve outbox

:::diagram{src="diagram.svg" alt="Bir isteğin yolu üzerinde 15 kalıp: istemci tarafında CDN, uç katmanda API gateway, rate limiting ve load balancer, servis katmanında circuit breaker, idempotency, CQRS, event sourcing ve saga, veri katmanında cache, replication, sharding ve consistent hashing, asenkron katmanda outbox, message queue ve pub/sub|The 15 patterns along a request path: CDN on the client side, API gateway, rate limiting and load balancer at the edge, circuit breaker, idempotency, CQRS, event sourcing and saga in the service layer, cache, replication, sharding and consistent hashing in the data layer, and outbox, message queue and pub/sub in the asynchronous layer"}
Her kalıp isteğin yolunda belirli bir noktada devreye girer; haritayı okuyabilmek, mülakatta "nereye ne koyarım" sorusunun yarısıdır.
:::

## Trafik dağıtımı

### 1. Load balancing
Yük dengeleyici, tek bir adres arkasında duran sunucu havuzuna istekleri dağıtır, düşen sunucuyu sağlık kontrolüyle havuzdan çıkarır ve sunucu ekleme/çıkarmayı istemciden gizler. Round-robin, least connections ve ağırlıklı dağıtım en yaygın algoritmalardır; L4 hızlı ve içeriğe kör, L7 ise URL ve başlığa göre yönlendirebilir. Ayrıntı için [Load balancer dersi](/lessons/a-05-load-balancing).

- **Kullan:** Birden fazla sunucu kopyan varsa; kesintisiz dağıtım ve tek sunucunun çökmesine dayanıklılık istiyorsan.
- **Kullanma:** Sunucular durum tutuyorsa (oturum bellekte) ve bunu paylaşımlı depoya taşımadıysan; önce stateless ol, sonra dengele.

### 2. API gateway
Gateway, tüm dış isteklerin geçtiği tek kapıdır: TLS sonlandırma, kimlik doğrulama, rate limiting, yönlendirme ve birden çok servisten yanıt toplama burada yapılır. Mikroservislerin ortak kaygılarını tek yerde toplar, böylece her servis yalnızca kendi işine odaklanır. Ayrıntı için [API Gateway dersi](/lessons/a-06-api-gateway).

- **Kullan:** Çok sayıda servisin ve birden fazla istemci türün (web, mobil, üçüncü taraf) varsa.
- **Kullanma:** Tek bir monolitin önüne, yalnızca "modern görünsün" diye; ek bir atlama ve yeni bir tek hata noktası demektir.

### 3. Rate limiting
Hız sınırlama, bir istemcinin birim zamanda yapabileceği istek sayısını sınırlar; token bucket ve sliding window en bilinen algoritmalardır. Amacı adaleti korumak, kötü niyetli ya da hatalı istemcilerin sistemi boğmasını önlemek ve arka uç kapasitesini öngörülebilir tutmaktır. Ayrıntı için [Rate limiting dersi](/lessons/a-10-rate-limiting).

- **Kullan:** Herkese açık API'lerde, giriş ve OTP gibi kötüye kullanıma açık uç noktalarda, paylaşımlı kaynakları koruyan iç servislerde.
- **Kullanma:** Limit aşımında kullanıcıya hiçbir geri bildirim vermeyeceksen; 429 yanıtı ve `Retry-After` başlığı olmadan sınırlama, hata gibi algılanır.

## Veriyi yakına getirme

### 4. Caching
Önbellek, pahalı bir hesaplamanın ya da veritabanı okumasının sonucunu hızlı bir bellekte saklar; aynı veri tekrar istendiğinde asıl kaynağa gidilmez. Cache-aside en yaygın kalıptır: uygulama önce önbelleğe bakar, yoksa veritabanından okuyup önbelleğe yazar. Zor kısım kapasite dolunca neyin atılacağı (LRU, LFU) ve verinin ne zaman bayatlayacağıdır (TTL, geçersiz kılma). Ayrıntı için [Caching dersi](/lessons/a-07-caching).

- **Kullan:** Okuma yazmadan çok daha fazlaysa ve veri birkaç saniyelik gecikmeyi kaldırıyorsa (ürün sayfası, profil, konfigürasyon).
- **Kullanma:** Her okumada mutlak güncellik şartsa (hesap bakiyesi, stok düşümü) ya da her anahtar yalnızca bir kez okunuyorsa; isabet oranı düşükse önbellek yalnızca karmaşıklık ekler.

:::interactive{type="cache" capacity=4 policy="lru"}
Önbellek kalıbını elle deneyin: dört slotluk LRU önbelleğe art arda anahtar okuyup yazın, isabet oranının nasıl oluştuğunu izleyin. Beşinci farklı anahtarı okuduğunuzda hangi anahtarın tahliye edildiğine bakın, sonra politikayı LFU'ya çevirip aynı diziyi tekrarlayın ve tahliye kararının nasıl değiştiğini karşılaştırın. Kapasiteyi büyütünce isabet oranının neden yükseldiğini kendi gözlerinizle görün.
:::

### 5. CDN
İçerik dağıtım ağı, statik dosyaları (görsel, video, JS, CSS) dünyanın dört bir yanındaki uç sunuculara kopyalar; kullanıcı en yakın uçtan okur. Hem gecikmeyi düşürür hem de kaynak sunucunun yükünü alır. Modern CDN'ler dinamik yanıtları da kısa süre önbellekleyebilir ve uç noktada kod çalıştırabilir. Ayrıntı için [CDN ve edge dersi](/lessons/a-08-cdn-edge).

- **Kullan:** Coğrafi olarak dağınık kullanıcılara büyük ve sık değişmeyen içerik sunuyorsan.
- **Kullanma:** Kullanıcıya özel, her istekte değişen ve önbelleklenemeyen yanıtlar için; CDN burada yalnızca fazladan atlama olur.

## Veritabanını büyütme

### 6. Database replication
Replikasyon, aynı verinin birden fazla kopyasını tutar: genellikle bir lider yazmaları alır, takipçiler kopyayı okuma trafiği için sunar. Senkron replikasyon güçlü tutarlılık verir ama yazmayı yavaşlatır; asenkron replikasyon hızlıdır ama replikadan eski veri okunabilir (replication lag). Lider düşerse bir takipçi yükseltilir (failover). Ayrıntı için [Replikasyon dersi](/lessons/a-12-replication).

- **Kullan:** Okuma yükünü dağıtmak, yüksek erişilebilirlik ve yedeklilik istediğinde.
- **Kullanma:** Darboğazın yazma olduğu durumlarda; replikalar yazma kapasitesini artırmaz, sharding gerekir.

### 7. Sharding / partitioning
Sharding, tek bir tabloyu bir anahtara göre (kullanıcı kimliği, bölge) birden fazla veritabanına böler; her parça (shard) yalnızca kendi dilimini tutar. Yazma kapasitesi ve veri hacmi yatay büyür, karşılığında anahtar seçimi kritik hâle gelir: kötü seçilen anahtar "sıcak shard" yaratır, parçalar arası JOIN ve transaction zorlaşır. Ayrıntı için [Sharding dersi](/lessons/a-11-consistent-hashing-sharding) ve [Okuma/yazma ölçekleme dersi](/lessons/d-05-read-write-scaling).

- **Kullan:** Tek makinenin disk, bellek ya da yazma kapasitesi gerçekten aşıldığında.
- **Kullanma:** Dikey ölçekleme, indeks düzeltme ve okuma replikaları hâlâ yeterliyken; sharding geri alması en zor karardır.

### 8. Consistent hashing
Veriyi sunuculara `hash(key) mod N` ile dağıtırsan, bir sunucu eklendiğinde neredeyse tüm anahtarlar yer değiştirir. Consistent hashing anahtarları ve sunucuları aynı halka üzerine yerleştirir; bir sunucu girip çıktığında yalnızca komşu dilim taşınır. Sanal düğümler dağılımı dengeler. Önbellek kümeleri ve shard yönlendirmesinde temel yapı taşıdır. Ayrıntı için [Consistent hashing dersi](/lessons/a-11-consistent-hashing-sharding).

- **Kullan:** Düğüm sayısı sık değişen dağıtık önbellek, depolama ya da mesaj bölümleme katmanlarında.
- **Kullanma:** Düğüm sayısı sabitse ve yeniden dağıtım maliyeti önemsizse; basit mod dağılımı daha anlaşılırdır.

## Asenkron iletişim

### 9. Message queue
Kuyruk, üretici ile tüketiciyi zamandan ayırır: üretici mesajı bırakıp devam eder, tüketici kendi hızında işler. Ani trafik dalgaları kuyrukta birikir, tüketici çökerse mesaj kaybolmaz, başarısız işler yeniden denenir. Bedeli, işin "hemen" değil "yakında" bitmesi ve en az bir kez teslimat nedeniyle tekrarlı işlemedir. Ayrıntı için [Mesaj kuyrukları dersi](/lessons/a-09-message-queues-event-driven).

- **Kullan:** E-posta, fatura, görüntü işleme gibi yanıtı beklemeyi gerektirmeyen işlerde; yük düzleştirme gerektiğinde.
- **Kullanma:** Kullanıcı yanıtı anında bekliyorsa (ödeme onayı); kuyruk burada yalnızca belirsizlik ekler.

### 10. Pub/sub
Yayınla/abone ol modelinde üretici bir konuya (topic) olay yayınlar, ilgilenen her abone kendi kopyasını alır. Kuyruktan farkı, bir mesajın tek tüketici yerine birçok bağımsız tüketiciye gitmesidir; sipariş oluştu olayını stok, bildirim ve analitik servisleri aynı anda dinleyebilir. Üretici kimin dinlediğini bilmez, bu da yeni tüketici eklemeyi sıfır maliyetli yapar. Ayrıntı için [Mesaj kuyrukları ve olay güdümlü mimari dersi](/lessons/a-09-message-queues-event-driven).

- **Kullan:** Bir olayın birden fazla bağımsız tepkisi olduğunda ve servisleri birbirinden habersiz tutmak istediğinde.
- **Kullanma:** Olayın tam olarak bir kez, belirli sırayla işlenmesi şartsa ve tüketici sayısı birse; düz kuyruk daha basittir.

## Dayanıklılık ve tutarlılık

### 11. Circuit breaker
Devre kesici, hata veren bir bağımlılığa istek göndermeyi bir süreliğine durdurur. Kapalı durumda istekler geçer; hata oranı eşiği aşınca devre açılır ve istekler anında reddedilir; zaman aşımı sonrası yarı açık durumda birkaç deneme isteğiyle servis yoklanır. Böylece yavaşlayan bir servis, onu bekleyen tüm servisleri peşinden sürüklemez (cascading failure). Ayrıntı için [Dağıtık kalıplar dersi](/lessons/c-04-distributed-patterns).

- **Kullan:** Ağ üzerinden çağrılan her dış bağımlılıkta; özellikle zaman aşımı uzun ve çağrı hacmi yüksekse.
- **Kullanma:** Hata olmadığında anlamlı bir "geri düşüş" (fallback) yanıtı veremiyorsan devre açıkken kullanıcı yine hata görür; önce fallback'i tasarla.

### 12. CQRS
Komut ve sorgu sorumluluk ayrımı, yazma modelini okuma modelinden ayırır: komutlar normalize bir yazma deposuna gider, okuma tarafı ise sorgulara göre biçimlenmiş, çoğu zaman denormalize ayrı bir depodan beslenir. İki taraf olaylarla senkronlanır, bu yüzden okuma tarafı nihai tutarlıdır. Karşılığında her taraf bağımsız ölçeklenir ve optimize edilir. Ayrıntı için [Mikroservis iletişimi dersi](/lessons/b-02-microservice-communication).

- **Kullan:** Okuma ve yazma kalıpları çok farklıysa (karmaşık raporlar ile basit komutlar) ya da okuma yükü yazmanın çok üstündeyse.
- **Kullanma:** Basit CRUD uygulamalarında; iki model ve senkronizasyon, kazanılan esneklikten pahalıya gelir.

### 13. Event sourcing
Olay kaynaklama, mevcut durumu saklamak yerine durumu değiştiren her olayı sırayla saklar; güncel durum olayların baştan oynatılmasıyla elde edilir. Bu, tam denetim izi, geçmişteki herhangi bir ana dönebilme ve yeni okuma modellerini eski olaylardan türetme imkânı verir. Bedeli, olay şemasının evrimi ve uzun olay akışlarında anlık görüntü (snapshot) ihtiyacıdır. Ayrıntı için [Mikroservis iletişimi dersi](/lessons/b-02-microservice-communication).

- **Kullan:** Finans, muhasebe ve denetim gerektiren alanlarda; "bu bakiye nasıl oluştu" sorusunun cevabı zorunluysa.
- **Kullanma:** Yalnızca güncel durumun önemli olduğu, geçmişin sorgulanmadığı basit alanlarda; eğitim ve araç maliyeti yüksektir.

### 14. Saga
Saga, birden fazla servise yayılan bir iş akışını yerel transaction'lar zinciri olarak yürütür: sipariş oluştur, ödeme al, stok ayır, kargo planla. Bir adım başarısız olursa önceki adımlar telafi işlemleriyle geri alınır (ödemeyi iade et, stoğu bırak). Koreografi her servisin olaylara tepki vermesiyle, orkestrasyon ise merkezi bir koordinatörle yürür. Dağıtık transaction ve uzun süreli kilitlere gerek kalmaz. Ayrıntı için [Mikroservis iletişimi dersi](/lessons/b-02-microservice-communication).

- **Kullan:** Bir iş akışı birden fazla servisin verisini değiştiriyorsa ve her adımın anlamlı bir telafisi varsa.
- **Kullanma:** Tüm adımlar tek veritabanındaysa; sıradan bir transaction yeterli ve çok daha basittir.

### 15. Idempotency ve outbox
İdempotent işlem, aynı istek tekrar geldiğinde sonucu değiştirmez: istemci her isteğe benzersiz bir anahtar ekler, sunucu daha önce işlenmiş anahtarı görünce kaydedilmiş yanıtı döndürür. Ağ hatası sonrası yeniden deneme bu sayede güvenlidir. Outbox ise "veritabanına yaz ve olay yayınla" ikilisini atomik yapar: olay, iş verisiyle aynı transaction içinde bir outbox tablosuna yazılır, ayrı bir süreç bunu kuyruğa taşır. Böylece yazma başarılı ama olay kaybolmuş durumu (dual write) ortadan kalkar. Ayrıntı için [Dağıtık kalıplar dersi](/lessons/c-04-distributed-patterns) ve [REST tasarımı ve idempotency dersi](/lessons/i-03-api-ve-rest-api-tasarim-guvenlik-ve-idempotency).

- **Kullan:** Ödeme, sipariş ve para transferi gibi tekrarın zarar verdiği her işlemde; olay yayınlayan her servis yazmasında.
- **Kullanma:** Doğası gereği idempotent olan salt okuma ve tam güncelleme (PUT) işlemlerine ayrıca anahtar eklemek gereksiz yüktür.

## Karar tablosu: problemden kalıba

Mülakatta ya da tasarım toplantısında kalıbı adıyla değil, problemiyle hatırlarsın. Aşağıdaki tablo en sık karşılaşılan şikâyeti ilk adaya eşler; ikinci sütun "önce bunu dene" diye okunmalı, tek doğru cevap olarak değil.

| Problem | İlk aday kalıp | Dikkat |
|---|---|---|
| Tek sunucu trafiği kaldırmıyor | Load balancing | Sunucular stateless olmalı |
| Aynı veri tekrar tekrar veritabanından okunuyor | Caching | TTL ve geçersiz kılma stratejisi şart |
| Uzak ülkelerdeki kullanıcılar yavaş yüklüyor | CDN | Yalnızca önbelleklenebilir içerik |
| Okuma yükü veritabanını boğuyor | Database replication | Replica lag'i kabul et |
| Yazma yükü veya veri hacmi tek makineyi aşıyor | Sharding | Shard anahtarı geri alınamaz |
| Düğüm eklenince önbellek isabeti sıfırlanıyor | Consistent hashing | Sanal düğümlerle dengele |
| Ani trafik dalgası arka ucu çökertiyor | Message queue | İş "yakında" biter |
| Bir olaya birçok servis tepki vermeli | Pub/sub | Sıra ve tekrar garantisini sorgula |
| Bir istemci API'yi tüketiyor | Rate limiting | 429 + Retry-After döndür |
| Yavaş bağımlılık tüm sistemi kilitliyor | Circuit breaker | Fallback tasarla |
| Her servis kimlik doğrulamayı kendisi yapıyor | API gateway | Gateway'i yedekle |
| Raporlar yazma modelini yoruyor | CQRS | Okuma tarafı nihai tutarlı |
| "Bu durum nasıl oluştu" sorusu cevaplanamıyor | Event sourcing | Snapshot ve şema evrimi |
| Çok servisli iş akışı yarıda kalıyor | Saga | Her adıma telafi yaz |
| Yeniden deneme çift ödeme yaratıyor | Idempotency + outbox | Anahtar saklama süresi |

:::callout{tone="warning" title="Kalıp yığmak tasarım değildir"}
Mülakatta en sık görülen hata, soruyu duyar duymaz on beş kutuyu da tahtaya çizmektir. Her kalıp bir maliyet taşır: önbellek bayat veri, kuyruk belirsiz gecikme, sharding karmaşık sorgular, saga telafi kodu demektir. İyi cevap "burada X kullanırım" değil, "burada X kullanırım çünkü şu ölçüm bunu gerektiriyor, bedeli de şudur" cümlesidir. Önce gereksinimi ve rakamı (istek/sn, veri boyutu, gecikme hedefi) söyle, kalıp sonra gelsin.
:::

:::realworld{company="Getir"}
Getir gibi dakikalar içinde teslimat yapan bir uygulamada sipariş akışı, bu dersteki kalıpların neredeyse tamamını tek yolculukta gösterir. Ürün görselleri ve uygulama varlıkları CDN'den iner; mobil istekler API gateway'den geçerken kimlik doğrulanır ve kampanya dönemlerindeki istek fırtınalarına karşı rate limiting uygulanır. Mahalle deposundaki stok ve ürün bilgisi okuma yoğun olduğundan önbellekten servis edilir, siparişler ise bölgeye göre bölümlenmiş veritabanlarında tutulur. "Sipariş verildi" olayı outbox üzerinden kuyruğa düşer; kurye atama, stok düşümü ve bildirim servisleri bunu pub/sub ile ayrı ayrı tüketir. Ödeme başarısız olursa saga önceki adımları telafi eder, ağ kopmasında istemcinin yeniden gönderdiği istek idempotency anahtarı sayesinde ikinci sipariş yaratmaz. Ödeme sağlayıcısı yavaşlarsa devre kesici, uygulamanın tamamının askıda kalmasını önler. Bu akışın her adımı genel mühendislik pratiğidir; şirkete özgü ayrıntılar değişse de kalıpların yerleşimi aynıdır.
:::

:::callout{tone="tip" title="Mülakat özeti"}
- 15 kalıbı beş aile olarak ezberle: dağıtım, yakına getirme, veritabanı büyütme, asenkron iletişim, dayanıklılık/tutarlılık.
- Her kalıp için bir cümle "ne zaman kullanma" bil; bu, kalıbı gerçekten anladığını gösteren kısımdır.
- Replikasyon okuma, sharding yazma ölçekler; kuyruk tek tüketici, pub/sub çok tüketici; saga telafi, outbox atomik yayın, idempotency güvenli tekrar.
:::

:::quiz{src="quiz.json"}
:::

:::next{lesson="j-02-system-design-notes-part-1"}
Sırada sistem tasarımı notlarının ilk bölümü: gereksinim analizi, ölçek tahmini ve bir isteğin uçtan uca yolculuğu.
:::

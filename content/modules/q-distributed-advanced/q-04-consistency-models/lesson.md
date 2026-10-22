---
id: q-04-consistency-models
slug: consistency-models
module: q-distributed-advanced
order: 4
title:
  tr: "Tutarlılık Modelleri: Linearizability'den Eventual'a"
  en: "Consistency Models: From Linearizability to Eventual"
summary:
  tr: Aynı yazmanın farklı replikalardan nasıl okunduğu; linearizable, sequential, causal ve eventual tutarlılık; read-your-writes ve monotonic reads oturum garantileri.
  en: How the same write is read from different replicas; linearizable, sequential, causal and eventual consistency; the read-your-writes and monotonic reads session guarantees.
durationMinutes: 30
level: advanced
prerequisites: [q-01-time-and-ordering, a-12-replication, d-05-read-write-scaling]
tags: [distributed-systems, consistency, replication, dynamodb, cap]
concepts: [consistency-models, linearizability, sequential-consistency, causal-consistency, eventual-consistency, read-your-writes, monotonic-reads, session-guarantees, pacelc]
---

## Kavram: "en son değer" ne demek?

Tek bir veritabanı sunucusunda "x'i 2 yaptım, şimdi okursam 2 görürüm" cümlesi tartışmasızdır. Veri birden fazla replikaya dağıldığında ise aynı cümle bir **sözleşmeye** dönüşür: hangi replikadan, ne zaman, kimin okuduğuna göre farklı cevaplar mümkündür. **Tutarlılık modeli**, depolama sisteminin programcıya verdiği bu sözdür: "bu kuralları izlerseniz okumalarınız şu garantileri taşır".

A-12'de replikasyon gecikmesini, D-05'te okuma replikalarının bayat veri döndürebildiğini gördünüz. Bu ders aynı olguya üstten bakar: hangi garantiler var, birbirlerinden ne kadar güçlüler ve her birinin bedeli nedir? Modeller güçlüden zayıfa sıralanır; güçlü model programlamayı kolaylaştırır ama koordinasyon, dolayısıyla gecikme ve bölünmede erişilemezlik ister.

## Linearizability: sanki tek kopya varmış gibi

**Linearizability** (atomik ya da güçlü tutarlılık da denir) en sezgisel modeldir: sistem, sanki verinin **tek bir kopyası** varmış ve her işlem başlangıcı ile bitişi arasındaki bir anda atomik olarak gerçekleşmiş gibi davranır. Pratik sonucu: bir yazma tamamlandıktan sonra *başlayan* her okuma, hangi istemciden ve hangi replikadan gelirse gelsin, o yazmayı (ya da daha yenisini) görür. Gerçek zaman sırası korunur.

Lider seçimi, kilitler (Q-03), benzersizlik kısıtları ("bu kullanıcı adı alınmış mı?") ve stok gibi "tek gerçek" isteyen her yerde linearizability gerekir. etcd ve ZooKeeper'ın yazmaları, Spanner'ın transaction'ları (Q-01'deki TrueTime ile) bu garantiyi verir. Bedeli koordinasyondur: her işlem lider ya da çoğunluk ile konuşmalıdır, ve ağ bölündüğünde azınlık tarafı cevap veremez (CAP'teki C).

Sık yapılan bir karışıklık: linearizability **serializability** ile aynı şey değildir. Serializability (D-03) birden çok nesneye dokunan transaction'ların bir sıraya dizilebilmesiyle ilgilidir; linearizability ise tek bir nesnede gerçek zamana uyan sıra ile. İkisini birlikte sağlayan sistemlere "strict serializable" denir.

## Sequential ve causal tutarlılık

**Sequential consistency** gerçek zaman şartını gevşetir: tüm istemciler işlemleri **aynı sırada** görür ve bu sıra her istemcinin kendi işlem sırasına uyar; ama sıranın gerçek zamanla örtüşmesi gerekmez. Bir okuma birkaç milisaniye eski olabilir, yeter ki herkes aynı tarihçeyi görsün. ZooKeeper dokümantasyonu istemci güncellemeleri için bu garantiyi açıkça verir; varsayılan okumalar bayat olabilir ve en güncel değeri isteyen istemci okumadan önce `sync` çağırır.

**Causal consistency** bir adım daha gevşer: yalnızca **nedensel olarak bağlı** işlemlerin sırası korunur. Q-01'deki happens-before ilişkisi burada devreye girer. Alice bir gönderi paylaşır, Bob ona yorum yazarsa, yorumu gören herkes gönderiyi de görmelidir. Ama birbirinden habersiz iki gönderi farklı kullanıcılara farklı sırada görünebilir. Causal tutarlılık bağımlılıkları (vektör saatler ya da bağımlılık listeleri ile) izlemeyi gerektirir, ama her işlemde çoğunlukla konuşmayı gerektirmez; bu yüzden ağ bölünmesinde bile erişilebilir kalabilen en güçlü modeller arasındadır.

## Eventual consistency ve oturum garantileri

**Eventual consistency** yalnızca şunu söyler: yazmalar durursa, replikalar *sonunda* aynı değere yakınsar. Ne zaman yakınsayacakları, o arada hangi sırayla ne görüneceği hakkında hiçbir söz yoktur. Çok hızlı ve her koşulda erişilebilirdir, ama uygulama tarafında şaşırtıcı davranışlara açıktır.

Bu şaşırtıcılıkların en can sıkıcı ikisini, tüm sistemi güçlü tutarlı yapmadan gidermek mümkündür. 1990'larda Bayou projesinde tanımlanan **oturum garantileri** tek bir kullanıcının deneyimini düzeltir:

- **Read-your-writes:** Kullanıcı kendi yazdığını her zaman görür. Uygulaması: yazmadan sonra bir süre liderden okumak, ya da yazmanın sürüm numarasını (LSN) istemciye verip yalnızca en az o sürüme ulaşmış replikadan okumak.
- **Monotonic reads:** Kullanıcı bir değeri gördükten sonra daha eskisini görmez; zaman geri gitmez. Uygulaması: kullanıcıyı hep aynı replikaya yönlendirmek (sticky) ya da yine sürüm numarası.
- **Monotonic writes** ve **writes-follow-reads** da aynı ailedendir: aynı kullanıcının yazmaları sırayla uygulanır, okuduğu bir şeye verdiği cevap okuduğundan sonra yer alır.

:::diagram{src="diagram.svg" alt="Tutarlılık modelleri güçlüden zayıfa: linearizable, sequential, causal, eventual; yanda oturum garantileri ve her seviyenin bedeli|Consistency models from strongest to weakest: linearizable, sequential, causal, eventual; alongside, session guarantees and the cost of each level"}
Yukarıdaki model aşağıdakilerin tüm garantilerini kapsar. Aşağı indikçe koordinasyon azalır, gecikme düşer, erişilebilirlik artar.
:::

:::predict{id="ryw-replika"}
Alice profil adını "Ayşe" olarak günceller. Yazma lidere gider ve onaylanır. Sayfa yenilenince okuma, liderin 2 saniye gerisindeki bir okuma replikasına yönlendirilir. Alice ne görür ve hangi garanti ihlal edilir? | Alice changes her profile name to "Ayşe". The write goes to the leader and is acknowledged. On refresh, the read is routed to a read replica that is 2 seconds behind the leader. What does Alice see, and which guarantee is violated?
- [ ] Yeni adı görür; ihlal yoktur | She sees the new name; nothing is violated
- [x] Eski adı görür; read-your-writes ihlal edilir | She sees the old name; read-your-writes is violated
- [ ] Hata alır; linearizability gereği okuma reddedilir | She gets an error; the read is rejected for linearizability
Açıklama: Asenkron replika yazmayı henüz almadığı için eski değeri döndürür. Eventual consistency buna izin verir ama kullanıcı "kaydetmedi" sanar. Read-your-writes garantisi için Alice'in okumaları bir süre lidere gitmeli ya da yazmanın sürüm numarasına ulaşmış bir replikaya yönlendirilmelidir. | The asynchronous replica has not received the write yet, so it returns the old value. Eventual consistency allows this, but the user thinks "it didn't save". For read-your-writes, Alice's reads should go to the leader for a while, or to a replica that has reached the write's version number.
:::

:::animation{scene="scene.json"}
Alice x=2 yazar; aynı yazma liderden, senkron replikadan ve geciken asenkron replikadan farklı modellerde farklı okunur; read-your-writes ve monotonic reads ihlalleri ve düzeltmeleri; causal sıranın korunması.
:::

## Quorum her şeyi çözer mi?

A-12'deki **W + R > N** kuralı, okuma kümesinin en az bir güncel kopyaya değmesini sağlar. Bu çoğu zaman "güncel oku" anlamına gelir, ama tek başına linearizability garantisi değildir: eşzamanlı bir yazma sürerken iki okuma farklı sonuç görebilir, sloppy quorum ya da LWW çakışma çözümü yazma kaybettirebilir. Dynamo tarzı sistemlerde quorum'u "güçlü tutarlılık" değil, "bayat okuma olasılığını düşüren ayar" olarak düşünmek daha doğrudur.

:::interactive{type="replication-quorum" nodes=3 writeQuorum=1 readQuorum=1 failedNodes=0}
N=3, W=1, R=1 ile başlayın ve art arda "Yaz" ve "Oku" düğmelerine basın: bazı okumalar BAYAT işaretlenecek; bu eventual consistency'dir. Sonra W ve R kaydırıcılarını 2'ye çıkarın ve aynı deneyi yapın: W + R > N olduğunda bayat okuma kayboluyor mu? Bir replikaya tıklayıp düşürün ve yazma/okuma gecikmesinin nasıl değiştiğine bakın. Son olarak W=1, R=1'e dönüp "Anti-entropy onarımı" düğmesiyle replikaların yakınsamasını izleyin.
:::

## Bölünme yokken bile: PACELC

CAP yalnızca ağ bölündüğünde ne olacağını söyler. Daniel Abadi'nin **PACELC** formülasyonu eksik yarıyı ekler: bölünme (**P**) varsa erişilebilirlik (**A**) ile tutarlılık (**C**) arasında, yoksa (**E**lse) gecikme (**L**) ile tutarlılık (**C**) arasında seçim yaparsınız. Normal günlerde bile linearizable okuma, liderle ya da çoğunlukla bir tur konuşmak demektir; bölgeler arası bu tur onlarca milisaniyedir. B-04'teki çok bölgeli mimarilerde bu seçim her okuma yolunda tekrar karşınıza çıkar.

:::realworld{company="Amazon DynamoDB"}
**Amazon DynamoDB** tutarlılık seçimini her okuma isteğine bırakır. Varsayılan okuma **eventually consistent**'tir: istek herhangi bir replikadan karşılanabilir ve kısa süre önce yapılmış bir yazmayı yansıtmayabilir. `ConsistentRead` parametresi true verilirse okuma **strongly consistent** olur ve önceki tüm başarılı yazmaları yansıtır; dokümantasyon bunun bedelini de açıkça yazar: daha fazla okuma kapasitesi tüketir, gecikmesi daha yüksek olabilir ve global ikincil indekslerde desteklenmez. Bölgeler arası çoğaltan **global tables** ise bölgeler arasında eventual consistency ile çalışır; aynı öğe iki bölgede eşzamanlı güncellenirse çakışmayı "son yazan kazanır" kuralıyla çözer. Amazon CTO'su Werner Vogels'ın "Eventually Consistent - Revisited" yazısı bu tasarım felsefesini anlatır ve read-your-writes, monotonic reads gibi oturum garantilerini eventual sistemlerin pratik tamamlayıcısı olarak tartışır. Uygulamada sık görülen kalıp: sepete ürün ekledikten sonraki ilk okumada strongly consistent okuma, ürün listesi gibi bayatlığa toleranslı sayfalarda varsayılan okuma.
:::

:::callout{tone="warning" title="Model seçimi işlem bazında yapılır"}
Bir sistemin tamamı için tek model seçmek zorunda değilsiniz. Ödeme bakiyesi ve stok linearizable, kullanıcının kendi profili read-your-writes, beğeni sayısı eventual olabilir. Her okuma yolunda "bu veri birkaç saniye bayat olursa ne kaybederim?" diye sorun.
:::

:::callout{tone="tip" title="Mülakat özeti"}
- Linearizable: tek kopya gibi, gerçek zaman sırası; kilit ve benzersizlik için şart, bedeli koordinasyon.
- Sequential: herkes aynı sıra, gerçek zaman şartı yok. Causal: yalnızca nedensel bağlı işlemler sıralı.
- Eventual: yalnızca sonunda yakınsama. Oturum garantileri (read-your-writes, monotonic reads) kullanıcı deneyimini kurtarır.
- W + R > N ≠ linearizability. PACELC: bölünme yokken bile gecikme ile tutarlılık arasında seçim var.
:::

:::quiz{src="quiz.json"}
:::

:::resources
- [Consistency Models (Jepsen)](https://jepsen.io/consistency) — belge — modellerin hiyerarşisi ve tanımları
- [Eventually Consistent - Revisited](https://www.allthingsdistributed.com/2008/12/eventually_consistent.html) — blog — Werner Vogels, oturum garantileri
- [DynamoDB read consistency](https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/HowItWorks.ReadConsistency.html) — belge — eventually ve strongly consistent okumalar
- [Designing Data-Intensive Applications](https://dataintensive.net/) — kitap — 5. ve 9. bölümler
:::

:::next{lesson="q-05-crdts-offline-collaboration"}
Sırada: koordinasyon olmadan bile doğru sonuca yakınsayan veri yapıları — CRDT'ler ve çevrimdışı iş birliği.
:::

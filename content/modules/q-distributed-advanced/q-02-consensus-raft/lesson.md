---
id: q-02-consensus-raft
slug: consensus-raft
module: q-distributed-advanced
order: 2
title:
  tr: "Konsensüs ve Raft: Lider Seçimi, Log Replikasyonu, Terimler"
  en: "Consensus and Raft: Leader Election, Log Replication, Terms"
summary:
  tr: Bir grup düğümün tek bir log sırası üzerinde anlaşması; Raft'ta lider seçimi, çoğunluk ile commit, terim numaraları ve ağ bölünmesindeki davranış.
  en: How a group of nodes agrees on a single log order; leader election in Raft, committing by majority, term numbers and behaviour during a network partition.
durationMinutes: 35
level: advanced
prerequisites: [q-01-time-and-ordering, a-12-replication]
tags: [distributed-systems, consensus, raft, etcd, leader-election]
concepts: [consensus, replicated-state-machine, raft, raft-term, leader-election, election-timeout, log-replication, majority-quorum, commit-index, split-brain]
---

## Kavram: neden konsensüs?

A-12'de lider-takipçi replikasyonunu gördünüz: tek lider yazmaları sıraya koyar, takipçiler aynı sırayı uygular. Bu düzen lider sağlıklıyken kusursuzdur. Zor soru, lider düştüğünde ortaya çıkar: Yeni lideri kim seçecek? İki düğüm aynı anda kendini lider ilan ederse ne olacak? Eski liderin onayladığı bir yazma yeni liderde yoksa ne olacak?

**Konsensüs (consensus)**, bir grup düğümün bazıları çökse ya da ağ mesajları gecikse bile **tek bir değer üzerinde** (pratikte: tek bir log sırası üzerinde) anlaşmasıdır. Bir konsensüs protokolü iki şeyi aynı anda garanti etmelidir:

- **Güvenlik (safety):** Hiçbir zaman iki farklı karar verilmez. Bir log girdisi bir kez commit edildiyse, hangi düğüm lider olursa olsun o girdi o konumda kalır.
- **İlerleme (liveness):** Düğümlerin çoğunluğu çalışıyor ve birbirleriyle konuşabiliyorsa sistem sonunda karar verir.

Bu ikilinin pratik karşılığı **replike durum makinesi (replicated state machine)** fikridir: her düğüm aynı komutları aynı sırada uygularsa aynı duruma ulaşır. etcd, Consul, CockroachDB, TiKV ve Kafka'nın KRaft modu bu fikri Raft ile uygular. Paxos aynı problemi daha önce çözmüştü; Raft ise 2014'te "anlaşılabilirlik" hedefiyle tasarlandı ve problemi üç alt probleme böler: **lider seçimi**, **log replikasyonu** ve **güvenlik kuralları**.

## Terimler (terms) ve roller

Raft'ta zaman, artan tamsayılarla numaralanan **terimlere (term)** bölünür. Her terim bir seçimle başlar ve o terimde **en fazla bir lider** olur. Terim numarası, Q-01'deki mantıksal saatlerin bir uygulamasıdır: düğümler fiziksel saate bakmaz, terimleri karşılaştırır.

Her düğüm üç rolden birindedir: **follower** (takipçi), **candidate** (aday) ya da **leader** (lider). Temel kural tek cümledir: *bir düğüm kendi teriminden büyük bir terim görürse terimini günceller ve hemen follower'a döner.* Bu kural, geri dönen eski liderin neden sorun çıkaramadığını açıklar.

:::diagram{src="diagram.svg" alt="Raft rol geçişleri ve log yapısı: follower, candidate ve leader arasındaki oklar; altta terim numaralı log girdileri ve commit indeksi|Raft role transitions and log structure: arrows between follower, candidate and leader; below, log entries with term numbers and the commit index"}
Üstte rol geçişleri: zaman aşımı follower'ı adaya, çoğunluk oyu adayı lidere çevirir; daha yüksek terim gören herkes follower'a döner. Altta her log girdisinin terimi ve commit indeksi.
:::

## Lider seçimi

Lider, takipçilere düzenli **heartbeat** (boş AppendEntries) gönderir. Bir takipçi **election timeout** süresince heartbeat almazsa:

1. Terimini 1 artırır, candidate olur ve kendine oy verir.
2. Diğer düğümlere `RequestVote(term, lastLogIndex, lastLogTerm)` gönderir.
3. Her düğüm bir terimde **yalnızca bir oy** verir ve yalnızca log'u **en az kendisininki kadar güncel** olan adaya oy verir (son girdinin terimi büyük olan, eşitse daha uzun olan daha günceldir).
4. **Çoğunluğun** oyunu alan aday lider olur ve hemen heartbeat göndererek diğer adayları susturur.

Election timeout her düğümde rastgele seçilir (Raft makalesi 150–300 ms aralığını önerir). Rastgelelik sayesinde genellikle tek bir düğümün süresi önce dolar ve oylar bölünmez; bölünürse terim artar ve seçim tekrarlanır. 3. adımdaki "güncel log" şartı Raft'ın en önemli güvenlik kuralıdır: commit edilmiş bir girdi çoğunlukta vardır, seçimi kazanmak için de çoğunluğun oyu gerekir; bu iki çoğunluk en az bir düğümde kesişir ve o düğüm eksik log'lu adaya oy vermez.

:::animation{scene="scene.json"}
Beş düğümlü kümede lider çöker, rastgele timeout'u ilk dolan düğüm aday olur ve çoğunluk oyuyla lider seçilir; yeni lider log'u çoğaltır; geri dönen eski lider daha yüksek terimi görüp geri adım atar ve commit edilmemiş girdisi silinir.
:::

## Log replikasyonu ve commit

İstemci yazması lidere gelir. Lider komutu kendi log'una `(index, term, komut)` olarak ekler ve `AppendEntries` ile takipçilere gönderir. Her AppendEntries bir **tutarlılık kontrolü** taşır: "yeni girdiden hemen önceki girdi şu index ve şu terimde". Takipçinin log'u bu noktada uyuşmuyorsa istek reddedilir; lider bir önceki girdiye geri gider ve uyuşan noktayı bulana kadar dener. Uyuşan noktadan sonraki farklı girdiler takipçide **silinir** ve liderinkilerle değiştirilir. Böylece tüm log'lar liderin log'una yakınsar.

Bir girdi, lider onu **çoğunluğa** kopyaladığında **commit** edilmiş sayılır. Lider commit indeksini ilerletir, komutu durum makinesine uygular ve istemciye ancak o zaman "tamam" der. 5 düğümlü kümede 3 kopya yeterlidir; 2 düğüm yavaş ya da çökmüş olsa bile yazmalar devam eder.

:::code{lang="ts" title="RequestVote işleyicisi: terim ve güncel log kuralları"}
```ts
interface VoteRequest { term: number; candidateId: string; lastLogIndex: number; lastLogTerm: number }

export function handleRequestVote(node: RaftNode, req: VoteRequest): { term: number; granted: boolean } {
  // 1) Eski terimden gelen istek: reddet, bizim terimimizi bildir
  if (req.term < node.currentTerm) return { term: node.currentTerm, granted: false };

  // 2) Daha yüksek terim gördük: terimi güncelle, follower'a dön, oyumuz boşalır
  if (req.term > node.currentTerm) {
    node.currentTerm = req.term;
    node.votedFor = null;
    node.role = 'follower';
  }

  // 3) Adayın log'u en az bizimki kadar güncel mi?
  const myLastTerm = node.log.at(-1)?.term ?? 0;
  const upToDate =
    req.lastLogTerm > myLastTerm ||
    (req.lastLogTerm === myLastTerm && req.lastLogIndex >= node.log.length);

  // 4) Bu terimde tek oy
  const canVote = node.votedFor === null || node.votedFor === req.candidateId;
  const granted = canVote && upToDate;
  if (granted) {
    node.votedFor = req.candidateId;
    node.resetElectionTimer(); // oy verdik, kendimiz aday olmayalım
  }
  return { term: node.currentTerm, granted };
}
```
```python
def handle_request_vote(node, req):
    if req.term < node.current_term:
        return node.current_term, False
    if req.term > node.current_term:
        node.current_term, node.voted_for, node.role = req.term, None, "follower"

    my_last_term = node.log[-1].term if node.log else 0
    up_to_date = (req.last_log_term > my_last_term or
                  (req.last_log_term == my_last_term and req.last_log_index >= len(node.log)))

    granted = node.voted_for in (None, req.candidate_id) and up_to_date
    if granted:
        node.voted_for = req.candidate_id
        node.reset_election_timer()
    return node.current_term, granted
```
:::

## Ağ bölünmesinde Raft

Beş düğümlü bir küme 2'ye 3 bölünürse ne olur? Çoğunluk kuralı her şeyi belirler:

- **Lider 2'li taraftaysa:** Yazmaları kabul etmeye çalışır ama çoğunluğa (3) ulaşamaz, hiçbir girdi commit edilmez; istemciler zaman aşımı alır. Bu, CAP'teki **CP** tercihidir: azınlık tarafı erişilebilirlikten vazgeçer.
- **3'lü taraf:** Heartbeat alamaz, seçim yapar, daha yüksek terimle yeni lider seçer ve yazmaya devam eder.
- **Bölünme iyileşince:** Eski lider daha yüksek terimi görür, follower olur; commit edilmemiş girdileri yeni liderin log'uyla ezilir. Bu girdiler için istemci hiç "tamam" almadığı için veri kaybı yoktur.

Aynı nedenle küme boyutu tek sayıdır: 4 düğümlü küme de yalnızca 1 hatayı tolere eder (çoğunluk 3), yani 3 düğümlü kümeden daha dayanıklı değildir ama daha yavaştır.

:::predict{id="raft-azinlik-lider"}
Beş düğümlü bir Raft kümesi ağ arızasıyla {S1, S2} ve {S3, S4, S5} olarak ikiye bölünür. Lider S1'dir. Bir istemci S1'e yazma gönderirse ne olur? | A five-node Raft cluster is split by a network fault into {S1, S2} and {S3, S4, S5}. S1 is the leader. What happens if a client sends a write to S1?
- [ ] S1 yazmayı commit eder; bölünme iyileşince diğerlerine kopyalar | S1 commits the write and copies it to the others when the partition heals
- [x] S1 yazmayı log'una ekler ama commit edemez; istemci onay almaz | S1 appends the write to its log but cannot commit it; the client gets no acknowledgement
- [ ] S1 ve S3 tarafındaki yeni lider aynı anda yazma commit eder (split-brain) | S1 and the new leader on the S3 side both commit writes (split-brain)
Açıklama: Commit için çoğunluk (5 düğümde 3) gerekir; S1 yalnızca S2'ye ulaşabildiği için girdiyi commit edemez ve istemciye "tamam" demez. Öbür tarafta S3-S5 yeni terimde lider seçer ve yazmaya devam eder. İki çoğunluk aynı anda var olamayacağı için split-brain oluşmaz; bölünme iyileşince S1'in commit edilmemiş girdisi silinir. | Committing requires a majority (3 of 5); S1 can only reach S2, so it cannot commit the entry and never acknowledges the client. On the other side S3–S5 elect a leader in a new term and keep writing. Two majorities cannot exist at once, so there is no split-brain; when the partition heals S1's uncommitted entry is discarded.
:::

Bu davranışı simülatörde deneyebilirsiniz. CAP simülatörü Raft'ın kendisini değil, çoğunluk kuralının sonucunu modeller; ama "azınlık tarafı reddeder, çoğunluk tarafı devam eder" sezgisi birebir aynıdır.

:::interactive{type="cap-theorem" mode="cp" replicas=5 partition=false}
Mod CP ve 5 replika ile başlayın. Önce bir replikaya yazın ve diğerlerinden okuyun. Sonra "Ağı böl" düğmesine basın: azınlık tarafındaki bir düğüme yazmayı ve okumayı deneyin, reddedildiğini görün. Çoğunluk tarafındaki bir düğüme yazın; başarılı olmalı. "Bölünmeyi onar" ile ağı birleştirip azınlıktaki düğümden tekrar okuyun. Son olarak replika sayısını 4'e düşürüp aynı deneyi yapın: azınlık tarafı kaç düğüm?
:::

:::realworld{company="etcd / Kubernetes"}
**Kubernetes** kümesinin tüm durumu (pod'lar, deployment'lar, secret'lar, lease'ler) **etcd**'de saklanır ve etcd, Raft üzerine kurulu bir anahtar-değer deposudur. API sunucusu etcd ile konuşan tek bileşendir; kontrol düzleminin geri kalanı etcd'deki değişiklikleri API sunucusu üzerinden izler. etcd dokümantasyonu üretim için **3 ya da 5 üyeli** küme önerir: 3 üye bir, 5 üye iki üyenin kaybını tolere eder. Daha fazla üye hata toleransını artırır ama her yazmanın daha fazla düğüme kopyalanması gerektiği için yazma performansını düşürür. Yeni bir üyenin kümeye eklenmesi de risklidir: boş log'lu bir üye çoğunluk hesabına hemen girerse, kendisi veri yakalarken kümenin commit yapabilmesi zorlaşır. etcd bu yüzden 3.4 sürümüyle **learner** üyeleri getirdi: yeni üye önce oy hakkı olmadan log'u yakalar, sonra tam üyeliğe yükseltilir. CockroachDB ise veriyi "range" denen parçalara böler ve her range için ayrı bir Raft grubu çalıştırır; böylece tek bir liderin darboğazı yerine binlerce küçük konsensüs grubu yükü paylaşır.
:::

:::callout{tone="warning" title="Raft yavaş bir disk ya da ağdan çok etkilenir"}
Lider bir girdiyi ancak çoğunluk onu **diske yazdıktan** sonra commit eder. Yavaş disk ya da yüksek ağ gecikmesi doğrudan yazma gecikmesine dönüşür; heartbeat'ler geciktiğinde de gereksiz seçimler başlar. etcd'yi hızlı SSD'li makinelerde çalıştırmak ve üyeleri aynı bölgedeki düşük gecikmeli bağlantılarla yerleştirmek bu yüzden önemlidir.
:::

:::callout{tone="tip" title="Mülakat özeti"}
- Konsensüs = çökme ve gecikmeye rağmen tek log sırası. Güvenlik asla bozulmaz, ilerleme çoğunluk ayaktayken sağlanır.
- Seçim: rastgele timeout → candidate, terim+1 → çoğunluk oyu → lider. Oy yalnızca güncel log'lu adaya verilir.
- Commit: girdi çoğunluğa kopyalanınca. Eski lider daha yüksek terimi görünce follower olur, commit edilmemiş girdileri silinir.
- Bölünmede azınlık yazamaz (CP). Küme boyutu tek sayı: 3 ya da 5.
:::

:::quiz{src="quiz.json"}
:::

:::resources
- [The Raft Consensus Algorithm](https://raft.github.io/) — belge — makale, görselleştirmeler ve uygulamalar listesi
- [In Search of an Understandable Consensus Algorithm (Raft makalesi)](https://raft.github.io/raft.pdf) — bildiri — Ongaro ve Ousterhout, USENIX ATC 2014
- [The Secret Lives of Data: Raft](https://thesecretlivesofdata.com/raft/) — yazı — adım adım görsel anlatım
- [etcd documentation](https://etcd.io/docs/) — belge — küme boyutu, learner üyeler ve işletim
:::

:::next{lesson="q-03-distributed-locks-leases"}
Sırada: konsensüsün pratikteki en yaygın kullanımı — dağıtık kilitler, lease'ler ve süresi dolan bir kilidin neden fencing token gerektirdiği.
:::

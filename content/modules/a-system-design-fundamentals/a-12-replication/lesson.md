---
id: a-12-replication
slug: replication
module: a-system-design-fundamentals
order: 12
title:
  tr: "Replication: Master-Slave, Master-Master, Leader Election, Quorum"
  en: "Replication: Leader-Follower, Multi-Leader, Leader Election, Quorum"
summary:
  tr: Veri kopyalama stratejileri ve quorum simülatörü.
  en: Data replication strategies and a quorum simulator.
durationMinutes: 30
level: advanced
prerequisites: [a-02-latency-throughput-cap, a-11-consistent-hashing-sharding]
tags: [replication, availability, consistency, raft, quorum, distributed-systems]
concepts: [replication, leader-follower, multi-leader, leaderless, sync-vs-async-replication, replication-lag, read-your-writes, failover, leader-election, raft, quorum, split-brain, write-conflict]
---

## Kavram: aynı verinin birden çok kopyası

Sharding veriyi *böler*; **replication (replikasyon)** veriyi *kopyalar*. Aynı kaydın birden fazla makinede bulunmasının üç nedeni vardır:

1. **Erişilebilirlik** — bir düğüm (ya da bir veri merkezi) düşünce sistem çalışmaya devam eder.
2. **Okuma ölçeklemesi** — okumalar kopyalara dağıtılır; tek lider yalnızca yazmalarla uğraşır.
3. **Gecikme** — kopya kullanıcıya coğrafi olarak yakın olursa okuma hızlanır.

Tek zor soru şudur: **kopyalar nasıl aynı kalır?** Veri değişince değişikliğin tüm kopyalara ulaşması zaman alır; bu arada kim yazabilir, kim okuyabilir, çelişen yazmalar olursa kim kazanır? Üç temel mimari bu soruya üç farklı cevap verir.

## 1. Leader-follower (master-slave, primary-replica)

En yaygın model. **Tek lider** tüm yazmaları kabul eder, değişiklikleri bir **replikasyon günlüğü** (WAL, binlog, oplog) olarak takipçilere gönderir; takipçiler günlüğü aynı sırada uygular. Okumalar liderden ya da takipçilerden yapılabilir. PostgreSQL streaming replication, MySQL binlog replication, MongoDB replica set, Redis replica, Kafka partition leader hep bu modeldir.

:::diagram{src="diagram.svg" alt="Üç replikasyon mimarisi yan yana: leader-follower, multi-leader ve leaderless quorum|Three replication architectures side by side: leader-follower, multi-leader and leaderless quorum"}
Soldan sağa: tek liderli, çok liderli ve lidersiz (quorum) replikasyon. Her biri tutarlılık, yazma kullanılabilirliği ve karmaşıklık arasında farklı bir noktada durur.
:::

### Senkron mu, asenkron mu?

| | **Senkron** | **Asenkron** | **Yarı senkron** |
|---|---|---|---|
| Lider ne zaman "tamam" der? | Takipçi(ler) yazmayı onayladıktan sonra | Hemen; takipçilere arka planda gönderir | En az bir takipçi onayladıktan sonra |
| Veri kaybı riski | Yok (onaylanan yazma en az 2 kopyada) | **Var**: lider düşerse henüz kopyalanmamış yazmalar kaybolur | Çok düşük |
| Yazma gecikmesi | En yavaş takipçi kadar | En düşük | Bir takipçi kadar |
| Takipçi düşünce | Yazmalar **durur** | Etkilenmez | Başka takipçi devreye girer |

Üretimde en yaygın seçim yarı senkrondur: bir takipçi senkron (veri kaybı yok), diğerleri asenkron (hız).

### Replication lag ve "kendi yazdığını okuma"

Asenkron takipçiler liderin biraz gerisindedir (**replication lag**: milisaniyelerden, yük altında dakikalara). Kullanıcı profilini güncelleyip sayfayı yenilediğinde takipçiden eski değeri okursa "kaydetmedi" sanır. Çözümler:

- **Read-your-writes**: kullanıcının *kendi* değiştirdiği veriyi bir süre liderden oku (ör. son yazmadan sonraki 1 dk).
- **Monotonic reads**: aynı kullanıcıyı hep aynı takipçiye yönlendir, zamanın geri gitmesini önle.
- **Lag izleme**: lag eşiği aşan takipçiyi okuma havuzundan çıkar.

:::animation{scene="scene.json"}
Yazma lidere gider, günlük takipçilere kopyalanır, quorum onayı sonrası istemciye yanıt döner; geciken takipçiden bayat okuma; lider düşer, Raft tarzı seçimle yeni lider belirlenir ve yazmalar devam eder.
:::

## Lider düşerse: failover ve leader election

Lider çöktüğünde üç şey olmalıdır: (1) çöktüğünün **anlaşılması** (heartbeat zaman aşımı), (2) yeni liderin **seçilmesi**, (3) istemcilerin ve takipçilerin **yeni lidere yönlendirilmesi**. Bunu elle yapmak dakikalar sürer; otomatik yapmak için bir **konsensüs** protokolü gerekir. En yaygın anlatımı **Raft**'tır (etcd, CockroachDB, TiKV, Consul, Kafka KRaft):

- Zaman **term** (dönem) numaralarıyla bölünür; her term'de en fazla bir lider vardır.
- Lider takipçilere düzenli **heartbeat** gönderir. Bir takipçi *election timeout* (rastgele 150–300 ms) boyunca heartbeat almazsa **candidate** olur, term'i artırır ve `RequestVote` gönderir.
- Her düğüm bir term'de **tek oy** verir ve yalnızca kendi günlüğü kadar güncel bir adaya oy verir (günlüğü geride kalan aday lider olamaz — veri kaybı önlenir).
- **Çoğunluğun** (N/2 + 1) oyunu alan aday lider olur. Rastgele timeout'lar iki adayın aynı anda çıkıp oyları bölmesini (split vote) nadir kılar; olursa yeni term'de tekrar denenir.
- Eski lider geri geldiğinde daha yüksek bir term görür ve takipçiye döner.

:::callout{tone="danger" title="Split-brain: iki lider, iki gerçek"}
Ağ bölündüğünde her iki tarafın da "lider benim" demesi **split-brain**'dir: iki taraf farklı yazmalar kabul eder ve birleşme anında veri çelişir. Çoğunluk kuralı bunu önler — 3 düğümlük kümede yalnızca 2 düğümlük taraf lider seçebilir. Bu yüzden küme boyutu **tek sayı** (3, 5) seçilir ve 2 düğümlük "HA" kurulumları aslında güvenli değildir. Eski liderin yazma kabul etmeye devam etmesini engellemek için **fencing token** (yalnızca en yüksek term'in yazması geçerli) kullanılır.
:::

## 2. Multi-leader (master-master, aktif-aktif)

Birden fazla düğüm yazma kabul eder ve değişiklikleri birbirine asenkron iletir. Kullanım alanları: **çok bölgeli** dağıtım (her bölgenin kendi lideri, bölgeler arası gecikme yazma yoluna girmez), **çevrimdışı istemciler** (telefon takvimi), **ortak düzenleme** (Google Docs). Bedeli **yazma çakışmalarıdır**: iki lider aynı kaydı aynı anda farklı değerlere güncellerse biri kazanmalıdır.

| Çakışma çözümü | Nasıl? | Sorun |
|---|---|---|
| **Last-write-wins (LWW)** | En büyük zaman damgası kazanır | Saatler senkron değil; kaybeden yazma sessizce yok olur |
| **Çakışmayı sakla, uygulamaya bırak** | Her iki sürüm tutulur (sibling), okuma sırasında birleştirilir | Uygulama karmaşıklığı (Dynamo'nun sepet örneği) |
| **CRDT** | Matematiksel olarak birleştirilebilir veri tipleri (sayaç, küme, metin) | Her veri modeline uymaz |
| **Çakışmadan kaçınma** | Aynı kaydın yazmalarını hep aynı lidere yönlendir (kullanıcının "ev" bölgesi) | Bölge düşünce yönlendirme değişir, çakışma geri gelir |

## 3. Leaderless ve quorum: W + R > N

Dynamo, Cassandra, Riak ve ScyllaDB lider kavramını tamamen kaldırır: istemci (ya da koordinatör) yazmayı **N kopyanın hepsine** gönderir ve **W** tanesinden onay bekler; okumada **R** kopyadan okur ve en yeni sürümü (versiyon numarası / vektör saati) seçer. Kural:

> **W + R > N** ise her okuma kümesi en az bir güncel kopyayla kesişir → en son yazma mutlaka görülür.

| N = 3 | W | R | Özellik |
|---|---|---|---|
| Dengeli | 2 | 2 | 1 düğüm düşse de okuma ve yazma sürer; her okuma güncel |
| Yazma ağırlıklı | 1 | 3 | Hızlı yazma; okuma herkese sormak zorunda |
| Okuma ağırlıklı | 3 | 1 | Hızlı okuma; bir düğüm düşerse yazma durur |
| Eventual | 1 | 1 | En hızlı, tutarlılık garantisi yok (W + R = 2 ≤ 3) |

Düşen kopyalar geri gelince eksikleri **read repair** (okuma sırasında eski kopya güncellenir) ve **anti-entropy** (arka planda Merkle ağacı karşılaştırması) kapatır. Quorum, çakışmayı tek başına çözmez; eşzamanlı yazmalar yine sürüm karşılaştırması ister.

:::interactive{type="replication-quorum" nodes=3 writeQuorum=2 readQuorum=2 failedNodes=0}
N=3 ile başlayın. W=2, R=2 iken bir düğümü düşürün: yazma ve okuma hâlâ çalışıyor mu? W=1, R=1 yapıp bir yazmadan hemen sonra okuyun — bayat değer alma ihtimali nedir? W=3 iken bir düğümü düşürün: ne oldu? Son olarak N=5, W=3, R=3 ile iki düğümü düşürün.
:::

:::code{lang="ts" title="Quorum koordinatörü: W onay bekle, R kopyadan en yeni sürümü seç"}
```ts
interface Versioned { value: string | null; version: number }   // version: monoton artan yazma numarası
interface Replica {
  id: string;
  write(key: string, v: Versioned): Promise<void>;
  read(key: string): Promise<Versioned>;
}

/** İlk `need` başarılı sonucu bekler; geri kalanını beklemez, hatalar çoğunluğu bozmadıkça yutulur */
async function waitFor<T>(promises: Promise<T>[], need: number): Promise<T[]> {
  return new Promise((resolve, reject) => {
    const ok: T[] = []; let failed = 0;
    for (const p of promises) {
      p.then((r) => { ok.push(r); if (ok.length === need) resolve(ok); })
       .catch(() => { failed++; if (promises.length - failed < need) reject(new Error("quorum sağlanamadı")); });
    }
  });
}

export class QuorumStore {
  constructor(private replicas: Replica[], private W: number, private R: number) {
    const N = replicas.length;
    if (W + R <= N) console.warn(`W + R = ${W + R} ≤ N = ${N}: bayat okuma mümkün (eventual)`);
  }

  async put(key: string, value: string, version: number): Promise<void> {
    // Yazmayı TÜM kopyalara gönder, W onay gelince dön; geç kalanlar arka planda tamamlanır
    const v: Versioned = { value, version };
    await waitFor(this.replicas.map((r) => r.write(key, v)), this.W);
  }

  async get(key: string): Promise<Versioned> {
    // R kopyadan oku, en yüksek sürümü seç
    const results = await waitFor(this.replicas.map((r) => r.read(key)), this.R);
    const newest = results.reduce((a, b) => (b.version > a.version ? b : a));
    // Read repair: eski sürüm dönen kopyaları arka planda güncelle
    for (const r of this.replicas) {
      r.read(key).then((cur) => { if (cur.version < newest.version) void r.write(key, newest); }).catch(() => {});
    }
    return newest;
  }
}
```
```python
import asyncio

class QuorumStore:
    def __init__(self, replicas, W, R):
        self.replicas, self.W, self.R = replicas, W, R
        if W + R <= len(replicas):
            print("uyarı: W + R ≤ N → bayat okuma mümkün")

    async def _wait_for(self, coros, need):
        ok, pending = [], {asyncio.ensure_future(c) for c in coros}
        while pending and len(ok) < need:
            done, pending = await asyncio.wait(pending, return_when=asyncio.FIRST_COMPLETED)
            for t in done:
                if t.exception() is None:
                    ok.append(t.result())
            if len(ok) + len(pending) < need:
                raise RuntimeError("quorum sağlanamadı")
        return ok

    async def put(self, key, value, version):
        await self._wait_for([r.write(key, (value, version)) for r in self.replicas], self.W)

    async def get(self, key):
        results = await self._wait_for([r.read(key) for r in self.replicas], self.R)
        newest = max(results, key=lambda v: v[1])          # en yüksek sürüm kazanır
        for r in self.replicas:                             # read repair (arka planda)
            asyncio.ensure_future(self._repair(r, key, newest))
        return newest

    async def _repair(self, r, key, newest):
        try:
            cur = await r.read(key)
            if cur[1] < newest[1]:
                await r.write(key, newest)
        except Exception:
            pass
```
:::

:::realworld{company="Amazon"}
**Amazon Aurora**, replikasyonu veritabanından ayırıp depolama katmanına taşır: her veri parçası üç Availability Zone'a **6 kopya** olarak yazılır. Yazma quorum'u **W = 4/6**, okuma quorum'u **R = 3/6**'dır (4 + 3 > 6). Bu seçim bilinçlidir: bir AZ tamamen kaybolsa (−2 kopya) yazma devam eder; bir AZ artı bir disk kaybolsa (−3 kopya) okuma devam eder ve kayıp kopya arka planda onarılır. Aurora lider (writer) düğümü yalnızca **redo log** kayıtlarını depolamaya gönderir, tam sayfa yazmaz — bu yüzden replikasyon trafiği geleneksel MySQL'in yaklaşık 1/8'idir. Writer düşerse bir read replica 30 saniyeden kısa sürede yeni writer olur ve DNS uç noktası güncellenir; replica'lar aynı paylaşımlı depolamayı okuduğu için replication lag tipik olarak 20 ms'nin altındadır.
:::

:::callout{tone="tip" title="Mülakat özeti"}
- Varsayılan cevap: **leader-follower, yarı senkron**, okumalar takipçilerden, kullanıcının kendi yazdığı veri için read-your-writes.
- "Lider düşerse?" → heartbeat, election timeout, çoğunluk oyu, term/fencing, **tek sayıda düğüm**. Raft'ı iki cümleyle anlatabilin.
- "Çok bölge, her yerde yazma" → multi-leader; hemen ardından **çakışma çözümünü** söyleyin (LWW'nin veri kaybettiğini belirtin).
- Quorum sorusu: **W + R > N** formülünü yazın, N=3/W=2/R=2 örneğini verin, düğüm düşünce ne olduğunu açıklayın.
- Her yaklaşımın kaybettiği şeyi söyleyin: senkron → gecikme, asenkron → veri kaybı riski, multi-leader → çakışma, quorum → eşzamanlı yazma sürümleri.
:::

:::quiz{src="quiz.json"}
:::

:::next{lesson="a-13-observability-12-factor"}
Sırada: replikasyon gecikmesini, lider seçimini ve her şeyi *görebilmek* — logging, metrics, tracing ve üretime hazır uygulamalar için 12-factor ilkeleri.
:::

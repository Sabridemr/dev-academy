---
id: a-11-consistent-hashing-sharding
slug: consistent-hashing-sharding
module: a-system-design-fundamentals
order: 11
title:
  tr: "Consistent Hashing, Sharding, Partitioning"
  en: "Consistent Hashing, Sharding, Partitioning"
summary:
  tr: Animasyonlu halka, sanal düğümler, yeniden dağıtım maliyeti.
  en: Animated ring, virtual nodes, redistribution cost.
durationMinutes: 30
level: advanced
tags: [consistent-hashing, sharding, partitioning, distributed-systems, scaling]
prerequisites: [a-05-load-balancing, a-07-caching]
concepts: [consistent-hashing, hash-ring, mod-n-problem, virtual-nodes, sharding, range-partitioning, hash-partitioning, directory-partitioning, shard-key, hot-shard, resharding, cross-shard-query]
---

## Kavram: veri tek makineye sığmayınca

Bir Redis sunucusu 64 GB tutar; 500 GB cache'iniz var. Bir PostgreSQL saniyede 20.000 yazma kaldırır; 200.000 geliyor. Dikey ölçeklemenin sonu geldiğinde veriyi **parçalara bölüp** (partition / shard) birden çok düğüme dağıtırsınız. O anda cevaplanması gereken tek soru şudur: *"Bu anahtar hangi düğümde?"* Cevap hem hızlı hesaplanmalı hem de düğüm eklenip çıkarıldığında **mümkün olduğunca az veri taşınmalıdır**.

## Basit çözüm ve çöküşü: `hash(key) mod N`

İlk akla gelen: anahtarı hash'le, düğüm sayısına göre mod al. 4 düğüm için `hash("user:42") mod 4 = 2` → düğüm 2. Hızlı, eşit dağılımlı, durumsuz. Sorun, *N* değiştiğinde ortaya çıkar: 4 düğüme bir beşinci eklendiğinde `mod 4` yerine `mod 5` kullanılır ve anahtarların yaklaşık **%80'i** başka bir düğüme düşer. Cache için bu, isabet oranının bir anda sıfıra inmesi ve veritabanının ezilmesi demektir; veritabanı shard'ları için ise terabaytlarca verinin taşınması.

Genel kural: `mod N`'de düğüm sayısı *N*'den *N+1*'e çıkınca taşınan anahtar oranı ≈ *N/(N+1)* — neredeyse hepsi. İdeal oran ise yalnızca **1/(N+1)**: yeni düğüm payına düşen kadar.

## Consistent hashing: halka

1997'de Karger ve arkadaşlarının önerdiği fikir basittir: hem **düğümleri** hem **anahtarları** aynı hash uzayına (ör. 0 … 2³²−1) yerleştirin ve bu uzayı bir **halka** olarak düşünün.

1. Her düğüm `hash(nodeId)` ile halkada bir noktaya konur.
2. Her anahtar `hash(key)` ile halkada bir noktaya düşer.
3. Anahtarın sahibi, o noktadan **saat yönünde** ilerlerken karşılaşılan **ilk düğümdür**.

Bir düğüm eklendiğinde yalnızca **saat yönünün tersindeki komşusuyla arasındaki** anahtarlar yeni düğüme taşınır; diğer tüm anahtarların sahibi değişmez. Düğüm çıkarıldığında ise onun anahtarları yalnızca saat yönündeki komşuya geçer. Taşınan veri ≈ *K/N* (K anahtar, N düğüm) — ideal değer.

:::diagram{src="diagram.svg" alt="Hash halkası üzerinde üç düğüm ve anahtarlar; yeni düğüm eklenince yalnızca komşu aralığın taşınması; mod N ile karşılaştırma|A hash ring with three nodes and keys; adding a node moves only the neighbouring range; comparison with mod N"}
Anahtar saat yönündeki ilk düğüme aittir. N4 eklenince yalnızca N1–N4 arasındaki yay (vurgulu) N2'den N4'e taşınır.
:::

:::animation{scene="scene.json"}
Düğüm ve anahtarların halkaya yerleşmesi, saat yönünde sahip bulma, N4 eklenince yalnızca bir anahtarın taşınması ve sanal düğümlerle dağılımın düzelmesi.
:::

## Sanal düğümler (virtual nodes / vnodes)

Üç düğümü halkaya rastgele koyarsanız aralıklar eşit çıkmaz: biri halkanın yarısına, diğeri %10'una sahip olabilir. Bir düğüm düşünce tüm yükü tek bir komşuya biner. Çözüm: her fiziksel düğümü halkaya **bir değil, 100–200 noktaya** koymak (`hash("N1#0")`, `hash("N1#1")`, …). Bu sanal düğümler:

- **Dağılımı düzeltir** — çok sayıda küçük aralık, büyük sayılar yasasıyla eşitlenir (standart sapma vnode sayısıyla düşer).
- **Heterojen kapasiteyi destekler** — iki kat güçlü makineye iki kat vnode verilir.
- **Düşen düğümün yükünü yayar** — N2'nin 150 vnode'u halkanın her yerine dağıldığı için anahtarları tek komşuya değil, tüm düğümlere paylaştırılır.

Bedeli, halka tablosunun büyümesidir (N × vnode nokta; ikili aramayla O(log) lookup) — pratikte önemsizdir.

:::interactive{type="consistent-hashing" nodes=3 virtualNodes=1 keys=24}
Önce sanal düğüm sayısı 1 iken anahtarların düğümlere nasıl dengesiz dağıldığına bakın. Bir düğüm ekleyin: kaç anahtar taşındı? Sanal düğüm sayısını 50'ye çıkarın ve aynı deneyi tekrarlayın — dağılım ve taşınma oranı nasıl değişti? Bir düğümü kaldırın; yükü kime gitti?
:::

## Sharding stratejileri

Consistent hashing, *hash tabanlı* bölümlemenin bir uygulamasıdır. Veritabanlarında üç temel strateji vardır:

| Strateji | Kural | Artıları | Eksileri | Örnekler |
|---|---|---|---|---|
| **Range (aralık)** | Anahtar aralıkları shard'lara atanır: A–F → S1, G–M → S2 … | Aralık sorguları (`WHERE date BETWEEN`) tek shard'a gider; sıralı tarama kolay | **Hot shard**: zaman damgası anahtarı tüm yazmayı son shard'a yığar; aralık sınırlarını yeniden dengelemek gerekir | HBase, Bigtable, MongoDB (ranged), CockroachDB |
| **Hash** | `hash(key)` → shard (mod N ya da consistent hashing) | Eşit dağılım; hot spot riski düşük | Aralık sorguları **tüm shard'lara** dağılır (scatter-gather); sıralama yok | Cassandra, DynamoDB, Redis Cluster (16.384 hash slot) |
| **Directory (dizin)** | Ayrı bir arama servisi "anahtar → shard" eşlemesini tutar | Tam esneklik: istenen anahtar istenen shard'a; taşıma kolay | Dizin servisi **ekstra atlama ve tek hata noktası**; büyük anahtar sayısında dizinin kendisi ölçek problemi | Vitess (VSchema), bazı çok kiracılı (multi-tenant) SaaS tasarımları |

Hibrit yaklaşımlar yaygındır: Cassandra **partition key**'i hash'ler (shard seçimi), **clustering key** ile partition içinde sıralı tutar (aralık sorgusu). DynamoDB da aynı modeldir.

## Shard anahtarı seçimi ve hot shard problemi

Shard anahtarı (shard key / partition key) sistemin en kalıcı kararıdır; değiştirmek tüm verinin taşınması demektir. İyi bir anahtar üç özellik taşır:

1. **Yüksek kardinalite** — `country` (200 değer) kötü, `userId` (milyonlarca) iyi.
2. **Düzgün yük dağılımı** — yalnızca anahtar sayısı değil, *trafik* de eşit dağılmalı.
3. **Sorgu yerelliği** — en sık sorgular tek shard'a gitmeli (`userId` ile bölünmüşse "kullanıcının siparişleri" tek shard; "bugünkü tüm siparişler" ise tüm shard'lar).

**Hot shard (sıcak parça)**, trafik tek bir shard'da yoğunlaştığında oluşur:

- *Zaman damgası anahtarı*: tüm yeni yazmalar en son aralığa gider (range sharding'in klasik hatası). Çare: anahtarın önüne hash öneki eklemek (`hash(userId) % 16 || timestamp`) ya da hash sharding.
- *Ünlü anahtar*: `userId = Taylor Swift` tek başına bir shard'ı doldurur. Çare: anahtarı alt anahtarlara bölmek (`user:1:0..15`), hot anahtarları ayrı bir katmanda (cache) tutmak ya da DynamoDB'nin yaptığı gibi *adaptive capacity* ile hot partition'ı otomatik bölmek.

:::callout{tone="danger" title="Hot shard'ı ölçmeden tasarım bitmez"}
"Anahtar sayısı eşit" ile "yük eşit" aynı şey değildir. Twitter'da takipçi sayısı, e-ticarette Black Friday ürünü, oyunlarda lider tablosu: anahtarlar eşit dağılsa da trafik %1'lik dilimde toplanır. Shard başına QPS ve veri boyutunu ayrı ayrı izleyin; en sıcak shard'ın ortalamanın 3 katını aştığı an yeniden dengeleme zamanıdır.
:::

## Yeniden dağıtım (resharding) ve cross-shard sorgular

Shard sayısı değişince veri taşınır; consistent hashing bunu en aza indirir ama sıfırlamaz. Pratik teknikler:

- **Önceden fazla mantıksal shard** oluşturup fiziksel düğümlere eşlemek (Redis Cluster'ın 16.384 slot'u, Vitess'in "shard split" işlemi). Düğüm eklemek slot'ları taşımaktır, hash fonksiyonunu değiştirmek değil.
- **Çift yazma + arka planda kopyalama**: taşıma sırasında eski ve yeni shard'a birlikte yazılır, okuma yeni shard'a geçirilir, eski silinir.

Shard'lar arası **JOIN** ve **transaction** pahalıdır: ya uygulama katmanında scatter-gather yapılır, ya veri sık birlikte sorgulanan şekilde **denormalize** edilir, ya da sorgu kalıbına göre ikinci bir kopya (ör. `orderId` ile bölünmüş siparişlerin `userId` ile bölünmüş bir indeksi — DynamoDB'de *Global Secondary Index*) tutulur.

:::code{lang="ts" title="Sanal düğümlü consistent hashing halkası (ikili arama ile lookup)"}
```ts
import { createHash } from "node:crypto";

/** 32-bit hash: MD5'in ilk 4 baytı (hızlı ve düzgün dağılımlı; kriptografik güvenlik gerekmez) */
function hash32(input: string): number {
  return createHash("md5").update(input).digest().readUInt32BE(0);
}

export class HashRing {
  private points: number[] = [];                  // sıralı halka konumları
  private owners = new Map<number, string>();     // konum → fiziksel düğüm

  constructor(nodes: string[] = [], private readonly vnodes = 150) {
    nodes.forEach((n) => this.addNode(n));
  }

  addNode(node: string): void {
    for (let i = 0; i < this.vnodes; i++) {
      const p = hash32(`${node}#${i}`);           // her sanal düğüm halkada ayrı bir nokta
      this.owners.set(p, node);
      this.points.push(p);
    }
    this.points.sort((a, b) => a - b);            // lookup için sıralı tut
  }

  removeNode(node: string): void {
    this.points = this.points.filter((p) => this.owners.get(p) !== node);
    for (const [p, n] of this.owners) if (n === node) this.owners.delete(p);
  }

  /** Anahtarın sahibi: saat yönünde ilk nokta (ikili arama, O(log N·vnodes)) */
  getNode(key: string): string | undefined {
    if (this.points.length === 0) return undefined;
    const h = hash32(key);
    let lo = 0, hi = this.points.length - 1;
    while (lo < hi) {
      const mid = (lo + hi) >>> 1;
      if (this.points[mid] < h) lo = mid + 1; else hi = mid;
    }
    // h, en büyük noktadan da büyükse halkanın başına sar
    const p = this.points[lo] >= h ? this.points[lo] : this.points[0];
    return this.owners.get(p);
  }
}

// Taşınma maliyetini ölçelim
const keys = Array.from({ length: 100_000 }, (_, i) => `user:${i}`);
const ring = new HashRing(["n1", "n2", "n3", "n4"]);
const before = new Map(keys.map((k) => [k, ring.getNode(k)]));
ring.addNode("n5");
const moved = keys.filter((k) => before.get(k) !== ring.getNode(k)).length;
console.log(`taşınan: ${(moved / keys.length * 100).toFixed(1)}%`);   // ≈ 20% (= 1/5); mod N ile ≈ 80% olurdu
```
```python
import bisect, hashlib

def hash32(s: str) -> int:
    return int.from_bytes(hashlib.md5(s.encode()).digest()[:4], "big")

class HashRing:
    def __init__(self, nodes=(), vnodes=150):
        self.vnodes, self.points, self.owners = vnodes, [], {}
        for n in nodes:
            self.add_node(n)

    def add_node(self, node: str):
        for i in range(self.vnodes):               # her sanal düğüm ayrı bir nokta
            p = hash32(f"{node}#{i}")
            self.owners[p] = node
            bisect.insort(self.points, p)

    def remove_node(self, node: str):
        self.points = [p for p in self.points if self.owners[p] != node]
        self.owners = {p: n for p, n in self.owners.items() if n != node}

    def get_node(self, key: str):
        if not self.points:
            return None
        h = hash32(key)
        i = bisect.bisect_left(self.points, h)      # saat yönünde ilk nokta
        if i == len(self.points):                   # sona geldiysek başa sar
            i = 0
        return self.owners[self.points[i]]
```
:::

:::realworld{company="Amazon"}
Amazon'un 2007 tarihli **Dynamo** makalesi, consistent hashing'i sanal düğümlerle birlikte üretim ölçeğinde kullanan ilk sistemlerden birini anlatır: her depolama düğümü halkada onlarca "token" alır, böylece bir düğüm eklenince ya da düşünce yük tüm kümeye yayılır ve güçlü makinelere daha çok token verilebilir. Bugün **DynamoDB** aynı ilkeyle çalışır: tablo, partition key'in hash'ine göre partition'lara bölünür; her partition en fazla 10 GB veri ve saniyede 3.000 okuma / 1.000 yazma birimi kaldırır. Trafik tek bir partition key'de yoğunlaşırsa (hot partition) **adaptive capacity** otomatik olarak o partition'a daha fazla kapasite kaydırır ve gerekirse partition'ı ikiye böler; yine de AWS'nin ilk tavsiyesi hep aynıdır: yüksek kardinaliteli, trafiği düzgün dağıtan bir partition key seçin — `date` değil, `userId`; gerekiyorsa `userId#shardSuffix` ile yazma yükünü yayın.
:::

:::callout{tone="tip" title="Mülakat özeti"}
- "Sharding yaparım" dediğinizde sırayla söyleyin: **shard anahtarı ne** (kardinalite, dağılım, sorgu yerelliği), **strateji ne** (range / hash / directory ve neden), **hot shard'ı nasıl engellerim**, **yeniden dağıtım nasıl olur** (consistent hashing / önceden bölünmüş slot'lar).
- Consistent hashing'i iki cümleyle anlatabilin: *anahtar saat yönündeki ilk düğümündür; düğüm eklenince yalnızca komşu aralık taşınır (~K/N)*. Sanal düğümleri sormadan ekleyin.
- Cross-shard JOIN sorusuna hazır olun: denormalizasyon, ikincil indeks kopyası ya da scatter-gather — ve her birinin bedeli.
:::

:::quiz{src="quiz.json"}
:::

:::next{lesson="a-12-replication"}
Sırada: shard'lara böldüğümüz verinin kaybolmaması için kopyalanması — leader-follower, multi-leader, leader election ve quorum.
:::

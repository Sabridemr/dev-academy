---
id: a-02-latency-throughput-cap
slug: latency-throughput-cap
module: a-system-design-fundamentals
order: 2
title:
  tr: "Gecikme vs. Verimlilik, SLA/SLO, CAP ve Tutarlılık"
  en: "Latency vs. Throughput, SLA/SLO, CAP and Consistency"
summary:
  tr: Performans ölçütleri (p50/p99), hizmet seviyeleri (SLA/SLO/SLI, hata bütçesi), CAP teoremi, PACELC ve tutarlılık modelleri — ağ bölünmesinde CP ve AP davranışı animasyonu.
  en: Performance metrics (p50/p99), service levels (SLA/SLO/SLI, error budgets), the CAP theorem, PACELC and consistency models — with an animation of CP and AP behaviour under a network partition.
durationMinutes: 30
level: intermediate
tags: [performance, latency, throughput, sla, slo, cap, consistency, distributed-systems]
prerequisites: [a-01-client-server-dns-http]
concepts: [latency, throughput, percentiles, tail-latency, sla-slo-sli, error-budget, cap-theorem, network-partition, cp-vs-ap, pacelc, consistency-models, eventual-consistency]
---

## Kavram: hızlı mı, çok mu?

"Sistem hızlı mı?" sorusu aslında iki ayrı sorudur:

- **Latency (gecikme)**: Tek bir isteğin başlangıcından bitişine kadar geçen süre. Birim: milisaniye.
- **Throughput (verimlilik / iş hacmi)**: Birim zamanda tamamlanan iş miktarı. Birim: istek/saniye (RPS), MB/s.

İkisi birbirinden bağımsız iyileştirilebilir ve çoğu zaman birbiriyle çelişir. Bir otoyol düşünün: gecikme bir arabanın yolu kat etme süresi, verimlilik saatte geçen araba sayısıdır. Şerit eklemek verimliliği artırır ama tek bir arabanın hızını değiştirmez; hız sınırını yükseltmek gecikmeyi düşürür ama şerit sayısı aynıysa saatte geçen araba sınırlıdır. Daha kötüsü, yol dolmaya başladığında (yüksek **utilization**) gecikme üstel olarak artar — kuyruk teorisinin temel sonucu budur ve %70–80 doluluktan sonra her sistem bunu yaşar.

İstek işleme süresini üç parçaya ayırmak işe yarar:

| Bileşen | Ne harcar? | Nasıl düşer? |
|---|---|---|
| **Ağ gecikmesi** | RTT × tur sayısı (önceki ders) | CDN, keep-alive, HTTP/3, daha az tur |
| **Kuyruk gecikmesi** | İsteğin işlenmeyi beklediği süre | Kapasite ekle, doluluğu düşür, önceliklendir |
| **Servis süresi** | CPU, disk, bağımlı servis çağrıları | Cache, indeks, paralel çağrı, daha az iş |

:::diagram{src="diagram.svg" alt="Solda gecikme dağılımı histogramı ve p50/p95/p99 çizgileri, sağda CAP üçgeni ve CP/AP/CA köşeleri|On the left a latency distribution histogram with p50/p95/p99 lines, on the right the CAP triangle with CP/AP/CA corners"}
Sol: gecikme asla tek bir sayı değildir, bir dağılımdır. Sağ: ağ bölünmesi yaşandığında (P kaçınılmaz) tutarlılık ile erişilebilirlikten biri seçilir.
:::

## Ortalama yalan söyler: yüzdelikler

1000 isteğin 990'ı 20 ms, 10'u 3 saniye sürüyorsa ortalama ~50 ms çıkar ve "sistem hızlı" dersiniz. Oysa her 100 kullanıcıdan biri 3 saniye bekledi. Bu yüzden gecikme **yüzdeliklerle (percentile)** raporlanır:

- **p50 (medyan)**: Kullanıcıların yarısının gördüğü tipik deneyim.
- **p95 / p99**: Kullanıcıların %5'inin / %1'inin gördüğünden daha kötü olan değer. "Kuyruk gecikmesi" (tail latency).
- **p99.9**: Büyük ölçekte önemli; günde 100 milyon istek alan bir sistemde p99.9 hâlâ 100 bin isteği temsil eder.

**Tail latency amplification (kuyruk gecikmesi büyümesi)**: Bir sayfa 100 mikroservise paralel istek atıyorsa ve her birinin p99'u 1 saniyeyse, sayfanın bu 1 saniyeyi görme olasılığı `1 − 0.99^100 ≈ %63`'tür. Tekil servis p99'u sayfa için neredeyse medyan olur. Büyük şirketlerin p99'a takıntılı olmasının nedeni budur. Çözümler: **hedged request** (yavaş kalan isteğin kopyasını başka replikaya gönder), zaman aşımı + varsayılan değer, bağımlılık sayısını azaltma.

:::callout{tone="warning" title="Gecikme hedeflerini ortalamayla yazmayın"}
"Ortalama yanıt süresi 200 ms altında" diyen bir SLO, kullanıcıların %5'inin 5 saniye beklediği bir sistemi geçer. Hedefleri "isteklerin %99'u 300 ms altında" biçiminde yazın; ortalamayı yalnızca kapasite planlamasında kullanın.
:::

## SLA, SLO, SLI ve hata bütçesi

| Terim | Ne? | Örnek |
|---|---|---|
| **SLI** (indicator) | Ölçülen metrik | Başarılı (non-5xx) isteklerin oranı; p99 gecikme |
| **SLO** (objective) | Ekibin kendine koyduğu iç hedef | 30 günde %99.9 başarılı istek; p99 < 300 ms |
| **SLA** (agreement) | Müşteriye verilen, ihlalinde yaptırımı olan sözleşme | %99.9 erişilebilirlik; altına düşülürse %10 iade |

SLO her zaman SLA'dan sıkı tutulur: SLA %99.9 ise SLO %99.95 olur ki alarm, para ödemeden önce çalsın.

**Hata bütçesi (error budget)** = `1 − SLO`. %99.9 SLO ayda yaklaşık **43 dakika** kesinti bütçesi demektir; %99.99 ise 4,3 dakika. Bütçe, ürün ile güvenilirlik arasındaki pazarlığı sayıya döker: bütçe doluysa yeni özellik yayınlamak serbest, bütçe tükendiyse yalnızca güvenilirlik işi yapılır. Her ek "dokuz" maliyeti yaklaşık 10 kat artırır çünkü artık insan müdahalesine zaman kalmaz; otomasyon, çoklu bölge ve yedeklilik şart olur.

| Erişilebilirlik | Yıllık kesinti | Aylık kesinti |
|---|---|---|
| %99 | 3,65 gün | 7,3 saat |
| %99.9 | 8,8 saat | 43,8 dk |
| %99.99 | 52,6 dk | 4,4 dk |
| %99.999 | 5,3 dk | 26 sn |

Seri bağlı bileşenlerde erişilebilirlikler çarpılır: her biri %99.9 olan 5 servise bağlı bir sayfa en iyi ihtimalle `0.999^5 ≈ %99.5` olur. Paralel yedeklilikte ise `1 − (1−A)^n` ile artar: iki bağımsız %99 replika birlikte %99.99 verir.

## CAP teoremi: bölünme anında seçim

Dağıtık bir veri sisteminde üç özellik tanımlanır:

- **Consistency (tutarlılık)**: Her okuma, en son yazmayı ya da bir hata döner. (Bu, ACID'deki C değil, *linearizability*'ye yakın bir anlamdır.)
- **Availability (erişilebilirlik)**: Çöken düğüm hariç her düğüm, her isteğe hata olmayan bir yanıt verir.
- **Partition tolerance (bölünme toleransı)**: Düğümler arası ağ koptuğunda sistem çalışmaya devam eder.

Teoremin popüler ama yanıltıcı özeti "üçünden ikisini seç"tir. Gerçekte ağ bölünmesi (partition) sizin seçiminiz değildir; kablolar kopar, switch'ler çöker, GC duraklaması düğümü "ölü" gösterir. **P her zaman olur.** Dolayısıyla asıl soru şudur: *bölünme yaşandığı anda* C'den mi, A'dan mı vazgeçeceksiniz?

- **CP sistem**: Bölünmede azınlık taraf yazmayı (hatta okumayı) reddeder; hata döner ama asla eski veri vermez. Örnek: ZooKeeper, etcd, HBase, çoğunluk (quorum) ayarlı Spanner.
- **AP sistem**: Her iki taraf da istek kabul etmeye devam eder; bölünme bitince çakışmalar uzlaştırılır (last-write-wins, vector clock, CRDT). Örnek: Cassandra, DynamoDB (varsayılan), CouchDB, DNS.
- **"CA" sistem**: Bölünmeyi tolere etmez; yani tek düğümlü ya da tek veri merkezli geleneksel bir ilişkisel veritabanıdır. Dağıtık değilse CAP'in konusu da değildir.

Aşağıdaki animasyon aynı bölünmede CP ve AP tarafının nasıl davrandığını yan yana gösterir.

:::animation{scene="scene.json"}
Ağ bölünmesi: CP tarafı azınlık replikada yazmayı reddeder; AP tarafı kabul eder ve bölünme kapanınca uzlaştırır.
:::

### PACELC: bölünme yokken de bir takas var

CAP yalnızca bölünme anını anlatır; oysa sistemler zamanın %99.99'unda bölünme yaşamaz. **PACELC** bunu tamamlar: *if **P**artition then **A** or **C**; **E**lse **L**atency or **C**onsistency*. Bölünme yokken bile her yazmayı tüm replikalara senkron yazarsanız (güçlü tutarlılık) gecikme artar; tek replikaya yazıp arkadan kopyalarsanız (eventual) gecikme düşer ama bir an için eski veri okunabilir.

| Sistem | Bölünmede | Normalde |
|---|---|---|
| DynamoDB (varsayılan) | A | L |
| Cassandra | A | L (quorum ile ayarlanabilir) |
| MongoDB (majority) | C | C |
| Spanner | C | C (TrueTime ile gecikme düşürülür) |
| PostgreSQL + sync replika | C | C |

## Tutarlılık modelleri: güçlüden zayıfa

1. **Linearizable (güçlü)**: Tek bir kopyası varmış gibi davranır; yazma tamamlandıysa herkes görür. Pahalı: her işlem çoğunluk onayı ister.
2. **Sequential**: Tüm düğümler aynı sırayı görür ama gerçek zamanla örtüşmeyebilir.
3. **Causal**: Sebep-sonuç ilişkili işlemler sırayla görülür (yanıt, sorudan önce görünmez); ilişkisizler serbest.
4. **Read-your-writes / Monotonic reads**: Kullanıcı kendi yazdığını hemen görür / bir kez gördüğü veriyi sonra daha eskisiyle değiştirilmiş görmez. Oturum (session) garantileri; genelde kullanıcıyı aynı replikaya yapıştırarak sağlanır.
5. **Eventual (nihai)**: Yazma durursa replikalar *bir süre sonra* aynı değere yakınsar. Bu sürenin üst sınırı yoktur; sosyal medya beğeni sayacı için iyi, banka bakiyesi için kötü.

Pratik kural: **para, envanter, kimlik → güçlü; sayaç, akış, öneri → eventual.** Aynı sistemin farklı tabloları farklı model kullanabilir.

:::interactive{type="cap-theorem" replicas=3 mode="cp" partition=false}
"Ağı böl" düğmesine basıp CP ve AP modlarında aynı yazma isteğinin akıbetini karşılaştırın: CP'de azınlık tarafında kalan N1 yazmayı ve okumayı reddeder, AP'de kabul eder ama diğer taraf bayat okur. Replika sayısını 2'den 5'e değiştirerek çoğunluk (quorum) eşiğinin ve azınlıkta kalan düğüm sayısının nasıl değiştiğini gözlemleyin; AP modunda iki tarafa da yazdıktan sonra "Bölünmeyi onar" ile çakışan değerlerin nasıl uzlaştırıldığını (last-write-wins) günlükte izleyin.
:::

:::code{lang="ts" title="Yüzdelik hesaplama ve quorum tabanlı yazma kararı"}
```ts
/** Sıralı örneklemden p-yüzdeliğini döner (nearest-rank yöntemi). */
export function percentile(samplesMs: number[], p: number): number {
  if (samplesMs.length === 0) throw new Error("örnek yok");
  const sorted = [...samplesMs].sort((a, b) => a - b);
  const rank = Math.ceil((p / 100) * sorted.length) - 1;   // p=99 → 0-tabanlı indeks
  return sorted[Math.max(0, rank)];
}

/** Hata bütçesi: SLO'ya göre pencerede kalan kesinti süresi (dakika). */
export function errorBudgetMinutes(sloPercent: number, windowDays: number, usedMinutes: number): number {
  const totalMinutes = windowDays * 24 * 60;
  const budget = totalMinutes * (1 - sloPercent / 100);     // %99.9 / 30 gün → 43.2 dk
  return Math.max(0, budget - usedMinutes);
}

interface Replica { id: string; reachable: boolean }

/** CP davranışı: çoğunluk (quorum) ulaşılabilir değilse yazmayı reddet. */
export async function writeWithQuorum(
  replicas: Replica[], quorum: number, key: string, value: string,
  send: (r: Replica, k: string, v: string) => Promise<boolean>,
): Promise<"committed" | "unavailable"> {
  const reachable = replicas.filter((r) => r.reachable);
  if (reachable.length < quorum) return "unavailable";       // azınlık taraf: hata dön, eski veri verme
  const acks = await Promise.allSettled(reachable.map((r) => send(r, key, value)));
  const ok = acks.filter((a) => a.status === "fulfilled" && a.value).length;
  return ok >= quorum ? "committed" : "unavailable";        // yeterli onay yoksa taahhüt etme
}
```
```python
import asyncio, math

def percentile(samples_ms: list[float], p: float) -> float:
    """Nearest-rank yüzdelik: p=99 için p99 gecikmesi."""
    if not samples_ms:
        raise ValueError("örnek yok")
    s = sorted(samples_ms)
    rank = max(0, math.ceil(p / 100 * len(s)) - 1)
    return s[rank]

def error_budget_minutes(slo_percent: float, window_days: int, used_minutes: float) -> float:
    total = window_days * 24 * 60
    budget = total * (1 - slo_percent / 100)   # %99.9 / 30 gün → 43.2 dk
    return max(0.0, budget - used_minutes)

async def write_with_quorum(replicas, quorum, key, value, send):
    reachable = [r for r in replicas if r.reachable]
    if len(reachable) < quorum:
        return "unavailable"                      # CP: azınlıkta yazma yok
    results = await asyncio.gather(*(send(r, key, value) for r in reachable), return_exceptions=True)
    acks = sum(1 for r in results if r is True)
    return "committed" if acks >= quorum else "unavailable"
```
:::

:::realworld{company="Amazon"}
Amazon'un 2007 tarihli **Dynamo** makalesi, alışveriş sepetinin neden AP seçtiğini açıkça yazar: "müşteri sepete ürün ekleyemiyorsa satış kaybedilir; iki sepet sürümü çakışırsa birleştirilir." Bölünme sırasında her replika yazmayı kabul eder, çakışmalar *vector clock* ile tespit edilip sepetler birleştirilir (silinen ürünün geri gelmesi kabul edilen bir yan etkidir). Aynı şirketin **DynamoDB** servisi bugün varsayılan olarak *eventually consistent* okuma sunar ve isteğe bağlı *strongly consistent* okuma için iki kat okuma kapasitesi ücreti alır — PACELC'in L/C takası doğrudan fiyat listesindedir. Performans tarafında Amazon'un meşhur bulgusu: her **100 ms** ek gecikme satışları yaklaşık **%1** düşürür; bu yüzden ekipler ortalamayı değil p99.9'u izler ve "hedged request" gibi kuyruk kısaltma tekniklerini standart kütüphaneye gömer.
:::

:::callout{tone="tip" title="Mülakat ipuçları"}
- Gecikme ve verimliliği ayrı ayrı sayılarla ifade edin: "p99 < 200 ms, 50k RPS" gibi. Tek bir "hızlı olmalı" cümlesi puan getirmez.
- CAP sorulduğunda "P'den vazgeçilemez; bölünmede C mi A mı?" diye çerçeveleyin, sonra PACELC ile normal zamandaki gecikme/tutarlılık takasını ekleyin.
- Her veri için ayrı karar verin: sipariş kaydı güçlü tutarlı, ürün görüntülenme sayacı eventual.
- SLO'yu kullanıcı gözünden yazın (başarılı istek oranı, p99), sunucu CPU'su gibi iç metriklerle değil.
:::

:::quiz{src="quiz.json"}
:::

:::next{lesson="a-03-horizontal-vertical-scaling"}
Sırada: verimlilik sınırına dayanan tek bir sunucuyu büyütmek mi, çoğaltmak mı? Yatay ve dikey ölçekleme.
:::

---
id: a-03-horizontal-vertical-scaling
slug: horizontal-vertical-scaling
module: a-system-design-fundamentals
order: 3
title:
  tr: "Yatay ve Dikey Ölçekleme"
  en: "Horizontal and Vertical Scaling"
summary:
  tr: Tek sunucu CPU %100'e dayanınca ne yapılır? Dikey büyütme (scale up) ile yatay çoğaltma (scale out) karşılaştırması, otomatik ölçekleme ve ölçeklemenin açığa çıkardığı yeni problemler.
  en: What do you do when a single server hits 100% CPU? Scale up versus scale out compared, autoscaling, and the new problems that scaling exposes.
durationMinutes: 25
level: beginner
tags: [scaling, capacity, availability, autoscaling, infrastructure]
prerequisites: [a-02-latency-throughput-cap]
concepts: [vertical-scaling, horizontal-scaling, scale-up-vs-scale-out, single-point-of-failure, autoscaling, capacity-planning, amdahl-law, stateless-prerequisite]
---

## Kavram: sunucu dolunca

Bir önceki derste kuyruk teorisinin acımasız kuralını gördük: doluluk %70–80'i aştığında gecikme üstel olarak artar. Tek sunucunuzun CPU grafiği %100'e yapıştığında, bellek şiştiğinde ya da disk IOPS sınırına dayandığında kullanıcılar bunu yavaşlık ve zaman aşımı olarak yaşar. İki seçeneğiniz vardır:

- **Dikey ölçekleme (vertical scaling / scale up)**: Aynı makineyi daha güçlüsüyle değiştirmek. 4 çekirdek → 32 çekirdek, 16 GB → 256 GB RAM, SSD → NVMe.
- **Yatay ölçekleme (horizontal scaling / scale out)**: Aynı makineden daha fazla eklemek ve yükü aralarında paylaştırmak. 1 sunucu → 4 sunucu.

İkisi de "kapasite ekler" ama sonuçları çok farklıdır. Yatay ölçekleme, modern sistem tasarımının neredeyse tüm diğer konularını (load balancer, stateless servis, dağıtık cache, sharding) zorunlu kılan karardır.

:::diagram{src="diagram.svg" alt="Solda dikey ölçekleme: küçük sunucu büyük sunucuya dönüşüyor; sağda yatay ölçekleme: load balancer arkasında dört eş sunucu|On the left vertical scaling: a small server becomes a big one; on the right horizontal scaling: four identical servers behind a load balancer"}
Dikey: tek makine, daha fazla güç. Yatay: daha fazla makine, araya bir dağıtıcı.
:::

## Dikey ölçekleme: kolay ama tavanı var

Dikey ölçeklemenin cazibesi basitliğidir: uygulama kodunda tek satır değişmez, veri tek yerde kalır, transaction'lar tek makinede ACID'dir. Çoğu startup'ın ilk yılı bu şekilde geçer ve bu **doğru** bir tercihtir — erken dağıtık sistem kurmak gereksiz karmaşıklıktır.

Ancak üç sınır vardır:

1. **Fiziksel tavan**: Satın alabileceğiniz en büyük makine bir noktada biter. AWS'in en büyük genel amaçlı örneği (ör. `u-24tb1.metal`, 24 TB RAM, 448 vCPU) bile sonludur ve o noktaya varmadan çok önce maliyet eğrisi dikleşir.
2. **Doğrusal olmayan fiyat**: İki kat çekirdek genelde iki kattan fazlaya mal olur; en üst segment makineler "premium" fiyatlanır.
3. **Tek hata noktası (SPOF)**: Ne kadar büyük olursa olsun tek makine çöktüğünde her şey durur. Yükseltme için bile genellikle yeniden başlatma (downtime) gerekir.

Buna rağmen bazı iş yükleri dikey ölçeklemeyi **tercih eder**: ilişkisel veritabanının birincil (primary) düğümü, bellek içi analitik, büyük tek işlemli (single-threaded) hesaplamalar. Veri dağıtmanın bedeli ağırsa, önce büyütün.

## Yatay ölçekleme: sınırsız ama bedelli

Yatay ölçeklemede teorik tavan yoktur: 4 sunucu yetmiyorsa 40, 400, 4000 eklersiniz. Üstelik tek bir sunucunun çökmesi kapasitenin yalnızca 1/N'ini götürür — yüksek erişilebilirlik bedavaya gelir. Küçük, ucuz, sıradan (commodity) donanım kullanabilirsiniz; bulutta "pay-as-you-go" ile talep düşünce sunucuları kapatırsınız.

Bedeli ise mimari karmaşıklıktır. Yatay ölçeklemenin **ön koşulları**:

| Ön koşul | Neden? | Çözüm (sonraki dersler) |
|---|---|---|
| Trafiği dağıtacak bir bileşen | Kullanıcı hangi sunucuya gideceğini bilemez | Load balancer (a-05) |
| **Stateless** servis | İstek herhangi bir sunucuya düşebilmeli | Oturumu dışarı taşı: Redis, JWT (a-04) |
| Paylaşımlı veri katmanı | N sunucu aynı veriyi görmeli | Merkezi DB, dağıtık cache (a-07) |
| Dağıtık konfigürasyon ve dağıtım | 40 sunucuyu elle güncelleyemezsiniz | CI/CD, container orchestration (F modülü) |
| Gözlemlenebilirlik | Hata 40 makineden hangisinde? | Merkezi log, metrik, tracing (a-13) |

### Karşılaştırma

| | **Dikey (scale up)** | **Yatay (scale out)** |
|---|---|---|
| Kod değişikliği | Yok | Stateless yapılmalı |
| Tavan | Donanımın en büyüğü | Pratikte yok |
| Erişilebilirlik | SPOF | N-1 dayanıklılık |
| Maliyet eğrisi | Üstel (premium donanım) | Yaklaşık doğrusal |
| Veri tutarlılığı | Kolay (tek makine) | Zor (dağıtık) |
| Yükseltme | Genelde downtime | Rolling, sıfır downtime |
| Esneklik | Yavaş (makine değişimi) | Dakikalar içinde ekle/çıkar |
| Uygun olduğu yer | DB primary, bellek içi işler, erken aşama | Web/API katmanı, worker'lar, cache |

:::callout{tone="warning" title="Amdahl yasası: her şey yatay ölçeklenmez"}
Bir isteğin %10'u paylaşımlı bir kaynakta (tek bir veritabanı satırı, global bir kilit, tek bir kuyruk) sırayla işlenmek zorundaysa, sonsuz sunucu ekleseniz bile hızlanma en fazla **10 kat** olur. Yatay ölçekleme planlarken önce "seri kalan parça nedir?" diye sorun; genelde cevap veritabanıdır ve o da ayrı bir derstir (sharding, read replica).
:::

## Animasyon: aynı yük, iki strateji

Aşağıdaki sahne tek sunucunun doluşunu, dikey büyütmenin kısa vadeli rahatlamasını ve yatay replikaların yükü nasıl paylaştığını gösterir. Her düğümün doluluk çubuğu CPU kullanımını temsil eder.

:::animation{scene="scene.json"}
Tek sunucu %100 → dikey büyütme (geçici rahatlama, SPOF sürüyor) → yatay replikalar + load balancer (yük paylaşımı, bir replika düşse bile hizmet sürüyor).
:::

## Otomatik ölçekleme (autoscaling)

Yatay ölçeklemenin asıl gücü, sunucu sayısını talebe göre **otomatik** değiştirmektir. Tipik bir politika:

- **Metrik**: ortalama CPU, istek/saniye/sunucu, kuyruk uzunluğu, p99 gecikme.
- **Hedef**: "ortalama CPU %60 olsun" (target tracking). %60 seçilir çünkü %80'den sonra kuyruk gecikmesi patlar ve yeni sunucunun açılması 1–3 dakika sürer; o süre için pay bırakılır.
- **Sınırlar**: min 2 (yedeklilik için), max 50 (bütçe ve bağımlılıkları korumak için).
- **Cooldown**: ölçekleme sonrası 2–5 dakika bekle; aksi hâlde sistem salınır (flapping).
- **Ölçek küçültme daha yavaş**: Büyütmede agresif, küçültmede muhafazakâr olun; trafik dalgalanmasında tekrar tekrar açıp kapatmak pahalıdır.

İki tuzak: **soğuk başlangıç** (yeni sunucu JIT ısınması, cache doldurma, bağlantı havuzu kurma derken ilk dakikalarda yavaştır) ve **bağımlılıkları ezme** (web katmanı 10'dan 50'ye çıkınca veritabanına açılan bağlantı sayısı da 5 kat artar; DB bunu kaldıramazsa ölçekleme kesintiyi büyütür). Bu yüzden ölçekleme sınırı, en zayıf bağımlılığın kapasitesine göre konur.

:::interactive{type="scaling" mode="horizontal" servers=1 maxServers=8 trafficRps=400 autoscale=false}
Trafik kaydırıcısını yükseltip tek sunucunun CPU'sunu %100'ün üstüne çıkarın. Soldaki dikey panelde makine boyutunu büyütün: gecikme düşer ama 2XL'de "donanım tavanı" uyarısına dayanırsınız ve maliyet doğrusal artmaz. Sağdaki yatay panelde "+" ile replika ekleyin: aynı trafik daha ucuza ve tek hata noktası olmadan taşınır. "Otomatik ölçekleme" kutusunu işaretleyin: hedef %70 kullanımda replika sayısı trafiğe göre her saniye bir adım değişir; "Trafik dalgası" düğmesiyle yükü dalgalandırıp replika sayısının yükü ne kadar gecikmeyle izlediğini gözlemleyin.
:::

:::code{lang="ts" title="Basit bir target-tracking autoscaler döngüsü"}
```ts
interface ScalingPolicy {
  targetCpu: number;      // ör. 0.6 → %60 hedef
  min: number;            // en az replika (yedeklilik için ≥ 2)
  max: number;            // bağımlılıkları korumak için üst sınır
  cooldownMs: number;     // iki ölçekleme kararı arası bekleme
  scaleInFactor: number;  // küçültmede temkinli ol: 0.5 → hesaplananın yarısı kadar azalt
}

interface Fleet {
  replicas: number;
  avgCpu(): Promise<number>;          // 0..1, son 1 dakikanın ortalaması
  setReplicas(n: number): Promise<void>;
}

export async function autoscaleTick(fleet: Fleet, p: ScalingPolicy, state: { lastChangeAt: number }) {
  const now = Date.now();
  if (now - state.lastChangeAt < p.cooldownMs) return;           // salınımı engelle

  const cpu = await fleet.avgCpu();
  // Hedef CPU'ya ulaşmak için gereken replika sayısı: mevcut yük / hedef doluluk
  const desiredRaw = Math.ceil(fleet.replicas * (cpu / p.targetCpu));
  let desired = Math.min(p.max, Math.max(p.min, desiredRaw));

  if (desired < fleet.replicas) {
    // Küçültme: hesaplanan farkın yalnızca bir kısmını uygula
    const delta = Math.ceil((fleet.replicas - desired) * p.scaleInFactor);
    desired = Math.max(p.min, fleet.replicas - delta);
  }

  if (desired !== fleet.replicas) {
    await fleet.setReplicas(desired);                            // yeni replikalar ısınana kadar LB'ye alınmaz (readiness)
    state.lastChangeAt = now;
  }
}
```
```python
import math, time

def autoscale_tick(fleet, policy, state):
    now = time.time()
    if now - state["last_change_at"] < policy["cooldown_s"]:
        return                                   # cooldown: salınımı engelle
    cpu = fleet.avg_cpu()                        # 0..1
    desired = math.ceil(fleet.replicas * (cpu / policy["target_cpu"]))
    desired = min(policy["max"], max(policy["min"], desired))
    if desired < fleet.replicas:                 # küçültmede temkinli ol
        delta = math.ceil((fleet.replicas - desired) * policy["scale_in_factor"])
        desired = max(policy["min"], fleet.replicas - delta)
    if desired != fleet.replicas:
        fleet.set_replicas(desired)
        state["last_change_at"] = now
```
:::

## Kapasite planlaması: kaç sunucu?

Mülakatta "kaç sunucu gerekir?" sorusuna zarf hesabıyla cevap verin:

1. **Zirve trafik**: Günlük 100 M istek → ortalama ~1.160 RPS; zirve genelde ortalamanın 2–3 katı → **~3.500 RPS**.
2. **Sunucu başına kapasite**: Yük testi ile ölçün. Diyelim bir sunucu %60 CPU'da 500 RPS kaldırıyor.
3. **Gereken**: 3.500 / 500 = 7 sunucu.
4. **Yedeklilik (N+1 / N+2)** ve bölge dağılımı: 3 availability zone'a yayıp birinin tamamen düşmesini tolere etmek için 7 × 1,5 ≈ **11 sunucu**.

Bu hesap, ölçeklemenin yalnızca web katmanıyla bitmediğini de gösterir: 11 sunucu × 20 DB bağlantısı = 220 bağlantı; veritabanınız bunu kaldırıyor mu?

:::realworld{company="Netflix"}
Netflix, akşam saatlerinde (prime time) ile sabah arasında trafiğinde birkaç katlık fark yaşar ve bunun için AWS üzerinde **öngörücü (predictive) autoscaling** kullanır: geçmiş günlerin trafiğinden akşam zirvesini önceden kestirip sunucuları zirveden *önce* açar, çünkü reaktif ölçekleme ancak yük geldikten sonra tepki verir ve soğuk başlangıç süresi kullanıcıya yansır. Mikroservislerin neredeyse tamamı stateless'tır ve "immutable" imajlardan dakikalar içinde yüzlerce kopya hâlinde açılır. Netflix ayrıca **Chaos Monkey** ile üretimde rastgele sunucu kapatır; amaç, yatay ölçeklenmiş her servisin "N−1 ile de çalışır" iddiasını sürekli test etmektir. Buna karşılık, veritabanı katmanında (Cassandra, EVCache) ölçekleme ayrı yönetilir; web katmanını 3 kat büyütmek, veri katmanını otomatik büyütmez.
:::

:::callout{tone="tip" title="Mülakat ipuçları"}
- "Önce dikey, sonra yatay" söylemek olgunluk gösterir: erken aşamada dağıtık sistem kurmayın; tavana yaklaşınca yatay geçin.
- Yatay ölçekleme dediğiniz an mülakatçı **stateless mi?** ve **veritabanı ne olacak?** diye soracaktır; cevaplarınızı hazırlayın (sonraki dersler).
- Autoscaling'i anlatırken metrik, hedef, min/max ve cooldown'ı sayın; "CPU %60" rakamının neden %90 olmadığını açıklayın (kuyruk gecikmesi + açılış süresi).
- Zarf hesabında zirve/ortalama oranını ve N+1 yedekliliği unutmayın.
:::

:::quiz{src="quiz.json"}
:::

:::next{lesson="a-04-stateless-stateful-sessions"}
Sırada: yatay ölçeklemenin bir numaralı ön koşulu — durumu sunucudan çıkarmak. Stateless servisler ve oturum yönetimi.
:::

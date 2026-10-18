---
id: g-07-production-ai-systems
slug: production-ai-systems
module: g-artificial-intelligence
order: 7
title:
  tr: "Üretimde AI Sistem Tasarımı: Öneri, Arama Sıralaması, Fraud"
  en: "Production AI System Design: Recommendations, Search Ranking, Fraud"
summary:
  tr: Amazon öneri sistemi örneğiyle ölçekli mimari.
  en: Scaled architecture using Amazon’s recommender as the example.
durationMinutes: 35
level: advanced
tags: [recommendation-system, search-ranking, fraud-detection, two-tower, feature-store, latency-budget, system-design]
prerequisites: [g-06-mlops, a-07-caching, a-09-message-queues-event-driven]
concepts: [candidate-generation, ranking, re-ranking, two-tower-model, approximate-nearest-neighbor, learning-to-rank, real-time-features, latency-budget, fallback, fraud-scoring, cold-start]
---

## Kavram: model değil, huni tasarlıyoruz

Mülakatta "Amazon'un ana sayfa önerilerini tasarla" dendiğinde cevap bir algoritma adı değildir. Cevap, **yüz milyonlarca ürünü 100 ms içinde 20 öneriye indiren bir huni** ve onu besleyen veri akışıdır. Aynı huni deseni üç büyük üretim AI probleminde tekrar eder: öneri, arama sıralaması ve fraud. Hepsinde aynı kısıtlar vardır: sıkı gecikme bütçesi, saniyede on binlerce istek, sürekli değişen veri ve "model cevap veremezse ne göstereceğiz?" sorusu.

:::diagram{src="diagram.svg" alt="Üç üretim AI sistemi yan yana: öneri hunisi (milyonlarca ürün → 500 aday → 20 öneri), arama sıralaması (sorgu → geri getirme → learning to rank), gerçek zamanlı fraud skorlama (işlem → özellikler → model → karar, 50 ms)|Three production AI systems side by side: recommendation funnel (millions of items → 500 candidates → 20 recommendations), search ranking (query → retrieval → learning to rank), real-time fraud scoring (transaction → features → model → decision, 50 ms)"}
Üç sistem de "ucuz ve geniş → pahalı ve dar" huni desenini ve gerçek zamanlı özellik akışını paylaşır.
:::

## Öneri sistemi: Amazon örneği

### Neden tek aşama yetmez?

Katalogda 300 milyon ürün var. En iyi sıralama modeli ürün başına 1 ms harcasa bile tek kullanıcı için 300 000 saniye gerekir. Çözüm, maliyeti kademelendirmektir:

| Aşama | Girdi → çıktı | Model | Bütçe |
|---|---|---|---|
| **Candidate generation** (aday üretimi) | 300M → ~500 | Two-tower + ANN araması, birlikte-satın-alma grafiği, popülerlik | ~15 ms |
| **Ranking** (sıralama) | 500 → 500 skor | GBDT ya da derin ağ; yüzlerce özellik, çapraz etkileşimler | ~30 ms |
| **Re-ranking** (yeniden sıralama) | 500 → 20 | Çeşitlilik, iş kuralları, stok, tazelik, keşif dilimi | ~5 ms |

Her aşama bir sonrakinin pahalı modelini küçük bir kümede çalıştırmasını sağlar. Birden fazla aday kaynağı paralel çalışır ve birleştirilir: "son baktıklarına benzer", "bunu alanlar şunu da aldı", "bölgende trend".

### Two-tower model

Kullanıcı kulesi kullanıcı özelliklerini (geçmiş tıklamalar, kategori ilgileri) bir vektöre, ürün kulesi ürün özelliklerini (başlık gömmesi, kategori, fiyat bandı) başka bir vektöre çevirir; eğitim, etkileşimde bulunan çiftlerin nokta çarpımını yüksek, rastgele çiftleri (negative sampling) düşük yapmayı hedefler. Kritik kazanç: iki kule **ayrı hesaplanabilir**. Ürün vektörleri gece batch olarak çıkarılıp bir **ANN indeksine** (HNSW, ScaNN, FAISS) yazılır; istek anında yalnızca kullanıcı vektörü hesaplanır (ya da önbellekten gelir) ve indeks milisaniyede en yakın 500 ürünü döner. Bu, "milyonlardan yüzlere" adımının sırrıdır.

### Ranking modeli ve özellikler

Sıralayıcı, aday başına yüzlerce özellik görür: kullanıcı (yaş segmenti, son 7 gün harcama), ürün (CTR, puan, fiyat), **çapraz** (kullanıcının bu kategoriden alma oranı, bu ürünü sepetten çıkarmış mı) ve **bağlam** (cihaz, saat, kampanya dönemi). Özellikler üç kaynaktan gelir:

- **Batch özellikler**: gece hesaplanır, online store'a yazılır (ürün CTR'si).
- **Gerçek zamanlı özellikler**: tıklama olayı Kafka'ya düşer, Flink işi "son 10 dakikada baktığı kategoriler"i günceller — oturum içi niyet buradan gelir.
- **İstek anı özellikleri**: cihaz, konum, sayfa türü.

Hedef, iş metriğinden türetilir: tıklama değil **satın alma olasılığı × marj** gibi birleşik bir değer. Eğitim verisi **gösterim loglarından** gelir: ne gösterildi, hangi konumda, ne tıklandı. Konum yanlılığı (üstteki her zaman daha çok tıklanır) özellik olarak modele verilir ve çıkarımda sabitlenir.

### Gecikme bütçesi

Sayfa p99'da 200 ms'de dönmek zorundaysa öneri bileşenine 100 ms kalır. Aşağıdaki animasyon tek bir isteğin huniden geçişini zaman damgalarıyla gösterir.

:::animation{scene="scene.json"}
Tek bir ana sayfa isteği: aday üretimi (ANN), toplu özellik getirme, sıralama, yeniden sıralama ve 70 ms'de yanıt; tıklama olayı gerçek zamanlı özellikleri günceller.
:::

:::interactive{type="request-journey" budgetMs=100 stages="gateway:5,candidate-gen:15,feature-fetch:10,ranking:30,re-rank:5" slowService="none" slowPenaltyMs=50}
İsteği gönderin: beş aşama 100 ms'lik gecikme bütçesinin içinde kalıyor mu? "Yavaş katman" olarak feature-fetch'i seçin (+50 ms → 60 ms) ve tekrar gönderin: bütçe aşılır ve fallback (popüler ürünler) devreye girer — gerçek sistemde zaman aşımına uğrayan aşama budur. Yavaş katmanı ranking'e taşıyıp aynı soruyu sorun; RTT'yi artırıp ağın bütçeden ne kadar yediğine bakın. "20 istek" ile ortalama ve p95'i bütçeyle karşılaştırın: ortalaması bütçede kalan bir sistemin p95'i aşıyorsa kullanıcıların bir kısmı fallback görür.
:::

:::callout{tone="warning" title="Fallback olmadan model yoktur"}
Feature store yavaşladı, ANN indeksi yeniden yükleniyor, sıralama servisi 5xx dönüyor — kullanıcı boş bir sayfa görmemeli. Her aşamanın zaman aşımı ve yedeği olur: özellik gelmezse varsayılan değer, sıralayıcı gelmezse aday skoru, adaylar gelmezse önbellekteki son liste ya da bölgesel popüler ürünler. Kalite düşer, sayfa yüklenir. Bu, `a-06` dersindeki circuit breaker'ın ML'deki karşılığıdır.
:::

## Arama sıralaması: learning to rank

Arama, öneriye çok benzer bir hunidir; fark, girdinin açık bir **sorgu** olmasıdır:

1. **Sorgu anlama**: yazım düzeltme, eşanlamlı genişletme, niyet sınıflandırma ("iphone kılıf" → aksesuar kategorisi), sorgu gömmesi.
2. **Geri getirme**: ters indeks (BM25) + vektör araması (anlamsal eşleşme) hibrit; binlerce aday.
3. **Learning to Rank (LTR)**: sorgu–belge çifti başına özellikler (BM25 skoru, başlıkta eşleşme, ürün CTR'si, fiyat, stok) ile eğitilmiş model. Kayıp fonksiyonları: **pointwise** (her belgeye ilgililik tahmini), **pairwise** (A, B'den üstte mi — RankNet, LambdaRank), **listwise** (tüm listenin NDCG'sini doğrudan optimize et — LambdaMART). Üretimde LambdaMART (GBDT) hâlâ en yaygın tercihtir; derin modeller (BERT cross-encoder) yalnızca ilk 50–100 için yeniden sıralamada kullanılır çünkü sorgu-belge çiftini birlikte işlemek pahalıdır.
4. **Değerlendirme**: çevrimdışı NDCG@10, MRR; çevrimiçi tıklama konumu, "sonuçsuz arama" oranı, satın alma dönüşümü ve A/B testi.

Etiketler iki kaynaktan gelir: insan değerlendiriciler (küçük, kaliteli) ve tıklama logları (büyük, yanlı). Tıklama logları konum yanlılığı için düzeltilir (inverse propensity weighting).

## Fraud tespiti: gerçek zamanlı skorlama

Ödeme onayı akışında modelin **50 ms** içinde karar vermesi gerekir; kart ağı zaman aşımı ve kullanıcı deneyimi daha fazlasına izin vermez. Tasarım:

- **Özellikler**: işlem anı (tutar, ülke, cihaz parmak izi), gerçek zamanlı toplamlar (bu kartla son 1 saatte kaç deneme, bu cihazdan son 24 saatte kaç farklı kart — Flink/Redis sayaçları), grafik özellikleri (bu e-posta daha önce şüpheli hesaplarla paylaşılan bir adres kullandı mı), geçmiş davranış (kullanıcının olağan harcama profili).
- **Model**: gecikme ve açıklanabilirlik için GBDT yaygın; büyük işlemcilerde derin ağ + GBDT birleşimi. Skor eşiği iş kararıdır: yanlış pozitif (iyi müşteriyi reddetmek) ile yanlış negatif (dolandırıcılık kaybı) maliyetleri eşitlenene kadar ayarlanır.
- **Üç yollu karar**: onayla / reddet / ek doğrulamaya gönder (3-D Secure, SMS). Orta bölge kullanıcıyı kaybetmeden riski düşürür.
- **Gecikmeli etiket**: ters ibraz (chargeback) 30–90 gün sonra gelir; model performansı ancak o zaman tam ölçülür. Bu arada manuel inceleme ekibinin kararları ara etiket olarak kullanılır.
- **Düşmanca ortam**: dolandırıcılar modele uyum sağlar → concept drift sürekli; haftalık yeniden eğitim ve kural motoru (anında yeni taktiklere yama) birlikte çalışır.

:::code{lang="ts" title="İki aşamalı öneri servisi: gecikme bütçesi, paralel aday kaynakları ve fallback"}
```ts
interface Candidate { itemId: string; source: string; score: number }
interface RankedItem { itemId: string; score: number; reason: string }

interface Deps {
  userEmbedding(userId: string): Promise<number[]>;                 // önbellekli, gece batch
  annSearch(vec: number[], k: number): Promise<Candidate[]>;        // HNSW/ScaNN indeksi
  coPurchase(userId: string, k: number): Promise<Candidate[]>;      // "bunu alanlar şunu da aldı"
  features(userId: string, itemIds: string[]): Promise<Map<string, number[]>>; // online feature store, toplu
  rank(userId: string, feats: Map<string, number[]>): Promise<Map<string, number>>; // model sunucusu
  popularFallback(region: string): Promise<RankedItem[]>;           // bölgesel popüler, önbellekte
  seen(userId: string): Promise<Set<string>>;                       // son 30 günde satın alınanlar
}

/** Promise'e üst sınır koy; süre aşılırsa yedek değeri dön (hata fırlatma, sayfa yüklenmeli). */
function withTimeout<T>(p: Promise<T>, ms: number, fallback: T): Promise<T> {
  return Promise.race([p, new Promise<T>((res) => setTimeout(() => res(fallback), ms))]);
}

export async function recommend(deps: Deps, userId: string, region: string, n = 20): Promise<RankedItem[]> {
  const t0 = Date.now();

  // 1) Aday üretimi: kaynaklar paralel, her biri kendi bütçesinde (15 ms)
  const vec = await withTimeout(deps.userEmbedding(userId), 5, [] as number[]);
  const [annCands, coCands, seen] = await Promise.all([
    vec.length ? withTimeout(deps.annSearch(vec, 300), 15, [] as Candidate[]) : Promise.resolve([] as Candidate[]),
    withTimeout(deps.coPurchase(userId, 200), 15, [] as Candidate[]),
    withTimeout(deps.seen(userId), 10, new Set<string>()),
  ]);
  const candidates = dedupe([...annCands, ...coCands]).filter((c) => !seen.has(c.itemId));
  if (candidates.length === 0) return deps.popularFallback(region);     // soğuk başlangıç ya da kesinti

  // 2) Özellik getirme (toplu, 10 ms) + 3) sıralama (30 ms); başarısızsa aday skorlarıyla devam
  const itemIds = candidates.map((c) => c.itemId);
  const feats = await withTimeout(deps.features(userId, itemIds), 10, new Map<string, number[]>());
  const scores = feats.size
    ? await withTimeout(deps.rank(userId, feats), 30, new Map<string, number>())
    : new Map<string, number>();

  const ranked: RankedItem[] = candidates.map((c) => ({
    itemId: c.itemId,
    score: scores.get(c.itemId) ?? c.score * 0.5,                       // sıralayıcı yoksa aday skoru (indirgenmiş)
    reason: c.source,
  }));

  // 4) Yeniden sıralama: çeşitlilik (aynı kategoriden en çok 3) + %5 keşif dilimi
  const final = diversify(ranked.sort((a, b) => b.score - a.score), n);
  if (Date.now() - t0 > 100) console.warn('rec budget exceeded', { userId, ms: Date.now() - t0 }); // SLO ihlali metriği
  return final;
}

function dedupe(cands: Candidate[]): Candidate[] {
  const best = new Map<string, Candidate>();
  for (const c of cands) if (!best.has(c.itemId) || best.get(c.itemId)!.score < c.score) best.set(c.itemId, c);
  return [...best.values()];
}

function diversify(items: RankedItem[], n: number, maxPerSource = 8): RankedItem[] {
  const perSource = new Map<string, number>();
  const out: RankedItem[] = [];
  for (const it of items) {
    const k = perSource.get(it.reason) ?? 0;
    if (k >= maxPerSource) continue;                                   // tek kaynağın listeyi ele geçirmesini önle
    perSource.set(it.reason, k + 1);
    out.push(it);
    if (out.length === n) break;
  }
  return out;
}
```
:::

## Üç sistemi birleştiren ilkeler

1. **Huni**: ucuz ve geniş modeller önce, pahalı ve dar modeller sonra.
2. **Önceden hesapla**: ürün vektörleri, popüler listeler, kullanıcı gömmeleri batch; istek anında yalnızca kaçınılmaz olan.
3. **Özellik tazeliği katmanlı**: batch (gün) + stream (saniye) + istek anı (ms).
4. **Bütçe ve fallback**: her aşamaya zaman aşımı, her zaman aşımına bir yedek.
5. **Log her şeyi**: gösterim, konum, skor, model sürümü — yarının eğitim verisi ve bugünün hata ayıklaması.
6. **Çevrimiçi ölç**: çevrimdışı metrik eleme içindir; kararı A/B verir.

:::realworld{company="Amazon"}
Amazon'un 2003'te yayımladığı *item-to-item collaborative filtering* makalesi "bunu alanlar şunu da aldı"nın temelidir ve hâlâ önemli bir aday kaynağıdır: ürün-ürün benzerlik tablosu çevrimdışı hesaplanır, istek anında yalnızca bir arama yapılır — ölçeklenebilirliğin sırrı buydu. Bugünkü sistem çok aşamalıdır: iki kuleli derin modeller ANN indeksleriyle adayları üretir, derin sıralama modelleri oturum içi sinyalleri (son dakikalarda bakılan ürünler, Kinesis/Flink ile güncellenen özellikler) kullanır ve yeniden sıralama katmanı stok, teslimat hızı (Prime uygunluğu) ve çeşitlilik kurallarını uygular. Ana sayfa onlarca "widget"tan oluşur ve her widget'ın kendi öneri çağrısı, kendi gecikme bütçesi ve kendi fallback'i vardır; biri zaman aşımına uğrarsa sayfa o widget olmadan yüklenir. Amazon arama tarafında da benzer biçimde çalışır: sözcüksel eşleşme ve anlamsal eşleşme birlikte aday üretir, LTR modeli satın alma olasılığını optimize eder. Fraud'da ise Amazon Pay ve pazar yeri için gerçek zamanlı grafik tabanlı özellikler (paylaşılan cihaz, adres, ödeme yöntemi ilişkileri) GBDT ve derin modelleri besler; kararların çoğu 100 ms'nin altında verilir ve şüpheli ama kesin olmayanlar ek doğrulamaya yönlendirilir.
:::

:::callout{tone="tip" title="Mülakat yol haritası (öneri sistemi için 45 dakika)"}
1. Gereksinimler: ölçek (DAU, katalog), gecikme (p99), hedef metrik (satın alma mı izleme süresi mi), tazelik ihtiyacı.
2. Yüksek seviye: huni (aday → sıralama → yeniden sıralama), çevrimdışı/çevrimiçi ayrımı, feature store, olay akışı.
3. Derinleşme: two-tower + ANN; sıralama özellikleri; konum yanlılığı; soğuk başlangıç (yeni kullanıcı → popüler/demografik, yeni ürün → içerik özellikleri + keşif dilimi).
4. Operasyon: bütçe/fallback, A/B, drift, geri bildirim döngüsü, günlükleme.
5. Takaslar: tazelik vs. maliyet, çeşitlilik vs. doğruluk, kişiselleştirme vs. gizlilik.
:::

:::quiz{src="quiz.json"}
:::

:::next{lesson="g-08-nn-playground"}
Sırada: teoriyi elinize alın — tarayıcıda TensorFlow.js ile küçük bir sinir ağı eğitip ağırlıkların epoch'lar boyunca değişimini izleyin.
:::

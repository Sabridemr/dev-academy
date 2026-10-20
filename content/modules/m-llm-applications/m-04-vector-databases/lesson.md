---
id: m-04-vector-databases
slug: vector-databases
module: m-llm-applications
order: 4
title:
  tr: "Vektör Veritabanları ve Benzerlik Araması"
  en: "Vector Databases and Similarity Search"
summary:
  tr: "Gömme uzayı, kosinüs benzerliği, HNSW ve IVF indeksleri, hibrit arama ve filtreleme."
  en: "Embedding space, cosine similarity, HNSW and IVF indexes, hybrid search and filtering."
durationMinutes: 30
level: advanced
tags: [llm, vector-database, embedding, ann, hnsw, search]
prerequisites: [g-05-llms, m-03-rag-pipeline]
concepts: [embedding-space, cosine-similarity, ann, hnsw, ivf, quantization, recall-at-k, metadata-filtering, hybrid-search]
---

## Kavram: anlamla arama yapan bir indeks

Klasik bir veritabanı indeksi "bu değere eşit olan" ya da "bu aralıkta kalan" satırları bulmak için tasarlanmıştır. B-ağacı sıralı anahtarlarda, ters indeks (inverted index) kelimelerde mükemmel çalışır. RAG'ın sorusu ise farklıdır: "bu cümleye **anlamca en yakın** bin parça hangileri?" Burada eşitlik yoktur, aralık yoktur; yüzlerce boyutlu bir uzayda bir noktaya en yakın komşuları bulmak vardır. **Vektör veritabanı**, bu soruyu milyonlarca vektör üzerinde milisaniyeler içinde cevaplamak için özelleşmiş bir indeks ve sorgu motorudur.

Önceki derste vektör veritabanını RAG hattındaki bir kutu olarak gördük. Bu derste kutunun içini açacağız: benzerlik nasıl ölçülür, neden her vektörü tek tek karşılaştırmak ölçeklenmez, HNSW ve IVF gibi indeksler hangi ödünleşimi yapar ve gerçek uygulamalarda neden saf vektör araması tek başına yetmez.

## Gömme uzayı ve benzerlik ölçüleri

Bir gömme modeli metni sabit uzunlukta bir sayı dizisine, yani bir vektöre çevirir. Model öyle eğitilmiştir ki anlamca benzer metinler uzayda birbirine yakın düşer. "Kargom nerede?" ile "Siparişimin teslimat durumu" birbirine yakın, "Şifremi unuttum" ise uzak bir noktadadır. Boyut sayısı modele göre değişir; birkaç yüzden birkaç bine kadar çıkabilir.

"Yakınlık" üç yaygın ölçüyle hesaplanır:

| Ölçü | Formül (sezgisel) | Ne zaman? |
|---|---|---|
| **Kosinüs benzerliği** | İki vektör arasındaki açının kosinüsü; uzunluğa bakmaz | Metin gömmelerinde varsayılan tercih |
| **İç çarpım (dot product)** | Açı ve uzunluğun birleşimi | Vektörler normalize edilmişse kosinüsle aynı sıralamayı verir, daha ucuzdur |
| **Öklid (L2) mesafesi** | Noktalar arası düz çizgi uzunluğu | Normalize vektörlerde kosinüsle aynı sıralamayı verir |

Pratikte en önemli kural şudur: gömme modelinin önerdiği ölçüyü kullanın ve vektörleri normalize ederek saklayın. Normalize edilmiş vektörlerde üç ölçü de aynı komşu sıralamasını verir ve iç çarpım en hızlı hesaplanandır. Bir başka kritik kural da tutarlılıktır: belgeler ve sorgular aynı modelle, aynı sürümle gömülmelidir. Bazı modeller sorgu ve belge için farklı önekler ("query:" / "passage:") ister; bunu atlamak isabeti sessizce düşürür.

:::interactive{type="embedding-space" dimensions=2 showNeighbors=true}
Bir kelimeye tıklayıp kosinüs benzerliğine göre en yakın komşularını görün; aynı kümedeki kelimelerin skorları ile farklı kümelerdekilerin skorlarını karşılaştırın. Başlangıçtaki 2B izdüşümde üst üste binen noktaları "Döndür" ve "Eğ" kaydırıcılarıyla ya da sürükleyerek ayırın: ekranda yakın görünen iki nokta tam vektörlerde uzak olabilir. Vektör aritmetiği kutusunda bir üçlü deneyip sonucun hangi kelimeye en yakın düştüğüne bakın.
:::

Bu oyun alanı birkaç boyutlu bir uzayı gösterir; gerçek gömmeler yüzlerce boyutludur ve sezgimiz orada yanıltıcı olabilir. Yüksek boyutta noktaların çoğu birbirine benzer uzaklıklarda durur; bu yüzden mutlak bir benzerlik eşiği (ör. "0,8'in üstü alakalıdır") modele ve veriye göre değişir. Eşiği sabit kodlamak yerine kendi değerlendirme setinizle ayarlayın.

## Neden kaba kuvvet yetmez?

En basit yöntem, sorguyu dizindeki her vektörle karşılaştırıp en yüksek skorlu *k* tanesini almaktır. Buna **düz (flat) arama** denir ve sonucu kesindir. Sorun ölçektir: 10 milyon parça ve 1 024 boyut, her sorguda yaklaşık 10 milyar çarpma–toplama işlemi ve 40 GB'lık bir veri taraması demektir. Saniyede yüzlerce sorgu gelen bir sistemde bu kabul edilemez.

Çözüm **yaklaşık en yakın komşu (ANN, approximate nearest neighbor)** aramasıdır: kesin cevaptan küçük bir miktar feragat edip aramayı büyüklük mertebeleriyle hızlandırmak. ANN'in kalitesi **recall@k** ile ölçülür: düz aramanın bulacağı gerçek ilk *k* komşunun ne kadarının ANN sonucunda da bulunduğu. Recall@10 = 0,95, gerçek ilk 10 komşunun ortalama 9,5'inin bulunduğu anlamına gelir.

## HNSW: katmanlı komşuluk grafiği

**HNSW (Hierarchical Navigable Small World)** bugün en yaygın ANN indeksidir. Her vektör bir grafın düğümüdür ve en yakın birkaç komşusuna kenarla bağlıdır. Graf katmanlıdır: üst katmanlarda az sayıda düğüm ve uzun atlamalar, alt katmanlarda tüm düğümler ve kısa, yerel bağlantılar vardır. Arama en üst katmanda bir giriş noktasından başlar, her adımda sorguya daha yakın bir komşuya geçer, daha fazla yaklaşamayınca bir alt katmana iner ve en alt katmanda aday listesini genişleterek sonuçlanır. Bu, bir şehirde önce otoyolla doğru semte, sonra ara sokaklarla doğru kapıya gitmeye benzer.

HNSW'nin iki önemli ayarı vardır. Kurulumda her düğümün bağlantı sayısı (`M`) grafın yoğunluğunu ve bellek kullanımını belirler. Sorguda ise aday listesinin genişliği (`ef_search`) recall ile gecikme arasındaki dengeyi kurar: büyük değer daha çok düğüm ziyaret eder, recall artar, gecikme de artar. HNSW'nin güçlü yanı yüksek recall ile düşük gecikmeyi birlikte vermesi ve yeni vektör eklemeyi desteklemesidir; zayıf yanı bellek tüketimi ve silmelerin grafı zamanla bozabilmesidir.

:::diagram{src="diagram.svg" alt="Solda HNSW: üç katmanlı komşuluk grafiği ve üst katmandan alta inen arama yolu; sağda IVF: vektör uzayı kümelere bölünmüş, sorgu yalnızca en yakın birkaç kümede aranıyor|Left, HNSW: a three-layer neighbourhood graph and the search path descending from the top layer; right, IVF: the vector space split into clusters, the query searching only the nearest few clusters"}
HNSW grafta atlayarak, IVF uzayı kümelere bölerek aranacak vektör sayısını küçültür.
:::

## IVF ve nicemleme

**IVF (Inverted File Index)** farklı bir strateji izler: vektör uzayını k-means ile örneğin birkaç bin kümeye böler ve her vektörü en yakın küme merkezine atar. Sorgu geldiğinde önce en yakın birkaç küme (`nprobe`) seçilir, arama yalnızca o kümelerdeki vektörlerde yapılır. `nprobe` büyüdükçe recall artar, hız düşer. IVF'nin kurulumu bir eğitim adımı gerektirir ve veri dağılımı zamanla değişirse kümeler yeniden eğitilmelidir.

Bellek darboğazı için **nicemleme (quantization)** kullanılır. Her bir 32 bitlik sayıyı 8 bite indirmek (skaler nicemleme) belleği dörtte birine düşürür; **ürün nicemlemesi (PQ)** vektörü alt parçalara bölüp her parçayı küçük bir kod kitabındaki en yakın girdiyle temsil eder ve çok daha büyük sıkıştırma sağlar. Bedeli doğruluktur; yaygın çözüm, sıkıştırılmış vektörlerle aday bulup ilk birkaç yüz adayı tam vektörlerle yeniden puanlamaktır.

| İndeks | Recall | Sorgu hızı | Bellek | Not |
|---|---|---|---|---|
| Düz (flat) | %100 | Yavaş (doğrusal) | Tam vektör | Küçük veri ve doğrulama için |
| HNSW | Çok yüksek | Çok hızlı | Yüksek (graf + vektör) | Genel amaçlı varsayılan |
| IVF | Yüksek (`nprobe`'a bağlı) | Hızlı | Orta | Eğitim adımı gerekir |
| IVF + PQ | Orta–yüksek | Hızlı | Çok düşük | Milyarlarca vektörde |

## Filtreleme: anlamsal arama + koşul

Gerçek sorgular neredeyse hiçbir zaman saf benzerlik değildir: "bu kiracının belgeleri içinde", "son bir yılın faturalarında", "kullanıcının erişim yetkisi olan klasörlerde". **Meta veri filtrelemesi** iki biçimde yapılabilir. **Sonradan filtreleme (post-filtering)** önce en yakın *k* vektörü bulup sonra koşula uymayanları atar; filtre seçiciyse elinizde hiç sonuç kalmayabilir. **Önceden filtreleme (pre-filtering)** aramayı yalnızca koşula uyan vektörler içinde yapar; doğru sonucu verir ama ANN indeksinin yapısıyla iyi uyuşması gerekir. Modern vektör veritabanlarının çoğu filtreyi grafik ya da küme taraması sırasında uygulayan karma yöntemler sunar. Bir motor seçerken kendi filtre seçiciliğinizle recall'u mutlaka ölçün; yüzde birlik bir kiracı filtresi bazı yapılandırmalarda recall'u çarpıcı biçimde düşürebilir.

## Hibrit arama

Vektör araması anlamı yakalar ama tam eşleşmede zayıftır. "ERR-4012 hatası" sorgusunun gömmesi, başka hata kodlarını içeren belgelere de yakın düşer; anahtar kelime araması (BM25) ise tam o kodu içeren belgeyi en üste koyar. **Hibrit arama** iki sonucu birleştirir. Skorlar farklı ölçeklerde olduğu için doğrudan toplanmaz; yaygın yöntem **Reciprocal Rank Fusion (RRF)**: her belgenin her listedeki sırasına göre `1 / (k + sıra)` puanı verilir ve puanlar toplanır. RRF basittir, ayar gerektirmez ve çoğu durumda iki yöntemden de daha iyi sonuç verir.

:::code{lang="python" title="Hibrit arama: BM25 ve vektör sonuçlarını RRF ile birleştirmek"}
```python
from collections import defaultdict

def rrf(result_lists: list[list[str]], k: int = 60, top: int = 5) -> list[tuple[str, float]]:
    """Her liste, belge kimliklerinin en iyiden kötüye sırasıdır. k sabiti üst sıraların baskınlığını yumuşatır."""
    scores: dict[str, float] = defaultdict(float)
    for results in result_lists:
        for rank, doc_id in enumerate(results, start=1):
            scores[doc_id] += 1.0 / (k + rank)
    return sorted(scores.items(), key=lambda kv: kv[1], reverse=True)[:top]

def hybrid_search(query: str, keyword_index, vector_index, tenant_id: str, n: int = 20):
    flt = {"tenant_id": tenant_id}                         # yetki filtresi her iki aramada da
    lexical = keyword_index.search(query, filter=flt, limit=n)        # BM25
    semantic = vector_index.search(query, filter=flt, limit=n)        # ANN (HNSW)
    return rrf([[h.id for h in lexical], [h.id for h in semantic]])

# "ERR-4012" gibi bir kod: BM25 listesinde 1. sırada, vektör listesinde 7. sırada olsa bile
# 1/61 + 1/67 ≈ 0.0313 ile yalnızca bir listede 1. olan belgeyi (1/61 ≈ 0.0164) geçer.
```
```ts
export function rrf(lists: string[][], k = 60, top = 5): [string, number][] {
  const scores = new Map<string, number>();
  for (const list of lists) {
    list.forEach((id, i) => scores.set(id, (scores.get(id) ?? 0) + 1 / (k + i + 1)));
  }
  return [...scores.entries()].sort((a, b) => b[1] - a[1]).slice(0, top);
}
```
:::

## Ayrı bir vektör veritabanına ihtiyacınız var mı?

Vektör araması artık birçok genel amaçlı veritabanında bir özellik olarak bulunur: PostgreSQL için pgvector eklentisi HNSW ve IVF indekslerini destekler, arama motorları ve birçok belge veritabanı da vektör alanı sunar. Birkaç milyon vektöre kadar, verinizin zaten durduğu veritabanında vektör araması yapmak çoğu zaman en iyi başlangıçtır: tek bir yedekleme ve erişim modeli, işlemsel tutarlılık ve meta veri filtrelerini SQL ile yazabilme. Yüz milyonlarca vektör, çok yüksek sorgu hacmi ya da özel nicemleme ihtiyacı olduğunda adanmış bir vektör veritabanı anlam kazanır. Karar verirken soyut hız karşılaştırmalarına değil, kendi verinizle ölçtüğünüz recall@k, p95 gecikme ve aylık maliyete bakın.

:::realworld{company="Spotify"}
Spotify, müzik önerilerinde milyonlarca şarkı ve kullanıcı vektörü arasında en yakın komşu araması yapar. Şirket bu ihtiyaç için 2013'te Annoy adlı açık kaynak ANN kütüphanesini yayımlamıştı; Annoy, uzayı rastgele hiper düzlemlerle bölen ağaçlar kurar ve indeksi diskten belleğe eşlenebilen dosyalar olarak saklar. 2023'te ise HNSW tabanlı Voyager kütüphanesini açık kaynak olarak duyurdu ve Annoy'a göre aynı doğrulukta belirgin biçimde daha hızlı ve daha az bellek kullanan aramalar elde ettiğini açıkladı. Bu geçiş, sektörün ağaç tabanlı yöntemlerden graf tabanlı HNSW'ye kayışının somut bir örneğidir.
:::

:::callout{tone="warning" title="Gömme modelini değiştirmek dizini geçersiz kılar"}
Farklı modellerin, hatta aynı modelin farklı sürümlerinin vektörleri karşılaştırılamaz. Model güncellemesi tüm dizinin yeniden gömülmesi demektir; her vektörle birlikte model adını ve sürümünü saklayın ve geçişi paralel dizinle yapın.
:::

:::callout{tone="tip" title="Mülakat özeti"}
- Normalize vektörlerde kosinüs, iç çarpım ve L2 aynı sıralamayı verir.
- ANN = biraz recall'dan feragat edip büyük hız kazanmak; HNSW'de `ef_search`, IVF'de `nprobe` bu dengeyi ayarlar.
- Gerçek sorgular filtre ister; tam eşleşme için BM25'i vektörle RRF üzerinden birleştirin.
:::

:::quiz{src="quiz.json"}
:::

:::next{lesson="m-05-evaluation"}
Sırada: bu ayarların hepsini neyle ölçeceğiz? Altın veri seti, LLM-as-judge ve RAG metrikleriyle değerlendirme.
:::

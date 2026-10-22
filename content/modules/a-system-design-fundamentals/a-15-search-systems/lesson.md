---
id: a-15-search-systems
slug: search-systems
module: a-system-design-fundamentals
order: 15
title:
  tr: "Arama Sistemleri: Ters İndeks ve Sıralama"
  en: "Search Systems: Inverted Index and Ranking"
summary:
  tr: Ters indeks, tokenizasyon ve stemming, TF-IDF ve BM25, facet, Elasticsearch/OpenSearch shard ve replica mimarisi, PostgreSQL full-text ne zaman yeter.
  en: Inverted index, tokenization and stemming, TF-IDF and BM25, facets, Elasticsearch/OpenSearch shard and replica architecture, when PostgreSQL full-text is enough.
durationMinutes: 30
level: intermediate
tags: [search, inverted-index, bm25, elasticsearch, opensearch, postgresql, full-text]
prerequisites: [a-07-caching, a-11-consistent-hashing-sharding, a-12-replication]
concepts: [inverted-index, tokenization, stemming, tf-idf, bm25, facets, search-shards, near-real-time-search, postgres-full-text]
---

## Kavram: "içinde geçen" belgeyi bulmak

Bir e-ticaret sitesinde kullanıcı arama kutusuna "kırmızı koşu ayakkabısı" yazıyor. Veritabanının klasik yolu `WHERE description LIKE '%koşu%'` gibi bir sorgudur: her satırı baştan sona okur, B-tree indeksini kullanamaz (joker baştadır), "koşu" ile "koşucu" ya da "Koşu" arasındaki ilişkiyi bilmez ve sonuçları önem sırasına koyamaz. Milyonlarca üründe bu hem yavaş hem de kullanışsızdır.

Arama sistemleri problemi tersinden çözer. Belgeyi okuyup kelimeleri aramak yerine, belgeler **yazılırken** her kelimenin hangi belgelerde geçtiğini önceden kaydederler. Bu yapıya **ters indeks (inverted index)** denir: kitabın sonundaki dizin gibi, "kelime → bu kelimenin geçtiği belgeler" eşlemesidir. Sorgu anında yalnızca aranan kelimelerin listelerine bakılır; belgelerin kendisi okunmaz.

## Analyzer: metinden terimlere

Ters indekse girecek "kelimeleri" üreten bileşene **analyzer** denir. Tipik bir analyzer üç adımdan oluşur:

1. **Tokenizasyon:** Metin boşluk ve noktalama işaretlerinden parçalanır: `"Redis ile önbellek stratejileri"` → `[Redis, ile, önbellek, stratejileri]`.
2. **Normalizasyon:** Küçük harfe çevirme, aksan katlama ve **stopword** ("ve", "ile", "bir" gibi neredeyse her belgede geçen kelimeler) temizliği.
3. **Stemming / lemmatizasyon:** Kelimeyi köküne indirme: `stratejileri` → `strateji`, `koşucular` → `koşucu`. Türkçe gibi eklemeli dillerde bu adım arama kalitesini en çok etkileyen adımdır; aynı kök onlarca farklı ekle karşımıza çıkar.

Altın kural: **sorgu da aynı analyzer'dan geçmelidir.** Belgeyi kök hâlinde indeksleyip sorguyu ham hâliyle ararsanız "stratejileri" kelimesi `strateji` terimini asla bulamaz. Türkçe özelinde bir tuzak daha vardır: büyük `I` harfinin küçüğü Türkçede `ı`, İngilizcede `i`'dir. Yanlış dil ayarıyla "IŞIK" araması "ışık" belgesini kaçırabilir; Elasticsearch'ün `turkish` analyzer'ı bu yüzden Türkçeye özel bir küçük harf filtresi kullanır.

:::diagram{src="diagram.svg" alt="Belgelerin analyzer'dan geçip ters indekse yazılması ve sorgunun posting listeleriyle eşleşmesi; altta shard ve replica dağılımı|Documents passing through an analyzer into an inverted index and a query matching posting lists; shard and replica layout below"}
Üst yarı: yazma yolu (belge → analyzer → terim → posting listesi) ve okuma yolu (sorgu → aynı analyzer → posting listelerinin kesişimi → skor). Alt yarı: indeksin üç primary shard ve onların replikalarına dağıtılması.
:::

:::predict{id="arama-skor-sirasi"}
Üç belge var: (1) "Redis önbellek stratejileri", (2) "PostgreSQL indeks, sorgu planı ve önbellek ayarları", (3) "Redis kuyruk ile arka plan işleri". Kullanıcı "redis önbellek" arıyor. En üstte hangi belge çıkar? | Three documents: (1) "Redis cache strategies", (2) "PostgreSQL index, query plan and cache settings", (3) "Background jobs with a Redis queue". The user searches for "redis cache". Which document ranks first?
- [x] Belge 1, çünkü iki terimi birden içeriyor | Document 1, because it contains both terms
- [ ] Belge 3, çünkü "Redis" ile başlıyor | Document 3, because it starts with "Redis"
- [ ] Belge 2, çünkü en uzun belge | Document 2, because it is the longest
- [ ] Üçü eşit skor alır, sıra rastgeledir | All three score equally, order is random
Açıklama: Ters indekste `redis` → [1, 3] ve `önbellek` → [1, 2] listeleri bulunur. Belge 1 iki listede de geçtiği için iki terimin katkısını birden alır. Belge 2 ve 3 tek terimle eşleşir; aralarındaki farkı BM25'in uzunluk normalizasyonu belirler: kısa belgedeki eşleşme daha değerli sayıldığı için uzun belge 2 geride kalır. | The inverted index holds `redis` → [1, 3] and `cache` → [1, 2]. Document 1 is in both lists so it gets both terms' contribution. Documents 2 and 3 match one term each; BM25's length normalisation separates them: a match in a shorter document counts for more, so the longer document 2 falls behind.
:::

:::animation{scene="scene.json"}
Üç belge analyzer'dan geçip ters indekse yazılır; "redis önbellek" sorgusu aynı analyzer'dan geçer, posting listeleri okunur, BM25 ile skorlanır ve facet sayımlarıyla döner.
:::

## Relevance: TF-IDF'ten BM25'e

Eşleşen belgeleri bulmak işin yarısıdır; asıl değer **sıralamadadır**. Klasik fikir **TF-IDF**'tir:

- **TF (term frequency):** Terim belgede kaç kez geçiyor? Çok geçiyorsa belge muhtemelen o konudadır.
- **IDF (inverse document frequency):** Terim kaç belgede geçiyor? "ve" her yerde geçtiği için ayırt edici değildir; "BM25" ise az belgede geçtiği için değerlidir. Kabaca `log(N / df)` ile hesaplanır.

**BM25** bu fikri iki pratik düzeltmeyle geliştirir. Birincisi **doygunluk**: bir terimin 20. kez geçmesi 2. kez geçmesi kadar değerli değildir; `k1` parametresi (Lucene'de varsayılan 1.2) TF katkısının ne kadar çabuk doyacağını belirler. Böylece bir kelimeyi yüz kez tekrar eden "anahtar kelime doldurma" sayfaları ödüllendirilmez. İkincisi **uzunluk normalizasyonu**: on kelimelik bir başlıkta geçen terim, on bin kelimelik bir belgede geçen aynı terimden daha anlamlıdır; `b` parametresi (varsayılan 0.75) bu etkinin gücünü ayarlar. Elasticsearch 5.0'dan bu yana varsayılan benzerlik ölçüsü BM25'tir.

Gerçek ürünlerde BM25 skoru tek başına kullanılmaz; popülerlik, stok durumu, kişiselleştirme ve tazelik gibi sinyallerle birleştirilir. Büyük şirketlerde ilk aşamada BM25 ile birkaç yüz aday seçilip ikinci aşamada makine öğrenmesi modeliyle yeniden sıralanması (**learning to rank**) yaygın bir desendir.

## Facet: aramanın yan paneli

"Marka: Nike (124), Adidas (98)", "Fiyat: 0–500 TL (61)" gibi filtre sayıları **facet** (Elasticsearch dilinde *aggregation*) ile üretilir. Facet, eşleşen belge kümesi üzerinde alan değerlerini sayar. Bunun için ters indeksin tersine, "belge → alan değeri" yönünde sütun tabanlı bir yapı (Lucene'de *doc values*) kullanılır. Facet'ler pahalıdır: milyonlarca eşleşmede her sorguda yeniden sayılır; bu yüzden yüksek kardinaliteli alanlarda (ör. ürün kimliği) facet açılmaz ve popüler sorguların sonuçları cache'lenir.

## Elasticsearch/OpenSearch mimarisi: shard ve replica

Tek bir makinenin diskine ve CPU'suna sığmayan indeks **shard**'lara bölünür; her shard kendi başına tam bir Lucene indeksidir. Belgeler, kimliklerinin hash'ine göre bir primary shard'a yönlendirilir ([consistent hashing ve sharding](/lessons/a-11-consistent-hashing-sharding) dersindeki fikrin aynısı). Her primary shard'ın bir ya da daha fazla **replica**'sı farklı düğümlerde tutulur: hem düğüm kaybında veri korunur hem de okuma trafiği replikalara yayılır.

Bir arama sorgusu **scatter-gather** ile çalışır. Koordinatör düğüm sorguyu her shard'ın bir kopyasına gönderir (*query* aşaması), her shard yerel en iyi *k* sonucu ve skorları döner, koordinatör bunları birleştirip gerçek ilk *k*'yı seçer ve yalnızca bu belgelerin içeriğini getirir (*fetch* aşaması). Bunun önemli bir sonucu vardır: sorgunun gecikmesini **en yavaş shard** belirler. Primary shard sayısı indeks oluşturulurken belirlenir ve sonradan değiştirmek yeniden indeksleme ister; bu yüzden kapasite tahmini baştan yapılır.

İki işletim detayı daha bilinmelidir. Lucene segmentleri değiştirilemez (immutable) olduğu için yeni belgeler önce bellekte toplanır ve **refresh** ile (Elasticsearch'te varsayılan olarak saniyede bir) aranabilir hâle gelir: arama **neredeyse gerçek zamanlıdır**, anında değil. Ayrıca arama indeksi bir **türetilmiş veridir**: doğruluğun kaynağı veritabanıdır ve indeks olaylarla (outbox, CDC; bkz. [mesaj kuyrukları](/lessons/a-09-message-queues-event-driven)) beslenir. Şema değişikliğinde yeni bir indeks oluşturulur, arka planda doldurulur ve bir **alias** tek hamlede yeni indekse çevrilir.

:::interactive{type="request-journey" stages="client,search-api,results-cache,query-analyzer:3,shard-scatter-gather:20,bm25-scoring:8,facet-agg:10" slowService="none" cacheHitRate=40}
Bir arama sorgusunun API'den sonuç cache'ine, analyzer'a, shard'lara dağıtılmasına (scatter-gather), BM25 skorlamasına ve facet sayımına kadar geçen yolunu şelalede izleyin. "Cache hit" kutusunu işaretleyip tekrar gönderin: popüler bir sorgu cache'ten döner ve shard'lara hiç gitmez. "Yavaş katman" seçiminde `shard-scatter-gather`'ı seçin: tek bir yavaş shard bütün sorguyu bekletir, çünkü koordinatör tüm shard'ların cevabını bekler. Ardından "20 istek" ile cache hit oranını %40'tan %80'e çıkarıp ortalama ve p95'in nasıl değiştiğini karşılaştırın.
:::

## PostgreSQL full-text ne zaman yeter?

Her arama ihtiyacı için ayrı bir küme kurmak gerekmez. PostgreSQL metni `tsvector` olarak saklar, sorguyu `tsquery`'ye çevirir, **GIN** indeksiyle ters indeksin aynısını sunar ve `ts_rank` ile basit bir sıralama yapar. Bu projenin araması tam olarak böyle çalışıyor: ders metni üzerinde `to_tsvector('simple', …)` GIN indeksi var, sonuçlar `ts_rank` ile sıralanıyor ve `ts_headline` ile eşleşen parça vurgulanıyor; hiç sonuç yoksa `ILIKE` alt dize araması yedek olarak devreye giriyor. `'simple'` sözlüğü kök bulma yapmaz, tam kelime eşleştirir; Türkçe ekler için bu bilinçli bir sadelik tercihidir ve alt dize yedeği eksikliği kısmen kapatır.

PostgreSQL full-text şu durumlarda yeterlidir: veri tek bir veritabanına sığıyorsa, arama ana iş akışının küçük bir parçasıysa, ayrı bir sistemi senkron tutma maliyetinden kaçınmak istiyorsanız ve sıralama kalitesi "kabul edilebilir" düzeydeyse. Yazım hatası toleransı, eşanlamlılar, gelişmiş facet'ler, BM25 benzeri ayarlanabilir sıralama ve yatay ölçek gerektiğinde ise Elasticsearch/OpenSearch gibi özel bir arama motoru gerekir.

:::realworld{company="Airbnb"}
Airbnb mühendisleri *Applying Deep Learning to Airbnb Search* (KDD 2019) makalesinde arama sıralamasının evrimini anlatır: elle ayarlanmış skorlama fonksiyonlarından gradient boosted ağaç modellerine, oradan sinir ağlarına geçiş. Makalenin değerli yanı başarı hikâyelerinden çok başarısız denemeleri dürüstçe aktarmasıdır: karmaşık mimarilerle başlamak yerine basit modellerle başlayıp özellik (feature) mühendisliğine ve doğru değerlendirme metriklerine yatırım yapmanın daha çok işe yaradığını yazarlar. Buradaki mimari ders genel geçerdir: aday kümesini ucuz bir geri getirme (retrieval) aşaması üretir, pahalı model yalnızca bu küçük küme üzerinde yeniden sıralama yapar. Elastic'in mühendislik blogundaki *Practical BM25* serisi de aynı resmin ilk yarısını, yani BM25'in `k1` ve `b` parametrelerinin skoru nasıl şekillendirdiğini örneklerle açıklar.
:::

:::callout{tone="warning" title="Arama indeksi doğruluğun kaynağı değildir"}
Siparişi, stoğu ya da fiyatı yalnızca arama indeksine yazmayın. İndeks gecikmeli (refresh), türetilmiş ve yeniden oluşturulabilir bir kopyadır. Kullanıcı "satın al" dediğinde fiyat ve stok her zaman veritabanından yeniden okunmalıdır.
:::

:::callout{tone="tip" title="Mülakat özeti"}
- "Arama kutusu" duyduğunuzda ters indeks, analyzer (aynısı sorguda da) ve BM25 üçlüsünü söyleyin.
- Yazma yolunu unutmayın: DB → olay/CDC → indeksleyici → arama kümesi; refresh gecikmesi kabul edilebilir mi?
- Ölçek: shard sayısı baştan seçilir, replica okuma kapasitesi ve dayanıklılık verir, en yavaş shard p99'u belirler.
:::

:::quiz{src="quiz.json"}
:::

:::resources
- [Introduction to Information Retrieval](https://nlp.stanford.edu/IR-book/) — kitap — Manning, Raghavan, Schütze; ters indeks ve skorlama
- [PostgreSQL: Full Text Search](https://www.postgresql.org/docs/current/textsearch.html) — belge — tsvector, tsquery, GIN ve ts_rank
- [Practical BM25 – Part 2: The BM25 Algorithm and its Variables](https://www.elastic.co/blog/practical-bm25-part-2-the-bm25-algorithm-and-its-variables) — blog — Elastic; k1 ve b
- [Applying Deep Learning To Airbnb Search](https://arxiv.org/abs/1810.09591) — bildiri — Airbnb arama sıralamasının evrimi
:::

:::next{lesson="a-16-background-jobs-scheduling"}
Sırada: arka plan işleri ve zamanlanmış görevler. Kuyruk işçileri, idempotent işler, retry/backoff/DLQ ve cron işlerinin birden fazla replikada tek kez çalışması.
:::

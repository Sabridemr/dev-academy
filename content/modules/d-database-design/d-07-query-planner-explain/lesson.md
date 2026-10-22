---
id: d-07-query-planner-explain
slug: query-planner-explain
module: d-database-design
order: 7
title:
  tr: "Sorgu Planlayıcı ve EXPLAIN Okuma: Tarama, Join Yöntemleri, İstatistikler"
  en: "The Query Planner and Reading EXPLAIN: Scans, Join Methods, Statistics"
summary:
  tr: Planlayıcının maliyet tahminini, tarama ve join seçimlerini EXPLAIN çıktısından okuyun; yavaş sorgu kalıplarını düzeltin.
  en: Read the planner's cost estimates, scan and join choices from EXPLAIN output; fix common slow-query patterns.
durationMinutes: 35
level: advanced
tags: [database, postgresql, query-plan, explain, performance, join]
prerequisites: [d-02-indexing]
concepts: [query-planner, cost-model, seq-scan, bitmap-scan, nested-loop-join, hash-join, merge-join, table-statistics, analyze, expression-index]
---

## Kavram: SQL "ne" der, planlayıcı "nasıl"ı seçer

SQL bildirimseldir: `SELECT ... WHERE ... JOIN ...` yazarken veritabanına hangi satırları istediğinizi söylersiniz, onları **nasıl** bulacağını söylemezsiniz. Aradaki boşluğu **sorgu planlayıcı** (planner/optimizer) doldurur. PostgreSQL bir sorguyu aldığında önce ayrıştırır, sonra olası yürütme yollarını (hangi tabloyu hangi yöntemle tarayacağı, tabloları hangi sırayla ve hangi algoritmayla birleştireceği) üretir, her birine bir **maliyet** biçer ve en ucuzunu yürütücüye (executor) verir.

d-02'de indeksin bir planı nasıl değiştirdiğini gördük. Bu derste bir adım geri çekilip planlayıcının kendisine bakıyoruz: maliyeti neye göre hesaplıyor, tahminleri nereden geliyor, üç join yöntemi arasında nasıl seçiyor ve en önemlisi, yanlış seçtiğinde bunu `EXPLAIN` çıktısından nasıl fark ederiz.

:::diagram{src="diagram.svg" alt="EXPLAIN plan ağacının anatomisi: kökte Limit, altında Sort, onun altında Hash Join; Hash Join'in solunda Seq Scan, sağında Hash ve altında Bitmap Heap Scan ile Bitmap Index Scan; her düğümde cost, rows ve actual alanları|Anatomy of an EXPLAIN plan tree: Limit at the root, Sort below, then a Hash Join with a Seq Scan on one side and a Hash over a Bitmap Heap Scan and Bitmap Index Scan on the other; each node shows cost, rows and actual fields"}
Plan bir ağaçtır ve **içten dışa** okunur: yapraklar tabloları tarar, üst düğümler satırları birleştirir, sıralar, sınırlar. Her düğüm kendi alt ağacının toplam maliyetini taşır.
:::

## Maliyet modeli: birimler sayfa okumasıdır

Planlayıcının maliyet birimi milisaniye değildir; **bir sayfayı sıralı okumanın** maliyeti 1 kabul edilir ve diğer her şey buna göre ölçeklenir. Varsayılan ayarlar:

| Parametre | Varsayılan | Anlamı |
|---|---|---|
| `seq_page_cost` | 1.0 | Sıralı sayfa okuma |
| `random_page_cost` | 4.0 | Rastgele sayfa okuma (indeksten heap'e atlama) |
| `cpu_tuple_cost` | 0.01 | Bir satırı işleme |
| `cpu_index_tuple_cost` | 0.005 | Bir indeks girdisini işleme |
| `cpu_operator_cost` | 0.0025 | Bir operatörü/fonksiyonu çalıştırma |

Basit bir sıralı taramanın maliyeti kabaca `sayfa_sayısı × 1.0 + satır_sayısı × 0.01` artı filtre başına operatör maliyetidir. İndeksli yolun maliyeti ise "kaç satır döneceği" tahminine bağlıdır: çok satır dönecekse her biri için rastgele heap okuması (4.0) birikir ve sıralı tarama ucuzlar. `random_page_cost = 4` dönen disklerin dünyasından kalma bir varsayımdır; tüm veri SSD'de ya da bellekteyse bu değeri 1.1–2 arasına çekmek indeksli planları daha sık seçtirir. Bu bir ayardır, bir sihir değil: önce ölçün.

`EXPLAIN` çıktısındaki `cost=0.42..8.61` iki sayıdır: ilk satırı üretmeden önceki **başlangıç maliyeti** ve tüm satırları üretmenin **toplam maliyeti**. `Sort` gibi düğümlerin başlangıç maliyeti yüksektir (her şeyi okumadan ilk satırı veremez); `LIMIT 10` bu yüzden sıralama gerektirmeyen bir indeksle dramatik biçimde hızlanır.

## Tarama yöntemleri: dört yol

- **Seq Scan**: tablonun tüm sayfalarını sırayla okur, her satıra filtreyi uygular. Küçük tablolarda ve satırların büyük bölümünü döndüren sorgularda en iyi plandır.
- **Index Scan**: indeks ağacında iner, eşleşen her girdi için heap'e gidip satırı okur. Az satır dönen seçici sorgular için idealdir.
- **Index Only Scan**: gereken her sütun indeksteyse heap'e gitmez (d-02'deki covering index).
- **Bitmap Index Scan + Bitmap Heap Scan**: indeksten eşleşen satır adreslerini toplar, bunları **sayfa sırasına** dizen bir bit eşlemi kurar, sonra heap'i fiziksel sırayla bir kez gezer. "Ne çok az ne çok fazla" satır dönen sorgularda ve birden fazla indeksin `BitmapAnd`/`BitmapOr` ile birleştirilmesinde kullanılır. Bit eşlemi `work_mem`'e sığmazsa satır yerine sayfa düzeyine iner (lossy) ve her satır yeniden kontrol edilir: plandaki `Recheck Cond` satırı bunu anlatır.

Bu projenin kendi arama servisi iyi bir örnek. `backend/src/modules/search/search.service.ts` dersleri `to_tsvector('simple', "searchText") @@ plainto_tsquery('simple', $1)` koşuluyla arar ve `20261018062400_search_index` migration'ı tam olarak bu ifade üzerine bir **GIN indeksi** kurar. GIN indeksleri PostgreSQL'de yalnızca bitmap taramasıyla kullanılabilir; tablo büyüdükçe plan `Bitmap Index Scan on "Lesson_searchText_fts_idx"` → `Bitmap Heap Scan on "Lesson"` şeklinde görünür. Ders sayısı az olduğu sürece planlayıcının indeksi hiç kullanmayıp `Seq Scan` seçmesi ise hata değil, doğru karardır: birkaç sayfalık tabloyu baştan sona okumak, indekse gidip gelmekten ucuzdur.

:::predict{id="kucuk-tablo-seq-scan"}
Arama tablosunda yalnızca birkaç yüz satır var ve doğru GIN indeksi tanımlı. `EXPLAIN` çıktısında yine de `Seq Scan on "Lesson"` görüyorsunuz. En olası açıklama hangisi? | The search table has only a few hundred rows and the right GIN index exists. Yet `EXPLAIN` shows `Seq Scan on "Lesson"`. What is the most likely explanation?
- [ ] İndeks bozulmuş; `REINDEX` gerekir | The index is corrupt; it needs `REINDEX`
- [x] Tablo birkaç sayfa olduğundan planlayıcı tam taramayı daha ucuz hesapladı | The table spans a few pages, so the planner costed the full scan as cheaper
- [ ] PostgreSQL full-text aramada indeks kullanamaz | PostgreSQL cannot use indexes for full-text search
- [ ] `plainto_tsquery` indeksi devre dışı bırakır | `plainto_tsquery` disables the index
Açıklama: Maliyet modeli sayfa okumalarını sayar. Tablo birkaç sayfaysa tüm sayfaları sırayla okumak, indeks + heap gidiş gelişinden ucuzdur ve planlayıcı haklı olarak `Seq Scan` seçer. Tablo büyüyünce aynı sorgu, değişiklik yapmadan bitmap taramasına geçer. | The cost model counts page reads. If the table is a few pages, reading them all sequentially is cheaper than index plus heap round trips, and the planner rightly picks `Seq Scan`. As the table grows, the same query switches to a bitmap scan with no change.
:::

Aşağıdaki animasyon aynı arama sorgusunun iki yürütmesini adım adım gösterir: önce indeks yokken sıralı tarama, sonra GIN indeksiyle bitmap taraması; planlayıcının ikisine biçtiği maliyetler ve istatistiklerin rolü dahil.

:::animation{scene="scene.json"}
Planlayıcı istatistiklerden satır tahmini yapar, iki planı fiyatlar; indekssiz plan tüm heap sayfalarını okur, GIN indeksli plan bit eşlemi kurup yalnızca ilgili sayfalara gider.
:::

## İstatistikler ve ANALYZE: tahminler nereden gelir?

Planlayıcı her sütun için `pg_statistic`'te (okunabilir hâli `pg_stats` görünümü) bir özet tutar: boş değer oranı, farklı değer sayısı (`n_distinct`), en sık değerler ve sıklıkları (`most_common_vals`), geri kalanlar için eşit yükseklikli histogram ve fiziksel sıra ile mantıksal sıra arasındaki korelasyon. Bu özetleri `ANALYZE` üretir; autovacuum belli oranda satır değiştiğinde onu otomatik çalıştırır.

Tahmin bozulunca plan bozulur. En tipik üç neden:

1. **Toplu yükleme sonrası bayat istatistik**: milyonlarca satır eklediniz, autoanalyze henüz çalışmadı; planlayıcı tabloyu hâlâ küçük sanıyor. Çözüm: yüklemeden sonra elle `ANALYZE tablo`.
2. **İlişkili sütunlar**: `city = 'İzmir' AND postal_code LIKE '35%'` koşulunda planlayıcı iki koşulu bağımsız sayar ve seçicilikleri çarpar; gerçek satır sayısının çok altında tahmin eder. PostgreSQL 10+ ile `CREATE STATISTICS ... (dependencies) ON city, postal_code FROM addresses` bu bağımlılığı öğretir.
3. **Çarpık dağılım**: bir müşteri siparişlerin yarısına sahipse ortalama tahmin yanıltır; `ALTER TABLE ... ALTER COLUMN ... SET STATISTICS 1000` daha ayrıntılı histogram toplar.

Teşhis kuralı basittir: `EXPLAIN ANALYZE` çıktısında bir düğümün tahmini `rows` değeri ile `actual rows` değeri arasında 10 kattan büyük fark varsa, o düğümün üstündeki her karar (join yöntemi, join sırası) yanlış temele oturmuş olabilir. Ayrıca `loops=N` gören her düğümde gerçek satır ve süre **döngü başına** verilir; toplamı bulmak için N ile çarpın. İç içe döngünün iç tarafındaki 0.05 ms'lik bir tarama, 40.000 döngüde iki saniye eder.

## Join yöntemleri: üç algoritma

| Yöntem | Nasıl çalışır? | Ne zaman iyi? | Zayıf yanı |
|---|---|---|---|
| **Nested Loop** | Dış taraftaki her satır için iç tarafı arar (çoğunlukla indeksle) | Dış taraf küçük, iç tarafta join sütununda indeks var | Dış taraf büyürse N × arama maliyeti patlar |
| **Hash Join** | Küçük girdiden bellekte hash tablosu kurar (build), büyük girdiyi tarayıp her satırı tabloda arar (probe) | İki büyük girdi, eşitlik koşulu, indeks yok | Yalnızca `=`; hash tablosu `work_mem`'e sığmazsa diske taşan parçalar (batch) |
| **Merge Join** | İki girdiyi join anahtarına göre sıralı okuyup fermuar gibi birleştirir | Girdiler zaten sıralı (indeks ya da önceki sort) ve büyük | Sıralı değilse önce sort maliyeti |

Hash join'in iki evresi, planda `Hash` düğümünün altında duran küçük tablo (build) ve `Hash Join` düğümünün diğer kolunda duran büyük tablo (probe) olarak görünür. `EXPLAIN ANALYZE` çıktısında `Buckets: 1024  Batches: 1  Memory Usage: 40kB` satırı tablonun belleğe sığdığını söyler; `Batches` 1'den büyükse veri diske taşmıştır ve `work_mem` ya da sorgunun kendisi gözden geçirilmelidir.

:::animation{scene="hash-join.scene.json"}
Hash join: küçük tablodan bellekte hash tablosu kurulur (build), büyük tablo satır satır taranıp tabloda aranır (probe); tablo work_mem'e sığmazsa batch'ler diske taşar.
:::

:::interactive{type="index-query-plan" rows=1000000 query="customer_id = 42"}
Bu kez indeksin varlığına değil planlayıcının **maliyet karşılaştırmasına** odaklanın. "Eşitlik: customer_id = 42" sorgusunda önce "İndeks yok", sonra "B-tree (customer_id)" seçip "Seq Scan maliyeti" ile "İndeks maliyeti" kutularını karşılaştırın. Ardından "Aralık: created_at 100–130" sorgusuna "B-tree (created_at)" ile geçin: iki maliyet birbirine çok yaklaşır, çünkü dönen satır sayısı arttıkça rastgele heap okumaları birikir. Son olarak "İkinci kolon: status = paid" sorgusunu "Bileşik (status, customer_id)" indeksiyle çalıştırın: indeks kullanılabilir olduğu hâlde planlayıcı Seq Scan seçer, çünkü sorgu tablonun büyük kısmını döndürür. "Seçilen kolonlar" ayarını "Yalnızca indeksli kolonlar" yapınca heap okuması ortadan kalkar ve plan Index Only Scan'e döner.
:::

## Yaygın yavaş sorgu kalıpları ve düzeltmeleri

| Belirti (planda) | Kalıp | Düzeltme |
|---|---|---|
| İndeksli sütunda `Seq Scan` + `Filter: (lower(email) = ...)` | Sütun bir fonksiyonun içinde | Aynı ifade üzerine indeks: `CREATE INDEX ON users (lower(email))` |
| Arama indeksi kullanılmıyor | İndeks `to_tsvector('simple', ...)` ile kurulu, sorgu farklı sözlük ya da tek argümanlı `to_tsvector(...)` kullanıyor | Sorgudaki ifade indeksteki ifadeyle **birebir** aynı olmalı |
| `LIKE '%kelime%'` için `Seq Scan` | Baştaki joker B-tree'yi işe yaramaz kılar | `pg_trgm` eklentisi ve `gin_trgm_ops` indeksi ya da full-text arama |
| Derin sayfada yavaşlayan liste | `OFFSET 100000 LIMIT 20` önceki tüm satırları üretip atar | Keyset sayfalama: `WHERE (created_at, id) < ($1, $2) ORDER BY created_at DESC, id DESC LIMIT 20` |
| Tahmin 1, gerçek 50.000; üstünde Nested Loop | Bayat ya da ilişkili sütun istatistiği | `ANALYZE`, `CREATE STATISTICS`, gerekirse histogram hedefini büyütmek |
| `Sort Method: external merge  Disk: ...` | Sıralama `work_mem`'e sığmıyor | `ORDER BY` sütunlarına uygun indeks ya da oturum bazında `work_mem` |
| `NOT IN (SELECT ...)` beklenmedik boş sonuç ya da yavaşlık | Alt sorguda NULL varsa `NOT IN` hiçbir satır döndürmez; planlayıcı da anti-join'e çeviremez | `NOT EXISTS` kullanın |

Bu projede arama servisi, full-text sorgusu sonuç bulamazsa `ILIKE '%...%'` yedeğine düşer; kodda bunun "tam tarama" olduğu bilinçli olarak yorumlanmıştır. Tablo küçükken kabul edilebilir bir ödünleşimdir; tablo büyürse ilk düzeltme adayı bir `pg_trgm` indeksidir.

:::code{lang="sql" title="Bir planı okumak: tahmin, gerçek, döngüler ve tampon sayısı"}
```sql
-- Yürütür ve ölçer; yazma sorgularını BEGIN ... ROLLBACK içine alın
EXPLAIN (ANALYZE, BUFFERS, SETTINGS)
SELECT l."id", ts_rank(to_tsvector('simple', l."searchText"), q) AS rank
FROM "Lesson" l, plainto_tsquery('simple', 'index') q
WHERE to_tsvector('simple', l."searchText") @@ q
ORDER BY rank DESC
LIMIT 20;

-- Okuma sırası (içten dışa):
-- 1) Bitmap Index Scan on "Lesson_searchText_fts_idx"   → eşleşen satır adresleri
-- 2) Bitmap Heap Scan on "Lesson"  Recheck Cond: ...      → sayfaları fiziksel sırayla oku
-- 3) Sort  Sort Key: rank DESC  Sort Method: top-N heapsort → LIMIT sayesinde yalnızca en iyi 20 tutulur
-- 4) Limit
-- Her düğümde: (cost=başlangıç..toplam rows=TAHMİN) (actual time=.. rows=GERÇEK loops=N)

-- Tahminler bozuksa:
ANALYZE "Lesson";
SELECT attname, n_distinct, most_common_vals
FROM pg_stats WHERE tablename = 'Lesson' AND attname = 'moduleId';
```
:::

:::realworld{company="GitLab"}
GitLab, PostgreSQL üzerinde çalışan büyük bir Rails uygulamasıdır ve geliştirici belgelerinin önemli bir kısmını kamuya açık tutar. Bu belgelerdeki "Understanding EXPLAIN plans" rehberi, ekibin her veritabanı değişikliğinde beklediği okuma alışkanlığını anlatır: planı içten dışa okumak, `rows` tahminini gerçek değerle karşılaştırmak, `loops` ile çarpmayı unutmamak ve `BUFFERS` çıktısını gerçek I/O göstergesi olarak kullanmak. GitLab'ın veritabanı inceleme süreci, yeni ya da değişen sorgular için merge request'e sorgu planının eklenmesini ister. Planlar geliştiricinin dizüstündeki küçük veriyle değil, üretim verisinin klonu üzerinde çalışan bir araçla (Database Lab tabanlı, sohbet üzerinden komut alan bir bot) alınır; çünkü küçük test veritabanında planlayıcı makul olarak Seq Scan seçer ve gerçek darboğaz görünmez. Bu derste vurguladığımız ilke budur: plan, tablonun gerçek boyutuna ve istatistiklerine göre değişir.
:::

:::callout{tone="warning" title="EXPLAIN ANALYZE sorguyu gerçekten çalıştırır"}
`EXPLAIN` yalnızca planı tahmin eder; `EXPLAIN ANALYZE` sorguyu **yürütür**. `UPDATE`/`DELETE` üzerinde çalıştırırsanız veri değişir: `BEGIN; EXPLAIN ANALYZE ...; ROLLBACK;` kalıbını kullanın. Üretimde ağır bir sorguyu analiz etmek de yük bindirir; mümkünse replika ya da üretim klonu kullanın.
:::

:::callout{tone="tip" title="Mülakat özeti"}
- Yavaş sorguda ilk adım tahmin değil ölçümdür: `EXPLAIN (ANALYZE, BUFFERS)`.
- Planı içten dışa okuyun; tahmini ve gerçek satır sayısını karşılaştırın, `loops` ile çarpın.
- Küçük tabloda Seq Scan normaldir; büyük tabloda seçici sorguda Seq Scan bir belirtidir.
- Join yöntemini sorulduğunda: küçük dış taraf + indeks → nested loop; iki büyük girdi ve eşitlik → hash; sıralı girdiler → merge.
- Tahminler bozuksa `ANALYZE` ve ilişkili sütunlar için `CREATE STATISTICS`.
:::

:::quiz{src="quiz.json"}
:::

:::resources
- [PostgreSQL: Using EXPLAIN](https://www.postgresql.org/docs/current/using-explain.html) — belge — plan düğümleri, maliyet ve ANALYZE çıktısı
- [PostgreSQL: Statistics Used by the Planner](https://www.postgresql.org/docs/current/planner-stats.html) — belge — pg_stats ve genişletilmiş istatistikler
- [Use The Index, Luke](https://use-the-index-luke.com/) — kitap — Markus Winand; indeksler ve planlar üzerine ücretsiz çevrimiçi kitap
- [GitLab: Understanding EXPLAIN plans](https://docs.gitlab.com/ee/development/database/understanding_explain_plans.html) — belge — GitLab geliştirici rehberi
:::

:::next{lesson="d-08-connection-pooling-n-plus-one"}
Sırada: tek bir sorgu hızlıyken uygulamanın yine de yavaş olmasının iki nedeni — bağlantı havuzu ve N+1 sorgu.
:::

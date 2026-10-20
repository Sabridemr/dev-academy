---
id: i-06-sql-notes
slug: sql-notes
module: i-api-sql-testing
order: 6
title:
  tr: "SQL Kapsamlı Notlar"
  en: "SQL Complete Notes"
summary:
  tr: "SELECT, JOIN, GROUP BY ve window fonksiyonlarıyla veriyi sorgulamayı ve SQL mülakatlarına hazırlanmayı öğren."
  en: "Learn to query data with SELECT, JOINs, GROUP BY and window functions, and prepare for SQL interviews."
durationMinutes: 32
level: intermediate
tags: [sql, databases, relational-databases, joins, indexing, query-plan, transactions, interview-prep]
prerequisites: [d-01-relational-modeling-normalization, d-02-indexing, d-03-transactions-acid-isolation]
concepts: [relational-model, select-where-order, sql-joins, group-by-having, subqueries-cte, dml-transactions, indexes-explain, query-anti-patterns, window-functions]
---

## Kavram: tablolar, satırlar ve ilişkiler

SQL (Structured Query Language), ilişkisel veritabanına "ne istediğini" söylediğin bildirimsel bir dildir; "nasıl bulacağını" ise veritabanı motoru planlar. Bu ayrım dersin sonuna kadar karşımıza çıkacak: aynı sonucu veren iki sorgu, motorun seçtiği plana göre bin kat farklı maliyete sahip olabilir.

İlişkisel modelde her şey **tablo**dur. Tablo, aynı yapıdaki satırlardan oluşur; her sütunun bir adı ve veri tipi vardır. Satırları birbirinden ayıran sütuna **birincil anahtar (primary key)**, başka bir tablonun birincil anahtarına işaret eden sütuna **yabancı anahtar (foreign key)** denir. Bu dersteki tüm örnekler tek bir küçük e-ticaret şeması üzerinde ilerler:

- `users(id, name, city, created_at)` — müşteriler
- `products(id, name, category, price)` — ürün kataloğu
- `orders(id, customer_id, product_id, status, total_amount, created_at)` — siparişler; `customer_id` → `users.id`, `product_id` → `products.id`

Şemayı küçük tutmanın amacı şu: JOIN sonuçlarını, gruplamayı ve indeks davranışını kafanda satır satır izleyebilmen. Örnek verimiz de aynı küçüklükte:

| users.id | name | city |
|---|---|---|
| 1 | Ayşe | İstanbul |
| 2 | Mehmet | Ankara |
| 3 | Zeynep | İzmir |
| 4 | Can | Bursa |

| orders.id | customer_id | product_id | status | total_amount |
|---|---|---|---|---|
| 101 | 1 | 10 | paid | 250 |
| 102 | 1 | 11 | shipped | 120 |
| 103 | 2 | 10 | paid | 80 |
| 104 | NULL | 12 | paid | 60 |

104 numaralı sipariş bir misafir siparişi: müşteri kaydı yok, bu yüzden `customer_id` NULL. Bu tek satır, JOIN türleri arasındaki farkı görünür kılacak.

:::diagram{src="diagram.svg" alt="Solda users, products ve orders tabloları ile yabancı anahtar okları; sağda bir SELECT sorgusunun mantıksal değerlendirme sırası: FROM, JOIN, WHERE, GROUP BY, HAVING, SELECT, ORDER BY, LIMIT|On the left the users, products and orders tables with foreign key arrows; on the right the logical evaluation order of a SELECT query: FROM, JOIN, WHERE, GROUP BY, HAVING, SELECT, ORDER BY, LIMIT"}
Ders boyunca kullanılan şema ve bir sorgunun yazıldığı sırayla değil, mantıksal sırayla değerlendirilmesi.
:::

## SELECT, WHERE, ORDER BY, LIMIT

En temel sorgu dört parçadan oluşur: hangi sütunlar (`SELECT`), hangi tablo (`FROM`), hangi satırlar (`WHERE`) ve hangi sırada (`ORDER BY`). `LIMIT` ise sonucun yalnızca ilk *n* satırını ister; sayfalama ve "en pahalı 10 sipariş" gibi sorgularda vazgeçilmezdir.

:::code{lang="sql" title="Temel sorgu: İstanbul'daki müşterilerin en yeni 10'u"}
```sql
SELECT id, name, created_at
FROM users
WHERE city = 'İstanbul'
ORDER BY created_at DESC
LIMIT 10;
```
:::

Burada akılda tutulacak birkaç kural var. `WHERE` satırları **tek tek** süzer; henüz grup ya da toplam yoktur. Karşılaştırmalarda `=`, `<>`, `>`, `BETWEEN`, `IN` ve `LIKE` kullanılır; `LIKE 'A%'` ile başı A olan değerler bulunur. NULL ise hiçbir değere eşit değildir — "bilinmiyor" anlamına gelir. `WHERE customer_id = NULL` yazarsan karşılaştırma sonucu UNKNOWN olur ve hiçbir satır dönmez; doğrusu `WHERE customer_id IS NULL` biçimidir. `ORDER BY` olmadan satırların sırası **tanımsızdır**; bugün ekleme sırasında geliyor diye yarın da öyle geleceğini varsayma. `DISTINCT` yinelenen satırları teker indirir; `SELECT DISTINCT city FROM users` dört satırdan dört şehir, ama iki müşteri aynı şehirdeyse üç şehir döndürür.

Sorgunun yazım sırası ile değerlendirme sırası farklıdır. Motor önce `FROM` ve `JOIN` ile satır kaynağını kurar, `WHERE` ile süzer, `GROUP BY` ile gruplar, `HAVING` ile grupları eler, ancak ondan sonra `SELECT` listesini hesaplar, en son `ORDER BY` ve `LIMIT` uygular. Bu sıra, "SELECT'te verdiğim takma adı neden WHERE'de kullanamıyorum?" sorusunun cevabıdır: WHERE çalışırken o takma ad henüz yoktur.

## JOIN türleri: iki tabloyu birleştirmek

Normalize edilmiş şemada bilgi dağınıktır: siparişin müşteri adı `users` tablosundadır. `JOIN`, iki tablonun satırlarını bir koşula göre eşleştirip yan yana getirir. Dört temel tür, eşleşmeyen satırlara ne yapıldığıyla ayrılır.

:::code{lang="sql" title="Dört JOIN türü aynı koşulla"}
```sql
-- 1) INNER: yalnızca iki tarafta da eşleşen satırlar
SELECT u.name, o.id AS order_id, o.total_amount
FROM users u
INNER JOIN orders o ON o.customer_id = u.id;

-- 2) LEFT: soldaki (users) tüm satırlar; eşleşme yoksa sağ taraf NULL
SELECT u.name, o.id AS order_id, o.total_amount
FROM users u
LEFT JOIN orders o ON o.customer_id = u.id;

-- 3) RIGHT: sağdaki (orders) tüm satırlar; eşleşme yoksa sol taraf NULL
SELECT u.name, o.id AS order_id, o.total_amount
FROM users u
RIGHT JOIN orders o ON o.customer_id = u.id;

-- 4) FULL OUTER: iki tarafın da tüm satırları
SELECT u.name, o.id AS order_id, o.total_amount
FROM users u
FULL OUTER JOIN orders o ON o.customer_id = u.id;
```
:::

**INNER JOIN** sonucu — yalnızca müşterisi bilinen siparişler, 3 satır:

| name | order_id | total_amount |
|---|---|---|
| Ayşe | 101 | 250 |
| Ayşe | 102 | 120 |
| Mehmet | 103 | 80 |

**LEFT JOIN** sonucu — her müşteri en az bir kez görünür, siparişi olmayanlar NULL ile, 5 satır:

| name | order_id | total_amount |
|---|---|---|
| Ayşe | 101 | 250 |
| Ayşe | 102 | 120 |
| Mehmet | 103 | 80 |
| Zeynep | NULL | NULL |
| Can | NULL | NULL |

**RIGHT JOIN** sonucu — her sipariş görünür, misafir siparişinde müşteri adı NULL, 4 satır:

| name | order_id | total_amount |
|---|---|---|
| Ayşe | 101 | 250 |
| Ayşe | 102 | 120 |
| Mehmet | 103 | 80 |
| NULL | 104 | 60 |

**FULL OUTER JOIN** sonucu — ikisinin birleşimi, 6 satır: INNER'daki üç satır, Zeynep ve Can'ın NULL'lu satırları ve 104 numaralı misafir siparişi.

Pratikte en çok INNER ve LEFT kullanılır; RIGHT JOIN, tabloların yerini değiştirip LEFT yazarak elde edilebildiği için nadiren görülür. LEFT JOIN'in klasik kullanımı "hiç siparişi olmayan müşteriler" sorusudur: `LEFT JOIN ... WHERE o.id IS NULL`. Bu kalıba **anti-join** denir ve `NOT IN` alt sorgusundan genellikle daha güvenlidir, çünkü `NOT IN` listesinde tek bir NULL varsa sonuç boş döner.

:::callout{tone="warning" title="LEFT JOIN'i WHERE ile bozmak"}
`LEFT JOIN orders o ... WHERE o.status = 'paid'` yazdığında, siparişi olmayan müşterilerin satırında `o.status` NULL'dur ve WHERE koşulu onları eler; LEFT JOIN sessizce INNER JOIN'e dönüşür. Sağ tabloya ait koşulu korumak istiyorsan onu `WHERE`'e değil `ON` cümlesine taşı: `LEFT JOIN orders o ON o.customer_id = u.id AND o.status = 'paid'`.
:::

## GROUP BY, HAVING ve toplama fonksiyonları

Toplama (aggregate) fonksiyonları çok satırı tek değere indirir: `COUNT`, `SUM`, `AVG`, `MIN`, `MAX`. `GROUP BY` ise bu indirgemeyi gruplar hâlinde yapar; her grup sonuçta tek satır olur. `COUNT(*)` satırları sayar, `COUNT(sütun)` ise o sütunu NULL olmayan satırları sayar; bu ayrım misafir siparişlerinde fark yaratır.

:::code{lang="sql" title="Müşteri başına ödenmiş sipariş toplamı; 100'ün üzerindekiler"}
```sql
SELECT u.name,
       COUNT(o.id)          AS order_count,
       SUM(o.total_amount)  AS revenue,
       AVG(o.total_amount)  AS avg_basket
FROM users u
JOIN orders o ON o.customer_id = u.id
WHERE o.status = 'paid'            -- satırları gruplamadan ÖNCE süz
GROUP BY u.id, u.name
HAVING SUM(o.total_amount) > 100   -- grupları toplamdan SONRA süz
ORDER BY revenue DESC;
```
:::

`WHERE` ve `HAVING` farkı mülakatların klasiğidir: `WHERE` satırlara gruplamadan önce, `HAVING` gruplara toplamdan sonra uygulanır. `WHERE SUM(...) > 100` yazılamaz çünkü WHERE çalışırken henüz toplam yoktur. Diğer sık hata, `SELECT` listesine gruplanmayan ve toplanmayan bir sütun koymaktır; standart SQL bunu reddeder, çünkü grup içindeki hangi satırın değerinin gösterileceği belirsizdir. Kural basit: SELECT'teki her sütun ya `GROUP BY`'da olmalı ya da bir toplama fonksiyonunun içinde.

## Alt sorgular ve CTE

Bir sorgunun sonucunu başka bir sorgunun içinde kullanabilirsin. **Alt sorgu (subquery)** `WHERE` içinde tek değer ya da liste üretebilir, `FROM` içinde türetilmiş tablo olarak durabilir. **Korelasyonlu alt sorgu** dış sorgunun her satırı için yeniden çalışır; küçük tablolarda zararsız, büyük tablolarda yavaştır.

**CTE** (Common Table Expression, `WITH` cümlesi) aynı işi okunabilir biçimde yapar: ara sonuca bir ad verir, ana sorgu onu tablo gibi kullanır. Uzun raporlama sorgularında iç içe parantezler yerine adım adım CTE zinciri yazmak hem anlaşılırlık hem de hata ayıklama açısından çok daha iyidir.

:::code{lang="sql" title="Aynı soru: ortalamanın üzerinde harcayan müşteriler"}
```sql
-- Alt sorgu ile
SELECT customer_id, SUM(total_amount) AS revenue
FROM orders
WHERE status = 'paid'
GROUP BY customer_id
HAVING SUM(total_amount) > (SELECT AVG(total_amount) FROM orders WHERE status = 'paid');

-- CTE ile: adım adım okunur
WITH paid AS (
  SELECT customer_id, total_amount
  FROM orders
  WHERE status = 'paid'
),
per_customer AS (
  SELECT customer_id, SUM(total_amount) AS revenue
  FROM paid
  GROUP BY customer_id
)
SELECT pc.customer_id, u.name, pc.revenue
FROM per_customer pc
JOIN users u ON u.id = pc.customer_id
WHERE pc.revenue > (SELECT AVG(total_amount) FROM paid)
ORDER BY pc.revenue DESC;
```
:::

CTE'nin bir de **özyinelemeli** (recursive) biçimi vardır; kategori ağacı ya da organizasyon şeması gibi hiyerarşik veriyi tek sorguda dolaşmak için kullanılır. Performans tarafında dikkat: bazı motorlar CTE'yi bir kez hesaplayıp belleğe alır, bazıları ana sorgunun içine açar. Davranışı tahmin etme, `EXPLAIN` ile bak.

## INSERT, UPDATE, DELETE ve transaction

Okumak kadar yazmak da SQL'in parçasıdır. `INSERT` yeni satır ekler, `UPDATE` var olanı değiştirir, `DELETE` siler. Üçünde de `WHERE` unutulan bir `UPDATE` ya da `DELETE` **tüm tabloyu** etkiler; üretimde yazma sorgusunu çalıştırmadan önce aynı `WHERE` ile bir `SELECT COUNT(*)` yapmak ucuz bir sigortadır.

Birden fazla yazmanın ya hep ya hiç olması gerekiyorsa **transaction** kullanılır. Sipariş oluşturma tipik örnektir: sipariş satırı eklenir, stok düşülür; biri başarısız olursa diğeri de geri alınmalıdır. `BEGIN` ile başlar, `COMMIT` ile kalıcılaşır, hata olursa `ROLLBACK` ile tamamı geri alınır. Bu, veritabanı dersinde gördüğün ACID'in A'sı (atomicity) ve I'sıdır (isolation): başka bir bağlantı, yarım kalmış ara durumu görmez.

:::code{lang="sql" title="Sipariş ver + stok düş: tek transaction"}
```sql
BEGIN;

INSERT INTO orders (id, customer_id, product_id, status, total_amount, created_at)
VALUES (105, 3, 10, 'paid', 250, NOW());

UPDATE products
SET stock = stock - 1
WHERE id = 10 AND stock > 0;
-- Etkilenen satır 0 ise stok yok: uygulama ROLLBACK çağırır

COMMIT;

-- Sonradan düzeltme ve silme
UPDATE orders SET status = 'cancelled' WHERE id = 105;
DELETE FROM orders WHERE status = 'cancelled' AND created_at < NOW() - INTERVAL '1 year';
```
:::

`UPDATE ... WHERE stock > 0` kalıbı önemlidir: iki kullanıcı son ürünü aynı anda almaya çalışırsa, koşul sayesinde yalnızca biri satırı güncelleyebilir; diğeri "0 satır etkilendi" görür ve işlem geri alınır. Uygulama katmanında önce okuyup sonra yazmak yerine koşulu veritabanına bırakmak, yarış koşullarına karşı en ucuz savunmadır.

## İndeksler ve EXPLAIN

İndeks olmadan `WHERE customer_id = 42` sorgusu tablodaki **her satırı** okur; buna sıralı tarama (Seq Scan) denir ve maliyeti tablo büyüklüğüyle doğru orantılıdır. **B-tree indeksi** sütun değerlerini sıralı bir ağaçta tutar: kök sayfadan başlayıp birkaç adımda aranan değere iner, ardından yaprak düzeyinde yan yana duran eşleşmeleri okur. Bir milyon satırda bu yaklaşık üç-dört sayfa okuması demektir; sıralı taramanın binlerce sayfasıyla kıyaslayınca indeksin neden "sihir" gibi hissettirdiği anlaşılır. Aynı ağaç yapısı, sıralı olduğu için `BETWEEN` aralık sorgularında ve `ORDER BY`'da da işe yarar.

Her sorguyu indeks hızlandırmaz. **Seçicilik**, koşulun tablonun ne kadarını elediğidir: `status = 'paid'` satırların yüzde doksanını tutuyorsa planlayıcı indeksi kullanmaz, çünkü her eşleşme için ayrı sayfa sıçraması yapmak sıralı taramadan pahalıdır. Buna karşılık `customer_id = 42` birkaç satır döndürür ve indeks için idealdir.

**Bileşik indeks** birden fazla sütunu tek ağaçta tutar: `(customer_id, status)`. Ağaç önce `customer_id`'ye, eşitse `status`'e göre sıralıdır. Bu yüzden **en soldaki önek kuralı** geçerlidir: bu indeks `customer_id = 42` için de, `customer_id = 42 AND status = 'paid'` için de kullanılır ama yalnızca `status = 'paid'` için kullanılamaz, tıpkı soyadına göre sıralı bir telefon rehberinde yalnızca ada göre arama yapamaman gibi. Sütun sırasını, sorgularının en çok eşitlikle süzdüğü sütun başa gelecek şekilde seç.

Planı tahmin etme, sor: `EXPLAIN` motorun seçtiği planı ve tahmini maliyeti gösterir; `EXPLAIN ANALYZE` sorguyu gerçekten çalıştırıp gerçek satır sayılarını da ekler. Tahmini ile gerçek satır sayısı arasında büyük fark varsa istatistikler bayattır.

:::code{lang="sql" title="İndeks oluştur ve planı karşılaştır"}
```sql
EXPLAIN ANALYZE
SELECT id, total_amount FROM orders
WHERE customer_id = 42 AND status = 'paid';
-- Seq Scan on orders  (cost=0.00..18 500)  rows=3  actual rows=3

CREATE INDEX idx_orders_customer_status ON orders (customer_id, status);

EXPLAIN ANALYZE
SELECT id, total_amount FROM orders
WHERE customer_id = 42 AND status = 'paid';
-- Index Scan using idx_orders_customer_status  (cost=0.42..12.5)  rows=3  actual rows=3
```
:::

:::interactive{type="index-query-plan" rows=100000}
İndeks ekleyip sorgu planının ve maliyetin değişimini izleyin. Önce "İndeks yok" ile Seq Scan maliyetini ve incelenen satır sayısını not edin; sonra B-tree (customer_id) ve Bileşik (customer_id, status) indekslerini seçip aynı değerlerin nasıl düştüğünü karşılaştırın. Sorguyu "İkinci kolon: status = paid" yapın: (customer_id, status) indeksi neden işe yaramıyor? "Aralık: created_at" sorgusuyla B-tree (created_at) indeksinin aralık taramasını, "Yalnızca indeksli kolonlar" seçeneğiyle de tabloya hiç gitmeyen Index Only Scan'i gözlemleyin.
:::

İndeksin bedeli yazma tarafındadır: her `INSERT`, `UPDATE` ve `DELETE` tabloyla birlikte tüm indeksleri de günceller ve disk alanı tüketir. Bu yüzden "her sütuna indeks" yaklaşımı yazma yoğun tablolarda geri teper; indeksi gerçek sorgu kalıplarına göre, ölçerek ekle.

## Yaygın hatalar

**N+1 sorgu problemi.** Uygulama önce 100 siparişi çeker, sonra her sipariş için ayrı bir sorguyla müşteri adını okur: 1 + 100 sorgu. Her biri hızlı olsa da ağ gidiş dönüşü toplanır ve liste sayfası saniyeler sürer. Çözüm tek bir `JOIN` ya da `WHERE customer_id IN (...)` ile toplu okuma; ORM kullanıyorsan "eager loading" seçeneğinin tam olarak bunu yaptığını bil.

**SELECT \*.** Tüm sütunları çekmek ağdan gereksiz veri taşır, uygulama belleğini şişirir ve en önemlisi **kapsayan indeks** (covering index) fırsatını kaçırır: yalnızca indeksli sütunları istediğinde motor tabloya hiç gitmeden yaprak sayfalardan yanıt verebilir. Ayrıca tabloya sütun eklendiğinde `SELECT *` kullanan kodun davranışı sessizce değişir.

**WHERE'de fonksiyonlu sütun.** `WHERE YEAR(created_at) = 2025` ya da `WHERE LOWER(email) = 'a@b.com'` yazdığında indeks kullanılamaz, çünkü indeks ham değere göre sıralıdır; motor her satır için fonksiyonu hesaplamak zorunda kalır. Koşulu sütunu çıplak bırakacak şekilde yaz: `created_at >= '2025-01-01' AND created_at < '2026-01-01'`. Küçük harf araması gerçekten gerekiyorsa ifade indeksi (`CREATE INDEX ... ON users (LOWER(email))`) oluştur.

**Sayfalamada büyük OFFSET.** `LIMIT 20 OFFSET 100000` motorun 100.020 satırı okuyup 100.000'ini atmasıdır. Sonsuz kaydırma gibi derin sayfalama senaryolarında imleç tabanlı sayfalama (`WHERE id > :son_gorulen_id ORDER BY id LIMIT 20`) sabit maliyetlidir.

:::callout{tone="tip" title="Mülakat özeti"}
- JOIN sorusunda kâğıda küçük iki tablo çiz, eşleşmeyen satırın akıbetini türe göre söyle; LEFT + `IS NULL` anti-join kalıbını mutlaka bil.
- WHERE satırı, HAVING grubu süzer; SELECT'teki her sütun ya GROUP BY'da ya da toplama içinde.
- "Sorgu yavaş" dendiğinde ilk refleks: `EXPLAIN ANALYZE`, seçicilik, bileşik indekste sütun sırası, WHERE'de fonksiyon var mı, N+1 var mı.
:::

## Pencere fonksiyonlarına kısa giriş

`GROUP BY` satırları tek satıra indirir; **pencere (window) fonksiyonları** ise satırları korurken her satırın yanına "komşularına göre" hesaplanmış bir değer ekler. `OVER (...)` cümlesi pencereyi tanımlar: `PARTITION BY` grupları, `ORDER BY` grup içi sırayı belirler.

:::code{lang="sql" title="Her müşterinin en pahalı siparişi ve kümülatif harcaması"}
```sql
SELECT customer_id,
       id AS order_id,
       total_amount,
       RANK()       OVER (PARTITION BY customer_id ORDER BY total_amount DESC) AS amount_rank,
       SUM(total_amount) OVER (PARTITION BY customer_id ORDER BY created_at)  AS running_total
FROM orders
WHERE status = 'paid';
```
:::

Üç sıralama fonksiyonunu ayırt et: `ROW_NUMBER()` her satıra benzersiz sıra verir (1, 2, 3, 4); `RANK()` eşit değerlere aynı sırayı verir ve sonraki sırayı atlar (1, 2, 2, 4); `DENSE_RANK()` eşitlere aynı sırayı verir ama boşluk bırakmaz (1, 2, 2, 3). "Her kategoride en çok satan 3 ürün" sorusu, `ROW_NUMBER` ile sıra verip dış sorguda `WHERE rn <= 3` süzmekle çözülür ve bu sorgu mülakatların neredeyse ezberidir. `LAG()` ve `LEAD()` önceki ya da sonraki satırın değerini getirir; günlük ciroda "düne göre fark" hesabı tek sorguda biter.

:::realworld{company="Trendyol"}
Trendyol ölçeğindeki bir pazar yerinde "siparişlerim" sayfası dersteki `orders` sorgusunun milyonlarca müşteriye çarpılmış hâlidir. Bu tür sistemlerde genel yaklaşım şöyledir: sipariş tablosu müşteri kimliği ve tarih üzerinde bileşik indekslenir ki her müşterinin son siparişleri tek indeks aralığından okunabilsin; liste sayfaları derin `OFFSET` yerine imleç tabanlı sayfalama kullanır; ürün adı gibi sık okunan ama nadiren değişen alanlar sipariş satırına kopyalanarak (denormalizasyon) JOIN sayısı azaltılır. Raporlama tarafındaki ağır `GROUP BY` ve pencere fonksiyonu sorguları ise işlem veritabanını yormamak için okuma replikalarına ya da ayrı bir analitik depoya yönlendirilir. Yani "hangi JOIN" sorusu kadar "bu sorgu hangi veritabanında, hangi indeksle çalışacak" sorusu da tasarımın parçasıdır.
:::

:::quiz{src="quiz.json"}
:::

:::next{lesson="j-01-must-know-system-design-patterns"}
Bu modül burada bitiyor. Sırada sistem tasarımı notları: load balancer'dan saga'ya, bilinmesi gereken 15 kalıp ve her birinin ne zaman kullanılacağı.
:::

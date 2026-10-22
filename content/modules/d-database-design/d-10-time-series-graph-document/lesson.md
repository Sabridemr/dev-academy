---
id: d-10-time-series-graph-document
slug: time-series-graph-document
module: d-database-design
order: 10
title:
  tr: "Zaman Serisi, Graf ve Belge Veritabanları: Veri Düzeni ve Sorgu Şekli"
  en: "Time-Series, Graph and Document Databases: Data Layout and Query Shape"
summary:
  tr: Chunk ve retention, düğüm/kenar gezintisi, gömme ve referans; ilişkisel modelin yetmediği yerler.
  en: Chunks and retention, node/edge traversal, embedding and referencing; where the relational model falls short.
durationMinutes: 35
level: advanced
tags: [database, time-series, graph-database, document-database, timescaledb, neo4j, mongodb]
prerequisites: [d-04-sql-vs-nosql, d-07-query-planner-explain]
concepts: [hypertable-chunk, retention-policy, downsampling, series-cardinality, property-graph, index-free-adjacency, graph-traversal, cypher, document-embedding, document-referencing]
---

## Kavram: model, sorgunun şeklini taşır

d-04'te veritabanı ailelerini yan yana koyup "hangisini ne zaman seçerim?" sorusunu cevapladık. Bu derste soruyu tersinden soruyoruz: **bu sistemler veriyi diskte ve bellekte nasıl düzenliyor ki belirli sorgular onlarda ucuz?** Üç modelin her biri, ilişkisel modelde pahalı olan tek bir sorgu şeklini ucuzlatmak için tasarlanmıştır:

- **Zaman serisi**: "son bir saatin dakikalık ortalaması", "90 günden eski veriyi at". Sorgu bir **zaman aralığıdır**.
- **Graf**: "arkadaşlarımın arkadaşları", "A'dan B'ye en kısa yol". Sorgu bir **gezintidir** (traversal).
- **Belge**: "siparişi kalemleri ve adresiyle birlikte getir". Sorgu bir **bütündür**: birlikte okunan veri birlikte durur.

:::diagram{src="diagram.svg" alt="Üç veri düzeni: solda zaman aralıklarına bölünmüş chunk'lar ve eski chunk'ların sıkıştırılıp silinmesi; ortada kenarları işaretçi olarak tutan düğümler; sağda kalemleri gömülü, müşteriye referans veren bir sipariş belgesi|Three data layouts: on the left, time-range chunks with older chunks compressed and dropped; in the middle, nodes holding their edges as pointers; on the right, an order document with embedded line items and a reference to the customer"}
Aynı ilke üç kez: verinin fiziksel düzeni, en sık sorulan soruya göre seçilir.
:::

## Zaman serisi: zamana göre bölünmüş, eskidikçe küçülen veri

Zaman serisi verisinin dört özelliği vardır: neredeyse yalnızca **eklenir** (güncellenmez), zaman sırasıyla gelir, hemen her sorgu bir **zaman aralığı** içerir ve verinin değeri yaşlandıkça azalır. Bir sunucunun dünkü CPU kullanımını saniye saniye isteyen olur; geçen yılınkini saniye saniye isteyen olmaz.

**TimescaleDB** bunu PostgreSQL üzerinde bir eklenti olarak çözer. Bir tabloyu **hypertable**'a çevirdiğinizde, arka planda zaman aralıklarına göre (varsayılan 7 gün) **chunk** adı verilen alt tablolara bölünür. Uygulama tek bir tabloya yazar ve okur; planlayıcı ise `WHERE time > now() - interval '1 hour'` gördüğünde ilgisiz chunk'ları hiç açmaz. d-07'deki dille: tarama maliyeti tablonun toplam boyutuyla değil, sorgulanan aralıkla orantılıdır.

Chunk düzeni üç işlemi daha ucuzlatır:

- **Retention**: eski veriyi silmek satır satır `DELETE` değil, tüm chunk'ı düşürmektir; `add_retention_policy('metrics', INTERVAL '90 days')` bunu düzenli çalıştırır. Satır silmenin ürettiği ölü satırlar ve vacuum yükü oluşmaz.
- **Sıkıştırma**: artık yazılmayan eski chunk'lar sütun bazlı sıkıştırılır; aynı metriğin ardışık değerleri birbirine çok benzediği için kazanım büyüktür.
- **Downsampling**: **continuous aggregate**'ler `time_bucket('1 hour', time)` gibi özetleri artımlı olarak güncel tutar. Ham veri 7 gün, saatlik özet 2 yıl saklanabilir.

**InfluxDB** ise baştan zaman serisi için yazılmış bir motordur. Veri modeli farklıdır: her nokta bir ölçüm adı, **etiketler** (tags; indekslenir, ör. `host=web-1,region=eu`), **alanlar** (fields; değerler, indekslenmez) ve zaman damgasından oluşur. Ölçüm adı + etiket kümesi bir **seri** tanımlar. En yaygın tasarım hatası etikete kullanıcı kimliği ya da istek kimliği gibi yüksek kardinaliteli bir değer koymaktır: seri sayısı patlar ve indeks belleğe sığmaz. Kural: etiket, gruplanacak ve filtrelenecek düşük kardinaliteli boyuttur; benzersiz değer alan olarak saklanır.

:::code{lang="sql" title="TimescaleDB: hypertable, retention ve saatlik özet"}
```sql
CREATE TABLE metrics (
  time   timestamptz NOT NULL,
  host   text        NOT NULL,
  cpu    double precision
);
SELECT create_hypertable('metrics', 'time');                 -- zaman aralıklı chunk'lara böl

-- Saatlik özet: ham veri yerine bunu sorgulayan panolar çok daha az satır okur
CREATE MATERIALIZED VIEW metrics_hourly WITH (timescaledb.continuous) AS
SELECT time_bucket('1 hour', time) AS bucket, host, avg(cpu) AS avg_cpu, max(cpu) AS max_cpu
FROM metrics GROUP BY bucket, host;

SELECT add_retention_policy('metrics', INTERVAL '7 days');   -- ham veri: 7 gün, chunk düşürerek
-- metrics_hourly ham veriden bağımsız olarak daha uzun saklanabilir
```
:::

## Graf: ilişkiler birinci sınıf veri

**Özellikli graf** (property graph) modelinde iki yapı vardır: **düğümler** (etiketli, ör. `:User`, özellikleri olan) ve **kenarlar** (ilişkiler; türü, yönü ve özellikleri olan, ör. `[:FRIEND {since: 2021}]`). Neo4j gibi yerel graf veritabanları kenarları **index-free adjacency** ile saklar: her düğüm kendi kenarlarına doğrudan işaretçi tutar. Bir komşuya geçmek, bir indekste arama yapmak değil, bir işaretçiyi izlemektir.

İlişkisel modelde aynı soru bir **JOIN zinciridir**. `friendships(user_id, friend_id)` tablosunda her atlama, indekste bir B-tree inişi ve bir JOIN demektir; ara sonuç her atlamada çarpılarak büyür. 200 arkadaşı olan biri için iki atlama, tekrarlarla birlikte 200 × 200 = 40.000 satırlık ara sonuçtur; üç atlama 8 milyon satırdır. Değişken derinlikli sorgular (`1..5 atlama`, "en kısa yol") için ise SQL'de özyinelemeli CTE gerekir ve planlayıcının bunun için iyi tahmin yapması zordur.

Neo4j'nin sorgu dili **Cypher**, bu gezintiyi bir desen olarak yazar. Sorgu, grafın şeklini ASCII çizimi gibi tarif eder:

:::code{lang="sql" title="Arkadaşın arkadaşı: SQL JOIN zinciri ve Cypher deseni"}
```sql
-- SQL: iki atlama = iki self-join; ortak arkadaş sayısına göre öneri
SELECT f2.friend_id AS suggestion, count(*) AS mutual
FROM friendships f1
JOIN friendships f2 ON f2.user_id = f1.friend_id
WHERE f1.user_id = $1
  AND f2.friend_id <> $1
  AND NOT EXISTS (SELECT 1 FROM friendships x WHERE x.user_id = $1 AND x.friend_id = f2.friend_id)
GROUP BY f2.friend_id
ORDER BY mutual DESC
LIMIT 10;
```
```cypher
// Cypher: aynı soru bir desen olarak; derinlik değişirse yalnızca *2 → *1..3 olur
MATCH (me:User {id: $id})-[:FRIEND]-(f:User)-[:FRIEND]-(fof:User)
WHERE fof <> me AND NOT (me)-[:FRIEND]-(fof)
RETURN fof.name AS suggestion, count(DISTINCT f) AS mutual
ORDER BY mutual DESC
LIMIT 10;
```
:::

Graf veritabanının maliyeti grafın toplam boyutuna değil, **gezilen alt grafa** bağlıdır. Bu, sorgu başlangıç düğümünden sınırlı bir bölgede kaldığı sürece büyük avantajdır; "tüm grafta en çok takip edilen 100 kullanıcı" gibi toplu analitikte ise avantaj kaybolur. Bir de bölme sorunu vardır: grafı makineler arasında bölmek, gezintiyi ağ atlamalarına çevirir.

Aşağıdaki animasyon aynı "kullanıcı → arkadaş → arkadaşın arkadaşı" sorgusunu önce ilişkisel JOIN zinciri, sonra graf gezintisi olarak yürütür.

:::animation{scene="scene.json"}
Solda her atlama bir indeks araması ve JOIN; ara sonuç büyür ve sonunda DISTINCT ile temizlenir. Sağda başlangıç düğümü bir kez bulunur, sonra kenar işaretçileri izlenir; ortak arkadaş sayısı gezinti sırasında birikir.
:::

:::interactive{type="graph-traversal" algorithm="bfs" nodes=10 start=0}
Graf veritabanının "arkadaşın arkadaşı" gezintisi özünde genişlik öncelikli aramadır (BFS). "Algoritma" BFS iken "Adım" düğmesiyle ilerleyin: başlangıç düğümünün tüm komşuları (arkadaşlar, 1. derece) kuyruğa girer ve önce onlar işlenir; ardından onların komşuları (arkadaşın arkadaşı, 2. derece) gelir. "Kuyruk (baş →)" panelinde iki katmanın sırayla aktığını, "Ziyaret sırası"nda da bir düğümün iki kez işlenmediğini izleyin: SQL'deki `DISTINCT`'in gezinti içindeki karşılığı ziyaret kümesidir. "Düğüm sayısı"nı artırıp "Yeni graf" ile tekrar deneyin ve ikinci katmanın birinci katmandan ne kadar hızlı büyüdüğüne bakın. Bir düğüme tıklayarak başlangıcı değiştirebilirsiniz.
:::

## Belge: birlikte okunan birlikte durur

**MongoDB** gibi belge veritabanlarında birim, iç içe alanları ve dizileri olan bir belgedir (BSON). Atomiklik varsayılan olarak **belge düzeyindedir**: tek bir belgenin içindeki her değişiklik atomiktir; MongoDB 4.0'dan beri çok belgeli transaction'lar da vardır ama tasarımın varsayılanı olmamalıdır. Bu yüzden modelleme sorusu "hangi veri tek belgede yaşamalı?" sorusudur.

d-04'te kısa kuralı gördük: birlikte okunan, sınırlı büyüyen ve bağımsız güncellenmeyen veri gömülür. Uygulamada karar şu ayrıntılara dayanır:

- **Sınır**: tek belge en fazla 16 MB olabilir. Sınırsız büyüyen bir dizi (bir gönderinin tüm yorumları) gömülmez; son 20 yorum gömülüp tamamı ayrı koleksiyonda tutulabilir (subset deseni).
- **Kopyanın bedeli**: siparişe müşterinin adını ve e-postasını gömmek (extended reference) okumayı JOIN'siz yapar; ama müşteri adını değiştirince eski siparişlerdeki kopyalar eski kalır. Sipariş anındaki adresin kopyası istenen bir şeydir (d-06'daki snapshot); profil fotoğrafının kopyası ise genellikle değildir.
- **Erişim yönü**: çoka-çok ilişkiler (öğrenci ↔ ders) iki tarafta da gömülemez; referans dizileri ve gerekirse `$lookup` kullanılır. `$lookup` ağır kullanılıyorsa veri belki ilişkiseldir.
- **İndeksler**: gömülü alanlar ve dizi elemanları indekslenebilir (dizi alanlarında multikey indeks); `{"items.sku": 1}` bir siparişin içindeki ürün koduna göre aramayı hızlandırır.

:::code{lang="js" title="MongoDB: gömme ve referans aynı belgede"}
```js
// Sipariş: kalemler ve teslimat adresi gömülü (birlikte okunur, sınırlı, sipariş anının kopyası)
// Müşteri: referans (bağımsız güncellenir, birçok siparişte paylaşılır)
db.orders.insertOne({
  _id: ObjectId(),
  customerId: ObjectId("665f1c2e9b1e8a0012345678"),   // referans
  customerName: "Ayşe Yılmaz",                         // extended reference: liste ekranı için kopya
  status: "paid",
  shippingAddress: { city: "İzmir", line1: "..." },    // snapshot
  items: [                                             // gömülü, sınırlı dizi
    { sku: "KB-101", qty: 1, unitPriceCents: 129900 },
    { sku: "MS-220", qty: 2, unitPriceCents: 34900 },
  ],
  createdAt: new Date(),
});
db.orders.createIndex({ customerId: 1, createdAt: -1 });   // "siparişlerim"
db.orders.createIndex({ "items.sku": 1 });                  // multikey: dizi elemanları indekslenir
```
:::

:::realworld{company="Meta"}
Facebook'un sosyal grafı, ekibin USENIX ATC 2013'te yayımladığı makalede anlatılan **TAO** üzerinde durur. TAO'nun veri modeli tam olarak bu dersteki graf modelidir: **nesneler** (kullanıcı, gönderi, yorum) ve aralarındaki türlü, yönlü **ilişkiler** (association; arkadaşlık, beğeni, yazarlık). Ancak altta yerel bir graf veritabanı yoktur: veri, parçalanmış (sharded) MySQL'de durur ve önünde coğrafi olarak dağıtılmış, okumaya göre optimize edilmiş bir önbellek katmanı vardır. API da buna göre dar tutulmuştur: bir nesneyi getirmek, bir nesnenin belirli türdeki ilişki listesini zamana göre sıralı getirmek ya da saymak. İlişki listeleri kaynak nesneyle aynı parçada saklandığı için "bu gönderiyi beğenenler" tek parçalı bir okumadır. TAO'nun dersi şudur: graf bir **veri modeli**dir, tek bir ürün değil. Sorgu şekli "bir düğümün komşularını getir" ise, iyi tasarlanmış bir ilişkisel depo üzerinde de verimli sunulabilir; Cypher tarzı keyfi çok atlamalı sorgular ise yerel graf motorlarının alanıdır.
:::

:::realworld{company="Uber"}
Uber'in 2016'da yayımladığı yazı dizisi, yolculuk verisi için geliştirdiği **Schemaless** deposunu anlatır. Schemaless, MySQL üzerine kurulmuş ve belge modeline yakın bir katmandır: veri, bir satır anahtarı, sütun adı ve sürüm (ref key) ile adreslenen **hücrelerde** JSON olarak saklanır. Hücreler değiştirilmez; güncelleme, daha yüksek sürümlü yeni bir hücre eklemektir (append-only). Şema veritabanında değil, okuyan kodda yaşar ve ikincil indeksler ana yazmadan sonra, nihai tutarlılıkla güncellenir. Tasarım, bu dersteki belge ilkesini ölçekte uygular: birlikte yazılıp okunan bir bütün (bir yolculuğun belirli bir aşaması) tek bir JSON hücresidir ve sorgu deseni "anahtarla bütünü getir"dir.
:::

:::callout{tone="warning" title="Yeni bir veritabanı, yeni bir operasyon yükü"}
TimescaleDB bir PostgreSQL eklentisi olduğu için mevcut yedekleme, replikasyon ve migration araçlarınızı (d-09) korur; ayrı bir motor (InfluxDB, Neo4j, MongoDB) ise kendi yedeğini, izlemesini, güvenlik güncellemelerini ve uzmanlığını ister. Önce PostgreSQL içinde çözülebiliyor mu diye bakın: zaman serisi için bölümleme ve BRIN indeksleri, sınırlı derinlikte graf için özyinelemeli CTE, esnek alanlar için JSONB.
:::

:::callout{tone="tip" title="Mülakat özeti"}
- Zaman serisi: zamana göre chunk, aralık sorgusunda chunk eleme, chunk düşürerek retention, continuous aggregate ile downsampling. InfluxDB'de etiket kardinalitesine dikkat.
- Graf: index-free adjacency; maliyet gezilen alt grafla orantılı. SQL'de her atlama bir JOIN ve ara sonuç çarpılarak büyür.
- Belge: atomiklik belge düzeyinde; gömme kararını sınır, kopya bedeli ve erişim yönü belirler.
- "Graf mı ilişkisel mi?" sorusunda sorgu şeklini sorun: sabit 1–2 atlama ilişkiselde iyi gider, değişken derinlik ve yol sorguları graf ister.
:::

:::quiz{src="quiz.json"}
:::

:::resources
- [TAO: Facebook's Distributed Data Store for the Social Graph](https://www.usenix.org/conference/atc13/technical-sessions/presentation/bronson) — bildiri — USENIX ATC 2013
- [TimescaleDB](https://github.com/timescale/timescaledb) — depo — hypertable, sıkıştırma ve continuous aggregate
- [Neo4j Cypher Manual](https://neo4j.com/docs/cypher-manual/current/introduction/) — belge — desen eşleme ve değişken uzunluklu ilişkiler
- [MongoDB: Data Modeling](https://www.mongodb.com/docs/manual/data-modeling/) — belge — gömme ve referans kararları
- [Designing Data-Intensive Applications](https://dataintensive.net/) — kitap — Martin Kleppmann; veri modelleri ve sorgu dilleri bölümü
:::

:::next{lesson="e-01-amazon-scale-ecommerce"}
Sırada: veritabanı tasarımı modülünü bitirdiniz. Şimdi bu araçları Amazon ölçeğinde bir e-ticaret sisteminde birleştirin.
:::

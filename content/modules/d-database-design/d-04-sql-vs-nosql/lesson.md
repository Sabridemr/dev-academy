---
id: d-04-sql-vs-nosql
slug: sql-vs-nosql
module: d-database-design
order: 4
title:
  tr: "SQL vs NoSQL: Key-Value, Document, Wide-Column, Graph, Time-Series"
  en: "SQL vs NoSQL: Key-Value, Document, Wide-Column, Graph, Time-Series"
summary:
  tr: Karşılaştırma matrisi ve seçim rehberi.
  en: Comparison matrix and selection guide.
durationMinutes: 30
level: intermediate
tags: [database, nosql, sql, data-modeling, cap, polyglot-persistence]
prerequisites: [d-01-relational-modeling-normalization, a-02-latency-throughput-cap]
concepts: [relational-vs-nosql, key-value-store, document-store, wide-column-store, graph-database, time-series-database, access-pattern-modeling, cap-theorem, polyglot-persistence, schema-on-read]
---

## Kavram: veritabanı seçimi bir erişim deseni sorusudur

"SQL mi NoSQL mi?" sorusu yanlış kurulmuştur; doğru soru **"veriye nasıl erişeceğim?"** sorusudur. İlişkisel veritabanları veriyi **yazarken** düzenler (normalize şema, JOIN ile her soru sorulabilir). NoSQL aileleri ise veriyi **okuma desenine göre** düzenler: her sorgu için veriyi önceden o şekle sokarsınız; esneklik azalır, belirli sorgular çok hızlanır ve yatay ölçekleme kolaylaşır.

NoSQL tek bir şey değildir; beş farklı ailedir ve her biri farklı bir problemi çözer. Aşağıdaki diyagram aynı veriyi — bir kullanıcının gönderisi, yorumları ve beğenileri — beş modelde yan yana gösterir.

:::diagram{src="diagram.svg" alt="Aynı gönderi verisinin ilişkisel tablolar, JSON doküman, key-value çifti, wide-column satırı ve graf olarak yerleşimi|The same post data laid out as relational tables, a JSON document, a key-value pair, a wide-column row and a graph"}
Aynı gerçek beş farklı şekle girer; hangisinin "doğru" olduğunu veri değil, sorgu belirler.
:::

## Beş NoSQL ailesi

### Key-value (Redis, DynamoDB*, Memcached)
Veri, anahtar → opak değer çiftidir. Tek işlem: `GET`/`PUT`/`DELETE` anahtarla. Mikro-saniye gecikme, doğrusal ölçekleme; ama "değeri X olan anahtarları getir" gibi sorgu yoktur. Oturum, önbellek, sayaç, rate-limit, özellik bayrakları için idealdir.

### Document (MongoDB, Couchbase, Firestore)
Değer artık opak değil, iç yapısı olan JSON/BSON dokümanıdır; alanlara göre sorgulanıp indekslenebilir. İlişkili veri (gönderi + yorumları) **tek dokümana gömülür** (embedding), böylece bir okuma JOIN'siz her şeyi getirir. Şema esnektir (schema-on-read); farklı dokümanlar farklı alan taşıyabilir. Bedel: gömülü veri büyürse (binlerce yorum) doküman şişer; çoka-çok ilişkiler ve çapraz doküman tutarlılığı zayıftır.

### Wide-column (Cassandra, ScyllaDB, HBase, Bigtable)
Satırlar bir **partition key** ile düğümlere dağıtılır, partition içinde **clustering key** ile sıralanır. Her sorgu partition key ile başlamak zorundadır; "tablo başına bir sorgu" felsefesiyle şema sorgudan türetilir. Yüksek yazma hacmi, çok veri merkezli replikasyon, ayarlanabilir tutarlılık. Zaman serisi akışları, mesaj geçmişi, etkinlik logları için biçilmiş kaftandır.

### Graph (Neo4j, Amazon Neptune, TigerGraph)
Düğümler ve ilişkiler birinci sınıf vatandaştır; "arkadaşımın arkadaşının beğendiği gönderiler" gibi **çok atlamalı** sorgular ilişkisel JOIN zincirinden kat kat hızlıdır çünkü ilişkiler işaretçi olarak saklanır (index-free adjacency). Sosyal ağ, dolandırıcılık tespiti, öneri, bilgi grafı. Zayıf yanı: toplu analitik ve basit CRUD'da fazladan karmaşıklık.

### Time-series (TimescaleDB, InfluxDB, ClickHouse**)
Zaman damgalı ölçümlere özelleşmiş: sıkıştırma (aynı metrik ardışık değerleri), otomatik zaman parçalama (chunk/partition), eski verinin seyreltilmesi (downsampling) ve `time_bucket` gibi pencere fonksiyonları. Metrik, IoT, finans tik verisi.

\* DynamoDB hem key-value hem wide-column özellikleri taşır (partition + sort key). \*\* ClickHouse aslında sütunsal OLAP veritabanıdır; zaman serisi analitiğinde yaygın kullanılır.

## Karşılaştırma matrisi

| | **İlişkisel** | **Key-value** | **Document** | **Wide-column** | **Graph** | **Time-series** |
|---|---|---|---|---|---|---|
| Veri birimi | Satır/tablo | Anahtar → blob | JSON doküman | Partition + sıralı satır | Düğüm + kenar | Zaman damgalı ölçüm |
| Şema | Önceden, katı | Yok | Esnek | Sorgudan türetilir | Esnek | Metrik + etiket |
| Sorgu gücü | Ad-hoc, JOIN | Yalnızca anahtar | Alan filtresi, indeks | Partition key zorunlu | Çok atlamalı gezinme | Zaman penceresi, agregasyon |
| Transaction | Çok satır ACID | Tek anahtar | Tek doküman (çoklu sınırlı) | Partition içi hafif | ACID (Neo4j) | Toplu ekleme |
| Ölçekleme | Dikey + read replica, sharding zor | Yatay, kolay | Yatay (shard key) | Yatay, doğal | Zor (graf bölmek) | Zaman bazlı bölme |
| Tutarlılık | Güçlü | Ayarlanabilir | Ayarlanabilir | Ayarlanabilir (quorum) | Güçlü (tek küme) | Eventual yeterli |
| Tipik gecikme | ms | µs–ms | ms | ms | ms (atlama sayısına göre) | ms (sıkıştırılmış tarama) |
| En iyi olduğu yer | İş verisi, raporlama | Önbellek, oturum | Katalog, profil, CMS | Akış, log, mesaj geçmişi | Sosyal, öneri, fraud | Metrik, IoT |
| Kaçının | Dev yazma akışı, esnek şema | İlişkisel sorgu | Çoka-çok, çapraz doküman transaction | Ad-hoc sorgu | Toplu analitik | Güncellenen kayıtlar |

## Aynı veri, farklı yerleşim

Animasyon, bir sosyal uygulamadaki tek gönderiyi (yazar, metin, yorumlar, beğeniler, görüntülenme sayısı) beş modele sırayla yerleştirir; her adımda hangi sorgunun kolaylaştığını, hangisinin zorlaştığını not eder.

:::animation{scene="scene.json"}
Gönderi, yorum ve beğeni verisinin ilişkisel, doküman, key-value, wide-column, graf ve zaman serisi modellerinde yerleşimi.
:::

:::code{lang="ts" title="Aynı gönderi, beş istemci: erişim deseni şemayı belirler"}
```ts
// 1) İlişkisel (PostgreSQL): normalize, her soru JOIN ile sorulabilir
await pg.query(`
  SELECT p.id, p.body, u.handle, count(l.user_id) AS likes
  FROM posts p JOIN users u ON u.id = p.author_id
  LEFT JOIN likes l ON l.post_id = p.id
  WHERE p.id = $1 GROUP BY p.id, u.handle`, [postId]);

// 2) Document (MongoDB): gönderi + son yorumlar tek dokümanda, tek okuma
await posts.insertOne({
  _id: postId, author: { id: 7, handle: 'ayse' }, body: 'Merhaba!',
  likeCount: 1280,                         // sayaç gömülü; tam liste ayrı koleksiyonda
  comments: [{ by: 'ali', text: 'Harika', at: new Date() }],   // en son 20 yorum (bounded)
});

// 3) Key-value (Redis): hazır render edilmiş gönderi, TTL ile
await redis.set(`post:${postId}:view`, JSON.stringify(renderedPost), 'EX', 300);
await redis.incr(`post:${postId}:views`);  // atomik sayaç

// 4) Wide-column (Cassandra): kullanıcının zaman akışı — partition: user_id, sıralama: zaman (yeni önce)
await cassandra.execute(
  `INSERT INTO timeline_by_user (user_id, posted_at, post_id, body) VALUES (?, ?, ?, ?)`,
  [authorId, new Date(), postId, body], { prepare: true },
);
// SELECT * FROM timeline_by_user WHERE user_id = ? LIMIT 50  → tek partition, sıralı okuma

// 5) Graph (Neo4j): "takip ettiklerimin beğendiği gönderiler" — iki atlama, JOIN yok
await neo4j.run(`
  MATCH (me:User {id: $me})-[:FOLLOWS]->(:User)-[:LIKED]->(p:Post)
  WHERE NOT (me)-[:LIKED]->(p)
  RETURN p ORDER BY p.createdAt DESC LIMIT 20`, { me: userId });

// 6) Time-series (TimescaleDB): dakikalık görüntülenme eğrisi
await pg.query(`
  SELECT time_bucket('1 minute', ts) AS minute, count(*) AS views
  FROM post_views WHERE post_id = $1 AND ts > now() - interval '1 hour'
  GROUP BY minute ORDER BY minute`, [postId]);
```
:::

## Seçim karar ağacı

Aşağıdaki akış, mülakatta "hangi veritabanı?" sorusuna sistematik cevap vermek içindir. Her dal bir **sorgu deseni** sorusudur, teknoloji modası değil.

:::diagram{src="decision-tree.svg" alt="Veritabanı seçimi karar ağacı: ilişki ve transaction ihtiyacından başlayıp erişim desenine göre ilişkisel, key-value, document, wide-column, graph ya da time-series önerisine ulaşır|Database selection decision tree: starting from relationship and transaction needs and following the access pattern to a relational, key-value, document, wide-column, graph or time-series recommendation"}
Varsayılan cevap ilişkisel veritabanıdır; ağacın diğer dalları ancak ölçülmüş bir gereksinimle açılır.
:::

Özetle:

1. **Çok tablolu ACID transaction ve ad-hoc sorgu** gerekiyor mu? → İlişkisel (PostgreSQL/MySQL). %80 vaka burada biter.
2. Yalnızca **anahtarla eriş** ve mikro-saniye istiyorsanız → Key-value.
3. **Birlikte okunan iç içe veri**, esnek alanlar → Document.
4. **Saniyede yüz binlerce yazma**, zaman sıralı akış, çok bölge → Wide-column.
5. **İlişkinin kendisi veri** ise (kim kimi, kaç atlama) → Graph.
6. **Zaman damgalı ölçüm**, pencere agregasyonu, veri eskimesi → Time-series.

## CAP ve tutarlılık ayarı

NoSQL sistemlerin çoğu, ağ bölünmesinde **erişilebilirliği** seçecek şekilde tasarlanmıştır (AP): Cassandra ve DynamoDB okuma/yazma başına tutarlılık seviyesi seçtirir (`ONE`, `QUORUM`, `ALL`). İlişkisel tek-lider sistemler ise bölünmede **tutarlılığı** korur (CP) ve lider ulaşılamazsa yazmayı reddeder. Pratikte asıl ayar düğmesi "bir okumanın en son yazmayı görmesi şart mı?" sorusudur; buna "evet" diyorsanız quorum (W + R > N) ya da tek lider gerekir.

:::interactive{type="cap-theorem" nodes=3 partition=false mode="ap"}
Üç replikalı kümede "Ağı böl" ile bölünmeyi açın. Önce AP modunda azınlık tarafındaki N1'e yazın, sonra çoğunluk tarafındaki N2'den okuyun: bayat okuma — Cassandra'nın ONE seviyesinin bedeli budur. CP moduna geçip aynı senaryoyu çalıştırın: N1 çoğunluğa ulaşamadığı için yazmayı ve okumayı reddeder, çoğunluk tarafı devam eder — QUORUM (W + R > N) ya da tek liderin davranışı. "Bölünmeyi onar" ile çakışmanın last-write-wins ile nasıl çözüldüğünü günlükte izleyin.
:::

:::callout{tone="warning" title="NoSQL = şemasız değildir"}
Şema her zaman vardır; soru onun **nerede** olduğudur. İlişkisel veritabanında şema veritabanındadır (schema-on-write), doküman deposunda ise okuyan kodun içindedir (schema-on-read). İkinci durumda üç yıl önce yazılmış dokümanı bugünkü kodun okuyabilmesi sizin sorumluluğunuzdur: alan sürümleme, varsayılan değerler ve göç (migration) betikleri NoSQL'de kaybolmaz, uygulamaya taşınır.
:::

:::realworld{company="Netflix"}
Netflix **polyglot persistence**'ın ders kitabı örneğidir. İzleme geçmişi ve "kaldığın yerden devam et" verisi, saniyede milyonlarca yazma ve çok bölgeli aktif-aktif replikasyon gerektirdiği için **Cassandra**'da tutulur; partition key profil kimliği, clustering key zamandır. Bu verinin önünde **EVCache** (Memcached tabanlı key-value) katmanı vardır; ana sayfa açılışında onlarca servis milisaniye altı gecikmeyle buradan okur. Katalog meta verisi ve A/B deney konfigürasyonu gibi ilişkisel ve transactional gereksinimler **MySQL/Aurora**'da; mikroservisler arası izleme (tracing) ve metrikler zaman serisi depolarında (Atlas) durur. Netflix mühendisleri izleme geçmişi büyüdükçe Cassandra'da tek satırın şişmesi problemini "canlı + sıkıştırılmış arşiv" olarak iki tabloya bölerek çözdü — veri modelini erişim desenine göre yeniden biçimlendirmenin somut örneği.
:::

:::callout{tone="tip" title="Mülakat özeti"}
- "NoSQL kullanırım" demeyin; **hangi aile** ve **hangi sorgu için** olduğunu söyleyin.
- Varsayılanınız ilişkisel olsun; ayrılmak için ölçülebilir gerekçe gösterin: yazma hacmi, gecikme, çok bölge, çok atlamalı sorgu.
- Doküman gömme kararı: birlikte okunan, sınırlı büyüyen, bağımsız güncellenmeyen veri gömülür; aksi hâlde referans verilir.
- Wide-column'da şema "sorgu başına tablo"dur; sorguyu bilmeden tablo tasarlanamaz.
- Polyglot persistence maliyetlidir: her ek depo ayrı operasyon, yedekleme ve tutarlılık sorunu getirir.
:::

:::quiz{src="quiz.json"}
:::

:::next{lesson="d-05-read-write-scaling"}
Sırada: seçtiğiniz veritabanı tek makineye sığmayınca ne olur? Read replica, bağlantı havuzu ve sharding.
:::

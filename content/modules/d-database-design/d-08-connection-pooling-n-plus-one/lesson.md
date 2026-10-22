---
id: d-08-connection-pooling-n-plus-one
slug: connection-pooling-n-plus-one
module: d-database-design
order: 8
title:
  tr: "Bağlantı Havuzu, N+1 ve ORM Tuzakları"
  en: "Connection Pools, N+1 and ORM Pitfalls"
summary:
  tr: Bağlantının maliyeti, havuz boyutu ve PgBouncer; N+1 sorgunun tespiti ve Prisma ile çözümü.
  en: The cost of a connection, pool sizing and PgBouncer; detecting N+1 queries and fixing them with Prisma.
durationMinutes: 30
level: intermediate
tags: [database, orm, prisma, connection-pool, pgbouncer, performance]
prerequisites: [d-05-read-write-scaling, d-07-query-planner-explain]
concepts: [connection-cost, connection-pooling, pool-timeout, n-plus-one, eager-loading, lazy-loading, dataloader, raw-sql, pgbouncer]
---

## Kavram: hızlı sorgu, yavaş uygulama

d-07'de tek bir sorguyu hızlandırmayı öğrendik. Üretimde çoğu yavaşlık ise tek bir kötü sorgudan değil, **iyi sorguların kötü kullanılmasından** gelir: her biri 1 ms süren yüzlerce sorgunun sırayla atılması ya da sorguların veritabanına ulaşmak için boş bağlantı beklemesi. Bu dersin iki konusu birbirine bağlıdır. N+1 deseni bir isteğin bağlantıyı gereğinden uzun tutmasına yol açar; uzun tutulan bağlantılar havuzu tüketir ve havuz tükenince hiç ilgisi olmayan istekler de beklemeye başlar.

## Bir bağlantının maliyeti

Uygulamanın PostgreSQL'e yeni bir bağlantı açması birkaç adımdır: TCP el sıkışması, çoğu kurulumda TLS el sıkışması, kimlik doğrulama (SCRAM birkaç gidiş-dönüş ister) ve sunucu tarafında bu bağlantıya özel yeni bir **arka uç süreci** başlatılması. Ağın uzak olduğu durumlarda bu toplam, sorgunun kendisinden çok daha uzun sürebilir. Üstelik bağlantı açık kaldığı sürece sunucuda bellek tutar.

Bu yüzden uygulamalar bağlantıları her istekte açıp kapatmaz; açık bağlantılardan oluşan bir **havuz** tutar. İstek gelince havuzdan bir bağlantı ödünç alınır, sorgu biter bitmez geri verilir. d-05'te havuz boyutunun neden küçük tutulduğunu ve PgBouncer'ın kip seçeneklerini gördük; burada havuzun uygulama içinden nasıl göründüğüne odaklanıyoruz.

:::diagram{src="diagram.svg" alt="Solda N+1 deseni: bir liste sorgusu ve ardından her satır için ayrı sorgu, toplam 1+N gidiş-dönüş; sağda aynı veri iki sorguda (IN) ya da tek JOIN'de; altta havuzdaki sınırlı bağlantılar ve kuyrukta bekleyen istekler|Left: the N+1 pattern, one list query followed by one query per row, 1+N round trips in total; right: the same data in two queries (IN) or one JOIN; below: the limited connections in the pool and requests waiting in the queue"}
Gidiş-dönüş sayısı, sorgu süresinden çok daha hızlı büyür. Havuz ise paylaşılan bir kaynaktır: bir isteğin israfı diğerlerinin bekleme süresidir.
:::

## Prisma'nın havuzu

Bu projenin backend'i Prisma kullanır ve Prisma kendi bağlantı havuzunu yönetir. Varsayılan havuz boyutu, Prisma belgelerine göre `fiziksel_çekirdek × 2 + 1`'dir ve `DATABASE_URL`'e eklenen parametrelerle değiştirilir:

- `connection_limit`: havuzdaki en fazla bağlantı.
- `pool_timeout`: boş bağlantı için en fazla bekleme süresi (saniye, varsayılan 10). Süre dolarsa sorgu `P2024` hatasıyla düşer: "Timed out fetching a new connection from the connection pool".
- `pgbouncer=true`: önde transaction kipinde PgBouncer varken Prisma'nın buna uygun davranması için.

`P2024` hatası çoğu zaman "havuzu büyütelim" refleksiyle karşılanır; oysa önce **bağlantıyı kimin, neden uzun tuttuğu** sorulmalıdır. Uzun interaktif transaction'lar (`$transaction(async (tx) => { ... })` içinde HTTP çağrısı yapmak gibi), yavaş sorgular ve N+1 döngüleri en tipik suçlulardır.

Sunucusuz (serverless) ortamlarda sorun katlanır: her fonksiyon örneği kendi küçük havuzunu açar ve trafik artınca yüzlerce örnek veritabanının bağlantı sınırına dayanır. Prisma belgeleri bu ortamlarda `connection_limit=1` ile başlamayı ve önüne PgBouncer gibi harici bir havuz koymayı önerir.

:::callout{tone="warning" title="Transaction kipi ve oturum durumu"}
PgBouncer transaction kipinde bir sunucu bağlantısı yalnızca transaction süresince sizindir. `SET` ile değiştirilen oturum ayarları, `LISTEN`, oturum düzeyi advisory lock'lar ve geçici tablolar bir sonraki transaction'da başka bir bağlantıda olabilir. Hazır ifadeler (prepared statements) uzun süre bu kipte desteklenmiyordu; PgBouncer 1.21 ile protokol düzeyindeki hazır ifadeler için destek geldi (`max_prepared_statements`). Sürümünüzü ve sürücünüzün ayarını kontrol edin.
:::

## N+1: en sessiz performans hatası

Desen şöyledir: bir liste için **1** sorgu atılır, sonra listedeki her öğe için ilişkili veriyi getiren **N** sorgu daha. Kod okurken masum görünür:

:::code{lang="ts" title="N+1 ve iki düzeltmesi (Prisma)"}
```ts
// ✗ N+1: 1 sorgu ders listesi + her ders için 1 sorgu ilerleme
const lessons = await prisma.lesson.findMany({ where: { moduleId } });
const result = [];
for (const l of lessons) {
  // Döngü içinde await: her tur ayrı bir gidiş-dönüş, sırayla
  const progress = await prisma.progress.findFirst({ where: { lessonId: l.id, userId } });
  result.push({ ...l, progress });
}

// ✓ Eager loading: Prisma ilişkiyi ayrı bir sorguyla, IN (...) ile toplu getirir → 2 sorgu
const withProgress = await prisma.lesson.findMany({
  where: { moduleId },
  include: { progress: { where: { userId }, select: { status: true, percent: true } } },
});

// ✓ Tek sorgu: relationJoins önizleme özelliği açıkken veritabanı tarafında JOIN
const joined = await prisma.lesson.findMany({
  relationLoadStrategy: 'join',
  where: { moduleId },
  include: { progress: { where: { userId } } },
});

// ✓ Elle toplu yükleme: anahtarları topla, tek IN sorgusu, bellekte eşle
const ids = lessons.map((l) => l.id);
const rows = await prisma.progress.findMany({ where: { userId, lessonId: { in: ids } } });
const byLesson = new Map(rows.map((r) => [r.lessonId, r]));
```
:::

Modülde 12 ders varsa ilk sürüm 13 sorgu atar. Her biri yalnızca 1 ms sürse bile, uygulama ile veritabanı arasındaki gidiş-dönüş süresi her sorguya eklenir ve sorgular sırayla beklenir. Daha kötüsü, liste büyüdükçe süre doğrusal artar: 500 öğelik bir yönetici sayfası 501 sorgu demektir. Test ortamında 3 kayıtla fark edilmez, üretimde fark edilir.

Aşağıdaki animasyon 1 + N sorgunun ardışık gidişini, aynı verinin IN ve JOIN ile getirilmesini ve ardından havuz dolduğunda isteklerin nasıl beklemeye başladığını gösterir.

:::animation{scene="scene.json"}
1 + N sorgu sırayla gider; aynı veri iki sorguda (IN) ve tek sorguda (JOIN) gelir. Sonra havuzdaki bağlantılar dolar, yeni istekler kuyrukta bekler ve biri pool_timeout ile düşer.
:::

### Lazy loading tuzakları

Prisma'da ilişkiler yalnızca `include` ya da `select` ile istendiğinde yüklenir; "erişince kendiliğinden yükleme" (lazy loading) yoktur. Bu yüzden Prisma'daki N+1'ler hep görünür bir döngüden gelir. Hibernate, ActiveRecord, TypeORM ve Django ORM gibi araçlarda ise ilişkiye `order.customer` diye erişmek arka planda sorgu atabilir; şablonun içinde, bir serileştiricide ya da bir log satırında yapılan erişim kodu okuyan kişiye görünmez. Bu araçların karşılıkları: Django'da `select_related`/`prefetch_related`, Rails'te `includes`, JPA'da `JOIN FETCH` ya da entity graph.

İkinci tuzak **aşırı eager loading**'dir: her şeyi `include` etmek, kullanılmayan büyük sütunları ve ilişkileri her istekte taşır. `select` ile yalnızca gereken alanları isteyin.

### Tespit

- **Sorgu logu**: Prisma'da `log: [{ emit: 'event', level: 'query' }]` ile her sorgu yayılır; bir istekte aynı şekle sahip sorgunun tekrar sayısını sayan küçük bir ara katman N+1'i hemen gösterir.
- **Testte sorgu sayısı sınırı**: kritik uç noktalar için "bu istek en fazla 3 sorgu atar" diye test yazın; liste büyüdüğünde sayının değişmemesi gerekir.
- **APM / dağıtık izleme**: bir istek izinde art arda dizilmiş onlarca kısa veritabanı aralığı (span) N+1'in görsel imzasıdır.
- **Hazır araçlar**: Rails dünyasında Bullet gem'i N+1 desenlerini geliştirme sırasında uyarı olarak bildirir.

### DataLoader: GraphQL'in çözümü

GraphQL'de her alan çözümleyicisi (resolver) bağımsız çalıştığı için N+1 kendiliğinden oluşur. Facebook'un açık kaynak yaptığı **DataLoader**, aynı olay döngüsü turunda istenen anahtarları toplayıp tek bir toplu çağrıya (`WHERE id IN (...)`) çevirir ve istek boyunca sonuçları önbelleğe alır. Prisma da aynı turda yapılan `findUnique` çağrılarını kendi içinde toplar; bu yüzden resolver içinde `findUnique` kullanmak `findFirst`'e göre daha güvenlidir.

## Ham SQL ne zaman?

ORM, CRUD'un ve basit ilişkilerin yüzde doksanını iyi yapar. Şu durumlarda ham SQL daha açık ve hızlıdır:

- Pencere fonksiyonları, CTE'ler, `GROUP BY` ile karmaşık raporlar.
- Veritabanına özgü özellikler: full-text arama, `pg_trgm`, JSONB operatörleri. Bu projenin arama servisi tam olarak bu nedenle `prisma.$queryRaw` ile `ts_rank` ve `ts_headline` kullanır.
- Toplu `INSERT ... ON CONFLICT` ve tek ifadede çok satırlı güncellemeler.

Kural: ham SQL'i yalnızca etiketli şablonla (`$queryRaw` ve `Prisma.sql`) yazın; değerler parametre olarak gider. `$queryRawUnsafe` ile kullanıcı girdisini dizeye eklemek SQL enjeksiyonu demektir.

:::realworld{company="Supabase"}
Supabase her projeye ayrılmış bir PostgreSQL veritabanı verir ve kullanıcılarının önemli bir kısmı uygulamalarını sunucusuz fonksiyonlarda ve edge ortamlarında çalıştırır. Bu ortamlarda bağlantılar kısa ömürlüdür ve aynı anda çok sayıda örnek açılır; doğrudan bağlanan her örnek ayrı bir Postgres arka uç süreci demektir. Supabase uzun süre her veritabanının yanında PgBouncer çalıştırdı. Ardından, çok kiracılı ve yatay ölçeklenebilen bir havuzlayıcıya ihtiyaç duyduğu için Elixir ile **Supavisor**'u yazdı ve açık kaynak olarak yayımladı. Supavisor, PgBouncer gibi çok sayıda istemci bağlantısını az sayıda gerçek Postgres bağlantısına çoklar; transaction ve session kiplerini destekler ve kiracı başına havuz ayarları tutar. Supabase belgeleri de bu dersteki ayrımı yapar: uzun ömürlü sunucular doğrudan ya da session kipinde, sunucusuz fonksiyonlar transaction kipindeki havuzlayıcı üzerinden bağlanmalıdır.
:::

:::callout{tone="tip" title="Mülakat özeti"}
- Havuz tükenmesinde ilk soru "kim bağlantıyı uzun tutuyor?" olmalı; havuzu büyütmek çoğu zaman veritabanını yorar.
- Havuzun en önemli metriği bekleme süresidir; Prisma'da zaman aşımı `P2024` olarak görünür.
- N+1 → eager loading (`include`), toplu `IN` sorgusu ya da JOIN; GraphQL'de DataLoader.
- Sunucusuz mimaride her örnek kendi havuzunu açar: harici havuzlayıcı (PgBouncer/Supavisor) ve küçük `connection_limit`.
- Ham SQL yasak değildir; parametreli yazıldığı sürece raporlar ve veritabanına özgü özellikler için doğru araçtır.
:::

:::quiz{src="quiz.json"}
:::

:::resources
- [Prisma: Connection pool](https://www.prisma.io/docs/orm/prisma-client/setup-and-configuration/databases-connections/connection-pool) — belge — connection_limit, pool_timeout ve varsayılan boyut
- [Prisma: Query optimization](https://www.prisma.io/docs/orm/prisma-client/queries/query-optimization-performance) — belge — N+1, findUnique toplama ve relationLoadStrategy
- [PgBouncer: Features](https://www.pgbouncer.org/features.html) — belge — kiplerin hangi oturum özelliklerini desteklediği
- [graphql/dataloader](https://github.com/graphql/dataloader) — depo — toplama ve istek içi önbellek
- [HikariCP: About Pool Sizing](https://github.com/brettwooldridge/HikariCP/wiki/About-Pool-Sizing) — makale — küçük havuzun neden daha hızlı olduğu
:::

:::next{lesson="d-09-zero-downtime-migrations"}
Sırada: uygulama çalışırken şemayı değiştirmek — expand/contract, CONCURRENTLY indeks ve partili backfill.
:::

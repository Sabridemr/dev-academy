---
id: d-05-read-write-scaling
slug: read-write-scaling
module: d-database-design
order: 5
title:
  tr: "Okuma/Yazma Ölçekleme: Read Replica, Connection Pool, Sharding"
  en: "Read/Write Scaling: Read Replicas, Connection Pools, Sharding"
summary:
  tr: Replika gecikmesi, havuz boyutlandırma, shard anahtarı seçimi.
  en: Replica lag, pool sizing, shard key selection.
durationMinutes: 35
level: advanced
tags: [database, scaling, replication, sharding, connection-pool, consistent-hashing]
prerequisites: [d-03-transactions-acid-isolation, a-03-horizontal-vertical-scaling, a-11-consistent-hashing-sharding, a-12-replication]
concepts: [read-replica, replication-lag, read-your-writes, connection-pooling, pool-sizing, sharding, shard-key, hot-shard, consistent-hashing, resharding, cross-shard-query]
---

## Kavram: önce okumayı, sonra bağlantıyı, en son yazmayı ölçekle

Tek bir veritabanı sunucusu şaşırtıcı derecede ileri gider: doğru indekslenmiş bir PostgreSQL on binlerce sorgu/saniye kaldırır. Ancak büyüyen her sistem aynı sırayla üç duvara çarpar:

1. **Okuma duvarı** — CPU okuma sorgularına yetmez → **read replica**.
2. **Bağlantı duvarı** — yüzlerce uygulama pod'u binlerce bağlantı açar, veritabanı bağlantı başına süreç/bellek tüketir → **connection pooling**.
3. **Yazma duvarı** — tek lider diskin ve CPU'nun yazma kapasitesini aşar, veri tek makineye sığmaz → **sharding**.

Sıra önemlidir: sharding en pahalı ve en geri dönüşsüz adımdır; ilk ikisi tükenmeden oraya gidilmez.

:::diagram{src="diagram.svg" alt="Üç ölçekleme katmanı: uygulama pod'ları, PgBouncer havuzu, birincil ve iki read replica, altta kullanıcı kimliğine göre dört shard|Three scaling layers: application pods, a PgBouncer pool, a primary with two read replicas, and four shards keyed by user id below"}
Okumalar replikalara, yazmalar birincile; bağlantılar havuzda toplanır; veri büyüyünce kullanıcı kimliğine göre shard'lara bölünür.
:::

## Read replica ve replication lag

Birincil (primary/leader) her yazmayı **WAL** (write-ahead log) olarak kaydeder; replikalar bu logu akış hâlinde alıp uygular. Uygulama `SELECT`'leri replikalara, `INSERT/UPDATE/DELETE`'i birincile gönderir. Varsayılan replikasyon **asenkron**dur: birincil commit'i onaylamak için replikayı beklemez. Sonuç: replika birkaç milisaniye ile birkaç saniye arasında **geride** kalır (replication lag).

Bu gecikmenin klasik belirtisi **read-your-writes** ihlalidir: kullanıcı profilini günceller (birincile yazılır), sayfa yenilenir (replikadan okunur), eski değeri görür ve "kaydedilmedi" sanıp tekrar dener.

:::animation{scene="scene.json"}
Yazma birincile gider, replika henüz uygulamamışken okuma bayat döner; çözüm olarak yazma sonrası birincile yönlendirme ve LSN bekleme.
:::

### Lag'e karşı dört strateji

| Strateji | Nasıl? | Bedel |
|---|---|---|
| **Yazma sonrası yapışkanlık** | Kullanıcı yazdıktan sonra N saniye (ör. 5 s) onun okumalarını birincile yolla (çerez/oturumda `last_write_at`) | Basit; birincile biraz yük |
| **LSN/GTID bekleme** | Yazmanın log konumunu (`pg_current_wal_lsn()`) istemciye ver; okuma, replika o konuma ulaşana kadar bekler ya da birincile düşer | Kesin; biraz karmaşık |
| **Kritik okumaları birincile** | Ödeme onayı, bakiye, yetki kontrolü hep birincilden | Kolay kural; disiplin ister |
| **Senkron replika** | En az bir replika onaylamadan commit dönmez (`synchronous_commit = on`) | Yazma gecikmesi artar; replika düşünce yazma durur |

:::code{lang="ts" title="Okuma/yazma ayrımı ve read-your-writes: yazma sonrası birincile yapışma"}
```ts
import { Pool } from 'pg';

const primary = new Pool({ host: 'db-primary', max: 20 });
const replicas = [new Pool({ host: 'db-replica-1', max: 40 }), new Pool({ host: 'db-replica-2', max: 40 })];
const STICKY_MS = 5_000;                     // yazma sonrası bu süre boyunca birincilden oku
let rr = 0;

interface Ctx { userId: string; lastWriteAt?: number; lastWriteLsn?: string }

/** Yazma: her zaman birincil. Yazmanın WAL konumunu bağlama kaydeder. */
export async function write(ctx: Ctx, sql: string, params: unknown[]) {
  const client = await primary.connect();
  try {
    const res = await client.query(sql, params);
    const { rows } = await client.query('SELECT pg_current_wal_lsn()::text AS lsn');
    ctx.lastWriteAt = Date.now();
    ctx.lastWriteLsn = rows[0].lsn;          // çereze/oturuma yazılır, sonraki isteklerle geri gelir
    return res;
  } finally {
    client.release();
  }
}

/** Okuma: yakın zamanda yazan kullanıcıyı birincile, diğerlerini replikaya yönlendirir. */
export async function read(ctx: Ctx, sql: string, params: unknown[], opts: { critical?: boolean } = {}) {
  const recentlyWrote = ctx.lastWriteAt !== undefined && Date.now() - ctx.lastWriteAt < STICKY_MS;
  if (opts.critical || recentlyWrote) return primary.query(sql, params);

  const replica = replicas[rr++ % replicas.length];     // basit round-robin
  if (ctx.lastWriteLsn) {
    // Replika kullanıcının son yazmasını uygulamış mı? Değilse birincile düş.
    const { rows } = await replica.query('SELECT pg_last_wal_replay_lsn() >= $1::pg_lsn AS caught_up', [ctx.lastWriteLsn]);
    if (!rows[0].caught_up) return primary.query(sql, params);
  }
  return replica.query(sql, params);
}
```
```python
import time, psycopg_pool

primary = psycopg_pool.ConnectionPool("host=db-primary", max_size=20)
replicas = [psycopg_pool.ConnectionPool(f"host=db-replica-{i}", max_size=40) for i in (1, 2)]
STICKY_S = 5.0
_rr = 0

def write(ctx: dict, sql: str, params=()):
    """Yazma her zaman birincile; WAL konumunu bağlama kaydet."""
    with primary.connection() as conn:
        conn.execute(sql, params)
        ctx["last_write_lsn"] = conn.execute("SELECT pg_current_wal_lsn()::text").fetchone()[0]
        ctx["last_write_at"] = time.time()

def read(ctx: dict, sql: str, params=(), critical=False):
    global _rr
    recently_wrote = time.time() - ctx.get("last_write_at", 0) < STICKY_S
    if critical or recently_wrote:
        with primary.connection() as conn:
            return conn.execute(sql, params).fetchall()
    pool = replicas[_rr % len(replicas)]; _rr += 1
    with pool.connection() as conn:
        lsn = ctx.get("last_write_lsn")
        if lsn and not conn.execute("SELECT pg_last_wal_replay_lsn() >= %s::pg_lsn", (lsn,)).fetchone()[0]:
            with primary.connection() as p:          # replika geride: birincile düş
                return p.execute(sql, params).fetchall()
        return conn.execute(sql, params).fetchall()
```
:::

## Connection pooling: daha az bağlantı, daha çok iş

PostgreSQL her bağlantı için ayrı bir süreç başlatır (~5–10 MB bellek) ve bağlantı sayısı arttıkça kilit yöneticisi, paylaşımlı bellek ve bağlam değiştirme maliyeti büyür. 500 pod × 20 bağlantı = 10.000 bağlantı bir veritabanını **hiç sorgu çalıştırmadan** çökertir. Çözüm iki kademeli havuzdur: uygulama içi küçük havuz + veritabanının önünde **PgBouncer** gibi merkezi bir havuz.

:::diagram{src="pooling.svg" alt="Yüzlerce uygulama bağlantısının PgBouncer'da az sayıda gerçek veritabanı bağlantısına çoklanması ve havuz boyutu formülü|Hundreds of application connections multiplexed by PgBouncer onto a few real database connections, with the pool size formula"}
Transaction pooling modunda bir sunucu bağlantısı yalnızca bir transaction süresince istemciye ayrılır; aradaki boşluklarda başkasına verilir.
:::

### Havuz boyutu formülü

Sezgiye aykırı gerçek: veritabanı, **az sayıda** bağlantıyla daha hızlıdır. PostgreSQL topluluğunun (ve HikariCP'nin) önerdiği başlangıç formülü:

```
pool_size = (core_count × 2) + effective_spindle_count
```

8 çekirdekli, SSD'li bir sunucu için `(8 × 2) + 1 ≈ 17–20` aktif bağlantı; binlerce eşzamanlı istek bu bağlantıları **sırayla** kullanır. Daha fazla bağlantı, aynı CPU için sıra beklemek yerine kilit çekişmesi ve bağlam değiştirme demektir. Bekleyen istekler havuz kuyruğunda durur; kuyruk süresi (`pool wait time`) izlenmesi gereken en önemli metriktir.

| PgBouncer modu | Bağlantı ne zaman geri verilir? | Kısıt |
|---|---|---|
| session | İstemci bağlantıyı kapatınca | Çoklama yok; yalnızca bağlantı açma maliyetini kurtarır |
| **transaction** (en yaygın) | Her transaction sonunda | Oturum durumu (`SET`, prepared statement, advisory lock) taşınmaz |
| statement | Her ifade sonunda | Çok ifadeli transaction yasak |

:::callout{tone="warning" title="Havuz tıkanıklığı zincirleme çöker"}
Yavaş tek bir sorgu (ör. indekssiz rapor) havuzdaki bağlantıları işgal eder; diğer istekler havuz kuyruğunda bekler, uygulama zaman aşımına düşer, yük dengeleyici pod'u sağlıksız sayar, kalan pod'lara daha çok istek gelir. Önlem: `statement_timeout` (ör. 5 s), ayrı rapor havuzu/replikası ve havuz bekleme süresi için alarm.
:::

## Sharding: yazmayı ve veriyi bölmek

Replika yazmayı ölçeklemez; tüm yazmalar hâlâ tek birincile gider. Veri ya da yazma hacmi tek makineyi aştığında tablo **yatay olarak** bölünür: her **shard** verinin bir alt kümesini tutan bağımsız bir veritabanıdır. Hangi satırın hangi shard'a gideceğini **shard key** belirler.

### Stratejiler

| Strateji | Nasıl? | Artı | Eksi |
|---|---|---|---|
| **Range** | `user_id 1–1M → shard 1, 1M–2M → shard 2` | Aralık sorguları tek shard'da | Yeni kullanıcılar hep son shard'a: sıcak nokta |
| **Hash** | `shard = hash(user_id) mod N` | Düzgün dağılım | N değişince neredeyse tüm veri taşınır |
| **Consistent hashing** | Halka üzerinde sanal düğümler | Düğüm ekleyince yalnızca 1/N taşınır | Aralık sorgusu yok |
| **Directory** | Ayrı bir arama tablosu: `tenant → shard` | Tam kontrol, kolay taşıma | Dizin tek hata noktası; ek sorgu |
| **Geo** | Kullanıcının bölgesine göre | Veri yerelliği, mevzuat (GDPR) | Taşınan kullanıcı, bölgeler arası sorgu |

:::interactive{type="consistent-hashing" nodes=4 virtualNodes=100 keys=200}
Dört shard'lı halkada anahtar dağılımını izleyin. Önce sanal düğüm sayısını 1'e düşürüp dağılımın nasıl bozulduğunu görün; sonra 100'e çıkarın. Bir shard ekleyin ve taşınan anahtar oranını mod-N hash ile karşılaştırın (beklenen: yaklaşık 1/5'e karşı yaklaşık 4/5).
:::

### Shard key seçimi: en önemli karar

İyi bir shard key üç özelliği aynı anda taşır:

1. **Yüksek kardinalite ve düzgün dağılım**: `country` kötü (3 değer tüm trafiği taşır), `user_id` iyi.
2. **Sorgu yerelliği**: En sık sorgular tek shard'a düşmeli. Bir kullanıcının siparişleri `user_id` ile shard'lanırsa "siparişlerim" tek shard'dır; `order_id` ile shard'lanırsa N shard'a dağılır (scatter-gather).
3. **Sıcak nokta direnci**: Ünlü hesap, büyük kiracı ya da `created_at` gibi monoton artan anahtarlar tek shard'ı ezer. Çözüm: bileşik anahtar (`tenant_id + hash(order_id)`), büyük kiracıyı kendi shard'ına taşıma ya da anahtara tuz ekleme.

### Sharding'in gizli maliyetleri

- **Cross-shard sorgu**: `JOIN` ve `GROUP BY` shard sınırını aşamaz; ya uygulama katmanında birleştirirsiniz ya da veriyi iki farklı anahtarla kopyalarsınız.
- **Cross-shard transaction**: İki shard'ı tek atomik işlemde güncellemek için 2PC ya da saga gerekir; ikisi de pahalı ve kırılgandır.
- **Benzersiz kimlik**: Auto-increment shard'lar arasında çakışır; Snowflake benzeri kimlikler (zaman + shard id + sayaç) ya da UUIDv7 kullanılır.
- **Resharding**: Shard sayısını değiştirmek canlı veri taşıma demektir. Baştan **mantıksal shard** sayısını büyük tutup (ör. 4096) bunları az sayıda fiziksel sunucuya eşlemek, ileride yalnızca eşlemeyi değiştirmenizi sağlar.

:::code{lang="ts" title="Mantıksal shard → fiziksel sunucu yönlendirmesi"}
```ts
import { createHash } from 'node:crypto';
import { Pool } from 'pg';

const LOGICAL_SHARDS = 4096;                    // baştan büyük: resharding yalnızca eşlemeyi değiştirir
const physical: Pool[] = [0, 1, 2, 3].map((i) => new Pool({ host: `db-shard-${i}`, max: 20 }));

/** Mantıksal shard → fiziksel sunucu eşlemesi; konfigürasyondan/dizin tablosundan gelir, canlı güncellenebilir. */
const shardMap = new Map<number, number>();
for (let s = 0; s < LOGICAL_SHARDS; s++) shardMap.set(s, s % physical.length);

export function logicalShardOf(key: string): number {
  // Kriptografik olmayan hızlı bir hash de olur; önemli olan düzgün dağılım ve kararlılık
  const h = createHash('md5').update(key).digest();
  return h.readUInt32BE(0) % LOGICAL_SHARDS;
}

export function poolFor(shardKey: string): Pool {
  const logical = logicalShardOf(shardKey);
  const phys = shardMap.get(logical)!;
  return physical[phys];
}

// Kullanım: kullanıcının siparişleri hep aynı shard'da → "siparişlerim" tek sorgu
export async function ordersOf(userId: string) {
  const { rows } = await poolFor(userId).query('SELECT * FROM orders WHERE user_id = $1 ORDER BY id DESC LIMIT 50', [userId]);
  return rows;
}

// Yeni fiziksel sunucu ekleme: yalnızca bazı mantıksal shard'ların eşlemesi değişir, veri o kadar taşınır
export function addPhysical(pool: Pool) {
  physical.push(pool);
  const target = physical.length - 1;
  for (const [logical, phys] of shardMap) {
    if (logical % physical.length === target && phys !== target) shardMap.set(logical, target); // taşıma işi tetiklenir
  }
}
```
:::

:::realworld{company="Meta"}
Instagram, PostgreSQL'i ilk günden **mantıksal shard** yaklaşımıyla böldü: binlerce mantıksal shard (her biri bir PostgreSQL *schema*), az sayıda fiziksel sunucuya eşlendi; sunucu eklemek yalnızca bazı şemaları taşımak demekti. Benzersiz kimlik için 64 bitlik bir sayı ürettiler: 41 bit milisaniye zaman damgası + 13 bit mantıksal shard id + 10 bit shard içi sayaç — böylece bir `media_id`'ye bakarak verinin hangi shard'da olduğu **hesaplanabiliyor**, dizin sorgusu gerekmiyordu. Shard key kullanıcı kimliğiydi; bir kullanıcının fotoğrafları, beğenileri ve yorumları aynı shard'da durduğu için profil sayfası tek shard sorgusuydu. Okuma tarafında her shard'ın replikaları ve önünde PgBouncer vardı; Meta bugün aynı prensipleri çok daha büyük ölçekte TAO ve MySQL üzerinde uyguluyor.
:::

:::callout{tone="tip" title="Mülakat özeti"}
- Sıra: indeks ve sorgu optimizasyonu → read replica → cache → connection pool → **en son** sharding.
- Replica lag sorulduğunda cevap: read-your-writes için yazma sonrası yapışkanlık ya da LSN bekleme; kritik okumalar birincilden.
- Havuz boyutu küçük tutulur: `(çekirdek × 2) + disk`; darboğaz havuz bekleme süresiyle izlenir.
- Shard key için üç soru: dağılım düzgün mü, sık sorgular tek shard'a mı düşüyor, sıcak nokta var mı?
- "Cross-shard JOIN nasıl yaparsınız?" sorusuna hazır olun: yapmazsınız — veriyi sorguya göre kopyalar ya da uygulama katmanında birleştirirsiniz.
:::

:::quiz{src="quiz.json"}
:::

:::next{lesson="d-06-example-schemas"}
Sırada: öğrendiklerinizi dört gerçek şemaya uygulayın — e-ticaret, sosyal medya, ödeme sistemi ve mesajlaşma.
:::

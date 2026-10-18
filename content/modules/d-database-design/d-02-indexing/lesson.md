---
id: d-02-indexing
slug: indexing
module: d-database-design
order: 2
title:
  tr: "İndeksleme: B-tree, Hash, Composite — Sorgu Planı"
  en: "Indexing: B-tree, Hash, Composite — Query Plans"
summary:
  tr: İndeksin sorgu planını nasıl değiştirdiğini animasyonla izleyin.
  en: Watch how an index changes the query plan.
durationMinutes: 30
level: intermediate
tags: [database, indexing, b-tree, query-plan, performance]
prerequisites: [d-01-relational-modeling-normalization]
concepts: [index, b-tree, hash-index, composite-index, leftmost-prefix, covering-index, query-plan, explain, selectivity, write-amplification]
---

## Kavram: indeks, tabloya giden kısa yol

Bir tabloda `WHERE email = 'ali@example.com'` koşulunu sağlayan satırı bulmak için veritabanının iki seçeneği vardır: **tüm satırları tek tek okumak** (sequential scan, O(N)) ya da önceden sıralanmış bir **indeksten** satırın yerini öğrenip doğrudan gitmek (O(log N)). İndeks, kitabın arkasındaki dizin gibidir: "ali@example.com → sayfa 4.812".

Bedeli: her `INSERT`/`UPDATE`/`DELETE` indeksleri de güncellemek zorundadır (**write amplification**) ve indeks disk ile bellek tüketir. Bu yüzden indeksleme "ne kadar çok o kadar iyi" değil, **sorgu desenine göre seçilen** bir yatırımdır.

:::diagram{src="diagram.svg" alt="Üç seviyeli B-tree: kök, iç düğümler ve bağlı yaprak sayfaları; yaprağa işaret eden heap satırı|A three-level B-tree: root, internal nodes and linked leaf pages; a heap row pointed to from a leaf"}
PostgreSQL B-tree'de yapraklar birbirine bağlıdır; aralık sorguları yaprak zincirini soldan sağa yürür. Her yaprak girdisi heap'teki fiziksel satır adresini (TID) taşır.
:::

## B-tree: neredeyse her şeyin varsayılanı

B-tree (dengeli ağaç) sıralı anahtarları sayfalara böler. Kök sayfadan başlayıp her seviyede "aradığım değer hangi aralıkta?" sorusunu sorar; 3–4 seviyede milyarlarca satıra ulaşır çünkü her sayfa yüzlerce anahtar tutar (8 KB sayfa, dallanma faktörü ~300–500).

Desteklediği işlemler:

- Eşitlik: `WHERE id = 42`
- Aralık: `WHERE created_at BETWEEN ... AND ...`, `<`, `>`
- Önek: `WHERE email LIKE 'ali%'` (başta `%` yoksa)
- Sıralama: `ORDER BY created_at` indeks sırasını kullanıp sort adımını atlar
- `MIN`/`MAX`: en sol/en sağ yaprağa tek iniş

Aşağıdaki animasyon tek bir eşitlik sorgusunun ağaçta iniş yolunu, sonra aynı sorgunun hash indeksle ve composite indeksle nasıl değiştiğini gösterir.

:::animation{scene="scene.json"}
Sequential scan ile indeksli aramanın karşılaştırması; kök → iç düğüm → yaprak → heap yolu.
:::

## Hash indeks: yalnızca eşitlik, ama O(1)

Hash indeks anahtarı hash'leyip kovaya (bucket) koyar. `=` sorgularında B-tree'den biraz daha hızlı ve daha küçüktür; ancak **aralık, sıralama ve önek** sorgularını hiç destekleyemez çünkü hash değerleri sırasızdır. PostgreSQL 10+ ile hash indeksler WAL'lanır ve güvenlidir; yine de pratikte yalnızca çok uzun anahtarlar (URL, token) için eşitlik aramasında tercih edilir. MySQL InnoDB'de kullanıcı hash indeks oluşturamaz; motor kendi "adaptive hash index"ini B-tree üstünde otomatik kurar.

| | **B-tree** | **Hash** |
|---|---|---|
| Eşitlik | ✓ O(log N) | ✓ O(1) ortalama |
| Aralık / sıralama / önek | ✓ | ✗ |
| Çok sütunlu (composite) | ✓ | ✗ |
| Boyut | Daha büyük | Daha küçük |
| Tipik kullanım | Varsayılan | Uzun anahtarlı eşitlik |

## Composite indeks ve en-soldaki önek kuralı

`CREATE INDEX ON orders (customer_id, status, created_at)` üç sütunu **sözlük sırasında** birleştirir: önce customer_id'ye, eşitse status'a, eşitse created_at'e göre sıralı. Sonuç olarak indeks yalnızca **soldan başlayan kesintisiz öneklerle** verimli kullanılabilir:

| Sorgu koşulu | İndeksi kullanır mı? | Neden |
|---|---|---|
| `customer_id = 7` | ✓ | En sol sütun |
| `customer_id = 7 AND status = 'paid'` | ✓ | İlk iki sütun |
| `customer_id = 7 AND status = 'paid' AND created_at > ...` | ✓ tam | Üç sütun; aralık en sonda |
| `customer_id = 7 AND created_at > ...` | kısmen | status atlanınca created_at için yalnızca filtre |
| `status = 'paid'` | ✗ | En sol sütun yok; telefon rehberinde ada göre arama gibi |
| `created_at > ...` | ✗ | Aynı neden |

Sütun sırası kuralı: **eşitlik koşullu sütunlar önce, aralık koşullu sütun en sonda**. Aralık sütunundan sonra gelen sütunlar artık sıralı değildir ve yalnızca filtre olarak kullanılır.

:::callout{tone="info" title="Covering index ve index-only scan"}
Sorgunun ihtiyaç duyduğu tüm sütunlar indekste varsa veritabanı heap'e hiç gitmez (index-only scan). PostgreSQL'de `CREATE INDEX ... (customer_id, status) INCLUDE (total_amount)` ile sıralamaya katılmayan ama "yanında taşınan" sütun eklenir. Bu, en çok okunan birkaç sorguyu 5–10 kat hızlandırabilen ucuz bir numaradır.
:::

## Sorgu planını okumak: EXPLAIN

Planlayıcı, tablo istatistiklerine (satır sayısı, değer dağılımı) bakarak her alternatifin maliyetini tahmin eder ve en ucuzunu seçer. `EXPLAIN (ANALYZE, BUFFERS)` hem tahmini hem gerçek sayıları gösterir:

:::code{lang="sql" title="EXPLAIN ANALYZE: indeks öncesi ve sonrası"}
```sql
-- İndeks yokken
EXPLAIN (ANALYZE, BUFFERS)
SELECT id, total_amount FROM orders WHERE customer_id = 4821 AND status = 'paid';

-- Seq Scan on orders  (cost=0.00..21845.00 rows=12 width=16) (actual time=0.03..187.4 rows=11 loops=1)
--   Filter: ((customer_id = 4821) AND (status = 'paid'))
--   Rows Removed by Filter: 999989
--   Buffers: shared hit=9346
-- Execution Time: 187.6 ms

CREATE INDEX CONCURRENTLY orders_customer_status_idx
  ON orders (customer_id, status) INCLUDE (total_amount);

-- İndeks sonrası
-- Index Only Scan using orders_customer_status_idx on orders
--   (cost=0.42..8.61 rows=12 width=16) (actual time=0.02..0.04 rows=11 loops=1)
--   Index Cond: ((customer_id = 4821) AND (status = 'paid'))
--   Heap Fetches: 0
--   Buffers: shared hit=4
-- Execution Time: 0.07 ms
```
:::

Okurken dikkat edilecek üç şey:

1. **Düğüm tipi**: `Seq Scan` (tam tarama), `Index Scan` (indeks + heap), `Index Only Scan` (yalnızca indeks), `Bitmap Heap Scan` (çok satır dönen indeks aramaları için).
2. **rows tahmini vs. actual rows**: 100 kat fark varsa istatistikler bayattır → `ANALYZE orders`.
3. **Buffers**: okunan sayfa sayısı; gerçek I/O maliyetinin en dürüst göstergesi.

:::interactive{type="index-query-plan" table="orders" rows=1000000 columns="customer_id,status,created_at,total_amount" query="customer_id = 4821 AND status = 'paid'"}
Sorguyu ve indeks tanımını değiştirin: önce indekssiz planı inceleyin, sonra (customer_id), (status, customer_id) ve (customer_id, status) indekslerini sırayla deneyip tahmini maliyetin ve okunan sayfa sayısının nasıl değiştiğini karşılaştırın. created_at aralığını ortaya koyduğunuzda en-soldaki önek kuralının etkisini gözlemleyin.
:::

## Seçicilik: planlayıcı neden bazen indeksi kullanmaz?

`status` sütununun yalnızca üç değeri varsa (`paid`, `pending`, `cancelled`) ve satırların %70'i `paid` ise, `WHERE status = 'paid'` için indeks kullanmak **daha yavaştır**: planlayıcı 700 bin satır için rastgele heap erişimi yerine sıralı taramayı seçer. Kural: bir indeks ancak sorgu satırların küçük bir yüzdesini (kabaca %5–10'dan azını) döndürdüğünde kazandırır. Düşük seçicilikli sütunlar için çözüm **partial index**tir: `CREATE INDEX ON orders (created_at) WHERE status = 'pending'` yalnızca bekleyen siparişleri indeksler ve çok küçük kalır.

:::code{lang="ts" title="Sorgu planını üretimde yakalamak: yavaş sorgu dedektörü"}
```ts
import { Pool } from 'pg';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

interface PlanSummary { nodeType: string; indexName?: string; estRows: number; actualRows: number; totalMs: number; seqScan: boolean }

/** Sorguyu EXPLAIN ANALYZE ile çalıştırır ve planın özetini döner (yalnızca staging/okuma replikasında kullanın). */
export async function explainSummary(sql: string, params: unknown[] = []): Promise<PlanSummary> {
  const { rows } = await pool.query(`EXPLAIN (ANALYZE, FORMAT JSON) ${sql}`, params);
  const plan = rows[0]['QUERY PLAN'][0];
  const root = plan.Plan;
  // Plan ağacında bir Seq Scan var mı? (derinlemesine gez)
  const hasSeqScan = (n: any): boolean => n['Node Type'] === 'Seq Scan' || (n.Plans ?? []).some(hasSeqScan);
  return {
    nodeType: root['Node Type'],
    indexName: root['Index Name'],
    estRows: root['Plan Rows'],
    actualRows: root['Actual Rows'],
    totalMs: plan['Execution Time'],
    seqScan: hasSeqScan(root),
  };
}

// CI'da: 100 ms'yi aşan ya da büyük tabloda Seq Scan yapan sorgular için testi düşür
export async function assertIndexed(sql: string, params: unknown[]) {
  const s = await explainSummary(sql, params);
  if (s.seqScan && s.actualRows < 1000) {
    throw new Error(`Seçici sorgu indeks kullanmıyor: ${sql} → ${s.nodeType} (${s.totalMs} ms)`);
  }
  // Tahmin/gerçek oranı 50x'i aşıyorsa istatistikler bayat: ANALYZE gerekir
  if (s.estRows > 0 && Math.max(s.estRows / s.actualRows, s.actualRows / s.estRows) > 50) {
    console.warn(`İstatistik sapması: tahmin ${s.estRows}, gerçek ${s.actualRows}`);
  }
}
```
```python
import json, psycopg

def explain_summary(conn, sql: str, params=()):
    """EXPLAIN ANALYZE çıktısını özetler; Seq Scan içeriyorsa işaretler."""
    with conn.cursor() as cur:
        cur.execute(f"EXPLAIN (ANALYZE, FORMAT JSON) {sql}", params)
        plan = cur.fetchone()[0][0]
    root = plan["Plan"]

    def has_seq_scan(node):
        return node["Node Type"] == "Seq Scan" or any(has_seq_scan(c) for c in node.get("Plans", []))

    return {
        "node_type": root["Node Type"],
        "index_name": root.get("Index Name"),
        "est_rows": root["Plan Rows"],
        "actual_rows": root["Actual Rows"],
        "total_ms": plan["Execution Time"],
        "seq_scan": has_seq_scan(root),
    }
```
:::

## Diğer indeks türleri (bir cümleyle)

- **GIN** (inverted): JSONB, dizi ve tam metin arama — "bu kelime hangi satırlarda geçiyor?"
- **GiST / SP-GiST**: geometri, aralık tipleri, en yakın komşu.
- **BRIN**: fiziksel olarak sıralı dev tablolarda (zaman serisi log) blok aralığı özetleri; çok küçük, aralık sorgularında yeterli.
- **Unique index**: hem kısıt hem indeks; `email` için zaten vardır, bir daha indekslemeyin.
- **Clustered index** (MySQL InnoDB): tablo verisi birincil anahtara göre fiziksel sıralı; ikincil indeksler satır adresi yerine PK değerini taşır, bu yüzden PK'yı kısa tutun.

:::realworld{company="Shopify"}
Shopify, milyonlarca mağazayı aynı MySQL şemalarında (shard başına binlerce mağaza) barındırır. Çok kiracılı bu yapıda kural nettir: **neredeyse her composite indeks `shop_id` ile başlar** — `(shop_id, created_at)`, `(shop_id, status, id)`. Böylece her sorgu önce kendi mağazasının dar aralığına iner, sonra ikinci sütunla süzülür; en-soldaki önek kuralı mimari seviyeye taşınmıştır. Ekip ayrıca her yeni migration'ı production kopyasında `EXPLAIN` ile denetleyen bir araçla indekssiz sorguları koda girmeden yakalar, çünkü 100 milyon satırlık `orders` tablosunda tek bir Seq Scan tüm shard'ı kilitleyebilir.
:::

:::callout{tone="tip" title="Mülakat özeti"}
- İndeks sorusu geldiğinde önce **sorguyu** sorun: hangi sütunlar `WHERE`'de, hangileri `ORDER BY`'da, kaç satır dönüyor?
- Composite sırası: eşitlik → aralık; sorgu en sol sütunu içermiyorsa indeks işe yaramaz.
- "Her sütuna indeks koyarım" cevabı eksi puandır: yazma maliyeti, disk ve planlayıcının kafasının karışması.
- Yavaş sorgunun ilk teşhisi `EXPLAIN ANALYZE`; tahmin/gerçek farkına ve Buffers'a bakın.
:::

:::quiz{src="quiz.json"}
:::

:::next{lesson="d-03-transactions-acid-isolation"}
Sırada: aynı satırı aynı anda değiştiren iki işlem ne olur? ACID, izolasyon seviyeleri ve deadlock.
:::

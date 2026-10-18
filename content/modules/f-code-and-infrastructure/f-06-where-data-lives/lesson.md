---
id: f-06-where-data-lives
slug: where-data-lives
module: f-code-and-infrastructure
order: 6
title:
  tr: "Hangi Veri Nerede Tutulur?"
  en: "Where Does Each Kind of Data Live?"
summary:
  tr: İlişkisel DB, NoSQL, object storage, cache, data warehouse, log/metrik depoları — veri akış diyagramı.
  en: Relational DB, NoSQL, object storage, cache, data warehouse, log/metric stores — data flow diagram.
durationMinutes: 30
level: intermediate
tags: [databases, storage, data-pipeline, cdc, data-warehouse, observability, caching]
prerequisites: [f-05-physical-request-path, a-07-caching]
concepts: [oltp-vs-olap, relational-database, nosql-key-value, object-storage, cache-layer, data-warehouse, change-data-capture, event-stream, data-lake, log-store, metrics-store, time-series, data-retention]
---

## Kavram: tek bir "veritabanı" yoktur, veri türleri vardır

Önceki derste bir sepet isteğinin Redis'e ve Postgres'e dokunduğunu gördük. Ama Amazon benzeri bir şirkette bir siparişin verisi yalnızca o iki yerde yaşamaz. Aynı sipariş, saatler içinde **en az altı farklı depoda** farklı biçimlerde bulunur: işlem veritabanında bir satır, cache'te bir JSON, Kafka'da bir olay, S3'te bir Parquet dosyası, data warehouse'ta bir tablo satırı, Elasticsearch'te bir log belgesi ve Prometheus'ta bir sayaç artışı.

Bunun nedeni basittir: **her erişim deseni farklı bir depo ister.** Bir satırı birincil anahtarla milisaniyede okuyup atomik güncellemek ile üç yıllık 2 milyar siparişi ülkeye göre toplamak aynı motorla verimli yapılamaz. Bu ders "hangi veri nerede durur, oraya nasıl gider ve ne kadar kalır" sorularına cevap verir.

## Depo türleri: karşılaştırma

| Depo | Örnek teknolojiler | Veri biçimi | Güçlü olduğu erişim | Zayıf olduğu | Tipik gecikme | Fiziksel olarak |
|---|---|---|---|---|---|---|
| **İlişkisel DB (OLTP)** | PostgreSQL, MySQL, Aurora | Satır, şema, ilişkiler | Transaction, anahtarla okuma/yazma, join | Büyük analitik tarama, çok yüksek yazma hacmi | 1–10 ms | VM + NVMe disk, primary AZ-a + standby AZ-b |
| **NoSQL key-value / document** | DynamoDB, Cassandra, MongoDB | Anahtar → belge | Öngörülebilir ms gecikme, yatay ölçek, milyonlarca yazma/sn | Ad-hoc sorgular, join, güçlü tutarlılık (varsayılan) | 1–5 ms | Yüzlerce düğüme otomatik bölümlenmiş (partition) |
| **Cache** | Redis, Memcached, ElastiCache | Anahtar → değer, RAM | Sıcak verinin tekrarlı okunması | Kalıcılık, büyük veri | 0,2–1 ms | RAM, servisle aynı AZ |
| **Object storage** | S3, GCS, Azure Blob | Blob (dosya) + metadata | Sınırsız boyut, çok ucuz, 11 dokuz dayanıklılık | Küçük rastgele güncellemeler, düşük gecikme | 10–100 ms | Region içinde en az 3 AZ'ye otomatik kopyalanır |
| **Data warehouse (OLAP)** | Redshift, BigQuery, Snowflake | Sütunsal (columnar), sıkıştırılmış | Milyarlarca satırda toplama, join, raporlama | Tek satır güncelleme, düşük gecikmeli OKU | saniyeler | Ayrı küme / serverless, S3 üzerinde |
| **Data lake** | S3 + Parquet + Glue/Iceberg | Ham ve işlenmiş dosyalar | Ucuz arşiv, ML eğitimi, yeniden işleme | Etkileşimli sorgu (katalog olmadan) | saniyeler–dakikalar | S3 |
| **Event stream** | Kafka, Kinesis, MSK | Append-only log, partition | Yüksek hacimli olay akışı, çoklu tüketici, replay | Rastgele erişim, sorgu | ms (yazma) | Broker'lar 3 AZ'ye yayılmış, disk |
| **Log deposu** | Elasticsearch/OpenSearch, Loki | Yarı yapılı metin belgeleri | Tam metin arama, filtreleme, son N gün | Uzun süreli saklama (pahalı) | saniyeler | Sıcak katman SSD, soğuk katman S3 |
| **Metrik deposu (time series)** | Prometheus, Mimir, CloudWatch, InfluxDB | (zaman, etiketler) → sayı | Toplama, alarm, dashboard | Yüksek kardinaliteli etiketler, ham olay | ms–saniye | Sıkıştırılmış TSDB, uzun dönem S3 |
| **Arama indeksi** | Elasticsearch, OpenSearch | Ters indeks | Ürün arama, fuzzy eşleşme, facet | Doğruluk kaynağı olmak | 10–50 ms | Shard'lar birden çok düğümde |

Üç ayrım tüm tabloyu özetler:

1. **OLTP vs OLAP**: Satır satır işlem (sipariş ver) vs. sütun sütun analiz (aylık ciro). Aynı veri iki motorda da bulunur ama **farklı düzenlenir**.
2. **Doğruluk kaynağı (source of truth) vs türev (derived)**: Postgres/DynamoDB doğruluk kaynağıdır; cache, arama indeksi, warehouse ve dashboard **türevdir** — kaybolursa kaynaktan yeniden üretilir.
3. **Sıcak / ılık / soğuk**: Son 1 saat RAM'de, son 30 gün SSD'de, son 7 yıl S3 Glacier'da. Maliyet kat kat düşer, gecikme kat kat artar.

:::diagram{src="diagram.svg" alt="Bir siparişin verisinin aktığı depolar: uygulama servisleri OLTP veritabanına ve cache'e yazar, CDC değişiklikleri Kafka'ya akıtır, tüketiciler arama indeksini, S3 data lake'i ve data warehouse'u besler, dashboard warehouse'tan okur; yan kanalda loglar Elasticsearch'e, metrikler Prometheus'a gider|The stores an order's data flows through: application services write to the OLTP database and cache, CDC streams changes to Kafka, consumers feed the search index, the S3 data lake and the data warehouse, dashboards read from the warehouse; in a side channel logs go to Elasticsearch and metrics to Prometheus"}
Soldaki doğruluk kaynağından sağdaki türev depolara tek yönlü akış. Hiçbir türev depo geri yazmaz; bozulursa yeniden üretilir.
:::

## Bir siparişin yolculuğu: OLTP → CDC → kuyruk → warehouse → dashboard

Kullanıcı "Siparişi tamamla"ya bastığında şunlar olur:

1. **OLTP yazma**: `orders-service`, Postgres'te tek bir transaction ile `orders` ve `order_items` tablolarına yazar, stok düşer. Commit, AZ-b'deki standby'a senkron kopyalanınca onaylanır. Bu **doğruluk kaynağıdır**.
2. **Cache güncelleme**: Sepet Redis'ten silinir (`DEL cart:u42`), sipariş özeti `order:9001` anahtarıyla kısa TTL ile yazılır; "Siparişlerim" sayfası DB'ye gitmeden açılır.
3. **CDC (Change Data Capture)**: Debezium, Postgres'in **WAL**'ını (write-ahead log) okur ve her satır değişikliğini bir olaya çevirir. Uygulama kodu ikinci bir yazma yapmaz; bu sayede "DB'ye yazdım ama Kafka'ya yazamadım" tutarsızlığı (dual write problemi) ortadan kalkar.
4. **Kafka**: Olay `orders.changes` topic'ine, `order_id` ile bölümlenerek (aynı siparişin olayları sıralı kalır) yazılır. Broker'lar üç AZ'de, replikasyon faktörü 3, saklama 7 gün. Birden fazla tüketici aynı akışı bağımsız okur.
5. **Tüketiciler**: (a) Arama indeksleyici OpenSearch'e yazar — "siparişlerimde ara" çalışır; (b) Lake yazıcı olayları 5 dakikalık Parquet dosyaları hâlinde S3'e (`s3://shop-lake/orders/dt=2026-10-18/`) bırakır; (c) Bildirim servisi e-posta gönderir.
6. **Warehouse yükleme**: Saatlik bir iş (Airflow/Glue) S3'teki Parquet'leri Redshift'e `COPY` eder ya da Snowflake doğrudan S3'ü dış tablo olarak okur. Veri sütunsal sıkıştırılır: 2 milyar sipariş birkaç yüz GB olur.
7. **Dashboard**: Analist "ülkeye göre saatlik ciro" sorgusunu yazar; warehouse yalnızca `country`, `total`, `created_at` sütunlarını tarar, saniyeler içinde döner. Yöneticinin ekranındaki grafik bu sorgunun 5 dakikada bir yenilenmiş hâlidir.

**Gecikme zinciri**: OLTP commit anında; cache 1 ms; Kafka 50–200 ms; arama indeksi 1–2 sn; S3 5 dk; warehouse 1 saat; dashboard 5 dk yenileme. Yani bir sipariş yöneticinin grafiğinde ~1 saat sonra belirir — ve bu **tamamen kabul edilebilir**, çünkü bu dashboard'un kullanıcısı için 1 saatlik tazelik yeterlidir. Gerçek zamanlı istenirse Kafka'dan doğrudan bir stream işleyici (Flink) besler; maliyeti artar.

:::animation{scene="scene.json"}
Bir siparişin verisi: OLTP transaction, cache, CDC ile WAL okuma, Kafka, arama indeksi ve S3 tüketicileri, warehouse yüklemesi ve dashboard; yan kanalda log ve metrikler.
:::

## Yan kanal: loglar ve metrikler nerede?

Sipariş verisinin yanında bir de **gözlemlenebilirlik verisi** üretilir; hacmi iş verisinden çok daha büyüktür ve ayrı depolara gider:

- **Loglar** (`{"level":"info","msg":"order created","order_id":9001,"latency_ms":42}`): Her pod stdout'a JSON yazar; node'daki Fluent Bit sidecar'ı toplar ve **OpenSearch/Elasticsearch**'e (son 14 gün, SSD) ya da **Loki**'ye (etiket indeksli, içerik S3'te, çok daha ucuz) gönderir. 14 günden eski loglar S3'e arşivlenir; uyumluluk için 1–7 yıl tutulur.
- **Metrikler** (`http_requests_total{service="orders",status="201"}`): Prometheus her pod'un `/metrics` ucunu 15 sn'de bir kazır. Zaman serisi olarak sıkıştırılmış tutulur (bir örnek ~1–2 byte); alarm kuralları ve Grafana dashboard'ları buradan okur. Uzun dönem (13 ay) Thanos/Mimir ile S3'te.
- **İzler (traces)**: f-05'teki span'ler Jaeger/Tempo'ya gider; %1–10 örnekleme ile saklanır çünkü hacim devasadır.

Bu üç depo **asla iş mantığının doğruluk kaynağı değildir**; "kaç sipariş alındı" sorusuna cevap Prometheus sayacı değil, warehouse'tur. Metrik yaklaşıktır (örnekleme, pod yeniden başlayınca sayaç sıfırlanır), warehouse kesindir.

:::callout{tone="warning" title="Dual write tuzağı"}
"DB'ye yazdım, sonra Kafka'ya da yazarım" yaklaşımı er geç tutarsızlık üretir: DB commit olur, uygulama Kafka'ya yazamadan çöker; ya da tersi. İki çözüm vardır: **CDC** (DB'nin kendi log'undan olay üretmek) ya da **outbox kalıbı** (olayı aynı transaction içinde bir `outbox` tablosuna yazıp ayrı bir süreçle Kafka'ya taşımak). İkisi de "önce DB, sonra olay — ama atomik" garantisi verir.
:::

:::callout{tone="info" title="Cache'in yeri: türev, geçici, kaybedilebilir"}
Cache tablodaki tek depodur ki kaybı **hiçbir veri kaybı** demek değildir; yalnızca gecikme ve DB yükü artar. Bu yüzden Redis'e "soğuk başlangıç" planı yapılır: cache boşken DB'yi ezmemek için istek birleştirme (request coalescing) ve kademeli ısıtma. a-07'deki cache-aside ve TTL stratejileri tam burada devreye girer.
:::

:::interactive{type="cache" policy="lru" capacity=6 writePolicy="cache-aside" ttlMs=30000}
Anahtarları birer sipariş özeti olarak düşünün. Cache boşken (soğuk) A–H anahtarlarını okuyun ve DB okuma sayacını izleyin; "Rastgele 10 okuma" ile ısındıkça isabet oranının artışını görün. TTL'i kısaltıp uzatın: kısa TTL bayat veriyi azaltır ama DB okumalarını artırır, uzun TTL tam tersi. Yazma politikasını write-through yapıp bir anahtara yazın: cache ve DB aynı anda güncellenir (DB kutusunda "≠ cache" uyarısı hiç çıkmaz) ama her yazma DB yazma sayacını da artırır — tutarlılığın bedeli çift yazmadır.
:::

## Kod: hangi veriyi nereye yazıyoruz?

:::code{lang="ts" title="Sipariş oluşturma: OLTP transaction + outbox + cache; türev depolara dokunmaz"}
```ts
import type { Pool } from 'pg';
import type { Redis } from 'ioredis';

interface OrderInput { userId: string; items: { sku: string; qty: number; unitPrice: number }[] }

/**
 * Doğruluk kaynağı yalnızca Postgres'tir. Kafka'ya, arama indeksine, S3'e ya da
 * warehouse'a BURADAN yazılmaz; hepsi outbox → CDC → Kafka zinciriyle türetilir.
 */
export async function createOrder(db: Pool, redis: Redis, input: OrderInput): Promise<string> {
  const client = await db.connect();
  try {
    await client.query('BEGIN');

    const total = input.items.reduce((s, i) => s + i.qty * i.unitPrice, 0);
    const { rows } = await client.query<{ id: string }>(
      'INSERT INTO orders (user_id, total, status) VALUES ($1, $2, $3) RETURNING id',
      [input.userId, total, 'PLACED'],
    );
    const orderId = rows[0].id;

    for (const item of input.items) {
      await client.query(
        'INSERT INTO order_items (order_id, sku, qty, unit_price) VALUES ($1, $2, $3, $4)',
        [orderId, item.sku, item.qty, item.unitPrice],
      );
      // Stok düşümü aynı transaction'da: ya hepsi ya hiçbiri
      const stock = await client.query('UPDATE inventory SET qty = qty - $1 WHERE sku = $2 AND qty >= $1', [item.qty, item.sku]);
      if (stock.rowCount === 0) throw new Error(`Yetersiz stok: ${item.sku}`);
    }

    // Outbox kalıbı: olay, iş verisiyle AYNI transaction'da yazılır → dual write yok.
    // Debezium outbox tablosunu CDC ile okuyup Kafka'ya (orders.changes) taşır.
    await client.query(
      `INSERT INTO outbox (aggregate_type, aggregate_id, event_type, payload)
       VALUES ('order', $1, 'OrderPlaced', $2)`,
      [orderId, JSON.stringify({ orderId, userId: input.userId, total, items: input.items, placedAt: new Date().toISOString() })],
    );

    await client.query('COMMIT');   // commit, AZ-b'deki standby'a senkron kopyalanınca döner

    // Cache: türev ve geçici. Başarısız olsa bile sipariş geçerlidir; sadece sonraki okuma DB'ye gider.
    await redis
      .multi()
      .del(`cart:${input.userId}`)                                                 // sepet boşaldı
      .set(`order:${orderId}`, JSON.stringify({ orderId, total, status: 'PLACED' }), 'EX', 600) // 10 dk
      .exec()
      .catch((err) => console.warn('cache update failed, continuing', err));

    return orderId;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}
```
```python
import json
from datetime import datetime, timezone

def create_order(conn, redis, user_id: str, items: list[dict]) -> str:
    total = sum(i["qty"] * i["unit_price"] for i in items)
    with conn:                                         # tek transaction: ya hepsi ya hiçbiri
        with conn.cursor() as cur:
            cur.execute("INSERT INTO orders (user_id, total, status) VALUES (%s, %s, 'PLACED') RETURNING id", (user_id, total))
            order_id = cur.fetchone()[0]
            for i in items:
                cur.execute("INSERT INTO order_items (order_id, sku, qty, unit_price) VALUES (%s, %s, %s, %s)",
                            (order_id, i["sku"], i["qty"], i["unit_price"]))
                cur.execute("UPDATE inventory SET qty = qty - %s WHERE sku = %s AND qty >= %s", (i["qty"], i["sku"], i["qty"]))
                if cur.rowcount == 0:
                    raise RuntimeError(f"Yetersiz stok: {i['sku']}")
            # Outbox: olay aynı transaction'da; Debezium CDC ile Kafka'ya taşır
            payload = {"orderId": order_id, "userId": user_id, "total": total, "items": items,
                       "placedAt": datetime.now(timezone.utc).isoformat()}
            cur.execute("INSERT INTO outbox (aggregate_type, aggregate_id, event_type, payload) VALUES ('order', %s, 'OrderPlaced', %s)",
                        (order_id, json.dumps(payload)))
    # Cache türevdir: hata olsa da sipariş geçerli
    try:
        pipe = redis.pipeline()
        pipe.delete(f"cart:{user_id}")
        pipe.set(f"order:{order_id}", json.dumps({"orderId": order_id, "total": total, "status": "PLACED"}), ex=600)
        pipe.execute()
    except Exception as err:
        print("cache update failed, continuing", err)
    return order_id
```
:::

## Saklama (retention) ve maliyet: aynı veri, farklı ömür

| Depo | Saklama | GB başına aylık maliyet (yaklaşık) | Neden |
|---|---|---|---|
| Redis | dakikalar–saatler (TTL) | ~$10+ (RAM) | Yalnızca sıcak veri |
| Postgres (OLTP) | aktif 1–2 yıl, sonra arşiv | ~$0,10–0,25 (SSD) + IOPS | Tablolar büyüdükçe indeksler yavaşlar; eski siparişler bölümlenir (partition) ve S3'e taşınır |
| Kafka | 7 gün (topic'e göre) | ~$0,10 (disk × 3 replika) | Replay penceresi; uzun dönem için S3'e akıtılır |
| OpenSearch (log) | 14 gün sıcak | ~$0,10–0,30 | Pahalı; eski loglar S3'e |
| Prometheus | 15 gün yerel, 13 ay S3 | düşük | Sıkıştırılmış seri |
| S3 Standard → IA → Glacier | 7+ yıl | $0,023 → $0,0125 → $0,004 | Yaşam döngüsü kuralı otomatik taşır |
| Warehouse | 3–5 yıl | ~$0,02–0,05 (sıkıştırılmış, S3 tabanlı) | Analitik için ucuz |

:::realworld{company="Amazon"}
Amazon.com'un sipariş sistemi bu modelin öncüsüdür. 2000'lerin başında tek bir devasa Oracle veritabanına dayanan Amazon, bu modelin ölçeklenmediğini görünce **DynamoDB**'yi geliştirdi: sepet ve sipariş durumu gibi "anahtarla oku-yaz, asla yavaşlama" verisi bugün DynamoDB'de tutulur ve Prime Day'de saniyede 100 milyonun üzerinde isteği tek haneli ms gecikmeyle karşılar. İlişkisel bütünlük gerektiren finansal kayıtlar **Aurora PostgreSQL**'de, ürün görselleri ve faturalar **S3**'te (Amazon'un kendi en büyük müşterisi), değişiklik akışı **DynamoDB Streams + Kinesis/MSK** üzerinden, analitik ise **Redshift**'te ve S3 tabanlı data lake'te (**Lake Formation**) yaşar. Amazon 2019'da son Oracle veritabanını kapattığını duyurduğunda, 75 PB veriyi bu amaca özel depolara taşımıştı. Loglar ve metrikler için dahili sistemlerin yanında **CloudWatch** kullanılır; Amazon'un ünlü ilkesi "her servis kendi dashboard'unu ve alarmını sahiplenir" tam olarak metrik deposunun servis ekiplerine ait olması demektir.
:::

:::callout{tone="tip" title="Mülakat ipuçları"}
- "Veritabanı olarak ne kullanırsınız?" sorusuna **tek bir isimle** cevap vermeyin. Önce erişim desenlerini sayın (işlem, anahtarla okuma, arama, analitik, dosya, log), sonra her birine depo eşleyin.
- **Doğruluk kaynağı tektir**; diğer her şey türevdir ve yeniden üretilebilir. Bu cümle, tutarlılık sorularının çoğunu çözer.
- Analitik ihtiyaç duyulduğunda OLTP'ye rapor sorgusu atmayın: **CDC/outbox → Kafka → warehouse** zincirini çizin ve kabul edilebilir gecikmeyi (dakikalar–saat) söyleyin.
- Log ve metriklerin ayrı depolara gittiğini, farklı saklama süreleri olduğunu ve iş sayıları için kaynak olmadığını belirtin.
:::

:::quiz{src="quiz.json"}
:::

:::next{lesson="f-07-security-layers"}
Verinin nerede durduğunu biliyoruz; şimdi onu kimin, nereden, nasıl koruduğuna bakalım: WAF, DDoS koruması, TLS, IAM ve zero-trust ile derinlemesine savunma.
:::

---
id: d-03-transactions-acid-isolation
slug: transactions-acid-isolation
module: d-database-design
order: 3
title:
  tr: Transaction, ACID, İzolasyon Seviyeleri, Deadlock
  en: Transactions, ACID, Isolation Levels, Deadlocks
summary:
  tr: Dirty read’den serializable’a; deadlock görselleştirmesi.
  en: From dirty reads to serializable; deadlock visualization.
durationMinutes: 35
level: intermediate
tags: [database, transactions, acid, isolation, locking, deadlock]
prerequisites: [d-01-relational-modeling-normalization, a-02-latency-throughput-cap]
concepts: [transaction, acid, atomicity, isolation-level, dirty-read, non-repeatable-read, phantom-read, lost-update, mvcc, lock, deadlock, serializable, optimistic-locking]
---

## Kavram: birden fazla adımı tek bir "ya hep ya hiç"e sarmak

Bir havale iki `UPDATE` ister: gönderenin bakiyesini düşür, alıcınınkini artır. İlk `UPDATE`'ten sonra süreç çökerse para buharlaşır. **Transaction (işlem)**, birden fazla okuma/yazmayı tek bir mantıksal birim yapar: ya tamamı kalıcı olur (`COMMIT`) ya da hiçbiri (`ROLLBACK`). Veritabanı bu garantiyi **ACID** adıyla özetlenen dört özellikle verir.

| Harf | Özellik | Anlamı | Nasıl sağlanır? |
|---|---|---|---|
| **A** | Atomicity (bölünmezlik) | Ya hepsi ya hiçbiri | Undo log / WAL ile geri alma |
| **C** | Consistency (tutarlılık) | Kısıtlar (FK, CHECK, UNIQUE) hep geçerli kalır | Kısıt denetimi; uygulama mantığı |
| **I** | Isolation (yalıtım) | Eşzamanlı işlemler birbirini "görmez" | Kilitler, MVCC |
| **D** | Durability (kalıcılık) | COMMIT dendi mi, elektrik kesilse de kalır | WAL fsync, replikasyon |

Mülakatta en çok karıştırılan harf **C**'dir: buradaki tutarlılık CAP'teki tutarlılık değildir; "işlem öncesi geçerli olan kurallar işlem sonrası da geçerli" demektir.

:::diagram{src="diagram.svg" alt="ACID dört özelliği ve dört izolasyon seviyesinin hangi anomalilere izin verdiğini gösteren matris|The four ACID properties and a matrix of which anomalies each of the four isolation levels permits"}
Sol: bir transaction'ın yaşam döngüsü. Sağ: izolasyon seviyesi yükseldikçe engellenen anomaliler artar, eşzamanlılık azalır.
:::

## İzolasyon: asıl zor olan harf

Tam yalıtım (her işlem sırayla çalışıyormuş gibi) pahalıdır; bu yüzden SQL standardı dört **izolasyon seviyesi** tanımlar ve her biri belirli **okuma anomalilerine** izin verir.

### Anomaliler

- **Dirty read**: Henüz commit edilmemiş veriyi okumak. T2, T1'in yazdığı ama sonra geri aldığı bakiyeyi görür.
- **Non-repeatable read**: Aynı satırı iki kez okuyunca farklı değer görmek; arada T2 commit etmiştir.
- **Phantom read**: Aynı koşullu sorguyu iki kez çalıştırınca farklı **satır kümesi** görmek; arada yeni satır eklenmiştir.
- **Lost update**: İki işlem aynı satırı okuyup "oku-değiştir-yaz" yapar; sonuncusu diğerinin yazdığını ezer.
- **Write skew**: İki işlem ayrı satırları günceller ama kararlarını birbirinin güncellediği veriye dayanarak vermiştir (klasik "nöbetçi doktor" örneği).

### Seviyeler tablosu

| Seviye | Dirty read | Non-repeatable | Phantom | Write skew | Nasıl çalışır (PostgreSQL) |
|---|---|---|---|---|---|
| Read Uncommitted | mümkün* | mümkün | mümkün | mümkün | PG'de Read Committed gibi davranır |
| **Read Committed** (PG varsayılanı) | ✗ | mümkün | mümkün | mümkün | Her *ifade* başında yeni snapshot |
| **Repeatable Read** (MySQL varsayılanı) | ✗ | ✗ | PG'de ✗ | mümkün | *İşlem* başında tek snapshot (MVCC) |
| **Serializable** | ✗ | ✗ | ✗ | ✗ | SSI: tehlikeli bağımlılık tespiti, iptal + yeniden deneme |

\* Standart izin verir; PostgreSQL hiçbir zaman dirty read yapmaz.

Modern motorlar çoğu izolasyonu **MVCC (Multi-Version Concurrency Control)** ile sağlar: her yazma satırın yeni bir sürümünü oluşturur; okuyucular işlemin başladığı andaki sürümü görür. Böylece **okuyucular yazanları, yazanlar okuyucuları engellemez**. Yazan-yazan çakışmasında ise kilit devreye girer.

:::interactive{type="isolation-levels" level="read-committed" scenario="bank-transfer" transactions=2}
Soldaki ve sağdaki transaction'ı adım adım ilerletin. Önce Read Committed'da non-repeatable read'i üretin; Repeatable Read'e geçip aynı adımların neden farklı sonuç verdiğini görün. Son olarak Serializable'da "nöbetçi doktor" senaryosunu çalıştırın ve hangi işlemin serialization failure ile iptal edildiğini inceleyin.
:::

## Kilitler ve deadlock

MVCC okumaları kilitsiz yapar, ama iki işlem aynı satırı **yazmak** isterse ikincisi birincinin bitmesini bekler (row-level exclusive lock). Bekleme zincirleri döngüye dönüşürse **deadlock** oluşur: T1, T2'nin kilidini; T2, T1'inkini bekler. Hiçbiri ilerleyemez.

Veritabanı bunu çözmeyi bilir: periyodik olarak (PostgreSQL'de `deadlock_timeout = 1s`) **wait-for graph** çizer, döngü bulunca bir **kurban** seçer ve onu `40P01 deadlock detected` hatasıyla geri alır. MySQL InnoDB kurbanı "en az undo kaydı olan işlem" olarak seçer; PostgreSQL döngüyü tespit eden işlemi iptal eder.

:::animation{scene="scene.json"}
İki transaction'ın çapraz kilit bekleyişi, deadlock dedektörünün döngüyü bulması ve kurban seçimi.
:::

### Deadlock'tan kaçınmanın üç yolu

1. **Tutarlı kilit sırası**: Kaynakları her zaman aynı sırada kilitleyin (ör. küçük `account_id` önce). Havale örneğinde iki işlem de önce 42'yi sonra 77'yi kilitlerse döngü oluşamaz.
2. **Kısa transaction**: Kilidi tutarken ağ çağrısı, kullanıcı girdisi ya da ağır hesap yapmayın.
3. **Yeniden deneme**: Deadlock ve serialization failure *beklenen* hatalardır; uygulamanız bunları yakalayıp üstel geri çekilmeyle (exponential backoff) tekrar denemelidir.

:::code{lang="ts" title="Deadlock ve serialization failure için yeniden denemeli transaction"}
```ts
import { Pool, PoolClient } from 'pg';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const RETRYABLE = new Set(['40001', '40P01']); // serialization_failure, deadlock_detected

/** Fonksiyonu bir transaction içinde çalıştırır; geçici çakışma hatalarında yeniden dener. */
export async function withTx<T>(fn: (c: PoolClient) => Promise<T>, isolation = 'READ COMMITTED', maxAttempts = 5): Promise<T> {
  for (let attempt = 1; ; attempt++) {
    const client = await pool.connect();
    try {
      await client.query(`BEGIN ISOLATION LEVEL ${isolation}`);
      const result = await fn(client);
      await client.query('COMMIT');
      return result;
    } catch (err: any) {
      await client.query('ROLLBACK').catch(() => undefined);
      if (!RETRYABLE.has(err?.code) || attempt >= maxAttempts) throw err;
      // üstel geri çekilme + jitter: tüm istekler aynı anda tekrar denemesin
      await new Promise((r) => setTimeout(r, 20 * 2 ** attempt + Math.random() * 50));
    } finally {
      client.release();
    }
  }
}

/** Havale: kilitleri her zaman küçük id'den büyüğe alarak deadlock olasılığını sıfırlar. */
export function transfer(from: number, to: number, amount: number) {
  return withTx(async (c) => {
    const [first, second] = from < to ? [from, to] : [to, from];
    // Tutarlı sırada SELECT ... FOR UPDATE: iki havale çapraz bekleyemez
    await c.query('SELECT id FROM accounts WHERE id = $1 FOR UPDATE', [first]);
    await c.query('SELECT id FROM accounts WHERE id = $1 FOR UPDATE', [second]);

    const { rows } = await c.query('SELECT balance FROM accounts WHERE id = $1', [from]);
    if (rows[0].balance < amount) throw new Error('Yetersiz bakiye');

    await c.query('UPDATE accounts SET balance = balance - $2 WHERE id = $1', [from, amount]);
    await c.query('UPDATE accounts SET balance = balance + $2 WHERE id = $1', [to, amount]);
    await c.query('INSERT INTO ledger(from_id, to_id, amount) VALUES ($1, $2, $3)', [from, to, amount]);
  });
}
```
```python
import random, time, psycopg

RETRYABLE = {"40001", "40P01"}  # serialization_failure, deadlock_detected

def with_tx(conn, fn, isolation="READ COMMITTED", max_attempts=5):
    """fn(cur) fonksiyonunu transaction içinde çalıştırır; geçici çakışmalarda yeniden dener."""
    for attempt in range(1, max_attempts + 1):
        try:
            with conn.cursor() as cur:
                cur.execute(f"BEGIN ISOLATION LEVEL {isolation}")
                result = fn(cur)
                cur.execute("COMMIT")
                return result
        except psycopg.Error as e:
            conn.rollback()
            if e.sqlstate not in RETRYABLE or attempt == max_attempts:
                raise
            time.sleep(0.02 * 2 ** attempt + random.random() * 0.05)

def transfer(conn, from_id, to_id, amount):
    def body(cur):
        first, second = sorted((from_id, to_id))  # tutarlı kilit sırası
        cur.execute("SELECT id FROM accounts WHERE id = %s FOR UPDATE", (first,))
        cur.execute("SELECT id FROM accounts WHERE id = %s FOR UPDATE", (second,))
        cur.execute("UPDATE accounts SET balance = balance - %s WHERE id = %s", (amount, from_id))
        cur.execute("UPDATE accounts SET balance = balance + %s WHERE id = %s", (amount, to_id))
    return with_tx(conn, body)
```
:::

## Lost update'e karşı: kötümser mi, iyimser mi?

Read Committed'da "oku → hesapla → yaz" deseni lost update'e açıktır. İki klasik çözüm:

- **Pessimistic (kötümser) kilit**: `SELECT ... FOR UPDATE` ile satırı okurken kilitle; diğer işlem bekler. Çakışma sıkıysa doğru seçim.
- **Optimistic (iyimser) kilit**: Satıra `version` sütunu ekle; `UPDATE ... WHERE id = $1 AND version = $2`. Etkilenen satır 0 ise başkası önce davranmıştır → yeniden oku ve dene. Çakışma seyrekse (web formları, sepet) kilit maliyeti olmadan çalışır.
- **Atomik ifade**: Mümkünse `UPDATE accounts SET balance = balance - 100` gibi tek ifadede yap; veritabanı satır kilidini kendisi alır, okuma-yazma arası boşluk kalmaz.

:::callout{tone="danger" title="Transaction içinde dış çağrı yapmayın"}
Kilit tutarken ödeme sağlayıcısına HTTP isteği atmak en sık görülen üretim kazasıdır: istek 30 saniye takılırsa o satırı bekleyen tüm işlemler kuyruklanır, bağlantı havuzu dolar ve tüm uygulama durur. Kural: transaction yalnızca veritabanı işlemlerini kapsar; dış çağrılar öncesinde ya da sonrasında (outbox deseniyle) yapılır.
:::

## Serializable ne zaman gerekir?

Repeatable Read, çoğu iş akışı için yeterlidir; **write skew** içeren kurallar (en az bir nöbetçi kalmalı, toplam rezervasyon kapasiteyi aşmamalı, kullanıcı adı benzersiz olmalı ama kısıt yok) Serializable ister. PostgreSQL'in SSI'ı kilit koymaz; işlemler arası okuma-yazma bağımlılıklarını izler ve tehlikeli bir desen oluştuğunda birini iptal eder. Bedeli: daha fazla iptal ve zorunlu yeniden deneme mantığı. Alternatif: kuralı veritabanı kısıtına (UNIQUE, EXCLUDE, CHECK) dönüştürmek — kısıtlar her seviyede güvenlidir.

:::realworld{company="Google"}
Google **Spanner**, kıtalar arası dağıtık bir veritabanında bile **external consistency** (serializable + gerçek zaman sırası) verir. Bunu iki parçayla yapar: yazmalar için iki fazlı kilit (2PL) ve Paxos; okumaların sırası için **TrueTime** — GPS ve atom saatleriyle belirsizlik aralığı garanti edilen bir saat API'si. Bir commit, saatin belirsizlik aralığı geçene kadar (tipik olarak birkaç milisaniye) bilinçli olarak *bekletilir* (commit-wait); böylece sonraki hiçbir işlem ondan önce olmuş gibi görünemez. Google AdWords'ün faturalama sistemi bu garantiye dayanır: reklam harcaması ve bütçe güncellemeleri farklı veri merkezlerinde yapılsa bile hiçbir hesap bütçesini aşamaz. Mülakat çıkarımı: güçlü izolasyon dağıtık sistemde imkânsız değildir, ama gecikme olarak ödenir.
:::

:::callout{tone="tip" title="Mülakat özeti"}
- ACID'deki C ile CAP'teki C'yi karıştırmayın; ilki kısıtların korunması, ikincisi replikalar arası aynılıktır.
- Anomali adlarını örnekle anlatabilin: dirty (commit edilmemiş), non-repeatable (aynı satır farklı değer), phantom (farklı satır kümesi), write skew (ayrı satırlar, bozulan kural).
- Deadlock'a cevap: tutarlı kilit sırası + kısa işlem + yeniden deneme. "Veritabanı zaten tespit eder" demek yetmez; uygulama hatayı ele almalıdır.
- Lost update için önce atomik `UPDATE`, sonra optimistic version, en son `FOR UPDATE`.
:::

:::quiz{src="quiz.json"}
:::

:::next{lesson="d-04-sql-vs-nosql"}
Sırada: ilişkisel modelin bu garantilerinden ne zaman vazgeçilir? Key-value, document, wide-column, graph ve time-series veritabanlarının karşılaştırması.
:::

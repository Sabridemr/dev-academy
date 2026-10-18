---
id: d-06-example-schemas
slug: example-schemas
module: d-database-design
order: 6
title:
  tr: "Örnek Şemalar: E-ticaret, Sosyal Medya, Ödeme, Mesajlaşma"
  en: "Example Schemas: E-commerce, Social Media, Payments, Messaging"
summary:
  tr: Gerçek dünyadan dört şema ve tasarım kararları.
  en: Four real-world schemas and their design decisions.
durationMinutes: 40
level: advanced
tags: [database, schema-design, er-diagram, e-commerce, social, payments, messaging]
prerequisites: [d-01-relational-modeling-normalization, d-03-transactions-acid-isolation, d-05-read-write-scaling]
concepts: [schema-design, order-transaction, inventory-reservation, idempotency-key, double-entry-ledger, append-only, fan-out, conversation-model, soft-delete, shard-key, outbox-pattern]
---

## Kavram: şema, iş kurallarının veritabanına çevirisidir

Önceki beş derste araçları öğrendik: normalizasyon, indeks, transaction, model seçimi, ölçekleme. Bu derste dört farklı alanın şemasını baştan sona kurup her tabloda **"neden böyle?"** sorusuna cevap vereceğiz. Dört alan bilinçli seçildi; her biri farklı bir baskın gereksinim taşır:

| Alan | Baskın gereksinim | Şemayı şekillendiren karar |
|---|---|---|
| E-ticaret | Stok ve sipariş tutarlılığı | Sipariş anındaki fiyatı dondurmak; stoğu rezervasyonla yönetmek |
| Sosyal medya | Okuma hacmi, fan-out | Takip grafı + önceden hesaplanmış akış; sayaçların denormalize tutulması |
| Ödeme sistemi | Para kaybolmaz, çift işlem olmaz | Append-only çift kayıtlı defter (double-entry ledger) + idempotency key |
| Mesajlaşma | Yazma hacmi, sıralama, teslim durumu | Konuşma başına sıralı mesaj kimliği; okundu bilgisinin ayrı tutulması |

:::diagram{src="diagram.svg" alt="Dört alanın şema haritası: e-ticaret, sosyal medya, ödeme ve mesajlaşma için çekirdek tablolar ve baskın tasarım kararı|Schema map of four domains: core tables and the dominant design decision for e-commerce, social media, payments and messaging"}
Her alanda 5–7 çekirdek tablo yeterlidir; karmaşıklık tablo sayısında değil, kısıtlarda ve indekslerde gizlidir.
:::

## 1. E-ticaret

Çekirdek sorular: "Bu ürünün fiyatı siparişten sonra değişirse?", "İki kişi son ürünü aynı anda sepete koyarsa?", "Sipariş durumu nasıl ilerler?"

:::diagram{src="er-ecommerce.svg" alt="E-ticaret ER diyagramı: users, addresses, products, inventory, carts, cart_items, orders, order_items, payments|E-commerce ER diagram: users, addresses, products, inventory, carts, cart_items, orders, order_items, payments"}
order_items satın alma anındaki fiyatı taşır; inventory tablosunda stok ve rezerve miktar ayrı sütunlardır.
:::

:::code{lang="sql" title="E-ticaret: DDL (PostgreSQL)"}
```sql
CREATE TABLE products (
  id            bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  sku           text NOT NULL UNIQUE,
  name          text NOT NULL,
  price_cents   integer NOT NULL CHECK (price_cents >= 0),   -- para: tam sayı kuruş, asla float
  currency      char(3) NOT NULL DEFAULT 'TRY',
  attributes    jsonb NOT NULL DEFAULT '{}',                  -- kategoriye göre değişen alanlar (beden, renk)
  is_active     boolean NOT NULL DEFAULT true
);
CREATE INDEX products_attrs_gin ON products USING gin (attributes);

CREATE TABLE inventory (
  product_id    bigint PRIMARY KEY REFERENCES products(id),
  on_hand       integer NOT NULL CHECK (on_hand >= 0),
  reserved      integer NOT NULL DEFAULT 0 CHECK (reserved >= 0),
  CHECK (reserved <= on_hand)                                 -- satılabilir = on_hand - reserved
);

CREATE TABLE orders (
  id            bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id       bigint NOT NULL REFERENCES users(id),
  status        text NOT NULL CHECK (status IN ('pending','paid','shipped','delivered','cancelled')),
  total_cents   integer NOT NULL,                             -- denormalize: kalemlerden türetilir, raporlama için
  shipping_address jsonb NOT NULL,                            -- snapshot: kullanıcı adresi sonradan değişebilir
  created_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX orders_user_created ON orders (user_id, created_at DESC);
CREATE INDEX orders_pending ON orders (created_at) WHERE status = 'pending';   -- partial: zaman aşımı işi için

CREATE TABLE order_items (
  order_id      bigint NOT NULL REFERENCES orders(id),
  product_id    bigint NOT NULL REFERENCES products(id),
  qty           integer NOT NULL CHECK (qty > 0),
  unit_price_cents integer NOT NULL,                          -- satın alma anındaki fiyat: tarihsel gerçek
  PRIMARY KEY (order_id, product_id)
);
```
:::

Tasarım kararları:

- **Para tam sayı kuruştur.** `numeric(12,2)` de kabul edilir; `float` asla.
- **Stok iki sayaçtır**: `on_hand` fiziksel stok, `reserved` ödenmemiş siparişlerin tuttuğu miktar. Sipariş oluşturulurken `reserved` artar, ödeme gelince `on_hand` ve `reserved` birlikte düşer, 15 dakikada ödenmeyen sipariş rezervi geri verir. Böylece "son ürün" iki kişiye satılmaz.
- **Snapshot'lar**: fiyat ve teslimat adresi siparişe kopyalanır; bunlar denormalizasyon değil, o anın gerçeğidir.
- **Shard key** gerekirse `user_id`: "siparişlerim" tek shard'da kalır; satıcı raporları ayrı bir analitik depoda üretilir.

### Sipariş oluşturma transaction'ı

Aşağıdaki animasyon tek bir "Satın al" tıklamasının tablolar arasındaki yolculuğunu gösterir: stok kontrolü ve rezervasyon, sipariş ve kalemlerin yazılması, ödeme kaydı, outbox olayı ve commit.

:::animation{scene="scene.json"}
Sipariş oluşturma: SELECT ... FOR UPDATE ile stok kilidi → orders → order_items → payments → outbox → COMMIT.
:::

:::code{lang="ts" title="Sipariş oluşturma: tek transaction, kilit sırası, outbox"}
```ts
import { PoolClient } from 'pg';

interface CartLine { productId: number; qty: number }

export async function placeOrder(c: PoolClient, userId: number, lines: CartLine[], idempotencyKey: string) {
  await c.query('BEGIN');
  try {
    // 0) Aynı istek iki kez gelirse (ağ tekrarı) aynı siparişi döndür
    const dup = await c.query('SELECT order_id FROM order_requests WHERE idempotency_key = $1', [idempotencyKey]);
    if (dup.rowCount) { await c.query('COMMIT'); return dup.rows[0].order_id; }

    // 1) Stok satırlarını her zaman product_id sırasına göre kilitle (deadlock önlemi)
    const sorted = [...lines].sort((a, b) => a.productId - b.productId);
    const ids = sorted.map((l) => l.productId);
    const inv = await c.query(
      `SELECT i.product_id, i.on_hand - i.reserved AS available, p.price_cents
         FROM inventory i JOIN products p ON p.id = i.product_id
        WHERE i.product_id = ANY($1) ORDER BY i.product_id FOR UPDATE OF i`, [ids]);
    const byId = new Map(inv.rows.map((r) => [r.product_id, r]));
    for (const l of sorted) {
      const row = byId.get(l.productId);
      if (!row || row.available < l.qty) throw new Error(`Stok yetersiz: ${l.productId}`);
    }

    // 2) Rezerve et (ödeme gelene kadar on_hand değişmez)
    for (const l of sorted) {
      await c.query('UPDATE inventory SET reserved = reserved + $2 WHERE product_id = $1', [l.productId, l.qty]);
    }

    // 3) Sipariş + kalemler; fiyat şu anki fiyattan dondurulur
    const total = sorted.reduce((s, l) => s + byId.get(l.productId)!.price_cents * l.qty, 0);
    const { rows: [order] } = await c.query(
      `INSERT INTO orders (user_id, status, total_cents, shipping_address)
       VALUES ($1, 'pending', $2, (SELECT to_jsonb(a) FROM addresses a WHERE a.user_id = $1 AND a.is_default))
       RETURNING id`, [userId, total]);
    for (const l of sorted) {
      await c.query('INSERT INTO order_items (order_id, product_id, qty, unit_price_cents) VALUES ($1, $2, $3, $4)',
        [order.id, l.productId, l.qty, byId.get(l.productId)!.price_cents]);
    }

    // 4) Ödeme niyeti ve idempotency kaydı
    await c.query(`INSERT INTO payments (order_id, amount_cents, status) VALUES ($1, $2, 'initiated')`, [order.id, total]);
    await c.query('INSERT INTO order_requests (idempotency_key, order_id) VALUES ($1, $2)', [idempotencyKey, order.id]);

    // 5) Outbox: dış dünyaya olay, aynı transaction içinde (ödeme sağlayıcısına HTTP çağrısı BURADA DEĞİL)
    await c.query(`INSERT INTO outbox (aggregate, aggregate_id, event, payload) VALUES ('order', $1, 'order.created', $2)`,
      [order.id, JSON.stringify({ orderId: order.id, userId, total })]);

    await c.query('COMMIT');
    return order.id;
  } catch (err) {
    await c.query('ROLLBACK');
    throw err;
  }
}
```
:::

## 2. Sosyal medya

Çekirdek sorular: "Ana akış nasıl 50 ms'de gelir?", "Takipçi sayısını her seferinde COUNT ile mi hesaplarız?", "Beğeni tablosu milyarlarca satır olunca?"

:::diagram{src="er-social.svg" alt="Sosyal medya ER diyagramı: users, follows, posts, likes, comments, feed_items ve denormalize sayaçlar|Social media ER diagram: users, follows, posts, likes, comments, feed_items and denormalized counters"}
follows tablosu grafın kenar listesidir; feed_items fan-out on write ile önceden hesaplanmış akıştır.
:::

:::code{lang="sql" title="Sosyal medya: DDL"}
```sql
CREATE TABLE users (
  id              bigint PRIMARY KEY,                 -- Snowflake id: zaman + shard + sayaç
  handle          citext NOT NULL UNIQUE,
  display_name    text NOT NULL,
  follower_count  integer NOT NULL DEFAULT 0,         -- denormalize sayaç; follows'tan türetilir
  following_count integer NOT NULL DEFAULT 0,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE follows (
  follower_id  bigint NOT NULL REFERENCES users(id),
  followee_id  bigint NOT NULL REFERENCES users(id),
  created_at   timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (follower_id, followee_id),            -- "kimleri takip ediyorum"
  CHECK (follower_id <> followee_id)
);
CREATE INDEX follows_followee ON follows (followee_id, created_at DESC);   -- "takipçilerim" (ters yön)

CREATE TABLE posts (
  id           bigint PRIMARY KEY,
  author_id    bigint NOT NULL REFERENCES users(id),
  body         text NOT NULL CHECK (length(body) <= 500),
  like_count   integer NOT NULL DEFAULT 0,
  reply_count  integer NOT NULL DEFAULT 0,
  deleted_at   timestamptz,                           -- soft delete: akışlardaki referanslar kırılmasın
  created_at   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX posts_author_created ON posts (author_id, created_at DESC) WHERE deleted_at IS NULL;

CREATE TABLE likes (
  post_id    bigint NOT NULL REFERENCES posts(id),
  user_id    bigint NOT NULL REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (post_id, user_id)                      -- aynı kişi iki kez beğenemez
);

-- Fan-out on write: her takipçi için akış satırı (Cassandra/Redis'e de taşınabilir)
CREATE TABLE feed_items (
  user_id    bigint NOT NULL,
  post_id    bigint NOT NULL,
  created_at timestamptz NOT NULL,
  PRIMARY KEY (user_id, created_at DESC, post_id)
);
```
:::

Tasarım kararları: sayaçlar **denormalize** tutulur ve beğeni/takip yazmasıyla aynı transaction'da (ya da asenkron olarak) güncellenir; `COUNT(*)` milyar satırlık tabloda sorgu başına çalıştırılmaz. `feed_items`, ünlü hesaplar (milyonlarca takipçi) için yazma fırtınası yaratır; bu yüzden hibrit model uygulanır: normal kullanıcılar fan-out on write, ünlüler okuma anında birleştirme (fan-out on read). Detayı e-03 Twitter dersinde göreceksiniz.

## 3. Ödeme sistemi

Çekirdek sorular: "Bakiye sütununu güncellersek geçmişi nasıl kanıtlarız?", "Aynı ödeme isteği iki kez gelirse?", "Dış sağlayıcı yanıt vermezse durum ne olur?"

:::diagram{src="er-payments.svg" alt="Ödeme sistemi ER diyagramı: accounts, ledger_entries (çift kayıt), transfers, payment_intents, idempotency_keys, webhooks_inbox|Payments ER diagram: accounts, ledger_entries (double entry), transfers, payment_intents, idempotency_keys, webhooks_inbox"}
Bakiye hiçbir yerde güncellenmez; her transfer defterde biri borç biri alacak iki satır olarak eklenir ve toplamı sıfırdır.
:::

:::code{lang="sql" title="Ödeme: append-only çift kayıtlı defter"}
```sql
CREATE TABLE accounts (
  id        bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  owner_id  bigint NOT NULL,
  currency  char(3) NOT NULL,
  kind      text NOT NULL CHECK (kind IN ('user','merchant','fees','settlement'))
);

CREATE TABLE transfers (
  id              uuid PRIMARY KEY,                     -- istemci üretir; idempotency ile aynı
  idempotency_key text NOT NULL UNIQUE,
  status          text NOT NULL CHECK (status IN ('pending','posted','failed','reversed')),
  amount_cents    bigint NOT NULL CHECK (amount_cents > 0),
  currency        char(3) NOT NULL,
  created_at      timestamptz NOT NULL DEFAULT now()
);

-- Yalnızca INSERT; UPDATE/DELETE yetkisi uygulama rolünden alınır
CREATE TABLE ledger_entries (
  id           bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  transfer_id  uuid NOT NULL REFERENCES transfers(id),
  account_id   bigint NOT NULL REFERENCES accounts(id),
  direction    text NOT NULL CHECK (direction IN ('debit','credit')),
  amount_cents bigint NOT NULL CHECK (amount_cents > 0),
  created_at   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ledger_account_time ON ledger_entries (account_id, created_at DESC);
REVOKE UPDATE, DELETE ON ledger_entries FROM app_role;

-- Bakiye = türetilmiş değer; sık okunuyorsa materialized view ya da günlük snapshot tablosu
CREATE VIEW account_balances AS
SELECT account_id,
       SUM(CASE direction WHEN 'credit' THEN amount_cents ELSE -amount_cents END) AS balance_cents
FROM ledger_entries GROUP BY account_id;

CREATE TABLE webhooks_inbox (                          -- sağlayıcıdan gelen olaylar: en az bir kez gelir, bir kez işlenir
  provider_event_id text PRIMARY KEY,
  payload           jsonb NOT NULL,
  processed_at      timestamptz
);
```
:::

Tasarım kararları: **append-only** defter denetlenebilirlik sağlar — her kuruşun nereden gelip nereye gittiği kanıtlanabilir; hata düzeltme silmeyle değil, ters kayıtla (`reversed`) yapılır. **Idempotency key** istemciden gelir; aynı anahtarla ikinci istek yeni transfer yaratmaz, ilkinin sonucunu döndürür. Dış sağlayıcıyla iletişim durum makinesidir: `pending` → sağlayıcı çağrısı → webhook → `posted`/`failed`; webhook'lar `provider_event_id` ile tekilleştirilir. Bakiye sütunu tutulacaksa yalnızca önbellek olarak tutulur ve defterden yeniden hesaplanabilir olmalıdır.

## 4. Mesajlaşma

Çekirdek sorular: "Bir konuşmadaki mesajlar nasıl sıralanır?", "Okundu bilgisi her mesaj × her katılımcı için mi saklanır?", "Milyarlarca mesaj nerede durur?"

:::diagram{src="er-messaging.svg" alt="Mesajlaşma ER diyagramı: users, conversations, participants, messages, message_receipts, attachments|Messaging ER diagram: users, conversations, participants, messages, message_receipts, attachments"}
messages, conversation_id ile partition'lanır ve konuşma içi sıra numarasıyla sıralanır; okundu bilgisi katılımcı başına tek satırdır.
:::

:::code{lang="sql" title="Mesajlaşma: konuşma başına sıralı mesajlar"}
```sql
CREATE TABLE conversations (
  id          bigint PRIMARY KEY,
  kind        text NOT NULL CHECK (kind IN ('direct','group')),
  last_seq    bigint NOT NULL DEFAULT 0,               -- konuşma içi monoton sayaç
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE participants (
  conversation_id bigint NOT NULL REFERENCES conversations(id),
  user_id         bigint NOT NULL REFERENCES users(id),
  last_read_seq   bigint NOT NULL DEFAULT 0,           -- okundu: mesaj × kişi yerine kişi başına tek sayı
  joined_at       timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (conversation_id, user_id)
);
CREATE INDEX participants_user ON participants (user_id);   -- "konuşmalarım"

CREATE TABLE messages (
  conversation_id bigint NOT NULL,
  seq             bigint NOT NULL,                     -- sıra: zaman damgası değil (saat kayması!)
  sender_id       bigint NOT NULL,
  body            text,
  attachment_url  text,
  sent_at         timestamptz NOT NULL DEFAULT now(),
  deleted_at      timestamptz,
  PRIMARY KEY (conversation_id, seq)                   -- Cassandra'da: partition conversation_id, clustering seq DESC
) PARTITION BY HASH (conversation_id);
```
:::

Tasarım kararları: sıralama için `seq` kullanılır, `sent_at` değil — istemci saatleri güvenilmez ve aynı milisaniyede iki mesaj gelebilir; `seq`, `UPDATE conversations SET last_seq = last_seq + 1 RETURNING last_seq` ile atomik üretilir. Okundu bilgisi "katılımcı, en son hangi seq'i okudu" olarak tek sayıdır; `unread = last_seq - last_read_seq` ücretsiz hesaplanır. Mesaj gövdesi uçtan uca şifreliyse sunucu yalnızca şifreli blob tutar. Ölçek büyüyünce `messages` tablosu birebir aynı anahtarlarla Cassandra'ya taşınır: partition key `conversation_id`, clustering key `seq`.

:::interactive{type="er-diagram" tables="users,conversations,participants,messages,message_receipts" mode="explore" preset="messaging" showCardinality=true}
Mesajlaşma şemasını inceleyin: participants tablosundaki last_read_seq sütununu kaldırıp yerine message_receipts (message_id, user_id, read_at) tablosu ekleyin ve aracın hesapladığı satır sayısını (mesaj × katılımcı) karşılaştırın. Sonra e-ticaret ön ayarına geçip inventory.reserved sütununu silin; hangi iş kuralının korumasız kaldığını görün.
:::

:::callout{tone="warning" title="Üç şemanın ortak hatası: zamanı kimlik sanmak"}
`created_at` ne sıralama anahtarı ne de benzersiz kimliktir. Sipariş kimliği için identity/Snowflake, mesaj sırası için konuşma içi `seq`, defter için ekleme sırası (`id`) kullanın. Zaman damgası yalnızca **bilgi**dir; kararlarınızı ona dayandırırsanız saat kayması ve çakışmalar üretimde sizi bulur.
:::

:::realworld{company="Amazon"}
Amazon'un sipariş akışı bu dersteki e-ticaret şemasının dağıtık sürümüdür. "Satın al" tıklaması tek veritabanı transaction'ı değildir; sipariş servisi siparişi `pending` yazar, envanter servisi rezervasyonu kendi deposunda yapar, ödeme servisi tahsilatı başlatır ve her adım bir olayla bir sonrakini tetikler (saga). Başarısız adım telafi olayı üretir: rezervasyon geri alınır, sipariş `cancelled` olur. Bu yüzden Amazon'da stok sayfada "var" görünürken ödeme sırasında "tükendi" diyebilir — rezervasyon ödeme değil sipariş anında yapılır ve süreyle sınırlıdır. Envanter servisi uzun süre DynamoDB üzerinde partition key olarak `sku + fulfillment_center` kullandı; böylece aynı ürünün farklı depolardaki stoğu farklı partition'lara dağılır ve tek sıcak anahtar oluşmaz. Ödeme tarafında ise her istek müşteri tarafından üretilen idempotency token taşır; ağ tekrarı aynı kartı iki kez çekemez.
:::

:::callout{tone="tip" title="Mülakat özeti: şema çizerken 7 adım"}
1. Varlıklar ve kardinalite (ER çizin, N-M için ara tablo).
2. Her tabloda birincil anahtar türü: identity, UUIDv7, Snowflake — ve neden.
3. Neyin snapshot olduğunu (fiyat, adres) neyin referans olduğunu söyleyin.
4. En sık 3 sorguyu yazın; her biri için indeks tanımlayın (composite sırası!).
5. Kritik transaction'ı adım adım anlatın: kilit sırası, idempotency, outbox.
6. Denormalize sayaçları ve nasıl güncel kaldıklarını belirtin.
7. Büyüyünce: shard key, hangi tablonun NoSQL'e taşınabileceği, hangi okumanın replikadan gelebileceği.
:::

:::quiz{src="quiz.json"}
:::

:::next{lesson="e-01-amazon-scale-ecommerce"}
Sırada: bu şemaları Amazon ölçeğinde çalıştırmak — kapasite hesabı, servis ayrımı ve Black Friday simülasyonu.
:::

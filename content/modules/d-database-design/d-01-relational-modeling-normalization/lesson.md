---
id: d-01-relational-modeling-normalization
slug: relational-modeling-normalization
module: d-database-design
order: 1
title:
  tr: İlişkisel Modelleme, Normalizasyon (1NF→BCNF), ER Diyagramları
  en: Relational Modeling, Normalization (1NF→BCNF), ER Diagrams
summary:
  tr: Interaktif ER çizim aracıyla şema tasarımı.
  en: Schema design with an interactive ER drawing tool.
durationMinutes: 30
level: intermediate
tags: [database, relational, normalization, er-diagram, schema-design]
prerequisites: [a-01-client-server-dns-http]
concepts: [relational-model, primary-key, foreign-key, functional-dependency, 1nf, 2nf, 3nf, bcnf, update-anomaly, er-diagram, cardinality, denormalization]
---

## Kavram: veriyi tablolara bölmek bir tasarım kararıdır

İlişkisel model, veriyi **tablolar (relation)**, **satırlar (tuple)** ve **sütunlar (attribute)** olarak düzenler. Her tablonun satırını tek başına tanımlayan bir **primary key (birincil anahtar)** vardır; tablolar arası bağ ise **foreign key (yabancı anahtar)** ile kurulur. Bu kadar basit bir modelin elli yıldır ayakta kalmasının nedeni, matematiksel bir temeli olmasıdır: hangi sütunun hangisini "belirlediğini" (**functional dependency — fonksiyonel bağımlılık**) yazabilir ve şemanın doğru olup olmadığını kanıtlayabiliriz.

Sistem tasarımı mülakatında şema çizmeniz istendiğinde beklenen şey, tabloları ezbere sıralamak değil; **varlıkları (entity)**, aralarındaki **ilişkileri (relationship)** ve **kardinaliteyi (1-1, 1-N, N-M)** gerekçeleriyle anlatmaktır. Bu dersin iki aracı var: ER diyagramı (ne var, nasıl bağlı?) ve normalizasyon (veriyi nasıl böleyim ki çelişki oluşmasın?).

:::diagram{src="diagram.svg" alt="Dört tablolu e-ticaret ER diyagramı: customers, orders, order_items, products ve aralarındaki 1-N ilişkileri|Four-table e-commerce ER diagram: customers, orders, order_items, products and their 1-N relationships"}
Crow's foot gösterimi: çatal ucu "çok", tek çizgi "bir" tarafını gösterir. order_items, orders ile products arasındaki N-M ilişkiyi çözen ara tablodur.
:::

## Fonksiyonel bağımlılık: her şeyin başlangıcı

`A → B` yazımı "A'nın değeri belli olunca B'nin değeri de bellidir" demektir. Bir sipariş tablosunda:

- `order_id → order_date, customer_id` (sipariş numarası tarihini ve müşterisini belirler)
- `customer_id → customer_name, customer_city` (müşteri numarası adını ve şehrini belirler)
- `product_id → product_name, unit_price`

Normalizasyon, bu bağımlılıkları okuyup "bu sütun bu tabloda durmamalı" kararını veren mekanik bir süreçtir. Her normal form bir öncekinin üzerine bir kural ekler.

## Tek tablonun üç hastalığı: anomaliler

Her şeyi tek tabloya yazdığınızı düşünün: `orders_flat(order_id, order_date, customer_id, customer_name, customer_city, product_id, product_name, unit_price, qty)`.

| Anomali | Ne olur? | Örnek |
|---|---|---|
| **Update anomaly** | Aynı bilgi birçok satırda tekrarlandığı için biri güncellenince diğerleri eski kalır | Müşteri şehir değiştirdi; 40 siparişinin 39'u güncellendi, biri unutuldu |
| **Insert anomaly** | Bir varlığı, ilişkili olmadığı başka bir varlık olmadan ekleyemezsiniz | Henüz hiç satılmamış ürünü kataloğa ekleyemezsiniz çünkü `order_id` boş olamaz |
| **Delete anomaly** | Bir satırı silince istemediğiniz bilgiyi de kaybedersiniz | Müşterinin tek siparişi iptal edilince müşterinin kaydı da yok olur |

Aşağıdaki animasyon bu tabloyu adım adım 1NF → 2NF → 3NF → BCNF sürecinden geçirir.

:::animation{scene="scene.json"}
orders_flat tablosunun anomalileri ve dört tabloya ayrıştırılması.
:::

## Normal formlar adım adım

### 1NF — atomik değerler, tekrar eden grup yok
Her hücrede tek bir değer olmalı; "product_ids = 12, 15, 33" gibi listeler yasaktır. Çözüm: her ürün satırı için ayrı satır. Bedeli: artık tabloyu `(order_id, product_id)` **bileşik anahtarı** tanımlar ve sipariş bilgileri her satırda tekrar eder.

### 2NF — kısmi bağımlılık yok
1NF + anahtar olmayan her sütun **anahtarın tamamına** bağlı olmalı. `product_name` yalnızca `product_id`'ye (anahtarın yarısına) bağlıdır → `products` tablosuna taşınır. `order_date` yalnızca `order_id`'ye bağlıdır → `orders` tablosuna taşınır. Geriye `order_items(order_id, product_id, qty)` kalır. Not: tek sütunlu anahtarı olan tablolar otomatik olarak 2NF'dir; 2NF yalnızca bileşik anahtarlarda anlam taşır.

### 3NF — geçişli bağımlılık yok
2NF + anahtar olmayan sütunlar **birbirine** bağlı olmamalı. `orders` içinde `order_id → customer_id → customer_city` zinciri var; `customer_city` müşterinin özelliğidir, siparişin değil → `customers` tablosuna taşınır. Kısa tanım: *"her sütun anahtara, tüm anahtara ve yalnızca anahtara bağlı olmalı."*

### BCNF — her belirleyici bir aday anahtar
3NF'nin sıkılaştırılmış hâli. Örnek: `stock(product_id, warehouse_id, shelf_code)` tablosunda `shelf_code → warehouse_id` (raf kodu hangi depoda olduğunu söyler) ama `shelf_code` aday anahtar değil. 3NF'yi geçer, BCNF'yi geçmez; `shelves(shelf_code, warehouse_id)` olarak ayrılır. Pratikte şemaların %95'i 3NF'ye gelince zaten BCNF'dir; mülakatta farkı bir cümleyle söyleyebilmek yeterlidir.

| Form | Kural | Yakaladığı hata |
|---|---|---|
| 1NF | Atomik hücre, tekrar eden grup yok | Virgülle ayrılmış listeler |
| 2NF | Bileşik anahtarın parçasına bağımlılık yok | Ürün adının her sipariş satırında tekrarı |
| 3NF | Anahtar olmayan sütunlar arası bağımlılık yok | Müşteri şehrinin sipariş tablosunda durması |
| BCNF | Her belirleyici aday anahtar | Anahtar olmayan sütunun anahtarın parçasını belirlemesi |

:::interactive{type="er-diagram" tables="customers,orders,order_items,products" mode="design" showCardinality=true}
Dört tabloyu sürükleyin, aralarına ilişki çizin ve kardinaliteyi ayarlayın. Sonra "normalize" düğmesiyle aracın tespit ettiği kısmi/geçişli bağımlılıkları inceleyin; order_items tablosuna product_name eklediğinizde aracın neden uyardığını görün.
:::

## ER diyagramı nasıl okunur ve çizilir?

1. **Varlıkları isimlendirin**: isimler, çoğul tablo adları (`customers`), tekil varlık adı (Customer).
2. **İlişkileri fiille tanımlayın**: Customer *places* Order, Order *contains* Product.
3. **Kardinalite ve zorunluluk**: Bir siparişin tam olarak bir müşterisi vardır (zorunlu-1); bir müşterinin sıfır veya çok siparişi olabilir (opsiyonel-N).
4. **N-M ilişkiyi ara tabloyla çözün**: `order_items(order_id, product_id, qty, unit_price_at_purchase)`. Ara tablolar genellikle kendi özniteliklerini taşır — bu, onların gerçek varlık olduğunun işaretidir.
5. **Anahtar seçimi**: doğal anahtar (e-posta, TC no) yerine çoğunlukla **surrogate key** (`bigint identity` ya da UUIDv7) kullanılır; doğal anahtarlar değişebilir ve dış sistemlere sızar.

:::code{lang="ts" title="Normalize şema: Drizzle ORM ile tablolar ve ilişkiler"}
```ts
import { pgTable, bigserial, bigint, text, integer, numeric, timestamp, primaryKey } from 'drizzle-orm/pg-core';

// 3NF: müşteri bilgisi yalnızca burada durur
export const customers = pgTable('customers', {
  id: bigserial('id', { mode: 'number' }).primaryKey(),
  email: text('email').notNull().unique(),         // doğal anahtar → benzersiz kısıt, PK değil
  name: text('name').notNull(),
  city: text('city').notNull(),
});

export const products = pgTable('products', {
  id: bigserial('id', { mode: 'number' }).primaryKey(),
  name: text('name').notNull(),
  unitPrice: numeric('unit_price', { precision: 12, scale: 2 }).notNull(),
});

export const orders = pgTable('orders', {
  id: bigserial('id', { mode: 'number' }).primaryKey(),
  customerId: bigint('customer_id', { mode: 'number' }).notNull().references(() => customers.id),
  orderedAt: timestamp('ordered_at', { withTimezone: true }).notNull().defaultNow(),
});

// N-M ilişkiyi çözen ara tablo; bileşik birincil anahtar
export const orderItems = pgTable(
  'order_items',
  {
    orderId: bigint('order_id', { mode: 'number' }).notNull().references(() => orders.id),
    productId: bigint('product_id', { mode: 'number' }).notNull().references(() => products.id),
    qty: integer('qty').notNull(),
    // Bilinçli kopya: satın alma anındaki fiyat tarihsel bir gerçektir, türetilmiş veri değil
    unitPriceAtPurchase: numeric('unit_price_at_purchase', { precision: 12, scale: 2 }).notNull(),
  },
  (t) => [primaryKey({ columns: [t.orderId, t.productId] })],
);
```
```sql
CREATE TABLE customers (
  id         bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  email      text NOT NULL UNIQUE,
  name       text NOT NULL,
  city       text NOT NULL
);
CREATE TABLE products (
  id         bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name       text NOT NULL,
  unit_price numeric(12,2) NOT NULL
);
CREATE TABLE orders (
  id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  customer_id bigint NOT NULL REFERENCES customers(id),
  ordered_at  timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE order_items (
  order_id               bigint NOT NULL REFERENCES orders(id),
  product_id             bigint NOT NULL REFERENCES products(id),
  qty                    integer NOT NULL CHECK (qty > 0),
  unit_price_at_purchase numeric(12,2) NOT NULL,
  PRIMARY KEY (order_id, product_id)
);
```
:::

## Fonksiyonel bağımlılığı koddan yakalamak

Şemanın normal formda olup olmadığını elle kontrol etmek yerine, bağımlılık listesini verip anahtar kapanışını (closure) hesaplatabilirsiniz. Aşağıdaki küçük fonksiyon, bir sütun kümesinden hangi sütunlara ulaşılabildiğini bulur; sonuç tüm sütunları kapsıyorsa o küme bir **süper anahtardır**.

:::code{lang="ts" title="Attribute closure: bir sütun kümesi anahtar mı?"}
```ts
type FD = { from: string[]; to: string[] };

/** X+ kapanışı: X'ten fonksiyonel bağımlılıklarla ulaşılabilen tüm sütunlar */
export function closure(attrs: string[], fds: FD[]): Set<string> {
  const result = new Set(attrs);
  let changed = true;
  while (changed) {
    changed = false;
    for (const fd of fds) {
      // sol tarafın tamamı kapanışta ise sağ tarafı ekle
      if (fd.from.every((a) => result.has(a))) {
        for (const b of fd.to) if (!result.has(b)) { result.add(b); changed = true; }
      }
    }
  }
  return result;
}

const fds: FD[] = [
  { from: ['order_id'], to: ['order_date', 'customer_id'] },
  { from: ['customer_id'], to: ['customer_name', 'customer_city'] },
  { from: ['product_id'], to: ['product_name', 'unit_price'] },
  { from: ['order_id', 'product_id'], to: ['qty'] },
];
// {order_id, product_id} tüm sütunlara ulaşır → aday anahtar
// {order_id} tek başına qty'ye ulaşamaz → anahtar değil; product_name → kısmi bağımlılık (2NF ihlali)
console.log(closure(['order_id', 'product_id'], fds));
```
:::

## Ne zaman kasıtlı olarak bozmalı? (denormalization)

Normalizasyon yazma tutarlılığını optimize eder; okuma tarafında ise her sorgu birkaç `JOIN` ister. Çok okunan, az değişen alanlar için kasıtlı kopya tutmak meşrudur — yeter ki **tek doğruluk kaynağı** belli olsun ve kopya bir mekanizmayla (trigger, event, batch) güncellensin. Tipik örnekler: `posts.comment_count`, `orders.total_amount`, arama için düzleştirilmiş `product_search` tablosu. Kural: önce normalize et, sonra ölçtüğün darboğaz için denormalize et.

:::callout{tone="warning" title="Kopya mı, tarihsel gerçek mi?"}
`order_items.unit_price_at_purchase` bir denormalizasyon **değildir**. Ürün fiyatı yarın değişse bile dünkü siparişin tutarı değişmemelidir; bu sütun farklı bir gerçeği (o anki fiyat) saklar. Buna karşılık `orders.customer_city` gerçek bir kopyadır ve müşteri taşınınca eskir. İkisini ayırt etmek mülakatta sık sorulan ince bir noktadır.
:::

:::realworld{company="Stripe"}
Stripe'ın veri modeli ders kitabı gibi normalize edilmiştir: `Customer`, `PaymentMethod`, `PaymentIntent`, `Charge`, `Invoice`, `InvoiceItem` ayrı varlıklardır ve API nesneleri bu tabloları yansıtır — bir `Charge` müşteriyi `customer` id'si ile referanslar, müşterinin adını kopyalamaz. Ancak fatura satırları (`InvoiceItem`) o anki fiyatı ve vergi oranını kendi üzerinde **dondurur**; fiyat planı sonradan değişse de kesilmiş fatura aynı kalır. Stripe mühendisleri ayrıca her tabloda surrogate id (`cus_...`, `ch_...` önekli benzersiz kimlikler) kullanır; böylece doğal anahtarlar (e-posta, kart numarası) hiçbir zaman ilişki anahtarı olmaz ve değiştirilebilir kalır.
:::

:::callout{tone="tip" title="Mülakat özeti"}
- Şema çizerken sırayla: varlıklar → ilişkiler ve kardinalite → anahtarlar → sık sorgular.
- "3NF nedir?" sorusuna tek cümle: *anahtara, tüm anahtara ve yalnızca anahtara bağlı.*
- N-M ilişki gördüğünüz anda ara tablo çizin ve ara tablonun kendi özniteliklerini sorun.
- Denormalizasyonu savunurken "hangi sorgu, hangi ölçüm, kopya nasıl güncel kalacak?" sorularına cevabınız hazır olsun.
:::

:::quiz{src="quiz.json"}
:::

:::next{lesson="d-02-indexing"}
Sırada: doğru tabloları kurduktan sonra sorguları hızlandırmak — B-tree, hash ve composite indeksler ile sorgu planı okuma.
:::

---
id: i-04-api-ve-rest-api-uctan-uca-ornek-ve-mulakat
slug: api-ve-rest-api-uctan-uca-ornek-ve-mulakat
module: i-api-sql-testing
order: 4
title:
  tr: "API ve REST API: Uçtan Uca E-ticaret Örneği, Mülakat Soru-Cevap ve Özet"
  en: "API and REST API: End-to-End E-commerce Example, Interview Q&A and Summary"
summary:
  tr: "Uçtan uca bir e-ticaret API'si, Google ile giriş ve veritabanı taslağıyla API mülakatına hazırlan."
  en: "Prepare for API interviews with an end-to-end e-commerce API, Sign in with Google and a database draft."
durationMinutes: 22
level: intermediate
tags: [api, e-commerce, oauth, postgresql, interview, cheat-sheet]
prerequisites: [i-03-api-ve-rest-api-tasarim-guvenlik-ve-idempotency]
concepts: [endpoint-design, order-lifecycle, authorization-code-flow, database-schema, stock-reservation, race-condition, http-status-codes]
---

## Pratik e-ticaret API örneği

Toptan satış projen için mantıklı bir temel endpoint yapısı şu olabilir:

:::code{lang="text"}
```text
POST   /api/v1/auth/login
POST   /api/v1/auth/refresh

GET    /api/v1/products
GET    /api/v1/products/{id}
POST   /api/v1/products
PATCH  /api/v1/products/{id}

GET    /api/v1/categories
GET    /api/v1/customers/me

GET    /api/v1/cart
POST   /api/v1/cart/items
PATCH  /api/v1/cart/items/{id}
DELETE /api/v1/cart/items/{id}

POST   /api/v1/orders
GET    /api/v1/orders
GET    /api/v1/orders/{id}

POST   /api/v1/webhooks/payment
POST   /api/v1/webhooks/shipping
```
:::

Bayi fiyatı gibi özel bir iş kuralında API token içindeki kullanıcı rolünü kontrol edebilir:

:::code{lang="json"}
```json
{
  "role": "wholesale_customer",
  "priceTier": "dealer"
}
```
:::

Sonrasında ürün API’si aynı ürün için kullanıcıya uygun fiyatı döndürür:

:::code{lang="json"}
```json
{
  "id": 12,
  "name": "Naturel Sızma Zeytinyağı 5L",
  "retailPrice": 950,
  "wholesalePrice": 760,
  "displayPrice": 760,
  "minimumOrderQuantity": 6
}
```
:::

Bu yapı; perakende fiyatı, bayi fiyatı, minimum sipariş miktarı, stok ve müşteri yetkisini merkezi biçimde yönetmeni sağlar.

## Uçtan uca sipariş akışı

Toptan satış sitende bir siparişin baştan sona hangi API çağrılarından geçtiğini aşağıdaki akış gösteriyor.

:::diagram{src="sekil-01.png" alt="Sekiz adımlı sipariş akışı: 1. Giriş (POST /auth/login → JWT), 2. Ürünler (GET /products?category=...), 3. Sepet (POST /cart/items), 4. Sipariş (POST /orders + Idempotency-Key), 5. Ödeme sayfası (ödeme sağlayıcısına yönlendirme), 6. Ödeme webhook'u (POST /webhooks/payment), 7. Stok düşümü (Sipariş: paid), 8. Kargo (POST /webhooks/shipping → shipped)|Eight-step order flow: 1. Login (POST /auth/login → JWT), 2. Products (GET /products?category=...), 3. Cart (POST /cart/items), 4. Order (POST /orders + Idempotency-Key), 5. Payment page (redirect to payment provider), 6. Payment webhook (POST /webhooks/payment), 7. Stock deduction (Order: paid), 8. Shipping (POST /webhooks/shipping → shipped)"}
:::

Adımların ayrıntısı:

1. **Giriş:** Müşteri giriş yapar. Sunucu `accessToken` (kısa ömürlü JWT) ve `refreshToken` döndürür.
2. **Ürün listeleme:** Token'daki `priceTier` bilgisine göre bayi fiyatı veya perakende fiyatı gösterilir.
3. **Sepet:** Minimum sipariş miktarı ve stok bu adımda kontrol edilir; kurala aykırıysa `422` döner.
4. **Sipariş oluşturma:** Sipariş `pending` durumunda kaydedilir. Stok, ödeme tamamlanana kadar rezerve edilir. Idempotency-Key çift siparişi engeller.
5. **Ödeme:** Kart bilgisi asla senin sunucuna gelmez; ödeme sağlayıcısının (iyzico, PayTR, Stripe vb.) sayfası veya formu kullanılır.
6. **Webhook:** Ödeme sağlayıcısı sonucu bildirir. İmza doğrulanır, event ID kaydedilir, sipariş `paid` olur.
7. **Stok:** Rezerve stok kalıcı olarak düşülür. Ödeme başarısızsa rezervasyon serbest bırakılır.
8. **Kargo:** Kargo firması webhook ile takip numarası ve durum gönderir. Müşteriye e-posta bildirimi gider.

Sipariş durumları için önerilen yaşam döngüsü:

:::code{lang="text"}
```text
pending → paid → preparing → shipped → delivered
   ↓        ↓
cancelled  refunded
```
:::

## Google ile giriş (OAuth 2.0) akışı

Google ile girişte en doğru yöntem **Authorization Code Flow**'dur (tarayıcı tarafında PKCE ile).

:::diagram{src="sekil-02.png" alt="Google ile giriş akışı: 1. Kullanıcı (Google ile giriş butonu) → 2. Google (giriş + izin ekranı) → 3. Geri dönüş (/auth/google/callback?code=...) → 4. Sunucu (code → token takası) → 5. Oturum (kendi JWT'n)|Sign in with Google flow: 1. User (Sign in with Google button) → 2. Google (login + consent screen) → 3. Callback (/auth/google/callback?code=...) → 4. Server (code → token exchange) → 5. Session (your own JWT)"}
:::

1. Kullanıcı butona tıklar. Site onu Google'a yönlendirir; adreste `client_id`, `redirect_uri`, `scope=openid email profile`, `state` ve `code_challenge` bulunur.
2. Kullanıcı Google'da giriş yapar ve izin verir. Parolasını sen hiçbir zaman görmezsin.
3. Google kullanıcıyı `redirect_uri` adresine tek kullanımlık bir `code` ile geri gönderir.
4. Sunucun bu `code`'u, `client_secret` ile birlikte Google'a gönderir ve karşılığında `id_token` alır. Bu adım mutlaka sunucuda yapılır, çünkü `client_secret` tarayıcıya konmaz.
5. Sunucu `id_token` imzasını doğrular, e-postayı çıkarır, kullanıcıyı veritabanında bulur ya da oluşturur ve kendi JWT'sini üretir.

Güvenlik kontrolleri:

- `state` parametresini kontrol et (CSRF koruması).
- `id_token` içindeki `aud` değerinin senin `client_id`'n olduğunu doğrula.
- `email_verified` alanı `true` değilse hesabı otomatik birleştirme.
- `redirect_uri` adresini Google Console'da tam olarak kaydet; joker karakter kullanma.

Veritabanında sosyal giriş için ayrı bir tablo tut (aşağıdaki `user_identities`). Böylece aynı kullanıcı hem e-posta/parola hem Google hem Apple ile girebilir.

## PostgreSQL veritabanı taslağı

Toptan gıda e-ticareti için başlangıç şeması. Fiyatlar kuruş olarak tam sayıyla tutulur; böylece ondalık yuvarlama hatası olmaz.

:::code{lang="sql"}
```sql
CREATE TABLE users (
  id            BIGSERIAL PRIMARY KEY,
  email         TEXT UNIQUE NOT NULL,
  password_hash TEXT,                 -- sadece sosyal giriş yapanlarda NULL
  full_name     TEXT NOT NULL,
  role          TEXT NOT NULL DEFAULT 'customer'
                CHECK (role IN ('customer','dealer','admin')),
  price_tier    TEXT NOT NULL DEFAULT 'retail',
  company_name  TEXT,
  tax_number    TEXT,                 -- vergi numarası (bayi için)
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE user_identities (        -- Google / Apple ile giriş
  id           BIGSERIAL PRIMARY KEY,
  user_id      BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  provider     TEXT NOT NULL,         -- 'google', 'apple'
  provider_uid TEXT NOT NULL,         -- Google 'sub' değeri
  UNIQUE (provider, provider_uid)
);

CREATE TABLE categories (
  id        SERIAL PRIMARY KEY,
  name      TEXT NOT NULL,            -- Zeytinyağı, Baharat, Kuru Meyve
  slug      TEXT UNIQUE NOT NULL,
  parent_id INT REFERENCES categories(id)
);

CREATE TABLE products (
  id            BIGSERIAL PRIMARY KEY,
  category_id   INT REFERENCES categories(id),
  sku           TEXT UNIQUE NOT NULL,
  name          TEXT NOT NULL,
  slug          TEXT UNIQUE NOT NULL,
  description   TEXT,
  unit          TEXT NOT NULL,        -- 'kg', 'lt', 'koli'
  package_size  NUMERIC(10,2),        -- 5 (lt), 1 (kg)
  min_order_qty INT NOT NULL DEFAULT 1,
  is_active     BOOLEAN NOT NULL DEFAULT true,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE product_prices (         -- perakende / bayi / özel fiyat
  product_id  BIGINT REFERENCES products(id) ON DELETE CASCADE,
  price_tier  TEXT NOT NULL,          -- 'retail', 'dealer', 'vip'
  price_cents INT NOT NULL CHECK (price_cents >= 0),
  currency    CHAR(3) NOT NULL DEFAULT 'TRY',
  PRIMARY KEY (product_id, price_tier)
);

CREATE TABLE stock (
  product_id BIGINT PRIMARY KEY REFERENCES products(id),
  quantity   INT NOT NULL CHECK (quantity >= 0),
  reserved   INT NOT NULL DEFAULT 0 CHECK (reserved >= 0)
);

CREATE TABLE addresses (
  id       BIGSERIAL PRIMARY KEY,
  user_id  BIGINT NOT NULL REFERENCES users(id),
  title    TEXT,                      -- 'Depo', 'Mağaza'
  city     TEXT NOT NULL,
  district TEXT NOT NULL,
  line     TEXT NOT NULL,
  phone    TEXT NOT NULL
);

CREATE TABLE orders (
  id              BIGSERIAL PRIMARY KEY,
  order_no        TEXT UNIQUE NOT NULL,         -- ORD-2026-1045
  user_id         BIGINT NOT NULL REFERENCES users(id),
  address_id      BIGINT REFERENCES addresses(id),
  status          TEXT NOT NULL DEFAULT 'pending',
  total_cents     INT NOT NULL,
  idempotency_key UUID UNIQUE,                  -- çift siparişi engeller
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE order_items (
  order_id         BIGINT REFERENCES orders(id) ON DELETE CASCADE,
  product_id       BIGINT REFERENCES products(id),
  quantity         INT NOT NULL CHECK (quantity > 0),
  unit_price_cents INT NOT NULL,      -- sipariş anındaki fiyat saklanır
  PRIMARY KEY (order_id, product_id)
);

CREATE TABLE payments (
  id           BIGSERIAL PRIMARY KEY,
  order_id     BIGINT NOT NULL REFERENCES orders(id),
  provider     TEXT NOT NULL,         -- 'iyzico', 'paytr'
  provider_ref TEXT UNIQUE,
  status       TEXT NOT NULL,         -- 'succeeded', 'failed', 'refunded'
  amount_cents INT NOT NULL
);

CREATE TABLE webhook_events (         -- aynı event'in iki kez işlenmesini engeller
  event_id    TEXT PRIMARY KEY,
  source      TEXT NOT NULL,
  received_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_products_category ON products(category_id) WHERE is_active;
CREATE INDEX idx_orders_user ON orders(user_id, created_at DESC);
```
:::

Tasarım notları:

- **Sipariş anındaki fiyat saklanır:** `order_items.unit_price_cents` sayesinde ürün fiyatı sonradan değişse de eski faturalar bozulmaz.
- **Fiyat ayrı tabloda:** Bayi, VIP gibi yeni bir fiyat seviyesi eklemek için şema değiştirmen gerekmez.
- **Stok rezervasyonu:** `reserved` alanı, ödemesi beklenen siparişlerin stoğu başkasına satmasını engeller.
- **Yarış durumu (race condition):** Stok düşerken `UPDATE stock SET quantity = quantity - $1 WHERE product_id = $2 AND quantity >= $1` kullan. Etkilenen satır sayısı 0 ise stok yetmemiştir.
- **IDOR koruması:** Sipariş sorgularında her zaman `WHERE id = $1 AND user_id = $currentUser` kullan.

## Postman koleksiyonu

Bu PDF ile birlikte masaüstüne **Toptan_Eticaret_API.postman_collection.json** dosyası kaydedildi. Kullanımı:

1. Postman'de **Import** düğmesine tıkla ve dosyayı seç.
2. Koleksiyonun **Variables** sekmesinde `baseUrl` değerini kontrol et (varsayılan: `http://localhost:3000/api/v1`).
3. Önce **Auth → Login** isteğini çalıştır. Test betiği gelen token'ı otomatik olarak `accessToken` değişkenine kaydeder.
4. Diğer istekler `Authorization: Bearer {{accessToken}}` başlığını otomatik kullanır.
5. **Orders → Create Order** isteği her çalıştırmada yeni bir `Idempotency-Key` üretir (`{{$guid}}`).

Koleksiyonda Auth, Products, Cart, Orders, Admin ve Webhooks klasörleri ile durum kodu testleri bulunur.

## Mülakat soru-cevap

**1. API nedir?** İki yazılımın önceden tanımlı kurallarla birbiriyle konuşmasını sağlayan arayüzdür.

**2. REST nedir, REST bir protokol müdür?** Hayır. REST bir mimari stildir; HTTP üzerinde kaynak odaklı, durumsuz (stateless) iletişimi tanımlar.

**3. Stateless ne demek?** Her istek, işlenmesi için gereken tüm bilgiyi (ör. token) kendisi taşır. Sunucu önceki isteği hatırlamak zorunda değildir. Bu, yatay ölçeklemeyi kolaylaştırır.

**4. PUT ile PATCH farkı nedir?** PUT kaynağın tamamını değiştirir; PATCH sadece gönderilen alanları günceller.

**5. PUT ile POST farkı nedir?** POST genelde yeni kaynak oluşturur ve idempotent değildir. PUT belirli bir adrese kaynağı yazar ve idempotenttir.

**6. Hangi HTTP metodları idempotenttir?** GET, PUT, DELETE, HEAD ve OPTIONS. POST idempotent değildir; PATCH tasarıma bağlıdır.

**7. Güvenli (safe) metod nedir?** Sunucudaki veriyi değiştirmeyen metoddur: GET, HEAD, OPTIONS. Her güvenli metod idempotenttir, tersi doğru değildir.

**8. 401 ile 403 farkı nedir?** 401: kimlik doğrulanmamış. 403: kimlik doğrulanmış ama yetkisi yok.

**9. 400 ile 422 farkı nedir?** 400: istek biçimsel olarak bozuk (geçersiz JSON). 422: biçim doğru ama iş kuralına aykırı (stoktan fazla sipariş).

**10. 200, 201 ve 204 ne zaman kullanılır?** 200 başarılı okuma/güncelleme, 201 yeni kaynak oluşturuldu, 204 başarılı ama gövde yok (silme).

**11. 500 ile 503 farkı nedir?** 500 beklenmedik sunucu hatası, 503 servisin geçici olarak kullanılamaması (bakım, aşırı yük).

**12. Authentication ile authorization farkı nedir?** Authentication "kimsin?", authorization "buna yetkin var mı?" sorusunu cevaplar.

**13. JWT nedir, şifreli midir?** İmzalı bir token formatıdır (header.payload.signature). Varsayılan olarak şifreli değildir; payload Base64 ile herkes tarafından okunabilir. Gizli veri konmamalıdır.

**14. Access token ve refresh token farkı nedir?** Access token kısa ömürlüdür (ör. 15 dk) ve her istekte gönderilir. Refresh token uzun ömürlüdür ve sadece yeni access token almak için kullanılır.

**15. OAuth 2.0 nedir?** Kullanıcının parolasını paylaşmadan üçüncü taraf uygulamaya sınırlı yetki vermesini sağlayan yetkilendirme çerçevesidir.

**16. OAuth ile OpenID Connect farkı nedir?** OAuth yetkilendirme içindir (erişim izni). OpenID Connect, OAuth üzerine kimlik doğrulama katmanı ekler ve `id_token` döndürür. "Google ile giriş" aslında OpenID Connect'tir.

**17. API key ile token farkı nedir?** API key genelde uygulamayı tanımlar ve uzun ömürlüdür. Token genelde kullanıcıyı temsil eder, süreli ve kapsamlıdır.

**18. CORS nedir, kim uygular?** Farklı origin'ler arası istekleri kontrol eden mekanizmadır. Tarayıcı uygular, sunucu izin başlıklarını gönderir.

**19. Preflight isteği nedir?** Tarayıcının asıl istekten önce gönderdiği `OPTIONS` isteğidir; izin verilen metod ve başlıkları sorar.

**20. Path ve query parametresi farkı nedir?** Path kaynağı tanımlar (`/products/12`), query filtreler ve sıralar (`?category=spices`).

**21. Pagination neden gerekir, türleri nelerdir?** Büyük listeleri parça parça döndürmek için. Türleri: page/limit, offset/limit ve cursor.

**22. Rate limiting nedir?** Belirli sürede yapılabilecek istek sayısını sınırlar. Aşılınca `429 Too Many Requests` döner.

**23. Webhook ile polling farkı nedir?** Polling'de istemci sürekli sorar; webhook'ta olay olunca karşı sistem haber verir.

**24. Webhook güvenliği nasıl sağlanır?** İmza (HMAC) doğrulaması, HTTPS, event ID ile tekrar kontrolü ve hızlı `200` cevabı.

**25. API versiyonlama neden yapılır?** Mevcut istemcileri bozmadan geriye uyumsuz değişiklik yapabilmek için. En yaygını URL ile (`/v1`, `/v2`).

**26. REST ile GraphQL farkı nedir?** REST'te çok endpoint vardır ve sunucu yanıtı belirler. GraphQL'de genelde tek endpoint vardır ve istemci istediği alanları seçer.

**27. Over-fetching ve under-fetching nedir?** Over-fetching: ihtiyacından fazla veri gelmesi. Under-fetching: tek istek yetmeyip birden çok istek atmak zorunda kalmak.

**28. IDOR açığı nedir?** Kullanıcının URL'deki ID'yi değiştirerek başkasının verisine erişebilmesidir. Her istekte sahiplik kontrolüyle önlenir.

**29. Idempotency-Key ne işe yarar?** Ağ hatası nedeniyle tekrarlanan POST isteğinin ikinci kez işlem yapmasını (çift sipariş, çift ödeme) engeller.

**30. API'yi hızlandırmak için neler yapılır?** Cache, pagination, veritabanı indeksi, gereksiz alanları döndürmemek, sıkıştırma (gzip) ve ağır işleri asenkron kuyruğa almak.

## Tek sayfalık özet

| HTTP metodları | | |
|---|---|---|
| **GET** | Oku | Güvenli, idempotent |
| **POST** | Oluştur / işlem başlat | İdempotent değil |
| **PUT** | Tamamen değiştir | İdempotent |
| **PATCH** | Kısmen güncelle | Tasarıma bağlı |
| **DELETE** | Sil | İdempotent |
| **OPTIONS** | İzinleri sor (CORS) | Güvenli |

| Durum kodları | | Durum kodları | |
|---|---|---|---|
| 200 | OK | 401 | Kimlik yok |
| 201 | Oluşturuldu | 403 | Yetki yok |
| 202 | Kabul edildi (asenkron) | 404 | Bulunamadı |
| 204 | İçerik yok | 409 | Çakışma |
| 301/302 | Yönlendirme | 422 | İş kuralı hatası |
| 304 | Değişmedi (cache) | 429 | Çok fazla istek |
| 400 | Hatalı istek | 500 / 503 | Sunucu hatası / erişilemiyor |

| Temel terimler | |
|---|---|
| **Endpoint** | API'nin belirli URL'si |
| **Resource** | Yönetilen veri (ürün, sipariş) |
| **Payload** | İstek/cevabın veri gövdesi |
| **Header** | Meta veri (Content-Type, Authorization) |
| **JWT** | İmzalı token: header.payload.signature |
| **OAuth 2.0** | Parolasız yetki devri |
| **CORS** | Tarayıcının origin'ler arası kontrolü |
| **Webhook** | Olay olunca gelen HTTP çağrısı |
| **Idempotent** | Tekrarlansa da sonuç aynı |
| **Rate limit** | Zaman başına istek sınırı → 429 |
| **OpenAPI** | API'yi tanımlayan standart (Swagger) |
| **Latency** | İstek-cevap arası süre (ms) |

:::quiz{src="quiz.json"}
:::

:::next{lesson="i-05-api-testing-notes"}
:::

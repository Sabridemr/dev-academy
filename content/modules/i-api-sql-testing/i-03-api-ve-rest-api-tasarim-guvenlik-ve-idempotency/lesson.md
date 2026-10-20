---
id: i-03-api-ve-rest-api-tasarim-guvenlik-ve-idempotency
slug: api-ve-rest-api-tasarim-guvenlik-ve-idempotency
module: i-api-sql-testing
order: 3
title:
  tr: "API ve REST API: Versiyonlama, Webhook, Pagination, Dokümantasyon, Güvenlik ve Idempotency"
  en: "API and REST API: Versioning, Webhooks, Pagination, Documentation, Security and Idempotency"
summary:
  tr: "Versiyonlama, webhook, pagination, hata yönetimi, güvenlik ve idempotency ile sağlam API tasarlamayı öğren."
  en: "Learn to design robust APIs with versioning, webhooks, pagination, error handling, security and idempotency."
durationMinutes: 25
level: intermediate
tags: [api, versioning, webhook, openapi, api-security, idempotency]
prerequisites: [i-02-api-ve-rest-api-temeller-ve-guvenlik, a-06-api-gateway]
concepts: [api-versioning, webhook, pagination, error-handling, openapi, rest-vs-graphql, idor, idempotency]
---

## API versiyonlama

API zamanla değişir. Ancak canlıdaki müşterilerin veya mobil uygulamaların eski API’ye bağlı olması mümkündür. **Versioning**, bu değişiklikleri mevcut istemcileri kırmadan yönetmeyi sağlar.

URL ile sürümleme örneği:

:::code{lang="text"}
```text
/api/v1/products
/api/v2/products
```
:::

Header ile sürümleme örneği:

:::code{lang="http"}
```http
Accept: application/vnd.magaza.v2+json
```
:::

En pratik ve anlaşılır yaklaşım çoğu proje için URL tabanlı sürümlemedir.

Örnek: v1’de ürün fiyatı tek sayı iken:

:::code{lang="json"}
```json
{
  "price": 420
}
```
:::

v2’de para birimi ve bayi fiyatı eklenebilir:

:::code{lang="json"}
```json
{
  "price": {
    "retail": 420,
    "wholesale": 350,
    "currency": "TRY"
  }
}
```
:::

Bu değişim v1 kullanan uygulamaları bozabileceği için v2 ile yayınlanır.

## Latency nedir?

**Latency**, API isteğinin gönderilmesi ile cevabın alınması arasında geçen süredir. Genellikle milisaniye (ms) olarak ölçülür.

Örnek:

:::code{lang="text"}
```text
İstek gönderildi: 10:00:00.000
Cevap alındı:    10:00:00.280
Latency: 280 ms
```
:::

Düşük latency daha hızlı kullanıcı deneyimi sağlar. Fakat sadece toplam süreye değil, şu parçalara da bakmak gerekir:

- Ağ gecikmesi
- Sunucu işlem süresi
- Veritabanı sorgu süresi
- Harici servislerin cevap süresi
- Görsel veya büyük JSON payload boyutu

Ürün listeleme endpoint’i çok yavaşsa; pagination, cache, görsel optimizasyonu ve veritabanı indeksleriyle iyileştirme yapılabilir.

## Senkron ve asenkron API

### Senkron API

İstemci isteği gönderir ve sunucu tamamlayana kadar cevabı bekler.

:::code{lang="text"}
```text
Müşteri sipariş oluşturur → API stok kontrolü yapar → sipariş kaydeder → cevap verir
```
:::

Bu, basit ve hızlı işlemler için uygundur.

### Asenkron API

İstemci isteği gönderir; işlem arka planda devam eder ve sonuç daha sonra alınır.

Örnek:

:::code{lang="text"}
```text
Ürün kataloğunu PDF olarak oluştur
```
:::

Bu işlem uzun sürebilir. API hemen şunu dönebilir:

:::code{lang="http"}
```http
202 Accepted
```
:::

:::code{lang="json"}
```json
{
  "jobId": "export_9087",
  "status": "processing"
}
```
:::

Daha sonra kullanıcı:

- polling ile sonucu sorabilir,
- webhook alabilir,
- e-posta bildirimi alabilir,
- uygulama içi bildirim görebilir.

Toplu fiyat güncelleme, stok içe aktarma, rapor oluşturma ve dosya işleme gibi ağır işler asenkron tasarlanır.

## Webhook nedir?

**Webhook**, belirli bir olay gerçekleştiğinde bir sistemin senin belirlediğin URL’ye otomatik HTTP isteği göndermesidir.

Polling yaklaşımında sen sürekli sorarsın:

:::code{lang="text"}
```text
“Ödeme tamamlandı mı?”
“Ödeme tamamlandı mı?”
“Ödeme tamamlandı mı?”
```
:::

Webhook yaklaşımında ödeme sistemi sana haber verir:

:::code{lang="text"}
```text
“Ödeme tamamlandı.”
```
:::

Örnek ödeme webhook’u:

:::code{lang="http"}
```http
POST /api/webhooks/payment
```
:::

:::code{lang="json"}
```json
{
  "event": "payment.succeeded",
  "paymentId": "pay_12345",
  "orderId": "ORD-2026-1045",
  "amount": 10500
}
```
:::

Webhook kullanırken mutlaka şunları yapmalısın:

- İmza doğrulaması yap.
- Aynı event’in tekrar gelmesine karşı idempotent tasarım kullan.
- Webhook’u hızlı şekilde `200 OK` ile karşıla.
- Ağır işlemleri arka plan kuyruğuna aktar.
- Event ID kaydet ve tekrarları engelle.
- Başarısız çağrılar için retry mantığı kur.

:::callout{tone="tip" title="Mülakatta böyle söyle:"}
Webhook'ta imzayı doğrularım, event ID ile tekrarları engellerim, hızlıca 200 dönerim ve ağır işi kuyruğa atarım.
:::

## Query parametreleri ve path parametreleri

**Path parametresi**, kaynağın kimliğini URL yolunda belirtir:

:::code{lang="http"}
```http
GET /api/products/123
```
:::

Buradaki `123`, path parametresidir.

**Query parametresi**, sonuçları filtrelemek, sıralamak veya sayfalamak için URL sonuna eklenir:

:::code{lang="http"}
```http
GET /api/products?category=olive-oil&minPrice=300&sort=price_desc
```
:::

Örnek kullanım:

:::code{lang="http"}
```http
GET /products/123
```
:::

Belirli ürünü getirir.

:::code{lang="http"}
```http
GET /products?category=spices&page=2&limit=24
```
:::

Baharat kategorisindeki ürünlerin ikinci sayfasını getirir.

Kural olarak path parametresi “hangi kaynağa erişiyorum?”, query parametresi ise “hangi koşullarda veya hangi görünümde istiyorum?” sorusuna cevap verir.

## Pagination nedir?

**Pagination**, büyük veri listelerini küçük parçalar halinde döndürme yöntemidir.

Örneğin binlerce ürün varsa, hepsini tek istekte göndermek yavaş ve maliyetli olur. Bunun yerine:

:::code{lang="http"}
```http
GET /api/products?page=2&limit=20
```
:::

Örnek cevap:

:::code{lang="json"}
```json
{
  "data": [
    {
      "id": 21,
      "name": "Kekik"
    }
  ],
  "pagination": {
    "page": 2,
    "limit": 20,
    "totalItems": 248,
    "totalPages": 13
  }
}
```
:::

Yaygın pagination yaklaşımları:

- **Page + limit:** Kullanımı kolaydır; yönetim panellerinde yaygındır.
- **Offset + limit:** Basit SQL sorgularında kolaydır, büyük tablolarda performans problemi yaşayabilir.
- **Cursor pagination:** Büyük ve sürekli değişen listelerde daha güvenilir ve performanslıdır.

E-ticaret ürün listelemelerinde başlangıç için `page` ve `limit` çoğu zaman yeterlidir.

## Hata yönetimi

İyi bir API hata durumunda sadece “bir şeyler ters gitti” dememelidir. Hem kullanıcıya hem geliştiriciye anlaşılır, tutarlı ve güvenli bir cevap vermelidir.

Örnek iyi hata cevabı:

:::code{lang="json"}
```json
{
  "error": {
    "code": "INSUFFICIENT_STOCK",
    "message": "Requested quantity exceeds available stock.",
    "details": {
      "productId": 12,
      "availableQuantity": 4
    },
    "requestId": "req_8f1a2"
  }
}
```
:::

İyi hata yönetimi için:

- Doğru HTTP status code kullan.
- Tüm endpoint’lerde aynı hata formatını koru.
- Kullanıcıya teknik stack trace gönderme.
- Sunucuda ayrıntılı hata logu tut.
- `requestId` ile loglarda ilgili hatayı bul.
- Doğrulama hatalarını alan bazında göster.
- Geliştirme ve üretim ortamında hata ayrıntısı seviyesini farklı tut.

## API dokümantasyonu

**API documentation**, bir geliştiricinin API’yi nasıl kullanacağını anlatan teknik kılavuzdur.

İyi dokümantasyonda şunlar bulunur:

- Base URL
- Authentication yöntemi
- Endpoint listesi
- HTTP metodları
- Parametreler
- Request body örnekleri
- Response örnekleri
- Hata kodları
- Rate limit kuralları
- Webhook olayları
- Sürüm ve değişiklik notları

Örnek dokümantasyon bölümü:

:::code{lang="http"}
```http
GET /api/v1/products/{id}
```
:::

:::code{lang="text"}
```text
Açıklama: Belirli bir ürünün ayrıntılarını getirir.
Authentication: Optional
Response: 200 OK
```
:::

Swagger UI / OpenAPI, Redoc ve Postman Documentation bu amaçla sık kullanılan çözümlerdir.

## Swagger ve OpenAPI

**OpenAPI Specification**, bir REST API’nin endpoint’lerini, parametrelerini, güvenlik yöntemlerini ve veri şemalarını makine tarafından okunabilir biçimde tanımlayan standarttır.

**Swagger**, bu standardın etrafında gelişmiş araç ekosistemidir. Günlük kullanımda insanlar bazen Swagger ve OpenAPI kelimelerini aynı anlamda kullanır; teknik olarak OpenAPI spesifikasyondur, Swagger ise araç ailesidir.

Basit OpenAPI örneği:

:::code{lang="yaml"}
```yaml
paths:
  /products/{id}:
    get:
      summary: Get a product
      responses:
        "200":
          description: Product found
```
:::

OpenAPI ile:

- Etkileşimli API dokümantasyonu oluşturulur.
- İstemci SDK’ları üretilebilir.
- Sunucu kod iskeleti üretilebilir.
- Şema doğrulaması yapılabilir.
- API sözleşmesi ekipler arasında paylaşılabilir.

## Schema nedir?

**Schema**, bir verinin hangi alanlardan oluştuğunu, her alanın tipini ve kurallarını tanımlar.

Ürün şeması örneği:

:::code{lang="json"}
```json
{
  "type": "object",
  "required": ["name", "price", "stock"],
  "properties": {
    "name": {
      "type": "string",
      "minLength": 2
    },
    "price": {
      "type": "number",
      "minimum": 0
    },
    "stock": {
      "type": "integer",
      "minimum": 0
    }
  }
}
```
:::

Bu şema şunları garanti etmeye çalışır:

- `name` zorunlu olmalı.
- `price` sayı olmalı ve negatif olmamalı.
- `stock` tam sayı olmalı ve negatif olmamalı.

Schema; API doğrulama, test, OpenAPI dokümantasyonu, frontend-backend sözleşmesi ve otomatik kod üretimi açısından önemlidir.

## REST ve SOAP farkı

REST ve SOAP aynı şey değildir.

| Özellik | REST | SOAP |
|---|---|---|
| Yapı | Mimari stil | Katı mesajlaşma protokolü |
| Veri formatı | Genellikle JSON, ayrıca XML vb. | XML tabanlı |
| Taşıma | Genellikle HTTP | HTTP, SMTP ve farklı taşıma yöntemleri |
| Esneklik | Daha esnek | Daha katı kurallı |
| Öğrenme/kullanım | Daha kolay ve hafif | Daha karmaşık ve ayrıntılı |
| Yaygın alan | Modern web ve mobil API’ler | Bankacılık, eski kurumsal sistemler |

REST daha hafif ve web uygulamalarında çok yaygındır. SOAP ise güçlü sözleşme, standartlaşmış hata yapısı ve bazı kurumsal güvenlik standartları nedeniyle eski veya yüksek kurallı sistemlerde hâlâ görülebilir.

## REST ve GraphQL farkı

REST’te çoğu zaman birden fazla endpoint vardır:

:::code{lang="http"}
```http
GET /products/12
GET /products/12/reviews
GET /products/12/supplier
```
:::

GraphQL’de genellikle tek endpoint bulunur ve istemci ihtiyacı olan alanları seçer:

:::code{lang="graphql"}
```graphql
query {
  product(id: "12") {
    name
    price
    stock
    reviews {
      rating
      comment
    }
  }
}
```
:::

| Konu | REST | GraphQL |
|---|---|---|
| Endpoint yapısı | Birden fazla endpoint | Genellikle tek endpoint |
| Veri seçimi | Sunucu belirler | İstemci istediği alanları seçer |
| Basitlik | Basit CRUD için çok uygun | Karmaşık ilişkili veri için avantajlı |
| Cache | HTTP cache kullanımı daha doğrudan | Daha özel cache stratejileri gerekebilir |
| Risk | Over-fetching veya under-fetching | Karmaşık sorgu ve maliyet kontrolü gerekir |

Katalog, ürün, varyant, fiyat, stok, kampanya ve müşteri özel fiyatlarının yoğun olduğu bir e-ticaret sisteminde GraphQL bazı frontend ekranlarını kolaylaştırabilir. Ancak başlangıç veya sade bir sistem için iyi tasarlanmış REST API daha hızlı ve yönetilebilir bir tercih olur.

:::callout{tone="tip" title="Mülakatta böyle söyle:"}
GraphQL over-fetching sorununu çözer ama cache ve sorgu maliyeti kontrolünü zorlaştırır. Basit CRUD için REST yeterlidir.
:::

## HATEOAS nedir?

**HATEOAS (Hypermedia As The Engine Of Application State)**, API cevabının kullanıcının yapabileceği sonraki işlemlere ait bağlantıları da içermesi yaklaşımıdır.

Örnek:

:::code{lang="json"}
```json
{
  "id": "ORD-2026-1045",
  "status": "pending",
  "links": [
    {
      "rel": "self",
      "href": "/api/orders/ORD-2026-1045"
    },
    {
      "rel": "cancel",
      "href": "/api/orders/ORD-2026-1045/cancel"
    }
  ]
}
```
:::

Bu yaklaşım istemcinin API’de ilerleyebileceği yolları API cevabından keşfetmesini sağlar. Pratikte her REST API tam HATEOAS uygulamaz; özellikle sade web ve mobil API’lerde zorunlu değildir.

## REST API tasarım ilkeleri

İyi bir REST API için temel uygulamalar:

- Kaynakları çoğul isimlerle tasarla: `/products`, `/orders`, `/customers`
- URL’lerde fiil kullanma: `/products/123` tercih et, `/getProduct/123` değil
- HTTP metodlarını doğru kullan
- Anlamlı status code döndür
- Tutarlı JSON formatı kullan
- Hata cevaplarını standardize et
- Filtreleme, sıralama ve pagination desteği ekle
- Büyük değişikliklerde API sürümü kullan
- OpenAPI ile dokümantasyon hazırla
- Güvenliği başlangıçtan itibaren düşün
- Log, monitoring ve request ID uygula
- İdempotency gerektiren kritik işlemleri koru.

## API güvenliği

API güvenliği sadece token koymaktan ibaret değildir. Katmanlı savunma gerekir.

### Temel güvenlik listesi

- **HTTPS kullan:** HTTP üzerinden token veya parola taşımayın.
- **Authentication uygula:** Kullanıcının kimliğini doğrula.
- **Authorization uygula:** Her işlemde rol ve kaynak bazlı yetki kontrolü yap.
- **Input validation yap:** Gelen tüm alanları doğrula.
- **Rate limit uygula:** Brute-force ve kötüye kullanımı azalt.
- **Hassas veriyi loglama:** Parola, kart verisi, token ve kişisel verileri maskele.
- **Token ömrünü sınırla:** Kısa ömürlü access token, güvenli refresh token yaklaşımı kullan.
- **CORS’u kısıtla:** Her domaine `*` ile sınırsız izin verme.
- **Güvenlik header’ları kullan:** HSTS gibi korumaları yapılandır.
- **Webhook imzasını doğrula:** Dış sistemden gelen çağrıların gerçek kaynağını kontrol et.
- **IDOR açıklarını engelle:** Kullanıcı sadece kendi siparişine erişebilmeli.
- **SQL injection ve XSS risklerini azalt:** Parametreli sorgu, çıktı kodlama ve sanitizasyon uygula.

Örnek IDOR hatası:

:::code{lang="http"}
```http
GET /api/orders/1001
```
:::

Giriş yapan herhangi bir kullanıcı sipariş numarasını değiştirerek başka müşterilerin siparişini görebiliyorsa, ciddi bir yetkilendirme açığı vardır. Sunucu her istekte siparişin o kullanıcıya ait olup olmadığını kontrol etmelidir.

:::callout{tone="tip" title="Mülakatta böyle söyle:"}
En sık gözden kaçan açık IDOR'dur. Her istekte kaynağın o kullanıcıya ait olup olmadığını sunucuda kontrol ederim.
:::

## Idempotency nedir?

**Idempotency**, aynı isteğin birden fazla kez gönderilmesinin sistem üzerinde aynı nihai etkiyi yaratmasıdır.

Örnek:

:::code{lang="http"}
```http
PUT /api/products/12
```
:::

Aynı ürün bilgisi on kez gönderilirse ürünün son durumu aynı kalır.

`DELETE /api/products/12` çağrısı da çoğu tasarımda idempotent kabul edilir: ilk çağrı ürünü siler, sonraki çağrılar ürün zaten silinmiş olduğu için farklı bir kaynak oluşturmaz.

Ancak ödeme ve sipariş oluşturma işlemlerinde çok dikkat gerekir. Ağ hatası yüzünden istemci aynı POST isteğini tekrar gönderirse çift sipariş oluşabilir.

Bu nedenle ödeme/sipariş gibi kritik POST endpoint’lerinde **Idempotency-Key** kullanılabilir:

:::code{lang="http"}
```http
POST /api/orders
Idempotency-Key: 81a65a2f-ec8d-4f06-a2aa-123456789abc
```
:::

Sunucu aynı anahtarla gelen tekrar isteği yeni sipariş yaratmak yerine ilk işlemin sonucuyla cevaplayabilir.

:::callout{tone="tip" title="Mülakatta böyle söyle:"}
GET, PUT ve DELETE idempotenttir; POST değildir. Ödeme ve sipariş gibi işlemlerde Idempotency-Key ile tekrarları güvenli hale getiririm.
:::

## Dene: API rate limiting

:::interactive{type="rate-limiter" algorithm="token-bucket" capacity=10 refillPerSec=2}
Token bucket ve sliding window algoritmalarını karşılaştır; ani istek patlamasında hangi isteklerin 429 ile reddedildiğini izle.
:::

:::quiz{src="quiz.json"}
:::

:::next{lesson="i-04-api-ve-rest-api-uctan-uca-ornek-ve-mulakat"}
:::

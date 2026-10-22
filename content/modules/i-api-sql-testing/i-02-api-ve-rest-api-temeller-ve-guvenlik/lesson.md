---
id: i-02-api-ve-rest-api-temeller-ve-guvenlik
slug: api-ve-rest-api-temeller-ve-guvenlik
module: i-api-sql-testing
order: 2
title:
  tr: "API ve REST API: Temeller, HTTP, Kimlik Doğrulama, CORS ve Postman ile Test"
  en: "API and REST API: Fundamentals, HTTP, Authentication, CORS and Testing with Postman"
summary:
  tr: "REST, HTTP yöntemleri, durum kodları, kimlik doğrulama, CORS ve Postman testiyle API temellerini kavra."
  en: "Grasp API basics through REST, HTTP methods, status codes, authentication, CORS and Postman testing."
durationMinutes: 25
level: beginner
tags: [api, rest, http, authentication, cors, postman]
prerequisites: [i-01-how-apis-are-created-and-called, a-01-client-server-dns-http]
concepts: [rest, http-methods, http-status-codes, idempotency, authentication, jwt, cors, api-gateway]
---

## API nedir?

**API (Application Programming Interface)**, iki yazılımın birbiriyle kontrollü biçimde konuşmasını sağlayan arayüzdür.

Örneğin toptan gıda e-ticaret sitende:

- Web sitesi müşteriden sipariş bilgilerini alır.
- API bu bilgileri sunucuya gönderir.
- Sunucu stok, fiyat, müşteri ve sipariş işlemlerini yapar.
- Sonucu tekrar web sitesine gönderir.

Bir müşteri zeytinyağı ürününü görüntülediğinde tarayıcı şu isteği yapabilir:

:::code{lang="http"}
```http
GET /api/products/olive-oil
```
:::

Sunucu da örneğin şunu döner:

:::code{lang="json"}
```json
{
  "id": 12,
  "name": "Naturel Sızma Zeytinyağı",
  "price": 420,
  "currency": "TRY",
  "stock": 85
}
```
:::

API, kullanıcı arayüzü ile veritabanı arasında doğrudan bağlantı kurulmasını engeller; güvenlik, doğrulama ve iş kurallarını merkezi hâle getirir.

## API türleri

API’ler erişim biçimine göre birkaç gruba ayrılır:

| Tür | Anlamı | Örnek kullanım |
|---|---|---|
| Public / Open API | Geliştiricilere açık API | Hava durumu, kur, harita API’leri |
| Partner API | Sadece anlaşmalı firmalara açık API | Bayi, kargo veya ödeme entegrasyonu |
| Internal / Private API | Şirket içinde kullanılan API | Yönetim paneli ile stok sistemi bağlantısı |
| Composite API | Birden fazla sistemin sonucunu birleştirir | Ürün + stok + fiyat + kargo bilgisini tek yanıtta döndürmek |

Örneğin sitendeki ürün detay sayfası; ürün bilgisini, güncel stoğu, bayi fiyatını ve teslimat bilgisini farklı servislerden alıp tek bir API cevabında birleştirebilir.

## REST API nedir?

**REST (Representational State Transfer)**, web API tasarlamak için yaygın bir mimari yaklaşımdır. REST API’lerde kaynaklar URL’lerle temsil edilir ve bu kaynaklara HTTP yöntemleriyle işlem yapılır.

Örnek kaynaklar:

:::code{lang="text"}
```text
/products
/orders
/customers
/categories
```
:::

Bir ürüne erişmek için:

:::code{lang="http"}
```http
GET /api/products/123
```
:::

Bir REST API’nin önemli mantıkları:

- URL’ler nesneleri veya kaynakları ifade eder: `/products/123`
- İşlemi HTTP yöntemi belirtir: `GET`, `POST`, `PUT`, `PATCH`, `DELETE`
- Her istek bağımsızdır; sunucu önceki isteğin durumunu zorunlu olarak hatırlamaz.
- Veri çoğunlukla JSON biçiminde taşınır.
- İstemci ile sunucu birbirinden ayrıdır; arayüz değişebilir, API aynı kalabilir.

:::callout{tone="tip" title="Mülakatta böyle söyle:"}
REST bir protokol değil, mimari stildir. Kaynaklar URL ile, işlemler HTTP metodu ile ifade edilir ve her istek durumsuzdur.
:::

## HTTP yöntemleri

HTTP metodları, API’ye “ne yapmak istiyorum?” bilgisini verir.

| Metot | Temel amaç | E-ticaret örneği |
|---|---|---|
| GET | Veri okumak | Ürünleri listelemek |
| POST | Yeni veri oluşturmak veya işlem başlatmak | Sipariş oluşturmak |
| PUT | Kaynağı tamamen değiştirmek | Ürün bilgisini tüm alanlarıyla güncellemek |
| PATCH | Kaynağın bir kısmını güncellemek | Sadece ürün fiyatını değiştirmek |
| DELETE | Kaynağı silmek | Ürünü silmek |
| OPTIONS | İzin verilen yöntemleri öğrenmek | CORS ön kontrolü |

Örnekler:

:::code{lang="http"}
```http
GET /api/products
```
:::

Ürün listesini getirir.

:::code{lang="http"}
```http
POST /api/orders
Content-Type: application/json
```
:::

:::code{lang="json"}
```json
{
  "customerId": 45,
  "items": [
    {
      "productId": 12,
      "quantity": 10
    }
  ]
}
```
:::

Yeni sipariş oluşturur.

:::code{lang="http"}
```http
PATCH /api/products/12
```
:::

:::code{lang="json"}
```json
{
  "price": 450
}
```
:::

Sadece fiyatı değiştirir.

## PUT ve POST farkı

Bu konu mülakatlarda çok sorulur.

**POST**, genellikle yeni kaynak oluşturmak veya özel bir işlem başlatmak için kullanılır.

:::code{lang="http"}
```http
POST /orders
```
:::

Bu çağrı her tekrarlandığında ayrı sipariş oluşabilir. Bu nedenle POST çoğunlukla **idempotent değildir**.

**PUT**, belirli bir kaynağı tamamen oluşturmak veya güncellemek için kullanılır.

:::code{lang="http"}
```http
PUT /products/12
```
:::

Aynı ürün verisini bu endpoint’e on kez gönderirsen, nihai durum aynı kalmalıdır. Bu nedenle PUT genellikle **idempotent** kabul edilir.

:::callout{tone="info"}
Önemli düzeltme: “POST her zaman oluşturur, PUT her zaman günceller” diye katı bir kural yoktur. Anlam, API tasarımına bağlıdır. Ancak REST’te yaygın kullanım bu şekildedir.
:::

:::callout{tone="tip" title="Mülakatta böyle söyle:"}
PUT idempotenttir, aynı isteği on kez göndersem de sonuç aynıdır. POST değildir; bu yüzden kritik POST isteklerinde Idempotency-Key kullanırım.
:::

## Endpoint ve resource

**Endpoint**, API’ye ulaşmak için kullanılan belirli URL’dir.\
**Resource (kaynak)** ise API’nin yönettiği kavramsal veridir.

Örnek:

:::code{lang="text"}
```text
/api/products
```
:::

Bu URL ürün koleksiyonunu temsil eder.

:::code{lang="text"}
```text
/api/products/123
```
:::

Bu URL, ID’si 123 olan tek ürün kaynağını temsil eder.

Örnek e-ticaret endpoint yapısı:

:::code{lang="text"}
```text
GET    /api/products             → Ürünleri listele
POST   /api/products             → Yeni ürün ekle
GET    /api/products/123         → Tek ürünü getir
PATCH  /api/products/123         → Ürünü kısmen güncelle
DELETE /api/products/123         → Ürünü sil
```
:::

Bu yapıya **RESTful routing** denir: URL kaynak odaklıdır, fiil yerine HTTP metodu kullanılır. Yani `/getProducts` yerine `/products` kullanmak daha RESTful’dur.

## JSON ve XML

API’lerde veri, istemci ve sunucu arasında belirli bir formatla taşınır.

### JSON

JSON, güncel web API’lerinde en yaygın veri biçimidir. Hafiftir, okunması kolaydır ve JavaScript ile doğal biçimde çalışır.

:::code{lang="json"}
```json
{
  "name": "Kuru İncir",
  "price": 350,
  "stock": 42,
  "organic": true
}
```
:::

### XML

XML daha eski ve daha ayrıntılı bir veri biçimidir. SOAP servislerinde sık görülür.

:::code{lang="xml"}
```xml
<product>
  <name>Kuru İncir</name>
  <price>350</price>
  <stock>42</stock>
</product>
```
:::

Yeni REST API projelerinde JSON çoğunlukla daha uygun seçimdir; SOAP entegrasyonlarında veya bazı kurumsal sistemlerde XML ile karşılaşabilirsin.

## HTTP durum kodları

HTTP durum kodları, API isteğinin sonucunu standardize eder.

| Kod | Anlamı | Örnek |
|---|---|---|
| 200 OK | İstek başarılı | Ürün bilgisi getirildi |
| 201 Created | Yeni kaynak oluşturuldu | Sipariş oluşturuldu |
| 204 No Content | Başarılı ama gövde yok | Ürün silindi |
| 400 Bad Request | İstek/veri hatalı | Fiyat alanı geçersiz |
| 401 Unauthorized | Kimlik doğrulama gerekli veya geçersiz | Token yok/geçersiz |
| 403 Forbidden | Kullanıcı tanındı ama yetkisi yok | Bayi olmayan kullanıcının bayi fiyatına erişmesi |
| 404 Not Found | Kaynak bulunamadı | Ürün ID’si yok |
| 409 Conflict | Çakışma | Aynı e-posta ile ikinci müşteri kaydı |
| 422 Unprocessable Content | Veri biçimsel olarak doğru ama iş kuralına aykırı | Stoktan fazla sipariş |
| 429 Too Many Requests | Çok fazla istek | Rate limit aşıldı |
| 500 Internal Server Error | Sunucu tarafında beklenmeyen hata | Veritabanı veya uygulama hatası |

**401 ve 403 farkı önemlidir:**

- **401:** Kullanıcı henüz kimliğini kanıtlamamıştır; geçerli token veya giriş gerekir.
- **403:** Kullanıcı kimliği doğrulanmıştır fakat bu işlem için yetkisi yoktur.

:::callout{tone="tip" title="Mülakatta böyle söyle:"}
401 kimliğini kanıtlamamışsın demek, 403 kim olduğunu biliyorum ama yetkin yok demek.
:::

Bu 4xx kodlarının çoğu, isteğin handler'a varmadan önce geçtiği kontrol zincirinde doğar. Her kontrol bir soruyu sorar; cevap "hayır" ise istek orada kendi koduyla geri döner ve sonraki katmanlar hiç çalışmaz.

:::diagram{src="diagram.svg" alt="Bir isteğin sırayla geçtiği kontroller: tarayıcıda CORS, gateway'de kimlik ve kota, serviste yetki, doğrulama ve handler; başarısız olunca sırasıyla tarayıcı engeli, 401, 429, 403, 400 ya da 422, 404 ya da 409 döner, başarılı yolun sonunda 2xx vardır|The checks a request passes in order: CORS in the browser, identity and quota at the gateway, permission, validation and the handler in the service; on failure they return a browser block, 401, 429, 403, 400 or 422, and 404 or 409 respectively, and the successful path ends in 2xx"}
Ucuz kontroller önde: kimliği kanıtlanmamış ya da kotasını aşmış istek arka uca hiç ulaşmaz.
:::

:::predict{id="musteri-admin-istegi"}
Geçerli bir token'la giriş yapmış, rolü `customer` olan bir kullanıcı `PATCH /api/admin/products/12` çağırıyor. Hangi yanıtı alır? | A logged-in user with a valid token and the `customer` role calls `PATCH /api/admin/products/12`. Which response does the user get?
- [ ] 401 Unauthorized, çünkü yönetici değil | 401 Unauthorized, because the user is not an admin
- [x] 403 Forbidden: kimlik doğrulandı ama rol yetmiyor | 403 Forbidden: identity is verified but the role is not enough
- [ ] 429 Too Many Requests | 429 Too Many Requests
- [ ] 404 Not Found, çünkü yönetici uç noktaları gizlidir | 404 Not Found, because admin endpoints are hidden
Açıklama: Token geçerli olduğu için kimlik doğrulama (authentication) başarılıdır; 401 burada yanlıştır. Sorun yetkidedir (authorization) ve doğru kod 403'tür. Bazı API'ler kaynağın varlığını sızdırmamak için 404 de döndürür, ama bu tasarım tercihidir; varsayılan cevap 403'tür. | Authentication succeeds because the token is valid, so 401 is wrong here. The problem is permission (authorization) and the right code is 403. Some APIs return 404 to avoid revealing that a resource exists, but that is a design choice; the default answer is 403.
:::

:::animation{scene="auth-and-rate-limit.scene.json"}
Token'sız istek 401, token'lı istek 200, yetkisiz rol 403, kotayı aşan istemci 429.
:::

## Request, response ve payload

Bir API iletişimi iki bölümden oluşur:

- **Request:** İstemcinin sunucuya gönderdiği istek
- **Response:** Sunucunun istemciye verdiği cevap

**Payload**, request veya response içindeki asıl veri gövdesidir.

Örnek sipariş isteği:

:::code{lang="http"}
```http
POST /api/orders
Content-Type: application/json
Authorization: Bearer TOKEN
```
:::

:::code{lang="json"}
```json
{
  "items": [
    {
      "productId": 12,
      "quantity": 25
    }
  ],
  "deliveryAddressId": 8
}
```
:::

Buradaki JSON nesnesi request payload’dur.

Sunucunun cevabı:

:::code{lang="json"}
```json
{
  "orderId": "ORD-2026-1045",
  "status": "pending",
  "total": 10500
}
```
:::

Bu da response payload’dur.

## Headers nedir?

**HTTP header**, isteğin veya cevabın nasıl işleneceğine dair meta veridir. Veri gövdesi değildir; verinin bağlamını taşır.

Sık kullanılan header’lar:

:::code{lang="http"}
```http
Content-Type: application/json
Accept: application/json
Authorization: Bearer eyJhbGciOi...
```
:::

- `Content-Type`: Gönderdiğin gövdenin biçimini belirtir.
- `Accept`: Karşı taraftan hangi formatta cevap beklediğini belirtir.
- `Authorization`: Kimlik bilgisi veya token taşır.
- `Cache-Control`: Cevabın önbelleğe alınıp alınmayacağını belirtir.
- `X-Request-ID`: İstek takibi ve hata analizi için benzersiz kimlik taşır.

Önemli ayrım: Bir **request body** gönderirken `Content-Type` kullanırsın; sunucudan hangi cevabı istediğini belirtmek için `Accept` kullanırsın.

## Authentication ve authorization

Bu iki kavram benzer görünür ancak farklıdır:

- **Authentication (kimlik doğrulama):** “Sen kimsin?”
- **Authorization (yetkilendirme):** “Bu işlemi yapmaya iznin var mı?”

Örnek:

1. Kullanıcı e-posta ve parolasıyla giriş yapar.
2. Sistem onun Sabri olduğunu doğrular: authentication.
3. Kullanıcı yönetim panelinde ürün fiyatını değiştirmek ister.
4. Sistem onun yönetici yetkisi olup olmadığını kontrol eder: authorization.

Bir müşteri başarılı şekilde giriş yapmış olabilir ama yönetim panelindeki `/api/admin/products` endpoint’ine erişmeye çalışırsa sunucu `403 Forbidden` dönmelidir.

:::callout{tone="tip" title="Mülakatta böyle söyle:"}
Authentication kimsin sorusudur, authorization ne yapabilirsin sorusudur. Önce kimlik doğrulanır, sonra yetki kontrol edilir.
:::

## API key, token, JWT ve OAuth 2.0

### API key

API key, genellikle uygulamayı veya istemciyi tanımlayan benzersiz bir anahtardır.

:::code{lang="http"}
```http
X-API-Key: abc123...
```
:::

Genellikle üçüncü taraf servislerde, kota/rate limit yönetiminde ve uygulama tanımlamada kullanılır. Tek başına kullanıcı yetkilendirmesi için çoğu zaman yeterli güvenlik sağlamaz.

### Token

Token, kullanıcı veya uygulama için geçici erişim kanıtıdır.

:::code{lang="http"}
```http
Authorization: Bearer ACCESS_TOKEN
```
:::

Token’lar genellikle süreli olur ve API’ye her çağrıda gönderilir.

### JWT

**JWT (JSON Web Token)**, içinde kullanıcı kimliği, roller ve son kullanma zamanı gibi bilgileri taşıyabilen imzalı bir token formatıdır.

JWT üç bölümden oluşur:

:::code{lang="text"}
```text
header.payload.signature
```
:::

JWT şifrelenmiş olmak zorunda değildir; çoğu JWT sadece imzalanır. Bu nedenle gizli veri JWT payload’ına konmamalıdır.

Bunu kendin görmek için aşağıdaki inceleyicide bir token'ı çöz ve gövdesini değiştir.

:::interactive{type="jwt-inspector" secret="devacademy-demo-secret" token=""}
İnceleyicinin ürettiği örnek token'ın başlık ve gövdesinin base64url çözümüyle düz JSON olarak okunabildiğine dikkat et: içerik gizli değildir. Gövdedeki `role` değerini `user`'dan `admin`'e çevir ve imza durumunun **geçersiz** olduğunu izle; gateway'in sahte bir rolü bu sayede reddettiğini düşün. Sonra sırrı değiştirmeden "Yeniden imzala" düğmesine bas: geçerli imzayı ancak sırrı bilen taraf üretebilir. Son olarak "Süresini doldur" ile imza geçerli olsa bile token'ın reddedildiğini, yani API'nin 401 döneceği durumu gör.
:::

### OAuth 2.0

OAuth 2.0, kullanıcı şifresini üçüncü taraf uygulamayla paylaşmadan yetki verme standardıdır.

Örnek: Kullanıcı sitene Google ile giriş yapar. Sen kullanıcının Google parolasını görmezsin; Google kullanıcı onayı sonrası sitene belirli kapsamlarla bir token verir.

OAuth 2.0 özellikle şunlarda yaygındır:

- Google ile giriş
- Facebook / Apple ile giriş
- Ödeme ve finans entegrasyonları
- Takvim, e-posta veya dosya erişimi
- Üçüncü taraf uygulamalara kontrollü izin verme

:::callout{tone="tip" title="Mülakatta böyle söyle:"}
JWT şifreli değil, imzalıdır. İçeriği herkes okuyabilir ama değiştiremez; bu yüzden içine gizli veri koymam.
:::

## CORS nedir?

**CORS (Cross-Origin Resource Sharing)**, tarayıcıların farklı domain’ler arasında yapılan istekleri güvenlik açısından kontrol etme mekanizmasıdır.

Örnek:

- Frontend: `https://magaza.com`
- API: `https://api.magaza.com`

Tarayıcı, frontend’in API’ye istek atıp atamayacağını API sunucusunun gönderdiği CORS header’larına göre kontrol eder.

Örnek cevap header’ı:

:::code{lang="http"}
```http
Access-Control-Allow-Origin: https://magaza.com
Access-Control-Allow-Methods: GET, POST, PATCH, DELETE
Access-Control-Allow-Headers: Content-Type, Authorization
```
:::

CORS esas olarak **tarayıcı güvenlik mekanizmasıdır**. Sunucudan sunucuya yapılan isteklerde tarayıcı CORS kısıtı uygulanmaz.

:::callout{tone="tip" title="Mülakatta böyle söyle:"}
CORS bir sunucu güvenliği değil, tarayıcı güvenliğidir. Postman veya sunucudan sunucuya isteklerde CORS hatası olmaz.
:::

## OPTIONS ve preflight isteği

Tarayıcı, bazı çapraz alan isteklerinden önce API’ye bir `OPTIONS` isteği gönderebilir. Buna **CORS preflight** denir.

Örneğin frontend şu isteği atmak istesin:

:::code{lang="http"}
```http
POST /api/orders
Authorization: Bearer TOKEN
Content-Type: application/json
```
:::

Tarayıcı önce şunu sorabilir:

:::code{lang="http"}
```http
OPTIONS /api/orders
```
:::

Sunucu da hangi metodlara, header’lara ve origin’lere izin verdiğini cevaplar.

:::code{lang="http"}
```http
Access-Control-Allow-Origin: https://magaza.com
Access-Control-Allow-Methods: POST
Access-Control-Allow-Headers: Authorization, Content-Type
```
:::

Bu kontrol geçerse tarayıcı asıl POST isteğini gönderir.

## Rate limiting ve throttling

**Rate limiting**, belirli bir zaman aralığında yapılabilecek istek sayısını sınırlar.\
**Throttling** ise aşırı istek olduğunda hızı sınırlama veya istekleri kontrollü biçimde yavaşlatma yaklaşımıdır.

Örnek politika:

:::code{lang="text"}
```text
Bir IP adresi için dakika başına en fazla 100 istek
```
:::

Kullanıcı bu sınırı aşarsa API genellikle şunu döner:

:::code{lang="http"}
```http
429 Too Many Requests
Retry-After: 60
```
:::

E-ticaret uygulamanda rate limit özellikle şu alanlarda önemlidir:

- Giriş endpoint’i: brute-force saldırılarını azaltmak
- Şifre sıfırlama endpoint’i: SMS/e-posta kötüye kullanımını önlemek
- Ürün arama ve filtreleme: sunucu yükünü azaltmak
- Sipariş endpoint’i: otomasyon ve kötüye kullanımı önlemek
- Açık API’ler: kota ve maliyet yönetimi yapmak

## API Gateway nedir?

**API Gateway**, istemciler ile arka uç servisleri arasında duran merkezi giriş noktasıdır.

Frontend doğrudan birçok farklı servise gitmek yerine gateway’e bağlanır:

:::code{lang="text"}
```text
Web sitesi
    |
API Gateway
    |
Ürün Servisi
Sipariş Servisi
Kullanıcı Servisi
Ödeme Servisi
Stok Servisi
```
:::

Gateway şu sorumlulukları üstlenebilir:

- Kimlik doğrulama ve token kontrolü
- Rate limiting
- CORS yönetimi
- İstekleri doğru servise yönlendirme
- Loglama ve izleme
- API sürümleme
- Hata yönetimi
- Yanıtları birleştirme

AWS API Gateway, Kong ve Apigee bu amaçla kullanılan yaygın çözümlerdendir.

API testi, Postman ve mock API'ler modülün API testi dersinde ayrıntılı işleniyor. Aşağıdaki kutu, ilk kez bir API'yi elle test edecekler için kısa bir başlangıç rehberidir.

:::callout{tone="info" title="Derinleşme"}
**API test nedir?**

API testinde kullanıcı arayüzünden bağımsız şekilde endpoint’lerin doğru çalışıp çalışmadığını kontrol edersin.

Bir API testinde şunları doğrularsın:

- Endpoint doğru yanıt veriyor mu?
- Status code beklenen değer mi?
- JSON yapısı doğru mu?
- Yetkisiz kullanıcı engelleniyor mu?
- Hatalı veri doğru hata mesajını veriyor mu?
- Sistem yoğun yükte çalışıyor mu?
- Aynı istek tekrarlandığında beklenmedik veri oluşuyor mu?

Örnek test senaryosu:

```http
POST /api/orders
```

- Geçerli token + yeterli stok → `201 Created`
- Token yok → `401 Unauthorized`
- Kullanıcı giriş yapmış ama bayi yetkisi yok → `403 Forbidden`
- `quantity: -2` → `400` veya `422`
- Stok yetersiz → `409 Conflict` veya `422`
- Aynı ödeme bildirimi tekrar gelirse → çift sipariş oluşmamalı

API testi, özellikle ödeme, sipariş, stok ve kullanıcı yetkileri gibi kritik alanlarda arayüz testinden daha güvenilir temel sağlar.

**Postman nedir?**

**Postman**, API istekleri göndermek, cevapları incelemek, test yazmak, dokümantasyon hazırlamak ve koleksiyonlar oluşturmak için kullanılan popüler bir API istemcisidir.

Postman ile:

- GET, POST, PUT, PATCH ve DELETE istekleri gönderirsin.
- Header, query parametresi, body ve token eklersin.
- API yanıtını inceleyebilirsin.
- Otomatik testler yazabilirsin.
- Farklı ortamlar arasında geçiş yapabilirsin.
- İstek koleksiyonlarını ekip ile paylaşabilirsin.

**Postman örneği**

Bir ürün endpoint’ini test etmek:

```http
GET {{baseUrl}}/api/products/12
Authorization: Bearer {{accessToken}}
```

Burada `{{baseUrl}}` ve `{{accessToken}}` Postman environment variable olabilir.

Test sekmesinde örnek kontrol:

```javascript
pm.test("Status code 200 olmalı", function () {
  pm.response.to.have.status(200);
});

pm.test("Ürün adı dönmeli", function () {
  const response = pm.response.json();
  pm.expect(response.name).to.exist;
});
```

Bu sayede her istek attığında Postman otomatik doğrulama yapar.

**Postman collection ve environment**

**Collection**, ilgili API isteklerinin birlikte gruplanmış hâlidir.

Örnek koleksiyon yapısı:

```text
Wholesale E-commerce API
├── Authentication
│   ├── Login
│   ├── Refresh Token
│   └── Logout
├── Products
│   ├── List Products
│   ├── Get Product
│   └── Update Product
├── Orders
│   ├── Create Order
│   ├── List Orders
│   └── Cancel Order
└── Admin
    ├── Manage Stock
    └── Manage Prices
```

**Environment variables** ise ortama göre değişen değerleri saklar:

```text
baseUrl
accessToken
adminToken
apiKey
```

Örneğin:

```text
Development: http://localhost:3000
Staging: https://staging-api.magaza.com
Production: https://api.magaza.com
```

Böylece aynı isteği değiştirmeden farklı sunucularda test edebilirsin.

**Mock API nedir?**

**Mock API**, gerçek backend henüz hazır değilken onun davranışını taklit eden sahte API’dir.

Örneğin frontend geliştirirken gerçek ürün servisi bitmediyse mock API şu cevabı dönebilir:

```json
[
  {
    "id": 1,
    "name": "Çam Fıstığı",
    "price": 950,
    "stock": 12
  },
  {
    "id": 2,
    "name": "Kuru İncir",
    "price": 350,
    "stock": 40
  }
]
```

Böylece tasarım, ürün listeleme, sepet ve kullanıcı akışları backend beklenmeden geliştirilebilir. Ancak canlıya çıkmadan önce mock yerine gerçek API ile entegrasyon mutlaka test edilmelidir.
:::

:::realworld{company="GitHub"}
GitHub'ın herkese açık REST API'si, bu dersteki kimlik ve kota kavramlarını belgelerinde açıkça gösterir. İstemci kimliğini `Authorization: Bearer <token>` başlığıyla taşır; kişisel erişim token'ları ve GitHub App token'ları kapsam (scope) ya da izinlerle sınırlandırılır, böylece token'ın neye erişebileceği kimlikten ayrı olarak belirlenir. Kota, kimliğe göre değişir: kimliği doğrulanmamış istekler IP başına saatte 60 ile sınırlıyken, kimliği doğrulanmış kullanıcılar saatte 5.000 isteğe kadar çıkabilir. Her yanıt `x-ratelimit-limit`, `x-ratelimit-remaining` ve `x-ratelimit-reset` başlıklarını taşır; istemci kalan hakkını bunlardan okur. Limit aşıldığında API 403 ya da 429 döner ve belgeler, `retry-after` başlığı varsa o süre kadar beklemeyi, yoksa sıfırlanma zamanına kadar istek atmamayı önerir. GitHub ayrıca bazı durumlarda, gizli bir deponun varlığını sızdırmamak için yetkisiz isteğe 403 yerine 404 döndüğünü belgelerinde belirtir. Bu da yetki hatasının bazen bilerek "bulunamadı" gibi gösterildiğinin gerçek bir örneğidir.
:::

:::quiz{src="quiz.json"}
:::

:::next{lesson="i-03-api-ve-rest-api-tasarim-guvenlik-ve-idempotency"}
:::

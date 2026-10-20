---
id: i-01-how-apis-are-created-and-called
slug: how-apis-are-created-and-called
module: i-api-sql-testing
order: 1
title:
  tr: "API Nasıl Oluşturulur? / API Çağrıldığında Ne Olur?"
  en: "How to Create an API? / What Happens When an API is Called?"
summary:
  tr: "Node.js, Express ve MongoDB ile adım adım API kurmayı ve bir API çağrısının uçtan uca akışını öğren."
  en: "Learn to build an API step by step with Node.js, Express and MongoDB and trace an API call end to end."
durationMinutes: 25
level: beginner
tags: [api, http, rest, express, fastapi, fetch, curl, json, openapi]
prerequisites: [a-01-client-server-dns-http]
concepts: [request-response-cycle, http-methods, url-anatomy, http-headers, http-status-codes, json, route-handler, fetch, curl, error-handling, auth-header, api-versioning, openapi]
---

## Kavram: API bir sözleşmedir

Bir mobil uygulama "bana kullanıcı 42'nin profilini ver" dediğinde, sunucu bunu nasıl anlar? Uygulama sunucunun kodunu görmez, veritabanına doğrudan bağlanmaz. Arada **API** (Application Programming Interface) vardır: sunucunun dış dünyaya açtığı, kuralları önceden belirlenmiş bir kapı. Hangi adrese, hangi biçimde istek atılırsa hangi yanıtın geleceği bu sözleşmede yazar.

Web dünyasında bu sözleşme neredeyse her zaman **HTTP** üzerinden ve çoğunlukla **JSON** biçiminde kurulur. Dolayısıyla bir API'yi anlamak, aslında üç şeyi anlamaktır:

1. **İstek** neyi taşır (metod, URL, başlıklar, gövde),
2. **Sunucu** bu isteği hangi koda yönlendirir ve ne yapar,
3. **Yanıt** neyi taşır (durum kodu, başlıklar, gövde).

Bu dersin ilk yarısı bu üç parçayı söker; ikinci yarısı küçük bir API'yi hem sunucu hem istemci tarafında yazar.

:::diagram{src="diagram.svg" alt="İstemci bir HTTP isteği (metod, URL, başlıklar, gövde) gönderir; sunucuda yönlendirici isteği doğru handler'a iletir, handler doğrulama yapıp veritabanına gider ve durum kodu, başlıklar ve JSON gövdeden oluşan yanıtı döner|The client sends an HTTP request (method, URL, headers, body); on the server the router forwards it to the right handler, which validates, talks to the database and returns a response made of a status code, headers and a JSON body"}
Bir API çağrısının anatomisi: istek sola, yanıt sağa; ortada yönlendirici → handler → veritabanı.
:::

## İstek-yanıt döngüsü

HTTP, **istemci-sunucu** modelinde çalışır ve her etkileşim aynı döngüyü izler: istemci bir istek gönderir, sunucu isteği işler, sunucu bir yanıt döner, istemci yanıtı kullanır. Sunucu kendiliğinden konuşmaz; her yanıtın başında bir istek vardır.

Bu döngünün iki önemli özelliği vardır. Birincisi **durumsuzluk** (stateless): sunucu, iki istek arasında istemciyi hatırlamak zorunda değildir; "kim olduğunuz" bilgisi her istekte yeniden (genellikle bir başlıkla) taşınır. İkincisi, döngünün **ağ üzerinden** gerçekleşmesidir: istek bir yük dengeleyiciden, bir API gateway'den, belki bir önbellekten geçer ve her katman gecikme ekler. İleride bir simülatörle bu yolu adım adım izleyeceğiz.

## HTTP metodları: isteğin fiili

Metod, "bu kaynağa ne yapmak istiyorum" sorusunun cevabıdır. REST tarzı API'lerde bu fiiller kaynak adlarıyla (isimler) birleşir: `GET /users`, `POST /orders`.

| Metod | Anlamı | Gövde taşır mı? | Idempotent mi? | Tipik yanıt |
|---|---|---|---|---|
| `GET` | Oku | Hayır | Evet | 200 + veri |
| `POST` | Oluştur / işlem başlat | Evet | Hayır | 201 + oluşturulan kaynak |
| `PUT` | Tamamını değiştir | Evet | Evet | 200 ya da 204 |
| `PATCH` | Kısmen güncelle | Evet | Genelde hayır | 200 |
| `DELETE` | Sil | Nadiren | Evet | 204 |

**Idempotent** sözcüğü, aynı isteği beş kez göndermenin bir kez göndermekle aynı sonucu doğurması demektir. `DELETE /users/42` beş kez çağrılsa kullanıcı yine bir kez silinmiş olur; `POST /orders` beş kez çağrılırsa beş sipariş oluşur. Bu fark, ağ hatasında isteği güvenle tekrar edip edemeyeceğinizi belirler ve sonraki derslerde yeniden karşımıza çıkacak.

## Bir URL'nin anatomisi, başlıklar ve gövde

`https://api.example.com/v1/users/42/orders?status=paid&limit=20` adresini parçalayalım:

- **Şema**: `https` — şifreli bağlantı. Üretimde her zaman.
- **Alan adı (host)**: `api.example.com` — DNS'in IP'ye çevirdiği kısım.
- **Yol (path)**: `/v1/users/42/orders` — kaynağın adresi. `v1` sürüm, `users/42` belirli bir kullanıcı, `orders` onun alt kaynağı. `42` bir **yol parametresidir**.
- **Sorgu (query)**: `?status=paid&limit=20` — filtreleme, sayfalama, sıralama gibi *isteğe bağlı* seçenekler. Kaynağın kimliği yola, kaynağın nasıl listeleneceği sorguya gider.

**Başlıklar** (headers) isteğin üst verisidir: `Content-Type: application/json` gövdenin biçimini, `Accept` beklenen yanıt biçimini, `Authorization` kimliği, `Accept-Language` dili söyler. Yanıt başlıkları da benzer işler görür: `Content-Type`, önbellek kuralları (`Cache-Control`), istek izi (`X-Request-Id`).

**Gövde** (body) ise taşınan asıl veridir. `GET` isteklerinde gövde yoktur; `POST` ve `PUT`'ta genellikle bir JSON nesnesi bulunur.

## Durum kodları: yanıtın tek satırlık özeti

Durum kodu üç basamaklıdır ve ilk basamak sınıfı verir:

| Sınıf | Anlamı | Sık kullanılanlar |
|---|---|---|
| 2xx | Başarılı | `200 OK`, `201 Created`, `204 No Content` |
| 3xx | Yönlendirme | `301`, `304 Not Modified` |
| 4xx | İstemci hatası | `400 Bad Request`, `401 Unauthorized`, `403 Forbidden`, `404 Not Found`, `409 Conflict`, `422 Unprocessable Entity`, `429 Too Many Requests` |
| 5xx | Sunucu hatası | `500 Internal Server Error`, `502 Bad Gateway`, `503 Service Unavailable`, `504 Gateway Timeout` |

4xx ile 5xx arasındaki çizgi "kim düzeltecek" sorusudur: 4xx'te istemci isteğini değiştirmelidir, 5xx'te sunucu tarafında bir şey bozuktur ve istemci aynı isteği biraz sonra tekrar deneyebilir. `401` ile `403` sıkça karıştırılır: 401 "kim olduğunu bilmiyorum" (kimlik yok ya da geçersiz), 403 "kim olduğunu biliyorum ama buna iznin yok" demektir.

:::callout{tone="tip" title="Doğru kodu seçmek"}
Her hatayı `500` döndüren bir API, istemciye hiçbir şey anlatmaz. Girdi hatalıysa `400` ya da `422`, kaynak yoksa `404`, aynı e-postayla ikinci kayıt deneniyorsa `409`, limit aşıldıysa `429` verin. Durum kodu, istemcinin kodundaki `if` dallarıdır; doğru seçildiğinde istemci hata mesajını ayrıştırmak zorunda kalmaz.
:::

## JSON: ortak dil

**JSON** (JavaScript Object Notation) metin tabanlı, insan tarafından okunabilir bir veri biçimidir. Nesne (`{}`), dizi (`[]`), metin, sayı, boolean ve `null` tiplerinden oluşur; tarih ya da ondalık para gibi tipler için metin kullanılır (`"2026-10-20T09:30:00Z"`, `"19.90"`). Hemen her dilin standart kütüphanesinde JSON ayrıştırıcısı bulunduğu için API'lerin varsayılan biçimi hâline gelmiştir.

Yanıt gövdelerinde iki yaygın alışkanlık vardır: liste yanıtlarını `{ "data": [...], "nextCursor": "..." }` gibi bir zarfa sarmak (sayfalama bilgisine yer açar) ve hata yanıtlarını tek bir biçimde döndürmek (`{ "error": { "code": "USER_NOT_FOUND", "message": "..." } }`). İstemci bu biçimi bir kez öğrenir, her uç noktada aynı kodu kullanır.

## Sunucu tarafı: bir API nasıl tanımlanır?

Bir API sunucusu özünde şu döngüyü çalıştırır: isteği al → metod ve yolu tanımlı rotalarla eşleştir → eşleşen **handler** fonksiyonunu çağır → handler girdiyi doğrular, veritabanıyla konuşur ve bir yanıt üretir → yanıtı yaz. Çerçeveler (framework) bu döngünün sıkıcı kısımlarını üstlenir; siz rotaları ve handler'ları yazarsınız.

Aşağıda aynı küçük "kullanıcılar" API'si iki popüler çerçeveyle yazılmıştır: Node.js için **Express**, Python için **FastAPI**. Veritabanı yerine bellek içi bir harita kullanılır; odak, bir rotanın nasıl tanımlandığı ve yanıtın nasıl döndüğüdür.

:::code{lang="ts" title="Küçük bir kullanıcı API'si: Express ve FastAPI"}
```ts
import express from "express";

const app = express();
app.use(express.json());                       // JSON gövdeyi req.body'ye ayrıştırır

type User = { id: number; name: string; email: string };
const users = new Map<number, User>();
let nextId = 1;

// GET /v1/users/:id → yol parametresi req.params.id ile okunur
app.get("/v1/users/:id", (req, res) => {
  const user = users.get(Number(req.params.id));
  if (!user) return res.status(404).json({ error: { code: "USER_NOT_FOUND" } });
  res.json(user);                               // 200 + JSON
});

// POST /v1/users → gövde doğrulanır, kaynak oluşturulur, 201 döner
app.post("/v1/users", (req, res) => {
  const { name, email } = req.body ?? {};
  if (typeof name !== "string" || !/^\S+@\S+$/.test(String(email))) {
    return res.status(422).json({ error: { code: "INVALID_BODY" } });
  }
  const user: User = { id: nextId++, name, email };
  users.set(user.id, user);
  res.status(201).location(`/v1/users/${user.id}`).json(user);
});

app.listen(3000, () => console.log("API 3000 portunda"));
```
```python
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, EmailStr

app = FastAPI()
users: dict[int, dict] = {}
next_id = 1

class NewUser(BaseModel):          # gövde şeması: FastAPI doğrulamayı kendisi yapar (422)
    name: str
    email: EmailStr

@app.get("/v1/users/{user_id}")
def get_user(user_id: int):        # yol parametresi tip dönüşümüyle gelir
    user = users.get(user_id)
    if user is None:
        raise HTTPException(status_code=404, detail={"code": "USER_NOT_FOUND"})
    return user                    # dict otomatik JSON'a çevrilir, 200

@app.post("/v1/users", status_code=201)
def create_user(body: NewUser):
    global next_id
    user = {"id": next_id, **body.model_dump()}
    users[next_id] = user
    next_id += 1
    return user
```
:::

İki örnekte de aynı iskelet görülür: **rota** (metod + yol), **handler** (fonksiyon), **doğrulama** (yanlış girdiye 4xx), **iş mantığı** (haritaya yazmak; gerçekte veritabanı sorgusu) ve **yanıt** (durum kodu + JSON). FastAPI'nin farkı, doğrulamayı tip tanımından türetmesi ve bunun karşılığında OpenAPI belgesini otomatik üretmesidir; bu konuya dersin sonunda döneceğiz.

## İstemciden çağırmak: fetch ve curl

API'yi çağıran tarafta da aynı parçalar vardır: metod, URL, başlıklar, gövde. Tarayıcı ve Node.js'te `fetch`, komut satırında `curl` en yaygın araçlardır. `curl`, hata ayıklarken bir isteği çerçeveden bağımsız biçimde yeniden üretmenin en hızlı yoludur; bir geliştirici "şu curl komutunu çalıştırır mısın" dediğinde kastettiği budur.

:::code{lang="ts" title="Aynı iki çağrı: fetch ile ve curl ile"}
```ts
const BASE = "https://api.example.com";
const token = process.env.API_TOKEN!;

// Kullanıcı oluştur (POST + JSON gövde + kimlik başlığı)
async function createUser(name: string, email: string) {
  const res = await fetch(`${BASE}/v1/users`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ name, email }),
  });
  if (!res.ok) {                                  // 2xx dışındaki her şey
    const err = await res.json().catch(() => ({}));
    throw new Error(`HTTP ${res.status}: ${err?.error?.code ?? "UNKNOWN"}`);
  }
  return (await res.json()) as { id: number; name: string; email: string };
}

// Kullanıcı oku (GET, sorgu parametresiyle alan seçimi)
async function getUser(id: number) {
  const url = new URL(`${BASE}/v1/users/${id}`);
  url.searchParams.set("fields", "id,name");
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (res.status === 404) return null;            // "yok" bir hata değil, bir cevap
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}
```
```bash
# Kullanıcı oluştur: -X metod, -H başlık, -d gövde, -i yanıt başlıklarını da göster
curl -i -X POST https://api.example.com/v1/users \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $API_TOKEN" \
  -d '{"name":"Ayşe","email":"ayse@example.com"}'

# Kullanıcı oku: GET varsayılan, -s sessiz, çıktıyı jq ile biçimlendir
curl -s "https://api.example.com/v1/users/42?fields=id,name" \
  -H "Authorization: Bearer $API_TOKEN" | jq .
```
:::

:::interactive{type="request-journey" layers="browser,gateway,api-service,cache,db" rttMs=40 cacheHitRate=30}
Bir isteği gönderip tarayıcı → gateway → API servisi → cache → veritabanı katmanlarından geçişini şelalede izleyin; her katmanın toplam gecikmeye katkısına bakın. "Cache hit" kutusunu işaretleyip tekrar gönderin: istek veritabanına hiç inmez. RTT kaydırıcısını 40 ms'den 150 ms'ye çekip uzak bir kullanıcının aynı çağrıyı ne kadar geç aldığını görün. "20 istek" ile %30 cache isabet oranında ortalama ve p95'i karşılaştırın; oranı %90'a çıkarınca hangisi daha çok düşüyor?
:::

## Hata yönetimi: iki tarafın sorumluluğu

**Sunucu tarafında** hata yönetimi üç kuralla özetlenir: girdiyi handler'ın en başında doğrula ve geçersizse iş mantığına hiç girme; beklenmeyen istisnaları tek bir merkezi hata yakalayıcıda `500`'e çevir ve stack trace'i istemciye değil loga yaz; her hata yanıtına istemcinin dallanabileceği sabit bir `code` ve insan için bir `message` koy.

**İstemci tarafında** ise `fetch`'in davranışını bilmek gerekir: ağ hatasında (DNS, bağlantı kopması) promise reddedilir, ama `404` ya da `500` gibi HTTP hataları *başarıyla* döner ve `res.ok` false olur. Bu yüzden yukarıdaki örnekte `res.ok` kontrolü vardır. Geçici hatalarda (`503`, `429`, zaman aşımı) kısa bir bekleme ile yeniden denemek mantıklıdır; ancak yalnızca idempotent isteklerde ya da sunucu bir **idempotency anahtarı** destekliyorsa. Aksi hâlde yeniden denenen `POST`, çift sipariş yaratır.

:::callout{tone="warning" title="Kimlik bilgisini URL'ye koymayın"}
`?api_key=abc123` biçiminde sorgu parametresiyle gönderilen anahtar; tarayıcı geçmişine, sunucu erişim loglarına, proxy kayıtlarına ve `Referer` başlığıyla üçüncü taraflara sızar. Kimlik her zaman `Authorization` başlığında taşınmalı, token'lar yalnızca HTTPS üzerinden gönderilmeli ve istemci kodunda sabit yazılmak yerine ortam değişkeninden okunmalıdır.
:::

## Kimlik doğrulama başlıkları

API'ler istemciyi tanımak için neredeyse her zaman `Authorization` başlığını kullanır. En yaygın şema **Bearer**'dır: `Authorization: Bearer <token>`. Token, bir giriş akışından (OAuth 2.0, kendi `/login` uç noktanız) alınmış kısa ömürlü bir **JWT** ya da sunucu tarafında saklanan opak bir dizge olabilir. Sunucudan sunucuya çağrılarda ise genellikle uzun ömürlü bir **API anahtarı** kullanılır; o da yine bir başlıkta (`Authorization` ya da `X-API-Key`) taşınır. **Basic** şema (`Authorization: Basic base64(kullanıcı:parola)`) hâlâ bazı iç araçlarda görülür ama parolayı her istekte taşıdığı için yeni tasarımlarda tercih edilmez.

Sunucu, kimlik başlığını handler'dan önce çalışan bir **ara katmanda** (middleware) doğrular; böylece her handler ayrı ayrı "token geçerli mi" diye sormaz. Geçersiz token `401`, geçerli ama yetkisiz işlem `403` üretir.

## Versiyonlama ve dokümantasyon

API bir sözleşme olduğu için onu bozmadan değiştirmek bir disiplindir. **Geriye uyumlu** değişiklikler (yeni alan eklemek, yeni uç nokta açmak) sürüm gerektirmez; **kırıcı** değişiklikler (alan silmek, tip değiştirmek, yolun anlamını değiştirmek) yeni bir sürüm ister. En yaygın yöntem sürümü yola koymaktır (`/v1/users`, `/v2/users`); bazı API'ler sürümü bir başlıkta taşır. Hangi yöntem seçilirse seçilsin eski sürüm bir süre yaşatılır ve istemcilere taşınma takvimi duyurulur.

Dokümantasyonun endüstri standardı **OpenAPI** belgesidir: API'nin uç noktalarını, parametrelerini, gövde şemalarını ve yanıtlarını makine tarafından okunabilir bir YAML/JSON dosyasında tanımlar. Bu belgeden interaktif dokümantasyon sayfası (Swagger UI, Redoc), istemci kütüphaneleri, mock sunucular ve sözleşme testleri üretilebilir. FastAPI gibi çerçeveler belgeyi koddan otomatik çıkarır; Express'te genellikle belge önce yazılır ve kod ona göre doğrulanır.

:::code{lang="yaml" title="OpenAPI 3.1: kullanıcı okuma uç noktasının tanımı"}
```yaml
openapi: 3.1.0
info: { title: Users API, version: 1.0.0 }
paths:
  /v1/users/{id}:
    get:
      summary: Kullanıcıyı id ile getir
      security: [{ bearerAuth: [] }]
      parameters:
        - { name: id, in: path, required: true, schema: { type: integer } }
        - { name: fields, in: query, schema: { type: string }, description: "Virgülle ayrılmış alan listesi" }
      responses:
        "200":
          description: Kullanıcı bulundu
          content:
            application/json:
              schema: { $ref: "#/components/schemas/User" }
        "401": { description: Kimlik yok ya da geçersiz }
        "404": { description: Kullanıcı yok }
components:
  securitySchemes:
    bearerAuth: { type: http, scheme: bearer, bearerFormat: JWT }
  schemas:
    User:
      type: object
      required: [id, name, email]
      properties:
        id: { type: integer }
        name: { type: string }
        email: { type: string, format: email }
```
:::

:::realworld{company="Stripe"}
Stripe'ın ödeme API'si, bu dersteki kavramların neredeyse hepsinin ders kitabı örneğidir. Kimlik, `Authorization: Bearer sk_...` başlığıyla taşınır ve anahtarlar test/canlı olarak ayrılmıştır. Kırıcı değişiklikler tarih damgalı sürümlerle (`Stripe-Version: 2024-06-20` gibi bir başlık) yönetilir; bir hesabın sürümü sabitlenir ve istemci hazır olana kadar eski davranış korunur. Ağ hatasında güvenli yeniden deneme için `POST` isteklerine `Idempotency-Key` başlığı eklenir: aynı anahtarla tekrar edilen istek ikinci bir ödeme yaratmaz, ilk yanıtı döner. Hata gövdeleri sabit bir biçimdedir (`type`, `code`, `message`, `param`) ve tüm uç noktalar OpenAPI belgesiyle yayınlanır; resmî istemci kütüphaneleri bu belgeden üretilir.
:::

:::callout{tone="info" title="Mülakat özeti"}
- Bir API çağrısını uçtan uca anlatabilin: metod + URL + başlıklar + gövde → yönlendirici → handler (doğrulama → iş mantığı → veritabanı) → durum kodu + başlıklar + JSON.
- `401` ile `403`, `400` ile `422`, `PUT` ile `PATCH` farklarını bir cümleyle söyleyin.
- Idempotency'yi "yeniden deneme güvenliği" bağlamında açıklayın.
- Versiyonlama ve OpenAPI'yi "API bir sözleşmedir" cümlesine bağlayın.
:::

:::quiz{src="quiz.json"}
:::

:::next{lesson="i-02-api-ve-rest-api-temeller-ve-guvenlik"}
Sırada: REST ilkeleri, HTTP'nin incelikleri, kimlik doğrulama yöntemleri, CORS ve Postman ile ilk testler.
:::

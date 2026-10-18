---
id: a-04-stateless-stateful-sessions
slug: stateless-stateful-sessions
module: a-system-design-fundamentals
order: 4
title:
  tr: "Stateless vs. Stateful Servisler ve Oturum Yönetimi"
  en: "Stateless vs. Stateful Services and Session Management"
summary:
  tr: Durum nerede tutulur? Sunucu belleğindeki oturumun yatay ölçeklemeyi nasıl kırdığı; sticky session, merkezi oturum deposu (Redis) ve JWT yaklaşımlarının animasyonlu karşılaştırması.
  en: Where does state live? How in-memory sessions break horizontal scaling; an animated comparison of sticky sessions, a central session store (Redis) and JWT.
durationMinutes: 25
level: intermediate
tags: [stateless, session, redis, jwt, authentication, scaling]
prerequisites: [a-03-horizontal-vertical-scaling]
concepts: [stateless-service, stateful-service, session-state, sticky-session, central-session-store, jwt, token-revocation, idempotency, state-externalization]
---

## Kavram: durum (state) nedir, nerede yaşar?

Bir servisin **durumu (state)**, iki istek arasında hatırlaması gereken her şeydir: kullanıcının giriş yapmış olması, sepetindeki ürünler, sihirbazın (wizard) kaçıncı adımında olduğu, yarım kalan dosya yüklemesi.

- **Stateful servis**: Bu bilgiyi kendi belleğinde ya da diskinde tutar. İkinci isteğin aynı sunucuya gelmesi **zorunludur**; aksi hâlde kullanıcı "oturumunuz sona erdi" görür.
- **Stateless servis**: İki istek arasında hiçbir şey hatırlamaz. İhtiyaç duyduğu her bilgi ya istekle birlikte gelir (token, çerez) ya da dışarıdaki paylaşımlı bir depodan okunur (Redis, veritabanı). Herhangi bir replika herhangi bir isteği işleyebilir.

Önceki derste yatay ölçeklemenin bir numaralı ön koşulunun stateless olmak olduğunu söylemiştik. Nedeni basit: load balancer isteği rastgele bir sunucuya gönderir; sunucu kullanıcının sepetini bilmiyorsa sistem bozuktur. "Stateless" demek "durum yok" demek değildir — **durum sunucudan çıkarılmış** demektir. Durum her zaman bir yerde yaşar; soru *nerede* olduğudur.

:::diagram{src="diagram.svg" alt="Üç oturum yaklaşımı yan yana: sticky session (LB kullanıcıyı aynı sunucuya yapıştırır), merkezi Redis oturum deposu (her sunucu Redis'ten okur), JWT (durum imzalı token olarak istemcide)|Three session approaches side by side: sticky session (LB pins the user to one server), central Redis session store (every server reads from Redis), JWT (state lives on the client as a signed token)"}
Aynı problem, üç cevap: durumu sunucuda tut ve kullanıcıyı ona yapıştır; durumu paylaşımlı depoya taşı; durumu istemciye ver.
:::

## Problem: bellek içi oturum

En basit web çatısı (framework) oturumu şöyle kurar: giriş yapan kullanıcıya rastgele bir `sessionId` çerezi verilir, kullanıcı bilgisi sunucunun belleğindeki bir `Map<sessionId, Session>` yapısında tutulur. Tek sunucuda kusursuz çalışır. İkinci sunucuyu eklediğiniz an:

1. Kullanıcı S1'de giriş yapar; oturum S1'in belleğindedir.
2. Sonraki istek round-robin ile S2'ye düşer; S2'nin böyle bir oturumdan haberi yoktur → **401**.
3. S1 yeniden başlatılırsa (deploy, çökme) tüm oturumlar kaybolur → herkes çıkış yapmış olur.

Üç çözüm ailesi vardır ve her biri bir takas yapar.

## Çözüm 1: Sticky session (oturum yapışkanlığı)

Load balancer, kullanıcıyı ilk düştüğü sunucuya "yapıştırır": ya bir çerez (`AWSALB`, `SERVERID=s1`) ya da istemci IP'sinin hash'i ile sonraki istekler hep aynı sunucuya gider. Uygulama kodu değişmez; durum sunucuda kalır.

**Bedeli:**
- **Dağılım bozulur**: Yoğun kullanıcılar aynı sunucuya yığılabilir; bir sunucu %90, diğeri %30 çalışır.
- **Sunucu düşerse oturum gider**: Kullanıcı yeniden giriş yapar, sepeti boşalır.
- **Ölçek küçültme zorlaşır**: Bir sunucuyu kapatmak için üzerindeki oturumların bitmesini beklemek (connection draining) gerekir.
- **Deploy acı verir**: Her rolling deploy bir grup kullanıcıyı düşürür.

Sticky session bir **geçiş aracıdır**: eski (legacy) bir uygulamayı değiştirmeden yatay ölçeklemeniz gerekiyorsa işe yarar; yeni tasarımda tercih edilmez.

## Çözüm 2: Merkezi oturum deposu

Oturum verisi sunucu belleğinden çıkıp paylaşımlı, hızlı bir depoya taşınır — neredeyse her zaman **Redis** (ya da Memcached, DynamoDB). Akış:

1. Giriş → sunucu oturumu Redis'e yazar: `SET session:abc123 {...} EX 1800`.
2. Çerezde yalnızca `sessionId` taşınır.
3. Her istekte sunucu `GET session:abc123` yapar (~0,5 ms, aynı veri merkezinde).
4. Çıkış → `DEL session:abc123`. Anında, kesin iptal.

Artık her sunucu her isteği işleyebilir, sunucular yeniden başlatılabilir, sticky session gerekmez. Yük dengeleyici round-robin ya da least-connections kullanabilir.

**Bedeli:** Redis yeni bir bağımlılık ve potansiyel **tek hata noktasıdır**; yüksek erişilebilirlik için replikalı (Sentinel/Cluster) kurulmalıdır. Her istek bir ek ağ turu yapar (küçük ama sıfır değil). Oturum verisi büyürse (sepet, tercih, geçmiş) Redis belleği maliyet olur; çözüm, oturumda yalnızca küçük bir çekirdek (userId, roller) tutup büyük veriyi veritabanına taşımaktır.

## Çözüm 3: JWT — durumu istemciye ver

**JSON Web Token**, sunucunun *imzaladığı* bir veri paketidir: `header.payload.signature`. Payload'da `sub` (kullanıcı id), `roles`, `exp` (son geçerlilik) gibi alanlar düz metin (Base64) olarak durur; imza ise sunucunun gizli anahtarı (HMAC) ya da özel anahtarı (RSA/ECDSA) ile üretilir. Sunucu token'ı aldığında yalnızca imzayı doğrular — hiçbir depoya gitmez. Durum tamamen istemcidedir.

```
eyJhbGciOiJIUzI1NiJ9 . eyJzdWIiOiI0MiIsInJvbGVzIjpbInVzZXIiXSwiZXhwIjoxNzM1Njg5NjAwfQ . 4tQe...
   header (alg)            payload (sub, roles, exp)                                 signature
```

Bu yaklaşım özellikle **mikroservisler arasında** değerlidir: her servis token'ı bağımsız doğrular, merkezi bir oturum servisine gidip gelmez.

**Bedeli — iptal problemi:** Token `exp` dolana kadar geçerlidir ve sunucu bunu "unutamaz". Kullanıcı çıkış yapsa, şifresi değişse, hesabı kapatılsa bile çalınmış bir token süresi dolana dek çalışır. Çözümler:

- **Kısa ömürlü access token (5–15 dk) + uzun ömürlü refresh token**: Refresh token sunucu tarafında (Redis/DB) tutulur ve iptal edilebilir; access token'ın kısa ömrü hasar penceresini sınırlar.
- **Denylist**: İptal edilen token id'leri (`jti`) `exp`'e kadar Redis'te tutulur. Bu, kapıdan kovduğumuz durumu pencereden geri almaktır; ama yalnızca iptal listesi tutmak, tüm oturumları tutmaktan çok daha küçüktür.

Ayrıca payload şifreli değildir (yalnızca imzalıdır); içine hassas veri koymayın. Token boyutu her istekte taşınır; 4 KB'lık bir çerez her istekte 4 KB ek yük demektir.

### Karşılaştırma

| | **Sticky session** | **Merkezi depo (Redis)** | **JWT** |
|---|---|---|---|
| Durum nerede? | Sunucu belleği | Paylaşımlı depo | İstemci (imzalı) |
| Kod değişikliği | Yok | Oturum katmanı | Auth katmanı |
| Sunucu düşerse | Oturum kaybolur | Sorunsuz | Sorunsuz |
| İstek başına ek maliyet | Yok | 1 Redis GET | İmza doğrulama (CPU, ~µs) |
| Anında iptal | Evet | Evet | Hayır (kısa ömür / denylist) |
| Yük dağılımı | Bozulur | Dengeli | Dengeli |
| Mikroservis uyumu | Zayıf | Orta (ortak Redis) | Güçlü |
| Uygun yer | Legacy geçiş | Web oturumları, sepet | API'ler, mikroservisler, mobil |

:::animation{scene="scene.json"}
Aynı kullanıcı, üç dünya: sticky session'da S1 düşünce oturum kaybı; Redis ile herhangi bir sunucu; JWT ile hiç depo sorgusu yok ama iptal gecikmeli.
:::

:::interactive{type="load-balancer" algorithm="round-robin" servers=3 sticky=true sessionStore="memory"}
Sticky açıkken aynı renkteki kullanıcının hep aynı sunucuya gittiğini ve dağılımın bozulduğunu izleyin; bir sunucuyu düşürüp o sunucudaki oturumların kaybolduğunu görün. Sonra sessionStore'u "redis" yapıp sticky'yi kapatın: istekler serbestçe dağılır ve sunucu düşse bile oturum sürer.
:::

## Durumu dışarı taşımanın diğer yüzleri

Oturum, durumun yalnızca en görünür hâlidir. Stateless bir servis için şunlar da sunucudan çıkmalıdır:

- **Yüklenen dosyalar** → yerel disk yerine object storage (S3).
- **Zamanlanmış işler** → tek bir sunucuda cron yerine dağıtık kilit ya da kuyruk; aksi hâlde 5 replika aynı işi 5 kez yapar.
- **Yerel cache** → kabul edilebilir ama *doğruluk için gerekli* olmamalı; her replika kendi cache'ini ısıtır, tutarsızlık olabilir.
- **WebSocket bağlantıları** → bağlantı doğası gereği bir sunucuya bağlıdır (stateful); sunucular arası mesaj için pub/sub (Redis Pub/Sub, Kafka) gerekir.
- **Idempotency**: Stateless servis tekrar eden isteği ayırt edemez; `Idempotency-Key` başlığını Redis'te saklayarak çift işlemi engelleyin.

:::callout{tone="danger" title="Stateful servisler kötü değildir"}
Veritabanları, mesaj kuyrukları, cache sunucuları doğaları gereği stateful'dır ve öyle olmalıdır. Hedef, **uygulama katmanını** stateless yapıp durumu bu iş için tasarlanmış, replikasyonu ve yedeklemesi çözülmüş birkaç stateful bileşende toplamaktır. Durumu 40 web sunucusuna yaymak yerine 3 Redis düğümünde tutmak, yönetmeniz gereken "hatırlayan" şeylerin sayısını azaltır.
:::

:::code{lang="ts" title="Redis destekli oturum ara katmanı ve kısa ömürlü JWT + refresh token"}
```ts
import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import type { Redis } from "ioredis";

const SESSION_TTL_S = 30 * 60;             // 30 dk kayan pencere
const ACCESS_TTL_S = 10 * 60;              // access token kısa ömürlü
const SECRET = process.env.JWT_SECRET!;

/* ---------- Çözüm 2: merkezi oturum deposu ---------- */
export async function createSession(redis: Redis, userId: string): Promise<string> {
  const sid = randomUUID();                                     // tahmin edilemez id
  await redis.set(`session:${sid}`, JSON.stringify({ userId, createdAt: Date.now() }), "EX", SESSION_TTL_S);
  return sid;                                                   // yalnızca bu id çereze yazılır
}

export async function loadSession(redis: Redis, sid: string) {
  const raw = await redis.get(`session:${sid}`);                // herhangi bir replika okuyabilir
  if (!raw) return null;
  await redis.expire(`session:${sid}`, SESSION_TTL_S);          // her istekte süreyi uzat (sliding)
  return JSON.parse(raw) as { userId: string; createdAt: number };
}

export const destroySession = (redis: Redis, sid: string) => redis.del(`session:${sid}`); // anında iptal

/* ---------- Çözüm 3: JWT (HS256) ---------- */
const b64 = (s: string | Buffer) => Buffer.from(s).toString("base64url");

export function signJwt(payload: Record<string, unknown>, ttlS = ACCESS_TTL_S): string {
  const header = b64(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const body = b64(JSON.stringify({ ...payload, iat: Math.floor(Date.now() / 1000), exp: Math.floor(Date.now() / 1000) + ttlS, jti: randomUUID() }));
  const sig = createHmac("sha256", SECRET).update(`${header}.${body}`).digest("base64url");
  return `${header}.${body}.${sig}`;
}

export function verifyJwt(token: string): Record<string, any> | null {
  const [header, body, sig] = token.split(".");
  if (!header || !body || !sig) return null;
  const expected = createHmac("sha256", SECRET).update(`${header}.${body}`).digest("base64url");
  if (expected.length !== sig.length || !timingSafeEqual(Buffer.from(expected), Buffer.from(sig))) return null; // imza
  const claims = JSON.parse(Buffer.from(body, "base64url").toString());
  if (claims.exp <= Math.floor(Date.now() / 1000)) return null;  // süresi dolmuş
  return claims;                                                 // hiçbir depoya gidilmedi
}

/* Refresh token sunucu tarafında tutulur → iptal edilebilir */
export async function issueTokens(redis: Redis, userId: string) {
  const refresh = randomUUID();
  await redis.set(`refresh:${refresh}`, userId, "EX", 30 * 24 * 3600);   // 30 gün
  return { accessToken: signJwt({ sub: userId }), refreshToken: refresh };
}
```
```python
import hmac, hashlib, base64, json, time, uuid

SECRET = b"change-me"
ACCESS_TTL_S = 600

def _b64(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).rstrip(b"=").decode()

def sign_jwt(payload: dict, ttl_s: int = ACCESS_TTL_S) -> str:
    header = _b64(json.dumps({"alg": "HS256", "typ": "JWT"}).encode())
    now = int(time.time())
    body = _b64(json.dumps({**payload, "iat": now, "exp": now + ttl_s, "jti": str(uuid.uuid4())}).encode())
    sig = _b64(hmac.new(SECRET, f"{header}.{body}".encode(), hashlib.sha256).digest())
    return f"{header}.{body}.{sig}"

def verify_jwt(token: str) -> dict | None:
    try:
        header, body, sig = token.split(".")
    except ValueError:
        return None
    expected = _b64(hmac.new(SECRET, f"{header}.{body}".encode(), hashlib.sha256).digest())
    if not hmac.compare_digest(expected, sig):      # zamanlama saldırısına dayanıklı karşılaştırma
        return None
    claims = json.loads(base64.urlsafe_b64decode(body + "=="))
    return None if claims["exp"] <= int(time.time()) else claims

# Redis oturumu: r.set(f"session:{sid}", json.dumps(data), ex=1800); r.get(...); r.delete(...)
```
:::

:::realworld{company="Netflix"}
Netflix'in kenar (edge) katmanı **Zuul**, gelen her isteğin yetkilendirmesini stateless biçimde yapar: istemci uygulamaları kısa ömürlü, imzalı token'lar taşır ve yüzlerce Zuul örneğinden herhangi biri, merkezi bir oturum servisine gitmeden token'ı doğrular. Bu sayede Zuul filosu dakikalar içinde büyütülüp küçültülebilir ve bir örneğin ölmesi hiçbir kullanıcıyı düşürmez. Oturum benzeri, hızla değişen durum (izlemeye devam et konumu, profil seçimi) ise **EVCache** adlı Memcached tabanlı, bölgeler arası replike edilen bir katmanda tutulur — yani merkezi depo yaklaşımı. İki yaklaşımın birlikte kullanılması tipiktir: kimlik için token, veri için paylaşımlı depo. Netflix ayrıca token'ların **çalınması** riskine karşı cihaz bağlama (device binding) ve kısa ömür + yenileme ile hasar penceresini daraltır.
:::

:::callout{tone="tip" title="Mülakat ipuçları"}
- "Stateless yaparım" dediğinizde mülakatçı **oturumu nereye koyacaksınız?** diye sorar; üç seçeneği ve takaslarını bir cümleyle sayabilin.
- JWT'nin en bilinen zayıflığı **iptal**: kısa ömür + refresh token ya da denylist deyin. "JWT = oturum yok" cümlesi yarım doğrudur; refresh token hâlâ sunucuda durumdur.
- Sticky session'ı "geçici çözüm" olarak konumlandırın; neden kalıcı istemediğinizi (dağılım, düşen sunucu, deploy) söyleyin.
- Durumu dışarı taşımanın oturumla sınırlı olmadığını belirtin: dosya, cron, WebSocket, idempotency.
:::

:::quiz{src="quiz.json"}
:::

:::next{lesson="a-05-load-balancing"}
Sırada: servisler stateless olduğuna göre istekleri dağıtacak bileşen — load balancer algoritmaları, L4/L7 ve health check.
:::

---
id: n-01-sessions-vs-tokens
slug: sessions-vs-tokens
module: n-auth-security
order: 1
title:
  tr: "Oturum mu, Token mı?"
  en: "Sessions or Tokens?"
summary:
  tr: "Sunucu taraflı oturum, çerez özellikleri (HttpOnly, SameSite), taşıyıcı token ve yenileme; hangi durumda hangisi."
  en: "Server-side sessions, cookie attributes (HttpOnly, SameSite), bearer tokens and refresh; which one when."
durationMinutes: 30
level: intermediate
tags: [authentication, session, cookie, bearer-token, refresh-token, security]
prerequisites: [a-04-stateless-stateful-sessions, a-01-client-server-dns-http, i-02-api-ve-rest-api-temeller-ve-guvenlik]
concepts: [server-side-session, session-cookie, cookie-attributes, samesite, bearer-token, refresh-token, token-revocation, token-storage]
---

## Kavram: HTTP hatırlamaz, kimlik her istekte yeniden kanıtlanır

HTTP durumsuz (stateless) bir protokoldür: sunucu, bir önceki isteği kimin gönderdiğini kendiliğinden bilmez. Kullanıcı bir kez e-posta ve şifresini doğru girdiğinde, sonraki yüzlerce isteğin her birinde şifreyi yeniden göndermesini istemeyiz; hem kullanışsızdır hem de şifrenin ağda ve bellekte dolaştığı süreyi uzatır. Bu yüzden giriş anında bir kez yapılan pahalı doğrulamanın sonucunu bir **kimlik kanıtına** dönüştürür ve istemciye veririz. Sonraki isteklerde istemci yalnızca bu kanıtı gösterir.

Bu kanıtın iki ana biçimi vardır ve bu dersin bütün sorusu bunların arasındaki farktır:

1. **Oturum kimliği (session id)**: Rastgele, anlamsız bir dizedir. Asıl bilgi (hangi kullanıcı, ne zaman giriş yaptı, rolü ne) sunucu tarafında bir *oturum deposunda* durur. Kanıt yalnızca o kayda işaret eden bir **referanstır**.
2. **Taşıyıcı token (bearer token)**: Kullanıcı bilgisini ve son kullanma zamanını kendi içinde taşıyan, sunucunun imzaladığı bir veridir. Sunucu bir depoya bakmadan, yalnızca imzayı doğrulayarak kimliğe ulaşır. Kanıt bu kez bilginin **kendisidir**.

Stateless ve stateful servisler dersinde bu ikisini ölçekleme açısından karşılaştırdık: oturum deposu servisleri durumsuz bırakır ama her isteğe bir gidiş-dönüş ekler, token ise depoyu ortadan kaldırır. Bu derste aynı ikiliğe **güvenlik** gözlüğüyle bakacağız: kanıt nerede saklanır, nasıl çalınır, çalınırsa ne kadar süre işe yarar ve nasıl iptal edilir?

:::diagram{src="diagram.svg" alt="Solda sunucu taraflı oturum: tarayıcı yalnızca rastgele bir oturum kimliğini çerezde taşır, sunucu her istekte Redis oturum deposuna bakar. Sağda taşıyıcı token: istemci imzalı token taşır, sunucu yalnızca imza anahtarıyla yerelde doğrular; kısa ömürlü access token ve uzun ömürlü refresh token ayrımı|Left: server-side session where the browser carries only a random session id in a cookie and the server looks it up in a Redis session store on every request. Right: bearer token where the client carries a signed token and the server verifies it locally with a signing key; split between a short-lived access token and a long-lived refresh token"}
Oturumda kanıt bir referanstır, token'da kanıt verinin kendisidir. Fark, iptal ve gecikme davranışını belirler.
:::

## Sunucu taraflı oturum: anlamsız bir anahtar, anlamlı bir kayıt

Giriş başarılı olduğunda sunucu kriptografik olarak güvenli bir rastgele sayı üreticisiyle en az 128 bitlik bir kimlik üretir, bunu anahtar olarak kullanıp oturum deposuna `{ userId, role, createdAt, lastSeenAt }` gibi bir kayıt yazar ve tarayıcıya `Set-Cookie` başlığıyla gönderir. Tarayıcı bu çerezi sonraki her istekte aynı siteye otomatik olarak ekler. Sunucu çerezdeki kimliği depoda arar; kayıt varsa kullanıcı doğrulanmıştır.

Bu modelin güçlü yanı **kontrolün tamamen sunucuda** olmasıdır. Kullanıcı çıkış yaptığında, şifresini değiştirdiğinde ya da yönetici hesabı askıya aldığında depodaki kaydı silmek yeterlidir; bir sonraki istekte kimlik geçersizdir. "Tüm cihazlardan çıkış yap" özelliği, kullanıcıya ait kayıtları silmekten ibarettir. Oturum kimliği hiçbir bilgi taşımadığı için çalınsa bile içinden e-posta ya da rol okunamaz.

Bedeli de belli: her kimlik doğrulamalı istek depoya bir sorgu yapar. Depo çökerse herkes çıkış yapmış gibi olur; depo başka bir bölgedeyse her isteğe bölgeler arası gecikme eklenir. Bu yüzden oturum deposu genellikle uygulamaya yakın, bellekte çalışan ve çoğaltılmış bir sistemdir; Redis bu iş için en yaygın tercihtir ve kayıtlara TTL vererek süresi dolan oturumların kendiliğinden temizlenmesini sağlar.

Oturum kimliğiyle ilgili iki kural pazarlık konusu değildir. Birincisi, kimlik tahmin edilemez olmalıdır; artan bir sayı ya da zaman damgası kullanmak başka kullanıcıların oturumlarını tahmin etmeye kapı açar. İkincisi, giriş anında kimlik **yeniden üretilmelidir**. Girişten önce verilmiş bir kimliği girişten sonra da kullanmaya devam eden uygulama *oturum sabitleme (session fixation)* zafiyetine açıktır: saldırgan kurbanın tarayıcısına bildiği bir kimliği yerleştirebilirse, kurban giriş yaptığında o kimlik yetkili hâle gelir.

## Çerez öznitelikleri: kanıtı tarayıcıda korumak

Çerez, oturum kimliğini taşımanın en olgun yoludur çünkü tarayıcı onu korumak için yerleşik mekanizmalar sunar. Bu mekanizmalar ancak doğru öznitelikleri verirseniz devreye girer:

| Öznitelik | Ne yapar? | Neye karşı korur? |
|---|---|---|
| `HttpOnly` | Çerezi `document.cookie` üzerinden JavaScript'e kapatır | XSS ile çerezin okunup dışarı sızdırılması |
| `Secure` | Çerez yalnızca HTTPS bağlantısında gönderilir | Açık ağda dinleme, HTTP'ye düşürme |
| `SameSite=Lax` | Başka siteden gelen alt isteklerde ve POST'ta çerez gönderilmez; üst düzey GET gezinmesinde gönderilir | CSRF'nin büyük kısmı |
| `SameSite=Strict` | Başka siteden gelen hiçbir istekte gönderilmez | CSRF; ama dış bağlantıdan gelen kullanıcı ilk sayfada çıkış yapmış görünür |
| `SameSite=None` | Siteler arası isteklerde de gönderilir; `Secure` zorunludur | Hiçbir şeye; yalnızca gerçekten gerektiğinde, ek CSRF savunmasıyla |
| `Path`, `Domain` | Çerezin hangi yollara ve alt alan adlarına gideceğini belirler | Gereksiz yere geniş paylaşım |
| `Max-Age` / `Expires` | Kalıcılık süresi; verilmezse tarayıcı kapanınca silinir | Terk edilmiş cihazda süresiz oturum |
| `__Host-` öneki | Tarayıcı, çerezin `Secure`, `Path=/` ve `Domain`'siz olmasını zorunlu kılar | Alt alan adından çerezin ezilmesi |

Burada dikkat edilmesi gereken ince bir nokta var: `HttpOnly` çerezi XSS'e karşı *okunmaktan* korur ama *kullanılmaktan* korumaz. Sayfanıza zararlı betik enjekte edilmişse, betik çerezi göremese de kullanıcının tarayıcısından istek gönderebilir ve tarayıcı çerezi otomatik ekler. Yani HttpOnly hasarı sınırlar: saldırgan oturumu kendi makinesine taşıyamaz, saldırı kurbanın sekmesi açık kaldığı sürece sürer. XSS'in asıl ilacı içerik güvenliği politikası (CSP) ve çıktı kaçışlamadır; bunları OWASP dersinde ayrıntılı göreceğiz.

Çerezin otomatik gönderilmesi aynı zamanda zayıf noktasıdır: başka bir sitedeki form, kullanıcının tarayıcısına sizin sitenize istek attırabilir ve tarayıcı çerezi ekler. **CSRF** (siteler arası istek sahteciliği) budur. `SameSite=Lax` modern tarayıcılarda varsayılan hâle gelmiş olsa da, durum değiştiren her uç noktada ek bir CSRF token'ı ya da özel bir istek başlığı zorunluluğu hâlâ sağlam bir pratiktir.

## Taşıyıcı token: kanıtın kendisi

Taşıyıcı token modelinde sunucu giriş anında bir veri yapısı oluşturur (kullanıcı kimliği, rol, son kullanma zamanı), bunu gizli bir anahtarla imzalar ve istemciye gövdede döndürür. İstemci sonraki isteklerde token'ı `Authorization: Bearer <token>` başlığına koyar. Sunucu imzayı doğrular, süreyi kontrol eder ve kullanıcıyı tanır; hiçbir depoya sormaz. Adındaki "taşıyıcı" kelimesi önemli bir uyarıdır: token'ı **taşıyan** kişi yetkilidir. Kimin elinde olduğuna bakılmaz, tıpkı bir konser biletinde olduğu gibi.

Bu model iki yerde parlar. İlki, çok sayıda servisin ya da bölgenin aynı kimliği doğrulaması gereken mimarilerdir: her servis yalnızca doğrulama anahtarını bilir, merkezi depoya bağımlılık kalmaz. İkincisi, tarayıcı olmayan istemcilerdir: mobil uygulamalar, komut satırı araçları ve servisten servise çağrılar çerez kavanozuna sahip değildir; başlıkta taşınan token onlar için doğal bir biçimdir. Mobil tarafta token, işletim sisteminin güvenli anahtar deposunda (iOS Keychain, Android Keystore) saklanmalıdır.

Token'ın zayıf yanı iptaldir. İmzalı bir token, süresi dolana kadar matematiksel olarak geçerlidir; kullanıcı çıkış yapsa bile, token'ı ele geçiren biri onu kullanmaya devam edebilir. Bu sorunu çözmenin bilinen tek dengeli yolu iki farklı token kullanmaktır.

:::animation{scene="scene.json"}
Önce çerezle taşınan oturum kimliği ve Redis araması, ardından yerelde doğrulanan taşıyıcı token ve çıkışta iki modelin farkı.
:::

## Access token ve refresh token: iki anahtarlı düzen

**Access token** kısa ömürlüdür (tipik olarak 5–15 dakika) ve her API isteğinde taşınır. Çalınırsa saldırganın kullanabileceği pencere dakikalarla sınırlıdır. **Refresh token** uzun ömürlüdür (günler ya da haftalar) ama yalnızca tek bir uç noktaya, yeni access token almak için gönderilir. En önemli fark şudur: refresh token **sunucuda kayıtlıdır**. Yani refresh adımı aslında küçük bir oturum aramasıdır ve iptal burada yapılır. Kullanıcı çıkış yaptığında refresh token kaydı iptal edilir; elde kalan access token en geç birkaç dakika içinde ölür.

:::callout{tone="info" title="Derinleşme"}
Bu düzeni bir adım ileri taşıyan teknik **refresh token rotasyonudur**: her yenilemede eski refresh token iptal edilir ve yenisi verilir. Aynı aileden iptal edilmiş bir token yeniden kullanılmaya çalışılırsa bu, iki tarafın (gerçek kullanıcı ve saldırgan) aynı token'ı tuttuğunun kanıtıdır; sunucu o ailenin tüm token'larını iptal eder ve kullanıcıdan yeniden giriş ister. Böylece çalıntı bir refresh token en fazla bir kez işe yarar ve hırsızlık fark edilir.

Refresh token veritabanında düz metin olarak değil, **hash'i** ile saklanmalıdır. Veritabanı yedeği sızarsa saldırgan elinde kullanılabilir token değil, yalnızca özetler bulur. Rastgele ve yüksek entropili bir token için yavaş şifre hash'lerine gerek yoktur; SHA-256 yeterlidir, çünkü tahmin edilecek bir sözlük yoktur.
:::

## Token tarayıcıda nerede durmalı?

Tarayıcı istemcileri için en çok tartışılan soru budur ve doğru cevap, iki saldırı türünü aynı anda düşünmeyi gerektirir:

| Saklama yeri | XSS ile çalınabilir mi? | CSRF ile kullanılabilir mi? | Not |
|---|---|---|---|
| `localStorage` | Evet, tek satırla | Hayır | Sayfa yenilense de kalır; sızan token cihaz dışında süresiz kullanılabilir |
| JavaScript belleği | Zor (sayfadaki betik hâlâ kullanabilir) | Hayır | Sayfa yenilenince kaybolur, bu yüzden bir yenileme mekanizması gerekir |
| `HttpOnly` çerez | Hayır | Evet, SameSite ve CSRF savunması gerekir | Tarayıcı otomatik gönderir |

Olgun web uygulamalarının çoğu bu tablodan bir karışım çıkarır: **refresh token** `HttpOnly; Secure; SameSite` çerezde durur ve yalnızca yenileme uç noktasına gider; **access token** yalnızca JavaScript belleğinde tutulur ve `Authorization` başlığında taşınır. Sayfa yenilendiğinde uygulama önce sessizce yenileme uç noktasını çağırır, çerez sayesinde yeni bir access token alır. API isteklerinin kendisi çerez taşımadığı için klasik CSRF'den etkilenmez; yenileme uç noktası ise SameSite ve kaynak (Origin) kontrolüyle korunur.

:::callout{tone="warning" title="localStorage'daki token, XSS'i oturum hırsızlığına çevirir"}
Uzun ömürlü bir token'ı `localStorage`'a koymak, sayfanızdaki herhangi bir XSS açığını kalıcı bir hesap ele geçirmeye dönüştürür: betik token'ı okur, saldırganın sunucusuna gönderir ve token süresi dolana kadar kullanıcı farkında olmadan taklit edilir. Belleğe ya da HttpOnly çereze taşımak XSS'i çözmez, ama hasarı "sekme açıkken" ile sınırlar.
:::

## Maliyet: oturum deposuna ek gidiş-dönüş

Güvenlik kararları performanstan bağımsız değildir. Sunucu taraflı oturumda her istek, uygulama sunucusundan oturum deposuna bir gidiş-dönüş yapar. Aynı veri merkezinde bu birkaç milisaniyedir; ama servisler çoğaldıkça ve her servis kimliği ayrıca doğruladıkça bu maliyet katlanır.

:::interactive{type="request-journey" layers="browser,auth-gateway,session-store:3,service" rttMs=30 cacheHitRate=0}
"İstek gönder" düğmesine basın ve gecikme şelalesinde **session-store** adımına bakın: bu, sunucu taraflı oturumun her istekte ödediği ek gidiş-dönüştür. Ardından RTT kaydırıcısını artırın; oturum deposu uygulamadan uzaklaştıkça toplam gecikmenin nasıl büyüdüğünü izleyin. Taşıyıcı token ile bu adım yerini yerel bir imza doğrulamasına bırakır; bedel olarak iptal gecikmesini kabul edersiniz.
:::

Gerçek sistemlerde orta yol sık görülür: access token imzayla yerelde doğrulanır, ama kullanıcının "hesabı silindi mi, rolü değişti mi, tüm oturumları kapatıldı mı" bilgisi kısa TTL'li bir önbellekten okunur. Böylece her istek tam bir oturum araması yapmaz, iptal gecikmesi de dakikalardan saniyelere iner.

:::code{lang="ts" title="Çerezle oturum ve taşıyıcı token doğrulaması yan yana"}
```ts
import { randomBytes, createHash } from 'node:crypto';
import type { Request, Response, NextFunction } from 'express';
import { jwtVerify } from 'jose';
import { redis } from './redis';

const SESSION_TTL_SEC = 60 * 60 * 8; // 8 saat
const accessKey = new TextEncoder().encode(process.env.JWT_ACCESS_SECRET!);

/** Girişten sonra: kimliği YENİDEN üret (session fixation'a karşı) ve çerezi sıkı özniteliklerle ver. */
export async function startSession(res: Response, userId: string) {
  const sid = randomBytes(32).toString('base64url');          // 256 bit, tahmin edilemez
  await redis.set(`sess:${sid}`, JSON.stringify({ userId }), 'EX', SESSION_TTL_SEC);
  res.cookie('__Host-sid', sid, {
    httpOnly: true, secure: true, sameSite: 'lax', path: '/', maxAge: SESSION_TTL_SEC * 1000,
  });
}

/** Model 1: her istekte oturum deposuna sor (iptal anında etkili). */
export async function requireSession(req: Request, res: Response, next: NextFunction) {
  const sid = req.cookies['__Host-sid'];
  const raw = sid ? await redis.get(`sess:${sid}`) : null;  // ek gidiş-dönüş
  if (!raw) return res.status(401).end();
  req.user = JSON.parse(raw);
  next();
}

/** Model 2: imzayı yerelde doğrula (depoya gitmez, süre dolana kadar geçerli). */
export async function requireBearer(req: Request, res: Response, next: NextFunction) {
  const token = req.headers.authorization?.replace(/^Bearer /, '');
  if (!token) return res.status(401).end();
  try {
    const { payload } = await jwtVerify(token, accessKey, { algorithms: ['HS256'] });
    req.user = { userId: payload.sub! };
    next();
  } catch {
    res.status(401).end();
  }
}

/** Refresh token veritabanında yalnızca hash'iyle tutulur. */
export const hashRefreshToken = (t: string) => createHash('sha256').update(t).digest('hex');
```
```python
import hashlib, json, os, secrets
from fastapi import Cookie, Header, HTTPException, Response
import jwt  # PyJWT
from .redis import redis

SESSION_TTL_SEC = 60 * 60 * 8
ACCESS_SECRET = os.environ["JWT_ACCESS_SECRET"]

def start_session(response: Response, user_id: str) -> None:
    sid = secrets.token_urlsafe(32)                       # girişte yeni kimlik
    redis.set(f"sess:{sid}", json.dumps({"user_id": user_id}), ex=SESSION_TTL_SEC)
    response.set_cookie("__Host-sid", sid, httponly=True, secure=True,
                        samesite="lax", path="/", max_age=SESSION_TTL_SEC)

def require_session(sid: str | None = Cookie(None, alias="__Host-sid")) -> dict:
    raw = redis.get(f"sess:{sid}") if sid else None       # ek gidiş-dönüş
    if not raw:
        raise HTTPException(status_code=401)
    return json.loads(raw)

def require_bearer(authorization: str = Header("")) -> dict:
    token = authorization.removeprefix("Bearer ")
    try:
        payload = jwt.decode(token, ACCESS_SECRET, algorithms=["HS256"])
    except jwt.PyJWTError:
        raise HTTPException(status_code=401)
    return {"user_id": payload["sub"]}

def hash_refresh_token(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()
```
:::

## Hangi durumda hangisi?

Tek bir doğru cevap yoktur; doğru soru, sistemin hangi özelliğe daha çok ihtiyaç duyduğudur:

| Durum | Önerilen yaklaşım | Neden? |
|---|---|---|
| Tek alan adında sunucu render eden klasik web uygulaması | Sunucu taraflı oturum + HttpOnly çerez | Basit, anında iptal, tarayıcı korumaları hazır |
| SPA + ayrı API, aynı kuruluş | Kısa access token (bellek) + HttpOnly çerezde refresh token | API çerezsiz kalır, iptal refresh adımında yapılır |
| Mobil uygulama | Access + refresh token, işletim sisteminin güvenli deposunda | Çerez kavanozu yok, cihaz güvenli depo sunar |
| Mikroservisler arası kimlik aktarımı | İmzalı kısa ömürlü token (ya da mTLS + servis kimliği) | Her serviste merkezi depoya bağımlılık olmaz |
| Bankacılık, yönetim paneli gibi yüksek risk | Sunucu taraflı oturum, kısa boşta kalma süresi, yeniden kimlik doğrulama | Anında iptal ve sıkı denetim, gecikmeden önemlidir |

Sık yapılan hata, token'ı "modern" olduğu için seçip ardından iptal ihtiyacını karşılamak için her istekte bir kara listeye bakmaktır. Bu noktada sunucu taraflı oturumun bütün maliyetini ödeyip avantajlarının hiçbirini almamış olursunuz. Kararınızı iptal gereksinimiyle başlatın: "Bir hesap kapatıldığında en geç kaç saniye içinde erişim kesilmeli?" sorusunun cevabı, access token ömrünü ve ara önbelleğin TTL'sini doğrudan belirler.

:::realworld{company="DevAcademy"}
Bu platformun kendisi önerilen karma modeli kullanır. Web istemcisi giriş yaptığında API, **refresh token'ı httpOnly bir çerezde** döndürür (istemci `X-Auth-Mode: cookie` başlığıyla bunu ister); **access token yalnızca JavaScript belleğinde** tutulur ve `localStorage`'da yalnızca görünür profil bilgisi durur. Access token 15 dakika, refresh token 30 gün yaşar. Her yenilemede refresh token **döndürülür** (rotation); veritabanında yalnızca SHA-256 özeti saklanır ve iptal edilmiş bir token yeniden kullanılırsa aynı "ailedeki" tüm token'lar iptal edilir. Web ve API farklı sitelerde çalıştığında çerezin gönderilebilmesi için `REFRESH_COOKIE_SAMESITE=none` (ve dolayısıyla `Secure`) gerekir. Mobil uygulama çerez yerine token'ları `expo-secure-store` ile cihazın güvenli deposunda tutar. Access token imzayla yerelde doğrulanır, ama kullanıcının silinip silinmediği, rolü ve oturumlarının kapatılıp kapatılmadığı Redis'te 30 saniyelik bir önbellekten kontrol edilir; şifre değiştiğinde bu durum güncellenir ve eski access token'lar da reddedilir.
:::

:::callout{tone="tip" title="Mülakat özeti"}
- Oturum kimliği bir **referanstır** (anında iptal, her istekte depo araması); taşıyıcı token **verinin kendisidir** (yerel doğrulama, iptal zor).
- Çerez için `HttpOnly`, `Secure`, `SameSite` ve girişte kimlik yenileme; token için kısa access + sunucuda kayıtlı, döndürülen refresh.
- "Token nerede saklanır?" sorusuna XSS ve CSRF'yi birlikte tartarak cevap verin.
:::

:::quiz{src="quiz.json"}
:::

:::next{lesson="n-02-jwt"}
Sırada: taşıyıcı token'ın en yaygın biçimi olan JWT'nin içini açıyoruz; başlık, gövde, imza ve klasik doğrulama hataları.
:::

---
id: n-02-jwt
slug: jwt
module: n-auth-security
order: 2
title:
  tr: "JWT: Yapısı, İmzası ve Tuzakları"
  en: "JWT: Structure, Signature and Pitfalls"
summary:
  tr: "Başlık/gövde/imza, HS256 ve RS256, süre dolumu, iptal problemi ve alg=none gibi klasik hatalar; interaktif JWT inceleyici."
  en: "Header/payload/signature, HS256 vs RS256, expiry, the revocation problem and classic mistakes like alg=none; interactive JWT inspector."
durationMinutes: 30
level: intermediate
tags: [jwt, token, signature, hmac, rsa, security]
prerequisites: [n-01-sessions-vs-tokens, i-02-api-ve-rest-api-temeller-ve-guvenlik]
concepts: [jwt-structure, jwt-claims, hs256-vs-rs256, jwks, alg-none, algorithm-confusion, jwt-validation, jwt-revocation]
---

## Kavram: üç parça, iki nokta, bir imza

Bir önceki derste taşıyıcı token'ın "kanıtın kendisi" olduğunu söyledik. **JSON Web Token (JWT)**, bu kanıtı taşımak için standartlaşmış en yaygın biçimdir. Bir JWT, noktalarla ayrılmış üç parçadan oluşan tek satırlık bir dizedir:

```
eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9 . eyJzdWIiOiJ1XzQyIiwicm9sZSI6InVzZXIiLCJleHAiOjE3OTk5OTk5OTl9 . 3q2_kQ…
           başlık (header)                                gövde (payload)                                   imza
```

- **Başlık**: Token türü ve imza algoritması, örneğin `{"alg":"HS256","typ":"JWT"}`. Asimetrik anahtarlarda hangi anahtarla imzalandığını gösteren `kid` (key id) de burada durur.
- **Gövde**: Talepler (claims) adı verilen anahtar-değer çiftleri: kullanıcı kimliği, rol, son kullanma zamanı.
- **İmza**: `base64url(başlık) + "." + base64url(gövde)` dizesinin, başlıkta belirtilen algoritma ve gizli anahtarla hesaplanmış imzası.

İlk iki parça yalnızca **base64url** ile kodlanmıştır; bu bir şifreleme değildir. Elinde token olan herkes gövdeyi saniyeler içinde okuyabilir. JWT'nin sağladığı garanti gizlilik değil **bütünlük** ve **köken doğrulamadır**: gövdedeki tek bir karakter değişirse imza artık tutmaz ve imzayı yalnızca anahtarı bilen taraf yeniden üretebilir. Gizlilik gerekiyorsa ayrı bir standart olan JWE (şifreli JWT) kullanılır; pratikte çoğu sistem bunun yerine gövdeye gizli bilgi koymamayı tercih eder.

:::diagram{src="diagram.svg" alt="JWT'nin üç parçası: base64url kodlu başlık ve gövde birleşerek imza girdisini oluşturur; HS256'da tek paylaşılan sır ile, RS256'da özel anahtarla imzalanır ve açık anahtarla doğrulanır; doğrulayıcı alg, imza, exp, iss ve aud kontrollerini sırayla yapar|The three parts of a JWT: base64url-encoded header and payload form the signing input; HS256 signs with a single shared secret, RS256 signs with a private key and verifies with a public key; the verifier checks alg, signature, exp, iss and aud in order"}
İmza girdisi başlık ve gövdenin birleşimidir; ikisinden birinde tek bit değişse imza geçersizleşir.
:::

## Kayıtlı talepler: gövdenin ortak dili

Standart, birlikte çalışabilirlik için kısa adlı bazı talepler tanımlar. Bunları doğru kullanmak, token'ın nerede ve ne kadar süre geçerli olduğunu makinece kontrol edilebilir kılar:

| Talep | Anlamı | Doğrulayıcı ne yapmalı? |
|---|---|---|
| `iss` (issuer) | Token'ı kim üretti? | Beklenen yayıncıyla birebir karşılaştır |
| `sub` (subject) | Token kimin hakkında? | Kullanıcı kimliği olarak kullan; e-posta gibi değişebilen değerleri değil |
| `aud` (audience) | Token kime yönelik? | Kendi servis adın listede değilse reddet |
| `exp` (expiration) | Son geçerlilik anı (Unix saniye) | Geçmişse reddet; birkaç saniyelik saat kayması toleransı ver |
| `nbf` (not before) | Bu andan önce geçersiz | Gelecekteyse reddet |
| `iat` (issued at) | Üretilme anı | Çok eskiyse ya da gelecekteyse şüphelen |
| `jti` (JWT id) | Token'a özgü kimlik | Tek kullanımlık token'larda ve iptal listelerinde anahtar olarak kullan |

`aud` talebi en çok ihmal edilenidir. Aynı kimlik sağlayıcısı birden fazla uygulamaya token veriyorsa ve siz `aud`'u kontrol etmiyorsanız, başka bir uygulama için üretilmiş geçerli bir token sizin API'nize de kabul edilir. Bir ödeme servisi için alınmış token'ın yönetim paneline girmesi tam olarak böyle olur.

Gövdeye ne koyacağınız da bir tasarım kararıdır. Token her istekte taşındığı için büyük gövde her isteğe bant genişliği ekler; ayrıca gövdedeki bilgi token'ın ömrü boyunca **donmuştur**. Kullanıcının rolünü token'a gömerseniz, rol değiştiğinde eski token'lar süreleri dolana kadar eski rolü taşımaya devam eder. Bu yüzden gövde küçük tutulur: `sub`, kısa bir rol ya da kapsam listesi ve zaman talepleri. E-posta, adres, kişisel veri ve elbette şifre gibi bilgiler gövdeye konmaz.

## HS256 mı, RS256 mı? Kim imzalar, kim doğrular?

İmza algoritması seçimi aslında bir **güven dağılımı** kararıdır.

**HS256 (HMAC + SHA-256)** simetriktir: imzalayan ve doğrulayan aynı gizli sırrı bilir. Hızlıdır ve tek bir servisin hem token ürettiği hem de doğruladığı monolitlerde idealdir. Ancak doğrulama yapan her servisin sırrı bilmesi, o servislerin her birinin **token üretebileceği** anlamına gelir. On mikroservisiniz varsa ve biri ele geçirilirse, saldırgan herhangi bir kullanıcı adına token basabilir.

**RS256 (RSA) ve ES256 (ECDSA)**, ayrıca **EdDSA** asimetriktir: yalnızca kimlik servisi özel anahtarı bilir ve imzalar; diğer tüm servisler açık anahtarla yalnızca doğrular. Açık anahtar sızsa bile kimse token üretemez. Açık anahtarlar genellikle bir **JWKS** (JSON Web Key Set) uç noktasında yayınlanır; doğrulayıcı token başlığındaki `kid` değerine bakarak doğru anahtarı seçer. Bu düzen anahtar rotasyonunu da kolaylaştırır: yeni anahtar JWKS'e eklenir, bir süre ikisi birlikte yayınlanır, eski anahtarla imzalanmış token'lar doğal olarak sona erdikten sonra eski anahtar listeden çıkarılır.

Basit bir kural: token'ı üreten ve doğrulayan aynı süreçse HS256 yeterlidir; doğrulayan taraf üreten taraftan farklı bir güven alanındaysa (başka ekip, başka servis, üçüncü taraf) asimetrik imza kullanın.

:::interactive{type="jwt-inspector" secret="devacademy-demo-secret" token=""}
İnceleyicinin ürettiği örnek token'ı inceleyin: başlık ve gövdenin base64url çözümüyle düz JSON olarak okunabildiğine dikkat edin. Ardından gövdedeki `role` değerini `user`'dan `admin`'e çevirin ve imza durumunun **geçersiz** olduğunu izleyin; gövde değişti ama imza eski gövdeye aitti. Son olarak sırrı değiştirmeden yeniden imzalayın ve imzanın ancak sırrı bilen tarafça üretilebildiğini görün.
:::

## Doğrulama kontrol listesi

Bir JWT kütüphanesinin `verify` fonksiyonunu çağırmak, doğru seçenekleri verirseniz güvenlidir. Doğrulayıcının yapması gerekenler sırasıyla şunlardır:

1. **Algoritmayı sabitle**: Kabul edilen algoritmayı yapılandırmadan ver (`algorithms: ['RS256']`); başlıktaki `alg`'a asla güvenme.
2. **Anahtarı seç**: Asimetrikte `kid` ile JWKS'ten seç; listede olmayan `kid`'i reddet. `kid`'i dosya yolu ya da SQL sorgusunun parçası olarak kullanma.
3. **İmzayı doğrula**: Sabit zamanlı karşılaştırma kütüphanede yapılır; elle string karşılaştırması yazma.
4. **Zamanı kontrol et**: `exp` ve `nbf`, en fazla birkaç saniye tolerans ile.
5. **Kökeni ve hedefi kontrol et**: `iss` ve `aud` beklenen değerlerle birebir eşleşmeli.
6. **Uygulama kuralları**: Token türü doğru mu (access token yerine refresh ya da ID token gönderilmemiş mi), kullanıcı hâlâ aktif mi?

:::callout{tone="danger" title="decode, verify değildir"}
Çoğu kütüphanede bir `decode` fonksiyonu vardır; token'ı imzaya bakmadan çözer ve gövdeyi döndürür. Hata ayıklama için faydalıdır ama kimlik doğrulamada kullanıldığında saldırgan istediği gövdeyi yazar, imzayı rastgele bırakır ve sistem onu kabul eder. Kimlik kararı veren her kod yolu `verify` çağırmalı; kod incelemelerinde `decode` görülen her yer sorgulanmalıdır.
:::

## Klasik tuzaklar

JWT'nin esnekliği, yanlış yapılandırıldığında tarihî zafiyetlerin kaynağı olmuştur. Hepsinin ortak noktası, doğrulayıcının saldırganın kontrol ettiği alanlara güvenmesidir.

**alg=none.** Standart, imzasız token için `"alg":"none"` değerini tanımlar. Bazı eski kütüphaneler başlıkta bu değeri görünce imza kontrolünü atlıyordu; saldırgan gövdeyi değiştirip imzayı silerek her kullanıcı olabiliyordu. Savunma: kabul edilen algoritma listesini sunucu tarafında sabitlemek ve `none`'u hiçbir zaman listeye koymamak.

**Algoritma karışıklığı.** Sunucu RS256 bekliyor ama `alg` değerine göre davranıyorsa, saldırgan başlığa HS256 yazar ve token'ı sunucunun **açık** anahtarıyla HMAC olarak imzalar. Açık anahtar herkese açıktır; kütüphane bu anahtarı HMAC sırrı gibi kullanırsa imza tutar. Savunma yine aynıdır: algoritma ve anahtar türü yapılandırmadan gelir, token'dan değil.

**Zayıf HMAC sırrı.** HS256'nın güvenliği tamamen sırrın tahmin edilemezliğine dayanır. `secret`, uygulama adı ya da kısa bir parola gibi değerler çevrimdışı sözlük denemeleriyle bulunabilir, çünkü saldırgan elindeki tek bir token ile denemeleri sunucuya hiç dokunmadan yapabilir. Sır en az 256 bit rastgele olmalı ve bir gizli bilgi yöneticisinde saklanmalıdır.

**Eksik `aud`/`iss` kontrolü.** Yukarıda gördüğümüz gibi başka bir uygulama için üretilmiş token'ın kabul edilmesine yol açar. Özellikle bir kimlik sağlayıcısının ID token'larını doğrularken kritik önemdedir.

**Uzun ömür.** Yedi gün ömürlü bir access token, çalındığında yedi günlük erişim demektir. Access token dakikalarla ölçülmeli, uzun yaşaması gereken şey sunucuda kayıtlı refresh token olmalıdır.

## İptal problemi ve gerçekçi çözümler

JWT'nin durumsuzluğu bir avantajdır, ta ki bir token'ı süresinden önce öldürmeniz gerekene kadar. Bu sorunu tamamen çözmenin yolu yoktur; ancak maliyeti seçilebilir:

- **Kısa ömür + refresh**: En yaygın çözüm. İptal refresh adımında yapılır, access token en fazla birkaç dakika daha yaşar.
- **jti kara listesi**: İptal edilen token'ların `jti` değeri, token'ın kalan ömrü kadar TTL ile Redis gibi bir depoya yazılır; doğrulayıcı her istekte listeye bakar. Kesin ama her isteğe bir arama ekler.
- **Kullanıcı sürümü**: Kullanıcı kaydında bir `tokenVersion` sayacı tutulur ve token'a gömülür; şifre değiştiğinde sayaç artar, eski sürümü taşıyan token'lar reddedilir. Arama kullanıcı başına bir değerdir ve kısa süreli önbelleğe alınabilir.
- **Anahtar rotasyonu**: Tüm token'ları bir anda geçersiz kılar; yalnızca anahtar sızıntısı gibi acil durumlarda kullanılır.

Bu seçeneklerin hepsi bir miktar durumu geri getirir. Bu bir başarısızlık değil, bilinçli bir dengedir: amaç her isteği depoya bağlamak değil, iptal gecikmesini iş gereksiniminin izin verdiği süreye indirmektir.

## JWT ne zaman yanlış araçtır?

JWT'nin popülerliği, onu her kimlik problemi için varsayılan cevap hâline getirdi; oysa bazı durumlarda daha basit bir araç daha güvenlidir. Tek bir alan adında çalışan, tek bir sunucu uygulamasının hem ürettiği hem okuduğu oturumlar için rastgele bir oturum kimliği ve sunucu taraflı kayıt, JWT'nin bütün doğrulama kurallarını ve iptal problemini hiç ortaya çıkarmaz. Benzer şekilde, şifre sıfırlama ya da e-posta doğrulama gibi tek kullanımlık bağlantılarda, veritabanında özeti saklanan rastgele bir token, gövdesi okunabilen ve süresi dolana kadar tekrar kullanılabilen bir JWT'den daha uygundur. JWT'nin gerçekten parladığı yer, üreten ve doğrulayan tarafların ayrı olduğu, doğrulayıcının merkezi bir depoya sormadan karar vermesi gereken dağıtık senaryolardır. Seçim yaparken "kim üretir, kim doğrular, ne kadar hızlı iptal etmem gerekir?" sorularını sormak, moda olanı değil ihtiyaca uyanı seçtirir.

:::code{lang="ts" title="JWT imzalama ve sıkı doğrulama (jose ve PyJWT)"}
```ts
import { SignJWT, jwtVerify, createRemoteJWKSet } from 'jose';

const secret = new TextEncoder().encode(process.env.JWT_ACCESS_SECRET!); // ≥ 32 bayt rastgele

/** HS256: aynı süreç hem imzalar hem doğrular. */
export async function issueAccessToken(userId: string, role: string) {
  return new SignJWT({ role })
    .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
    .setSubject(userId)
    .setIssuer('https://api.example.dev')
    .setAudience('example-web')
    .setIssuedAt()
    .setExpirationTime('15m')
    .setJti(crypto.randomUUID())
    .sign(secret);
}

export async function verifyAccessToken(token: string) {
  const { payload } = await jwtVerify(token, secret, {
    algorithms: ['HS256'],                 // başlıktaki alg'a güvenme
    issuer: 'https://api.example.dev',
    audience: 'example-web',
    clockTolerance: 5,                      // saniye
  });
  return payload;
}

/** RS256/ES256: dış kimlik sağlayıcısının token'ını JWKS ile doğrula. */
const jwks = createRemoteJWKSet(new URL('https://idp.example.com/.well-known/jwks.json'));
export async function verifyIdpToken(token: string) {
  const { payload } = await jwtVerify(token, jwks, {
    algorithms: ['RS256', 'ES256'],
    issuer: 'https://idp.example.com',
    audience: 'my-client-id',
  });
  return payload;
}
```
```python
import os, uuid, datetime as dt
import jwt  # PyJWT
from jwt import PyJWKClient

SECRET = os.environ["JWT_ACCESS_SECRET"]  # ≥ 32 bayt rastgele

def issue_access_token(user_id: str, role: str) -> str:
    now = dt.datetime.now(dt.timezone.utc)
    claims = {
        "sub": user_id, "role": role,
        "iss": "https://api.example.dev", "aud": "example-web",
        "iat": now, "exp": now + dt.timedelta(minutes=15), "jti": str(uuid.uuid4()),
    }
    return jwt.encode(claims, SECRET, algorithm="HS256")

def verify_access_token(token: str) -> dict:
    return jwt.decode(
        token, SECRET,
        algorithms=["HS256"],                     # sabit liste, 'none' yok
        issuer="https://api.example.dev",
        audience="example-web",
        leeway=5,
        options={"require": ["exp", "iat", "sub"]},
    )

jwks_client = PyJWKClient("https://idp.example.com/.well-known/jwks.json")

def verify_idp_token(token: str) -> dict:
    key = jwks_client.get_signing_key_from_jwt(token)  # kid ile anahtar seçimi
    return jwt.decode(token, key.key, algorithms=["RS256", "ES256"],
                      issuer="https://idp.example.com", audience="my-client-id")
```
:::

:::realworld{company="Google"}
"Google ile giriş" akışında Google, kullanıcı için RS256 ile imzalanmış bir **ID token** (JWT) üretir. Google açık anahtarlarını herkese açık bir JWKS uç noktasında yayınlar ve bu anahtarları düzenli olarak döndürür; yanıtın `Cache-Control` başlığı doğrulayıcıya anahtarları ne kadar süre önbelleğe alabileceğini söyler. Doğrulayıcı token başlığındaki `kid` ile doğru anahtarı seçer, ardından `iss` değerinin Google olduğunu ve `aud` değerinin **kendi istemci kimliği** olduğunu kontrol etmek zorundadır. Bu platformun API'si de Google ve Apple ID token'larını tam olarak bu şekilde doğrular: imza sağlayıcının JWKS'iyle kontrol edilir ve `aud` yapılandırmadaki istemci kimlikleri listesiyle karşılaştırılır; liste boşsa o sağlayıcıyla giriş tamamen kapalıdır.
:::

:::callout{tone="tip" title="Mülakat özeti"}
- JWT **imzalıdır, şifreli değildir**: gövde herkesçe okunur, yalnızca değiştirilemez.
- Algoritmayı sunucuda sabitle, `exp`/`iss`/`aud` kontrol et, `decode` yerine `verify` kullan.
- Üreten ve doğrulayan farklı güven alanlarındaysa asimetrik imza + JWKS + `kid` ile rotasyon.
- İptal için kısa ömür + refresh; gerekirse `jti` listesi ya da kullanıcı sürümü.
:::

:::quiz{src="quiz.json"}
:::

:::next{lesson="n-03-oauth2-oidc"}
Sırada: token'ı başka bir uygulamadan almak. OAuth 2.0 yetkilendirme kodu akışı, PKCE ve OpenID Connect'in ID token'ı.
:::

---
id: n-03-oauth2-oidc
slug: oauth2-oidc
module: n-auth-security
order: 3
title:
  tr: "OAuth 2.0 ve OpenID Connect"
  en: "OAuth 2.0 and OpenID Connect"
summary:
  tr: "Authorization code + PKCE, client credentials, scope ve consent, ID token ve yaygın hatalar; adım adım akış simülatörü."
  en: "Authorization code + PKCE, client credentials, scopes and consent, ID tokens and common mistakes; step-by-step flow simulator."
durationMinutes: 35
level: intermediate
tags: [oauth2, oidc, pkce, sso, authorization, security]
prerequisites: [n-02-jwt, a-01-client-server-dns-http, i-02-api-ve-rest-api-temeller-ve-guvenlik]
concepts: [oauth-roles, authorization-code-flow, pkce, oauth-state, client-credentials, oauth-scopes, openid-connect, id-token]
---

## Kavram: şifreni verme, anahtarını ver

Bir takvim uygulamasının e-posta hesabınızdaki toplantı davetlerini okuması gerektiğini düşünün. En kaba çözüm, uygulamaya e-posta şifrenizi vermektir. Bu çözüm üç ayrı felaket barındırır: uygulama hesabınızda **her şeyi** yapabilir, ona verdiğiniz erişimi geri almak için şifrenizi değiştirmeniz gerekir ve uygulamanın veritabanı sızarsa şifreniz de sızar. **OAuth 2.0**, bu soruna verilmiş standart cevaptır: kullanıcı şifresini hiçbir zaman üçüncü tarafa vermez; bunun yerine kimlik sağlayıcısı, kullanıcının onayıyla, **sınırlı yetkili ve geri alınabilir** bir erişim token'ı üretir.

OAuth'un bir *yetkilendirme* (authorization) çerçevesi olduğunu baştan vurgulamak gerekir. "Bu uygulama benim adıma takvimimi okuyabilir" cümlesini ifade eder; "bu kişi kimdir" sorusunu cevaplamaz. Kimlik doğrulama katmanı, OAuth'un üzerine inşa edilmiş ayrı bir standart olan **OpenID Connect (OIDC)** ile gelir. Bu ayrımı karıştırmak, bu dersin sonunda göreceğimiz en tehlikeli hatalardan birinin kaynağıdır.

OAuth dört rol tanımlar:

| Rol | Kim? | Örnek |
|---|---|---|
| Kaynak sahibi (resource owner) | Verinin sahibi olan kullanıcı | Takvimi olan siz |
| İstemci (client) | Kullanıcı adına erişmek isteyen uygulama | Takvim uygulaması |
| Yetkilendirme sunucusu (authorization server) | Kullanıcıyı doğrulayan, onay alan ve token üreten taraf | Kimlik sağlayıcısının giriş sayfası |
| Kaynak sunucusu (resource server) | Korunan veriyi sunan API | E-posta sağlayıcısının API'si |

İstemciler de iki gruba ayrılır. **Gizli istemciler (confidential)**, sırrını güvenle saklayabilen sunucu taraflı uygulamalardır. **Açık istemciler (public)** ise tarayıcıda çalışan tek sayfa uygulamaları, mobil ve masaüstü uygulamalarıdır: kodları kullanıcının cihazındadır ve içine gömülen her "sır" çıkarılabilir. Bu ayrım, hangi akışın ve hangi korumanın gerektiğini belirler.

:::diagram{src="diagram.svg" alt="OAuth 2.0 rolleri ve kanallar: kullanıcı tarayıcısı ön kanal (yönlendirmeler) üzerinden yetkilendirme sunucusuyla konuşur; istemci arka kanalda kodu token ile takas eder; access token kaynak sunucusuna, ID token istemciye gider|OAuth 2.0 roles and channels: the user's browser talks to the authorization server over the front channel (redirects); the client exchanges the code for tokens on the back channel; the access token goes to the resource server, the ID token to the client"}
Ön kanal (tarayıcı yönlendirmeleri) görünür ve değiştirilebilir; bu yüzden token'lar arka kanalda alınır.
:::

## Authorization code akışı, adım adım

Kullanıcı etkileşimi olan neredeyse her senaryo için önerilen akış **authorization code + PKCE**'dir. Akışın püf noktası, işi iki kanala bölmesidir. *Ön kanal*, kullanıcının tarayıcısındaki yönlendirmelerdir; adres çubuğunda, tarayıcı geçmişinde ve bazen loglarda görünür. *Arka kanal*, istemcinin yetkilendirme sunucusuyla doğrudan yaptığı HTTPS çağrısıdır. Değerli olan token'lar yalnızca arka kanalda dolaşır; ön kanalda yalnızca kısa ömürlü, tek kullanımlık bir **kod** taşınır.

1. **Hazırlık**: İstemci rastgele bir `code_verifier` üretir, bunun SHA-256 özetinden `code_challenge` hesaplar ve ayrıca rastgele bir `state` değeri saklar.
2. **Yetkilendirme isteği**: Tarayıcı, yetkilendirme sunucusunun `/authorize` uç noktasına `client_id`, `redirect_uri`, `scope`, `state` ve `code_challenge` ile yönlendirilir.
3. **Giriş ve onay**: Kullanıcı kimlik sağlayıcısında giriş yapar ve istenen kapsamları onaylar. Şifre yalnızca bu sayfaya girilir; istemci onu hiç görmez.
4. **Kodla geri dönüş**: Sunucu tarayıcıyı `redirect_uri`'ye `?code=…&state=…` ile geri yollar. İstemci `state`'in sakladığıyla aynı olduğunu kontrol eder.
5. **Token takası**: İstemci arka kanalda `/token` uç noktasına kodu ve **`code_verifier`'ı** gönderir. Sunucu verifier'ın özetinin baştaki challenge ile eşleştiğini doğrular ve token'ları döndürür.
6. **Kaynağa erişim**: İstemci access token'ı `Authorization: Bearer` başlığıyla kaynak sunucusuna gönderir; kaynak sunucusu token'ın imzasını, `aud` ve kapsamını kontrol eder.

:::animation{scene="scene.json"}
Authorization code + PKCE akışı: yönlendirme, onay, kodla dönüş, verifier ile token takası ve kaynak sunucusuna erişim.
:::

## PKCE: çalınan kod neden işe yaramaz?

Dördüncü adımda kod ön kanalda taşınır. Mobil bir cihazda aynı özel URL şemasını kaydetmiş kötü niyetli bir uygulama, bir tarayıcı eklentisi ya da yanlış yapılandırılmış bir log, bu kodu yakalayabilir. Gizli istemcilerde bu tek başına yetmez çünkü takas için istemci sırrı da gerekir. Ama açık istemcilerin sırrı yoktur; yakalanan kod doğrudan token'a çevrilebilir.

**PKCE (Proof Key for Code Exchange)** bu boşluğu kapatır. Akışı başlatan istemci, yalnızca kendisinin bildiği bir `code_verifier` üretir ve sunucuya yalnızca onun özeti olan `code_challenge`'ı gösterir. Kodu yakalayan biri, takas sırasında verifier'ı sunamaz; özetten verifier'a geri gitmek de hash fonksiyonunun tek yönlülüğü nedeniyle pratikte imkânsızdır. Böylece her akış, kendine özgü ve tek kullanımlık bir sırla bağlanmış olur.

PKCE'de challenge yöntemi her zaman `S256` olmalıdır; `plain` yöntemi verifier'ı doğrudan ön kanala koyar ve korumayı anlamsızlaştırır. Güncel öneriler PKCE'yi yalnızca açık istemciler için değil, **tüm** istemciler için zorunlu kabul eder; gizli istemcide de kod enjeksiyonu saldırılarına karşı ek bir katman sağlar.

:::interactive{type="oauth-flow" flow="authorization-code" pkce=true}
Akışı adım adım ilerletin ve her adımda hangi değerin ön kanalda (tarayıcı adres çubuğu), hangisinin arka kanalda taşındığına dikkat edin. PKCE açıkken token takası adımında `code_verifier`'ın gönderildiğini ve sunucunun onu baştaki challenge ile karşılaştırdığını izleyin. Ardından PKCE'yi kapatıp aynı akışı tekrarlayın: yakalanan bir kodun artık tek başına token'a çevrilebildiğini görün.
:::

## state, redirect_uri ve nonce: küçük ama hayati alanlar

**state**, akışı başlatan tarayıcı oturumuyla geri dönen yanıtı birbirine bağlar. Kontrol edilmezse saldırgan, kendi hesabına ait bir kodu kurbanın tarayıcısına teslim edebilir; kurban farkında olmadan saldırganın hesabına bağlanır ve girdiği veriler saldırgana gider. Bu, OAuth'a özgü bir CSRF türüdür. `state` rastgele olmalı, oturumda saklanmalı ve geri dönüşte birebir karşılaştırılmalıdır.

**redirect_uri**, yetkilendirme sunucusunda önceden kayıtlı değerlerle **birebir** eşleşmelidir. Joker karakterlere ya da "bu alan adıyla başlıyorsa kabul et" gibi gevşek kurallara izin veren sunucular, kodun saldırganın kontrol ettiği bir adrese gönderilmesine kapı açar. Uygulamanızdaki açık yönlendirme (open redirect) zafiyetleri de bu zincirin parçası olabilir.

**nonce**, OIDC'ye özgüdür: istemci yetkilendirme isteğine rastgele bir değer koyar ve sunucu bunu ID token'ın içine yazar. İstemci, aldığı ID token'daki `nonce`'ın kendi ürettiğiyle aynı olduğunu kontrol ederek eski bir ID token'ın yeniden oynatılmasını engeller.

## Diğer akışlar: hangisi ne zaman?

| Akış | Kullanım | Durum |
|---|---|---|
| Authorization code + PKCE | Kullanıcısı olan web, SPA, mobil, masaüstü | Önerilen varsayılan |
| Client credentials | Kullanıcı yok; servisten servise (cron işi, arka uç entegrasyonu) | Önerilir; istemci kendi adına token alır |
| Device authorization | Klavyesi zayıf cihazlar: TV, komut satırı aracı | Önerilir; kullanıcı onayı başka cihazda verir |
| Refresh token | Mevcut erişimi kullanıcıyı yeniden yönlendirmeden yenilemek | Önerilir; açık istemcilerde rotasyonla |
| Implicit | Token'ı doğrudan URL parçasında döndürür | Kullanımdan kaldırıldı: token ön kanala sızar |
| Resource owner password | İstemci kullanıcının şifresini toplar | Kullanımdan kaldırıldı: OAuth'un amacını boşa çıkarır |

**Client credentials** akışında kullanıcı yoktur; istemci kendi kimliğiyle (sır ya da tercihen özel anahtarla imzalanmış bir istemci onayıyla) doğrudan `/token` uç noktasından token alır. Bu token "bir kullanıcı adına" değil "bu servis olarak" yetki taşır, dolayısıyla kapsamı o servisin gerçekten ihtiyaç duyduğu işlemlerle sınırlanmalıdır.

## Scope ve consent: en az yetkiyle başla

**Scope (kapsam)**, istenen erişimin sınırlarını belirleyen etiketlerdir: `calendar.read`, `repo`, `email` gibi. Yetkilendirme sunucusu bu kapsamları onay ekranında kullanıcıya gösterir (consent) ve token'a yalnızca onaylananları yazar. Kaynak sunucusu her istekte token'daki kapsamın işlem için yeterli olup olmadığını kontrol etmelidir; token'ın geçerli olması, her şeye izinli olduğu anlamına gelmez.

İyi tasarımda istemci başlangıçta yalnızca temel kapsamları ister ve ek yetkiyi ilgili özellik ilk kez kullanıldığında talep eder (artımlı yetkilendirme). Böylece onay ekranı kullanıcıyı korkutmaz ve token çalınırsa hasar sınırlı kalır. Geniş kapsamlı token'lar, sızan anahtarların en pahalı türüdür.

## OpenID Connect: OAuth'a kimlik katmanı

OIDC, OAuth akışına `openid` kapsamını ekler ve yetkilendirme sunucusunun token yanıtına bir **ID token** koymasını sağlar. ID token, kullanıcının kim olduğunu ve nasıl doğrulandığını anlatan imzalı bir JWT'dir: `iss` (sağlayıcı), `sub` (sağlayıcıdaki kalıcı kullanıcı kimliği), `aud` (istemci kimliğiniz), `exp`, `iat`, `nonce` ve isteğe bağlı olarak `email`, `email_verified`, `name` gibi profil talepleri.

OIDC ayrıca bir **keşif belgesi** (`/.well-known/openid-configuration`) tanımlar; istemci buradan yetkilendirme ve token uç noktalarını, JWKS adresini ve desteklenen algoritmaları otomatik öğrenir. Bu standartlaşma sayesinde "Google ile giriş", "Apple ile giriş" ya da kurumsal tek oturum açma (SSO) aynı kütüphaneyle yapılandırılabilir.

Kullanıcıyı uygulamanızdaki hesaba bağlarken anahtar olarak `iss` + `sub` çiftini kullanın. E-posta değişebilir, başka bir sağlayıcıda aynı e-posta başka bir kişiye ait olabilir ve `email_verified` yanlışsa e-postayı kimlik kanıtı olarak kabul etmek hesap ele geçirmeye yol açar.

:::callout{tone="warning" title="ID token API'ye, access token kimliğe kanıt değildir"}
ID token **istemci** için üretilmiştir: `aud` değeri sizin istemci kimliğinizdir ve "bu kullanıcı giriş yaptı" der. Onu API'lere taşıyıcı token olarak göndermek, `aud` kontrolünü anlamsızlaştırır. Tersi de tehlikelidir: bir access token'ı "kullanıcı bu kişidir" kanıtı olarak kabul etmek, başka bir uygulama için alınmış token'larla giriş yapılabilmesi demektir. Kimlik için ID token'ı imza, `iss`, `aud` ve `nonce` kontrolüyle doğrulayın; API erişimi için access token kullanın.
:::

## Yaygın hatalar özeti

- `state` üretmemek ya da geri dönüşte karşılaştırmamak.
- `redirect_uri` için gevşek eşleşme, uygulamada açık yönlendirme bırakmak.
- Açık istemcide PKCE kullanmamak ya da `plain` yöntemini seçmek.
- Token'ları URL'de, tarayıcı geçmişinde ya da loglarda bırakmak.
- ID token'ı `aud` ve imza kontrolü yapmadan kabul etmek; e-postayı kalıcı kimlik anahtarı yapmak.
- Gereğinden geniş kapsam istemek ve kaynak sunucusunda kapsam kontrolünü atlamak.

Bu platform da sosyal girişte OIDC'nin kimlik katmanına dayanır: web ve mobil istemciler Google ya da Apple'dan bir ID token alır ve API'ye gönderir; API bu token'ı sağlayıcının JWKS anahtarlarıyla doğrular, `aud` değerini yapılandırmadaki istemci kimlikleriyle karşılaştırır ve ardından kendi kısa ömürlü access token'ı ile döndürülen refresh token'ını üretir. Sağlayıcının token'ı yalnızca bir kez, kimlik kanıtı olarak kullanılır; platformun kendi API'sine erişim her zaman platformun kendi token'larıyla yapılır.

:::code{lang="ts" title="PKCE değerleri, yetkilendirme URL'si ve token takası"}
```ts
import { createHash, randomBytes } from 'node:crypto';

const b64url = (buf: Buffer) => buf.toString('base64url');

/** 1) Akış başına yeni verifier, challenge ve state üret; verifier ile state'i oturumda sakla. */
export function startLogin(session: Record<string, string>) {
  const verifier = b64url(randomBytes(32));                       // 43 karakter
  const challenge = b64url(createHash('sha256').update(verifier).digest());
  const state = b64url(randomBytes(16));
  session.pkceVerifier = verifier;
  session.oauthState = state;

  const url = new URL('https://idp.example.com/authorize');
  url.search = new URLSearchParams({
    response_type: 'code',
    client_id: process.env.OAUTH_CLIENT_ID!,
    redirect_uri: 'https://app.example.dev/callback',               // kayıtlı değerle birebir aynı
    scope: 'openid email calendar.read',
    state,
    code_challenge: challenge,
    code_challenge_method: 'S256',
  }).toString();
  return url.toString();
}

/** 2) Geri dönüşte state'i kontrol et, kodu verifier ile arka kanalda takas et. */
export async function handleCallback(query: URLSearchParams, session: Record<string, string>) {
  if (!query.get('state') || query.get('state') !== session.oauthState) {
    throw new Error('state eşleşmiyor');
  }
  const res = await fetch('https://idp.example.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code: query.get('code')!,
      redirect_uri: 'https://app.example.dev/callback',
      client_id: process.env.OAUTH_CLIENT_ID!,
      code_verifier: session.pkceVerifier,
    }),
  });
  delete session.pkceVerifier;                                      // tek kullanımlık
  delete session.oauthState;
  if (!res.ok) throw new Error('token takası başarısız');
  return res.json() as Promise<{ access_token: string; id_token: string; refresh_token?: string }>;
}
```
```python
import base64, hashlib, os, secrets
from urllib.parse import urlencode
import httpx

def b64url(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).rstrip(b"=").decode()

def start_login(session: dict) -> str:
    verifier = b64url(secrets.token_bytes(32))
    challenge = b64url(hashlib.sha256(verifier.encode()).digest())
    state = b64url(secrets.token_bytes(16))
    session["pkce_verifier"], session["oauth_state"] = verifier, state
    params = {
        "response_type": "code",
        "client_id": os.environ["OAUTH_CLIENT_ID"],
        "redirect_uri": "https://app.example.dev/callback",
        "scope": "openid email calendar.read",
        "state": state,
        "code_challenge": challenge,
        "code_challenge_method": "S256",
    }
    return "https://idp.example.com/authorize?" + urlencode(params)

def handle_callback(query: dict, session: dict) -> dict:
    if not query.get("state") or query["state"] != session.pop("oauth_state", None):
        raise PermissionError("state eşleşmiyor")
    res = httpx.post("https://idp.example.com/token", data={
        "grant_type": "authorization_code",
        "code": query["code"],
        "redirect_uri": "https://app.example.dev/callback",
        "client_id": os.environ["OAUTH_CLIENT_ID"],
        "code_verifier": session.pop("pkce_verifier"),
    })
    res.raise_for_status()
    return res.json()  # access_token, id_token, refresh_token
```
:::

:::realworld{company="GitHub"}
GitHub, OAuth'un farklı istemci türlerine nasıl uyarlandığını iyi gösterir. Web uygulamaları için klasik authorization code akışını sunar; kullanıcı GitHub'ın onay ekranında uygulamanın istediği kapsamları (`repo`, `read:user` gibi) görür ve onaylar. Klavyesi ya da tarayıcısı olmayan ortamlar için **device flow** desteklenir: GitHub'ın komut satırı aracı oturum açarken terminalde kısa bir kullanıcı kodu gösterir, kullanıcı bu kodu başka bir cihazdaki tarayıcıda girip onay verir ve araç arka planda token'ı alır. Böylece şifre hiçbir zaman terminale yazılmaz. GitHub ayrıca daha ince yetkili ve kısa ömürlü token'lar üreten **GitHub App** modelini önerir: uygulama yalnızca kurulduğu depolara ve seçilen izinlere erişebilir, bu da geniş kapsamlı uzun ömürlü kişisel token'lara olan ihtiyacı azaltır.
:::

:::callout{tone="tip" title="Mülakat özeti"}
- OAuth **yetkilendirme**, OIDC **kimlik doğrulama** içindir; ID token istemciye, access token API'ye gider.
- Kullanıcılı her akış için authorization code + PKCE (S256); servisten servise client credentials.
- `state` ile CSRF'yi, birebir `redirect_uri` ile kod sızıntısını, `nonce` ile ID token tekrarını engelle.
- Kullanıcıyı `iss` + `sub` ile eşle; e-postayı kalıcı kimlik anahtarı yapma.
:::

:::quiz{src="quiz.json"}
:::

:::next{lesson="n-04-authorization-rbac-abac"}
Sırada: kim olduğunu bildiğimiz kullanıcının ne yapabileceğine karar vermek. RBAC, ABAC ve politika motorları.
:::

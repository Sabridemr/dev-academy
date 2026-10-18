---
id: f-07-security-layers
slug: security-layers
module: f-code-and-infrastructure
order: 7
title:
  tr: "Güvenlik Katmanları: WAF, DDoS, TLS, IAM, Zero-Trust"
  en: "Security Layers: WAF, DDoS, TLS, IAM, Zero-Trust"
summary:
  tr: Derinlemesine savunma.
  en: Defense in depth.
durationMinutes: 30
level: intermediate
tags: [security, waf, ddos, tls, iam, zero-trust, mtls, defense-in-depth]
prerequisites: [f-05-physical-request-path, f-04-iac-config-secrets-flags]
concepts: [defense-in-depth, ddos-mitigation, anycast-scrubbing, web-application-firewall, tls-termination, authentication-vs-authorization, iam-least-privilege, iam-roles, zero-trust, mutual-tls, service-identity, network-segmentation, audit-logging]
---

## Kavram: tek bir duvar yoktur, katmanlar vardır

f-05'te bir isteğin İstanbul'dan Frankfurt'taki veritabanına kadar geçtiği her makineyi izledik. Bu derste aynı yolu bir **saldırganın gözünden** yürüyeceğiz: isteğin geçtiği her katman aynı zamanda bir **savunma hattıdır**. Amazon benzeri bir şirket "güvenlik duvarımız var" demez; **derinlemesine savunma** (defense in depth) uygular: her katman farklı bir tehdit sınıfını durdurur ve hiçbir katman tek başına güvenilmez. Bir katman aşılsa bile saldırganın yolu bir sonrakinde kesilir.

| Katman | Nerede? (f-05) | Neyi durdurur? | Teknoloji |
|---|---|---|---|
| 1. **DDoS koruması** | Anycast edge, scrubbing merkezleri | Hacimsel sel (L3/L4: SYN flood, UDP amplification), bot dalgaları | AWS Shield, Cloudflare, anycast + BGP |
| 2. **WAF** | Edge PoP / CDN | Uygulama katmanı saldırıları (SQL injection, XSS, kötü bot'lar, L7 flood) | AWS WAF, Cloudflare WAF, ModSecurity |
| 3. **TLS** | Edge'de sonlanır, origin'e yeniden şifreli | Dinleme, ortadaki adam, veri değiştirme | TLS 1.3, HSTS, sertifika otomasyonu (ACM) |
| 4. **API gateway: kimlik doğrulama + yetki** | Region, EKS pod'ları | Kimliksiz / süresi dolmuş token, yetki dışı erişim, kötüye kullanım (rate limit) | JWT/OIDC, OAuth 2.0, rate limiting |
| 5. **Ağ segmentasyonu** | VPC, subnet, security group | Dışarıdan doğrudan erişim, servisler arası gereksiz trafik | Özel subnet, SG, NetworkPolicy |
| 6. **Zero-trust: mTLS + servis kimliği** | Pod sidecar'ları (service mesh) | Küme içine sızan saldırganın yanal hareketi (lateral movement) | Istio / Linkerd / App Mesh, SPIFFE |
| 7. **IAM: en az yetki** | Her servisin rolü, veritabanı, S3 | Ele geçirilen servisin yetkisini aşması | IAM rolleri (IRSA), politikalar, DB rolleri |
| 8. **Denetim ve tespit** | Her yerde | Olup biteni görmemek | CloudTrail, GuardDuty, SIEM, anomali alarmları |

:::diagram{src="diagram.svg" alt="Derinlemesine savunma katmanları: dıştan içe anycast DDoS scrubbing, WAF, TLS sonlandırma, API gateway kimlik doğrulama ve rate limit, VPC segmentasyonu, mTLS servis mesh ve IAM en az yetki; her katmanda durdurulan tehdit örneği|Defense-in-depth layers from outside in: anycast DDoS scrubbing, WAF, TLS termination, API gateway authentication and rate limiting, VPC segmentation, mTLS service mesh and IAM least privilege; an example threat stopped at each layer"}
Dıştan içe doğru her katman farklı bir tehdit sınıfını filtreler. En içteki veri, yedi katmanın hepsini aşan bir saldırgana bile en az yetkiyle korunur.
:::

## 1. DDoS koruması: seli kıyıya varmadan dağıtmak

Dağıtık hizmet engelleme saldırısı (DDoS), on binlerce ele geçirilmiş cihazdan (botnet) aynı anda trafik göndererek kapasiteyi tüketmeyi hedefler. Üç sınıfı vardır:

- **Hacimsel (L3/L4)**: Tb/sn boyutunda UDP/ICMP seli, DNS/NTP amplifikasyonu. Hedef: bant genişliğini doldurmak.
- **Protokol**: SYN flood — TCP el sıkışmasını yarım bırakıp bağlantı tablosunu doldurmak.
- **Uygulama (L7)**: Saniyede milyonlarca "geçerli görünen" HTTP isteği (ör. pahalı bir arama sorgusu).

Savunma mimarisi iki fikre dayanır:

1. **Anycast ile dağıtmak**: f-05'te gördük — aynı IP 100+ PoP'tan yayınlanır. 2 Tb/sn'lik bir sel, dünyaya yayılmış botnet'ten geldiği için her PoP'a yalnızca 10–20 Gb/sn düşer; hiçbir nokta tek başına boğulmaz. Saldırganın coğrafi dağılımı savunmanın lehine çalışır.
2. **Scrubbing (temizleme)**: Şüpheli trafik, özel donanımlı temizleme merkezlerinden geçirilir; SYN cookie'leri, hız sınırları ve imza eşleştirme ile kötü paketler atılır, temiz trafik origin'e iletilir. Origin'in IP'si **hiç yayınlanmaz**; yalnızca edge'den gelen trafiği kabul eder (security group kuralı), böylece saldırgan edge'i atlayamaz.

AWS'te bu katman **Shield Standard** (ücretsiz, otomatik) ve **Shield Advanced** (7/24 müdahale ekibi, maliyet koruması) ile CloudFront/Route 53'ün arkasında çalışır.

## 2. WAF: uygulama katmanındaki kötü niyet

DDoS filtresinden geçen trafik "hacim olarak normal" ama içerik olarak kötü olabilir: `' OR 1=1 --` içeren bir arama sorgusu (SQL injection), `<script>` içeren bir yorum (XSS), `../../etc/passwd` (path traversal). **Web Application Firewall**, HTTP isteğinin gövdesini, başlıklarını ve URL'sini kural setleriyle (OWASP Core Rule Set, yönetilen bot kuralları) karşılaştırır ve eşleşenleri **403** ile reddeder. Edge'de çalıştığı için kötü istek origin'e hiç ulaşmaz.

WAF ayrıca L7 DDoS'u da karşılar: IP başına istek hızı (`rate-based rule`: 5 dakikada 2.000 istek), coğrafi kısıtlama, bilinen kötü IP listeleri ve CAPTCHA/challenge ile bot ayıklama.

:::callout{tone="warning" title="WAF, güvensiz kodun bahanesi değildir"}
WAF'ın SQL injection'ı yakalaması, kodun parametreli sorgu (`$1`) kullanması gerekliliğini ortadan kaldırmaz. WAF'lar atlatılabilir (encoding, parçalama). Derinlemesine savunmanın özü budur: WAF yakalar, kod yine de doğru yazılır, veritabanı rolü yine de yalnızca gereken tablolara erişir. Üçü birden başarısız olmadan veri sızmaz.
:::

## 3. TLS: yoldaki veriyi korumak

TLS üç garanti verir: **gizlilik** (şifreleme), **bütünlük** (değiştirilemez) ve **kimlik** (sunucu sertifikası gerçekten `shop.example.com`'a ait). f-05'te TLS'in edge'de sonlandığını gördük; güvenlik açısından ek kurallar:

- **TLS 1.3** zorunlu, eski protokoller (TLS 1.0/1.1) ve zayıf şifre takımları kapalı; eski istemci bağlanamaz, bağlanmamalıdır.
- **HSTS** başlığı tarayıcıya "bu site yalnızca HTTPS" der; HTTP'ye düşürme saldırısı engellenir.
- **Edge → origin arası yeniden şifrelenir** (origin'de kendi sertifikası); özel omurga bile düz metin taşımaz.
- Sertifikalar **otomatik** yenilenir (ACM, Let's Encrypt): süresi dolan sertifika hâlâ en yaygın "kesinti" nedenlerinden biridir.

## 4. Kimlik doğrulama ve yetkilendirme: gateway kapısı

Şifreli ve temiz bir istek Frankfurt'a vardığında API gateway sorar: **Sen kimsin?** (authentication) ve **Buna hakkın var mı?** (authorization).

- **Authentication**: İstek bir `Authorization: Bearer <JWT>` taşır. Gateway imzayı kimlik sağlayıcının (Cognito, Auth0, kendi OIDC sunucunuz) açık anahtarıyla doğrular, süresini (`exp`) ve hedef kitleyi (`aud`) kontrol eder. Geçersizse **401**.
- **Authorization**: Token'daki `sub` (kullanıcı) ve `scope`/`roles` ile istenen kaynak karşılaştırılır: `GET /orders/9001` yalnızca o siparişin sahibi ya da destek rolü için geçerlidir. Değilse **403**. Bu kontrol gateway'de kaba, serviste ince yapılır (ikisi de!).
- **Rate limiting**: Kullanıcı/anahtar başına kota; aşılırsa **429**. a-10'daki token bucket tam burada çalışır.

## 5. Zero-trust: içerideki ağa da güvenme

Klasik model "kale ve hendek"ti: dış duvar güçlü, içerisi serbest. Bir saldırgan tek bir pod'u ele geçirince (ör. bir bağımlılıktaki zafiyetle) küme içindeki her servise rahatça ulaşırdı — buna **yanal hareket** denir. **Zero-trust**, "ağda olmak güven vermez; her istek, nereden gelirse gelsin, kimliğini kanıtlar" der. Uygulamada:

- **Servis kimliği**: Her pod'a kriptografik bir kimlik verilir (SPIFFE ID: `spiffe://shop/ns/prod/sa/cart-service`), kısa ömürlü bir sertifika olarak otomatik dağıtılır ve saatte bir döndürülür.
- **mTLS (karşılıklı TLS)**: Servisler arası her bağlantıda **iki taraf da** sertifika sunar. `cart-service`'in sidecar'ı, kendini `inventory-service` olarak tanıtamayan bir pod'dan gelen bağlantıyı el sıkışma aşamasında reddeder. Service mesh (Istio, Linkerd, AWS App Mesh) bunu uygulama koduna dokunmadan sidecar proxy'lerle yapar.
- **Yetki politikaları**: "`orders-service` → `payments-service` `POST /charge` çağırabilir; `cart-service` çağıramaz." Kimlik + izin, IP adresinden bağımsızdır; pod IP'si değişse de politika çalışır.
- **Ağ segmentasyonu** yine vardır (özel subnet, NetworkPolicy, veritabanına yalnızca uygulama subnet'inden erişim) — ama tek güvence değildir.

## 6. IAM: en az yetki ilkesi

Saldırgan yedi katmanı aşıp `cart-service` pod'unun içinde kod çalıştırdığını varsayalım. Ne yapabilir? Cevap, pod'un **IAM rolünün** izin verdiği kadardır. **En az yetki (least privilege)**: her servis yalnızca işini yapmak için gereken minimum izne sahiptir.

- `cart-service` rolü: `dynamodb:GetItem/PutItem` **yalnızca** `carts` tablosunda; `secretsmanager:GetSecretValue` **yalnızca** `prod/cart/*` için. `s3:*` yok, `iam:*` yok, `orders` tablosuna erişim yok.
- Rol pod'a **IRSA** (IAM Roles for Service Accounts) ile bağlanır: uzun ömürlü anahtar yoktur; pod, Kubernetes service account token'ını 15 dakikalık AWS kimlik bilgilerine çevirir (f-04'teki "kimlikle erişim").
- Veritabanı tarafında da aynı ilke: `cart_app` DB kullanıcısı `cart_items` üzerinde `SELECT/INSERT/UPDATE/DELETE`, `orders` üzerinde hiçbir şey; `DROP` kimsede yok.
- İnsanlar için: kalıcı admin yok; gerekince süreli yükseltme (just-in-time access), MFA zorunlu, her eylem CloudTrail'de.

:::animation{scene="scene.json"}
Kötü niyetli bir istek katman katman filtrelenir: hacimsel sel anycast edge'de dağıtılır, SQL injection WAF'ta, eski TLS el sıkışmada, geçersiz JWT gateway'de, kimliksiz pod mTLS'te, yetkisiz DELETE IAM'de durur; meşru istek tüm katmanlardan geçer.
:::

:::interactive{type="request-journey" path="anycast-edge,waf,tls,api-gateway,service-mesh,iam,database" mode="security" attackTypes="syn-flood,sql-injection,expired-token,lateral-movement,privilege-escalation"}
Soldan bir saldırı türü seçip gönderin ve hangi katmanda, hangi HTTP koduyla durdurulduğunu izleyin. Sonra katmanları tek tek kapatın (ör. WAF'ı devre dışı bırakın) ve aynı saldırının bir sonraki katmana ulaştığını, ama IAM en az yetki sayesinde yine de veriye erişemediğini gözlemleyin. Son olarak meşru bir isteği gönderip tüm katmanlardan geçtiğini doğrulayın.
:::

:::code{lang="ts" title="Gateway'de kimlik doğrulama ve serviste ince yetki kontrolü (iki katman)"}
```ts
import { createRemoteJWKSet, jwtVerify, type JWTPayload } from 'jose';

// ---- Katman 4a: API gateway — token geçerli mi? (authentication) ----
const JWKS = createRemoteJWKSet(new URL('https://auth.shop.example.com/.well-known/jwks.json'));

export interface Principal { userId: string; roles: string[]; scopes: string[] }

export async function authenticate(authorizationHeader?: string): Promise<Principal> {
  const token = authorizationHeader?.match(/^Bearer (.+)$/)?.[1];
  if (!token) throw new HttpError(401, 'missing token');
  try {
    // İmza (IdP'nin açık anahtarı), süre (exp), yayıncı (iss) ve hedef kitle (aud) birlikte doğrulanır
    const { payload } = await jwtVerify(token, JWKS, {
      issuer: 'https://auth.shop.example.com',
      audience: 'shop-api',
      clockTolerance: 30,          // saat kayması toleransı: 30 sn
    });
    return toPrincipal(payload);
  } catch {
    throw new HttpError(401, 'invalid or expired token');   // neden söylenmez: saldırgana ipucu verme
  }
}

function toPrincipal(p: JWTPayload): Principal {
  return {
    userId: String(p.sub),
    roles: Array.isArray(p['roles']) ? (p['roles'] as string[]) : [],
    scopes: typeof p['scope'] === 'string' ? p['scope'].split(' ') : [],
  };
}

// ---- Katman 4b: serviste ince yetki — bu kullanıcı BU kaynağa dokunabilir mi? (authorization) ----
interface Order { id: string; ownerId: string }

export function authorizeOrderAccess(principal: Principal, order: Order, action: 'read' | 'cancel'): void {
  const isOwner = order.ownerId === principal.userId;
  const isSupport = principal.roles.includes('support');
  const hasScope = principal.scopes.includes(action === 'read' ? 'orders:read' : 'orders:write');

  // Sahip ya da destek rolü VE uygun scope; aksi hâlde 403 (kimlik doğru ama hak yok)
  if (!hasScope || !(isOwner || isSupport)) throw new HttpError(403, 'forbidden');
  // Not: 404 yerine 403 dönmek kaynak varlığını sızdırır; bazı API'ler bilinçli olarak 404 döner.
}

export class HttpError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

// ---- Katman 7: IAM en az yetki — kod ne kadar doğru olursa olsun rol bunu sınırlar ----
// cart-service'in IAM politikası (IRSA ile pod'a bağlı):
// {
//   "Effect": "Allow",
//   "Action": ["dynamodb:GetItem", "dynamodb:PutItem", "dynamodb:UpdateItem"],
//   "Resource": "arn:aws:dynamodb:eu-central-1:123456789012:table/carts"
// }
// → ele geçirilmiş bir cart-service bile orders tablosunu okuyamaz, hiçbir tabloyu silemez.
```
```python
import jwt            # PyJWT
from jwt import PyJWKClient

JWKS = PyJWKClient("https://auth.shop.example.com/.well-known/jwks.json")

class HttpError(Exception):
    def __init__(self, status: int, message: str):
        super().__init__(message)
        self.status = status

def authenticate(authorization_header: str | None) -> dict:
    if not authorization_header or not authorization_header.startswith("Bearer "):
        raise HttpError(401, "missing token")
    token = authorization_header[7:]
    try:
        key = JWKS.get_signing_key_from_jwt(token).key
        payload = jwt.decode(token, key, algorithms=["RS256"], audience="shop-api",
                             issuer="https://auth.shop.example.com", leeway=30)
    except jwt.PyJWTError:
        raise HttpError(401, "invalid or expired token")      # neden söylenmez
    return {"user_id": payload["sub"], "roles": payload.get("roles", []),
            "scopes": payload.get("scope", "").split()}

def authorize_order_access(principal: dict, order: dict, action: str) -> None:
    is_owner = order["owner_id"] == principal["user_id"]
    is_support = "support" in principal["roles"]
    needed = "orders:read" if action == "read" else "orders:write"
    if needed not in principal["scopes"] or not (is_owner or is_support):
        raise HttpError(403, "forbidden")                      # kimlik doğru, hak yok
```
:::

## 7. Denetim ve tespit: görmediğinizi savunamazsınız

Son katman önleyici değil, **tespit edicidir**: her IAM çağrısı CloudTrail'e, her WAF kararı loglara, her mTLS reddi mesh metriklerine yazılır (f-06'daki log/metrik depoları). GuardDuty gibi servisler bu akışta anomali arar: "cart-service rolü ilk kez `ListBuckets` çağırdı", "bir pod gece 3'te bilinmeyen bir IP'ye 2 GB gönderdi". Olay müdahale planı (runbook) ve düzenli tatbikatlar (game day) bu katmanın parçasıdır.

:::realworld{company="Amazon"}
Amazon.com, AWS'nin kendi güvenlik katmanlarının en büyük müşterisidir. Dış kenarda **Route 53 + CloudFront + AWS Shield Advanced** üçlüsü anycast ile çalışır; AWS, 2020'de 2,3 Tb/sn'lik, o güne kadar görülmüş en büyük DDoS saldırısını bu altyapıyla müşterilerine hissettirmeden karşıladığını açıkladı. **AWS WAF** yönetilen kural grupları (OWASP, bot kontrolü, hesap ele geçirme önleme) Prime Day'de saniyede milyonlarca isteği inceler. İçeride Amazon'un güvenlik kültürü iki ilkeye dayanır: **"least privilege by default"** — her servis yalnızca kendi IAM rolüyle çalışır, insanlar production'a kalıcı erişime sahip değildir, erişim süreli ve onaylıdır — ve **"her şey şifreli"**: servisler arası trafik mTLS, diskteki veri KMS ile şifreli, anahtarlar otomatik döner. Amazon'un dahili servisleri birbirine IP ile değil **imzalı kimliklerle** (SigV4 benzeri istek imzalama) güvenir; bu, AWS API'lerinin her çağrıyı imzalatmasının aynısıdır — zero-trust'ın 2000'lerden beri uygulanan hâli.
:::

:::callout{tone="tip" title="Mülakat ipuçları"}
- Güvenlik sorusuna **katman katman** cevap verin ve her katmanı f-05'teki fiziksel konumuna oturtun: "DDoS edge'de anycast ile, WAF edge'de, TLS edge'de sonlanır origin'e yeniden şifrelenir, authn/authz gateway'de, mTLS mesh'te, IAM her servisin rolünde."
- **Authentication ile authorization'ı** karıştırmayın: 401 "kimsin bilmiyorum", 403 "biliyorum ama hakkın yok".
- Zero-trust'ı tek cümleyle: *"Ağ konumu güven vermez; her çağrı kimliğini kanıtlar ve yalnızca izin verilen işlemi yapar."*
- "Saldırgan bir pod'u ele geçirirse?" sorusuna hazır olun: mTLS yanal hareketi, IAM en az yetki veri erişimini, kısa ömürlü kimlik bilgileri kalıcılığı sınırlar; CloudTrail/GuardDuty tespit eder.
:::

:::quiz{src="quiz.json"}
:::

:::next{lesson="f-08-devacademy-architecture"}
Modülün son dersinde tüm bu kavramları elinizdeki uygulamaya uygularız: DevAcademy'nin kendi monorepo'su, backend'i, web ve mobil katmanları gerçekte nasıl çalışıyor?
:::

---
id: a-10-rate-limiting
slug: rate-limiting
module: a-system-design-fundamentals
order: 10
title:
  tr: "Rate Limiting Algoritmaları"
  en: "Rate Limiting Algorithms"
summary:
  tr: Token bucket, leaky bucket, sliding window — interaktif karşılaştırma.
  en: Token bucket, leaky bucket, sliding window — interactive comparison.
durationMinutes: 25
level: intermediate
tags: [rate-limiting, api-gateway, redis, resilience, security]
prerequisites: [a-06-api-gateway, a-07-caching]
concepts: [rate-limiting, token-bucket, leaky-bucket, fixed-window, sliding-window-log, sliding-window-counter, distributed-rate-limiter, http-429, rate-limit-key]
---

## Kavram: herkese adil, sisteme güvenli

Bir API'yi saniyede 10.000 istek kaldıracak şekilde tasarladınız; tek bir müşteri hatalı bir döngüyle saniyede 50.000 istek göndermeye başladı. Geri kalan herkes için servis çöktü. **Rate limiting (istek sınırlama)**, bir istemcinin belirli bir zaman penceresinde yapabileceği istek sayısını sınırlayarak üç şeyi korur:

- **Kullanılabilirlik** — tek bir kötü (ya da kötü niyetli) istemci herkesin servisini bozamaz.
- **Maliyet** — her istek CPU, DB ve üçüncü taraf API parası demektir.
- **Güvenlik** — brute-force login, kazıma (scraping) ve basit DoS saldırılarını yavaşlatır.

Sınırı aşan istek genellikle **HTTP 429 Too Many Requests** ile reddedilir; yanıtta `Retry-After` ve `X-RateLimit-Limit / Remaining / Reset` başlıkları istemciye ne zaman tekrar deneyebileceğini söyler. Üç tasarım sorusu vardır: **neye göre** sınırlıyoruz (anahtar), **nerede** sınırlıyoruz (katman) ve **hangi algoritmayla**.

### Anahtar (key) ve katman

| Anahtar | Örnek | Not |
|---|---|---|
| Kullanıcı / API key | `user:42`, `apikey:sk_live_…` | En adil; kimlik doğrulama sonrası uygulanır |
| IP adresi | `ip:203.0.113.7` | Kimliksiz uç noktalar (login, kayıt) için; NAT arkasındaki kullanıcıları cezalandırabilir |
| Uç nokta | `POST /login` | Pahalı ya da hassas uç noktalara ayrı, daha sıkı limit |
| Birleşik | `user:42:/export` | Hem kullanıcı hem uç nokta bazında |

Sınırlama en dışta (**CDN / WAF**: IP bazlı kaba filtre), ortada (**API Gateway**: kullanıcı/API key bazlı ana limit) ve içeride (**servis**: pahalı iş için koruma, örn. "kullanıcı başına eşzamanlı 2 rapor") katman katman uygulanır.

:::diagram{src="diagram.svg" alt="Dört rate limiting algoritmasının yan yana şeması: token bucket, leaky bucket, fixed window ve sliding window|Side-by-side schematic of four rate limiting algorithms: token bucket, leaky bucket, fixed window and sliding window"}
Dört algoritma, aynı soruya ("bu isteği şimdi kabul edeyim mi?") farklı bellek ve adalet dengeleriyle cevap verir.
:::

## Token bucket (jeton kovası)

En yaygın algoritma. Bir kovada en fazla **kapasite** (burst) kadar jeton durur; kova sabit hızla (**refill rate**) dolar. Her istek bir jeton harcar; jeton yoksa istek reddedilir. İki parametre iki farklı şeyi kontrol eder:

- **Refill rate** → uzun vadeli ortalama hız (ör. 5 istek/s).
- **Kapasite** → izin verilen ani patlama (ör. 10 istek bir anda).

Boşta kalan istemcinin jetonları birikir (kapasiteye kadar); bu yüzden gerçek kullanıcı davranışına — uzun sessizlik, kısa patlama — çok iyi uyar. AWS API Gateway, Stripe ve çoğu gateway bunu kullanır.

:::animation{scene="scene.json"}
Token bucket: dolu kova, normal trafik, patlama sırasında jetonların tükenmesi ve 429'lar, yeniden dolum ve kararlı durum.
:::

Bellek maliyeti anahtar başına iki sayıdır: `tokens` ve `lastRefill`. Jetonlar tembel (lazy) hesaplanır: istek geldiğinde `tokens = min(capacity, tokens + (now − lastRefill) × rate)`; ayrı bir zamanlayıcıya gerek yoktur.

## Leaky bucket (sızdıran kova)

Kovaya istekler düşer, kova altından **sabit hızla** sızar (işlenir). Kova doluysa yeni istek taşar (reddedilir). Token bucket'ın aksine çıkış hızı pürüzsüzdür: patlama girişte tamponlanır, arka uç hiç ani yük görmez. Bu yüzden genellikle bir **kuyruk** ile uygulanır ve hem sınırlama hem **trafik şekillendirme** (traffic shaping) için kullanılır; NGINX'in `limit_req` modülü bu modeldir. Dezavantajı: kuyrukta bekleyen istek gecikme yaşar ve eski istekler yeni, belki daha önemli istekleri bekletir.

## Fixed window counter (sabit pencere)

Zaman sabit pencerelere bölünür (`12:00:00–12:00:59`), her pencere için bir sayaç tutulur: `INCR key:user42:1200`; sayaç limiti aşınca reddet, pencere bitince sayaç sıfırlanır. Bellek ve uygulama en basit olanıdır (Redis'te `INCR` + `EXPIRE`). Zayıf noktası **pencere sınırı problemidir**: limit 100/dk ise bir istemci 12:00:59'da 100, 12:01:00'da 100 daha gönderebilir — 2 saniyede 200 istek, yani limitin iki katı.

:::callout{tone="warning" title="Pencere sınırı problemi gerçek bir risktir"}
Fixed window ile "dakikada 1.000" demek, aslında "herhangi bir 2 saniyede 2.000'e izin veriyorum" demektir. Arka ucunuz bu patlamayı kaldıramıyorsa limit sizi korumuyordur. Çözüm: sliding window ya da token bucket.
:::

## Sliding window log (kayan pencere günlüğü)

Her isteğin zaman damgası bir listede (Redis sorted set) tutulur. Yeni istek geldiğinde `now − window`'dan eski kayıtlar silinir, kalan sayı limitle karşılaştırılır. **Tamamen doğrudur** — hiçbir pencere sınırı etkisi yoktur — ama bellek anahtar başına O(limit)'tir: limit 10.000/saat olan 1 milyon kullanıcı için 10 milyar zaman damgası. Yüksek limitlerde pratik değildir; düşük limitli hassas uç noktalarda (ör. "saatte 5 şifre sıfırlama") idealdir.

## Sliding window counter (kayan pencere sayacı)

Fixed window'un belleği ile sliding log'un doğruluğuna yakın bir ara çözüm. Önceki ve mevcut pencerenin sayaçları tutulur; tahmini sayı, önceki pencerenin **örtüşen yüzdesi** ile ağırlıklandırılır:

```
tahmin = mevcut_sayaç + önceki_sayaç × (1 − pencere_içinde_geçen_oran)
```

Örnek: limit 100/dk, önceki dakikada 84 istek, mevcut dakikanın 15. saniyesinde 36 istek: `36 + 84 × (1 − 15/60) = 36 + 63 = 99` → bir istek daha kabul, sonrası red. Cloudflare bu yöntemle 400 milyon isteklik bir örneklemde yalnızca %0,003 isteğin yanlış karar aldığını raporlamıştır. Bellek anahtar başına iki sayaçtır.

## Karşılaştırma

| Algoritma | Burst'e izin | Doğruluk | Bellek / anahtar | Çıkış hızı | Tipik kullanım |
|---|---|---|---|---|---|
| **Token bucket** | Evet (kapasite kadar) | İyi | 2 sayı | Patlamalı | Genel API limiti (varsayılan seçim) |
| **Leaky bucket** | Hayır (kuyruklar) | İyi | Kuyruk boyutu | Pürüzsüz, sabit | Trafik şekillendirme, arka ucu koruma |
| **Fixed window** | Sınırda 2× | Zayıf | 1 sayaç | Patlamalı | Kaba, ucuz sınırlar |
| **Sliding window log** | Hayır | Tam | O(limit) zaman damgası | Düzgün | Düşük limitli hassas uç noktalar |
| **Sliding window counter** | Çok az | Yaklaşık (çok iyi) | 2 sayaç | Düzgün | Yüksek hacimli genel limit (CDN/gateway) |

:::interactive{type="rate-limiter" algorithm="token-bucket" capacity=10 refillPerSec=5 windowMs=1000 limit=10}
Aynı istek dizisini dört algoritmaya gönderin. Önce yavaş, sonra bir anda 15 istek: token bucket kaçını kabul ediyor, leaky bucket kaçını kuyruğa alıyor? Fixed window'da istekleri pencere sınırının hemen önüne ve arkasına yığın; sliding window aynı deseni nasıl yakalıyor?
:::

## Dağıtık rate limiter: Redis + Lua

Gateway'in üç kopyası varsa her biri kendi belleğinde sayaç tutarsa gerçek limit üç katına çıkar. Sayaç paylaşımlı bir yerde — pratikte **Redis** — durmalıdır. Burada iki tuzak vardır:

1. **Yarış koşulu**: `GET tokens` → hesapla → `SET tokens` üç ayrı komut olursa iki gateway aynı anda aynı değeri okuyup ikisi de kabul eder. Çözüm: hesabı **tek atomik işlemde** yapmak — bir Lua betiği Redis'te tek thread üzerinde kesintisiz çalışır.
2. **Gecikme ve kullanılabilirlik**: her istek Redis'e gidiyorsa Redis gecikmesi her isteğe eklenir, Redis düşerse ne olur? Yaygın cevap: *fail-open* (Redis yoksa izin ver, alarm üret) ve yerel bir cache ile Redis'e toplu/seyrek gitmek (örn. her gateway 10 jetonu yerel olarak önden alır).

:::code{lang="ts" title="Redis + Lua ile atomik token bucket (dağıtık)"}
```ts
import Redis from "ioredis";

const redis = new Redis();

// Tüm hesap Redis içinde tek atomik adımda yapılır: yarış koşulu yok.
// KEYS[1] = bucket anahtarı; ARGV = kapasite, doldurma hızı (token/s), şimdi (ms), istenen token
const TOKEN_BUCKET_LUA = `
local key       = KEYS[1]
local capacity  = tonumber(ARGV[1])
local rate      = tonumber(ARGV[2])
local now_ms    = tonumber(ARGV[3])
local requested = tonumber(ARGV[4])

local data   = redis.call('HMGET', key, 'tokens', 'ts')
local tokens = tonumber(data[1])
local ts     = tonumber(data[2])
if tokens == nil then tokens = capacity; ts = now_ms end   -- ilk istek: kova dolu başlar

-- Tembel dolum: geçen süre kadar token ekle, kapasiteyi aşma
local elapsed = math.max(0, now_ms - ts) / 1000
tokens = math.min(capacity, tokens + elapsed * rate)

local allowed = 0
if tokens >= requested then
  tokens = tokens - requested
  allowed = 1
end

redis.call('HSET', key, 'tokens', tokens, 'ts', now_ms)
-- Kova en geç bu sürede yeniden dolar; boşta kalan anahtarlar kendiliğinden silinsin
redis.call('PEXPIRE', key, math.ceil(capacity / rate * 1000) + 1000)

-- allowed, kalan token, bir sonraki token için beklenecek ms
local wait_ms = 0
if allowed == 0 then wait_ms = math.ceil((requested - tokens) / rate * 1000) end
return { allowed, math.floor(tokens), wait_ms }
`;

export interface Decision { allowed: boolean; remaining: number; retryAfterMs: number }

export async function allowRequest(
  key: string,
  capacity = 10,
  refillPerSec = 5,
): Promise<Decision> {
  const [allowed, remaining, wait] = (await redis.eval(
    TOKEN_BUCKET_LUA, 1, `rl:${key}`, capacity, refillPerSec, Date.now(), 1,
  )) as [number, number, number];
  return { allowed: allowed === 1, remaining, retryAfterMs: wait };
}

// Express middleware: kullanıcı başına limit, 429 + standart başlıklar
export function rateLimit(capacity: number, refillPerSec: number) {
  return async (req: any, res: any, next: any) => {
    const key = req.user?.id ? `user:${req.user.id}` : `ip:${req.ip}`;
    const d = await allowRequest(key, capacity, refillPerSec);
    res.setHeader("X-RateLimit-Limit", capacity);
    res.setHeader("X-RateLimit-Remaining", d.remaining);
    if (!d.allowed) {
      res.setHeader("Retry-After", Math.ceil(d.retryAfterMs / 1000));
      return res.status(429).json({ error: "rate_limited", retryAfterMs: d.retryAfterMs });
    }
    next();
  };
}
```
```python
import time, redis

r = redis.Redis()
TOKEN_BUCKET_LUA = """
local key, capacity, rate = KEYS[1], tonumber(ARGV[1]), tonumber(ARGV[2])
local now_ms, requested = tonumber(ARGV[3]), tonumber(ARGV[4])
local data = redis.call('HMGET', key, 'tokens', 'ts')
local tokens, ts = tonumber(data[1]), tonumber(data[2])
if tokens == nil then tokens = capacity; ts = now_ms end
tokens = math.min(capacity, tokens + math.max(0, now_ms - ts) / 1000 * rate)
local allowed = 0
if tokens >= requested then tokens = tokens - requested; allowed = 1 end
redis.call('HSET', key, 'tokens', tokens, 'ts', now_ms)
redis.call('PEXPIRE', key, math.ceil(capacity / rate * 1000) + 1000)
local wait_ms = 0
if allowed == 0 then wait_ms = math.ceil((requested - tokens) / rate * 1000) end
return { allowed, math.floor(tokens), wait_ms }
"""
script = r.register_script(TOKEN_BUCKET_LUA)

def allow_request(key: str, capacity: int = 10, refill_per_sec: float = 5.0):
    allowed, remaining, wait_ms = script(keys=[f"rl:{key}"],
                                         args=[capacity, refill_per_sec, int(time.time() * 1000), 1])
    return bool(allowed), int(remaining), int(wait_ms)   # 429 kararı ve Retry-After için
```
:::

## İstemci tarafı: 429 alınca ne yapmalı?

İyi bir istemci 429'u hata değil **sinyal** olarak görür: `Retry-After`'a uyar, yoksa üstel geri çekilme + jitter uygular ve asla sıkı döngüde tekrar denemez. İyi bir sunucu da belgelerinde limitleri açıkça yazar; sürpriz limit, destek biletine dönüşür.

:::realworld{company="Stripe"}
Stripe'ın API'si dört farklı sınırlayıcıyı katman katman çalıştırır. **Request rate limiter**, kullanıcı başına saniyelik istek sınırı için Redis üzerinde **token bucket** kullanır; müşterilerin tek seferlik toplu işleri (burst) kapasite sayesinde geçer, sürekli yüksek hız ise 429 ile kesilir. **Concurrent request limiter**, aynı anda uçuşta olan istek sayısını sınırlar — yavaş uç noktaların tüm worker'ları işgal etmesini önler. **Fleet usage load shedder**, kapasitenin %20'sini kritik (ödeme oluşturma) istekler için rezerve eder; kritik olmayan trafik (liste sorguları) önce kesilir. **Worker utilization load shedder** ise sunucular doyma noktasına yaklaşınca en düşük öncelikli istekleri reddeder. Stripe, limitleri önce yalnızca loglayan "gölge modda" çalıştırıp etkisini ölçtükten sonra devreye alır ve her 429 yanıtında `Retry-After` döndürür.
:::

:::callout{tone="tip" title="Mülakat özeti"}
- Varsayılan cevap: **token bucket** (burst + ortalama ayrı ayarlanır, 2 sayı bellek). Pürüzsüz çıkış gerekiyorsa leaky bucket; CDN ölçeğinde yaklaşık ama ucuz çözüm için sliding window counter.
- Fixed window'u önerirseniz **pencere sınırı problemini** kendiniz söyleyin.
- "Dağıtık" kelimesi geçince: paylaşımlı sayaç (Redis), **atomiklik** (Lua / INCR), Redis düşünce **fail-open mi fail-closed mu**, ve yerel ön-tahsis ile gecikme azaltma.
- Yanıtı unutmayın: **429 + Retry-After + X-RateLimit-*** başlıkları.
:::

:::quiz{src="quiz.json"}
:::

:::next{lesson="a-11-consistent-hashing-sharding"}
Sırada: rate limiter sayaçlarını, cache anahtarlarını ve veritabanı satırlarını birden çok düğüme nasıl dağıtırız? Consistent hashing, sharding ve partitioning.
:::

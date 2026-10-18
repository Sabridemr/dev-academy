---
id: e-06-classic-interview-systems
slug: classic-interview-systems
module: e-case-studies
order: 6
title:
  tr: URL Kısaltıcı, Rate Limiter, Notification Servisi
  en: URL Shortener, Rate Limiter, Notification Service
summary:
  tr: Klasik mülakat soruları ve çözüm şablonu.
  en: Classic interview questions and a solution template.
durationMinutes: 45
level: intermediate
tags: [case-study, interview, url-shortener, rate-limiter, notifications, template]
prerequisites: [a-07-caching, a-10-rate-limiting, a-09-message-queues-event-driven, e-05-whatsapp-messaging]
concepts: [solution-template, base62-encoding, id-generation, redirect-301-vs-302, sliding-window-counter, distributed-rate-limiting, notification-fan-out, retry-backoff-dlq]
---

## Üç klasik, tek şablon

Bu üç soru neredeyse her sistem tasarımı mülakat setinde vardır; büyük vakalardan farkı 45 dakikada **uçtan uca** bitirilmesinin beklenmesidir. Bu yüzden asıl ölçülen şey derinlik değil, **disiplinli bir şablonu** hızla uygulayabilmenizdir.

:::callout{tone="info" title="Çözüm şablonu (her soru için aynı 7 adım)"}
1. **Gereksinimler** — fonksiyonel 3–5 madde, fonksiyonel olmayan 3–4 madde; okuma/yazma oranını söyle.
2. **Kapasite** — QPS, depolama, bant genişliği; bir dakikadan uzun sürmesin.
3. **API** — 2–3 uç nokta, istek/yanıt alanları.
4. **Veri modeli** — tablo/anahtar tasarımı, hangi depo ve neden.
5. **Yüksek seviye mimari** — kutu-ok diyagramı, istek yolu.
6. **Derinleştirme** — mülakatçının seçtiği 1–2 bileşen.
7. **Darboğazlar** — tek hata noktaları, sıcak anahtarlar, ölçekleme planı.
:::

## Mini vaka 1: URL kısaltıcı

### Gereksinimler
**Fonksiyonel**: uzun URL'den kısa kod üret; kısa koda gelen isteği yönlendir; isteğe bağlı özel alias ve son kullanma tarihi; tıklama istatistiği. **Fonksiyonel olmayan**: yönlendirme p99 < 50 ms, %99.99 erişilebilirlik (kısaltma düşebilir, yönlendirme düşemez), okuma/yazma ≈ 100:1, kodlar tahmin edilemez olsun.

### Kapasite
Ayda 100 M yeni URL ≈ **40 yazma/s**; 100:1 oranla **4 K yönlendirme/s** (tepe 40 K). Kayıt ~500 B → 5 yılda 6 Mia URL × 500 B ≈ **3 TB** — tek bir KV kümesine sığar. Kod uzunluğu: base62 ile 7 karakter = 62⁷ ≈ **3.5 trilyon** kod; 6 Mia için fazlasıyla yeter.

:::interactive{type="capacity-estimator" dau=50000000 readsPerUserPerDay=8 writesPerUserPerDay=0.07 avgWriteSizeBytes=500 avgReadSizeBytes=300 peakMultiplier=10 hotDataRatio=0.2 replicationFactor=3}
Depolamanın ne kadar küçük kaldığına dikkat edin: bu problemde darboğaz disk değil, yönlendirme gecikmesi ve id üretimidir. Tepe çarpanını 10'dan 20'ye çıkarın (viral bir link): tepe okuma QPS'si ve gereken uygulama sunucusu sayısı iki katına çıkar ama cache boyutu değişmez ve birkaç GB'ta kalır — yönlendirme tablosunun sıcak kısmı tamamen belleğe sığar.
:::

### Tasarım kararları
**ID üretimi** — üç seçenek: (a) `hash(longUrl)` kes: çakışma kontrolü gerekir, aynı URL aynı kodu alır; (b) **merkezi sayaç + base62**: tahmin edilebilir (`…/aB3x9Q` → bir sonraki `…/aB3x9R`), tek hata noktası; (c) **aralık tahsisi**: her API düğümü ZooKeeper/DB'den 1 M'lik bir aralık alır, yerel sayaçla ilerler, aralık bitince yenisini ister — koordinasyon yok, kayıp aralık önemsiz. Tahmin edilebilirliği kırmak için sayı base62'ye çevrilmeden önce bir bijektif karıştırma (ör. çarpımsal ters) uygulanır.

**301 mi 302 mi?**

| | 301 Moved Permanently | 302 Found |
|---|---|---|
| Tarayıcı davranışı | Yanıtı önbelleğe alır; sonraki tıklamalar sunucuya **gelmez** | Her tıklamada sunucuya gelir |
| Sunucu yükü | Çok düşük | Her tıklama bir istek |
| Analitik | Tıklamalar kaybolur | Her tıklama sayılır |
| Hedefi değiştirme | Önbellek yüzünden gecikir | Anında |

Ürün tıklama istatistiği satıyorsa (Bitly) **302**; yalnızca yükü azaltmak istiyorsanız 301. Çoğu mülakatta beklenen cevap: "analitik için 302, ama tarayıcı önbelleğini kısa tutan `Cache-Control` ile 301 de düşünülebilir."

**Veri modeli ve yol** — `short_code → {long_url, created_at, expires_at, owner}` bir KV depoda (DynamoDB/Cassandra, anahtar = kod, otomatik dağılım). Yönlendirme yolu: CDN/edge → API → Redis (sıcak kodlar, %90+ isabet) → KV. Tıklama olayı senkron yazılmaz; Kafka'ya düşer, analitik toplu işler.

:::diagram{src="url-shortener.svg" alt="URL kısaltıcı mimarisi: kısaltma yolu aralık tabanlı id üretici ve KV depo, yönlendirme yolu Redis cache ve 302, tıklama olayları Kafka ile analitiğe|URL shortener architecture: shortening path with range-based id generator and KV store, redirect path with Redis cache and 302, click events to analytics via Kafka"}
Yazma yolu (üst) nadir ve koordinasyonsuz; okuma yolu (alt) cache'ten beslenir ve analitik asenkrondur.
:::

:::animation{scene="url-shortener.scene.json"}
POST /shorten → aralıktan id → base62 → KV + cache → 201; GET /aB3x9Q → cache HIT → 302 → hedef site; tıklama olayı Kafka'ya; cache miss durumunda KV sorgusu.
:::

**Darboğazlar**: viral tek link (tek anahtar) → Redis + CDN edge cache ile emilir; id üretici düşerse → her düğümün cebinde önceden alınmış aralık var; kötüye kullanım → kısaltma tarafında rate limit ve kara liste denetimi (phishing).

## Mini vaka 2: Rate limiter servisi

### Gereksinimler
**Fonksiyonel**: istemci/anahtar başına kural (ör. 100 istek/dk, plan bazlı), aşımda `429` + `Retry-After`, kurallar çalışırken değiştirilebilsin. **Fonksiyonel olmayan**: isteğe eklenen gecikme < 2 ms, dağıtık gateway düğümleri arasında **tutarlı** sayım, limiter'ın kendisi düşünce API düşmesin (fail-open/closed kararı bilinçli olsun).

### Kapasite
Gateway'den 1 M istek/s geçiyorsa her istek bir sayaç işlemi → **1 M Redis op/s** (pipeline ve Lua ile tek gidiş-dönüş). 10 M aktif anahtar × ~100 B ≈ 1 GB bellek; anahtarlar TTL ile kendiliğinden temizlenir.

### Tasarım kararları
**Nerede?** API gateway'de middleware olarak (tüm servisler için tek yer) ya da sidecar olarak. **Hangi algoritma?** Modül A'da gördüğünüz beşinden üretimde en yaygın **sliding window counter**: iki tam sayı (önceki ve mevcut pencere sayacı) ile sabit pencerenin sınır patlamasını giderir, log tutmadığı için bellek sabittir. **Dağıtık senkron**: her düğümün kendi sayacı olursa N düğüm N katı limit verir; çözüm **paylaşımlı Redis** ve sayaç oku-hesapla-yaz adımlarını tek **Lua betiği** ile atomik yapmaktır (yarış koşulu yok). Çok bölgeli kurulumda bölge başına Redis + yaklaşık global limit kabul edilir. **Redis düşerse?** Gateway yerel yaklaşık sayaca düşer (limit/N) ve alarm verir: fail-open; ödeme gibi hassas uçlarda fail-closed tercih edilebilir.

:::code{lang="ts" title="Sliding window counter: Redis Lua ile atomik karar"}
```ts
// KEYS[1] = mevcut pencere anahtarı, KEYS[2] = önceki pencere anahtarı
// ARGV = limit, windowMs, elapsedInWindowMs, ttlMs
const SLIDING_WINDOW_LUA = `
  local cur  = tonumber(redis.call('GET', KEYS[1]) or '0')
  local prev = tonumber(redis.call('GET', KEYS[2]) or '0')
  local limit, win, elapsed = tonumber(ARGV[1]), tonumber(ARGV[2]), tonumber(ARGV[3])
  local weighted = prev * (1 - elapsed / win) + cur      -- önceki pencerenin kalan ağırlığı
  if weighted + 1 > limit then
    return { 0, math.floor(limit - weighted) }             -- reddet, kalan ≈ 0
  end
  redis.call('INCR', KEYS[1])
  redis.call('PEXPIRE', KEYS[1], tonumber(ARGV[4]))        -- anahtar kendi kendini temizler
  return { 1, math.floor(limit - weighted - 1) }           -- izin ver, kalan
`;

export async function allow(redis: Redis, apiKey: string, limit = 100, windowMs = 60_000) {
  const now = Date.now();
  const curWin = Math.floor(now / windowMs);
  const [ok, remaining] = (await redis.eval(
    SLIDING_WINDOW_LUA, 2,
    `rl:${apiKey}:${curWin}`, `rl:${apiKey}:${curWin - 1}`,
    limit, windowMs, now % windowMs, windowMs * 2,
  )) as [number, number];
  // 429 için Retry-After: pencerenin kalan süresi (kaba ama yeterli)
  const retryAfterSec = Math.ceil((windowMs - (now % windowMs)) / 1000);
  return { allowed: ok === 1, remaining: Math.max(0, remaining), retryAfterSec };
}
```
```python
SLIDING_WINDOW_LUA = """
local cur  = tonumber(redis.call('GET', KEYS[1]) or '0')
local prev = tonumber(redis.call('GET', KEYS[2]) or '0')
local limit, win, elapsed = tonumber(ARGV[1]), tonumber(ARGV[2]), tonumber(ARGV[3])
local weighted = prev * (1 - elapsed / win) + cur
if weighted + 1 > limit then return {0, math.floor(limit - weighted)} end
redis.call('INCR', KEYS[1]); redis.call('PEXPIRE', KEYS[1], tonumber(ARGV[4]))
return {1, math.floor(limit - weighted - 1)}
"""

def allow(redis, api_key, limit=100, window_ms=60_000):
    now = int(time.time() * 1000)
    cur_win = now // window_ms
    ok, remaining = redis.eval(SLIDING_WINDOW_LUA, 2,
                               f"rl:{api_key}:{cur_win}", f"rl:{api_key}:{cur_win - 1}",
                               limit, window_ms, now % window_ms, window_ms * 2)
    return ok == 1, max(0, remaining), -(-(window_ms - now % window_ms) // 1000)
```
:::

:::diagram{src="rate-limiter.svg" alt="Rate limiter mimarisi: birden fazla gateway düğümü paylaşımlı Redis'te Lua ile atomik sayaç günceller, kural servisi limitleri dağıtır, aşımda 429 döner, Redis düşerse yerel sayaca düşülür|Rate limiter architecture: multiple gateway nodes update atomic counters in shared Redis via Lua, a rules service distributes limits, 429 is returned on excess, local fallback counters when Redis is down"}
Sayaç gateway düğümünde değil Redis'te yaşar; böylece istemci hangi düğüme düşerse düşsün aynı limit uygulanır.
:::

:::animation{scene="rate-limiter.scene.json"}
Kural bulma → Lua ile atomik sayım → izin ve başlıklar → farklı düğümlere dağılan patlama aynı Redis anahtarında sayılır → 429 + Retry-After → pencere kayar → Redis düşünce fail-open.
:::

:::interactive{type="rate-limiter" algorithm="fixed-window" limit=10 windowMs=5000 rate=1}
Sabit pencere ile başlayın: zaman çizelgesindeki pencere çizgisinin hemen öncesinde ve hemen sonrasında "10 istek gönder"e basın — 5 saniyelik limitin iki katı, yani 20 istek geçti mi? Sliding window counter'a geçip aynı şeyi deneyin: önceki pencerenin ağırlıklı sayımı patlamayı yakalar. Sonra token bucket'a geçin (kapasite 10, dolum 1/sn): kısa patlamalara kapasite kadar izin verirken ortalamayı dolum hızında nasıl tuttuğunu karşılaştırın.
:::

## Mini vaka 3: Notification servisi

### Gereksinimler
**Fonksiyonel**: push, e-posta ve SMS kanallarında bildirim; kullanıcı tercihleri ve sessiz saatler; şablon + yerelleştirme; teslim durumu takibi. **Fonksiyonel olmayan**: hiçbir bildirim kaybolmasın ama **çift gönderim de olmasın**; işlemsel bildirim (OTP) < 5 s, pazarlama bildirimi dakikalar; sağlayıcı (APNs, SES, Twilio) kotalarına uyum; günde 1 Mia bildirim.

### Tasarım kararları
Omurga bir **boru hattıdır**: üreticiler (sipariş, ödeme, pazarlama) bir olay ya da `POST /notifications` ile isteği bırakır; servis önce **idempotency anahtarıyla** (`eventId + userId + channel`) tekilleştirir, sonra **tercih servisine** sorar (kanal açık mı, sessiz saat mi, günlük sınır aşıldı mı), **şablonu** kullanıcının diliyle render eder ve her kanal için ayrı kuyruğa yazar. Kanal başına işçi havuzları sağlayıcıya gönderir; her sağlayıcının önünde kendi **rate limiter**'ı vardır (Twilio 100 SMS/s gibi). Geçici hatada **üstel geri çekilme + jitter** ile yeniden dener; N denemeden sonra mesaj **DLQ**'ya düşer ve alarm üretir; sağlayıcı toparlanınca DLQ yeniden oynatılır. Her adım bir durum tablosuna yazılır (`QUEUED → SENT → DELIVERED/FAILED`), böylece "bildirimim nerede?" sorusu cevaplanabilir. Öncelik ayrımı için işlemsel ve pazarlama trafiği **ayrı kuyruklarda** akar; pazarlama patlaması OTP'yi geciktiremez.

:::diagram{src="notification.svg" alt="Notification servisi mimarisi: üreticiler, giriş kuyruğu, tekilleştirme, tercih ve şablon servisleri, kanal kuyrukları, işçi havuzları, sağlayıcı rate limiter'ları, retry ve DLQ, durum takibi|Notification service architecture: producers, ingest queue, deduplication, preference and template services, per-channel queues, worker pools, provider rate limiters, retry and DLQ, status tracking"}
İşlemsel ve pazarlama trafiği ayrı kuyruklarda akar; her sağlayıcının önünde kendi limiter'ı ve DLQ'su vardır.
:::

:::animation{scene="notification.scene.json"}
OrderConfirmed → tekilleştirme → tercih (push + e-posta, SMS kapalı) → şablon → kanal kuyrukları → push başarılı → e-posta sağlayıcısı 503 → backoff ile 3 deneme → DLQ → yeniden oynatma.
:::

**Darboğazlar**: pazarlama kampanyası 50 M bildirimi aynı anda bırakır → ayrı kuyruk + sağlayıcı limiter'ı ile düzleştir; sağlayıcı kesintisi → circuit breaker + DLQ; tercih servisi her istekte sorgulanır → kısa TTL'li cache; çift gönderim → idempotency tablosu (TTL 24 saat).

:::realworld{company="Stripe"}
Stripe'ın API'si üç mini vakanın hepsini bir arada yaşatır. **Idempotency-Key** başlığı ile aynı isteğin tekrar gönderilmesi aynı sonucu döndürür; anahtar ve yanıt 24 saat saklanır — notification servisindeki tekilleştirmenin aynısı. Rate limiting tarafında Stripe, mühendislik blogunda dört ayrı limiter kullandığını anlatır: istek hızı limiter'ı (token bucket, kullanıcı başına), eşzamanlı istek limiter'ı, kritik uç noktaları koruyan **load shedder** ve işçi kapasitesini ayıran öncelik limiter'ı; hepsi Redis üzerinde çalışır ve Redis'e ulaşılamazsa **fail-open** davranır — "limiter'ın kendisi kesinti nedeni olmamalı". Webhook teslimi ise bir notification servisidir: her olay **üstel geri çekilmeyle 3 güne kadar** yeniden denenir, başarısız teslimler panelde görünür ve elle yeniden oynatılabilir. Kısa, tahmin edilemez ve zamanla sıralı kimlikler için Stripe `ch_1N…` gibi ön ekli base62 id'ler kullanır — URL kısaltıcıdaki id üretimi tartışmasının birebir karşılığı.
:::

:::callout{tone="tip" title="Mülakat ipuçları"}
- Üç soru da "basit" görünür; mülakatçı **takasları** duymak ister: 301/302, sayaç/aralık/hash, fail-open/fail-closed, en az bir kez/tam olarak bir kez etkisi.
- Kapasiteyi bir dakikada bitirip asıl zamanı 5–7. adımlara ayırın; sayıların yönünü (ne büyük, ne küçük) söyleyebilmek yeter.
- URL kısaltıcıda **id üretimini** ve **yönlendirme yolunun cache'ten geçtiğini** mutlaka söyleyin; 7 karakter base62 hesabını ezbere bilin.
- Rate limiter'da "sayaç nerede yaşıyor?" sorusuna **paylaşımlı Redis + Lua atomikliği** ile cevap verin; "Redis düşerse?" sorusunu beklemeden siz açın.
- Notification'da **idempotency + ayrı öncelik kuyrukları + backoff + DLQ** dörtlüsünü tahtaya yazın; sağlayıcı kotasını unutmayın.
- Zaman kalırsa izleme: her mini sistemde hangi metriğe alarm koyardınız (yönlendirme p99, 429 oranı, DLQ derinliği)?
:::

:::quiz{src="quiz.json"}
:::

:::next{lesson="f-01-servers-datacenters-regions"}
Vaka modülü tamamlandı. Sırada Modül F: bu çizdiğimiz kutular fiziksel olarak nerede çalışıyor? Sunucu türleri, veri merkezi, region ve availability zone.
:::

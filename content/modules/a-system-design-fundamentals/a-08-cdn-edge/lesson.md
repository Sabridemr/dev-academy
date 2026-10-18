---
id: a-08-cdn-edge
slug: cdn-edge
module: a-system-design-fundamentals
order: 8
title:
  tr: "CDN ve Edge Computing"
  en: "CDN and Edge Computing"
summary:
  tr: Statik içerik dağıtımı, PoP'lar, cache miss/hit akışı, Cache-Control ve invalidation, anycast yönlendirme ve origin'e dokunmadan çalışan edge fonksiyonları.
  en: Static content delivery, PoPs, the cache miss/hit flow, Cache-Control and invalidation, anycast routing, and edge functions that run without touching the origin.
durationMinutes: 25
level: intermediate
tags: [cdn, edge, caching, networking, performance, latency]
prerequisites: [a-01-client-server-dns-http, a-07-caching]
concepts: [cdn, point-of-presence, edge-cache-hit-miss, origin-shield, cache-control-headers, cache-invalidation, anycast-routing, edge-functions, dynamic-content-cdn, cache-key]
---

## Kavram: içeriği kullanıcıya yaklaştırmak

İlk derste bir HTTPS isteğinin 3–4 RTT'ye mal olduğunu hesaplamıştık. İstanbul'daki kullanıcı ile Virginia'daki sunucu arasındaki RTT ~150 ms ise, daha ilk byte gelmeden yarım saniye geçer; bir sayfadaki 80 statik dosya için bu felakettir. Işık hızını değiştiremeyiz; **mesafeyi** değiştirebiliriz.

**CDN (Content Delivery Network)**, dünyanın yüzlerce noktasına yayılmış **PoP (Point of Presence)** adı verilen sunucu kümelerinden oluşur. Kullanıcı en yakın PoP'a bağlanır (RTT 5–20 ms); PoP içeriği cache'inde buluyorsa anında döner, bulamıyorsa **origin**'inize (asıl sunucunuz) gidip getirir ve bir sonraki kullanıcı için saklar. Sonuç:

- **Gecikme düşer**: TCP + TLS el sıkışmaları yakın PoP ile yapılır; içerik yakından gelir.
- **Origin yükü düşer**: 1 milyon kullanıcı aynı görseli isterse origin bunu bir kez (PoP başına bir kez) üretir.
- **Dayanıklılık artar**: DDoS trafiği PoP'larda emilir; origin çökse bile cache'lenmiş içerik servis edilebilir (stale-if-error).

:::diagram{src="diagram.svg" alt="Dünya üzerinde kullanıcılar, yakın PoP'lar, origin shield ve origin sunucusu; PoP'ta cache hit yeşil, miss kırmızı okla origin'e gidiyor; bir PoP'ta edge fonksiyonu çalışıyor|Users across the world, nearby PoPs, an origin shield and the origin server; a cache hit at the PoP in green, a miss going to origin in red; an edge function running at one PoP"}
Kullanıcı en yakın PoP'a gider; PoP ya cache'ten servis eder ya da origin'e (çoğu zaman bir ara "shield" üzerinden) gider.
:::

## Kullanıcı en yakın PoP'u nasıl bulur?

İki yaygın yöntem vardır:

1. **GeoDNS**: CDN'in DNS sunucusu, sorgunun geldiği resolver'ın konumuna göre farklı bir PoP IP'si döner. Basit ama resolver'ın konumu kullanıcıyı yanıltabilir (ör. kullanıcı Ankara'da, resolver Frankfurt'ta). EDNS Client Subnet bunu kısmen düzeltir.
2. **Anycast**: Tüm PoP'lar **aynı IP adresini** BGP ile duyurur; internetin yönlendirme tablosu paketi en yakın (en az hop) PoP'a götürür. Bir PoP düşerse BGP rotayı otomatik çeker; failover saniyeler içindedir. Cloudflare ve Google bunu kullanır.

## Cache hit, miss ve origin shield

Bir PoP'a `GET /img/hero.webp` geldiğinde:

- **HIT**: Dosya cache'te ve taze (TTL dolmamış) → anında döner. `X-Cache: HIT`, `Age: 3421`.
- **MISS**: Cache'te yok → PoP origin'e gider, yanıtı saklar ve döner. İlk kullanıcı bedeli öder.
- **STALE / REVALIDATE**: TTL dolmuş ama `stale-while-revalidate` izni var → kullanıcıya eski kopya anında verilir, arka planda origin'den yenisi çekilir.

Binlerce PoP'un her biri origin'e ayrı ayrı miss gönderirse, popüler bir dosyanın yayın anında origin'e aynı anda yüzlerce istek gelir ("thundering herd"). **Origin shield** (ya da tiered caching), PoP'lar ile origin arasına tek bir ara cache katmanı koyar: tüm PoP miss'leri önce shield'e gider; shield origin'e yalnızca bir kez sorar. Aynı anda gelen miss'ler tek isteğe birleştirilir (**request coalescing / collapsing**).

Aşağıdaki animasyon tam bu akışı gösterir: miss, shield, origin, hit ve origin'e hiç dokunmayan bir edge fonksiyonu.

:::animation{scene="scene.json"}
İlk kullanıcı miss yaşar; PoP shield üzerinden origin'e gider. İkinci kullanıcı aynı PoP'tan 8 ms'de hit alır. Üçüncü adımda bir edge fonksiyonu görseli yeniden boyutlandırır, dördüncüde purge ile cache temizlenir.
:::

## Cache'i yöneten başlıklar

CDN'e "neyi, ne kadar süre, kim için" sakladığını origin söyler — HTTP başlıklarıyla:

| Başlık | Anlamı | Örnek |
|---|---|---|
| `Cache-Control: public, max-age=31536000, immutable` | Herkese servis et, 1 yıl sakla, yeniden doğrulama | Hash'li dosyalar: `app.3f9a2c.js` |
| `Cache-Control: public, max-age=60, s-maxage=600` | Tarayıcı 1 dk, CDN (shared) 10 dk saklasın | Ürün listesi JSON'u |
| `Cache-Control: private, no-store` | CDN saklamasın | Kullanıcıya özel sepet, hesap sayfası |
| `stale-while-revalidate=300` | TTL dolunca 5 dk eski kopyayı ver, arkada yenile | Haber ana sayfası |
| `stale-if-error=86400` | Origin 5xx dönerse 1 gün eski kopyayı ver | Her şey (dayanıklılık) |
| `ETag` / `Last-Modified` | Koşullu istek: değişmediyse `304` | Büyük dosyalar |
| `Vary: Accept-Encoding, Accept-Language` | Bu başlıklara göre ayrı kopya tut | Sıkıştırma, dil |

**Cache key** varsayılan olarak URL'dir (host + path + query). `Vary` başlığı ve CDN kuralları anahtarı genişletir; `?utm_source=` gibi anlamsız parametreleri anahtardan çıkarmazsanız aynı dosyanın yüzlerce kopyası tutulur ve hit oranı çöker.

### Invalidation: iki felsefe

- **Sürümlü URL (cache busting)**: Dosya adına içerik hash'i koyun (`app.3f9a2c.js`), 1 yıl `immutable` verin. Yeni sürüm = yeni URL; eski cache hiç umursanmaz. Statik varlıklar için **altın standart**.
- **Purge (zorla silme)**: Sürüm değiştiremediğiniz URL'ler için (`/`, `/api/products`) CDN API'si ile anahtarı ya da bir **surrogate key / cache tag** ile ilgili tüm nesneleri silin: `purge tag:product-42`. Yayılması saniyeler sürer ama "yanlışlıkla her şeyi purge edip origin'i ezmek" gerçek bir kaza türüdür.

:::callout{tone="warning" title="Kişisel veriyi cache'lemek"}
`Set-Cookie` içeren ya da kullanıcıya özel bir yanıtı yanlışlıkla `public` işaretlemek, A kullanıcısının hesap sayfasını B'ye göstermek demektir; bu bir veri sızıntısıdır ve gerçekten yaşanmıştır. Kural: kimlik doğrulamalı yanıtlar varsayılan olarak `private, no-store`; CDN'de yalnızca açıkça güvenli olanı açın. Anahtar kısmında `Authorization` başlığını yok saymayın.
:::

## Dinamik içerik ve edge computing

CDN yalnızca statik dosya için değildir:

- **Dinamik hızlandırma**: Cache'lenemeyen API isteği bile PoP üzerinden geçerse kazanır: kullanıcı TCP/TLS'i yakın PoP ile kurar, PoP–origin arası bağlantı sıcak tutulur (keep-alive), rota optimize edilir. 150 ms'lik el sıkışmalar 10 ms'ye iner.
- **Edge functions** (Cloudflare Workers, Lambda@Edge, Fastly Compute, Vercel Edge): PoP'ta çalışan küçük fonksiyonlar. Tipik işler: A/B testi için istek yönlendirme, coğrafi engelleme, JWT doğrulama, görsel yeniden boyutlandırma, kişiselleştirilmiş HTML parçası enjekte etme, bot filtreleme. Soğuk başlangıç milisaniyelerdir çünkü V8 isolate'leri ya da WebAssembly kullanılır; süre ve bellek sınırlıdır (ör. 50 ms CPU), yerel disk yoktur.
- **Edge KV / Durable Objects / D1**: Edge'de küçük, eventually consistent veri depoları; feature flag, oturum parçası, sayaç için.

Edge'in sınırı: durum. Origin veritabanınız tek bölgedeyse, edge fonksiyonu her veri ihtiyacında yine o bölgeye gider ve kazanım erir. Edge'de **okuma ağırlıklı, nadiren değişen, kullanıcıya yakın olması değerli** işler kazanır.

:::interactive{type="cache" policy="lru" capacity=4 ttlSec=20}
Cache slotlarını bir edge PoP, alttaki veritabanını origin olarak düşünün. Aynı anahtarı (ör. A) art arda okuyun: ilk istek miss olup origin'e iner, sonrakiler hit ile edge'den döner. Slotun altındaki TTL çubuğunun tükenmesini bekleyip tekrar okuyun: süresi dolan kopya yeniden origin'e gider. TTL kaydırıcısını kısaltıp "Rastgele 10 okuma" ile hit oranının nasıl düştüğünü, kapasiteyi küçültünce LRU'nun hangi dosyayı tahliye ettiğini izleyin; "Sıfırla" bir purge gibi tüm cache'i boşaltır ve ardından gelen her okuma origin'e düşer.
:::

:::code{lang="ts" title="Origin tarafında doğru Cache-Control + edge fonksiyonunda A/B yönlendirme ve görsel boyutlandırma"}
```ts
/* ---------- Origin (Express/Fastify benzeri): başlıkları içerik türüne göre ver ---------- */
export function cacheHeadersFor(path: string, isAuthenticated: boolean): Record<string, string> {
  if (isAuthenticated) return { "Cache-Control": "private, no-store" };                 // kişisel yanıt asla CDN'de kalmaz
  if (/\.[0-9a-f]{8,}\.(js|css|woff2|png|webp)$/.test(path))                            // hash'li dosya: sürümlü URL
    return { "Cache-Control": "public, max-age=31536000, immutable" };
  if (path.startsWith("/api/products"))
    return { "Cache-Control": "public, max-age=30, s-maxage=600, stale-while-revalidate=300, stale-if-error=86400", "Surrogate-Key": "products" };
  return { "Cache-Control": "public, max-age=0, s-maxage=60, stale-while-revalidate=120", Vary: "Accept-Encoding" };
}

/* ---------- Edge function (Cloudflare Workers tarzı fetch handler) ---------- */
export default {
  async fetch(req: Request, env: { ORIGIN: string; KV: KVNamespace }): Promise<Response> {
    const url = new URL(req.url);

    // 1) Cache key normalizasyonu: izleme parametrelerini at (aksi hâlde hit oranı çöker)
    for (const p of [...url.searchParams.keys()]) if (p.startsWith("utm_")) url.searchParams.delete(p);

    // 2) A/B: çerez yoksa ata, origin'e varyant başlığı ile git (kullanıcı için yapışkan)
    const cookies = req.headers.get("cookie") ?? "";
    let variant = /ab=(a|b)/.exec(cookies)?.[1];
    const assignNow = !variant;
    if (!variant) variant = Math.random() < 0.5 ? "a" : "b";

    // 3) Görsel yeniden boyutlandırma: /img/hero.webp?w=400 → edge'de üret, origin'e dokunma
    if (url.pathname.startsWith("/img/") && url.searchParams.has("w")) {
      const width = Math.min(2000, Number(url.searchParams.get("w")));
      const cacheKey = new Request(url.toString(), req);                               // genişlik anahtarın parçası
      const cached = await caches.default.match(cacheKey);
      if (cached) return cached;                                                        // PoP cache HIT
      const original = await fetch(`${env.ORIGIN}${url.pathname}`, { cf: { cacheTtl: 86400 } } as RequestInit);
      const resized = await fetch(original.url, { cf: { image: { width, format: "webp" } } } as RequestInit);
      const res = new Response(resized.body, resized);
      res.headers.set("Cache-Control", "public, max-age=86400");
      await caches.default.put(cacheKey, res.clone());                                  // bir sonraki kullanıcı için sakla
      return res;
    }

    // 4) Diğer her şey: origin'e varyant başlığıyla git, çerezi gerekirse yaz
    const originRes = await fetch(new Request(url.toString(), { headers: { ...Object.fromEntries(req.headers), "x-ab-variant": variant } }));
    const res = new Response(originRes.body, originRes);
    if (assignNow) res.headers.append("Set-Cookie", `ab=${variant}; Path=/; Max-Age=2592000; SameSite=Lax`);
    return res;
  },
};
```
```python
# Origin tarafı (Flask örneği): aynı başlık kurallarını uygula
import re
from flask import Flask, request, make_response

app = Flask(__name__)
HASHED = re.compile(r"\.[0-9a-f]{8,}\.(js|css|woff2|png|webp)$")

@app.after_request
def set_cache_headers(resp):
    path = request.path
    if request.cookies.get("session"):                         # kimlik doğrulamalı → CDN saklamasın
        resp.headers["Cache-Control"] = "private, no-store"
    elif HASHED.search(path):                                  # sürümlü statik dosya
        resp.headers["Cache-Control"] = "public, max-age=31536000, immutable"
    elif path.startswith("/api/products"):
        resp.headers["Cache-Control"] = "public, max-age=30, s-maxage=600, stale-while-revalidate=300, stale-if-error=86400"
        resp.headers["Surrogate-Key"] = "products"             # purge tag:products ile toplu temizleme
    else:
        resp.headers["Cache-Control"] = "public, max-age=0, s-maxage=60, stale-while-revalidate=120"
        resp.headers["Vary"] = "Accept-Encoding"
    return resp
```
:::

:::realworld{company="Cloudflare"}
Cloudflare, 300'den fazla şehirde PoP işletir ve tüm PoP'lar aynı IP bloklarını **anycast** ile duyurur; bir şehirdeki PoP bakıma alındığında BGP duyurusu çekilir ve trafik saniyeler içinde komşu şehre akar. Popüler bir dosyanın yayınında origin'in ezilmemesi için **Tiered Cache** (origin shield) katmanı alt PoP miss'lerini birkaç üst PoP'ta toplar ve aynı nesneye gelen eş zamanlı istekleri tek bir origin çağrısına birleştirir. **Workers**, her PoP'ta V8 isolate'leri olarak çalışır; soğuk başlangıç ~5 ms'dir çünkü konteyner değil, aynı süreç içinde izole bir bağlam açılır. Cloudflare'in kendi blog yazılarında anlatılan yaygın bir kullanım, milyarlarca görsel isteğinin edge'de yeniden boyutlandırılıp WebP/AVIF'e çevrilmesidir — origin yalnızca orijinal dosyayı bir kez verir. Cache purge ise global olarak birkaç saniyede yayılır; "tag ile purge" sayesinde bir ürün güncellendiğinde yalnızca o ürünle etiketli sayfalar düşer, tüm site değil.
:::

:::callout{tone="tip" title="Mülakat ipuçları"}
- CDN'i yalnızca "statik dosyalar için" demeyin: dinamik hızlandırma, DDoS emilimi, edge fonksiyonları ve stale-if-error ile dayanıklılığı sayın.
- "Cache nasıl geçersiz olur?" sorusunun cevabı iki kelimedir: **sürümlü URL** (statik) ve **tag ile purge** (dinamik). TTL'i tek başına bir strateji olarak sunmayın.
- `max-age` ile `s-maxage` farkını, `Vary`'nin cache key'e etkisini ve `private` ile kişisel veri sızıntısı riskini bilin.
- Origin shield / request coalescing'i "thundering herd" problemine çözüm olarak adlandırın.
- Edge computing için sınırı dürüstçe söyleyin: durum merkezdeyse edge fonksiyonu yine merkeze gider.
:::

:::quiz{src="quiz.json"}
:::

:::next{lesson="a-09-message-queues-event-driven"}
Sırada: isteği hemen cevaplamak yerine kuyruğa atıp arkada işlemek — mesaj kuyrukları ve event-driven mimari.
:::

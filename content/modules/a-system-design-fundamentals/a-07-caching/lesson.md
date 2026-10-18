---
id: a-07-caching
slug: caching
module: a-system-design-fundamentals
order: 7
title:
  tr: "Caching: Katmanlar ve Stratejiler"
  en: "Caching: Layers and Strategies"
summary:
  tr: Browser → CDN → gateway → uygulama → DB; cache-aside, write-through, write-back, TTL, LRU/LFU.
  en: Browser → CDN → gateway → app → DB; cache-aside, write-through, write-back, TTL, LRU/LFU.
durationMinutes: 30
level: intermediate
tags: [cache, performance, latency, redis, cdn]
prerequisites: [a-02-latency-throughput-cap, a-06-api-gateway]
concepts: [cache-layers, cache-hit-ratio, cache-aside, read-through, write-through, write-back, ttl, lru, lfu, cache-invalidation, thundering-herd]
---

## Kavram: pahalı işin sonucunu yakında tutmak

Bir ürün sayfası için veritabanına gidip beş tabloyu birleştirmek 20 ms sürüyorsa ve aynı sayfa saniyede 5.000 kez isteniyorsa, aynı hesabı 5.000 kez yapıyoruz demektir. **Cache (önbellek)**, pahalı bir işlemin sonucunu daha hızlı ve daha yakın bir yerde saklayıp bir sonraki isteği oradan yanıtlama fikridir. İki ölçüt her şeyi belirler:

- **Hit ratio (isabet oranı)** = hit / (hit + miss). %90 isabet, DB yükünü 10 kat azaltır; %99 isabet 100 kat.
- **Staleness (bayatlık)**: cache'teki kopya kaynaktan ne kadar geride kalabilir? Cache tasarımı bu iki değer arasındaki pazarlıktır.

Cache yalnızca "Redis" değildir; bir istek kullanıcıdan veritabanına giderken birden fazla cache katmanından geçer ve her katman farklı bir şeyi saklar.

## Cache katmanları: istek DB'ye varmadan kaç kapıdan geçer?

| Katman | Ne saklar? | Tipik gecikme | Kontrol mekanizması |
|---|---|---|---|
| **Tarayıcı / istemci** | Statik dosyalar, API yanıtları | ~0 ms (disk/bellek) | `Cache-Control`, `ETag`, `max-age` |
| **CDN (edge)** | Görseller, JS/CSS, bazen tam HTML | 10–30 ms | TTL, `s-maxage`, purge API |
| **API Gateway / reverse proxy** | Yanıt gövdeleri (GET) | ~1 ms | URL + header anahtarı, kısa TTL |
| **Uygulama (in-process)** | Sık kullanılan nesneler, konfigürasyon | ~0.01 ms | LRU map, süreç başına ayrı |
| **Dağıtık cache (Redis/Memcached)** | Oturumlar, hesaplanmış sayfa parçaları, sorgu sonuçları | ~0.5–1 ms | TTL + eviction politikası |
| **Veritabanı** | Buffer pool, sorgu planı | 5–50 ms | Otomatik (InnoDB, shared_buffers) |

Her katmandaki miss bir sonrakine düşer. İyi tasarlanmış bir sistemde isteklerin büyük çoğunluğu ilk iki üç katmanda sönümlenir ve DB'ye yalnızca "gerçekten yeni" sorular ulaşır.

:::diagram{src="diagram.svg" alt="Tarayıcıdan veritabanına beş cache katmanı, her katmanın isabet oranı ve gecikmesi|Five cache layers from browser to database with hit ratio and latency for each"}
Her katman bir filtredir: miss olan istek bir alt katmana iner. DB'ye ulaşan trafik, katmanların isabet oranlarının çarpımı kadar azalır.
:::

## Okuma stratejileri: cache-aside ve read-through

**Cache-aside (lazy loading)** en yaygın desendir ve mantık uygulamadadır:

1. Uygulama önce cache'e bakar (`GET product:42`).
2. **Miss** ise veritabanından okur.
3. Sonucu cache'e yazar (`SET product:42 ... EX 300`) ve kullanıcıya döner.
4. Bir sonraki istek **hit** olur ve DB'ye hiç dokunmaz.

Aşağıdaki animasyon bu akışı ve bir güncelleme sonrası girdinin silinmesini (invalidation) gösterir.

:::animation{scene="scene.json"}
Cache-aside: miss → DB → cache'i doldur → hit; güncellemede önce DB, sonra cache girdisini sil.
:::

**Read-through**'ta aynı akış vardır ama DB'ye gitme işini cache kütüphanesi/sunucusu üstlenir (uygulama yalnızca cache ile konuşur). Davranış aynıdır, sorumluluk yer değiştirir. İkisinde de cache yalnızca *istenen* veriyle dolar; bu yüzden ilk istek her zaman yavaştır (cold start) ve bazı ekipler açılışta cache'i önceden doldurur (**warming**).

## Yazma stratejileri

Okuma kolay; asıl soru yazma anında cache ile DB'nin nasıl tutarlı kalacağıdır.

| Strateji | Yazma akışı | Tutarlılık | Gecikme | Risk | Tipik kullanım |
|---|---|---|---|---|---|
| **Write-through** | Cache ve DB aynı anda (senkron) yazılır | Güçlü — cache hiç bayat olmaz | Yazma yavaşlar (iki yazma) | Hiç okunmayacak veriyi de cache'e doldurur | Okuma ağırlıklı, bayatlığa tahammülsüz veriler (fiyat, stok) |
| **Write-back (write-behind)** | Önce yalnızca cache'e yazılır, DB'ye toplu/asenkron aktarılır | Zayıf — cache düşerse yazma kaybolur | Çok hızlı yazma | **Veri kaybı**; dirty girdilerin takibi gerekir | Sayaçlar, beğeniler, görüntülenme sayıları |
| **Write-around** | Yalnızca DB'ye yazılır, cache girdisi silinir ya da hiç dolmaz | Orta — ilk okuma miss olur | Normal | Yazdıktan hemen sonra okuma miss'tir | Bir kez yazılıp nadiren okunan veri (loglar, arşiv) |

Cache-aside ile birlikte en çok görülen yazma kalıbı **"DB'ye yaz, cache'i sil"**dir (write-around'un bir biçimi). Neden *güncellemek* yerine *silmek*? İki eşzamanlı güncelleme farklı sırayla DB'ye ve cache'e ulaşırsa cache'te eski değer kalabilir; silmek bu yarışı ortadan kaldırır, bir sonraki okuma doğru değeri DB'den alır.

## TTL ve geçersiz kılma (invalidation)

Her cache girdisinin bir **TTL** (time to live) değeri olmalıdır; TTL'siz cache zamanla çöplüğe döner. TTL seçimi basit bir soruya bağlıdır: *"Bu veri en fazla ne kadar bayat olabilir?"* Hava durumu için 10 dakika kabul edilebilir, sepet toplamı için 10 saniye bile çok olabilir.

TTL tek başına yetmez; iki yaklaşım birlikte kullanılır:

- **Zaman tabanlı (TTL)**: en kötü durumda bayatlık süresini sınırlar, güvenlik ağıdır.
- **Olay tabanlı (explicit invalidation)**: veri değiştiğinde ilgili anahtarlar silinir ya da bir "sürüm numarası" artırılır (`product:42:v7`). Dağıtık sistemlerde bu genellikle bir olay (event) yayınlanarak yapılır.

:::callout{tone="info" title="TTL'e rastgelelik ekleyin"}
Bir deploy sırasında 100.000 girdi aynı saniyede yazılırsa, hepsi 300 saniye sonra **aynı saniyede** dolar ve DB'ye ani bir dalga gider. TTL'e ±%10 jitter eklemek (270–330 s) bu "senkron son kullanma" dalgasını yayar.
:::

## Eviction: yer bitince kim çıkar?

Cache belleği sınırlıdır; dolunca bir girdinin çıkarılması (eviction) gerekir.

| Politika | Kural | İyi olduğu yer | Zayıf yanı |
|---|---|---|---|
| **LRU** (Least Recently Used) | En uzun süredir *erişilmeyen* çıkar | Genel amaçlı; zamansal yerellik yüksek yüklerde | Tek seferlik büyük tarama (scan) sıcak verileri süpürür |
| **LFU** (Least Frequently Used) | En az *sayıda* erişilen çıkar | Popülerlik dağılımı kararlıysa (ünlü ürünler) | Eskiden popüler olan girdiler uzun süre kalır; sayaç bakımı maliyetli |
| **FIFO** | En eski eklenen çıkar | Basit, öngörülebilir | Erişim örüntüsünü hiç dikkate almaz |
| **TTL tabanlı** | Süresi dolan çıkar | Bayatlık sınırı önemliyse | Dolu cache'te yer açmaz |

Redis'in varsayılanı `allkeys-lru` ile `volatile-ttl` arasında seçilir; üretimde çoğunlukla **yaklaşık LRU** (rastgele örnekleme ile) kullanılır çünkü tam LRU'nun bağlı listesi büyük anahtar sayılarında pahalıdır.

:::animation{scene="eviction.scene.json"}
Kapasitesi 3 olan LRU cache: A, B, C dolar; A'ya tekrar erişilince "en yeni" olur; D gelince en uzun süredir kullanılmayan B tahliye edilir.
:::

:::interactive{type="cache" policy="lru" capacity=4 writePolicy="cache-aside" ttlMs=0}
Anahtarları okuyun ve yazın; isabet oranını izleyin. Politikayı LFU'ya çevirip aynı erişim dizisini tekrarlayın: hangi anahtar tahliye ediliyor? Yazma politikasını write-back yapıp "flush" etmeden önce cache'i düşürürseniz ne kaybolur?
:::

## Üç klasik tuzak

**1. Thundering herd / cache stampede.** Çok popüler bir anahtarın TTL'i dolar; aynı anda 10.000 istek miss alır ve hepsi DB'ye aynı sorguyu gönderir. Çözümler: tek bir isteğin DB'ye gitmesine izin verip diğerlerini bekletmek (**single-flight / request coalescing**), bayat değeri sunarken arka planda yenilemek (**stale-while-revalidate**), TTL dolmadan olasılıksal yenileme (**early expiration**).

**2. Hot key.** Tek bir anahtar (ünlü bir kullanıcının profili) tüm trafiği tek bir Redis düğümüne yığar. Çözüm: anahtarı kopyalamak (`user:1:0..9` gibi *N* kopyadan rastgele birini okumak) ya da in-process cache ile ilk darbeyi uygulama içinde sönümlemek.

**3. Cache penetration.** Var olmayan anahtarlar (`product:-1`) hiçbir zaman cache'e girmez, her istek DB'ye düşer. Çözüm: "yok" sonucunu da kısa TTL ile cache'lemek (negative caching) ya da Bloom filtresi ile var olmayanı DB'ye sormadan reddetmek.

:::code{lang="ts" title="Cache-aside + TTL jitter + single-flight (stampede koruması)"}
```ts
import Redis from "ioredis";

const redis = new Redis();
const inFlight = new Map<string, Promise<string>>();   // süreç içi single-flight tablosu

/** TTL'e ±%10 rastgelelik ekler: aynı anda yazılan girdiler aynı anda dolmasın */
function jitter(ttlSec: number): number {
  return Math.round(ttlSec * (0.9 + Math.random() * 0.2));
}

export async function getOrLoad(
  key: string,
  ttlSec: number,
  loader: () => Promise<string>,       // miss durumunda DB'ye giden fonksiyon
): Promise<string> {
  const cached = await redis.get(key);
  if (cached !== null) return cached;  // HIT

  // Aynı anahtar için zaten DB'ye giden bir istek varsa ona katıl
  const pending = inFlight.get(key);
  if (pending) return pending;

  const promise = (async () => {
    try {
      const value = await loader();                       // yalnızca BİR istek DB'ye gider
      await redis.set(key, value, "EX", jitter(ttlSec));  // cache'i doldur
      return value;
    } finally {
      inFlight.delete(key);
    }
  })();
  inFlight.set(key, promise);
  return promise;
}

/** Yazma: önce DB, sonra cache girdisini sil (güncelleme değil!) */
export async function updateProduct(id: number, patch: object, db: { update: Function }) {
  await db.update("products", id, patch);
  await redis.del(`product:${id}`);
}
```
```python
import asyncio, random
import redis.asyncio as redis

r = redis.Redis()
in_flight: dict[str, asyncio.Future] = {}

def jitter(ttl_sec: int) -> int:
    return round(ttl_sec * (0.9 + random.random() * 0.2))

async def get_or_load(key: str, ttl_sec: int, loader):
    cached = await r.get(key)
    if cached is not None:
        return cached                      # HIT
    if key in in_flight:                   # başka bir istek zaten DB'de
        return await in_flight[key]
    fut = asyncio.get_event_loop().create_future()
    in_flight[key] = fut
    try:
        value = await loader()             # tek istek DB'ye gider
        await r.set(key, value, ex=jitter(ttl_sec))
        fut.set_result(value)
        return value
    finally:
        in_flight.pop(key, None)
```
:::

:::realworld{company="Meta"}
Facebook'un *Scaling Memcache at Facebook* makalesi cache-aside'ın dünyadaki en büyük uygulamasını anlatır: web sunucuları önce Memcached kümesine bakar, miss'te MySQL'e gider ve sonucu cache'e koyar; yazmalarda DB güncellenir ve cache anahtarı **silinir**. Stampede ve yarış koşullarına karşı **lease** mekanizması kullanılır: miss alan ilk istemciye kısa ömürlü bir "doldurma izni" verilir, aynı anahtar için gelen diğer istemciler kısa süre bekler ya da bayat değeri alır. Bölgeler arası tutarlılık için MySQL replikasyon akışına bağlı **mcsqueal** süreci, DB'de değişen satırların cache anahtarlarını uzak bölgelerde de geçersiz kılar. Sonuç: milyarlarca istek/saniye, isabet oranı %95'in üzerinde ve DB katmanı ancak bu sayede ayakta kalır.
:::

:::callout{tone="tip" title="Mülakat özeti"}
- "Cache eklerim" dediğinizde şu dört soruya hazır olun: **neyi** (anahtar + değer), **nerede** (hangi katman), **ne kadar süre** (TTL + invalidation), **dolunca ne olur** (eviction).
- Yazma için varsayılan cevap: *cache-aside + DB'ye yaz, cache'i sil*. Write-back'i yalnızca veri kaybının kabul edilebilir olduğu sayaçlar için önerin.
- Hit ratio'yu hesaplayın: %99 isabet, %90 isabetten 10 kat daha az DB yükü demektir; %1'lik fark küçük değildir.
- Stampede, hot key ve penetration'ı kendiliğinizden söylemek sizi ayırır.
:::

:::quiz{src="quiz.json"}
:::

:::next{lesson="a-08-cdn-edge"}
Sırada: cache katmanlarının en dıştakisi — CDN ve edge computing. Statik içerik dünyanın her yerine nasıl dağıtılır, PoP'lar nasıl çalışır, kod kenarda nasıl koşar?
:::

---
id: e-03-twitter-timeline
slug: twitter-timeline
module: e-case-studies
order: 3
title:
  tr: "Twitter/X: Timeline Fan-out, Cache, Trending"
  en: "Twitter/X: Timeline Fan-out, Cache, Trending"
summary:
  tr: Fan-out on write vs. read, ünlü problemi.
  en: Fan-out on write vs. read, the celebrity problem.
durationMinutes: 40
level: advanced
tags: [case-study, social-network, fan-out, cache, streaming, interview]
prerequisites: [a-07-caching, a-09-message-queues-event-driven, a-11-consistent-hashing-sharding, e-01-amazon-scale-ecommerce]
concepts: [fan-out-on-write, fan-out-on-read, hybrid-fan-out, celebrity-problem, timeline-cache, social-graph, trending-topics, count-min-sketch]
---

## Vaka: "Twitter'ı tasarla"

Twitter'ın (X) zorluğu veri miktarı değil, **bir yazmanın kaç okuyucuya dokunduğu**dur. Bir tweet 280 karakterdir; ama 100 milyon takipçisi olan biri yazdığında o 280 karakter 100 milyon ayrı timeline'da belirmelidir. E-ticarette "bir sipariş = bir kayıt"tı; burada "bir tweet = N timeline güncellemesi" ve N, sıfırdan yüz milyona kadar değişir. Bu dersin tamamı tek bir soruya cevaptır: **timeline'ı yazarken mi, okurken mi oluşturmalı?**

## 1. Gereksinimler

### Fonksiyonel
- Tweet at (metin + medya), sil
- Takip et / takibi bırak
- **Home timeline**: takip edilenlerin tweet'leri, yeniden eskiye (ya da sıralanmış)
- Beğeni, retweet, yanıt
- Trending konular (son 10–30 dakikanın en hızlı yükselen hashtag'leri)
- Arama

### Fonksiyonel olmayan

| Gereksinim | Hedef | Gerekçe |
|---|---|---|
| Timeline gecikmesi | p99 < 200 ms | Uygulama açılır açılmaz akış dolu olmalı |
| Tweet görünürlük gecikmesi | Takipçilerde < 5 s | Eventual consistency kabul; "anında" gerekmez |
| Erişilebilirlik | Okuma için %99.99 | Yazma birkaç saniye kuyrukta bekleyebilir |
| Okuma/yazma oranı | ~100:1 | 500 M tweet/gün'e karşılık 50 Mia timeline görüntüleme |
| Dayanıklılık | Tweet asla kaybolmaz | Kalıcı depo + replikasyon |

## 2. Kapasite tahmini

Varsayımlar: 250 M DAU; kullanıcı başına günde 50 timeline yüklemesi ve 2 yazma (tweet, beğeni, retweet); tweet kaydı ~300 B; bir timeline sayfası (20 tweet, hidrate edilmiş) ~20 KB; ortalama takipçi sayısı 200.

- **Tweet yazma** = 500 M / 86 400 ≈ **5.8 K tweet/s**; tepe ~15 K/s
- **Timeline okuma** = 250 M × 50 / 86 400 ≈ **145 K QPS**; tepe ~400 K QPS
- **Fan-out yazma yükü** = 5.8 K tweet/s × 200 takipçi = **1.2 M cache yazması/s** — tweet'in kendisinden 200 kat fazla
- **Ünlü etkisi**: 100 M takipçili tek bir tweet = 100 M yazma; 1 M yazma/s hızında bile **100 saniye** sürer
- **Depolama**: 500 M × 300 B = 150 GB/gün metin; medya bunun 50–100 katı (object storage + CDN)
- **Timeline cache**: 250 M aktif kullanıcı × 800 tweet id × 16 B ≈ **3.2 TB RAM** — pahalı ama mümkün (yüzlerce Redis düğümü)

Rakamlar iki şeyi söylüyor: okuma yolu cache'ten gelmek zorunda (145 K QPS'yi DB'den join ile karşılayamazsınız) ve fan-out yazması tweet yazmasından çok daha büyük bir sistem.

## 3. Yüksek seviye mimari

:::diagram{src="diagram.svg" alt="Twitter timeline mimarisi: tweet servisi, sosyal graf, Kafka, fan-out işçileri, Redis timeline cache'leri, timeline servisi ile ünlü birleştirme ve trending için akış işleme|Twitter timeline architecture: tweet service, social graph, Kafka, fan-out workers, Redis timeline caches, the timeline service with celebrity merge and stream processing for trending"}
Yazma yolu (üst) asenkron fan-out ile timeline cache'lerini doldurur; okuma yolu (alt) cache'ten id listesi alır, ünlü tweet'lerini okurken birleştirir ve gövdeleri hidrate eder.
:::

## 4. Bileşenlerin derinleştirilmesi

### Fan-out on write (push)
Tweet atıldığında bir işçi yazarın takipçi listesini alır ve tweet id'sini **her takipçinin timeline cache'ine** iter. Okuma anında timeline hazırdır: tek bir Redis `LRANGE` → 20 id → hidrate. Okuma ucuz, yazma pahalı. Problem: ünlüler. 100 M takipçiye push etmek dakikalar sürer, cache kümesini boğar ve kullanıcıların çoğu o tweet'i zaten hiç görmeyecektir (uyuyor, pasif).

### Fan-out on read (pull)
Hiçbir şey önceden hazırlanmaz. Kullanıcı timeline'ı açınca takip ettiği 500 kişinin son tweet'leri ayrı ayrı çekilir, birleştirilir, sıralanır. Yazma ucuz, okuma pahalı: 145 K QPS × 500 sorgu = 72 M sorgu/s. Olmaz.

### Hibrit: ünlü eşiği
Twitter'ın çözümü ikisini karıştırır:

| | Sıradan kullanıcı (< ~10 K takipçi) | Ünlü (> eşik) |
|---|---|---|
| Yazma | Takipçilerin cache'ine push | Yalnızca tweet deposuna yaz, push yok |
| Okuma | Cache'ten hazır listeyi al | Takip edilen ünlülerin son tweet'leri okurken çekilir ve listeye **birleştirilir** (merge) |
| Maliyet | Yazma ağır | Okuma biraz ağır (ama kullanıcı başına takip edilen ünlü sayısı küçüktür) |

Eşik sabit değildir; takipçi sayısı, yazma sıklığı ve sistem yüküne göre ayarlanır. Pasif kullanıcılar (30 gündür girmeyen) için timeline hiç materialize edilmez; dönünce fan-out on read ile yeniden kurulur. Bu tek kural cache boyutunu %40'tan fazla düşürür.

### Timeline cache
Kullanıcı başına bir Redis listesi: `timeline:{userId}` → `[(tweetId, authorId, ts), ...]`, en fazla ~800 girdi (`LPUSH` + `LTRIM`). Yalnızca id'ler tutulur; gövde ayrı bir **tweet cache**'inden `MGET` ile hidrate edilir — aynı tweet milyonlarca listede id olarak yer alır ama gövdesi bir kez saklanır. Redis kümesi `userId`'ye göre consistent hashing ile shard'lanır; her shard'ın replikası vardır çünkü cache kaybı = o kullanıcılar için pahalı yeniden kurma.

### Tweet deposu ve ID üretimi
Tweet'ler `tweet_id`'ye göre shard'lanmış bir depoda (Twitter'da Manhattan, önce MySQL) saklanır. ID'ler **Snowflake** biçimindedir: 41 bit zaman damgası + 10 bit makine + 12 bit sıra. Böylece id'ler zamana göre sıralıdır; timeline birleştirmesi (merge) id karşılaştırmasıyla yapılır, ayrı bir zaman alanına gerek kalmaz.

### Sosyal graf
`followers(userId)` ve `following(userId)` iki yönlü tutulur; fan-out işçisi birincisini, okurken birleştirme ikincisini kullanır. Takipçi listeleri Redis set'lerinde ya da graf-özel depoda (FlockDB) shard'lanır; büyük listeler sayfalanarak okunur.

### Trending: akış üzerinde sayım
Her tweet'in hashtag'leri Kafka'dan bir akış işleme işine (Flink/Storm/Heron) girer. Amaç son 10 dakikada **en çok yükselen** etiketleri bulmaktır. Milyonlarca farklı etiketi tam saymak RAM yer; bunun yerine **Count-Min Sketch** kullanılır: *d* adet hash fonksiyonu ve *d × w* boyutlu sayaç matrisi. Her etiket geldiğinde *d* sayaç artırılır; sorguda *d* sayacın **minimumu** alınır — asla eksik saymaz, nadiren fazla sayar; birkaç yüz KB ile milyonlarca etiketi takip eder. Üstüne bir **top-k heap** ve "geçen haftanın aynı saatine göre z-skoru" eklenir ki her zaman popüler olan etiketler (#futbol) değil, aniden yükselenler çıksın. Sonuç bölge bazında cache'lenir ve dakikada bir yenilenir.

:::code{lang="ts" title="Hibrit fan-out işçisi + okurken ünlü birleştirme"}
```ts
const CELEBRITY_THRESHOLD = 10_000;
const TIMELINE_CAP = 800;

/** Kafka'dan gelen TweetCreated olayını işler. */
export async function onTweetCreated(ev: { tweetId: string; authorId: string }, deps: Deps) {
  const followerCount = await deps.graph.followerCount(ev.authorId);
  if (followerCount > CELEBRITY_THRESHOLD) {
    // Ünlü: push yok. Takipçiler okurken çekecek.
    await deps.celebrityIndex.recordLatest(ev.authorId, ev.tweetId);
    return;
  }
  // Sıradan kullanıcı: takipçi listesini sayfa sayfa gez, aktif olanlara it
  for await (const page of deps.graph.followersPaged(ev.authorId, 1000)) {
    const active = await deps.activity.filterActive(page, { days: 30 });
    await deps.redis.pipeline(active.map((uid) => [
      ['LPUSH', `timeline:${uid}`, ev.tweetId],
      ['LTRIM', `timeline:${uid}`, 0, TIMELINE_CAP - 1],
    ]).flat()).exec();
  }
}

/** Home timeline okuma: cache listesi + ünlü tweet'leri birleştir + hidrate et. */
export async function homeTimeline(userId: string, deps: Deps, limit = 20) {
  const cached: string[] = await deps.redis.lrange(`timeline:${userId}`, 0, limit * 2);
  const celebs = await deps.graph.followedCelebrities(userId);            // genelde < 50 kişi
  const celebTweets = (await Promise.all(celebs.map((c) => deps.celebrityIndex.latest(c, 5)))).flat();
  // Snowflake id'ler zamana göre sıralı: büyük id = yeni tweet
  const ids = [...new Set([...cached, ...celebTweets])].sort((a, b) => (BigInt(b) > BigInt(a) ? 1 : -1)).slice(0, limit);
  return deps.tweetCache.mget(ids);                                        // gövdeleri tek seferde getir
}
```
```python
CELEBRITY_THRESHOLD = 10_000
TIMELINE_CAP = 800

async def on_tweet_created(ev, deps):
    if await deps.graph.follower_count(ev.author_id) > CELEBRITY_THRESHOLD:
        await deps.celebrity_index.record_latest(ev.author_id, ev.tweet_id)   # push yok
        return
    async for page in deps.graph.followers_paged(ev.author_id, 1000):
        active = await deps.activity.filter_active(page, days=30)
        pipe = deps.redis.pipeline()
        for uid in active:
            pipe.lpush(f"timeline:{uid}", ev.tweet_id)
            pipe.ltrim(f"timeline:{uid}", 0, TIMELINE_CAP - 1)
        await pipe.execute()

async def home_timeline(user_id, deps, limit=20):
    cached = await deps.redis.lrange(f"timeline:{user_id}", 0, limit * 2)
    celebs = await deps.graph.followed_celebrities(user_id)
    celeb_tweets = [t for c in celebs for t in await deps.celebrity_index.latest(c, 5)]
    ids = sorted(set(cached) | set(celeb_tweets), key=int, reverse=True)[:limit]
    return await deps.tweet_cache.mget(ids)
```
:::

## 5. Darboğazlar ve çözümler

| Darboğaz | Belirti | Çözüm |
|---|---|---|
| Ünlü tweet'i | Fan-out kuyruğu dakikalarca tıkanır | Hibrit: eşik üstü push yok, okurken birleştir |
| Fan-out dalgası (viral an) | Kafka lag artar, tweet görünürlüğü 5 s'yi aşar | İşçi sayısını otomatik ölçekle, takipçi listelerini sayfala, pasifleri atla |
| Sıcak tweet cache anahtarı | Tek Redis shard'ı doyar | Tweet cache'ini birden fazla kopyada tut (replicated hot keys), istemci tarafı cache |
| Timeline cache RAM maliyeti | TB'larca bellek | Yalnızca id tut, pasif kullanıcıya liste açma, 800 ile sınırla |
| Cache düğümü kaybı | Yüz binlerce kullanıcı için boş timeline | Replika + okurken yeniden kurma (fan-out on read fallback) |
| Trending'de tam sayım | Milyonlarca etiket için RAM | Count-Min Sketch + top-k + pencere bazlı z-skoru |
| Sıralama (ranking) gecikmesi | ML modeli p99'u bozar | Aday kümesini cache'ten al, sıralamayı zaman sınırlı yap, zaman aşımında kronolojik dön |

## 6. İstek yolculuğu: tweet'ten takipçinin ekranına

Aşağıdaki sahne iki isteği birbirine bağlar: yazarın "Tweetle" tıklaması (yazma yolu, asenkron fan-out) ve bir takipçinin birkaç saniye sonra uygulamayı açması (okuma yolu, cache + birleştirme + hidrasyon).

:::animation{scene="scene.json"}
Yazar → LB → gateway → tweet servisi → tweet DB → Kafka → fan-out işçisi → sosyal graf → Redis timeline'lar; takipçi → timeline servisi → cache + ünlü birleştirme → tweet cache → 200.
:::

:::interactive{type="fan-out" mode="hybrid" avgFollowers=150 celebrityFollowers=1500 celebrityThreshold=1000 celebrities=2}
Önce "Fan-out on write" stratejisini seçin, "Ünlü hesap" kutusunu işaretleyip "Gönderi paylaş"a basın: kaç timeline cache yazması oluştu, yayılma kaç saniye sürdü? "Fan-out on read" stratejisine geçip "Akışı oku"ya basın: okuma başına kaç sorgu gerekti? Son olarak "Hibrit" ile ünlü eşiğini değiştirin ve karşılaştırma tablosunda yazma çoğaltması ile okuma gecikmesinin dengelendiği noktayı bulun.
:::

:::realworld{company="Twitter"}
Twitter 2013'te mimarisini açıkça paylaştı: günde 400 M tweet (ortalama 4.6 K/s, tepe 12 K/s), home timeline için **300 K QPS** okuma ve fan-out işi için tüm tweet'lerin takipçi başına bir kopyasını tutan Redis kümelerinde kullanıcı başına **800 tweet id**. Bir tweet'in tüm takipçilere ulaşması ortalama ~5 saniye sürüyordu; Lady Gaga'nın o zamanki 31 M takipçisi bu süreyi dakikalara çıkardığı için ünlüler için push devre dışı bırakılıp okurken birleştirmeye geçildi. Tweet id'leri için **Snowflake** zaman sıralı 64-bit id üretir; arama için **Earlybird** ters indeksi, trending için **Heron** akış işleme kullanılır. Instagram da benzer bir hibrit uygular: ünlüler için push yerine pull ve feed'in ML ile sıralanması aday kümesi cache'ten geldikten sonra yapılır.
:::

:::callout{tone="tip" title="Mülakat ipuçları"}
- İlk tahtaya "okuma/yazma = 100:1, ortalama 200 takipçi, ünlü 100 M" yazın; tüm tartışma bu üç sayıdan çıkar.
- "Fan-out on write" dediğinizde mülakatçı ünlüyü soracak; cevabı önceden verin: **hibrit + eşik + okurken birleştirme**.
- Timeline cache'inde **gövde değil id** tutulduğunu ve hidrasyonun ayrı bir cache'ten `MGET` ile yapıldığını söyleyin; bu, "aynı tweet milyonlarca kez kopyalanmıyor mu?" sorusunun cevabıdır.
- Pasif kullanıcılara liste açmamak basit ama puan getiren bir optimizasyondur.
- Trending sorulursa "sayarım" demeyin: **pencere + Count-Min Sketch + top-k + baz çizgiye göre yükseliş**.
- ID üretimi sorulursa Snowflake: zaman sıralı olması birleştirmeyi ucuzlatır.
:::

:::quiz{src="quiz.json"}
:::

:::next{lesson="e-04-uber-geo-matching"}
Sırada: veri sürekli hareket ettiğinde — Uber'de sürücü konumları, coğrafi indeksleme ve eşleştirme.
:::

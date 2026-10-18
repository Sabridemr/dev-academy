---
id: e-04-uber-geo-matching
slug: uber-geo-matching
module: e-case-studies
order: 4
title:
  tr: "Uber: Coğrafi İndeksleme, Eşleştirme, Gerçek Zamanlı Konum"
  en: "Uber: Geo Indexing, Matching, Real-time Location"
summary:
  tr: Geohash/H3, sürücü eşleştirme, konum akışı.
  en: Geohash/H3, driver matching, location streams.
durationMinutes: 40
level: advanced
tags: [case-study, geospatial, real-time, websocket, matching, interview]
prerequisites: [a-01-client-server-dns-http, a-09-message-queues-event-driven, a-11-consistent-hashing-sharding, e-03-twitter-timeline]
concepts: [geohash, h3-hexagons, quadtree, location-ingestion, websocket-streams, driver-matching, surge-pricing, eta-routing]
---

## Vaka: "Uber'i tasarla"

Önceki vakalarda veri yerinde duruyordu; burada **veri hareket ediyor**. Milyonlarca sürücü birkaç saniyede bir konum gönderir ve bu konumlar saniyeler içinde eskir. Bir yolcu "çağır"a bastığında sistem şu soruya 1–2 saniyede cevap vermelidir: *şu anda, bu noktanın yakınında, boşta olan ve yolda en kısa sürede gelebilecek sürücü kim?* Üç alt problem vardır: konum akışını yutmak (ingestion), "yakın" sorgusunu hızlı cevaplamak (coğrafi indeks) ve arz-talebi dengeleyerek eşleştirmek (matching + fiyatlama).

## 1. Gereksinimler

### Fonksiyonel
- Sürücüler konumlarını sürekli bildirir; yolcu haritada yakındaki araçları görür
- Yolcu yolculuk ister; sistem uygun sürücüyü bulur ve teklif gönderir
- Sürücü kabul/ret eder; yolculuk boyunca canlı konum ve ETA
- Dinamik fiyatlama (surge): talep arzı aştığında çarpan
- Yolculuk geçmişi, ödeme, puanlama

### Fonksiyonel olmayan

| Gereksinim | Hedef | Gerekçe |
|---|---|---|
| Eşleştirme gecikmesi | İstekten teklife < 2 s, p99 < 5 s | Bekleyen yolcu rakibe geçer |
| Konum tazeliği | Sürücü konumu ≤ 4 s eski | Eski konum yanlış ETA ve kötü eşleşme demek |
| Erişilebilirlik | Eşleştirme için %99.99; konum akışı kayıp toleranslı | Bir konum paketi kaybolursa sonraki gelir |
| Tutarlılık | Bir sürücüye aynı anda tek teklif (güçlü); harita görünümü eventual | Çift atama operasyonel kaos |
| Ölçek | Şehir başına 100 K+ eşzamanlı sürücü; küresel milyonlar | Şehir bazlı bölümleme doğal |

## 2. Kapasite tahmini

Varsayımlar: zirvede 5 M aktif sürücü, her biri 4 saniyede bir ~100 baytlık konum paketi gönderir (günde ortalama 8 saat çevrimiçi ≈ 7 200 güncelleme); 25 M yolculuk/gün; yolcu uygulaması açıkken her 5 saniyede yakın araç sorgusu yapar (günde ~200 sorgu/kullanıcı, yanıt ~2 KB).

- **Konum yazma** = 5 M / 4 s = **1.25 M güncelleme/s** — hiçbir ilişkisel veritabanı bunu satır satır yazamaz; bellek içi indeks + akış gerekir
- **Konum verisi** = 1.25 M × 100 B = 125 MB/s; günde ~10 TB ham iz (zaman serisi deposuna sıkıştırılarak yazılır, canlı indekste yalnızca **son konum** tutulur)
- **Eşleştirme** = 25 M / 86 400 ≈ 290 istek/s, tepe ~1.5 K/s; her istek 20–50 aday için ETA hesabı → **~50 K routing hesabı/s**
- **Yakın araç sorgusu** ≈ 5 M sürücü için ~1 M sorgu/s tepe — ucuz olmak zorunda (hücre bazlı cache)
- **Bağlantı**: 5 M sürücü + milyonlarca yolcu = **~10 M eşzamanlı WebSocket**; sunucu başına ~100 K bağlantı → ~100 bağlantı sunucusu

Ders: darboğaz depolama değil, **bellek içi indeksin yazma hızı** ve **routing CPU'su**dur.

:::interactive{type="capacity-estimator" dau=5000000 readsPerUserPerDay=200 writesPerUserPerDay=7200 avgWriteSizeBytes=100 avgReadSizeBytes=2000 peakMultiplier=2 hotDataRatio=0.01 replicationFactor=2}
Yazma QPS'ye bakın: bu rakam bir OLTP veritabanının üst sınırının çok üzerindedir. Güncelleme aralığını 4 s'den 1 s'ye indirdiğinizde (writesPerUserPerDay = 28800) yazma yükünün ve ham veri hacminin nasıl dört katına çıktığını, ama canlı indeks boyutunun (yalnızca son konum) değişmediğini düşünün.
:::

## 3. Yüksek seviye mimari

:::diagram{src="diagram.svg" alt="Uber mimarisi: sürücü uygulamalarından WebSocket sunucularına konum akışı, Kafka, H3 hücre bazlı bellek içi geo indeks, eşleştirme servisi, ETA/routing, surge fiyatlama, trip veritabanı ve yolcu uygulaması|Uber architecture: location stream from driver apps to WebSocket servers, Kafka, an in-memory H3-cell geo index, the matching service, ETA/routing, surge pricing, the trip database and the rider app"}
Sol taraf sürekli akan konum verisini yutar; sağ taraf yolcu isteğini hücre sorgusu, ETA sıralaması ve WebSocket teklifiyle eşleştirmeye çevirir.
:::

## 4. Bileşenlerin derinleştirilmesi

### Coğrafi indeksleme: "yakın" sorusunu ucuzlatmak
İki boyutlu koordinatlarda "2 km yarıçapındaki sürücüler" sorgusu, B-tree ile çözülemez (tek boyutlu sıralama). Üç klasik yaklaşım:

| Yöntem | Fikir | Artı | Eksi |
|---|---|---|---|
| **Geohash** | Dünyayı özyinelemeli olarak 32 kareye böl; her hücre bir base32 dizesi (`sxk9p3`) | Ön ek = kapsayan hücre; string anahtarla Redis'te tutulabilir | Hücre sınırında komşular farklı ön ek alır; kareler kutuplara doğru bozulur |
| **Quadtree** | Yoğunluğa göre dörde bölünen ağaç; yoğun şehirde küçük, çölde büyük hücre | Uyarlanabilir çözünürlük | Ağacı güncel tutmak (sürücü hareket edince yaprak değiştirir) ve dağıtmak zor |
| **H3 (Uber)** | Altıgen hiyerarşik ızgara, 16 çözünürlük; her hücrenin 64-bit id'si | Tüm komşular eşit uzaklıkta (altıgen), `kRing(cell, k)` ile halka sorgusu basit, yoğunluk/surge hesabı için doğal birim | Hiyerarşi tam iç içe değil (yaklaşık) |

Uber bu yüzden H3'ü geliştirdi: altıgenlerde her komşuya olan mesafe aynıdır, karelerde köşegen komşu %41 daha uzaktadır; bu eşleştirme ve fiyatlama bölgelerinde adaleti artırır. Canlı indeks basit bir yapıdır: `cell:{h3Id} → Set<driverId>` ve `driver:{id} → {lat, lng, h3, status, ts}`; her ikisi bellek içi (Redis Cluster ya da Uber'de özel Ringpop/Go servisleri) ve şehre göre bölümlenmiş.

### Konum akışı: WebSocket + Kafka
Sürücü uygulaması kalıcı bir WebSocket üzerinden 4 saniyede bir konum yollar (HTTP başlığı ve TLS el sıkışması maliyetinden kaçınmak için). Bağlantı sunucusu paketleri 100 ms'lik mikro-partiler hâlinde Kafka'ya yazar (`location-updates`, anahtar: `driverId` → aynı sürücünün sırası korunur). Tüketiciler indeksi günceller: sürücü hücre değiştirdiyse eski set'ten çıkar, yeniye girer; `ts` alanı 15 s'den eskiyse sürücü "görünmez" sayılır (TTL ile çürüme). Aynı akış zaman serisi deposuna (yolculuk izi, analitik, sahtecilik) ve yolcunun canlı harita görünümüne beslenir.

### Eşleştirme servisi
Yolcu isteği gelince: (1) alış noktasının H3 hücresi ve `kRing(cell, 2)` ile 19 hücre; (2) bu hücrelerdeki boşta sürücüler (aday küme, 20–50); (3) her aday için **yol ağı ETA'sı** (kuş uçuşu değil — nehrin öbür yakası 300 m ama 15 dakikadır); (4) sıralama: ETA + sürücü kabul oranı + araç tipi; (5) en iyi sürücüye **teklif**, 15 s zamanlayıcı; ret/timeout → sıradaki. Çift atamayı önlemek için sürücü durumu `IDLE → OFFERED → BUSY` geçişi **atomik compare-and-set** ile yapılır (Redis `WATCH/MULTI` ya da Lua). Uber ileri sürümlerinde tek tek değil, **toplu eşleştirme** yapar: 2 saniyelik penceredeki tüm istek ve sürücüleri alıp toplam bekleme süresini minimize eden atamayı (bipartite matching) çözer.

### Surge fiyatlama
Her H3 hücresi (çözünürlük 8–9) için son birkaç dakikanın **talep** (istekler + uygulama açanlar) ve **arz** (boşta sürücü) sayıları akış işlemeyle hesaplanır. Oran eşiği aşınca çarpan (1.2×, 1.8×) devreye girer; komşu hücrelerle yumuşatılır ki bir sokak ötede fiyat ikiye katlanmasın. Çarpan fiyat teklifine (quote) gömülür ve teklif birkaç dakika sabitlenir — yolcu "çağır"a bastığında fiyat değişmez.

### ETA / Routing
Yol ağı bir graf olarak bellekte tutulur (OpenStreetMap + Uber'in kendi izleri); contraction hierarchies gibi ön hesaplamalı algoritmalarla kıtasal sorgu milisaniyededir. Canlı trafik, geçen yolculukların hız verisinden kenar ağırlıklarına yansıtılır. ETA tahmininin son katmanı ML'dir: graf ETA'sına hava, saat ve sürücü davranışı eklenir.

:::code{lang="ts" title="Geohash kodlama + hücre halkası ile yakın sürücü araması (Redis)"}
```ts
const BASE32 = '0123456789bcdefghjkmnpqrstuvwxyz';

/** Enlem/boylamı `precision` karakterlik geohash'e çevirir (6 karakter ≈ 1.2 km × 0.6 km). */
export function geohashEncode(lat: number, lng: number, precision = 6): string {
  let minLat = -90, maxLat = 90, minLng = -180, maxLng = 180;
  let hash = '', bits = 0, ch = 0, even = true;
  while (hash.length < precision) {
    if (even) {                                   // çift bit: boylam
      const mid = (minLng + maxLng) / 2;
      if (lng >= mid) { ch = (ch << 1) | 1; minLng = mid; } else { ch <<= 1; maxLng = mid; }
    } else {                                      // tek bit: enlem
      const mid = (minLat + maxLat) / 2;
      if (lat >= mid) { ch = (ch << 1) | 1; minLat = mid; } else { ch <<= 1; maxLat = mid; }
    }
    even = !even;
    if (++bits === 5) { hash += BASE32[ch]; bits = 0; ch = 0; }   // her 5 bit bir karakter
  }
  return hash;
}

/**
 * Konum güncellemesi: sürücü hücre değiştirdiyse eski set'ten çıkar, yeniye gir.
 * Kümeler TTL ile çürür; 15 s güncelleme gelmeyen sürücü görünmez olur.
 */
export async function updateDriverLocation(redis: Redis, driverId: string, lat: number, lng: number) {
  const cell = geohashEncode(lat, lng, 6);
  const prev = await redis.hget(`driver:${driverId}`, 'cell');
  const tx = redis.multi();
  if (prev && prev !== cell) tx.srem(`cell:${prev}`, driverId);
  tx.sadd(`cell:${cell}`, driverId).expire(`cell:${cell}`, 30);
  tx.hset(`driver:${driverId}`, { lat, lng, cell, ts: Date.now() }).expire(`driver:${driverId}`, 15);
  await tx.exec();
}

/** Alış noktasının hücresi + 8 komşu hücredeki boşta sürücüler (sınır problemi için komşular şart). */
export async function nearbyIdleDrivers(redis: Redis, lat: number, lng: number): Promise<string[]> {
  const cells = [geohashEncode(lat, lng, 6), ...geohashNeighbors(geohashEncode(lat, lng, 6))];
  const ids = await redis.sunion(...cells.map((c) => `cell:${c}`));
  const rows = await Promise.all(ids.map((id) => redis.hgetall(`driver:${id}`)));
  return ids.filter((_, i) => rows[i].status === 'IDLE' && Date.now() - Number(rows[i].ts) < 15_000);
}
```
```python
BASE32 = "0123456789bcdefghjkmnpqrstuvwxyz"

def geohash_encode(lat, lng, precision=6):
    min_lat, max_lat, min_lng, max_lng = -90.0, 90.0, -180.0, 180.0
    out, bits, ch, even = "", 0, 0, True
    while len(out) < precision:
        if even:                                  # boylam biti
            mid = (min_lng + max_lng) / 2
            if lng >= mid: ch, min_lng = (ch << 1) | 1, mid
            else:          ch, max_lng = ch << 1, mid
        else:                                     # enlem biti
            mid = (min_lat + max_lat) / 2
            if lat >= mid: ch, min_lat = (ch << 1) | 1, mid
            else:          ch, max_lat = ch << 1, mid
        even = not even
        bits += 1
        if bits == 5:
            out += BASE32[ch]; bits, ch = 0, 0
    return out

def nearby_idle_drivers(redis, lat, lng):
    center = geohash_encode(lat, lng, 6)
    cells = [center, *geohash_neighbors(center)]          # sınır problemi: komşular şart
    ids = redis.sunion(*[f"cell:{c}" for c in cells])
    rows = [redis.hgetall(f"driver:{i}") for i in ids]
    now = time.time() * 1000
    return [i for i, r in zip(ids, rows) if r.get("status") == "IDLE" and now - float(r["ts"]) < 15_000]
```
:::

## 5. Darboğazlar ve çözümler

| Darboğaz | Belirti | Çözüm |
|---|---|---|
| Konum yazma hızı | 1.25 M güncelleme/s | Bellek içi indeks, Kafka ile mikro-parti, şehir bazlı bölümleme, yalnızca son konumu tut |
| Hücre sınırı | Yolcunun 100 m ötesindeki sürücü komşu hücrede kalır | Her zaman merkez + komşu hücreler (`kRing`), gerekirse halkayı genişlet |
| Sıcak hücre (stadyum çıkışı) | Tek hücrede 5 K sürücü/yolcu | Daha ince çözünürlüğe in (H3 res 9 → 10), toplu eşleştirme, aday kümesini kes |
| Çift atama | İki yolcuya aynı sürücü | Sürücü durumunda atomik CAS, tek teklif kuralı, zamanlayıcıyla geri alma |
| ETA CPU'su | Aday başına routing çağrısı | Önce kuş uçuşu ile 50'ye kırp, sonra routing; sonuçları hücre çiftleri için kısa süre cache'le |
| Bağlantı sunucusu kaybı | 100 K sürücü aynı anda yeniden bağlanır | Jitter'lı yeniden bağlanma, bağlantı durumu dışarıda (sunucu durumsuz), consistent hashing ile dağıtım |
| Surge dalgalanması | Fiyat her saniye zıplar | Pencere yumuşatma, komşu hücre ortalaması, teklif fiyatını birkaç dakika kilitle |

## 6. İstek yolculuğu: "Çağır" tıklaması

:::animation{scene="scene.json"}
Arka planda konum akışı (WebSocket → Kafka → geo indeks); yolcu isteği → gateway → eşleştirme → surge → H3 halka sorgusu → ETA sıralaması → WebSocket ile sürücüye teklif → kabul → trip DB → yolcuya yanıt.
:::

:::interactive{type="geo-index" index="h3" resolution=8 drivers=300 ringSize=1 showBoundaryProblem=true}
Önce geohash'i seçip yolcuyu bir hücre sınırına yakın koyun: en yakın sürücü aday listesine giriyor mu? Komşu hücreleri açın. Sonra H3'e geçin ve halka boyutunu (k) artırarak aday sayısı ile sorgu maliyetinin nasıl değiştiğini izleyin; quadtree'de yoğun bölgenin nasıl daha küçük hücrelere bölündüğüne bakın.
:::

:::realworld{company="Uber"}
Uber 2018'de açık kaynak yaptığı **H3** altıgen ızgarasını hem eşleştirme hem surge fiyatlama hem de analitik için ortak birim olarak kullanır; altıgenin tüm komşularına eşit uzaklık, "yakın" hesaplarını ve bölge birleştirmeyi basitleştirir. Konum akışı için sürücü uygulamaları kalıcı bağlantı üzerinden 4 saniyede bir güncelleme yollar; bu akış Kafka üzerinden hem canlı indekse hem de yolculuk izi deposuna gider. Eşleştirme (DISCO) tarafında Uber, istek geldikçe teker teker atamak yerine birkaç saniyelik pencerelerde **toplu eşleştirme** yaparak şehir genelinde toplam bekleme süresini düşürdüğünü paylaştı. Coğrafi sorgu servisi Go ile yazıldı ve **Ringpop** (consistent hashing + gossip) ile düğümler arasında şehir/hücre sahipliği dağıtıldı; böylece hiçbir merkezi veritabanı konum yazma yoluna girmez. Routing için Uber ve benzeri şirketler (Google Maps, Lyft) contraction hierarchies tabanlı motorlar ile milisaniyelik kıtasal sorgular yapar; canlı trafik geçmiş yolculuk hızlarından kenar ağırlığı olarak eklenir.
:::

:::callout{tone="tip" title="Mülakat ipuçları"}
- Açılışı "veri hareket ediyor, konum saniyeler içinde eskiyor" diye yapın; bu, neden bellek içi indeks ve TTL kullandığınızı açıklar.
- Coğrafi indeks sorulduğunda üçünü sayın (geohash, quadtree, H3) ve **hücre sınırı problemini** kendiniz gündeme getirin — komşu hücre sorgusu şart.
- "En yakın" = yol ETA'sı, kuş uçuşu değil; önce ucuz filtre (hücre), sonra pahalı sıralama (routing).
- Çift atama sorusuna atomik durum geçişi (CAS) ve tek teklif + zamanlayıcı ile cevap verin.
- Bağlantı katmanını (WebSocket sunucuları) ayrı bir ölçekleme birimi olarak çizin; sunucuları durumsuz tutup bağlantı durumunu dışarıda saklayın.
- Surge için "arz/talep oranı per hücre, yumuşatma, teklif fiyatı kilitleme" üçlüsü yeterlidir.
:::

:::quiz{src="quiz.json"}
:::

:::next{lesson="e-05-whatsapp-messaging"}
Sırada: milyonlarca kalıcı bağlantı üzerinden mesaj teslimi, teslim durumları, presence ve uçtan uca şifreleme — WhatsApp vakası.
:::

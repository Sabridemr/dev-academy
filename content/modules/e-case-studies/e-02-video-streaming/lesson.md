---
id: e-02-video-streaming
slug: video-streaming
module: e-case-studies
order: 2
title:
  tr: "Netflix/YouTube: Video Depolama, Transcoding, CDN, Adaptive Bitrate"
  en: "Netflix/YouTube: Video Storage, Transcoding, CDN, Adaptive Bitrate"
summary:
  tr: Upload’dan oynatmaya video boru hattı.
  en: The video pipeline from upload to playback.
durationMinutes: 40
level: advanced
tags: [case-study, video, cdn, transcoding, streaming, interview]
prerequisites: [a-07-caching, a-08-cdn-edge, a-09-message-queues-event-driven, e-01-amazon-scale-ecommerce]
concepts: [video-upload, transcoding-pipeline, bitrate-ladder, video-storage, cdn-prepositioning, adaptive-bitrate, hls-dash-manifest, playback-journey]
---

## Vaka: "YouTube'u / Netflix'i tasarla"

Video sistemleri sistem tasarımının en **asimetrik** vakasıdır: yazma yolu (upload) nadir ama çok ağır, okuma yolu (izleme) çok sık ve bant genişliği canavarıdır. E-ticarette darboğaz veritabanı tutarlılığıydı; burada darboğaz **byte taşımak**tır. Bu yüzden mimarinin ağırlık merkezi veritabanından CDN'e kayar ve "istek" kavramının yerini "segment" alır.

İki ürün aynı iskeleti paylaşsa da farkları bilin: YouTube kullanıcı üretimi içerikle (dakikada 500+ saat upload) ingest tarafında, Netflix ise sınırlı katalog ama devasa eşzamanlı izleyiciyle dağıtım tarafında zorlanır.

## 1. Gereksinimler

### Fonksiyonel
- Video yükleme (büyük dosya, kesilen bağlantıdan devam)
- Farklı cihaz ve bağlantı hızlarında takılmadan oynatma
- Oynatma sırasında kaliteyi otomatik ayarlama (adaptive bitrate)
- Arama, küçük resim, izleme geçmişi, "kaldığın yerden devam"
- (Netflix) DRM; (YouTube) yorum, beğeni, abonelik

### Fonksiyonel olmayan

| Gereksinim | Hedef | Gerekçe |
|---|---|---|
| Başlatma gecikmesi | İlk kare < 2 s | Her saniye bekleme izleyici kaybettirir |
| Rebuffer oranı | < %0.5 izleme süresi | Takılma, kaliteden daha çok şikâyet yaratır |
| Erişilebilirlik | Oynatma için %99.99 | Upload ve işleme birkaç dakika gecikebilir |
| Tutarlılık | Yüksek tolerans: yeni video dakikalar sonra görünebilir | İçerik değişmez (immutable); versiyonlama yeterli |
| Dayanıklılık | Orijinal dosya asla kaybolmaz | Tekrar üretilemez |
| Maliyet | Egress maliyeti belirleyici | 1 TB/s'lik trafikte %1 cache isabeti bile milyonlarca dolardır |

## 2. Kapasite tahmini

Varsayımlar: 200 M DAU, kullanıcı başına günde 5 video izleme ve ortalama izleme başına 100 MB indirme (10 dk × ~1.3 Mbps ortalama), her 100 kullanıcıdan biri günde 1 video yükler (ortalama ham dosya 500 MB).

- **İzleme QPS** = 200 M × 5 / 86 400 ≈ **11.6 K oynatma başlangıcı/s**; ama her oynatma 4–6 saniyede bir segment ister → ~**1 M segment isteği/s**
- **Egress** = 11.6 K × 100 MB ≈ **1.2 TB/s** — hiçbir origin bunu kaldıramaz; %95+ CDN'den çıkmalı
- **Upload** = 2 M video/gün ≈ 23 upload/s; ham veri 1 PB/gün
- **Transcoding çıktısı**: her video 6–8 çözünürlük × 2–3 codec → ham boyutun ~1.5–2 katı; 5 yılda **~3 EB** depolama (sıcak/soğuk katmanlama şart)
- **İşlem gücü**: 1 saatlik 1080p videonun tüm merdiveni ≈ 2–4 CPU-saat; günde 2 M video × ortalama 8 dk ≈ **~1 M CPU-saat/gün** → binlerce işçi, paralel segment transcoding

:::interactive{type="capacity-estimator" dau=200000000 readsPerUserPerDay=5 writesPerUserPerDay=0.01 avgWriteSizeBytes=500000000 avgReadSizeBytes=100000000 peakMultiplier=3 hotDataRatio=0.05 replicationFactor=3}
Egress sayısına bakın ve bunu tek bir veri merkezinin 100 Gbps'lik bağlantısıyla karşılaştırın (12.5 GB/s). Sıcak veri oranını %5'ten %20'ye çıkarın: CDN cache boyutu nasıl değişiyor? Bu sayı Netflix'in neden her ISP'ye kendi cihazını koyduğunu açıklar.
:::

## 3. Yüksek seviye mimari

:::diagram{src="diagram.svg" alt="Video boru hattı: yükleyici, presigned URL ile object storage, transcoding kuyruğu ve ffmpeg işçileri, bitrate merdiveni, CDN hiyerarşisi ve adaptive bitrate istemci|Video pipeline: uploader, object storage via presigned URL, transcoding queue and ffmpeg workers, bitrate ladder, CDN hierarchy and an adaptive bitrate client"}
Soldaki ingest yolu dakikalar sürebilir ve asenkrondur; sağdaki oynatma yolu milisaniyelerle ölçülür ve neredeyse tamamen CDN'den beslenir.
:::

Mimari iki bağımsız boru hattından oluşur. **Ingest**: istemci → object storage (doğrudan, presigned URL) → kuyruk → transcoding işçileri → çıktı deposu → CDN'e ön yükleme. **Oynatma**: istemci → playback API (metadata, manifest URL, DRM lisansı) → CDN edge'den manifest ve segmentler. İki yolu birbirine bağlayan tek şey metadata veritabanındaki "bu video hazır" bayrağıdır.

## 4. Bileşenlerin derinleştirilmesi

### Upload: tarayıcıdan doğrudan depoya
Büyük dosyayı uygulama sunucusundan geçirmek israftır. İstemci, upload servisinden **presigned URL** alır ve dosyayı 5–10 MB'lık parçalar hâlinde doğrudan object storage'a (S3/GCS) yükler (multipart upload). Her parça bağımsız yeniden denenebilir; bağlantı kopunca kaldığı parçadan devam eder (resumable). Son parça gelince depo bir olay yayınlar: `VideoUploaded{videoId, rawPath}`.

### Transcoding: kuyruk + ffmpeg işçileri
Ham dosya farklı cihazlar için **bitrate merdivenine** (ladder) dönüştürülür: 240p/400 kbps'den 4K/16 Mbps'e 6–8 kademe, her biri H.264 ve AV1/HEVC gibi 2–3 codec'te. İş `transcode-jobs` kuyruğuna düşer; işçiler videoyu **önce 2–4 saniyelik segmentlere böler**, her segment ayrı bir işçide paralel kodlanır, sonra birleştirilir. Böylece 2 saatlik film 2 saat değil birkaç dakikada hazır olur. Her çıktı segmenti ve HLS/DASH manifest'i çıktı deposuna yazılır; iş tamamlanınca metadata DB'de `status = READY` olur. Hata alan iş yeniden denenir, üç denemeden sonra DLQ'ya düşer.

### Depolama: sıcak ve soğuk
Ham dosya ucuz soğuk katmanda (Glacier benzeri) saklanır — yalnızca yeniden kodlama gerekirse okunur. Kodlanmış segmentler sıcak object storage'dadır. İçerik **immutable** olduğundan cache-busting için `videoId/v2/720p/seg_0042.ts` gibi versiyonlu yollar yeterlidir; TTL sorunu yoktur.

### CDN: üç katmanlı hiyerarşi
Segment istekleri önce **edge** PoP'una gider. Edge'de yoksa **origin shield** (bölgesel ara katman) sorulur; o da yoksa object storage'a gidilir. Shield katmanı, bin edge'in aynı anda origin'e saldırmasını (thundering herd) engeller. Netflix bu yapıyı bir adım öteye taşır: **prepositioning** — gece saatlerinde ertesi gün popüler olacağı tahmin edilen içerik ISP içindeki cihazlara önceden kopyalanır; izleyici tıkladığında içerik zaten birkaç km ötededir.

### Manifest ve adaptive bitrate (ABR) istemci
Oynatıcı önce **master manifest**'i (HLS `.m3u8` / DASH `.mpd`) indirir: hangi çözünürlükler ve codec'ler var, her kademenin segment listesi nerede. Sonra her 2–4 saniyede bir segment ister ve her segment için kaliteyi yeniden seçer. İki sinyal kullanılır: **ölçülen indirme hızı** (throughput) ve **tampondaki saniye** (buffer). Tampon doluysa daha yüksek kaliteyi dener, tampon azalıyorsa hemen düşer. Karar tamamen istemcidedir; sunucu "aptal" kalır ve sonsuz ölçeklenir.

:::code{lang="ts" title="Hibrit ABR: throughput + buffer tabanlı kalite seçimi"}
```ts
interface Rendition { height: number; bitrateKbps: number }

const LADDER: Rendition[] = [
  { height: 240, bitrateKbps: 400 }, { height: 360, bitrateKbps: 800 }, { height: 480, bitrateKbps: 1400 },
  { height: 720, bitrateKbps: 2800 }, { height: 1080, bitrateKbps: 5000 }, { height: 2160, bitrateKbps: 16000 },
];

/**
 * Son segmentlerin hızına ve tampondaki saniyeye göre bir sonraki segmentin kalitesini seçer.
 * safety: ölçülen hızın yalnızca %70'ine güven (ağ dalgalanır).
 */
export function pickRendition(opts: { recentThroughputKbps: number[]; bufferSec: number; current: Rendition }): Rendition {
  const { recentThroughputKbps, bufferSec, current } = opts;
  // Harmonik ortalama: tek bir hızlı ölçümün kandırmasını engeller
  const harmonic = recentThroughputKbps.length / recentThroughputKbps.reduce((s, v) => s + 1 / v, 0);
  const budget = harmonic * 0.7;

  // Tampon azsa (panik bölgesi) ne olursa olsun bir kademe düş
  if (bufferSec < 5) {
    const idx = LADDER.indexOf(current);
    return LADDER[Math.max(0, idx - 1)];
  }
  // Tampon rahatsa (>= 20 s) biraz daha cesur ol: bütçenin %120'sine kadar izin ver
  const allowance = bufferSec >= 20 ? budget * 1.2 : budget;
  const affordable = LADDER.filter((r) => r.bitrateKbps <= allowance);
  const best = affordable[affordable.length - 1] ?? LADDER[0];

  // Yukarı çıkarken tek kademe, aşağı inerken serbest (titremeyi azaltır)
  const curIdx = LADDER.indexOf(current);
  const bestIdx = LADDER.indexOf(best);
  return bestIdx > curIdx ? LADDER[curIdx + 1] : best;
}
```
```python
LADDER = [(240, 400), (360, 800), (480, 1400), (720, 2800), (1080, 5000), (2160, 16000)]

def pick_rendition(recent_kbps, buffer_sec, current):
    harmonic = len(recent_kbps) / sum(1 / v for v in recent_kbps)
    budget = harmonic * 0.7
    cur = LADDER.index(current)
    if buffer_sec < 5:                      # panik: bir kademe düş
        return LADDER[max(0, cur - 1)]
    allowance = budget * 1.2 if buffer_sec >= 20 else budget
    affordable = [r for r in LADDER if r[1] <= allowance] or [LADDER[0]]
    best = LADDER.index(affordable[-1])
    return LADDER[cur + 1] if best > cur else LADDER[best]
```
:::

## 5. Darboğazlar ve çözümler

| Darboğaz | Belirti | Çözüm |
|---|---|---|
| Transcoding kuyruğu birikiyor | Yeni video saatlerce "işleniyor" | Segment paralelliği, spot/preemptible işçiler, önce düşük kalite yayınla (progressive readiness) |
| Yeni popüler içerik (lansman) | Bin edge aynı anda origin'e gider | Origin shield, request coalescing, prepositioning |
| Uzun kuyruk (long tail) içerik | Edge isabet oranı düşer | Popülerlik tahminli cache yerleşimi, shield katmanında daha büyük disk |
| Büyük upload'ın kopması | Baştan yükleme, kullanıcı vazgeçer | Multipart + resumable upload, parça başına checksum |
| Depolama maliyeti | EB ölçeğinde fatura | Sıcak/soğuk katmanlama, izlenmeyen kademeleri silip gerekince yeniden üretme, per-title encoding |
| Rebuffer artışı | Akşam saatlerinde ISP tıkanıklığı | ABR'nin tampon tabanlı modu, ISP içi cache, düşük kademelere daha verimli codec (AV1) |

## 6. İstek yolculuğu: "Oynat" tıklaması

:::animation{scene="scene.json"}
Oynat → gateway → playback servisi → metadata DB → manifest → CDN edge (miss) → origin shield → object storage → segmentler → ABR kalite geçişi.
:::

## 7. Ingest yolu: upload'dan CDN'e

Oynatma yolunun arkasında, dakikalar önce tamamlanmış asenkron bir boru hattı vardır. Aşağıdaki sahne bir videonun yüklenmesinden CDN'e ön yüklenmesine kadar geçen adımları gösterir.

:::animation{scene="upload-pipeline.scene.json"}
Multipart upload → VideoUploaded olayı → kuyruk → segment bazlı paralel ffmpeg işçileri → bitrate merdiveni → manifest → READY → CDN ön yükleme.
:::

:::realworld{company="Netflix"}
Netflix trafiğinin %95'inden fazlasını kendi CDN'i **Open Connect** üzerinden servis eder: ISP'lerin veri merkezlerine ücretsiz yerleştirilen, yüzlerce TB SSD/HDD taşıyan "Open Connect Appliance" kutuları. Kutular gündüz izleyiciye hizmet eder, gece ise ertesi gün popüler olacağı tahmin edilen içerikle **doldurulur** (fill window); böylece akşam zirvesinde omurga neredeyse hiç kullanılmaz. Kodlama tarafında Netflix, her başlık için ayrı bir merdiven hesaplayan **per-title encoding** ile aynı görsel kalitede bant genişliğini %20–50 azalttı; **Cosmos** platformu filmleri saniyelik parçalara bölerek on binlerce işçide paralel kodlar. YouTube ise aynı problemi farklı uçtan çözer: dakikada yüklenen 500 saatten fazla video için önce hızlı bir H.264 sürümü yayınlanır, VP9/AV1 kademeleri popülerlik arttıkça arka planda üretilir.
:::

:::callout{tone="tip" title="Mülakat ipuçları"}
- İlk cümleniz "okuma yolu bant genişliği, yazma yolu CPU problemi" olsun; iki yolu **ayrı boru hatları** olarak çizin.
- Upload'ı uygulama sunucusundan geçirmeyin: **presigned URL + multipart + resumable**.
- Transcoding'de "kuyruk + işçi" demek yetmez; **segment paralelliği** ve **progressive readiness** (önce 360p yayınla) puanı artırır.
- CDN'de üç katmanı sayın: edge → origin shield → origin. Lansman senaryosu sorulursa **prepositioning** ve **request coalescing**.
- ABR'nin istemcide çalıştığını vurgulayın: sunucu durumsuz segment servis eder, zekâ oynatıcıdadır. HLS/DASH manifest'in ne olduğunu bir cümleyle açıklayabilin.
- Tutarlılık sorusuna rahat yaklaşın: içerik immutable, versiyonlu yol, eventual tamamen kabul edilebilir.
:::

:::quiz{src="quiz.json"}
:::

:::next{lesson="e-03-twitter-timeline"}
Sırada: yazma başına milyonlarca okuyucu olduğunda ne olur? Twitter/X timeline, fan-out ve ünlü problemi.
:::

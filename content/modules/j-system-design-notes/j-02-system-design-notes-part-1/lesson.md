---
id: j-02-system-design-notes-part-1
slug: system-design-notes-part-1
module: j-system-design-notes
order: 2
title:
  tr: "Sistem Tasarımı Mülakat Çerçevesi ve Kapasite Tahmini"
  en: "System Design Interview Framework and Capacity Estimation"
summary:
  tr: "Temel bileşenler, önbellek, yük dengeleme ve ölçeklemeyle ölçeklenebilir sistem tasarlamayı öğren."
  en: "Learn to design scalable systems from the request path to databases, caching, load balancing and scaling."
durationMinutes: 30
level: beginner
tags: [system-design, interview-prep, requirements, capacity-estimation, back-of-envelope, architecture]
prerequisites: [a-02-latency-throughput-cap, a-03-horizontal-vertical-scaling]
concepts: [interview-framework, functional-requirements, non-functional-requirements, back-of-envelope-estimation, qps-estimation, storage-estimation, bandwidth-estimation, high-level-design, trade-offs, interview-time-management]
---

## Kavram: mülakat bir sınav değil, ortak bir tasarım oturumudur

Sistem tasarımı mülakatında tek bir "doğru cevap" yoktur. Mülakatçı, sizin belirsiz bir problemi nasıl parçaladığınızı, hangi soruları sorduğunuzu, sayıları nasıl tahmin ettiğinizi ve verdiğiniz her kararın bedelini bilip bilmediğinizi görmek ister. "Twitter'ı tasarla" gibi bir cümleyle başlayan 45 dakikalık oturumda en sık yapılan hata, duyar duymaz beyaz tahtaya kutular çizmeye başlamaktır. Oysa iyi adaylar önce **problemi küçültür**, sonra **ölçeği sayıya döker**, ardından **basit ama çalışan bir iskelet** kurar ve kalan zamanı **darboğazlara ve ödünleşimlere** ayırır.

Bu ders, işte bu dört adımlı çalışma biçimini öğretir. Daha önceki modüllerde öğrendiğiniz yapı taşlarını (yük dengeleyici, önbellek, kuyruk, replikasyon) burada bir araya getireceğiz; amaç yeni bileşen öğrenmek değil, elinizdekileri **doğru sırayla ve gerekçeli** kullanmaktır.

:::diagram{src="diagram.svg" alt="Dört adımlı sistem tasarımı çerçevesi: gereksinimleri netleştir, kapasite tahmini yap, üst düzey tasarımı çiz, derinleş ve ödünleşimleri tartış; her adımın süresi ve çıktısı|Four-step system design framework: clarify requirements, estimate capacity, draw the high-level design, deep dive and discuss trade-offs; each step with its duration and output"}
Her adımın somut bir çıktısı vardır; bir sonraki adım bir öncekinin çıktısı üzerine kurulur.
:::

## Adım 1 — Gereksinimleri netleştir

Mülakatçının verdiği problem bilerek eksik bırakılmıştır. İlk beş dakikanın görevi, bu boşluğu sorularla doldurmak ve kapsamı küçültmektir. İki tür gereksinim toplanır.

**Fonksiyonel gereksinimler** sistemin *ne yaptığını* anlatır: kullanıcı ne yapabilir, hangi işlemler var, hangi veriler saklanır. Örneğin bir mesajlaşma uygulaması için "bire bir mesaj gönderme", "okundu bilgisi" ve "çevrim içi durumu" fonksiyonel gereksinimlerdir. Burada mutlaka **kapsam dışı** listesi de çıkarın: "Grup sohbetini ve medya paylaşımını bugün ele almayalım" demek zayıflık değil, olgunluk göstergesidir.

**Fonksiyonel olmayan gereksinimler** sistemin *ne kadar iyi* çalışması gerektiğini anlatır ve tasarımı asıl şekillendiren bunlardır:

| Boyut | Sorulacak soru | Tasarıma etkisi |
|---|---|---|
| Ölçek | Kaç günlük aktif kullanıcı? Okuma/yazma oranı? | Tek sunucu mu, shard'lı küme mi |
| Gecikme | p99 kaç milisaniye kabul edilebilir? | Önbellek, CDN, bölge seçimi |
| Erişilebilirlik | %99,9 mu, %99,99 mu? | Replikasyon, çoklu bölge, failover |
| Tutarlılık | Kullanıcı yazdığını hemen görmeli mi? | Güçlü tutarlılık mı, nihai tutarlılık mı |
| Dayanıklılık | Veri kaybı tolere edilebilir mi? | Senkron replikasyon, yedekleme |
| Güvenlik | Kimlik doğrulama, yetkilendirme, KVKK/GDPR | Gateway, şifreleme, veri yerleşimi |

Bir sayı bile aldığınızda tasarım kararlarınız anlam kazanır: "%99,99 erişilebilirlik" yılda yaklaşık 53 dakika kesinti demektir; bu, tek bir veritabanı sunucusuyla ulaşılamayacak bir hedeftir ve sizi daha ilk dakikada replikasyon konuşmaya iter.

:::callout{tone="warning" title="Sessiz varsayım yapmayın"}
Mülakatçı sayı vermezse kendiniz makul bir varsayım yapın ama **yüksek sesle söyleyin**: "10 milyon günlük aktif kullanıcı varsayıyorum, uygunsa devam edeyim." Sessizce yapılan varsayım, tasarımın sonunda "ben öyle düşünmemiştim" ile çöker; yüksek sesle yapılan varsayım ise mülakatçıya sizi yönlendirme fırsatı verir.
:::

## Adım 2 — Kapasite tahmini (arka-zarf hesapları)

Sayılar olmadan "ölçeklenebilir" kelimesi boş bir sıfattır. Arka-zarf hesabı, kesin değer bulmak için değil, **büyüklük mertebesini** belirlemek için yapılır: saniyede 100 istek mi, 100 bin istek mi? 1 GB mı, 1 PB mı? Bu sorunun cevabı, tek bir PostgreSQL ile mi yoksa shard'lı bir küme ile mi ilerleyeceğinizi söyler.

Üç şeyi tahmin edersiniz: **trafik (QPS)**, **depolama** ve **bant genişliği**. Örnek olarak orta ölçekli bir sosyal uygulama alalım ve tüm varsayımları açıkça yazalım:

- Günlük aktif kullanıcı (DAU): 10 milyon
- Kullanıcı başına günde 20 okuma (zaman akışı, profil, arama) ve 2 yazma (gönderi, beğeni)
- Ortalama yazma boyutu 1 KB, ortalama okuma yanıtı 10 KB
- Tepe trafik, ortalamanın 3 katı
- Veri 5 yıl saklanır; replikasyon faktörü 3

**Trafik.** Bir günde 86.400 saniye vardır; hesabı kolaylaştırmak için bunu 100.000 kabul etmek yaygın bir kısayoldur (hata payı %15, mertebe için yeterli).

- Günlük okuma: 10M × 20 = 200 milyon → 200M / 86.400 ≈ **2.300 okuma/sn**
- Günlük yazma: 10M × 2 = 20 milyon → 20M / 86.400 ≈ **230 yazma/sn**
- Tepe: ≈ **7.000 okuma/sn**, **700 yazma/sn**
- Okuma/yazma oranı 10:1 — bu, sistemin **okuma ağırlıklı** olduğunu ve önbellek ile okuma replikalarının yatırımın en iyi geri döneceği yer olduğunu söyler.

**Depolama.** 20 milyon yazma × 1 KB = günde **20 GB** yeni veri. Yılda ~7,3 TB, beş yılda ~**36,5 TB**. Üç kopya tutulduğunda disk ihtiyacı ~**110 TB**. Bu, tek bir makinenin diskine sığmaz; en baştan bölümleme (partitioning) ve nesne depolamayı planlamanız gerektiği anlamına gelir.

**Bant genişliği.** Çıkış (egress): 2.300 okuma/sn × 10 KB ≈ **23 MB/s**, tepe anda ~70 MB/s. Giriş (ingress): 230 × 1 KB ≈ 230 KB/s. Çıkışın girişten yüz kat büyük olması, yine önbellek ve CDN'in neden kritik olduğunu gösterir.

**Önbellek.** 80/20 kuralı: günlük okunan verinin %20'si trafiğin %80'ini üretir. Günlük okuma hacmi 200M × 10 KB = 2 TB; bunun %20'si **~400 GB** sıcak veri demektir. Tek bir Redis düğümüne sığmaz; birkaç düğümlük bir Redis Cluster ya da daha agresif bir sıcak veri oranı gerekir.

:::interactive{type="capacity-estimator" dau=10000000 readsPerUserPerDay=20 writesPerUserPerDay=2}
Kapasite tahminini kendiniz yapın: yukarıdaki örnek değerler yüklü. Önce sonuç kartlarındaki okuma/yazma QPS'in elle hesapladığımız 2.300 ve 230 ile örtüştüğünü doğrulayın. Sonra "Kullanıcı başına günlük okuma" alanını 100'e çıkarıp sunucu sayısının nasıl sıçradığını, "Tepe trafik çarpanı"nı 3'ten 10'a alıp tepe QPS'i ve "Sıcak veri oranı"nı değiştirip önbellek boyutunu izleyin. Her değişiklikte kendinize sorun: bu sayı hangi mimari kararı değiştirir?
:::

:::code{lang="python" title="Arka-zarf hesabı: elle yapılan hesabı koda dökmek"}
```python
SECONDS_PER_DAY = 86_400

def estimate(dau, reads_per_user, writes_per_user,
             write_bytes=1_000, read_bytes=10_000,
             peak=3, years=5, replicas=3):
    reads_per_day = dau * reads_per_user
    writes_per_day = dau * writes_per_user
    read_qps = reads_per_day / SECONDS_PER_DAY
    write_qps = writes_per_day / SECONDS_PER_DAY
    daily_bytes = writes_per_day * write_bytes
    total_bytes = daily_bytes * 365 * years * replicas
    return {
        "read_qps": round(read_qps),
        "write_qps": round(write_qps),
        "peak_read_qps": round(read_qps * peak),
        "egress_mb_s": round(read_qps * read_bytes / 1e6, 1),
        "daily_gb": round(daily_bytes / 1e9, 1),
        "total_tb_with_replicas": round(total_bytes / 1e12, 1),
    }

print(estimate(10_000_000, 20, 2))
# {'read_qps': 2315, 'write_qps': 231, 'peak_read_qps': 6944,
#  'egress_mb_s': 23.1, 'daily_gb': 20.0, 'total_tb_with_replicas': 109.5}
```
```ts
const SECONDS_PER_DAY = 86_400;

export function estimate(dau: number, readsPerUser: number, writesPerUser: number,
  opts = { writeBytes: 1_000, readBytes: 10_000, peak: 3, years: 5, replicas: 3 }) {
  const readsPerDay = dau * readsPerUser;
  const writesPerDay = dau * writesPerUser;
  const readQps = readsPerDay / SECONDS_PER_DAY;
  const writeQps = writesPerDay / SECONDS_PER_DAY;
  const dailyBytes = writesPerDay * opts.writeBytes;
  const totalBytes = dailyBytes * 365 * opts.years * opts.replicas;
  return {
    readQps: Math.round(readQps),
    writeQps: Math.round(writeQps),
    peakReadQps: Math.round(readQps * opts.peak),
    egressMBps: +(readQps * opts.readBytes / 1e6).toFixed(1),
    dailyGB: +(dailyBytes / 1e9).toFixed(1),
    totalTBWithReplicas: +(totalBytes / 1e12).toFixed(1),
  };
}
```
:::

:::callout{tone="tip" title="Yuvarlama sanatı"}
Arka-zarf hesabında 2 ile 3'ü, 86.400 ile 100.000'i ayırmak önemli değildir; 10 ile 1.000'i ayırmak önemlidir. Sayıları onun kuvvetlerine yuvarlayın, birimleri her satırda yazın ("yazma/sn", "GB/gün") ve sonuca bir **yorum** ekleyin: "230 yazma/sn tek bir PostgreSQL için rahat; 7.000 okuma/sn için önbellek şart." Yorumsuz sayı, mülakatçı için anlamsızdır.
:::

## Adım 3 — Üst düzey tasarım

Artık ne yapacağınızı (fonksiyonel) ve hangi ölçekte yapacağınızı (sayılar) biliyorsunuz. Şimdi uçtan uca çalışan en basit iskeleti çizin. Yaygın tuzak, burada mükemmeliyetçilik yapıp ilk kutuda takılmaktır; hedef, kullanıcıdan veritabanına giden yolu 10 dakikada kapatmaktır.

Tipik bir iskelet şu yapı taşlarından oluşur:

| Yapı taşı | Görevi | Ne zaman eklenir |
|---|---|---|
| DNS + CDN | Alan adı çözümü, statik içeriği uçta sunma | Görsel, video, JS ağırlıklı her üründe |
| Yük dengeleyici | Trafiği durumsuz sunuculara dağıtma, sağlık kontrolü | Birden fazla uygulama sunucusu olduğunda |
| API Gateway | Kimlik doğrulama, hız sınırlama, yönlendirme | Birden fazla servis ya da dış istemci olduğunda |
| Uygulama servisleri | İş mantığı; durumsuz, yatay ölçeklenir | Her zaman |
| Önbellek (Redis) | Sıcak okumaları bellekten karşılama, oturum | Okuma/yazma oranı yüksekse |
| Veritabanı | Kalıcı kayıt; ilişkisel ya da NoSQL | Her zaman; tür veri modeline göre |
| Okuma replikaları / shard | Okuma ölçeklemesi / yazma ve veri boyutu ölçeklemesi | QPS ya da veri tek makineyi aştığında |
| Mesaj kuyruğu | Asenkron iş, servisleri ayrıştırma, tepe yumuşatma | Bildirim, e-posta, analitik gibi yan işler varsa |
| Nesne depolama | Büyük ikili dosyalar | Medya yüklemesi varsa |

Bu adımda ayrıca **API'yi** birkaç satırda tanımlayın (`POST /posts`, `GET /feed?cursor=`) ve **veri modelini** ana tablolarıyla (kullanıcı, gönderi, takip) çizin. Hangi sorgunun hangi tabloya ve hangi indekse vurduğunu söyleyebilmek, bir sonraki adımda darboğazı bulmanızı kolaylaştırır.

:::code{lang="yaml" title="Beyaz tahta notu: 45 dakikada doldurulacak tasarım özeti"}
```yaml
problem: "Sosyal uygulama zaman akışı"
fonksiyonel:
  kapsam_ici: [gönderi oluştur, takip et, zaman akışını oku]
  kapsam_disi: [medya, DM, arama]
fonksiyonel_olmayan:
  dau: 10_000_000
  okuma_yazma_orani: "10:1"
  p99_gecikme_ms: 200
  erisilebilirlik: "99.99%"
  tutarlilik: "akışta nihai, kendi gönderinde okuma-sonrası-yazma"
kapasite:
  okuma_qps: 2300      # tepe ~7000
  yazma_qps: 230       # tepe ~700
  depolama_5yil_tb: 110  # 3 replika dahil
  onbellek_gb: 400
ust_duzey:
  - "CDN → LB → API Gateway → feed-service / post-service"
  - "Postgres (gönderi, takip) + Redis (akış önbelleği)"
  - "Kafka: gönderi olayı → fan-out worker"
derinlesme:
  darbogaz: "ünlü kullanıcıların fan-out'u (10M takipçi × 1 yazma)"
  odunlesim: "push (hızlı okuma, pahalı yazma) vs pull (ucuz yazma, yavaş okuma) → hibrit"
```
:::

## Adım 4 — Derinleşme ve ödünleşimler

İskelet çalışır hâle geldikten sonra mülakatçı genellikle sizi bir noktaya iter: "Bu veritabanı 7.000 okuma/sn'yi kaldırır mı?", "Bir sunucu çökerse ne olur?", "Ünlü bir kullanıcı gönderi atınca ne olur?" Bu sorular yanıtlanırken tasarımın **en zayıf halkasını** siz bulmalısınız; kapasite tahmininizdeki sayılar burada rehberdir.

Derinleşme adımının kuralı şudur: her ek bileşen bir **maliyetle** gelir ve bunu siz söylemelisiniz. Önbellek gecikmeyi düşürür ama bayat veri ve geçersiz kılma karmaşıklığı getirir. Shard'lama yazma kapasitesini artırır ama çapraz shard sorguları ve yeniden dengelemeyi zorlaştırır. Nihai tutarlılık erişilebilirliği yükseltir ama kullanıcı kendi beğenisini anında göremeyebilir. "X kullanırım" yerine "X kullanırım çünkü okuma ağırlıklıyız; bedeli Y, bunu Z ile yönetirim" biçiminde konuşun.

Mülakatçıların değer verdiği birkaç derinleşme başlığı: tek hata noktalarının (SPOF) ortadan kaldırılması, sıcak anahtar / sıcak partition problemi, idempotent yazma ve tekrar deneme, veri yaşam döngüsü ve arşivleme, izleme ve alarm.

## 45 dakikalık zaman planı

| Dakika | Adım | Çıktı | İşaret |
|---|---|---|---|
| 0–5 | Gereksinimler | Kapsam içi/dışı listesi, fonksiyonel olmayan hedefler | En az üç netleştirici soru sordunuz mu? |
| 5–10 | Kapasite tahmini | QPS, depolama, bant genişliği, önbellek boyutu | Her sayının yanında bir yorum var mı? |
| 10–25 | Üst düzey tasarım | Uçtan uca çizim, API, veri modeli | Kullanıcıdan veritabanına yol kapandı mı? |
| 25–40 | Derinleşme | 2–3 darboğaz ve her biri için ödünleşim | Her bileşenin bedelini söylediniz mi? |
| 40–45 | Özet ve sorular | Tasarımın zayıf noktaları, sıradaki iyileştirmeler | Açık bıraktıklarınızı kendiniz saydınız mı? |

Zamanı tahtada görünür bir yere not edin. 25. dakikada hâlâ gereksinim tartışıyorsanız nazikçe kapatın: "Bunları varsayım olarak alıp tasarıma geçiyorum."

## Tipik mülakat soruları

Sık sorulan problemler ve her birinin sizi zorlayacağı asıl nokta:

- **URL kısaltıcı** — kısa anahtar üretimi, çok yüksek okuma/yazma oranı, önbellek ve 301/302 seçimi.
- **Zaman akışı (Twitter/Instagram)** — fan-out on write/on read, ünlü kullanıcı problemi, sıralama.
- **Mesajlaşma (WhatsApp)** — kalıcı bağlantılar, teslim garantileri, çevrim içi durumu, mesaj sırası.
- **Araç çağırma (Uber)** — konum güncellemelerinin yazma yoğunluğu, coğrafi indeks, eşleştirme.
- **Video platformu** — yükleme ve kodlama hattı, CDN, nesne depolama, önerme.
- **Hız sınırlayıcı / bildirim servisi / dosya depolama** — daha küçük ama ödünleşim yüklü tasarımlar.

Hepsinde aynı dört adım çalışır; fark, hangi adımda ağırlık vereceğinizdedir. URL kısaltıcıda kapasite hesabı ve veritabanı seçimi öne çıkar, mesajlaşmada ise bağlantı yönetimi ve teslim garantileri.

## Sık yapılan hatalar

1. **Soru sormadan çizmeye başlamak.** Kapsamı daraltmadan her şeyi tasarlamaya çalışırsınız ve hiçbirini bitiremezsiniz.
2. **Sayısız "ölçeklenebilir" demek.** QPS'i bilmeden mikroservis, Kafka ve shard önermek aşırı mühendislik olarak görünür.
3. **Tek bir çözüme bağlanmak.** Alternatifi ve bedelini söylemeden karar vermek, ödünleşim düşünmediğiniz izlenimi bırakır.
4. **Mülakatçının ipuçlarını kaçırmak.** "Peki ya yazmalar artarsa?" sorusu bir yönlendirmedir; direnmek yerine oraya gidin.
5. **Veri modelini ve API'yi atlamak.** Kutular çizip tabloları hiç konuşmayan adaylar, derinleşme adımında darboğazı gösteremez.
6. **Sessizlik.** Düşünürken de konuşun; mülakatçı zihninizdeki süreci puanlar, yalnızca sonucu değil.
7. **Zamanı yönetmemek.** En parlak derinleşme bile 44. dakikada başlarsa görünmez.

:::realworld{company="Trendyol"}
Türkiye'nin en büyük e-ticaret platformlarından Trendyol için kapasite planlaması, "Efsane Günler" ve 11.11 gibi kampanya dönemlerinde sıradan bir günün kat kat üstüne çıkan trafikle başa çıkmak demektir. Böyle bir sistemi mülakatta tasarlıyor olsaydınız, bu dersin ikinci adımı tam olarak burada devreye girer: olağan günün QPS'i değil, **tepe çarpanı** belirleyici olur. Ürün sayfaları ve arama gibi okuma ağırlıklı yollar önbellek ve CDN ile ölçeklenirken, sepet ve ödeme gibi yazma yolları için kuyruklama ve tepe yumuşatma gerekir. Kampanya öncesi yük testleriyle hedef QPS'in doğrulanması, bu dersteki arka-zarf hesabının gerçek hayattaki karşılığıdır: önce tahmin, sonra ölçüm.
:::

:::quiz{src="quiz.json"}
:::

:::next{lesson="j-03-system-design-with-redis-and-kafka"}
Sırada: çerçevenin üçüncü ve dördüncü adımında en sık başvurduğunuz iki yapı taşı — Redis ile önbellek ve sayaçlar, Kafka ile olay akışı — ve ikisini birleştiren bir sipariş mimarisi.
:::

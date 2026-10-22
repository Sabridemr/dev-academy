---
id: h-11-grafana-notes
slug: grafana-notes
module: h-devops-tools
order: 11
title:
  tr: "Gözlemlenebilirlik: Prometheus, Grafana ve Alarmlar"
  en: "Observability: Prometheus, Grafana and Alerting"
summary:
  tr: "Grafana'da veri kaynakları, dashboard, PromQL/LogQL sorguları ve uyarılarla sistemleri izlemeyi öğren."
  en: "Learn to monitor systems with Grafana using data sources, dashboards, PromQL/LogQL queries and alerts."
durationMinutes: 28
level: intermediate
tags: [grafana, prometheus, observability, monitoring, alerting, slo, devops]
prerequisites: [a-13-observability-12-factor, f-03-kubernetes-basics, h-05-devops-ve-docker-kullanim-rehberi]
concepts: [metrics-logs-traces, prometheus-data-model, pull-model, promql, data-source, dashboard, panel, alert-rule, notification-policy, contact-point, slo, error-budget, loki, tempo]
---

## Kavram: sistemin içini dışarıdan görmek

Bir uygulama canlıya alındığında asıl soru "çalışıyor mu" değil, "nasıl çalışıyor" olur. Kullanıcılar yavaşlık mı yaşıyor, hangi uç nokta hata veriyor, dün geceki dağıtımdan sonra bellek neden sızıyor? **Gözlemlenebilirlik (observability)**, bir sistemin dışarıdan ürettiği sinyallere bakarak iç durumunu anlayabilme yeteneğidir. İzleme (monitoring) önceden bildiğiniz soruları sorar; gözlemlenebilirlik daha önce aklınıza gelmemiş soruları da cevaplayabilmenizi sağlar.

Bu sinyaller üç ana türe ayrılır ve her biri farklı bir soruya cevap verir:

- **Metrikler (metrics)** — zaman içinde ölçülen sayılar: saniyedeki istek, CPU yüzdesi, kuyruk uzunluğu. Ucuzdur, uzun süre saklanır, "ne zaman ve ne kadar" sorusunu cevaplar.
- **Loglar (logs)** — zaman damgalı olay kayıtları: "kullanıcı 42 için ödeme reddedildi, sebep: limit". Ayrıntılıdır ama hacimlidir; "tam olarak ne oldu" sorusunu cevaplar.
- **İzler (traces)** — tek bir isteğin servisler arasında izlediği yol ve her adımın süresi. Dağıtık sistemlerde "zaman nerede harcandı" sorusunu cevaplar.

Üçünü birbirine bağlayan şey ortak etiketler ve kimliklerdir: bir metrik grafiğindeki sıçramadan o dakikanın loglarına, logdaki trace kimliğinden ilgili ize atlayabildiğinizde gözlemlenebilirlik gerçekten işe yarar. **Grafana** tam olarak bu birleştirme katmanıdır: kendisi veri toplamaz ve saklamaz; Prometheus, Loki, Tempo, Elasticsearch, PostgreSQL gibi **veri kaynaklarına (data source)** sorgu atar ve sonuçları panellerde görselleştirir.

:::diagram{src="diagram.svg" alt="Gözlemlenebilirlik boru hattı: uygulama metrikleri /metrics uç noktasından Prometheus tarafından çekilir, loglar Promtail ile Loki'ye, izler OpenTelemetry ile Tempo'ya gider; Grafana üç kaynağı sorgular, alert kuralları Alertmanager üzerinden Slack ve çağrı sistemine bildirim gönderir|Observability pipeline: application metrics are pulled by Prometheus from the /metrics endpoint, logs go to Loki via Promtail, traces to Tempo via OpenTelemetry; Grafana queries all three sources and alert rules notify Slack and on-call via Alertmanager"}
Metrik, log ve iz ayrı depolarda yaşar; Grafana tek ekranda birleştirir.
:::

## Prometheus veri modeli ve pull yaklaşımı

**Prometheus**, bulut yerlisi dünyanın fiili metrik standardıdır. Veri modeli basittir: her zaman serisi bir **metrik adı** ve bir dizi **etiket (label)** çiftiyle tanımlanır, değerleri zaman damgalı kayan noktalı sayılardır. `http_requests_total{method="GET", route="/api/orders", status="200"}` bir seridir; `status="500"` olanı ayrı bir seridir. Etiketler sorgularda filtreleme ve gruplama yapmanızı sağlar; ama her yeni etiket değeri yeni bir seri demektir, bu yüzden kullanıcı kimliği gibi sınırsız değerleri asla etiket yapmazsınız (kardinalite patlaması).

Dört metrik türü vardır: **counter** yalnızca artar (toplam istek, toplam hata); **gauge** iner çıkar (bellek, aktif bağlantı); **histogram** değerleri kovalara (bucket) dağıtır ve yüzdelik hesaplamaya izin verir (yanıt süresi); **summary** istemci tarafında yüzdelik hesaplar.

Prometheus'un ayırt edici özelliği **pull (çekme)** modelidir: uygulamalar metriklerini `/metrics` uç noktasında düz metin olarak yayınlar, Prometheus belirli aralıklarla (örneğin 15 saniye) bu uç noktaları **kazır (scrape)**. Push yerine pull'un avantajları: hedefin ayakta olup olmadığı otomatik bilinir (`up` metriği), yapılandırma merkezidir ve bir uygulama hatasının izleme sistemini mesaj seliyle boğması zorlaşır. Kubernetes gibi ortamlarda hedefler **servis keşfi** ile otomatik bulunur. Kısa ömürlü toplu işler için istisna olarak **Pushgateway** vardır.

Bir metriğin `/metrics` uç noktasından nöbetçinin telefonuna kadar izlediği yol, bu dersin geri kalanının iskeletidir. PromQL, panel ve alert kuralı bölümlerine geçmeden önce yolun tamamını izleyin.

:::predict{id="alert-for-suresi"}
Kuralda `expr: hata oranı > 0.02` ve `for: 5m` yazıyor. Hata oranı 2 dakika boyunca %3'e çıkıp sonra normale dönerse ne olur? | The rule says `expr: error ratio > 0.02` and `for: 5m`. If the error ratio jumps to 3% for 2 minutes and then returns to normal, what happens?
- [ ] Uyarı hemen tetiklenir ve nöbetçi aranır | The alert fires immediately and on-call is paged
- [x] Uyarı pending olur ama firing'e geçmeden kapanır; bildirim gitmez | The alert goes pending but clears before firing; no notification is sent
- [ ] Uyarı 5 dakika sonra yine de tetiklenir | The alert still fires after 5 minutes
Açıklama: `for`, koşulun kesintisiz doğru kalması gereken süredir. Koşul ilk kez sağlandığında uyarı pending olur. Süre dolmadan koşul bozulursa uyarı sessizce kapanır. Bu, kısa dalgalanmaların gece kimseyi uyandırmamasını sağlar. | `for` is how long the condition must stay continuously true. When it first holds, the alert goes pending; if the condition breaks before the time is up, the alert quietly clears. This keeps short blips from waking anyone at night.
:::

:::animation{scene="metrics-to-alert.scene.json"}
Prometheus'un hedefleri kazıması, Grafana'nın PromQL ile panel çizmesi ve kuralın pending ile firing durumları. Ardından Alertmanager'ın uyarıyı Slack'e ve nöbetçiye yönlendirmesi, instance kırılımıyla kök nedenin bulunması ve uyarının çözülmesi gösteriliyor.
:::

## PromQL: zaman serisi sorgulama dili

**PromQL**, serileri seçen, zaman penceresinde işleyen ve toplayan bir ifade dilidir. En önemli fikir şudur: counter'ların ham değeri anlamsızdır, her zaman **rate** ile hıza çevrilir. `rate(x[5m])` son beş dakikadaki saniye başına artışı verir; pencere, kazıma aralığının en az dört katı olmalıdır ki aradaki boşluklar sonucu bozmasın.

:::code{lang="promql" title="Sık kullanılan PromQL ifadeleri"}
```promql
# Saniyedeki toplam istek (tüm örnekler toplanmış)
sum(rate(http_requests_total[5m]))

# Rota başına hata oranı (%): 5xx / tüm istekler
sum by (route) (rate(http_requests_total{status=~"5.."}[5m]))
  / sum by (route) (rate(http_requests_total[5m])) * 100

# p95 yanıt süresi (histogram kovalarından)
histogram_quantile(0.95, sum by (le) (rate(http_request_duration_seconds_bucket[5m])))

# Konteyner başına bellek kullanımı (gauge, doğrudan okunur)
container_memory_working_set_bytes{namespace="prod"} / 1024 / 1024

# Kazınamayan hedefler
up == 0

# Disk 4 saat içinde dolacak mı? (doğrusal öngörü)
predict_linear(node_filesystem_avail_bytes{mountpoint="/"}[1h], 4 * 3600) < 0
```
:::

`sum by (route)` ifadesi toplamayı etiket bazında gruplar; `=~` düzenli ifadeyle eşleştirir; `histogram_quantile` kovalardan yüzdelik türetir. Sorguları Grafana'nın **Explore** ekranında deneyip sonra panele taşımak iyi bir alışkanlıktır.

## Grafana: panel, dashboard ve değişkenler

Grafana'nın yapı taşı **panel**dir: bir sorgu (ya da birkaçı), bir görselleştirme türü (time series, stat, gauge, bar, table, logs, heatmap) ve eşik, birim, açıklama gibi ayarlar. Paneller bir **dashboard** üzerinde satırlar hâlinde düzenlenir. İyi bir servis dashboard'u genellikle üstte dört "altın sinyali" gösterir — trafik, hata oranı, gecikme, doygunluk — altında ise bağımlılıklar ve kaynak kullanımı gelir.

**Değişkenler (variables)**, aynı dashboard'u her servis ya da ortam için tekrar yazmaktan kurtarır: `$namespace` ve `$service` gibi açılır listeler sorgulara `{namespace="$namespace"}` biçiminde girer. **Annotations**, dağıtım anlarını grafik üzerinde dikey çizgi olarak gösterir; bir sıçramanın bir dağıtımla çakışıp çakışmadığını saniyede görürsünüz. Dashboard'lar JSON olarak dışa aktarılabilir ve kodla (provisioning) yönetilir; böylece Git'te sürümlenir ve yeni bir Grafana örneğine otomatik yüklenir.

:::callout{tone="info" title="Altın sinyaller ve RED"}
Google'ın SRE pratiğinden gelen dört altın sinyal: **gecikme, trafik, hata, doygunluk**. İstek odaklı servisler için sade bir alt küme olan **RED** (Rate, Errors, Duration) çoğu dashboard'un ilk satırını oluşturur. Bu üç paneli her servis için standartlaştırırsanız nöbetçi mühendis hangi servise bakarsa baksın aynı yerleşimi görür.
:::

## Trafik dalgasında metrikler nasıl değişir?

Bir kampanya ya da haber nedeniyle trafik beş katına çıktığında dashboard'unuzda neler olur? İstek hızı yükselir, kapasite yetişemezse kuyruk uzar ya da istekler düşer, hata oranı ve p95 gecikme sıçrar; otomatik ölçekleme gecikmeyle devreye girer ve örnek sayısı artar. Aşağıdaki simülatörde bu dalgayı kendiniz üretin ve her kontrolün hangi metriği nasıl etkilediğini izleyin.

:::interactive{type="traffic-wave" baselineRps=200 peakMultiplier=5 autoscale=true}
Trafik dalgasında metriklerin nasıl değiştiğini izleyin: taban trafik ve tepe çarpanını yükseltip "Günü oynat"a basın; talep ile kapasite eğrisinin açıldığı anda düşen istek sayısının nasıl arttığına bakın. Otomatik ölçeklemeyi kapatıp sabit instance sayısıyla karşılaştırın, ölçekleme gecikmesini artırıp tepe instance ve günlük maliyet göstergelerini izleyin; kuyruğu açtığınızda düşen istek yerine bekleme süresinin uzadığını fark edin. Her göstergenin Prometheus'ta hangi sorguya karşılık geleceğini düşünün: talep `sum(rate(http_requests_total[1m]))`, düşen istek `rate(http_requests_total{status="503"}[1m])`, instance sayısı `count(up{job="api"})`.
:::

## Alert kuralları: veriden nöbetçiye

Dashboard'a bakmak için birinin uyanık olması gerekir; **uyarı (alert)** sistemi sizin yerinize bakar. Bir **alert kuralı** üç şeyden oluşur: bir sorgu, bir koşul (eşik) ve bir süre (`for`). Süre, geçici dalgalanmaların alarm üretmesini engeller: "hata oranı 5 dakika boyunca %2'nin üzerindeyse" gibi. Kural tetiklendiğinde **etiketler** (`severity=critical`, `team=payments`) taşır; **bildirim politikası (notification policy)** bu etiketlere bakarak uyarıyı doğru **iletişim noktasına (contact point)** — Slack kanalı, e-posta, PagerDuty, webhook — yönlendirir. Benzer uyarılar gruplanır, çözülene kadar belirli aralıklarla tekrarlanır, bakım pencerelerinde **sessize alınır (silence)**.

:::code{lang="yaml" title="Prometheus alert kuralı örneği"}
```yaml
groups:
  - name: api-slo
    rules:
      - alert: HighErrorRate
        expr: |
          sum(rate(http_requests_total{job="api", status=~"5.."}[5m]))
            / sum(rate(http_requests_total{job="api"}[5m])) > 0.02
        for: 5m
        labels:
          severity: critical
          team: payments
        annotations:
          summary: "API hata oranı %2'nin üzerinde"
          description: "Son 5 dakikada 5xx oranı {{ $value | humanizePercentage }}."
          runbook_url: "https://wiki.ornek.com/runbooks/api-errors"
```
:::

İyi bir uyarının iki özelliği vardır: **eyleme dönüktür** (biri gece uyandırılıyorsa yapacak bir şey olmalı) ve **belirtiye dayanır** (CPU %80 değil, "kullanıcılar hata alıyor"). Nedene dayalı uyarılar gürültü üretir; nöbetçi birkaç hafta sonra bildirimleri okumayı bırakır ve gerçek kesinti kaçar.

## SLO ve hata bütçesi

Kaç uyarı kuralının "doğru" eşiği olduğuna karar vermenin sistematik yolu **SLO (Service Level Objective)** kavramıdır. Önce bir **SLI** seçersiniz — başarılı isteklerin oranı ya da 300 ms altında yanıtlanan isteklerin oranı gibi ölçülebilir bir gösterge. Sonra bir hedef koyarsınız: "30 günde isteklerin %99,9'u başarılı olacak." Bu hedefin tersi **hata bütçesidir**: 30 günde isteklerin %0,1'i başarısız olabilir; zaman cinsinden yaklaşık 43 dakika tam kesinti.

Hata bütçesi, güvenilirlik ile hız arasındaki tartışmayı sayıya bağlar. Bütçe doluysa ekip riskli dağıtımlar yapabilir; bütçe tükeniyorsa yeni özellik yerine dayanıklılık işine öncelik verilir. Uyarılar da bütçeye göre kurulur: "bütçeyi şu hızla yakmaya devam edersek 2 gün içinde tükenecek" anlamına gelen **burn rate** uyarıları, sabit eşiklerden çok daha az gürültü üretir ve kullanıcıyı gerçekten etkileyen sorunları yakalar. Kısa (1 saat) ve uzun (6 saat) pencereleri birlikte kontrol eden çok pencereli kurallar, hem ani çöküşü hem sinsi bozulmayı yakalar.

:::callout{tone="warning" title="Yüzde 100 bir hedef değildir"}
%100 erişilebilirlik hedeflemek, her dağıtımı korkutucu hâle getirir ve yine de başarılamaz; kullanıcının telefonu ve ağı zaten yüzde yüz güvenilir değildir. Her ek dokuz (%99 → %99,9 → %99,99) maliyeti kabaca on katına çıkarır. Hedefi, kullanıcının fark edeceği seviyeye göre seçin ve ölçmeye başlamadan hedef koymayın.
:::

## Loki ve Tempo: log ve iz tarafı

**Loki**, Grafana ekibinin geliştirdiği log deposudur ve "Prometheus ama loglar için" felsefesiyle çalışır: log içeriğini tam metin indekslemek yerine yalnızca etiketleri (`app`, `namespace`, `pod`) indeksler, satırları sıkıştırılmış parçalar hâlinde nesne depolamada tutar. Bu onu ucuz ve basit yapar. Sorgu dili **LogQL**, PromQL'e benzer: `{app="api"} |= "error" | json | status >= 500` gibi bir akış seçici ve filtre zinciri; `rate({app="api"} |= "error" [5m])` ile loglardan metrik türetilebilir. Loglar Promtail, Grafana Alloy ya da Fluent Bit gibi bir ajanla toplanır.

**Tempo** ise dağıtık izleri saklar. Uygulamalar OpenTelemetry SDK'sı ile her isteğe bir trace kimliği verir ve servisler arası çağrılarda bu kimliği başlıklarla taşır; her servis kendi **span**'ini (başlangıç, bitiş, etiketler) gönderir. Grafana'da bir log satırındaki trace kimliğine tıklayıp izin tamamını görmek, üç sinyali birbirine bağlamanın en somut hâlidir.

## Örnek kurulum: Docker Compose ile Prometheus + Grafana

Aşağıdaki kurulum tek komutla yerel bir izleme yığını ayağa kaldırır. `prometheus.yml` içindeki `scrape_configs`, Prometheus'un hangi hedefleri kazıyacağını söyler; Grafana ise `provisioning` klasörü sayesinde açılışta Prometheus'u veri kaynağı olarak tanır.

:::code{lang="yaml" title="docker-compose.yml ve prometheus.yml"}
```yaml
# docker-compose.yml
services:
  prometheus:
    image: prom/prometheus:v2.53.0
    ports: ["9090:9090"]
    volumes:
      - ./prometheus.yml:/etc/prometheus/prometheus.yml:ro
      - prom-data:/prometheus
    command: ["--config.file=/etc/prometheus/prometheus.yml", "--storage.tsdb.retention.time=15d"]

  grafana:
    image: grafana/grafana:11.1.0
    ports: ["3000:3000"]
    environment:
      GF_SECURITY_ADMIN_PASSWORD: degistir-beni
    volumes:
      - ./grafana/provisioning:/etc/grafana/provisioning:ro
      - grafana-data:/var/lib/grafana
    depends_on: [prometheus]

  node-exporter:
    image: prom/node-exporter:v1.8.1
    ports: ["9100:9100"]

volumes:
  prom-data: {}
  grafana-data: {}
```
```yaml
# prometheus.yml
global:
  scrape_interval: 15s
  evaluation_interval: 15s

rule_files:
  - /etc/prometheus/rules/*.yml

scrape_configs:
  - job_name: prometheus
    static_configs:
      - targets: ["localhost:9090"]
  - job_name: node
    static_configs:
      - targets: ["node-exporter:9100"]
  - job_name: api
    metrics_path: /metrics
    static_configs:
      - targets: ["host.docker.internal:8080"]
```
```yaml
# grafana/provisioning/datasources/prometheus.yml
apiVersion: 1
datasources:
  - name: Prometheus
    type: prometheus
    url: http://prometheus:9090
    isDefault: true
```
:::

`docker compose up -d` sonrasında `localhost:9090/targets` adresinde hedeflerin "UP" olduğunu, `localhost:3000` adresinde Grafana'nın Prometheus'u gördüğünü doğrulayın. İlk dashboard için Grafana'nın topluluk kataloğundan "Node Exporter Full" panosunu kimliğiyle içe aktarmak dakikalar içinde CPU, bellek ve disk grafikleri verir.

:::realworld{company="Grafana Labs"}
Grafana Labs, kendi barındırdığı Grafana Cloud hizmetini izlemek için ürettiği araçların kendisini kullanır ve bu deneyimi açıkça paylaşır. Şirketin bulut ortamı on milyonlarca aktif zaman serisini Mimir (uzun süreli Prometheus depolaması), petabaytlarca logu Loki ve izleri Tempo üzerinde tutar; bu ölçek, "her log satırını indekslemek yerine yalnızca etiketleri indeksle" kararının asıl gerekçesidir. Ekipler servislerini SLO'larla yönetir: her servis için kullanıcıya dönük bir SLI tanımlanır, hata bütçesi burn rate uyarılarıyla takip edilir ve nöbetçi yalnızca bütçeyi hızla tüketen olaylarda uyandırılır. Geliştiriciler dashboard ve uyarı kurallarını JSON ve YAML olarak Git'te tutar; CI boru hattı bunları Grafana'ya otomatik yükler. Sonuç, "dashboard'u kim bozdu" sorusunun `git log` ile cevaplandığı bir ortamdır.
:::

:::callout{tone="tip" title="Mülakat özeti"}
- Metrik "ne kadar", log "ne oldu", iz "nerede yavaş" sorusunu cevaplar; Grafana üçünü sorgulayıp görselleştirir, saklamaz.
- Prometheus pull ile `/metrics` kazır; seri = ad + etiketler; counter'ı `rate()` ile, yüzdeliği `histogram_quantile()` ile okuyun; kardinaliteyi kontrol altında tutun.
- Uyarı = sorgu + eşik + `for`; belirtiye dayalı ve eyleme dönük olsun; politika etiketlere göre iletişim noktasına yönlendirir.
- SLO hedefi, hata bütçesini tanımlar (%99,9 / 30 gün ≈ 43 dk); burn rate uyarıları sabit eşiklerden daha az gürültülüdür.
- Loki etiket indeksler, Tempo OpenTelemetry izlerini saklar; dashboard ve kurallar kod olarak Git'te yaşar.
:::

:::quiz{src="quiz.json"}
:::

:::next{lesson="h-12-ai-for-devops-notes"}
Sırada: topladığınız metrik ve logları yapay zekâ ile yorumlamak — anomali tespiti, olay özetleme ve DevOps iş akışlarında yapay zekâ asistanları.
:::

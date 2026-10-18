---
id: a-13-observability-12-factor
slug: observability-12-factor
module: a-system-design-fundamentals
order: 13
title:
  tr: "Observability ve 12-Factor App"
  en: "Observability and the 12-Factor App"
summary:
  tr: Logging, metrics, tracing; üretim için 12 ilke.
  en: Logging, metrics, tracing; twelve principles for production.
durationMinutes: 30
level: intermediate
tags: [observability, logging, metrics, tracing, opentelemetry, twelve-factor, sre]
prerequisites: [a-06-api-gateway, a-09-message-queues-event-driven]
concepts: [observability, three-pillars, structured-logging, correlation-id, metrics, red-method, percentiles, cardinality, distributed-tracing, trace-context, span, slo-alerting, twelve-factor, config-in-env, stateless-processes]
---

## Kavram: "ne oldu?" sorusunu üretimde cevaplayabilmek

Bir kullanıcı "ödeme sayfası bazen 10 saniye sürüyor" diyor. Hangi istek? Hangi servis? Hangi veritabanı sorgusu? Mikroservislerde bir istek 10 servisten geçer; hiçbiri tek başına yavaş görünmez. **Monitoring**, bildiğiniz soruları önceden tanımlanmış göstergelerle izlemektir ("CPU %80'i aştı mı?"). **Observability (gözlemlenebilirlik)** ise sistemin dışarıya verdiği sinyallerden, *önceden aklınıza gelmemiş* soruları da cevaplayabilmektir ("iOS 17'deki kullanıcıların sepet-boşaltma istekleri neden yalnızca eu-west'te yavaş?"). Bunun için üç sinyal türü — **üç sütun** — birlikte kullanılır.

## Üç sütun: log, metrik, trace

| | **Log** | **Metrik** | **Trace** |
|---|---|---|---|
| Ne? | Zaman damgalı, ayrık olay kaydı | Zaman serisi hâlinde toplanmış sayı | Bir isteğin servisler arasındaki yolculuğu (span ağacı) |
| Cevapladığı soru | "Bu istekte tam olarak ne oldu?" | "Sistem genelinde durum nasıl, trend ne?" | "Bu isteğin zamanı nerede harcandı?" |
| Maliyet | Yüksek (hacim istekle orantılı) | Düşük (önceden toplanmış) | Orta (örnekleme ile) |
| Araçlar | Loki, Elasticsearch, CloudWatch Logs | Prometheus, Datadog, CloudWatch Metrics | Jaeger, Tempo, Zipkin, X-Ray |
| Zayıf yanı | Bağlamsız log yığınında arama | Tek bir isteği açıklayamaz | Örnekleme nadir hataları kaçırabilir |

Üçünü birbirine bağlayan şey **trace-id**'dir: metrik "p99 arttı" der, trace "payment-service'teki DB çağrısı 800 ms" der, o span'a bağlı log "lock wait timeout on orders table" der. Bağ yoksa üç ayrı aracınız vardır, gözlemlenebilirliğiniz yoktur.

:::diagram{src="diagram.svg" alt="Servislerden OpenTelemetry collector'a, oradan log, metrik ve trace depolarına ve tek bir panele akan gözlemlenebilirlik boru hattı|Observability pipeline from services through an OpenTelemetry collector to log, metric and trace stores and a single dashboard"}
Her servis üç sinyali de tek bir ajana/collector'a gönderir; depolar farklı olsa bile trace-id üçünü birbirine bağlar.
:::

## Structured logging: metin değil, olay

`console.log("user 42 paid 199 TRY")` arama yapılamaz, filtrelenemez, sayılamaz. **Yapısal log** JSON gibi makine okunur bir formattır ve her satırda aynı bağlam alanları bulunur:

```json
{"ts":"2026-03-14T10:22:31.412Z","level":"error","service":"payment","env":"prod",
 "trace_id":"4bf92f3577b34da6a3ce929d0e0e4736","span_id":"00f067aa0ba902b7",
 "user_id":"u_42","order_id":"o_9f1","msg":"charge failed","provider":"stripe","code":"card_declined","duration_ms":812}
```

Kurallar: (1) her satırda `service`, `env`, `trace_id`; (2) seviyeleri tutarlı kullanın (DEBUG geliştirme, INFO iş olayı, WARN kendi kendine toparlanan sorun, ERROR insan müdahalesi gerektiren); (3) kişisel veri (e-posta, kart numarası, token) **loglanmaz**; (4) log'u dosyaya değil **stdout**'a yazın — toplama platformun işidir (12-factor XI).

## Metrikler: RED, USE, yüzdelikler

Her servis için en az **RED** metrikleri: **R**ate (istek/s), **E**rrors (hata oranı), **D**uration (gecikme dağılımı). Altyapı kaynakları için **USE**: **U**tilization, **S**aturation, **E**rrors. İki kritik ayrıntı:

- **Ortalama yalan söyler.** 1.000 isteğin 990'ı 20 ms, 10'u 5 s sürüyorsa ortalama 70 ms'dir ve kimse sorunu görmez. **p50 / p95 / p99** (yüzdelikler) kullanın; SLO'lar yüzdelikle yazılır: "isteklerin %99'u 300 ms altında".
- **Kardinalite patlaması.** Prometheus'ta her etiket kombinasyonu ayrı bir zaman serisidir. `user_id` etiketi eklerseniz 1 milyon kullanıcı × 10 uç nokta × 5 durum kodu = 50 milyon seri ve metrik sisteminiz çöker. Yüksek kardinaliteli bilgi log ve trace'e aittir, metriğe değil.

:::callout{tone="warning" title="Etiketlere kullanıcı kimliği koymayın"}
Metrik etiketleri (label/tag) için güvenli kümeler: servis, uç nokta (şablon hâlinde: `/users/:id`, gerçek id değil), HTTP metodu, durum kodu sınıfı, bölge. `user_id`, `order_id`, `email`, ham URL, hata mesajı metni → log ve trace'e.
:::

## Distributed tracing: trace-id'nin yolculuğu

Bir **trace**, tek bir isteğin uçtan uca kaydıdır; **span** ise o isteğin bir servisteki (ya da bir DB çağrısındaki) tek bir adımıdır. Her span'in `trace_id`, kendi `span_id`'si ve `parent_span_id`'si vardır; böylece bir ağaç oluşur ve şelale (waterfall) görünümünde hangi adımın ne kadar sürdüğü görülür.

Sihir **context propagation**'dadır: ilk servis (genellikle gateway) bir trace-id üretir ve her giden HTTP isteğine **W3C `traceparent`** başlığı ekler:

```
traceparent: 00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01
             │  └─ trace-id (16 bayt)            └─ parent span-id  └─ flags (01 = örneklendi)
             └─ sürüm
```

Her servis bu başlığı alır, aynı trace-id'yi korur, kendi span'ini açar ve bir sonraki servise **yeni** span-id ile iletir. Mesaj kuyruklarında aynı bilgi mesaj başlıklarında taşınır. Trace'i tam yapan şey, tek bir servisin bile başlığı düşürmemesidir — bu yüzden propagation elle değil **OpenTelemetry** gibi standart bir kütüphaneyle otomatik yapılır.

:::animation{scene="scene.json"}
Gateway trace-id üretir; traceparent başlığı order, inventory ve payment servislerine taşınır; payment'taki yavaş span p99 ihlalinin kaynağını gösterir; span'ler collector'da birleşir ve aynı trace_id log ile metriği birbirine bağlar.
:::

:::interactive{type="request-journey" services="gateway,order-service,inventory-service,payment-service" slowService="payment-service"}
İstek gönderin ve her servisin span'ini şelale görünümünde izleyin. "Yavaş katman" seçimini değiştirin: toplam gecikme servisler arasında nasıl bölünüyor, p99 ihlalinin kaynağı hangi span? Şelalede her span'in bir öncekinin bitişinden başladığına dikkat edin: span'leri aynı zaman çizgisine dizen şey traceparent başlığıdır; bir servis bu başlığı iletmeseydi trace o noktada kopar, sonraki span'ler ayrı bir trace olarak görünürdü.
:::

:::code{lang="ts" title="W3C trace context yayılımı + yapısal log (Express middleware)"}
```ts
import { randomBytes } from "node:crypto";
import { AsyncLocalStorage } from "node:async_hooks";

interface TraceCtx { traceId: string; spanId: string; sampled: boolean }
const als = new AsyncLocalStorage<TraceCtx>();         // istek boyunca bağlamı taşır
const hex = (n: number) => randomBytes(n).toString("hex");

/** Gelen traceparent'ı ayrıştır; yoksa yeni trace başlat (bu servis kök span olur) */
export function traceMiddleware(serviceName: string) {
  return (req: any, res: any, next: any) => {
    const m = /^00-([0-9a-f]{32})-([0-9a-f]{16})-([0-9a-f]{2})$/.exec(req.header("traceparent") ?? "");
    const ctx: TraceCtx = {
      traceId: m ? m[1] : hex(16),                       // aynı trace-id'yi KORU
      spanId: hex(8),                                    // bu servis için YENİ span-id
      sampled: m ? (parseInt(m[3], 16) & 1) === 1 : Math.random() < 0.1,   // %10 head sampling
    };
    const parentSpanId = m ? m[2] : undefined;
    const start = process.hrtime.bigint();
    res.setHeader("x-trace-id", ctx.traceId);           // destek ekibi hata raporuna ekleyebilsin

    als.run(ctx, () => {
      res.on("finish", () => {
        const durationMs = Number(process.hrtime.bigint() - start) / 1e6;
        // Span'i (gerçekte OTel exporter'a) ve isteğin özet logunu yaz
        log("info", "request completed", {
          service: serviceName, span_parent: parentSpanId,
          method: req.method, route: req.route?.path ?? req.path,   // şablon rota: kardinalite güvenli
          status: res.statusCode, duration_ms: Math.round(durationMs),
        });
      });
      next();
    });
  };
}

/** Giden isteklere başlığı ekle: aynı trace, bizim span'imiz parent olur */
export function outgoingHeaders(): Record<string, string> {
  const c = als.getStore();
  if (!c) return {};
  return { traceparent: `00-${c.traceId}-${c.spanId}-${c.sampled ? "01" : "00"}` };
}

/** Yapısal log: her satıra trace_id otomatik eklenir, stdout'a yazılır */
export function log(level: "debug" | "info" | "warn" | "error", msg: string, fields: Record<string, unknown> = {}) {
  const c = als.getStore();
  process.stdout.write(JSON.stringify({
    ts: new Date().toISOString(), level, msg,
    trace_id: c?.traceId, span_id: c?.spanId, ...fields,
  }) + "\n");
}

// Kullanım: app.use(traceMiddleware("order-service"));
//           await fetch("http://payment/charge", { headers: outgoingHeaders() });
```
```python
import json, os, re, sys, time, contextvars
from flask import Flask, request, g

_ctx = contextvars.ContextVar("trace_ctx", default=None)
TP = re.compile(r"^00-([0-9a-f]{32})-([0-9a-f]{16})-([0-9a-f]{2})$")

def log(level, msg, **fields):
    c = _ctx.get() or {}
    sys.stdout.write(json.dumps({"ts": time.time(), "level": level, "msg": msg,
                                 "trace_id": c.get("trace_id"), "span_id": c.get("span_id"), **fields}) + "\n")

def outgoing_headers():
    c = _ctx.get()
    return {"traceparent": f"00-{c['trace_id']}-{c['span_id']}-01"} if c else {}

app = Flask("order-service")

@app.before_request
def start_span():
    m = TP.match(request.headers.get("traceparent", ""))
    _ctx.set({"trace_id": m.group(1) if m else os.urandom(16).hex(),   # aynı trace'i koru
              "span_id": os.urandom(8).hex(),                          # yeni span
              "parent": m.group(2) if m else None})
    g.start = time.perf_counter()

@app.after_request
def end_span(resp):
    log("info", "request completed", route=request.url_rule.rule if request.url_rule else request.path,
        status=resp.status_code, duration_ms=round((time.perf_counter() - g.start) * 1000))
    resp.headers["x-trace-id"] = _ctx.get()["trace_id"]
    return resp
```
:::

## Alarm: belirtiye uyan, sebebe değil

CPU %90 bir sebep olabilir ama kullanıcı CPU'yu görmez; kullanıcı **hata** ve **gecikme** görür. Alarmlar **SLO**'ya bağlanır: "30 günlük hata bütçesinin %5'i son 1 saatte tükendi" (**burn rate** alarmı). Bu, gece 3'te sayfalanan alarm sayısını azaltır ve her alarmı eyleme bağlar. Sebep metrikleri (CPU, kuyruk derinliği, replication lag) alarmda değil, **tanıda** kullanılır.

## 12-Factor App: gözlemlenebilir ve işletilebilir uygulama

2011'de Heroku mühendislerinin yazdığı [12-Factor](https://12factor.net) manifestosu, bulutta çalışan bir servisin taşınabilir, ölçeklenebilir ve işletilebilir olması için 12 ilke tanımlar. Bugün Kubernetes ve container dünyasının varsayılanlarıdır.

| # | İlke | Kısaca | Neden önemli? |
|---|---|---|---|
| I | **Codebase** | Tek kod tabanı, sürüm kontrolünde, çok deploy | Aynı koddan dev/staging/prod |
| II | **Dependencies** | Bağımlılıklar açıkça bildirilir ve izole edilir (`package.json`, lockfile) | "Bende çalışıyor" biter |
| III | **Config** | Konfigürasyon **ortam değişkenlerinde**, kodda değil | Aynı imaj her ortamda; sırlar repoya girmez |
| IV | **Backing services** | DB, cache, kuyruk birer **bağlı kaynak**tır (URL ile) | Yerel Postgres ↔ RDS yalnızca config farkı |
| V | **Build, release, run** | Üç aşama kesin ayrılır; release değiştirilemez | Geri alma = önceki release'i çalıştır |
| VI | **Processes** | Süreçler **stateless** ve paylaşımsız; durum backing service'te | Yatay ölçekleme, sticky session yok |
| VII | **Port binding** | Uygulama kendi portunu dinler, dış sunucuya gömülmez | Container'da tek komutla çalışır |
| VIII | **Concurrency** | Süreç modeliyle ölçeklen (web, worker ayrı tipler) | HPA ile replika sayısı artar |
| IX | **Disposability** | Hızlı başlat, zarif kapat (SIGTERM'de işi bitir) | Deploy ve autoscale güvenli |
| X | **Dev/prod parity** | Ortamlar olabildiğince aynı (aynı DB, aynı imaj) | Üretimde sürpriz azalır |
| XI | **Logs** | Log bir **olay akışıdır**; stdout'a yaz, platform toplar | Structured logging bölümü |
| XII | **Admin processes** | Migration gibi yönetim işleri aynı kod/ortamla tek seferlik süreç | Elle SQL yok |

Gözlemlenebilirlik açısından en kritik üçü: **III** (config ortamdan gelir → her ortam etiketlenebilir), **VI** (stateless → herhangi bir replika bir isteğin yalnızca bir parçasıdır, trace olmadan takip edilemez) ve **XI** (log akışı → merkezi toplama ve trace-id ile ilişkilendirme).

:::realworld{company="Google"}
Dağıtık izlemenin modern biçimi Google'ın 2010 tarihli **Dapper** makalesiyle başladı. Google'da tek bir arama isteği binlerce makineye yayılır; Dapper her isteğe bir trace-id verip RPC kütüphanesine **otomatik** span üretimi ekledi — geliştiricilerin kod değiştirmesine gerek kalmadan tüm servisler izlenir oldu. İki tasarım kararı bugünkü tüm sistemlerin temelidir: (1) **örnekleme**: isteklerin yalnızca küçük bir kısmı (ör. 1/1024) izlenir, çünkü tam izleme gecikme ve depolama maliyetini kabul edilemez kılar; yine de yüksek hacimde örneklem sorunları yakalamaya yeter; (2) **bant dışı toplama**: span'ler isteğin yanıtını bekletmeden yerel ajanla asenkron toplanır. Dapper'dan Zipkin (Twitter), Jaeger (Uber) ve nihayet **OpenTelemetry** standardı doğdu; bugün `traceparent` başlığı Google Cloud Trace, AWS X-Ray ve Datadog arasında bile ortak dildir.
:::

:::callout{tone="tip" title="Mülakat özeti"}
- "Nasıl izlersiniz?" sorusuna üç sütun + **trace-id ile korelasyon** cevabı verin; sadece "log tutarız" demek yetmez.
- Metrik için RED/USE ve **yüzdelikler** (p99), etiketlerde **kardinalite** uyarısı — bunları söylemek sizi ayırır.
- Tracing'i anlatırken `traceparent` yayılımını ve **örneklemeyi** mutlaka ekleyin.
- Alarmı SLO/hata bütçesine bağlayın; CPU alarmına değil.
- 12-factor'dan en az III (config), VI (stateless), XI (log akışı) maddelerini gerekçesiyle sayabilin.
:::

:::quiz{src="quiz.json"}
:::

:::next{lesson="b-01-monolith-to-microservices"}
Modül A tamamlandı. Sırada Modül B: bu yapı taşlarını bir araya getiren mimariler — monolitten modüler monolite, oradan mikroservislere geçişin adımları ve kriterleri.
:::

---
id: a-06-api-gateway
slug: api-gateway
module: a-system-design-fundamentals
order: 6
title:
  tr: "API Gateway"
  en: "API Gateway"
summary:
  tr: Routing, auth, rate limiting, aggregation, circuit breaker; Gateway vs. Reverse Proxy vs. Service Mesh. Bir isteğin gateway içindeki adımları ve circuit breaker'ın açılması animasyonlu.
  en: Routing, auth, rate limiting, aggregation, circuit breaker; Gateway vs. Reverse Proxy vs. Service Mesh. The steps of a request inside the gateway and a circuit breaker tripping, animated.
durationMinutes: 30
level: intermediate
tags: [api-gateway, microservices, reverse-proxy, service-mesh, rate-limiting, circuit-breaker, authentication]
prerequisites: [a-05-load-balancing, a-04-stateless-stateful-sessions]
concepts: [api-gateway, edge-authentication, rate-limiting, request-routing, response-aggregation, circuit-breaker, reverse-proxy, service-mesh, bff-pattern, gateway-bottleneck]
---

## Kavram: mikroservislerin ön kapısı

Tek bir monolitiniz varken istemci bir adrese konuşur. Sistemi 30 mikroservise böldüğünüzde mobil uygulama 30 adresi mi bilecek? Her servis kendi kimlik doğrulamasını mı yazacak? Rate limit her serviste ayrı mı yapılandırılacak? **API Gateway**, tüm dış trafiğin geçtiği tek giriş noktasıdır ve "her serviste tekrar edecek" işleri bir yerde toplar:

1. **Routing**: `/api/orders/*` → sipariş servisi, `/api/users/*` → kullanıcı servisi.
2. **Authentication / Authorization**: Token'ı kenarda doğrula; servisler yalnızca güvenilir trafiği görsün.
3. **Rate limiting & quota**: Kullanıcı/API anahtarı başına istek sınırı.
4. **Aggregation / composition**: Bir istemci isteğini birden çok servise dağıtıp tek yanıtta birleştir.
5. **Resilience**: Zaman aşımı, retry, **circuit breaker**; arızalı servisi izole et.
6. **Protokol çevirisi**: Dışarıda REST/JSON, içeride gRPC; WebSocket sonlandırma.
7. **Gözlemlenebilirlik**: Her isteğe correlation id ekle, log/metrik/trace üret.
8. **Cache, sıkıştırma, TLS sonlandırma, CORS, istek doğrulama**.

Önceki derste gördüğümüz L7 load balancer da path'e göre yönlendirme yapabiliyordu. Gateway'i ayıran şey, isteği yalnızca *iletmek* değil, **anlamak ve dönüştürmek**tir: başlık ekler, gövdeyi doğrular, birden çok çağrıyı orkestre eder.

:::diagram{src="diagram.svg" alt="Dışarıda web, mobil ve üçüncü taraf istemciler; ortada API Gateway içinde sıralı filtreler (TLS, auth, rate limit, routing, aggregation, circuit breaker); sağda sipariş, kullanıcı, ürün servisleri ve altında Redis ile kimlik sağlayıcı|Web, mobile and third-party clients outside; the API Gateway in the middle with an ordered filter chain (TLS, auth, rate limit, routing, aggregation, circuit breaker); order, user and product services on the right with Redis and an identity provider below"}
Gateway bir filtre zinciridir: istek soldan girer, her filtre ya geçirir ya reddeder.
:::

## İsteğin gateway içindeki yolculuğu

Bir `GET /api/orders/123` isteği gateway'de şu sırayla işlenir; sıra önemlidir çünkü **ucuz ve çok reddeden kontroller öne** alınır:

| Sıra | Adım | Reddederse | Neden bu sırada? |
|---|---|---|---|
| 1 | TLS sonlandırma, IP allow/deny, WAF | 403 | En ucuz; kötü niyetli trafiği en erken at |
| 2 | **Authentication** (JWT imzası, API key) | 401 | Kimliksiz isteğe rate limit uygulamak anlamsız |
| 3 | **Rate limiting** (kullanıcı/anahtar başına) | 429 + `Retry-After` | Kimlik belli; artık adil kota uygulanabilir |
| 4 | **Authorization** (rol, scope) | 403 | Bu kullanıcı bu kaynağa erişebilir mi? |
| 5 | İstek doğrulama, dönüştürme | 400 | Şema hatalı isteği servise taşımaya gerek yok |
| 6 | **Routing** + load balancing | 502/503 | Hedef servis örneğini seç |
| 7 | **Circuit breaker / timeout / retry** | 503 (fast-fail) | Hasta servisi koru, kaskad çöküşü engelle |
| 8 | **Aggregation**, yanıt dönüştürme, cache | — | Birden çok yanıtı tek gövdeye birleştir |

Aşağıdaki animasyon bu zinciri ve bir servisin hastalanması durumunda circuit breaker'ın açılmasını gösterir.

:::animation{scene="scene.json"}
Auth → rate limit → routing → aggregation; ardından envanter servisi yavaşlar, hata eşiği aşılır ve devre açılır (fast-fail + fallback).
:::

## Circuit breaker: hasta servisi dinlendirmek

Bir servis yavaşladığında ona istek göndermeye devam etmek iki şeyi kötüleştirir: servis daha da boğulur, gateway'in bağlantı/thread havuzu bekleyen isteklerle dolar ve **sağlıklı** servislere giden istekler de bekler (kaskad çöküş). Circuit breaker üç durumlu bir makinedir:

- **Closed (kapalı)**: Normal; istekler geçer, hata oranı izlenir.
- **Open (açık)**: Son pencerede hata/zaman aşımı oranı eşiği (ör. 10 s'de %50, en az 20 istek) aştı. İstekler servise **gitmez**; anında 503 ya da **fallback** döner (cache'teki eski değer, varsayılan içerik, boş liste).
- **Half-open (yarı açık)**: Bekleme süresi (ör. 30 s) dolunca birkaç deneme isteği geçirilir. Başarılıysa Closed, değilse yeniden Open.

Circuit breaker gateway'de **hedef servis başına** (hatta uç nokta başına) tutulur; envanter servisinin devresi açıkken sipariş servisi normal çalışır. Retry ile birlikte kullanılırken dikkat: devre açıkken retry yapmayın, retry'ları **exponential backoff + jitter** ile sınırlayın; aksi hâlde retry fırtınası toparlanan servisi yeniden düşürür.

:::callout{tone="danger" title="Gateway tek hata noktası olmasın"}
Tüm trafik gateway'den geçiyorsa gateway'in çökmesi her şeyin çökmesidir. Gateway'i **stateless** tutun (rate limit sayaçları Redis'te), birden çok örnek çalıştırın, önüne L4 load balancer koyun ve kendi dağıtımını canary ile yapın. Gateway'e iş mantığı koymaya başladığınız an "dağıtık monolit" kurmuş olursunuz: aggregation evet, sipariş hesaplama hayır.
:::

## Aggregation ve BFF

Mobil bir sipariş detay ekranı sipariş, kullanıcı ve ürün servislerinden veri ister. İstemcinin üç ayrı istek atması hem RTT'yi üçe katlar hem mobil pili yer. Gateway üç çağrıyı **paralel** yapar ve tek JSON döner. Bu kalıp büyüyünce istemci türü başına özel bir gateway katmanına dönüşür: **Backend for Frontend (BFF)**. Web BFF geniş yanıtlar, mobil BFF küçük ve sıkıştırılmış yanıtlar üretir; her BFF'i o istemcinin ekibi sahiplenir. Aggregation'ın bedeli: gateway artık servislerin veri şekline bağımlıdır ve en yavaş servis yanıtı belirler (önceki dersteki kuyruk gecikmesi büyümesi!). Zaman aşımı ve kısmi yanıt (ürün bilgisi gelmediyse `null` dön) şarttır.

## Gateway vs. Reverse Proxy vs. Service Mesh

Üçü de "araya giren" bileşenlerdir ve sık karıştırılır:

| | **Reverse Proxy** | **API Gateway** | **Service Mesh** |
|---|---|---|---|
| Nerede durur? | Servisin önünde (kuzey-güney) | Tüm sistemin dış kapısında (kuzey-güney) | Her servisin yanında sidecar (doğu-batı) |
| Trafik | Dış → iç | Dış → iç | İç ↔ iç (servisler arası) |
| İsteği anlar mı? | Sınırlı (path, header) | Evet (auth, gövde, aggregation) | Evet ama uygulama mantığı yok |
| Tipik işler | TLS, cache, sıkıştırma, LB | Auth, rate limit, routing, composition, API yaşam döngüsü | mTLS, retry, circuit breaker, tracing, trafik bölme |
| Yapılandırma | Statik (nginx.conf) | API tanımları, politikalar | Kontrol düzlemi (Istio, Linkerd) |
| Örnekler | NGINX, HAProxy, Envoy | Kong, AWS API Gateway, Apigee, Zuul, Envoy Gateway | Istio, Linkerd, Consul Connect |
| Ne zaman? | Her zaman (ucuz, basit) | Çok istemci + çok servis | Onlarca servis, servisler arası güvenlik/gözlem ihtiyacı |

Pratikte üçü üst üste bulunur: dışarıda L4 LB → gateway (kendisi Envoy tabanlı bir reverse proxy olabilir) → mesh sidecar'lı servisler. Mesh, gateway'in yaptığı retry/circuit breaker/mTLS işlerini **servisler arası** trafiğe taşır; gateway dış dünyayla ilgilenmeye devam eder.

:::interactive{type="request-journey" stages="tls,auth,rate-limit,routing,aggregation,circuit-breaker" failureStage="aggregation" errorThreshold=0.5 windowSec=10}
Bir istek gönderip zincirdeki adımları izleyin. Geçersiz token ile 401, limit aşımıyla 429 aldığınızı görün. "Envanter servisini yavaşlat" düğmesiyle hata oranını eşiğin üstüne çıkarın: devre açıldığında isteklerin servise gitmeden fallback ile döndüğünü, half-open denemesinin başarılı olunca devrenin kapandığını izleyin.
:::

:::code{lang="ts" title="Gateway filtre zinciri: auth → rate limit → routing → circuit breaker"}
```ts
import type { Redis } from "ioredis";

type Ctx = { req: Request; user?: { id: string; scopes: string[] }; route?: Route };
type Route = { prefix: string; upstream: string; breaker: CircuitBreaker };
type Filter = (ctx: Ctx, next: () => Promise<Response>) => Promise<Response>;

/* ---- Circuit breaker: closed → open → half-open ---- */
export class CircuitBreaker {
  private state: "closed" | "open" | "half-open" = "closed";
  private failures = 0;
  private total = 0;
  private openedAt = 0;

  constructor(private readonly opt = { threshold: 0.5, minRequests: 20, openMs: 30_000, windowMs: 10_000 }) {
    setInterval(() => { this.failures = 0; this.total = 0; }, opt.windowMs).unref(); // kayan pencere (basitleştirilmiş)
  }

  async exec<T>(call: () => Promise<T>, fallback: () => T): Promise<T> {
    if (this.state === "open") {
      if (Date.now() - this.openedAt < this.opt.openMs) return fallback();   // fast-fail: servise hiç gitme
      this.state = "half-open";                                              // bekleme bitti, bir deneme izni
    }
    try {
      const result = await call();
      if (this.state === "half-open") this.state = "closed";                 // deneme başarılı → devre kapandı
      this.total++;
      return result;
    } catch (err) {
      this.total++; this.failures++;
      if (this.state === "half-open" || (this.total >= this.opt.minRequests && this.failures / this.total >= this.opt.threshold)) {
        this.state = "open"; this.openedAt = Date.now();                     // eşik aşıldı → devre açık
      }
      return fallback();
    }
  }
}

/* ---- Filtreler ---- */
export const authFilter = (verify: (t: string) => Ctx["user"] | null): Filter => async (ctx, next) => {
  const token = ctx.req.headers.get("authorization")?.replace(/^Bearer /, "");
  const user = token ? verify(token) : null;                                 // imza + exp kontrolü, depo yok
  if (!user) return new Response("unauthorized", { status: 401 });
  ctx.user = user;
  return next();
};

export const rateLimitFilter = (redis: Redis, limit = 100, windowS = 60): Filter => async (ctx, next) => {
  const key = `rl:${ctx.user!.id}:${Math.floor(Date.now() / 1000 / windowS)}`;  // sabit pencere, kullanıcı başına
  const count = await redis.incr(key);
  if (count === 1) await redis.expire(key, windowS);
  if (count > limit) return new Response("too many requests", { status: 429, headers: { "Retry-After": String(windowS) } });
  return next();
};

export const routingFilter = (routes: Route[]): Filter => async (ctx, next) => {
  const path = new URL(ctx.req.url).pathname;
  ctx.route = routes.find((r) => path.startsWith(r.prefix));
  if (!ctx.route) return new Response("not found", { status: 404 });
  return next();
};

export const proxyFilter: Filter = async (ctx) => {
  const { upstream, breaker, prefix } = ctx.route!;
  const url = new URL(ctx.req.url);
  const target = upstream + url.pathname.slice(prefix.length) + url.search;
  return breaker.exec(
    async () => {
      const res = await fetch(target, { method: ctx.req.method, headers: { ...Object.fromEntries(ctx.req.headers), "x-user-id": ctx.user!.id, "x-request-id": crypto.randomUUID() }, signal: AbortSignal.timeout(2_000) });
      if (res.status >= 500) throw new Error(`upstream ${res.status}`);     // 5xx ve timeout hata sayılır
      return res;
    },
    () => new Response(JSON.stringify({ error: "service unavailable", fallback: true }), { status: 503, headers: { "content-type": "application/json" } }),
  );
};

/* ---- Zinciri çalıştır ---- */
export function compose(filters: Filter[]) {
  return (req: Request): Promise<Response> => {
    const ctx: Ctx = { req };
    const run = (i: number): Promise<Response> => (i < filters.length ? filters[i](ctx, () => run(i + 1)) : Promise.resolve(new Response("no handler", { status: 500 })));
    return run(0);
  };
}
```
```python
import time

class CircuitBreaker:
    """closed → open → half-open; hedef servis başına bir örnek tutulur."""
    def __init__(self, threshold=0.5, min_requests=20, open_s=30):
        self.state, self.failures, self.total, self.opened_at = "closed", 0, 0, 0.0
        self.threshold, self.min_requests, self.open_s = threshold, min_requests, open_s

    def exec(self, call, fallback):
        if self.state == "open":
            if time.time() - self.opened_at < self.open_s:
                return fallback()                     # fast-fail: servise gitme
            self.state = "half-open"                  # bir deneme izni
        try:
            result = call()
            if self.state == "half-open":
                self.state = "closed"
            self.total += 1
            return result
        except Exception:
            self.total += 1; self.failures += 1
            if self.state == "half-open" or (self.total >= self.min_requests and self.failures / self.total >= self.threshold):
                self.state, self.opened_at = "open", time.time()
            return fallback()
```
:::

:::realworld{company="Netflix"}
Netflix'in **Zuul** gateway'i, mikroservis dünyasındaki en çok incelenen gateway örneklerinden biridir. Her istek *pre* (auth, rate limit, routing kararı), *route* (origin'e iletme) ve *post* (yanıt başlıkları, metrik) filtre gruplarından geçer; filtreler çalışma zamanında, yeniden dağıtım yapmadan eklenip çıkarılabilir — bir olay sırasında belirli bir istemci sürümünü anında kısıtlamak için bu kullanılır. Circuit breaker ve bulkhead için Netflix'in açık kaynaklı **Hystrix** kütüphanesi doğdu; Hystrix her bağımlılığa ayrı bir thread havuzu vererek envanter servisinin takılmasının öneri servisini etkilemesini engelledi. Zuul 2 ile Netflix, bloklayan thread-per-request modelinden olay güdümlü (Netty) modele geçti; nedeni, bir origin yavaşladığında binlerce thread'in beklemede kilitlenmesiydi — gateway'in kendisi kaskad çöküşün parçası oluyordu. Bugün aynı işlevlerin çoğu Envoy tabanlı gateway'lerde ve Istio gibi mesh'lerde yerleşik olarak gelir.
:::

:::callout{tone="tip" title="Mülakat ipuçları"}
- "API Gateway koyarım" dedikten sonra **hangi sorumlulukları** vereceğinizi sayın; auth ve rate limit'i kenara çekmenin servisleri nasıl sadeleştirdiğini anlatın.
- Gateway ile L7 LB / reverse proxy farkını bir cümlede verin: proxy iletir, gateway anlar ve dönüştürür. Mesh'i "servisler arası (doğu-batı) aynı işler" diye konumlandırın.
- Circuit breaker'ın **üç durumunu** ve eşiklerini (hata oranı, minimum istek, bekleme süresi) ezbere bilin; fallback örneği verin.
- Gateway'in SPOF ve gecikme eklediğini kendiniz söyleyin; çözümü (stateless, çoklu örnek, Redis'te sayaç) ekleyin.
:::

:::quiz{src="quiz.json"}
:::

:::next{lesson="a-07-caching"}
Sırada: gateway'in de uyguladığı ama tüm katmanlara yayılan en güçlü hızlandırıcı — caching katmanları ve stratejileri.
:::

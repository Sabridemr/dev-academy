---
id: c-04-distributed-patterns
slug: distributed-patterns
module: c-design-patterns
order: 4
title:
  tr: "Dağıtık Sistem Kalıpları: Circuit Breaker, Retry+Backoff, Bulkhead, Sidecar, Strangler Fig, Outbox"
  en: "Distributed Patterns: Circuit Breaker, Retry+Backoff, Bulkhead, Sidecar, Strangler Fig, Outbox"
summary:
  tr: Dayanıklılık ve geçiş kalıpları.
  en: Resilience and migration patterns.
durationMinutes: 55
level: advanced
tags: [design-patterns, distributed-systems, resilience, circuit-breaker, retry, bulkhead, sidecar, strangler-fig, outbox, typescript]
prerequisites: [c-03-behavioral-patterns, b-02-microservice-communication, a-06-api-gateway]
concepts: [circuit-breaker, retry-backoff, jitter, bulkhead, cascading-failure, sidecar, service-mesh, strangler-fig, outbox, dual-write, idempotency, fail-fast]
---

## Kavram: ağ güvenilmez, süreçler çöker, saatler kayar

GoF kalıpları tek süreç içindeki nesnelerin ilişkisini düzenler. Ağ araya girdiğinde üç yeni gerçekle yaşarsınız: **çağrı kaybolabilir**, **karşı taraf yavaşlayabilir** ve **iki sistemi aynı anda güncelleyemezsiniz**. Dağıtık sistem kalıpları bu üç gerçeğe karşı on yıllardır biriken cevaplardır. Hepsinin ortak ilkesi şudur: **hatayı erken, ucuz ve sınırlı biçimde ver; hiç hata vermemeye çalışma.**

| Kalıp | Soru | Grup |
|---|---|---|
| **Circuit Breaker** | Hasta bir servise çağrı yığmayı nasıl durdururum? | Dayanıklılık |
| **Retry + Exponential Backoff (jitter)** | Geçici bir hatayı, servisi daha da boğmadan nasıl aşarım? | Dayanıklılık |
| **Bulkhead** | Bir bağımlılığın yavaşlığı diğer akışları nasıl batırmaz? | Dayanıklılık |
| **Sidecar** | Bu korumaları her dilde yeniden yazmadan nasıl sağlarım? | Platform |
| **Strangler Fig** | Monoliti büyük patlama olmadan nasıl değiştiririm? | Geçiş |
| **Transactional Outbox** | Veritabanına yazıp olayı yayınlamayı nasıl atomik yaparım? | Tutarlılık |

:::diagram{src="diagram.svg" alt="Altı dağıtık sistem kalıbının karşılaştırma haritası: dayanıklılık, platform, geçiş ve tutarlılık grupları ve bir çağrıdaki katman sırası|Comparison map of the six distributed patterns: resilience, platform, migration and consistency groups, plus the layer order in a single call"}
Bir uzak çağrıda katman sırası: Bulkhead → Circuit Breaker → Retry → Timeout → ağ. Yazma + olay için Outbox; geçiş için Strangler Fig; hepsini koddan çıkarmak için Sidecar.
:::

:::animation{scene="scene.json"}
OrderService'in tek bir ödeme çağrısı: bulkhead izni, breaker kararı, jitter'lı retry, sidecar'a taşıma, outbox ile olay yayını ve strangler fig bağlamı.
:::

:::interactive{type="rate-limiter" algorithm="token-bucket" capacity=100 refillPerSecond=50 clients=200 retryMode="exponential-jitter" showThunderingHerd=true}
Servisin önünde bir token bucket var. 200 istemciyi aynı anda hata aldırın ve yeniden deneme modunu değiştirin: sabit aralık, üstel geri çekilme (jitter yok) ve full jitter. Her modda kovanın doluluk eğrisini, reddedilen istek sayısını ve toparlanma süresini karşılaştırın; "thundering herd" dalgalarını jitter'ın nasıl dağıttığını görün.
:::

---

## 1. Circuit Breaker

**Niyet**: Başarısız olma olasılığı yüksek bir işlemi tekrar tekrar denemeyi engellemek; hasta servise nefes aldırmak ve çağıranın kaynaklarını korumak.

Elektrik sigortasından esinlenir. Üç durum vardır:

- **CLOSED**: Çağrılar geçer, sonuçlar sayılır. Hata oranı eşiği aşınca → OPEN.
- **OPEN**: Çağrılar ağa çıkmadan anında reddedilir (`CircuitOpenError`), fallback çalışır. Süre dolunca → HALF-OPEN.
- **HALF-OPEN**: Sınırlı sayıda deneme çağrısı geçer. Başarılıysa → CLOSED, başarısızsa → OPEN.

Üretimde eşik "ardışık N hata" değil, **kayan pencerede hata oranı + minimum istek sayısı** olarak tanımlanır (örn. son 10 s'de en az 20 istek ve %50 hata); aksi hâlde düşük trafikte tek bir hata breaker'ı açar.

:::diagram{src="uml-circuit-breaker.svg" alt="Circuit Breaker UML: CircuitBreaker sınıfı, BreakerState arayüzü ve Closed, Open, HalfOpen durumları|Circuit Breaker UML: the CircuitBreaker class, the BreakerState interface and the Closed, Open, HalfOpen states"}
Breaker'ın içi bir State kalıbıdır (c-03).
:::

:::animation{scene="circuit-breaker.scene.json"}
CLOSED → hatalar birikir → OPEN (hızlı hata, fallback) → HALF-OPEN (tek deneme) → CLOSED.
:::

:::code{lang="ts" title="Circuit Breaker: kayan pencere, üç durum, fallback"}
```ts
type State = 'CLOSED' | 'OPEN' | 'HALF_OPEN';

export interface BreakerOptions {
  windowMs: number;          // hata oranının ölçüldüğü pencere
  minRequests: number;       // oranın anlamlı olması için en az istek
  failureRateThreshold: number; // 0..1
  openForMs: number;         // OPEN'da kalma süresi
  halfOpenMaxCalls: number;  // HALF_OPEN'da izin verilen deneme sayısı
}

export class CircuitOpenError extends Error { constructor(name: string) { super(`circuit ${name} is open`); } }

export class CircuitBreaker {
  private state: State = 'CLOSED';
  private results: { at: number; ok: boolean }[] = [];
  private openedAt = 0;
  private halfOpenInFlight = 0;

  constructor(private readonly name: string, private readonly opts: BreakerOptions, private readonly now = () => Date.now()) {}

  async call<T>(fn: () => Promise<T>, fallback?: () => Promise<T>): Promise<T> {
    if (!this.allowRequest()) {
      metrics.increment('breaker.rejected', { name: this.name });
      if (fallback) return fallback();
      throw new CircuitOpenError(this.name);
    }
    try {
      const result = await fn();
      this.record(true);
      return result;
    } catch (err) {
      this.record(false);
      if (fallback && this.state === 'OPEN') return fallback();
      throw err;
    }
  }

  private allowRequest(): boolean {
    if (this.state === 'CLOSED') return true;
    if (this.state === 'OPEN') {
      if (this.now() - this.openedAt < this.opts.openForMs) return false;
      this.transition('HALF_OPEN');                         // süre doldu: deneme izni
    }
    if (this.halfOpenInFlight >= this.opts.halfOpenMaxCalls) return false;
    this.halfOpenInFlight++;
    return true;
  }

  private record(ok: boolean) {
    const t = this.now();
    this.results.push({ at: t, ok });
    this.results = this.results.filter((r) => t - r.at <= this.opts.windowMs);   // kayan pencere

    if (this.state === 'HALF_OPEN') {
      this.halfOpenInFlight--;
      return this.transition(ok ? 'CLOSED' : 'OPEN');       // tek deneme karar verir
    }
    if (this.results.length < this.opts.minRequests) return;
    const failureRate = this.results.filter((r) => !r.ok).length / this.results.length;
    if (failureRate >= this.opts.failureRateThreshold) this.transition('OPEN');
  }

  private transition(next: State) {
    if (next === this.state) return;
    metrics.gauge('breaker.state', next === 'CLOSED' ? 0 : next === 'HALF_OPEN' ? 1 : 2, { name: this.name });
    this.state = next;
    if (next === 'OPEN') this.openedAt = this.now();
    if (next === 'CLOSED') this.results = [];
    if (next !== 'HALF_OPEN') this.halfOpenInFlight = 0;
  }
}

// Kullanım
const paymentsBreaker = new CircuitBreaker('payments', { windowMs: 10_000, minRequests: 20, failureRateThreshold: 0.5, openForMs: 30_000, halfOpenMaxCalls: 1 });
const result = await paymentsBreaker.call(
  () => http.post('/charges', body, { timeout: 2_000 }),
  async () => { await pendingQueue.enqueue(body); return { status: 'PENDING' }; },   // fallback
);
```
```python
import time

class CircuitBreaker:
    def __init__(self, name, window_s=10, min_requests=20, threshold=0.5, open_for_s=30):
        self.name, self.window, self.min_req, self.threshold, self.open_for = name, window_s, min_requests, threshold, open_for_s
        self.state, self.results, self.opened_at = "CLOSED", [], 0.0

    def call(self, fn, fallback=None):
        if not self._allow():
            if fallback: return fallback()
            raise CircuitOpenError(self.name)
        try:
            r = fn(); self._record(True); return r
        except TransientError:
            self._record(False)
            if fallback and self.state == "OPEN": return fallback()
            raise

    def _allow(self):
        if self.state == "CLOSED": return True
        if self.state == "OPEN":
            if time.monotonic() - self.opened_at < self.open_for: return False
            self.state = "HALF_OPEN"
        return True                                   # HALF_OPEN: tek deneme

    def _record(self, ok):
        now = time.monotonic()
        self.results = [(t, o) for t, o in self.results if now - t <= self.window] + [(now, ok)]
        if self.state == "HALF_OPEN":
            self.state = "CLOSED" if ok else "OPEN"; self.opened_at = now; return
        if len(self.results) >= self.min_req and sum(1 for _, o in self.results if not o) / len(self.results) >= self.threshold:
            self.state, self.opened_at = "OPEN", now
```
```java
// Üretimde Resilience4j tercih edilir; çekirdek fikir:
public final class CircuitBreaker {
    enum State { CLOSED, OPEN, HALF_OPEN }
    private volatile State state = State.CLOSED;
    private final Deque<long[]> results = new ArrayDeque<>();     // [timestamp, ok]
    private long openedAt;
    private final long windowMs = 10_000, openForMs = 30_000; private final int minRequests = 20; private final double threshold = 0.5;

    public <T> T call(Supplier<T> fn, Supplier<T> fallback) {
        if (!allow()) { if (fallback != null) return fallback.get(); throw new CircuitOpenException(); }
        try { T r = fn.get(); record(true); return r; }
        catch (TransientException e) { record(false); if (fallback != null && state == State.OPEN) return fallback.get(); throw e; }
    }
    private synchronized boolean allow() {
        if (state == State.CLOSED) return true;
        if (state == State.OPEN) { if (System.currentTimeMillis() - openedAt < openForMs) return false; state = State.HALF_OPEN; }
        return true;
    }
    private synchronized void record(boolean ok) {
        long now = System.currentTimeMillis();
        results.addLast(new long[]{now, ok ? 1 : 0});
        while (!results.isEmpty() && now - results.peekFirst()[0] > windowMs) results.pollFirst();
        if (state == State.HALF_OPEN) { state = ok ? State.CLOSED : State.OPEN; openedAt = now; return; }
        long failures = results.stream().filter(r -> r[1] == 0).count();
        if (results.size() >= minRequests && (double) failures / results.size() >= threshold) { state = State.OPEN; openedAt = now; }
    }
}
// Resilience4j: CircuitBreakerConfig.custom().slidingWindowSize(100).failureRateThreshold(50).waitDurationInOpenState(Duration.ofSeconds(30))
```
:::

**Ne zaman kullan**
- Uzak bağımlılığa yapılan her senkron çağrıda; özellikle çağıranın kendisi de başka servislerin bağımlılığıysa (zincirleme çökmeyi kırar).
- Anlamlı bir fallback tanımlanabildiğinde: önbellekten eski veri, varsayılan değer, kuyruğa alıp sonra işleme, "şu an kullanılamıyor" mesajı.

**Ne zaman kullanma**
- Fallback yoksa ve istek zaten başarısız olacaksa breaker yalnızca hatayı hızlandırır; yine de kaynak koruması için değerlidir, ama "çözüm" sanmayın.
- Süreç içi, ağ içermeyen çağrılarda.
- Breaker'ı bağımlılık **başına** kurun; tüm HTTP çağrılarını tek breaker'a bağlamak, bir servisin hastalığının hepsini kapatmasına yol açar.

---

## 2. Retry + Exponential Backoff (jitter)

**Niyet**: Geçici hataları (timeout, 503, 429, bağlantı reseti) servisi daha da boğmadan, giderek artan ve rastgeleleştirilmiş aralıklarla yeniden deneyerek aşmak.

Üç bileşen zorunludur:

1. **Hata sınıflandırması**: Yalnızca geçici hatalar yeniden denenir. 400/401/404 asla; 409/422 duruma göre; 429 ve 503'te varsa `Retry-After` başlığına uyulur.
2. **İdempotency**: İlk deneme aslında işlenmiş olabilir. Yeniden denenen işlem ya doğal olarak idempotent olmalı (GET, PUT) ya da bir **Idempotency-Key** taşımalıdır (POST /charges).
3. **Backoff + jitter**: Bekleme `min(cap, base·2ⁿ)` ile büyür; **full jitter** bu üst sınır içinde rastgele seçer: `rand(0, min(cap, base·2ⁿ))`. Jitter olmadan aynı anda hata alan tüm istemciler aynı anda geri döner ve toparlanan servisi dalga dalga tekrar düşürür (**thundering herd**).

Ayrıca **retry bütçesi** (toplam trafiğin %10'undan fazlası yeniden deneme olmasın) ve **her denemenin kendi zaman aşımı** gerekir; breaker açıkken retry yapılmaz.

:::diagram{src="uml-retry.svg" alt="Retry UML: RetryPolicy sınıfı, BackoffStrategy arayüzü, FullJitter ve DecorrelatedJitter|Retry UML: the RetryPolicy class, the BackoffStrategy interface, FullJitter and DecorrelatedJitter"}
:::

:::animation{scene="retry-backoff.scene.json"}
503 → rand(0,100) ms → 503 → rand(0,200) ms → başarı; sonra jitter kapatılınca thundering herd.
:::

:::code{lang="ts" title="Retry: geçici hata sınıflandırması, full jitter, Retry-After, idempotency anahtarı"}
```ts
export interface RetryOptions {
  maxAttempts: number;    // toplam deneme (ilk dahil)
  baseMs: number;
  capMs: number;
  retryOn: (err: unknown) => boolean;
  onRetry?: (attempt: number, delayMs: number, err: unknown) => void;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Full jitter: AWS Architecture Blog'un önerdiği, çarpışmayı en çok dağıtan strateji */
export function fullJitter(attempt: number, baseMs: number, capMs: number): number {
  const ceiling = Math.min(capMs, baseMs * 2 ** attempt);
  return Math.floor(Math.random() * ceiling);
}

export function isTransient(err: unknown): boolean {
  if (err instanceof HttpError) return err.status === 429 || err.status === 503 || err.status === 502 || err.status === 504;
  if (err instanceof Error) return ['ETIMEDOUT', 'ECONNRESET', 'EAI_AGAIN'].includes((err as NodeJS.ErrnoException).code ?? '');
  return false;
}

export async function retry<T>(fn: (attempt: number) => Promise<T>, o: RetryOptions): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await fn(attempt);
    } catch (err) {
      const last = attempt + 1 >= o.maxAttempts;
      if (last || !o.retryOn(err)) throw err;                               // kalıcı hata ya da bütçe bitti
      const serverHint = err instanceof HttpError ? err.retryAfterMs : undefined;
      const delay = serverHint ?? fullJitter(attempt, o.baseMs, o.capMs);  // sunucu söylüyorsa ona uy
      o.onRetry?.(attempt + 1, delay, err);
      await sleep(delay);
    }
  }
}

// Kullanım: idempotency anahtarı TÜM denemelerde aynı
const idempotencyKey = `order-${orderId}-reserve`;
const reservation = await retry(
  () => http.post('/reservations', items, { headers: { 'Idempotency-Key': idempotencyKey }, timeout: 1_500 }),
  { maxAttempts: 4, baseMs: 100, capMs: 5_000, retryOn: isTransient, onRetry: (n, d) => metrics.increment('retry', { n }) },
);
```
```python
import random, time

def full_jitter(attempt, base, cap):
    return random.uniform(0, min(cap, base * 2 ** attempt))

def is_transient(err):
    return isinstance(err, HttpError) and err.status in (429, 502, 503, 504) or isinstance(err, (TimeoutError, ConnectionResetError))

def retry(fn, max_attempts=4, base=0.1, cap=5.0, retry_on=is_transient):
    for attempt in range(max_attempts):
        try:
            return fn(attempt)
        except Exception as err:
            if attempt + 1 >= max_attempts or not retry_on(err):
                raise
            delay = getattr(err, "retry_after", None) or full_jitter(attempt, base, cap)
            time.sleep(delay)

key = f"order-{order_id}-reserve"
retry(lambda n: http.post("/reservations", json=items, headers={"Idempotency-Key": key}, timeout=1.5))
# Kütüphane: tenacity → @retry(wait=wait_random_exponential(multiplier=0.1, max=5), stop=stop_after_attempt(4), retry=retry_if_exception(is_transient))
```
```java
public final class Retry {
    public static <T> T run(IntFunction<T> fn, int maxAttempts, long baseMs, long capMs, Predicate<Throwable> retryOn) throws Exception {
        for (int attempt = 0; ; attempt++) {
            try { return fn.apply(attempt); }
            catch (Exception err) {
                if (attempt + 1 >= maxAttempts || !retryOn.test(err)) throw err;
                long ceiling = Math.min(capMs, baseMs * (1L << attempt));
                long delay = (err instanceof HttpException h && h.retryAfterMs() > 0) ? h.retryAfterMs() : ThreadLocalRandom.current().nextLong(ceiling + 1);   // full jitter
                Thread.sleep(delay);
            }
        }
    }
}
// String key = "order-" + orderId + "-reserve";
// Retry.run(n -> http.post("/reservations", items, Map.of("Idempotency-Key", key), Duration.ofMillis(1500)), 4, 100, 5000, Retry::isTransient);
// Resilience4j: RetryConfig.custom().maxAttempts(4).intervalFunction(IntervalFunction.ofExponentialRandomBackoff(100, 2.0, 0.5))
```
:::

**Ne zaman kullan**
- Geçici hata olasılığı olan her ağ çağrısında, idempotency garantisiyle birlikte.
- Kuyruk tüketicilerinde (mesaj yeniden teslim) ve arka plan işlerinde.

**Ne zaman kullanma**
- İdempotent olmayan işlemlerde anahtar olmadan: çift çekim, çift sipariş.
- Kullanıcı yanıt beklerken uzun backoff: toplam süre bütçesini (örn. 3 s) aşmayın; aşıyorsa hızlı hata verip kullanıcıya bırakın.
- Zincirin her katmanında ayrı retry: A 3×, B 3×, C 3× → 27 kat yük (**retry amplification**). Yeniden denemeyi tek katmanda (genelde en dışta ya da sidecar'da) yapın.

---

## 3. Bulkhead

**Niyet**: Sistemin bileşenlerini birbirinden izole etmek; bir bileşenin arızası diğerlerinin kaynaklarını tüketemesin.

Gemi gövdesindeki su geçirmez bölmelerden adını alır. Her bağımlılığa ayrı bir **eşzamanlılık havuzu** (semafor, iş parçacığı havuzu, bağlantı havuzu) ayrılır. Yavaşlayan öneri servisi en fazla kendi 5 iznini doldurur; ödeme çağrıları 20 izinlik kendi bölmesinde devam eder. Bölme dolunca yeni çağrı ya kısa bir kuyrukta bekler ya da **anında reddedilir** ve fallback çalışır.

Boyutlandırma Little yasasıyla yapılır: gereken eşzamanlılık ≈ istek hızı × ortalama süre (λ × W). Saniyede 100 istek ve 80 ms ortalama süre → 8 eşzamanlı; güvenlik payıyla 20.

:::diagram{src="uml-bulkhead.svg" alt="Bulkhead UML: Bulkhead sınıfı, BulkheadRegistry ve bağımlılık başına örnekler|Bulkhead UML: the Bulkhead class, BulkheadRegistry and per-dependency instances"}
:::

:::animation{scene="bulkhead.scene.json"}
İki bölme → öneri servisi yavaşlar → bölme dolar, hızlı ret → ödeme etkilenmez → bölme olmasaydı zincirleme çökme.
:::

:::code{lang="ts" title="Bulkhead: semafor + sınırlı kuyruk, bağımlılık başına"}
```ts
export class BulkheadFullError extends Error { constructor(name: string) { super(`bulkhead ${name} is full`); } }

export class Bulkhead {
  private inFlight = 0;
  private readonly waiters: { resolve: () => void; reject: (e: Error) => void; timer: NodeJS.Timeout }[] = [];

  constructor(readonly name: string, private readonly maxConcurrent: number, private readonly maxQueue = 0, private readonly maxWaitMs = 500) {}

  async run<T>(fn: () => Promise<T>): Promise<T> {
    await this.acquire();
    try { return await fn(); }
    finally { this.release(); }
  }

  private acquire(): Promise<void> {
    if (this.inFlight < this.maxConcurrent) { this.inFlight++; return Promise.resolve(); }
    if (this.waiters.length >= this.maxQueue) {
      metrics.increment('bulkhead.rejected', { name: this.name });
      return Promise.reject(new BulkheadFullError(this.name));            // anında ret: iş parçacığı tutma
    }
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {                                     // kuyrukta sonsuza dek bekleme
        this.waiters.splice(this.waiters.findIndex((w) => w.timer === timer), 1);
        reject(new BulkheadFullError(this.name));
      }, this.maxWaitMs);
      this.waiters.push({ resolve, reject, timer });
    });
  }

  private release() {
    const next = this.waiters.shift();
    if (next) { clearTimeout(next.timer); next.resolve(); }                // izin devredilir, inFlight sabit kalır
    else this.inFlight--;
  }

  snapshot() { return { inFlight: this.inFlight, queued: this.waiters.length, max: this.maxConcurrent }; }
}

// Bağımlılık başına bölme; kritik yola büyük, "olsa iyi olur"a küçük ve kuyruksuz
const bulkheads = {
  payments: new Bulkhead('payments', 20, 50),
  recommendations: new Bulkhead('recommendations', 5, 0),
};

const recs = await bulkheads.recommendations
  .run(() => recClient.suggest(userId))
  .catch((e) => (e instanceof BulkheadFullError ? [] : Promise.reject(e)));   // fallback: önerisiz sayfa
```
```python
import asyncio

class Bulkhead:
    def __init__(self, name, max_concurrent, max_queue=0, max_wait=0.5):
        self.name, self._sem = name, asyncio.Semaphore(max_concurrent)
        self.max_queue, self.max_wait, self._queued = max_queue, max_wait, 0

    async def run(self, coro_fn):
        if self._sem.locked() and self._queued >= self.max_queue:
            raise BulkheadFull(self.name)                       # anında ret
        self._queued += 1
        try:
            await asyncio.wait_for(self._sem.acquire(), timeout=self.max_wait)
        except asyncio.TimeoutError:
            raise BulkheadFull(self.name)
        finally:
            self._queued -= 1
        try:
            return await coro_fn()
        finally:
            self._sem.release()

payments = Bulkhead("payments", 20, 50)
recommendations = Bulkhead("recommendations", 5, 0)
```
```java
public final class Bulkhead {
    private final String name; private final Semaphore permits; private final long maxWaitMs;
    public Bulkhead(String name, int maxConcurrent, long maxWaitMs) { this.name = name; this.permits = new Semaphore(maxConcurrent, true); this.maxWaitMs = maxWaitMs; }

    public <T> T run(Callable<T> fn) throws Exception {
        if (!permits.tryAcquire(maxWaitMs, TimeUnit.MILLISECONDS)) throw new BulkheadFullException(name);
        try { return fn.call(); } finally { permits.release(); }
    }
}
// Alternatif: bağımlılık başına ayrı ExecutorService (thread pool bulkhead) — Hystrix'in varsayılanı buydu.
// Resilience4j: BulkheadConfig.custom().maxConcurrentCalls(20).maxWaitDuration(Duration.ofMillis(500))
// Kubernetes düzeyinde: pod başına CPU/bellek limiti ve ayrı deployment'lar da birer bulkhead'dir.
```
:::

**Ne zaman kullan**
- Bir serviste birden çok uzak bağımlılık varsa (hemen her mikroservis).
- Kritik ve kritik olmayan akışlar aynı süreçte yaşıyorsa (ödeme vs. öneri).
- Çok kiracılı sistemlerde kiracı başına kapasite ayırmak için (gürültülü komşu problemi).

**Ne zaman kullanma**
- Tek bağımlılık ve tek akış varsa bölme anlamsızdır; genel eşzamanlılık limiti yeter.
- Bölmeleri çok küçük tutmak kapasiteyi boşa harcar; metriklerle (ret oranı, kuyruk süresi) ayarlayın.

---

## 4. Sidecar

**Niyet**: Bir uygulamanın yardımcı işlevlerini (ağ dayanıklılığı, güvenlik, gözlemlenebilirlik) aynı dağıtım biriminde çalışan ayrı bir sürece taşımak.

Motosiklet sepeti gibi: sidecar, uygulama konteyneriyle **aynı pod'da** çalışır, aynı ağ ad alanını (localhost) ve diskleri paylaşır ama ayrı bir süreçtir. Uygulama düz HTTP ile `localhost`'a konuşur; sidecar proxy (Envoy, Linkerd-proxy) mTLS, retry, circuit breaker, timeout, yük dengeleme, metrik ve dağıtık izleme başlıklarını üstlenir ve karşı tarafın sidecar'ına bağlanır. Sidecar'ların tamamı bir **kontrol düzlemi** (Istio'da istiod) tarafından yapılandırılır; bu bütüne **service mesh** denir.

Kazanç: Java, Go ve Python servisleri **aynı politikayı** kodlarını değiştirmeden alır; politika merkezden anında güncellenir; güvenlik (mTLS, yetki) platforma iner. Bedel: pod başına ek bellek/CPU, çağrı başına ~1 ms ek gecikme, bir bileşen daha (sidecar sürümleri, yükseltme sırası) ve hata ayıklamada bir dolaylılık katmanı.

:::diagram{src="uml-sidecar.svg" alt="Sidecar bileşen diyagramı: orders pod'unda OrderApp ve EnvoySidecar; inventory pod'unda EnvoySidecar ve InventoryApp; kontrol düzlemi|Sidecar component diagram: OrderApp and EnvoySidecar in the orders pod; EnvoySidecar and InventoryApp in the inventory pod; the control plane"}
:::

:::animation{scene="sidecar.scene.json"}
Uygulama localhost'a konuşur → sidecar mTLS ile karşıya → retry/CB sidecar'da → kontrol düzlemi politikayı iter.
:::

:::code{lang="ts" title="Sidecar: uygulama kodu sadeleşir, politika YAML'a taşınır"}
```ts
// ÖNCE: dayanıklılık uygulama kodunda (her dilde, her serviste tekrar)
const inventory = await bulkheads.inventory.run(() =>
  breakers.inventory.call(() =>
    retry(() => http.get(`https://inventory.internal/stock/${sku}`, { timeout: 1_000, cert: mtlsCert }), retryOpts),
  ),
);

// SONRA: uygulama yalnızca düz HTTP ile localhost'a konuşur; iptables trafiği sidecar'a yönlendirir
const inventory = await fetch(`http://inventory/stock/${sku}`).then((r) => r.json());
```
```yaml
# Istio DestinationRule: retry, timeout, circuit breaker (outlier detection) ve bulkhead (connection pool)
apiVersion: networking.istio.io/v1
kind: DestinationRule
metadata: { name: inventory }
spec:
  host: inventory
  trafficPolicy:
    connectionPool:
      http: { http1MaxPendingRequests: 50, http2MaxRequests: 200 }   # bulkhead
    outlierDetection:                                                  # circuit breaker
      consecutive5xxErrors: 5
      interval: 10s
      baseEjectionTime: 30s
      maxEjectionPercent: 50
    tls: { mode: ISTIO_MUTUAL }                                        # mTLS
---
apiVersion: networking.istio.io/v1
kind: VirtualService
metadata: { name: inventory }
spec:
  hosts: [inventory]
  http:
    - route: [{ destination: { host: inventory } }]
      timeout: 1s
      retries: { attempts: 2, perTryTimeout: 500ms, retryOn: "5xx,reset,connect-failure" }   # yalnızca idempotent GET için!
```
```java
// Sidecar'lı ortamda Java servisi de aynı sadeliğe iner; kütüphane bağımlılığı yok
public final class InventoryClient {
    private final HttpClient http = HttpClient.newHttpClient();
    public Stock stock(String sku) throws Exception {
        var req = HttpRequest.newBuilder(URI.create("http://inventory/stock/" + sku)).build();   // düz HTTP, localhost → sidecar
        return Json.read(http.send(req, HttpResponse.BodyHandlers.ofString()).body(), Stock.class);
    }
}
// Dikkat: retry'ı HEM sidecar HEM kütüphane yaparsa retry amplification oluşur; tek katman seçin.
```
:::

**Ne zaman kullan**
- Çok dilli, çok ekipli ortamda tutarlı güvenlik ve dayanıklılık politikası gerekiyor.
- mTLS ve servisler arası yetkilendirme platform gereksinimi (sıfır güven ağı).
- Onlarca servis var ve her birine kütüphane güncellemesi dağıtmak ay sürüyor.

**Ne zaman kullanma**
- 3–5 servisli küçük sistem: mesh'in operasyon maliyeti kazancını aşar; kütüphane (Resilience4j, Polly) yeterlidir.
- Aşırı düşük gecikme gereksinimi (her ms önemli) ya da çok yüksek bağlantı sayısı (sidecar bellek maliyeti katlanır).
- Uygulama düzeyi semantik gerektiren kararlar (hangi isteğin idempotent olduğu, iş kuralına bağlı fallback): sidecar bunu bilemez; bu kısım kodda kalır.

---

## 5. Strangler Fig

**Niyet**: Eski bir sistemi, yeni sistemi onun etrafında kademeli olarak büyüterek ve eski sistemin parçalarını tek tek devre dışı bırakarak değiştirmek.

Martin Fowler'ın Avustralya'daki boğucu incir ağacından esinlenerek adlandırdığı kalıp, b-01'deki geçiş stratejisinin uygulama biçimidir. Döngü: **facade koy → yeni servisi kur → veriyi senkronize et → canary (%10) → %100 → eski kodu sil → tekrarla**. Her adımın geri dönüşü bir yönlendirme satırıdır; büyük patlama yoktur.

Kritik ayrıntılar: Geçiş süresince iki veri deposu arasında **senkronizasyon** (CDC ile değişiklik akışı, çift yazım yerine) gerekir; yazmalar tek tarafa (önce eski, sonra yeni) verilmelidir; **gölge trafik** (isteği iki sisteme de gönderip yalnızca eskinin cevabını kullanmak) yanıt eşitliğini doğrulamanın güvenli yoludur; ve en çok unutulan adım **eski kodu silmek**tir — silinmezse iki sistem sonsuza dek birlikte taşınır.

:::diagram{src="uml-strangler.svg" alt="Strangler Fig UML: StranglerFacade yönlendiricisi, RouteTable, LegacyMonolith, CatalogService ve SyncJob|Strangler Fig UML: the StranglerFacade router, RouteTable, LegacyMonolith, CatalogService and SyncJob"}
:::

:::animation{scene="strangler-fig.scene.json"}
Facade → yeni servis + CDC → %10 canary → %100 ve kodu sök → incir ağacı kuruyana kadar tekrarla.
:::

:::code{lang="ts" title="Strangler facade: yüzde bazlı yönlendirme, yapışkan canary, gölge trafik"}
```ts
interface Route { prefix: string; newPercent: number; shadow?: boolean }

export class StranglerFacade {
  constructor(private readonly routes: Route[], private readonly legacy: Upstream, private readonly modern: Upstream, private readonly flags: FeatureFlags) {}

  async handle(req: Request): Promise<Response> {
    const route = this.routes.find((r) => req.path.startsWith(r.prefix));
    const percent = route ? this.flags.number(`strangler.${route.prefix}.percent`, route.newPercent) : 0;   // canlıda değiştirilebilir

    // Yapışkan canary: aynı kullanıcı hep aynı tarafa düşsün (tutarlı deneyim, kolay hata ayıklama)
    const bucket = hash(req.userId ?? req.ip) % 100;
    const target = bucket < percent ? this.modern : this.legacy;

    if (route?.shadow && target === this.legacy) {
      void this.modern.send(req).then((res) => compare(req, res)).catch(() => {});   // gölge: cevabı kullanma, sadece karşılaştır
    }

    const res = await target.send(req);
    res.headers.set('x-served-by', target === this.modern ? 'catalog-svc' : 'legacy');   // gözlemlenebilirlik
    return res;
  }
}

// Yönlendirme tablosu bir veri yapısıdır; geri dönüş = percent: 0
const facade = new StranglerFacade(
  [
    { prefix: '/products', newPercent: 100 },
    { prefix: '/search', newPercent: 10, shadow: true },
    { prefix: '/orders', newPercent: 0 },
  ],
  legacyUpstream, modernUpstream, flags,
);
```
```python
class StranglerFacade:
    def __init__(self, routes, legacy, modern, flags):
        self.routes, self.legacy, self.modern, self.flags = routes, legacy, modern, flags

    def handle(self, req):
        route = next((r for r in self.routes if req.path.startswith(r["prefix"])), None)
        percent = self.flags.number(f"strangler.{route['prefix']}.percent", route["new_percent"]) if route else 0
        bucket = stable_hash(req.user_id or req.ip) % 100          # yapışkan canary
        target = self.modern if bucket < percent else self.legacy
        if route and route.get("shadow") and target is self.legacy:
            background(lambda: compare(req, self.modern.send(req)))  # gölge trafik
        res = target.send(req)
        res.headers["x-served-by"] = "catalog-svc" if target is self.modern else "legacy"
        return res
```
```java
public final class StranglerFacade {
    record Route(String prefix, int newPercent, boolean shadow) {}
    private final List<Route> routes; private final Upstream legacy, modern; private final FeatureFlags flags;

    public Response handle(Request req) {
        Route route = routes.stream().filter(r -> req.path().startsWith(r.prefix())).findFirst().orElse(null);
        int percent = route == null ? 0 : flags.number("strangler." + route.prefix() + ".percent", route.newPercent());
        int bucket = Math.floorMod(Objects.hash(req.userIdOrIp()), 100);          // yapışkan canary
        Upstream target = bucket < percent ? modern : legacy;
        if (route != null && route.shadow() && target == legacy) executor.submit(() -> compare(req, modern.send(req)));   // gölge
        Response res = target.send(req);
        res.header("x-served-by", target == modern ? "catalog-svc" : "legacy");
        return res;
    }
}
// Pratikte: NGINX split_clients, Istio VirtualService weight, AWS ALB weighted target groups aynı işi yapar.
```
:::

**Ne zaman kullan**
- Büyük, canlı, durdurulamayan bir sistemi değiştirirken (neredeyse her legacy geçişi).
- Riskin kademeli alınması ve her adımda ölçülmesi gerekiyorsa.

**Ne zaman kullanma**
- Sistem küçükse ve tamamen yeniden yazmak birkaç hafta sürüyorsa: facade'ın maliyeti geçişten büyük olabilir.
- İstekleri yakalayabileceğiniz bir giriş noktası yoksa (toplu işler, doğrudan DB erişen istemciler): önce o giriş noktasını yaratın.
- Veri modeli iki sistem arasında anlamlı biçimde bölünemiyorsa: önce sınırları (bounded context, b-03) netleştirin.

---

## 6. Transactional Outbox

**Niyet**: Bir veritabanı yazımını ve ona karşılık gelen mesaj yayınını, dağıtık transaction olmadan **atomik** hâle getirmek.

**Çift yazım (dual write)** problemi: "DB'ye yaz, sonra Kafka'ya yayınla" dizisinde süreç ikisinin arasında çökerse olay kaybolur; ters sırada ise hayalet olay oluşur. 2PC çoğu broker tarafından desteklenmez ve zaten kaçınılır.

Outbox çözümü: Olay, iş verisiyle **aynı yerel transaction** içinde bir `outbox` tablosuna yazılır — ya ikisi de commit olur ya hiçbiri. Ayrı bir **relay** (polling) ya da **CDC** (Debezium, WAL okuyarak) gönderilmemiş satırları broker'a taşır ve işaretler. Relay yayınladıktan sonra işaretlemeden çökerse olay **ikinci kez** yayınlanır: teslim **at-least-once**'tır; tüketiciler olay id'sini `processed_ids` tablosunda tutarak **idempotent** olur. Sonuç: kayıpsız ve etkin biçimde tam bir kez işleme — b-02'deki saga ve olay mimarisinin güvenilir temeli.

:::diagram{src="uml-outbox.svg" alt="Outbox UML: OrderService aynı transaction'da OrderRepository ve OutboxRepository'ye yazar; OutboxRelay broker'a yayınlar; tüketici idempotenttir|Outbox UML: OrderService writes to OrderRepository and OutboxRepository in one transaction; OutboxRelay publishes to the broker; the consumer is idempotent"}
:::

:::animation{scene="outbox.scene.json"}
Çift yazım tuzağı → aynı transaction'da iki satır → relay okur ve yayınlar → işaretleme ve çökme senaryosu → idempotent tüketici.
:::

:::code{lang="ts" title="Outbox: aynı transaction, relay, idempotent tüketici"}
```ts
// 1) Yazma tarafı: iş verisi + olay, TEK transaction
export class OrderService {
  constructor(private readonly db: Db) {}

  async place(cmd: PlaceOrder): Promise<string> {
    const orderId = randomUUID();
    const eventId = randomUUID();
    await this.db.transaction(async (tx) => {
      await tx.query('INSERT INTO orders (id, user_id, total_minor, status) VALUES ($1, $2, $3, $4)', [orderId, cmd.userId, cmd.totalMinor, 'PLACED']);
      await tx.query(
        'INSERT INTO outbox (id, aggregate_id, type, payload, created_at) VALUES ($1, $2, $3, $4, now())',
        [eventId, orderId, 'OrderPlaced', JSON.stringify({ orderId, userId: cmd.userId, totalMinor: cmd.totalMinor })],
      );
    });                                                     // ya ikisi de commit olur ya hiçbiri
    return orderId;
  }
}

// 2) Relay: gönderilmemişleri sırayla yayınla, sonra işaretle (polling publisher)
export class OutboxRelay {
  constructor(private readonly db: Db, private readonly broker: Broker, private readonly batch = 100) {}

  async tick(): Promise<number> {
    // FOR UPDATE SKIP LOCKED: birden fazla relay kopyası aynı satırı almaz
    const rows = await this.db.query<OutboxRow>(
      'SELECT * FROM outbox WHERE sent_at IS NULL ORDER BY created_at LIMIT $1 FOR UPDATE SKIP LOCKED', [this.batch],
    );
    for (const row of rows) {
      await this.broker.publish('orders', { key: row.aggregate_id, headers: { 'event-id': row.id }, value: row.payload });  // key = sıra garantisi
      await this.db.query('UPDATE outbox SET sent_at = now() WHERE id = $1', [row.id]);   // çökme buradan önceyse → tekrar yayın (at-least-once)
    }
    return rows.length;
  }
}
setInterval(() => relay.tick().catch(log.error), 200);

// 3) Tüketici: idempotent
export class ShippingConsumer {
  async on(msg: Message) {
    const eventId = msg.headers['event-id'];
    await this.db.transaction(async (tx) => {
      const inserted = await tx.query('INSERT INTO processed_events (id) VALUES ($1) ON CONFLICT DO NOTHING RETURNING id', [eventId]);
      if (inserted.rowCount === 0) return;                  // daha önce işlendi: atla
      await this.createShipment(tx, JSON.parse(msg.value));
    });
  }
}
```
```python
def place_order(db, cmd):
    order_id, event_id = uuid4(), uuid4()
    with db.transaction() as tx:                                   # tek transaction
        tx.execute("INSERT INTO orders (id, user_id, total_minor, status) VALUES (%s, %s, %s, 'PLACED')", (order_id, cmd.user_id, cmd.total_minor))
        tx.execute("INSERT INTO outbox (id, aggregate_id, type, payload, created_at) VALUES (%s, %s, 'OrderPlaced', %s, now())",
                   (event_id, order_id, json.dumps({"orderId": str(order_id), "userId": cmd.user_id})))
    return order_id

def relay_tick(db, broker, batch=100):
    with db.transaction() as tx:
        rows = tx.fetch("SELECT * FROM outbox WHERE sent_at IS NULL ORDER BY created_at LIMIT %s FOR UPDATE SKIP LOCKED", (batch,))
        for row in rows:
            broker.publish("orders", key=row.aggregate_id, headers={"event-id": str(row.id)}, value=row.payload)
            tx.execute("UPDATE outbox SET sent_at = now() WHERE id = %s", (row.id,))

def on_order_placed(db, msg):                                      # idempotent tüketici
    with db.transaction() as tx:
        if tx.execute("INSERT INTO processed_events (id) VALUES (%s) ON CONFLICT DO NOTHING", (msg.headers["event-id"],)).rowcount == 0:
            return
        create_shipment(tx, json.loads(msg.value))
```
```java
@Transactional                                                      // tek transaction
public UUID place(PlaceOrder cmd) {
    UUID orderId = UUID.randomUUID(), eventId = UUID.randomUUID();
    jdbc.update("INSERT INTO orders (id, user_id, total_minor, status) VALUES (?, ?, ?, 'PLACED')", orderId, cmd.userId(), cmd.totalMinor());
    jdbc.update("INSERT INTO outbox (id, aggregate_id, type, payload, created_at) VALUES (?, ?, 'OrderPlaced', ?::jsonb, now())",
                eventId, orderId, json.write(Map.of("orderId", orderId, "userId", cmd.userId())));
    return orderId;
}

@Scheduled(fixedDelay = 200)
@Transactional
public void relayTick() {
    var rows = jdbc.query("SELECT * FROM outbox WHERE sent_at IS NULL ORDER BY created_at LIMIT 100 FOR UPDATE SKIP LOCKED", OutboxRow.MAPPER);
    for (var row : rows) {
        kafka.send(new ProducerRecord<>("orders", null, row.aggregateId().toString(), row.payload(), List.of(new RecordHeader("event-id", row.id().toString().getBytes())))).get();
        jdbc.update("UPDATE outbox SET sent_at = now() WHERE id = ?", row.id());
    }
}
// Polling yerine CDC: Debezium outbox event router, outbox tablosundaki INSERT'leri WAL'dan okuyup Kafka'ya yazar; sent_at'e gerek kalmaz.
```
:::

**Ne zaman kullan**
- Bir veritabanı değişikliğinin ardından **mutlaka** bir mesaj yayınlanması gerekiyorsa (sipariş → kargo, kullanıcı → e-posta, ödeme → muhasebe). Saga ve olay tabanlı mimarinin her adımında.
- Broker ile veritabanının farklı sistemler olduğu her durumda; yani neredeyse her zaman.

**Ne zaman kullanma**
- Olayın kaybolması kabul edilebilirse (telemetri, en iyi çaba bildirimleri): doğrudan yayın yeterlidir.
- Veritabanınız doğal olarak değişiklik akışı sunuyorsa (DynamoDB Streams, MongoDB change streams, Postgres logical replication + Debezium): outbox tablosu yerine CDC'yi doğrudan kullanabilirsiniz; ama olay sözleşmesini tablo şemasına bağlamamak için çoğu ekip yine bir outbox tablosu tutar.
- Tüketicileri idempotent yapamıyorsanız: outbox at-least-once verir, tam bir kez vermez; önce idempotency'yi çözün.

---

## Kalıplar birlikte: bir çağrının anatomisi

| Katman | Kalıp | Karar |
|---|---|---|
| 1 | Bulkhead | Bu bağımlılık için izin var mı? Yoksa anında ret + fallback. |
| 2 | Circuit Breaker | Bağımlılık sağlıklı mı? OPEN ise ağa çıkma + fallback. |
| 3 | Retry + Backoff | Geçici hata mı, idempotent mi? Evetse jitter'lı bekle ve tekrar dene (bütçe dahilinde). |
| 4 | Timeout | Her deneme için ayrı zaman aşımı; toplam süre bütçesi aşılmasın. |
| — | Sidecar | 1–4'ü koddan çıkarıp platforma taşır (dil bağımsız politika). |
| — | Outbox | Çağrı başarılıysa ve bir olay yayınlanacaksa: aynı transaction'da outbox. |
| — | Strangler Fig | Tüm bunları eski sistemden yeniye yol yol geçerken uygular. |

:::callout{tone="danger" title="Retry amplification ve 'iyi niyetli' DDoS"}
Dört katmanlı bir çağrı zincirinde her katman 3 kez yeniden denerse, en alttaki servis tek bir kullanıcı isteği için 3⁴ = 81 istek görebilir. Kesinti anında bu, toparlanmayı imkânsız kılar. Kurallar: yeniden denemeyi **tek katmanda** yapın (en dışta ya da sidecar'da), **retry bütçesi** koyun (yeniden denemeler toplam trafiğin %10'unu aşamaz), breaker açıkken **asla** retry yapmayın ve `Retry-After` başlığına uyun. Google SRE kitabının "cascading failures" bölümü bu konunun en iyi kaynağıdır.
:::

:::realworld{company="Netflix"}
Bu dersteki kalıpların çoğu adını ya da yaygınlığını Netflix'e borçludur. 2011'de açık kaynaklanan **Hystrix**, her uzak çağrıyı bir komut nesnesine sarıp circuit breaker, bulkhead (bağımlılık başına thread pool) ve timeout'u tek pakette sundu; Netflix'in günde on milyarlarca bağımlılık çağrısında "bir bağımlılığın hastalığı akışı durdurmasın" ilkesini kurumsallaştırdı. Hystrix 2018'de bakım moduna alındı; fikirleri **Resilience4j**'de (JVM) ve **Envoy**'un outlier detection'ında yaşıyor — Netflix de servisler arası trafiğini giderek sidecar tabanlı mesh'e taşıdı. **Chaos Monkey** ve Simian Army, bu korumaların gerçekten çalıştığını üretimde rastgele örnek öldürerek kanıtladı. Strangler Fig tarafında Netflix'in 2008–2016 arasında veri merkezinden AWS'ye geçişi, yıllar süren yol yol bir boğma hikâyesidir: önce üye olmayan sayfalar, sonra arama, en son faturalama taşındı. Olay tutarlılığında ise Netflix'in **Keystone** boru hattı ve servislerin Cassandra + Kafka arasındaki yazımlarında outbox/CDC yaklaşımı standarttır; çift yazımın yarattığı "kayıp olay" türü arızalar, şirketin yayımladığı post-mortem'larda açıkça anılır.
:::

:::callout{tone="tip" title="Mülakat özeti"}
- "Servis X yavaşlarsa ne olur?" sorusuna katman katman cevap verin: timeout → retry (idempotent + jitter) → circuit breaker (fallback ne?) → bulkhead (hangi havuz?). Bu sıra tek başına çok şey anlatır.
- Jitter'ı kendiliğinizden anın ve **thundering herd** kelimesini kullanın; retry amplification için "tek katmanda retry" deyin.
- Circuit breaker eşiğini "ardışık 5 hata" değil "pencerede oran + minimum istek" olarak tanımlayın; HALF-OPEN'ı unutmayın.
- Sidecar sorulursa artı (dil bağımsız politika, mTLS) ve eksiyi (bellek, +1 ms, operasyon) dengeli verin; küçük sistemde kütüphaneyi savunun.
- Outbox'ı **çift yazım** problemini tarif ederek başlatın; at-least-once ve idempotent tüketiciyi ekleyin; CDC alternatifini söyleyin.
- Strangler Fig'de "kur → senkronize et → canary → %100 → sil" döngüsünü ve geri dönüşün bir yönlendirme satırı olduğunu vurgulayın.
:::

:::quiz{src="quiz.json"}
:::

:::next{lesson="d-01-relational-modeling-normalization"}
Tasarım kalıpları modülü burada bitiyor. Sırada veritabanı tasarımı: ilişkisel modelleme, normalizasyon (1NF→BCNF) ve interaktif ER diyagramları.
:::

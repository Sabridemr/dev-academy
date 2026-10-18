---
id: c-02-structural-patterns
slug: structural-patterns
module: c-design-patterns
order: 2
title:
  tr: "Structural: Adapter, Decorator, Facade, Proxy, Composite, Bridge"
  en: "Structural: Adapter, Decorator, Facade, Proxy, Composite, Bridge"
summary:
  tr: Sınıf ve nesneleri daha büyük yapılarda birleştiren kalıplar.
  en: Patterns that compose classes and objects into larger structures.
durationMinutes: 50
level: intermediate
tags: [design-patterns, gof, structural, adapter, decorator, facade, proxy, composite, bridge, typescript]
prerequisites: [c-01-creational-patterns]
concepts: [structural-patterns, adapter, decorator, facade, proxy, composite, bridge, composition-over-inheritance, wrapper]
---

## Kavram: sarmak, birleştirmek, ayırmak

Creational kalıplar nesnelerin **nasıl doğduğuyla** ilgilenirdi; **structural (yapısal) kalıplar** doğmuş nesnelerin **nasıl bir araya geldiğiyle** ilgilenir. Çoğu aynı tekniğe dayanır: bir nesneyi başka bir nesnenin içine koymak (**bileşim**) ve çağrıyı iletmek. Bu kadar benzer yapıların altı ayrı isminin olması kafa karıştırır; ama isimler yapıyı değil **niyeti** anlatır:

| Kalıp | Arayüz | Niyet | Tek cümle |
|---|---|---|---|
| **Adapter** | Farklı | Uyum | "Bu SDK'yı bizim arayüzümüze çevir." |
| **Decorator** | Aynı | Genişletme | "Bu nesneye loglama ekle, kalıtım kullanmadan." |
| **Proxy** | Aynı | Kontrol | "Gerçek nesneye erişimi ben yöneteyim: cache, yetki, tembel yükleme." |
| **Facade** | Yeni, basit | Basitleştirme | "Dört servisi tek metot arkasına koy." |
| **Composite** | Aynı (ağaç) | Tek tip işlem | "Dosya ve klasöre aynı `size()` çağrısını yap." |
| **Bridge** | İki hiyerarşi | Ayrıştırma | "Rapor türleri ile çıktı formatları birbirinden bağımsız büyüsün." |

:::diagram{src="diagram.svg" alt="Altı yapısal kalıbın karşılaştırma haritası: sarmalayıcı ailesi (Adapter, Decorator, Proxy, Facade) ve yapı ailesi (Composite, Bridge)|Comparison map of the six structural patterns: the wrapper family (Adapter, Decorator, Proxy, Facade) and the structure family (Composite, Bridge)"}
Sarmalayıcı ailesinde soru "neden sarıyorsun?"; yapı ailesinde soru "nesneler nasıl düzenleniyor?"
:::

Aşağıdaki animasyon aynı istemci–servis çifti üzerinde sarmalayıcının dört yüzünü gösterir; ardından her kalıbı kendi UML'i, kendi nesne etkileşimi ve üç dilde koduyla inceleyeceğiz.

:::animation{scene="scene.json"}
Aynı sarmalayıcı: arayüz çevirir (Adapter), davranış ekler (Decorator), erişimi kontrol eder (Proxy), çok kapıyı tek kapıya indirir (Facade).
:::

:::interactive{type="request-journey" stages="controller,logging-decorator,retry-decorator,caching-proxy,adapter,legacy-sdk" failureStage="legacy-sdk"}
Bir isteğin altı katmanlı sarmalayıcı zincirinden geçişini izleyin. "Cache hit" kutusunu işaretleyip tekrar gönderin: caching-proxy isteği kısa devre yapar, adapter ve legacy-sdk hiç çağrılmaz — Proxy'nin işi budur. "Hata enjekte et: legacy-sdk" ile eski SDK'yı düşürün: hata adapter'dan dışarı, retry ve logging sarmalayıcılarından geçerek controller'a taşınır; retry-decorator'ın cache'in dışında durması, cache miss'lerin de yeniden denenmesi anlamına gelir. "20 istek" ile farklı cache hit oranlarında ortalama ve p95'i karşılaştırın.
:::

---

## 1. Adapter

**Niyet**: Bir sınıfın arayüzünü, istemcinin beklediği başka bir arayüze dönüştürmek; aksi hâlde birlikte çalışamayacak sınıfları birlikte çalıştırmak.

Tipik senaryo: alan kodunuz `PaymentGateway.charge(amountMinor, currency)` bekler; bankanın SDK'sı `makePayment(lira, cardToken)` sunar ve değiştirilemez. Adapter hedef arayüzü uygular, SDK'yı içinde tutar ve çeviriyi tek yerde yapar. b-03'teki hexagonal mimaride **her giden adaptör** tam olarak budur.

:::diagram{src="uml-adapter.svg" alt="Adapter UML: CheckoutService PaymentGateway arayüzüne bağlı; BankSdkAdapter arayüzü uygular ve LegacyBankSdk'yı sarar|Adapter UML: CheckoutService depends on PaymentGateway; BankSdkAdapter implements it and wraps LegacyBankSdk"}
:::

:::animation{scene="adapter.scene.json"}
`charge(1999, "TRY")` → kuruş/lira çevirisi → `makePayment(19.99, token)` → `Receipt` → `Result`.
:::

:::code{lang="ts" title="Adapter: hedef arayüz, adaptee ve çeviri"}
```ts
// Hedef arayüz: alan kodunun istediği
export interface PaymentGateway {
  charge(amountMinor: number, currency: 'TRY' | 'USD', cardToken: string): Promise<{ ok: boolean; paymentId?: string; reason?: string }>;
}

// Adaptee: 3. parti SDK, imzası bizim elimizde değil
declare class LegacyBankSdk {
  makePayment(amountLira: number, cardToken: string, opts: { currencyCode: number }): Promise<{ status: string; refNo: string; msg: string }>;
}

export class BankSdkAdapter implements PaymentGateway {
  private static readonly CURRENCY_CODES = { TRY: 949, USD: 840 } as const;
  constructor(private readonly sdk: LegacyBankSdk) {}

  async charge(amountMinor: number, currency: 'TRY' | 'USD', cardToken: string) {
    const receipt = await this.sdk.makePayment(
      amountMinor / 100,                                          // kuruş → lira
      cardToken,
      { currencyCode: BankSdkAdapter.CURRENCY_CODES[currency] },  // ISO kodu eşlemesi
    );
    return receipt.status === '00'                                // SDK'nın "başarı" kodu
      ? { ok: true, paymentId: receipt.refNo }
      : { ok: false, reason: receipt.msg };
  }
}

// İstemci yalnızca PaymentGateway bilir; testte sahte bir gateway takılır
export class CheckoutService {
  constructor(private readonly gateway: PaymentGateway) {}
  pay(orderTotalMinor: number, token: string) { return this.gateway.charge(orderTotalMinor, 'TRY', token); }
}
```
```python
from typing import Protocol

class PaymentGateway(Protocol):
    def charge(self, amount_minor: int, currency: str, card_token: str) -> dict: ...

class BankSdkAdapter:
    CURRENCY_CODES = {"TRY": 949, "USD": 840}
    def __init__(self, sdk): self.sdk = sdk
    def charge(self, amount_minor, currency, card_token):
        receipt = self.sdk.make_payment(amount_minor / 100, card_token, currency_code=self.CURRENCY_CODES[currency])
        if receipt["status"] == "00":
            return {"ok": True, "payment_id": receipt["refNo"]}
        return {"ok": False, "reason": receipt["msg"]}

class CheckoutService:
    def __init__(self, gateway: PaymentGateway): self.gateway = gateway
    def pay(self, total_minor, token): return self.gateway.charge(total_minor, "TRY", token)
```
```java
public interface PaymentGateway { Result charge(long amountMinor, String currency, String cardToken); }

public final class BankSdkAdapter implements PaymentGateway {
    private static final Map<String, Integer> CURRENCY = Map.of("TRY", 949, "USD", 840);
    private final LegacyBankSdk sdk;
    public BankSdkAdapter(LegacyBankSdk sdk) { this.sdk = sdk; }

    @Override public Result charge(long amountMinor, String currency, String cardToken) {
        Receipt r = sdk.makePayment(amountMinor / 100.0, cardToken, CURRENCY.get(currency)); // kuruş → lira
        return "00".equals(r.status()) ? Result.ok(r.refNo()) : Result.fail(r.msg());
    }
}
```
:::

**Ne zaman kullan**
- Değiştiremediğiniz bir sınıfı (SDK, legacy, üçüncü taraf) kendi arayüzünüze uydurmanız gerekiyor.
- Aynı port için birden fazla sağlayıcı (Stripe, iyzico, banka SDK'sı) değiştirilebilir olmalı.

**Ne zaman kullanma**
- Her iki tarafı da siz yazıyorsanız: arayüzü düzeltin, çeviri katmanı eklemeyin.
- Adapter içinde iş kuralı birikmeye başladıysa: adaptör çevirir, karar vermez; kural alan katmanına taşınmalı.

---

## 2. Decorator

**Niyet**: Bir nesneye, alt sınıf türetmeden, çalışma zamanında ek sorumluluklar yüklemek.

Decorator aynı arayüzü uygular, içinde aynı arayüzden bir nesne tutar ve çağrıyı iletmeden önce/sonra bir şey yapar. Decorator'lar **zincirlenir**; sırası davranışı değiştirir. Kalıtımla "LoggingRetryingEmailNotifier" gibi kombinasyon patlaması yerine her kesit tek bir sınıf olur.

:::diagram{src="uml-decorator.svg" alt="Decorator UML: Notifier arayüzü, EmailNotifier, soyut NotifierDecorator ve Retry/Logging decorator'ları|Decorator UML: Notifier interface, EmailNotifier, abstract NotifierDecorator and the Retry/Logging decorators"}
:::

:::animation{scene="decorator.scene.json"}
Logging → Retry → Email zinciri: ilk deneme başarısız, retry tekrar dener, logging toplam süreyi ölçer.
:::

:::code{lang="ts" title="Decorator: zincirlenebilir, sırası önemli"}
```ts
export interface Notifier { send(msg: string): Promise<void> }

export class EmailNotifier implements Notifier {
  constructor(private readonly smtp: SmtpClient) {}
  async send(msg: string) { await this.smtp.deliver(msg); }
}

abstract class NotifierDecorator implements Notifier {
  constructor(protected readonly inner: Notifier) {}
  send(msg: string) { return this.inner.send(msg); }            // varsayılan: ilet
}

export class RetryDecorator extends NotifierDecorator {
  constructor(inner: Notifier, private readonly attempts = 3) { super(inner); }
  async send(msg: string) {
    for (let i = 1; ; i++) {
      try { return await this.inner.send(msg); }
      catch (err) { if (i >= this.attempts) throw err; await sleep(100 * 2 ** (i - 1)); }  // üstel bekleme
    }
  }
}

export class LoggingDecorator extends NotifierDecorator {
  constructor(inner: Notifier, private readonly log: Logger) { super(inner); }
  async send(msg: string) {
    const t0 = performance.now();
    try { await this.inner.send(msg); this.log.info('notify ok', { ms: performance.now() - t0 }); }
    catch (err) { this.log.error('notify failed', { ms: performance.now() - t0, err }); throw err; }
  }
}

// Kompozisyon kökü: sıra önemli — logging dışta olduğu için TÜM denemeleri ölçer
const notifier: Notifier = new LoggingDecorator(new RetryDecorator(new EmailNotifier(smtp), 3), logger);
```
```python
class Notifier(Protocol):
    def send(self, msg: str) -> None: ...

class RetryDecorator:
    def __init__(self, inner: Notifier, attempts=3): self.inner, self.attempts = inner, attempts
    def send(self, msg):
        for i in range(1, self.attempts + 1):
            try: return self.inner.send(msg)
            except TransientError:
                if i == self.attempts: raise
                time.sleep(0.1 * 2 ** (i - 1))

class LoggingDecorator:
    def __init__(self, inner: Notifier, log): self.inner, self.log = inner, log
    def send(self, msg):
        t0 = time.perf_counter()
        try:
            self.inner.send(msg); self.log.info("notify ok", ms=(time.perf_counter() - t0) * 1000)
        except Exception as e:
            self.log.error("notify failed", err=e); raise

notifier = LoggingDecorator(RetryDecorator(EmailNotifier(smtp), 3), log)
# Not: Python'da fonksiyon decorator'ları (@retry, @log) aynı fikrin fonksiyon düzeyindeki hâlidir.
```
```java
public interface Notifier { void send(String msg); }

public abstract class NotifierDecorator implements Notifier {
    protected final Notifier inner;
    protected NotifierDecorator(Notifier inner) { this.inner = inner; }
    @Override public void send(String msg) { inner.send(msg); }
}

public final class RetryDecorator extends NotifierDecorator {
    private final int attempts;
    public RetryDecorator(Notifier inner, int attempts) { super(inner); this.attempts = attempts; }
    @Override public void send(String msg) {
        for (int i = 1; ; i++) {
            try { inner.send(msg); return; }
            catch (TransientException e) { if (i >= attempts) throw e; sleep(100L << (i - 1)); }
        }
    }
}

public final class LoggingDecorator extends NotifierDecorator {
    private final Logger log;
    public LoggingDecorator(Notifier inner, Logger log) { super(inner); this.log = log; }
    @Override public void send(String msg) {
        long t0 = System.nanoTime();
        try { inner.send(msg); log.info("notify ok {}ms", (System.nanoTime() - t0) / 1_000_000); }
        catch (RuntimeException e) { log.error("notify failed", e); throw e; }
    }
}
// Notifier n = new LoggingDecorator(new RetryDecorator(new EmailNotifier(smtp), 3), log);
// JDK örneği: new BufferedInputStream(new GZIPInputStream(new FileInputStream(f)))
```
:::

**Ne zaman kullan**
- Kesen ilgiler (logging, retry, cache, metrik, yetki, sıkıştırma) farklı kombinasyonlarda gerekiyor.
- Sınıf `final`/kapalı ya da kalıtım hiyerarşisi zaten dolu.
- Davranışı çalışma zamanında, konfigürasyonla açıp kapatmak istiyorsunuz. HTTP middleware zincirleri ve Java I/O akışları bu kalıptır.

**Ne zaman kullanma**
- Tek bir ek davranış, hiç değişmeyecek: doğrudan sınıfa yazın.
- Zincir 5–6 katmanı geçti ve hata ayıklamak stack trace'te kayboluyor: bazılarını birleştirin ya da middleware çerçevesine taşıyın.
- Decorator'lar sarılan nesnenin **kimliğine** dayanan kodu bozar (`instanceof`, eşitlik); bu kodu önce temizleyin.

---

## 3. Facade

**Niyet**: Bir alt sistemdeki arayüz kümesine tek ve basit bir giriş noktası sunmak.

Facade, karmaşık bir akışı (stok ayır → ödeme al → kargo planla → bildir) tek bir `placeOrder()` arkasına koyar. Alt sistemleri gizlemez, **zorunlu kılmaz**; yalnızca en sık senaryoyu paketler. b-01'deki modül `public API`'si tam bir facade'dır; büyüyünce b-02'deki saga orchestrator'a dönüşür.

:::diagram{src="uml-facade.svg" alt="Facade UML: CheckoutFacade dört alt sistemi sarar; OrderController yalnızca facade'ı bilir|Facade UML: CheckoutFacade wraps four subsystems; OrderController knows only the facade"}
:::

:::animation{scene="facade.scene.json"}
Tek `placeOrder()` çağrısı; facade dört alt sistemi koordine eder, hata olursa telafi eder.
:::

:::code{lang="ts" title="Facade: koordinasyon içeride, iş kuralı dışarıda"}
```ts
export class CheckoutFacade {
  constructor(
    private readonly inventory: InventoryService,
    private readonly payments: PaymentGateway,
    private readonly shipping: ShippingService,
    private readonly notifier: NotificationService,
  ) {}

  async placeOrder(cart: Cart, card: CardToken): Promise<OrderId> {
    const reservation = await this.inventory.reserve(cart.items);           // 1
    const payment = await this.payments.charge(cart.totalMinor, 'TRY', card); // 2
    if (!payment.ok) {
      await this.inventory.release(reservation);                             // telafi
      throw new PaymentDeclinedError(payment.reason);
    }
    try {
      await this.shipping.schedule(cart.address, cart.items);               // 3
    } catch (err) {
      await this.payments.refund(payment.paymentId!);                       // telafi
      await this.inventory.release(reservation);
      throw err;
    }
    const orderId = OrderId.generate();
    await this.notifier.orderConfirmed(cart.userId, orderId);               // 4
    return orderId;
  }
}

// Controller yalnızca facade'ı bilir
app.post('/checkout', async (req, res) => res.status(201).json({ orderId: await checkout.placeOrder(req.body.cart, req.body.card) }));
```
```python
class CheckoutFacade:
    def __init__(self, inventory, payments, shipping, notifier):
        self.inventory, self.payments, self.shipping, self.notifier = inventory, payments, shipping, notifier

    def place_order(self, cart, card):
        reservation = self.inventory.reserve(cart.items)
        payment = self.payments.charge(cart.total_minor, "TRY", card)
        if not payment["ok"]:
            self.inventory.release(reservation); raise PaymentDeclined(payment["reason"])
        try:
            self.shipping.schedule(cart.address, cart.items)
        except Exception:
            self.payments.refund(payment["payment_id"]); self.inventory.release(reservation); raise
        order_id = new_order_id()
        self.notifier.order_confirmed(cart.user_id, order_id)
        return order_id
```
```java
public final class CheckoutFacade {
    private final InventoryService inventory; private final PaymentGateway payments;
    private final ShippingService shipping; private final NotificationService notifier;
    // kurucu enjeksiyonu...

    public OrderId placeOrder(Cart cart, CardToken card) {
        var reservation = inventory.reserve(cart.items());
        var payment = payments.charge(cart.totalMinor(), "TRY", card);
        if (!payment.ok()) { inventory.release(reservation); throw new PaymentDeclinedException(payment.reason()); }
        try { shipping.schedule(cart.address(), cart.items()); }
        catch (RuntimeException e) { payments.refund(payment.paymentId()); inventory.release(reservation); throw e; }
        var orderId = OrderId.generate();
        notifier.orderConfirmed(cart.userId(), orderId);
        return orderId;
    }
}
```
:::

**Ne zaman kullan**
- Bir modülün/SDK'nın dışarıya sunduğu yüzü sadeleştirmek; istemcilerin 4–5 sınıfı doğru sırayla çağırmasını istememek.
- Katmanlar arası bağımlılığı azaltmak: sunum katmanı yalnızca facade'ı bilir, alt sistem yeniden düzenlenebilir.

**Ne zaman kullanma**
- Facade'a iş kuralı sızıyorsa ("indirim şöyle hesaplanır"): kural alan nesnesine aittir; facade koordine eder.
- Tek bir "her şeyi yapan" dev facade oluşuyorsa: use case başına küçük facade'lar (ya da doğrudan use case sınıfları) daha sağlıklıdır.

---

## 4. Proxy

**Niyet**: Başka bir nesneye erişimi kontrol etmek için onun yerine geçen bir vekil sunmak.

Proxy de aynı arayüzü uygular ve içinde gerçek nesneyi tutar; ama niyeti **kontrol**dür: çağrıyı geciktirebilir (virtual proxy, tembel yükleme), reddedebilir (protection proxy), önbellekten karşılayabilir (caching proxy), ağ üzerinden iletebilir (remote proxy — gRPC stub'ları). Decorator'dan farkı: proxy genellikle gerçek nesnenin yaşam döngüsünü kendisi yönetir ve istemci zincir kurmaz.

:::diagram{src="uml-proxy.svg" alt="Proxy UML: ImageService arayüzü, CachingImageProxy ve gerçek S3ImageService|Proxy UML: ImageService interface, CachingImageProxy and the real S3ImageService"}
:::

:::animation{scene="proxy.scene.json"}
İlk çağrı cache miss → S3; ikinci çağrı cache hit; yetkisiz istek proxy'de reddedilir.
:::

:::code{lang="ts" title="Proxy: caching + protection, aynı arayüz"}
```ts
export interface ImageService { getThumbnail(id: string, user: User): Promise<Uint8Array> }

export class S3ImageService implements ImageService {
  constructor(private readonly s3: S3Client) {}
  async getThumbnail(id: string) { return this.s3.getObject(`thumbs/${id}.jpg`); }     // ~120 ms
}

export class CachingImageProxy implements ImageService {
  private readonly cache = new LRU<string, Uint8Array>({ max: 5_000 });
  private real?: ImageService;                                     // virtual proxy: tembel oluşturma

  constructor(private readonly makeReal: () => ImageService, private readonly acl: Acl) {}

  async getThumbnail(id: string, user: User) {
    if (!this.acl.canView(user, id)) throw new ForbiddenError(id);   // protection: gerçek nesneye hiç gitme
    const hit = this.cache.get(id);
    if (hit) return hit;                                              // caching: 0,2 ms
    this.real ??= this.makeReal();                                    // ilk ihtiyaçta oluştur
    const bytes = await this.real.getThumbnail(id, user);
    this.cache.set(id, bytes);
    return bytes;
  }
}

// İstemci için tip aynı: ImageService
const images: ImageService = new CachingImageProxy(() => new S3ImageService(s3), acl);
```
```python
class CachingImageProxy:
    def __init__(self, make_real, acl, max_items=5000):
        self._make_real, self._acl, self._real = make_real, acl, None
        self._cache = LRUCache(max_items)

    def get_thumbnail(self, image_id, user):
        if not self._acl.can_view(user, image_id):
            raise Forbidden(image_id)                     # protection proxy
        if image_id in self._cache:
            return self._cache[image_id]                  # caching proxy
        if self._real is None:
            self._real = self._make_real()                # virtual proxy (tembel)
        data = self._real.get_thumbnail(image_id, user)
        self._cache[image_id] = data
        return data
```
```java
public final class CachingImageProxy implements ImageService {
    private final Supplier<ImageService> makeReal; private final Acl acl;
    private final Map<String, byte[]> cache = Collections.synchronizedMap(new LruMap<>(5_000));
    private volatile ImageService real;

    public CachingImageProxy(Supplier<ImageService> makeReal, Acl acl) { this.makeReal = makeReal; this.acl = acl; }

    @Override public byte[] getThumbnail(String id, User user) {
        if (!acl.canView(user, id)) throw new ForbiddenException(id);           // protection
        byte[] hit = cache.get(id);
        if (hit != null) return hit;                                             // caching
        if (real == null) synchronized (this) { if (real == null) real = makeReal.get(); } // virtual
        byte[] bytes = real.getThumbnail(id, user);
        cache.put(id, bytes);
        return bytes;
    }
}
// JDK/framework örnekleri: java.lang.reflect.Proxy, Spring @Transactional ve @Cacheable proxy'leri, Hibernate lazy entity proxy'leri
```
:::

**Ne zaman kullan**
- Pahalı nesneyi gerektiğinde oluşturmak (virtual), erişimi yetkiye bağlamak (protection), sonuçları önbelleklemek (caching), uzak servisi yerel nesne gibi göstermek (remote), kullanım saymak (smart reference).
- Çerçeveler bunu sizin için üretir: Spring'in `@Transactional`, `@Cacheable` anotasyonları çalışma zamanı proxy'leridir.

**Ne zaman kullanma**
- Davranış eklemek istiyorsanız ve istemci kombinasyonu seçecekse: bu Decorator'dır.
- Proxy'nin varlığı istemci için görünmez olmalı; istemci "proxy mi gerçek mi?" diye kontrol etmek zorunda kalıyorsa soyutlama sızmıştır.

---

## 5. Composite

**Niyet**: Nesneleri parça-bütün hiyerarşileri hâlinde ağaç yapılarında düzenlemek ve istemcilerin tekil nesnelerle bileşik nesnelere **aynı şekilde** davranmasını sağlamak.

Yaprak (`File`) ve bileşik (`Directory`) aynı `FsNode` arayüzünü uygular; bileşik, çocuk listesini tutar ve işlemi onlara yayar. İstemci özyinelemeyi hiç görmez. Dosya sistemleri, UI bileşen ağaçları (React'in çocuk bileşenleri), organizasyon şemaları, aritmetik ifade ağaçları, menüler hep Composite'tir.

:::diagram{src="uml-composite.svg" alt="Composite UML: FsNode arayüzü, File yaprağı, çocuk listesi tutan Directory bileşiği|Composite UML: FsNode interface, the File leaf, the Directory composite holding a children list"}
:::

:::animation{scene="composite.scene.json"}
`root.size()` → dizinler çocuklarına aynı çağrıyı yapar → dosyalar bayt döner → toplamlar yukarı akar.
:::

:::code{lang="ts" title="Composite: yaprak ve dal aynı arayüzde"}
```ts
export interface FsNode {
  readonly name: string;
  size(): number;
  walk(visit: (node: FsNode, depth: number) => void, depth?: number): void;
}

export class File implements FsNode {
  constructor(readonly name: string, private readonly bytes: number) {}
  size() { return this.bytes; }
  walk(visit: (n: FsNode, d: number) => void, depth = 0) { visit(this, depth); }
}

export class Directory implements FsNode {
  private readonly children: FsNode[] = [];
  constructor(readonly name: string) {}
  add(...nodes: FsNode[]) { this.children.push(...nodes); return this; }
  size() { return this.children.reduce((sum, c) => sum + c.size(), 0); }        // özyineleme burada
  walk(visit: (n: FsNode, d: number) => void, depth = 0) {
    visit(this, depth);
    for (const c of this.children) c.walk(visit, depth + 1);
  }
}

// İstemci: tür kontrolü yok
const root = new Directory('/').add(
  new Directory('src').add(new File('a.ts', 8_192), new File('b.ts', 12_288)),
  new File('README.md', 3_072),
);
console.log(root.size());                                   // 23552
root.walk((n, d) => console.log(`${'  '.repeat(d)}${n.name} ${n.size()}`));
```
```python
from abc import ABC, abstractmethod

class FsNode(ABC):
    def __init__(self, name): self.name = name
    @abstractmethod
    def size(self) -> int: ...

class File(FsNode):
    def __init__(self, name, nbytes): super().__init__(name); self._bytes = nbytes
    def size(self): return self._bytes

class Directory(FsNode):
    def __init__(self, name): super().__init__(name); self.children = []
    def add(self, *nodes): self.children.extend(nodes); return self
    def size(self): return sum(c.size() for c in self.children)   # özyineleme

root = Directory("/").add(Directory("src").add(File("a.ts", 8192), File("b.ts", 12288)), File("README.md", 3072))
print(root.size())   # 23552
```
```java
public sealed interface FsNode permits File, Directory { String name(); long size(); }

public record File(String name, long bytes) implements FsNode {
    public long size() { return bytes; }
}

public final class Directory implements FsNode {
    private final String name; private final List<FsNode> children = new ArrayList<>();
    public Directory(String name) { this.name = name; }
    public String name() { return name; }
    public Directory add(FsNode... nodes) { children.addAll(List.of(nodes)); return this; }
    public long size() { return children.stream().mapToLong(FsNode::size).sum(); }   // özyineleme
}
```
:::

**Ne zaman kullan**
- Veri doğal olarak ağaçtır ve istemci "tek öğe" ile "grup"a aynı işlemi uygulamak istiyor (boyut, çizim, toplam fiyat, yetki kontrolü).
- Yeni düğüm türleri eklenebilmeli, istemci değişmemeli.

**Ne zaman kullanma**
- Yapı düz bir listeyse: dizi yeterlidir.
- Yaprak ile bileşiğin ortak arayüzü zorlamalı hâle geliyorsa (`File.add()` ne yapsın?): ya `add/remove`'u yalnızca bileşiğe koyun (tip güvenliği) ya da yaprakta hata fırlatın (tekdüzelik); kararı bilinçli verin.
- Çok derin ağaçlarda özyineleme yığını taşırabilir; döngü (symlink) koruması gerekir.

---

## 6. Bridge

**Niyet**: Bir soyutlamayı uygulamasından ayırmak, böylece ikisi **bağımsız değişebilsin**.

Rapor türleri (Sales, Inventory) ve çıktı formatları (PDF, HTML, CSV) kalıtımla modellenirse N×M sınıf çıkar: `SalesPdfReport`, `SalesHtmlReport`, ... Bridge iki hiyerarşiyi ayırır: soyutlama (`Report`) içinde bir uygulama (`Exporter`) referansı tutar. Yeni rapor türü ya da yeni format eklemek diğer tarafı etkilemez: N+M sınıf.

:::diagram{src="uml-bridge.svg" alt="Bridge UML: Report soyutlama hiyerarşisi ile Exporter uygulama hiyerarşisi bileşimle bağlanmış|Bridge UML: the Report abstraction hierarchy and the Exporter implementation hierarchy joined by composition"}
:::

:::animation{scene="bridge.scene.json"}
`SalesReport.render()` köprü üzerinden `heading/table/finish` çağırır; exporter PDF'ten HTML'e değişince rapor kodu değişmez.
:::

:::code{lang="ts" title="Bridge: soyutlama (ne) × uygulama (nasıl)"}
```ts
// Uygulama tarafı: NASIL
export interface Exporter {
  heading(text: string): void;
  table(rows: string[][]): void;
  finish(): Uint8Array;
}
export class PdfExporter implements Exporter { /* pdf-lib ile çizer */ heading(t: string) {} table(r: string[][]) {} finish() { return new Uint8Array(); } }
export class HtmlExporter implements Exporter {
  private parts: string[] = [];
  heading(t: string) { this.parts.push(`<h1>${escape(t)}</h1>`); }
  table(rows: string[][]) { this.parts.push('<table>' + rows.map((r) => `<tr>${r.map((c) => `<td>${escape(c)}</td>`).join('')}</tr>`).join('') + '</table>'); }
  finish() { return new TextEncoder().encode(this.parts.join('')); }
}

// Soyutlama tarafı: NE
export abstract class Report {
  constructor(protected readonly exporter: Exporter) {}              // köprü
  abstract render(data: ReportData): Uint8Array;
}
export class SalesReport extends Report {
  render(data: ReportData) {
    this.exporter.heading(`Satış raporu ${data.period}`);
    this.exporter.table([['Bölge', 'Ciro'], ...data.salesByRegion.map((r) => [r.region, fmt(r.total)])]);
    return this.exporter.finish();
  }
}
export class InventoryReport extends Report {
  render(data: ReportData) {
    this.exporter.heading('Stok durumu');
    this.exporter.table([['SKU', 'Adet'], ...data.stock.map((s) => [s.sku, String(s.qty)])]);
    return this.exporter.finish();
  }
}

// 2 rapor × 2 format: 4 sınıf değil, 4 kombinasyon
const pdf = new SalesReport(new PdfExporter()).render(data);
const html = new InventoryReport(new HtmlExporter()).render(data);
```
```python
class Exporter(Protocol):                       # uygulama: NASIL
    def heading(self, text: str) -> None: ...
    def table(self, rows: list[list[str]]) -> None: ...
    def finish(self) -> bytes: ...

class HtmlExporter:
    def __init__(self): self.parts = []
    def heading(self, t): self.parts.append(f"<h1>{html.escape(t)}</h1>")
    def table(self, rows): self.parts.append("<table>" + "".join("<tr>" + "".join(f"<td>{html.escape(c)}</td>" for c in r) + "</tr>" for r in rows) + "</table>")
    def finish(self): return "".join(self.parts).encode()

class Report(ABC):                              # soyutlama: NE
    def __init__(self, exporter: Exporter): self.exporter = exporter   # köprü
    @abstractmethod
    def render(self, data) -> bytes: ...

class SalesReport(Report):
    def render(self, data):
        self.exporter.heading(f"Satış raporu {data.period}")
        self.exporter.table([["Bölge", "Ciro"], *[[r.region, fmt(r.total)] for r in data.sales_by_region]])
        return self.exporter.finish()
```
```java
public interface Exporter { void heading(String text); void table(List<List<String>> rows); byte[] finish(); }  // NASIL

public abstract class Report {                                     // NE
    protected final Exporter exporter;                             // köprü
    protected Report(Exporter exporter) { this.exporter = exporter; }
    public abstract byte[] render(ReportData data);
}

public final class SalesReport extends Report {
    public SalesReport(Exporter e) { super(e); }
    @Override public byte[] render(ReportData data) {
        exporter.heading("Satış raporu " + data.period());
        var rows = new ArrayList<List<String>>(); rows.add(List.of("Bölge", "Ciro"));
        data.salesByRegion().forEach(r -> rows.add(List.of(r.region(), fmt(r.total()))));
        exporter.table(rows);
        return exporter.finish();
    }
}
// JDBC bu kalıptır: java.sql.Connection (soyutlama) × sürücüler (uygulama)
```
:::

**Ne zaman kullan**
- İki (ya da daha fazla) bağımsız değişim ekseni var ve kalıtım kombinasyon patlaması üretiyor.
- Uygulamayı çalışma zamanında değiştirmek istiyorsunuz (aynı rapor, farklı format).
- Platforma özgü kodu (iOS/Android, Postgres/MySQL) soyutlamanın arkasına koymak istiyorsunuz.

**Ne zaman kullanma**
- Tek değişim ekseni varsa: Strategy ya da basit arayüz yeterlidir.
- Soyutlama ile uygulama bire bir eşleşiyor ve hiç çaprazlanmayacaksa: köprü yalnızca dolaylılık ekler.

---

## Kalıpları birbirinden ayırmak

| Karışan ikili | Ayırt edici soru |
|---|---|
| Adapter vs. Facade | Adapter **var olan** bir arayüze uydurur (1→1); Facade **yeni, basit** bir arayüz tanımlar (1→N). |
| Decorator vs. Proxy | Decorator davranış ekler, istemci zinciri kurar; Proxy erişimi/yaşam döngüsünü yönetir, çağrıyı iletmeyebilir. |
| Bridge vs. Adapter | Bridge **baştan** tasarlanır, iki hiyerarşiyi ayırır; Adapter **sonradan** gelir, uyumsuzluğu onarır. |
| Bridge vs. Strategy | Yapısal olarak aynı; Bridge soyutlamanın kendi alt sınıfları da olduğunda, Strategy yalnızca algoritma değiştiğinde. |
| Composite vs. Decorator | İkisi de özyinelemeli bileşim; Composite **çok** çocuk toplar, Decorator **tek** nesne sarar ve davranış ekler. |

:::callout{tone="warning" title="Sarmalayıcı yorgunluğu"}
Her katman bir dolaylılıktır. Bir isteğin `LoggingDecorator → MetricsDecorator → RetryDecorator → CircuitBreakerDecorator → CachingProxy → AuthProxy → Adapter → SDK` yolculuğu, stack trace'te sekiz çerçeve ve hata ayıklamada bir öğleden sonra demektir. Kesen ilgileri çerçeve düzeyine (HTTP middleware, service mesh sidecar — c-04) taşımak çoğu zaman daha temizdir; nesne düzeyinde decorator'ı yalnızca gerçekten nesneye özgü davranış için kullanın.
:::

:::realworld{company="Netflix"}
Netflix'in **Zuul** API gateway'i filtre zinciri ile çalışır: her istek `pre`, `route` ve `post` filtrelerinden geçer — kimlik doğrulama, rate limiting, bölge yönlendirme, yanıt sıkıştırma. Bu, HTTP düzeyinde **Decorator** zinciridir; filtreler çalışma zamanında yüklenip sırası değiştirilebilir. Aynı şirketin **Hystrix** kütüphanesi (bugün Resilience4j ile devam eden fikir) her uzak çağrıyı bir `HystrixCommand` içine sarar: zaman aşımı, bulkhead ve circuit breaker davranışını **Proxy** gibi araya girerek uygular; çağrı reddedilebilir ve gerçek servise hiç ulaşmaz. Netflix'in cihaz ekiplerinin BFF katmanı ise yüzlerce mikroservisi tek bir cihaz API'si arkasına koyan büyük bir **Facade**'dır. Son olarak, Netflix'in Java servisleri yıllar içinde REST'ten gRPC'ye geçerken istemci kütüphaneleri **Adapter** katmanlarıyla eski arayüzü korudu; çağıran kod değişmeden taşıma kademeli yapıldı. Tek bir şirketin edge katmanında dört yapısal kalıbın aynı anda çalışması tesadüf değil: bunlar ölçekli sistemlerin doğal eklem yerleridir.
:::

:::callout{tone="tip" title="Mülakat ipuçları"}
- "Decorator ile Proxy farkı?" neredeyse kesin sorulur: **niyet** (genişletme vs. kontrol) ve **kim kurar** (istemci zinciri vs. proxy gerçek nesneyi) cevabını verin.
- Adapter'ı hexagonal mimariyle bağlayın: "giden adaptörlerim Adapter kalıbıdır" cümlesi iki dersi birleştirir.
- Facade'ı savunurken "iş kuralı içermez, alt sisteme erişimi yasaklamaz" sınırlarını söyleyin.
- Bridge'i "N×M yerine N+M" formülüyle ve JDBC örneğiyle anlatın.
- Composite'te `add()`'in yaprakta ne yapacağı sorusuna hazır olun; iki seçeneğin ödünleşimini bilin.
:::

:::quiz{src="quiz.json"}
:::

:::next{lesson="c-03-behavioral-patterns"}
Sırada davranışsal kalıplar: nesneler arasında sorumluluk ve iletişimi düzenleyen Observer, Strategy, Command, State, Chain of Responsibility, Mediator ve Template Method.
:::

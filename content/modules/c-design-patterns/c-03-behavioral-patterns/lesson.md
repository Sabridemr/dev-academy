---
id: c-03-behavioral-patterns
slug: behavioral-patterns
module: c-design-patterns
order: 3
title:
  tr: "Behavioral: Observer, Strategy, Command, State, Chain of Responsibility, Mediator, Template Method"
  en: "Behavioral: Observer, Strategy, Command, State, Chain of Responsibility, Mediator, Template Method"
summary:
  tr: Nesneler arası sorumluluk ve iletişim kalıpları.
  en: Patterns for responsibility and communication between objects.
durationMinutes: 55
level: intermediate
tags: [design-patterns, gof, behavioral, observer, strategy, command, state, chain-of-responsibility, mediator, template-method, typescript]
prerequisites: [c-02-structural-patterns]
concepts: [behavioral-patterns, observer, strategy, command, state, chain-of-responsibility, mediator, template-method, hollywood-principle, open-closed]
---

## Kavram: kim, kimi, ne zaman çağırıyor?

Yapısal kalıplar nesnelerin **nasıl birleştiğini** düzenlerdi. **Behavioral (davranışsal) kalıplar** nesnelerin **nasıl konuştuğunu** ve sorumluluğun **kime ait olduğunu** düzenler. Hepsi aynı soruya farklı cevaplardır: *bir şey olduğunda hangi nesne karar verecek ve kimler haberdar olacak?*

| Kalıp | Soru | Tek cümle |
|---|---|---|
| **Strategy** | Aynı işin değiştirilebilir yolları var mı? | Algoritmayı nesneye koy, çalışma zamanında takıp çıkar. |
| **Template Method** | İskelet sabit, adımlar değişken mi? | Sırayı üst sınıfta sabitle, adımları alt sınıfa bırak. |
| **State** | Davranış duruma göre köklü biçimde değişiyor mu? | Her durum bir sınıf; geçişler durumun içinde. |
| **Observer** | Bir değişiklikten kaç taraf haberdar olmalı? | Yayınla; kimin dinlediğini bilme. |
| **Mediator** | Çok bileşen karmaşık biçimde konuşuyor mu? | Herkes tek aracıyla konuşsun. |
| **Command** | İsteği saklamak, ertelemek, geri almak gerekiyor mu? | İsteği nesneye çevir. |
| **Chain of Responsibility** | İsteği kim ele alacak belirsiz mi? | Halka halka ilerlet; işle, ilet ya da kes. |

:::diagram{src="diagram.svg" alt="Yedi davranışsal kalıbın üç grupta karşılaştırma haritası: değişen algoritma, iletişim, istek yönetimi|Comparison map of the seven behavioral patterns in three groups: varying algorithm, communication, request management"}
Üç grup: algoritma/davranış değişimi, iletişim, istek yönetimi. Karar akışı altta.
:::

Tek bir "sipariş ver" isteği bu kalıpların beşinden geçebilir. Önce bütünü görelim, sonra her kalıbı tek tek açalım.

:::animation{scene="scene.json"}
Middleware zinciri → komut nesnesi → fiyat stratejisi → durum geçişi → olay yayını: bir istek, beş davranışsal kalıp.
:::

:::interactive{type="request-journey" stages="auth-handler,ratelimit-handler,validation-handler,command-bus,order-state,pricing-strategy,event-bus" failureStage="validation-handler"}
İsteği gönderip zincirdeki halkaları sırayla izleyin: üç handler (auth, rate limit, validation) → komut veri yolu → sipariş durumu → fiyat stratejisi → olay yayını. "Hata enjekte et: validation-handler" kutusunu işaretleyip tekrar gönderin: zincir o halkada kesilir, komut hiç çalışmaz ve hiçbir olay yayınlanmaz — Chain of Responsibility'nin "halkayı kaldır ya da sırasını değiştir" esnekliği, her halkanın sonrakini bilmeden karar vermesinden gelir. Şelalede her halkanın maliyetine bakın: ucuz ve sık eleyen halkaların (auth, rate limit) zincirin başında durması boşuna değildir.
:::

---

## 1. Observer

**Niyet**: Nesneler arasında bire çok bağımlılık tanımlamak; bir nesnenin durumu değiştiğinde bağımlı tüm nesnelerin otomatik olarak haberdar olmasını sağlamak.

Yayıncı (subject) bir gözlemci listesi tutar; `notify()` çağrıldığında listedeki her gözlemcinin `update()` metodu çağrılır. Yayıncı gözlemcilerin somut tipini bilmez; yeni gözlemci eklemek yayıncıyı değiştirmez. DOM olayları, RxJS, Node `EventEmitter`, React state abonelikleri ve b-02'deki olay tabanlı mimari bu kalıbın süreç içi ve süreçler arası biçimleridir.

:::diagram{src="uml-observer.svg" alt="Observer UML: OrderEvents konusu, OrderObserver arayüzü, EmailObserver ve AnalyticsObserver|Observer UML: the OrderEvents subject, the OrderObserver interface, EmailObserver and AnalyticsObserver"}
:::

:::animation{scene="observer.scene.json"}
Abonelik → yayın → yayıncıya dokunmadan yeni gözlemci → abonelik iptali ve tuzaklar.
:::

:::code{lang="ts" title="Observer: tip güvenli, iptal fonksiyonu dönen, hata izole eden"}
```ts
export interface OrderPaid { orderId: string; userId: string; totalMinor: number }
export interface OrderObserver { update(evt: OrderPaid): void | Promise<void> }

export class OrderEvents {
  private readonly observers = new Set<OrderObserver>();

  /** Abone ol; dönen fonksiyon aboneliği iptal eder (sızıntıya karşı) */
  subscribe(o: OrderObserver): () => void {
    this.observers.add(o);
    return () => this.observers.delete(o);
  }

  async notify(evt: OrderPaid): Promise<void> {
    // Her gözlemci izole: biri patlarsa diğerleri yine çağrılır
    const results = await Promise.allSettled([...this.observers].map((o) => o.update(evt)));
    for (const r of results) if (r.status === 'rejected') console.error('observer failed', r.reason);
  }
}

export class EmailObserver implements OrderObserver {
  constructor(private readonly mailer: Mailer) {}
  update(evt: OrderPaid) { return this.mailer.send(evt.userId, `Sipariş ${evt.orderId} alındı`); }
}
export class AnalyticsObserver implements OrderObserver {
  constructor(private readonly tracker: Tracker) {}
  update(evt: OrderPaid) { this.tracker.track('order_paid', { value: evt.totalMinor / 100 }); }
}

// Kompozisyon kökü
const events = new OrderEvents();
const unsubscribeAnalytics = events.subscribe(new AnalyticsObserver(tracker));
events.subscribe(new EmailObserver(mailer));
// ... kapanışta: unsubscribeAnalytics();
```
```python
class OrderEvents:
    def __init__(self): self._observers = set()
    def subscribe(self, observer):
        self._observers.add(observer)
        return lambda: self._observers.discard(observer)      # iptal fonksiyonu
    def notify(self, evt):
        for o in list(self._observers):                        # kopya: iterasyonda değişiklik güvenli
            try: o.update(evt)
            except Exception as e: log.exception("observer failed: %s", e)   # izolasyon

class EmailObserver:
    def __init__(self, mailer): self.mailer = mailer
    def update(self, evt): self.mailer.send(evt.user_id, f"Sipariş {evt.order_id} alındı")
```
```java
public final class OrderEvents {
    private final Set<OrderObserver> observers = ConcurrentHashMap.newKeySet();
    public Runnable subscribe(OrderObserver o) { observers.add(o); return () -> observers.remove(o); }
    public void notify(OrderPaid evt) {
        for (OrderObserver o : observers) {
            try { o.update(evt); } catch (RuntimeException e) { log.error("observer failed", e); }  // izolasyon
        }
    }
}
// JDK: java.util.concurrent.Flow, PropertyChangeListener; Spring: ApplicationEventPublisher + @EventListener
```
:::

**Ne zaman kullan**
- Bir değişikliğin ilgilendirdiği taraf sayısı değişken ve yayıncı onları tanımamalı.
- Modüller arası gevşek bağ istiyorsunuz (b-01 modüler monolitte süreç içi olay otobüsü).

**Ne zaman kullanma**
- Tek bir dinleyici var ve hep olacak: doğrudan çağrı daha okunabilir.
- Sıra ve atomiklik kritik ("önce stok, sonra ödeme"): Observer sıra garantisi vermez; orkestrasyon (b-02) kullanın.
- Gözlemciler ağır iş yapıyor: senkron `notify` yayıncıyı yavaşlatır; kuyruğa aktarın.

---

## 2. Strategy

**Niyet**: Bir algoritma ailesi tanımlamak, her birini ayrı nesneye koymak ve birbirinin yerine kullanılabilir yapmak.

Bağlam (`ShippingCalculator`) algoritmayı **seçmez, kullanır**; seçim dışarıda (konfigürasyon, kullanıcı, kural motoru) yapılır. `if (type === 'express') ... else if ...` zincirlerinin yerini alır; yeni algoritma eklemek bağlamı değiştirmez.

:::diagram{src="uml-strategy.svg" alt="Strategy UML: ShippingCalculator bağlamı, PricingStrategy arayüzü ve FlatRate, ByWeight, Express stratejileri|Strategy UML: the ShippingCalculator context, the PricingStrategy interface and the FlatRate, ByWeight, Express strategies"}
:::

:::animation{scene="strategy.scene.json"}
Strateji dışarıdan seçilir, bağlam devreder, çalışma zamanında değiştirilir.
:::

:::code{lang="ts" title="Strategy: arayüz olarak ve fonksiyon olarak"}
```ts
export interface Parcel { weightKg: number; distanceKm: number }
export interface PricingStrategy { price(p: Parcel): number }      // kuruş

export class FlatRate implements PricingStrategy {
  constructor(private readonly feeMinor: number) {}
  price() { return this.feeMinor; }
}
export class ByWeight implements PricingStrategy {
  constructor(private readonly perKgMinor: number) {}
  price(p: Parcel) { return Math.ceil(p.weightKg) * this.perKgMinor; }
}
export class Express implements PricingStrategy {
  constructor(private readonly base: PricingStrategy, private readonly multiplier: number) {}
  price(p: Parcel) { return Math.round(this.base.price(p) * this.multiplier); }   // stratejiler birleştirilebilir
}

export class ShippingCalculator {
  constructor(private strategy: PricingStrategy) {}
  setStrategy(s: PricingStrategy) { this.strategy = s; }
  price(p: Parcel) {
    const net = this.strategy.price(p);                      // değişen kısım
    return Math.round(net * 1.2);                            // ortak kısım: KDV
  }
}

// TypeScript'te strateji çoğu zaman yalnızca bir fonksiyondur:
type Pricing = (p: Parcel) => number;
const strategies: Record<string, Pricing> = {
  flat: () => 4_900,
  weight: (p) => Math.ceil(p.weightKg) * 1_200,
  express: (p) => Math.round(Math.ceil(p.weightKg) * 1_200 * 1.8),
};
const price = strategies[userChoice](parcel);
```
```python
from typing import Callable, Protocol

class PricingStrategy(Protocol):
    def price(self, parcel) -> int: ...

class ByWeight:
    def __init__(self, per_kg_minor): self.per_kg = per_kg_minor
    def price(self, parcel): return math.ceil(parcel.weight_kg) * self.per_kg

class ShippingCalculator:
    def __init__(self, strategy: PricingStrategy): self.strategy = strategy
    def price(self, parcel): return round(self.strategy.price(parcel) * 1.2)

# Fonksiyonel biçim: strateji = fonksiyon
Pricing = Callable[[object], int]
strategies: dict[str, Pricing] = {
    "flat": lambda p: 4900,
    "weight": lambda p: math.ceil(p.weight_kg) * 1200,
}
```
```java
public interface PricingStrategy { long price(Parcel p); }

public final class ByWeight implements PricingStrategy {
    private final long perKgMinor;
    public ByWeight(long perKgMinor) { this.perKgMinor = perKgMinor; }
    public long price(Parcel p) { return (long) Math.ceil(p.weightKg()) * perKgMinor; }
}

public final class ShippingCalculator {
    private PricingStrategy strategy;
    public ShippingCalculator(PricingStrategy s) { this.strategy = s; }
    public void setStrategy(PricingStrategy s) { this.strategy = s; }
    public long price(Parcel p) { return Math.round(strategy.price(p) * 1.2); }
}
// Java 8+: PricingStrategy fonksiyonel arayüz → lambda: calc.setStrategy(p -> 4_900L);
// JDK örneği: Comparator, Collections.sort(list, comparator)
```
:::

**Ne zaman kullan**
- Aynı işlemin birden çok varyantı var ve varyant çalışma zamanında seçiliyor (fiyatlama, sıkıştırma, kimlik doğrulama yöntemi, yeniden deneme politikası).
- `switch` dalları büyüyor ve her dal ayrı test edilmek isteniyor.

**Ne zaman kullanma**
- İki varyant var ve hiç artmayacak: basit `if` dürüsttür.
- Dil birinci sınıf fonksiyon destekliyorsa (TS, Python, Kotlin, Java lambda) sınıf hiyerarşisi yerine fonksiyon geçirmek çoğu zaman yeterlidir; kalıp aynıdır, tören azalır.

---

## 3. Command

**Niyet**: Bir isteği nesne olarak kapsüllemek; böylece istekleri parametreleştirmek, kuyruğa almak, loglamak ve geri alınabilir yapmak.

İstek (`AddItemCommand`) ne yapılacağını ve kime yapılacağını (alıcı: `Cart`) bilir; çağırıcı (`CommandHistory`, bir düğme, bir kuyruk tüketicisi) yalnızca `execute()` bilir. Komut nesneleşince serileştirilebilir, saklanabilir, yeniden oynatılabilir: b-02'deki CQRS komutları ve iş kuyrukları aynı kalıbın dağıtık hâlidir.

:::diagram{src="uml-command.svg" alt="Command UML: Command arayüzü, AddItemCommand ve RemoveItemCommand, CommandHistory çağırıcısı ve Cart alıcısı|Command UML: the Command interface, AddItemCommand and RemoveItemCommand, the CommandHistory invoker and the Cart receiver"}
:::

:::animation{scene="command.scene.json"}
İstek nesneleşir → çağırıcı çalıştırır, yığına koyar → geri al aynı komutun `undo()` metodunu çağırır.
:::

:::code{lang="ts" title="Command: execute/undo, geçmiş yığını, serileştirme"}
```ts
export interface Command { execute(): void; undo(): void; readonly name: string }

export class Cart {
  readonly lines = new Map<string, number>();
  add(sku: string, qty: number) { this.lines.set(sku, (this.lines.get(sku) ?? 0) + qty); }
  remove(sku: string, qty: number) {
    const left = (this.lines.get(sku) ?? 0) - qty;
    left > 0 ? this.lines.set(sku, left) : this.lines.delete(sku);
  }
}

export class AddItemCommand implements Command {
  readonly name = 'add-item';
  constructor(private readonly cart: Cart, private readonly sku: string, private readonly qty: number) {}
  execute() { this.cart.add(this.sku, this.qty); }
  undo() { this.cart.remove(this.sku, this.qty); }
  toJSON() { return { name: this.name, sku: this.sku, qty: this.qty }; }   // kuyruğa/loga yazılabilir
}

export class CommandHistory {
  private readonly done: Command[] = [];
  private readonly undone: Command[] = [];
  run(cmd: Command) { cmd.execute(); this.done.push(cmd); this.undone.length = 0; }
  undo() { const c = this.done.pop(); if (c) { c.undo(); this.undone.push(c); } }
  redo() { const c = this.undone.pop(); if (c) { c.execute(); this.done.push(c); } }
}

// Makro: komut listesi de bir komuttur (Composite ile birleşir)
export class MacroCommand implements Command {
  readonly name = 'macro';
  constructor(private readonly cmds: Command[]) {}
  execute() { this.cmds.forEach((c) => c.execute()); }
  undo() { [...this.cmds].reverse().forEach((c) => c.undo()); }
}
```
```python
from dataclasses import dataclass

@dataclass
class AddItemCommand:
    cart: "Cart"; sku: str; qty: int
    def execute(self): self.cart.add(self.sku, self.qty)
    def undo(self): self.cart.remove(self.sku, self.qty)

class CommandHistory:
    def __init__(self): self.done, self.undone = [], []
    def run(self, cmd): cmd.execute(); self.done.append(cmd); self.undone.clear()
    def undo(self):
        if self.done: c = self.done.pop(); c.undo(); self.undone.append(c)
    def redo(self):
        if self.undone: c = self.undone.pop(); c.execute(); self.done.append(c)
```
```java
public interface Command { void execute(); void undo(); }

public record AddItemCommand(Cart cart, String sku, int qty) implements Command {
    public void execute() { cart.add(sku, qty); }
    public void undo() { cart.remove(sku, qty); }
}

public final class CommandHistory {
    private final Deque<Command> done = new ArrayDeque<>(), undone = new ArrayDeque<>();
    public void run(Command c) { c.execute(); done.push(c); undone.clear(); }
    public void undo() { if (!done.isEmpty()) { Command c = done.pop(); c.undo(); undone.push(c); } }
    public void redo() { if (!undone.isEmpty()) { Command c = undone.pop(); c.execute(); done.push(c); } }
}
// JDK: Runnable/Callable + ExecutorService = komut + kuyruk; Swing Action
```
:::

**Ne zaman kullan**
- Undo/redo, makro kaydı, işlem günlüğü (audit), zamanlanmış/ertelenmiş çalıştırma, iş kuyruğu.
- Çağırıcı ile alıcıyı ayırmak: UI düğmesi hangi servisin çağrıldığını bilmesin.

**Ne zaman kullanma**
- Yalnızca bir fonksiyonu geçirmek istiyorsanız: closure/lambda yeterlidir; `undo` ve serileştirme gerekmiyorsa sınıf gereksizdir.
- Geri alma, dış sistemlerde yan etki içeriyorsa (ödeme çekildi): `undo` bir **telafi** işlemidir (b-02 saga), basit ters işlem değil.

---

## 4. State

**Niyet**: Bir nesnenin iç durumu değiştiğinde davranışını değiştirmesine izin vermek; nesne sınıfını değiştirmiş gibi görünür.

Bağlam (`Order`) her çağrıyı mevcut durum nesnesine devreder; durum sınıfı hem davranışı hem de geçerli geçişleri bilir ve bağlamın durumunu değiştirir. `switch(status)` ifadelerinin her metotta tekrarlanmasını önler; durum × olay tablosunu sınıflara dağıtır.

:::diagram{src="uml-state.svg" alt="State UML: Order bağlamı, OrderState arayüzü ve Pending, Paid, Shipped, Cancelled durumları|State UML: the Order context, the OrderState interface and the Pending, Paid, Shipped, Cancelled states"}
:::

:::animation{scene="state.scene.json"}
`pay()` Pending → Paid, `ship()` Paid → Shipped, `cancel()` Shipped durumda reddedilir.
:::

:::code{lang="ts" title="State: geçişler durum sınıfında, bağlamda switch yok"}
```ts
export interface OrderState {
  readonly name: string;
  pay(o: Order): void;
  ship(o: Order): void;
  cancel(o: Order): void;
}

class InvalidTransition extends Error {
  constructor(state: string, action: string) { super(`${action} not allowed in ${state}`); }
}

export class Order {
  private state: OrderState = new PendingState();
  constructor(readonly id: string) {}
  get status() { return this.state.name; }
  pay() { this.state.pay(this); }                      // devret
  ship() { this.state.ship(this); }
  cancel() { this.state.cancel(this); }
  /** @internal yalnızca durum sınıfları çağırır */
  transitionTo(next: OrderState) { this.state = next; }
}

class PendingState implements OrderState {
  readonly name = 'PENDING';
  pay(o: Order) { payments.capture(o.id); o.transitionTo(new PaidState()); }
  ship(o: Order) { throw new InvalidTransition(this.name, 'ship'); }
  cancel(o: Order) { o.transitionTo(new CancelledState()); }
}
class PaidState implements OrderState {
  readonly name = 'PAID';
  pay() { /* idempotent: zaten ödendi */ }
  ship(o: Order) { shipping.create(o.id); o.transitionTo(new ShippedState()); }
  cancel(o: Order) { payments.refund(o.id); o.transitionTo(new CancelledState()); }
}
class ShippedState implements OrderState {
  readonly name = 'SHIPPED';
  pay(o: Order) { throw new InvalidTransition(this.name, 'pay'); }
  ship(o: Order) { throw new InvalidTransition(this.name, 'ship'); }
  cancel(o: Order) { throw new InvalidTransition(this.name, 'cancel'); }   // iade süreci ayrı akıştır
}
class CancelledState implements OrderState {
  readonly name = 'CANCELLED';
  pay(o: Order) { throw new InvalidTransition(this.name, 'pay'); }
  ship(o: Order) { throw new InvalidTransition(this.name, 'ship'); }
  cancel() { /* idempotent */ }
}
```
```python
class OrderState:
    name = "BASE"
    def pay(self, o): raise InvalidTransition(self.name, "pay")
    def ship(self, o): raise InvalidTransition(self.name, "ship")
    def cancel(self, o): raise InvalidTransition(self.name, "cancel")

class Pending(OrderState):
    name = "PENDING"
    def pay(self, o): payments.capture(o.id); o.transition_to(Paid())
    def cancel(self, o): o.transition_to(Cancelled())

class Paid(OrderState):
    name = "PAID"
    def ship(self, o): shipping.create(o.id); o.transition_to(Shipped())
    def cancel(self, o): payments.refund(o.id); o.transition_to(Cancelled())

class Shipped(OrderState): name = "SHIPPED"       # varsayılanlar: her şey hata
class Cancelled(OrderState): name = "CANCELLED"

class Order:
    def __init__(self, id): self.id, self._state = id, Pending()
    def pay(self): self._state.pay(self)
    def ship(self): self._state.ship(self)
    def cancel(self): self._state.cancel(self)
    def transition_to(self, s): self._state = s
```
```java
public sealed interface OrderState permits Pending, Paid, Shipped, Cancelled {
    default void pay(Order o)    { throw new InvalidTransition(name(), "pay"); }
    default void ship(Order o)   { throw new InvalidTransition(name(), "ship"); }
    default void cancel(Order o) { throw new InvalidTransition(name(), "cancel"); }
    String name();
}
public final class Pending implements OrderState {
    public String name() { return "PENDING"; }
    @Override public void pay(Order o) { payments.capture(o.id()); o.transitionTo(new Paid()); }
    @Override public void cancel(Order o) { o.transitionTo(new Cancelled()); }
}
public final class Paid implements OrderState {
    public String name() { return "PAID"; }
    @Override public void ship(Order o) { shipping.create(o.id()); o.transitionTo(new Shipped()); }
    @Override public void cancel(Order o) { payments.refund(o.id()); o.transitionTo(new Cancelled()); }
}
// Order.pay() { state.pay(this); } — bağlamda switch yok. Alternatif: enum + geçiş tablosu (Spring Statemachine).
```
:::

**Ne zaman kullan**
- Nesnenin 3+ durumu var ve her metot duruma göre farklı davranıyor (sipariş, ödeme, bağlantı, belge onayı, oyun karakteri).
- Geçiş kuralları iş açısından kritik ve tek tek test edilmeli.

**Ne zaman kullanma**
- İki durum ve bir bayrak yeterliyse: `boolean` dürüst çözümdür.
- Durum sayısı çok, geçişler veri odaklıysa: açık bir **geçiş tablosu** (`{from, event} → to`) ya da durum makinesi kütüphanesi (XState, Spring Statemachine) daha okunabilir olabilir.

---

## 5. Chain of Responsibility

**Niyet**: Bir isteği, onu ele alabilecek nesnelerden oluşan bir zincir boyunca iletmek; gönderenin alıcıya bağlanmasını önlemek.

Her halka üç seçenek arasında karar verir: **işle**, **sonrakine ilet**, **zinciri kes**. HTTP middleware (Express, Koa, ASP.NET), servlet filter'ları, gRPC interceptor'ları, logging seviyeleri ve UI olay kabarcıklanması (event bubbling) bu kalıptır.

:::diagram{src="uml-chain.svg" alt="Chain of Responsibility UML: soyut Handler ve next referansı; Auth, RateLimit, Validation ve Controller işleyicileri|Chain of Responsibility UML: abstract Handler with next reference; Auth, RateLimit, Validation and Controller handlers"}
:::

:::animation{scene="chain-of-responsibility.scene.json"}
Halkalar iletir → bir halka zinciri keser (400) → geçerli istek sona ulaşır (201).
:::

:::code{lang="ts" title="Chain of Responsibility: setNext zinciri ve middleware biçimi"}
```ts
export interface Req { token?: string; ip: string; body: unknown }
export interface Res { status: number; body?: unknown }

export abstract class Handler {
  private next?: Handler;
  setNext(h: Handler): Handler { this.next = h; return h; }          // zincirleme kurulum
  abstract handle(req: Req): Promise<Res>;
  protected forward(req: Req): Promise<Res> {
    return this.next ? this.next.handle(req) : Promise.resolve({ status: 404 });
  }
}

export class AuthHandler extends Handler {
  async handle(req: Req) { return verify(req.token) ? this.forward(req) : { status: 401 }; }   // kes ya da ilet
}
export class RateLimitHandler extends Handler {
  constructor(private readonly limiter: TokenBucket) { super(); }
  async handle(req: Req) { return this.limiter.tryTake(req.ip) ? this.forward(req) : { status: 429 }; }
}
export class ValidationHandler extends Handler {
  constructor(private readonly schema: ZodSchema) { super(); }
  async handle(req: Req) {
    const parsed = this.schema.safeParse(req.body);
    return parsed.success ? this.forward({ ...req, body: parsed.data }) : { status: 400, body: parsed.error.issues };
  }
}
export class ControllerHandler extends Handler {
  async handle(req: Req) { const order = await orders.place(req.body as PlaceOrder); return { status: 201, body: order }; }
}

// Zincir çalışma zamanında kurulur; sıra önemli: ucuz kontroller öne
const chain = new AuthHandler();
chain.setNext(new RateLimitHandler(bucket)).setNext(new ValidationHandler(PlaceOrderSchema)).setNext(new ControllerHandler());
const res = await chain.handle(req);

// Aynı kalıbın fonksiyonel biçimi (Express/Koa): next() çağırmak = ilet, çağırmamak = kes
app.use(async (ctx, next) => { if (!verify(ctx.token)) return (ctx.status = 401); await next(); });
```
```python
class Handler:
    def __init__(self): self._next = None
    def set_next(self, h): self._next = h; return h
    def handle(self, req): raise NotImplementedError
    def forward(self, req): return self._next.handle(req) if self._next else (404, None)

class AuthHandler(Handler):
    def handle(self, req): return self.forward(req) if verify(req.token) else (401, None)

class RateLimitHandler(Handler):
    def __init__(self, limiter): super().__init__(); self.limiter = limiter
    def handle(self, req): return self.forward(req) if self.limiter.try_take(req.ip) else (429, None)

class ValidationHandler(Handler):
    def handle(self, req):
        errors = validate(req.body)
        return (400, errors) if errors else self.forward(req)

chain = AuthHandler()
chain.set_next(RateLimitHandler(bucket)).set_next(ValidationHandler()).set_next(ControllerHandler())
```
```java
public abstract class Handler {
    private Handler next;
    public Handler setNext(Handler h) { this.next = h; return h; }
    public abstract Response handle(Request req);
    protected Response forward(Request req) { return next == null ? Response.of(404) : next.handle(req); }
}
public final class AuthHandler extends Handler {
    @Override public Response handle(Request req) { return verify(req.token()) ? forward(req) : Response.of(401); }
}
public final class RateLimitHandler extends Handler {
    private final TokenBucket limiter;
    public RateLimitHandler(TokenBucket l) { this.limiter = l; }
    @Override public Response handle(Request req) { return limiter.tryTake(req.ip()) ? forward(req) : Response.of(429); }
}
// Handler chain = new AuthHandler(); chain.setNext(new RateLimitHandler(b)).setNext(new ValidationHandler()).setNext(new ControllerHandler());
// Servlet Filter.doFilter(req, res, chain) ve Spring HandlerInterceptor aynı kalıptır.
```
:::

**Ne zaman kullan**
- İstek, çalışma zamanında belirlenen bir dizi işleyiciden geçmeli ve her işleyici bağımsız eklenip çıkarılabilmeli.
- Kesen ilgiler (auth, limit, doğrulama, loglama) iş mantığından ayrı tutulmalı.

**Ne zaman kullanma**
- İsteği kimin ele alacağı baştan belli: doğrudan çağırın.
- Zincirin sonunda kimse işlemeyebilir ve bu sessizce kaybolur: varsayılan bir son halka (404/exception) ekleyin.
- Sıra bağımlılığı dokümante değilse zincir kırılgandır; sırayı tek yerde (kompozisyon kökü) kurun.

---

## 6. Mediator

**Niyet**: Bir grup nesnenin nasıl etkileştiğini kapsülleyen bir nesne tanımlamak; nesnelerin birbirine açıkça başvurmasını önleyerek gevşek bağ sağlamak.

Bileşenler yalnızca aracıya bildirir; aracı kimin ne yapacağını bilir. N bileşen arasındaki N² olası bağ, N bağa iner. Form koordinasyonu, sohbet odası, hava trafik kulesi klasik örneklerdir; b-02'deki saga orchestrator ve mesaj broker'ı da birer dağıtık mediator'dur.

:::diagram{src="uml-mediator.svg" alt="Mediator UML: FormMediator arayüzü, CheckoutFormMediator ve dört form bileşeni|Mediator UML: the FormMediator interface, CheckoutFormMediator and four form widgets"}
:::

:::animation{scene="mediator.scene.json"}
Adres değişir → aracı kargo ve fiyatı günceller → zincirleme etkiler de aracıdan geçer.
:::

:::code{lang="ts" title="Mediator: bileşenler aracıyı bilir, birbirini değil"}
```ts
export interface FormMediator { notify(sender: Component, event: string): void }

abstract class Component {
  constructor(protected readonly mediator: FormMediator) {}
}

export class AddressField extends Component {
  value = '';
  onChange(v: string) { this.value = v; this.mediator.notify(this, 'changed'); }   // tek bağımlılık: mediator
}
export class ShippingSelector extends Component {
  options: string[] = []; selected?: string;
  reload(opts: string[]) { this.options = opts; this.selected = undefined; }
  select(o: string) { this.selected = o; this.mediator.notify(this, 'selected'); }
}
export class PriceSummary extends Component { total = 0; recalc(shipping?: string) { this.total = computeTotal(shipping); } }
export class SubmitButton extends Component { enabled = false; setEnabled(b: boolean) { this.enabled = b; } }

export class CheckoutFormMediator implements FormMediator {
  constructor(
    private readonly address: AddressField,
    private readonly shipping: ShippingSelector,
    private readonly price: PriceSummary,
    private readonly submit: SubmitButton,
  ) {}

  notify(sender: Component, event: string) {                   // koordinasyon tek yerde
    if (sender === this.address && event === 'changed') {
      this.shipping.reload(shippingOptionsFor(this.address.value));
      this.price.recalc(undefined);
      this.submit.setEnabled(false);
    }
    if (sender === this.shipping && event === 'selected') {
      this.price.recalc(this.shipping.selected);
      this.submit.setEnabled(Boolean(this.address.value && this.shipping.selected));
    }
  }
}
```
```python
class CheckoutFormMediator:
    def __init__(self, address, shipping, price, submit):
        self.address, self.shipping, self.price, self.submit = address, shipping, price, submit
        for c in (address, shipping, price, submit): c.mediator = self

    def notify(self, sender, event):
        if sender is self.address and event == "changed":
            self.shipping.reload(shipping_options_for(self.address.value))
            self.price.recalc(None); self.submit.set_enabled(False)
        elif sender is self.shipping and event == "selected":
            self.price.recalc(self.shipping.selected)
            self.submit.set_enabled(bool(self.address.value and self.shipping.selected))

class AddressField:
    def __init__(self): self.value, self.mediator = "", None
    def on_change(self, v): self.value = v; self.mediator.notify(self, "changed")
```
```java
public interface FormMediator { void notify(Object sender, String event); }

public final class CheckoutFormMediator implements FormMediator {
    private final AddressField address; private final ShippingSelector shipping;
    private final PriceSummary price; private final SubmitButton submit;
    // kurucu...
    @Override public void notify(Object sender, String event) {
        if (sender == address && event.equals("changed")) {
            shipping.reload(shippingOptionsFor(address.value()));
            price.recalc(null); submit.setEnabled(false);
        } else if (sender == shipping && event.equals("selected")) {
            price.recalc(shipping.selected());
            submit.setEnabled(!address.value().isBlank() && shipping.selected() != null);
        }
    }
}
// Örnekler: java.util.Timer, ExecutorService (görev-iş parçacığı aracılığı), Spring ApplicationContext olay yayını
```
:::

**Ne zaman kullan**
- Çok sayıda bileşen karmaşık ve değişken kurallarla birbirini etkiliyor; bileşenleri başka ekranda yeniden kullanmak istiyorsunuz.
- Koordinasyon mantığını tek yerde test etmek istiyorsunuz.

**Ne zaman kullanma**
- İki bileşen var: doğrudan konuşsunlar.
- Mediator her kuralı yutup "tanrı nesnesi" oluyorsa: olay bazlı (Observer) yapıya geçin ya da birden fazla küçük mediator kullanın. Observer ile fark: Observer'da yayıncı kimin dinlediğini bilmez; Mediator herkesi bilir ve yönlendirir.

---

## 7. Template Method

**Niyet**: Bir algoritmanın iskeletini bir işlemde tanımlamak, bazı adımları alt sınıflara ertelemek; alt sınıflar algoritmanın yapısını değiştirmeden adımları yeniden tanımlar.

Üst sınıfın `run()` metodu adımları sabit sırayla çağırır; **soyut adımlar** alt sınıfta zorunlu, **kancalar** (hook) isteğe bağlıdır. "Hollywood ilkesi": *bizi arama, biz seni ararız* — alt sınıf akışı başlatmaz, üst sınıf alt sınıfın adımlarını çağırır. Test çerçevelerinin `setUp/test/tearDown` yaşam döngüsü, React sınıf bileşenlerinin yaşam döngüsü metodları ve c-01'deki Factory Method bu kalıbın örnekleridir.

:::diagram{src="uml-template-method.svg" alt="Template Method UML: soyut DataImporter ve run şablonu; CsvImporter ve JsonImporter alt sınıfları|Template Method UML: abstract DataImporter with the run template; CsvImporter and JsonImporter subclasses"}
:::

:::animation{scene="template-method.scene.json"}
`run()` iskeleti: `open` üstte → `parse` altta → `validate` kancası → `save` altta → `close` üstte.
:::

:::code{lang="ts" title="Template Method: final iskelet, soyut adımlar, kancalar"}
```ts
export interface Row { [k: string]: string }
export interface Report { total: number; saved: number; skipped: number }

export abstract class DataImporter {
  /** Şablon: sıra sabit; alt sınıflar bunu ezmemeli */
  async run(path: string): Promise<Report> {
    const stream = await this.open(path);
    try {
      const rows = await this.parse(stream);                 // soyut adım
      const valid = this.validate(rows);                      // kanca (varsayılanı var)
      await this.save(valid);                                 // soyut adım
      return { total: rows.length, saved: valid.length, skipped: rows.length - valid.length };
    } finally {
      await this.close(stream);                               // kanca
    }
  }

  protected open(path: string): Promise<ReadableStream> { return fs.openAsStream(path); }
  protected abstract parse(stream: ReadableStream): Promise<Row[]>;
  protected validate(rows: Row[]): Row[] { return rows.filter((r) => Object.values(r).some(Boolean)); }  // boş satırı at
  protected abstract save(rows: Row[]): Promise<void>;
  protected close(stream: ReadableStream): Promise<void> { return stream.cancel(); }
}

export class CsvImporter extends DataImporter {
  constructor(private readonly db: Db, private readonly delimiter = ',') { super(); }
  protected async parse(stream: ReadableStream) { return parseCsv(await readAll(stream), { delimiter: this.delimiter }); }
  protected async save(rows: Row[]) { await this.db.bulkInsert('sales', rows); }
}

export class JsonImporter extends DataImporter {
  constructor(private readonly db: Db, private readonly schema: ZodSchema) { super(); }
  protected async parse(stream: ReadableStream) { return JSON.parse(await readAll(stream)) as Row[]; }
  protected validate(rows: Row[]) { return super.validate(rows).filter((r) => this.schema.safeParse(r).success); } // kancayı genişlet
  protected async save(rows: Row[]) { await this.db.bulkInsert('sales', rows); }
}
```
```python
from abc import ABC, abstractmethod

class DataImporter(ABC):
    def run(self, path):                                  # şablon
        stream = self.open(path)
        try:
            rows = self.parse(stream)                     # soyut
            valid = self.validate(rows)                   # kanca
            self.save(valid)                              # soyut
            return {"total": len(rows), "saved": len(valid)}
        finally:
            self.close(stream)                            # kanca

    def open(self, path): return open(path, "rb")
    @abstractmethod
    def parse(self, stream): ...
    def validate(self, rows): return [r for r in rows if any(r.values())]
    @abstractmethod
    def save(self, rows): ...
    def close(self, stream): stream.close()

class CsvImporter(DataImporter):
    def __init__(self, db, delimiter=","): self.db, self.delimiter = db, delimiter
    def parse(self, stream): return list(csv.DictReader(io.TextIOWrapper(stream), delimiter=self.delimiter))
    def save(self, rows): self.db.bulk_insert("sales", rows)
```
```java
public abstract class DataImporter {
    public final Report run(Path path) throws IOException {            // final: sıra değiştirilemez
        try (InputStream in = open(path)) {
            List<Row> rows = parse(in);                                 // soyut
            List<Row> valid = validate(rows);                           // kanca
            save(valid);                                                // soyut
            return new Report(rows.size(), valid.size());
        }
    }
    protected InputStream open(Path p) throws IOException { return Files.newInputStream(p); }
    protected abstract List<Row> parse(InputStream in) throws IOException;
    protected List<Row> validate(List<Row> rows) { return rows.stream().filter(Row::nonEmpty).toList(); }
    protected abstract void save(List<Row> rows);
}

public final class CsvImporter extends DataImporter {
    private final Db db;
    public CsvImporter(Db db) { this.db = db; }
    @Override protected List<Row> parse(InputStream in) { return Csv.read(in); }
    @Override protected void save(List<Row> rows) { db.bulkInsert("sales", rows); }
}
// JDK: AbstractList, InputStream.read(byte[]) → read(); JUnit yaşam döngüsü; Servlet.service() → doGet/doPost
```
:::

**Ne zaman kullan**
- Birden çok sınıf aynı algoritmayı küçük farklarla tekrarlıyor; iskeleti tek yere toplayıp tekrarı kaldırmak istiyorsunuz.
- Çerçeve yazıyorsunuz ve kullanıcıların belirli noktalara kod takmasını istiyorsunuz.

**Ne zaman kullanma**
- Adımlar çalışma zamanında değişmeli ya da birden fazla eksende varyasyon var: **Strategy** (bileşim) daha esnektir; kalıtım tek eksenlidir ve derleme zamanında sabitlenir.
- Alt sınıflar iskeletin sırasını değiştirmeye başlıyorsa kalıp yanlış seçilmiştir; iskelet `final`/`sealed` olmalı.

---

## Kalıpları birbirinden ayırmak

| Karışan ikili | Ayırt edici soru |
|---|---|
| Strategy vs. Template Method | Bileşim mi (çalışma zamanı, çoklu eksen) kalıtım mı (derleme zamanı, tek eksen)? |
| Strategy vs. State | Strategy'yi istemci seçer ve stratejiler birbirini bilmez; State'te geçişi durumun kendisi yapar ve durumlar birbirini bilir. |
| Observer vs. Mediator | Observer'da yayıncı kimseyi tanımaz (bire çok, tek yön); Mediator herkesi tanır ve çift yönlü koordine eder. |
| Command vs. Strategy | Command "ne yapılacak" isteğini (alıcı + parametre) taşır ve geri alınabilir; Strategy "nasıl yapılacak"ı taşır. |
| Chain of Responsibility vs. Decorator | İkisi de zincir; Chain'de halka isteği **kesebilir** ve genellikle biri işler, Decorator'da her katman iletir ve davranış ekler. |

:::callout{tone="warning" title="Kalıp adı, kod kokusu değildir"}
Davranışsal kalıpların çoğu, modern dillerde birinci sınıf fonksiyonlarla çok daha kısa yazılır: Strategy bir fonksiyon, Command bir closure, Observer bir callback listesi, Chain bir middleware dizisidir. Kalıbın değeri sınıf sayısında değil, ekibin ortak kelime dağarcığındadır. "Burada bir Strategy var" demek, altı satırlık fonksiyonun **neden** parametre olarak geçtiğini bir cümlede açıklar. Sınıf hiyerarşisini yalnızca durum taşımak, serileştirmek ya da `undo` gibi ikinci bir metot gerektiğinde kurun.
:::

:::realworld{company="Stripe"}
Stripe'ın ödeme altyapısı davranışsal kalıpların ölçekli bir sergisidir. **PaymentIntent** nesnesi açık bir **State** makinesidir: `requires_payment_method → requires_confirmation → requires_action → processing → succeeded/canceled`; her durumda hangi API çağrısının geçerli olduğu durum tarafından belirlenir ve geçersiz çağrılar `invalid_request_error` ile reddedilir. **Webhook** sistemi dev bir **Observer**'dır: Stripe olayı yayınlar, binlerce müşteri uç noktası abone olur; Stripe kimin dinlediğini bilmez, teslimatı yeniden dener ve müşterilerden idempotent işleyici bekler (b-02'deki at-least-once dersinin aynısı). API istekleri, kimlik doğrulama → rate limiting → idempotency anahtarı kontrolü → doğrulama **Chain of Responsibility**'sinden geçer; `Idempotency-Key` başlığı aynı **Command**'ın iki kez çalışmasını önler. Ödeme yöntemi seçimi (kart, SEPA, Apple Pay) ve 3-D Secure akışları ise **Strategy** ile takılır: aynı `confirm()` çağrısı, yönteme göre farklı yolculuk. Stripe'ın 2017'den beri yayımladığı mühendislik yazıları, bu durum makinelerinin ve idempotency katmanlarının günde yüz milyonlarca isteği nasıl tutarlı tuttuğunu anlatır.
:::

:::callout{tone="tip" title="Mülakat ipuçları"}
- Observer sorulduğunda b-02'deki olay tabanlı mimariyle köprü kurun: "aynı kalıp, süreçler arası".
- Strategy ile State farkını "kim geçişi yapar?" sorusuyla açıklayın; en çok karıştırılan ikilidir.
- Command'ı undo/redo ile değil, **kuyruk ve idempotency** ile anlatırsanız dağıtık sistem bilginizi gösterirsiniz.
- Chain of Responsibility için Express middleware'i örnek verin ve "halka kesebilir" vurgusunu yapın.
- Template Method ile Strategy'de "kalıtım vs. bileşim" tercihini gerekçelendirin; görüşmeciler bileşimi savunmanızı bekler.
- Mediator'ın "tanrı nesne" riskini kendiliğinizden söyleyin.
:::

:::quiz{src="quiz.json"}
:::

:::next{lesson="c-04-distributed-patterns"}
Sırada dağıtık sistem kalıpları: ağ üzerinde hayatta kalmanın yolları — Circuit Breaker, Retry + Backoff, Bulkhead, Sidecar, Strangler Fig ve Outbox.
:::

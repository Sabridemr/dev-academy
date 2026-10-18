---
id: c-01-creational-patterns
slug: creational-patterns
module: c-design-patterns
order: 1
title:
  tr: "Creational: Singleton, Factory, Abstract Factory, Builder, Prototype"
  en: "Creational: Singleton, Factory, Abstract Factory, Builder, Prototype"
summary:
  tr: Nesne üretimini soyutlayan kalıplar.
  en: Patterns that abstract object creation.
durationMinutes: 45
level: intermediate
tags: [design-patterns, gof, creational, singleton, factory, builder, prototype, typescript]
prerequisites: [b-03-serverless-bff-clean-ddd]
concepts: [creational-patterns, singleton, factory-method, abstract-factory, builder, prototype, dependency-inversion, dependency-injection]
---

## Kavram: `new` bir bağımlılıktır

Bir sınıfın içinde `new EmailNotification(smtp)` yazdığınız anda o sınıf üç şeyi bilmek zorunda kalır: somut sınıfın adını, kurucusunun parametrelerini ve o parametrelerin nereden geleceğini. Bu bilgi istemciye gömüldükçe değişiklik maliyeti artar: yeni bir kanal eklemek istemciyi değiştirir, testte gerçek SMTP sunucusu gerekir, aynı `if/else` beş yerde kopyalanır.

**Creational (yaratımsal) kalıplar**, "hangi sınıfın, ne zaman, nasıl örnekleneceği" kararını çağıran koddan ayırır. Hepsi aynı ilkeye dayanır: istemci **soyut bir tipe** konuşur, somut sınıf başka bir yerde seçilir (Dependency Inversion). Farkları, kararın **nereye** taşındığıdır:

| Kalıp | Karar nereye taşınır? | Çözdüğü asıl problem |
|---|---|---|
| **Singleton** | Sınıfın kendisine (statik erişim) | Gerçekten tek olması gereken paylaşılan kaynak |
| **Factory Method** | Alt sınıfa (kalıtım) | Üst sınıf akışı bilir, ürünü bilmez |
| **Abstract Factory** | Ayrı bir fabrika nesnesine (bileşim) | Birlikte kullanılması gereken ürün aileleri |
| **Builder** | Adım adım dolduran bir kurucu nesneye | Çok parametreli, isteğe bağlı alanlı karmaşık nesne |
| **Prototype** | Mevcut bir örneğin `clone()` metoduna | Kurulumu pahalı ya da sınıfı çalışma zamanında belli olan nesne |

:::diagram{src="diagram.svg" alt="Beş creational kalıbın karşılaştırma haritası: problem, fikir, kullanım yeri ve aralarındaki ilişkiler|Comparison map of the five creational patterns: problem, idea, typical use and the relations between them"}
Harita: Factory Method genelleşince Abstract Factory olur; Abstract Factory ve Builder karmaşık üretimde alternatiftir; Prototype fabrikaların içinde kullanılabilir; fabrikalar çoğu zaman tek örnektir.
:::

Aşağıdaki animasyon, bir servisin doğrudan `new` ile başlayıp fabrikaya geçişini ve beş kalıbın seçim rehberini gösterir.

:::animation{scene="scene.json"}
Doğrudan `new` → `if/else` şişmesi → fabrika → istemciye dokunmadan kanal değiştirme → hangi kalıp ne zaman.
:::

:::interactive{type="request-journey" scenario="creational-pipeline" stages="controller,factory,builder,singleton-config,repository" showObjectGraph=true}
Bir "bildirim gönder" isteğinin nesne grafiğini izleyin: controller fabrikadan ürün ister, ürün builder ile kurulan bir istek nesnesi kullanır, yapılandırma tek örnekten (singleton) okunur. Her durakta "somut sınıfı kim biliyor?" sorusunu açıp bağımlılık yönünü görün; fabrikayı sahte (mock) ile değiştirip test modunu deneyin.
:::

---

## 1. Singleton

**Niyet**: Bir sınıfın yalnızca tek bir örneği olmasını sağlamak ve ona küresel bir erişim noktası sunmak.

Kurucu `private` yapılır; statik bir `getInstance()` ilk çağrıda nesneyi yaratır, sonraki çağrılarda aynı referansı döner. Yapılandırma, bağlantı havuzu, logger, metrik kayıt defteri gibi "iki tane olması anlamsız" kaynaklar için düşünülür.

:::diagram{src="uml-singleton.svg" alt="Singleton UML: ConfigService sınıfı, özel statik instance alanı, özel kurucu ve statik getInstance; iki istemci aynı örneği kullanır|Singleton UML: ConfigService with a private static instance field, private constructor and static getInstance; two clients share the instance"}
:::

:::animation{scene="singleton.scene.json"}
İlk `getInstance()` nesneyi yaratır, ikincisi aynı referansı alır; her iki istemci aynı nesne üzerinde çalışır.
:::

:::code{lang="ts" title="Singleton: tembel başlatma, private kurucu, test için reset"}
```ts
export class ConfigService {
  private static instance: ConfigService | undefined;
  private readonly values: Map<string, string>;

  private constructor() {                               // dışarıdan new engellenir
    this.values = loadConfigFromEnvAndFile();           // pahalı iş bir kez yapılır
  }

  static getInstance(): ConfigService {
    // JS tek iş parçacıklı olduğu için kilit gerekmez; JVM/CLR'de double-checked locking ya da holder idiom gerekir
    if (!ConfigService.instance) ConfigService.instance = new ConfigService();
    return ConfigService.instance;
  }

  get(key: string): string {
    const v = this.values.get(key);
    if (v === undefined) throw new Error(`missing config: ${key}`);
    return v;
  }

  /** Yalnızca testlerde: izolasyon için örneği sıfırla */
  static resetForTests() { ConfigService.instance = undefined; }
}

// Kullanım
const dbUrl = ConfigService.getInstance().get('db.url');
```
```python
import threading

class ConfigService:
    _instance = None
    _lock = threading.Lock()

    def __new__(cls):
        if cls._instance is None:
            with cls._lock:                       # çok iş parçacığında yarış koşulunu önle
                if cls._instance is None:
                    inst = super().__new__(cls)
                    inst._values = load_config()  # bir kez
                    cls._instance = inst
        return cls._instance

    def get(self, key):
        return self._values[key]

# Pythonic alternatif: modül düzeyinde tek nesne (config = ConfigService()) — modüller zaten tek yüklenir
```
```java
public final class ConfigService {
    // Holder idiom: JVM sınıf yüklemesi tembel ve iş parçacığı güvenlidir; kilit gerekmez
    private static final class Holder { static final ConfigService INSTANCE = new ConfigService(); }
    private final Map<String, String> values;

    private ConfigService() { values = loadConfig(); }

    public static ConfigService getInstance() { return Holder.INSTANCE; }

    public String get(String key) {
        var v = values.get(key);
        if (v == null) throw new IllegalStateException("missing config: " + key);
        return v;
    }
}
// Alternatif: enum ConfigService { INSTANCE; ... } — serileştirme ve yansımaya karşı da güvenli
```
:::

**Ne zaman kullan**
- Kaynak fiziksel olarak tektir ve paylaşılmalıdır: bağlantı havuzu, işlem içi cache, metrik kayıt defteri.
- Başlatma pahalıdır ve bir kez yapılmalıdır.

**Ne zaman kullanma**
- "Her yerden erişmek kolay olsun" diye. Bu, küresel değişkenin kılık değiştirmiş hâlidir: bağımlılık imzalarda görünmez, testler birbirine sızar, sıralamaya bağlı hatalar çıkar.
- Bir DI konteyneriniz varsa: aynı sonucu `singleton` ömür kapsamıyla (NestJS `@Injectable`, Spring `@Scope("singleton")`) açık bağımlılık olarak alırsınız. Modern kodda Singleton çoğunlukla bir **ömür politikası**, bir sınıf kalıbı değildir.

---

## 2. Factory Method

**Niyet**: Nesne yaratma arayüzünü üst sınıfta tanımlamak, hangi sınıfın örnekleneceğine alt sınıfların karar vermesini sağlamak.

Üst sınıf bir **şablon** akış içerir (`notify()`), akışın içinde soyut bir **fabrika metodu** çağırır (`createNotification()`). Alt sınıf yalnızca bu metodu ezer. Böylece akış tek yerde kalır, ürün çeşitlenir.

:::diagram{src="uml-factory-method.svg" alt="Factory Method UML: soyut NotificationCreator ve notify şablonu, EmailCreator/SmsCreator alt sınıfları, Notification arayüzü ve somut ürünler|Factory Method UML: abstract NotificationCreator with the notify template, EmailCreator/SmsCreator subclasses, the Notification interface and concrete products"}
:::

:::animation{scene="factory-method.scene.json"}
İstemci soyut tipe konuşur; şablon metod fabrika metodunu çağırır; alt sınıf somut ürünü yaratır; şablon ürünü arayüz üzerinden kullanır.
:::

:::code{lang="ts" title="Factory Method: şablon akış üst sınıfta, ürün kararı alt sınıfta"}
```ts
export interface Notification { send(userId: string, message: string): Promise<void> }

export abstract class NotificationCreator {
  /** Şablon: loglama ve yeniden deneme her kanal için aynı */
  async notify(userId: string, message: string): Promise<void> {
    const notification = this.createNotification();        // fabrika metodu
    for (let attempt = 1; attempt <= 3; attempt++) {
      try { await notification.send(userId, message); return; }
      catch (err) { if (attempt === 3) throw err; await sleep(100 * attempt); }
    }
  }
  protected abstract createNotification(): Notification;   // alt sınıf karar verir
}

export class EmailCreator extends NotificationCreator {
  constructor(private readonly smtp: SmtpClient) { super(); }
  protected createNotification() { return new EmailNotification(this.smtp); }
}

export class SmsCreator extends NotificationCreator {
  constructor(private readonly gateway: SmsGateway) { super(); }
  protected createNotification() { return new SmsNotification(this.gateway); }
}

// İstemci yalnızca soyut tipi bilir; hangi creator'ın enjekte edildiği DI/konfig işidir
export class OrderService {
  constructor(private readonly notifier: NotificationCreator) {}
  async confirm(orderId: string, userId: string) { await this.notifier.notify(userId, `Sipariş ${orderId} onaylandı`); }
}
```
```python
from abc import ABC, abstractmethod

class NotificationCreator(ABC):
    def notify(self, user_id, message):          # şablon akış
        notification = self.create_notification()
        for attempt in range(1, 4):
            try:
                notification.send(user_id, message); return
            except TransientError:
                if attempt == 3: raise
                time.sleep(0.1 * attempt)

    @abstractmethod
    def create_notification(self): ...          # fabrika metodu

class EmailCreator(NotificationCreator):
    def __init__(self, smtp): self.smtp = smtp
    def create_notification(self): return EmailNotification(self.smtp)

class SmsCreator(NotificationCreator):
    def __init__(self, gateway): self.gateway = gateway
    def create_notification(self): return SmsNotification(self.gateway)
```
```java
public abstract class NotificationCreator {
    public void notify(String userId, String message) {           // şablon akış
        Notification n = createNotification();                     // fabrika metodu
        for (int attempt = 1; ; attempt++) {
            try { n.send(userId, message); return; }
            catch (TransientException e) { if (attempt == 3) throw e; sleep(100L * attempt); }
        }
    }
    protected abstract Notification createNotification();
}

public final class EmailCreator extends NotificationCreator {
    private final SmtpClient smtp;
    public EmailCreator(SmtpClient smtp) { this.smtp = smtp; }
    @Override protected Notification createNotification() { return new EmailNotification(smtp); }
}

public final class SmsCreator extends NotificationCreator {
    private final SmsGateway gateway;
    public SmsCreator(SmsGateway gateway) { this.gateway = gateway; }
    @Override protected Notification createNotification() { return new SmsNotification(gateway); }
}
```
:::

**Ne zaman kullan**
- Bir çerçeve/kütüphane yazıyorsunuz ve kullanıcıların akışınıza kendi ürünlerini takmasını istiyorsunuz (hook noktası). `React.createElement`, Java `Collection.iterator()`, test çerçevelerinde `createTestClient()` bu kalıptır.
- Akış sabit, üretilen tür değişken.

**Ne zaman kullanma**
- Yalnızca bir `switch(type)` ile nesne seçiyorsanız: basit bir **statik fabrika fonksiyonu** (`createNotification(type)`) yeterlidir; sınıf hiyerarşisi kurmak gereksizdir.
- Kalıtım yerine bileşim mümkünse (ürünü kurucudan enjekte etmek), çoğu zaman daha sadedir.

---

## 3. Abstract Factory

**Niyet**: Birbirleriyle ilişkili ya da birlikte kullanılması gereken nesne **ailelerini**, somut sınıflarını belirtmeden üretmek.

Factory Method tek ürün üretir ve kalıtım kullanır; Abstract Factory **birden çok ürün** üretir ve **bileşim** kullanır: istemciye bir fabrika nesnesi verilir, istemci ondan düğme, onay kutusu, menü ister. Tek fabrika nesnesi olduğu için aile karışamaz.

:::diagram{src="uml-abstract-factory.svg" alt="Abstract Factory UML: UIFactory arayüzü, MacFactory ve WindowsFactory, Button ve Checkbox arayüzleri ve platforma özgü ürünler|Abstract Factory UML: UIFactory interface, MacFactory and WindowsFactory, Button and Checkbox interfaces and platform-specific products"}
:::

:::animation{scene="abstract-factory.scene.json"}
Fabrika bir kez seçilir; istemci aynı fabrikadan düğme ve onay kutusu alır; fabrika değişince tüm aile değişir.
:::

:::code{lang="ts" title="Abstract Factory: platforma göre tutarlı UI ailesi"}
```ts
export interface Button { paint(): string }
export interface Checkbox { paint(): string }

export interface UIFactory {
  createButton(): Button;
  createCheckbox(): Checkbox;
}

class MacButton implements Button { paint() { return '<button class="mac">' } }
class MacCheckbox implements Checkbox { paint() { return '<input class="mac-check">' } }
class WinButton implements Button { paint() { return '<button class="win">' } }
class WinCheckbox implements Checkbox { paint() { return '<input class="win-check">' } }

export class MacFactory implements UIFactory {
  createButton() { return new MacButton(); }
  createCheckbox() { return new MacCheckbox(); }
}
export class WindowsFactory implements UIFactory {
  createButton() { return new WinButton(); }
  createCheckbox() { return new WinCheckbox(); }
}

// İstemci: yalnızca arayüzleri bilir, aile tutarlılığı garanti
export class SettingsScreen {
  constructor(private readonly ui: UIFactory) {}
  render() { return this.ui.createButton().paint() + this.ui.createCheckbox().paint(); }
}

// if/else'in bulunduğu TEK yer: kompozisyon kökü
export function makeFactory(platform: NodeJS.Platform): UIFactory {
  return platform === 'darwin' ? new MacFactory() : new WindowsFactory();
}
```
```python
from typing import Protocol

class Button(Protocol):
    def paint(self) -> str: ...
class Checkbox(Protocol):
    def paint(self) -> str: ...

class UIFactory(Protocol):
    def create_button(self) -> Button: ...
    def create_checkbox(self) -> Checkbox: ...

class MacFactory:
    def create_button(self): return MacButton()
    def create_checkbox(self): return MacCheckbox()

class WindowsFactory:
    def create_button(self): return WinButton()
    def create_checkbox(self): return WinCheckbox()

class SettingsScreen:
    def __init__(self, ui: UIFactory): self.ui = ui
    def render(self): return self.ui.create_button().paint() + self.ui.create_checkbox().paint()

def make_factory(platform: str) -> UIFactory:         # tek karar noktası
    return MacFactory() if platform == "darwin" else WindowsFactory()
```
```java
public interface Button { String paint(); }
public interface Checkbox { String paint(); }

public interface UIFactory {
    Button createButton();
    Checkbox createCheckbox();
}

public final class MacFactory implements UIFactory {
    public Button createButton() { return new MacButton(); }
    public Checkbox createCheckbox() { return new MacCheckbox(); }
}
public final class WindowsFactory implements UIFactory {
    public Button createButton() { return new WinButton(); }
    public Checkbox createCheckbox() { return new WinCheckbox(); }
}

public final class SettingsScreen {
    private final UIFactory ui;
    public SettingsScreen(UIFactory ui) { this.ui = ui; }
    public String render() { return ui.createButton().paint() + ui.createCheckbox().paint(); }
}
// Kompozisyon kökü: UIFactory f = os.equals("mac") ? new MacFactory() : new WindowsFactory();
```
:::

**Ne zaman kullan**
- Ürünler **aile** oluşturuyor ve karışmamalı: tema (açık/koyu), platform (Mac/Win), bulut sağlayıcı (AWS/GCP istemci kümesi), veritabanı sürücü ailesi (connection + command + transaction).
- Aileyi çalışma zamanında/konfigürasyonla değiştirmek istiyorsunuz.

**Ne zaman kullanma**
- Tek ürün türü varsa (Factory Method ya da basit fabrika yeter).
- Aileye sık sık **yeni ürün türü** ekleniyorsa: her yeni ürün (ör. `Slider`) arayüzü ve tüm somut fabrikaları değiştirir. Aile sayısı değil ürün türü sayısı büyüyorsa kalıp yorulur.

---

## 4. Builder

**Niyet**: Karmaşık bir nesnenin kurulumunu temsilinden ayırmak; aynı kurulum sürecinin farklı temsiller üretmesine izin vermek.

Pratikte motivasyon **telescoping constructor** problemidir: `new HttpRequest(url, null, null, 5000, null, true, ...)`. Builder her alanı adıyla, isteğe bağlı ve herhangi bir sırada alır; `build()` doğrulamayı tek yerde yapar ve **değişmez** bir ürün döner.

:::diagram{src="uml-builder.svg" alt="Builder UML: HttpRequestBuilder zincirlenebilir metodları ve build; değişmez HttpRequest ürünü; RequestPresets director|Builder UML: HttpRequestBuilder with chainable methods and build; the immutable HttpRequest product; the RequestPresets director"}
:::

:::animation{scene="builder.scene.json"}
Zincirleme çağrılar builder'ı doldurur; `build()` doğrular ve değişmez `HttpRequest` üretir.
:::

:::code{lang="ts" title="Builder: fluent arayüz, tek noktada doğrulama, değişmez ürün"}
```ts
export class HttpRequest {
  constructor(
    readonly method: 'GET' | 'POST',
    readonly url: string,
    readonly headers: Readonly<Record<string, string>>,
    readonly timeoutMs: number,
    readonly body?: unknown,
  ) { Object.freeze(this); }
}

export class HttpRequestBuilder {
  private _method: 'GET' | 'POST' = 'GET';
  private _url?: string;
  private _headers: Record<string, string> = {};
  private _timeoutMs = 30_000;
  private _body?: unknown;

  method(m: 'GET' | 'POST') { this._method = m; return this; }       // her adım this döner
  url(u: string) { this._url = u; return this; }
  header(k: string, v: string) { this._headers[k] = v; return this; }
  timeout(ms: number) { this._timeoutMs = ms; return this; }
  body(b: unknown) { this._body = b; this._method = 'POST'; return this; }

  build(): HttpRequest {
    if (!this._url) throw new Error('url is required');              // doğrulama tek yerde
    if (this._timeoutMs <= 0) throw new Error('timeout must be > 0');
    if (this._body !== undefined && !this._headers['content-type']) this._headers['content-type'] = 'application/json';
    return new HttpRequest(this._method, this._url, { ...this._headers }, this._timeoutMs, this._body);
  }
}

// "Director": sık kurulumları hazırlayan yardımcı
export const RequestPresets = {
  jsonGet: (url: string) => new HttpRequestBuilder().url(url).header('accept', 'application/json'),
  authed: (url: string, token: string) => RequestPresets.jsonGet(url).header('authorization', `Bearer ${token}`),
};

const req = RequestPresets.authed('/orders', token).timeout(5_000).build();
```
```python
from dataclasses import dataclass, field

@dataclass(frozen=True)                      # değişmez ürün
class HttpRequest:
    method: str
    url: str
    headers: dict
    timeout_ms: int
    body: object = None

class HttpRequestBuilder:
    def __init__(self):
        self._method, self._url, self._headers, self._timeout, self._body = "GET", None, {}, 30000, None
    def url(self, u): self._url = u; return self
    def header(self, k, v): self._headers[k] = v; return self
    def timeout(self, ms): self._timeout = ms; return self
    def body(self, b): self._body = b; self._method = "POST"; return self
    def build(self) -> HttpRequest:
        if not self._url: raise ValueError("url is required")      # tek noktada doğrulama
        if self._body is not None: self._headers.setdefault("content-type", "application/json")
        return HttpRequest(self._method, self._url, dict(self._headers), self._timeout, self._body)

# Not: Python'da keyword argümanlar (HttpRequest(url=..., timeout_ms=...)) çoğu Builder ihtiyacını karşılar.
```
```java
public final class HttpRequest {
    public final String method, url; public final Map<String, String> headers; public final int timeoutMs; public final Object body;
    private HttpRequest(Builder b) {
        method = b.method; url = b.url; headers = Map.copyOf(b.headers); timeoutMs = b.timeoutMs; body = b.body;
    }
    public static Builder builder() { return new Builder(); }

    public static final class Builder {                          // iç sınıf: ürünün private kurucusuna erişir
        private String method = "GET", url; private final Map<String, String> headers = new HashMap<>();
        private int timeoutMs = 30_000; private Object body;
        public Builder url(String u) { url = u; return this; }
        public Builder header(String k, String v) { headers.put(k, v); return this; }
        public Builder timeout(int ms) { timeoutMs = ms; return this; }
        public Builder body(Object b) { body = b; method = "POST"; return this; }
        public HttpRequest build() {
            if (url == null) throw new IllegalStateException("url is required");
            if (body != null) headers.putIfAbsent("content-type", "application/json");
            return new HttpRequest(this);
        }
    }
}
// Kullanım: HttpRequest.builder().url("/orders").header("authorization", "Bearer " + token).timeout(5000).build();
```
:::

**Ne zaman kullan**
- 4+ parametre ve çoğu isteğe bağlı; farklı kombinasyonlar için kurucu patlaması yaşanıyor.
- Ürün değişmez olmalı ama adım adım kurulmalı (HTTP istekleri, SQL sorguları, test verisi, konfigürasyon).
- Kurulum sırasında doğrulama ve varsayılan türetme mantığı var.

**Ne zaman kullanma**
- Dilin adlandırılmış/isteğe bağlı parametreleri varsa (Python kwargs, Kotlin default args, TypeScript options nesnesi) ve doğrulama basitse: `new HttpRequest({ url, timeoutMs })` yeterlidir.
- Nesne 2–3 zorunlu alandan ibaretse Builder yalnızca satır sayısı ekler.

---

## 5. Prototype

**Niyet**: Yeni nesneleri, bir prototip örneği **kopyalayarak** üretmek.

Kurulumu pahalı (I/O, hesaplama, çok sayıda alt nesne) ya da somut sınıfı çalışma zamanında belli olan nesneler için `new` yerine `clone()` çağrılır. Bir **registry**, anahtar ile prototipleri saklar ve istendiğinde klon döner. Kritik ayrıntı **derin kopya**: iç diziler kopyalanmazsa klonlar prototiple aynı veriyi paylaşır ve biri diğerini bozar.

:::diagram{src="uml-prototype.svg" alt="Prototype UML: Prototype arayüzü ve clone, DocumentTemplate uygulaması, PrototypeRegistry ve istemci|Prototype UML: Prototype interface with clone, DocumentTemplate implementation, PrototypeRegistry and the client"}
:::

:::animation{scene="prototype.scene.json"}
Pahalı şablon bir kez kurulur ve kaydedilir; istemci `create("invoice")` ister; registry `clone()` ile derin kopya üretir; kopya değişir, şablon korunur.
:::

:::code{lang="ts" title="Prototype: derin kopya ve registry"}
```ts
export interface Prototype<T> { clone(): T }

interface Style { name: string; font: Font; size: number }     // Font değişmez, paylaşılabilir
interface Block { type: 'heading' | 'table' | 'text'; content: string }

export class DocumentTemplate implements Prototype<DocumentTemplate> {
  constructor(public title: string, private styles: Style[], private blocks: Block[]) {}

  static async loadExpensive(path: string): Promise<DocumentTemplate> {   // ~300 ms: disk + ayrıştırma
    const spec = await readJson(path);
    const styles = await Promise.all(spec.styles.map(resolveStyleWithFonts));
    return new DocumentTemplate(spec.title, styles, spec.blocks);
  }

  clone(): DocumentTemplate {                                            // ~2 ms
    return new DocumentTemplate(
      this.title,
      this.styles.map((s) => ({ ...s })),                                 // derin: stil nesneleri kopyalanır, Font paylaşılır
      this.blocks.map((b) => ({ ...b })),                                 // derin: blok nesneleri kopyalanır
    );
  }

  addBlock(b: Block) { this.blocks.push(b); return this; }
}

export class PrototypeRegistry {
  private readonly items = new Map<string, Prototype<unknown>>();
  register<T>(key: string, proto: Prototype<T>) { this.items.set(key, proto); }
  create<T>(key: string): T {
    const p = this.items.get(key);
    if (!p) throw new Error(`unknown prototype: ${key}`);
    return p.clone() as T;                                               // somut sınıfı bilmeden üret
  }
}

// Açılışta bir kez, sonra her fatura için ucuz klon
registry.register('invoice', await DocumentTemplate.loadExpensive('templates/invoice.json'));
const invoice = registry.create<DocumentTemplate>('invoice');
invoice.title = 'Fatura #1042';
```
```python
import copy

class DocumentTemplate:
    def __init__(self, title, styles, blocks):
        self.title, self.styles, self.blocks = title, styles, blocks

    def clone(self):
        # copy.deepcopy iç listeleri de kopyalar; Font gibi paylaşılacak nesneler için __deepcopy__ ezilebilir
        return copy.deepcopy(self)

class PrototypeRegistry:
    def __init__(self): self._items = {}
    def register(self, key, proto): self._items[key] = proto
    def create(self, key): return self._items[key].clone()

registry = PrototypeRegistry()
registry.register("invoice", DocumentTemplate.load_expensive("templates/invoice.json"))
invoice = registry.create("invoice")
invoice.title = "Fatura #1042"            # şablon etkilenmez
```
```java
public final class DocumentTemplate implements Cloneable {
    private String title; private List<Style> styles; private List<Block> blocks;

    @Override public DocumentTemplate clone() {
        try {
            DocumentTemplate c = (DocumentTemplate) super.clone();         // sığ kopya
            c.styles = styles.stream().map(Style::copy).toList();          // derin: listeler ve elemanları
            c.blocks = blocks.stream().map(Block::copy).toList();
            return c;
        } catch (CloneNotSupportedException e) { throw new AssertionError(e); }
    }
    // Pratikte Object.clone() yerine kopya kurucu (new DocumentTemplate(other)) tercih edilir.
}

public final class PrototypeRegistry {
    private final Map<String, DocumentTemplate> items = new HashMap<>();
    public void register(String key, DocumentTemplate proto) { items.put(key, proto); }
    public DocumentTemplate create(String key) { return items.get(key).clone(); }
}
```
:::

**Ne zaman kullan**
- Kurulum pahalı, kopyalama ucuz: belge/rapor şablonları, oyun varlıkları, önceden ısıtılmış konfigürasyon nesneleri, test fixture'ları.
- Üretilecek somut sınıf çalışma zamanında (anahtarla) belirleniyor ve sınıf hiyerarşisi kurmak istemiyorsunuz.

**Ne zaman kullanma**
- Nesne basit ve kurulumu ucuzsa; `clone()` derin/sığ tartışması gereksiz karmaşıklıktır.
- Nesne grafı döngüsel referanslar içeriyorsa: derin kopya zorlaşır, önce yapıyı sadeleştirin.

---

## Karşılaştırma ve seçim

| Soru | Cevap |
|---|---|
| Nesne tek olmalı, paylaşılmalı mı? | Singleton — ama tercihen DI konteynerinin tek örnek kapsamı |
| Üst sınıf akışı biliyor, ürünü alt sınıf mı seçecek? | Factory Method |
| Birlikte kullanılması gereken ürün ailesi mi var? | Abstract Factory |
| Çok parametre, isteğe bağlı alanlar, değişmez sonuç mu? | Builder |
| Kurulum pahalı, mevcut örnekten kopyalamak mı ucuz? | Prototype |
| Yalnızca `switch(type)` ile seçim mi? | Basit fabrika fonksiyonu; kalıp gerekmez |

:::callout{tone="warning" title="Kalıp enflasyonu"}
Creational kalıpların en yaygın kötüye kullanımı, iki somut sınıf için beş arayüz ve üç fabrika yazmaktır. Kalıp bir **refactoring hedefidir**: önce `new` ile yazın, aynı üretim kararının ikinci kez tekrarlandığını ya da testte somut sınıfın ayak bağı olduğunu gördüğünüzde kalıbı çıkarın. Her kalıbın adı, bir ekip arkadaşınıza "bu neden böyle?" sorusunun cevabını tek kelimeyle vermenizi sağlar; değeri budur.
:::

:::realworld{company="Google"}
Google'ın Java ekosistemindeki **Guice** ve Android'deki **Dagger/Hilt**, Singleton tartışmasının modern cevabıdır: `@Singleton` yalnızca bir **ömür kapsamıdır**; sınıfın kendisi sıradan bir sınıftır ve bağımlılık kurucudan açıkça geçer. Böylece testte sahte nesne takmak önemsizdir. Aynı ekosistemde **Protocol Buffers**'ın ürettiği her mesaj sınıfı değişmezdir ve yalnızca `Message.newBuilder()...build()` ile kurulur — Builder kalıbının günde trilyonlarca kez çalışan uygulaması; `toBuilder()` ise mevcut mesajı kopyalayıp değiştirmek için Prototype fikrini kullanır. Go tarafında Google'ın kendi kod tabanında soyut fabrika yerine **fonksiyonel seçenekler** (`grpc.Dial(addr, grpc.WithTimeout(...))`) tercih edilir: Builder'ın dil özelliğiyle sadeleşmiş hâli. Ders: kalıbın adı değil, çözdüğü problem kalıcıdır; dil değiştikçe biçim değişir.
:::

:::callout{tone="tip" title="Mülakat ipuçları"}
- "Singleton kullanır mısın?" sorusunun iyi cevabı: "Tek örnek ihtiyacını DI kapsamıyla karşılarım; klasik Singleton'ı gizli bağımlılık ve test izolasyonu nedeniyle kaçınırım."
- Factory Method ile Abstract Factory farkını tek cümleyle: **kalıtımla tek ürün** vs. **bileşimle ürün ailesi**.
- Builder'ı savunurken "değişmez ürün + tek noktada doğrulama" deyin; yalnızca "okunabilirlik" zayıf gerekçedir.
- Prototype'ta derin/sığ kopya ayrımını kendiliğinizden anın; görüşmeciler tam bunu bekler.
- Kod yazmanız istenirse önce arayüzü, sonra istemciyi, en son somut sınıfları yazın: bağımlılık yönünü gösterir.
:::

:::quiz{src="quiz.json"}
:::

:::next{lesson="c-02-structural-patterns"}
Sırada yapısal kalıplar: nesneleri daha büyük yapılarda birleştiren Adapter, Decorator, Facade, Proxy, Composite ve Bridge.
:::

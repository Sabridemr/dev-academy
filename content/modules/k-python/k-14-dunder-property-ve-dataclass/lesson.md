---
id: k-14-dunder-property-ve-dataclass
slug: dunder-property-ve-dataclass
module: k-python
order: 14
title:
  tr: "OOP 3: Özel Metotlar, property, dataclass ve Kapsülleme"
  en: "OOP 3: Dunder Methods, property, dataclass and Encapsulation"
summary:
  tr: "Özel metotlar, property, dataclass ve soyut sınıflarla temiz nesneler tasarla."
  en: "Design clean objects with dunder methods, properties, dataclasses and abstract classes."
durationMinutes: 24
level: intermediate
tags: [python, oop, dunder, property, dataclass]
prerequisites: [k-13-kalitim-ve-polimorfizm]
concepts: [dunder-methods, operator-overloading, eq-and-hash, encapsulation, property, dataclass, abstract-base-class]
---

## Python veri modeli: sözdiziminin arkasındaki metotlar

`len(liste)`, `a + b`, `x in kume`, `print(nesne)`, `for oge in kutu`... Bunlar Python'un en sık kullanılan
sözdizimleri. Peki `len()` bir listenin uzunluğunu nereden biliyor? Cevap: **Python veri modeli** (data model).
Python bu sözdizimlerinin her birini, nesnenin sınıfındaki özel bir metoda çevirir:

| Yazdığın | Python'un çağırdığı |
|---|---|
| `len(x)` | `type(x).__len__(x)` |
| `a + b` | `a.__add__(b)` (olmazsa `b.__radd__(a)`) |
| `a == b` | `a.__eq__(b)` |
| `x in kutu` | `kutu.__contains__(x)` |
| `kutu[i]` | `kutu.__getitem__(i)` |
| `for o in kutu` | `iter(kutu)` → `kutu.__iter__()` |
| `str(x)`, `print(x)` | `x.__str__()` |
| `repr(x)` | `x.__repr__()` |
| `f(x)` (nesneyi çağırma) | `f.__call__(x)` |
| `if x:` | `x.__bool__()` (yoksa `__len__`) |

Adlarının başında ve sonunda iki alt çizgi olduğu için bunlara **dunder metotlar** (double underscore) ya da
**özel metotlar** (special methods) denir. Bu metotları kendi sınıfına yazarsan nesnelerin de listeler, sayılar
ve sözlükler gibi "Python'a özgü" davranır. Bu derste önce bu metotları, sonra kapsüllemeyi (encapsulation),
`property`'yi, `dataclass`'ı ve soyut sınıfları göreceksin.

:::callout{tone="info" title="Kural: dunder metotları sen çağırmazsın"}
`v.__add__(w)` yazmak çalışır ama okunmaz. Dunder metotları Python'un çağırması için yazarsın; sen `v + w`,
`len(x)`, `repr(x)` gibi normal sözdizimini kullanırsın. Ayrıca kendi uydurduğun `__benim__` gibi isimlerden
kaçın: bu isim alanı Python'a ayrılmıştır.
:::

## __str__ ve __repr__: iki farklı okuyucu

Bir nesneyi metne çevirmenin iki yolu var ve ikisi farklı kişiler için:

- `__repr__`: **geliştirici** için. Açık ve tek anlamlı olmalı; mümkünse nesneyi yeniden oluşturacak koda benzemeli.
  Etkileşimli kabukta, hata ayıklayıcıda ve **liste içindeki** öğeler yazdırılırken kullanılır.
- `__str__`: **son kullanıcı** için. Okunaklı, "güzel" metin. `print()` ve `str()` bunu kullanır.

`__str__` tanımlı değilse Python `__repr__`'a düşer; tersi geçerli değildir. Bu yüzden ilk yazman gereken
`__repr__`'dır.

:::code{lang="python" title="__repr__ geliştiriciye, __str__ kullanıcıya"}
```python
class Urun:
    def __init__(self, ad, fiyat):
        self.ad = ad
        self.fiyat = fiyat

    def __repr__(self):
        return f"Urun(ad={self.ad!r}, fiyat={self.fiyat!r})"

    def __str__(self):
        return f"{self.ad} - {self.fiyat} TL"


u = Urun("Kalem", 25)
print(u)         # Kalem - 25 TL
print(repr(u))   # Urun(ad='Kalem', fiyat=25)
print([u])       # [Urun(ad='Kalem', fiyat=25)]  → liste öğeleri repr ile yazılır
print(f"{u!r}")  # Urun(ad='Kalem', fiyat=25)
```
:::

## Operatör aşırı yükleme: v1 + v2 aslında bir metot çağrısı

İki boyutlu bir vektör sınıfı yazdığını düşün. `v1 + v2` yazabilmek için sınıfa `__add__` eklemen yeter.
Buna **operatör aşırı yükleme** (operator overloading) denir. Aşağıdaki simülasyonda `+` operatörünün
yığında nasıl bir `__add__` çerçevesine dönüştüğünü ve heap'te **yeni** bir nesne oluştuğunu izle.

:::trace{src="vektor-toplama.trace.json" title="v1 + v2 → v1.__add__(v2)|v1 + v2 → v1.__add__(v2)"}
`v3 = v1 + v2` satırında yığına `Vektor.__add__` çerçevesi eklendiğine, `self`'in v1'i, `diger`'in v2'yi gösterdiğine dikkat et.
:::

Simülasyondan çıkan dersler:

- `v1 + v2` ifadesi `Vektor.__add__(v1, v2)` çağrısıdır; `self` sol işlenen, `diger` sağ işlenendir.
- İyi tasarlanmış bir `__add__` işlenenleri **değiştirmez**, yeni nesne döndürür. Sayılarda da böyledir: `2 + 3`
  ne 2'yi ne 3'ü değiştirir.
- `print(v3)` sırasında `__repr__` çağrıldı, çünkü `__str__` tanımlı değildi.

### Ters metotlar ve NotImplemented

`Vektor(1, 2) * 3` için Python `Vektor.__mul__`'ı çağırır. Peki `3 * Vektor(1, 2)`? Sol işlenen `int`; `int.__mul__`
bir vektörle ne yapacağını bilmez ve özel bir değer olan `NotImplemented` döndürür. Python bunu görünce
**sağ işlenenin ters (reflected) metodunu** dener: `Vektor.__rmul__(v, 3)`. `__radd__` da aynı mantıkla çalışır
ve `sum()` için önemlidir: `sum()` toplamaya `0` ile başlar, yani ilk işlem `0 + v`'dir.

:::code{lang="python" title="__mul__, __rmul__ ve __radd__"}
```python
class Vektor:
    def __init__(self, x, y):
        self.x, self.y = x, y

    def __add__(self, diger):
        if not isinstance(diger, Vektor):
            return NotImplemented   # "bu türü bilmiyorum", Python başka yol dener
        return Vektor(self.x + diger.x, self.y + diger.y)

    def __radd__(self, diger):
        if diger == 0:              # sum() 0 ile başlar: 0 + v
            return self
        return NotImplemented

    def __mul__(self, k):
        return Vektor(self.x * k, self.y * k)

    __rmul__ = __mul__              # 3 * v de aynı sonucu versin

    def __repr__(self):
        return f"Vektor({self.x}, {self.y})"


print(Vektor(1, 2) * 3)                   # Vektor(3, 6)
print(3 * Vektor(1, 2))                   # Vektor(3, 6)  → __rmul__
print(sum([Vektor(1, 1), Vektor(2, 2)]))  # Vektor(3, 3)  → önce 0 + v → __radd__
Vektor(1, 2) + 5   # TypeError: unsupported operand type(s) for +: 'Vektor' and 'int'
```
:::

:::callout{tone="warning" title="NotImplemented döndür, hata fırlatma"}
Tanımadığın bir türle karşılaşınca `__add__` içinden `TypeError` fırlatma ya da `False` döndürme; `NotImplemented`
döndür. Böylece Python karşı tarafın ters metodunu deneyebilir; o da yoksa anlamlı bir `TypeError` üretir.
`NotImplemented` (bir değer) ile `NotImplementedError` (bir hata sınıfı) farklı şeylerdir.
:::

## Eşitlik ve hash: __eq__ ile __hash__ birlikte düşünülür

Varsayılan olarak iki nesne yalnızca **aynı nesneyse** eşittir (`==`, `is` gibi davranır). Değere göre
eşitlik istiyorsan `__eq__` yazarsın. Ama burada önemli bir kural var:

- Bir sınıfta `__eq__` tanımlayıp `__hash__` tanımlamazsan Python o sınıfın `__hash__`'ini **`None`** yapar.
  Nesne artık **hash'lenemez** (unhashable) olur: `set` öğesi ya da `dict` anahtarı olamaz.
- Neden? Kümeler ve sözlükler önce hash'e, sonra eşitliğe bakar. Kural şudur: **`a == b` ise `hash(a) == hash(b)`
  olmalı.** Varsayılan hash kimliğe dayandığı için, değere göre eşitlik tanımlayınca bu kural bozulurdu.
  Python bozuk bir hash yerine hiç hash olmamasını seçer.

:::code{lang="python" title="__eq__ yazınca __hash__ None olur"}
```python
class Nokta:
    def __init__(self, x, y):
        self.x, self.y = x, y

    def __eq__(self, diger):
        if not isinstance(diger, Nokta):
            return NotImplemented
        return (self.x, self.y) == (diger.x, diger.y)


print(Nokta(1, 2) == Nokta(1, 2))  # True
print(Nokta.__hash__)              # None
{Nokta(1, 2)}                      # TypeError: ... unhashable type: 'Nokta'
```
:::

Nesnen **değiştirilemez** gibi kullanılacaksa (alanları oluşturulduktan sonra değişmeyecekse), `__hash__`'i
eşitlikte kullandığın alanlardan üret. Aşağıdaki simülasyonda bir kümeye iki eşit nesne eklendiğinde Python'un
önce `__hash__`, sonra `__eq__` çağırdığını göreceksin.

:::trace{src="esitlik-ve-hash.trace.json" title="Kümede __hash__ ve __eq__|__hash__ and __eq__ in a set"}
`kume = {a, b}` satırında önce iki `__hash__` çağrısı, ardından aynı hash bulunduğu için bir `__eq__` çağrısı yapıldığını izle.
:::

:::callout{tone="danger" title="Değişen alandan hash üretme"}
Hash'i değiştirilebilir alanlardan üretip nesneyi bir kümeye koyduktan sonra alanı değiştirirsen, nesne kümede
"yanlış kovada" kalır: `nesne in kume` False döner ama nesne hâlâ oradadır. Hash'lenebilir nesnelerin hash'e giren
alanları değişmemeli. Aşağıda göreceğin `@dataclass(frozen=True)` bunu garanti etmenin en kolay yoludur.
:::

### Sıralama: __lt__ ve total_ordering

`sorted()` ve `min()`/`max()` nesneleri `<` ile karşılaştırır, yani `__lt__` arar. Altı karşılaştırma
operatörünü (`<`, `<=`, `>`, `>=`, `==`, `!=`) tek tek yazmak yerine `functools.total_ordering` dekoratörünü
kullanabilirsin: `__eq__` ve bir tanesini (örneğin `__lt__`) yazarsın, gerisini o üretir.

:::code{lang="python" title="Sürüm numaralarını doğru sıralamak"}
```python
from functools import total_ordering


@total_ordering
class Surum:
    def __init__(self, metin):
        self.parcalar = tuple(int(p) for p in metin.split("."))

    def __eq__(self, diger):
        return self.parcalar == diger.parcalar

    def __lt__(self, diger):
        return self.parcalar < diger.parcalar

    def __repr__(self):
        return ".".join(map(str, self.parcalar))


print(sorted(["1.10.0", "1.2.3", "1.9"]))                       # ['1.10.0', '1.2.3', '1.9'] (metin sırası, yanlış)
print(sorted([Surum("1.10.0"), Surum("1.2.3"), Surum("1.9")]))  # [1.2.3, 1.9, 1.10.0]
print(Surum("2.0") >= Surum("1.9"))                             # True (>= metodunu total_ordering üretti)
```
:::

## Kapsayıcı gibi davranan nesneler

Kendi koleksiyon sınıfını yazarken `__len__`, `__getitem__`, `__contains__` ve `__iter__` metotlarıyla nesnene
liste gibi davranmayı öğretebilirsin. `__getitem__`'a gelen anahtar bir dilim (`slice`) de olabilir; iç listeye
aynen iletirsen dilimleme de bedavaya çalışır.

:::code{lang="python" title="Liste gibi davranan bir çalma listesi"}
```python
class CalmaListesi:
    def __init__(self, sarkilar):
        self._sarkilar = list(sarkilar)

    def __len__(self):
        return len(self._sarkilar)

    def __getitem__(self, i):
        return self._sarkilar[i]

    def __contains__(self, sarki):
        return sarki in self._sarkilar

    def __iter__(self):
        return iter(self._sarkilar)


liste = CalmaListesi(["Yağmur", "Rüzgar", "Deniz"])
print(len(liste))            # 3
print(liste[0], liste[-1])   # Yağmur Deniz
print(liste[1:])             # ['Rüzgar', 'Deniz']
print("Deniz" in liste)      # True
print(bool(CalmaListesi([])))  # False → __bool__ yoksa __len__() == 0 kullanılır
```
:::

İki dunder daha:

- `__call__`: nesneyi fonksiyon gibi çağrılabilir yapar. `Carpan(2)` diye oluşturduğun bir nesneyi `iki_kat(21)`
  diye çağırabilirsin; içinde durum (`self.k`) saklayan "fonksiyonlar" için kullanışlıdır. `callable(nesne)`
  True döner.
- `__bool__`: `if nesne:` sorusunun cevabı. Tanımlı değilse Python `__len__`'e bakar; o da yoksa nesne her zaman
  doğrudur (truthy).

## Kapsülleme: _x, __x ve isim karıştırma

Java veya C#'taki `private` anahtar kelimesi Python'da yoktur. Python'un yaklaşımı "hepimiz yetişkiniz" der ve
**sözleşmelere** dayanır:

| Yazım | Anlamı | Erişilebilir mi? |
|---|---|---|
| `self.ad` | Genel (public) özellik | Evet |
| `self._ad` | "İç kullanım için, dokunma" sözleşmesi | Evet, ama dokunmaman beklenir |
| `self.__ad` | **İsim karıştırma** (name mangling): `_Sinif__ad` olarak saklanır | Dolaylı olarak evet |

Çift alt çizgi bir güvenlik özelliği değildir. Asıl amacı, **alt sınıfların** aynı isimli bir özelliği yanlışlıkla
ezmesini önlemektir: `Hesap` içindeki `__bakiye` gerçekte `_Hesap__bakiye` adıyla saklanır, alt sınıftaki
`__bakiye` ise `_AltSinif__bakiye` olur.

:::code{lang="python" title="İsim karıştırma (name mangling)"}
```python
class Hesap:
    def __init__(self):
        self._komisyon = 0.01   # sözleşme: iç kullanım
        self.__bakiye = 100     # isim karıştırma

    def bakiye(self):
        return self.__bakiye    # sınıfın içinde normal adla erişilir


h = Hesap()
print(h._komisyon)       # 0.01 → erişilebilir, sadece sözleşme
print(vars(h))           # {'_komisyon': 0.01, '_Hesap__bakiye': 100}
print(h.bakiye())        # 100
print(h._Hesap__bakiye)  # 100 → "gizli" değil, sadece adı değişmiş
h.__bakiye               # AttributeError: 'Hesap' object has no attribute '__bakiye'
```
:::

Günlük kodda çoğunlukla tek alt çizgi (`_x`) yeterlidir. Çift alt çizgiyi kalıtım hiyerarşisinde isim çakışması
gerçekten riskliyse kullan.

## property: özellik gibi görünen metotlar

Bir sınıfa `self.celsius = 22` gibi genel bir özellik koydun ve herkes bunu kullanıyor. Sonra fark ettin ki
mutlak sıfırın (-273.15 °C) altındaki değerler engellenmeli. Java geleneğinde baştan `getCelsius()` ve
`setCelsius()` yazılır. Python'da buna gerek yok: `@property` ile özelliği **sonradan** metoda çevirirsin ve
kullanan kod hiç değişmez (`oda.celsius = 25` yazmaya devam eder).

- `@property` ile süslenen metot **okuma** (getter) işlemidir.
- `@<ad>.setter` ile süslenen metot **yazma** (setter) işlemidir; doğrulama burada yapılır.
- Setter yazmazsan özellik **salt okunur** (read-only) olur.
- Gerçek değer genellikle `_celsius` gibi tek alt çizgili bir özellikte saklanır. Property ile aynı adı
  kullanırsan (`self.celsius = ...` setter içinde) setter kendini sonsuza kadar çağırır.

:::trace{src="property-dogrulama.trace.json" title="property ile doğrulama|Validation with property"}
`self.celsius = celsius` satırında setter çerçevesinin açıldığını, `oda.celsius = -300` satırında ise setter'ın `ValueError` fırlattığını ve `_celsius`'un 25 olarak kaldığını izle.
:::

Simülasyonda gördüğün gibi `__init__` içindeki `self.celsius = celsius` ataması bile setter'dan geçti; böylece
geçersiz bir değerle nesne **oluşturmak** da mümkün değil. `fahrenheit` ise setter'ı olmayan, her okunduğunda
`_celsius`'tan hesaplanan bir değerdir. Ona yazmaya çalışırsan Python izin vermez:

:::code{lang="python" title="Salt okunur property"}
```python
oda = Sicaklik(22)
print(oda.fahrenheit)   # 71.6
oda.fahrenheit = 100    # AttributeError: property 'fahrenheit' of 'Sicaklik' object has no setter
```
:::

Hata mesajının bu biçimi Python 3.11+ içindir; eski sürümlerde `can't set attribute` yazar.

## dataclass: veri taşıyan sınıfları kısaltmak

Çoğu sınıfın işi birkaç alanı bir arada tutmaktır. Her seferinde `__init__`, `__repr__` ve `__eq__` yazmak
sıkıcı ve hataya açıktır. `dataclasses` modülündeki `@dataclass` dekoratörü (Python 3.7+), sınıfın
**tip açıklamalı alanlarına** bakarak bu metotları senin yerine üretir.

:::code{lang="python" title="dataclass: alanlar, varsayılanlar ve __post_init__"}
```python
from dataclasses import dataclass, field


@dataclass
class Sepet:
    sahip: str                                         # zorunlu alan
    indirim: int = 0                                   # varsayılan değer
    urunler: list[str] = field(default_factory=list)   # her nesneye yeni liste

    def __post_init__(self):                           # üretilen __init__'ten sonra çalışır
        if not 0 <= self.indirim <= 100:
            raise ValueError("indirim 0-100 arası olmalı")


a = Sepet("Ayşe")
b = Sepet("Can", indirim=10)
a.urunler.append("kalem")
print(a)                                 # Sepet(sahip='Ayşe', indirim=0, urunler=['kalem'])
print(b)                                 # Sepet(sahip='Can', indirim=10, urunler=[])
print(a == Sepet("Ayşe", 0, ["kalem"]))  # True → üretilen __eq__ alanları karşılaştırır
Sepet("Ece", indirim=150)                # ValueError: indirim 0-100 arası olmalı
```
:::

Dikkat etmen gerekenler:

- Alanlar **tip açıklamasıyla** tanımlanır (`sahip: str`). Açıklaması olmayan sınıf değişkeni alan sayılmaz.
  Tipler çalışma zamanında kontrol edilmez (K-15).
- Varsayılanı olan alanlardan sonra varsayılansız alan gelemez (fonksiyon parametrelerindeki kuralın aynısı).
- `__eq__` üretildiği için, `eq=True` ve `frozen=False` (varsayılanlar) iken `__hash__` yine **`None`** olur.

:::callout{tone="danger" title="Neden field(default_factory=list)?"}
`urunler: list = []` yazsaydın, bu liste sınıf tanımlanırken **bir kez** oluşur ve bütün nesneler aynı listeyi
paylaşırdı: K-06'daki değiştirilebilir varsayılan argüman tuzağının aynısı. `dataclass` bunu bildiği için seni
engeller: `ValueError: mutable default <class 'list'> for field urunler is not allowed: use default_factory`.
`default_factory=list` ise her nesne oluşturulurken `list()`'i yeniden çağırır ve her nesneye **kendi** listesini verir.
:::

### frozen=True ve order=True

- `frozen=True`: alanlar oluşturulduktan sonra değiştirilemez (`FrozenInstanceError`). Eşitlik ve değişmezlik
  birlikte olduğu için dataclass bu durumda alanlardan bir `__hash__` de üretir: nesne kümeye ve sözlük anahtarına
  konabilir.
- `order=True`: `<`, `<=`, `>`, `>=` metotlarını üretir. Karşılaştırma alanları **tanım sırasıyla** bir demet
  (tuple) gibi yapar.

:::code{lang="python" title="Değiştirilemez ve sıralanabilir dataclass"}
```python
from dataclasses import dataclass


@dataclass(frozen=True, order=True)
class Surum:
    ana: int
    kucuk: int
    yama: int = 0


s = Surum(1, 2)
print(sorted([Surum(2, 0), s, Surum(1, 10)]))
# [Surum(ana=1, kucuk=2, yama=0), Surum(ana=1, kucuk=10, yama=0), Surum(ana=2, kucuk=0, yama=0)]
print(len({s, Surum(1, 2)}))   # 1 → hash'lenebilir, eşitler tek sayılır
s.ana = 5                      # dataclasses.FrozenInstanceError: cannot assign to field 'ana'
```
:::

## Soyut sınıflar: abc.ABC ve @abstractmethod

K-13'te polimorfizmi gördün: farklı sınıflar aynı metodu kendi bildiği gibi uygular. Peki bir alt sınıfın o
metodu **mutlaka** yazmasını nasıl garanti edersin? **Soyut temel sınıf** (abstract base class) ile.
`abc.ABC`'den türeyen ve `@abstractmethod` ile işaretli metodu olan bir sınıf **örneklenemez**. Alt sınıf
soyut metotların hepsini yazana kadar o da örneklenemez.

:::code{lang="python" title="Soyut sınıf örneklenemez"}
```python
from abc import ABC, abstractmethod


class Sekil(ABC):
    @abstractmethod
    def alan(self): ...

    def tanit(self):                  # somut metot: alt sınıflar miras alır
        return f"{type(self).__name__}: alan={self.alan()}"


class Kare(Sekil):
    def __init__(self, a):
        self.a = a

    def alan(self):
        return self.a ** 2


print(Kare(3).tanit())   # Kare: alan=9
Sekil()                  # TypeError: Can't instantiate abstract class Sekil without an implementation for abstract method 'alan'
```
:::

Hata, `alan` metodu **çağrıldığında** değil, nesne **oluşturulurken** gelir: eksik bir alt sınıfı erkenden
yakalarsın. (Mesajın bu biçimi Python 3.12+; eski sürümlerde `with abstract method alan` yazar.)

:::callout{tone="tip" title="ABC mi, Protocol mü?"}
`ABC` ile alt sınıflar temel sınıftan **açıkça türemek** zorundadır (nominal tipleme). K-15'te göreceğin
`typing.Protocol` ise "şu metotları olan her nesne olur" der (yapısal tipleme). Ortak kod (`tanit` gibi) paylaşmak
ve örneklemeyi zorla engellemek istiyorsan ABC, sadece bir arayüz tarif etmek istiyorsan Protocol daha hafiftir.
:::

## Gerçek hayattan: hangisini ne zaman?

- **Veri taşıyan nesne** (API cevabı, ayar, para tutarı, koordinat): `@dataclass`. Değişmemesi gerekiyorsa
  `frozen=True`.
- **Kural koruyan özellik** (yaş negatif olamaz, e-posta biçimi): `property` ile doğrulama ya da dataclass'ta
  `__post_init__`.
- **Matematiksel ya da koleksiyon benzeri tür** (vektör, para, matris, özel liste): dunder metotlar.
- **Ortak bir sözleşme ve paylaşılan kod** (ödeme sağlayıcıları, şekiller): soyut sınıf.

Kütüphanelerde bu kalıpları her yerde görürsün: `pathlib.Path` `/` operatörünü `__truediv__` ile yazar
(`Path("a") / "b"`), pandas `df["sutun"]` için `__getitem__` kullanır, Pydantic ve SQLAlchemy modelleri
dataclass'a benzer bir alan tanımlama biçimi kullanır.

## Özet

- Python sözdizimi (`+`, `len`, `in`, `[]`, `for`, `print`) sınıftaki **dunder metotlara** dönüşür; bunları
  yazarak nesnelerine yerleşik türler gibi davranmayı öğretirsin.
- Önce `__repr__` yaz (geliştirici için); `__str__` kullanıcıya yönelik metindir ve yoksa `__repr__` kullanılır.
- Operatör metotları yeni nesne döndürmeli, tanımadıkları türde `NotImplemented` dönmelidir; `__radd__`/`__rmul__`
  ters yönü karşılar.
- `__eq__` tanımlayınca `__hash__` `None` olur; eşit nesneler eşit hash vermeli ve hash'e giren alanlar değişmemeli.
- `_x` bir sözleşme, `__x` isim karıştırmadır; ikisi de gerçek gizlilik sağlamaz. Doğrulama ve salt okunur
  özellikler için `property` kullan.
- `@dataclass` `__init__`/`__repr__`/`__eq__` üretir; değiştirilebilir varsayılan için `field(default_factory=...)`,
  değişmezlik için `frozen=True`, sıralama için `order=True` kullan.
- `abc.ABC` + `@abstractmethod` ile alt sınıflara sözleşme dayatırsın; soyut sınıf örneklenince `TypeError` alırsın.

:::quiz{src="quiz.json"}
:::

:::next{lesson="k-15-moduller-paketler-ve-tip-ipuclari"}
:::

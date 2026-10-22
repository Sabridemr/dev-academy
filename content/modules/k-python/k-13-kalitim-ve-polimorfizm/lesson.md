---
id: k-13-kalitim-ve-polimorfizm
slug: kalitim-ve-polimorfizm
module: k-python
order: 13
title:
  tr: "OOP 2: Kalıtım, Polimorfizm, super() ve MRO"
  en: "OOP 2: Inheritance, Polymorphism, super() and MRO"
summary:
  tr: "Kalıtımla kodu yeniden kullan, polimorfizmi uygula; super() ve metot arama sırasını kavra."
  en: "Reuse code with inheritance, apply polymorphism and understand super() and method lookup."
durationMinutes: 22
level: intermediate
tags: [python, oop, kalitim, polimorfizm, mro]
prerequisites: [k-12-siniflar-ve-nesneler]
concepts: [inheritance, method-override, super, polymorphism, duck-typing, mro, mixin, composition]
---

## Kalıtım neden var?

K-12'de bir sınıfın veriyi ve davranışı nasıl bir araya getirdiğini gördün. Şimdi şu durumu düşün: bir şirkette
çalışanlar, yöneticiler ve stajyerler var. Hepsinin adı ve maaşı var, hepsi için yıllık maliyet hesaplanıyor.
Ama yöneticinin bir ekibi ve primi var, stajyerin bir okulu var. Üç ayrı sınıf yazıp ortak kodu üçüne de
kopyalarsan, bir hatayı düzeltirken üç yeri birden değiştirmen gerekir.

**Kalıtım (inheritance)**, yeni bir sınıfı var olan bir sınıfın **üzerine kurmanı** sağlar. Yeni sınıfa **alt
sınıf (subclass, child)**, üzerine kurulduğu sınıfa **üst sınıf (superclass, parent, base class)** denir. Alt
sınıf, üst sınıfın tüm niteliklerini ve metotlarını **devralır**; istediklerini değiştirebilir, yenilerini
ekleyebilir.

Kalıtım bir **"is-a" (bir ...dır)** ilişkisi kurar: "Yönetici **bir** çalışandır", "Köpek **bir** hayvandır".
Bu cümle doğal gelmiyorsa kalıtım muhtemelen yanlış araçtır (dersin sonunda kompozisyona bakacağız).

## Sözdizimi ve metot ezme

Alt sınıf tanımlarken üst sınıfı parantez içinde yazarsın: `class Kopek(Hayvan):`. Alt sınıfta üst sınıftakiyle
**aynı isimde** bir metot tanımlarsan, alt sınıfın nesneleri için o metot kullanılır. Buna **metot ezme
(method override)** denir.

:::code{lang="python" title="Devralma ve ezme"}
```python
class Hayvan:
    def __init__(self, ad):
        self.ad = ad

    def tanit(self):
        return f"Ben {self.ad}, {self.ses()} diyorum"

    def ses(self):
        return "..."


class Kopek(Hayvan):
    def ses(self):               # Hayvan.ses'i ezer
        return "Hav"


class Kedi(Hayvan):
    def ses(self):
        return "Miyav"


print(Kopek("Karabaş").tanit())      # Ben Karabaş, Hav diyorum
print(Kedi("Tekir").tanit())         # Ben Tekir, Miyav diyorum
print(Hayvan("Bilinmeyen").tanit())  # Ben Bilinmeyen, ... diyorum
```
:::

Bu küçük örnekte çok şey oluyor. `Kopek` hiç `__init__` ya da `tanit` yazmadı, ikisini de `Hayvan`'dan devraldı.
`tanit` metodu `Hayvan` sınıfında yazılmış olsa da içindeki `self.ses()` çağrısı **nesnenin gerçek sınıfında**
aranır: `self` bir `Kopek` olduğu için `Kopek.ses` çalışır. Üst sınıf, alt sınıfların dolduracağı bir boşluk
bırakmış gibidir.

### Nitelik arama zinciri

K-12'de bir nitelik okunurken önce nesneye, sonra sınıfa bakıldığını gördün. Kalıtımla birlikte zincir uzar:

1. Nesnenin kendi `__dict__`'i
2. Nesnenin sınıfı (`Kopek`)
3. Üst sınıflar, sırayla (`Hayvan`)
4. En sonda her sınıfın atası olan `object`

İlk bulunan kazanır. Bulunamazsa `AttributeError` fırlar. Python 3'te her sınıf, yazmasan da `object`'ten türer:
`issubclass(Kopek, object)` her zaman `True`'dur. Bu zincirin tam sırasına **metot arama sırası (method resolution
order, MRO)** denir; birazdan ayrıntısına gireceğiz.

:::diagram{src="kalitim-hiyerarsisi.svg" alt="object, Hayvan ve ondan türeyen Kopek ile Kedi sınıfları; sağda Kopek tanit çağrısının nesne, Kopek ve Hayvan sırasıyla aranması ve self.ses çağrısının yeniden Kopek sınıfında bulunması.|object, Hayvan and its subclasses Kopek and Kedi; on the right the Kopek tanit call being looked up on the object, Kopek and Hayvan in turn and the self.ses call being found again on Kopek."}
`tanit` üst sınıfta bulunur, ama içindeki `self.ses()` aramaya yine nesnenin gerçek sınıfından başlar.
:::

## super() ve super().__init__

Alt sınıf bir metodu ezdiğinde üst sınıfın sürümü kaybolmaz; `super()` ile ona ulaşabilirsin. En sık kullanım
yeri `__init__`'tir: alt sınıf kendi `__init__`'ini yazdığında üst sınıfınki **otomatik çalışmaz**. Ortak
alanların kurulması için onu `super().__init__(...)` ile açıkça çağırman gerekir.

:::trace{src="super-init.trace.json" title="super().__init__: iki çerçeve, tek self|super().__init__: two frames, one self"}
`super().__init__` çağrısında yığında Yonetici.__init__ ve Calisan.__init__ çerçevelerinin üst üste durduğuna ve iki çerçevedeki `self`'in aynı nesneyi gösterdiğine dikkat et. Sonra `yillik` çağrısında ezilen metodun üst sürümü nasıl genişlettiğini izle.
:::

Simülasyondan çıkarılacaklar:

- Yalnızca **bir** nesne oluştu: bir `Yonetici` örneği. `Calisan.__init__` yeni bir nesne oluşturmadı; aynı
  `self` üzerinde `ad` ve `maas` alanlarını kurdu. "Üst sınıf nesnesi" diye ayrı bir şey yoktur.
- Alt sınıf önce üst sınıfın kurulumunu yaptırdı, sonra kendine özgü alanı (`ekip`) ekledi. Bu sıra bir gelenektir
  ve çoğu durumda doğrudur.
- `super().yillik()` metodu tamamen yeniden yazmak yerine **genişletti**: üst sınıfın hesabı + prim.

:::callout{tone="warning" title="super().__init__'i unutmak"}
Alt sınıfta `__init__` yazıp `super().__init__(...)` çağırmayı unutursan üst sınıfın kurduğu alanlar hiç oluşmaz.
Hata o anda değil, alan ilk kullanıldığında çıkar ve kaynağını bulmak zorlaşır. Alt sınıfta `__init__`
yazdıysan ilk iş olarak `super().__init__(...)`'i çağırmayı alışkanlık hâline getir.
:::

:::code{lang="python" title="Unutulan super().__init__"}
```python
class Stajyer(Calisan):
    def __init__(self, ad, okul):
        self.okul = okul          # super().__init__ unutuldu!


s = Stajyer("Linus", "ODTÜ")
print(s.ad)   # AttributeError: 'Stajyer' object has no attribute 'ad'
```
:::

`super()`'i parametresiz yazmak Python 3'e özgü kısa yoldur. Eski kodlarda `super(Yonetici, self).__init__(...)`
ya da doğrudan `Calisan.__init__(self, ...)` görebilirsin. İkincisi çalışır ama birazdan göreceğin çoklu kalıtımda
zinciri kırar; `super()` kullan.

## Polimorfizm: aynı çağrı, farklı davranış

**Polimorfizm (polymorphism, "çok biçimlilik")**, farklı türden nesnelerin **aynı arayüzle** kullanılabilmesidir.
Kod, elindeki nesnenin tam olarak ne olduğunu bilmeden `s.alan()` der; hangi metodun çalışacağına nesnenin sınıfı
karar verir. Böylece yeni bir şekil eklediğinde onu kullanan kodu değiştirmen gerekmez.

:::trace{src="polimorfizm.trace.json" title="Polimorfizm: aynı satır, farklı metot|Polymorphism: same line, different method"}
Döngüdeki `s.alan()` satırından her seferinde hangi sınıfın `alan` metoduna gidildiğini izle: yığına eklenen çerçevenin adı (Kare.alan ya da Daire.alan) bunu gösterir.
:::

Simülasyondaki döngüde `if isinstance(s, Kare): ... elif isinstance(s, Daire): ...` gibi bir zincir yok. Bu
önemli: tür kontrolü zincirleri her yeni tür eklendiğinde büyür ve unutulan bir dal hata kaynağı olur. Polimorfizmde
yeni bir `Ucgen` sınıfı yazıp `alan` metodunu tanımlaman yeterli; döngü olduğu gibi çalışır.

`Sekil.alan` içindeki `raise NotImplementedError`, "alt sınıflar bunu doldurmalı" demenin basit bir yoludur.
Eksik metodu daha nesne oluşturulurken yakalayan **soyut sınıfları** (`abc.ABC`, `@abstractmethod`) K-14'te göreceksin.

### Duck typing

Python polimorfizm için kalıtımı **şart koşmaz**. Bir nesnenin hangi sınıftan geldiğine değil, **istenen metoda
sahip olup olmadığına** bakılır: "Ördek gibi yürüyor ve ördek gibi vaklıyorsa, o bir ördektir." Buna **duck typing**
denir.

:::code{lang="python" title="Ortak üst sınıf olmadan polimorfizm"}
```python
class Ordek:
    def ses_cikar(self):
        return "Vak vak"


class RobotOrdek:                 # Ordek'ten türemiyor!
    def ses_cikar(self):
        return "Bip vak"


def koro(uyeler):
    for u in uyeler:
        print(u.ses_cikar())


koro([Ordek(), RobotOrdek()])     # Vak vak / Bip vak
koro([42])  # AttributeError: 'int' object has no attribute 'ses_cikar'
```
:::

Python'un kendisi de böyle çalışır: `len()` bir `str`, `list` ya da `dict` almasının ortak bir üst sınıftan değil,
hepsinin `__len__` metodu olmasından gelir. `for` döngüsü de nesnenin `list` olup olmadığını sormaz, `__iter__`
olup olmadığına bakar (K-11). Duck typing esnektir, ama hata yalnızca çalışma anında, metot çağrıldığında ortaya
çıkar. Büyük projelerde arayüzü belgelemek için `typing.Protocol` kullanılır (K-15).

## isinstance ve issubclass

- `isinstance(nesne, Sinif)`: nesne bu sınıfın ya da **alt sınıflarından birinin** örneği mi?
- `issubclass(AltSinif, Sinif)`: bir sınıf diğerinden türemiş mi? (Sınıf kendisinin de alt sınıfı sayılır.)

:::code{lang="python" title="Tür sorguları"}
```python
k = Kopek("Karabaş")
print(isinstance(k, Kopek), isinstance(k, Hayvan), isinstance(k, Kedi))  # True True False
print(isinstance(k, (Kedi, Kopek)))     # True → demetteki herhangi biri
print(issubclass(Kopek, Hayvan))        # True
print(issubclass(Hayvan, Kopek))        # False
print(issubclass(bool, int))            # True → bool aslında int'in alt sınıfı
print(Kopek.__bases__)                  # (<class '__main__.Hayvan'>,)
```
:::

`type(k) == Hayvan` yerine `isinstance(k, Hayvan)` kullan: `type` karşılaştırması alt sınıfları dışarıda bırakır.
Ama `isinstance` zincirlerini polimorfizmin yerine kullanma; çoğu zaman doğru çözüm metodu sınıfa taşımaktır.

## Çoklu kalıtım, elmas problemi ve MRO

Python bir sınıfın **birden fazla** üst sınıfı olmasına izin verir: `class D(B, C):`. Peki `B` ve `C` aynı
metodu tanımlıyorsa hangisi çalışır? Daha zor bir durum: `B` ve `C` ikisi de `A`'dan türüyorsa? Bu şekle, çizildiğinde
eşkenar dörtgene benzediği için **elmas problemi (diamond problem)** denir:

:::code{lang="python" title="Elmas şekli"}
```python
#       A
#      / \
#     B   C
#      \ /
#       D
class D(B, C): ...
```
:::

Python bu soruyu her sınıf için tek ve doğrusal bir arama listesi hesaplayarak çözer: **MRO**. Bu listeyi
`Sinif.__mro__` ya da `Sinif.mro()` ile görebilirsin. Liste **C3 doğrusallaştırma (C3 linearization)** algoritmasıyla
hesaplanır ve iki temel kurala uyar:

1. Bir alt sınıf her zaman üst sınıflarından **önce** gelir (`D`, `B` ve `C`'den önce; `B` ve `C`, `A`'dan önce).
2. Üst sınıfların `class D(B, C)` satırında **yazıldığı sıra** korunur (`B`, `C`'den önce).

:::code{lang="python" title="Elmas ve gerçek MRO çıktısı"}
```python
class A:
    def kim(self):
        return "A"

class B(A):
    def kim(self):
        return "B"

class C(A):
    def kim(self):
        return "C"

class D(B, C):
    pass

print(D().kim())     # B
print(D.__mro__)
# (<class '__main__.D'>, <class '__main__.B'>, <class '__main__.C'>,
#  <class '__main__.A'>, <class 'object'>)

class E(C, B):
    pass

print([k.__name__ for k in E.mro()])   # ['E', 'C', 'B', 'A', 'object']
```
:::

`A`, `B`'nin hemen arkasından değil, `C`'den sonra geliyor: `A` ortak atadır ve kural 1 gereği tüm alt sınıflarından
sonra gelmek zorundadır. Bu sayede `A` listede **bir kez** yer alır. Kurallar çelişirse Python sınıfı oluşturmayı
reddeder: `class X(A, B):` (üst sınıfı alt sınıfından önce yazmak) `TypeError: Cannot create a consistent method
resolution order (MRO) for bases A, B` hatası verir (mesajın satır bölünmesi sürüme göre değişebilir).

MRO listesinin aramayı nasıl yönlendirdiğini adım adım izle. Animasyonun son üç adımı, aşağıdaki simülasyonda
göreceğin `super()` zincirinin özetidir.

:::animation{scene="mro-arama.scene.json"}
`d.selam()` aramasının `B`'den sonra `A`'ya değil `C`'ye geçtiğine ve `super()` zincirinde `A`'nın yalnızca bir kez
çalıştığına dikkat et.
:::

### super() aslında "MRO'da sıradaki" demektir

`super()` "benim üst sınıfım" demek değildir; **"bu nesnenin MRO'sunda benden sonra gelen sınıf"** demektir.
Tek kalıtımda ikisi aynı şeydir, ama elmasta fark ortaya çıkar:

:::trace{src="elmas-super.trace.json" title="Elmas: super() zinciri MRO'yu izler|Diamond: the super() chain follows the MRO"}
`B.selam` içindeki `super().selam()` çağrısının A'ya değil C'ye gittiğini izle. Yığında D, B, C, A çerçeveleri üst üste biner ve her birinde `self` aynı D nesnesidir.
:::

`B` sınıfının kodu `C`'den habersiz yazılmıştı, ama `D` nesnesi üzerinde çalışırken `B`'deki `super()` `C`'yi
çağırdı. Bu, **işbirlikçi çoklu kalıtım (cooperative multiple inheritance)** dediğimiz şeyi mümkün kılar: her
sınıf `super()` ile zinciri devam ettirir ve `A.selam` tam **bir kez** çalışır. Sınıflardan biri `super()` yerine
`A.selam(self)` yazsaydı zincir kopar ya da `A` iki kez çalışırdı.

## Mixin'ler

Çoklu kalıtımın en yaygın ve en güvenli kullanımı **mixin**'lerdir. Mixin, tek başına anlamı olmayan, **tek bir
yeteneği** başka sınıflara "karıştırmak" için yazılmış küçük bir sınıftır. Genelde kendi `__init__`'i ve durumu
yoktur; adı çoğunlukla `...Mixin` ile biter.

:::code{lang="python" title="Yetenek ekleyen küçük sınıflar"}
```python
import json


class JsonMixin:
    def to_json(self):
        return json.dumps(self.__dict__, ensure_ascii=False)


class LogMixin:
    def log(self, mesaj):
        print(f"[{type(self).__name__}] {mesaj}")


class Urun(JsonMixin, LogMixin):
    def __init__(self, ad, fiyat):
        self.ad = ad
        self.fiyat = fiyat


u = Urun("Çay", 45.5)
print(u.to_json())      # {"ad": "Çay", "fiyat": 45.5}
u.log("stoğa eklendi")  # [Urun] stoğa eklendi
```
:::

Django gibi çatılarda (`LoginRequiredMixin`) ve standart kütüphanede (`socketserver.ThreadingMixIn`) bu kalıbı
sıkça görürsün. Mixin'ler bir "is-a" ilişkisi değil, bir "can-do" (yapabilir) ilişkisi anlatır.

## Kalıtım yerine kompozisyon

Kalıtım güçlüdür ama sıkı bir bağ kurar: alt sınıf, üst sınıfın iç yapısına bağımlı hâle gelir ve üst sınıftaki bir
değişiklik tüm alt sınıfları etkileyebilir. Çoğu durumda daha esnek seçenek **kompozisyondur (composition)**: bir
nesnenin, işinin bir kısmını **sahip olduğu** başka bir nesneye devretmesi. Bu bir **"has-a" (...sı var)**
ilişkisidir.

:::code{lang="python" title="Araba bir Motor değildir, bir motoru vardır"}
```python
class Motor:
    def __init__(self, beygir):
        self.beygir = beygir
        self.calisiyor = False

    def calistir(self):
        self.calisiyor = True


class Araba:
    def __init__(self, marka, motor):
        self.marka = marka
        self.motor = motor          # bileşen: dışarıdan veriliyor

    def yola_cik(self):
        self.motor.calistir()       # işi parçasına devrediyor (delegation)
        return f"{self.marka} {self.motor.beygir} beygirle yola çıktı"


araba = Araba("Anadol", Motor(68))
print(araba.yola_cik())          # Anadol 68 beygirle yola çıktı
print(araba.motor.calisiyor)     # True
```
:::

`Araba(Motor)` yazmak yanlış olurdu: araba bir motor değildir ve motorun tüm metotlarını (belki `yag_degistir`)
arabanın arayüzüne taşımak anlamsızdır. Kompozisyonla motoru bir elektrik motoruyla değiştirmek de kolaydır;
yalnızca `Araba`'ya farklı bir nesne verirsin. Bu fikir K-16'daki **dependency injection**'ın temelidir.

| Soru | Kalıtım ("is-a") | Kompozisyon ("has-a") |
|---|---|---|
| Cümle doğal mı? | "Yönetici bir çalışandır" | "Arabanın bir motoru vardır" |
| Bağ | Sıkı: alt sınıf üstün iç yapısını bilir | Gevşek: yalnızca bileşenin arayüzü kullanılır |
| Çalışma anında değiştirme | Zor (sınıf sabittir) | Kolay (başka bileşen ver) |
| İyi olduğu yer | Gerçek tür hiyerarşileri, çerçeve kancaları, istisna sınıfları | Davranışı birleştirmek, test edilebilirlik |

:::callout{tone="tip" title="Pratik kural"}
"Kalıtım yerine kompozisyonu tercih et" (favor composition over inheritance) yaygın bir tasarım tavsiyesidir.
Kalıtım hiyerarşini sığ tut (çoğu zaman 1–2 seviye yeter). Bir sınıfı yalnızca birkaç metodunu yeniden kullanmak
için miras alıyorsan dur ve kompozisyonu düşün.
:::

## Liskov'a kısa giriş

Kalıtımın doğru kullanılıp kullanılmadığını anlamanın bir yolu **Liskov yerine geçme ilkesidir (Liskov Substitution
Principle, LSP)**: üst sınıf beklenen her yerde alt sınıfın bir nesnesi **sorunsuzca** kullanılabilmelidir. Alt
sınıf üst sınıfın verdiği sözleri bozmamalıdır.

:::code{lang="python" title="Matematikte doğru, kodda yanlış: Kare bir Dikdörtgen mi?"}
```python
class Dikdortgen:
    def __init__(self, en, boy):
        self.en = en
        self.boy = boy

    def en_ayarla(self, en):
        self.en = en

    def alan(self):
        return self.en * self.boy


class Kare(Dikdortgen):
    def __init__(self, kenar):
        super().__init__(kenar, kenar)

    def en_ayarla(self, en):        # kare kalmak için boyu da değiştiriyor
        self.en = en
        self.boy = en


def genislet(d):
    d.en_ayarla(10)
    return d.alan()                 # çağıran, boyun değişmediğini varsayıyor


print(genislet(Dikdortgen(2, 5)))   # 50
print(genislet(Kare(5)))            # 100 → beklenen 50 değil!
```
:::

"Kare bir dikdörtgendir" matematikte doğrudur, ama `Dikdortgen`'in "eni değiştirmek boyu etkilemez" sözünü `Kare`
bozuyor. "is-a" testi gerekli ama yeterli değil: **davranış** da uyumlu olmalı. Bu ilkeyi ve diğer SOLID ilkelerini
K-16'da ayrıntılı göreceksin.

:::realworld{company="scikit-learn"}
Python'un en yaygın makine öğrenmesi kütüphanesi **scikit-learn**, bu dersteki üç fikri birlikte kullanır ve
geliştirici belgelerinde açıkça anlatır.

**Polimorfizm:** Yüzlerce farklı model (doğrusal regresyon, karar ağacı, rastgele orman...) aynı arayüzü sunar:
`fit(X, y)`, `predict(X)`, `score(X, y)`. `Pipeline` ya da `GridSearchCV` gibi araçlar ellerindeki modelin hangi
sınıftan olduğunu bilmez; yalnızca bu metotları çağırır. Yeni bir model yazan kişi bu metotları sağladığı sürece
mevcut araçların hepsiyle çalışır.

**Kalıtım ve mixin'ler:** Modeller `BaseEstimator`'dan türer; bu sınıf `get_params`/`set_params` gibi ortak
davranışı verir. Sınıflandırıcı olmak `ClassifierMixin`, dönüştürücü olmak `TransformerMixin` gibi küçük mixin
sınıflarıyla eklenir (örneğin `TransformerMixin`, `fit` ve `transform`'u birleştiren `fit_transform`'u sağlar).

**MRO:** Kütüphanenin "kendi estimator'ını geliştir" rehberi, mixin'lerin kalıtım listesinde `BaseEstimator`'ın
**soluna** yazılmasını ister: `class Modelim(ClassifierMixin, BaseEstimator)`. Sebep bu derste gördüğün kuraldır:
MRO soldan sağa ilerler, mixin'in sağladığı ya da ezdiği metotların temel sınıftakilerden önce bulunması gerekir.

Ders: büyük bir kütüphanede kalıtım derin bir ağaç değil, küçük ve birleştirilebilir yetenek sınıflarıdır; doğru
sırayı belirleyen de MRO'dur.
:::

## Özet

- Kalıtım (`class Alt(Ust):`) bir "is-a" ilişkisi kurar; alt sınıf üst sınıfın nitelik ve metotlarını devralır,
  aynı isimle tanımladıklarını ezer (override).
- Alt sınıf `__init__` yazarsa üst sınıfınki otomatik çalışmaz: `super().__init__(...)` çağır. İki çerçeve çalışır ama
  `self` tek bir nesnedir.
- Polimorfizm: aynı `nesne.metot()` çağrısı, nesnenin sınıfına göre farklı metoda gider. Duck typing'de ortak üst
  sınıf bile gerekmez.
- `isinstance`/`issubclass` alt sınıfları da hesaba katar; tür zincirleri yerine polimorfizmi tercih et.
- Metot arama sırası (MRO) C3 ile hesaplanır; `Sinif.__mro__` ile görülür. `super()` "MRO'da sıradaki sınıf" demektir.
- Mixin'ler tek bir yetenek ekler; "has-a" ilişkilerinde kalıtım yerine kompozisyon kullan.
- Alt sınıf, üst sınıfın yerine sorunsuzca geçebilmelidir (Liskov).

:::quiz{src="quiz.json"}
:::

:::next{lesson="k-14-dunder-property-ve-dataclass"}
:::

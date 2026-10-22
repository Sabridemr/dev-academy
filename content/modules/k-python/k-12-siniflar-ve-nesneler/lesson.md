---
id: k-12-siniflar-ve-nesneler
slug: siniflar-ve-nesneler
module: k-python
order: 12
title:
  tr: "OOP 1: Sınıflar, Nesneler ve self"
  en: "OOP 1: Classes, Objects and self"
summary:
  tr: "Sınıf ile nesne farkını, __init__ ve self'i, örnek ve sınıf niteliklerini bellekte izle."
  en: "Track classes vs objects, __init__ and self, instance and class attributes in memory."
durationMinutes: 21
level: intermediate
tags: [python, oop, siniflar, nesneler, self]
prerequisites: [k-11-iterator-ve-generator]
concepts: [class, instance, self, init-method, instance-attribute, class-attribute, bound-method, classmethod-staticmethod]
---

## Neden nesne yönelimli programlama?

Şimdiye kadar veriyi (listeler, sözlükler) ve o veri üzerinde çalışan fonksiyonları ayrı ayrı tuttun. Küçük
programlarda bu gayet iyi çalışır. Ama bir banka uygulaması düşün: her hesabın sahibi ve bakiyesi var, para
yatırma ve çekme işlemleri var.

:::code{lang="python" title="Sınıfsız: veri ve davranış ayrı"}
```python
def hesap_olustur(sahip, bakiye):
    return {"sahip": sahip, "bakiye": bakiye}


def para_yatir(hesap, tutar):
    hesap["bakiye"] += tutar


ada = hesap_olustur("Ada", 100)
para_yatir(ada, 25)
ada["bakiye"] = -999       # Hiçbir şey bunu engellemiyor
print(ada)                 # {'sahip': 'Ada', 'bakiye': -999}
```
:::

Bu yaklaşımın sorunları program büyüdükçe belirginleşir: sözlüğün hangi anahtarlarla oluşturulacağı bir
kurala bağlı değildir, hangi fonksiyonların "hesap" sözlüğüyle çalıştığı dağınık durur ve veriyi kuralları
çiğneyerek değiştirmek çok kolaydır.

**Nesne yönelimli programlama (object-oriented programming, OOP)** veriyi ve onu işleyen davranışı **tek bir
birimde** toplar. Bu birime **nesne (object)** denir. Nesnenin verisine **nitelik (attribute)**, davranışına
**metot (method)** denir. Nesnelerin nasıl oluşacağını tarif eden şablona da **sınıf (class)** denir.

| Kavram | Benzetme | Python'da |
|---|---|---|
| Sınıf (class) | Ev planı, kurabiye kalıbı | `class Hesap:` ile tanımlanan nesne |
| Nesne / örnek (instance) | Plana göre yapılmış her ev | `Hesap("Ada", 100)` ile oluşan nesne |
| Nitelik (attribute) | Evin rengi, oda sayısı | `ada.bakiye` |
| Metot (method) | Evde yapılabilecek işler | `ada.yatir(25)` |

Aslında sınıfları kullanmaya çoktan başladın: `list`, `dict`, `str` birer sınıftır. `[1, 2]` bir `list`
örneğidir, `append` de onun metodudur. Bu derste kendi türlerini oluşturmayı öğreneceksin.

## İlk sınıf: class, __init__ ve self

:::code{lang="python" title="Hesap sınıfı"}
```python
class Hesap:
    def __init__(self, sahip, bakiye):
        self.sahip = sahip
        self.bakiye = bakiye

    def yatir(self, tutar):
        self.bakiye += tutar
        return self.bakiye


ada = Hesap("Ada", 100)
print(type(ada))                # <class '__main__.Hesap'>
print(isinstance(ada, Hesap))   # True
print(ada.yatir(25))            # 125
```
:::

Satır satır:

- `class Hesap:` bir sınıf tanımlar. Sınıf isimleri **PascalCase** yazılır (`AlisverisSepeti`), fonksiyon ve
  değişkenler ise `snake_case`.
- `__init__` (iki alt çizgiyle "dunder init") **başlatıcı** (initializer) metottur. Nesne oluşturulduktan hemen
  sonra Python onu otomatik çağırır; görevi yeni nesnenin ilk niteliklerini kurmaktır.
- `self`, **üzerinde çalışılan nesnedir**. Her örnek metodunun ilk parametresi odur. `self` bir anahtar kelime
  değil, bir gelenektir; ama başka isim kullanma.
- `self.sahip = sahip` sağdaki yerel parametrenin değerini **nesnenin üzerinde** `sahip` adlı bir niteliğe bağlar.

`Hesap("Ada", 100)` yazdığında arka planda iki adım olur: önce `Hesap.__new__` boş bir nesne oluşturur, sonra
`Hesap.__init__(o_nesne, "Ada", 100)` çağrılır. `__init__` bir şey döndürmez (`None`); ifadenin değeri, oluşturulan
nesnedir. Teknik olarak `__init__` bir "kurucu" (constructor) değil başlatıcıdır, ama günlük dilde ikisi de
kullanılır.

Şimdi bunu bellekte izle. Heap'te `Hesap` **sınıf nesnesi** (metotları tutar) ve her `Hesap(...)` çağrısının
oluşturduğu **örnek nesneleri** ayrı kutular olarak görünecek.

:::trace{src="hesap-olusturma.trace.json" title="Hesap('Ada', 100): nesne nasıl doğar?|Hesap('Ada', 100): how an object is born"}
`__init__` çağrısında `self`'in yeni, boş örneği gösterdiğine ve `self.sahip = ...` satırından sonra alanın yerel çerçevede değil örneğin kutusunda belirdiğine dikkat et. `yatir` çağrılarında `self`'in hangi nesneye bağlandığını izle.
:::

Bu simülasyondan çıkarılacaklar:

- **Sınıf da bir nesnedir.** `class` satırı heap'te bir sınıf nesnesi oluşturur ve `Hesap` ismini ona bağlar.
  Metotlar (`__init__`, `yatir`) bu sınıf nesnesinin üzerinde durur, örneklerde değil.
- Her `Hesap(...)` çağrısı **ayrı** bir örnek oluşturur. `ada` ve `linus` bağımsızdır: birinin bakiyesi diğerini
  etkilemez.
- `__init__` çerçevesi kapanınca `self` ismi yok olur, ama nesne yaşamaya devam eder, çünkü artık `ada` onu
  gösterir. Nitelikler çerçevede değil, nesnede durur.

:::callout{tone="warning" title="self'i unutma"}
`__init__` içinde `self.bakiye = bakiye` yerine `bakiye = bakiye` yazarsan, yalnızca yerel bir değişken atanır ve
çerçeve kapanınca kaybolur. Nesnede `bakiye` niteliği hiç oluşmaz; sonra `ada.bakiye` dediğinde
`AttributeError: 'Hesap' object has no attribute 'bakiye'` alırsın. Aynı şekilde metot tanımında `self`
parametresini unutursan çağrıda `TypeError: ... takes 0 positional arguments but 1 was given` hatası çıkar:
Python nesneyi otomatik olarak ilk argüman olarak verir ama metot onu kabul etmez.
:::

Simülasyondaki adımları bileşen bileşen bir daha izleyelim: sınıf çağrısı önce `__new__`'e, sonra `__init__`'e
gider; ardından nitelik aramasının örnekten sınıfa nasıl ilerlediğini görürsün. Bu son adım, bir sonraki bölümün
konusu olan bound method'un nereden geldiğini de açıklıyor.

:::animation{scene="nesnenin-dogusu.scene.json"}
`__new__`'in ürettiği boş `__dict__`'in `__init__` atamalarıyla nasıl dolduğuna ve `ada.yatir` aramasının örnekte
"MISS" alıp sınıfta bulunduğuna dikkat et.
:::

## Metotlar ve bound method

Simülasyonda `ada.yatir(25)` ile `Hesap.yatir(linus, 10)` aynı şekilde çalıştı. Bunun nedeni şudur: metot,
sınıfın üzerinde duran sıradan bir fonksiyondur. `ada.yatir` yazdığında Python, fonksiyonu sınıfta bulur ve onu
`ada` nesnesine **bağlanmış** yeni bir nesneye sarar: buna **bound method** denir. Bound method çağrıldığında
bağlı olduğu nesneyi ilk argüman (`self`) olarak kendisi ekler.

:::code{lang="python" title="nesne.metot() ile Sinif.metot(nesne) aynı şeydir"}
```python
ada = Hesap("Ada", 100)

print(Hesap.yatir)               # <function Hesap.yatir at 0x...>
print(ada.yatir)                 # <bound method Hesap.yatir of <__main__.Hesap object at 0x...>>
print(ada.yatir.__self__ is ada) # True: bağlı olduğu nesne

islem = ada.yatir                # bound method bir değişkende saklanabilir
print(islem(5))                  # 105  → self olarak hâlâ ada verilir
print(Hesap.yatir(ada, 5))       # 110  → uzun yazım
```
:::

Bu sayede bound method'ları başka fonksiyonlara geri çağırma (callback) olarak verebilirsin; nesneyi
"hatırlarlar".

Şimdiye kadar gördüklerini tek resimde topla: metotlar ve sınıf nitelikleri sınıf nesnesinde, örneğe ait veriler
her örneğin kendi `__dict__`'inde durur.

:::diagram{src="sinif-ve-ornekler.svg" alt="Hesap sınıf nesnesinde tur niteliği ve metotlar, altında kendi __dict__ sözlükleri olan iki örnek; örnekler __class__ ile sınıfı, ada ve linus isimleri örnekleri gösterir.|The Hesap class object holds the tur attribute and the methods; below it two instances with their own __dict__; instances point to the class via __class__ and the names ada and linus point to the instances."}
Okuma örnekten sınıfa doğru arar, atama ise her zaman örneğin kendisine yazar.
:::

## Örnek nitelikleri ve sınıf nitelikleri

İki tür nitelik var:

- **Örnek niteliği (instance attribute):** `self.x = ...` ile nesnenin üzerinde oluşur. Her örneğin kendi değeri
  vardır.
- **Sınıf niteliği (class attribute):** sınıf gövdesinde, metotların dışında atanır. Sınıf nesnesinin üzerinde
  **tek kopya** olarak durur ve tüm örnekler tarafından **paylaşılır**.

Bir nitelik okunduğunda (`a.tur`) Python şu sırayla arar: **önce nesnenin kendisi, bulamazsa sınıfı** (sonra üst
sınıflar; K-13). Ama **atama** (`a.tur = ...`) her zaman nesnenin kendisine yapılır. Bu asimetri, aşağıdaki
"gölgeleme" davranışını doğurur.

:::trace{src="sinif-niteligi.trace.json" title="Sınıf niteliği, paylaşım ve gölgeleme|Class attributes, sharing and shadowing"}
Örnek kutularında 'tur' alanı olmadığı hâlde `a.tur`'un sınıftaki değeri okuduğuna, `b.tur = 'kurt'` atamasının ise sınıfı değil yalnızca b'nin kutusunu değiştirdiğine dikkat et.
:::

Simülasyondaki `Kopek.sayac += 1` satırı önemli: sınıf niteliğini değiştirmek istiyorsan onu **sınıf üzerinden**
değiştir. `self.sayac += 1` yazsaydın Python önce sınıftaki 0'ı okur, sonra sonucu (1) **örneğin** üzerine yazardı;
her köpeğin kendi sayacı olur ve sınıftaki sayaç hep 0 kalırdı.

Sınıf nitelikleri; sabitler (`KDV_ORANI = 0.20`), varsayılan değerler ve tüm örneklerin ortak sayacı gibi
paylaşılması **gereken** veriler için uygundur.

### Değiştirilebilir sınıf niteliği tuzağı

Sınıf niteliği değiştirilebilir (mutable) bir nesne olursa iş tehlikeli hâl alır. Bu, K-06'daki değiştirilebilir
varsayılan argüman tuzağının sınıflardaki karşılığıdır.

:::trace{src="paylasilan-liste.trace.json" title="Tuzak: tüm sepetler aynı listeyi paylaşıyor|Trap: every basket shares one list"}
`s1.ekle('elma')` sırasında listenin sınıf kutusunda değiştiğini ve `s2.urunler`'in de aynı listeyi gösterdiğini izle. Sonra `DogruSepet`'te her örneğin kendi listesini aldığını gör.
:::

:::callout{tone="danger" title="Değiştirilebilir değeri sınıf gövdesine koyma"}
`urunler = []`, `ayarlar = {}` gibi değiştirilebilir değerleri sınıf niteliği olarak yazma; `self.urunler.append(...)`
nesnenin değil sınıfın listesini değiştirir ve veri tüm örnekler arasında sızar. Her nesneye ait olması gereken
değiştirilebilir veriyi **`__init__` içinde** `self.urunler = []` ile oluştur. Gerçekten paylaşılan bir sabit
listeye ihtiyacın varsa onu değiştirilemez bir demet (tuple) yap.
:::

## __dict__: nesnenin içine bakmak

Bir örneğin nitelikleri, `__dict__` adlı bir sözlükte tutulur. Simülasyonlardaki örnek kutularında gördüğün
alanlar tam olarak budur. Sınıfın da kendi `__dict__`'i vardır ve metotlar oradadır.

:::code{lang="python" title="__dict__, getattr ve hasattr"}
```python
ada = Hesap("Ada", 100)
print(ada.__dict__)                  # {'sahip': 'Ada', 'bakiye': 100}
print("yatir" in ada.__dict__)       # False → metot örnekte değil
print("yatir" in Hesap.__dict__)     # True  → sınıfta

ada.etiket = "VIP"                   # Python, dışarıdan yeni nitelik eklemene izin verir
print(ada.__dict__)                  # {'sahip': 'Ada', 'bakiye': 100, 'etiket': 'VIP'}

print(getattr(ada, "bakiye"))        # 100 → ismi metin olarak verilen nitelik
print(hasattr(ada, "faiz"))          # False
print(getattr(ada, "faiz", 0))       # 0   → yoksa varsayılan
```
:::

Dışarıdan yeni nitelik ekleyebilmek esneklik sağlar ama yazım hatalarını da gizler: `ada.bakiyee = 0` hata vermez,
sessizce yeni bir alan oluşturur. Bu yüzden tüm nitelikleri `__init__` içinde tanımlamak iyi bir alışkanlıktır;
okuyan kişi nesnenin "şeklini" tek yerde görür. (`__slots__` ile bu esneklik kapatılabilir; K-17'de göreceksin.)

## @classmethod ve @staticmethod

Normal metotlar ilk argüman olarak **örneği** (`self`) alır. İki dekoratör bunu değiştirir:

| Tür | İlk parametre | Ne zaman? |
|---|---|---|
| Örnek metodu | `self` (örnek) | Nesnenin verisiyle çalışan işler (çoğu metot) |
| `@classmethod` | `cls` (sınıf) | Alternatif kurucular, sınıf düzeyinde işler |
| `@staticmethod` | Yok | Sınıfla mantıksal olarak ilgili ama ne örneğe ne sınıfa ihtiyaç duyan yardımcı |

:::code{lang="python" title="Alternatif kurucu ve yardımcı fonksiyon"}
```python
class Tarih:
    def __init__(self, gun, ay, yil):
        self.gun = gun
        self.ay = ay
        self.yil = yil

    @classmethod
    def metinden(cls, metin):
        gun, ay, yil = (int(p) for p in metin.split("."))
        return cls(gun, ay, yil)        # cls burada Tarih

    @staticmethod
    def artik_yil_mi(yil):
        return yil % 4 == 0 and (yil % 100 != 0 or yil % 400 == 0)

    def goster(self):
        return f"{self.gun:02d}.{self.ay:02d}.{self.yil}"


t = Tarih.metinden("29.10.1923")
print(t.goster())                  # 29.10.1923
print(Tarih.artik_yil_mi(2024))    # True
print(t.artik_yil_mi(1900))        # False → örnekten de çağrılabilir
```
:::

`metinden` içinde `Tarih(...)` yerine `cls(...)` yazmak önemlidir: K-13'te göreceğin alt sınıflardan çağrıldığında
`cls` o alt sınıf olur ve doğru türde nesne üretilir. Standart kütüphanede bu kalıbın örnekleri çoktur:
`dict.fromkeys(...)`, `datetime.fromisoformat(...)`.

## Kimlik ve eşitlik

Kendi sınıflarının nesnelerini `==` ile karşılaştırdığında şaşırtıcı bir sonuç alırsın:

:::code{lang="python" title="Aynı değerler, farklı nesneler"}
```python
b = Hesap("Ada", 100)
c = Hesap("Ada", 100)

print(b == c)   # False → nitelikler aynı ama farklı nesneler
print(b is c)   # False
d = b
print(d is b)   # True
print(b == d)   # True
```
:::

Python, `==` için sınıfta bir `__eq__` metodu arar. Sen tanımlamadığında `object`'ten gelen varsayılan
kullanılır ve o yalnızca **kimliğe** bakar: `b == c` aslında `b is c` gibi davranır. "İki hesap, sahibi ve
bakiyesi aynıysa eşittir" demek için `__eq__` yazmak gerekir; bunu K-14'te `__eq__`, `__repr__` ve `dataclass`
ile yapacağız. `print(b)`'nin `<__main__.Hesap object at 0x...>` gibi okunaksız bir şey basmasının nedeni de
aynıdır: henüz `__repr__` yazmadık.

:::callout{tone="info" title="Python'da her şey bir nesne"}
`type(5)` → `int`, `type(int)` → `type`. Sınıflar da birer nesnedir ve türleri `type`'tır. Fonksiyonlar, modüller,
hatta `None` da nesnedir. Bu yüzden sınıfları değişkenlere atayabilir, fonksiyonlara argüman olarak verebilir ve
listelerde saklayabilirsin. `cls(...)` ile çalışan `classmethod`'lar tam olarak bu özellikten yararlanır.
:::

## Gerçekçi örnek: alışveriş sepeti

Şimdi öğrendiklerini bir araya getirelim: paylaşılan bir sabit (sınıf niteliği), her nesneye ait bir liste
(örnek niteliği), geçersiz veriyi reddeden bir metot (K-10'daki `raise`) ve birbirini kullanan metotlar.

:::code{lang="python" title="Sepet sınıfı"}
```python
class Sepet:
    KDV_ORANI = 0.20                      # sınıf niteliği: tüm sepetler için aynı

    def __init__(self, musteri):
        self.musteri = musteri
        self.kalemler = []                # örnek niteliği: her sepetin kendi listesi

    def ekle(self, urun, fiyat, adet=1):
        if fiyat <= 0 or adet <= 0:
            raise ValueError("Fiyat ve adet pozitif olmalı")
        self.kalemler.append((urun, fiyat, adet))

    def ara_toplam(self):
        return sum(fiyat * adet for _, fiyat, adet in self.kalemler)

    def toplam(self):
        return round(self.ara_toplam() * (1 + self.KDV_ORANI), 2)


sepet = Sepet("Ada")
sepet.ekle("Kalem", 15.0, adet=4)
sepet.ekle("Defter", 40.0)
print(sepet.ara_toplam())    # 100.0
print(sepet.toplam())        # 120.0
print(len(sepet.kalemler))   # 2
```
:::

Dikkat et: `toplam`, `self.ara_toplam()` ile aynı nesnenin başka bir metodunu çağırıyor ve `self.KDV_ORANI`'yi
okurken arama örnekte bulamayıp sınıfa geçiyor. `ekle` metodu geçersiz veriyi daha kapıda reddederek nesnenin
her zaman tutarlı kalmasını sağlıyor. Bu, sözlüklü versiyonda yapamadığımız şeydi: **kurallar verinin yanında
yaşıyor**. Yine de dikkat: `sepet.kalemler.append(...)` ile kuralı dışarıdan atlamak hâlâ mümkün. Python'da
"gizli" alan kavramını ve `property` ile kontrollü erişimi K-14'te göreceksin.

:::callout{tone="tip" title="İyi bir sınıfın işaretleri"}
Sınıfın tek ve net bir sorumluluğu olsun (adı bunu söylesin). Tüm nitelikleri `__init__`'te kur. Nesneyi
geçersiz duruma sokan girdiyi metotlarda reddet. Yalnızca veri taşıyan, hiç davranışı olmayan bir sınıf
yazıyorsan `dataclass` (K-14) daha uygun olabilir; durumu olmayan tek bir işlem içinse düz bir fonksiyon yeterlidir.
:::

:::realworld{company="Netflix"}
Netflix, veri bilimcilerinin makine öğrenmesi iş akışlarını yazması için **Metaflow** adlı bir Python kütüphanesi
geliştirdi ve açık kaynak olarak yayınladı. Metaflow'da bir iş akışı tam olarak bu dersteki araçlarla tanımlanır:
`FlowSpec`'ten türeyen bir **sınıf** yazarsın, akışın her adımı `@step` ile işaretlenmiş bir **metottur** ve
adımlar arasında taşınacak veri `self` üzerine atanan **örnek nitelikleridir**.

```python
class EgitimAkisi(FlowSpec):
    @step
    def start(self):
        self.veri = yukle()        # bir sonraki adıma taşınır
        self.next(self.egit)
```

Burada `self.veri = ...` satırı yalnızca nesnenin `__dict__`'ine yazmakla kalmaz; Metaflow adım bittiğinde
örneğin niteliklerini "artifact" olarak saklar ve sonraki adımda yeniden yükler. Böylece bir adım başka bir
makinede çalışsa bile `self.veri` oradadır ve geçmiş çalıştırmaların verisi sonradan incelenebilir.

Çıkarılacak ders: "veri `self`'te, davranış metotlarda" fikri yalnızca küçük örneklerde değil, büyük bir
şirketin üretim araçlarında da kullanıcıya sunulan arayüzün kendisidir. Nitelik atamasının nesneye yazıldığını
bilmek, böyle bir çatının neyi neden kaydettiğini anlamanı sağlar.
:::

## Özet

- Sınıf bir şablondur; her çağrısı (`Hesap(...)`) heap'te yeni ve bağımsız bir **örnek** oluşturur. Sınıfın
  kendisi de heap'te yaşayan bir nesnedir ve metotları tutar.
- `__init__` yeni nesneyi başlatır; `self` o nesnedir. `self.x = ...` niteliği nesnenin üzerinde oluşturur.
- `nesne.metot(a)` ile `Sinif.metot(nesne, a)` aynıdır; `nesne.metot` bir bound method'dur.
- Nitelik okurken önce nesneye, sonra sınıfa bakılır; atama ise her zaman nesneye yapılır ve sınıf niteliğini
  gölgeler.
- Değiştirilebilir değerleri sınıf niteliği yapma; her örneğe ait veriyi `__init__` içinde oluştur.
- `@classmethod` sınıfı (`cls`) alır ve alternatif kurucular için idealdir; `@staticmethod` hiçbir şeyi otomatik almaz.
- `__eq__` tanımlanmadıkça `==` kimliği karşılaştırır.

:::quiz{src="quiz.json"}
:::

:::next{lesson="k-13-kalitim-ve-polimorfizm"}
:::

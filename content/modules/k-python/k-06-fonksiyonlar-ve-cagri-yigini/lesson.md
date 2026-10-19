---
id: k-06-fonksiyonlar-ve-cagri-yigini
slug: fonksiyonlar-ve-cagri-yigini
module: k-python
order: 6
title:
  tr: "Fonksiyonlar, Parametreler ve Çağrı Yığını"
  en: "Functions, Parameters and the Call Stack"
summary:
  tr: "Fonksiyon çağrısında açılan çerçeveyi, parametre aktarımını ve return'ü yığında adım adım gör."
  en: "Watch frames get pushed, arguments passed and values returned on the call stack."
durationMinutes: 20
level: beginner
tags: [python, fonksiyonlar, parametreler, call-stack]
prerequisites: [k-05-koleksiyonlar-ve-kopyalama]
concepts: [function-definition, return-value, parameters-and-arguments, default-arguments, args-kwargs, call-stack, stack-frame, first-class-functions]
---

## Neden fonksiyon?

Bir alışveriş sitesinde KDV hesabını sepet sayfasında, fatura ekranında ve e-posta şablonunda ayrı ayrı yazdığını
düşün. Oran değiştiğinde üç yeri de bulup düzeltmen gerekir; birini unutursan müşteriler farklı tutarlar görür.
**Fonksiyon** (function), bir işi bir kez yazıp ona bir isim vermeni ve o ismi istediğin yerden çağırmanı sağlar.

Fonksiyonlar iki temel ihtiyaca cevap verir:

- **Tekrarı önlemek** (DRY, don't repeat yourself): Aynı kod tek yerde yaşar, düzeltme tek yerde yapılır.
- **Soyutlama** (abstraction): `kdv_ekle(tutar)` çağıran kişi içerideki formülü bilmek zorunda değildir. Uzun bir
  programı küçük, isimli, tek tek test edilebilir parçalara bölmüş olursun.

## Tanımlama, çağırma ve return

Fonksiyon `def` anahtar kelimesiyle tanımlanır. Parantez içindeki isimler **parametrelerdir** (parameter); fonksiyonu
çağırırken verdiğin değerler ise **argümanlardır** (argument). `return` fonksiyonu bitirir ve çağırana bir değer
gönderir.

| Terim | Nerede? | Örnek (`def kdv_ekle(tutar, oran=0.20)`) |
|---|---|---|
| Parametre (parameter) | Tanımdaki isim; fonksiyonun çerçevesinde yerel değişken olur | `tutar`, `oran` |
| Argüman (argument) | Çağrıda verilen değer (nesne) | `kdv_ekle(100, 0.10)` içindeki `100` ve `0.10` |
| Varsayılan değer (default) | Argüman verilmezse kullanılan değer | `oran=0.20` |
| Dönen değer (return value) | `return` ile çağırana giden nesne | `120.0` |

:::code{lang="python" title="İlk fonksiyon"}
```python
def kdv_ekle(tutar, oran=0.20):
    """Tutara KDV ekleyip sonucu döndürür."""
    return tutar * (1 + oran)

print(kdv_ekle(100))          # 120.0
print(kdv_ekle(100, 0.10))    # 110.00000000000001
print(kdv_ekle.__doc__)       # Tutara KDV ekleyip sonucu döndürür.
```
:::

İkinci satırdaki garip `110.00000000000001` bir hata değil, kayan noktalı sayıların (float) ikili tabanda tam
gösterilememesinin sonucudur (K-03). Para hesabında `decimal.Decimal` ya da kuruş cinsinden tam sayı kullanılır.

Fonksiyonun ilk satırındaki üç tırnaklı metin **docstring**'dir. `help(kdv_ekle)` ve editörler bu metni gösterir;
fonksiyonun ne yaptığını, parametrelerini ve dönen değeri kısaca anlatmak için kullan.

### return yoksa None

`return` satırına hiç ulaşmayan ya da değersiz `return` ile biten fonksiyon **`None`** döndürür. Ekrana bir şey
basmak ile değer döndürmek aynı şey değildir:

:::code{lang="python" title="print etmek döndürmek değildir"}
```python
def selamla(isim):
    print("Merhaba", isim)

sonuc = selamla("Ada")   # Merhaba Ada
print(sonuc)             # None
```
:::

### Birden çok değer döndürmek

Python'da `return a, b` aslında **tek** bir değer döndürür: bir tuple. Çağıran taraf onu K-05'te gördüğün gibi açar.

:::code{lang="python" title="Tuple ile çoklu dönüş"}
```python
def min_max(sayilar):
    return min(sayilar), max(sayilar)

sonuc = min_max([4, 9, 1])
print(sonuc, type(sonuc))   # (1, 9) <class 'tuple'>
en_kucuk, en_buyuk = min_max([4, 9, 1])
print(en_kucuk, en_buyuk)   # 1 9
```
:::

## Çağrı yığını: her çağrıya bir çerçeve

Bir fonksiyonu çağırdığında Python şunları yapar:

1. **Yeni bir çerçeve** (frame) oluşturur ve onu **çağrı yığınının** (call stack) tepesine koyar.
2. Parametre isimlerini bu çerçevede, verilen argüman nesnelerine bağlar (K-02: kopya alınmaz).
3. Çağıran kod, çağrının yapıldığı satırda **bekler**.
4. Fonksiyon `return` ile bittiğinde çerçeve yığından çıkarılır, yerel isimleri yok olur ve dönen değer
   çağıranın beklediği yere konur.

Yığın, üst üste konmuş tabaklar gibidir: en son konan ilk alınır (LIFO, last in first out). Bir fonksiyon başka bir
fonksiyonu çağırırsa yeni çerçeve onun üstüne gelir. Aşağıdaki simülasyonda `siparis` → `toplam_hesapla` →
`kdv_ekle` zinciriyle yığının önce büyüyüp sonra küçüldüğünü göreceksin.

:::trace{src="cagri-yigini.trace.json" title="Çağrı yığınının büyümesi ve küçülmesi|The call stack growing and shrinking"}
Soldaki çerçeve listesini izle: her çağrıda yeni bir çerçeve eklenir, her `return`de en üstteki kalkar. İkinci `siparis` çağrısında çerçevelerin sıfırdan açıldığına bak.
:::

Simülasyondan çıkarılacak önemli noktalar:

- `toplam_hesapla` ve `siparis` aynı isimli parametrelere (`fiyat`, `adet`) sahip, ama bunlar **farklı
  çerçevelerde** duran ayrı isimler. Biri diğerini etkilemez.
- `kdv_ekle` çalışırken `toplam_hesapla` ve `siparis` yok olmadı; kendi satırlarında **duraklamış** olarak
  bekliyorlar. Bu yüzden bir hata olduğunda Python sana bütün zinciri gösteren bir **traceback** basar.
- Aynı fonksiyonun ikinci çağrısı bir öncekinden hiçbir şey hatırlamaz: `ara`, `toplam`, `sonuc` yeniden oluşur.
  Fonksiyonun "hafızası" yoktur; durum tutmak istiyorsan onu bir nesnede ya da closure'da (K-07) saklarsın.

:::callout{tone="info" title="Traceback yığını okur"}
Bir hata oluştuğunda gördüğün `Traceback (most recent call last):` çıktısı, hata anındaki çağrı yığınının
dökümüdür. En üstte en dış çağrı, en altta hatanın asıl oluştuğu satır vardır. Hata ayıklarken alttan yukarı
okumak genellikle en hızlı yoldur.
:::

### Yerel değişkenler çerçeveyle birlikte yok olur

Fonksiyonun içinde oluşturduğun isimler o çağrının çerçevesine aittir. Çerçeve kapandığında bu isimlere dışarıdan
ulaşamazsın; değeri dışarı taşımanın tek düzgün yolu `return`'dür. İsim yok olsa da, döndürdüğün nesne başka bir
isme bağlandığı sürece heap'te yaşamaya devam eder.

:::code{lang="python" title="Yerel isim dışarıda yoktur"}
```python
def hesapla():
    ara_sonuc = 42          # yerel isim
    return ara_sonuc * 2

deger = hesapla()
print(deger)                # 84
try:
    print(ara_sonuc)
except NameError as e:
    print(e)                # name 'ara_sonuc' is not defined
```
:::

Bu yalıtım bir özelliktir, kısıtlama değil: fonksiyonun içinde istediğin ismi kullanabilirsin, başka bir
fonksiyondaki aynı isimle çakışmaz. İsimlerin hangi sırayla arandığını (LEGB kuralı) bir sonraki derste
göreceksin.

Yığının bir sınırı vardır: CPython varsayılan olarak yaklaşık 1000 iç içe Python çağrısına izin verir
(`sys.getrecursionlimit()`), aşılırsa `RecursionError` oluşur. Bunu özyineleme dersinde (K-08) ayrıntılı
göreceğiz.

## Parametre türleri

### Konumsal ve isimli argümanlar

Argümanları **sırasıyla** (konumsal, positional) ya da **isimleriyle** (isimli, keyword) verebilirsin. İsimli
argümanlar sırayı serbest bırakır ve çağrıyı okunur yapar. Aynı çağrıda önce konumsallar, sonra isimliler gelir.

:::code{lang="python" title="Konumsal, isimli ve varsayılan"}
```python
def kullanici_olustur(ad, yas, sehir="İstanbul", aktif=True):
    return f"{ad} ({yas}) - {sehir} - {aktif}"

print(kullanici_olustur("Ada", 30))
# Ada (30) - İstanbul - True
print(kullanici_olustur("Can", 25, aktif=False))
# Can (25) - İstanbul - False
print(kullanici_olustur(yas=40, ad="Ece", sehir="İzmir"))
# Ece (40) - İzmir - True
# kullanici_olustur(ad="Ada", 30)  → SyntaxError: isimliden sonra konumsal olmaz
```
:::

Varsayılan değeri olan parametreler, olmayanlardan **sonra** gelmelidir: `def f(a=1, b)` sözdizimi hatasıdır.

### Değiştirilebilir varsayılan argüman tuzağı

Varsayılan değerler **fonksiyon tanımlanırken**, yani `def` satırı çalıştığında **bir kez** hesaplanır ve
fonksiyon nesnesinin içinde saklanır (`fonksiyon.__defaults__`). Varsayılan değer bir liste ya da sözlük gibi
değiştirilebilir bir nesneyse, her çağrı **aynı nesneyi** kullanır:

:::trace{src="varsayilan-tuzak.trace.json" title="Değiştirilebilir varsayılan argüman tuzağı|The mutable default argument trap"}
`ekle_hatali` iki kez çağrıldığında 'liste' parametresinin iki seferde de aynı heap nesnesini gösterdiğine, `ekle_dogru`da ise her çağrıda yeni bir liste oluştuğuna bak.
:::

:::callout{tone="danger" title="Varsayılan değer olarak [] ya da {} verme"}
`def f(x, liste=[])` yazdığında bütün çağrılar tek bir listeyi paylaşır ve veri çağrılar arasında sızar. Bu
hata özellikle web sunucularında farklı kullanıcıların verisinin karışmasına yol açabilir. Doğru kalıp:
`def f(x, liste=None):` ve gövdenin başında `if liste is None: liste = []`. Aynı kural `dict`, `set` ve kendi
değiştirilebilir nesnelerin için de geçerlidir.
:::

Simülasyonda `x is y` sonucunun `True` çıkması tuzağın kanıtıdır: iki çağrı aynı liste nesnesini döndürdü.

Peki Python neden böyle tasarlanmış? Çünkü `def` de sıradan bir çalıştırılabilir ifadedir: satıra gelindiğinde
fonksiyon nesnesi oluşturulur ve varsayılan ifadeler o anda **değerlendirilir**. Her çağrıda yeniden
değerlendirmek hem yavaş olurdu hem de `def f(x, zaman=simdi())` gibi tanımların anlamını belirsizleştirirdi.
Bu davranışı bilerek kullanan kod da vardır (örneğin basit bir önbellek), ama okuyana niyetini açıkça
belirtmedikçe tuzak olarak kalır. Varsayılan değeri görmek istersen `ekle_hatali.__defaults__` yazdırabilirsin:
iki çağrıdan sonra `(['a', 'b'],)` görürsün, yani liste gerçekten fonksiyon nesnesinin içinde büyümüştür.

### *args ve **kwargs: değişken sayıda argüman

Bazen fonksiyonun kaç argüman alacağını önceden bilemezsin (`print` gibi). Parametre adının önüne konan `*`,
**fazla konumsal argümanları bir tuple'da** toplar; `**` ise **fazla isimli argümanları bir sözlükte** toplar.
`args` ve `kwargs` yalnızca geleneksel isimlerdir; önemli olan yıldızlardır.

Çağrı tarafında ise yıldızlar tersini yapar: `*liste` bir koleksiyonu konumsal argümanlara, `**sozluk` bir
sözlüğü isimli argümanlara **açar** (unpacking).

:::trace{src="args-kwargs.trace.json" title="*args tuple, **kwargs dict olarak gelir|*args arrives as a tuple, **kwargs as a dict"}
`kaydet` çerçevesinde 'mesajlar'ın tuple, 'etiketler'in dict olduğuna; ikinci çağrıda açılan liste ve sözlükten yeni nesneler oluştuğuna dikkat et.
:::

İkinci çağrıda heap'e bakarsan, `mesajlar` için `parcalar` listesinden **ayrı** bir tuple, `etiketler` için de
`ayarlar` sözlüğünden **ayrı** bir sözlük oluştuğunu görürsün. Yani `etiketler`'i fonksiyon içinde değiştirmek
çağıranın `ayarlar` sözlüğünü etkilemez (içindeki değiştirilebilir değerler ise yine paylaşılır).

### Keyword-only ve positional-only parametreler

Parametre listesine tek başına konan `*`, ondan sonraki parametrelerin **yalnızca isimle** verilebileceğini
söyler (keyword-only). `/` ise ondan önceki parametrelerin **yalnızca konumla** verilebileceğini söyler
(positional-only, Python 3.8+).

:::code{lang="python" title="/ ve * ile çağrı biçimini zorlamak"}
```python
def transfer(kaynak, hedef, /, tutar, *, onayli=False):
    return f"{kaynak}->{hedef}: {tutar} (onaylı={onayli})"

print(transfer("A", "B", 100, onayli=True))
# A->B: 100 (onaylı=True)
print(transfer("A", "B", tutar=50))
# A->B: 50 (onaylı=False)
try:
    transfer("A", "B", 100, True)          # onayli konumla verilemez
except TypeError as e:
    print("TypeError:", e)
    # TypeError: transfer() takes 3 positional arguments but 4 were given
try:
    transfer(kaynak="A", hedef="B", tutar=1)  # kaynak isimle verilemez
except TypeError as e:
    print("TypeError:", e)
    # TypeError: transfer() got some positional-only arguments passed
    # as keyword arguments: 'kaynak, hedef'
```
:::

Keyword-only parametreler, `True`/`False` gibi anlamı çağrıda görünmeyen bayraklar için çok yararlıdır:
`transfer("A", "B", 100, True)` okuyanı düşündürür, `onayli=True` ise kendini anlatır. Positional-only
parametreler, parametre adını sonradan değiştirebilme özgürlüğü ister kütüphane yazarları içindir.

Tam sıralama şöyledir:

| Sıra | Biçim | Örnek |
|---|---|---|
| 1 | Yalnızca konumsal, ardından `/` | `a, b, /` |
| 2 | Normal (konumsal ya da isimli) | `c, d=1` |
| 3 | `*args` ya da tek başına `*` | `*args` |
| 4 | Yalnızca isimli | `e, f=2` |
| 5 | `**kwargs` | `**kwargs` |

## Fonksiyonlar da nesnedir

Python'da fonksiyonlar **birinci sınıf nesnelerdir** (first-class objects). `def` satırı aslında heap'te bir
fonksiyon nesnesi oluşturur ve onu bir isme bağlar; simülasyonlarda heap'te gördüğün `function` kutuları bunlardır.
Bu yüzden bir fonksiyonu başka bir isme atayabilir, bir listeye koyabilir ya da başka bir fonksiyona argüman
olarak verebilirsin:

:::code{lang="python" title="Fonksiyonu değer gibi kullanmak"}
```python
def iki_kati(x):
    return x * 2

def uygula(f, degerler):
    return [f(d) for d in degerler]

kopya = iki_kati            # çağırmadan (parantezsiz) atama
print(kopya(5))             # 10
print(uygula(iki_kati, [1, 2, 3]))   # [2, 4, 6]
print(sorted(["ece", "Ada", "can"], key=str.lower))
# ['Ada', 'can', 'ece']
islemler = {"topla": lambda a, b: a + b, "carp": lambda a, b: a * b}
print(islemler["carp"](3, 4))        # 12
```
:::

`iki_kati` ile `iki_kati()` arasındaki farka dikkat et: parantezsiz isim fonksiyon **nesnesinin kendisidir**,
parantezli hali onu **çağırır** ve dönen değeri verir. `sorted(..., key=str.lower)` yazarken `str.lower`'ı
çağırmıyorsun, `sorted`'a "her elemanı karşılaştırmadan önce bununla dönüştür" diye fonksiyonu teslim ediyorsun.
Bu fikir, bir sonraki dersteki closure ve dekoratörlerin temelidir.

:::callout{tone="tip" title="İyi fonksiyonun özellikleri"}
Tek bir iş yapsın ve adı o işi söylesin (`hesapla_kdv`, `kullanici_bul`). Mümkünse girdisini parametreden alsın,
sonucunu `return` ile versin; global değişken okuyup yazmasın ve argümanlarını gizlice değiştirmesin. Böyle
fonksiyonlar (saf fonksiyon, pure function) kolay test edilir ve güvenle yeniden kullanılır.
:::

## Gerçek hayattan bir örnek

Bir API istemcisinde ortak ayarları tek fonksiyonda toplayıp esnek bırakmak için bu derste gördüğün her şeyi
birlikte kullanırsın:

:::code{lang="python" title="Esnek bir istek oluşturucu"}
```python
def istek_olustur(metot, yol, /, *parcalar, zaman_asimi=10, **basliklar):
    """HTTP isteğini temsil eden bir sözlük döndürür."""
    url = "/".join([yol, *parcalar])
    return {"metot": metot, "url": url,
            "zaman_asimi": zaman_asimi, "basliklar": basliklar}

ortak = {"Accept": "application/json"}
print(istek_olustur("GET", "/api", "kullanicilar", "42", **ortak))
# {'metot': 'GET', 'url': '/api/kullanicilar/42', 'zaman_asimi': 10, 'basliklar': {'Accept': 'application/json'}}
```
:::

## Özet

- Fonksiyon tekrarı önler ve soyutlama sağlar; `def` ile tanımlanır, docstring ile belgelenir.
- `return` yoksa fonksiyon `None` döndürür; `return a, b` bir tuple döndürür.
- Her çağrı çağrı yığınına kendi yerel değişkenleriyle yeni bir çerçeve ekler; `return` ile çerçeve kalkar.
  Aynı fonksiyonun iki çağrısı birbirinden bağımsızdır.
- Parametre tanımdaki isim, argüman çağrıda verilen değerdir. Konumsal, isimli ve varsayılan argümanlar
  birlikte kullanılabilir.
- Varsayılan değerler bir kez hesaplanır: değiştirilebilir varsayılan yerine `None` kullan.
- `*args` tuple, `**kwargs` dict olarak gelir; çağrıda `*` ve `**` açar. `/` yalnızca konumsal, tek başına `*`
  yalnızca isimli parametreleri ayırır.
- Fonksiyonlar nesnedir: isme atanır, argüman olarak verilir, koleksiyonlarda saklanır.

:::quiz{src="quiz.json"}
:::

:::next{lesson="k-07-kapsam-closure-ve-dekoratorler"}
:::

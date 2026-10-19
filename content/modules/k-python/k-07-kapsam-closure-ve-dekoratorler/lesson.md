---
id: k-07-kapsam-closure-ve-dekoratorler
slug: kapsam-closure-ve-dekoratorler
module: k-python
order: 7
title:
  tr: "Kapsam (LEGB), Closure ve Dekoratörler"
  en: "Scope (LEGB), Closures and Decorators"
summary:
  tr: "İsimlerin nerede arandığını, closure'ın değişkeni nasıl yakaladığını ve dekoratörleri öğren."
  en: "Learn where names are looked up, how closures capture variables and how decorators work."
durationMinutes: 23
level: intermediate
tags: [python, kapsam, closure, dekorator, fonksiyonlar]
prerequisites: [k-06-fonksiyonlar-ve-cagri-yigini]
concepts: [legb-scope, global-nonlocal, unboundlocalerror, closure, late-binding, decorator, functools-wraps]
---

## Kapsam nedir ve neden önemli?

Bir önceki derste her fonksiyon çağrısının kendi çerçevesine sahip olduğunu gördün. Peki fonksiyonun içinde
`x` yazdığında Python bu `x`'i **nerede** arar? Kendi çerçevesinde mi, onu tanımlayan fonksiyonda mı, modülün en
üstünde mi? Bu sorunun cevabına **kapsam** (scope) denir. Kapsamı bilmek üç şey için şarttır:

- İki farklı fonksiyonda aynı ismi rahatça kullanabilmek (ve neden çakışmadıklarını anlamak).
- `UnboundLocalError` gibi ilk bakışta anlamsız görünen hataları çözebilmek.
- Bu dersin ikinci yarısındaki **closure** ve **dekoratör** kavramlarını anlamak: ikisi de kapsam kurallarının
  doğrudan sonucudur.

## LEGB kuralı

Python bir ismi okurken dört kapsama sırayla bakar ve **ilk bulduğunda durur**:

| Harf | Kapsam | Ne içerir? |
|---|---|---|
| **L** | Local (yerel) | Çalışan fonksiyonun içinde atanan isimler ve parametreler |
| **E** | Enclosing (kapsayan) | Fonksiyon başka bir fonksiyonun içinde tanımlandıysa, dıştaki fonksiyon(lar)ın yerel isimleri |
| **G** | Global (modül) | Dosyanın en üst seviyesinde atanan isimler, `def` ve `import` ile gelenler |
| **B** | Built-in (yerleşik) | `print`, `len`, `list`, `range`, `ValueError` gibi Python'la gelen isimler |

Dört kapsamda da bulunamazsa `NameError` oluşur.

:::code{lang="python" title="LEGB sırası"}
```python
x = "global"

def dis():
    x = "enclosing"
    def ic():
        x = "local"
        print(x)       # local
    ic()
    print(x)           # enclosing

dis()
print(x)               # global
print(len("abc"))      # 3 → len built-in kapsamda bulundu
```
:::

Üç ayrı `x` vardır ve her biri **kendi çerçevesinde** yaşar. `ic` içindeki atama, `dis`'teki ya da modüldeki
`x`'e dokunmaz. Bu, K-06'da gördüğün "her çağrının kendi çerçevesi" fikrinin isim aramadaki karşılığıdır.

:::callout{tone="info" title="if ve for kapsam oluşturmaz"}
Java ya da C'den geliyorsan dikkat: Python'da yalnızca **modül, fonksiyon ve sınıf** gövdeleri kapsam oluşturur.
`if`, `for`, `while` ve `with` blokları oluşturmaz. Bir `for` döngüsünden sonra döngü değişkeni hâlâ son değeriyle
erişilebilirdir. (Comprehension'lar ise kendi kapsamına sahiptir; döngü değişkenleri dışarı sızmaz.)
:::

## Atama kuralı: isim nerede atanıyorsa oraya aittir

LEGB **okuma** için geçerlidir. Bir isme **atama** yaptığında (`=`, `+=`, `for x in`, `def x`, `import x`) Python
o ismi varsayılan olarak **çalışan fonksiyonun yereli** sayar. Ve bu karar çalışma anında değil, fonksiyon
**derlenirken** (bytecode'a çevrilirken) bir kez verilir: fonksiyon gövdesinin **herhangi bir yerinde** o isme
atama varsa, isim o fonksiyonun **tamamında** yereldir.

### UnboundLocalError

Bu kuralın en meşhur sonucu şudur: global bir sayacı fonksiyonda okuyabilirsin, ama `sayac = sayac + 1` yazınca
hata alırsın. Çünkü atama yüzünden `sayac` yerel sayılmıştır; sağ taraftaki `sayac` da artık yerel isme bakar ve
o isme henüz değer verilmemiştir.

:::trace{src="unbound-local.trace.json" title="UnboundLocalError neden olur?|Why UnboundLocalError happens"}
`oku` aynı ismi sorunsuz okurken `artir`ın neden hata verdiğine bak: fark, fonksiyonda atama olup olmamasıdır.
:::

Hata mesajı (Python 3.11+) her şeyi söyler: "cannot access local variable 'sayac' where it is not associated with
a value". Yani Python `sayac`'ın yerel olduğunu biliyor, ama henüz bağlanmadığını söylüyor. Eski sürümlerde mesaj
"local variable 'sayac' referenced before assignment" biçimindedir.

### global ve nonlocal

Gerçekten dıştaki ismi **yeniden bağlamak** istiyorsan bunu açıkça bildirmelisin:

- `global isim`: bu fonksiyondaki `isim`, modül seviyesindeki isimdir.
- `nonlocal isim`: bu fonksiyondaki `isim`, en yakın **kapsayan fonksiyondaki** isimdir (global olamaz).

:::code{lang="python" title="global ve nonlocal"}
```python
sayac = 0

def artir():
    global sayac
    sayac += 1

artir(); artir()
print(sayac)          # 2

def dis():
    toplam = 0
    def ekle(n):
        nonlocal toplam
        toplam += n
    ekle(5); ekle(7)
    return toplam

print(dis())          # 12
```
:::

:::callout{tone="warning" title="global'i az kullan"}
`global` ile her yerden değiştirilen değişkenler, programın neresinin neyi değiştirdiğini takip etmeyi zorlaştırır
ve test yazmayı güçleştirir. Değeri parametreyle al, `return` ile döndür; durum tutman gerekiyorsa closure ya da
sınıf (K-12) kullan. Değiştirilebilir bir global nesneyi **değiştirmek** (`liste.append(...)`) için `global`
gerekmez, çünkü ismi yeniden bağlamıyorsun; ama bu da aynı takip sorununu taşır.
:::

### Built-in isimleri gölgeleme

Built-in kapsam en sonda arandığı için, aynı isimde bir global ya da yerel değişken oluşturursan yerleşik ismi
**gölgelemiş** (shadowing) olursun. Klasik örnek değişkene `list`, `dict`, `str`, `id`, `sum` ya da `input` adını
vermektir:

:::code{lang="python" title="list = ... tuzağı"}
```python
list = [1, 2, 3]          # built-in list artık gölgede
try:
    harfler = list("abc")
except TypeError as e:
    print(e)              # 'list' object is not callable
del list                  # global ismi sil: built-in yeniden görünür
print(list("abc"))        # ['a', 'b', 'c']
```
:::

:::callout{tone="danger" title="Yerleşik isimleri değişken adı yapma"}
`list`, `dict`, `str`, `type`, `id`, `sum`, `max`, `min`, `filter` gibi isimleri değişken adı olarak kullanma.
Hata, gölgeleyen satırda değil, çok daha sonra yerleşik fonksiyonu çağırdığın yerde ortaya çıkar ve kafa
karıştırır. `liste`, `sayilar`, `kullanici_id` gibi açıklayıcı isimler seç. Linter'lar (örneğin Ruff'un `A`
kuralları) bunu otomatik yakalar.
:::

## Closure: değişkeni yakalayan fonksiyon

Python'da bir fonksiyonu başka bir fonksiyonun içinde tanımlayabilir ve onu `return` ile dışarı verebilirsin
(fonksiyonlar nesnedir, K-06). İç fonksiyon dıştakinin bir değişkenini kullanıyorsa ilginç bir şey olur: dış
fonksiyonun çerçevesi kapandıktan sonra bile iç fonksiyon o değişkene erişebilir. Bu iç fonksiyona **closure**
(kapanış) denir.

Nasıl mümkün? Derleyici, iç fonksiyonun dıştaki bir değişkeni kullandığını görünce o değişkeni normal yerel
yerine bir **hücrede** (cell) saklar. İç fonksiyon nesnesi bu hücreye bir referans tutar (`fonksiyon.__closure__`).
Çerçeve kapanınca çerçeve yok olur ama hücre, onu tutan fonksiyon yaşadıkça yaşar.

:::trace{src="closure-sayac.trace.json" title="Closure ile sayaç|A counter built with a closure"}
Heap'teki iki `artir` fonksiyonunun closure değerlerini izle: `a` ve `b` ayrı hücrelere sahip, biri artınca diğeri değişmez.
:::

Simülasyondan çıkan dersler:

- `sayac_olustur` her çağrıldığında **yeni** bir çerçeve, yeni bir `sayi` hücresi ve yeni bir `artir` fonksiyon
  nesnesi oluşur. `a` ve `b` aynı koddan üretilmiş ama durumları ayrı iki sayaçtır.
- `sayac_olustur` döndükten sonra çerçevesi yığından kalktı, ama `sayi` closure içinde yaşamaya devam etti.
- `nonlocal sayi` olmasaydı `sayi += 1` atama olduğu için `sayi`'yı yerel sayacak ve `UnboundLocalError` verecekti.
  Yalnızca okuyan bir iç fonksiyonun `nonlocal`'a ihtiyacı yoktur.

Closure'lar küçük bir durum tutmanın hafif bir yoludur: sınıf yazmadan bir sayaç, bir önbellek, bir ayar
"dondurulmuş" fonksiyon üretebilirsin.

:::code{lang="python" title="Ayarı dondurmak ve closure'ı incelemek"}
```python
def carpan(n):
    def carp(x):
        return x * n
    return carp

iki_kat = carpan(2)
uc_kat = carpan(3)
print(iki_kat(10), uc_kat(10))                  # 20 30
print(iki_kat.__code__.co_freevars)             # ('n',)
print(iki_kat.__closure__[0].cell_contents)     # 2
```
:::

### Geç bağlama (late binding) tuzağı

Closure, değişkenin o anki **değerini** değil, değişkenin **kendisini** (hücreyi) yakalar. Değer, iç fonksiyon
**çağrıldığında** okunur. Bir döngüde lambda ya da iç fonksiyon üretirsen hepsi aynı döngü değişkenini paylaşır ve
çağırdığında hepsi değişkenin **son** değerini görür:

:::trace{src="gec-baglama.trace.json" title="Döngüde lambda: geç bağlama|Lambdas in a loop: late binding"}
`hatali_olustur`daki üç lambdanın heap'te aynı `i` değerini gösterdiğine, `dogru_olustur`da ise her lambdanın kendi varsayılan değerini taşıdığına bak.
:::

Çözüm yolları: varsayılan argümanla değeri tanım anında dondurmak (`lambda i=i: i`), bir fabrika fonksiyonu
kullanmak (`carpan(n)` gibi, her çağrı yeni hücre üretir) ya da `functools.partial`. Varsayılan argüman hilesi
kısa ama fonksiyonun imzasını değiştirir (biri `f(5)` diye çağırırsa `i` ezilir); kalıcı kodda fabrika fonksiyonu
daha temizdir.

## Dekoratörler: fonksiyonu saran fonksiyon

Bir projede on farklı fonksiyonun ne kadar sürdüğünü ölçmek istediğini düşün. Her birinin başına ve sonuna zaman
ölçen kod eklemek tekrardır ve asıl işi gürültüye boğar. **Dekoratör** (decorator), bir fonksiyonu alıp onun
yerine geçecek **yeni bir fonksiyon** döndüren fonksiyondur. Yeni fonksiyon (sarmalayıcı, wrapper) genellikle bir
şey yapar, asıl fonksiyonu çağırır ve sonucunu döndürür. Asıl fonksiyona closure ile erişir.

`@` sözdizimi yalnızca bir kısaltmadır:

:::code{lang="python" title="@ sözdiziminin açılımı"}
```python
def bagir(fonk):
    def sarmalayici(*args, **kwargs):
        return fonk(*args, **kwargs).upper()
    return sarmalayici

@bagir
def selam(isim):
    return f"merhaba {isim}"

# Yukarıdaki @bagir şunun tam karşılığıdır:
# def selam(isim): ...
# selam = bagir(selam)

print(selam("ada"))    # MERHABA ADA
```
:::

Dekoratör, `def` satırı çalıştığı anda **bir kez** uygulanır. Sonrasında `selam` ismi artık sarmalayıcıyı
gösterir; her `selam(...)` çağrısı önce sarmalayıcının çerçevesini açar, o da asıl fonksiyonu çağırır:

:::trace{src="dekorator.trace.json" title="Dekoratör: önce sarmalayıcı, sonra asıl fonksiyon|Decorator: wrapper first, then the original"}
`topla(2, 3)` çağrısında yığına önce `sarmalayici`, onun üstüne asıl `topla` çerçevesinin eklendiğine; heap'te sarmalayıcının closure'ında asıl fonksiyonu tuttuğuna bak.
:::

### functools.wraps

Simülasyonun sonunda `topla.__name__` hâlâ `topla` yazdırdı. Bunu sağlayan `@functools.wraps(fonk)` satırıdır.
O olmasaydı `topla.__name__` `sarmalayici` olurdu; docstring, `help()` çıktısı, hata ayıklama araçları ve loglar
yanlış ismi gösterirdi. `wraps`, asıl fonksiyonun `__name__`, `__doc__`, `__module__`, `__qualname__` gibi
bilgilerini sarmalayıcıya kopyalar ve asıl fonksiyonu `__wrapped__` niteliğinde saklar. **Her dekoratörde kullan.**

### Zamanlama ve loglama dekoratörü

:::code{lang="python" title="Zamanlama dekoratörü"}
```python
import functools
import time

def zamanla(fonk):
    @functools.wraps(fonk)
    def sarmalayici(*args, **kwargs):
        baslangic = time.perf_counter()
        try:
            return fonk(*args, **kwargs)
        finally:
            gecen = time.perf_counter() - baslangic
            print(f"{fonk.__name__} {gecen:.4f} sn sürdü")
    return sarmalayici

@zamanla
def topla_kareler(n):
    """0..n-1 sayılarının karelerini toplar."""
    return sum(i * i for i in range(n))

print(topla_kareler(100_000))
print(topla_kareler.__name__, "-", topla_kareler.__doc__)
# topla_kareler 0.00xx sn sürdü   (süre makineye göre değişir)
# 333328333350000
# topla_kareler - 0..n-1 sayılarının karelerini toplar.
```
:::

`try/finally` sayesinde fonksiyon hata fırlatsa bile süre yazdırılır ve hata çağırana aynen iletilir.

### Parametreli dekoratör: üç katman

`@tekrar(3)` gibi argüman alan bir dekoratör yazmak istersen bir katman daha gerekir. `tekrar(3)` önce
**çağrılır** ve asıl dekoratörü döndürür; `@` o dönen dekoratörü fonksiyona uygular:

:::code{lang="python" title="Parametreli dekoratör"}
```python
import functools

def tekrar(kez):                    # 1. katman: ayarı alır
    def dekorator(fonk):            # 2. katman: fonksiyonu alır
        @functools.wraps(fonk)
        def sarmalayici(*args, **kwargs):   # 3. katman: çağrıyı sarar
            sonuclar = []
            for _ in range(kez):
                sonuclar.append(fonk(*args, **kwargs))
            return sonuclar
        return sarmalayici
    return dekorator

@tekrar(3)                          # selamla = tekrar(3)(selamla)
def selamla(isim):
    return f"selam {isim}"

print(selamla("ece"))  # ['selam ece', 'selam ece', 'selam ece']
```
:::

Birden fazla dekoratör üst üste yazılabilir; **alttaki önce** uygulanır: `@a` `@b` `def f` demek
`f = a(b(f))` demektir.

### Standart kütüphaneden hazır dekoratörler

Kendi dekoratörünü yazmadan önce standart kütüphaneye bak. `functools.lru_cache` (ve Python 3.9+ ile gelen
kısa hali `functools.cache`) bir fonksiyonun sonuçlarını argümanlarına göre önbelleğe alır; aynı argümanla
tekrar çağrıldığında hesaplama yapmadan kayıtlı sonucu döndürür. Argümanlar sözlük anahtarı olarak kullanıldığı
için hashable olmalıdır (K-05).

:::code{lang="python" title="lru_cache ile önbellek"}
```python
from functools import lru_cache

@lru_cache(maxsize=None)
def fib(n):
    return n if n < 2 else fib(n - 1) + fib(n - 2)

print(fib(80))              # 23416728348467685
print(fib.cache_info().hits > 0)   # True
```
:::

Dekoratörler yalnızca fonksiyonlara değil sınıflara da uygulanabilir: `@dataclass` (K-14) bir sınıfı alıp ona
`__init__`, `__repr__` gibi metotlar ekler. Sınıf içinde göreceğin `@property`, `@staticmethod` ve
`@classmethod` da dekoratördür. Web çatılarındaki `@app.get("/kullanicilar")` gibi satırlar ise fonksiyonu bir
yönlendirme tablosuna kaydeden parametreli dekoratörlerdir.

## Gerçek hayattan bir örnek: yetki kontrolü

Bir yönetim panelinde bazı işlemleri yalnızca belirli roldeki kullanıcıların yapabilmesini istiyorsun. Kontrolü
her fonksiyonun başına kopyalamak yerine parametreli bir dekoratör yazarsın; asıl fonksiyonlar yalnızca kendi
işlerini anlatır:

:::code{lang="python" title="Rol kontrol eden dekoratör"}
```python
import functools

def rol_gerekli(rol):
    def dekorator(fonk):
        @functools.wraps(fonk)
        def sarmalayici(kullanici, *args, **kwargs):
            if rol not in kullanici["roller"]:
                raise PermissionError(f"{fonk.__name__} için '{rol}' rolü gerekli")
            return fonk(kullanici, *args, **kwargs)
        return sarmalayici
    return dekorator

@rol_gerekli("admin")
def kullanici_sil(kullanici, hedef_id):
    return f"{hedef_id} silindi"

admin = {"ad": "Ada", "roller": {"admin"}}
misafir = {"ad": "Can", "roller": set()}
print(kullanici_sil(admin, 42))      # 42 silindi
try:
    kullanici_sil(misafir, 42)
except PermissionError as e:
    print(e)                         # kullanici_sil için 'admin' rolü gerekli
```
:::

Burada üç dersin birleştiğini görüyorsun: `rol` bir closure değişkeni, roller bir `set` (hızlı `in` sorgusu) ve
`*args/**kwargs` sarmalayıcının her imzaya uymasını sağlıyor.

## Özet

- Python isimleri **LEGB** sırasıyla arar: Local, Enclosing, Global, Built-in. İlk bulduğunda durur.
- Bir fonksiyonda bir isme atama varsa, isim derleme sırasında o fonksiyonun **tamamında** yerel sayılır; atamadan
  önce okumak `UnboundLocalError` verir.
- Dıştaki ismi yeniden bağlamak için `global` (modül) ya da `nonlocal` (kapsayan fonksiyon) kullan; `global`'i
  az kullan. `list`, `sum` gibi yerleşik isimleri gölgeleme.
- **Closure**, dış fonksiyonun değişkenini hücre olarak yakalayan iç fonksiyondur; dış çerçeve kapansa da hücre
  yaşar. Her fabrika çağrısı yeni bir hücre üretir.
- Closure değeri değil değişkeni yakalar: döngüde üretilen lambdalar son değeri görür (geç bağlama). Çözüm:
  `lambda i=i: ...` ya da fabrika fonksiyonu.
- **Dekoratör**, fonksiyon alıp fonksiyon döndüren fonksiyondur; `@d` demek `f = d(f)` demektir. Her zaman
  `functools.wraps` kullan; argümanlı dekoratör üç katmanlıdır. `lru_cache` gibi hazır dekoratörleri tanı.

:::quiz{src="quiz.json"}
:::

:::next{lesson="k-08-ozyineleme"}
:::

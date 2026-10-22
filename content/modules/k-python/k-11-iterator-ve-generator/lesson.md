---
id: k-11-iterator-ve-generator
slug: iterator-ve-generator
module: k-python
order: 11
title:
  tr: "Iterator ve Generator: Tembel Hesaplama"
  en: "Iterators and Generators: Lazy Evaluation"
summary:
  tr: "for döngüsünün arkasındaki iterator protokolünü ve yield ile duraklayan fonksiyonları gör."
  en: "See the iterator protocol behind for loops and functions that pause with yield."
durationMinutes: 23
level: intermediate
tags: [python, iterator, generator, yield, itertools]
prerequisites: [k-10-hatalar-istisnalar-ve-dosyalar]
concepts: [iterable, iterator-protocol, stop-iteration, generator, yield, lazy-evaluation, yield-from, itertools]
---

## Neden önemli?

`for` döngüsüyle bir listeyi, bir metni, bir sözlüğü, bir dosyayı, `range(10)`'u ve `zip(...)`'in sonucunu
dolaşabiliyorsun. Bunlar birbirinden çok farklı nesneler. Tek bir `for` sözdizimi hepsinde nasıl çalışıyor?

Cevap, Python'un **iterator protokolüdür (iterator protocol)**: "bana sıradaki elemanı ver" diyebildiğin her nesne
için ortak bir sözleşme. Bu dersin ikinci yarısındaki **generator'lar** ise bu sözleşmeyi bir fonksiyonla, `yield`
anahtar kelimesiyle yazmanın en kolay yoludur. Generator'lar şunları mümkün kılar:

- 10 GB'lık bir log dosyasını belleğe almadan satır satır işlemek.
- Sonsuz dizilerle çalışmak (her saniye gelen olaylar, sonsuz sayaç).
- Veriyi bir **boru hattından (pipeline)** akıtmak: oku → dönüştür → süz → yaz. Her adım bir sonrakine tek bir
  eleman verir.

K-09'da generator ifadelerinin **tembel (lazy)** olduğunu gördün. Bu derste tembelliğin yığında ve bellekte gerçekte
nasıl çalıştığını izleyeceksin.

## Iterable ve iterator: iki ayrı rol

Bu iki kelime birbirine çok benzer ama farklı şeyleri anlatır:

| | Iterable (dolaşılabilir) | Iterator (dolaşıcı) |
|---|---|---|
| Ne demek? | Üzerinde dolaşılabilen bir **kaynak** | Dolaşmanın **o anki konumunu** tutan nesne |
| Gereken metot | `__iter__()` → bir iterator döndürür | `__next__()` → sıradaki eleman; `__iter__()` → kendisi |
| Örnekler | `list`, `str`, `dict`, `set`, `range`, dosya | `iter(liste)`, generator'lar, `map`, `zip`, `enumerate`, dosya |
| Tekrar dolaşılır mı? | Evet, her `iter()` yeni bir iterator verir | **Hayır**, bir kez tükenince biter |

Benzetme: kitap bir **iterable**'dır; **kitap ayracı** ise bir iterator'dır. Aynı kitaba birden fazla ayraç koyabilir,
her birini ayrı ilerletebilirsin. Ayraç son sayfaya gelince orada kalır, kendiliğinden başa dönmez.

İki yerleşik fonksiyon bu protokolü kullanır:

- `iter(nesne)` → `nesne.__iter__()` çağırır ve bir iterator alır.
- `next(iterator)` → `iterator.__next__()` çağırır ve sıradaki elemanı alır. Eleman kalmamışsa **`StopIteration`**
  istisnası fırlatılır. `next(iterator, varsayilan)` biçiminde yazarsan istisna yerine varsayılan değer döner.

:::code{lang="python" title="iter, next ve StopIteration"}
```python
harfler = "ab"
it = iter(harfler)
print(next(it), next(it))    # a b
try:
    next(it)
except StopIteration:
    print("StopIteration")   # StopIteration

liste = [1, 2]
print(iter(liste) is iter(liste))   # False → her iter() yeni bir iterator
it = iter(liste)
print(iter(it) is it)               # True  → iterator'ın iter()'i kendisi
```
:::

`StopIteration` bir hata değildir. K-10'da gördüğün istisna mekanizmasını Python burada **"bitti" sinyali** olarak
kullanır.

## for döngüsünün arka planı

Python'da `for x in kaynak: gövde` yazdığında yorumlayıcı kabaca şunu yapar:

:::code{lang="python" title="for döngüsünün eşdeğeri"}
```python
_it = iter(kaynak)
while True:
    try:
        x = next(_it)
    except StopIteration:
        break
    gövde
```
:::

Bu açılımı kendi yazdığımız bir iterator sınıfıyla izleyelim. `GeriSayim`, protokolün iki metodunu uygular:
`__iter__` kendini döndürür, `__next__` her çağrıda bir sonraki sayıyı verir ya da `StopIteration` fırlatır.

:::trace{src="iterator-sinifi.trace.json" title="for döngüsünün açılımı ve kendi iterator'ın|Unrolling a for loop with your own iterator"}
Her next(it) çağrısında yığına __next__ çerçevesinin girdiğini, heap'teki 'kalan' niteliğinin 2 → 1 → 0 diye azaldığını ve ikinci döngünün gövdesinin hiç çalışmadığını izle.
:::

Simülasyondan çıkanlar:

- `iter(sayim)` aynı nesneyi döndürdü (`__iter__` → `self`). Bu yüzden `it` ve `sayim` heap'te **tek bir nesneyi**
  gösteriyor.
- Her `next(it)` bir `__next__` çerçevesi açtı. Konum bilgisi (`kalan`) çerçevede değil, **nesnenin niteliğinde**
  tutuluyor. Çerçeve kapanınca konum kaybolmuyor.
- `kalan` 0'a inince `raise StopIteration` çalıştı. İstisna `__next__` çerçevesinden global çerçeveye yayıldı ve
  `except` ile yakalandı.
- İkinci `for` döngüsü yine `iter(sayim)` çağırdı, aynı tükenmiş nesneyi aldı ve ilk `next`'te `StopIteration`
  gördü. Gövde **hiç çalışmadı**, hata da çıkmadı.

### Tek kullanımlık iterator tuzağı

Son madde, Python'daki en sinsi hatalardan birinin kaynağıdır:

:::callout{tone="danger" title="İkinci tur sessizce boş döner"}
Iterator'lar **bir kez** tüketilir ve bunu hata vermeden yapar. `map`, `filter`, `zip`, generator'lar ve dosya
nesneleri iterator'dır:

```python
sayilar = map(int, ["1", "2", "3"])
print(sum(sayilar))   # 6
print(sum(sayilar))   # 0  ← hata yok, sadece boş!
```

Aynı veriyi birden fazla kez dolaşacaksan önce `list(...)` ile somutlaştır ya da her seferinde yeni bir iterator
üret. Bir fonksiyon parametre olarak "iterable" alıyor ve onu iki kez dolaşıyorsa (`len` + `for`, ya da iki ayrı
`for`), çağıran bir generator verdiğinde fonksiyon yanlış çalışır.
:::

Kendi sınıfını tekrar dolaşılabilir yapmak istiyorsan `__iter__` her çağrıda **yeni** bir iterator döndürmeli.
En kolay yolu `__iter__`'i bir generator fonksiyonu olarak yazmaktır. Şimdi generator'lara geçiyoruz.

## Generator fonksiyonları ve yield

Gövdesinde `yield` geçen her fonksiyon bir **generator fonksiyonudur**. Normal bir fonksiyondan üç önemli farkı
vardır:

1. Çağırmak gövdeyi **çalıştırmaz**. Yalnızca bir **generator nesnesi** döndürür. Bu nesne bir iterator'dır.
2. Her `next()` çağrısında gövde, bir sonraki `yield`'e kadar çalışır, değeri dışarı verir ve **askıya alınır
   (suspend)**.
3. Askıya alınan çerçeve yok edilmez. Yerel değişkenleri ve kaldığı satır generator nesnesinin içinde saklanır.
   Bir sonraki `next()` **tam kaldığı yerden** devam eder.

:::trace{src="generator.trace.json" title="yield: askıya al, kaldığın yerden devam et|yield: suspend and resume"}
sayac çerçevesinin her next() ile yığına girdiğini, yield'de yığından çıktığını ama n değerini kaybetmediğini; gen = sayac(2) satırında ise hiçbir şey yazdırılmadığını izle.
:::

Bu simülasyonda dikkat etmen gereken anlar:

- `gen = sayac(2)` satırından sonra çıktı panelinde **hiçbir şey yok**. `"[gen] başladı"` ancak ilk `next(gen)`
  çağrısında yazdırıldı. Generator fonksiyonunu çağırmak gövdeyi başlatmaz.
- İlk `next` ile `sayac` çerçevesi yığına girdi ve `yield n` satırına kadar çalıştı. Oynatıcı bunu çerçeveden çıkış
  (`return`) olarak gösteriyor ve "dönen" değeri 1. Ardından yığında **yalnızca Global** kaldı.
- İkinci `next` ile çerçeve **aynı yerel değişkenlerle** (`n=1`) geri geldi ve `yield`'den sonraki satırdan (`n += 1`)
  devam etti. Normal bir fonksiyon her çağrıda sıfırdan başlar; generator başlamaz.
- Üçüncü `next`'te döngü bitti, fonksiyon sonuna ulaştı ve gerçekten sonlandı. Python bu noktada `StopIteration`
  fırlatır. `next(gen, "tükendi")` bunu yakaladı ve varsayılan değeri döndürdü.

Askıdaki çerçeve nerede duruyor? Heap'teki **generator nesnesinin içinde**. Generator nesnesi, durdurulmuş bir
fonksiyon çerçevesini taşıyan bir kaptır. `gen` ismi yaşadıkça çerçeve de yaşar.

:::callout{tone="info" title="return ve generator"}
Generator içinde `return deger` yazabilirsin. Bu, generator'ı bitirir ve fırlatılan `StopIteration`'ın `value`
niteliğine `deger` konur. `for` döngüsü bu değeri yok sayar; asıl kullanım yeri aşağıdaki `yield from`'dur. Generator
içinde **elle** `raise StopIteration` yazma: Python 3.7'den beri bu `RuntimeError`'a dönüştürülür (PEP 479).
:::

## Generator ifadeleri ve bellek

K-09'da gördüğün `(x * x for x in kaynak)` yazımı, tek satırlık bir generator fonksiyonunun kısaltmasıdır. List
comprehension'dan farklı olarak Python 3.12+ sürümlerde de **kendi çerçevesini** açar (adı `<genexpr>`).

Tembelliğin bellek kazancını ölçelim. `sys.getsizeof` bir nesnenin **kendi** boyutunu bayt olarak verir:

:::code{lang="python" title="Liste mi, generator mı? (Python 3.14, 64-bit)"}
```python
import sys

liste = [x * x for x in range(1_000_000)]
gen = (x * x for x in range(1_000_000))

print(sys.getsizeof(liste))   # 8448728  → ~8 MB, yalnızca referans dizisi
print(sys.getsizeof(gen))     # 208      → eleman sayısından bağımsız

print(sum(gen))               # 333332833333500000
print(sum(gen))               # 0  → generator tükendi!
```
:::

Kesin sayılar Python sürümüne ve platforma göre değişir. Değişmeyen şey şudur: liste **bir milyon referansı** aynı anda
tutar (üstelik `getsizeof` içindeki int nesnelerini saymaz bile). Generator ise yalnızca o anki durumu tutar ve
boyutu eleman sayısından **bağımsızdır**. Bedeli de son satırda görülüyor: generator bir kez tüketilir ve indeksle
erişilemez (`gen[5]` yok, `len(gen)` yok).

| Liste | Generator |
|---|---|
| Bütün elemanlar hemen hesaplanır ve bellekte durur | Elemanlar istendikçe, birer birer üretilir |
| Tekrar tekrar dolaşılabilir, `len`, indeks, dilim var | Bir kez dolaşılır; `len` ve indeks yok |
| Küçük veri ve tekrar kullanım için ideal | Büyük ya da sonsuz veri, tek geçişlik işler için ideal |

## Sonsuz generator

Generator'lar yalnızca istenen kadar çalıştığı için **sonsuz** olabilir. `while True` içeren bir generator
programı kilitlemez; tüketen taraf ne zaman duracağına karar verir.

:::code{lang="python" title="Sonsuz fibonacci ve islice"}
```python
from itertools import islice

def fibonacci():
    a, b = 0, 1
    while True:            # sonsuz: ama yalnızca istenince ilerler
        yield a
        a, b = b, a + b

print(list(islice(fibonacci(), 10)))   # [0, 1, 1, 2, 3, 5, 8, 13, 21, 34]
```
:::

K-08'deki döngülü fibonacci ile karşılaştır: aynı `a, b = b, a + b` mantığı, ama artık "kaç tane?" sorusu
fonksiyonun içinde değil, **çağıranın** elinde. Sonsuz bir generator'ı `list(fibonacci())` ile somutlaştırmaya
çalışırsan bellek dolana kadar çalışır; her zaman `islice`, `break` ya da `zip` gibi bir sınırla tüket.

## Boru hattı (pipeline)

Generator'ların asıl gücü **zincirlendiklerinde** ortaya çıkar. Her aşama bir öncekinden değer ister, işler ve bir
sonrakine verir. Unix'teki `cat log | grep 500 | head` boru hattının Python karşılığıdır.

:::interactive{type="predict-run" src="boru-hatti.trace.json" title="Önce tahmin et: boru hattının çıktısı|Predict first: the pipeline's output"}
Simülasyonu izlemeden önce kodu oku: `oku:` ve `sonuç:` satırları hangi sırayla basılır, döngü ilk turda `x`e hangi değeri verir? Her soruda bir seçenek işaretle. Sorulardaki satır numaraları soldaki kod listesine göredir. "Çalıştır ve karşılaştır" ile cevapların işaretlenir, doğru ve yanlış sayısı görünür ve iz oynamaya başlar; her sorunun altındaki adım numarasına izin kaydırıcısıyla gidip değeri kendin doğrula. Puan sunucuya gönderilmez; "Yeniden dene" ile tekrar cevaplayabilirsin.
:::

:::trace{src="boru-hatti.trace.json" title="Generator boru hattı|A generator pipeline"}
Yığında ciftler, sayiya ve oku çerçevelerinin üst üste bindiğini ve çıktıda oku ile sonuç satırlarının iç içe geçtiğini izle: veri toptan değil, tek tek akıyor.
:::

Bu simülasyonda gördüklerin:

- `hat = ciftler(sayiya(oku([...])))` satırı **hiçbir satır okumadı**. Yalnızca birbirine bağlı üç generator nesnesi
  oluştu.
- `for` döngüsü en dıştaki `ciftler`'den değer istedi. `ciftler`, `sayiya`'dan istedi; o da `oku`'dan istedi. Yığında
  üç generator çerçevesi **aynı anda** göründü.
- `"1"` okundu, sayıya çevrildi, filtreye takıldı ve `ciftler` hemen bir sonrakini istedi. `"2"` boru hattının sonuna
  kadar aktı ve `"3"` okunmadan **önce** `sonuç: 2` yazdırıldı.
- Hiçbir aşama ara bir liste oluşturmadı. Kaynak 3 satır da olsa 3 milyon satır da olsa bellekte aynı anda tek bir
  eleman var.

Gerçek hayatta aynı kalıp bir log dosyasına uygulanır. K-10'da gördüğün gibi dosya nesneleri de satır satır okuyan
iterator'lardır (örnekte gerçek dosya yerine `io.StringIO` kullanıyoruz):

:::code{lang="python" title="Log dosyasından hataları süzmek"}
```python
import io

dosya = io.StringIO("200 /\n404 /yok\n200 /api\n500 /api\n")  # open("app.log") yerine

def satirlar(f):
    for satir in f:
        yield satir.rstrip("\n")

def hatalar(kaynak):
    for s in kaynak:
        kod, yol = s.split()
        if int(kod) >= 400:
            yield kod, yol

for kod, yol in hatalar(satirlar(dosya)):
    print(kod, yol)
# 404 /yok
# 500 /api
```
:::

## yield from: başka bir generator'a devretmek

Bir generator, başka bir iterable'ın bütün değerlerini olduğu gibi dışarı vermek istiyorsa `for x in alt: yield x`
yazmak yerine **`yield from alt`** yazabilir. Bu özellikle K-08'deki özyinelemeli düzleştirmeyi tembel hâle getirmek
için çok doğaldır:

:::code{lang="python" title="yield from ile özyinelemeli generator"}
```python
def duzlestir(veri):
    for oge in veri:
        if isinstance(oge, list):
            yield from duzlestir(oge)   # alt generator'ın bütün değerlerini aktar
        else:
            yield oge

print(list(duzlestir([1, [2, [3, 4]], 5])))   # [1, 2, 3, 4, 5]
```
:::

`yield from`, `for` + `yield`'den fazlasını da yapar. `send()` ile gönderilen değerleri ve istisnaları alt
generator'a iletir. Ayrıca alt generator `return deger` ile bittiğinde o değer `yield from` ifadesinin **sonucu**
olur. Bu mekanizma, K-18'de göreceğin `async`/`await`'in tarihsel temelidir.

## itertools: hazır iterator araçları

Standart kütüphanedeki `itertools` modülü, C ile yazılmış hızlı ve tembel iterator yapı taşları sunar. En sık
kullanılanlar:

:::code{lang="python" title="count, islice, chain ve groupby"}
```python
from itertools import count, islice, chain, groupby

for i in count(10, 5):            # 10, 15, 20, ... sonsuza kadar
    if i > 25:
        break
    print(i, end=" ")             # 10 15 20 25
print()

print(list(islice(count(), 3)))   # [0, 1, 2]  → herhangi bir iterator'dan ilk n tanesi
print(list(chain([1, 2], (3, 4), "ab")))   # [1, 2, 3, 4, 'a', 'b']  → kopyalamadan uç uca ekler

meyveler = ["elma", "armut", "avokado", "erik", "muz"]
for harf, grup in groupby(sorted(meyveler), key=lambda m: m[0]):
    print(harf, list(grup))
# a ['armut', 'avokado']
# e ['elma', 'erik']
# m ['muz']
```
:::

:::callout{tone="warning" title="groupby önce sıralama ister"}
`groupby`, SQL'deki `GROUP BY` gibi çalışmaz. Yalnızca **art arda gelen** aynı anahtarlı elemanları gruplar.
Sıralamadan `groupby(meyveler, key=lambda m: m[0])` yazarsan `e ['elma']`, `a ['armut', 'avokado']`, `e ['erik']`
gibi aynı harf için **iki ayrı grup** alırsın. Önce aynı `key` ile `sorted` uygula. Ayrıca her `grup` da bir
iterator'dır: bir sonraki gruba geçince öncekinin içeriği kaybolur. Saklaman gerekiyorsa hemen `list(grup)` yap.
:::

Diğer faydalı araçlar: `zip_longest` (en uzuna kadar eşleştirir), `accumulate` (birikimli toplamlar), `product` ve
`permutations` (kombinatorik), `tee` (bir iterator'ı ikiye böler, ama arada tampon bellek tutar).

## send(): generator'a değer göndermek

`yield` bir ifade olarak da kullanılabilir: `deger = yield sonuc`. Bu durumda `gen.send(x)`, generator'ı devam
ettirir ve askıdaki `yield` ifadesinin değeri `x` olur. Böylece generator, dışarıdan veri alan ve durumunu
hatırlayan bir **eşyordama (coroutine)** dönüşür.

:::code{lang="python" title="send ile hareketli ortalama"}
```python
def ortalama():
    toplam = adet = 0
    ort = None
    while True:
        deger = yield ort        # ort'u dışarı ver, gelecek değeri bekle
        toplam += deger
        adet += 1
        ort = toplam / adet

o = ortalama()
next(o)                          # ilk yield'e kadar ilerlet ("priming")
print(o.send(10), o.send(20), o.send(60))   # 10.0 15.0 30.0
```
:::

İlk `next(o)` zorunludur. Henüz bekleyen bir `yield` yokken `send` ile `None` dışında bir değer gönderirsen
`TypeError` alırsın. Günlük kodda `send`'e nadiren ihtiyaç duyarsın; modern Python'da eşyordamlar için
`async def` / `await` kullanılır (K-18).

## Ne zaman hangisi?

- Tek geçişlik, büyük ya da sonsuz veri → **generator** (fonksiyon ya da ifade).
- Durumu karmaşık, birden fazla metodu olan, tekrar başlatılabilmesi gereken bir dolaşım → **iterator sınıfı**
  (`__iter__` içinde generator döndürmek çoğu zaman en temizidir).
- Aynı veriyi birkaç kez kullanacaksın, `len` ya da indeks gerekiyor → **liste**.
- Hazır bir kalıp varsa önce **itertools**'a bak; tekerleği yeniden icat etme.

## Özet

- **Iterable** `iter()` ile iterator veren bir kaynaktır. **Iterator** ise `next()` ile sıradaki elemanı veren ve
  konumunu hatırlayan nesnedir. Bittiğinde `StopIteration` fırlatır.
- `for` döngüsü `iter()` + `while` + `next()` + `except StopIteration: break` kalıbının kısa yazımıdır.
- Iterator'lar **tek kullanımlıktır**. Tükenmiş bir iterator ikinci kez dolaşılınca hata vermez, sessizce boş döner.
- `yield` içeren fonksiyon çağrılınca gövde çalışmaz, bir generator nesnesi döner. Her `next` bir sonraki `yield`'e
  kadar çalıştırır. Çerçeve askıya alınır ve yerel değişkenleriyle birlikte kaldığı yerden devam eder.
- Generator'lar tembeldir: bellekte yalnızca o anki durumu tutar. Bu sayede büyük ve sonsuz veriyle, boru hattı
  zincirleriyle çalışabilirsin.
- `yield from` alt generator'a devreder. `itertools` (`count`, `islice`, `chain`, `groupby`) hazır tembel araçlar
  sunar; `groupby` önce sıralama ister.
- `send()` generator'a dışarıdan değer gönderir. Modern eşzamanlı kodda bunun yerini `async`/`await` aldı.

:::exercise{src="parcala.exercise.json"}
:::

:::quiz{src="quiz.json"}
:::

:::next{lesson="k-12-siniflar-ve-nesneler"}
:::

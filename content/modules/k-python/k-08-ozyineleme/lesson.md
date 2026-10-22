---
id: k-08-ozyineleme
slug: ozyineleme
module: k-python
order: 8
title:
  tr: "Özyineleme (Recursion) ve Yığın Derinliği"
  en: "Recursion and Stack Depth"
summary:
  tr: "Kendini çağıran fonksiyonların yığını nasıl büyütüp küçülttüğünü ve sınırlarını gör."
  en: "See how self-calling functions grow and shrink the stack, and where their limits are."
durationMinutes: 24
level: intermediate
tags: [python, ozyineleme, cagri-yigini, memoization, algoritma]
prerequisites: [k-07-kapsam-closure-ve-dekoratorler]
concepts: [recursion, base-case, call-stack, memoization, recursion-limit, tail-call, recursive-data]
---

## Özyineleme nedir, ne işe yarar?

**Özyineleme (recursion)**, bir fonksiyonun bir problemi çözerken **kendini daha küçük bir girdiyle çağırmasıdır**.
Kulağa döngüsel bir tanım gibi gelir: "faktöriyeli hesaplamak için faktöriyeli kullan". Ama her çağrıda problem
küçülür ve sonunda cevabı doğrudan bilinen bir noktaya varılır. Orada çağrılar durur ve cevaplar geri toplanır.

Gündelik bir benzetme: sinema salonunda kaçıncı sırada oturduğunu bilmiyorsun. Önündekine "sen kaçıncı sıradasın?"
diye sorarsın. O da önündekine sorar. En öndeki kişi "1" der, çünkü önünde kimse yoktur. Cevap geriye doğru
aktarılır: herkes duyduğu sayıya 1 ekleyip arkasındakine söyler. Kimse salonun tamamını saymak zorunda kalmaz;
herkes yalnızca bir adımlık işi yapar.

Özyineleme şu tür problemlerde kendiliğinden ortaya çıkar:

- **Kendine benzeyen veri yapıları:** klasör ağacı, iç içe listeler, JSON belgeleri, HTML DOM'u, organizasyon şeması.
- **Böl ve fethet (divide and conquer) algoritmaları:** merge sort, quicksort, ikili arama.
- **Tanımı zaten özyinelemeli olan matematik:** faktöriyel, fibonacci, üs alma.
- **Geri izleme (backtracking):** sudoku çözme, labirentte yol bulma, tüm kombinasyonları üretme.

Bu derste özyinelemenin çağrı yığınında (call stack) gerçekte ne yaptığını adım adım izleyeceksin. K-06'da gördüğün
"her çağrı yeni bir çerçeve açar" kuralı burada da aynen geçerli. Özyinelemede tek fark, açılan çerçevelerin hepsinin
**aynı fonksiyona** ait olmasıdır.

## İki parça: temel durum ve özyinelemeli durum

Doğru yazılmış her özyinelemeli fonksiyonun iki parçası vardır:

| Parça | Görevi | Faktöriyelde |
|---|---|---|
| **Temel durum (base case)** | Cevabı doğrudan bilinen en küçük girdi. Burada fonksiyon kendini **çağırmaz**. | `n <= 1` ise `1` döndür |
| **Özyinelemeli durum (recursive case)** | Problemi biraz küçültüp kendini çağırır, gelen cevabı kullanarak kendi cevabını kurar. | `n * faktoriyel(n - 1)` |

Faktöriyelin matematik tanımı da tam olarak böyledir: `n! = n × (n-1)!` ve `1! = 1`.

:::code{lang="python" title="Faktöriyel: özyinelemeli tanım"}
```python
def faktoriyel(n):
    if n <= 1:                         # temel durum
        return 1
    return n * faktoriyel(n - 1)       # özyinelemeli durum

print(faktoriyel(5))   # 120
```
:::

Özyinelemeli bir fonksiyon yazarken şu üç soruyu sor:

1. **En küçük girdi ne, cevabı ne?** (temel durum)
2. **Problemi nasıl bir adım küçültürüm?** (`n - 1`, listenin geri kalanı, alt klasör...)
3. **Küçük problemin cevabı elimdeyse büyüğünü nasıl kurarım?** (çarp, topla, birleştir)

Üçüncü soruda bir "inanç sıçraması" yaparsın: alt çağrının doğru çalıştığını varsayarsın. Temel durum doğru
ve her adım problemi gerçekten küçültüyorsa bu varsayım her zaman tutar (matematikteki tümevarımın aynısı).

Her özyinelemeli çağrının iki evresi vardır: problem temel duruma kadar küçülürken bekleyen işler birikir, temel
durumdan sonra cevaplar ters sırayla kurulur.

:::diagram{src="inis-cikis.svg" alt="faktoriyel(4) çağrısının temel duruma inişi ve 1, 2, 6, 24 değerleriyle geri çıkışı|faktoriyel(4) descending to the base case and climbing back with the values 1, 2, 6, 24"}
İnişte çarpmalar bekletilir; çıkışta her çerçeve bekleyen işini tamamlayıp kapanır.
:::

## Yığında ne oluyor? Faktöriyel simülasyonu

Şimdi `faktoriyel(4)` çağrısını izle. Her çağrı yığına yeni bir çerçeve ekler ve **her çerçevenin kendi `n`
değişkeni vardır**. Dört tane `n` aynı anda yaşar. Birbirlerini ezmezler, çünkü her biri ayrı çerçevenin yerel ismidir.

:::trace{src="faktoriyel.trace.json" title="Faktöriyel: yığının büyümesi ve küçülmesi|Factorial: the stack grows and shrinks"}
Yığının n=4, 3, 2, 1 diye dört çerçeveye çıkmasını, sonra dönüş değerleri 1, 2, 6, 24 ile tek tek küçülmesini izle.
:::

Simülasyonda iki ayrı evre gördün:

- **İniş (winding):** Her çerçeve `n * faktoriyel(n - 1)` satırında takılır. Çarpmayı yapamaz, çünkü sağ tarafın
  değeri henüz yok. Yeni bir çerçeve açılır ve yığın büyür.
- **Çıkış (unwinding):** `n=1` çerçevesi temel duruma ulaşır ve `1` döndürür. Kapanınca bekleyen `n=2` çerçevesi
  kaldığı yerden devam eder: `2 * 1 = 2`. Sonra `3 * 2 = 6`, en sonunda `4 * 6 = 24`.

Önemli nokta şu: bekleyen çerçeve **kaldığı satırı ve yerel değişkenlerini** hatırlar. Özyinelemenin "sihri" budur;
her çağrının durumu kendi çerçevesinde saklanır.

## Listelerde özyineleme: toplam ve ters çevirme

Aynı kalıp listelere ve metinlere de uyar. "Boş liste" ya da "tek karakter" temel durumdur. "İlk eleman + geri kalanı"
özyinelemeli durumdur.

:::code{lang="python" title="Liste toplamı ve metni ters çevirme"}
```python
def toplam(liste):
    if not liste:                      # boş liste: toplam 0
        return 0
    return liste[0] + toplam(liste[1:])

def ters(metin):
    if len(metin) <= 1:                # tek karakter ya da boş: zaten ters
        return metin
    return ters(metin[1:]) + metin[0]

print(toplam([3, 5, 2]))   # 10
print(ters("python"))      # nohtyp
```
:::

Bu örnekler kavramı öğretmek için harika, ama gerçek kodda `sum(liste)` ve `metin[::-1]` kullan. `liste[1:]` her
çağrıda **yeni bir liste kopyalar**. Bu yüzden bu `toplam` hem O(n²) zaman harcar hem de birkaç bin elemanda yığın
sınırına çarpar.

## Çağrı ağacı: naif fibonacci neden yavaş?

Fibonacci dizisi: `fib(0) = 0`, `fib(1) = 1`, sonrası `fib(n) = fib(n-1) + fib(n-2)`. Tanım iki tane özyinelemeli
çağrı içerir. Bu yüzden çağrılar bir zincir değil, bir **ağaç** oluşturur:

```text
                fib(4)
              /        \
         fib(3)         fib(2)
        /      \        /    \
    fib(2)   fib(1)  fib(1) fib(0)
    /    \
 fib(1) fib(0)
```

Dikkat: yığın aynı anda bu ağacın **yalnızca bir dalını** tutar. `fib(3)` bütün alt ağacıyla bitip dönmeden
`fib(2)` (sağ kol) başlamaz. Simülasyonda bir global sayaç ile kaç çağrı yapıldığını da sayıyoruz.

:::interactive{type="predict-run" src="fibonacci-agaci.trace.json" title="Önce tahmin et: kaç çağrı?|Predict first: how many calls?"}
Simülasyonu izlemeden önce kodu oku: `fib(4)` için `fib` toplam kaç kez çağrılır ve program ne yazdırır? Her soruda bir seçenek işaretle. Sorulardaki satır numaraları soldaki kod listesine göredir. "Çalıştır ve karşılaştır" ile cevapların işaretlenir, doğru ve yanlış sayısı görünür ve iz oynamaya başlar; her sorunun altındaki adım numarasına izin kaydırıcısıyla gidip değeri kendin doğrula. Puan sunucuya gönderilmez; "Yeniden dene" ile tekrar cevaplayabilirsin.
:::

:::trace{src="fibonacci-agaci.trace.json" title="Naif fibonacci: çağrı ağacı|Naive fibonacci: the call tree"}
Yığının en fazla 4 çerçeve derinliğe indiğine ama toplam 9 çağrı yapıldığına dikkat et; fib(2)'nin iki kez baştan hesaplandığını yakala.
:::

Küçük `n` için 9 çağrı masum görünür. Ama aynı alt problemler tekrar tekrar çözüldüğü için çağrı sayısı **üstel**
büyür (yaklaşık 1.6ⁿ). Ölçelim:

:::code{lang="python" title="Naif fibonacci kaç çağrı yapar?"}
```python
sayac = 0

def fib(n):
    global sayac
    sayac += 1
    return n if n < 2 else fib(n - 1) + fib(n - 2)

for n in (10, 20, 30):
    sayac = 0
    fib(n)
    print(n, sayac)
# 10 177
# 20 21891
# 30 2692537
```
:::

`n` yalnızca 10 arttı ama çağrı sayısı yaklaşık 120 katına çıktı. `fib(40)` için yüz milyonlarca çağrı gerekir ve
saniyeler sürer. Yığın derinliği sorun değildir (en fazla `n`). Sorun, **aynı işin tekrar tekrar yapılmasıdır**.

## Memoization: bir kez hesapla, hatırla

**Memoization**, bir fonksiyonun daha önce hesapladığı sonuçları bir önbellekte (cache) saklamasıdır. Aynı girdi
tekrar gelirse hesaplama yapılmaz, saklanan cevap döndürülür. Önce elle, bir sözlükle yapalım:

:::trace{src="memo.trace.json" title="Sözlükle memoization|Memoization with a dict"}
Bütün çerçevelerdeki 'bellek' isminin heap'teki TEK sözlüğü gösterdiğini ve sözlüğün 2, 3, 4, 5 anahtarlarıyla dolduğunu izle.
:::

Burada K-02'deki **nesne referansıyla aktarım** kuralını yeniden görüyorsun. Sözlük her çağrıya parametre olarak
verilir ama kopyalanmaz. Bir çerçevenin yazdığı sonucu diğer bütün çerçeveler görür. Çağrı sayısı üstelden
**doğrusala** (yaklaşık 2n) iner.

### functools.lru_cache ve cache

Bunu her seferinde elle yazmana gerek yok. Standart kütüphanedeki `functools.lru_cache` dekoratörü (K-07'de
dekoratörleri gördün) aynı işi yapar. Python 3.9+ sürümlerde sınırsız önbellek için kısa yazım `@functools.cache`
da vardır.

:::code{lang="python" title="lru_cache ile tek satırda memoization"}
```python
from functools import lru_cache

@lru_cache(maxsize=None)
def fib(n):
    return n if n < 2 else fib(n - 1) + fib(n - 2)

print(fib(80))            # 23416728348467685
print(fib.cache_info())   # CacheInfo(hits=78, misses=81, maxsize=None, currsize=81)
```
:::

`misses=81`: 0'dan 80'e kadar her `n` yalnızca bir kez gerçekten hesaplandı. `hits=78`: geri kalan istekler
önbellekten geldi. Naif hâliyle bu hesap pratikte hiç bitmezdi.

:::callout{tone="warning" title="lru_cache tuzakları"}
`lru_cache` argümanları sözlük anahtarı olarak kullanır. Bu yüzden argümanlar **hashable** olmalıdır: liste ya da
sözlük verirsen `TypeError: unhashable type: 'list'` alırsın (yerine tuple ver). Ayrıca önbellek yalnızca
**saf fonksiyonlarda** (aynı girdiye hep aynı çıktıyı veren, dışarıyı değiştirmeyen) güvenlidir. Dosya okuyan ya da
saate bakan bir fonksiyonu önbelleğe alırsan eski sonucu döndürür. `maxsize=None` önbelleği sınırsız büyütür; uzun
yaşayan süreçlerde bir sınır ver.
:::

Naif fibonacci ile memoization'lı sürümü yan yana görmek farkı netleştirir. Animasyon önce çağrı ağacının derinlik
öncelikli açılıp kapanmasını, sonra aynı ağacın sözlükle budanmasını gösteriyor.

:::animation{scene="fib-cagri-agaci.scene.json"}
Sayaçtaki çağrı sayısını ve sağdaki `fib(2)` düğümünü izle: naif sürümde alt ağaç ikinci kez açılır, memo sürümünde sözlükten tek adımda gelir.
:::

## Yığının sınırı: RecursionError

Her çerçeve bellek tüketir. Python sonsuz özyinelemenin süreci çökertmesini önlemek için bir **özyineleme sınırı
(recursion limit)** uygular. Sınır aşılınca `RecursionError` fırlatılır. CPython'da varsayılan değer 1000'dir.

:::code{lang="python" title="Sınırı görmek ve aşmak"}
```python
import sys

print(sys.getrecursionlimit())   # 1000 (CPython varsayılanı)

def geri_say(n):
    if n == 0:
        return "bitti"
    return geri_say(n - 1)

try:
    geri_say(5000)
except RecursionError as hata:
    print("RecursionError:", hata)
# RecursionError: maximum recursion depth exceeded

sys.setrecursionlimit(10000)     # dikkatli kullan!
print(geri_say(5000))            # bitti
```
:::

`RecursionError` alıyorsan iki olasılık vardır:

1. **Temel durum eksik ya da hiç ulaşılmıyor.** Örneğin `faktoriyel(-1)`, `n <= 1` yerine `n == 1` yazılmışsa
   sonsuza kadar iner. Bu bir hatadır; sınırı artırmak işe yaramaz.
2. **Girdi gerçekten çok derin.** Örneğin 10.000 elemanlı bir bağlı liste. Burada çözüm genellikle algoritmayı
   döngüye çevirmektir.

:::callout{tone="danger" title="setrecursionlimit bir çözüm değil, erteleme"}
`sys.setrecursionlimit` yalnızca Python'un kendi sayacını yükseltir. Sınırı çok büyük yaparsan Python'un hata
fırlatabileceği noktayı geçip işletim sisteminin gerçek yığın belleğini tüketebilirsin. Bu durumda program
`RecursionError` yerine **segmentation fault** ile hiçbir iz bırakmadan çökebilir. Python 3.12'den beri CPython,
Python çağrılarını C yığınından büyük ölçüde ayırdı ve bu risk azaldı. Yine de derinliği girdiye bağlı kodda sınırı
yükseltmek yerine döngüye geçmek daha güvenlidir.
:::

## Python'da kuyruk özyineleme optimizasyonu yok

Bazı dillerde (Scheme, bazı derleyicilerle C, Scala'da `@tailrec`) **kuyruk çağrısı (tail call)** optimize edilir.
Fonksiyonun son işi kendini çağırmak ise yeni çerçeve açılmaz, mevcut çerçeve yeniden kullanılır. Bu sayede
özyineleme bir döngü kadar az bellek tüketir.

:::code{lang="python" title="Kuyruk özyinelemeli yazım Python'da yine de derinleşir"}
```python
def topla(n, biriken=0):
    if n == 0:
        return biriken
    return topla(n - 1, biriken + n)   # son iş: kendini çağırmak (kuyruk çağrısı)

print(topla(100))     # 5050
topla(5000)           # RecursionError: maximum recursion depth exceeded
```
:::

CPython bu optimizasyonu **yapmaz**. Bu bilinçli bir tasarım kararıdır. Guido van Rossum'un gerekçesi, her çağrının
hata izinde (traceback) görünmesinin hata ayıklamada değerli olmasıdır. Kısacası Python'da kuyruk özyinelemeli yazmak
yığın derinliği açısından hiçbir şey kazandırmaz.

## Özyinelemeden döngüye

Her özyinelemeli fonksiyon bir döngüye çevrilebilir. Doğrusal olanlar (faktöriyel, toplam, fibonacci) basit bir
döngüyle yazılır. Ağaç benzeri olanlar için yığını **kendin**, bir liste olarak tutarsın. Python'un çağrı yığını
yerine heap'teki bir liste kullanılır ve onun 1000 sınırı yoktur.

:::code{lang="python" title="Aynı işler, döngüyle"}
```python
def faktoriyel_dongu(n):
    sonuc = 1
    for i in range(2, n + 1):
        sonuc *= i
    return sonuc

def fib_dongu(n):
    a, b = 0, 1
    for _ in range(n):
        a, b = b, a + b
    return a

def duzlestir_dongu(veri):
    sonuc = []
    yigin = list(reversed(veri))        # kendi yığınımız
    while yigin:
        oge = yigin.pop()
        if isinstance(oge, list):
            yigin.extend(reversed(oge)) # alt listeyi yığına aç
        else:
            sonuc.append(oge)
    return sonuc

print(faktoriyel_dongu(5))                    # 120
print(fib_dongu(80))                          # 23416728348467685
print(duzlestir_dongu([1, [2, [3, 4]], 5]))   # [1, 2, 3, 4, 5]
```
:::

Hangisini seçmelisin? Kural basit: **okunabilirlik önce gelir.** Derinlik küçük ve sınırlıysa (bir JSON yapılandırma
dosyası, birkaç seviyelik klasör ağacı, dengeli bir ikili ağaç) özyineleme genellikle daha kısa ve anlaşılırdır.
Derinlik kullanıcı verisine bağlı olarak binlere çıkabiliyorsa döngü güvenlidir.

## İç içe yapılarda özyinelemenin doğallığı

Özyineleme en çok, **verinin kendisi özyinelemeli** olduğunda parlar. Bir liste, eleman olarak başka listeler
içerebilir. Bir klasör başka klasörler içerebilir. Kaç seviye olduğunu önceden bilmezsin, bu yüzden iç içe `for`
döngüleriyle yazamazsın. Ama "elemanı listeyse, aynı fonksiyonla onu da düzleştir" demek yeterlidir:

:::trace{src="duzlestir.trace.json" title="İç içe listeyi düzleştirme|Flattening a nested list"}
Her çerçevenin kendi 'sonuc' listesini oluşturduğunu, alt çağrının döndürdüğü listenin üst çerçevede extend ile eklendiğini izle.
:::

Simülasyonda yığının derinliği, **verinin iç içelik derinliğini** takip etti: `[3, 4]` listesine ulaşınca üç
`duzlestir` çerçevesi vardı. Aynı fikirle bir klasör ağacını gezebilirsin:

:::code{lang="python" title="Klasör ağacını girintili yazdırma"}
```python
klasor = {
    "ad": "proje",
    "alt": [
        {"ad": "src", "alt": [{"ad": "main.py", "alt": []}, {"ad": "util.py", "alt": []}]},
        {"ad": "README.md", "alt": []},
    ],
}

def yazdir(dugum, girinti=0):
    print("  " * girinti + dugum["ad"])
    for cocuk in dugum["alt"]:          # temel durum örtük: 'alt' boşsa döngü hiç dönmez
        yazdir(cocuk, girinti + 1)

yazdir(klasor)
# proje
#   src
#     main.py
#     util.py
#   README.md
```
:::

Burada açık bir `if` temel durumu yok. Alt öğesi olmayan bir düğümde `for` döngüsü hiç çalışmaz ve fonksiyon
kendiliğinden döner. Gerçek dosya sisteminde aynı işi `os.walk` ya da `pathlib.Path.rglob` yapar. Bunlar da
kavramsal olarak aynı ağaç gezintisidir.

:::callout{tone="tip" title="Özyinelemeli fonksiyonu nasıl test edersin?"}
Önce temel durumu test et (`faktoriyel(1)`, boş liste, yaprak düğüm). Sonra bir üst seviyeyi (`faktoriyel(2)`, tek
seviye iç içe liste). Bu ikisi doğruysa tümevarım gereği gerisi de doğrudur. Hata ayıklarken fonksiyonun başına
`print("  " * derinlik, girdi)` gibi girintili bir satır eklemek çağrı ağacını gözle görmeni sağlar.
:::

## Sık yapılan hatalar

- **Temel durumu unutmak** ya da girdiyi küçültmemek (`f(n)` içinde yine `f(n)` çağırmak) → `RecursionError`.
- **Alt çağrının sonucunu döndürmeyi unutmak:** `return` yerine sadece `duzlestir(oge)` yazmak. Hesap yapılır ama
  sonuç kaybolur ve fonksiyon `None` döndürür.
- **Değiştirilebilir varsayılan argümanla biriktirmek:** `def f(x, sonuc=[])` tüm çağrılar arasında aynı listeyi
  paylaşır (K-06). Her çağrıda yeni liste oluştur ya da dönüş değerlerini birleştir.
- **Pahalı dilimleme:** `liste[1:]` her seviyede kopya üretir. Büyük veride bir indeks parametresi (`i + 1`) geçir.

:::realworld{company="Microsoft"}
Python'un özyinelemeye yaklaşımı, dili geliştirenlerin kamuya açık tartışmalarında açıkça gerekçelendirilmiştir.
Guido van Rossum 2009'da kişisel blogunda yayımladığı "Tail Recursion Elimination" yazılarında kuyruk çağrısı
optimizasyonunu bilerek eklemediğini anlattı: optimizasyon, hata anında traceback'ten çerçeveleri sileceği için
hata ayıklamayı zorlaştırır ve Python'da döngü yazmak zaten doğal bir alternatiftir.

Yıllar sonra Microsoft'un desteklediği **Faster CPython** projesi (Guido van Rossum ve Mark Shannon'ın da içinde
olduğu ekip) yığının nasıl kullanıldığını değiştirdi. Python 3.11'in "What's New" belgesine göre bir Python
fonksiyonu başka bir Python fonksiyonunu çağırdığında yorumlayıcı artık C düzeyinde yeni bir çağrı açmıyor, yeni
çerçeveyi kurup doğrudan ona "atlıyor". Böylece çoğu Python çağrısı C yığınını tüketmiyor ve faktöriyel ya da
fibonacci gibi basit özyinelemeli fonksiyonlar belirgin biçimde hızlandı. Python 3.12'de ise `sys.setrecursionlimit`
sınırı yalnızca Python koduna uygulanır hâle geldi; C yığını ayrı bir mekanizmayla korunuyor.

Bu derse bağlanan sonuç: çerçeveler artık daha ucuz, ama sınır ve kuyruk çağrısı politikası değişmedi. Derinliği
girdiye bağlı olan özyinelemeyi (uzun bağlı liste, çok derin JSON) yine döngüye ya da açık bir yığına çevirmen gerekir.
:::

## Özet

- Özyineleme, problemi küçültüp fonksiyonun kendini çağırmasıdır. Her zaman bir **temel durum** ve problemi küçülten
  bir **özyinelemeli durum** gerekir.
- Her çağrı yığına **ayrı bir çerçeve** ekler. Her çerçevenin kendi yerel değişkenleri vardır (dört ayrı `n`).
  Dönüş değerleri yığın küçülürken geri toplanır.
- Naif fibonacci aynı alt problemleri tekrar çözdüğü için **üstel** sayıda çağrı yapar. Memoization (sözlük ya da
  `functools.lru_cache`) bunu doğrusala indirir.
- CPython'da varsayılan özyineleme sınırı 1000'dir (`sys.getrecursionlimit()`). Aşılınca `RecursionError` fırlatılır.
  Sınırı yükseltmek kalıcı çözüm değildir.
- Python kuyruk çağrısını optimize etmez. Derin özyinelemeyi döngüye ya da elle yönetilen bir yığına çevir.
- İç içe listeler, klasör ağaçları ve JSON gibi **özyinelemeli verilerde** özyineleme en doğal ve okunur çözümdür.

:::quiz{src="quiz.json"}
:::

:::next{lesson="k-09-comprehension-ve-fonksiyonel-araclar"}
:::

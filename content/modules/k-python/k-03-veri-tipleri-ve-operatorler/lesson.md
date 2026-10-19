---
id: k-03-veri-tipleri-ve-operatorler
slug: veri-tipleri-ve-operatorler
module: k-python
order: 3
title:
  tr: "Temel Veri Tipleri ve Operatörler"
  en: "Core Data Types and Operators"
summary:
  tr: "int, float, str, bool ve None ile çalış; operatörleri, dönüşümleri ve string işlemlerini öğren."
  en: "Work with int, float, str, bool and None; learn operators, conversions and string operations."
durationMinutes: 22
level: beginner
tags: [python, veri-tipleri, operatorler, string, tip-donusumu]
prerequisites: [k-02-degiskenler-ve-bellek-modeli]
concepts: [numeric-types, floating-point, string-immutability, slicing, short-circuit-evaluation, truthiness, operator-precedence, type-conversion]
---

## Neden veri tipleri?

Önceki derste her değerin heap'te yaşayan bir **nesne** olduğunu ve her nesnenin bir **tipi** (type) olduğunu
gördün. Tip, nesnenin **ne olduğunu** ve onunla **neler yapılabileceğini** belirler: iki sayıyı toplayabilirsin,
bir metni büyük harfe çevirebilirsin, ama bir metni sayıya bölemezsin. Bu derste her gün kullanacağın temel
tiplerle ve onları birleştiren operatörlerle tanışacaksın.

| Tip | Örnek değer | Değiştirilebilir mi? | Ne için? |
|---|---|---|---|
| `int` | `42`, `-7`, `10**30` | Hayır | Tam sayılar, sayaçlar, indeksler |
| `float` | `3.14`, `1e-3`, `0.1` | Hayır | Ondalıklı ölçümler, oranlar |
| `bool` | `True`, `False` | Hayır | Mantıksal sonuçlar, bayraklar |
| `str` | `"Ada"`, `'çay'` | Hayır | Metin |
| `NoneType` | `None` | Hayır | "Değer yok" bilgisi |

Bir nesnenin tipini `type()` ile, belirli bir tipten olup olmadığını `isinstance()` ile sorarsın:
`type(3.0)` → `<class 'float'>`, `isinstance(True, int)` → `True` (nedenini birazdan göreceksin).

## Sayılar: int ve float

### int: sınırsız hassasiyet

Birçok dilde tam sayılar 32 ya da 64 bitle sınırlıdır ve sınırı aşınca "taşma" (overflow) olur. Python'un
`int` tipi **keyfi büyüklükte** (arbitrary precision) sayıları tutar; sınır yalnızca bellektir:

:::code{lang="python" title="Büyük tam sayılar"}
```python
print(2 ** 100)          # 1267650600228229401496703205376
nufus = 8_100_000_000    # alt çizgi okunurluk içindir, değeri etkilemez
print(nufus * 1000)      # 8100000000000
print(0b101, 0x1A)       # 5 26  → ikilik ve onaltılık yazım
```
:::

### float: IEEE 754 ve 0.1 + 0.2

`float`, bilgisayar donanımının kullandığı **IEEE 754 çift duyarlıklı** (64 bit) kayan noktalı sayı biçimidir.
Bu biçim sayıları **ikilik tabanda** saklar. Onluk tabanda masum görünen `0.1`, ikilik tabanda tıpkı 1/3'ün
onluk tabanda 0.3333... olması gibi **sonsuz** bir kesirdir ve en yakın temsil edilebilir değere yuvarlanır.
Sonuç:

:::code{lang="python" title="Kayan nokta yuvarlama hataları"}
```python
print(0.1 + 0.2)               # 0.30000000000000004
print(0.1 + 0.2 == 0.3)        # False

import math
print(math.isclose(0.1 + 0.2, 0.3))   # True
print(round(0.1 + 0.2, 2))            # 0.3
print(round(2.5), round(3.5))         # 2 4  → "bankacı yuvarlaması"
```
:::

Bu Python'a özgü bir hata değildir; JavaScript, Java ve C'de de aynı sonucu alırsın. `round()` .5 durumunda
**çift sayıya** yuvarlar (round half to even); bu yüzden `round(2.5)` 2'dir.

:::callout{tone="warning" title="float'ları == ile karşılaştırma"}
Hesaplanmış iki `float` değeri `==` ile karşılaştırmak, yukarıdaki gibi küçük yuvarlama farkları yüzünden
beklenmedik `False` sonuçlar verir. Bunun yerine `math.isclose(a, b)` kullan. Para gibi kesin ondalık gereken
hesaplarda `float` yerine `decimal.Decimal("0.1")` kullan (metinden oluşturulduğuna dikkat et:
`Decimal("0.1") + Decimal("0.2")` → `Decimal('0.3')`) ya da tutarları kuruş cinsinden `int` olarak sakla.
:::

### bool: aslında bir int

`bool` tipinin yalnızca iki değeri vardır: `True` ve `False`. Tarihsel nedenlerle `bool`, `int`'in bir
**alt sınıfıdır** (subclass): `True` 1 gibi, `False` 0 gibi davranır.

:::code{lang="python" title="bool bir int alt sınıfıdır"}
```python
print(isinstance(True, int))   # True
print(True + True)             # 2
notlar = [80, 45, 90, 30]
print(sum(n >= 50 for n in notlar))   # 2  → kaç kişi geçti? True'lar 1 sayılır
```
:::

Son satırdaki sayma hilesi sık kullanılır; ama `True + True` gibi ifadeleri günlük kodda yazmaktan kaçın,
okuyanı şaşırtır.

### None: "değer yok"

`None`, `NoneType` tipinin tek nesnesidir ve "burada bir değer yok" anlamına gelir: henüz hesaplanmamış bir
sonuç, bulunamayan bir kayıt, bir şey döndürmeyen fonksiyonun dönüş değeri. `None` tekil (singleton) olduğu
için karşılaştırmada `==` değil `is` kullanılır: `if sonuc is None:`. `None`, `False` ya da `0` ile aynı şey
değildir: `None == False` → `False`.

## Metinler: str

### Unicode, indeksleme ve dilimleme

Python 3'te `str`, **Unicode** karakterlerden oluşan bir dizidir; Türkçe karakterler, emojiler ve Çince sorunsuz
çalışır. `len("çay")` 3'tür. Metin tek (`'...'`) ya da çift (`"..."`) tırnakla yazılabilir; çok satırlı metin
için üç tırnak (`"""..."""`) kullanılır.

Her karakterin bir **indeksi** (sırası) vardır. İndeks 0'dan başlar; **negatif indeks** sondan sayar.
**Dilimleme** (slicing) `metin[başla:bitir:adım]` biçimindedir ve `bitir` **dahil değildir**:

:::code{lang="python" title="İndeks ve dilim"}
```python
s = "Python"
#    P  y  t  h  o  n
#    0  1  2  3  4  5
#   -6 -5 -4 -3 -2 -1
print(s[0], s[-1])     # P n
print(s[1:4])          # yth  → 1, 2, 3 (4 dahil değil)
print(s[:3], s[-3:])   # Pyt hon
print(s[::-1])         # nohtyP → adım -1: ters çevir
print(s[2:100])        # thon  → dilimde taşan sınır hata vermez
# s[10]                # IndexError: string index out of range
```
:::

### Değiştirilemezlik: her işlem yeni nesne

`str` değiştirilemez (immutable) bir tiptir: `s[0] = "J"` yazarsan `TypeError: 'str' object does not support
item assignment` alırsın. `upper()`, `strip()`, `replace()` gibi metotlar mevcut metni **değiştirmez**, yeni bir
metin **döndürür**. Sonucu bir isme bağlamazsan kaybolur. Aşağıdaki simülasyonda metinler de heap'te ayrı
nesneler olarak gösteriliyor.

:::trace{src="string-yeni-nesne.trace.json" title="String işlemleri yeni nesne üretir|String operations create new objects"}
Her metot çağrısında heap'e yeni bir kutu eklendiğine, `temiz` yeniden bağlanınca eski metnin etiketsiz kalıp kaybolduğuna dikkat et.
:::

:::callout{tone="danger" title="Sonucu atamayı unutma"}
`isim.strip()` tek başına bir satır olarak yazılırsa hiçbir işe yaramaz: yeni metin üretilir ve hemen atılır,
`isim` aynı kalır. Doğrusu `isim = isim.strip()`. Bu, Python'a yeni başlayanların en sık yaptığı hatalardan biridir.
Listelerde ise tersi geçerlidir: `liste.sort()` yerinde değiştirir ve `None` döndürür (K-05).
:::

### Sık kullanılan string metotları

| Metot | Ne yapar? | Örnek → sonuç |
|---|---|---|
| `upper()` / `lower()` | Büyük / küçük harf | `"Ada".upper()` → `'ADA'` |
| `strip()` | Baştaki ve sondaki boşlukları atar | `"  Ada  ".strip()` → `'Ada'` |
| `split(ayirici)` | Parçalara bölüp liste döndürür | `"a,b,c".split(",")` → `['a', 'b', 'c']` |
| `ayirici.join(liste)` | Listeyi tek metinde birleştirir | `"-".join(["x", "y"])` → `'x-y'` |
| `replace(eski, yeni)` | Tüm geçişleri değiştirir | `"kedi".replace("k", "t")` → `'tedi'` |
| `find(alt)` | İlk geçişin indeksi, yoksa -1 | `"merhaba".find("h")` → `3` |
| `startswith` / `endswith` | Başlangıç / bitiş kontrolü | `"rapor.pdf".endswith(".pdf")` → `True` |
| `in` operatörü | İçeriyor mu? | `"ha" in "merhaba"` → `True` |

`join`'in ayırıcının metodu olduğuna dikkat et: `"-".join(parcalar)`. Büyük metinleri döngüde `+` ile
birleştirmek yerine parçaları listede toplayıp en sonda bir kez `join` etmek hem okunur hem verimlidir.

:::callout{tone="info" title="Türkçe büyük/küçük harf"}
`upper()` ve `lower()` Unicode kurallarını kullanır, Türkçe yerel ayarını değil: `"i".upper()` → `'I'` olur,
`'İ'` değil. Türkçe metinlerde doğru dönüşüm gerekiyorsa `i`/`İ` ve `ı`/`I` harflerini önce elle değiştirmen
ya da bir yerelleştirme kütüphanesi kullanman gerekir.
:::

### f-string biçimlendirme

f-string'de süslü parantezin içine `:` koyup **biçim belirteci** (format specifier) yazabilirsin:

:::code{lang="python" title="Biçim belirteçleri"}
```python
ad = "Ada"
fiyat = 1234.5678
print(f"{fiyat:.2f}")      # 1234.57     → 2 ondalık
print(f"{fiyat:,.2f}")     # 1,234.57    → binlik ayırıcı
print(f"[{ad:>6}]")        # [   Ada]    → 6 karakter, sağa yasla
print(f"[{ad:<6}]")        # [Ada   ]    → sola yasla
print(f"{42:05d}")         # 00042       → sıfırla doldur
print(f"{0.256:.1%}")      # 25.6%       → yüzde
print(f"{fiyat=}")         # fiyat=1234.5678 (Python 3.8+)
```
:::

## Operatörler

### Aritmetik operatörler

| Operatör | Anlamı | Örnek → sonuç |
|---|---|---|
| `+` `-` `*` | Toplama, çıkarma, çarpma | `2 + 3 * 4` → `14` |
| `/` | Bölme, **her zaman float** | `10 / 5` → `2.0` |
| `//` | Tam bölme (aşağı yuvarlar) | `7 // 2` → `3` |
| `%` | Mod (kalan) | `7 % 2` → `1` |
| `**` | Üs alma | `2 ** 10` → `1024` |

`//` sonucu **aşağıya** (eksi sonsuza doğru) yuvarlar, sıfıra doğru değil. Bu yüzden negatif sayılarda
sonuçlar bazı dillerden farklıdır. Python'da `%` sonucu her zaman **bölenle aynı işaretlidir** ve şu eşitlik
hep doğrudur: `(a // b) * b + (a % b) == a`.

:::code{lang="python" title="Negatif sayılarda // ve %"}
```python
print(7 // 2, 7 % 2)      # 3 1
print(-7 // 2, -7 % 2)    # -4 1   → -3.5 aşağı yuvarlanır: -4
print(7 // -2, 7 % -2)    # -4 -1
print(int(-7 / 2))        # -3     → int() ise sıfıra doğru keser
print(-2 ** 2)            # -4     → ** önce: -(2 ** 2)
print((-2) ** 2)          # 4
```
:::

### Karşılaştırma ve zincirleme

`==`, `!=`, `<`, `<=`, `>`, `>=` her zaman `bool` döndürür. Python, matematikteki gibi **zincirleme
karşılaştırmaya** izin verir: `1 < x < 5` ifadesi `1 < x and x < 5` demektir (ama `x` yalnızca bir kez
hesaplanır). `is` / `is not` kimlik, `in` / `not in` üyelik sorar.

### Mantıksal operatörler ve kısa devre

`and`, `or` ve `not` mantıksal operatörlerdir. İlk ikisi hakkında iki önemli gerçek vardır:

1. **Kısa devre (short-circuit):** Sonuç sol taraftan belli olursa sağ taraf **hiç hesaplanmaz**. `and`'de sol
   taraf yanlışsa, `or`'da sol taraf doğruysa sağ tarafa bakılmaz.
2. **Operandın kendisini döndürürler**, `True`/`False`'u değil: `x and y` → `x` yanlışsa `x`, değilse `y`;
   `x or y` → `x` doğruysa `x`, değilse `y`. `not` ise her zaman `bool` döndürür.

Aşağıdaki simülasyonda `sol` ve `sag` fonksiyonları çağrıldıklarında ekrana yazar. Hangi fonksiyonun çağrı
yığınında hiç çerçeve açmadığına bak.

:::trace{src="kisa-devre.trace.json" title="and/or kısa devresi|and/or short-circuit"}
`a` ve `c` satırlarında `sag` çerçevesinin hiç açılmadığına, `b` ve `d` satırlarında ise açıldığına dikkat et; sonuçların operandların kendisi olduğuna bak.
:::

:::code{lang="python" title="Kısa devrenin pratik kullanımları"}
```python
print(0 or "varsayılan")   # varsayılan
print("" and "x")          # (boş metin)
print(3 and 4)             # 4
print(not 0, not "a")      # True False

isim = ""
gosterilecek = isim or "Misafir"           # boşsa varsayılan değer
liste = []
if liste and liste[0] > 10:                # liste boşsa liste[0] hiç çalışmaz
    print("büyük")
```
:::

:::callout{tone="warning" title="or ile varsayılan değer tuzağı"}
`adet = girilen or 10` deseni, `girilen` **geçerli ama falsy** bir değer olduğunda (ör. `0`) da 10'a döner.
Yalnızca `None` durumunda varsayılan istiyorsan açık yaz: `adet = 10 if girilen is None else girilen`.
:::

### Truthiness: hangi değerler "yanlış" sayılır?

`if` ve `while` koşulları ile `and`/`or` her nesneyi bir **doğruluk değerine** (truthiness) çevirir. Kural
basittir: **boş ya da sıfır olan her şey yanlış (falsy), geri kalan her şey doğrudur (truthy).**

| Falsy (yanlış sayılır) | Truthy örnekleri |
|---|---|
| `False`, `None` | `True` |
| `0`, `0.0` | `1`, `-3`, `0.1` |
| `""` (boş metin) | `" "` (boşluk), `"0"`, `"False"` |
| `[]`, `()`, `{}`, `set()` | `[0]`, `[None]`, `{"a": 1}` |

Bu yüzden Python'da `if len(liste) > 0:` yerine kısaca `if liste:` yazılır.

### Operatör önceliği

Bir ifadede birden çok operatör varsa, yukarıdakiler önce uygulanır (en yüksekten en düşüğe, kısaltılmış):

| Öncelik | Operatörler |
|---|---|
| 1 (en yüksek) | `()` parantez, çağrı, indeks |
| 2 | `**` (sağdan sola: `2 ** 3 ** 2` → `512`) |
| 3 | `-x`, `+x` (tekli işaret) |
| 4 | `*`, `/`, `//`, `%` |
| 5 | `+`, `-` |
| 6 | `==`, `!=`, `<`, `>`, `<=`, `>=`, `is`, `in` |
| 7 | `not` |
| 8 | `and` |
| 9 (en düşük) | `or` |

Emin olmadığın her yerde parantez kullan: `(a and b) or c` hem doğru hem okunur.

## Tip dönüşümleri

Python **güçlü tiplidir**: `"3" + 4` gibi karışık işlemleri kendiliğinden dönüştürmez, `TypeError` verir. Dönüşümü
sen açıkça yaparsın. Tipin adı aynı zamanda dönüştürücü fonksiyondur:

| Çağrı | Sonuç | Not |
|---|---|---|
| `int("42")` | `42` | Boşluklar tolere edilir: `int(" 7 ")` → `7` |
| `int(3.9)` | `3` | Sıfıra doğru keser, yuvarlamaz |
| `int("3.5")` | `ValueError` | Metin bir tam sayı olmalı |
| `int("101", 2)` | `5` | İkinci argüman taban |
| `float("3.5")` | `3.5` | |
| `str(3.0)` | `'3.0'` | Her nesne metne çevrilebilir |
| `bool("0")` | `True` | Boş olmayan her metin truthy |

:::trace{src="tip-donusumu.trace.json" title="Tip dönüşümü ve ValueError|Type conversion and ValueError"}
Değişken tablosunda dönüşümlerin sonuçlarını izle; son adımda `int` fonksiyonunun ondalıklı bir metni reddettiğini gör.
:::

Ondalıklı bir metni tam sayıya çevirmek istiyorsan iki adımda yap: `int(float("3.5"))` → `3`. Kullanıcı
girdisini dönüştürürken `ValueError`'u `try/except` ile yakalamayı istisnalar dersinde göreceksin.

## Gerçek hayattan: fiyat etiketi

Öğrendiklerini birleştiren küçük bir örnek: bir formdan gelen metinleri temizle, dönüştür, hesapla ve
biçimlendir.

:::code{lang="python" title="Formdan gelen veriyi işlemek"}
```python
ham_urun = "  kablosuz kulaklık "
ham_fiyat = "1499.90"
ham_adet = "2"
kupon = ""

urun = ham_urun.strip().title()
fiyat = float(ham_fiyat)
adet = int(ham_adet)
kupon_kodu = kupon or "YOK"
toplam = fiyat * adet
indirimli = toplam * 0.9 if kupon else toplam

print(f"{urun} x{adet} | kupon: {kupon_kodu} | {indirimli:,.2f} TL")
# Kablosuz Kulaklık x2 | kupon: YOK | 2,999.80 TL
```
:::

## Özet

- `int` sınırsız büyüklükte tam sayıdır; `float` IEEE 754 ikilik kesirdir, bu yüzden `0.1 + 0.2 != 0.3`;
  karşılaştırmada `math.isclose`, kesin ondalıkta `Decimal` kullan.
- `bool`, `int`'in alt sınıfıdır; `None` "değer yok" demektir ve `is None` ile kontrol edilir.
- `str` Unicode ve değiştirilemezdir: indeks, negatif indeks ve dilim okur; her metot **yeni** metin döndürür,
  sonucu bir isme bağlamayı unutma.
- `/` her zaman float verir; `//` aşağı yuvarlar, `%` bölenin işaretini alır; `**` sağdan sola ve tekli
  eksiden önce uygulanır.
- `and`/`or` kısa devre yapar ve operandın kendisini döndürür; boş ve sıfır değerler falsy'dir.
- Dönüşümler açıktır: `int()`, `float()`, `str()`, `bool()`; `int("3.5")` `ValueError` verir.

:::quiz{src="quiz.json"}
:::

:::next{lesson="k-04-kosullar-ve-donguler"}
:::

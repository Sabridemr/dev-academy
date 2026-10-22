---
id: k-04-kosullar-ve-donguler
slug: kosullar-ve-donguler
module: k-python
order: 4
title:
  tr: "Kontrol Akışı: Koşullar ve Döngüler"
  en: "Control Flow: Conditions and Loops"
summary:
  tr: "if/elif/else, while, for ve range ile programın akışını adım adım yönetmeyi öğren."
  en: "Learn to steer a program step by step with if/elif/else, while, for and range."
durationMinutes: 21
level: beginner
tags: [python, kontrol-akisi, kosullar, donguler, match-case]
prerequisites: [k-03-veri-tipleri-ve-operatorler]
concepts: [conditional-statements, pattern-matching, while-loop, for-loop, range, break-continue, loop-else, nested-loops]
---

## Kontrol akışı nedir?

İlk derste programın **yukarıdan aşağı, satır satır** çalıştığını gördün. Gerçek programlar ise karar verir
("kullanıcı giriş yaptıysa panoyu göster") ve tekrar eder ("sepetteki her ürün için fiyatı topla"). Satırların
hangi sırayla ve kaç kez çalışacağını belirleyen yapılara **kontrol akışı** (control flow) denir. Python'da iki
temel araç vardır:

- **Koşullar** (`if`, `elif`, `else`, `match`): bir bloğu çalıştır ya da atla.
- **Döngüler** (`while`, `for`): bir bloğu tekrar tekrar çalıştır.

Bu derste her ikisini de simülasyonlarla, yeşil okun koddaki satırlar arasında nasıl **zıpladığını** izleyerek
öğreneceksin.

:::diagram{src="kontrol-akisi.svg" alt="Kontrol akışı: if, elif, else zincirinde ilk doğru koşulun bloğunun çalışması ve while döngüsünde koşul, gövde, continue ve break yolları|Control flow: the first true condition's block running in an if, elif, else chain, and the condition, body, continue and break paths of a while loop"}
Koşullar akışı dallandırır, döngüler aynı bloğa geri döndürür. `continue` koşula, `break` döngünün dışına gider.
:::

## if, elif, else

`if` bir koşulu değerlendirir; koşul truthy ise girintili bloğu çalıştırır. `elif` ("else if") önceki koşullar
yanlışsa denenecek yeni bir koşul ekler; `else` hiçbiri tutmazsa çalışır. Python koşulları **yukarıdan aşağı**
dener ve **ilk doğru olan** bloğu çalıştırıp zincirden çıkar.

:::code{lang="python" title="Not harfi hesaplama"}
```python
def harf_notu(puan):
    if puan >= 90:
        return "AA"
    elif puan >= 75:
        return "BA"
    elif puan >= 50:
        return "CC"
    else:
        return "FF"

print(harf_notu(95), harf_notu(80), harf_notu(50), harf_notu(12))
# AA BA CC FF
```
:::

80 puan hem `>= 75` hem `>= 50` koşulunu sağlar, ama yalnızca ilk eşleşen (`BA`) çalışır. Bu yüzden koşulların
**sırası** önemlidir: en dar koşulu en üste yaz. `if puan >= 50` en üstte olsaydı 95 puan da `CC` alırdı.

### İç içe koşullar ve sadeleştirme

Bir koşulun içinde başka bir koşul olabilir. Ama derin iç içe yapılar okunması zor "ok ucu" kodlara dönüşür.
Çoğu zaman `and` ile birleştirmek ya da **erken dönüş** (early return) kullanmak daha temizdir:

:::code{lang="python" title="İç içe if yerine erken dönüş"}
```python
# İç içe: okunması zor
def indirim(uye_mi, tutar):
    if uye_mi:
        if tutar >= 500:
            return 0.15
        else:
            return 0.05
    else:
        return 0.0

# Erken dönüş: düz ve okunur
def indirim2(uye_mi, tutar):
    if not uye_mi:
        return 0.0
    if tutar >= 500:
        return 0.15
    return 0.05

print(indirim(True, 600), indirim2(True, 600), indirim2(False, 600))
# 0.15 0.15 0.0
```
:::

### Koşullu ifade: x if c else y

İki değerden birini seçip bir isme bağlayacaksan, dört satırlık `if/else` yerine **koşullu ifade**
(conditional expression, "üçlü operatör") kullanabilirsin: `durum = "reşit" if yas >= 18 else "çocuk"`.
Okunuşu: "yaş 18 ve üstüyse `reşit`, değilse `çocuk`". Yalnızca basit seçimlerde kullan; iç içe koşullu
ifadeler hızla okunmaz hale gelir.

:::callout{tone="warning" title="= ile == karışıklığı ve gereksiz karşılaştırma"}
`if x = 5:` yazmak `SyntaxError` verir; karşılaştırma `==` ile yapılır. Bir de `if aktif == True:` gibi
yazımlardan kaçın: `if aktif:` yeterlidir. Boş liste kontrolü için de `if len(liste) == 0:` yerine
`if not liste:` yaz. `None` kontrolü ise her zaman `if deger is None:` olmalı, çünkü `0` ve `""` da falsy'dir.
:::

## match-case: yapısal desen eşleme (Python 3.10+)

Python 3.10 ile gelen `match` ifadesi, bir değeri sırayla **desenlere** (pattern) karşı dener ve ilk eşleşen
`case` bloğunu çalıştırır. Diğer dillerdeki `switch`'e benzer ama çok daha güçlüdür: yalnızca sabitlerle değil,
yapılarla da eşleşir ve parçaları isimlere bağlar.

:::code{lang="python" title="match-case desenleri (Python 3.10+)"}
```python
def degerlendir(puan):
    match puan:
        case 100:                  # sabit desen
            return "tam puan"
        case 0:
            return "sıfır"
        case n if n >= 50:         # yakalama + guard (koruma koşulu)
            return f"geçti ({n})"
        case _:                    # joker: her şeyle eşleşir
            return "kaldı"

def komut(metin):
    match metin.split():
        case ["git", yon]:         # iki elemanlı liste; ikinciyi yakala
            return f"{yon} yönüne git"
        case ["dur"]:
            return "dur"
        case ["al", *esyalar]:     # geri kalanları listeye topla
            return f"alınan: {esyalar}"
        case _:
            return "bilinmiyor"

print(degerlendir(100), degerlendir(72), degerlendir(30))
# tam puan geçti (72) kaldı
print(komut("git kuzey"), komut("al elma armut"), komut("uç"))
# kuzey yönüne git alınan: ['elma', 'armut'] bilinmiyor
```
:::

| Desen | Örnek | Ne zaman eşleşir? |
|---|---|---|
| Sabit (literal) | `case 100:` / `case "dur":` | Değer eşitse |
| Yakalama (capture) | `case n:` | Her zaman; değeri `n` adına bağlar |
| Joker (wildcard) | `case _:` | Her zaman; hiçbir şeye bağlamaz |
| Guard | `case n if n >= 50:` | Desen eşleşir **ve** koşul doğruysa |
| Dizi | `case ["git", yon]:` | Uzunluk ve elemanlar uyuyorsa |

Birden çok sabiti tek `case` içinde dikey çizgiyle birleştirebilirsin (veya deseni): `case "e" | "evet":`.

:::callout{tone="danger" title="Yakalama deseni sabit değildir"}
`case HEDEF:` yazınca Python `HEDEF` değişkeninin değeriyle karşılaştırmaz; **her şeyle eşleşen** bir yakalama
deseni oluşturur ve değeri `HEDEF` adına bağlar. Bir değişkendeki sabitle karşılaştırmak için noktalı ad kullan
(`case Renk.KIRMIZI:`) ya da guard yaz (`case x if x == HEDEF:`). Basit iki-üç seçenekli kararlarda `if/elif`
genellikle daha sadedir; `match`'in gücü yapıları parçalamakta ortaya çıkar.
:::

## while döngüsü

`while koşul:` bloğu, koşul truthy olduğu sürece tekrar tekrar çalıştırır. Koşul **her turun başında** yeniden
kontrol edilir. Kaç kez döneceğini önceden bilmediğin durumlar için uygundur: "kullanıcı doğru şifreyi girene
kadar", "kuyrukta iş kaldığı sürece".

Bir `while` döngüsünün sağlıklı çalışması için üç parça gerekir: **başlangıç** (sayaç = 1), **koşul**
(sayaç <= 4) ve koşulu sonunda yanlış yapacak **ilerleme** (sayaç += 1). Ayrıca `while True:` ile bilerek
"sonsuz" bir döngü kurup çıkışı içeriden `break` ile yapabilirsin.

:::trace{src="while-toplam.trace.json" title="while ile toplam ve geri sayım|Summing and counting down with while"}
Okun her turda `while` satırına geri döndüğünü, `i` 5 olunca döngüden çıkıldığını ve ikinci döngünün `break` ile bittiğini izle.
:::

:::callout{tone="warning" title="Sonsuz döngü"}
İlerleme adımını unutursan (`i += 1` yazmazsan) koşul hep doğru kalır ve program asla bitmez. Terminalde böyle
bir programı **Ctrl+C** ile durdurursun (`KeyboardInterrupt`). `while True:` kullanıyorsan her yoldan bir
`break`'e ulaşılabildiğinden emin ol.
:::

## for döngüsü ve iterable'lar

Python'un `for` döngüsü C/Java'daki sayaçlı `for`'dan farklıdır: bir **iterable** (üzerinde dolaşılabilen
nesne) üzerinde **eleman eleman** gezer. Liste, metin, `range`, sözlük, dosya... hepsi iterable'dır. Her turda
döngü değişkeni sıradaki elemana bağlanır.

:::code{lang="python" title="for ile dolaşma"}
```python
for meyve in ["elma", "armut"]:
    print(meyve)          # elma, sonra armut

for harf in "çay":
    print(harf, end=" ")  # ç a y
print()

stok = {"kalem": 12, "silgi": 0}
for urun, adet in stok.items():
    print(urun, adet)     # kalem 12, sonra silgi 0
```
:::

`for`'un arkasındaki **iterator protokolünü** (`iter()` ve `next()`) K-11 dersinde simülasyonla açacağız.

### range(başla, bitir, adım)

Belirli sayıda tekrar ya da sayı dizisi için `range` kullanılır. Dilimlemede olduğu gibi **bitir dahil
değildir**. `range` sayıların listesini bellekte oluşturmaz; istendikçe üretir, bu yüzden `range(10**9)` bile
anında oluşur.

| Çağrı | Ürettiği sayılar |
|---|---|
| `range(5)` | 0, 1, 2, 3, 4 |
| `range(2, 10, 3)` | 2, 5, 8 |
| `range(5, 0, -1)` | 5, 4, 3, 2, 1 |
| `range(0)` | (hiçbiri, döngü hiç çalışmaz) |

### enumerate: indeks ve eleman birlikte

Hem sırayı hem elemanı istiyorsan `for i in range(len(liste)):` yazma; `enumerate` kullan:

:::code{lang="python" title="enumerate"}
```python
gorevler = ["rapor yaz", "e-posta at", "toplantı"]
for sira, gorev in enumerate(gorevler, start=1):
    print(f"{sira}. {gorev}")
# 1. rapor yaz
# 2. e-posta at
# 3. toplantı
```
:::

## break, continue ve döngü-else

- `break`: döngüyü **hemen** bitirir, döngüden sonraki satıra geçer.
- `continue`: bu turun kalanını atlar, **bir sonraki tura** geçer.
- `else` (döngüye bağlı): döngü **break olmadan** doğal yoldan bittiğinde çalışır. Adı yanıltıcıdır; "break
  olmadıysa" (no break) diye düşün.

:::code{lang="python" title="continue ve break"}
```python
for i in range(10):
    if i % 2 == 0:
        continue          # çiftleri atla
    if i > 7:
        break             # 7'den büyük ilk tekte dur
    print(i, end=" ")
print()
# 1 3 5 7
```
:::

`for` başlığı her turda iterator'dan bir sonraki elemanı ister; `continue` bu isteğe erken döner, `break` ise
döngüyü tamamen terk eder. Animasyonda üç elemanlı bir listede bu yolları ve döngü-`else`'in ne zaman çalıştığını izle.

:::animation{scene="for-dongusu-akisi.scene.json"}
`continue` turunda `print`'in atlandığına, elemanlar bitince `StopIteration` ile döngünün sessizce sona erip `else`'e girdiğine, `break` senaryosunda ise `else`'in atlandığına dikkat et.
:::

Döngü-else'in en klasik kullanımı **arama**dır: bir şey bulursan `break` edersin, döngü bulamadan biterse
`else` "bulunamadı" durumunu işler. Asal sayı kontrolünde bölen bulmak tam olarak budur:

:::trace{src="asal-kontrol.trace.json" title="for + break + else ile asal kontrolü|Prime check with for + break + else"}
7 için döngünün tüm bölenleri deneyip `else` bloğuna girdiğine, 9 için ise 3'te `break` olup `else`'in atlandığına dikkat et.
:::

Simülasyondaki fonksiyon anlaşılır olsun diye 2'den `n-1`'e kadar bütün sayıları dener. Gerçek kodda
`range(2, int(n ** 0.5) + 1)` yeterlidir: `n`'in karekökünden büyük bir böleni varsa, karekökünden küçük bir
eşi de vardır.

## İç içe döngüler

Bir döngünün içinde başka bir döngü olabilir. Dış döngünün **her turunda iç döngü baştan sona** çalışır; bu
yüzden toplam tur sayısı çarpılır (3 satır × 3 sütun = 9 iç tur). 1000 × 1000'lik iç içe bir döngü bir milyon
tur demektir; büyük verilerde bu hızla yavaşlar.

:::interactive{type="predict-run" src="carpim-tablosu.trace.json" title="Önce tahmin et: iç içe döngü|Predict first: nested loops"}
Aşağıdaki simülasyonu açmadan önce kodu oku ve her soruda bir seçenek işaretle: programın çıktısını (döngüden sonra `satir` ve `sutun`un hangi değerde kaldığı dahil) ve belirli bir satır çalıştıktan sonra bir değişkenin değerini tahmin et. Sorulardaki satır numaraları soldaki kod listesine göredir. "Çalıştır ve karşılaştır" ile cevapların işaretlenir, doğru ve yanlış sayısı görünür ve iz oynamaya başlar; her sorunun altındaki adım numarasına izin kaydırıcısıyla gidip değeri kendin doğrula. Puan sunucuya gönderilmez; "Yeniden dene" ile tekrar cevaplayabilirsin.
:::

:::trace{src="carpim-tablosu.trace.json" title="İç içe döngüyle çarpım tablosu|Multiplication table with nested loops"}
`sutun` değişkeninin dış döngünün her turunda 1'den yeniden başladığını, her satırda yeni bir liste oluştuğunu izle.
:::

İç içe döngüde `break` yalnızca **içinde bulunduğu** döngüyü bitirir; dış döngü devam eder. İki döngüden birden
çıkmak gerekiyorsa en temiz yol, döngüleri bir fonksiyona koyup `return` etmektir.

## Sık kullanılan döngü desenleri

Birçok problem birkaç temel desene indirgenir. Bunları elle yazabilmek, sonra da hazır karşılıklarını bilmek gerekir:

:::code{lang="python" title="Toplam, en büyük, arama, sayma"}
```python
sayilar = [4, 9, 1, 7]

toplam = 0                     # biriktirici (accumulator)
for x in sayilar:
    toplam += x

en_buyuk = sayilar[0]          # şimdiye kadarki en iyi
for x in sayilar:
    if x > en_buyuk:
        en_buyuk = x

aranan = 7                     # arama: bulunca dur
konum = -1
for i, x in enumerate(sayilar):
    if x == aranan:
        konum = i
        break

buyukler = 0                   # sayma
for x in sayilar:
    if x > 5:
        buyukler += 1

print(toplam, en_buyuk, konum, buyukler)    # 21 9 3 2
print(sum(sayilar), max(sayilar), sayilar.index(7))   # 21 9 3 → hazır karşılıkları
```
:::

## Döngü tuzakları

### Bir eksik, bir fazla (off-by-one)

`range` ve dilimlerde **bitir değerinin dahil olmaması** en sık hata kaynağıdır. 1'den 10'a kadar (10 dahil)
toplamak için `range(1, 11)` gerekir; `range(1, 10)` 10'u atlar. `while i < n` ile `while i <= n` arasındaki
fark da bir tur eder. Şüphe ettiğinde sınırları küçük bir örnekle (`list(range(1, 4))` → `[1, 2, 3]`) dene.

### Döngüdeyken listeyi değiştirmek

Üzerinde dolaştığın listeden eleman silmek, iterator'ün indeksini kaydırır ve bazı elemanların **atlanmasına**
yol açar:

:::code{lang="python" title="Dolaşırken silme tuzağı"}
```python
sayilar = [1, 2, 2, 3]
for n in sayilar:
    if n == 2:
        sayilar.remove(n)
print(sayilar)        # [1, 2, 3]  → ikinci 2 atlandı!

sayilar = [1, 2, 2, 3]
sayilar = [n for n in sayilar if n != 2]   # yeni liste oluştur
print(sayilar)        # [1, 3]
```
:::

İlk `2` silinince arkasındaki elemanlar bir sola kayar ve döngü bir sonraki indekse geçtiği için ikinci `2`'yi
hiç görmez. Doğru yol, filtrelenmiş **yeni** bir liste oluşturmak (yukarıdaki comprehension'ı K-09'da
ayrıntılı göreceksin) ya da listenin bir kopyası üzerinde dolaşmaktır: `for n in sayilar[:]:`. Sözlükte ise
dolaşırken eleman eklemek/silmek doğrudan `RuntimeError` verir.

:::callout{tone="tip" title="Döngü değişkeni döngüden sonra da yaşar"}
Python'da `for` ve `while` yeni bir kapsam (scope) oluşturmaz: döngü değişkeni döngü bittikten sonra son
değeriyle kalır (çarpım tablosu simülasyonunun son adımına bak). Bu bazen işe yarar, ama aynı ismi döngüden
sonra başka amaçla kullanırken dikkatli ol.
:::

## Gerçek hayattan: basit bir menü

Koşullar, `while True`, `break` ve `continue` birlikte, komut satırı menülerinin iskeletini oluşturur:

:::code{lang="python" title="Menü döngüsü (input ile)"}
```python
bakiye = 100
while True:
    secim = input("1) Bakiye  2) Çek  q) Çıkış: ").strip()
    if secim == "q":
        print("Görüşmek üzere!")
        break
    if secim == "1":
        print(f"Bakiye: {bakiye} TL")
    elif secim == "2":
        tutar = int(input("Tutar: "))
        if tutar > bakiye:
            print("Yetersiz bakiye")
            continue
        bakiye -= tutar
        print(f"Kalan: {bakiye} TL")
    else:
        print("Geçersiz seçim")
```
:::

:::realworld{company="Amazon Web Services"}
Ağ üzerinden bir servisi çağıran her program bir gün geçici bir hatayla karşılaşır: zaman aşımı, kısa süreli
aşırı yük, "daha sonra tekrar dene" yanıtı. Bunun standart çözümü bu derste öğrendiğin parçalardan kurulan bir
**yeniden deneme döngüsüdür**: sınırlı sayıda tur atan bir `for`, başarı olunca `break`, bütün denemeler
tükenince çalışan döngü-`else` (ya da döngüden sonra fırlatılan bir hata).

AWS Architecture Blog'daki "Exponential Backoff And Jitter" yazısı bu döngünün nasıl yazılmaması gerektiğini de
anlatır: binlerce istemci hatayı aynı anda görüp hemen ve aynı aralıklarla tekrar denerse, toparlanmaya çalışan
servisi yeniden ezer. Yazının önerisi, her turda bekleme süresini katlanarak artırmak (exponential backoff) ve bu
süreye rastgelelik eklemektir (jitter); böylece istemcilerin denemeleri zamana yayılır.

AWS'nin Python SDK'sı boto3 (altındaki botocore kütüphanesi), yeniden denemeyi bu ilkelere göre kendisi yapar ve
deneme sayısı ile modu yapılandırma üzerinden ayarlanabilir. Kendi kodunda böyle bir döngü yazarken üç şeyi
unutma: üst sınır (sonsuz `while True` değil), başarıda `break` ve denemeler bittiğinde hatayı yutmak yerine
açıkça bildirmek.
:::

## Özet

- `if/elif/else` koşulları yukarıdan aşağı dener ve **ilk doğru** bloğu çalıştırır; sıraya dikkat et, derin iç
  içe yapılar yerine erken dönüş ve `and` kullan; basit seçimlerde `x if c else y`.
- `match-case` (3.10+) değeri desenlere karşı dener: sabit, yakalama, joker `_`, guard ve dizi desenleri;
  çıplak bir isim **yakalama** desenidir, sabit değil.
- `while` koşul doğru olduğu sürece döner; başlangıç, koşul ve ilerleme parçalarını unutma, `while True` +
  `break` deseni yaygındır.
- `for` bir iterable'ın elemanları üzerinde gezer; `range(başla, bitir, adım)`'da bitir dahil değildir;
  indeks gerekiyorsa `enumerate` kullan.
- `break` döngüyü bitirir, `continue` sonraki tura geçer; döngü-`else` yalnızca `break` olmadan bitince çalışır.
- İç içe döngülerde tur sayıları çarpılır; `break` yalnızca en içteki döngüyü bitirir.
- Off-by-one hatalarına ve dolaşırken listeyi değiştirmeye dikkat et; yeni liste oluştur ya da kopya üzerinde dolaş.

:::exercise{src="collatz.exercise.json"}
:::

:::quiz{src="quiz.json"}
:::

:::next{lesson="k-05-koleksiyonlar-ve-kopyalama"}
:::

---
id: k-09-comprehension-ve-fonksiyonel-araclar
slug: comprehension-ve-fonksiyonel-araclar
module: k-python
order: 9
title:
  tr: "Comprehension, lambda ve Fonksiyonel Araçlar"
  en: "Comprehensions, lambda and Functional Tools"
summary:
  tr: "Comprehension, lambda, map, filter, sorted ve zip ile kısa ve okunur kod yaz."
  en: "Write short, readable code with comprehensions, lambda, map, filter, sorted and zip."
durationMinutes: 24
level: intermediate
tags: [python, comprehension, lambda, fonksiyonel-programlama, siralama]
prerequisites: [k-08-ozyineleme]
concepts: [list-comprehension, dict-comprehension, lambda, map-filter, key-function, zip-enumerate, pure-function, reduce]
---

## Neden bu araçlar?

Programların büyük kısmı aynı birkaç işi tekrar tekrar yapar: bir koleksiyonun her elemanını **dönüştür**, bazılarını
**süz**, sonucu **sırala**, iki listeyi **eşleştir**, hepsini tek bir değere **indirge**. K-04'te bunları `for`
döngüsü ve `append` ile yazmayı öğrendin. Bu ders aynı işleri daha kısa, çoğu zaman daha okunur ve biraz daha hızlı
yazmanın Python'daki yollarını gösteriyor:

- **Comprehension:** liste, sözlük ve küme kurmanın tek ifadelik yolu.
- **lambda:** tek satırlık, isimsiz küçük fonksiyonlar.
- **Yerleşik araçlar:** `map`, `filter`, `sorted`, `min`, `max`, `zip`, `enumerate`, `any`, `all`.
- **functools ve operator modülleri:** `reduce`, `itemgetter`, `attrgetter`.

Bu araçların ortak fikri, **fonksiyonel programlamadan (functional programming)** gelir. Verinin "nasıl"
değiştirileceğini adım adım anlatmak yerine "ne" istediğini söylersin: "notlardan 50 ve üstü olanların on katı".

## List comprehension: döngünün kısa yazımı

Önce tanıdık bir döngü:

:::code{lang="python" title="Döngü ve comprehension yan yana"}
```python
notlar = [45, 82, 67, 90, 38]

# klasik döngü
gecenler = []
for n in notlar:
    if n >= 50:
        gecenler.append(n * 10)

# aynı iş: list comprehension
gecenler2 = [n * 10 for n in notlar if n >= 50]

print(gecenler)    # [820, 670, 900]
print(gecenler2)   # [820, 670, 900]
```
:::

Comprehension'ı soldan sağa şöyle oku: **"`n * 10` değerlerinden bir liste; `n`, `notlar` içinde dolaşırken;
yalnızca `n >= 50` ise."** Genel kalıp şudur:

```text
[ İFADE   for DEĞİŞKEN in KAYNAK   if KOŞUL ]
   ↑ ne         ↑ nereden              ↑ hangileri (isteğe bağlı)
```

Döngüdeki dört satırın her parçası comprehension'da bir yere karşılık gelir: boş liste `[`, `for` satırı `for`
kısmı, `if` satırı sondaki `if`, `append(...)` içindeki değer en baştaki ifade.

### Filtre mi, koşullu ifade mi?

Sondaki `if` bir **filtredir**: koşulu sağlamayan eleman listeye hiç girmez. Ama bazen her elemanı tutmak, yalnızca
değerini koşula göre seçmek istersin. Bunun için **koşullu ifade (conditional expression)** `x if koşul else y` en
başa, ifade kısmına yazılır:

:::code{lang="python" title="Filtre sonda, koşullu ifade başta"}
```python
notlar = [45, 82, 67]

print([n for n in notlar if n >= 50])                    # [82, 67]        → 2 eleman
print(["geçti" if n >= 50 else "kaldı" for n in notlar]) # ['kaldı', 'geçti', 'geçti'] → 3 eleman

# ikisi birlikte de olabilir
print(["A" if n >= 80 else "B" for n in notlar if n >= 50])  # ['A', 'B']
```
:::

:::callout{tone="warning" title="else sona yazılmaz"}
`[n for n in notlar if n >= 50 else 0]` bir **SyntaxError**'dır. Sondaki `if` filtredir ve `else` almaz.
Her eleman için bir değer seçmek istiyorsan koşullu ifadeyi başa taşı: `[n if n >= 50 else 0 for n in notlar]`.
:::

## Yorumlayıcıda ne oluyor?

Python 3.12'den önce her comprehension, arka planda gizli bir fonksiyon olarak derlenir ve çağrıldığında **kendi
çerçevesini** açardı. Python 3.12 ile gelen PEP 709 ("inlined comprehensions") bunu değiştirdi. Artık list, dict ve
set comprehension'ları **bulundukları fonksiyonun çerçevesinde** çalışır. Bu ders Python 3.14 ile izlendi:

:::trace{src="comprehension.trace.json" title="Comprehension adım adım|A comprehension step by step"}
Comprehension satırında yığına yeni çerçeve eklenmediğine, 'n'nin tek_kareler çerçevesinde 1, 2, 3 diye değiştiğine ve 2 için kare çağrılmadığına dikkat et.
:::

Bu simülasyonda gördüklerin:

- Comprehension satırı her turda **yeniden** vurgulandı. Yığında `<listcomp>` gibi ayrı bir çerçeve yok. Döngü
  `tek_kareler` çerçevesinin içinde döndü ve `n` o çerçevede `1`, `2`, `3` oldu.
- `kare` yalnızca filtreden geçen `1` ve `3` için çağrıldı. Filtre, ifadeden **önce** değerlendirilir.
- Yapım hâlindeki liste simülasyonda görünmez, çünkü yorumlayıcının kendi iç değer yığınında durur. Liste ancak
  tamamlandığında `sonuc` ismine bağlanır ve heap'te belirir.
- Döngü bittiğinde `n` eski değerine (`"dış"`) döndü. Comprehension değişkeni, ayrı çerçeve olmasa bile **dışarı
  sızmaz**. Python 2'de sızıyordu; Python 3'te hiçbir sürümde sızmaz.

:::callout{tone="info" title="Sürüm farkı neyi değiştirir?"}
Davranış (sonuç, değişkenin sızmaması) bütün Python 3 sürümlerinde aynıdır. Değişen, performans ve hata izleridir:
3.11 ve öncesinde traceback'te `<listcomp>` satırı görürdün, 3.12+ sürümlerde görmezsin. **Generator ifadeleri**
(birazdan) bu değişiklikten etkilenmedi; onlar hâlâ kendi çerçevelerini açar.
:::

## Dict ve set comprehension

Aynı sözdizimi süslü parantezle sözlük ve küme de kurar. `anahtar: değer` yazarsan sözlük, yalnızca değer yazarsan
küme olur.

:::code{lang="python" title="Sözlük ve küme kurmak"}
```python
kelimeler = ["elma", "Armut", "kiraz", "elma", "Muz"]

uzunluk = {k: len(k) for k in kelimeler}
print(uzunluk)       # {'elma': 4, 'Armut': 5, 'kiraz': 5, 'Muz': 3}

kucuk = {k.lower() for k in kelimeler}       # küme: tekrarlar düşer
print(sorted(kucuk)) # ['armut', 'elma', 'kiraz', 'muz']

fiyat = {"elma": 30, "muz": 55}
zamli = {urun: tl * 1.1 for urun, tl in fiyat.items() if tl < 50}
print(zamli)         # {'elma': 33.0}
```
:::

Kümeyi doğrudan değil `sorted` ile yazdırdık, çünkü kümelerin yazdırılma sırası garanti değildir. Sözlükte `elma`
iki kez geçtiği hâlde tek anahtar oldu: aynı anahtara ikinci atama öncekinin üzerine yazar.

## İç içe comprehension ve okunabilirlik sınırı

Birden fazla `for` yazabilirsin. Sıralama, iç içe döngüyle **aynıdır**: soldaki `for` dıştaki döngüdür.

:::code{lang="python" title="İç içe for: düzleştirme ve matris çevirme"}
```python
matris = [[1, 2, 3], [4, 5, 6]]

# for satir in matris:  for x in satir:  → düzleştir
print([x for satir in matris for x in satir])            # [1, 2, 3, 4, 5, 6]

# comprehension içinde comprehension: satır ve sütunları çevir (transpose)
print([[satir[i] for satir in matris] for i in range(3)]) # [[1, 4], [2, 5], [3, 6]]

print([(x, y) for x in range(3) for y in range(x)])       # [(1, 0), (2, 0), (2, 1)]
```
:::

Burada dur ve dürüst ol: son iki satırı ilk okuyuşta anladın mı? Comprehension'lar **tek bir dönüşüm ve tek bir
filtre** için harikadır. Şunlardan biri varsa döngüye dön:

- İkiden fazla `for` ya da birden fazla `if`.
- Satır 80 karakteri aşıyor ve bölmen gerekiyor.
- İçeride yan etki var: `print`, dosyaya yazma, başka listeye `append`. Comprehension **değer üretmek** içindir.
  Yalnızca yan etki için `[print(x) for x in liste]` yazmak, kimsenin kullanmadığı bir `None` listesi üretir.

## Generator ifadesi: tembel kardeş

Köşeli parantezi normal parantezle değiştirirsen bir **generator ifadesi (generator expression)** elde edersin.
Liste hemen tamamen kurulmaz; değerler **istendikçe**, birer birer üretilir. Buna **tembel değerlendirme (lazy
evaluation)** denir.

:::code{lang="python" title="Liste yerine generator ifadesi"}
```python
sayilar = [1, 2, 3, 4, 5, 6]
g = (x * x for x in sayilar)
print(g)              # <generator object <genexpr> at 0x...>
print(next(g), next(g))   # 1 4

# Bir fonksiyonun tek argümanıysa ekstra parantez gerekmez:
print(sum(x * x for x in range(1_000_000)))   # 333332833333500000
```
:::

Son satır bir milyon elemanlı bir liste **kurmadan** toplamı hesaplar; bellekte aynı anda tek bir sayı tutulur.
Sonucu tek seferde tüketeceksen (`sum`, `max`, `any`, `"".join`) generator ifadesi tercih edilir. Iterator ve
generator'ları K-11'de ayrıntılı göreceksin.

## lambda: tek satırlık isimsiz fonksiyon

`lambda`, bir **ifade** olarak fonksiyon oluşturur: `lambda parametreler: dönüş_ifadesi`. Gövdesinde tek bir ifade
olabilir; `return`, atama, `if` bloğu ya da döngü yazamazsın.

```python
kare = lambda x: x * x      # çalışır ama önerilmez
def kare(x):                # bunun yerine
    return x * x
```

Bir lambda'yı isme atamak işe yarar ama PEP 8 bunu önermez. Hata izinde fonksiyon adı `<lambda>` görünür ve
docstring ekleyemezsin. Lambda'nın doğal yeri, **başka bir fonksiyona argüman olarak** verilen kısa, tek kullanımlık
işlerdir: `sorted(..., key=lambda ...)`, `max(..., key=...)`, `map`, `filter`. Mantık iki koşulu aşıyorsa ya da
yeniden kullanılacaksa `def` ile isimlendir.

## map ve filter mı, comprehension mı?

`map(f, kaynak)` her elemana `f` uygular. `filter(f, kaynak)` ise `f`'nin doğru döndürdüğü elemanları tutar. İkisi de
Python 3'te **tembel bir iterator** döndürür; sonucu görmek için `list(...)` gerekir.

:::code{lang="python" title="Aynı iş, üç yazım"}
```python
sayilar = [1, 2, 3, 4, 5, 6]

print(list(map(lambda x: x * x, sayilar)))        # [1, 4, 9, 16, 25, 36]
print(list(filter(lambda x: x % 2 == 0, sayilar)))  # [2, 4, 6]
print([x * x for x in sayilar if x % 2 == 0])     # [4, 16, 36]

# hazır bir fonksiyon varsa map çok okunurdur:
print(list(map(str, sayilar)))                    # ['1', '2', '3', '4', '5', '6']
```
:::

| Durum | Tercih |
|---|---|
| Dönüşüm + filtre birlikte | Comprehension |
| Hazır, isimli bir fonksiyon uygulamak (`str`, `int`, `str.strip`) | `map` de gayet okunur |
| `lambda` yazman gerekiyorsa | Comprehension genelde daha net |
| Sonuç tek seferde tüketilecek (`sum`, `any`) | Generator ifadesi |

Python topluluğunun genel tercihi comprehension'dır. `map(lambda ...)` gördüğün yerin çoğu bir comprehension ile
daha okunur yazılabilir.

## sorted, min, max ve key fonksiyonu

`sorted(kaynak)` **yeni bir liste** döndürür; `liste.sort()` ise listeyi **yerinde** sıralar ve `None` döndürür.
İkisi de `key` ve `reverse` parametrelerini alır. `key`, her elemandan karşılaştırılacak değeri çıkaran bir
fonksiyondur. `min` ve `max` da aynı `key` parametresini kabul eder.

:::interactive{type="predict-run" src="sorted-key.trace.json" title="Önce tahmin et: sorted ve key|Predict first: sorted and key"}
Simülasyonu izlemeden önce kodu oku: aynı puana sahip öğrenciler sıralamada nereye düşer, `max` hangisini seçer? Her soruda bir seçenek işaretle. Sorulardaki satır numaraları soldaki kod listesine göredir. "Çalıştır ve karşılaştır" ile cevapların işaretlenir, doğru ve yanlış sayısı görünür ve iz oynamaya başlar; her sorunun altındaki adım numarasına izin kaydırıcısıyla gidip değeri kendin doğrula. Puan sunucuya gönderilmez; "Yeniden dene" ile tekrar cevaplayabilirsin.
:::

:::trace{src="sorted-key.trace.json" title="sorted ve key fonksiyonu|sorted and the key function"}
Her sorted ve max çağrısında lambda çerçevesinin üç kez, her öğrenci için bir kez açılıp anahtarı döndürdüğünü izle.
:::

Simülasyondan çıkanlar:

- `key` fonksiyonu **her eleman için tam bir kez** çağrılır (üç eleman, üç çağrı). Karşılaştırmalar o anahtarlar
  üzerinden yapılır. Bu yüzden pahalı bir `key` bile n kez çalışır, n·log n kez değil.
- **Çok anahtarlı sıralama** için `key` bir tuple döndürür. Tuple'lar soldan sağa karşılaştırılır. Sayısal bir alanı
  ters çevirmek için `-puan` hilesi işe yarar.
- Python'un sıralaması **kararlıdır (stable)**: anahtarları eşit olan elemanlar ilk sıralarını korur (`ece`, `can`'dan
  önce kaldı).
- Orijinal liste hiç değişmedi; `sorted` yeni liste üretti. Yeni liste aynı tuple nesnelerini gösteriyor, kopyalamıyor.

### operator modülü: itemgetter ve attrgetter

`lambda o: o["puan"]` gibi "bir alan çek" lambda'ları o kadar yaygındır ki `operator` modülü hazır karşılıklarını
sunar. Daha kısadırlar ve C ile yazıldıkları için biraz daha hızlıdırlar.

:::code{lang="python" title="itemgetter, attrgetter ve reverse"}
```python
from operator import itemgetter, attrgetter

ogr = [
    {"ad": "ece", "puan": 72, "yas": 21},
    {"ad": "ali", "puan": 90, "yas": 23},
    {"ad": "can", "puan": 72, "yas": 20},
]
print([o["ad"] for o in sorted(ogr, key=itemgetter("puan", "ad"))])
# ['can', 'ece', 'ali']   → önce puan, eşitse ad
print([o["ad"] for o in sorted(ogr, key=itemgetter("puan"), reverse=True)])
# ['ali', 'ece', 'can']   → reverse=True'da da eşitler ilk sırasını korur
print(min(ogr, key=itemgetter("yas"))["ad"])   # can

kelimeler = ["elma", "Armut", "Muz"]
print(sorted(kelimeler))                 # ['Armut', 'Muz', 'elma']  (büyük harf önce!)
print(sorted(kelimeler, key=str.lower))  # ['Armut', 'elma', 'Muz']

class Urun:
    def __init__(self, ad, fiyat):
        self.ad, self.fiyat = ad, fiyat

urunler = [Urun("kalem", 15), Urun("defter", 40), Urun("silgi", 5)]
print([u.ad for u in sorted(urunler, key=attrgetter("fiyat"))])  # ['silgi', 'kalem', 'defter']
```
:::

## zip ve enumerate: veriyi birleştirmek

`zip(a, b, ...)` birden çok kaynağı eleman eleman eşleştirip tuple'lar üretir. `enumerate(kaynak, start=0)` ise
her elemana bir sıra numarası ekler. İkisi de tembeldir. Böylece `for i in range(len(liste))` gibi kırılgan indeks
kodlarına gerek kalmaz.

:::trace{src="zip-enumerate.trace.json" title="zip ve enumerate ile eşleştirme|Pairing with zip and enumerate"}
Her turda sira, isim ve puan isimlerinin tek bir iç içe tuple'dan açıldığını ve son satırda kısa liste yüzünden "can"ın düştüğünü izle.
:::

:::callout{tone="danger" title="zip sessizce keser"}
Listeler farklı uzunluktaysa `zip` **hata vermeden** en kısasında durur. Veri kaybı fark edilmeden geçer. Python
3.10+ sürümlerde `zip(a, b, strict=True)` yazarsan uzunluklar farklı olduğunda
`ValueError: zip() argument 2 is shorter than argument 1` alırsın. Uzunlukların eşit olması gerekiyorsa her zaman
`strict=True` kullan. Bilerek en uzununa kadar gitmek istiyorsan `itertools.zip_longest` var.
:::

Küçük bir hile: `zip(*ciftler)` işlemi tersine çevirir (unzip). `list(zip(*[("ali", 90), ("ece", 72)]))` sonucu
`[('ali', 'ece'), (90, 72)]` olur.

## any, all ve reduce: koleksiyonu tek değere indirgemek

`any` en az bir elemanın, `all` bütün elemanların doğru olup olmadığını söyler. İkisi de **kısa devre** yapar:
`any` ilk doğruyu, `all` ilk yanlışı bulunca durur. Bu yüzden generator ifadesiyle çok iyi çalışırlar.

`functools.reduce(f, kaynak, baslangic)` ise bir iki-argümanlı fonksiyonu soldan sağa uygulayarak koleksiyonu
**tek bir değere** indirger: `f(f(f(1, 2), 3), 4)`.

:::code{lang="python" title="any, all ve reduce"}
```python
from functools import reduce
import operator

puanlar = [72, 90, 72]
print(any(p > 85 for p in puanlar))   # True
print(all(p >= 50 for p in puanlar))  # True
print(any([]), all([]))               # False True  (boş küme: "hepsi" boşta doğru sayılır)

print(reduce(operator.mul, [1, 2, 3, 4], 1))                 # 24
print(reduce(lambda a, b: a if a > b else b, [3, 9, 2]))     # 9
```
:::

`reduce` güçlüdür ama çoğu zaman okunurluğu düşüktür. Toplam için `sum`, en büyük için `max`, çarpım için
`math.prod`, metin birleştirmek için `"".join` zaten var. `reduce`'u hazır bir karşılığı olmayan birikimli işlemler
için sakla. Guido van Rossum da bu yüzden `reduce`'u Python 3'te yerleşik fonksiyonlardan çıkarıp `functools`'a taşıdı.

## Saf fonksiyon ve yan etki

**Saf fonksiyon (pure function)** iki kurala uyar: aynı girdiye **hep aynı çıktıyı** verir ve dışarıdaki hiçbir şeyi
**değiştirmez** (yan etkisi yoktur). `len`, `sorted`, `kare` saftır. `list.sort` (girdiyi değiştirir), `print`
(ekrana yazar) ve `random.random` (her seferinde farklı sonuç verir) saf değildir.

:::code{lang="python" title="Yan etkili ve saf sürüm"}
```python
def zam_yap_yerinde(fiyatlar):          # yan etkili: çağıranın listesini değiştirir
    for i in range(len(fiyatlar)):
        fiyatlar[i] *= 1.1

def zamli(fiyatlar):                    # saf: yeni liste döndürür
    return [f * 1.1 for f in fiyatlar]
```
:::

Comprehension, `map`, `filter` ve `sorted` doğası gereği **yeni** bir değer üretir. Bu yüzden saf kod yazmayı
kolaylaştırırlar. Saf fonksiyonların testi kolaydır, sonuçları önbelleğe alınabilir (K-08'deki `lru_cache`) ve
paralel çalıştırmak güvenlidir. Gerçek programlar yan etkisiz olamaz (bir yere yazman gerekir), ama iyi bir tasarım
yan etkileri kenarlarda toplar, hesaplamanın kendisini saf tutar.

:::callout{tone="tip" title="Gerçek hayattan: API yanıtını işlemek"}
Bir API'den gelen sipariş listesinden "aktif siparişlerin müşteri e-postalarını tekil ve sıralı" almak tek okunur
satırdır: `sorted({s["email"] for s in siparisler if s["durum"] == "aktif"})`. Set comprehension tekrarları atar,
`sorted` sıralar ve listeye çevirir.
:::

## Özet

- `[ifade for x in kaynak if koşul]`: dönüştür ve süz. Sondaki `if` filtredir; değer seçmek için başta
  `a if koşul else b` kullanılır.
- Dict `{k: v for ...}` ve set `{x for ...}` comprehension'ları aynı kalıbı izler. Comprehension değişkeni dışarı
  sızmaz. Python 3.12+ sürümlerde list, dict ve set comprehension'ları ayrı çerçeve açmaz.
- İkiden fazla `for`, birden çok koşul ya da yan etki varsa okunabilirlik için döngüye dön.
- `( ... )` generator ifadesi tembeldir; `sum`, `any`, `max` gibi tek seferlik tüketimde bellek kazandırır.
- `lambda` kısa, tek ifadelik ve argüman olarak verilen işler içindir. İsme atanacaksa `def` yaz.
- `sorted`, `min` ve `max` içindeki `key` her eleman için bir kez çağrılır. Tuple anahtar çok alanlı sıralama yapar,
  sıralama kararlıdır. `itemgetter` ve `attrgetter` hazır anahtar fonksiyonlarıdır.
- `zip` ve `enumerate` indeks hesabını ortadan kaldırır. `zip` en kısada durur, bu yüzden gerekirse `strict=True`
  kullan. Saf fonksiyonlar test etmesi ve akıl yürütmesi en kolay kodu oluşturur.

:::exercise{src="transpoz.exercise.json"}
:::

:::quiz{src="quiz.json"}
:::

:::next{lesson="k-10-hatalar-istisnalar-ve-dosyalar"}
:::

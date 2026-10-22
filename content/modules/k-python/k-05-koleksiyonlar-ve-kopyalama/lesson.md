---
id: k-05-koleksiyonlar-ve-kopyalama
slug: koleksiyonlar-ve-kopyalama
module: k-python
order: 5
title:
  tr: "Koleksiyonlar: list, tuple, dict, set ve Kopyalama"
  en: "Collections: list, tuple, dict, set and Copying"
summary:
  tr: "Dört temel koleksiyonu, takma ad tuzağını ve sığ/derin kopyayı bellekte izle."
  en: "Track the four core collections, the aliasing trap and shallow vs deep copies in memory."
durationMinutes: 21
level: beginner
tags: [python, koleksiyonlar, list, dict, kopyalama]
prerequisites: [k-04-kosullar-ve-donguler]
concepts: [list, tuple, dict, set, hashing, time-complexity, aliasing, shallow-vs-deep-copy]
---

## Neden koleksiyonlar?

Şimdiye kadar tek tek değerlerle çalıştın: bir sayı, bir metin, bir `bool`. Gerçek programlar ise **çok sayıda**
değerle uğraşır: bir sepetteki ürünler, bir sınıftaki öğrenciler, kullanıcı adından kullanıcı bilgisine giden
bir eşleme, bir sayfayı ziyaret etmiş benzersiz IP adresleri. Bu değerleri tek bir isim altında toplayan
nesnelere **koleksiyon** (collection) denir.

Python'un dört temel yerleşik koleksiyonu vardır:

| Tür | Örnek | Sıralı mı? | Değiştirilebilir mi? | Tekrar eden eleman? |
|---|---|---|---|---|
| `list` | `[3, 1, 3]` | Evet (indeksle erişim) | Evet | Olabilir |
| `tuple` | `(3, 1, 3)` | Evet (indeksle erişim) | Hayır | Olabilir |
| `dict` | `{"ada": 30}` | Ekleme sırasını korur (3.7+) | Evet | Anahtarlar tekil |
| `set` | `{3, 1}` | Sırasız | Evet | Hayır |

Bu derste her birinin ne işe yaradığını, hangi işlemin ne kadar hızlı olduğunu ve en önemlisi **bellekte ne
olduğunu** göreceksin. K-02'de öğrendiğin kural burada da geçerli: koleksiyonlar da heap'te yaşayan nesnelerdir ve
**içlerinde değerlerin kendisini değil, nesnelere referansları** tutarlar. Kopyalama tuzaklarının hepsi bu tek
cümleden çıkar.

Bu cümlenin ne demek olduğunu baştan görmek için animasyonda iç içe bir listeyi önce takma adla, sonra sığ, sonra
derin kopyayla çoğaltıyoruz. Okların hangi nesnelere gittiğini izle; dersin sonundaki kopyalama bölümünde aynı
durumu kodla ve simülasyonla ayrıntılı inceleyeceksin.

:::animation{scene="sig-derin-kopya.scene.json"}
`copy.copy` adımında yeni dış listenin oklarının eski iç listelere gittiğine, `sig[0].append("Deniz")` sonrasında değişikliğin `takim` üzerinden de göründüğüne, `derin`in ise hiç etkilenmediğine dikkat et.
:::

## list: sıralı ve değiştirilebilir dizi

Liste, köşeli parantezle yazılan, elemanlarını sırayla tutan ve sonradan değiştirilebilen koleksiyondur.
Elemanlara **indeks** (index) ile erişirsin; ilk eleman 0'dır, negatif indeks sondan sayar. **Dilim** (slice)
`liste[baslangic:bitis:adim]` ile bir parçayı yeni bir liste olarak alırsın (bitiş dahil değildir).

:::code{lang="python" title="Oluşturma, indeks ve dilim"}
```python
sayilar = [10, 20, 30, 40, 50]
print(sayilar[0], sayilar[-1])   # 10 50
print(sayilar[1:3])              # [20, 30]
print(sayilar[::2])              # [10, 30, 50]
print(sayilar[::-1])             # [50, 40, 30, 20, 10]
print(len(sayilar), 30 in sayilar)  # 5 True
bos = []
harfler = list("abc")
print(harfler)                   # ['a', 'b', 'c']
```
:::

### Listeyi değiştiren metotlar

| Metot | Ne yapar? | Dönen değer |
|---|---|---|
| `append(x)` | Sona tek eleman ekler | `None` |
| `insert(i, x)` | `i` konumuna ekler, sonrakileri kaydırır | `None` |
| `extend(iterable)` | Başka bir koleksiyonun elemanlarını sona ekler | `None` |
| `pop()` / `pop(i)` | Son (ya da `i`.) elemanı çıkarır | Çıkarılan eleman |
| `remove(x)` | Değeri `x` olan **ilk** elemanı siler; yoksa `ValueError` | `None` |
| `sort()` | Listeyi **yerinde** sıralar | `None` |

:::code{lang="python" title="append, extend, insert, pop, remove"}
```python
sepet = ["elma"]
sepet.append("armut")          # ['elma', 'armut']
sepet.extend(["kiraz", "muz"]) # ['elma', 'armut', 'kiraz', 'muz']
sepet.append(["a", "b"])       # dikkat: listeyi TEK eleman olarak ekler
print(sepet)   # ['elma', 'armut', 'kiraz', 'muz', ['a', 'b']]
sepet.pop()                    # son elemanı çıkarır
sepet.insert(0, "erik")        # ['erik', 'elma', 'armut', 'kiraz', 'muz']
son = sepet.pop()              # 'muz'
sepet.remove("elma")
print(sepet, son)  # ['erik', 'armut', 'kiraz'] muz
```
:::

### sort() ile sorted() farkı

İkisi de sıralar ama çok farklı davranır. `liste.sort()` **aynı listeyi** yerinde değiştirir ve `None` döndürür.
`sorted(x)` ise herhangi bir yinelenebilir (iterable) nesneyi alır ve **yeni bir liste** döndürür; orijinali
olduğu gibi bırakır. İkisi de `key=` ve `reverse=True` alır.

:::code{lang="python" title="sort yerinde, sorted yeni liste"}
```python
notlar = [70, 95, 82]
yeni = sorted(notlar)
print(notlar, yeni)        # [70, 95, 82] [70, 82, 95]
sonuc = notlar.sort(reverse=True)
print(notlar, sonuc)       # [95, 82, 70] None
isimler = ["ece", "Ada", "can"]
print(sorted(isimler, key=str.lower))  # ['Ada', 'can', 'ece']
```
:::

:::callout{tone="warning" title="notlar = notlar.sort() yazma"}
`sort()` `None` döndürdüğü için `notlar = notlar.sort()` satırı listeni kaybettirir: `notlar` artık `None`'dır.
Yerinde sıralamak istiyorsan sadece `notlar.sort()`, yeni bir liste istiyorsan `yeni = sorted(notlar)` yaz.
Aynı kural `append`, `extend`, `reverse` gibi yerinde çalışan bütün metotlar için geçerlidir.
:::

## tuple: değiştirilemez sıralı dizi

Tuple, listeye benzer ama oluşturulduktan sonra elemanları **değiştirilemez** (immutable). Sabit kalması gereken
gruplar için idealdir: bir koordinat `(x, y)`, bir RGB rengi, bir fonksiyonun döndürdüğü birden çok değer.
Değiştirilemediği için sözlük anahtarı olarak da kullanılabilir (birazdan neden olduğunu göreceksin).

Tuple'ı asıl oluşturan virgüldür, parantez değil. `a, b = b, a` gibi satırlarda sağ taraf önce bir tuple'a
**paketlenir** (packing), sonra sol taraftaki isimlere **açılır** (unpacking).

:::code{lang="python" title="Paketleme ve açma"}
```python
nokta = 3, 4            # paketleme: (3, 4)
x, y = nokta            # açma
tek = (5,)              # tek elemanlı tuple için virgül şart
print(type((5)), type(tek))  # <class 'int'> <class 'tuple'>

a, b = 1, 2
a, b = b, a             # takas: geçici değişken gerekmez
ilk, *geri = [1, 2, 3, 4]
print(a, b, ilk, geri)  # 2 1 1 [2, 3, 4]
```
:::

### Değiştirilemez ama içi değişebilir

Tuple'ın değiştirilemez olması, **hangi nesnelere referans tuttuğunun** değişmeyeceği demektir. Eğer o
nesnelerden biri liste gibi değiştirilebilir bir nesneyse, listenin kendisi yine değişebilir:

:::code{lang="python" title="Tuple içinde liste"}
```python
kayit = ("Ada", [90, 85])
kayit[1].append(100)    # izinli: listeyi değiştiriyoruz, tuple'ı değil
print(kayit)            # ('Ada', [90, 85, 100])
try:
    kayit[1] = [0]      # yasak: tuple'ın referansını değiştirmek
except TypeError as e:
    print(e)            # 'tuple' object does not support item assignment
```
:::

## dict: anahtardan değere eşleme

Sözlük (dictionary), her **anahtarı** (key) bir **değere** (value) eşler. "Bu kullanıcı adının e-postası ne?",
"bu ürün kodunun fiyatı ne?" gibi sorular için kullanılır. Anahtarlar tekildir; aynı anahtara yeniden atama
eski değerin üstüne yazar.

### Hashing: sözlük nasıl bu kadar hızlı?

Bir listede bir değeri aramak için Python baştan sona her elemana bakmak zorundadır. Sözlük ise anahtarın
**hash değerini** (hash) kullanır: `hash("ada")` anahtardan hesaplanan bir tam sayıdır. Sözlük bu sayıdan iç
tablosundaki konumu hesaplar ve doğrudan oraya bakar. Bu yüzden eleman sayısı ne olursa olsun arama, ekleme ve
silme **ortalamada sabit zamanda** (O(1)) yapılır.

Bunun bir şartı var: anahtarın hash değeri, sözlükte durduğu sürece **değişmemelidir**. Değişseydi sözlük anahtarı
yanlış yerde arardı. Bu yüzden anahtar olarak yalnızca **hashable** nesneler kullanılabilir: `int`, `str`,
`float`, `bool`, `None`, elemanları da hashable olan `tuple` ve `frozenset`. `list`, `dict`, `set` değiştirilebilir
olduğu için hashable değildir.

:::diagram{src="sozluk-hash.svg" alt="Listede arama elemanlara tek tek bakar, sözlükte arama ise anahtarın hash değerinden yuvayı hesaplayıp doğrudan oraya gider|Searching a list checks elements one by one, while a dict lookup computes the slot from the key's hash and goes straight there"}
Liste "ada"yı bulmak için beş elemana bakar; sözlük hash'ten yuvayı hesaplar ve tek seferde bulur.
:::

:::code{lang="python" title="Hashable anahtarlar"}
```python
konum = {(41, 29): "İstanbul"}      # tuple anahtar: geçerli
try:
    hatali = {[41, 29]: "İstanbul"}
except TypeError as e:
    print(e)  # ... unhashable type: 'list' (mesaj sürüme göre biraz değişir)
```
:::

### Temel sözlük işlemleri

:::code{lang="python" title="get, setdefault, items"}
```python
yaslar = {"ada": 30, "can": 25}
yaslar["ece"] = 28                 # ekleme
yaslar["ada"] = 31                 # güncelleme
print(yaslar.get("mert"))          # None (KeyError yerine)
print(yaslar.get("mert", 0))       # 0
# yaslar["mert"]                   # KeyError: 'mert'

gruplar = {}
gruplar.setdefault("A", []).append("ada")   # yoksa [] koyar, sonra döndürür
gruplar.setdefault("A", []).append("can")   # varsa mevcut listeyi döndürür
print(gruplar)                     # {'A': ['ada', 'can']}

for isim, yas in yaslar.items():
    print(isim, yas)               # ada 31 / can 25 / ece 28
print(list(yaslar.keys()), list(yaslar.values()))
# ['ada', 'can', 'ece'] [31, 25, 28]
del yaslar["can"]
print("can" in yaslar)             # False (in anahtarlarda arar)
```
:::

Python 3.7'den beri sözlükler **ekleme sırasını korur**: `items()` anahtarları eklediğin sırayla verir. Bu dilin
resmi garantisidir, ona güvenebilirsin.

## set: tekil elemanlar ve küme işlemleri

Küme (set), her elemandan **en fazla bir tane** tutan, sırasız bir koleksiyondur. İçeride sözlük gibi hash
tablosu kullanır; bu yüzden elemanları hashable olmalıdır ve `in` sorgusu ortalamada O(1)'dir. Boş küme `set()`
ile yazılır; `{}` boş bir **sözlüktür**.

:::code{lang="python" title="Küme işlemleri"}
```python
python = {"ada", "can", "ece"}
java = {"can", "mert"}
print(python | java)   # birleşim:  ada, can, ece, mert (sıra değişebilir)
print(python & java)   # kesişim:   {'can'}
print(python - java)   # fark:      ada ve ece
print(python ^ java)   # simetrik fark: ikisinden yalnız birinde olanlar
python.add("zeynep")
python.discard("yok")  # yoksa hata vermez (remove KeyError verir)
```
:::

## Hangi durumda hangisi?

Doğru koleksiyonu seçmek çoğu zaman en büyük performans kazancıdır. Aşağıdaki tablo CPython'daki **ortalama**
maliyetleri gösterir (n: eleman sayısı):

| İşlem | `list` | `dict` | `set` |
|---|---|---|---|
| `x in koleksiyon` | O(n), tek tek bakar | O(1) (anahtarda) | O(1) |
| İndeksle / anahtarla erişim | O(1) | O(1) | yok |
| Sona ekleme | O(1) (amortize) | O(1) | O(1) |
| Başa ekleme `insert(0, x)` | O(n), herkesi kaydırır | yok | yok |
| Ortadan silme | O(n) | O(1) | O(1) |

Kısa bir karar rehberi:

- **Sıra önemli, tekrar olabilir, değişecek** → `list`.
- **Sabit kayıt, sözlük anahtarı, fonksiyondan çoklu dönüş** → `tuple`.
- **Bir şeyden başka bir şeye erişim (ID → kayıt)** → `dict`.
- **"Bunu daha önce gördüm mü?" ve tekilleştirme** → `set`.

:::callout{tone="tip" title="Büyük listede in yerine set"}
10.000 elemanlı bir yasaklı kelime listesinde her kelime için `if kelime in yasakli_liste:` yazarsan her sorgu
listenin tamamını tarayabilir. Listeyi bir kez `yasakli = set(yasakli_liste)` ile kümeye çevir; sorgular
ortalamada sabit zamana iner. Sözlük ve kümenin O(1)'i **ortalamadır**; çok nadir çakışma durumlarında daha
yavaş olabilir.
:::

## dict ve set ile sayma ve tekilleştirme

Gerçek hayatta en sık yaptığın iki iş: bir şeyin kaç kez geçtiğini saymak ve tekrarları atmak. Aşağıdaki
simülasyonda sözlüğün her turda nasıl büyüdüğünü ve kümenin tekrarları nasıl yok ettiğini izle.

:::trace{src="sayma.trace.json" title="dict ile sayma, set ile tekilleştirme|Counting with dict, de-duplicating with set"}
Her döngü turunda `sayac` sözlüğündeki değerin nasıl arttığına, sonda `set` ile `dict.fromkeys` farkına bak.
:::

Bu iş o kadar yaygındır ki standart kütüphanede hazır bir araç vardır: `collections.Counter`.

:::code{lang="python" title="Counter"}
```python
from collections import Counter
c = Counter(["elma", "armut", "elma", "kiraz", "elma"])
print(c.most_common(1))   # [('elma', 3)]
```
:::

## Takma ad, sığ kopya ve derin kopya

K-02'den hatırla: `b = a` kopyalamaz, aynı nesneye ikinci bir isim verir. Buna **takma ad** (aliasing) denir.
Bağımsız bir liste istiyorsan kopya almalısın. Ama "kopya" iki farklı derinlikte olabilir:

- **Sığ kopya** (shallow copy): yeni bir **dış** koleksiyon oluşturur, ama içine eskisindeki **aynı referansları**
  koyar. `liste.copy()`, `liste[:]`, `list(liste)`, `dict(d)`, `d.copy()` hepsi sığdır.
- **Derin kopya** (deep copy): `copy.deepcopy(x)` iç içe bütün değiştirilebilir nesneleri de kopyalar; sonuç
  orijinalle hiçbir değiştirilebilir nesneyi paylaşmaz.

Düz bir sayı ya da metin listesinde fark görünmez, çünkü elemanlar zaten değiştirilemez. Fark **iç içe**
yapılarda ortaya çıkar:

:::trace{src="sig-derin-kopya.trace.json" title="Sığ kopya ve derin kopya|Shallow copy vs deep copy"}
Heap'te `sig` listesinin oklarının `takim` ile aynı iç listelere gittiğine, `derin`in ise kendi iç listelerine sahip olduğuna dikkat et.
:::

Simülasyonun sonunda üç ayrı dış liste var, ama `takim` ile `sig` iç listeleri **paylaşıyor**. `sig[0]`'a eklenen
"Deniz", `takim[0]`'da da görünüyor. `sig`'e yeni bir eleman eklemek ise yalnızca `sig`'i etkiledi, çünkü dış
listeler ayrı nesneler. `derin` ise tamamen bağımsız: ona eklenen "Zeynep" başka hiçbir yerde görünmüyor.

:::interactive{type="python-memory" scenario="shallow-vs-deep" title="Kendin dene: sığ ve derin kopya|Try it: shallow vs deep copy"}
"Adım ileri" ile ilerle. `takma_ad` yalnızca yeni bir isimdir, `orijinal` ile aynı #id'yi gösterir. `sig` yeni bir dış listedir ama yuvalarındaki oklar `orijinal`in iç listelerine gider; `derin` için iç listeler de yeniden oluşturulur. `sig[0].append(99)` adımında vurgulanan kartlara ve çıktıdaki iki listeye bak. Sonra "Kodu düzenle" ile `copy.copy(orijinal)` yerine `orijinal[:]` ya da `list(orijinal)` yazıp "Çalıştır"a bas: sonuç aynıysa onlar da sığ kopyadır.
:::

:::callout{tone="info" title="deepcopy neden her zaman kullanılmıyor?"}
Derin kopya bütün yapıyı dolaştığı için büyük verilerde yavaştır ve bellek harcar. Çoğu zaman sığ kopya yeterlidir
ya da veriyi hiç değiştirmeden yeni bir yapı üretmek (örneğin comprehension ile) daha temizdir. `deepcopy`'yi iç
içe ve değiştirilebilir bir yapıyı gerçekten bağımsız değiştirmen gerektiğinde kullan.
:::

### `[[0] * 3] * 3` tuzağı

Bir ızgara ya da matris oluşturmak için akla gelen ilk yol çoğu zaman yanlıştır. `*` operatörü bir listeyi
çoğaltırken elemanları **kopyalamaz**, aynı referansı tekrar eder. `[0] * 3` sorun çıkarmaz çünkü `0`
değiştirilemez. Ama `[[0] * 3] * 3` dış listeye **aynı iç listenin** referansını üç kez koyar:

:::trace{src="carpim-tuzagi.trace.json" title="Liste çarpma tuzağı|The list multiplication trap"}
`tuzak` listesinin üç okunun da aynı heap nesnesine gittiğine, `dogru` listesinde ise üç ayrı iç liste oluştuğuna bak.
:::

:::callout{tone="danger" title="İç içe liste oluştururken * kullanma"}
`[[0] * 3] * 3` ile kurulan bir matriste tek hücreyi değiştirmek bütün satırları değiştirir. İç içe yapıları
her zaman comprehension ile kur: `[[0] * 3 for _ in range(3)]`. Aynı tuzak `[[]] * n` ve `[{}] * n` için de
geçerlidir.
:::

## Gerçek hayattan bir örnek

Bir e-ticaret sitesinde siparişleri müşteriye göre gruplamak ve hangi şehirlerden sipariş geldiğini bulmak
istediğini düşün. Dört koleksiyonu da yerinde kullanan kısa bir çözüm:

:::code{lang="python" title="Siparişleri gruplama"}
```python
siparisler = [
    ("ada", "İzmir", 120),
    ("can", "Ankara", 80),
    ("ada", "İzmir", 45),
]
musteriye_gore = {}
sehirler = set()
for musteri, sehir, tutar in siparisler:   # tuple açma
    musteriye_gore.setdefault(musteri, []).append(tutar)
    sehirler.add(sehir)
print(musteriye_gore)    # {'ada': [120, 45], 'can': [80]}
print(sorted(sehirler))  # ['Ankara', 'İzmir']
```
:::

:::realworld{company="Instagram (Meta)"}
Instagram'ın sunucu kodu, tek bir büyük Django uygulamasında çok sayıda mühendisin aynı anda çalıştığı bir Python
kod tabanıdır. Şirketin mühendislik blogundaki "Python at Scale: Strict Modules" yazısı, bu ölçekte en çok sorun
çıkaran şeylerden birinin **modül düzeyinde paylaşılan değiştirilebilir durum** olduğunu anlatır: bir modülün en
üstünde tanımlanmış bir liste ya da sözlük, onu içe aktaran her yerden aynı nesne olarak görülür. Bir kod parçası
onu "kendi kopyası" sanıp yerinde değiştirdiğinde, değişiklik başka isteklere ve başka modüllere sızar. Bu dersteki
takma ad ve sığ kopya tuzağının, binlerce dosyaya yayılmış hâlidir.

Instagram'ın çözümü, belirli modüllerin içe aktarılırken yan etki üretmesini ve dışarıdan değiştirilmesini
kısıtlayan "strict modules" adlı bir mekanizmaydı. Kendi kodunda aynı sorunu daha basit araçlarla azaltabilirsin:

- Paylaşılan sabit veriler için `tuple` ve `frozenset` gibi değiştirilemez koleksiyonlar kullan.
- Bir fonksiyona ya da başka bir modüle verdiğin listeyi, orada değiştirilmesini istemiyorsan kopyalayarak ver;
  iç içe yapılarda sığ kopyanın yetmeyeceğini unutma.
- Değiştirmek yerine yeni bir koleksiyon üret (comprehension ile); böylece kimse başkasının nesnesine dokunmaz.
:::

## Özet

- `list` sıralı ve değiştirilebilir; `append`, `extend`, `insert`, `pop`, `remove` yerinde çalışır ve çoğu
  `None` döndürür. `sort()` yerinde sıralar, `sorted()` yeni liste döndürür.
- `tuple` değiştirilemez; paketleme/açma ile çoklu atama ve takas yapılır. İçindeki liste yine değişebilir.
- `dict` anahtarları hash ile bulur; anahtar hashable olmalı. `get`, `setdefault`, `items` en çok kullanacağın
  araçlar; ekleme sırası 3.7'den beri korunur.
- `set` tekilliği garanti eder ve birleşim, kesişim, fark sunar. `in` sorgusu `set`/`dict`'te ortalamada O(1),
  `list`'te O(n).
- `b = a` takma addır. `copy()`, `[:]`, `list()` sığ kopyadır: iç nesneler paylaşılır. Tam bağımsızlık için
  `copy.deepcopy`.
- İç içe liste oluştururken `*` değil comprehension kullan.

:::exercise{src="tekillestir.exercise.json"}
:::

:::quiz{src="quiz.json"}
:::

:::next{lesson="k-06-fonksiyonlar-ve-cagri-yigini"}
:::

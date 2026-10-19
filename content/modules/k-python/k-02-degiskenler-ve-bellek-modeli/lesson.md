---
id: k-02-degiskenler-ve-bellek-modeli
slug: degiskenler-ve-bellek-modeli
module: k-python
order: 2
title:
  tr: "Değişkenler ve Bellek Modeli: İsimler, Nesneler ve Referanslar"
  en: "Variables and the Memory Model: Names, Objects and References"
summary:
  tr: "Değişkenin kutu değil etiket olduğunu; stack, heap, id() ve değiştirilebilirliği simülasyonla gör."
  en: "See that variables are labels, not boxes: stack, heap, id() and mutability, simulated."
durationMinutes: 25
level: beginner
tags: [python, degiskenler, bellek, referans, mutability]
prerequisites: [k-01-python-nasil-calisir]
concepts: [variable-binding, object-identity, stack-frame, heap, mutability, aliasing, pass-by-object-reference]
---

## Değişken nedir? Kutu değil, etiket

Birçok dilde değişken, bellekte belli büyüklükte bir **kutu** gibi anlatılır: `int x = 5` yazınca 4 baytlık bir
yer ayrılır ve içine 5 yazılır. Python'da durum farklıdır. Python'da **her değer bir nesnedir** (object) ve
nesneler belleğin **heap** denen bölgesinde yaşar. Değişken ise o nesneye yapıştırılmış bir **isim etiketidir**.

```python
yas = 30
```

Bu satır üç şey yapar:

1. Heap'te değeri `30` olan bir `int` nesnesi oluşturulur (ya da hazırdaki kullanılır).
2. Çalışan çerçevenin (frame) isim tablosuna `yas` adı eklenir.
3. `yas` adı o nesneye **bağlanır** (binding).

Python dokümantasyonunda bu yüzden "değişkene değer atamak" yerine çoğu zaman **"ismi nesneye bağlamak"**
denir. Bu küçük fark, Python'da karşılaşacağın birçok "garip" davranışın tek açıklamasıdır.

### Stack ve heap

Programın belleğini iki bölge olarak düşünmek işini kolaylaştırır:

| Bölge | Ne tutar? | Ne zaman oluşur/silinir? |
|---|---|---|
| **Çağrı yığını (stack)** | Her fonksiyon çağrısı için bir **çerçeve**: o çağrının yerel isimleri ve hangi satırda olduğu | Çağrıda çerçeve eklenir, `return` ile çıkarılır |
| **Heap** | Nesnelerin kendisi: sayılar, metinler, listeler, sözlükler, fonksiyonlar, sınıflar | Oluşturulunca eklenir; hiçbir isim ya da nesne onu göstermiyorsa silinir |

Çerçevedeki isim, heap'teki nesneyi **gösterir** (referans). Aşağıdaki simülasyonlarda soldaki tablo çerçeveleri,
sağdaki kutular heap'i gösterir; aradaki oklar referanslardır.

:::callout{tone="info" title="CPython ayrıntısı"}
Python'un en yaygın uygulaması olan CPython'da çerçeveler ve nesneler aslında işletim sistemi açısından aynı
heap belleğinde durur. "Stack" burada **fonksiyon çağrılarının yığını** anlamında kullanılır: mantıksal bir
modeldir ve kodun nasıl davrandığını doğru tahmin etmeni sağlar.
:::

## İlk simülasyon: etiketler ve değiştirilemez nesneler

Aşağıdaki programda sayılar ve metinler de heap'te ayrı nesneler olarak gösteriliyor (normalde simülasyonlar
kalabalık olmasın diye basit değerleri satır içinde gösterir). Her adımda **yeşil ok** çalışacak satırı,
**soluk ok** az önce çalışan satırı gösterir. Değişen değişken satırı ve yeni oluşan ya da değişen nesne
sarı ile vurgulanır.

:::trace{src="etiketler.trace.json" title="Etiketler ve değiştirilemez nesneler|Labels and immutable objects"}
İleri tuşuyla adım adım ilerle; `kopya = yas` satırında yeni nesne oluşmadığına dikkat et.
:::

Bu simülasyondan çıkarılacak üç ders:

- `kopya = yas` **kopyalamaz**. Sadece aynı nesneye ikinci bir etiket ekler.
- `yas = yas + 1`, 30 nesnesini **değiştirmez**. `int` değiştirilemez (immutable) bir türdür: toplama yeni bir
  nesne (31) üretir ve `yas` etiketi yeni nesneye taşınır. `kopya` hâlâ 30'u gösterir.
- Hiçbir etiketin göstermediği nesneye artık ulaşılamaz. CPython onu **referans sayımı** ile hemen temizler
  (ayrıntısı K-17 dersinde).

## Kimlik: id() ve is

Her nesnenin, yaşadığı süre boyunca değişmeyen bir **kimliği** vardır. `id(nesne)` bu kimliği bir tam sayı
olarak verir (CPython'da nesnenin bellek adresidir). `is` operatörü iki ismin **aynı nesneyi** gösterip
göstermediğini, `==` ise **değerlerinin eşit** olup olmadığını sorar.

:::code{lang="python" title="id, is ve =="}
```python
a = [1, 2, 3]
b = a          # aynı nesne
c = [1, 2, 3]  # aynı değerde, farklı nesne

print(id(a) == id(b))  # True
print(a is b)          # True  → aynı nesne
print(a == c)          # True  → değerler eşit
print(a is c)          # False → farklı nesneler
```
:::

:::callout{tone="warning" title="Sayıları is ile karşılaştırma"}
`x is 1000` gibi karşılaştırmalar bazen `True`, bazen `False` döner. CPython -5 ile 256 arasındaki küçük
tam sayıları ve bazı kısa metinleri önbellekte tutup yeniden kullanır; bu bir uygulama ayrıntısıdır.
**Değer karşılaştırmak için her zaman `==` kullan.** `is`'i yalnızca `None`, `True`, `False` gibi tekil
nesnelerle kullan: `if sonuc is None:`.
:::

## Değiştirilebilir (mutable) ve değiştirilemez (immutable) türler

Python türleri, nesnenin içeriği oluşturulduktan sonra değişebiliyor mu sorusuna göre ikiye ayrılır:

| Değiştirilemez (immutable) | Değiştirilebilir (mutable) |
|---|---|
| `int`, `float`, `bool`, `complex` | `list` |
| `str`, `bytes` | `dict` |
| `tuple`, `frozenset` | `set` |
| `None` | Kendi yazdığın sınıfların nesneleri (çoğunlukla) |

Değiştirilemez bir nesne üzerinde "değiştiren" görünen her işlem aslında **yeni bir nesne** üretir. Değiştirilebilir
nesnelerde ise `append`, `extend`, `sort`, `x[0] = ...`, `d["k"] = ...` gibi işlemler nesneyi **yerinde**
değiştirir. Aynı nesneyi gösteren tüm isimler değişikliği görür. Buna **takma ad (aliasing)** denir.

:::trace{src="liste-paylasimi.trace.json" title="Takma ad: iki isim, tek liste|Aliasing: two names, one list"}
`yedek.append(...)` sonrasında iki ismin de aynı listeyi gösterdiğini, `sepet[:]` ile ise yeni bir liste oluştuğunu izle.
:::

:::callout{tone="tip" title="Ne zaman kopya almalı?"}
Bir listeyi başka bir yere verip orada değiştirilmesini istemiyorsan kopyasını ver: `liste.copy()`,
`list(liste)` ya da `liste[:]`. İç içe listelerde bunlar **sığ kopyadır** (içteki listeler hâlâ paylaşılır);
tamamen bağımsız kopya için `copy.deepcopy` gerekir. Kopyalamayı K-05 dersinde simülasyonla ayrıntılı göreceğiz.
:::

### += operatörünün iki yüzü

`+=` operatörü türün değiştirilebilir olup olmamasına göre farklı davranır:

:::code{lang="python" title="+= listeyi yerinde değiştirir, int'i değiştiremez"}
```python
a = [1, 2]
b = a
a += [3]        # list.__iadd__: yerinde genişletir
print(b)        # [1, 2, 3]  → b de değişti

x = 5
y = x
x += 1          # int değiştirilemez: x yeni nesneye (6) bağlanır
print(y)        # 5
```
:::

## Fonksiyonlara argüman aktarımı

Python'da argümanlar ne "değer ile" (kopya) ne de klasik anlamda "referans ile" aktarılır. Doğru ad
**nesne referansıyla aktarım**dır (pass by object reference / call by sharing):

- Fonksiyon çağrıldığında yığına **yeni bir çerçeve** eklenir.
- Parametre isimleri, çağıranın verdiği **aynı nesnelere** bağlanır. Kopya alınmaz.
- Fonksiyon içinde nesneyi **değiştirirsen** (mutable ise) çağıran da değişikliği görür.
- Fonksiyon içinde parametre ismini **başka nesneye bağlarsan**, bu yalnızca yerel etiketi taşır; çağıranın
  değişkeni etkilenmez.

:::trace{src="fonksiyona-aktarim.trace.json" title="Nesne referansıyla aktarım|Pass by object reference"}
`ekle` çağrısında 'liste' parametresinin global 'notlar' ile aynı nesneyi gösterdiğine, `artir` içinde ise 'sayi'nın yeni nesneye taşındığına dikkat et.
:::

Simülasyonda gördüğün gibi `ekle` çağrısı bittiğinde çerçevesi yığından çıkarılır, ama listede yaptığı değişiklik
kalır: değişiklik çerçevede değil, heap'teki nesnededir. `artir` ise yalnızca kendi yerel `sayi` etiketini
taşıdı; global `puan` hâlâ 90.

:::callout{tone="danger" title="Klasik tuzak: değiştirilebilir varsayılan argüman"}
`def ekle(oge, liste=[])` gibi bir tanımda varsayılan liste **fonksiyon tanımlanırken bir kez** oluşturulur ve
her çağrıda aynı nesne kullanılır. Böylece çağrılar arasında veri sızar. Doğrusu `liste=None` verip fonksiyonun
içinde `if liste is None: liste = []` yazmaktır. Bu tuzağı K-06 dersinde simülasyonla göreceğiz.
:::

## Dinamik tipleme: tip isimde değil, nesnede

Python'da bir ismin tipi yoktur; **nesnenin** tipi vardır. Aynı isim önce bir sayıya, sonra bir metne bağlanabilir:

:::code{lang="python" title="Tip nesneye aittir"}
```python
deger = 42
print(type(deger))   # <class 'int'>
deger = "kırk iki"
print(type(deger))   # <class 'str'>
```
:::

Bu esneklik hızlı yazmayı sağlar ama hatalara da kapı açar. Büyük projelerde **tip ipuçları** (`deger: int = 42`)
ve `mypy` gibi araçlarla bu risk azaltılır (K-15 dersi). Python yine de **güçlü tipli** bir dildir: `"3" + 4`
otomatik dönüştürülmez, `TypeError` verir.

## Özet

- Değişken bir kutu değil, heap'teki bir nesneye bağlanmış **isimdir**. Atama kopyalamaz, bağlar.
- Her fonksiyon çağrısı yığına bir **çerçeve** ekler; çerçeve isimleri, heap nesneleri değerleri tutar.
- `is` kimliği, `==` değeri karşılaştırır. Sayı ve metinlerde `==` kullan.
- Değiştirilemez nesnelerde "değişiklik" yeni nesne üretir; değiştirilebilir nesneler yerinde değişir ve
  aynı nesneyi gösteren tüm isimler bunu görür.
- Argümanlar nesne referansıyla aktarılır: nesneyi değiştirmek çağıranı etkiler, ismi yeniden bağlamak etkilemez.

:::quiz{src="quiz.json"}
:::

:::next{lesson="k-03-veri-tipleri-ve-operatorler"}
:::

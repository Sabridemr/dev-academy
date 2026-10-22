---
id: k-17-bellek-yonetimi-ve-gc
slug: bellek-yonetimi-ve-gc
module: k-python
order: 17
title:
  tr: "Bellek Yönetimi: Referans Sayımı ve Çöp Toplayıcı"
  en: "Memory Management: Reference Counting and Garbage Collection"
summary:
  tr: "Nesnelerin ne zaman silindiğini, döngüsel referansları ve __slots__'u öğren."
  en: "Learn when objects are freed, how cyclic references are collected and __slots__."
durationMinutes: 26
level: advanced
tags: [python, bellek, garbage-collection, referans-sayimi, performans]
prerequisites: [k-16-solid-ve-dependency-injection]
concepts: [reference-counting, garbage-collection, reference-cycle, weak-reference, object-interning, memory-profiling, slots]
---

## Neden bellek yönetimini bilmelisin?

C gibi dillerde belleği sen ayırır (`malloc`) ve sen geri verirsin (`free`). Unutursan bellek sızar, iki kez
verirsen program çöker. Python bu yükü senden alır: nesne oluşturursun, işin bitince Python onu kendisi temizler.
Buna **otomatik bellek yönetimi** (automatic memory management) denir.

"Otomatik" demek "düşünmene gerek yok" demek değildir. Şu soruların cevabını bilmeyen bir Python geliştiricisi er
geç zorlanır:

- Bir nesne **tam olarak ne zaman** silinir? `del` yazınca mı?
- Sunucu günlerce çalışınca bellek neden sürekli büyüyor?
- Milyonlarca küçük nesne tutarken belleği nasıl yarıya indirebilirim?
- `a is b` bazen neden `True`, bazen `False`?

Bu derste CPython'un (Python'un standart uygulaması) belleği nasıl yönettiğini temelden kuracağız: nesne başlığı,
referans sayımı (reference counting), döngüsel çöp toplayıcı (cyclic garbage collector), zayıf referanslar,
önbellekler, `__slots__` ve ölçüm araçları. K-02 dersindeki "isim nesneye bağlanan etikettir" modelini biliyorsan
hazırsın.

:::callout{tone="info" title="Bu ders CPython'u anlatır"}
Dil standardı yalnızca "erişilemeyen nesneler bir gün temizlenebilir" der; **nasıl** yapılacağını uygulamaya bırakır.
Aşağıdaki ayrıntılar (referans sayımı, nesiller, küçük int önbelleği, bayt boyutları) CPython'a özgüdür. PyPy gibi
başka uygulamalar farklı davranabilir. Kodunu bu ayrıntılara **güvenerek** yazma; onları anlamak ve ölçmek için kullan.
:::

## Her nesnenin bir başlığı var

CPython'da heap'teki her nesne, asıl verisinden önce küçük bir **nesne başlığı** (object header) taşır. Bu başlıkta
en az iki alan bulunur:

| Alan | Ne tutar? | Neden gerekli? |
|---|---|---|
| `ob_refcnt` | Referans sayacı: bu nesneyi kaç referansın gösterdiği | Sayaç 0 olunca nesne hemen silinebilir |
| `ob_type` | Nesnenin tipine (`int`, `list`, senin sınıfın...) işaretçi | `type(x)`, metot arama ve davranış buradan gelir |

64 bit bir sistemde bu iki alan toplam 16 bayttır. Bu yüzden Python'da "küçük" bir değer bile birkaç düzine bayt
tutar: `sys.getsizeof(0)` 28 bayt döndürür. Listeler, sözlükler ve takip edilmesi gereken diğer nesneler bunlara ek
olarak çöp toplayıcının kullandığı alanlar da taşır.

:::callout{tone="info" title="Free-threaded yapıda başlık farklıdır"}
Python 3.13 ile gelen deneysel GIL'siz (free-threaded) yapıda referans sayacı, thread'ler arası yarışları azaltmak
için farklı bir yapıyla tutulur ve başlık daha büyüktür. Normal (varsayılan) yapıda yukarıdaki iki alanlı model geçerlidir.
:::

Aşağıdaki şema nesne başlığını ve belleği geri veren iki mekanizmayı bir arada gösteriyor; dersin geri kalanında
ikisini sırayla açacağız.

:::diagram{src="nesne-basligi-ve-nesiller.svg" alt="Bir list nesnesinin bellek düzeni: GC bağlantıları, ob_refcnt, ob_type ve veri; yanında referans sayımı ve genç ile yaşlı nesilli döngüsel çöp toplayıcı|Memory layout of a list object: GC links, ob_refcnt, ob_type and data; beside it reference counting and the cyclic garbage collector with young and old generations"}
Referans sayımı her zaman çalışır; döngüsel toplayıcı yalnızca konteyner nesnelerini izler.
:::

## Referans sayımı: temel mekanizma

CPython'un ana stratejisi basittir: her nesne, kendisini gösteren referansları sayar.

- Bir isim nesneye bağlanınca, nesne bir listeye eklenince, fonksiyona argüman olarak verilince sayaç **artar**.
- İsim başka nesneye bağlanınca, `del` ile silinince, liste nesneyi çıkarınca, fonksiyonun çerçevesi kapanınca
  sayaç **azalır**.
- Sayaç **0** olduğu anda nesne serbest bırakılır. Beklemek yok, ayrı bir temizlik turu yok.

Bu "hemen silme" özelliği referans sayımının en güzel tarafıdır: bellek, ihtiyaç bittiği satırda geri döner.

### sys.getrefcount neden bir fazla gösterir?

Sayacı `sys.getrefcount` ile görebilirsin. Ama ilk denemede çoğu kişi şaşırır:

:::code{lang="python" title="sys.getrefcount ile sayaç (Python 3.12 ve 3.14'te aynı çıktı)"}
```python
import sys

liste = []
print(sys.getrefcount(liste))   # 2 → 'liste' + getrefcount'un argümanı
diger = liste
print(sys.getrefcount(liste))   # 3
del diger
print(sys.getrefcount(liste))   # 2
```
:::

Listeyi yalnızca `liste` adı gösteriyor, ama çıktı 2. Sebep: `liste`'yi `getrefcount`'a **argüman olarak verirken**
geçici bir referans daha oluşur. Yani gördüğün sayı her zaman "gerçek sayı + 1"dir.

:::callout{tone="warning" title="getrefcount değerlerine bel bağlama"}
Bu sayılar yorumlayıcının iç ayrıntılarına bağlıdır ve sürümden sürüme değişir. Örneğin Python 3.14'te yorumlayıcı
bazı yerel değişken referanslarını saymadan "ödünç" kullanır; bir fonksiyon içindeki yerel listede
`sys.getrefcount` 3.12'de 2, 3.14'te 1 döndürür. Değeri yalnızca öğrenmek ve hata ayıklamak için kullan; asla
program mantığını bu sayıya göre kurma.
:::

Mekanizmanın tamamını, döngülerin neden ayrı bir toplayıcı gerektirdiğiyle birlikte aşağıdaki animasyonda
izleyebilirsin.

:::animation{scene="referans-sayimi-ve-gc.scene.json"}
Her adımda listenin `rc` rozetini takip et; ikinci yarıda iki düğümün sayacının neden 1'de takılı kaldığına ve
toplayıcının onları nasıl bulduğuna bak.
:::

## del ismi siler, nesneyi değil

Python'da en yaygın yanılgılardan biri `del x`'in "nesneyi bellekten sildiğini" sanmaktır. `del x` yalnızca
**`x` adını** çerçeveden kaldırır ve nesnenin sayacını bir azaltır. Nesneyi başka bir isim (ya da liste, sözlük,
nitelik) hâlâ gösteriyorsa nesne yaşamaya devam eder.

Aşağıdaki simülasyonda heap görünümü yalnızca **erişilebilir** (reachable) nesneleri çizer: herhangi bir çerçevedeki
bir isimden başlayıp oklarla ulaşılabilen nesneleri. Bir nesne görünümden kaybolduğunda, programın ona artık
ulaşamadığını anlarsın. Basit referans sayımı durumlarında bu, CPython'un nesneyi o anda serbest bıraktığı anlamına
gelir.

:::trace{src="del-ve-referanslar.trace.json" title="del ismi siler, nesneyi değil|del removes the name, not the object"}
İlk `del` sonrasında listenin heap'te kaldığına, ikinci `del` sonrasında ise kaybolduğuna dikkat et. Fonksiyon dönünce yerel liste de gidiyor.
:::

Simülasyondan çıkan kurallar:

- `del veri` sonrasında liste **yaşadı**, çünkü `yedek` onu gösteriyordu. Sayaç 2'den 1'e indi.
- `del yedek` son referansı kaldırdı, sayaç 0 oldu ve liste o anda serbest bırakıldı.
- Fonksiyonun yerel değişkenleri çerçeveyle birlikte yok olur. `return` ile dışarı verdiğin nesne ise yaşar,
  çünkü artık onu çağıran tutar.

Gerçek bir programda bunu `__del__` metoduyla gözleyebilirsin. `__del__`, nesne serbest bırakılmadan hemen önce
çağrılan özel bir metottur (finalizer):

:::code{lang="python" title="__del__ ne zaman çalışır?"}
```python
class Dosya:
    def __init__(self, ad):
        self.ad = ad
        print("açıldı:", ad)

    def __del__(self):
        print("silindi:", self.ad)

d = Dosya("rapor.txt")
e = d
del d
print("d silindi, e hâlâ tutuyor")
del e
print("program devam ediyor")
# açıldı: rapor.txt
# d silindi, e hâlâ tutuyor
# silindi: rapor.txt
# program devam ediyor
```
:::

`silindi:` satırı `del d` sonrasında değil, **son referans** olan `e` silindiğinde yazıldı.

## Referans döngüleri: sayımın kör noktası

Referans sayımı tek başına her şeyi çözemez. İki nesne **birbirini gösteriyorsa**, dışarıdan hiçbir isim onlara
ulaşamasa bile her birinin sayacı en az 1'de kalır. Buna **referans döngüsü** (reference cycle) denir. Çift yönlü
bağlı listeler, ebeveyn-çocuk ağaçları (çocuk `parent` niteliğiyle ebeveyni gösterir), kendine referans veren
nesneler ve yakalanmış istisnaların traceback'leri sık rastlanan döngü kaynaklarıdır.

:::trace{src="dongusel-referans.trace.json" title="Referans döngüsü ve çöp toplayıcı|Reference cycle and the garbage collector"}
İki `komsu` okunun birbirini gösterdiği anı ve iki `del` sonrasında nesnelerin görünümden kaybolduğunu izle. Görünmemeleri, silindikleri anlamına gelmiyor.
:::

Son adımlarda X ve Y heap görünümünden kayboldu, çünkü hiçbir isimden onlara ulaşılamıyor. Ama burada önemli bir
fark var: ilk simülasyondaki listenin sayacı 0'a inmişti ve hemen silinmişti. X ve Y'nin sayaçları ise **1'de**
kaldı (birbirlerini tutuyorlar). Referans sayımı onları asla silemez. Bunlar **erişilemeyen ama canlı**
nesnelerdir: çöp.

:::interactive{type="python-memory" scenario="refcount-gc" title="Kendin dene: sayaç sıfıra inince|Try it: when the count hits zero"}
"Adım ileri" ile ilerle ve sağdaki kartlarda `ref=` sayacını izle: `b = a` sayacı 2'ye çıkarır, `del a` yalnızca ismi siler (sayaç 1), `b = None` ile sayaç 0'a iner ve liste hemen "silindi" olarak görünür. `del dis` dış listeyle birlikte içteki iki listeyi de zincirleme siler. `dugum.append(dugum)` kendini gösteren bir döngü kurar: `del dugum` sonrasında liste `ref=1` ile kalır ve "erişilemez (döngü)" uyarısı çıkar; son satırdaki `gc.collect()` (aşağıda anlatılan döngüsel toplayıcı) onu toplar. "Silinen nesne" sayacı o ana kadar silinenlerin toplamıdır; "Kodu düzenle" ile kendi senaryonu da deneyebilirsin.
:::

### Döngüsel çöp toplayıcı ve nesiller

CPython bu durum için ikinci bir mekanizma çalıştırır: **döngüsel çöp toplayıcı** (cyclic garbage collector, kısaca
GC). `gc` modülüyle kontrol edilir. Kabaca şöyle çalışır:

1. Başka nesneleri tutabilen **taşıyıcı** (container) nesneleri izler: listeler, sözlükler, sınıf örnekleri...
   (int ve str gibi başka nesne tutamayanları izlemez, çünkü onlar döngü kuramaz.)
2. Bir grup nesne için, grubun **içinden** gelen referansları sayaçlardan düşer.
3. Sayacı sıfıra inen, yani yalnızca grup içinden tutulan nesneler erişilemezdir; bunları siler.

Her şeyi sık sık taramak pahalı olurdu. Bu yüzden GC **nesil** (generation) fikrini kullanır. Gözlem şudur:
nesnelerin çoğu genç ölür (geçici listeler, ara sonuçlar). Yeni nesneler genç nesilde başlar ve sık taranır;
birkaç taramadan sağ çıkanlar yaşlı nesle geçer ve daha seyrek taranır.

:::code{lang="python" title="gc modülü ile döngüyü toplamak"}
```python
import gc

class Dugum:
    def __init__(self, ad):
        self.ad = ad
        self.komsu = None

gc.collect()                 # önce ortalığı temizle
x = Dugum("X")
y = Dugum("Y")
x.komsu = y
y.komsu = x
del x, y                     # döngü erişilemez kaldı
print(gc.collect())          # 2 → iki Dugum nesnesi bulundu ve silindi
print(gc.get_threshold())    # 3.14'te (2000, 10, 10), 3.12'de (700, 10, 10)
```
:::

`gc.collect()` erişilemez bulduğu nesne sayısını döndürür. Python 3.12 ve 3.14'te bu örnek 2 yazdırır; çok eski
sürümlerde nesnelerin `__dict__` sözlükleri de ayrıca sayıldığı için farklı bir sayı görebilirsin. Eşik değerleri
sürüme göre değişir: CPython 3.12'de klasik üç nesil vardı; 3.14'te toplayıcı **artımlı** (incremental) çalışacak
şekilde yeniden düzenlendi ve kavramsal olarak genç ve yaşlı nesillere indirildi. Ayrıntı ne olursa olsun fikir aynıdır:
genç nesneler sık, eski nesneler seyrek taranır.

Normalde `gc.collect()`'i elle çağırman gerekmez; GC, nesne ayırma sayısı eşiği aşınca kendiliğinden çalışır. Elle
çağırmak, test sırasında ya da büyük bir veri yapısını bıraktıktan hemen sonra belleğin geri döndüğünden emin olmak
istediğinde işe yarar.

## Zayıf referanslar: tutmadan göstermek

Bazen bir nesneyi **göstermek** ama onu **canlı tutmamak** istersin. Tipik örnek önbellektir: "Bu resim hâlâ
kullanılıyorsa önbellekten ver, kimse kullanmıyorsa silinsin." Normal bir sözlük nesneyi sonsuza kadar canlı tutar.
**Zayıf referans** (weak reference) ise sayacı artırmaz.

:::code{lang="python" title="weakref ile kendini temizleyen önbellek"}
```python
import weakref

class Resim:
    def __init__(self, ad):
        self.ad = ad

onbellek = weakref.WeakValueDictionary()
logo = Resim("logo.png")
onbellek["logo"] = logo
print(onbellek.get("logo").ad)   # logo.png
del logo
print(onbellek.get("logo"))      # None → nesne silindi, kayıt da kendiliğinden düştü
```
:::

Döngüleri baştan önlemek için de kullanılır: ağaçta çocuk ebeveyni `weakref.ref(ebeveyn)` ile gösterirse döngü
oluşmaz ve ağaç referans sayımıyla anında temizlenir. Zayıf referansı çağırarak (`r()`) nesneyi alırsın; nesne
silinmişse `None` döner. Her nesne zayıf referans kabul etmez: `int`, `str`, `tuple` gibi yerleşik tipler ve
`__slots__` içinde `__weakref__` olmayan sınıflar kabul etmez.

## __del__'e güvenme

`__del__` cazip görünür: "Nesne silinince dosyayı kapatırım." Ama bu yaklaşım sorunludur:

:::callout{tone="danger" title="__del__ ile kaynak yönetme"}
- **Ne zaman** çalışacağı garanti değildir. Nesne bir döngüdeyse GC'nin bir sonraki turunu bekler; PyPy gibi referans
  sayımı yapmayan uygulamalarda çok daha geç çalışabilir. Program kapanırken hiç çalışmayabilir de.
- İçinde oluşan istisnalar **yutulur**: çağırana ulaşmaz, sadece stderr'e bir uyarı basılır.
- `__del__` içinde `self`'i bir yere kaydedersen nesne "dirilir" (resurrection) ve kafa karıştırıcı hatalar doğar.

Dosya, soket, veritabanı bağlantısı gibi kaynakları **`with` bloğu** (context manager) ile yönet: kaynak bloğun
sonunda, hata olsa bile, belirli bir anda kapanır. Bir nesne silinince mutlaka bir şey yapılması gerekiyorsa
`weakref.finalize` daha güvenli bir alternatiftir.
:::

:::callout{tone="info" title="Derinleşme: küçük int önbelleği ve string interning"}

K-02'de `is` ile sayı karşılaştırmanın tehlikeli olduğunu görmüştük. Şimdi nedenini bellek açısından görelim.
CPython, çok kullanılan bazı nesneleri **bir kez** oluşturup tekrar tekrar kullanır:

- **Küçük int önbelleği:** -5 ile 256 arasındaki tam sayılar yorumlayıcı başlarken oluşturulur. `x = 7` yazdığında
  yeni nesne yaratılmaz, hazırdaki 7 kullanılır.
- **String interning:** Tanımlayıcıya benzeyen (harf, rakam, alt çizgi) kısa metin sabitleri ve değişken/nitelik
  adları tek bir kopya olarak saklanır. `sys.intern(s)` ile bir metni elle de intern edebilirsin.

```python
a = 256
b = 256
print(a is b)              # True  → küçük int önbelleği

x = int("1000")
y = int("1000")
print(x == y, x is y)      # True False → iki ayrı nesne

s1 = "merhaba"
s2 = "merhaba"
print(s1 is s2)            # True  → derleyici bu sabiti intern etti

t1 = "".join(["mer", "haba"])
print(t1 == s1, t1 is s1)  # True False → çalışma anında üretildi
```

Sonuçlar bu kadar kırılgandır: aynı değer, oluşturulma biçimine göre aynı ya da farklı nesne olabilir. Bir
fonksiyonun içinde `1000` sabitini iki kez yazarsan derleyici tek nesne kullanabilir ve `is` bu sefer `True`
dönebilir. Kural değişmez: **değer için `==`, tekil nesneler (`None`, `True`, `False`) için `is`.**
:::

## Nesneler ne kadar yer kaplar?

`sys.getsizeof(nesne)` bir nesnenin **kendi** boyutunu bayt cinsinden verir:

:::code{lang="python" title="sys.getsizeof ve listenin fazladan yer ayırması (64 bit, CPython 3.12 ve 3.14)"}
```python
import sys

print(sys.getsizeof(0))      # 28
print(sys.getsizeof(2**30))  # 32 → büyük sayılar daha çok yer tutar
print(sys.getsizeof(""))     # 41
print(sys.getsizeof([]))     # 56

liste = []
onceki = sys.getsizeof(liste)
for i in range(20):
    liste.append(i)
    boyut = sys.getsizeof(liste)
    if boyut != onceki:
        print(f"uzunluk {len(liste):2} → {boyut} bayt")
        onceki = boyut
# uzunluk  1 → 88 bayt
# uzunluk  5 → 120 bayt
# uzunluk  9 → 184 bayt
# uzunluk 17 → 248 bayt
```
:::

Liste her `append`'te büyümüyor; ara ara **sıçrıyor**. Buna **fazladan yer ayırma** (over-allocation) denir. Liste
dolduğunda CPython yalnızca bir eleman için değil, gelecekteki eklemeler için de yer ayırır (bu sürümlerde 1. elemanda
4, 5. elemanda 8, 9. elemanda 16 kapasiteye çıkar; her eleman 64 bit sistemde 8 baytlık bir işaretçidir). Böylece
`append` ortalamada sabit zamanda (amortized O(1)) çalışır. Bedeli, listenin çoğu zaman biraz boş yer taşımasıdır.

:::callout{tone="warning" title="getsizeof derin boyutu vermez"}
`sys.getsizeof([ic_liste])` yalnızca dış listenin **işaretçi dizisini** ölçer; içindeki nesnelerin boyutunu eklemez.
On elemanlı bir listeyi içeren tek elemanlı liste 64 bayt görünür, iç liste ayrıca 136 bayttır. Bir veri yapısının
toplam bellek kullanımını öğrenmek için `tracemalloc` gibi araçları kullan.
:::

## __slots__ ile bellek kazancı

Normal bir sınıfın örneği niteliklerini bir sözlükte (`__dict__`) tutar. Bu esneklik sağlar (istediğin an yeni nitelik
ekleyebilirsin) ama her örnek için ek bellek demektir. `__slots__` ile sınıfın hangi nitelikleri olacağını önceden
söylersen, CPython sözlük yerine sabit yerli, sıkı bir yapı kullanır.

:::code{lang="python" title="__slots__ ile 100 bin nesne (CPython 3.14, macOS; değerler ortama göre biraz değişir)"}
```python
import tracemalloc


class Nokta:
    def __init__(self, x, y):
        self.x = x
        self.y = y


class SlotNokta:
    __slots__ = ("x", "y")

    def __init__(self, x, y):
        self.x = x
        self.y = y


def olc(sinif):
    tracemalloc.start()
    noktalar = [sinif(i, i) for i in range(100_000)]
    simdiki, _ = tracemalloc.get_traced_memory()
    tracemalloc.stop()
    return simdiki / 1_000_000


print(f"Nokta:     {olc(Nokta):.1f} MB")      # Nokta:     12.8 MB
print(f"SlotNokta: {olc(SlotNokta):.1f} MB")  # SlotNokta: 8.8 MB
print(hasattr(SlotNokta(1, 2), "__dict__"))   # False
```
:::

Bu ölçüm sayıların kendisini ve listeyi de içerir; yine de nokta başına belirgin bir kazanç var (3.12'de de benzer:
yaklaşık 12.0 MB ve 8.8 MB). Python 3.11 ve 3.12 normal örneklerin `__dict__`'ini zaten sıkıştırdığı için kazanç eski
sürümlerdeki kadar büyük değildir, ama milyonlarca nesnede hâlâ önemlidir.

Bedeli: `__slots__` olan bir sınıfa listede olmayan nitelik ekleyemezsin (`AttributeError`), zayıf referans
istiyorsan `"__weakref__"`'i slot listesine eklemen gerekir ve kalıtımda her alt sınıfın da `__slots__` tanımlaması
gerekir. `@dataclass(slots=True)` (Python 3.10+) aynı şeyi tek parametreyle yapar.

## Bellek sızıntısı desenleri

Otomatik yönetilen dillerde de bellek sızar. Burada "sızıntı", artık ihtiyacın olmayan nesneleri **hâlâ erişilebilir**
tutmak demektir: GC onları çöp sayamaz, çünkü teknik olarak çöp değiller.

:::trace{src="onbellek-sizintisi.trace.json" title="Global önbellek sızıntısı|A global cache leak"}
Her çağrıda önbellek sözlüğüne yeni bir kayıt eklendiğini ve `k` başka kayda geçse bile eski kayıtların heap'te kaldığını izle.
:::

Bu küçük örnekte üç kayıt sorun değil. Ama aynı kod bir web sunucusunda her istekte farklı kullanıcı kimliğiyle
çağrılırsa önbellek **sınırsız büyür** ve sunucu günler içinde belleği tüketir. Sık görülen sızıntı desenleri:

| Desen | Neden sızar? | Çözüm |
|---|---|---|
| Sınırsız global önbellek | Sözlük her şeyi sonsuza kadar tutar | `functools.lru_cache(maxsize=...)`, boyut ya da süre sınırı, `WeakValueDictionary` |
| Hiç çıkarılmayan dinleyiciler (listener) | Olay yayıncısı abonelerin listesini tutar | Aboneliği iptal et ya da `weakref` ile tut |
| Kapanmayan kaynaklar | Açık dosya, soket, bağlantı nesneleri ve tamponları kalır | `with` bloğu kullan |
| Büyük nesneyi yakalayan closure | İç fonksiyon dış değişkeni canlı tutar | Yalnızca gereken küçük değeri yakala |
| Saklanan istisnalar | Traceback, tüm çerçeveleri ve yerel değişkenleri tutar | İstisnayı uzun süre saklama, gerekirse yalnızca mesajını sakla |

## tracemalloc ile ölçmek

Tahmin etme, ölç. Standart kütüphanedeki `tracemalloc` modülü Python'un yaptığı bellek ayırmalarını izler ve hangi
satırın ne kadar bellek ayırdığını söyler:

:::code{lang="python" title="En çok bellek ayıran satırları bulmak"}
```python
import tracemalloc

tracemalloc.start()
kayitlar = [str(i) * 10 for i in range(50_000)]
anlik = tracemalloc.take_snapshot()
for istatistik in anlik.statistics("lineno")[:2]:
    print(istatistik)
# ornek.py:4: size=4769 KiB, count=50001, average=98 B
```
:::

Sızıntı ararken iki anlık görüntü (snapshot) al: biri işlemden önce, biri sonra. `sonra.compare_to(once, "lineno")`
hangi satırın belleği büyüttüğünü gösterir. Uzun çalışan bir serviste bu karşılaştırmayı belirli aralıklarla yapmak,
sızıntının kaynağını bulmanın en hızlı yoludur.

:::callout{tone="tip" title="Gerçek hayattan: büyüyen bir işçi süreci"}
Bir arka plan işçisi her görevde bir raporun özetini "sonra lazım olur" diye modül düzeyindeki bir sözlüğe atıyor.
Bellek grafiği her gün testere dişi yerine düz bir rampa çiziyor. `tracemalloc` karşılaştırması büyümenin o sözlüğe
ekleme yapan satırda olduğunu gösteriyor. Çözüm: sözlüğü `lru_cache(maxsize=1000)` ile değiştirmek ya da özetleri
veritabanına yazmak.
:::

:::realworld{company="Instagram"}
Instagram Engineering'in 2017 tarihli **"Dismissing Python Garbage Collection at Instagram"** yazısı, bu dersteki
iki mekanizmanın üretimde nasıl beklenmedik bir maliyet doğurabileceğini anlatır. Instagram'ın Django sunucuları
uWSGI ile çalışır: bir ana süreç uygulamayı yükler ve işçi süreçleri `fork` ile çoğaltır. İşletim sistemi bellek
sayfalarını **yazma anında kopyalama** (copy-on-write) ile paylaştırdığı için işçiler başlangıçta ana sürecin
belleğini ortak kullanır. Ekip, bu paylaşılan belleğin zamanla eridiğini fark etti. Sebep, nesneleri yalnızca
**okumanın** bile başlıklarına yazmasıydı: referans sayacı güncellemeleri ve döngüsel toplayıcının tarama sırasında
nesne başlıklarına dokunması, sayfaların her işçide ayrı ayrı kopyalanmasına yol açıyordu.

Ekip döngüsel toplayıcıyı kapatmayı denedi ve paylaşılan belleğin arttığını, CPU verimliliğinin iyileştiğini
gözlemledi. Bu çalışmanın ardından CPython'a Python 3.7 ile `gc.freeze()` eklendi: `fork` öncesinde çağrıldığında
o ana kadarki tüm izlenen nesneleri kalıcı bir nesle taşır ve toplayıcı onları bir daha taramaz. Ders şudur:
bellek yönetimi ayrıntıları çoğu programda görünmezdir, ama yüzlerce işçi süreçli bir serviste ölçülebilir fark yaratır.
Böyle bir ayar yapmadan önce mutlaka ölç.
:::

## Özet

- CPython'da her nesnenin başlığında bir **referans sayacı** ve **tip işaretçisi** vardır; sayaç 0 olunca nesne o anda silinir.
- `sys.getrefcount` argüman referansı yüzünden 1 fazla gösterir ve değerleri sürüme bağlıdır; yalnızca öğrenmek için kullan.
- `del` **ismi** siler; nesne, başka bir referans kaldıkça yaşar.
- Birbirini gösteren nesneler (döngüler) referans sayımıyla silinemez; onları **nesil** temelli döngüsel çöp toplayıcı (`gc`) bulur.
- `weakref` nesneyi canlı tutmadan gösterir; önbelleklerde ve ebeveyn bağlantılarında döngüleri önler. Kaynakları `__del__` ile değil `with` ile yönet.
- Küçük int önbelleği ve string interning yüzünden `is` değer karşılaştırmasında güvenilmezdir; `==` kullan.
- `sys.getsizeof` yalnızca nesnenin kendisini ölçer; listeler fazladan yer ayırır, `__slots__` örnek başına belleği azaltır ve sızıntılar `tracemalloc` ile bulunur.

:::quiz{src="quiz.json"}
:::

:::next{lesson="k-18-eszamanlilik-ve-asyncio"}
:::

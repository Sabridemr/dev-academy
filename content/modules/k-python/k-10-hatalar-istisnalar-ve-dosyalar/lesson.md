---
id: k-10-hatalar-istisnalar-ve-dosyalar
slug: hatalar-istisnalar-ve-dosyalar
module: k-python
order: 10
title:
  tr: "Hatalar, İstisnalar, Dosyalar ve Context Manager"
  en: "Errors, Exceptions, Files and Context Managers"
summary:
  tr: "try/except/finally, kendi istisnaların, with bloğu ve dosya okuma/yazmayı öğren."
  en: "Learn try/except/finally, custom exceptions, the with statement and file I/O."
durationMinutes: 25
level: intermediate
tags: [python, istisnalar, hata-yonetimi, dosyalar, context-manager, json]
prerequisites: [k-09-comprehension-ve-fonksiyonel-araclar]
concepts: [exception, try-except, exception-propagation, custom-exception, exception-chaining, file-io, context-manager, json]
---

## Hata neden bir nesne?

Gerçek programlar hep "beklenmedik" durumlarla karşılaşır: kullanıcı yaş alanına "otuz" yazar, dosya diskte
yoktur, ağ kopar, bir liste boş gelir. Eski tarz dillerde her fonksiyon bir **hata kodu** döndürür ve çağıran her
seferinde bu kodu kontrol etmek zorunda kalırdı. Kontrolü unuttuğun anda hata sessizce kaybolurdu.

Python başka bir yol seçer: bir işlem yapılamadığında **istisna (exception)** fırlatılır. İstisna, heap'te yaşayan
sıradan bir **nesnedir**: türü (`ValueError`, `KeyError`...), mesajı ve nerede oluştuğunu anlatan bir **iz
(traceback)** taşır. Fırlatılan istisna bulunduğu fonksiyonu anında durdurur ve onu yakalayan biri çıkana kadar
**çağrı yığınında (call stack) yukarı doğru** ilerler. Kimse yakalamazsa program durur ve traceback ekrana basılır.

Bu modelin iki büyük faydası var:

- Hatayı **görmezden gelemezsin**: yakalamadığın istisna programı durdurur, sessizce yanlış sonuç üretmez.
- Hatayı **nerede ele alacağına sen karar verirsin**: hatanın oluştuğu yer ile onu anlamlı şekilde ele alabilecek
  yer genellikle farklıdır (örneğin derin bir yardımcı fonksiyon ile kullanıcıya mesaj gösteren üst katman).

## Traceback okumayı öğren

Aşağıdaki küçük program boş bir listenin ortalamasını almaya çalışıyor:

:::code{lang="python" title="ortalama.py"}
```python
def ortalama(notlar):
    return sum(notlar) / len(notlar)


def rapor(sinif):
    print("Ortalama:", ortalama(sinif))


rapor([])
```
:::

Çalıştırınca şunu görürsün (Python 3.13+ çıktısı; `~~~^^^` işaretleri 3.11 ile geldi):

:::code{lang="bash" title="Terminal"}
```bash
$ python3 ortalama.py
Traceback (most recent call last):
  File "ortalama.py", line 9, in <module>
    rapor([])
    ~~~~~^^^^
  File "ortalama.py", line 6, in rapor
    print("Ortalama:", ortalama(sinif))
                       ~~~~~~~~^^^^^^^
  File "ortalama.py", line 2, in ortalama
    return sum(notlar) / len(notlar)
           ~~~~~~~~~~~~^~~~~~~~~~~~~
ZeroDivisionError: division by zero
```
:::

Traceback'i **aşağıdan yukarı** oku:

1. **En alt satır**: istisnanın türü ve mesajı. Önce buna bak: `ZeroDivisionError: division by zero`.
2. **Hemen üstü**: hatanın gerçekten oluştuğu satır (`ortalama` içindeki bölme).
3. **Daha yukarısı**: o satıra nasıl gelindiği, yani hata anındaki çağrı yığını. "most recent call last" ifadesi en
   son yapılan çağrının en altta olduğunu söyler.

Traceback aslında hata anındaki **yığının fotoğrafıdır**. Hatanın sebebi çoğu zaman en alttaki satırda değil, daha
yukarıda yanlış veri gönderen çağrıdadır: burada asıl soru "rapor neden boş liste aldı?" sorusudur.

## İstisna hiyerarşisi

İstisnalar sınıflardır ve bir **kalıtım ağacı** oluşturur (kalıtımı K-13'te ayrıntılı göreceksin). Ağacın kökünde
`BaseException` vardır. Altında programdan çıkış için kullanılan özel istisnalar (`SystemExit`, `KeyboardInterrupt`)
ve senin ilgileneceğin hemen her şeyin atası olan `Exception` durur.

:::code{lang="python" title="Hiyerarşiyi sorgulamak"}
```python
print(issubclass(ZeroDivisionError, ArithmeticError))  # True
print(issubclass(KeyboardInterrupt, Exception))        # False
print(ZeroDivisionError.__mro__)
# (<class 'ZeroDivisionError'>, <class 'ArithmeticError'>,
#  <class 'Exception'>, <class 'BaseException'>, <class 'object'>)
```
:::

`except ArithmeticError:` yazarsan `ZeroDivisionError` da yakalanır, çünkü o bir `ArithmeticError`'dır. Sık
karşılaşacağın türler:

| İstisna | Ne zaman? | Örnek |
|---|---|---|
| `ValueError` | Tür doğru ama değer uygunsuz | `int("otuz")` |
| `TypeError` | İşlem bu türle yapılamaz | `"3" + 4` |
| `KeyError` | Sözlükte anahtar yok | `{}["ad"]` |
| `IndexError` | Dizin aralık dışında | `[1, 2][5]` |
| `AttributeError` | Nesnede böyle nitelik yok | `None.upper()` |
| `ZeroDivisionError` | Sıfıra bölme | `1 / 0` |
| `FileNotFoundError` | Dosya yok (`OSError` alt türü) | `open("yok.txt")` |
| `NameError` | İsim tanımlı değil | `print(tanimsiz)` |
| `StopIteration` | Iterator bitti (K-11) | `next(iter([]))` |
| `KeyboardInterrupt` | Kullanıcı Ctrl+C bastı (`Exception` değil!) | — |

## try / except / else / finally

Hatayı yakalamak için riskli kodu `try` bloğuna koyarsın. Dört parçanın her birinin net bir görevi vardır:

| Blok | Ne zaman çalışır? | Ne için? |
|---|---|---|
| `try` | Her zaman (ilk hataya kadar) | Riskli işlem |
| `except Tur` | try içinde **o türden** bir istisna fırlarsa | Hatayı ele almak |
| `else` | try **hiç hata fırlatmadan** biterse | Yalnızca başarı durumunda yapılacak iş |
| `finally` | **Her durumda**, hata olsa da olmasa da, `return` olsa bile | Temizlik: dosya, bağlantı, kilit |

Şimdi aynı fonksiyonun iki kez çağrıldığı programı adım adım izle. Birinci çağrıda bölme başarılı, ikincisinde
sıfıra bölme var.

:::trace{src="try-akisi.trace.json" title="try/except/else/finally: iki yol|try/except/else/finally: two paths"}
İlk çağrıda `try → else → finally`, ikinci çağrıda `try → except → finally` sırasını izle. Hata adımında akışın `sonuc = a / b` satırından doğrudan `except` satırına atladığına dikkat et.
:::

Simülasyondan çıkarılacaklar:

- Hata fırladığı anda `try` içindeki **kalan satırlar atlanır**. İkinci çağrıda `sonuc` hiç atanmadı; ona değeri
  `except` bloğu verdi.
- `else` gereksiz gibi görünse de değerlidir: `try` bloğunu yalnızca hata çıkabilecek satırla sınırlı tutmanı
  sağlar. Başarı sonrası kodu `try` içine koyarsan, oradaki beklenmedik bir hatayı da yanlışlıkla yakalayabilirsin.
- `finally` iki yolda da çalıştı.

### Birden fazla except

Farklı hatalara farklı tepki vermek için birden fazla `except` yazabilirsin. Python bunları **yukarıdan aşağı**
dener ve **ilk uyanı** çalıştırır; bu yüzden özel türler üstte, genel türler altta olmalı. Birden fazla türü tek
blokta yakalamak için demet kullan: `except (ValueError, TypeError):`.

:::code{lang="python" title="Hataya göre farklı tepki"}
```python
def fiyat_coz(metin):
    try:
        return float(metin)
    except ValueError:
        print("Sayı değil:", repr(metin))
    except TypeError:
        print("Metin bekleniyordu, gelen:", type(metin).__name__)
    return None


print(fiyat_coz("12.5"))    # 12.5
print(fiyat_coz("on iki"))  # Sayı değil: 'on iki'  sonra  None
print(fiyat_coz(None))      # Metin bekleniyordu, gelen: NoneType  sonra  None
```
:::

`except ValueError as hata:` yazınca istisna nesnesi `hata` ismine bağlanır; `str(hata)` mesajı verir. Bu isim
`except` bloğu bitince **silinir** (Python bunu bellek sızıntısını önlemek için yapar).

## İstisna yığında nasıl yayılır?

Bir fonksiyonda yakalanmayan istisna o fonksiyonu yarıda bırakır, çerçevesini yığından çıkarır ve **çağırana**
geçer. Çağıranda da uygun `try` yoksa o da kapanır. Bu, uygun bir `except` bulunana ya da en üste ulaşılana kadar
sürer. Buna **yayılma (propagation)** ya da yığının **çözülmesi (stack unwinding)** denir.

:::trace{src="yayilma.trace.json" title="İstisnanın yığında yayılması|Exception propagating up the stack"}
İkinci kayıtta ('otuz') hatanın `yas_coz` içinde doğduğunu, `kayit_olustur` çerçevesinin de yarıda kapandığını ve hatanın ancak `kaydet` içindeki try tarafından yakalandığını izle.
:::

Burada önemli bir tasarım fikri var: `yas_coz` ve `kayit_olustur` hatayla ne yapacaklarını **bilmiyor**, o yüzden
yakalamıyorlar. Hatalı kaydı atlayıp devam etmeye karar verebilecek tek yer, kayıt listesini yöneten `kaydet`
fonksiyonu. **Hatayı, onunla anlamlı bir şey yapabileceğin yerde yakala.** Her fonksiyona `try` serpiştirmek kodu
okunmaz yapar.

## raise: hatayı kendin fırlatmak

Fonksiyonun geçersiz bir girdiyle karşılaştığında yanlış bir sonuç döndürmek yerine `raise` ile istisna fırlat.
Kendi hata türlerini tanımlamak için `Exception`'dan türeyen bir sınıf yazman yeterli:

:::code{lang="python" title="Kendi istisna sınıfın"}
```python
class YetersizBakiyeHatasi(Exception):
    """Hesapta yeterli para olmadığında fırlatılır."""

    def __init__(self, bakiye, tutar):
        super().__init__(f"Bakiye {bakiye} TL, çekilmek istenen {tutar} TL")
        self.bakiye = bakiye
        self.tutar = tutar


def para_cek(bakiye, tutar):
    if tutar <= 0:
        raise ValueError("Tutar pozitif olmalı")
    if tutar > bakiye:
        raise YetersizBakiyeHatasi(bakiye, tutar)
    return bakiye - tutar


try:
    para_cek(100, 250)
except YetersizBakiyeHatasi as e:
    print("Hata:", e)                    # Hata: Bakiye 100 TL, çekilmek istenen 250 TL
    print("Eksik:", e.tutar - e.bakiye)  # Eksik: 150
```
:::

Kendi istisna sınıfının iki faydası var: çağıran **yalnızca bu durumu** ayrıca yakalayabilir ve istisna nesnesi
hatayla ilgili ek veri (`bakiye`, `tutar`) taşıyabilir. Bir kütüphane yazıyorsan tüm hatalarını ortak bir
`KutuphaneHatasi` sınıfından türetmek de yaygın bir pratiktir. (`class`, `__init__` ve `super()` K-12 ve K-13'te
ayrıntılı anlatılıyor; şimdilik kalıbı tanı.)

### Yeniden fırlatma ve zincirleme

Bazen hatayı yakalayıp bir şey yapmak (örneğin günlüğe yazmak) ama sonra **yine de yukarı iletmek** istersin.
`except` içinde tek başına `raise` yazmak, yakalanan istisnayı traceback'iyle birlikte aynen yeniden fırlatır.

Alt seviyedeki bir hatayı daha anlamlı bir hataya çevirmek istediğinde ise `raise YeniHata(...) from e` kullan.
Buna **istisna zincirleme (exception chaining)** denir: yeni istisnanın `__cause__` niteliği eskisini gösterir ve
traceback iki hatayı da "The above exception was the direct cause of the following exception" satırıyla birlikte
basar. Böylece asıl sebep kaybolmaz.

:::code{lang="python" title="raise ve raise ... from"}
```python
import json
import logging


class AyarHatasi(Exception):
    pass


def ayar_oku(metin):
    try:
        return json.loads(metin)
    except json.JSONDecodeError as e:
        raise AyarHatasi("Ayar dosyası bozuk") from e   # zincirle


def kaydet():
    try:
        1 / 0
    except ZeroDivisionError:
        logging.error("Kayıt başarısız")
        raise                                           # aynısını yeniden fırlat


try:
    ayar_oku('{"port": 80,}')        # sondaki virgül JSON'da geçersiz
except AyarHatasi as e:
    print(e)                          # Ayar dosyası bozuk
    print(type(e.__cause__).__name__) # JSONDecodeError
```
:::

## EAFP ve LBYL

Python topluluğunda iki yaklaşım konuşulur:

- **LBYL** (Look Before You Leap, "atlamadan önce bak"): önce kontrol et, sonra yap. `if "ad" in d: print(d["ad"])`
- **EAFP** (Easier to Ask Forgiveness than Permission, "izin istemektense af dilemek kolaydır"): doğrudan dene,
  olmazsa istisnayı yakala.

:::code{lang="python" title="Aynı iş, iki tarz"}
```python
stok = {"elma": 3}

# LBYL
if "armut" in stok:
    print(stok["armut"])
else:
    print("yok")

# EAFP
try:
    print(stok["armut"])
except KeyError:
    print("yok")

# Çoğu zaman en iyisi: hazır araç
print(stok.get("armut", 0))   # 0
```
:::

Python EAFP'ye yatkındır. Özellikle dosya gibi dış kaynaklarda LBYL'nin bir **yarış durumu (race condition)**
sorunu vardır: `if path.exists():` kontrolünden sonra, `open` çağrısından önce dosya silinebilir. Yine de basit
durumlarda okunabilirlik önceliklidir; `dict.get` gibi hazır araç varsa onu kullan.

:::callout{tone="danger" title="Çıplak except ve geniş yakalama tuzağı"}
`except:` (türsüz) ya da `except Exception: pass` yazmak hataları **yutar**. Yazım hatası (`NameError`), yanlış
tür (`TypeError`) gibi gerçek hatalar da sessizce kaybolur ve program yanlış sonuçla devam eder. Çıplak `except:`
üstelik `KeyboardInterrupt` ve `SystemExit`'i de yakalar: Ctrl+C programı durduramaz hâle gelir. Kural: **yalnızca
beklediğin ve ele alabileceğin türü yakala**. Gerçekten her şeyi yakalaman gereken en üst katmanda (örneğin bir web
isteğinin sınırında) `except Exception as e:` yaz ve hatayı mutlaka günlüğe kaydet.
:::

## Dosyalarla çalışmak

Dosya açmak için yerleşik `open` fonksiyonu kullanılır. Bir dosya nesnesi döner; bu nesne işletim sisteminden
alınmış bir **kaynaktır (resource)** ve işin bitince kapatılmalıdır. Açık bırakılan dosyalar yazılan verinin diske
geç düşmesine (tamponlama) ve işletim sisteminin dosya tanıtıcı sınırının dolmasına yol açabilir.

| Mod | Anlamı | Dosya yoksa | Dosya varsa |
|---|---|---|---|
| `"r"` | Okuma (varsayılan) | `FileNotFoundError` | Baştan okur |
| `"w"` | Yazma | Oluşturur | **İçeriği siler**, baştan yazar |
| `"a"` | Sona ekleme | Oluşturur | Sonuna ekler |
| `"x"` | Yalnızca yeni dosya | Oluşturur | `FileExistsError` |
| `"b"` eki | İkili (bytes) mod: `"rb"`, `"wb"` | — | — |
| `"+"` eki | Hem okuma hem yazma: `"r+"` | — | — |

:::callout{tone="warning" title="encoding parametresini unutma"}
Metin modunda `encoding` vermezsen Python işletim sisteminin varsayılan kodlamasını kullanır. Windows'ta bu
çoğu zaman UTF-8 değildir ve "ş, ğ, İ" gibi harfler bozulur ya da `UnicodeDecodeError` alırsın. Kodun her
makinede aynı çalışsın diye metin dosyalarını her zaman `encoding="utf-8"` ile aç.
:::

### with ile açmak, okumak ve yazmak

`with` bloğu, dosyayı blok bitince **otomatik kapatır**, blok içinde hata fırlasa bile. Bu, `try/finally` ile
`f.close()` yazmanın kısa ve güvenli hâlidir.

:::code{lang="python" title="Yazma ve satır satır okuma"}
```python
with open("notlar.txt", "w", encoding="utf-8") as f:
    f.write("Ada,90\n")
    f.write("Linus,75\n")
    print(f.closed)       # False → blok içinde açık

print(f.closed)           # True → with bitti, dosya kapandı

with open("notlar.txt", encoding="utf-8") as f:
    for satir in f:       # satır satır: dosyanın tamamı belleğe alınmaz
        ad, puan = satir.strip().split(",")
        print(ad, int(puan))
# Ada 90
# Linus 75
```
:::

Okuma yöntemleri:

- `f.read()`: tüm içeriği tek bir `str` olarak verir (`'Ada,90\nLinus,75\n'`). Küçük dosyalar için uygun.
- `f.readline()`: bir sonraki satırı, sonundaki `\n` ile birlikte verir (`'Ada,90\n'`).
- `f.readlines()`: tüm satırları liste olarak verir (`['Ada,90\n', 'Linus,75\n']`).
- `for satir in f:` dosya nesnesi bir iterator'dır (K-11); satırları teker teker okur. Büyük dosyalar için en iyisi.

`write` satır sonu eklemez; `\n`'yi kendin yazmalısın. Satırları okurken de sondaki `\n`'yi `strip()` ile temizle.

### pathlib: yollarla nesne olarak çalışmak

Dosya yollarını metin birleştirerek kurmak (`"veriler" + "/" + ad`) işletim sistemleri arasında sorun çıkarır.
Standart kütüphanedeki `pathlib.Path`, yolu bir nesne olarak temsil eder:

:::code{lang="python" title="pathlib ile kısa dosya işleri"}
```python
from pathlib import Path

klasor = Path("veriler")
klasor.mkdir(exist_ok=True)
dosya = klasor / "selam.txt"            # / operatörü yolları birleştirir
dosya.write_text("Merhaba, dünya\n", encoding="utf-8")
print(dosya.read_text(encoding="utf-8"))          # Merhaba, dünya
print(dosya.name, dosya.suffix, dosya.exists())   # selam.txt .txt True
```
:::

`Path` nesnesini doğrudan `open(dosya, ...)` içine de verebilirsin. `read_text`/`write_text` dosyayı açıp kapatmayı
kendisi halleder.

## Context manager: with'in arkasında ne var?

`with` yalnızca dosyalara özel değildir. `__enter__` ve `__exit__` metotlarına sahip her nesne bir **context
manager**'dır ve `with` ile kullanılabilir. `with ifade as isim:` şunları yapar:

1. `ifade`'yi hesaplar ve nesnenin `__enter__()` metodunu çağırır; dönen değeri `isim`'e bağlar.
2. Bloğu çalıştırır.
3. Blok nasıl biterse bitsin (normal, `return`, istisna) `__exit__(tur, deger, iz)` metodunu çağırır. Hata yoksa üç
   argüman da `None` olur. `__exit__` doğru (truthy) bir değer döndürürse istisna **yutulur**; aksi hâlde yayılmaya
   devam eder.

Dosya nesnesinin `__exit__` metodu dosyayı kapatır; "with dosyayı hata olsa bile kapatır" cümlesinin arkasındaki
mekanizma budur. Aşağıda kendi context manager sınıfımızı yazıyoruz. Gerçek dosya yerine bellekte çalışan
`io.StringIO` kullanıyoruz; arayüzü bir metin dosyasıyla aynıdır.

:::trace{src="context-manager.trace.json" title="Kendi context manager'ın: __enter__ ve __exit__|Your own context manager: __enter__ and __exit__"}
`int("bozuk")` hatasından sonra akışın doğrudan `except`'e değil önce `__exit__`'e gittiğini ve `__exit__`'in False dönmesiyle hatanın dışarıdaki `except`'e ulaştığını izle.
:::

Simülasyonda `k.acik` en sonda `False`: hata olmasına rağmen kaynak "kapatıldı". `except` bitince `e` isminin
global çerçeveden silindiğine de dikkat et.

### contextlib.contextmanager ile kısa yol

Her seferinde sınıf yazmak zorunda değilsin. `contextlib.contextmanager` dekoratörü, tek `yield` içeren bir
üreteç (generator, K-11) fonksiyonunu context manager'a çevirir: `yield`'den önceki kod `__enter__`, sonraki kod
`__exit__` görevini görür. `yield`'i `try/finally` içine almak, blokta hata olsa bile temizliğin çalışmasını sağlar.

:::code{lang="python" title="@contextmanager"}
```python
from contextlib import contextmanager


@contextmanager
def bolum(baslik):
    print(f"--- {baslik} başladı")
    try:
        yield baslik.upper()     # with bloğu tam burada çalışır
    finally:
        print(f"--- {baslik} bitti")


with bolum("rapor") as b:
    print("içerideyim:", b)
# --- rapor başladı
# içerideyim: RAPOR
# --- rapor bitti
```
:::

:::callout{tone="tip" title="with nerelerde kullanılır?"}
Kilitler (`threading.Lock`), veritabanı bağlantıları ve işlemleri (transaction), geçici dizinler
(`tempfile.TemporaryDirectory`), belirli bir istisnayı bilerek yok saymak (`contextlib.suppress(FileNotFoundError)`)
ve testlerde geçici ayar değiştirmek. Kural basit: **"aç, kullan, ne olursa olsun kapat"** kalıbı gördüğün her yer
bir context manager adayıdır.
:::

## json: veriyi metne dönüştürmek

Programın verisini dosyaya kaydetmek ya da bir API'ye göndermek için yaygın biçim JSON'dur. `json` modülünde dört
temel fonksiyon var: sonu **s** ile bitenler (`dumps`, `loads`) **metin (string)** ile, bitmeyenler (`dump`,
`load`) **dosya** ile çalışır.

:::code{lang="python" title="dumps/loads ve dump/load"}
```python
import json

kayit = {"ad": "Ada", "yas": 36, "diller": ["Python", "C"], "aktif": True, "not": None}

metin = json.dumps(kayit, ensure_ascii=False)
print(metin)
# {"ad": "Ada", "yas": 36, "diller": ["Python", "C"], "aktif": true, "not": null}
print(json.loads(metin) == kayit)    # True

with open("kayit.json", "w", encoding="utf-8") as f:
    json.dump(kayit, f, ensure_ascii=False, indent=2)

with open("kayit.json", encoding="utf-8") as f:
    okunan = json.load(f)
print(okunan["diller"])              # ['Python', 'C']
```
:::

Dönüşümde Python `True`/`None` değerleri JSON'da `true`/`null` olur. `ensure_ascii=False` vermezsen "İzmir"
`"İzmir"` olarak yazılır (geçerli ama okunması zor). JSON'da demet yoktur: `(1, 2)` gidip `[1, 2]` olarak
döner. Bozuk JSON okunursa `json.JSONDecodeError` (bir `ValueError` alt türü) fırlar; dışarıdan gelen veriyi okurken
onu yakalamayı unutma.

## Ek: log satırlarını düzenli ifadeyle ayrıştırmak

Dosyayı satır satır okumayı öğrendin; gerçek hayatta okunan satırların çoğu log kaydıdır ve içlerinden tarih, seviye ve mesajı ayıklamak gerekir. Python'da bunun aracı `re` modülüdür: `re.match(desen, satir)` eşleşirse `m.group("seviye")` ile adlandırılmış bir grubu okursun, eşleşmezse `None` döner ve o satırı atlarsın. Desenler ilk bakışta karmaşık görünür; aşağıdaki oyun alanı her parçayı tek tek açıklar.

:::interactive{type="regex-playground" preset="log"}
Hazır **Log satırı** deseninde dört satırdan üçü eşleşir; tarih, saat, seviye ve mesaj grupları farklı renklerle vurgulanır, yan paneldeki açıklama her parçayı Türkçe anlatır. **m** bayrağını kapatın: `^` ve `$` artık her satırın değil metnin tamamının başı ve sonu olduğu için eşleşme kalmaz. Ardından deseni `(\w+\s?)+$` gibi iç içe tekrar içeren bir desenle değiştirin ve ReDoS uyarısını okuyun. Deseni Python'a taşırken farklar kutusuna bakın: JS'teki `(?<seviye>...)` Python'da `(?P<seviye>...)` olarak yazılır.
:::

## Özet

- İstisna, hata bilgisini taşıyan bir nesnedir; yakalanana kadar çağrı yığınında yukarı yayılır ve geçtiği
  çerçeveleri kapatır. Traceback'i aşağıdan yukarı oku.
- `try` riskli kodu, `except` hatayı, `else` yalnızca başarıyı, `finally` her durumdaki temizliği taşır.
- Özel türü önce yakala; çıplak `except:` ve `except Exception: pass` hataları yutar, kullanma.
- `raise` ile kendi istisnalarını fırlat; ayrı durumlar için `Exception`'dan türeyen sınıf yaz, alt seviye hatayı
  `raise ... from e` ile zincirle.
- Dosyaları `with open(..., encoding="utf-8")` ile aç; büyük dosyaları satır satır oku, yollar için `pathlib` kullan.
- `with`, `__enter__`/`__exit__` protokolüyle kaynağı hata olsa bile serbest bırakır; `@contextmanager` kısa yoldur.
- `json.dumps/loads` metinle, `json.dump/load` dosyayla çalışır.

:::quiz{src="quiz.json"}
:::

:::next{lesson="k-11-iterator-ve-generator"}
:::

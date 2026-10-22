---
id: k-15-moduller-paketler-ve-tip-ipuclari
slug: moduller-paketler-ve-tip-ipuclari
module: k-python
order: 15
title:
  tr: "Modüller, Paketler, Sanal Ortam ve Tip İpuçları"
  en: "Modules, Packages, Virtual Environments and Type Hints"
summary:
  tr: "import sistemini, venv ve pip'i, tip ipuçlarını ve Protocol ile arayüz tanımlamayı öğren."
  en: "Learn imports, venv and pip, type hints and defining interfaces with Protocol."
durationMinutes: 24
level: intermediate
tags: [python, modules, venv, type-hints, mypy]
prerequisites: [k-14-dunder-property-ve-dataclass]
concepts: [module, import-system, package, virtual-environment, standard-library, type-hints, static-type-checking, protocol]
---

## Modül nedir?

Şimdiye kadar yazdığın programlar tek bir dosyadaydı. Gerçek projeler yüzlerce dosyadan oluşur ve kodu
parçalara ayırmanın Python'daki temel birimi **modüldür** (module): her `.py` dosyası bir modüldür. `ayarlar.py`
dosyası `ayarlar` adlı bir modüldür; başka bir dosyadan `import ayarlar` diyerek içindeki isimleri kullanırsın.

Modüller üç sorunu çözer:

- **Düzen:** İlgili kodu bir arada, ilgisiz kodu ayrı tutarsın (`veritabani.py`, `eposta.py`, `raporlar.py`).
- **Yeniden kullanım:** Bir kez yazdığın fonksiyonu birçok yerden içe aktarırsın.
- **İsim alanı (namespace):** `json.loads` ile kendi `loads` fonksiyonun çakışmaz; her modülün kendi isim tablosu var.

## import nasıl çalışır?

`import ayarlar` satırı çalıştığında Python sırasıyla şunları yapar:

1. **Önbelleğe bakar:** `sys.modules` sözlüğünde `"ayarlar"` anahtarı var mı? Varsa hazır modül nesnesini
   kullanır ve **hiçbir şey çalıştırmaz**.
2. **Bulur:** Yoksa `sys.path` listesindeki klasörlerde (betiğin klasörü, standart kütüphane, `site-packages`)
   `ayarlar.py` dosyasını ya da `ayarlar/` paketini arar.
3. **Oluşturur ve çalıştırır:** Boş bir **modül nesnesi** oluşturur, önce `sys.modules`'e koyar, sonra dosyanın
   kodunu **yukarıdan aşağıya bir kez** bu nesnenin isim alanında çalıştırır. Dosyadaki her `def`, `class` ve
   atama modül nesnesinin bir özelliği olur.
4. **Bağlar:** İçe aktaran dosyada `ayarlar` adını bu modül nesnesine bağlar.

K-02'den hatırla: Python'da her şey nesnedir. Modül de heap'te yaşayan, `module` tipinde bir nesnedir.

:::code{lang="python" title="Modül ilk import'ta bir kez çalışır"}
```python
# ayarlar.py
print("ayarlar yükleniyor...")
DEBUG = True

# main.py
import sys
import ayarlar      # "ayarlar yükleniyor..." yazdırılır
import ayarlar      # ikinci kez: sys.modules'ten gelir, hiçbir şey yazdırılmaz

print(sys.modules["ayarlar"] is ayarlar)  # True → önbellekteki nesnenin ta kendisi
print(type(ayarlar))                      # <class 'module'>
print(ayarlar.DEBUG)                      # True → modülün özelliği
```
:::

Bu "bir kez çalışır" davranışı önemli bir sonuç doğurur: modül, programın her yerinden paylaşılan tek bir
nesnedir. Bir modülde tanımlanan liste ya da bağlantı nesnesi, onu içe aktaran herkes için **aynı** nesnedir.
Bu yüzden modül düzeyinde (fonksiyon dışında) ağır işler (ağ bağlantısı, dosya okuma) yapmamaya çalış: içe aktarma
anında, belki hiç beklemediğin bir yerde çalışırlar.

### import biçimleri

:::code{lang="python" title="Dört temel import biçimi"}
```python
import math                         # modülün tamamı: math.sqrt(16)
from math import sqrt, pi           # belirli isimler: sqrt(16)
import datetime as dt               # takma ad: dt.date.today()
from collections import Counter as Sayac   # isme takma ad

# Kaçın: hangi ismin nereden geldiği belirsizleşir, isimler sessizce ezilir
from math import *
```
:::

`from math import sqrt` da modülün **tamamını** yükler ve çalıştırır; yalnızca senin isim alanına `sqrt` adını
ekler. Yani "sadece bir fonksiyonu içe aktarıp hız kazanmak" diye bir şey yoktur.

Yukarıdaki dört adımı, import mekanizmasının parçaları arasında dolaşan mesajlar olarak izle: önbellek, bulucu,
yükleyici ve sonunda oluşan modül nesnesi.

:::animation{scene="import-sistemi.scene.json"}
Boş modülün kod çalışmadan önce `sys.modules`'e girdiğine ve ikinci `import`'ta bulucu ile yükleyicinin hiç
çalışmadığına dikkat et.
:::

## if __name__ == "__main__"

Python her modüle `__name__` adlı özel bir değişken verir:

- Dosya **doğrudan çalıştırılıyorsa** (`python3 rapor.py`) değeri `"__main__"`dır.
- Dosya **içe aktarılıyorsa** (`import rapor`) değeri modülün adıdır: `"rapor"`.

Bu sayede bir dosya hem içe aktarılabilir bir kütüphane hem de çalıştırılabilir bir betik olabilir. Aşağıdaki
simülasyonda izleyici kodu doğrudan çalıştırıyor; `__name__` değerine ve koşulun sonucuna dikkat et.

:::trace{src="name-main.trace.json" title="__name__ ve __main__ koruması|__name__ and the __main__ guard"}
İlk `print` satırının çıktısında `__name__` değerini gör; ardından koşul doğru olduğu için `main()` çerçevesinin açıldığını izle.
:::

Bu kalıbı her betikte kullan. Koruma olmasaydı, testlerin ya da başka bir modülün `import rapor` demesi
bütün raporun üretilmesine yol açardı.

## Paketler ve __init__.py

Modül sayısı artınca onları klasörlerde toplarsın. İçinde modüller bulunan klasöre **paket** (package) denir.
Klasörde `__init__.py` dosyası varsa bu **normal paket** (regular package) olur; paket ilk içe aktarıldığında
`__init__.py` çalışır. (Python 3.3+'te `__init__.py` olmayan klasörler de "namespace package" olarak içe
aktarılabilir ama uygulama kodunda `__init__.py` koymak hâlâ en açık yoldur.)

:::code{lang="text" title="Tipik bir proje yapısı"}
```text
magaza/
├── pyproject.toml
├── src/
│   └── magaza/
│       ├── __init__.py
│       ├── siparis.py
│       ├── odeme/
│       │   ├── __init__.py
│       │   ├── kart.py
│       │   └── havale.py
│       └── ortak/
│           ├── __init__.py
│           └── para.py
└── tests/
    └── test_siparis.py
```
:::

İçe aktarmanın iki yolu var:

- **Mutlak import** (absolute): paket kökünden tam yol. `from magaza.ortak.para import Para`. Okunaklıdır,
  PEP 8 bunu önerir.
- **Göreli import** (relative): bulunduğun pakete göre. `kart.py` içinde `from ..ortak.para import Para`
  (`.` aynı paket, `..` bir üst paket). Yalnızca paket içindeki modüllerde çalışır; doğrudan
  `python3 kart.py` diye çalıştırılan dosyada "no known parent package" hatası verir. Paket içindeki bir modülü
  çalıştırmak için `python3 -m magaza.odeme.kart` kullan.

:::diagram{src="paket-yapisi.svg" alt="magaza paketinin klasör ağacı, dosya yollarının noktalı modül adlarına karşılığı ve kart.py içinden para modülüne mutlak ve göreli import yolları|Folder tree of the magaza package, how file paths map to dotted module names, and absolute and relative import paths from kart.py to the para module"}
Klasör yolu noktalı modül adına dönüşür; `magaza.odeme.kart` içe aktarılırken önce üst paketlerin `__init__.py` dosyaları çalışır.
:::

:::callout{tone="warning" title="Döngüsel import tuzağı"}
`siparis.py` başında `from magaza.musteri import Musteri`, `musteri.py` başında `from magaza.siparis import Siparis`
yazarsan: Python `siparis`'i çalıştırmaya başlar, ilk satırda `musteri`'ye geçer, `musteri` de henüz **yarım**
(partially initialized) olan `siparis`'ten `Siparis`'i ister. O satıra daha gelinmediği için
`ImportError: cannot import name 'Siparis' from partially initialized module 'magaza.siparis' (most likely due to a circular import)`
alırsın. Çözümler: ortak parçayı üçüncü bir modüle taşı, bağımlılığın yönünü tek yöne çevir ya da son çare olarak
içe aktarmayı kullanıldığı fonksiyonun içine al. Döngüsel import çoğu zaman tasarımın sınırlarının bulanık
olduğunun işaretidir.
:::

Bir de **gölgeleme** (shadowing) tuzağı var: kendi dosyanı `json.py`, `random.py` ya da `test.py` diye
adlandırırsan, betiğin klasörü `sys.path`'te önde olduğu için standart kütüphane yerine **senin** dosyan içe aktarılır.

## Standart kütüphane turu

Python "piller dahil" (batteries included) bir dildir: kurulumla birlikte yüzlerce modül gelir. En sık
kullanacakların:

| Modül | Ne işe yarar | Örnek |
|---|---|---|
| `pathlib` | Dosya yolları, nesne tabanlı | `Path("raporlar") / "ocak.csv"` |
| `json` | JSON okuma/yazma | `json.loads(metin)`, `json.dumps(veri)` |
| `datetime` | Tarih, saat, süre | `datetime(2026, 10, 19) + timedelta(days=12)` |
| `collections` | Özel koleksiyonlar | `Counter`, `defaultdict`, `deque` |
| `itertools` | Yineleyici araçları | `chain`, `groupby`, `combinations` |
| `os`, `sys` | İşletim sistemi, yorumlayıcı | `os.environ`, `sys.argv` |
| `re` | Düzenli ifadeler | `re.findall(r"\d+", metin)` |

:::code{lang="python" title="pathlib, json, datetime ve itertools"}
```python
from pathlib import Path
import json
from datetime import datetime, timedelta
import itertools

p = Path("raporlar") / "2026" / "ocak.csv"   # / operatörü: Path.__truediv__
print(p.name, p.suffix, p.parent)            # ocak.csv .csv raporlar/2026  (Windows'ta \ ile)

veri = {"ad": "Ada", "diller": ["Python", "Go"], "aktif": True}
metin = json.dumps(veri, ensure_ascii=False)
print(metin)                                 # {"ad": "Ada", "diller": ["Python", "Go"], "aktif": true}
print(json.loads(metin)["diller"][0])        # Python

t = datetime(2026, 10, 19, 14, 30)
print(t + timedelta(days=12))                # 2026-10-31 14:30:00
print(t.strftime("%d.%m.%Y %H:%M"))          # 19.10.2026 14:30

print(list(itertools.chain([1, 2], [3])))              # [1, 2, 3]
print(list(itertools.combinations("ABC", 2)))          # [('A', 'B'), ('A', 'C'), ('B', 'C')]
for harf, grup in itertools.groupby(["elma", "erik", "armut"], key=lambda s: s[0]):
    print(harf, list(grup))                  # e ['elma', 'erik']  /  a ['armut']
```
:::

`collections` modülündeki üç yardımcıyı simülasyonda izle: `Counter` sayar, `defaultdict` eksik anahtarı
kendisi oluşturur, `deque` iki uçtan hızlı çalışan bir kuyruktur.

:::trace{src="koleksiyonlar.trace.json" title="Counter, defaultdict ve deque|Counter, defaultdict and deque"}
Döngüde `gruplar` sözlüğüne yeni anahtarların `KeyError` olmadan eklendiğine ve `deque` dolunca en eski öğenin atıldığına dikkat et.
:::

:::callout{tone="tip" title="Kendin yazmadan önce bak"}
Kelime saymak için sözlük döngüsü, son N kaydı tutmak için liste kesme, gruplamak için `if anahtar not in d`
kontrolleri yazıyorsan dur: `Counter`, `deque(maxlen=N)` ve `defaultdict` bunları hem daha kısa hem daha hızlı yapar.
`groupby`'ın yalnızca **ardışık** aynı anahtarları grupladığını unutma: genelde önce aynı anahtara göre sıralarsın.
:::

## Sanal ortamlar: venv ve pip

Standart kütüphane dışındaki paketleri (requests, FastAPI, pandas) **pip** ile PyPI'dan kurarsın. Ama tüm
paketleri sistemdeki tek Python'a kurarsan sorun çıkar: A projesi `Django 4.2` isterken B projesi `Django 5.1`
ister. Aynı Python'da bir paketin tek bir sürümü kurulu olabilir; buna **bağımlılık çakışması** (dependency
conflict) denir. Ayrıca işletim sisteminin kendi araçları sistem Python'una bağlı olabilir; oraya paket kurmak
onları bozabilir.

Çözüm **sanal ortamdır** (virtual environment): her projeye ait, kendi `site-packages` klasörü olan yalıtılmış
bir Python ortamı.

:::code{lang="bash" title="Sanal ortam oluşturma ve kullanma"}
```bash
cd magaza
python3 -m venv .venv               # .venv klasöründe yeni ortam

source .venv/bin/activate           # macOS / Linux
.venv\Scripts\activate              # Windows (cmd / PowerShell)

python -m pip install requests      # artık yalnızca bu ortama kurulur
python -m pip freeze > requirements.txt   # kurulu sürümleri dosyaya yaz
python -m pip install -r requirements.txt # başka makinede aynısını kur
deactivate                          # ortamdan çık
```
:::

Etkinleştirme (activate) sihirli bir işlem değildir: `PATH` değişkeninin başına `.venv/bin` klasörünü ekler,
böylece `python` ve `pip` komutları ortamdakiler olur. `.venv` klasörünü git'e ekleme (`.gitignore`); onun yerine
bağımlılık listesini paylaş. `pip` yerine `python -m pip` yazmak, paketin **o anki** Python'a kurulduğundan emin olmanı sağlar.

:::callout{tone="warning" title="Ortamı etkinleştirmeyi unutmak"}
En sık hata: paketi bir ortama kurup programı başka bir Python ile çalıştırmak. Sonuç
`ModuleNotFoundError: No module named 'requests'`. Hangi Python'u kullandığını `python -c "import sys; print(sys.executable)"`
ile kontrol et; editöründe de (VS Code, PyCharm) yorumlayıcı olarak `.venv` içindekini seç.
:::

### pyproject.toml ve uv

Modern Python projeleri ayarlarını ve bağımlılıklarını tek bir `pyproject.toml` dosyasında tanımlar (PEP 621).
`requirements.txt` "şu anda kurulu olanların listesi" iken, `pyproject.toml` projenin **kimliğidir**: adı,
sürümü, desteklediği Python sürümü, bağımlılıkları ve araç ayarları (mypy, pytest, ruff).

:::code{lang="toml" title="Basit bir pyproject.toml"}
```toml
[project]
name = "magaza"
version = "0.1.0"
requires-python = ">=3.12"
dependencies = [
    "requests>=2.32",
]

[tool.mypy]
strict = true
```
:::

**uv**, Rust ile yazılmış, pip ve venv'in işini çok daha hızlı yapan bir araçtır. `uv init` proje oluşturur,
`uv add requests` hem `pyproject.toml`'a ekler hem kurar, `uv run main.py` ortamı kendisi hazırlayıp çalıştırır ve
`uv.lock` dosyasıyla tam sürümleri kilitler. Arka plandaki kavramlar (sanal ortam, bağımlılık listesi) aynıdır;
venv ve pip'i anlamak uv'yi de anlamanı sağlar.

## Tip ipuçları

K-02'de Python'un **dinamik tipli** olduğunu gördün: tip isimde değil nesnededir. Projeler büyüdükçe "bu
fonksiyon ne alıyor, ne döndürüyor?" sorusu zorlaşır. **Tip ipuçları** (type hints, PEP 484) bu bilgiyi koda
yazmanın standart yoludur:

:::code{lang="python" title="Temel tip açıklamaları"}
```python
from typing import Callable, Optional, TypedDict


def ortalama(notlar: list[int]) -> float:          # parametre ve dönüş tipi
    return sum(notlar) / len(notlar)


stok: dict[str, int] = {"kalem": 10, "silgi": 4}   # değişken açıklaması


def bul(ad: str) -> str | None:                    # "str ya da None" (Python 3.10+)
    return ad if ad in stok else None


def bul_eski(ad: str) -> Optional[str]:            # aynı anlam, eski yazım
    return ad if ad in stok else None


def uygula(f: Callable[[int], int], x: int) -> int:   # int alıp int dönen fonksiyon
    return f(x)


class Kullanici(TypedDict):                        # belirli anahtarları olan sözlük
    ad: str
    yas: int


k: Kullanici = {"ad": "Ada", "yas": 36}
```
:::

`list[int]` ve `dict[str, int]` yazımı Python 3.9+'ta çalışır; daha eskilerde `typing.List`, `typing.Dict`
kullanılırdı. `X | None` yazımı 3.10+'dır; `Optional[X]` ile aynı anlama gelir.

### Generic fonksiyonlar

"Ne tür liste verirsen o türden öğe döner" demek için **tip değişkeni** kullanırsın:

:::code{lang="python" title="Generic fonksiyon: TypeVar ve 3.12+ sözdizimi"}
```python
from typing import TypeVar

T = TypeVar("T")

def ilk(ogeler: list[T]) -> T:        # Python 3.5+ (TypeVar ile)
    return ogeler[0]

def ilk_yeni[T](ogeler: list[T]) -> T:   # Python 3.12+ (PEP 695)
    return ogeler[0]

isim = ilk(["Ada", "Can"])   # mypy isim'in tipini str olarak bilir
```
:::

### İpuçları çalışma zamanında zorlanmaz

Bu çok önemli: Python yorumlayıcısı tip ipuçlarını **kontrol etmez**. Onlar, fonksiyon nesnesinin
`__annotations__` sözlüğünde duran bilgilerdir. Yanlış tipte değer verirsen kod yine çalışır; hata ancak bir
işlem gerçekten başarısız olursa gelir.

:::trace{src="tip-ipucu-zorlanmaz.trace.json" title="Tip ipuçları çalışma zamanında zorlanmaz|Type hints are not enforced at runtime"}
`topla("2", "3")` çağrısında hiçbir uyarı olmadan '23' döndüğüne, son satırdaki hatanın ise ipucundan değil `+` operatöründen geldiğine dikkat et.
:::

:::code{lang="python" title="İpuçları sadece veridir"}
```python
def ortalama(notlar: list[int]) -> float:
    return sum(notlar) / len(notlar)

print(ortalama.__annotations__)   # {'notlar': list[int], 'return': <class 'float'>}
```
:::

### mypy ile statik kontrol

İpuçlarını kontrol eden şey **statik tip denetleyicisidir** (static type checker): kodu çalıştırmadan okur ve
tutarsızlıkları bulur. En yaygını **mypy**'dir (alternatifler: pyright, VS Code'daki Pylance).

:::code{lang="python" title="hatali.py"}
```python
def ortalama(notlar: list[int]) -> float:
    return sum(notlar) / len(notlar)


def bul(ad: str) -> str | None:
    return None


ortalama(["70", "80"])
sonuc = bul("kalem")
print(sonuc.upper())
```
:::

:::code{lang="bash" title="mypy çıktısı"}
```bash
python -m pip install mypy
mypy hatali.py
# hatali.py:9: error: List item 0 has incompatible type "str"; expected "int"  [list-item]
# hatali.py:9: error: List item 1 has incompatible type "str"; expected "int"  [list-item]
# hatali.py:11: error: Item "None" of "str | None" has no attribute "upper"  [union-attr]
# Found 3 errors in 1 file (checked 1 source file)
```
:::

Üçüncü hata özellikle değerlidir: `bul` `None` dönebilir ve sen bunu kontrol etmeden `.upper()` çağırıyorsun.
Bu hata çalışma zamanında ancak `None` geldiği gün, belki üretimde ortaya çıkardı. mypy onu yazarken yakalar.
Çözüm: `if sonuc is not None: print(sonuc.upper())`. mypy bu kontrolden sonra `sonuc`'un `str` olduğunu anlar
(tip daraltma, type narrowing).

:::callout{tone="info" title="Kademeli tipleme"}
Tip ipuçları zorunlu değildir; projeye yavaş yavaş eklenebilir (gradual typing). Açıklaması olmayan fonksiyonlar
mypy için varsayılan olarak `Any` kabul edilir ve gövdeleri kontrol edilmez. Yeni kodda en azından fonksiyon
imzalarına (parametreler ve dönüş tipi) ipucu yazmak iyi bir başlangıçtır.
:::

## Protocol: yapısal tipleme

K-14'te `abc.ABC` ile bir sözleşme tanımladın; alt sınıfların temel sınıftan **açıkça türemesi** gerekiyordu.
`typing.Protocol` (Python 3.8+) başka bir yol sunar: "şu metotlara sahip **her** nesne bu tipe uyar". Sınıfın
protokolden türemesine, hatta protokolü bilmesine gerek yoktur. Buna **yapısal tipleme** (structural typing) denir;
Python'un "ördek gibi yürüyorsa ördektir" (duck typing) felsefesinin statik denetlenebilen hâlidir.

:::code{lang="python" title="Protocol ile arayüz"}
```python
from typing import Protocol


class Bildirici(Protocol):
    def gonder(self, mesaj: str) -> None: ...


class EpostaBildirici:                 # Bildirici'den türemiyor!
    def gonder(self, mesaj: str) -> None:
        print(f"E-posta: {mesaj}")


class Yazici:
    def yazdir(self, metin: str) -> None:
        print(metin)


def siparis_onayla(bildirici: Bildirici) -> None:
    bildirici.gonder("Siparişin alındı")


siparis_onayla(EpostaBildirici())   # E-posta: Siparişin alındı
siparis_onayla(Yazici())            # mypy: Argument 1 to "siparis_onayla" has incompatible type "Yazici"; expected "Bildirici"
                                    # çalışma zamanında: AttributeError: 'Yazici' object has no attribute 'gonder'
```
:::

`siparis_onayla` fonksiyonu hangi somut sınıfla çalıştığını bilmez; yalnızca "gonder metodu olan bir şey" ister.
Bu, bir sonraki dersin konusu olan **dependency injection**'ın temelidir: fonksiyon ya da sınıf somut bir
e-posta servisine değil, bir **arayüze** bağımlı olur; testte o arayüze uyan sahte bir nesne verirsin.

:::realworld{company="Instagram"}
Instagram'ın sunucu tarafı, yıllar içinde büyüyen tek bir Django kod tabanıdır ve Python 3'e geçişini tamamladıktan
sonra ekip tip ipuçlarına yöneldi. Milyonlarca satırlık, tipsiz yazılmış bir koda elle açıklama eklemek pratik
olmadığı için Instagram mühendisleri **MonkeyType** adlı aracı geliştirip 2017'de açık kaynak olarak yayımladı.
MonkeyType, kod çalışırken (ör. testler ya da gerçek trafik sırasında) fonksiyonlara gerçekte hangi türde
argümanların geldiğini ve ne döndürdüklerini kaydeder; ardından bu kayıtlardan taslak tip açıklamaları üretip
kaynağa ya da `.pyi` dosyalarına yazabilir.

Bu, derste anlattığımız **kademeli tiplemenin** büyük ölçekteki karşılığıdır: tip ipuçları çalışma zamanında
zorlanmaz, ama bir kez eklendiklerinde mypy ya da Meta'nın kendi denetleyicisi Pyre gibi statik araçlar onları
okuyup hataları kod çalışmadan yakalar. Üretilen açıklamalar körü körüne kabul edilmez; geliştirici onları gözden
geçirip daha genel bir tür (ör. somut `list` yerine `Iterable`) ya da bir `Protocol` seçer. Modüller ve paketler
de bu süreçte önemlidir: tip denetleyicisi, `from magaza.ortak.para import Para` gibi mutlak import'ları izleyerek
bir modüldeki türü diğerinde doğrular. Ders boyunca gördüğün araçlar, yani paket yapısı, mutlak import'lar ve tip
ipuçları, büyük bir Python kod tabanının bakımını mümkün kılan aynı parçalardır.
:::

## Özet

- Her `.py` dosyası bir modüldür. İlk `import`'ta modül nesnesi oluşturulur, kodu **bir kez** çalışır ve
  `sys.modules`'te önbelleğe alınır; sonraki import'lar aynı nesneyi döndürür.
- `__name__` doğrudan çalıştırılan dosyada `"__main__"`, içe aktarılanda modül adıdır; betik kodunu
  `if __name__ == "__main__":` altına koy.
- Paketler `__init__.py` içeren klasörlerdir. Mutlak import'u tercih et; döngüsel import'tan ve standart kütüphane
  adlarını gölgelemekten kaçın.
- Her projeye `python3 -m venv .venv` ile ayrı bir sanal ortam aç; bağımlılıkları `requirements.txt` ya da
  `pyproject.toml` ile paylaş. uv aynı işi daha hızlı yapar.
- Tip ipuçları (`list[int]`, `str | None`, `Callable`, `TypedDict`, generic'ler) belgeleme ve araç desteği içindir;
  Python bunları çalışma zamanında **zorlamaz**.
- mypy gibi statik denetleyiciler hataları kod çalışmadan bulur; özellikle `None` kontrolü unutulan yerleri yakalar.
- `typing.Protocol` "şu metotları olan her nesne" diye yapısal bir arayüz tanımlar ve bağımlılıkları gevşetmenin
  anahtarıdır.

:::quiz{src="quiz.json"}
:::

:::next{lesson="k-16-solid-ve-dependency-injection"}
:::

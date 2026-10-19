---
id: k-19-testler-ve-mini-proje
slug: testler-ve-mini-proje
module: k-python
order: 19
title:
  tr: "Test Yazma ve Uçtan Uca Mini Proje"
  en: "Testing and an End-to-End Mini Project"
summary:
  tr: "pytest ile test yaz ve öğrendiklerini OOP ve DI ile bir kütüphane uygulamasında birleştir."
  en: "Write tests with pytest and combine everything in a library app built with OOP and DI."
durationMinutes: 24
level: intermediate
tags: [python, pytest, test, mock, mini-proje, dependency-injection]
prerequisites: [k-18-eszamanlilik-ve-asyncio]
concepts: [unit-testing, pytest, fixture, parametrize, mocking, test-double, tdd, dependency-injection]
---

## Neden test yazmalısın?

Bir fonksiyon yazdın, çalıştırdın, doğru sonucu gördün. İki hafta sonra küçük bir değişiklik yaptın ve başka bir
yerde bir şey bozuldu; fark etmen bir hafta sürdü. Test yazmak, "çalışıyor mu?" sorusunu **elle değil, otomatik ve
tekrarlanabilir** biçimde sormaktır. İyi bir test paketi sana üç şey verir:

- **Güven:** Kodu değiştirdiğinde (refaktör) davranışın bozulmadığını saniyeler içinde görürsün.
- **Belge:** `test_zaten_oduncteki_kitap_hata_verir` gibi bir test, kodun ne yapması gerektiğini okunur biçimde anlatır.
- **Daha iyi tasarım:** Test etmesi zor kod genellikle fazla bağımlı koddur. K-16'da gördüğün dependency injection,
  testi kolaylaştırmanın en güçlü aracıdır.

Bu derste önce pytest ile test yazmayı öğreneceğiz, sonra modül boyunca öğrendiklerini (dataclass, Protocol, özel
istisnalar, constructor injection) küçük bir **Kütüphane** uygulamasında birleştirip testleriyle birlikte yazacağız.

### Test piramidi

Her test aynı değildir. Yaygın bir model **test piramidi**dir (test pyramid):

| Katman | Ne test eder? | Hız | Sayı |
|---|---|---|---|
| **Birim testi** (unit test) | Tek bir fonksiyon ya da sınıf, bağımlılıkları sahte nesnelerle | Milisaniyeler | Çok (tabanı oluşturur) |
| **Entegrasyon testi** (integration test) | Birkaç parçanın gerçek bağımlılıklarla birlikte çalışması (ör. gerçek veritabanı) | Saniyeler | Orta |
| **Uçtan uca test** (end-to-end) | Tüm sistemin kullanıcı gözünden davranışı (tarayıcı, API) | Yavaş | Az |

Piramidin tabanı geniştir: çoğu test hızlı birim testleridir. Bu derste ağırlıklı olarak birim testi yazacağız.

## pytest ile başlamak

Python'un standart kütüphanesinde `unittest` vardır, ama topluluğun büyük kısmı daha sade olan **pytest**'i kullanır.
Sanal ortamında (K-15) kur:

:::code{lang="bash" title="pytest kurulumu ve çalıştırma"}
```bash
python -m pip install pytest
python -m pytest            # bulunduğun klasördeki testleri bul ve çalıştır
python -m pytest -v         # her testi ayrı satırda göster
python -m pytest -k iade    # adında "iade" geçen testleri çalıştır
```
:::

pytest'in kuralları basittir:

- Dosya adı `test_` ile başlar (ya da `_test.py` ile biter): `test_fiyat.py`.
- Test fonksiyonunun adı `test_` ile başlar.
- Kontrol için düz `assert` yazılır. Özel `assertEqual` metotlarına gerek yoktur.

:::code{lang="python" title="test_fiyat.py: bir geçen, bir kalan test"}
```python
def indirimli_fiyat(fiyat, oran):
    return fiyat - fiyat * oran / 100


def test_yuzde_on_indirim():
    assert indirimli_fiyat(200, 10) == 180


def test_ceyrek_indirim():
    assert indirimli_fiyat(100, 25) == 70   # beklenti yanlış: sonuç 75
```
:::

`python -m pytest test_fiyat.py` çalıştırınca pytest başarısız testi ayrıntılı gösterir (pytest 9, Python 3.14):

:::code{lang="bash" title="Başarısız testin çıktısı"}
```bash
test_fiyat.py .F                                                [100%]

=================================== FAILURES ===================================
_____________________________ test_ceyrek_indirim ______________________________

    def test_ceyrek_indirim():
>       assert indirimli_fiyat(100, 25) == 70
E       assert 75.0 == 70
E        +  where 75.0 = indirimli_fiyat(100, 25)

test_fiyat.py:10: AssertionError
=========================== short test summary info ============================
FAILED test_fiyat.py::test_ceyrek_indirim - assert 75.0 == 70
========================= 1 failed, 1 passed in 0.02s ==========================
```
:::

pytest `assert` ifadesini yeniden yazarak (assertion rewriting) her iki tarafın değerini de gösterir: `75.0 == 70`
ve `75.0`'ın nereden geldiği. `.` geçen, `F` kalan testi gösterir.

### pytest.raises: hata beklemek

Bazen doğru davranış **hata vermektir**. `pytest.raises` bloğu, içindeki kod beklenen istisnayı fırlatmazsa testi
başarısız sayar. `match=` ile mesajı da düzenli ifadeyle kontrol edebilirsin.

### fixture: hazırlığı paylaşmak

Birçok test aynı hazırlığa (ör. içinde iki kitap olan bir depo) ihtiyaç duyar. **fixture**, bu hazırlığı yapan ve
testlere parametre adıyla verilen fonksiyondur. Her test fixture'ın **taze** bir kopyasını alır; testler birbirini
etkilemez. Fixture'lar başka fixture'ları da parametre olarak isteyebilir; pytest bağımlılık zincirini kendisi çözer.
Bu, küçük bir dependency injection sistemidir.

### parametrize: aynı testi farklı verilerle

:::code{lang="python" title="pytest.raises ve parametrize"}
```python
import pytest


def bol(a, b):
    return a / b


def test_sifira_bolme():
    with pytest.raises(ZeroDivisionError):
        bol(1, 0)


@pytest.mark.parametrize(
    "metin, beklenen",
    [("kayak", True), ("Ada", True), ("python", False)],
)
def test_palindrom(metin, beklenen):
    temiz = metin.lower()
    assert (temiz == temiz[::-1]) is beklenen
# test_palindrom[kayak-True] PASSED
# test_palindrom[Ada-True] PASSED
# test_palindrom[python-False] PASSED
```
:::

Üç veri satırı üç ayrı test olarak raporlanır; biri kalırsa hangisi olduğunu hemen görürsün.

## Test dublörleri: fake, mock ve patch

Birim testinde gerçek e-posta göndermek, gerçek veritabanına yazmak ya da saatin değişmesini beklemek istemezsin.
Gerçek bağımlılık yerine kullanılan nesnelere **test dublörü** (test double) denir. En sık iki tür:

| Tür | Nedir? | Ne zaman? |
|---|---|---|
| **Fake** | Gerçeğin basit ama çalışan bir gerçeklemesi: bellekte depo, mesajları listeye yazan bildirici | Davranışı ve sonucu (durumu) test etmek istediğinde |
| **Mock** | Kendisine yapılan çağrıları kaydeden, istenen değeri döndüren programlanabilir nesne (`unittest.mock.Mock`) | "Şu metot şu argümanlarla çağrıldı mı?" sorusunu sormak istediğinde |

`Mock()` nesnesinin her niteliği yine bir `Mock`'tur ve her çağrıyı kaydeder: `bildirici.gonder.assert_called_once_with(...)`
ile kontrol edersin. **`patch`** ise bir modüldeki ismi test süresince geçici olarak sahte nesneyle değiştirir.
DI kullanmayan, bağımlılığını içeride import eden kodlarda işe yarar:

:::code{lang="python" title="unittest.mock.patch ile modül fonksiyonunu değiştirmek"}
```python
import random
from unittest.mock import patch


def zar_at():
    return random.randint(1, 6)


def test_zar_patch():
    with patch("random.randint", return_value=6) as sahte:
        assert zar_at() == 6
    sahte.assert_called_once_with(1, 6)
```
:::

:::callout{tone="warning" title="patch'i ismin arandığı yerde uygula"}
`patch` nesneyi değil, **bir modüldeki ismi** değiştirir. Kodun `from random import randint` ile ismi kendi
modülüne kopyaladıysa `patch("random.randint")` işe yaramaz; `patch("benim_modulum.randint")` yazman gerekir.
Çok fazla `patch` görüyorsan bu bir tasarım kokusudur: bağımlılığı constructor'dan vermek (DI) testleri hem daha sade
hem daha az kırılgan yapar. Ayrıca her şeyi mock'larsan testler gerçek davranışı değil, uygulama ayrıntılarını
kontrol etmeye başlar ve her refaktörde kırılır. Mümkün olduğunda fake tercih et.
:::

## TDD: kırmızı, yeşil, refaktör

**Test güdümlü geliştirme** (Test-Driven Development, TDD) testleri koddan **önce** yazmayı önerir. Döngü kısadır:

1. **Kırmızı:** Henüz var olmayan bir davranış için küçük bir test yaz. Çalıştır, kaldığını gör (testin gerçekten
   bir şey kontrol ettiğinden emin olursun).
2. **Yeşil:** Testi geçirecek **en basit** kodu yaz.
3. **Refaktör:** Testler yeşilken kodu temizle: tekrarları kaldır, isimleri düzelt. Testler seni korur.

Her yeni kural için döngü tekrar başlar. TDD her durumda şart değildir, ama iş kuralları net olan servis kodunda
(aşağıdaki proje gibi) çok iyi çalışır.

## Mini proje: Kütüphane uygulaması

Şimdi modül boyunca öğrendiklerini birleştiriyoruz. Uygulama, üyelerin kitap ödünç alıp iade etmesini yönetir.
Klasör yapısı:

:::code{lang="bash" title="Proje yapısı"}
```bash
kutuphane-projesi/
├── kutuphane/
│   ├── __init__.py
│   ├── modeller.py      # Kitap (dataclass)
│   ├── hatalar.py       # özel istisnalar
│   ├── depo.py          # KitapDeposu (Protocol) + BellekDeposu
│   └── servis.py        # OduncServisi (iş kuralları)
└── tests/
    └── test_servis.py
```
:::

### 1. Model: Kitap

:::code{lang="python" title="kutuphane/modeller.py"}
```python
from dataclasses import dataclass
from datetime import date


@dataclass
class Kitap:
    isbn: str
    baslik: str
    yazar: str
    odunc_alan: str | None = None
    iade_tarihi: date | None = None

    @property
    def musait(self) -> bool:
        return self.odunc_alan is None
```
:::

`@dataclass` (K-14) `__init__`, `__repr__` ve `__eq__` metotlarını üretir. `musait` bir `property`: ayrı bir alan
tutmak yerine durumu `odunc_alan`'dan türetir, böylece iki alan birbiriyle çelişemez.

### 2. Özel istisnalar

:::code{lang="python" title="kutuphane/hatalar.py"}
```python
class KutuphaneHatasi(Exception):
    """Bu uygulamanın tüm hatalarının ortak atası."""


class KitapBulunamadi(KutuphaneHatasi):
    def __init__(self, isbn: str):
        super().__init__(f"Kitap bulunamadı: {isbn}")
        self.isbn = isbn


class KitapZatenOduncte(KutuphaneHatasi):
    def __init__(self, baslik: str, uye: str):
        super().__init__(f"'{baslik}' zaten ödünçte: {uye}")
        self.baslik = baslik
        self.uye = uye
```
:::

Ortak bir ata sınıf, çağıranın isterse tüm uygulama hatalarını tek `except KutuphaneHatasi` ile yakalamasını sağlar.
Hata nesnesinde `isbn` gibi alanlar tutmak, mesajı ayrıştırmadan programatik karar vermeyi mümkün kılar (ör. web
katmanında `KitapBulunamadi` → HTTP 404).

### 3. Depo: Protocol ve gerçeklemesi

:::code{lang="python" title="kutuphane/depo.py"}
```python
from typing import Protocol

from .modeller import Kitap


class KitapDeposu(Protocol):
    def getir(self, isbn: str) -> Kitap | None: ...
    def kaydet(self, kitap: Kitap) -> None: ...


class BellekDeposu:
    """Kitapları sözlükte tutan basit gerçekleme (testler ve demo için)."""

    def __init__(self) -> None:
        self._kitaplar: dict[str, Kitap] = {}

    def getir(self, isbn: str) -> Kitap | None:
        return self._kitaplar.get(isbn)

    def kaydet(self, kitap: Kitap) -> None:
        self._kitaplar[kitap.isbn] = kitap
```
:::

`KitapDeposu` bir **Protocol**'dür (K-15, K-16): "getir ve kaydet metotları olan her şey depodur" der.
`BellekDeposu` ondan kalıtım almaz ama aynı metotlara sahip olduğu için mypy onu kabul eder (yapısal tipleme). Yarın
bir `PostgresDeposu` yazdığında servis kodunda tek satır değişmez.

### 4. Servis: iş kuralları ve constructor injection

:::code{lang="python" title="kutuphane/servis.py"}
```python
from collections.abc import Callable
from datetime import date, timedelta
from typing import Protocol

from .depo import KitapDeposu
from .hatalar import KitapBulunamadi, KitapZatenOduncte
from .modeller import Kitap

ODUNC_SURESI = timedelta(days=14)


class Bildirici(Protocol):
    def gonder(self, alici: str, mesaj: str) -> None: ...


class OduncServisi:
    def __init__(self, depo: KitapDeposu, bildirici: Bildirici,
                 bugun: Callable[[], date] = date.today) -> None:
        self._depo = depo
        self._bildirici = bildirici
        self._bugun = bugun

    def _bul(self, isbn: str) -> Kitap:
        kitap = self._depo.getir(isbn)
        if kitap is None:
            raise KitapBulunamadi(isbn)
        return kitap

    def odunc_ver(self, isbn: str, uye: str) -> Kitap:
        kitap = self._bul(isbn)
        if not kitap.musait:
            raise KitapZatenOduncte(kitap.baslik, kitap.odunc_alan)
        kitap.odunc_alan = uye
        kitap.iade_tarihi = self._bugun() + ODUNC_SURESI
        self._depo.kaydet(kitap)
        self._bildirici.gonder(uye, f"'{kitap.baslik}' iade tarihi: {kitap.iade_tarihi}")
        return kitap

    def iade_al(self, isbn: str) -> Kitap:
        kitap = self._bul(isbn)
        kitap.odunc_alan = None
        kitap.iade_tarihi = None
        self._depo.kaydet(kitap)
        return kitap
```
:::

Servisin üç bağımlılığı var ve üçü de **constructor'dan** geliyor: depo, bildirici ve "bugün"ü veren saat fonksiyonu.
Saat de bir bağımlılıktır: `date.today()`'i doğrudan çağırsaydık testte iade tarihini kontrol edemezdik, çünkü her
gün farklı sonuç verirdi. Varsayılan değer `date.today` olduğu için gerçek kullanımda vermek zorunda değilsin.

### Ödünç alma akışını simüle edelim

Aşağıdaki simülasyon servisin sadeleştirilmiş bir hâlidir (ekran sade kalsın diye dataclass yerine düz sınıf,
bildirici ve saat olmadan). Heap'te servis, depo ve kitap nesnelerinin oklarla nasıl bağlandığına bak.

:::trace{src="odunc-akisi.trace.json" title="Ödünç alma akışı|The borrowing flow"}
`servis.odunc_ver` çağrısında yığına önce servis, sonra depo çerçevesinin eklendiğine ve `kitap.odunc_alan` değişikliğinin depodaki aynı nesnede göründüğüne dikkat et.
:::

Burada K-02'deki ders yeniden karşımıza çıkıyor: depo kitabın **kopyasını** değil, kendisini döndürür. Bu yüzden
projedeki `kaydet` çağrısı bellek deposunda aslında gereksizdir, ama gerçek bir veritabanı deposunda değişikliği kalıcı yapan
adım odur. Servis hangi deponun kullanıldığını bilmediği için `kaydet`'i her zaman çağırır.

### Hatalı akış: zaten ödünçte olan kitap

:::trace{src="hatali-akis.trace.json" title="Zaten ödünçteki kitap: özel istisna|A book already on loan: custom exception"}
İkinci çağrıda `if` kontrolünün istisna fırlattığına, `odunc_ver` çerçevesinin kapandığına ve kitabın hâlâ 'ayse'de kaldığına dikkat et.
:::

Kural kontrolü **değişiklikten önce** yapılıyor. İstisna fırladığında kitap nesnesine dokunulmamış oluyor. Hata
durumunda yarım kalmış bir güncelleme bırakmamak iyi servis kodunun temel özelliğidir.

### 5. Testler: fake depo ve fake bildirici ile

:::code{lang="python" title="tests/test_servis.py"}
```python
from datetime import date
from unittest.mock import Mock

import pytest

from kutuphane.depo import BellekDeposu
from kutuphane.hatalar import KitapBulunamadi, KitapZatenOduncte
from kutuphane.modeller import Kitap
from kutuphane.servis import OduncServisi


class SahteBildirici:
    """Fake: gönderilen mesajları listede biriktirir."""

    def __init__(self):
        self.mesajlar = []

    def gonder(self, alici, mesaj):
        self.mesajlar.append((alici, mesaj))


@pytest.fixture
def depo():
    d = BellekDeposu()
    d.kaydet(Kitap("111", "Dune", "Frank Herbert"))
    d.kaydet(Kitap("222", "Tutunamayanlar", "Oğuz Atay"))
    return d


@pytest.fixture
def bildirici():
    return SahteBildirici()


@pytest.fixture
def servis(depo, bildirici):
    return OduncServisi(depo, bildirici, bugun=lambda: date(2026, 1, 1))


def test_odunc_ver_kitabi_uyeye_atar(servis, depo):
    kitap = servis.odunc_ver("111", "ayse")

    assert kitap.odunc_alan == "ayse"
    assert kitap.iade_tarihi == date(2026, 1, 15)
    assert depo.getir("111").musait is False


def test_odunc_ver_bildirim_gonderir(servis, bildirici):
    servis.odunc_ver("111", "ayse")

    assert bildirici.mesajlar == [("ayse", "'Dune' iade tarihi: 2026-01-15")]


def test_zaten_oduncteki_kitap_hata_verir(servis):
    servis.odunc_ver("111", "ayse")

    with pytest.raises(KitapZatenOduncte, match="zaten ödünçte: ayse"):
        servis.odunc_ver("111", "mehmet")


@pytest.mark.parametrize("isbn", ["999", "", "111-x"])
def test_olmayan_kitap_bulunamadi_hatasi_verir(servis, isbn):
    with pytest.raises(KitapBulunamadi):
        servis.odunc_ver(isbn, "ayse")


def test_iade_sonrasi_kitap_yeniden_odunc_verilebilir(servis):
    servis.odunc_ver("111", "ayse")
    servis.iade_al("111")

    kitap = servis.odunc_ver("111", "mehmet")
    assert kitap.odunc_alan == "mehmet"


def test_mock_ile_bildirim_cagrisi(depo):
    bildirici = Mock()
    servis = OduncServisi(depo, bildirici, bugun=lambda: date(2026, 1, 1))

    servis.odunc_ver("222", "zeynep")

    bildirici.gonder.assert_called_once_with(
        "zeynep", "'Tutunamayanlar' iade tarihi: 2026-01-15"
    )
```
:::

Proje kökünde `python -m pytest -v` çalıştırınca 8 test geçer (parametrize'lı test üç kez sayılır). `servis` fixture'ı
`depo` ve `bildirici` fixture'larını ister; pytest önce onları oluşturur, sonra servise verir. Sabit tarih veren
`lambda` sayesinde iade tarihi her gün aynıdır: 1 Ocak + 14 gün = 15 Ocak.

Her test aynı yapıyı izler: **Hazırla** (arrange), **Çalıştır** (act), **Doğrula** (assert). Aradaki boş satırlar
bu üç bölümü gözle ayırmayı kolaylaştırır. Sahte bildiricinin testte nasıl çalıştığını simülasyonla da görelim:

:::trace{src="sahte-bildirici-testi.trace.json" title="Fake ile bir birim testi|A unit test with a fake"}
Servisin `bildirici` alanının test fonksiyonundaki `sahte` nesnesini gösterdiğine ve `assert` satırına gelindiğinde mesajın listeye eklenmiş olduğuna dikkat et.
:::

:::callout{tone="tip" title="Gerçek uygulamada birleştirme"}
Testlerde fake'leri, üretimde gerçek nesneleri bir araya getiren yer **bileşim kökü**dür (composition root):
genellikle `main.py`. Orada `OduncServisi(PostgresDeposu(baglanti), EpostaBildirici(smtp))` yazılır. Servis kodu iki
dünyada da aynıdır; değişen yalnızca constructor'a verilen nesnelerdir.
:::

:::callout{tone="danger" title="Testlerin birbirine bağımlı olması"}
Bir testin, başka bir testin oluşturduğu veriye güvenmesi (ör. modül düzeyinde tek bir depo nesnesini tüm testlerin
paylaşması) en sinsi test hatalarından biridir: testler tek tek geçer, birlikte kalır ya da çalışma sırasına göre
sonuç değişir. Her testin kendi taze verisini fixture ile alması bu yüzden önemlidir.
:::

## Modülü bitirirken: bundan sonra ne öğrenmeli?

Bu modülde Python'u sıfırdan, yorumlayıcının nasıl çalıştığından başlayarak öğrendin: değişkenlerin etiket olduğunu,
çağrı yığınını ve heap'i, fonksiyonları ve closure'ları, veri yapılarını, OOP'yi, SOLID ve dependency injection'ı,
bellek yönetimini, eşzamanlılığı ve test yazmayı. Bu temel üzerine şu yollardan birini seçebilirsin:

| Yön | Ne öğrenmeli? | Neden? |
|---|---|---|
| **Web backend** | **FastAPI** (tip ipuçları + asyncio ile modern API'ler) ya da **Django** (her şeyi içinde getiren olgun çatı) | Bu derste kurduğun servis + depo yapısı doğrudan bir API'nin arkasına oturur |
| **Veri** | **pandas**, ardından NumPy ve görselleştirme (matplotlib) | Veri analizi ve makine öğrenmesinin giriş kapısı |
| **Tasarım** | **C modülü: tasarım kalıpları** | Strategy, Factory, Observer gibi kalıplar SOLID ve DI üzerine kurulur |
| **Kalite** | `ruff` (lint), `mypy` (tip kontrolü), `pytest-cov` (kapsam) | Projeyi büyütürken kodu temiz ve güvenli tutar |

Önerimiz: Kütüphane uygulamasını FastAPI ile bir REST API'ye dönüştür, `BellekDeposu` yerine SQLite kullanan bir
depo yaz ve mevcut testlerin hâlâ geçtiğini gör. Bu tek alıştırma, modüldeki neredeyse her konuyu bir arada kullanır.

## Özet

- Testler değişiklik yaparken güven, okunur belge ve daha iyi tasarım sağlar; test piramidinin tabanı hızlı birim testleridir.
- pytest: `test_` ile başlayan dosya ve fonksiyonlar, düz `assert`, okunur hata çıktısı; `python -m pytest -v` ile çalıştır.
- `pytest.raises` beklenen istisnayı, `fixture` paylaşılan hazırlığı, `parametrize` aynı testi farklı verilerle çalıştırır.
- Fake çalışan basit bir gerçeklemedir; `Mock` çağrıları kaydeder; `patch` ismi arandığı modülde geçici olarak değiştirir. Mümkünse DI + fake tercih et.
- TDD döngüsü: kırmızı (kalan test), yeşil (en basit çözüm), refaktör (testler yeşilken temizle).
- Kütüphane projesi: dataclass model, özel istisna hiyerarşisi, Protocol ile depo, constructor injection ile servis; saat bile bağımlılık olarak verilince testler deterministik olur.

:::quiz{src="quiz.json"}
:::

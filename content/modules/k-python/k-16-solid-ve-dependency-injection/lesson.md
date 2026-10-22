---
id: k-16-solid-ve-dependency-injection
slug: solid-ve-dependency-injection
module: k-python
order: 16
title:
  tr: "SOLID ve Dependency Injection"
  en: "SOLID and Dependency Injection"
summary:
  tr: "Bağımlılıkları dışarıdan vererek test edilebilir, gevşek bağlı Python kodu tasarla."
  en: "Design testable, loosely coupled Python code by injecting dependencies from outside."
durationMinutes: 21
level: advanced
tags: [python, oop, solid, dependency-injection, testing]
prerequisites: [k-15-moduller-paketler-ve-tip-ipuclari]
concepts: [solid, single-responsibility, open-closed, liskov-substitution, dependency-inversion, dependency-injection, test-doubles, composition-root]
---

## Neden tasarım ilkeleri?

Çalışan kod yazmak ilk adımdır. Asıl zorluk, altı ay sonra o koda yeni bir özellik eklerken her şeyin
kırılmamasıdır. Bir sınıfı değiştirdiğinde ilgisiz üç yerin bozulduğunu, bir fonksiyonu test etmek için gerçek
veritabanını ayağa kaldırman gerektiğini gördüğünde aslında **bağlılık** (coupling) sorunu yaşıyorsundur.

**SOLID**, Robert C. Martin'in derlediği beş nesne yönelimli tasarım ilkesinin baş harfleridir. Kural değil,
**yön gösterici**dirler: amacı değişime dayanıklı, anlaşılır ve test edilebilir kod yazmaktır. Bu dersin ikinci
yarısında SOLID'in son harfinin pratikteki karşılığı olan **dependency injection**'ı (bağımlılık enjeksiyonu)
simülasyonlarla göreceksin.

| Harf | İlke | Tek cümlede |
|---|---|---|
| **S** | Single Responsibility (Tek Sorumluluk) | Bir sınıfın değişmek için tek bir nedeni olmalı |
| **O** | Open/Closed (Açık/Kapalı) | Genişlemeye açık, değişikliğe kapalı ol |
| **L** | Liskov Substitution (Yerine Koyma) | Alt sınıf, üst sınıfın beklendiği her yerde sorunsuz çalışmalı |
| **I** | Interface Segregation (Arayüz Ayrımı) | Kimse kullanmadığı metotlara bağımlı olmaya zorlanmamalı |
| **D** | Dependency Inversion (Bağımlılığın Tersine Çevrilmesi) | Somut sınıflara değil, soyutlamalara bağımlı ol |

## S: Tek Sorumluluk

"Tek sorumluluk" "tek metot" demek değildir. Soru şudur: **bu sınıf kimin isteğiyle değişir?** Muhasebe rapor
biçimini, veritabanı ekibi tabloyu, pazarlama e-posta metnini değiştirmek isterse ve üçü de aynı sınıfa
dokunuyorsa, o sınıfın üç sorumluluğu var demektir.

:::code{lang="python" title="Kötü: her şeyi yapan sınıf → İyi: ayrılmış sorumluluklar"}
```python
# KÖTÜ: hesaplama, kalıcılık ve bildirim aynı yerde
class Fatura:
    def __init__(self, kalemler):
        self.kalemler = kalemler

    def toplam(self):
        return sum(k.fiyat * k.adet for k in self.kalemler)

    def veritabanina_kaydet(self):      # SQL değişirse Fatura değişir
        ...

    def eposta_gonder(self, adres):     # e-posta şablonu değişirse Fatura değişir
        ...


# İYİ: her sınıfın tek bir değişme nedeni var
class Fatura:
    def __init__(self, kalemler):
        self.kalemler = kalemler

    def toplam(self):
        return sum(k.fiyat * k.adet for k in self.kalemler)


class FaturaDeposu:
    def kaydet(self, fatura): ...


class FaturaBildirimi:
    def gonder(self, fatura, adres): ...
```
:::

## O: Açık/Kapalı

Yeni bir davranış eklemek için **mevcut, test edilmiş kodu açıp değiştirmek** zorunda kalıyorsan (her yeni
indirim türü için bir `elif` daha), ilke çiğneniyor demektir. İyi tasarımda yeni davranış **yeni kod ekleyerek**
gelir.

:::code{lang="python" title="if/elif zinciri yerine genişletilebilir kurallar"}
```python
# KÖTÜ: her yeni indirim türü bu fonksiyonu değiştirmeyi gerektirir
def son_fiyat(tutar, tur):
    if tur == "ogrenci":
        return tutar * 0.8
    elif tur == "kampanya":
        return tutar - 15
    # elif tur == "bayram": ... sonsuza kadar uzar


# İYİ: yeni indirim = yeni sınıf; son_fiyat hiç değişmez
from typing import Protocol


class IndirimKurali(Protocol):
    def uygula(self, tutar: float) -> float: ...


class OgrenciIndirimi:
    def uygula(self, tutar: float) -> float:
        return tutar * 0.8


class KampanyaIndirimi:
    def __init__(self, miktar: float) -> None:
        self.miktar = miktar

    def uygula(self, tutar: float) -> float:
        return max(tutar - self.miktar, 0)


def son_fiyat(tutar: float, kurallar: list[IndirimKurali]) -> float:
    for kural in kurallar:
        tutar = kural.uygula(tutar)
    return tutar


print(son_fiyat(100, [OgrenciIndirimi(), KampanyaIndirimi(15)]))  # 65.0
```
:::

## L: Liskov'un Yerine Koyma İlkesi

K-13'te kalıtımı gördün. Liskov ilkesi kalıtımın **ne zaman doğru** olduğunu söyler: üst sınıf nesnesiyle çalışan
kod, alt sınıf nesnesi verildiğinde de **şaşırmadan** çalışmalı. "Matematikte kare bir dikdörtgendir" diye kurulan
kalıtım bu ilkeyi bozan klasik örnektir:

:::code{lang="python" title="Kare bir Dikdortgen mi?"}
```python
class Dikdortgen:
    def __init__(self, en, boy):
        self.en, self.boy = en, boy

    def en_ayarla(self, deger):
        self.en = deger

    def alan(self):
        return self.en * self.boy


class Kare(Dikdortgen):
    def __init__(self, kenar):
        super().__init__(kenar, kenar)

    def en_ayarla(self, deger):        # kare kalabilmek için boyu da değiştiriyor
        self.en = self.boy = deger


def genislet(d: Dikdortgen):
    d.en_ayarla(10)
    return d.alan()                    # çağıran: "boy değişmedi, alan = 10 * boy" bekliyor


print(genislet(Dikdortgen(2, 5)))      # 50
print(genislet(Kare(5)))               # 100 → sürpriz! Kare, Dikdortgen'in yerine geçemiyor
```
:::

Liskov ihlalinin belirtileri: alt sınıfta `NotImplementedError` fırlatan ezilmiş metotlar, `isinstance` ile
"bu kareyse farklı davran" kontrolleri, üst sınıfın sözünü (dönüş tipi, yan etkiler) değiştiren metotlar. Çözüm
genellikle kalıtımı bırakıp ortak bir arayüz (`Sekil` protokolü) ya da bileşim (composition) kullanmaktır.

## I: Arayüz Ayrımı

Büyük, "her şeyi bilen" bir arayüz, onu uygulayan sınıfları kullanmadıkları metotları yazmaya zorlar.

:::code{lang="python" title="Şişman arayüz yerine küçük protokoller"}
```python
from typing import Protocol


# KÖTÜ: basit bir yazıcı tarama ve faks metotlarını da "uygulamak" zorunda
class CokIslevliCihaz(Protocol):
    def yazdir(self, belge: str) -> None: ...
    def tara(self) -> str: ...
    def faks_gonder(self, numara: str) -> None: ...


# İYİ: küçük, odaklı arayüzler
class Yazdirabilir(Protocol):
    def yazdir(self, belge: str) -> None: ...


class Taranabilir(Protocol):
    def tara(self) -> str: ...


def rapor_bas(yazici: Yazdirabilir, rapor: str) -> None:   # yalnızca ihtiyacını ister
    yazici.yazdir(rapor)
```
:::

Python'da `Protocol` bu ilkeyi uygulamayı çok kolaylaştırır: fonksiyon parametresinin tipini "bana gereken en küçük
arayüz" olarak yazarsın.

## D: Bağımlılığın Tersine Çevrilmesi

İlkenin iki parçası var:

1. Üst düzey modüller (iş kuralları: sipariş, ödeme) alt düzey modüllere (PostgreSQL, SMTP) bağımlı olmamalı;
   **ikisi de soyutlamalara** bağımlı olmalı.
2. Soyutlamalar ayrıntılara değil, ayrıntılar soyutlamalara bağımlı olmalı.

"Tersine çevrilme", bağımlılık okunun yönüyle ilgilidir. Klasik tasarımda `SiparisServisi → PostgresDepo` okunu
görürsün. DIP'te iş katmanı bir `SiparisDeposu` protokolü tanımlar ve `PostgresDepo` bu protokole uyar:
artık ayrıntı, iş katmanının koyduğu sözleşmeye bağımlıdır. Peki servis, somut depoyu nereden bulacak? Cevap:
**dependency injection**.

Aşağıdaki şema bu ters dönüşü iki tasarımı yan yana koyarak gösteriyor.

:::diagram{src="bagimlilik-yonu.svg" alt="Solda SiparisServisi doğrudan PostgresDepo'ya bağlı; sağda servis SiparisDeposu protokolünü kullanıyor, PostgresDepo ve SahteDepo protokole uyuyor|Left: SiparisServisi depends directly on PostgresDepo; right: the service uses the SiparisDeposu protocol, PostgresDepo and SahteDepo conform to it"}
Ok yönüne dikkat et: sağda ayrıntılar iş katmanının tanımladığı sözleşmeye doğru bakıyor.
:::

## Sorun: bağımlılığını kendisi oluşturan sınıf

:::code{lang="python" title="Sıkı bağlı (tightly coupled) servis"}
```python
class SiparisServisi:
    def __init__(self):
        self.depo = PostgresDepo("postgres://uretim-sunucusu/magaza")   # somut sınıf, sabit adres
        self.bildirim = SmtpEposta("smtp.sirket.com")                    # gerçek e-posta sunucusu

    def olustur(self, urun):
        self.depo.kaydet(urun)
        self.bildirim.gonder(f"{urun} alındı")
```
:::

Bu sınıfta neler yanlış?

- **Test edilemez:** `SiparisServisi()` yazdığın an gerçek veritabanına bağlanır. Her test gerçek bir müşteriye
  e-posta gönderebilir.
- **Değiştirilemez:** PostgreSQL'den başka bir depoya geçmek ya da SMTP yerine SMS göndermek için sınıfın içini
  değiştirmen gerekir (Açık/Kapalı ihlali).
- **Gizli bağımlılıklar:** Sınıfın imzasına (`__init__(self)`) bakarak neye ihtiyaç duyduğunu anlayamazsın.

## Çözüm: bağımlılığı dışarıdan vermek

Dependency injection'ın tanımı şaşırtıcı derecede basittir: **bir nesne ihtiyaç duyduğu nesneleri kendisi
oluşturmaz; onlar ona dışarıdan verilir.** En yaygın biçim **constructor injection**: bağımlılıklar `__init__`
parametresi olarak gelir.

Aşağıdaki simülasyonda aynı `SiparisServisi` sınıfı önce "gerçek" depo (burada ekrana SQL yazan bir sınıf),
sonra sahte (fake) depo ile kuruluyor. Heap'te servis nesnesinin `depo` ve `bildirim` özelliklerinin dışarıdan
verilen nesnelere **referans** tuttuğunu göreceksin.

:::trace{src="constructor-injection.trace.json" title="Constructor injection: gerçek ve sahte depo|Constructor injection: real and fake repository"}
`SiparisServisi` nesnesinin `depo` okunun önce `SqlDepo`'yu, ikinci serviste `SahteDepo`'yu gösterdiğine; `olustur` metodunun iki durumda da hiç değişmeden çalıştığına dikkat et.
:::

K-02'deki bellek modeliyle düşün: servis bağımlılıklarını **kopyalamaz**, sadece onlara isim bağlar. Hangi
nesnenin bağlanacağına servis değil, onu **kuran kod** karar verir. Servisin tek beklentisi, verilen nesnenin bir
`kaydet` metodu olmasıdır; bunu bir `Protocol` ile açıkça yazarsın:

:::code{lang="python" title="Protocol ile arayüz + constructor injection"}
```python
from typing import Protocol


class SiparisDeposu(Protocol):
    def kaydet(self, urun: str) -> None: ...


class Bildirici(Protocol):
    def gonder(self, mesaj: str) -> None: ...


class SiparisServisi:
    def __init__(self, depo: SiparisDeposu, bildirim: Bildirici) -> None:
        self.depo = depo              # bağımlılıklar imzada açıkça görünüyor
        self.bildirim = bildirim

    def olustur(self, urun: str) -> None:
        self.depo.kaydet(urun)
        self.bildirim.gonder(f"{urun} alındı")
```
:::

Simülasyonda nesne referanslarını satır satır gördün. Aşağıdaki animasyon aynı fikri kuşbakışı gösteriyor: önce
sıkı bağlı servis, sonra protokol, composition root ve aynı servise takılan sahte depo.

:::animation{scene="constructor-injection.scene.json"}
Servis sınıfının hiçbir adımda değişmediğine, yalnızca kurucuya verilen nesnenin değiştiğine dikkat et.
:::

## Testte fake, stub ve mock

Gerçek bağımlılığın yerine testte kullanılan nesnelere genel olarak **test dublörü** (test double) denir.
Üç yaygın türü karıştırılır:

| Tür | Ne yapar? | Örnek |
|---|---|---|
| **Fake** | Basitleştirilmiş ama **çalışan** bir uygulama | Veriyi listede tutan bellek içi depo |
| **Stub** | Sabit, önceden belirlenmiş cevaplar döndürür | Her zaman `1250.0` döndüren döviz kuru servisi |
| **Mock** | Kendisine **nasıl çağrıldığını** kaydeder; test bu çağrıları doğrular | `unittest.mock.Mock` ile `gonder` bir kez mi çağrıldı? |

:::code{lang="python" title="Fake ile test (ve aynı testin mock ile hâli)"}
```python
from dataclasses import dataclass, field
from unittest.mock import Mock


@dataclass
class SahteEposta:                                   # fake: gerçekten çalışır, ama bellekte
    gonderilenler: list[tuple[str, str]] = field(default_factory=list)

    def gonder(self, alici: str, konu: str) -> None:
        self.gonderilenler.append((alici, konu))


class KayitServisi:
    def __init__(self, eposta) -> None:
        self.eposta = eposta

    def kaydol(self, adres: str) -> None:
        self.eposta.gonder(adres, "Hoş geldin!")


def test_kaydolunca_hosgeldin_epostasi_gider():
    sahte = SahteEposta()
    KayitServisi(eposta=sahte).kaydol("ada@ornek.com")
    assert sahte.gonderilenler == [("ada@ornek.com", "Hoş geldin!")]   # durumu kontrol et


def test_mock_ile():
    mock_eposta = Mock()
    KayitServisi(eposta=mock_eposta).kaydol("can@ornek.com")
    mock_eposta.gonder.assert_called_once_with("can@ornek.com", "Hoş geldin!")   # çağrıyı kontrol et
```
:::

Fake'ler **sonuca** (durum), mock'lar **etkileşime** (hangi metot hangi argümanla çağrıldı) bakar. Mock'larla
dolu testler kodun iç yapısına sıkıca bağlanır ve yeniden düzenlemede (refactoring) kırılır; mümkün olduğunda
basit fake'leri tercih et. Testleri K-19'da pytest ile ayrıntılı yazacaksın.

:::callout{tone="warning" title="Enjeksiyonsuz koda yama yapmak"}
Bağımlılığı içeride oluşturan kodu test etmek için `unittest.mock.patch("modul.PostgresDepo")` ile yama
yapılabilir. Çalışır, ama test artık "hangi modülde hangi isimle içe aktarıldığı" gibi ayrıntılara bağlıdır;
yanlış yere yama yapmak (ismin tanımlandığı modül yerine kullanıldığı modül) çok yaygın bir hatadır. `patch`'e
sık ihtiyaç duyuyorsan, bu bağımlılığı enjekte etmen gerektiğinin işaretidir.
:::

## Fonksiyonlarda enjeksiyon ve varsayılan bağımlılık

DI yalnızca sınıflar için değildir. Python'da fonksiyonlar birinci sınıf nesneler olduğu için, bağımlılığı bir
**fonksiyon parametresi** olarak vermek en hafif yoldur. Saat, rastgelelik ve ortam değişkenleri tipik adaylardır:

:::code{lang="python" title="Saat bağımlılığını enjekte etmek"}
```python
from datetime import datetime
from typing import Callable


def selamla(simdi: Callable[[], datetime] = datetime.now) -> str:
    return "Günaydın" if simdi().hour < 12 else "İyi günler"


print(selamla())                                      # gerçek saate göre
print(selamla(lambda: datetime(2026, 1, 1, 9, 0)))    # Günaydın   → testte sabit saat
print(selamla(lambda: datetime(2026, 1, 1, 15, 0)))   # İyi günler
```
:::

Buradaki `simdi=datetime.now`, **varsayılan bağımlılık** desenidir: üretim kodu parametre vermeden çağırır,
test kendi saatini verir. Aynı deseni sınıflarda da kullanabilirsin: `def __init__(self, depo=None):` ve içeride
`self.depo = depo if depo is not None else BellekDepo()`. Kullanışlıdır, ama varsayılan **ağır** bir nesneyse
(gerçek veritabanı) sınıf yine somut sınıfa bağımlı kalır ve modül içe aktarılırken ya da nesne kurulurken
istemeden bağlantı açılabilir. Varsayılanı hafif ve güvenli tut.

:::callout{tone="danger" title="Varsayılan bağımlılığı tanımda oluşturma"}
`def __init__(self, depo=BellekDepo()):` yazma. K-06'daki değiştirilebilir varsayılan argüman tuzağı burada da
geçerli: `BellekDepo()` fonksiyon **tanımlanırken bir kez** oluşur ve tüm servis nesneleri aynı depoyu paylaşır.
Testler birbirinin verisini görür. `None` varsayılanı ve içeride oluşturma kullan.
:::

## Composition root: bağımlılıkları tek yerde kurmak

Bağımlılıkları dışarıdan veriyorsan, bir yerde biri onları **oluşturup birbirine bağlamalıdır**. Bu yere
**composition root** (bileşim kökü) denir ve genellikle uygulamanın giriş noktasıdır: `main()` fonksiyonu,
web uygulamasının başlangıç kodu. Kural: somut sınıflar (`PostgresDepo`, `SmtpEposta`) **yalnızca burada**
anılır; uygulamanın geri kalanı protokollerle konuşur.

:::code{lang="python" title="Bütün bağlantılar tek yerde"}
```python
# main.py — composition root
import os


def main() -> None:
    depo = PostgresDepo(os.environ["DATABASE_URL"])
    bildirim = SmtpEposta(os.environ["SMTP_HOST"])
    servis = SiparisServisi(depo=depo, bildirim=bildirim)
    api = SiparisApi(servis)
    api.calistir()


if __name__ == "__main__":
    main()
```
:::

Test dosyan ise kendi "mini kökünü" kurar: `SiparisServisi(depo=SahteDepo(), bildirim=SahteBildirim())`.
Ayarlar (bağlantı adresleri) da burada okunur ve parametre olarak aşağı iner; derinlerdeki bir sınıf
`os.environ`'a kendisi uzanmaz.

## Basit bir DI container

Bağımlılık ağacı büyüyünce composition root'taki elle kurulum uzayabilir. **DI container** (bağımlılık
konteyneri), "şu ada istek gelince şu fabrikayı çağır" kayıtlarını tutan ve nesneleri **talep edildiğinde**
kuran bir nesnedir. En basit hâli bir sözlüktür: anahtar bir ad, değer bir fabrika fonksiyonu.

:::trace{src="di-konteyner.trace.json" title="Sözlük tabanlı DI container|Dictionary-based DI container"}
`kaydet` çağrılarında sözlüğe yalnızca fabrikaların (lambda) eklendiğine; `coz("servis")` çağrısında servisin fabrikasının içeriden `coz("depo")` çağırdığına ve yığında iç içe çerçeveler oluştuğuna dikkat et.
:::

Simülasyondaki konteyner her `coz` çağrısında **yeni** nesne üretir (transient). Gerçek konteynerler ayrıca
**singleton** (uygulama boyunca tek nesne, örneğin bağlantı havuzu) ve **scoped** (her web isteği için bir nesne)
yaşam süreleri sunar. Singleton'ı eklemek için `coz` içinde üretilen nesneyi bir önbellek sözlüğünde saklaman yeterli.

### Gerçek dünyada

- **FastAPI `Depends`:** Python dünyasında en çok karşılaşacağın DI biçimidir. Uç nokta fonksiyonunun
  parametresinde neye ihtiyaç duyduğunu söylersin, FastAPI her istekte o fonksiyonu çağırıp sonucu verir. Testte
  `app.dependency_overrides[depo_ver] = lambda: SahteDepo()` ile gerçek bağımlılığı değiştirirsin.

:::code{lang="python" title="FastAPI ile bağımlılık (örnek)"}
```python
from fastapi import Depends, FastAPI

app = FastAPI()


def depo_ver() -> SiparisDeposu:
    return PostgresDepo(AYARLAR.database_url)


@app.post("/siparisler")
def siparis_olustur(urun: str, depo: SiparisDeposu = Depends(depo_ver)):
    depo.kaydet(urun)
    return {"durum": "alındı"}
```
:::

- **dependency-injector** kütüphanesi: konteynerleri, sağlayıcıları (`Singleton`, `Factory`) ve yapılandırmayı
  bildirimsel olarak tanımlamanı sağlayan, büyük uygulamalar için tam teşekküllü bir DI çatısıdır.

Çoğu Python projesi için **elle constructor injection + bir composition root** yeterlidir. Container'a ancak
bağımlılık grafiği gerçekten büyüyünce ihtiyaç duyarsın.

## Aşırı soyutlama tuzağı

SOLID ve DI güçlü araçlardır, ama her araç gibi yanlış yerde kullanılabilir:

- Yalnızca **bir** uygulaması olan ve olması da beklenmeyen bir şey için protokol, fabrika ve container yazmak
  kodu okumayı zorlaştırır. "Bir gün lazım olur" (YAGNI: You Aren't Gonna Need It) diye soyutlama ekleme.
- Python'da Java'daki gibi her sınıfa bir `IArayuz` eşi yazmak gerekmez. Protocol'ü, gerçekten birden fazla
  uygulama olduğunda ya da **test sınırında** (veritabanı, ağ, saat, dosya sistemi) kullan.
- Saf hesaplama yapan fonksiyonları (`toplam`, `vergi_hesapla`) enjekte etmeye gerek yoktur; onlar zaten
  kolayca test edilir. DI'ı **yan etkili** bağımlılıklar için sakla.
- İyi bir ölçüt: bir değişiklik yapmak için kaç dosyayı açmak zorundasın ve testini yazmak ne kadar kolay?
  Soyutlama bu iki soruya fayda sağlamıyorsa gereksizdir.

:::realworld{company="Instagram"}
Instagram'ın sunucu tarafı, dünyanın en büyük Django uygulamalarından biri olarak bilinen tek bir Python monolitidir.
Instagram Engineering'in 2019'da yayımladığı **"Python at Scale: Strict Modules"** yazısı, bu büyüklükte bir kod
tabanında **import anında çalışan yan etkili kodun** ne kadar pahalı olduğunu anlatır: modül düzeyinde bağlantı açan,
global durum kuran ya da başka modülleri değiştiren kod, sunucunun açılışını yavaşlatır, testleri birbirine bağlar ve
hangi parçanın neye bağımlı olduğunu görünmez kılar. Ekibin çözümü, belirli modüllerin import edilirken yan etki
üretmesini yasaklayan ve bunu araçla denetleyen "strict modules" yaklaşımı oldu.

Bu dersteki ilkelerle bağlantı açıktır: bağımlılığı modül yüklenirken gizlice oluşturmak yerine onu **açıkça kurup
dışarıdan vermek** (composition root ve constructor injection) hem testleri izole eder hem de bağımlılık grafiğini
okunur kılar. Büyük ekiplerde bu disiplin tek tek geliştiricinin iyi niyetine bırakılmaz; lint kuralları ve statik
analiz araçlarıyla otomatik olarak korunur.
:::

## Özet

- SOLID beş yön gösterici ilkedir: tek değişme nedeni (S), değiştirmeden genişletme (O), alt sınıfın üst sınıfın
  yerine sorunsuz geçmesi (L), küçük ve odaklı arayüzler (I), soyutlamalara bağımlılık (D).
- Bağımlılığını kendisi oluşturan sınıf sıkı bağlıdır: test etmek için gerçek veritabanı ve e-posta gerekir,
  değiştirmek için sınıfın içine dokunmak gerekir.
- Dependency injection, bağımlılıkları dışarıdan vermektir; en yaygın biçimi constructor injection'dır ve
  nesne yalnızca bağımlılıklarına **referans** tutar.
- `typing.Protocol` ile tanımlanan yapısal arayüzler, gerçek ve sahte uygulamaların aynı yere takılmasını sağlar.
- Testte fake (çalışan basit uygulama), stub (sabit cevap) ve mock (çağrı kaydı) kullanılır; mümkünse fake tercih et.
- Bağımlılıkları uygulamanın giriş noktasındaki **composition root**'ta kur; büyük projelerde bir DI container ya
  da FastAPI `Depends` bu işi kolaylaştırır.
- Soyutlamayı ihtiyaç olduğunda ekle: yan etkili sınırlarda DI, saf mantıkta sadelik.

:::quiz{src="quiz.json"}
:::

:::next{lesson="k-17-bellek-yonetimi-ve-gc"}
:::

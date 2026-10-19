---
id: k-01-python-nasil-calisir
slug: python-nasil-calisir
module: k-python
order: 1
title:
  tr: "Python Nasıl Çalışır: Yorumlayıcı, Bytecode ve İlk Program"
  en: "How Python Runs: Interpreter, Bytecode and Your First Program"
summary:
  tr: "Python kodunun bytecode'a dönüşüp satır satır çalışmasını izleyerek ilk programını yaz."
  en: "Write your first program while watching Python compile to bytecode and run line by line."
durationMinutes: 20
level: beginner
tags: [python, yorumlayici, bytecode, ilk-program, hatalar]
prerequisites: []
concepts: [interpreter, bytecode, python-virtual-machine, indentation, syntax-error, runtime-error, f-string]
---

## Python nedir, nerede kullanılır?

Python, 1991'de Guido van Rossum tarafından yayımlanan, **okunabilirliği** öne çıkaran, genel amaçlı bir
programlama dilidir. Kodun İngilizce cümleye yakın okunması, süslü parantez yerine girinti kullanması ve
"pilleri dahil" (batteries included) denen zengin standart kütüphanesi onu hem yeni başlayanlar hem de
profesyoneller için popüler yapar.

Python'u bugün şu alanlarda sıkça görürsün:

| Alan | Örnek kullanım | Bilinen araçlar |
|---|---|---|
| Web arka ucu (backend) | API'ler, yönetim panelleri | Django, FastAPI, Flask |
| Veri analizi | Tablo işleme, raporlama | pandas, NumPy, Jupyter |
| Yapay zekâ ve makine öğrenmesi | Model eğitimi, çıkarım | PyTorch, scikit-learn |
| Otomasyon ve betikler | Dosya düzenleme, rapor üretme, DevOps | Standart kütüphane, Ansible |
| Test otomasyonu | API ve arayüz testleri | pytest, Playwright |

Bu modülde Python'u sıfırdan, ama "yüzeyde" kalmadan öğreneceksin: her konuda yorumlayıcının arka planda ne
yaptığını **simülasyonlarla** göreceksin. İlk adım, yazdığın kodun nasıl çalıştığını anlamak.

## Kurulum ve sürüm kontrolü

Python'u [python.org](https://www.python.org/downloads/) adresinden indirebilir ya da işletim sisteminin paket
yöneticisini kullanabilirsin (macOS'ta `brew install python`, Ubuntu'da `sudo apt install python3`). Windows'ta
kurulum sihirbazındaki **"Add python.exe to PATH"** kutusunu işaretlemeyi unutma.

Kurulumdan sonra terminalde sürümü kontrol et:

:::code{lang="bash" title="Sürüm kontrolü"}
```bash
python3 --version
# Python 3.14.6   (senin sürümün farklı olabilir)

# Windows'ta komut çoğunlukla şöyledir:
py --version
```
:::

Bu derslerdeki örnekler **Python 3.10 ve üstü** ile çalışır; bazı özellikler daha yeni sürüm ister ve
yanında belirtilir. Python 2 artık desteklenmiyor (2020'de ömrünü tamamladı), yeni projede kullanma.

:::callout{tone="info" title="python mu, python3 mü?"}
macOS ve Linux'ta çoğu zaman `python3` komutunu kullanırsın; bazı sistemlerde `python` hiç yoktur ya da eski
bir sürümü gösterir. Sanal ortam (virtual environment) etkinleştirildiğinde ise `python` doğru sürümü gösterir.
Sanal ortamları ve paket yönetimini ileriki derslerde göreceksin.
:::

## REPL: Python ile sohbet etmek

Terminalde yalnızca `python3` yazarsan **etkileşimli kabuk** açılır. Buna REPL (Read–Eval–Print Loop) denir:
yazdığın ifadeyi **okur**, **değerlendirir**, sonucu **yazdırır** ve tekrar bekler. `>>>` işareti girdi bekliyor demektir.

:::code{lang="python" title="REPL oturumu"}
```python
>>> 2 + 3
5
>>> "Merhaba".upper()
'MERHABA'
>>> isim = "Ada"
>>> isim
'Ada'
>>> exit()
```
:::

REPL bir şeyi hızlıca denemek için harikadır: "bu metot ne döndürüyor?" sorusunu saniyeler içinde yanıtlar.
Dikkat et: REPL'de bir ifadenin değeri otomatik gösterilir, ama bir **dosyada** (script) çalışırken değeri görmek
için `print()` kullanman gerekir.

## İlk program: print ve yorumlar

Bir metin düzenleyicide `merhaba.py` adında bir dosya oluştur:

:::code{lang="python" title="merhaba.py"}
```python
# Bu bir yorumdur: Python bu satırı yok sayar.
print("Merhaba, dünya!")      # satır sonuna da yorum yazılabilir
print("Toplam:", 2 + 3)       # virgülle ayrılan değerler arasına boşluk konur
print("a", "b", sep="-")      # ayırıcıyı değiştirmek: a-b
```
:::

Çalıştırmak için terminalde:

:::code{lang="bash" title="Dosyayı çalıştırma"}
```bash
python3 merhaba.py
# Merhaba, dünya!
# Toplam: 5
# a-b
```
:::

- `print()` aldığı değerleri metne çevirir, aralarına boşluk koyar ve sonuna satır sonu ekler.
- `#` ile başlayan her şey satır sonuna kadar **yorumdur** (comment). Yorumlar kodu okuyan insanlar içindir;
  "ne" yaptığını değil, **neden** öyle yaptığını açıklayan yorumlar en değerli olanlardır.
- Python'da çok satırlı yorum için özel bir sözdizimi yoktur; her satıra `#` koyarsın. Fonksiyonların başına
  yazılan `"""..."""` metinleri ise **docstring**'dir ve belgelendirme için kullanılır (fonksiyonlar dersinde).

## Girinti ve bloklar

Birçok dil kod bloklarını `{ }` ile işaretler. Python'da **girinti (indentation) sözdiziminin parçasıdır**:
iki nokta (`:`) ile biten bir satırdan sonra gelen ve daha içeride başlayan satırlar o satırın **bloğunu** oluşturur.

:::code{lang="python" title="Girinti bloğu belirler"}
```python
yas = 20
if yas >= 18:
    print("Reşit")          # if bloğunun içinde
    print("Oy kullanabilir") # hâlâ if bloğunda
print("Kontrol bitti")      # blok dışında: her durumda çalışır
```
:::

Girintiyi bozarsan program **hiç başlamaz**. Python 3.14 ile alınan gerçek hata mesajları:

:::code{lang="python" title="IndentationError örnekleri"}
```python
yas = 20
if yas >= 18:
print("Reşit")
# IndentationError: expected an indented block after 'if' statement on line 2

x = 1
  y = 2
# IndentationError: unexpected indent
```
:::

:::callout{tone="warning" title="Sekme ile boşluğu karıştırma"}
Standart (PEP 8) her girinti seviyesi için **4 boşluk** kullanmaktır. Aynı dosyada sekme (tab) ve boşluğu
karıştırmak `TabError` ya da gözle görülmeyen hatalara yol açar. Editörünü "Tab tuşu 4 boşluk eklesin"
şeklinde ayarla; VS Code ve PyCharm Python dosyalarında bunu varsayılan olarak yapar.
:::

## Yorumlayıcı perde arkasında ne yapar?

Python'a genellikle "yorumlanan dil" (interpreted language) denir, ama bu tam resim değildir. En yaygın Python
uygulaması olan **CPython** (python.org'dan indirdiğin, C ile yazılmış yorumlayıcı) bir dosyayı çalıştırırken
kabaca şu aşamalardan geçer:

1. **Okuma ve ayrıştırma (parsing):** Kaynak metin parçalara (token) bölünür ve sözdizimi kontrol edilir. Bir
   parantez kapanmamışsa ya da girinti bozuksa burada `SyntaxError` oluşur ve **hiçbir satır çalışmaz**.
2. **Derleme (compile):** Ayrıştırılmış kod, **bytecode** denen, Python sanal makinesine özel basit komutlara
   çevrilir. Bu, makine kodu değildir; işlemci onu doğrudan çalıştıramaz.
3. **Çalıştırma:** **Python sanal makinesi** (PVM, Python Virtual Machine) bytecode komutlarını tek tek
   alıp yürütür. Bu bir döngüdür: "sıradaki komutu al, uygula, devam et".

| Aşama | Girdi | Çıktı | Bu aşamada çıkabilecek hata |
|---|---|---|---|
| Ayrıştırma | `.py` kaynak metni | Sözdizimi ağacı (AST) | `SyntaxError`, `IndentationError` |
| Derleme | AST | Bytecode (kod nesnesi) | Nadiren (ör. bazı `SyntaxError` türleri) |
| Çalıştırma (PVM) | Bytecode | Programın davranışı, çıktı | `NameError`, `TypeError`, `ValueError`... |

### dis ile bytecode'u görmek

Standart kütüphanedeki `dis` (disassembler) modülü bir fonksiyonun bytecode'unu okunur biçimde gösterir:

:::code{lang="python" title="dis modülü (çıktı Python 3.14.6 ile alındı)"}
```python
import dis

def topla(a, b):
    sonuc = a + b
    return sonuc

dis.dis(topla)
#   3           RESUME                   0
#
#   4           LOAD_FAST_BORROW_LOAD_FAST_BORROW 1 (a, b)
#               BINARY_OP                0 (+)
#               STORE_FAST               2 (sonuc)
#
#   5           LOAD_FAST_BORROW         2 (sonuc)
#               RETURN_VALUE
```
:::

Soldaki sayılar kaynak satır numaralarıdır. `sonuc = a + b` satırının üç adıma bölündüğünü görüyorsun:
`a` ve `b` değerlerini yükle, `+` işlemini uygula, sonucu `sonuc` adına kaydet. PVM bu komutları sırayla yürütür.

:::callout{tone="info" title="Bytecode sürüme bağlıdır"}
Bytecode komutlarının adları ve sayısı Python sürümleri arasında değişir. Yukarıdaki `LOAD_FAST_BORROW_LOAD_FAST_BORROW`
gibi birleşik komutlar yeni sürümlerdeki optimizasyonların ürünüdür; senin sürümünde farklı adlar görmen normaldir.
Bytecode'u ezberlemen gerekmez: önemli olan, kaynak kodun çalışmadan önce **derlendiğini** bilmektir.
:::

### __pycache__ ve .pyc dosyaları

Bir dosyayı başka bir dosyadan `import` ettiğinde CPython o modülün bytecode'unu diske kaydeder, böylece
sonraki çalıştırmada yeniden derlemesi gerekmez. Bu dosyalar modülün yanındaki `__pycache__` klasörüne yazılır:

:::code{lang="bash" title="__pycache__ içeriği"}
```bash
python3 main.py          # main.py içinde: import yardimci
ls __pycache__
# yardimci.cpython-314.pyc
```
:::

Dosya adındaki `cpython-314`, bytecode'un hangi yorumlayıcı ve sürüm için üretildiğini söyler. Kaynak dosya
değişirse `.pyc` otomatik olarak yeniden üretilir. Doğrudan çalıştırdığın ana dosya (`python3 main.py`) ise
genellikle önbelleğe yazılmaz. `__pycache__` klasörünü git'e eklemezsin; `.gitignore` dosyasına konur.

### CPython, PyPy ve diğerleri

"Python" aslında bir dil tanımıdır; onu çalıştıran farklı **uygulamalar** (implementation) vardır:

- **CPython:** Referans uygulama, C ile yazılmıştır. Neredeyse herkesin kullandığı budur ve bu modüldeki
  ayrıntılar (bytecode, referans sayımı) CPython'a göredir.
- **PyPy:** **JIT (just-in-time) derleyici** içeren bir uygulama. Sık çalışan kodu çalışma sırasında makine
  koduna çevirerek uzun süren, saf Python ile yazılmış programlarda belirgin hız kazandırabilir. C ile yazılmış
  bazı eklenti kütüphanelerle uyumluluğu CPython kadar geniş değildir.
- Ayrıca MicroPython (mikrodenetleyiciler) gibi özel amaçlı uygulamalar da vardır.

Hangisini kullandığını öğrenmek için: `import sys; print(sys.implementation.name)` → `cpython`.

## Program satır satır, yukarıdan aşağı çalışır

PVM programını **yukarıdan aşağıya**, her satırı sırayla çalıştırarak yürütür (koşullar, döngüler ve
fonksiyonlar bu sırayı değiştirir; onları sonraki derslerde göreceksin). Her atama satırı, sağ tarafı hesaplar
ve sonucu bir isme bağlar. Bir isim sonradan değiştirildiğinde **önceki satırlar yeniden çalışmaz**.

Aşağıdaki simülasyonda soldaki kodda **yeşil ok** birazdan çalışacak satırı gösterir. Sağdaki tabloda global
çerçevedeki (global frame) isimleri ve altta **Çıktı** panelini izle.

:::trace{src="satir-satir.trace.json" title="Satır satır çalışma|Line-by-line execution"}
`fiyat = 15` satırından sonra `toplam` değerinin kendiliğinden değişmediğine, çıktının satırların çalışma sırasıyla oluştuğuna dikkat et.
:::

Bu simülasyondan şunu çıkar: Python bir tablo hesaplayıcı (Excel) gibi formülleri canlı tutmaz. `toplam =
fiyat * adet` satırı çalıştığı anda **o anki** değerlerle bir kez hesaplanır. Güncel sonucu istiyorsan hesabı
tekrar yazman (ya da ileride göreceğin gibi bir fonksiyona koyman) gerekir.

## Hata türleri: program ne zaman durur?

Python'da hataları ikiye ayırmak çok işine yarar.

### SyntaxError: program hiç başlamaz

Sözdizimi hatası ayrıştırma aşamasında yakalanır. Dosyanın 100. satırında bir parantez açık kalsa bile
1. satırdaki `print` **çalışmaz**, çünkü derleme hiç tamamlanmamıştır:

:::code{lang="python" title="SyntaxError: hiçbir şey yazdırılmaz"}
```python
print("Merhaba")
print("Dünya"
#   File "s1.py", line 2
#     print("Dünya"
#          ^
# SyntaxError: '(' was never closed
```
:::

Çıktıda "Merhaba" yok! Yeni Python sürümleri hata mesajlarını oldukça açıklayıcı yazar; mesajı ve gösterilen
satırı dikkatle oku. Bazen asıl hata gösterilen satırın **bir önceki** satırındadır (kapanmamış bir parantez
gibi).

### Çalışma zamanı hataları: hataya kadar her şey çalışır

Sözdizimi doğruysa program başlar. Hata ancak sorunlu satıra **gelindiğinde** ortaya çıkar; o satıra kadar olan
her şey çalışmış, çıktılar yazılmış olur. Bu hatalara çalışma zamanı hatası (runtime error) ya da Python
terimiyle **istisna** (exception) denir. En sık karşılaşacakların:

| Hata | Ne zaman? | Örnek |
|---|---|---|
| `NameError` | Tanımlanmamış bir isim kullanıldığında | `print(sayc)` (yazım hatası) |
| `TypeError` | İşlem bu türler için anlamsızsa | `"yaş: " + 25` |
| `ValueError` | Tür doğru ama değer uygun değilse | `int("abc")` |
| `ZeroDivisionError` | Sıfıra bölmede | `10 / 0` |

:::trace{src="calisma-zamani-hatasi.trace.json" title="Hataya kadar çalışan program|A program that runs until the error"}
Çıktı panelinde ilk üç adımın yazıldığına, son adımın NameError ile bittiğine ve 5. adımın hiç çalışmadığına dikkat et.
:::

Gerçek terminalde bu hata bir **traceback** (geri izleme) ile gösterilir. Traceback'i aşağıdan yukarı oku: en
alttaki satır hatanın türünü ve mesajını, onun üstü hangi dosyanın hangi satırında olduğunu söyler.

:::code{lang="python" title="TypeError ve traceback (Python 3.14)"}
```python
print("a")
print("yaş: " + 25)
# a
# Traceback (most recent call last):
#   File "s4.py", line 2, in <module>
#     print("yaş: " + 25)
#           ~~~~~~~~^~~~
# TypeError: can only concatenate str (not "int") to str
```
:::

:::callout{tone="danger" title="Çalışmayan satırdaki hata gizli kalır"}
Python çalışma zamanı hatalarını önceden kontrol etmez. Bir `if` bloğunun içinde yazım hatası varsa ve o blok
hiç çalışmazsa program sorunsuz görünür; hata, koşulun ilk kez doğru olduğu gün (çoğunlukla canlı ortamda)
patlar. Bu yüzden kodunun **her dalını** çalıştıran testler yazmak ve `ruff`, `mypy` gibi statik analiz
araçları kullanmak Python'da özellikle önemlidir.
:::

## Kullanıcıdan veri almak: input()

`input()` kullanıcıya bir istem gösterir, Enter'a basılana kadar bekler ve yazılanı **her zaman metin (str)**
olarak döndürür. Sayıyla hesap yapacaksan dönüştürmen gerekir:

:::code{lang="python" title="input ve tip dönüşümü"}
```python
isim = input("Adın ne? ")          # kullanıcı: Ada
yas_metin = input("Kaç yaşındasın? ")  # kullanıcı: 30
yas = int(yas_metin)               # "30" → 30
print(f"Merhaba {isim}, 5 yıl sonra {yas + 5} yaşında olacaksın.")
# Merhaba Ada, 5 yıl sonra 35 yaşında olacaksın.
```
:::

Kullanıcı `otuz` yazarsa `int()` bir `ValueError` fırlatır. Hatalı girdiyi nazikçe ele almayı (`try/except`)
istisnalar dersinde öğreneceksin. Simülasyonlarda `input()` kullanmıyoruz, çünkü iz önceden kaydedilir ve
kullanıcıdan girdi bekleyemez.

## f-string ile çıktı biçimlendirme

Metinle değerleri birleştirmenin en okunur yolu **f-string**'dir (Python 3.6+): metnin önüne `f` koyarsın ve
süslü parantez içine istediğin ifadeyi yazarsın. Python ifadeyi hesaplar ve metne çevirir; bu yüzden `"yaş: " +
25` hatası f-string'de oluşmaz.

:::code{lang="python" title="f-string temelleri"}
```python
urun = "Kalem"
fiyat = 12.5
adet = 3
print(f"{adet} adet {urun}: {fiyat * adet} TL")   # 3 adet Kalem: 37.5 TL
print(f"Fiyat: {fiyat:.2f} TL")                   # Fiyat: 12.50 TL
print(f"{adet=}")                                 # adet=3  (hata ayıklarken çok kullanışlı)
```
:::

Biçim belirteçlerinin (`:.2f`, `:>6`, `:,`) ayrıntısını veri tipleri dersinde göreceksin.

## PEP 8: okunur kodun ortak dili

**PEP 8**, Python topluluğunun resmî kod stili kılavuzudur. Kuralları sana dayatan bir derleyici yoktur, ama
herkesin aynı stili kullanması başkasının kodunu okumayı çok kolaylaştırır. Başlangıç için akılda tutman
gerekenler:

- Girinti için **4 boşluk**; sekme kullanma.
- Değişken ve fonksiyon adları **snake_case**: `toplam_fiyat`, `kullanici_sayisi`. Sınıf adları
  **PascalCase**: `Siparis`. Sabitler **BÜYÜK_HARF**: `MAX_DENEME = 3`.
- Operatörlerin iki yanına birer boşluk: `x = a + b`; virgülden sonra bir boşluk: `print(a, b)`.
- Satırları kısa tut (PEP 8 79 karakter önerir; birçok ekip 88–100 kullanır).
- Anlamlı isimler seç: `x` yerine `ogrenci_sayisi`.

:::callout{tone="tip" title="Stili elle düzeltme, araçlara bırak"}
`ruff format` ya da `black` gibi biçimlendiriciler kodunu kaydettiğin anda PEP 8'e uygun hale getirir;
`ruff check` ise olası hataları ve stil sorunlarını raporlar. Editörüne bir kez kurarsın, sonra stil
tartışmalarına zaman harcamazsın.
:::

## Özet

- Python okunabilirliği öne çıkaran, web, veri, yapay zekâ ve otomasyonda yaygın, genel amaçlı bir dildir;
  `python3 --version` ile sürümünü kontrol edersin.
- REPL hızlı deneme içindir; dosyadaki programda değer görmek için `print()` gerekir. `#` yorum başlatır.
- Girinti sözdiziminin parçasıdır: `:` ile biten satırın bloğu 4 boşluk içeriden başlar; bozuk girinti
  `IndentationError` verir.
- CPython kaynak kodu önce **bytecode**'a derler, sonra **Python sanal makinesi** bu komutları tek tek yürütür;
  `dis` modülü bytecode'u gösterir, import edilen modüllerin bytecode'u `__pycache__` içinde `.pyc` olarak saklanır.
- Program yukarıdan aşağı satır satır çalışır; bir ismi değiştirmek önceki hesapları güncellemez.
- `SyntaxError` programın hiç başlamamasına yol açar; çalışma zamanı hataları (`NameError`, `TypeError`...)
  o satıra gelinene kadar her şeyin çalışmasına izin verir.
- `input()` her zaman `str` döndürür; f-string ile değerleri okunur biçimde yazdırırsın; PEP 8 ortak stil dilidir.

:::quiz{src="quiz.json"}
:::

:::next{lesson="k-02-degiskenler-ve-bellek-modeli"}
:::

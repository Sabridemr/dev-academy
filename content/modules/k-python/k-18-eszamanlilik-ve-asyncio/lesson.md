---
id: k-18-eszamanlilik-ve-asyncio
slug: eszamanlilik-ve-asyncio
module: k-python
order: 18
title:
  tr: "Eşzamanlılık: Thread, GIL, multiprocessing ve asyncio"
  en: "Concurrency: Threads, the GIL, multiprocessing and asyncio"
summary:
  tr: "GIL'in etkisini, thread ile process farkını ve asyncio ile beklerken iş yapmayı öğren."
  en: "Learn the GIL's impact, threads vs processes and doing work while awaiting with asyncio."
durationMinutes: 23
level: advanced
tags: [python, eszamanlilik, asyncio, threading, multiprocessing, gil]
prerequisites: [k-17-bellek-yonetimi-ve-gc]
concepts: [concurrency, parallelism, threading, gil, race-condition, multiprocessing, asyncio, event-loop]
---

## Neden eşzamanlılık?

Bir web sunucusu düşün: her istekte veritabanına sorgu atıyor, başka bir servise HTTP isteği yapıyor ve sonucu
döndürüyor. Bu sürenin büyük kısmında işlemci **hiçbir şey yapmıyor**, ağdan cevap bekliyor. Programın bir isteği
beklerken diğerlerini de karşılayabilmesi gerekir. Ya da tersine, 10 bin fotoğrafı yeniden boyutlandırıyorsun ve
bilgisayarında 8 çekirdek var; tek çekirdekle çalışmak zamanın 7/8'ini çöpe atmaktır.

Bu iki problem farklıdır ve Python'da farklı araçlarla çözülür. Bu derste önce kavramları ayıracağız, sonra
`threading`, GIL, `multiprocessing`, `concurrent.futures` ve `asyncio`'yu tek tek göreceğiz. Dersin sonunda "benim
işim için hangisi?" sorusunu bir tabloyla cevaplayabileceksin.

## Eşzamanlılık ve paralellik

İki terim sık karıştırılır:

- **Eşzamanlılık** (concurrency): Birden fazla işin **aynı zaman aralığında ilerlemesi**. İşler sırayla, parça parça
  çalışabilir. Tek bir aşçının çorba kaynarken salata doğraması gibi: aynı anda iki elle iki iş yapmıyor, ama
  beklerken boş durmuyor.
- **Paralellik** (parallelism): Birden fazla işin **aynı anda, fiziksel olarak** çalışması. İki aşçının iki ayrı
  tezgâhta aynı anda çalışması gibi. Birden fazla çekirdek gerekir.

Her paralel program eşzamanlıdır, ama her eşzamanlı program paralel değildir.

### I/O-bound ve CPU-bound

Doğru aracı seçmek için önce işinin **nerede beklediğini** bilmelisin:

| Tür | Zamanın çoğu nereye gidiyor? | Örnekler | Ne yardımcı olur? |
|---|---|---|---|
| **I/O-bound** (giriş/çıkışa bağlı) | Ağ, disk, veritabanı cevabını **beklemeye** | HTTP istekleri, dosya indirme, SQL sorguları | Eşzamanlılık: thread ya da asyncio |
| **CPU-bound** (işlemciye bağlı) | İşlemcinin **hesap yapmasına** | Resim işleme, şifreleme, büyük sayısal hesaplar | Paralellik: birden fazla süreç (process) |

## threading: aynı süreçte birden fazla iş

**Thread** (iş parçacığı), aynı süreç (process) içinde çalışan bağımsız bir yürütme akışıdır. Thread'ler aynı belleği
paylaşır: aynı global değişkenleri, aynı heap nesnelerini görürler. Bu, veri paylaşımını kolaylaştırır ama tehlikeli
de yapar (birazdan göreceğiz).

:::code{lang="python" title="Üç indirmeyi thread'lerle aynı anda beklemek"}
```python
import threading
import time


def indir(ad):
    print(f"{ad} başladı")
    time.sleep(1)          # ağ beklemesi yerine
    print(f"{ad} bitti")


baslangic = time.perf_counter()
threadler = [threading.Thread(target=indir, args=(f"dosya{i}",)) for i in range(3)]
for t in threadler:
    t.start()              # thread'i başlat, beklemeden devam et
for t in threadler:
    t.join()               # thread bitene kadar bekle
print(f"toplam: {time.perf_counter() - baslangic:.1f} sn")
# dosya0 başladı
# dosya1 başladı
# dosya2 başladı
# dosya0 bitti   ← "bitti" satırlarının sırası çalıştırmadan çalıştırmaya değişebilir
# dosya1 bitti
# dosya2 bitti
# toplam: 1.0 sn
```
:::

Sıralı çalışsaydı 3 saniye sürecekti; thread'lerle 1 saniye. Çünkü `time.sleep` (ve gerçek ağ/disk beklemeleri)
sırasında thread kenara çekilir ve diğerleri çalışır. `start()` thread'i başlatır, `join()` ana programın o thread'in
bitmesini beklemesini sağlar. `join` unutulursa ana program sonuçlar hazır olmadan ilerleyebilir.

:::callout{tone="info" title="Simülasyonlarda neden thread yok?"}
Bu sitedeki simülasyon izleyicisi yalnızca ana thread'i adım adım izleyebilir. Bu yüzden thread kullanan kodları
yalnızca kod bloklarında gösteriyoruz. Thread'lerin araya girme (interleaving) davranışını ise birazdan generator'larla
**taklit ederek** simüle edeceğiz.
:::

## GIL: Global Interpreter Lock

CPython'da bir **Global Interpreter Lock** (GIL, küresel yorumlayıcı kilidi) vardır: aynı süreçte, aynı anda yalnızca
**bir** thread Python bytecode'u çalıştırabilir. Thread'ler GIL'i sırayla alır; bir thread beklemeye geçince (I/O)
ya da belirli bir süre (varsayılan 5 ms, `sys.getswitchinterval()`) çalıştıktan sonra GIL'i bırakır.

**Neden var?** K-17'de gördüğün referans sayaçlarını hatırla. Her atama, her fonksiyon çağrısı bu sayaçları değiştirir.
İki thread aynı sayacı aynı anda değiştirseydi sayaç bozulur, nesneler erken silinir ya da hiç silinmezdi. GIL, tek
bir büyük kilitle bütün bu iç yapıları korur. Basit, hızlı tek thread performansı ve C eklentileriyle kolay uyum sağlar.

**Etkisi:** I/O-bound işlerde GIL pek sorun değildir, çünkü bekleyen thread GIL'i bırakır. Ama CPU-bound işte iki
thread aynı anda hesap yapamaz:

:::code{lang="python" title="CPU-bound işte thread hızlandırmaz (örnek ölçüm, CPython 3.14, GIL açık)"}
```python
import threading
import time


def say(n):
    while n > 0:
        n -= 1


N = 20_000_000

baslangic = time.perf_counter()
say(N)
say(N)
print(f"sıralı:   {time.perf_counter() - baslangic:.2f} sn")   # sıralı:   0.36 sn

baslangic = time.perf_counter()
t1 = threading.Thread(target=say, args=(N,))
t2 = threading.Thread(target=say, args=(N,))
t1.start(); t2.start()
t1.join(); t2.join()
print(f"2 thread: {time.perf_counter() - baslangic:.2f} sn")   # 2 thread: 0.35 sn
```
:::

İki thread kullandık ama süre değişmedi: iş sırayla yapıldı. (Kesin süreler makineye göre değişir; önemli olan
oranın neredeyse 1 olmasıdır.)

:::callout{tone="info" title="GIL'siz Python: free-threaded yapı"}
PEP 703 ile Python 3.13'te **deneysel** bir GIL'siz yapı geldi; 3.14'te resmî olarak desteklenen ama hâlâ isteğe
bağlı bir yapıdır (genellikle `python3.14t` gibi ayrı bir yorumlayıcı olarak kurulur). Bu yapıda thread'ler gerçekten
paralel çalışabilir, ama tek thread performansı biraz düşer ve bazı C eklentileri henüz uyumlu değildir. Hangi yapıda
olduğunu `sys._is_gil_enabled()` ile görebilirsin. Varsayılan Python hâlâ GIL'lidir; bu dersteki ölçümler GIL'li
yapıya aittir.
:::

## Yarış durumu ve Lock

GIL Python'un **iç** yapılarını korur, senin **verini** değil. İki thread aynı veriyi "oku, değiştir, yaz" adımlarıyla
güncellerse ve bu adımların arasında thread değişimi olursa bir güncelleme kaybolabilir. Buna **yarış durumu**
(race condition) denir: sonuç, thread'lerin hangi sırayla çalıştığına bağlıdır.

Aşağıdaki simülasyonda iki "thread"i generator'larla taklit ediyoruz. `yield`, işletim sisteminin thread değiştirdiği
anı temsil ediyor; sırayı da biz elle seçiyoruz ki en kötü durumu görebilelim.

:::trace{src="yaris-durumu.trace.json" title="Yarış durumu: kaybolan güncelleme|Race condition: a lost update"}
İki görevin de `gecici` değişkenine 0 okuduğu ana dikkat et. İkisi de 1 yazıyor ve bir artış kayboluyor.
:::

Gerçek thread'lerle aynı hatayı görmek için oku ve yaz adımlarının arasına bir thread değişimi fırsatı koymak yeter:

:::code{lang="python" title="Gerçek thread'lerde yarış durumu"}
```python
import threading
import time

sayac = 0


def artir():
    global sayac
    for _ in range(1000):
        deger = sayac      # 1) oku
        time.sleep(0)      # burada başka thread'e geçilebilir
        sayac = deger + 1  # 2) yaz


threadler = [threading.Thread(target=artir) for _ in range(4)]
for t in threadler:
    t.start()
for t in threadler:
    t.join()
print(sayac)   # 4000 olmalı; her çalıştırmada farklı, çok daha küçük bir sayı çıkar (ör. 1033)
```
:::

Çözüm, oku-yaz bölümünü bir **kilit** (lock) ile korumaktır. `threading.Lock`, aynı anda yalnızca bir thread'in
korunan bölgeye (kritik bölge, critical section) girmesine izin verir:

:::code{lang="python" title="Lock ile güvenli artırma"}
```python
import threading
import time

sayac = 0
kilit = threading.Lock()


def artir():
    global sayac
    for _ in range(1000):
        with kilit:            # aynı anda yalnızca bir thread girebilir
            deger = sayac
            time.sleep(0)
            sayac = deger + 1


threadler = [threading.Thread(target=artir) for _ in range(4)]
for t in threadler:
    t.start()
for t in threadler:
    t.join()
print(sayac)   # 4000
```
:::

:::callout{tone="danger" title="sayac += 1 de güvenli değildir"}
`sayac += 1` tek satır olsa da bytecode düzeyinde oku, topla ve yaz adımlarından oluşur. Thread değişimi aralarına
düşebilir; deneyde hata nadir görünür ama üretimde, yük altında ortaya çıkar. Paylaşılan değiştirilebilir veriyi
**her zaman** kilitle koru ya da hiç paylaşma: thread'ler arasında veri aktarmak için `queue.Queue` kullan. İki kilidi
farklı sırayla alan thread'ler birbirini sonsuza kadar bekleyebilir (deadlock); kilitleri hep aynı sırayla al.
:::

## multiprocessing ve concurrent.futures

CPU-bound işte gerçek paralellik için **ayrı süreçler** (process) kullanılır. Her sürecin kendi Python yorumlayıcısı,
kendi belleği ve kendi GIL'i vardır; bu yüzden çekirdeklere gerçekten yayılırlar. Bedeli: süreç başlatmak pahalıdır
ve süreçler bellek paylaşmaz. Veriler `pickle` ile serileştirilip süreçler arasında kopyalanır.

Elle `multiprocessing.Process` yönetmek yerine çoğu zaman `concurrent.futures` modülünü kullanırsın. Thread havuzu ve
süreç havuzu için **aynı arayüzü** sunar:

:::code{lang="python" title="ThreadPoolExecutor ve ProcessPoolExecutor"}
```python
import time
from concurrent.futures import ProcessPoolExecutor, ThreadPoolExecutor


def kare_toplami(n):            # CPU-bound
    return sum(i * i for i in range(n))


def bekle(saniye):              # I/O-bound taklidi
    time.sleep(saniye)
    return saniye


if __name__ == "__main__":
    with ThreadPoolExecutor(max_workers=4) as havuz:
        print(list(havuz.map(bekle, [0.5, 0.5, 0.5, 0.5])))   # [0.5, 0.5, 0.5, 0.5] (~0.5 sn)

    with ProcessPoolExecutor() as havuz:          # varsayılan: çekirdek sayısı kadar süreç
        sonuclar = list(havuz.map(kare_toplami, [10_000_000] * 4))
    print(sonuclar[0])                            # 333333283333335000000
```
:::

`map` sonuçları **girdi sırasıyla** döndürür. Tek tek iş göndermek için `havuz.submit(fonk, arg)` bir `Future` nesnesi
döndürür; `future.result()` sonucu bekleyip alır.

:::callout{tone="warning" title="if __name__ == '__main__' koruması"}
macOS ve Windows'ta yeni süreçler modülü **baştan içe aktararak** başlar (spawn). Süreç havuzunu oluşturan kod
`if __name__ == "__main__":` bloğunda değilse, her alt süreç yeniden havuz oluşturmaya çalışır ve program hata verir.
Ayrıca alt süreçlere gönderdiğin fonksiyon modül düzeyinde tanımlı olmalıdır (lambda ya da iç fonksiyon pickle edilemez).
:::

## asyncio: tek thread'de binlerce bekleyiş

Thread'ler I/O-bound işi çözer ama her thread işletim sisteminden bellek ve zamanlama maliyeti ister; on binlerce
bağlantıda bu ağırlaşır. **asyncio** farklı bir yol izler: **tek thread** içinde, işbirlikçi (cooperative) çoklu görev.

Temel parçalar:

- **Coroutine:** `async def` ile tanımlanan fonksiyon. Çağırınca gövde çalışmaz, bir coroutine nesnesi döner.
- **await:** "Bu iş bitene kadar beni askıya al, bu arada başkası çalışsın." Yalnızca `async def` içinde kullanılır.
- **Olay döngüsü** (event loop): Hazır olan görevleri sırayla çalıştıran, bekleyenleri bekleme bitince uyandıran zamanlayıcı.
- **Task:** Olay döngüsüne kaydedilmiş, arka planda ilerleyen coroutine. `asyncio.create_task` ile oluşturulur.

En önemli fark şudur: thread'lerde işletim sistemi seni **istediği an** durdurabilir. asyncio'da ise bir görev yalnızca
`await` noktalarında kontrolü bırakır. Yarış durumları büyük ölçüde azalır, çünkü iki `await` arasındaki kod kesintisiz
çalışır.

### Olay döngüsünün özü: işbirlikçi zamanlayıcı

Olay döngüsü sihir değildir. Fikrin özünü generator'larla 15 satırda yazabiliriz: her görev bir generator, `yield`
"kontrolü bırakıyorum" demek, zamanlayıcı da görevleri bir kuyrukta sırayla ilerletiyor.

:::trace{src="isbirlikci-zamanlayici.trace.json" title="Generator ile işbirlikçi zamanlayıcı|A cooperative scheduler with generators"}
Kuyruktaki iki generator'ın sırayla ilerlediğine ve `yield` sonrası yerel `i` değerinin korunduğuna dikkat et. Biten görev kuyruğa geri eklenmiyor.
:::

Gerçek asyncio'da `yield` yerine `await`, kuyruk yerine olay döngüsünün hazır görevler listesi vardır. Bir görev
`await asyncio.sleep(1)` dediğinde döngü onu bir zamanlayıcıya kaydeder ve süre dolunca yeniden kuyruğa koyar.
Ağ işlemlerinde de işletim sistemine "bu soket okunabilir olunca haber ver" denir. Python'da coroutine'ler zaten
generator mekanizmasının üzerine kuruludur.

### async/await, gather ve create_task

:::code{lang="python" title="Üç isteği asyncio.gather ile aynı anda beklemek"}
```python
import asyncio
import time


async def indir(ad, sure):
    print(f"{ad} başladı")
    await asyncio.sleep(sure)      # bekle ama olay döngüsünü serbest bırak
    print(f"{ad} bitti")
    return f"{ad}: {sure} sn"


async def main():
    baslangic = time.perf_counter()
    sonuclar = await asyncio.gather(
        indir("profil", 1),
        indir("siparisler", 2),
        indir("oneriler", 1),
    )
    print(sonuclar)
    print(f"toplam: {time.perf_counter() - baslangic:.1f} sn")


asyncio.run(main())
# profil başladı
# siparisler başladı
# oneriler başladı
# profil bitti
# oneriler bitti
# siparisler bitti
# ['profil: 1 sn', 'siparisler: 2 sn', 'oneriler: 1 sn']
# toplam: 2.0 sn
```
:::

`asyncio.run(main())` bir olay döngüsü oluşturur, `main`'i çalıştırır ve bitince döngüyü kapatır. Programın giriş
noktasında **bir kez** çağrılır. `gather` coroutine'leri görev olarak başlatır ve hepsi bitince sonuçları **verilen
sırayla** döndürür; toplam süre en uzun beklemedir (2 sn), toplamları değil (4 sn).

Aşağıdaki simülasyon gerçek asyncio ile çalışıyor. İzleyici asyncio'nun iç kodunu göstermez, yalnızca senin
coroutine çerçevelerin görünür. Bir coroutine askıya alındığında izleyici bunu "dönüş" olarak, devam ettirildiğinde
yeniden "çağrı" olarak gösterir.

:::trace{src="asyncio-gather.trace.json" title="asyncio.gather ile iki coroutine|Two coroutines with asyncio.gather"}
`a` coroutine'inin `await` satırında askıya alınıp `b`'nin başladığına, sonra `a`'nın kaldığı yerden devam ettiğine dikkat et. main çerçevesi bu sırada askıda.
:::

`create_task` ise bir coroutine'i hemen planlar ve sen başka işler yaparken arka planda ilerletir:

:::code{lang="python" title="create_task ve çıplak coroutine farkı"}
```python
import asyncio


async def hesapla(x):
    await asyncio.sleep(0.1)
    return x * 2


async def main():
    gorev = asyncio.create_task(hesapla(21))   # hemen planlanır
    print("görev oluşturuldu, başka iş yapılıyor")
    sonuc = await gorev
    print(sonuc)                  # 42

    c = hesapla(1)
    print(type(c).__name__)       # coroutine → henüz çalışmadı
    print(await c)                # 2


asyncio.run(main())
```
:::

### time.sleep tuzağı: olay döngüsünü bloklamak

Olay döngüsü tek thread'dir. Bir coroutine `await` etmeden uzun süre çalışırsa **bütün** görevler durur:

:::code{lang="python" title="time.sleep olay döngüsünü bloklar"}
```python
import asyncio
import time


async def kotu(ad):
    time.sleep(1)                  # olay döngüsünü BLOKLAR
    print(ad, "bitti")


async def main():
    baslangic = time.perf_counter()
    await asyncio.gather(kotu("a"), kotu("b"), kotu("c"))
    print(f"toplam: {time.perf_counter() - baslangic:.1f} sn")   # toplam: 3.0 sn


asyncio.run(main())
```
:::

:::callout{tone="danger" title="async fonksiyon içinde bloklayan çağrı"}
Yukarıdaki üç görev sırayla çalışır ve 3 saniye sürer; `await asyncio.sleep(1)` ile 1 saniye sürerdi. Kod hata
vermez, sadece sessizce yavaşlar; bu yüzden fark edilmesi zordur. Aynı sorun `requests` gibi senkron HTTP
kütüphaneleri, senkron veritabanı sürücüleri ve uzun CPU hesaplarıyla da olur. Asenkron kütüphaneler kullan
(`httpx`, `aiohttp`, `asyncpg`) ya da bloklayan işi `await asyncio.to_thread(fonk, arg)` ile bir thread'e gönder.
:::

## Hangi durumda hangisi?

| İş | Önerilen araç | Neden? |
|---|---|---|
| Birkaç düzine HTTP isteği, dosya indirme, senkron kütüphanelerle | `ThreadPoolExecutor` | Kolay; GIL beklemede serbest kalır; mevcut senkron kodla çalışır |
| Binlerce eşzamanlı bağlantı (web sunucusu, websocket, crawler) | `asyncio` | Tek thread, görev başına çok düşük maliyet |
| Ağır hesaplama (resim, sayısal analiz, sıkıştırma) | `ProcessPoolExecutor` | Her süreç kendi GIL'iyle ayrı çekirdekte çalışır |
| NumPy gibi C tabanlı kütüphanelerle büyük hesap | Çoğu zaman ek araç gerekmez | Bu kütüphaneler hesap sırasında GIL'i bırakıp kendi içinde paralelleşebilir |
| Basit bir betik, tek iş | Hiçbiri | Eşzamanlılık karmaşıklık ekler; önce ölç |

:::callout{tone="tip" title="Gerçek hayattan: yavaş rapor servisi"}
Bir rapor servisi 40 farklı API'den veri topluyor ve her istek ortalama 300 ms sürüyor: sıralı çalışınca 12 saniye.
İş I/O-bound olduğu için `ThreadPoolExecutor(max_workers=10)` ile toplama süresi yaklaşık 1,2 saniyeye iner. Servis
zaten FastAPI gibi asenkron bir çatıdaysa aynı iş `httpx.AsyncClient` ve `asyncio.gather` ile yapılır. Raporun sonundaki
ağır PDF üretimi ise CPU-bound'dur ve süreç havuzuna gönderilir.
:::

## Özet

- **Eşzamanlılık** işlerin aynı zaman aralığında ilerlemesi, **paralellik** aynı anda fiziksel olarak çalışmasıdır. Önce işinin I/O-bound mu CPU-bound mu olduğunu belirle.
- `threading.Thread` ile `start()`/`join()`; thread'ler belleği paylaşır ve I/O beklemelerinde gerçek kazanç sağlar.
- CPython'un **GIL**'i aynı anda tek thread'in bytecode çalıştırmasına izin verir; CPU-bound işte thread hızlandırmaz. 3.13+ free-threaded yapı isteğe bağlıdır.
- GIL senin verini korumaz: paylaşılan veriyi `Lock` ile koru ya da `queue.Queue` ile aktar; aksi hâlde **yarış durumu** oluşur.
- CPU-bound iş için süreçler: `ProcessPoolExecutor`; `if __name__ == "__main__"` korumasını unutma.
- `asyncio` tek thread'de işbirlikçi çalışır: `async def`, `await`, `asyncio.run`, `gather`, `create_task`. Olay döngüsü, generator tabanlı bir zamanlayıcının gelişmiş hâlidir.
- Coroutine içinde `time.sleep` gibi bloklayan çağrılar bütün döngüyü durdurur; `await asyncio.sleep` ya da `asyncio.to_thread` kullan.

:::quiz{src="quiz.json"}
:::

:::next{lesson="k-19-testler-ve-mini-proje"}
:::

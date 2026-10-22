---
id: o-05-processes-threads
slug: processes-threads
module: o-network-os
order: 5
title:
  tr: "Süreçler ve Thread'ler: Zamanlayıcı ve Yarış Koşulları"
  en: "Processes and Threads: The Scheduler and Race Conditions"
summary:
  tr: Süreç yaşam döngüsü, fork/exec, context switch, CPU zamanlayıcısı, thread'ler ve yarış koşulları; GIL'e köprü.
  en: Process lifecycle, fork/exec, context switches, the CPU scheduler, threads and race conditions; a bridge to the GIL.
durationMinutes: 30
level: intermediate
tags: [os, linux, process, thread, scheduler, concurrency]
prerequisites: [o-04-http-versions]
concepts: [process, process-states, fork-exec, context-switch, cpu-scheduler, thread, race-condition, mutex, gil]
---

## Kavram: çalışan bir program ne demektir?

Diskteki `python3` ya da `nginx` dosyası yalnızca bir talimat listesidir. Onu çalıştırdığınızda çekirdek (kernel) bir **süreç (process)** yaratır: kendi sanal adres alanı, açık dosya tanımlayıcıları (file descriptor), ortam değişkenleri, kullanıcı kimliği ve en az bir yürütme akışı olan yalıtılmış bir kap. Linux'ta her sürecin bir **PID**'si vardır ve çekirdek onu `task_struct` adlı bir yapıda izler. `ps aux` ya da `top` çıktısında gördüğünüz her satır böyle bir yapının özetidir.

Bir sunucuda yüzlerce süreç vardır ama çekirdek sayısı belki 4 ya da 16'dır. Aynı anda gerçekten çalışabilen akış sayısı çekirdek sayısı kadardır; geri kalan her şey **zamanlayıcının (scheduler)** CPU'yu çok hızlı biçimde paylaştırmasıyla oluşan bir yanılsamadır. Bu dersin amacı o yanılsamanın mekanizmasını görmek: süreç hangi durumlardan geçer, CPU bir süreçten diğerine nasıl el değiştirir, beklemek neden CPU harcamaz ve aynı belleği paylaşan thread'ler neden birbirinin verisini bozabilir.

## Süreç yaşam döngüsü

Bir süreç ömrü boyunca birkaç durum arasında gezinir:

- **New (yeni)**: çekirdek yapıları oluşturuluyor.
- **Ready (hazır)**: çalışmaya hazır, yalnızca CPU bekliyor; *run queue* içinde sırada.
- **Running (çalışıyor)**: şu an bir çekirdekte talimat yürütüyor.
- **Blocked / waiting (bloklu)**: bir olayı bekliyor — disk okuması, ağ paketi, kilit, `sleep`. Bu durumdaki süreç CPU kuyruğunda bile değildir; CPU harcamaz.
- **Terminated (sonlandı)**: `exit()` çağrıldı; ebeveyn çıkış kodunu `wait()` ile alana kadar **zombie** olarak tabloda kalır.

:::diagram{src="diagram.svg" alt="Süreç durum makinesi: new, ready, running, blocked ve terminated durumları ile aralarındaki geçişler|Process state machine: new, ready, running, blocked and terminated states with the transitions between them"}
Running → ready geçişi zaman dilimi bittiğinde (preemption), running → blocked geçişi bir sistem çağrısı beklemeye geçtiğinde olur. Blocked bir süreç doğrudan running'e dönemez; önce ready kuyruğuna girer.
:::

`top` çıktısındaki `S` sütunu bu durumların Linux karşılığını gösterir: `R` (running ya da runnable), `S` (kesilebilir uyku, ör. ağ bekleme), `D` (kesilemez uyku, çoğunlukla disk I/O), `Z` (zombie). **Load average** de aslında R ve D durumundaki süreçlerin ortalama sayısıdır; bu yüzden disk darboğazı olan bir makinede CPU boşta görünürken load average yüksek olabilir.

## fork ve exec: yeni süreç nasıl doğar?

Unix'te süreç yaratmak iki adımlıdır. **`fork()`** çağıran sürecin neredeyse birebir kopyasını üretir; çocuk, ebeveynin belleğini, açık dosyalarını ve kod konumunu devralır. Bellek gerçekte kopyalanmaz: iki süreç aynı fiziksel sayfaları **copy-on-write** olarak paylaşır, biri yazana kadar kopya oluşmaz. Ardından çocuk **`exec()`** ile kendi bellek görüntüsünü tamamen başka bir programla değiştirir. Shell'e `ls` yazdığınızda olan tam budur: shell fork eder, çocuk `exec("ls")` yapar, ebeveyn `wait()` ile bekler.

Bu ayrımın pratik sonuçları vardır. Gunicorn ya da PostgreSQL gibi sunucular bir ana süreç başlatıp işçileri fork ederek çoğaltır; copy-on-write sayesinde ortak kod ve salt okunur veriler fiziksel bellekte tek kopya kalır. Konteyner çalışma zamanları da sonunda bir `fork`/`clone` ve `exec` zincirinden ibarettir — bunu modülün son dersinde göreceğiz.

## Zamanlayıcı ve context switch

Linux'un varsayılan zamanlayıcısı uzun yıllar **CFS (Completely Fair Scheduler)** oldu; 6.6 sürümünden itibaren yerini **EEVDF** algoritmasına bıraktı. Ayrıntı farklı olsa da fikir aynıdır: her çalıştırılabilir sürece CPU'dan adil bir pay vermek ve hiçbirinin sonsuza dek beklememesini sağlamak. Çalışan süreç ya kendi isteğiyle CPU'yu bırakır (bloklayan bir sistem çağrısı yapar) ya da zamanlayıcı onun payının dolduğuna karar verip **önceden boşaltır (preemption)**. Bunu mümkün kılan, donanımın düzenli aralıklarla ürettiği zamanlayıcı kesmesidir.

CPU bir süreçten diğerine geçerken çekirdek bir **context switch** yapar: mevcut sürecin yazmaçlarını (program sayacı, yığın işaretçisi, genel yazmaçlar) kaydeder, sıradakini yükler ve gerekiyorsa adres alanını değiştirir. Tek bir geçiş mikrosaniyeler mertebesindedir ama bedava değildir: önbellekler ve TLB yeni sürecin verisiyle "soğuk" başlar. Saniyede yüz binlerce geçiş yapan bir sistem, işin önemli kısmını iş yapmak yerine el değiştirmeye harcıyor olabilir; `vmstat 1` çıktısındaki `cs` sütunu bu sayıyı gösterir.

Aşağıdaki animasyon tek çekirdekli bir CPU'nun üç süreç arasında paylaşılmasını, bir sürecin disk okumasına bloklanmasını ve disk kesmesiyle geri dönmesini izler.

:::predict{id="bloklu-surec-cpu"}
B süreci `read()` ile diskten veri istedi ve veri 5 ms sonra gelecek. Bu 5 ms boyunca CPU ne yapar? | Process B called `read()` to fetch data from disk and the data will arrive in 5 ms. What does the CPU do during those 5 ms?
- [ ] B'nin çekirdeğinde döngüde bekler; veri gelince B devam eder | Spins on B's core; B resumes when the data arrives
- [x] B bekleme kuyruğuna alınır, CPU hazır kuyruğundaki başka bir süreci çalıştırır | B moves to a wait queue and the CPU runs another process from the ready queue
- [ ] B'nin zaman dilimi dolana kadar CPU boşta kalır | The CPU idles until B's time slice expires
Açıklama: Bloklayan bir sistem çağrısı süreci *blocked* durumuna alır ve çekirdek hemen başka bir hazır süreci seçer. Disk işi bitince donanım bir kesme üretir, çekirdek B'yi tekrar hazır kuyruğuna koyar. I/O ağırlıklı sunucuların az CPU ile çok bağlantı taşıyabilmesinin nedeni budur. | A blocking system call moves the process to the *blocked* state and the kernel immediately picks another ready process. When the disk finishes, the hardware raises an interrupt and the kernel puts B back on the ready queue. That is why I/O-heavy servers can serve many connections with little CPU.
:::

:::animation{scene="scene.json"}
Tek çekirdek, üç süreç: zaman dilimleri, context switch, `read()` ile bloklanma ve disk kesmesiyle hazır kuyruğuna dönüş.
:::

## Thread'ler: aynı evde birden fazla akış

Bir süreç içinde birden fazla **thread** çalışabilir. Thread'ler aynı adres alanını, aynı heap'i ve aynı açık dosyaları paylaşır; her birinin yalnızca kendi yığını (stack) ve yazmaçları vardır. Linux çekirdeği açısından bir thread, belleği paylaşan bir görevden (`clone()` ile yaratılmış `task`) başka bir şey değildir ve zamanlayıcı onları süreçler gibi planlar. Bu yüzden thread yaratmak ve thread'ler arasında geçiş yapmak süreçlere göre ucuzdur; veri paylaşmak da bir değişkeni okumak kadar kolaydır.

Kolaylığın bedeli **yarış koşuludur (race condition)**. `sayac += 1` tek bir satır gibi görünür ama işlemci için üç adımdır: belleği oku, bir ekle, belleğe yaz. İki thread aynı değeri (ör. 41) okur, ikisi de 42 hesaplar ve ikisi de 42 yazarsa bir artış kaybolur. Hata yalnızca zamanlayıcı geçişi tam o iki talimatın arasına denk geldiğinde ortaya çıkar; bu yüzden testte geçip üretimde yük altında patlar. Çözüm, kritik bölgeyi bir **mutex (kilit)** ile korumak ya da atomik işlemler kullanmaktır. Kilitler de kendi sorunlarını getirir: yanlış sırada alınan iki kilit **deadlock**'a, aşırı paylaşılan tek kilit de thread'lerin sırayla beklediği bir darboğaza yol açar.

:::code{lang="python" title="Kayıp güncelleme: kilitsiz ve kilitli sayaç"}
```python
import threading

sayac = 0
kilit = threading.Lock()

def kilitsiz(n: int) -> None:
    global sayac
    for _ in range(n):
        tmp = sayac        # oku
        tmp += 1           # hesapla — burada geçiş olursa güncelleme kaybolabilir
        sayac = tmp        # yaz

def kilitli(n: int) -> None:
    global sayac
    for _ in range(n):
        with kilit:        # kritik bölge: aynı anda tek thread
            sayac += 1

for hedef in (kilitsiz, kilitli):
    sayac = 0
    ts = [threading.Thread(target=hedef, args=(200_000,)) for _ in range(4)]
    for t in ts: t.start()
    for t in ts: t.join()
    print(hedef.__name__, sayac, "beklenen:", 800_000)
```
:::

:::callout{tone="info" title="GIL'e köprü"}
CPython'da **GIL (Global Interpreter Lock)**, aynı anda yalnızca bir thread'in Python bytecode'u yürütmesine izin verir. Bu, işletim sisteminin thread'leri gerçekten planlamadığı anlamına gelmez: thread'ler gerçek çekirdek thread'leridir, yalnızca yorumlayıcı kilidi sırayla alırlar. Sonuç olarak CPU ağırlıklı Python kodu thread'lerle hızlanmaz (süreçler gerekir), ama I/O bekleyen thread'ler GIL'i bırakır ve tıpkı yukarıdaki bloklu süreç gibi CPU'yu başkasına devreder. GIL ayrıca yukarıdaki yarışı ortadan kaldırmaz: geçiş bytecode'lar arasında olabilir. Python tarafını k-18-eszamanlilik-ve-asyncio dersinde ayrıntılı gördün ya da göreceksin; burada altında yatan işletim sistemi mekanizmasını tamamlıyoruz.
:::

## Süreç mi, thread mi?

| | Süreç | Thread |
|---|---|---|
| Bellek | Ayrı adres alanı | Paylaşılan adres alanı |
| Yaratma ve geçiş maliyeti | Daha yüksek | Daha düşük |
| Hata yalıtımı | Biri çökerse diğerleri ayakta | Bir thread'in bellek hatası tüm süreci düşürür |
| Veri paylaşımı | IPC gerekir (pipe, soket, paylaşılan bellek) | Doğrudan, ama kilit gerekir |

Chrome'un her sekmeyi ayrı süreçte çalıştırması ve PostgreSQL'in bağlantı başına süreç modeli yalıtımı seçer; Java ve Go sunucuları ise tek süreçte çok sayıda thread ya da hafif görev çalıştırarak verimliliği seçer.

:::realworld{company="Netflix"}
Netflix'in performans mühendisi Brendan Gregg'in Netflix Tech Blog'da yayımladığı *Linux Performance Analysis in 60,000 Milliseconds* yazısı, bir Linux sunucusuna sorun anında girildiğinde ilk dakikada çalıştırılacak on komutu anlatır. Listenin önemli bir kısmı doğrudan bu dersin kavramlarına bakar: `uptime` ile load average (çalıştırılabilir ve kesilemez uykudaki süreç sayısı), `vmstat 1` ile run queue uzunluğu (`r`) ve context switch sayısı (`cs`), `mpstat -P ALL 1` ile tek bir çekirdeğin doygun olup olmadığı, `pidstat 1` ile süreç başına CPU kullanımı. Yazının vurguladığı fikir, CPU yüzdesinin tek başına yanıltıcı olduğudur: run queue sürekli çekirdek sayısını aşıyorsa süreçler hazır durumda CPU bekliyordur; CPU boşken load yüksekse süreçler büyük olasılıkla disk I/O'sunda bloklu bekliyordur. Gregg'in USE yöntemi (Utilization, Saturation, Errors) de CPU için doygunluğu tam olarak bu hazır kuyruğu uzunluğu üzerinden tanımlar.
:::

:::callout{tone="warning" title="Zombie ve yetim süreçler"}
Ebeveyn `wait()` çağırmazsa çocuk sonlandıktan sonra zombie olarak kalır; PID tablosu dolarsa yeni süreç yaratılamaz. Konteynerlerde PID 1 olarak çalışan uygulamanız bu "çocukları biçme" görevini üstlenmiyorsa zombie'ler birikir — `tini` gibi küçük init süreçleri bu yüzden vardır.
:::

:::quiz{src="quiz.json"}
:::

:::resources
- [Operating Systems: Three Easy Pieces](https://pages.cs.wisc.edu/~remzi/OSTEP/) — kitap — süreç soyutlaması, zamanlama ve eşzamanlılık bölümleri
- [fork(2) — Linux manual page](https://man7.org/linux/man-pages/man2/fork.2.html) — belge — copy-on-write ve çocuk sürecin devraldıkları
- [Linux Performance Analysis in 60,000 Milliseconds](https://netflixtechblog.com/linux-performance-analysis-in-60-000-milliseconds-accc10403c55) — makale — Netflix Tech Blog
- [The USE Method](https://www.brendangregg.com/usemethod.html) — makale — Brendan Gregg; kullanım, doygunluk, hata
:::

:::next{lesson="o-06-virtual-memory"}
Sırada: her sürecin "tüm belleğe sahipmiş gibi" çalışmasını sağlayan sanal bellek, sayfa tabloları ve page fault.
:::

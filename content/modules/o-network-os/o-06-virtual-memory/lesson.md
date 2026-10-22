---
id: o-06-virtual-memory
slug: virtual-memory
module: o-network-os
order: 6
title:
  tr: "Bellek: Sanal Bellek, Sayfalama ve Sızıntılar"
  en: "Memory: Virtual Memory, Paging and Leaks"
summary:
  tr: Sanal adres alanı, sayfa tablosu ve TLB, page fault, swap, heap ve stack, bellek sızıntısı ve OOM killer.
  en: Virtual address spaces, page tables and the TLB, page faults, swap, heap and stack, memory leaks and the OOM killer.
durationMinutes: 30
level: intermediate
tags: [os, linux, memory, virtual-memory, paging, performance]
prerequisites: [o-05-processes-threads]
concepts: [virtual-memory, page-table, tlb, page-fault, swap, heap-stack, memory-leak, oom-killer, rss]
---

## Kavram: her süreç tüm belleğe sahipmiş gibi davranır

Bir programda bir değişkenin adresini yazdırdığınızda `0x7ffd5e2a1c40` gibi bir sayı görürsünüz. Aynı programı iki kez aynı anda çalıştırın: iki süreç de aynı adresi kullanabilir, yine de birbirinin verisini bozmaz. Çünkü bu adresler **sanal adreslerdir (virtual address)**. Her sürecin kendine ait, geniş ve düzenli bir **sanal adres alanı** vardır; bu alan donanım ve çekirdek iş birliğiyle fiziksel RAM'deki gerçek konumlara çevrilir.

Bu soyutlama üç sorunu birden çözer:

1. **Yalıtım**: bir süreç başka bir sürecin belleğine adres yazarak ulaşamaz; sayfa tablosunda o eşleme yoktur.
2. **Kolaylık**: her program aynı düzeni görür (kod altta, heap ortada, yığın üstte); programın RAM'in neresine yüklendiği umurunda olmaz.
3. **Esneklik**: fiziksel bellekten fazlası vaat edilebilir; kullanılmayan sayfalar hiç ayrılmaz ya da diske gönderilir.

## Sayfalar, sayfa tablosu ve TLB

Bellek tek tek byte'lar olarak değil, tipik olarak **4 KiB'lık sayfalar** hâlinde yönetilir. Sanal adres iki parçaya ayrılır: sayfa numarası ve sayfa içindeki konum (offset). Her sürecin bir **sayfa tablosu (page table)** vardır: "sanal sayfa 0x7ffd5 → fiziksel çerçeve 0x1a3f2, okunabilir/yazılabilir, bellekte mevcut" gibi girdiler içerir. Çeviriyi işlemcinin içindeki **MMU (Memory Management Unit)** her bellek erişiminde yapar.

Sayfa tablosu da bellektedir ve x86-64'te dört (yeni işlemcilerde beş) seviyeli bir ağaçtır; her erişimde bu ağacı yürümek her okumayı birkaç kat yavaşlatırdı. Bu yüzden MMU, son çevirileri **TLB (Translation Lookaside Buffer)** adlı küçük ve çok hızlı bir önbellekte tutar. TLB isabet ederse çeviri neredeyse bedavadır; ıskalarsa donanım sayfa tablosunu yürür (page walk) ve sonucu TLB'ye koyar. Önceki dersteki context switch'in "önbelleği soğutur" dediğimiz kısmının önemli bir payı budur: adres alanı değişince eski süreçten kalan TLB girdileri yeni süreç için işe yaramaz.

:::diagram{src="diagram.svg" alt="Bir sürecin sanal adres alanı düzeni ve sayfa tablosu üzerinden fiziksel bellek çerçevelerine ve diskteki swap alanına eşlenmesi|A process's virtual address space layout mapped through the page table to physical memory frames and to swap on disk"}
Sanal alandaki her sayfa ya fiziksel bir çerçeveye eşlenmiştir, ya diskte (swap ya da dosya) bekler, ya da hiç ayrılmamıştır. Sayfa tablosundaki "mevcut" (present) biti hangisi olduğunu söyler.
:::

## Page fault: sayfa bellekte değilse

MMU sayfa tablosunda "mevcut değil" işaretli bir girdiye rastlarsa bir **page fault** istisnası üretir ve kontrol çekirdeğe geçer. Adının aksine page fault çoğunlukla hata değildir; sanal belleğin normal işleyişidir. Çekirdek nedenine bakar:

- **Minor fault**: sayfa zaten RAM'de ama bu sürecin tablosunda değil (ör. ilk kez dokunulan, sıfırlanmış yeni bir heap sayfası ya da başka süreçle paylaşılan bir kütüphane sayfası). Disk yok; mikrosaniyeler.
- **Major fault**: sayfa diskte; ya swap alanına gönderilmiş ya da henüz okunmamış bir dosya eşlemesi (`mmap`). Çekirdek diskten okur, süreç bu sürede bloklu bekler. Milisaniyeler — yani önceki dersteki bloklanma senaryosunun bellek versiyonu.
- **Geçersiz erişim**: adres hiç eşlenmemiş ya da izin yok (salt okunur sayfaya yazma). Süreç `SIGSEGV` ile sonlandırılır: meşhur *segmentation fault*.

Çekirdek sayfayı yükledikten sonra tabloyu günceller ve hatayı tetikleyen talimatı **yeniden çalıştırır**; program hiçbir şey fark etmez, yalnızca yavaşlar.

:::animation{scene="scene.json"}
Bir okuma talimatı: TLB ıskalar, sayfa tablosu yürünür, sayfa bellekte yoktur, page fault, çekirdek sayfayı diskten yükler, tabloyu günceller ve talimat yeniden çalışır.
:::

## Fiziksel bellek dolunca: sayfa değiştirme ve swap

RAM sınırlıdır. Yeni bir sayfaya yer gerektiğinde çekirdek bir sayfayı çıkarmak zorundadır. Dosyadan okunmuş temiz bir sayfa (ör. bir kütüphanenin kodu) basitçe atılabilir, gerekirse dosyadan yeniden okunur. Değiştirilmiş anonim bir sayfa (heap verisi) ise atılamaz; **swap** alanına yazılmalıdır. Hangi sayfanın çıkacağına Linux, LRU'ya yakın "aktif/pasif listeler" yaklaşımıyla karar verir. Aşağıdaki simülatör bu kararı oyuncaklaştırır.

:::interactive{type="cache" policy="lru" capacity=3 writePolicy="cache-aside" ttlMs=0}
Bu deneyde cache slotlarını **fiziksel bellek çerçeveleri**, A–H anahtarlarını bir sürecin **sayfaları**, her miss'i bir **page fault**, "DB okuma" sayacını da **diskten yükleme** gibi düşünün. Kapasite 3 çerçeveyle başlayın; A, B, C, A, D, A, B sırasıyla okuyun ve hangi sayfanın tahliye edildiğini izleyin. Ardından "Rastgele 10 okuma" ile hit oranına bakın, kapasite kaydırıcısını 6'ya çıkarıp tekrarlayın: bellek çalışma kümesine (working set) yetince page fault'lar neredeyse kaybolur. Tahliye politikasını FIFO'ya çevirip aynı diziyi deneyin. Sınırı da bilin: gerçek çekirdek, kirli sayfaları geri yazma, paylaşılan sayfalar ve önden okuma gibi bu simülatörde olmayan ayrıntılarla çalışır.
:::

Çalışma kümesi RAM'e sığmadığında sistem sürekli sayfa çıkarıp geri okur; buna **thrashing** denir. CPU boştadır ama her şey dururcasına yavaşlar. Swap da tükendiğinde Linux son çare olarak **OOM killer**'ı çalıştırır ve bellek tüketimi en yüksek puanlı süreci `SIGKILL` ile öldürür. Konteyner dünyasında "pod'um sebepsiz yeniden başladı, çıkış kodu 137" vakalarının büyük kısmı budur.

## Heap, stack ve bellek sızıntısı

Sanal alanın iki dinamik bölgesi vardır. **Stack (yığın)**: her thread için ayrı, fonksiyon çağrılarının yerel değişkenlerini ve dönüş adreslerini tutar; çağrı bitince otomatik geri alınır, boyutu sınırlıdır (Linux'ta tipik ana thread yığını 8 MiB) ve aşılırsa *stack overflow* olur. **Heap**: `malloc`, `new` ya da Python nesneleri için kullanılan, açıkça ayrılıp serbest bırakılan alan. Allocator gerektiğinde çekirdekten `brk` ya da `mmap` ile yeni sanal sayfalar ister.

**Bellek sızıntısı**, artık kullanılmayan heap belleğinin geri verilmemesidir. C'de `free` unutulduğunda; çöp toplayıcılı dillerde ise nesneye hâlâ bir referans (büyüyen bir global sözlük, hiç temizlenmeyen bir önbellek, kaydı silinmeyen bir dinleyici) kaldığında olur. Belirtisi, sürecin **RSS (resident set size)** değerinin yük sabitken bile zamanla tırmanmasıdır. Python'da referans sayımı ve döngü toplayıcının nesneleri nasıl serbest bıraktığını k-17-bellek-yonetimi-ve-gc dersinde gördün ya da göreceksin; burada o nesnelerin altında duran sayfaları görüyoruz. Serbest bırakılan bir Python nesnesi her zaman belleği işletim sistemine geri vermez: allocator onu kendi havuzunda tekrar kullanmak üzere tutabilir, bu yüzden RSS düşmeyebilir.

:::code{lang="bash" title="Bir sürecin belleğini gözlemlemek"}
```bash
# Sanal boyut (VmSize) ile gerçekten RAM'de duran (VmRSS) arasındaki fark
grep -E 'VmSize|VmRSS|VmSwap' /proc/<pid>/status

# Sistem geneli: si/so sütunları saniyede swap'a giren/çıkan sayfalar
vmstat 1 5

# Süreç başına minor (minflt/s) ve major (majflt/s) page fault oranı
pidstat -r -p <pid> 1

# Çekirdek OOM killer bir süreci öldürdü mü?
dmesg -T | grep -i 'killed process'
```
```python
# Python'da sızıntı avı: iki anlık görüntü arasında en çok büyüyen satırlar
import tracemalloc

tracemalloc.start()
once = tracemalloc.take_snapshot()
# ... şüpheli işi birkaç kez çalıştır ...
sonra = tracemalloc.take_snapshot()
for fark in sonra.compare_to(once, "lineno")[:5]:
    print(fark)
```
:::

:::callout{tone="warning" title="VIRT büyük diye panik yapmayın"}
`top`'taki VIRT sütunu sürecin ayırdığı sanal alanı gösterir; ayrılmış ama dokunulmamış sayfalar RAM tüketmez. Kapasite planlamasında ve sızıntı takibinde bakılacak değer **RSS**'tir (ve paylaşılan sayfaları dağıtan **PSS**). Java ya da Go süreçlerinin gigabaytlarca VIRT göstermesi çoğunlukla normaldir.
:::

:::realworld{company="Netflix"}
Brendan Gregg, Netflix'teki performans çalışmaları sırasında yayımladığı *Linux Performance Analysis in 60,000 Milliseconds* yazısında sorun anında ilk bakılacak komutlar arasında `free -m` ve `vmstat 1`'i sayar ve bellek için iki ayrıntıyı vurgular. Birincisi, `free` çıktısındaki "buff/cache" kısmı kullanılmayan RAM'in çekirdek tarafından dosya önbelleği olarak değerlendirilmesidir ve gerektiğinde geri alınır; "boş bellek az" görünmesi tek başına sorun değildir. İkincisi, `vmstat`'taki `si` ve `so` sütunlarının sıfırdan farklı olması sistemin swap'a girip çıktığını, yani bellek baskısı altında olduğunu gösterir. Gregg'in kendi sitesinde topladığı bellek analizi notları ve flame graph araçları da sayfa hatası olaylarını izleyerek hangi kod yolunun bellek büyüttüğünü bulmaya odaklanır. Ortak ders şudur: bellek sorunlarında "ne kadar boş RAM var" yerine sayfalama etkinliği (major fault, swap trafiği) ve süreç başına RSS eğilimi izlenmelidir.
:::

:::quiz{src="quiz.json"}
:::

:::resources
- [Operating Systems: Three Easy Pieces](https://pages.cs.wisc.edu/~remzi/OSTEP/) — kitap — adres çevirisi, sayfalama, TLB ve swap bölümleri
- [proc(5) — Linux manual page](https://man7.org/linux/man-pages/man5/proc.5.html) — belge — /proc/<pid>/status alanları
- [Linux kernel: Concepts overview (memory management)](https://docs.kernel.org/admin-guide/mm/concepts.html) — belge — sanal bellek, sayfa önbelleği, OOM
- [Linux Performance Analysis in 60,000 Milliseconds](https://netflixtechblog.com/linux-performance-analysis-in-60-000-milliseconds-accc10403c55) — makale — Netflix Tech Blog
:::

:::next{lesson="o-07-filesystem-io"}
Sırada: dosya sistemi ve I/O — inode'lar, page cache, write() çağrısının diske ne zaman ulaştığı ve fsync.
:::

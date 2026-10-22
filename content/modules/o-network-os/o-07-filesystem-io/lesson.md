---
id: o-07-filesystem-io
slug: filesystem-io
module: o-network-os
order: 7
title:
  tr: "Dosya Sistemi ve I/O: inode, Page Cache ve epoll"
  en: "File Systems and I/O: inodes, the Page Cache and epoll"
summary:
  tr: inode ve dizinler, izinler, page cache, sync/fsync ve dayanıklılık, blocking ve non-blocking I/O, epoll ile olay döngüsü.
  en: inodes and directories, permissions, the page cache, sync/fsync and durability, blocking vs non-blocking I/O, event loops with epoll.
durationMinutes: 30
level: intermediate
tags: [linux, filesystem, io, page-cache, fsync, epoll]
prerequisites: [o-06-virtual-memory]
concepts: [inode, file-descriptor, page-cache, dirty-page, fsync, blocking-io, non-blocking-io, epoll]
---

## Kavram: "dosyaya yazdım" ne demek?

Bir backend uygulaması `f.write(data)` çağırdığında çoğumuz verinin diske gittiğini varsayarız. Gerçekte o anda veri yalnızca **çekirdeğin belleğine** kopyalanmıştır. Diskin dönen plakaları ya da SSD'nin flaş hücreleri henüz hiçbir şey görmemiştir. Bu fark, bir önceki derste gördüğümüz sanal belleğin doğal uzantısıdır: işletim sistemi, yavaş cihazların önüne her zaman bir önbellek koyar. Veritabanlarının, log sistemlerinin ve kuyrukların "kayıt kalıcı mı?" sorusuna verdiği cevap bu dersin konusudur.

## inode, dizin ve dosya tanımlayıcı

Linux dosya sistemlerinde (ext4, XFS) bir dosyanın kimliği adı değil, **inode** numarasıdır. inode; dosyanın sahibi, izinleri, boyutu, zaman damgaları ve verinin diskteki hangi bloklarda durduğunu tutar. **Dosya adı inode'da yoktur.** Dizin, aslında "ad → inode numarası" eşlemelerinden oluşan özel bir dosyadır. Bu yüzden:

- `mv a.txt b.txt` aynı dosya sisteminde veriyi kopyalamaz; yalnızca dizin girdisini değiştirir ve anlık gerçekleşir.
- **Hard link** (`ln a b`) aynı inode'a ikinci bir ad verir; inode'un bağlantı sayacı sıfıra inene kadar veri silinmez.
- Açık bir dosyayı `rm` ile silmek diski hemen boşaltmaz; süreç dosyayı açık tuttuğu sürece inode yaşar. "Disk dolu ama `du` boş gösteriyor" vakalarının klasik nedeni budur (`lsof | grep deleted`).

İzinler de inode'da durur: sahip/grup/diğerleri için `rwx` bitleri. Dizinlerde `x` biti "içine girebilme", `r` biti "listeleyebilme" anlamına gelir; bir dosyayı silmek için dosyanın değil, **dizinin** yazma iznine ihtiyaç vardır.

Bir süreç `open()` çağırdığında çekirdek ona küçük bir tamsayı döner: **dosya tanımlayıcı (file descriptor, fd)**. 0, 1 ve 2 standart girdi, çıktı ve hatadır. Soketler, pipe'lar ve epoll nesneleri de fd'dir; Unix'in "her şey bir dosyadır" ilkesi pratikte "her şey bir fd'dir" demektir. Süreç başına fd sınırı (`ulimit -n`) aşıldığında yeni bağlantı kabul edilemez; yüksek trafikli sunucularda sık görülen bir hatadır.

:::diagram{src="diagram.svg" alt="Uygulamadan diske yazma yolu: sistem çağrısı, VFS, page cache, blok katmanı ve disk; yanda dizin girdisinden inode'a ve veri bloklarına giden yapı|The write path from application to disk: system call, VFS, page cache, block layer and disk; beside it the structure from a directory entry to an inode and data blocks"}
Her `read()` ve `write()` önce VFS'ten geçer ve neredeyse her zaman page cache'te karşılanır; diske inmek ayrı ve daha sonraki bir adımdır.
:::

## Page cache: çekirdeğin yazma tamponu

Çekirdek boştaki RAM'i diskten okunan ve diske yazılacak sayfaları tutmak için kullanır; buna **page cache** denir. `free -h` çıktısındaki `buff/cache` sütunu budur ve "boş" bellek az görünse de bu alan gerektiğinde geri verilir.

- **Okuma:** Sayfa page cache'teyse `read()` mikro saniyeler içinde döner (hit). Değilse çekirdek diski okur, sayfayı cache'e koyar ve sonra kopyalar. Aynı dosyayı ikinci kez okumanın çok daha hızlı olmasının nedeni budur.
- **Yazma:** `write()` veriyi page cache'teki sayfaya kopyalar, sayfayı **kirli (dirty)** olarak işaretler ve hemen döner. Kirli sayfalar arka plandaki writeback iş parçacıkları tarafından daha sonra diske yazılır; varsayılan ayarlarda bu genellikle birkaç saniye ile yaklaşık yarım dakika içinde olur (`vm.dirty_expire_centisecs`, `vm.dirty_background_ratio`).

Bu tasarım yazmayı hızlandırır ve küçük yazmaları birleştirir. Bedeli şudur: güç kesilir ya da çekirdek çökerse, henüz diske inmemiş kirli sayfalar kaybolur. Süreç çökmesi bu verileri kaybettirmez, çünkü veri zaten çekirdektedir; risk makinenin kendisinin düşmesidir.

## fsync: "artık gerçekten diskte"

Kalıcılık isteyen uygulama **`fsync(fd)`** çağırır. Çekirdek o dosyanın kirli sayfalarını ve meta verisini blok katmanına gönderir, cihazdan yazmanın tamamlandığı onayını bekler (gerekirse diskin kendi yazma önbelleğini boşaltma komutuyla) ve ancak sonra döner. `fdatasync()` yalnızca veriyi ve verinin okunması için şart olan meta veriyi yazar; `sync()` ise sistemdeki tüm kirli sayfaları kapsar.

Birkaç ince ama önemli nokta:

1. **Yeni dosya oluşturduysanız dizini de fsync edin.** Dosyanın içeriği diskte olsa bile, ad → inode girdisi dizin dosyasındadır; çökmeden sonra dosya "kaybolmuş" görünebilir.
2. **Atomik değiştirme kalıbı:** geçici dosyaya yaz → `fsync(tmp)` → `rename(tmp, hedef)` → dizini `fsync`. `rename` aynı dosya sisteminde atomiktir; okuyan ya eski ya yeni dosyayı görür.
3. **fsync hatası ciddiye alınmalıdır.** Linux'ta başarısız bir writeback'ten sonra kirli sayfalar temiz işaretlenebilir; ikinci bir fsync'in başarılı dönmesi verinin yazıldığı anlamına gelmez. Aşağıdaki gerçek dünya örneği tam bu konudadır.

Veritabanları bu yüzden her commit'te write-ahead log'u (WAL) fsync eder; "commit başarılı" yanıtı ancak bundan sonra döner. Saniyede kaç commit yapılabileceğini çoğu zaman diskin fsync gecikmesi belirler.

:::predict{id="write-sonra-cokme"}
Bir uygulama `write()` çağırdı ve başarılı dönüş aldı, ama `fsync()` çağırmadı. İki saniye sonra sunucunun elektriği kesildi. Veriye ne olur? | An application called `write()` and got a successful return but never called `fsync()`. Two seconds later the server lost power. What happens to the data?
- [ ] Kesinlikle diskte; `write()` başarılı döndü | It is definitely on disk; `write()` succeeded
- [x] Kaybolmuş olabilir; veri büyük olasılıkla yalnızca page cache'teki kirli sayfadaydı | It may be lost; the data was most likely only in a dirty page in the page cache
- [ ] Kaybolmaz; çekirdek kapanırken page cache'i otomatik olarak diske yazar | It is safe; the kernel always flushes the page cache while shutting down
Açıklama: `write()` yalnızca çekirdek belleğine kopyalamanın başarılı olduğunu söyler. Ani güç kaybında çekirdeğin hiçbir şey yazacak fırsatı yoktur; writeback henüz çalışmadıysa kirli sayfalar kaybolur. Kalıcılık garantisi `fsync()` dönüşüyle başlar. | `write()` only reports that copying into kernel memory succeeded. On sudden power loss the kernel has no chance to write anything; if writeback has not run yet, the dirty pages are lost. The durability guarantee starts when `fsync()` returns.
:::

:::animation{scene="scene.json"}
`write()` page cache'te kirli sayfa bırakıp hemen döner; `fsync()` sayfayı blok katmanı üzerinden diske indirir ve disk onaylayınca döner. Sonraki `read()` cache'ten karşılanır.
:::

:::interactive{type="cache" policy="lru" capacity=4 writePolicy="write-back" ttlMs=0}
Bu simülatörü page cache gibi düşünün: slotlar RAM'deki sayfalar, "Veritabanı" kutuları disk. Yazma politikası **write-back** iken birkaç anahtarın "Yaz" düğmesine basın: slotlar **kirli** işaretlenir, "DB yazma" sayacı artmaz; bu `write()` sonrası durumdur. **Flush** düğmesine basın: kirli sayfalar tek seferde "diske" yazılır ve sayaç artar; bu, `fsync()` ya da arka plandaki writeback'e karşılık gelir. Ardından politikayı **write-through** yapın: her yazma anında diske gider, kirli sayaç sıfırda kalır ama "DB yazma" hızla büyür; her `write()` sonrası `fsync()` çağırmanın maliyeti budur. Kapasiteyi düşürüp yeni anahtarlar okuyarak tahliyeyi gözleyin. Analojinin sınırı: gerçek çekirdek kirli bir sayfayı tahliye etmeden önce mutlaka diske yazar ve writeback'i zamanlayıcıyla kendiliğinden başlatır; simülatördeki slotlar ise sabit sayıdadır.
:::

## Blocking ve non-blocking I/O, epoll

Varsayılan olarak `read()` bir sokette veri yoksa **bloklar**: thread uyur, zamanlayıcı CPU'yu başka işe verir (o-05'teki "bekleyen" durumu). Her bağlantıya bir thread ayırmak 100 bağlantıda iyi çalışır, 50.000 bağlantıda thread başına yığın belleği ve context switch maliyeti yüzünden çöker.

Alternatif, fd'yi **`O_NONBLOCK`** ile açmaktır: veri yoksa `read()` beklemek yerine hemen `EAGAIN` döner. Ama hangi soketin hazır olduğunu tek tek yoklamak CPU'yu boşa yakar. Çözüm **I/O çoklama**dır: `select` ve `poll` her çağrıda tüm fd listesini çekirdeğe verir (O(n)); Linux'un **`epoll`**'u ise ilgilenilen fd'leri çekirdekte bir kez kaydeder ve `epoll_wait` yalnızca **hazır olanları** döner. Tek bir thread, binlerce bağlantıyı bir **olay döngüsü** içinde gezer. Nginx, Redis, Node.js'in libuv'u ve Python'un `asyncio`'su Linux'ta bu mekanizmanın üstüne kuruludur.

Önemli bir istisna: normal dosyalar epoll ile "hazır/değil" şeklinde izlenemez; disk okuması her zaman hazır kabul edilir ve gerektiğinde bloklar. Bu yüzden libuv dosya işlemlerini bir thread havuzunda yapar; daha yeni `io_uring` arayüzü ise dosya ve ağ I/O'sunu ortak bir asenkron kuyrukta birleştirir.

:::code{lang="python" title="Kalıcı yazma (fsync + atomik rename) ve selectors ile olay döngüsü"}
```python
import os, selectors, socket

def kalici_yaz(yol: str, veri: bytes) -> None:
    gecici = yol + ".tmp"
    fd = os.open(gecici, os.O_WRONLY | os.O_CREAT | os.O_TRUNC, 0o644)
    try:
        os.write(fd, veri)      # page cache'e kopyalar, hemen döner
        os.fsync(fd)            # kirli sayfalar diske inene kadar bekler
    finally:
        os.close(fd)
    os.rename(gecici, yol)      # aynı dosya sisteminde atomik
    dfd = os.open(os.path.dirname(yol) or ".", os.O_RDONLY)
    try:
        os.fsync(dfd)           # dizin girdisini (ad → inode) de kalıcı yap
    finally:
        os.close(dfd)

# Linux'ta DefaultSelector epoll kullanır
sel = selectors.DefaultSelector()
sunucu = socket.socket()
sunucu.bind(("0.0.0.0", 8080)); sunucu.listen()
sunucu.setblocking(False)       # O_NONBLOCK
sel.register(sunucu, selectors.EVENT_READ)

while True:
    for anahtar, _ in sel.select():          # epoll_wait: yalnızca hazır fd'ler
        if anahtar.fileobj is sunucu:
            baglanti, _ = sunucu.accept()
            baglanti.setblocking(False)
            sel.register(baglanti, selectors.EVENT_READ)
        else:
            veri = anahtar.fileobj.recv(4096)
            if veri:
                anahtar.fileobj.sendall(veri)  # yankı (echo)
            else:
                sel.unregister(anahtar.fileobj); anahtar.fileobj.close()
```
:::

:::realworld{company="PostgreSQL"}
2018'de PostgreSQL geliştiricileri, topluluk içinde "fsyncgate" adıyla anılan bir sorunu kamuya açık posta listesinde ve proje wiki'sinde belgeledi. PostgreSQL uzun süre şu varsayımla çalışmıştı: `fsync()` bir kez hata dönerse, sonraki bir `fsync()` denemesi aynı kirli verileri yeniden yazmayı dener. Linux'ta ise başarısız bir writeback'ten sonra çekirdek ilgili sayfaları temiz olarak işaretleyebiliyor ve hata yalnızca bir kez raporlanabiliyordu; ikinci `fsync()` başarılı dönse de veri aslında diske yazılmamış oluyordu. Üstelik hata, dosyayı o sırada açık tutmayan bir süreçte hiç görülmeyebiliyordu.

Sonuç olarak PostgreSQL, fsync hatasını artık "tekrar denenebilir" değil, kurtarılamaz kabul ediyor: sunucu bilerek çöküyor (PANIC) ve yeniden başlarken WAL'dan kurtarma yapıyor. Bu olay, çekirdek geliştiricileriyle de tartışılan, hata raporlama davranışını iyileştiren çalışmalara yol açtı. Ders şudur: kalıcılık yalnızca "fsync çağırdım" değil, "fsync'in sözleşmesini doğru anladım" demektir.
:::

:::callout{tone="warning" title="Konteyner ve bulut disklerinde fsync"}
Ağ üzerinden bağlanan bulut disklerinde bir fsync, yerel NVMe'ye göre kat kat yavaş olabilir. Her küçük yazmada fsync çağıran bir uygulama burada darboğaza girer. Çözüm fsync'ten vazgeçmek değil, yazmaları **gruplamaktır** (group commit): birden fazla kaydı tek fsync ile kalıcı hale getirmek. `strace -e fsync,fdatasync -T` ile süreçlerinizin ne sıklıkla ve ne kadar sürede fsync yaptığını ölçün.
:::

:::quiz{src="quiz.json"}
:::

:::resources
- [fsync(2) — Linux manual page](https://man7.org/linux/man-pages/man2/fsync.2.html) — belge — fsync ve fdatasync sözleşmesi
- [epoll(7) — Linux manual page](https://man7.org/linux/man-pages/man7/epoll.7.html) — belge — kenar ve seviye tetiklemeli bildirim
- [inode(7) — Linux manual page](https://man7.org/linux/man-pages/man7/inode.7.html) — belge — inode alanları ve dosya türleri
- [PostgreSQL wiki: Fsync Errors](https://wiki.postgresql.org/wiki/Fsync_Errors) — belge — fsyncgate özeti ve alınan önlemler
:::

:::next{lesson="o-08-container-internals"}
Sırada: şimdiye kadar gördüğümüz süreç, bellek ve dosya sistemi mekanizmaları bir araya gelince ne olur? Konteyner aslında namespace'lere sarılmış, cgroup ile sınırlanmış ve overlay dosya sistemi üzerinde koşan sıradan bir süreçtir.
:::

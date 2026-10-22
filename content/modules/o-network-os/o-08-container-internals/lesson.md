---
id: o-08-container-internals
slug: container-internals
module: o-network-os
order: 8
title:
  tr: "Konteynerlerin Altındaki OS: Namespace, cgroup ve Union FS"
  en: "The OS Beneath Containers: Namespaces, cgroups and Union File Systems"
summary:
  tr: "Konteyner bir süreçtir: namespace'lerle yalıtım, cgroup'larla kaynak sınırı, overlay dosya sistemiyle katmanlı imaj."
  en: "A container is a process: isolation with namespaces, resource limits with cgroups, layered images with an overlay file system."
durationMinutes: 30
level: advanced
tags: [linux, containers, namespaces, cgroups, overlayfs, docker]
prerequisites: [o-07-filesystem-io]
concepts: [container-is-a-process, linux-namespaces, pid-namespace, cgroups, memory-limit, oom-killer, overlayfs, container-runtime]
---

## Kavram: konteyner bir süreçtir

Docker'ı kullanmayı h-05'te gördün: `docker run` yazınca bir "kutu" açılıyor, içinde kendi dosya sistemi, kendi ağı ve kendi süreç listesi var. Bu dersin iddiası basit ama şaşırtıcıdır: **o kutu yoktur.** Linux çekirdeğinde "konteyner" diye bir nesne bulunmaz. Konteyner, sıradan bir süreçtir; yalnızca çekirdek ona dünyanın daha küçük bir parçasını gösterir ve kullanabileceği kaynakları sınırlar. Bunu üç mekanizma sağlar:

1. **Namespace'ler** — sürecin *neyi görebileceğini* belirler.
2. **cgroup'lar** — sürecin *ne kadar kullanabileceğini* belirler.
3. **Union (overlay) dosya sistemi** — sürecin kök dizinini salt okunur imaj katmanlarından ve ince bir yazılabilir katmandan oluşturur.

Sanal makineden farkı buradadır: sanal makine kendi çekirdeğini çalıştırır, konteyner ise ana makinenin çekirdeğini paylaşır. Bu yüzden konteyner milisaniyeler içinde başlar, ama çekirdek düzeyindeki bir açık tüm konteynerleri etkileyebilir.

Kendiniz görebilirsiniz: bir konteyner çalışırken ana makinede `ps aux` çalıştırın. Konteynerin içindeki süreç orada, farklı bir PID ile, sıradan bir satır olarak listelenir. `docker top <konteyner>` da aynı ana makine PID'lerini gösterir.

:::diagram{src="diagram.svg" alt="Bir süreci saran üç katman: PID, mount, network, UTS, IPC ve user namespace'leri; bellek, CPU ve PID sınırları koyan cgroup; salt okunur imaj katmanları üzerinde yazılabilir katmandan oluşan overlay kök dosya sistemi|Three layers wrapped around a process: PID, mount, network, UTS, IPC and user namespaces; a cgroup setting memory, CPU and PID limits; an overlay root file system made of a writable layer on top of read-only image layers"}
Konteyner = süreç + namespace'ler (görünüm) + cgroup (kaynak) + overlay rootfs (dosya sistemi).
:::

## Namespace'ler: neyi görebilirim?

Bir namespace, çekirdekteki küresel bir kaynağı sarmalar ve içindeki süreçlere o kaynağın kendine ait bir kopyası varmış gibi gösterir. Linux'ta bugün sekiz tür vardır; en önemlileri:

| Namespace | Yalıttığı şey | Konteynerde etkisi |
|---|---|---|
| **PID** | Süreç numaraları | İçerideki ilk süreç kendini PID 1 görür; ana makinedeki diğer süreçleri göremez |
| **Mount** | Bağlama noktaları | Kendi kök dizini (`/`) ve bağlamaları vardır |
| **Network** | Ağ arayüzleri, yönlendirme, portlar | Kendi `eth0`'ı ve kendi 80 numaralı portu olur |
| **UTS** | Host adı | `hostname` konteyner kimliğini döner |
| **IPC** | Paylaşımlı bellek, semaforlar | Diğer konteynerlerle IPC kaynakları karışmaz |
| **User** | UID/GID eşlemesi | İçerideki root, dışarıda yetkisiz bir kullanıcı olabilir (rootless) |
| **cgroup** | cgroup hiyerarşisinin görünümü | Süreç kendi cgroup'unu kök gibi görür |

Namespace'ler `clone()` sistem çağrısına bayraklar (`CLONE_NEWPID`, `CLONE_NEWNS`, `CLONE_NEWNET`...) verilerek yeni bir süreçle birlikte ya da `unshare()` ile mevcut süreç için oluşturulur. `setns()` ise var olan bir namespace'e katılmayı sağlar; `docker exec` tam olarak bunu yapar: konteynerin namespace'lerine katılan yeni bir süreç başlatır.

PID 1 olmak bir sorumluluk getirir: Linux'ta PID 1'in sinyal işleme davranışı farklıdır ve öksüz kalan alt süreçleri (zombi) toplaması beklenir. Uygulamanızı doğrudan PID 1 olarak çalıştırıp `SIGTERM`'i ele almazsanız `docker stop` on saniye bekleyip `SIGKILL` gönderir. `docker run --init` ya da `tini` gibi küçük bir init bu sorunu çözer.

## cgroup'lar: ne kadar kullanabilirim?

**Control group (cgroup)**, süreçleri bir gruba koyup o grubun CPU, bellek, disk I/O ve süreç sayısı kullanımını ölçen ve sınırlayan çekirdek mekanizmasıdır. Güncel dağıtımlar **cgroup v2**'yi kullanır: tek bir hiyerarşi `/sys/fs/cgroup` altında dosyalar olarak görünür.

- `memory.max`: grubun kullanabileceği en fazla bellek. Aşılırsa çekirdek önce sayfa geri kazanmayı dener (o-06'da gördüğümüz page cache sayfaları dahil), başaramazsa grup içinde **OOM killer** bir süreci öldürür. Docker'da çıkış kodu 137 ve `OOMKilled: true` olarak görünür.
- `cpu.max`: belirli bir periyotta kullanılabilecek CPU süresi (ör. `50000 100000` = yarım çekirdek). Aşılırsa süreç öldürülmez, **kısılır (throttle)**; gecikme artar.
- `pids.max`: grubun oluşturabileceği süreç/thread sayısı; fork bombasına karşı korur.

Kubernetes'te pod tanımına yazdığınız `resources.limits.memory` ve `limits.cpu`, sonunda kubelet ve konteyner çalışma zamanı tarafından bu dosyalara yazılan değerlere dönüşür.

:::predict{id="cgroup-bellek-limiti"}
256 MB bellek limitiyle çalışan bir konteynerdeki süreç, her istekte biraz daha bellek ayırıyor ve hiç geri vermiyor (sızıntı). Kullanım limite ulaştığında ne olur? | A process in a container with a 256 MB memory limit allocates a bit more memory on every request and never frees it (a leak). What happens when usage reaches the limit?
- [ ] Çekirdek süreci yavaşlatır (throttle) ama çalışmaya devam ettirir | The kernel throttles the process but keeps it running
- [ ] Konteyner otomatik olarak ana makinenin boş belleğini kullanmaya başlar | The container automatically starts using the host's free memory
- [x] Geri kazanma yetmezse cgroup içinde OOM killer süreci öldürür; konteyner 137 koduyla çıkar | If reclaim is not enough, the OOM killer kills the process inside the cgroup; the container exits with code 137
Açıklama: Bellek CPU gibi "beklenerek" paylaştırılamaz. `memory.max` aşıldığında çekirdek önce sayfa geri kazanmayı dener; sızıntıda geri kazanılacak sayfa kalmadığı için OOM killer devreye girer. Kısma (throttle) CPU limitinin davranışıdır. | Memory cannot be shared by "waiting" the way CPU can. When `memory.max` is exceeded the kernel first tries to reclaim pages; with a leak there is nothing left to reclaim, so the OOM killer steps in. Throttling is how the CPU limit behaves.
:::

:::animation{scene="scene.json"}
Sıradan bir süreç (PID 4123) namespace'lere sarılır, overlay kök dosya sistemini görür, 256 MB'lık cgroup'a eklenir ve sızıntı limite çarptığında OOM killer tarafından öldürülür.
:::

## Overlay dosya sistemi: imaj katmanları

Bir konteyner imajı, her biri bir dosya sistemi farkı olan salt okunur katmanlardan oluşur (Dockerfile'daki her `RUN`, `COPY` genellikle bir katman). Çalışma zamanı bu katmanları **overlayfs** ile üst üste bindirir: `lowerdir` salt okunur imaj katmanları, `upperdir` konteynere özel yazılabilir katman, `merged` ise sürecin `/` olarak gördüğü birleşik görünümdür.

Bir dosya ilk kez değiştirildiğinde **copy-up** olur: dosya alt katmandan yazılabilir katmana kopyalanır ve değişiklik orada yapılır. Silme ise alt katmanda dosyayı silmez, üstte bir "whiteout" işareti bırakır. Sonuçları pratiktir: aynı imajdan çalışan yüz konteyner, imaj katmanlarını diskte ve page cache'te paylaşır; ama büyük bir dosyayı konteyner içinde değiştirmek tüm dosyanın kopyalanmasına yol açar. Veritabanı dosyaları gibi yoğun yazılan veriler bu yüzden overlay'de değil, **volume**'da tutulur.

## Çalışma zamanı zinciri

`docker run` dediğinizde bu işleri Docker CLI yapmaz. İstek Docker daemon'una, oradan **containerd**'ye gider; containerd imajı indirir, katmanları açar ve OCI standardındaki bir paket (bundle) hazırlar. Asıl süreci **runc** gibi düşük seviyeli bir çalışma zamanı oluşturur: namespace'leri açar, cgroup'u yazar, overlay kökü bağlar ve sonra sizin komutunuzu `exec` eder. Kubernetes de Docker daemon'u olmadan containerd ya da CRI-O ile aynı zinciri kullanır.

:::code{lang="bash" title="Konteynerin altını kendi gözünüzle görün (Linux, root ya da sudo)"}
```bash
# 1) Docker olmadan PID ve mount namespace'i: içeride kendinizi PID 1 görürsünüz
sudo unshare --pid --fork --mount-proc bash -c 'echo "PID: $BASHPID"; ps aux | head -3'

# 2) Çalışan bir konteynerin ana makinedeki PID'i ve namespace'leri
PID=$(docker inspect -f '{{.State.Pid}}' web)
sudo lsns -p "$PID"                 # pid, mnt, net, uts, ipc ... namespace kimlikleri
cat /proc/"$PID"/cgroup              # 0::/system.slice/docker-<id>.scope

# 3) cgroup v2 limitlerini doğrudan okuyun
docker run -d --name sinirli --memory=256m --cpus=0.5 nginx
CG=/sys/fs/cgroup/system.slice/docker-$(docker inspect -f '{{.Id}}' sinirli).scope
cat "$CG/memory.max"                 # 268435456
cat "$CG/cpu.max"                    # 50000 100000
cat "$CG/memory.events"              # oom_kill sayacı burada artar

# 4) Overlay katmanları
docker inspect -f '{{json .GraphDriver.Data}}' sinirli   # LowerDir, UpperDir, MergedDir
```
:::

Not: cgroup yolu sistemin cgroup sürücüsüne göre değişebilir (systemd ya da cgroupfs); `cat /proc/<pid>/cgroup` her zaman doğru yolu söyler.

:::realworld{company="Google"}
cgroup'ların kökeni Google'dır. 2006 civarında Google mühendisleri, aynı makinede çok sayıda işi birbirini ezmeden çalıştırmak için çekirdeğe "process containers" adlı bir yama önerdi; bu çalışma isim karmaşasını önlemek için "control groups" adını aldı ve 2008'de Linux 2.6.24 ile ana çekirdeğe girdi.

Google'ın 2015'te EuroSys'te yayımladığı *Large-scale cluster management at Google with Borg* makalesi, bu mekanizmanın üretimdeki karşılığını anlatır: Borg, her görevi bir Linux cgroup tabanlı konteynerde çalıştırır, CPU ve bellek limitleriyle yüksek öncelikli üretim işleri ile düşük öncelikli toplu işleri aynı makinelerde paylaştırır ve kaynak sıkışınca düşük öncelikli işleri kısar ya da sonlandırır. Makalenin "Lessons" bölümü, Borg deneyiminin Kubernetes tasarımına (pod, etiketler, pod ve servis başına IP adresi) nasıl yansıdığını da açıkça yazar. Bugün `docker run --memory` ya da bir pod'un `limits` alanı, aynı çekirdek mekanizmasının basitleştirilmiş arayüzleridir.
:::

:::callout{tone="warning" title="Konteyner bir güvenlik sınırı değildir (tek başına)"}
Konteynerler aynı çekirdeği paylaşır. Konteyner içinde root çalışan bir süreç, bir çekirdek açığıyla ana makineye kaçabilir. Savunma katmanlarını birlikte kullanın: root olmayan kullanıcı (`USER` talimatı) ya da user namespace (rootless), gereksiz yetenekleri düşürmek (`--cap-drop=ALL`), seccomp profili ve salt okunur kök dosya sistemi (`--read-only`). Güvenilmeyen kodu çalıştırıyorsanız gVisor ya da Firecracker gibi ek yalıtım katmanlarını değerlendirin.
:::

:::callout{tone="tip" title="Hata ayıklarken"}
Konteyner "sebepsizce" yeniden başlıyorsa önce `docker inspect` çıktısında `OOMKilled` alanına ve cgroup'un `memory.events` dosyasına bakın. Gecikme ani sıçramalar yapıyorsa `cpu.stat` içindeki `nr_throttled` ve `throttled_usec` değerleri CPU limitine takıldığınızı gösterir.
:::

:::quiz{src="quiz.json"}
:::

:::resources
- [namespaces(7) — Linux manual page](https://man7.org/linux/man-pages/man7/namespaces.7.html) — belge — tüm namespace türleri ve sistem çağrıları
- [cgroups(7) — Linux manual page](https://man7.org/linux/man-pages/man7/cgroups.7.html) — belge — cgroup v1 ve v2
- [Control Group v2](https://docs.kernel.org/admin-guide/cgroup-v2.html) — belge — çekirdek belgesi: memory.max, cpu.max, memory.events
- [Large-scale cluster management at Google with Borg](https://research.google/pubs/large-scale-cluster-management-at-google-with-borg/) — bildiri — EuroSys 2015
- [Docker: OverlayFS storage driver](https://docs.docker.com/engine/storage/drivers/overlayfs-driver/) — belge — lowerdir, upperdir, copy-up
:::

:::next{lesson="h-05-devops-ve-docker-kullanim-rehberi"}
Altını gördün; şimdi üstüne dön. h-05'teki Docker ve Compose rehberinde `--memory`, volume, ağ ve çok aşamalı Dockerfile gibi pratik ayarları bu derste öğrendiğin namespace, cgroup ve overlay mekanizmalarıyla eşleştirerek yeniden oku.
:::

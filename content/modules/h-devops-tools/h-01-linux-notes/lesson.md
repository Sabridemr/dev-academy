---
id: h-01-linux-notes
slug: linux-notes
module: h-devops-tools
order: 1
title:
  tr: "Linux Temelleri: Terminal, Dosya Sistemi ve İzinler"
  en: "Linux Basics: Terminal, File System and Permissions"
summary:
  tr: "Linux mimarisi, dosya sistemi, izinler ve temel komutlarla terminalde rahatça çalışmayı öğren."
  en: "Work confidently in the Linux terminal with its architecture, file system, permissions and core commands."
durationMinutes: 28
level: beginner
tags: [linux, command-line, shell, bash, devops, system-administration]
prerequisites: [a-01-client-server-dns-http, f-01-servers-datacenters-regions]
concepts: [kernel, shell, file-system-hierarchy, file-permissions, chmod, pipes, grep, process-management, systemd, package-manager, shell-scripting, ssh, cron]
---

## Kavram: sunucuların ortak dili

Bulutta kiraladığınız sanal makine, Kubernetes'in içinde koşan konteyner, CI hattınızın "runner"ı ve elinizdeki Android telefon aynı çekirdeği paylaşır: **Linux**. Bir DevOps mühendisi için Linux bilmek, bir aşçı için bıçak tutmayı bilmek gibidir; sonraki derslerde göreceğiniz Docker, CI/CD ve izleme araçlarının tamamı bu temelin üstünde durur.

Linux'u öğrenmenin en verimli yolu komutları ezberlemek değil, sistemin **nasıl düşündüğünü** kavramaktır. Bu ders üç fikrin etrafında döner:

1. **Her şey bir dosyadır** — disk, ağ kartı, çalışan süreçler bile dosya ağacında bir yerde görünür.
2. **Küçük araçlar birleşir** — her komut tek bir iş yapar, `|` (pipe) ile zincirlenir.
3. **Kullanıcı ve izin modeli** — kimin neyi okuyup yazabileceği dosya düzeyinde belirlenir.

## Mimari: kernel, shell ve kullanıcı alanı

Linux katmanlı bir yapıdır. En altta donanım (CPU, bellek, disk, ağ kartı) durur. Onun hemen üstünde **kernel (çekirdek)** vardır: süreçleri zamanlar, belleği paylaştırır, dosya sistemlerini ve sürücüleri yönetir. Kernel'in üstü **kullanıcı alanı (user space)** olarak adlandırılır; burada editörünüz, web sunucunuz ve **shell** (kabuk) çalışır.

Shell, yazdığınız komutları yorumlayan programdır. En yaygın olanı **bash**'tir; macOS'ta ve birçok geliştirici makinesinde **zsh** kullanılır. `ls -l /var/log` yazdığınızda shell satırı parçalara ayırır, `ls` programını bulur ve kernel'e "bu programı çalıştır" der. `ls` de dizini okumak için kernel'e bir **sistem çağrısı (system call)** yapar; kernel diski okuyup sonucu geri verir. Kullanıcı alanındaki hiçbir program donanıma doğrudan dokunamaz; her şey bu dar kapıdan geçer.

:::diagram{src="diagram.svg" alt="Linux katmanları: üstte kullanıcı alanı (shell, uygulamalar, servisler), ortada sistem çağrısı arayüzü, altta kernel bileşenleri (zamanlayıcı, bellek yönetimi, VFS, ağ yığını, sürücüler) ve en altta donanım; sağda bir komutun katmanlardan geçişi|Linux layers: user space (shell, applications, services) on top, the system call interface in the middle, kernel components (scheduler, memory management, VFS, network stack, drivers) below and hardware at the bottom; on the right, a command passing through the layers"}
Bir komut shell'den başlar, sistem çağrısıyla kernel'e iner ve donanıma ancak kernel üzerinden ulaşır.
:::

Hangi dağıtımı (distribution) kullandığınız bu resmi değiştirmez. Ubuntu, Debian, Fedora, Rocky Linux ya da Alpine aynı kernel'i farklı paket yöneticileri ve varsayılan araçlarla paketler. Sunucularda uzun süre desteklenen sürümler (LTS) tercih edilir; konteyner imajlarında ise küçük boyutu için Alpine ya da "slim" Debian yaygındır.

## Dosya sistemi hiyerarşisi

Windows'taki `C:` ve `D:` sürücülerinin aksine Linux'ta tek bir ağaç vardır ve kökü `/` ile gösterilir. Takılan her disk, USB bellek ya da ağ paylaşımı bu ağacın bir dalına **bağlanır (mount)**. Dizinlerin yerleşimi **Filesystem Hierarchy Standard (FHS)** adlı bir standarda uyar; bu sayede hangi dağıtımda olursanız olun yapılandırma dosyalarını nerede arayacağınızı bilirsiniz.

| Dizin | Ne tutar? | Günlük hayatta ne zaman girersiniz? |
|---|---|---|
| `/etc` | Sistem ve servis yapılandırmaları | nginx, ssh, cron ayarlarını düzenlerken |
| `/var` | Değişen veriler: loglar, kuyruklar, önbellekler | `/var/log` içinde hata ararken |
| `/home` | Kullanıcıların ev dizinleri (`~`) | Kişisel dosyalar, `.bashrc`, SSH anahtarları |
| `/root` | root kullanıcısının ev dizini | Yönetici işlerinde |
| `/usr` | Kurulu programlar ve kütüphaneler | `/usr/bin`, `/usr/local/bin` içinde komutlar |
| `/opt` | Üçüncü parti ya da kendi uygulamalarınız | Tek klasörde dağıtılan araçlar |
| `/tmp` | Geçici dosyalar; yeniden başlatınca temizlenebilir | Ara çıktılar |
| `/proc`, `/sys` | Kernel'in sanal görünümü: süreçler, donanım | `cat /proc/cpuinfo` gibi sorgular |
| `/dev` | Aygıt dosyaları | `/dev/sda`, `/dev/null` |
| `/boot` | Kernel ve önyükleyici | Kernel güncellemelerinde |

Yollar iki türlüdür: `/etc/nginx/nginx.conf` gibi kökten başlayan **mutlak yol**, `../logs/app.log` gibi bulunduğunuz dizine göre **göreli yol**. `.` bulunduğunuz dizini, `..` bir üst dizini, `~` ev dizininizi temsil eder.

## Gezinme ve dosya komutları

Terminalde geçirdiğiniz zamanın büyük kısmı dolaşmak, bakmak ve taşımakla geçer. Aşağıdaki blok en sık kullanacağınız komutları bir senaryo içinde gösterir.

:::code{lang="bash" title="Dizinlerde dolaşma ve dosya işlemleri"}
```bash
pwd                        # neredeyim?
ls -lah /var/log           # ayrıntılı, gizli dosyalar dahil, okunabilir boyutlar
cd /opt/app && ls          # dizine gir ve listele
mkdir -p releases/v2/logs  # iç içe dizinleri tek seferde oluştur
touch notes.txt            # boş dosya oluştur (ya da zaman damgasını güncelle)
cp -r config/ config.bak/  # dizini özyinelemeli kopyala
mv notes.txt NOTES.md      # taşı ya da yeniden adlandır
rm -rf releases/v1         # dizini sorgusuz sil — dikkat!
cat /etc/os-release        # dağıtım bilgisi
less /var/log/syslog       # sayfa sayfa gez; q ile çık
head -n 20 app.log         # ilk 20 satır
tail -f app.log            # dosyayı canlı izle
find /var/www -name "*.log" -mtime +7   # 7 günden eski log dosyalarını bul
ln -s /opt/app/current /srv/app         # sembolik bağ oluştur
```
:::

`ln -s` ile oluşturulan **sembolik bağ** bir kısayol gibidir: hedefin yolunu tutar, hedef silinirse bağ kırılır. `ln` ile (parametresiz) oluşturulan **sert bağ (hard link)** ise aynı veriye ikinci bir isim verir; orijinal silinse bile veri yaşamaya devam eder. Dağıtım araçlarının `current -> releases/v2` gibi bir bağı değiştirerek sürüm geçişi yapması, sembolik bağların klasik kullanımıdır.

## İzinler: kim, neyi, nasıl?

Linux çok kullanıcılı bir sistemdir; her dosyanın bir **sahibi (user)** ve bir **grubu (group)** vardır. İzinler üç kitle için ayrı ayrı tanımlanır: sahip, grup ve diğerleri (others). Her kitle için üç hak vardır: okuma (**r**), yazma (**w**) ve çalıştırma (**x**). `ls -l` çıktısındaki `-rwxr-x---` dizisi tam olarak bunu söyler: sahip her şeyi yapabilir, grup okuyup çalıştırabilir, diğerleri hiçbir şey yapamaz.

İzinler sekizlik (oktal) sayılarla da yazılır: r=4, w=2, x=1 toplanır ve her kitle için bir rakam oluşur.

| Oktal | Semboller | Anlamı | Tipik kullanım |
|---|---|---|---|
| 7 | rwx | oku + yaz + çalıştır | Sahibin betikleri, dizinler |
| 6 | rw- | oku + yaz | Sahibin veri dosyaları |
| 5 | r-x | oku + çalıştır | Grubun/diğerlerinin program erişimi |
| 4 | r-- | yalnızca oku | Herkese açık yapılandırma |
| 0 | --- | hiçbir hak | Gizli anahtarlar için "diğerleri" |

Sık karşılaşılan üçlüler: `644` (sahip yazar, herkes okur — tipik dosya), `755` (sahip her şeyi yapar, herkes okuyup çalıştırır — tipik betik ya da dizin), `600` (yalnızca sahip — SSH özel anahtarı), `700` (yalnızca sahip, dizin — `~/.ssh`). Dizinlerde `x` hakkı "içine girebilme" anlamına gelir; `r` olup `x` olmayan bir dizinin içeriğini listeleyebilir ama içindeki dosyaları açamazsınız.

:::code{lang="bash" title="chmod, chown ve sudo"}
```bash
ls -l deploy.sh            # -rw-r--r-- 1 deploy deploy 412 ... deploy.sh
chmod 755 deploy.sh        # sahip rwx, grup ve diğerleri r-x
chmod u+x,go-r deploy.sh   # sembolik biçim: sahibe x ekle, grup/diğerlerinden r al
chmod -R 750 /opt/app      # özyinelemeli uygula
chown deploy:www-data /opt/app/uploads   # sahip ve grubu değiştir
chmod 600 ~/.ssh/id_ed25519              # özel anahtar yalnızca sahibe açık
sudo systemctl restart nginx             # tek bir komutu root yetkisiyle çalıştır
```
:::

:::callout{tone="warning" title="chmod 777 bir çözüm değil, semptomdur"}
Bir uygulama "permission denied" verdiğinde refleks olarak `chmod -R 777` yazmak her kullanıcıya her şeyi yazma hakkı verir; web sunucusundaki küçük bir açık, tüm uygulama dosyalarının üzerine yazılmasına dönüşür. Doğru yaklaşım hangi kullanıcının çalıştığını bulmak (`ps -o user= -p <PID>`), dosyanın sahibini ya da grubunu ona göre düzeltmek ve yalnızca gereken hakkı vermektir.
:::

## Metin işleme: grep, awk, sed ve pipe

Linux'un gerçek gücü, programların birbirine bağlanmasıdır. Her komutun bir standart girdisi (stdin), standart çıktısı (stdout) ve hata çıktısı (stderr) vardır. `|` işareti soldaki komutun çıktısını sağdakinin girdisine bağlar; `>` çıktıyı dosyaya yazar, `>>` dosyanın sonuna ekler, `2>` ise yalnızca hataları yönlendirir.

- **grep** satır arar: `grep -i error app.log` büyük/küçük harf duyarsız arar, `-n` satır numarası verir, `-r` dizinleri tarar, `-v` eşleşmeyenleri gösterir, `-E` genişletilmiş düzenli ifade kullanır.
- **awk** sütunlarla çalışır: her satırı alanlara böler (`$1`, `$2`…), koşul ve hesaplama yapar.
- **sed** satırları dönüştürür: `s/eski/yeni/g` ile bul-değiştir, `-i` ile dosyayı yerinde düzenler.
- **sort**, **uniq**, **wc**, **cut**, **tr**, **xargs** gibi yardımcılar zincirin halkalarıdır.

:::code{lang="bash" title="Log analizi için komut zincirleri"}
```bash
# Kaç satırda "error" geçiyor?
grep -c "error" app.log

# En çok istek yapan 5 IP (access log'un ilk sütunu IP)
awk '{print $1}' access.log | sort | uniq -c | sort -rn | head -5

# 500 dönen isteklerin yollarını listele (9. sütun durum kodu, 7. sütun yol)
awk '$9 == 500 {print $7}' access.log | sort | uniq -c | sort -rn

# Yapılandırmada portu değiştir ve dosyayı yerinde düzenle
sed -i 's/listen 8080/listen 80/' /etc/nginx/conf.d/app.conf

# Hataları canlı izle, ama sağlık kontrollerini dışarıda bırak
tail -f app.log | grep --line-buffered -i error | grep -v "/health"

# stdout'u dosyaya, stderr'i ayrı dosyaya yaz
./build.sh > build.out 2> build.err
```
:::

Bu zincirlerin güzelliği, her halkayı tek başına deneyebilmenizdir: önce `awk '{print $1}'` çıktısına bakın, doğruysa `| sort` ekleyin, sonra `| uniq -c`. Karmaşık bir boru hattı böyle adım adım kurulur.

## Süreç yönetimi: ps, top, kill ve systemd

Çalışan her programa **süreç (process)** denir; her birinin benzersiz bir **PID**'i, bir ebeveyni ve sahibi vardır. `ps aux` tüm süreçleri listeler, `top` ya da daha okunaklı `htop` canlı CPU/bellek tüketimini gösterir. Bir süreci durdurmak için ona **sinyal** gönderirsiniz: `kill <PID>` varsayılan olarak nazik bir **SIGTERM** yollar ve programa temizlik yapma fırsatı verir; `kill -9` ise **SIGKILL** ile süreci anında yok eder, bu yüzden yalnızca yanıt vermeyen süreçlerde son çare olmalıdır.

Terminalden başlattığınız bir komutu `Ctrl+Z` ile durdurup `bg` ile arka planda sürdürebilir, `fg` ile öne alabilir, `&` ile baştan arka planda başlatabilirsiniz. Oturum kapansa bile sürmesi gereken işler için `nohup` ya da `tmux`/`screen` kullanılır.

Modern dağıtımlarda servisleri **systemd** yönetir. Bir servis, `/etc/systemd/system/` altındaki küçük bir "unit" dosyasıyla tanımlanır; systemd onu açılışta başlatır, çökerse yeniden ayağa kaldırır ve loglarını **journald** ile toplar.

:::code{lang="bash" title="Süreçler ve servisler"}
```bash
ps aux | grep -v grep | grep node     # node süreçlerini bul
top -o %MEM                           # belleğe göre sırala
kill 4312                             # SIGTERM gönder
kill -9 4312                          # yanıt yoksa SIGKILL
pkill -f "worker.py"                  # komut satırına göre öldür
nice -n 10 ./rapor-uret.sh            # düşük öncelikle başlat (yüksek nice = düşük öncelik)

sudo systemctl status nginx           # durum ve son loglar
sudo systemctl enable --now myapp     # açılışta başlat ve hemen çalıştır
sudo journalctl -u myapp -f           # servisin loglarını canlı izle
sudo journalctl --since "1 hour ago" -p err   # son bir saatin hataları
```
:::

## Disk ve ağ komutları

Disk dolduğunda ya da bir port dinlenmediğinde ilk bakacağınız komutlar şunlardır. `df -h` bağlı dosya sistemlerinin doluluğunu, `du -sh *` bulunduğunuz dizindeki alt dizinlerin boyutunu gösterir; bir sunucuda disk alarmı geldiğinde `du -sh /var/log/* | sort -rh | head` genellikle suçluyu bulur. `free -h` bellek ve takas (swap) durumunu, `uptime` yükü, `lsblk` disk ve bölümleri listeler.

Ağ tarafında `ip addr` arayüzleri ve IP'leri, `ss -tulpn` hangi sürecin hangi portu dinlediğini, `ping` ve `traceroute` erişilebilirliği, `dig` DNS çözümlemesini, `curl -I` bir HTTP uç noktasının başlıklarını gösterir. Güvenlik duvarı için Ubuntu'da `ufw`, RHEL ailesinde `firewalld` kullanılır.

:::code{lang="bash" title="Disk ve ağ teşhisi"}
```bash
df -h                                  # disk doluluğu
du -sh /var/log/* | sort -rh | head    # en büyük log dizinleri
free -h                                # bellek
ss -tulpn | grep :443                  # 443'ü kim dinliyor?
ip addr show                           # arayüzler ve IP'ler
dig +short api.ornek.com               # DNS kaydı
curl -sS -o /dev/null -w "%{http_code} %{time_total}s\n" https://api.ornek.com/health
sudo ufw allow 22/tcp && sudo ufw enable
```
:::

## Paket yöneticileri

Yazılım kurmanın Linux yolu, bir **paket yöneticisi** aracılığıyla dağıtımın imzalı depolarından paket çekmektir. Debian ve Ubuntu'da `apt`, Fedora, RHEL ve Rocky'de `dnf`, Alpine'da `apk`, Arch'ta `pacman` kullanılır. Komutların mantığı aynıdır: depo listesini güncelle, paketi kur, güncelle, kaldır. `apt update` yalnızca paket listesini yeniler, `apt upgrade` paketleri gerçekten günceller; ikisini karıştırmak sık yapılan bir hatadır. Üretim sunucularında paket sürümlerini sabitlemek, sürpriz güncellemeleri önler.

## Kısa bir bash betiği

Tekrar eden işleri betiğe (script) dökmek, Linux'un "küçük araçları birleştir" felsefesinin doğal sonucudur. Aşağıdaki betik bir uygulamanın sağlık uç noktasını kontrol eder, başarısızsa servisi yeniden başlatır ve olayı loglar.

:::code{lang="bash" title="healthcheck.sh — başarısız sağlık kontrolünde servisi yeniden başlat"}
```bash
#!/usr/bin/env bash
set -euo pipefail          # hata, tanımsız değişken ve pipe hatasında dur

SERVICE="${1:-myapp}"      # ilk argüman, yoksa myapp
URL="http://127.0.0.1:8080/health"
LOG="/var/log/healthcheck.log"

status=$(curl -s -o /dev/null -w "%{http_code}" --max-time 5 "$URL" || echo "000")

if [[ "$status" == "200" ]]; then
  echo "$(date -Is) OK $SERVICE" >> "$LOG"
else
  echo "$(date -Is) FAIL $SERVICE (http $status) — yeniden başlatılıyor" >> "$LOG"
  systemctl restart "$SERVICE"
fi
```
:::

Betiği `chmod +x healthcheck.sh` ile çalıştırılabilir yapın ve `./healthcheck.sh api` biçiminde çağırın. İlk satırdaki **shebang** (`#!`) hangi yorumlayıcının kullanılacağını söyler; `set -euo pipefail` ise sessizce devam eden hataları en baştan engeller.

## SSH ve cron

Sunuculara uzaktan erişimin standardı **SSH**'tir. Parola yerine anahtar çifti kullanın: `ssh-keygen -t ed25519` ile bir özel ve bir açık anahtar üretilir; açık anahtar sunucudaki `~/.ssh/authorized_keys` dosyasına eklenir, özel anahtar asla makinenizden çıkmaz. `~/.ssh/config` dosyasında takma adlar tanımlayarak `ssh prod-web` demek yeterli olur. `scp` ve `rsync` dosya kopyalar; `rsync` yalnızca değişen parçaları gönderdiği için dağıtımlarda tercih edilir.

**cron**, zamanlanmış işler içindir. `crontab -e` ile açılan dosyada her satır beş zaman alanı (dakika, saat, ayın günü, ay, haftanın günü) ve bir komuttan oluşur. Sistem genelindeki görevler `/etc/cron.d/` altına konur; daha karmaşık zamanlamalar ya da hata takibi gerektiğinde systemd timer'ları cron'un modern alternatifidir.

:::code{lang="bash" title="SSH anahtarı, uzak komut ve cron satırları"}
```bash
ssh-keygen -t ed25519 -C "deploy@laptop"
ssh-copy-id deploy@203.0.113.10          # açık anahtarı sunucuya ekle
ssh deploy@203.0.113.10 'df -h /'        # uzakta tek komut çalıştır
rsync -avz --delete ./dist/ deploy@203.0.113.10:/opt/app/current/

# crontab -e
*/5 * * * *  /opt/scripts/healthcheck.sh api            # her 5 dakikada bir
0 3 * * *    /opt/scripts/backup-db.sh >> /var/log/backup.log 2>&1   # her gece 03:00
0 0 * * 0    find /tmp -type f -mtime +7 -delete        # pazar gece yarısı temizlik
```
:::

:::callout{tone="tip" title="Terminalde hızlanmanın üç kısayolu"}
`Ctrl+R` geçmişte komut arar, `Tab` dosya ve komut adlarını tamamlar, `!!` son komutu tekrarlar (`sudo !!` en sık kullanılan biçimidir). `man <komut>` ya da `<komut> --help` her zaman elinizin altında; `tldr` aracı ise kısa örneklerle özetler.
:::

:::realworld{company="Netflix"}
Netflix'in yayın altyapısı, bulutta binlerce Linux örneği üzerinde koşar ve şirketin performans mühendisleri Linux teşhis araçlarını en görünür kullanan ekiplerden biridir. Ekibin yaygınlaştırdığı "ilk 60 saniye" yaklaşımı, yavaşlayan bir sunucuda sırayla `uptime`, `dmesg | tail`, `vmstat 1`, `mpstat -P ALL 1`, `pidstat 1`, `iostat -xz 1`, `free -m`, `sar -n DEV 1` ve `top` komutlarıyla CPU, bellek, disk ve ağ darboğazını dakikalar içinde daraltmayı öğütler. Aynı ekip, kernel'in `perf` aracının çıktısını okunabilir "flame graph" görsellerine dönüştürerek hangi fonksiyonun CPU yediğini tek bakışta göstermeyi standart hâline getirdi. Bu araçların hiçbiri Netflix'e özgü değildir; hepsi bu derste öğrendiğiniz süreç ve kaynak komutlarının biraz daha derin kuzenleridir.
:::

:::callout{tone="info" title="Mülakat özeti"}
- Kernel donanımı yönetir, shell komutları yorumlar; kullanıcı alanı donanıma yalnızca sistem çağrılarıyla ulaşır.
- `/etc` yapılandırma, `/var/log` loglar, `/home` kullanıcılar, `/proc` kernel'in canlı görünümü.
- İzinler sahip/grup/diğerleri × r/w/x; `644` dosya, `755` betik ve dizin, `600` gizli anahtar.
- `kill` SIGTERM gönderir, `kill -9` son çaredir; servisleri `systemctl`, logları `journalctl` yönetir.
- Pipe ile küçük araçları zincirleyin: `grep | awk | sort | uniq -c | sort -rn | head`.
:::

:::quiz{src="quiz.json"}
:::

:::next{lesson="h-02-linux-temelleri-vps-kurulumu-ve-guvenlik"}
Sırada: bu komutları gerçek bir VPS üzerinde uygulamak — sunucu kiralama, SSH anahtarıyla güvenli giriş, güvenlik duvarı ve Fail2ban.
:::

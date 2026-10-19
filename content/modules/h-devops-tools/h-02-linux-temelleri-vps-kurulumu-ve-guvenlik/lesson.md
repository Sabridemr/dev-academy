---
id: h-02-linux-temelleri-vps-kurulumu-ve-guvenlik
slug: linux-temelleri-vps-kurulumu-ve-guvenlik
module: h-devops-tools
order: 2
title:
  tr: "Linux ve VPS Kullanım Rehberi: Linux Temelleri, VPS Kurulumu ve Güvenlik"
  en: "Linux and VPS Usage Guide: Linux Basics, VPS Setup and Security"
summary:
  tr: "Linux temellerini öğren, bir VPS kurup SSH anahtarı, UFW ve Fail2ban ile güvenli hâle getir."
  en: "Learn Linux basics, then set up a VPS and secure it with SSH keys, UFW and Fail2ban."
durationMinutes: 15
level: beginner
tags: [linux, vps, terminal, ssh, guvenlik, dns]
prerequisites: []
concepts: [dosya-sistemi, dosya-izinleri, paket-yonetimi, systemd, ssh-anahtari, ufw, fail2ban, dns-kaydi]
---

Sıfırdan bir VPS kiralayıp uygulamanızı alan adı ve HTTPS ile canlıya almak

## 1. Linux'a Genel Bakış

Linux, sunucuların büyük çoğunluğunda kullanılan açık kaynaklı bir işletim sistemidir. Bir VPS aldığınızda karşınıza genellikle grafik arayüzü olmayan, yalnızca **terminal** üzerinden yönetilen bir Linux gelir.

### Dağıtım Seçimi

| Dağıtım | Kullanım Alanı | Paket Yöneticisi |
|---|---|---|
| **Ubuntu Server 24.04 LTS** | En yaygın, en çok kaynak — önerilir | `apt` |
| Debian 12 | Çok kararlı, hafif | `apt` |
| Rocky / AlmaLinux | Kurumsal (RHEL uyumlu) | `dnf` |
| Alpine | Çok küçük, konteynerlerde | `apk` |

LTS (Long Term Support) sürümler 5 yıl güvenlik güncellemesi alır; sunucular için her zaman LTS seçin.

### Temel Kavramlar

- **Kernel (çekirdek):** Donanım ile yazılım arasındaki katman.
- **Shell:** Komutları yorumlayan program (bash, zsh).
- **root:** Tam yetkili yönetici hesabı. Günlük işte kullanılmaz; `sudo` tercih edilir.
- **Süreç (process):** Çalışan her program. Her birinin bir PID numarası vardır.
- **Servis (daemon):** Arka planda sürekli çalışan program (nginx, ssh, postgres).
- **Paket:** Kurulabilir yazılım birimi.

## 2. Dosya Sistemi Yapısı

Linux'ta her şey `/` (kök) dizininden başlar; Windows'taki gibi C:, D: sürücüleri yoktur.

| Dizin | İçerik |
|---|---|
| `/` | Kök dizin |
| `/home/kullanici` | Kullanıcı dosyaları (`~` ile kısaltılır) |
| `/root` | root kullanıcısının ev dizini |
| `/etc` | Tüm yapılandırma dosyaları (nginx, ssh, sistem) |
| `/var` | Değişken veriler: loglar (`/var/log`), web dosyaları (`/var/www`) |
| `/opt` | Ek uygulamalar — kendi uygulamalarınız için iyi bir yer |
| `/usr/bin`, `/usr/local/bin` | Çalıştırılabilir programlar |
| `/tmp` | Geçici dosyalar (yeniden başlatınca silinir) |
| `/dev` | Donanım aygıtları |
| `/proc` | Çalışan sistem bilgileri |
| `/mnt`, `/media` | Bağlanmış diskler |

**Yollar:** `/etc/nginx` mutlak yoldur (kökten başlar); `site/index.html` göreceli yoldur (bulunduğunuz yere göre). `.` bulunduğunuz dizin, `..` bir üst dizindir.

## 3. Terminal Temelleri

Bir komutun genel yapısı: `komut -secenekler argumanlar`

:::code{lang="bash"}
```bash
ls -la /etc        # komut: ls, seçenek: -la, argüman: /etc
```
:::

### Klavye Kısayolları

| Kısayol | İşlev |
|---|---|
| `Tab` | Otomatik tamamlama (iki kez basınca seçenekleri listeler) |
| `↑ / ↓` | Komut geçmişi |
| `Ctrl+C` | Çalışan komutu durdurur |
| `Ctrl+D` | Oturumu kapatır |
| `Ctrl+L` | Ekranı temizler |
| `Ctrl+R` | Geçmişte arama |
| `Ctrl+A / Ctrl+E` | Satır başı / sonu |
| `Ctrl+Z` | Komutu duraklatır (`fg` ile devam) |

### Yardım Alma

:::code{lang="bash"}
```bash
man ls             # Ayrıntılı kılavuz (q ile çıkış)
ls --help          # Kısa yardım
which nginx        # Programın yeri
type cd            # Komutun türü
```
:::

## 4. Dosya ve Dizin İşlemleri

:::code{lang="bash"}
```bash
pwd                         # Bulunduğunuz dizin
ls                          # Listele
ls -lah                     # Ayrıntılı, gizliler dahil, okunur boyutlarla
cd /var/www                 # Dizine git
cd ~   |  cd  |  cd -       # Ev dizini / önceki dizin
mkdir proje                 # Dizin oluştur
mkdir -p a/b/c              # İç içe dizin oluştur
touch index.html            # Boş dosya
cp dosya.txt yedek.txt      # Kopyala
cp -r klasor/ yedek/        # Dizin kopyala
mv eski.txt yeni.txt        # Yeniden adlandır
mv dosya.txt /opt/          # Taşı
rm dosya.txt                # Sil
rm -r klasor/               # Dizini sil
rm -rf klasor/              # Sormadan zorla sil (ÇOK DİKKATLİ)
ln -s /opt/app/current app  # Kısayol (sembolik bağ)
tree -L 2                   # Ağaç görünümü (apt install tree)
```
:::

**Uyarı:** Linux'ta çöp kutusu yoktur. `rm` ile silinen dosya geri gelmez.

### Dosya Okuma

:::code{lang="bash"}
```bash
cat dosya.txt               # Tüm içerik
less dosya.txt              # Sayfa sayfa (/ ile ara, q çık)
head -n 20 dosya.txt        # İlk 20 satır
tail -n 50 dosya.txt        # Son 50 satır
tail -f /var/log/syslog     # Canlı izle (log takibi için)
wc -l dosya.txt             # Satır sayısı
```
:::

### Metin Düzenleyiciler

**nano** (kolay): - `nano /etc/hosts` ile açın - `Ctrl+O` kaydet, `Ctrl+X` çık, `Ctrl+W` ara, `Ctrl+K` satır kes

**vim** (güçlü; birçok sunucuda hazır gelir): - `i` yazma moduna geç, `Esc` komut moduna dön - `:w` kaydet, `:q` çık, `:wq` kaydet ve çık, `:q!` kaydetmeden çık - `/kelime` ara, `dd` satır sil, `u` geri al

## 5. Arama ve Metin İşleme

:::code{lang="bash"}
```bash
find / -name "nginx.conf" 2>/dev/null     # Dosya adıyla ara
find . -type f -name "*.log" -mtime +7    # 7 günden eski loglar
find . -size +100M                        # 100 MB'tan büyük dosyalar
grep "error" app.log                      # Metin ara
grep -rin "DATABASE_URL" /opt/app         # Dizinde, büyük/küçük harf duyarsız, satır no
grep -v "debug" app.log                   # İçermeyenleri göster
sort dosya | uniq -c | sort -nr           # Tekrar sayısına göre sırala
awk '{print $1}' access.log               # İlk sütun (IP'ler)
sed -i 's/eski/yeni/g' ayar.conf          # Dosyada bul-değiştir
```
:::

### Yönlendirme ve Boru

:::code{lang="bash"}
```bash
komut > dosya       # Çıktıyı dosyaya yaz (üzerine)
komut >> dosya      # Dosyaya ekle
komut 2> hata.log   # Hataları dosyaya yaz
komut &> tum.log    # Hepsini dosyaya yaz
komut1 | komut2     # Birinin çıktısını diğerine ver
```
:::

Örnek — en çok istek atan 10 IP:

:::code{lang="bash"}
```bash
awk '{print $1}' /var/log/nginx/access.log | sort | uniq -c | sort -nr | head
```
:::

## 6. Kullanıcılar, Gruplar ve İzinler

### Kullanıcı Yönetimi

:::code{lang="bash"}
```bash
whoami                      # Mevcut kullanıcı
sudo adduser ahmet          # Kullanıcı oluştur
sudo usermod -aG sudo ahmet # sudo yetkisi ver
sudo deluser ahmet          # Kullanıcı sil
su - ahmet                  # Kullanıcıya geç
passwd                      # Şifre değiştir
groups                      # Üye olunan gruplar
```
:::

### İzinleri Anlamak

`ls -l` çıktısı: `-rwxr-xr-- 1 deploy www-data 1024 index.html`

| Bölüm | Anlam |
|---|---|
| `-` | Tür (`-` dosya, `d` dizin, `l` bağ) |
| `rwx` | Sahibin izinleri |
| `r-x` | Grubun izinleri |
| `r--` | Diğerlerinin izinleri |

`r` = okuma (4), `w` = yazma (2), `x` = çalıştırma (1). Sayılar toplanır: `rwx` = 7, `r-x` = 5, `r--` = 4.

:::code{lang="bash"}
```bash
chmod 755 script.sh         # rwxr-xr-x  (programlar, dizinler)
chmod 644 index.html        # rw-r--r--  (normal dosyalar)
chmod 600 .env              # rw-------  (gizli dosyalar)
chmod +x deploy.sh          # Çalıştırılabilir yap
chown deploy:www-data dosya # Sahip ve grup değiştir
chown -R deploy /opt/app    # Dizinle birlikte
```
:::

## 7. Paket Yönetimi (Ubuntu/Debian)

:::code{lang="bash"}
```bash
sudo apt update                    # Paket listesini yenile
sudo apt upgrade -y                # Tüm paketleri güncelle
sudo apt install nginx git curl    # Kur
sudo apt remove nginx              # Kaldır
sudo apt purge nginx               # Ayarlarıyla birlikte kaldır
sudo apt autoremove                # Gereksiz paketleri temizle
apt search postgres                # Paket ara
apt list --installed               # Kurulu paketler
sudo apt install unattended-upgrades   # Otomatik güvenlik güncellemeleri
sudo dpkg-reconfigure unattended-upgrades
```
:::

## 8. Süreçler ve Sistem Kaynakları

:::code{lang="bash"}
```bash
top                         # Canlı süreç listesi (q çık)
htop                        # Daha kullanışlı sürümü (apt install htop)
ps aux | grep node          # Belirli süreci bul
kill 1234                   # Süreci nazikçe durdur
kill -9 1234                # Zorla durdur
pkill node                  # Ada göre durdur
free -h                     # RAM
df -h                       # Disk doluluğu
du -sh /var/log/*           # Dizin boyutları
ncdu /                      # Etkileşimli disk analizi
uptime                      # Açık kalma süresi ve yük
nproc                       # CPU çekirdek sayısı
```
:::

### Arka Planda Çalıştırma

:::code{lang="bash"}
```bash
komut &                     # Arka plana at
nohup komut &               # Oturum kapansa da çalışsın
tmux                        # Kalıcı terminal oturumu
#  tmux: Ctrl+B sonra D ile ayrıl, "tmux attach" ile geri dön
```
:::

Kalıcı uygulamalar için `nohup` yerine **systemd** veya **Docker** kullanın (bkz. Bölüm 17).

## 9. Servis Yönetimi (systemd)

:::code{lang="bash"}
```bash
sudo systemctl status nginx       # Durum
sudo systemctl start nginx        # Başlat
sudo systemctl stop nginx         # Durdur
sudo systemctl restart nginx      # Yeniden başlat
sudo systemctl reload nginx       # Kesintisiz ayar yenileme
sudo systemctl enable nginx       # Açılışta otomatik başlat
sudo systemctl disable nginx      # Otomatik başlatmayı kapat
systemctl list-units --type=service --state=running
```
:::

### Loglar (journald)

:::code{lang="bash"}
```bash
journalctl -u nginx               # Servis logları
journalctl -u nginx -f            # Canlı izle
journalctl -u nginx --since "1 hour ago"
journalctl -p err -b              # Bu açılıştan beri hatalar
sudo journalctl --vacuum-size=500M  # Log boyutunu sınırla
```
:::

## 10. Ağ Temelleri

| Kavram | Açıklama |
|---|---|
| **IP adresi** | Sunucunun internetteki adresi (ör. 203.0.113.10) |
| **Port** | Sunucudaki hizmetin kapı numarası |
| **DNS** | Alan adını IP'ye çevirir |
| **A kaydı** | alanadi.com → IPv4 adresi |
| **CNAME** | Bir adı başka bir ada yönlendirir (www → alanadi.com) |
| **TLS/SSL** | HTTPS şifrelemesi |

Yaygın portlar: 22 (SSH), 80 (HTTP), 443 (HTTPS), 5432 (PostgreSQL), 3306 (MySQL), 6379 (Redis), 3000/8000 (uygulama).

:::code{lang="bash"}
```bash
ip a                              # IP adresleri
curl ifconfig.me                  # Dış IP
ping -c 4 google.com              # Bağlantı testi
sudo ss -tulpn                    # Hangi port hangi programda
curl -I https://alanadi.com       # HTTP başlıkları
dig alanadi.com +short            # DNS sorgusu
traceroute google.com             # Yol izleme
```
:::

## 11. VPS Nedir ve Nasıl Seçilir?

**VPS (Virtual Private Server),** bir veri merkezindeki fiziksel sunucunun sanal bir parçasıdır. Size ayrılmış CPU, RAM, disk ve sabit bir IP adresi verir; root erişimiyle istediğiniz her şeyi kurabilirsiniz.

### Popüler Sağlayıcılar

| Sağlayıcı | Not |
|---|---|
| Hetzner | Fiyat/performans çok iyi, Avrupa merkezleri |
| DigitalOcean | Kolay arayüz, iyi dokümantasyon |
| Vultr / Linode | Çok sayıda lokasyon |
| AWS Lightsail | AWS ekosistemi |
| Türk sağlayıcılar | Türkiye içi düşük gecikme, TL fatura |

### Başlangıç İçin Önerilen Boyut

| Proje | CPU | RAM | Disk |
|---|---|---|---|
| Statik site / küçük API | 1 vCPU | 1–2 GB | 25 GB |
| E-ticaret (uygulama + PostgreSQL) | 2 vCPU | 4 GB | 40–80 GB SSD |
| Yoğun trafik | 4+ vCPU | 8+ GB | Ayrı veritabanı sunucusu |

### Sipariş Adımları

1. Sağlayıcıda hesap açın.
2. **Ubuntu 24.04 LTS** imajını seçin.
3. Size yakın lokasyon seçin (Türkiye için Frankfurt/Nürnberg/İstanbul).
4. **SSH anahtarınızı** ekleyin (Bölüm 12).
5. Sunucuyu oluşturun ve IP adresini not edin.

## 12. SSH ile Bağlanma

SSH, uzak sunucuya şifreli bağlantı sağlar.

### SSH Anahtarı Oluşturma (kendi bilgisayarınızda)

:::code{lang="bash"}
```bash
ssh-keygen -t ed25519 -C "sabri@mac"
# Enter ile varsayılan yol: ~/.ssh/id_ed25519
cat ~/.ssh/id_ed25519.pub         # Açık anahtar — VPS paneline bunu yapıştırın
```
:::

`id_ed25519` (özel anahtar) **asla** paylaşılmaz; `.pub` uzantılı açık anahtar paylaşılabilir.

### Bağlanma

:::code{lang="bash"}
```bash
ssh root@203.0.113.10
```
:::

### Kolay Bağlantı İçin `~/.ssh/config`

:::code{lang="text"}
```text
Host magaza
    HostName 203.0.113.10
    User deploy
    IdentityFile ~/.ssh/id_ed25519
```
:::

Artık yalnızca `ssh magaza` yazmanız yeterli.

### Dosya Aktarımı

:::code{lang="bash"}
```bash
scp dosya.zip magaza:/opt/app/           # Tek dosya gönder
scp magaza:/opt/app/yedek.sql ./         # Sunucudan al
rsync -avz --delete ./site/ magaza:/var/www/site/   # Klasör senkronize et
```
:::

## 13. İlk Kurulum ve Güvenlik Sıkılaştırma

Sunucu açıldıktan sonra ilk 15 dakikada yapılması gerekenler:

### 1. Sistemi Güncelleyin

:::code{lang="bash"}
```bash
apt update && apt upgrade -y
timedatectl set-timezone Europe/Istanbul
hostnamectl set-hostname magaza-prod
```
:::

### 2. Yönetici Kullanıcı Oluşturun

:::code{lang="bash"}
```bash
adduser deploy
usermod -aG sudo deploy
mkdir -p /home/deploy/.ssh
cp ~/.ssh/authorized_keys /home/deploy/.ssh/
chown -R deploy:deploy /home/deploy/.ssh
chmod 700 /home/deploy/.ssh && chmod 600 /home/deploy/.ssh/authorized_keys
```
:::

Yeni terminalde `ssh deploy@IP` ile girişi **test edin**, sonra devam edin.

### 3. SSH'ı Güvenli Hale Getirin

`sudo nano /etc/ssh/sshd_config` içinde:

:::code{lang="text"}
```text
PermitRootLogin no
PasswordAuthentication no
PubkeyAuthentication yes
```
:::

:::code{lang="bash"}
```bash
sudo systemctl restart ssh
```
:::

### 4. Güvenlik Duvarı (UFW)

:::code{lang="bash"}
```bash
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow OpenSSH
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw enable
sudo ufw status verbose
```
:::

**Önemli:** `ufw enable` öncesi SSH'a izin vermezseniz sunucuya erişiminiz kesilir.

### 5. Kaba Kuvvet Saldırılarına Karşı Fail2ban

:::code{lang="bash"}
```bash
sudo apt install fail2ban -y
sudo systemctl enable --now fail2ban
sudo fail2ban-client status sshd
```
:::

### 6. Otomatik Güvenlik Güncellemeleri

:::code{lang="bash"}
```bash
sudo apt install unattended-upgrades -y
sudo dpkg-reconfigure --priority=low unattended-upgrades
```
:::

### 7. Swap (Düşük RAM'li sunucularda)

:::code{lang="bash"}
```bash
sudo fallocate -l 2G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile && sudo swapon /swapfile
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
```
:::

## 14. Alan Adı ve DNS Ayarı

Alan adınızı aldığınız firmanın (veya Cloudflare'in) DNS panelinde:

| Tür | Ad | Değer |
|---|---|---|
| A | `@` | 203.0.113.10 |
| A | `www` | 203.0.113.10 |
| A | `api` | 203.0.113.10 (isteğe bağlı) |

Yayılması birkaç dakika ile birkaç saat sürebilir. Kontrol:

:::code{lang="bash"}
```bash
dig alanadi.com +short
```
:::

:::quiz{src="quiz.json"}
:::

## Orijinal PDF sayfaları

:::callout{tone="info" title="Özgün görünüm"}
Bu dersin metni *Linux VPS Rehberi* PDF dosyasının 1–9. sayfalarının özgün hâlidir; sayfalar aşağıda PDF'teki görünümüyle yer alır.
:::

:::diagram{src="pdf-sayfa-01.png" alt="Linux VPS Rehberi - PDF sayfa 1"}
PDF sayfa 1 / 19
:::

:::diagram{src="pdf-sayfa-02.png" alt="Linux VPS Rehberi - PDF sayfa 2"}
PDF sayfa 2 / 19
:::

:::diagram{src="pdf-sayfa-03.png" alt="Linux VPS Rehberi - PDF sayfa 3"}
PDF sayfa 3 / 19
:::

:::diagram{src="pdf-sayfa-04.png" alt="Linux VPS Rehberi - PDF sayfa 4"}
PDF sayfa 4 / 19
:::

:::diagram{src="pdf-sayfa-05.png" alt="Linux VPS Rehberi - PDF sayfa 5"}
PDF sayfa 5 / 19
:::

:::diagram{src="pdf-sayfa-06.png" alt="Linux VPS Rehberi - PDF sayfa 6"}
PDF sayfa 6 / 19
:::

:::diagram{src="pdf-sayfa-07.png" alt="Linux VPS Rehberi - PDF sayfa 7"}
PDF sayfa 7 / 19
:::

:::diagram{src="pdf-sayfa-08.png" alt="Linux VPS Rehberi - PDF sayfa 8"}
PDF sayfa 8 / 19
:::

:::diagram{src="pdf-sayfa-09.png" alt="Linux VPS Rehberi - PDF sayfa 9"}
PDF sayfa 9 / 19
:::

:::next{lesson="h-03-canliya-alma-yedekleme-ve-bakim"}
:::

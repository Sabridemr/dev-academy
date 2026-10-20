---
id: h-03-canliya-alma-yedekleme-ve-bakim
slug: canliya-alma-yedekleme-ve-bakim
module: h-devops-tools
order: 3
title:
  tr: "Linux ve VPS Kullanım Rehberi: Canlıya Alma, Yedekleme ve Bakım"
  en: "Linux and VPS Usage Guide: Deployment, Backups and Maintenance"
summary:
  tr: "Uygulamanı VPS'te Nginx, systemd ya da Docker Compose ile yayına al; yedekle, izle ve sorun gider."
  en: "Deploy your app on a VPS with Nginx, systemd or Docker Compose, then back it up, monitor and fix it."
durationMinutes: 22
level: intermediate
tags: [linux, vps, deployment, nginx, docker, backup]
prerequisites: [h-02-linux-temelleri-vps-kurulumu-ve-guvenlik, f-03-kubernetes-basics]
concepts: [ters-vekil, lets-encrypt, systemd-servisi, docker-compose, caddy, github-actions, cron, yedekleme]
---

## 15. Canlıya Alma Yöntemleri — Genel Bakış

| Yöntem | Ne Zaman? |
|---|---|
| **A. Statik site + Nginx** | Sadece HTML/CSS/JS |
| **B. Node.js/Python + systemd + Nginx** | Tek uygulama, Docker'sız, basit |
| **C. Docker Compose + Caddy/Nginx** | Önerilen: taşınabilir, çok servisli |
| **D. Coolify / Dokploy (PaaS)** | Arayüzden yönetim, Heroku benzeri |

Aşağıda her yöntemi adım adım anlatıyoruz.

### Genel Mimari

:::code{lang="text"}
```text
Kullanıcı → alanadi.com (DNS) → VPS:443
         → Nginx/Caddy (HTTPS, ters vekil)
              ├─ /        → statik dosyalar veya frontend
              └─ /api     → uygulama (localhost:3000)
                              └─ PostgreSQL (localhost:5432, dışarıya kapalı)
```
:::

## 16. Yöntem A — Statik Siteyi Nginx ile Yayınlamak

:::code{lang="bash"}
```bash
sudo apt install nginx -y
sudo mkdir -p /var/www/magaza
sudo chown -R deploy:deploy /var/www/magaza
```
:::

Kendi bilgisayarınızdan dosyaları gönderin:

:::code{lang="bash"}
```bash
rsync -avz ./site/ magaza:/var/www/magaza/
```
:::

Site ayarı — `sudo nano /etc/nginx/sites-available/magaza`:

:::code{lang="nginx"}
```nginx
server {
    listen 80;
    server_name alanadi.com www.alanadi.com;
    root /var/www/magaza;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    location ~* \.(png|jpg|jpeg|webp|svg|css|js|woff2)$ {
        expires 30d;
        add_header Cache-Control "public";
    }

    gzip on;
    gzip_types text/css application/javascript image/svg+xml;
}
```
:::

Etkinleştirin:

:::code{lang="bash"}
```bash
sudo ln -s /etc/nginx/sites-available/magaza /etc/nginx/sites-enabled/
sudo rm /etc/nginx/sites-enabled/default
sudo nginx -t                 # Ayar testi — her değişiklikten sonra
sudo systemctl reload nginx
```
:::

### HTTPS (Let's Encrypt)

:::code{lang="bash"}
```bash
sudo apt install certbot python3-certbot-nginx -y
sudo certbot --nginx -d alanadi.com -d www.alanadi.com
sudo certbot renew --dry-run  # Otomatik yenileme testi
```
:::

Certbot HTTPS ayarını ve HTTP→HTTPS yönlendirmesini otomatik ekler; sertifika 90 günde bir kendiliğinden yenilenir.

## 17. Yöntem B — Node.js Uygulaması (systemd + Nginx)

### 1. Gerekli Yazılımlar

:::code{lang="bash"}
```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs git build-essential
node -v && npm -v
```
:::

### 2. PostgreSQL Kurulumu

:::code{lang="bash"}
```bash
sudo apt install postgresql -y
sudo -u postgres psql
```
:::

:::code{lang="sql"}
```sql
CREATE USER magaza WITH PASSWORD 'guclu_sifre';
CREATE DATABASE magaza OWNER magaza;
\q
```
:::

PostgreSQL varsayılan olarak yalnızca `localhost`'u dinler — dışarıya açmayın.

### 3. Kodu Sunucuya Alın

:::code{lang="bash"}
```bash
sudo mkdir -p /opt/magaza && sudo chown deploy:deploy /opt/magaza
cd /opt/magaza
git clone git@github.com:kullanici/magaza.git .
npm ci --omit=dev
npm run build        # varsa
```
:::

Özel GitHub deposu için sunucuda `ssh-keygen` ile anahtar üretip GitHub'da **Deploy key** olarak ekleyin.

### 4. Ortam Değişkenleri

`nano /opt/magaza/.env`:

:::code{lang="bash"}
```bash
NODE_ENV=production
PORT=3000
DATABASE_URL=postgres://magaza:guclu_sifre@localhost:5432/magaza
SESSION_SECRET=uzun_rastgele_bir_deger
```
:::

:::code{lang="bash"}
```bash
chmod 600 /opt/magaza/.env
openssl rand -hex 32          # Rastgele gizli anahtar üretimi
```
:::

### 5. systemd Servisi

`sudo nano /etc/systemd/system/magaza.service`:

:::code{lang="ini"}
```ini
[Unit]
Description=Magaza Node Uygulamasi
After=network.target postgresql.service

[Service]
Type=simple
User=deploy
WorkingDirectory=/opt/magaza
EnvironmentFile=/opt/magaza/.env
ExecStart=/usr/bin/node dist/server.js
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
```
:::

:::code{lang="bash"}
```bash
sudo systemctl daemon-reload
sudo systemctl enable --now magaza
sudo systemctl status magaza
journalctl -u magaza -f
curl http://localhost:3000     # Yerel test
```
:::

Alternatif olarak **PM2** de kullanılabilir: `npm i -g pm2 && pm2 start dist/server.js --name magaza && pm2 startup && pm2 save`.

### 6. Nginx Ters Vekil

`/etc/nginx/sites-available/magaza`:

:::code{lang="nginx"}
```nginx
server {
    listen 80;
    server_name alanadi.com www.alanadi.com;
    client_max_body_size 20M;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }
}
```
:::

:::code{lang="bash"}
```bash
sudo nginx -t && sudo systemctl reload nginx
sudo certbot --nginx -d alanadi.com -d www.alanadi.com
```
:::

### 7. Güncelleme Betiği

`/opt/magaza/deploy.sh`:

:::code{lang="bash"}
```bash
#!/usr/bin/env bash
set -euo pipefail
cd /opt/magaza
git pull origin main
npm ci --omit=dev
npm run build
npm run migrate || true
sudo systemctl restart magaza
echo "Yayın tamamlandı: $(date)"
```
:::

:::code{lang="bash"}
```bash
chmod +x deploy.sh && ./deploy.sh
```
:::

Python (Django/FastAPI) için aynı yapı geçerlidir: `python3 -m venv venv`, `pip install -r requirements.txt`, `ExecStart=/opt/magaza/venv/bin/gunicorn -w 3 -b 127.0.0.1:8000 app:app`.

## 18. Yöntem C — Docker Compose ile Canlıya Alma (Önerilen)

### 1. Docker Kurulumu

:::code{lang="bash"}
```bash
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker deploy
# Çıkış yapıp yeniden bağlanın
docker run hello-world
```
:::

### 2. Proje Yapısı

:::code{lang="text"}
```text
/opt/magaza
├── compose.yaml
├── .env
├── Caddyfile
├── api/            (Dockerfile + kod)
└── site/           (HTML/CSS/JS)
```
:::

### 3. `compose.yaml`

:::code{lang="yaml"}
```yaml
services:
  caddy:
    image: caddy:2-alpine
    ports: ["80:80", "443:443"]
    volumes:
      - ./Caddyfile:/etc/caddy/Caddyfile:ro
      - ./site:/srv/site:ro
      - caddy_data:/data
    restart: unless-stopped

  api:
    build: ./api
    env_file: .env
    depends_on:
      db: { condition: service_healthy }
    restart: unless-stopped

  db:
    image: postgres:16-alpine
    environment:
      POSTGRES_USER: magaza
      POSTGRES_PASSWORD: ${DB_PASSWORD}
      POSTGRES_DB: magaza
    volumes: [pgdata:/var/lib/postgresql/data]
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U magaza"]
      interval: 10s
    restart: unless-stopped

volumes:
  pgdata:
  caddy_data:
```
:::

### 4. `Caddyfile` (HTTPS otomatik)

:::code{lang="text"}
```text
alanadi.com, www.alanadi.com {
    encode gzip
    handle /api/* {
        reverse_proxy api:3000
    }
    handle {
        root * /srv/site
        try_files {path} /index.html
        file_server
    }
}
```
:::

### 5. `.env`

:::code{lang="bash"}
```bash
DB_PASSWORD=guclu_sifre
DATABASE_URL=postgres://magaza:guclu_sifre@db:5432/magaza
NODE_ENV=production
```
:::

### 6. Başlatma

:::code{lang="bash"}
```bash
cd /opt/magaza
docker compose up -d --build
docker compose ps
docker compose logs -f
```
:::

Caddy, alan adınız sunucuya yönlendirilmişse sertifikayı ilk istekte otomatik alır.

### 7. Güncelleme

:::code{lang="bash"}
```bash
git pull && docker compose up -d --build && docker image prune -f
```
:::

**Not:** Docker, UFW kurallarını atlayarak portları açabilir. Veritabanı gibi servislerde `ports:` tanımlamayın; yalnızca Docker ağı içinde kalsınlar.

## 19. Yöntem D — Coolify ile Arayüzden Yönetim

Coolify, kendi VPS'inize kurulan açık kaynaklı bir Heroku/Vercel alternatifidir.

:::code{lang="bash"}
```bash
curl -fsSL https://cdn.coollabs.io/coolify/install.sh | sudo bash
```
:::

Kurulumdan sonra `http://IP:8000` adresinden panele girin; GitHub deponuzu bağlayın, alan adını yazın, **Deploy** deyin. HTTPS, veritabanı, yedekleme ve her `git push`'ta otomatik yayın arayüzden ayarlanır.

## 20. Otomatik Yayın (GitHub Actions)

`.github/workflows/deploy.yml`:

:::code{lang="yaml"}
```yaml
name: Deploy
on:
  push:
    branches: [main]
jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: appleboy/ssh-action@v1
        with:
          host: ${{ secrets.VPS_HOST }}
          username: deploy
          key: ${{ secrets.VPS_SSH_KEY }}
          script: |
            cd /opt/magaza
            git pull origin main
            docker compose up -d --build
            docker image prune -f
```
:::

GitHub deposunda **Settings → Secrets → Actions** altına `VPS_HOST` ve `VPS_SSH_KEY` (özel anahtar) ekleyin. Artık `main` dalına her gönderimde site otomatik güncellenir.

## 21. Yedekleme

### Veritabanı Yedeği Betiği

`/opt/scripts/yedek.sh`:

:::code{lang="bash"}
```bash
#!/usr/bin/env bash
set -e
TARIH=$(date +%F_%H%M)
mkdir -p /yedek
docker compose -f /opt/magaza/compose.yaml exec -T db \
  pg_dump -U magaza magaza | gzip > /yedek/db_$TARIH.sql.gz
find /yedek -name "*.sql.gz" -mtime +14 -delete   # 14 günden eskileri sil
```
:::

(Docker'sız kurulumda: `sudo -u postgres pg_dump magaza | gzip > ...`)

### Zamanlama (cron)

:::code{lang="bash"}
```bash
crontab -e
```
:::

:::code{lang="text"}
```text
# dakika saat gün ay haftagünü  komut
0 3 * * * /opt/scripts/yedek.sh >> /var/log/yedek.log 2>&1
```
:::

| Örnek | Anlamı |
|---|---|
| `*/5 * * * *` | 5 dakikada bir |
| `0 * * * *` | Her saat başı |
| `0 3 * * *` | Her gün 03:00 |
| `0 4 * * 0` | Her pazar 04:00 |

### Sunucu Dışına Kopyalama

:::code{lang="bash"}
```bash
rclone copy /yedek uzak:magaza-yedek     # S3, Google Drive, Backblaze vb.
```
:::

Ayrıca VPS sağlayıcınızın **snapshot/otomatik yedek** özelliğini açın. Geri yükleme:

:::code{lang="bash"}
```bash
gunzip -c db_2026-09-28.sql.gz | docker compose exec -T db psql -U magaza magaza
```
:::

## 22. İzleme ve Bakım

- **Uptime Kuma:** Site kapanınca e-posta/Telegram bildirimi.
- **Netdata:** Tek komutla canlı CPU/RAM/disk panosu.
- **Loglar:** `/var/log/nginx/access.log`, `/var/log/nginx/error.log`, `journalctl`, `docker compose logs`.
- **Disk:** `df -h` ile düzenli kontrol; `docker system prune` ile temizlik.
- **Log dönüşümü:** `logrotate` eski logları otomatik sıkıştırır (`/etc/logrotate.d/`).

### Haftalık Bakım Listesi

1. `sudo apt update && sudo apt upgrade`
2. Disk ve RAM kontrolü
3. Yedeklerin oluştuğunu ve açılabildiğini doğrulayın
4. Hata loglarına göz atın
5. `docker compose pull` ile imajları güncelleyin

## 23. Sorun Giderme

| Belirti | Kontrol / Çözüm |
|---|---|
| Site açılmıyor | `dig alanadi.com` doğru IP mi? `sudo ufw status` 80/443 açık mı? |
| 502 Bad Gateway | Uygulama çalışmıyor: `systemctl status magaza` veya `docker compose ps` |
| 504 Timeout | Uygulama yavaş/kilitli; logları ve veritabanını kontrol edin |
| Nginx başlamıyor | `sudo nginx -t` ile hatalı satırı bulun |
| Port kullanımda | `sudo ss -tulpn \| grep :80` |
| SSL alınamıyor | DNS henüz yayılmamış veya 80 portu kapalı |
| Disk dolu | `du -sh /* \| sort -h`, eski loglar ve Docker imajları |
| RAM bitiyor | `htop`, swap ekleyin veya sunucuyu büyütün |
| SSH bağlanmıyor | Sağlayıcı panelindeki web konsolu ile girip `sshd_config` ve `ufw`'yi kontrol edin |
| Permission denied | `ls -l` ile sahip/izinleri kontrol, `chown` / `chmod` |

## 24. Canlıya Alma Kontrol Listesi

- [ ] Ubuntu LTS kurulu ve güncel
- [ ] root girişi ve şifreli giriş kapalı, SSH anahtarı aktif
- [ ] UFW açık; yalnızca 22, 80, 443
- [ ] Fail2ban ve otomatik güncellemeler çalışıyor
- [ ] DNS kayıtları sunucuya yönlü
- [ ] Uygulama systemd veya Docker ile otomatik başlıyor
- [ ] HTTPS aktif, HTTP → HTTPS yönlendirmesi var
- [ ] `.env` Git dışında, izinleri 600
- [ ] Veritabanı dışarıya kapalı
- [ ] Günlük yedek + sunucu dışı kopya
- [ ] Uptime izleme ve bildirim kurulu
- [ ] Güncelleme süreci (betik veya GitHub Actions) test edildi

## 25. Hızlı Başvuru

:::code{lang="bash"}
```bash
ssh magaza                               # Sunucuya bağlan
sudo systemctl restart magaza            # Uygulamayı yeniden başlat
journalctl -u magaza -f                  # Uygulama logları
sudo nginx -t && sudo systemctl reload nginx
sudo tail -f /var/log/nginx/error.log
docker compose ps | logs -f | up -d --build | down
df -h ; free -h ; htop
sudo ufw status
sudo certbot renew --dry-run
rsync -avz ./site/ magaza:/var/www/magaza/
```
:::

:::quiz{src="quiz.json"}
:::

:::next{lesson="h-04-git-notes"}
:::

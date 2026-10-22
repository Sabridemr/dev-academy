---
id: h-05-devops-ve-docker-kullanim-rehberi
slug: devops-ve-docker-kullanim-rehberi
module: h-devops-tools
order: 5
title:
  tr: DevOps ve Docker Kullanım Rehberi
  en: DevOps and Docker Usage Guide
summary:
  tr: "Docker, Compose ve GitHub Actions ile uygulamanı konteynerleştirip otomatik olarak üretime taşı."
  en: "Containerize your app with Docker and Compose and ship it to production automatically with GitHub Actions."
durationMinutes: 25
level: beginner
tags: [devops, docker, docker-compose, ci-cd, kubernetes, iac]
prerequisites: [h-04-git-notes, f-03-kubernetes-basics]
concepts: [konteyner, dockerfile, volume, docker-compose, github-actions, reverse-proxy, terraform, yedekleme]
---

Başlangıçtan üretim ortamına kadar pratik bir başvuru kaynağı

## 1. DevOps Nedir?

DevOps, yazılım geliştirme (Dev) ile sistem operasyonlarını (Ops) birleştiren bir kültür ve yöntemler bütünüdür. Amaç, yazılımı **hızlı, güvenilir ve otomatik** biçimde kullanıcıya ulaştırmaktır.

### Temel İlkeler

- **Otomasyon:** Derleme, test, dağıtım ve altyapı elle değil, kodla yapılır.
- **Sürekli Entegrasyon (CI):** Her kod değişikliği otomatik derlenir ve test edilir.
- **Sürekli Teslimat/Dağıtım (CD):** Testi geçen kod otomatik olarak sunucuya gönderilir.
- **Altyapı Kod Olarak (IaC):** Sunucular, ağlar ve veritabanları dosyalarla tanımlanır.
- **İzleme ve Geri Bildirim:** Loglar, metrikler ve alarmlarla sistem sürekli gözlemlenir.

### DevOps Yaşam Döngüsü

| Aşama | Açıklama | Örnek Araçlar |
|---|---|---|
| Planlama | Görev ve sürüm planı | Linear, Jira, GitHub Issues |
| Kodlama | Kaynak kod yönetimi | Git, GitHub, GitLab |
| Derleme | Paketleme, imaj oluşturma | Docker, npm, Maven |
| Test | Otomatik testler | Jest, Pytest, Playwright |
| Yayınlama | CI/CD hattı | GitHub Actions, GitLab CI, Jenkins |
| Dağıtım | Sunucuya kurulum | Docker Compose, Kubernetes, Ansible |
| Operasyon | Altyapı yönetimi | Terraform, Nginx, systemd |
| İzleme | Log ve metrik | Prometheus, Grafana, Loki, Sentry |

## 2. Gerekli Temel Beceriler

1. **Linux:** Dosya sistemi, izinler, süreçler, servisler (systemd), paket yönetimi.
2. **Ağ:** IP, DNS, portlar, HTTP/HTTPS, TLS sertifikaları, güvenlik duvarı.
3. **Git:** Dal (branch) yönetimi, birleştirme, pull request akışı.
4. **Betik yazma:** Bash ve temel Python.
5. **Konteynerler:** Docker ve Docker Compose.
6. **CI/CD:** GitHub Actions veya benzeri.
7. **Bulut:** AWS, Google Cloud, Azure, Hetzner veya DigitalOcean temelleri.
8. **İzleme:** Log toplama, metrik ve alarm kurma.

## 3. Git Temelleri

:::code{lang="bash"}
```bash
git init                         # Yeni depo
git clone <url>                  # Depoyu indir
git status                       # Değişiklikleri gör
git add .                        # Tüm değişiklikleri hazırla
git commit -m "mesaj"            # Kaydet
git push origin main             # Uzak depoya gönder
git pull                         # Güncellemeleri al
git checkout -b ozellik/sepet    # Yeni dal oluştur ve geç
git merge ozellik/sepet          # Dalı birleştir
git log --oneline --graph        # Geçmişi görüntüle
git stash / git stash pop        # Değişiklikleri geçici sakla
```
:::

**Önerilen akış:** `main` her zaman yayına hazırdır; her özellik ayrı dalda geliştirilir, pull request ile incelenip birleştirilir.

## 4. Docker Nedir?

Docker, uygulamayı ve tüm bağımlılıklarını **konteyner** adı verilen yalıtılmış, taşınabilir bir paket içinde çalıştırır. "Benim bilgisayarımda çalışıyordu" sorununu ortadan kaldırır.

### Temel Kavramlar

| Kavram | Açıklama |
|---|---|
| **İmaj (Image)** | Uygulamanın salt okunur şablonu (tarif). |
| **Konteyner** | İmajın çalışan örneği. |
| **Dockerfile** | İmajın nasıl oluşturulacağını tanımlayan dosya. |
| **Registry** | İmajların saklandığı depo (Docker Hub, GHCR). |
| **Volume** | Kalıcı veri depolama alanı. |
| **Network** | Konteynerlerin birbiriyle iletişim kurduğu ağ. |
| **Compose** | Çok konteynerli uygulamaları tek dosyayla yönetme. |

### Sanal Makine ile Farkı

Sanal makine tam bir işletim sistemi çalıştırır (GB boyutunda, dakikalar içinde açılır). Konteyner ana makinenin çekirdeğini paylaşır (MB boyutunda, saniyeler içinde açılır).

:::diagram{src="diagram.svg" alt="Sanal makine ile konteyner karşılaştırması: solda hipervizör üstünde her biri kendi misafir işletim sistemi çekirdeğini taşıyan üç sanal makine, sağda tek bir paylaşılan Linux çekirdeği ve Docker motoru üstünde yalnızca kütüphane ve uygulama taşıyan üç konteyner|Virtual machines versus containers: on the left three virtual machines on a hypervisor, each carrying its own guest OS kernel; on the right three containers on a single shared Linux kernel and the Docker engine, carrying only libraries and the application"}
Fark, çekirdeğin kopyalanıp kopyalanmamasındadır. Konteynerler tek çekirdeği paylaşır ve namespace ile cgroup sayesinde birbirinden yalıtılır.
:::

## 5. Docker Kurulumu

**macOS / Windows:** Docker Desktop indirilip kurulur (docker.com).

**Ubuntu:**

:::code{lang="bash"}
```bash
sudo apt update
sudo apt install -y ca-certificates curl
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker $USER    # sudo'suz kullanım (oturumu yeniden açın)
docker --version
docker run hello-world           # Kurulum testi
```
:::

## 6. Docker Temel Komutları

### İmaj Komutları

:::code{lang="bash"}
```bash
docker pull nginx:alpine         # İmaj indir
docker images                    # İmajları listele
docker build -t uygulamam:1.0 .  # Dockerfile'dan imaj oluştur
docker tag uygulamam:1.0 kullanici/uygulamam:1.0
docker push kullanici/uygulamam:1.0
docker rmi nginx:alpine          # İmaj sil
docker image prune -a            # Kullanılmayan imajları temizle
```
:::

### Konteyner Komutları

:::code{lang="bash"}
```bash
docker run -d --name web -p 8080:80 nginx:alpine   # Arka planda çalıştır
docker ps                        # Çalışanları listele
docker ps -a                     # Tümünü listele
docker logs -f web               # Logları canlı izle
docker exec -it web sh           # Konteynere bağlan
docker stop web / docker start web / docker restart web
docker rm -f web                 # Zorla sil
docker inspect web               # Ayrıntılı bilgi
docker stats                     # Kaynak kullanımı
docker cp web:/etc/nginx/nginx.conf ./   # Dosya kopyala
```
:::

### Sık Kullanılan `docker run` Parametreleri

| Parametre | Anlamı |
|---|---|
| `-d` | Arka planda çalıştır |
| `-p 8080:80` | Ana makine portu : konteyner portu |
| `-v veri:/data` | Volume bağla |
| `-e KEY=deger` | Ortam değişkeni |
| `--env-file .env` | Ortam değişkenlerini dosyadan al |
| `--name` | Konteyner adı |
| `--restart unless-stopped` | Otomatik yeniden başlatma |
| `--network agim` | Belirli ağa bağla |
| `--rm` | Durunca otomatik sil |

### Temizlik

:::code{lang="bash"}
```bash
docker system df                 # Disk kullanımı
docker system prune -a --volumes # Kullanılmayan her şeyi sil (DİKKAT)
```
:::

## 7. Dockerfile Yazımı

### Temel Talimatlar

| Talimat | Görevi |
|---|---|
| `FROM` | Temel imaj |
| `WORKDIR` | Çalışma dizini |
| `COPY` | Dosya kopyala |
| `RUN` | İmaj oluşturulurken komut çalıştır |
| `ENV` | Ortam değişkeni |
| `EXPOSE` | Kullanılan portu belgeler |
| `USER` | Çalışacak kullanıcı |
| `CMD` / `ENTRYPOINT` | Konteyner başlarken çalışacak komut |
| `HEALTHCHECK` | Sağlık kontrolü |

### Örnek: Statik HTML Sitesi

:::code{lang="dockerfile"}
```dockerfile
FROM nginx:alpine
COPY ./site /usr/share/nginx/html
EXPOSE 80
```
:::

### Örnek: Node.js Uygulaması (Çok Aşamalı)

:::code{lang="dockerfile"}
```dockerfile
# 1. Aşama: derleme
FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# 2. Aşama: çalıştırma
FROM node:20-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app/dist ./dist
COPY package*.json ./
RUN npm ci --omit=dev
USER node
EXPOSE 3000
HEALTHCHECK CMD wget -qO- http://localhost:3000/health || exit 1
CMD ["node", "dist/server.js"]
```
:::

Bu Dockerfile'daki talimatların sırası rastgele değildir: her talimat imajda bir katmana karşılık gelir ve Docker katmanları önbellekte saklar. Aşağıdaki soru bu sıranın neden önemli olduğunu soruyor.

:::predict{id="docker-katman-onbellek"}
Yukarıdaki derleme aşamasında yalnızca `src/server.ts` dosyasında bir satırı değiştirip `docker build` çalıştırıyorsunuz. Hangi adımlar yeniden çalışır? | In the build stage above you change one line in `src/server.ts` and run `docker build`. Which steps run again?
- [ ] Tüm adımlar; Docker her derlemede imajı sıfırdan üretir | Every step; Docker builds the image from scratch every time
- [x] `COPY . .` ve sonrasındaki adımlar; `npm ci` önbellekten gelir | `COPY . .` and the steps after it; `npm ci` comes from cache
- [ ] Yalnızca `RUN npm run build` | Only `RUN npm run build`
Açıklama: Docker talimatları sırayla önbellekle karşılaştırır. `package*.json` değişmediği için `npm ci` katmanı önbellekten gelir. `COPY . .` farklı içerik gördüğü için o katman ve üstündeki her şey yeniden üretilir. Kod, bağımlılık listesinden önce kopyalansaydı her değişiklikte `npm ci` de yeniden çalışırdı. | Docker checks each instruction against its cache in order. `package*.json` is unchanged, so the `npm ci` layer comes from cache. `COPY . .` sees new content, so that layer and everything above it is rebuilt. Had the code been copied before the dependency list, `npm ci` would rerun on every change.
:::

:::animation{scene="docker-layers.scene.json"}
Talimatların salt okunur katmanlara dönüşmesi ve iki konteynerin aynı katmanları paylaşması. Copy-on-write, kod değişikliğinde önbelleğin devreye girmesi ve push/pull sırasında yalnızca yeni katmanların taşınması da gösteriliyor.
:::

### .dockerignore

:::code{lang="text" title=".dockerignore"}
```text
node_modules
.git
.env
*.log
dist
```
:::

### En İyi Uygulamalar

- Küçük temel imaj kullanın (`alpine`, `slim`, `distroless`).
- Sık değişmeyen katmanları üste koyun (önce `package.json`, sonra kod) — önbellek verimli çalışır.
- Çok aşamalı derleme ile imaj boyutunu küçültün.
- Konteyneri root olarak çalıştırmayın (`USER`).
- Sabit sürüm etiketi kullanın (`node:20-alpine`, `latest` değil).
- Şifreleri imaja gömmeyin; ortam değişkeni veya secret kullanın.
- Her konteyner tek bir iş yapsın.

## 8. Volume ve Ağ Yönetimi

### Volume

:::code{lang="bash"}
```bash
docker volume create pgdata
docker volume ls
docker run -d -v pgdata:/var/lib/postgresql/data postgres:16
docker run -d -v $(pwd)/site:/usr/share/nginx/html nginx   # Bind mount (geliştirme için)
```
:::

**Named volume** üretimde veri saklamak için, **bind mount** geliştirmede kodu canlı yansıtmak için kullanılır.

### Ağ

:::code{lang="bash"}
```bash
docker network create agim
docker run -d --name db --network agim postgres:16
docker run -d --name api --network agim uygulamam
# api konteyneri veritabanına "db" adıyla erişir: postgres://db:5432
```
:::

## 9. Docker Compose

Birden fazla servisi (web, API, veritabanı, önbellek) tek dosyada tanımlar.

### Örnek: E-ticaret Yığını (`compose.yaml`)

:::code{lang="yaml" title="compose.yaml"}
```yaml
services:
  web:
    image: nginx:alpine
    ports:
      - "80:80"
    volumes:
      - ./site:/usr/share/nginx/html:ro
      - ./nginx.conf:/etc/nginx/conf.d/default.conf:ro
    depends_on:
      - api
    restart: unless-stopped

  api:
    build: ./api
    env_file: .env
    environment:
      DATABASE_URL: postgres://app:${DB_PASSWORD}@db:5432/magaza
      REDIS_URL: redis://cache:6379
    depends_on:
      db:
        condition: service_healthy
    restart: unless-stopped

  db:
    image: postgres:16-alpine
    environment:
      POSTGRES_USER: app
      POSTGRES_PASSWORD: ${DB_PASSWORD}
      POSTGRES_DB: magaza
    volumes:
      - pgdata:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U app"]
      interval: 10s
      retries: 5
    restart: unless-stopped

  cache:
    image: redis:7-alpine
    restart: unless-stopped

volumes:
  pgdata:
```
:::

### `.env` Dosyası

:::code{lang="bash" title=".env"}
```bash
DB_PASSWORD=guclu_bir_sifre
```
:::

`.env` dosyasını **asla** Git'e göndermeyin (`.gitignore` içine ekleyin).

### Compose Komutları

:::code{lang="bash"}
```bash
docker compose up -d             # Başlat
docker compose up -d --build     # Yeniden derleyip başlat
docker compose ps                # Durum
docker compose logs -f api       # Belirli servis logları
docker compose exec db psql -U app magaza   # Veritabanına bağlan
docker compose down              # Durdur ve sil
docker compose down -v           # Volume'larla birlikte sil (VERİ GİDER)
docker compose pull              # Yeni imajları indir
```
:::

## 10. CI/CD — GitHub Actions

Depoda `.github/workflows/deploy.yml` dosyası oluşturulur.

:::code{lang="yaml" title=".github/workflows/deploy.yml"}
```yaml
name: Build ve Deploy
on:
  push:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
      - run: npm ci
      - run: npm test

  build:
    needs: test
    runs-on: ubuntu-latest
    permissions:
      contents: read
      packages: write
    steps:
      - uses: actions/checkout@v4
      - uses: docker/login-action@v3
        with:
          registry: ghcr.io
          username: ${{ github.actor }}
          password: ${{ secrets.GITHUB_TOKEN }}
      - uses: docker/build-push-action@v6
        with:
          push: true
          tags: ghcr.io/${{ github.repository }}:latest

  deploy:
    needs: build
    runs-on: ubuntu-latest
    steps:
      - uses: appleboy/ssh-action@v1
        with:
          host: ${{ secrets.SERVER_HOST }}
          username: deploy
          key: ${{ secrets.SSH_KEY }}
          script: |
            cd /opt/magaza
            docker compose pull
            docker compose up -d
            docker image prune -f
```
:::

**Secrets:** GitHub'da *Settings* > *Secrets and variables* > *Actions* bölümünden `SERVER_HOST`, `SSH_KEY` gibi gizli değerler eklenir.

## 11. Sunucu Hazırlığı (Üretim)

:::code{lang="bash"}
```bash
# 1. Güncelleme ve kullanıcı
sudo apt update && sudo apt upgrade -y
sudo adduser deploy && sudo usermod -aG sudo,docker deploy

# 2. SSH güvenliği (/etc/ssh/sshd_config)
#    PasswordAuthentication no
#    PermitRootLogin no
sudo systemctl restart ssh

# 3. Güvenlik duvarı
sudo ufw allow OpenSSH
sudo ufw allow 80,443/tcp
sudo ufw enable

# 4. Docker kurulumu
curl -fsSL https://get.docker.com | sudo sh
```
:::

### Ters Vekil (Reverse Proxy) ve HTTPS

Nginx veya **Caddy** ile gelen istekler konteynerlere yönlendirilir. Caddy, Let's Encrypt sertifikalarını otomatik alır:

:::code{lang="text" title="Caddyfile"}
```text
# Caddyfile
magazaniz.com {
    reverse_proxy web:80
}
api.magazaniz.com {
    reverse_proxy api:3000
}
```
:::

## 12. Altyapı Kod Olarak (IaC)

### Terraform

Bulut kaynaklarını (sunucu, DNS, veritabanı) kodla tanımlar.

:::code{lang="hcl"}
```hcl
resource "hcloud_server" "web" {
  name        = "magaza-web"
  image       = "ubuntu-24.04"
  server_type = "cx22"
  location    = "nbg1"
}
```
:::

:::code{lang="bash"}
```bash
terraform init     # Sağlayıcıları indir
terraform plan     # Yapılacak değişiklikleri gör
terraform apply    # Uygula
terraform destroy  # Kaldır
```
:::

### Ansible

Sunucu yapılandırmasını (paket kurulumu, dosya kopyalama) otomatikleştirir.

:::code{lang="yaml"}
```yaml
- hosts: web
  become: true
  tasks:
    - name: Docker kur
      apt:
        name: docker.io
        state: present
        update_cache: true
```
:::

## 13. Kubernetes'e Giriş

Çok sayıda konteyneri birden fazla sunucuda yöneten orkestrasyon sistemidir. Küçük projelerde Docker Compose genellikle yeterlidir; trafik ve ekip büyüdüğünde Kubernetes değerlendirilir.

| Kavram | Açıklama |
|---|---|
| Pod | En küçük birim, bir veya daha fazla konteyner |
| Deployment | Pod sayısı ve güncelleme yönetimi |
| Service | Pod'lara sabit ağ adresi |
| Ingress | Dış trafiği yönlendirme |
| ConfigMap / Secret | Yapılandırma ve gizli değerler |
| Namespace | Mantıksal ayrım |

:::code{lang="bash"}
```bash
kubectl get pods
kubectl apply -f deployment.yaml
kubectl logs -f <pod>
kubectl describe pod <pod>
kubectl scale deployment api --replicas=3
kubectl rollout undo deployment api
```
:::

## 14. İzleme ve Loglama

- **Prometheus:** Metrik toplar (CPU, bellek, istek sayısı).
- **Grafana:** Metrikleri panolarda görselleştirir.
- **Loki / ELK:** Logları merkezi olarak toplar ve aranabilir yapar.
- **Uptime Kuma:** Site erişilebilirliğini izler, kapanınca bildirim gönderir.
- **Sentry:** Uygulama hatalarını yakalar.

Basit başlangıç: Uptime Kuma'yı Compose'a eklemek.

:::code{lang="yaml"}
```yaml
  uptime:
    image: louislam/uptime-kuma:1
    ports: ["3001:3001"]
    volumes: ["uptime:/app/data"]
```
:::

## 15. Yedekleme

:::code{lang="bash"}
```bash
# PostgreSQL yedeği
docker compose exec -T db pg_dump -U app magaza > yedek_$(date +%F).sql

# Geri yükleme
docker compose exec -T db psql -U app magaza < yedek_2026-09-28.sql
```
:::

Cron ile günlük otomatik yedek:

:::code{lang="bash"}
```bash
0 3 * * * cd /opt/magaza && docker compose exec -T db pg_dump -U app magaza | gzip > /yedek/db_$(date +\%F).sql.gz
```
:::

**3-2-1 kuralı:** 3 kopya, 2 farklı ortam, 1 kopya sunucu dışında.

## 16. Güvenlik Kontrol Listesi

- Şifreler ve API anahtarları yalnızca `.env` veya secret yöneticisinde tutulur.
- SSH'ta şifreli giriş kapalı, yalnızca anahtar ile giriş.
- Yalnızca gerekli portlar açık (22, 80, 443).
- Veritabanı portu dışarıya açılmaz.
- İmajlar düzenli güncellenir ve taranır: `docker scout cves uygulamam:1.0` veya `trivy image uygulamam:1.0`.
- Konteynerler root olmayan kullanıcıyla çalışır.
- HTTPS zorunludur.
- Düzenli yedek alınır ve geri yükleme test edilir.

## 17. Sorun Giderme

| Sorun | Çözüm |
|---|---|
| Konteyner hemen kapanıyor | `docker logs <ad>` ile hatayı okuyun |
| Port kullanımda | `sudo lsof -i :80` ile süreci bulun veya başka port seçin |
| Konteynerler birbirini görmüyor | Aynı ağda olduklarını ve servis adını kullandığınızı kontrol edin |
| Disk doldu | `docker system df` ve `docker system prune` |
| Değişiklik yansımıyor | `docker compose up -d --build` ile yeniden derleyin |
| İzin hatası (volume) | Dosya sahipliğini ve `USER` ayarını kontrol edin |
| Permission denied (docker.sock) | Kullanıcıyı `docker` grubuna ekleyip yeniden giriş yapın |

## 18. Öğrenme Yol Haritası

1. **Hafta 1–2:** Linux komut satırı, Git.
2. **Hafta 3–4:** Docker, Dockerfile, Compose — kendi sitenizi konteynerleştirin.
3. **Hafta 5:** GitHub Actions ile otomatik test ve dağıtım.
4. **Hafta 6:** Bir VPS kiralayıp Caddy + Compose ile yayına alın.
5. **Hafta 7:** İzleme (Uptime Kuma, Grafana) ve yedekleme.
6. **Hafta 8+:** Terraform, Ansible, ardından Kubernetes.

## 19. Hızlı Başvuru Kartı

:::code{lang="bash"}
```bash
docker ps -a                     # Tüm konteynerler
docker logs -f <ad>              # Loglar
docker exec -it <ad> sh          # İçeri gir
docker compose up -d --build     # Derle ve başlat
docker compose down              # Durdur
docker system prune -a           # Temizlik
git add . && git commit -m "" && git push
kubectl get pods -A              # Tüm pod'lar
```
:::

:::realworld{company="Google"}
Google, konteyner fikrini Docker'dan çok önce iç altyapısında kullanmaya başladı. Şirketin 2015'te yayımladığı "Large-scale cluster management at Google with Borg" makalesi, uygulamaların Linux çekirdeğinin cgroup ve namespace özellikleriyle yalıtılmış görevler olarak binlerce makineye nasıl dağıtıldığını anlatır. Bu, derste gördüğünüz "konteyner çekirdeği paylaşır" fikrinin büyük ölçekli bir örneğidir. Google'ın açık kaynak "distroless" imajları ise bu dersteki en iyi uygulamalar listesinin doğrudan karşılığıdır. Bu imajlarda yalnızca uygulama ve çalışma zamanı bağımlılıkları bulunur: kabuk, paket yöneticisi ya da gereksiz araç yoktur. Projenin belgelerinde savunulan gerekçe ikilidir. Konteynerin içinde ne kadar az şey varsa saldırganın kullanabileceği yüzey o kadar küçük olur. Güvenlik tarayıcılarının raporları da hiç kullanılmayan paketlerdeki açıklarla dolmaz. Çok aşamalı derleme bu yaklaşımı mümkün kılar: derleme araçları ilk aşamada kalır, son imaja yalnızca çıktı kopyalanır.
:::

:::quiz{src="quiz.json"}
:::

:::next{lesson="h-06-cicd-temelleri-ve-ilk-workflow"}
:::

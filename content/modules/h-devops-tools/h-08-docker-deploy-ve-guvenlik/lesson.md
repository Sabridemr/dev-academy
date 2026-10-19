---
id: h-08-docker-deploy-ve-guvenlik
slug: docker-deploy-ve-guvenlik
module: h-devops-tools
order: 8
title:
  tr: "CI/CD ve GitHub Actions: Docker, Deploy, Rollback ve Güvenlik"
  en: "CI/CD and GitHub Actions: Docker, Deployment, Rollback and Security"
summary:
  tr: "Docker ile konteyner tabanlı CI/CD, deploy yöntemleri, environments ve onay kapıları, veritabanı migration'ları, deployment stratejileri, rollback, concurrency, reusable workflow ve composite action, runner türleri, güvenlik ve izinler."
  en: "Container-based CI/CD with Docker, deployment methods, environments and approval gates, database migrations, deployment strategies, rollback, concurrency, reusable workflows and composite actions, runner types, security and permissions."
durationMinutes: 12
level: intermediate
tags: [docker, deployment, github-actions, security, rollback]
prerequisites: []
concepts: [docker-image, environments, database-migrations, blue-green, canary, concurrency, reusable-workflow, least-privilege]
---

## Docker ve konteyner tabanlı CI/CD

**Docker**, uygulamanı tüm bağımlılıklarıyla birlikte tek bir paket (image) hâline getirir. Bu image her yerde aynı şekilde çalışır.

Node.js uygulaması için çok aşamalı (multi-stage) Dockerfile:

:::code{lang="dockerfile"}
```dockerfile
# 1. aşama: build
FROM node:22-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# 2. aşama: çalıştırma (küçük ve güvenli)
FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY package*.json ./
RUN npm ci --omit=dev
COPY --from=build /app/dist ./dist
USER node
EXPOSE 3000
HEALTHCHECK CMD wget -qO- http://localhost:3000/health || exit 1
CMD ["node", "dist/server.js"]
```
:::

Image'ı build edip **GitHub Container Registry (GHCR)**'ye gönderme:

:::code{lang="yaml"}
```yaml
jobs:
  docker:
    runs-on: ubuntu-latest
    permissions:
      contents: read
      packages: write
    steps:
      - uses: actions/checkout@v7

      - uses: docker/setup-buildx-action@v3

      - uses: docker/login-action@v3
        with:
          registry: ghcr.io
          username: ${{ github.actor }}
          password: ${{ secrets.GITHUB_TOKEN }}

      - uses: docker/build-push-action@v7
        with:
          context: .
          push: true
          tags: |
            ghcr.io/${{ github.repository }}:latest
            ghcr.io/${{ github.repository }}:${{ github.sha }}
          cache-from: type=gha
          cache-to: type=gha,mode=max
```
:::

Etiketleme kuralı: `latest` tek başına kullanılmaz. Her image commit SHA'sı veya sürüm numarasıyla (`v1.4.2`) etiketlenir. Böylece hangi kodun canlıda olduğunu bilir ve eski sürüme kolayca dönersin.

`.dockerignore` dosyası mutlaka eklenmeli:

:::code{lang="text"}
```text
node_modules
.git
.env
*.md
coverage
```
:::

## Deploy yöntemleri

Projenin büyüklüğüne göre farklı deploy hedefleri seçilebilir:

| Yöntem | Uygun olduğu durum | Zorluk |
|---|---|---|
| Vercel / Netlify | Statik site, Next.js frontend | Çok kolay |
| Render / Railway / Fly.io | Node.js API + PostgreSQL | Kolay |
| VPS + SSH + Docker | Tam kontrol, düşük maliyet (Hetzner, DigitalOcean) | Orta |
| AWS / GCP / Azure | Büyük ölçek, yönetilen servisler | Zor |
| Kubernetes | Çok servisli, yüksek trafik | Çok zor |

### VPS'e SSH ile Docker deploy

:::code{lang="yaml"}
```yaml
  deploy:
    needs: docker
    runs-on: ubuntu-latest
    environment:
      name: production
      url: https://www.magaza.com
    steps:
      - name: Sunucuya bağlan ve güncelle
        uses: appleboy/ssh-action@v1
        with:
          host: ${{ secrets.SSH_HOST }}
          username: ${{ secrets.SSH_USER }}
          key: ${{ secrets.SSH_PRIVATE_KEY }}
          script: |
            cd /opt/magaza
            export IMAGE_TAG=${{ github.sha }}
            docker compose pull
            docker compose run --rm api npm run db:migrate
            docker compose up -d
            docker image prune -f

      - name: Smoke test
        run: |
          sleep 10
          curl --fail --retry 5 --retry-delay 5 https://www.magaza.com/health
```
:::

Sunucudaki `docker-compose.yml`:

:::code{lang="yaml"}
```yaml
services:
  api:
    image: ghcr.io/kullanici/magaza:${IMAGE_TAG}
    restart: unless-stopped
    env_file: .env
    ports:
      - "3000:3000"
    depends_on:
      - db
  db:
    image: postgres:17
    restart: unless-stopped
    volumes:
      - pgdata:/var/lib/postgresql/data
    env_file: .env.db
volumes:
  pgdata:
```
:::

SSH güvenliği için: sadece deploy'a özel bir kullanıcı ve anahtar oluştur, parola ile girişi kapat ve bu kullanıcıya sadece gerekli yetkileri ver.

### Platform hook ile deploy (Render örneği)

:::code{lang="yaml"}
```yaml
- name: Render deploy
  run: curl -fsS -X POST "${{ secrets.RENDER_DEPLOY_HOOK_URL }}"
```
:::

## Environments ve onay kapıları

GitHub'da **Settings → Environments** bölümünden `staging` ve `production` ortamları oluşturulur.

Production için ayarlanabilecekler:

- **Required reviewers:** Deploy başlamadan önce belirli kişilerin onayı gerekir.
- **Wait timer:** Onaydan sonra belirli süre bekleme.
- **Deployment branches:** Sadece `main` dalından deploy yapılabilir.
- **Environment secrets:** Sadece bu ortama ait gizli anahtarlar.

:::code{lang="yaml"}
```yaml
jobs:
  deploy-staging:
    environment: staging
    runs-on: ubuntu-latest
    steps:
      - run: echo "Staging'e deploy"

  deploy-production:
    needs: deploy-staging
    environment:
      name: production
      url: https://www.magaza.com
    runs-on: ubuntu-latest
    steps:
      - run: echo "Canlıya deploy"
```
:::

Workflow `deploy-production` job'una geldiğinde durur ve onay bekler. Onaylayan kişi, tarih ve deploy edilen commit GitHub'da kayıt altına alınır. Bu, Continuous Delivery'nin GitHub Actions'taki karşılığıdır.

## Veritabanı migration'ları

Kodla birlikte veritabanı şemasını da güvenle değiştirmek CI/CD'nin en kritik kısımlarındandır.

**Migration**, veritabanı değişikliklerinin sıralı ve versiyonlu dosyalar hâlinde tutulmasıdır:

:::code{lang="text"}
```text
migrations/
  001_create_users.sql
  002_create_products.sql
  003_add_dealer_price.sql
```
:::

Araçlar: Prisma Migrate, Knex, node-pg-migrate, Drizzle, Flyway.

Kurallar:

- Migration'lar deploy sırasında otomatik ve uygulama başlamadan önce çalışır.
- Canlıdaki veritabanını asla elle değiştirme; her değişiklik migration dosyasıyla yapılır.
- Deploy öncesi mutlaka yedek al.
- **Geriye uyumlu değişiklik (expand-contract) yap:**

:::code{lang="text"}
```text
Yanlış: Tek deploy'da "price" sütununu "price_cents" olarak yeniden adlandırmak
        → eski kod çalışırken sütun kaybolur, site çöker.

Doğru:
1. deploy: price_cents sütununu ekle, kod ikisine de yazsın   (expand)
2. deploy: veriyi taşı, kod sadece price_cents okusun
3. deploy: eski price sütununu sil                            (contract)
```
:::

Büyük tablolarda kilitlenmeye dikkat: PostgreSQL'de index eklerken `CREATE INDEX CONCURRENTLY` kullan.

## Deployment stratejileri

| Strateji | Nasıl çalışır? | Avantaj | Dezavantaj |
|---|---|---|---|
| Recreate | Eskiyi durdur, yeniyi başlat | Basit | Kısa kesinti olur |
| Rolling | Sunucular sırayla güncellenir | Kesintisiz | Bir süre iki sürüm aynı anda çalışır |
| Blue-Green | İki ortam vardır; trafik tek seferde yeniye geçer | Anında geri dönüş | İki kat kaynak gerekir |
| Canary | Trafiğin küçük bir kısmı (%5) yeni sürüme gider | Risk en aza iner | İzleme ve trafik yönetimi gerekir |
| Feature flag | Kod canlıdadır ama özellik kapalıdır | Deploy ile yayın ayrılır | Bayrak yönetimi gerekir |

:::diagram{src="sekil-01.png" alt="Blue-Green yapısı: Kullanıcılar load balancer üzerinden Blue (v1.4, şu an canlı) ortamına gider; Green (v1.5) test ediliyor"}
:::

Blue-Green'de yeni sürüm (Green) hazırlanır ve test edilir. Hazır olunca load balancer trafiği Green'e çevirir. Sorun olursa trafik tekrar Blue'ya döner.

**Feature flag örneği:** Yeni "toplu sipariş" özelliğini canlıya çıkarırsın ama sadece seçili bayilere açarsın. Sorun çıkarsa deploy yapmadan özelliği kapatırsın.

:::code{lang="javascript"}
```javascript
if (flags.isEnabled('bulk-order', user)) {
  showBulkOrderButton();
}
```
:::

## Rollback (geri alma)

Her deploy stratejisinin bir geri alma planı olmalıdır.

Yöntemler:

- **Önceki image'a dön:** Image'lar commit SHA'sı ile etiketlendiyse önceki etiketle yeniden başlatmak yeterlidir.
- **Git revert:** Hatalı commit'i geri alan yeni bir commit oluştur; pipeline yeniden çalışır.
- **Platform rollback:** Vercel, Render gibi platformlarda önceki deploy'a tek tıkla dönülür.
- **Feature flag'i kapat:** En hızlı yöntemdir.

Elle tetiklenen rollback workflow'u:

:::code{lang="yaml"}
```yaml
name: Rollback

on:
  workflow_dispatch:
    inputs:
      tag:
        description: 'Dönülecek image etiketi (commit SHA)'
        required: true

jobs:
  rollback:
    runs-on: ubuntu-latest
    environment: production
    steps:
      - uses: appleboy/ssh-action@v1
        with:
          host: ${{ secrets.SSH_HOST }}
          username: ${{ secrets.SSH_USER }}
          key: ${{ secrets.SSH_PRIVATE_KEY }}
          script: |
            cd /opt/magaza
            export IMAGE_TAG=${{ inputs.tag }}
            docker compose pull api
            docker compose up -d api
```
:::

Dikkat: Veritabanı migration'ları kod kadar kolay geri alınmaz. Bu yüzden migration'ları geriye uyumlu yazmak, rollback'i güvenli hâle getirir.

## Concurrency

Aynı anda iki deploy'un çalışması felakete yol açabilir. `concurrency` bunu engeller:

:::code{lang="yaml"}
```yaml
concurrency:
  group: deploy-production
  cancel-in-progress: false    # devam eden deploy'u iptal etme, sırada beklet
```
:::

PR'larda ise eski çalıştırmaları iptal etmek dakika tasarrufu sağlar:

:::code{lang="yaml"}
```yaml
concurrency:
  group: ci-${{ github.ref }}
  cancel-in-progress: true
```
:::

Aynı PR'a art arda üç push yapılırsa sadece en sonuncusu test edilir.

## Reusable workflows ve composite actions

Aynı adımları birçok workflow'da tekrar yazmamak için iki yöntem vardır.

### Reusable workflow

`.github/workflows/deploy-template.yml`:

:::code{lang="yaml"}
```yaml
name: Deploy şablonu

on:
  workflow_call:
    inputs:
      environment:
        type: string
        required: true
    secrets:
      SSH_PRIVATE_KEY:
        required: true

jobs:
  deploy:
    runs-on: ubuntu-latest
    environment: ${{ inputs.environment }}
    steps:
      - run: echo "${{ inputs.environment }} ortamına deploy"
```
:::

Çağırma:

:::code{lang="yaml"}
```yaml
jobs:
  staging:
    uses: ./.github/workflows/deploy-template.yml
    with:
      environment: staging
    secrets: inherit
```
:::

### Composite action

`.github/actions/setup-project/action.yml`:

:::code{lang="yaml"}
```yaml
name: Proje kurulumu
description: Node kur ve bağımlılıkları yükle
runs:
  using: composite
  steps:
    - uses: actions/setup-node@v7
      with: { node-version: 22, cache: npm }
    - run: npm ci
      shell: bash
```
:::

Kullanım:

:::code{lang="yaml"}
```yaml
steps:
  - uses: actions/checkout@v7
  - uses: ./.github/actions/setup-project
  - run: npm test
```
:::

|  | Reusable workflow | Composite action |
|---|---|---|
| Seviye | Job'ların tamamı | Step grubu |
| Secrets | Alabilir | Doğrudan alamaz (input olarak verilir) |
| Kullanım | Deploy şablonu | Kurulum adımları |

## Runner türleri

| Tür | Açıklama | Ne zaman? |
|---|---|---|
| GitHub-hosted | GitHub'ın sanal makineleri: `ubuntu-latest`, `windows-latest`, `macos-latest` | Çoğu proje |
| Larger runners | Daha fazla CPU/RAM, ücretli | Ağır build'ler |
| Self-hosted | Kendi sunucunda çalışan runner | Özel ağ erişimi, özel donanım, maliyet |

Self-hosted runner'ı **herkese açık depolarda kullanma**: Fork'tan gelen bir PR, senin sunucunda kod çalıştırabilir.

Linux runner'lar en hızlı ve en ucuz seçenektir. Özel depolarda macOS ve Windows dakikaları Linux'a göre daha yüksek ücretlendirilir.

## Güvenlik ve izinler

### GITHUB_TOKEN izinlerini kısıtla

:::code{lang="yaml"}
```yaml
permissions:
  contents: read           # varsayılan olarak sadece okuma

jobs:
  docker:
    permissions:
      contents: read
      packages: write      # sadece bu job paket yazabilir
```
:::

**En az yetki ilkesi:** Her job sadece ihtiyacı olan izne sahip olmalıdır.

### Üçüncü taraf action'ları sabitle

:::code{lang="yaml"}
```yaml
# Riskli: etiket sonradan değiştirilebilir
- uses: birisi/bir-action@v1

# Güvenli: belirli commit'e sabitlenmiş
- uses: birisi/bir-action@8f4b7f84864484a7bf31766abe9204da3cbe65b3 # v1.2.0
```
:::

Resmî `actions/*` ve büyük kuruluşların action'ları dışındakileri commit SHA ile sabitlemek, tedarik zinciri saldırılarına karşı önemli bir korumadır.

### pull_request_target tehlikesi

`pull_request_target`, fork'tan gelen PR'da bile secret'lara erişimle çalışır. Bu tetikleyicide PR'daki kodu checkout edip çalıştırmak, saldırganın secret'larını çalmasına yol açabilir. Emin değilsen `pull_request` kullan.

### Script injection

:::code{lang="yaml"}
```yaml
# Tehlikeli: PR başlığı komut olarak çalışabilir
- run: echo "${{ github.event.pull_request.title }}"

# Güvenli: önce ortam değişkenine al
- run: echo "$TITLE"
  env:
    TITLE: ${{ github.event.pull_request.title }}
```
:::

### OIDC ile parolasız bulut erişimi

AWS, GCP veya Azure'a deploy ederken uzun ömürlü erişim anahtarlarını secret olarak saklamak yerine **OIDC** kullanılır. GitHub, her çalıştırma için kısa ömürlü bir kimlik token'ı üretir; bulut sağlayıcı bu token'ı doğrulayıp geçici yetki verir.

:::code{lang="yaml"}
```yaml
permissions:
  id-token: write
  contents: read
```
:::

## Orijinal PDF sayfaları

:::callout{tone="info" title="Özgün görünüm"}
Bu dersin metni *CICD GitHub Actions Rehberi* PDF dosyasının 15–23. sayfalarının özgün hâlidir; sayfalar aşağıda PDF'teki görünümüyle yer alır.
:::

:::diagram{src="pdf-sayfa-15.png" alt="CICD GitHub Actions Rehberi - PDF sayfa 15"}
PDF sayfa 15 / 33
:::

:::diagram{src="pdf-sayfa-16.png" alt="CICD GitHub Actions Rehberi - PDF sayfa 16"}
PDF sayfa 16 / 33
:::

:::diagram{src="pdf-sayfa-17.png" alt="CICD GitHub Actions Rehberi - PDF sayfa 17"}
PDF sayfa 17 / 33
:::

:::diagram{src="pdf-sayfa-18.png" alt="CICD GitHub Actions Rehberi - PDF sayfa 18"}
PDF sayfa 18 / 33
:::

:::diagram{src="pdf-sayfa-19.png" alt="CICD GitHub Actions Rehberi - PDF sayfa 19"}
PDF sayfa 19 / 33
:::

:::diagram{src="pdf-sayfa-20.png" alt="CICD GitHub Actions Rehberi - PDF sayfa 20"}
PDF sayfa 20 / 33
:::

:::diagram{src="pdf-sayfa-21.png" alt="CICD GitHub Actions Rehberi - PDF sayfa 21"}
PDF sayfa 21 / 33
:::

:::diagram{src="pdf-sayfa-22.png" alt="CICD GitHub Actions Rehberi - PDF sayfa 22"}
PDF sayfa 22 / 33
:::

:::diagram{src="pdf-sayfa-23.png" alt="CICD GitHub Actions Rehberi - PDF sayfa 23"}
PDF sayfa 23 / 33
:::

:::next{lesson="h-09-kalite-izleme-ve-tam-pipeline"}
:::

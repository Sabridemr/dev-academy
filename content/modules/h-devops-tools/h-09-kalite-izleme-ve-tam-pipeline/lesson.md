---
id: h-09-kalite-izleme-ve-tam-pipeline
slug: kalite-izleme-ve-tam-pipeline
module: h-devops-tools
order: 9
title:
  tr: "CI/CD ve GitHub Actions: Kod Kalitesi, Sürümleme, İzleme ve Tam Pipeline"
  en: "CI/CD and GitHub Actions: Code Quality, Versioning, Monitoring and the Full Pipeline"
summary:
  tr: "Güvenlik taraması, SemVer sürümleme ve izlemeyle projen için uçtan uca bir CI/CD pipeline'ı kur."
  en: "Build an end-to-end CI/CD pipeline with security scanning, SemVer releases and monitoring."
durationMinutes: 20
level: intermediate
tags: [ci-cd, github-actions, monitoring, release, devops]
prerequisites: [h-08-docker-deploy-ve-guvenlik, a-13-observability-12-factor]
concepts: [dependabot, codeql, semantic-versioning, health-check, dora-metrics, gitops, full-pipeline]
---

## Kod kalitesi ve güvenlik taraması

### Dependabot

`.github/dependabot.yml`:

:::code{lang="yaml"}
```yaml
version: 2
updates:
  - package-ecosystem: npm
    directory: /
    schedule:
      interval: weekly
    open-pull-requests-limit: 5

  - package-ecosystem: github-actions
    directory: /
    schedule:
      interval: monthly

  - package-ecosystem: docker
    directory: /
    schedule:
      interval: monthly
```
:::

Dependabot, güncel olmayan veya güvenlik açığı olan bağımlılıklar için otomatik PR açar. CI bu PR'ları test eder; geçerse güvenle birleştirirsin.

### CodeQL

GitHub'ın statik kod analizi aracıdır. SQL injection, XSS ve benzeri açıkları tarar. **Security → Code scanning** bölümünden birkaç tıkla açılabilir.

### Diğer kontroller

- `npm audit --audit-level=high`: Bilinen açıkları olan paketleri bulur.
- **Secret scanning:** Koda yanlışlıkla eklenen API anahtarlarını tespit eder.
- **Trivy:** Docker image'larındaki açıkları tarar.
- **Lighthouse CI:** Web sitesinin performans, erişilebilirlik ve SEO puanını ölçer.

:::code{lang="yaml"}
```yaml
  security:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v7
      - uses: actions/setup-node@v7
        with: { node-version: 22 }
      - run: npm ci
      - run: npm audit --audit-level=high
```
:::

## Sürümleme ve release

**Semantic Versioning (SemVer):** `MAJOR.MINOR.PATCH`

| Değişiklik | Örnek | Sürüm |
|---|---|---|
| Hata düzeltme | Stok hesabı düzeltildi | 1.4.2 → 1.4.3 |
| Yeni özellik (geriye uyumlu) | Google ile giriş eklendi | 1.4.3 → 1.5.0 |
| Kırıcı değişiklik | API fiyat formatı değişti | 1.5.0 → 2.0.0 |

Etiket ile release workflow'u:

:::code{lang="yaml"}
```yaml
name: Release

on:
  push:
    tags: ['v*.*.*']

permissions:
  contents: write

jobs:
  release:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v7
      - name: GitHub Release oluştur
        run: gh release create "$GITHUB_REF_NAME" --generate-notes
        env:
          GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```
:::

:::code{lang="bash"}
```bash
git tag v1.5.0
git push origin v1.5.0
```
:::

`release-please` veya `semantic-release` araçları, Conventional Commits mesajlarından sürüm numarasını ve değişiklik notlarını otomatik üretir.

## İzleme ve bildirimler

Deploy bitti diye iş bitmez; canlıda ne olduğunu görmek gerekir.

- **Health check endpoint:** `/health` adresi uygulama ve veritabanı çalışıyorsa `200` döner.
- **Hata takibi:** Sentry, canlıdaki hataları ve hangi sürümde başladığını gösterir.
- **Uptime izleme:** UptimeRobot, Better Stack gibi araçlar site kapanınca haber verir.
- **Log ve metrik:** Grafana, Datadog, Logtail.

:::code{lang="javascript"}
```javascript
app.get('/health', async (req, res) => {
  try {
    await db.query('SELECT 1');
    res.json({ status: 'ok', version: process.env.APP_VERSION });
  } catch {
    res.status(503).json({ status: 'db_unreachable' });
  }
});
```
:::

Başarısız deploy için Slack bildirimi:

:::code{lang="yaml"}
```yaml
- name: Slack bildirimi
  if: failure()
  run: |
    curl -X POST -H 'Content-type: application/json' \
      --data '{"text":"Deploy başarısız: ${{ github.repository }} @ ${{ github.sha }}"}' \
      "${{ secrets.SLACK_WEBHOOK_URL }}"
```
:::

### DORA metrikleri

Bir ekibin CI/CD olgunluğunu ölçen dört temel metrik:

| Metrik | Anlamı |
|---|---|
| Deployment frequency | Ne sıklıkla canlıya çıkıyorsun? |
| Lead time for changes | Commit'ten canlıya geçen süre |
| Change failure rate | Deploy'ların yüzde kaçı sorun çıkarıyor? |
| Time to restore | Sorun olunca ne kadar sürede düzeliyor? |

## Hata ayıklama ve sık sorunlar

| Sorun | Olası neden | Çözüm |
|---|---|---|
| Workflow hiç çalışmıyor | Dosya yanlış klasörde veya YAML hatası | `.github/workflows/` yolunu ve girintiyi kontrol et |
| `npm ci` hatası | `package-lock.json` yok veya uyumsuz | Lock dosyasını commit et |
| Localde geçiyor, CI'da başarısız | Node sürümü, saat dilimi, ortam değişkeni farkı | Aynı sürümü kullan, `.nvmrc` ekle |
| Veritabanına bağlanamıyor | Servis henüz hazır değil | `health-cmd` ekle |
| Secret boş geliyor | Fork PR'ı veya yanlış environment | Secret seviyesini ve ortamı kontrol et |
| Permission denied (403) | GITHUB_TOKEN izni yetersiz | `permissions` bloğuna gerekli izni ekle |
| Testler bazen geçiyor bazen kalıyor (flaky) | Zamanlama, sıra bağımlılığı | Testleri bağımsız yap, sabit bekleme yerine koşul bekle |

Hata ayıklama ipuçları:

- Başarısız job'da **Re-run jobs → Enable debug logging** seçeneği ayrıntılı log verir.
- `ACTIONS_STEP_DEBUG` değişkenini `true` yaparak kalıcı debug açılır.
- **act** aracı ile workflow'ları kendi bilgisayarında Docker üzerinde çalıştırabilirsin.
- `timeout-minutes` ile takılan job'ların dakika harcamasını engelle:

:::code{lang="yaml"}
```yaml
jobs:
  test:
    runs-on: ubuntu-latest
    timeout-minutes: 15
```
:::

## Maliyet ve limitler

- Herkese açık depolarda standart GitHub-hosted runner'lar ücretsizdir.
- Özel depolarda planına göre aylık ücretsiz dakika ve depolama kotası vardır; aşılırsa ücretlendirilir. Güncel kotaları GitHub'ın faturalama sayfasından kontrol et.
- Dakika tasarrufu için: cache kullan, `paths` filtresi ekle, `concurrency` ile eski çalıştırmaları iptal et, `timeout-minutes` koy, ağır E2E testlerini sadece `main` veya gece çalıştır.
- Artifact saklama süresini kısalt (`retention-days`).

## Diğer CI/CD araçları

| Araç | Özellik |
|---|---|
| GitHub Actions | GitHub ile yerleşik, geniş Marketplace |
| GitLab CI/CD | GitLab'a yerleşik, `.gitlab-ci.yml` |
| Jenkins | Açık kaynak, kendi sunucunda, çok esnek ama bakım ister |
| CircleCI | Hızlı, güçlü önbellek |
| Azure DevOps | Microsoft ekosistemi |
| Bitbucket Pipelines | Atlassian (Jira) ekosistemi |
| Argo CD / Flux | Kubernetes için GitOps |

**GitOps**, canlı ortamın istenen durumunun Git deposunda tanımlanması ve bir aracın (Argo CD) ortamı sürekli bu tanıma eşitlemesidir. Deploy, bir YAML dosyasını değiştirip birleştirmekle yapılır.

GitLab CI'da aynı mantık:

:::code{lang="yaml"}
```yaml
stages: [test, build, deploy]

test:
  stage: test
  image: node:22
  script:
    - npm ci
    - npm test
```
:::

## Projen için tam pipeline

Toptan gıda e-ticaret siten (Node.js + PostgreSQL) için önerilen yapı:

:::diagram{src="sekil-01.png" alt="Proje pipeline akışı: PR açıldı, Lint + Unit, Entegrasyon (PostgreSQL), Güvenlik (npm audit), Birleştirme (review); ardından main'e merge, Docker build (GHCR + SHA), Staging (migrate + smoke), Onay, Production (migrate + smoke)|Project pipeline flow: PR opened, Lint + Unit, Integration (PostgreSQL), Security (npm audit), Merge (review); then merge to main, Docker build (GHCR + SHA), Staging (migrate + smoke), Approval, Production (migrate + smoke)"}
:::

Dosya yapısı:

:::code{lang="text"}
```text
.github/
├── dependabot.yml
├── actions/
│   └── setup-project/action.yml
└── workflows/
    ├── ci.yml            # PR ve push: lint, test, entegrasyon
    ├── deploy.yml        # main: docker, staging, production
    ├── rollback.yml      # elle: önceki sürüme dön
    └── nightly.yml       # gece: E2E testleri, yedekleme kontrolü
```
:::

`.github/workflows/ci.yml`:

:::code{lang="yaml"}
```yaml
name: CI

on:
  pull_request:
  push:
    branches: [main]

concurrency:
  group: ci-${{ github.ref }}
  cancel-in-progress: true

permissions:
  contents: read

jobs:
  lint-unit:
    runs-on: ubuntu-latest
    timeout-minutes: 10
    steps:
      - uses: actions/checkout@v7
      - uses: actions/setup-node@v7
        with: { node-version: 22, cache: npm }
      - run: npm ci
      - run: npm run lint
      - run: npm run test:unit -- --coverage

  integration:
    runs-on: ubuntu-latest
    timeout-minutes: 15
    services:
      postgres:
        image: postgres:17
        env:
          POSTGRES_USER: test
          POSTGRES_PASSWORD: test
          POSTGRES_DB: magaza_test
        ports: ['5432:5432']
        options: >-
          --health-cmd "pg_isready -U test"
          --health-interval 5s --health-timeout 5s --health-retries 10
    env:
      DATABASE_URL: postgresql://test:test@localhost:5432/magaza_test
      JWT_SECRET: ci-test-secret
    steps:
      - uses: actions/checkout@v7
      - uses: actions/setup-node@v7
        with: { node-version: 22, cache: npm }
      - run: npm ci
      - run: npm run db:migrate
      - run: npm run test:integration

  security:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v7
      - uses: actions/setup-node@v7
        with: { node-version: 22, cache: npm }
      - run: npm ci
      - run: npm audit --audit-level=high
```
:::

`.github/workflows/deploy.yml`:

:::code{lang="yaml"}
```yaml
name: Deploy

on:
  push:
    branches: [main]
  workflow_dispatch:

concurrency:
  group: deploy
  cancel-in-progress: false

permissions:
  contents: read
  packages: write

env:
  IMAGE: ghcr.io/${{ github.repository }}

jobs:
  ci:
    uses: ./.github/workflows/ci.yml

  image:
    needs: ci
    runs-on: ubuntu-latest
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
          push: true
          tags: ${{ env.IMAGE }}:${{ github.sha }}
          build-args: APP_VERSION=${{ github.sha }}
          cache-from: type=gha
          cache-to: type=gha,mode=max

  staging:
    needs: image
    runs-on: ubuntu-latest
    environment:
      name: staging
      url: https://staging.magaza.com
    steps:
      - uses: appleboy/ssh-action@v1
        with:
          host: ${{ secrets.SSH_HOST }}
          username: ${{ secrets.SSH_USER }}
          key: ${{ secrets.SSH_PRIVATE_KEY }}
          script: |
            cd /opt/magaza
            export IMAGE_TAG=${{ github.sha }}
            docker compose pull api
            docker compose run --rm api npm run db:migrate
            docker compose up -d api
      - run: curl --fail --retry 6 --retry-delay 5 https://staging.magaza.com/health

  production:
    needs: staging
    runs-on: ubuntu-latest
    environment:
      name: production
      url: https://www.magaza.com
    steps:
      - uses: appleboy/ssh-action@v1
        with:
          host: ${{ secrets.SSH_HOST }}
          username: ${{ secrets.SSH_USER }}
          key: ${{ secrets.SSH_PRIVATE_KEY }}
          script: |
            cd /opt/magaza
            ./backup-db.sh
            export IMAGE_TAG=${{ github.sha }}
            docker compose pull api
            docker compose run --rm api npm run db:migrate
            docker compose up -d api
      - run: curl --fail --retry 6 --retry-delay 5 https://www.magaza.com/health

      - name: Hata bildirimi
        if: failure()
        run: |
          curl -X POST -H 'Content-type: application/json' \
            --data '{"text":"Canlı deploy başarısız: ${{ github.sha }}"}' \
            "${{ secrets.SLACK_WEBHOOK_URL }}"
```
:::

Not: Reusable workflow olarak çağrılabilmesi için `ci.yml` dosyasının `on:` bölümüne `workflow_call:` de eklenmelidir.

Kurulum kontrol listesi:

1. `package.json` içinde `lint`, `test:unit`, `test:integration`, `db:migrate`, `build` komutlarını tanımla.
2. `Dockerfile`, `.dockerignore` ve `/health` endpoint'ini ekle.
3. GitHub'da `staging` ve `production` environment'larını oluştur; production'a onaylayıcı ekle.
4. Secrets ekle: `SSH_HOST`, `SSH_USER`, `SSH_PRIVATE_KEY`, `SLACK_WEBHOOK_URL`. Sunucudaki `.env` dosyasına `DATABASE_URL`, `JWT_SECRET`, ödeme anahtarlarını koy.
5. `main` için branch protection kurallarını aç ve CI kontrollerini zorunlu yap.
6. Dependabot'u ve CodeQL'i etkinleştir.
7. İlk deploy'dan önce rollback workflow'unu staging'de dene.

## Dene: tam pipeline

:::interactive{type="pipeline" stages=8 failureStage=0 retries=1}
Lint, test, güvenlik taraması, paketleme, staging ve canlı aşamalarını içeren tam pipeline'ı çalıştır; bir aşamayı bozup hangi noktada durduğunu izle.
:::

:::callout{tone="info" title="İlgili dersler"}
Bu konuyu başka bir açıdan anlatan dersler:

- [Observability ve 12-Factor App](/lessons/a-13-observability-12-factor)
:::

:::quiz{src="quiz.json"}
:::

:::next{lesson="h-10-mulakat-soru-cevap-ve-ozet"}
:::

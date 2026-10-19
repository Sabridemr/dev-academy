---
id: h-07-tetikleyiciler-secrets-cache-ve-testler
slug: tetikleyiciler-secrets-cache-ve-testler
module: h-devops-tools
order: 7
title:
  tr: "CI/CD ve GitHub Actions: Tetikleyiciler, İfadeler, Secrets, Matrix, Cache ve Testler"
  en: "CI/CD and GitHub Actions: Triggers, Expressions, Secrets, Matrix, Cache and Tests"
summary:
  tr: "Workflow tetikleyicileri, job bağımlılıkları, koşullar ve context'ler, ortam değişkenleri ve çıktılar, secrets ve variables, matrix, cache, artifact, PostgreSQL ile entegrasyon testi ve test piramidi."
  en: "Workflow triggers, job dependencies, conditions and contexts, environment variables and outputs, secrets and variables, matrix, cache, artifacts, integration testing with PostgreSQL and the test pyramid."
durationMinutes: 11
level: intermediate
tags: [github-actions, secrets, cache, testing, postgresql]
prerequisites: []
concepts: [events, needs, expressions, contexts, secrets, matrix-strategy, artifacts, service-containers]
---

## Tetikleyiciler (events)

:::code{lang="yaml"}
```yaml
on:
  push:
    branches: [main, 'release/**']
    paths:
      - 'src/**'
      - 'package.json'
    paths-ignore:
      - '**.md'
    tags: ['v*']

  pull_request:
    types: [opened, synchronize, reopened]

  schedule:
    - cron: '0 3 * * *'      # her gün 03:00 UTC

  workflow_dispatch:         # Actions sekmesinden elle başlatma
    inputs:
      environment:
        description: 'Hedef ortam'
        type: choice
        options: [staging, production]
        default: staging

  release:
    types: [published]

  workflow_run:
    workflows: [CI]
    types: [completed]
```
:::

| Tetikleyici | Kullanım |
|---|---|
| `push` | Dala kod gönderildiğinde |
| `pull_request` | PR açıldığında veya güncellendiğinde |
| `schedule` | Zamanlanmış işler: gece testleri, yedekleme, bağımlılık kontrolü |
| `workflow_dispatch` | Elle başlatma; deploy veya bakım işleri için ideal |
| `release` | GitHub'da sürüm yayınlandığında |
| `workflow_run` | Başka bir workflow bittiğinde |
| `paths` | Sadece belirli dosyalar değişince çalıştırma |

`schedule` saatleri **UTC** cinsindendir. İstanbul UTC+3 olduğu için `0 3 * * *` İstanbul saatiyle 06:00'dır.

## Job'lar arası bağımlılık

Job'lar varsayılan olarak paralel çalışır. Sıra gerekiyorsa `needs` kullanılır:

:::code{lang="yaml"}
```yaml
jobs:
  lint:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v7
      - run: npm ci && npm run lint

  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v7
      - run: npm ci && npm test

  build:
    needs: [lint, test]      # ikisi de başarılı olursa çalışır
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v7
      - run: npm ci && npm run build

  deploy:
    needs: build
    if: github.ref == 'refs/heads/main'
    runs-on: ubuntu-latest
    steps:
      - run: echo "Deploy"
```
:::

:::diagram{src="sekil-01.png" alt="Job bağımlılığı: lint ve test paralel çalışır, ikisi build adımına bağlanır, build ardından deploy gelir"}
:::

`lint` ve `test` aynı anda çalışır, ikisi bitince `build`, sonra `deploy` çalışır.

## Koşullar, ifadeler ve context'ler

`${{ }}` içinde ifade (expression) yazılır.

:::code{lang="yaml"}
```yaml
steps:
  - name: Sadece main'de
    if: github.ref == 'refs/heads/main'
    run: echo "main dalı"

  - name: Sadece PR'da
    if: github.event_name == 'pull_request'
    run: echo "PR"

  - name: Önceki adım başarısız olsa da çalış
    if: always()
    run: echo "Rapor yükle"

  - name: Sadece hata olursa
    if: failure()
    run: echo "Bildirim gönder"
```
:::

Sık kullanılan context'ler:

| Context | Örnek | Anlamı |
|---|---|---|
| `github` | `github.sha`, `github.ref_name`, `github.actor` | Commit, dal, tetikleyen kişi |
| `env` | `env.NODE_ENV` | Ortam değişkenleri |
| `secrets` | `secrets.DATABASE_URL` | Gizli değerler |
| `vars` | `vars.API_URL` | Gizli olmayan yapılandırma değişkenleri |
| `matrix` | `matrix.node` | Matrix değerleri |
| `needs` | `needs.build.outputs.version` | Önceki job'un çıktıları |
| `inputs` | `inputs.environment` | Elle başlatmadaki girdiler |

Durum fonksiyonları: `success()` (varsayılan), `failure()`, `always()`, `cancelled()`.

## Ortam değişkenleri ve çıktılar

:::code{lang="yaml"}
```yaml
env:                         # tüm workflow için
  NODE_ENV: test

jobs:
  build:
    runs-on: ubuntu-latest
    env:                     # sadece bu job için
      API_URL: https://staging-api.magaza.com
    outputs:
      version: ${{ steps.ver.outputs.version }}
    steps:
      - id: ver
        run: echo "version=$(date +%Y%m%d)-${GITHUB_SHA::7}" >> "$GITHUB_OUTPUT"

      - name: Sonraki adımlar için değişken
        run: echo "BUILD_TIME=$(date)" >> "$GITHUB_ENV"

      - run: echo "Sürüm ${{ steps.ver.outputs.version }}, zaman $BUILD_TIME"

  deploy:
    needs: build
    runs-on: ubuntu-latest
    steps:
      - run: echo "Yayınlanan sürüm ${{ needs.build.outputs.version }}"
```
:::

- `$GITHUB_OUTPUT`: Bir adımın çıktısını tanımlar; diğer adımlar ve job'lar okuyabilir.
- `$GITHUB_ENV`: Aynı job'daki sonraki adımlar için ortam değişkeni tanımlar.
- `$GITHUB_STEP_SUMMARY`: Actions sayfasında Markdown özet gösterir.

:::code{lang="yaml"}
```yaml
- run: |
    echo "## Test Sonucu" >> "$GITHUB_STEP_SUMMARY"
    echo "120 test başarılı" >> "$GITHUB_STEP_SUMMARY"
```
:::

## Secrets ve variables

Parola, API anahtarı ve token gibi değerler **asla** koda veya YAML dosyasına yazılmaz.

GitHub'da **Settings → Secrets and variables → Actions** bölümünden eklenir:

- **Secrets:** Şifreli saklanır, loglarda `***` olarak maskelenir. Örnek: `DATABASE_URL`, `SSH_PRIVATE_KEY`, `IYZICO_SECRET_KEY`.
- **Variables:** Gizli olmayan ayarlar. Örnek: `API_URL`, `NODE_VERSION`.

Seviyeler:

| Seviye | Kapsam |
|---|---|
| Repository | Tüm workflow'lar |
| Environment | Sadece o ortama (staging/production) deploy eden job'lar |
| Organization | Organizasyondaki seçili depolar |

:::code{lang="yaml"}
```yaml
steps:
  - name: Migration
    run: npm run db:migrate
    env:
      DATABASE_URL: ${{ secrets.DATABASE_URL }}
      API_URL: ${{ vars.API_URL }}
```
:::

Kurallar:

- Secret'ları `echo` ile yazdırma; maskeleme her durumu yakalamayabilir (ör. Base64'e çevrilmiş hâli).
- Fork'lardan gelen PR'larda secret'lar varsayılan olarak verilmez; bu bir güvenlik özelliğidir.
- Production secret'larını environment seviyesinde tut ki sadece onaylı deploy job'u erişebilsin.
- Secret'ları düzenli değiştir (rotate) ve kimin erişebildiğini sınırla.

`GITHUB_TOKEN`, her çalıştırmada otomatik oluşturulan geçici bir token'dır. Depoya yorum yazma, paket yayınlama gibi işler için kullanılır ve çalıştırma bitince geçersiz olur.

## Matrix stratejisi

Aynı testleri farklı sürüm veya işletim sistemlerinde paralel çalıştırır.

:::code{lang="yaml"}
```yaml
jobs:
  test:
    runs-on: ${{ matrix.os }}
    strategy:
      fail-fast: false
      matrix:
        os: [ubuntu-latest, windows-latest]
        node: [20, 22, 24]
        exclude:
          - os: windows-latest
            node: 20
    steps:
      - uses: actions/checkout@v7
      - uses: actions/setup-node@v7
        with:
          node-version: ${{ matrix.node }}
      - run: npm ci
      - run: npm test
```
:::

Bu yapı 5 paralel job oluşturur. `fail-fast: false`, bir kombinasyon başarısız olsa bile diğerlerinin bitmesini sağlar.

Web uygulamasında genelde tek Node sürümü yeterlidir (canlıda kullandığın sürüm). Matrix daha çok kütüphane geliştirirken veya PostgreSQL'in birden fazla sürümünü test ederken işe yarar.

## Cache

Her job temiz makinede başladığı için `npm ci` her seferinde paketleri indirir. Cache bu süreyi ciddi biçimde kısaltır.

En kolay yöntem `setup-node` içindeki yerleşik cache'tir:

:::code{lang="yaml"}
```yaml
- uses: actions/setup-node@v7
  with:
    node-version: 22
    cache: npm
```
:::

Elle cache (ör. Playwright tarayıcıları için):

:::code{lang="yaml"}
```yaml
- uses: actions/cache@v4
  with:
    path: ~/.cache/ms-playwright
    key: playwright-${{ runner.os }}-${{ hashFiles('package-lock.json') }}
    restore-keys: |
      playwright-${{ runner.os }}-
```
:::

- `key`: Lock dosyası değişince yeni cache oluşur.
- `restore-keys`: Tam eşleşme yoksa en yakın eski cache kullanılır.
- Cache bir hızlandırmadır; cache olmadan da workflow doğru çalışmalıdır.

**Cache ile artifact farkı:**

|  | Cache | Artifact |
|---|---|---|
| Amaç | Hızlandırma (bağımlılıklar) | Çıktıyı saklamak/aktarmak |
| Örnek | node_modules, npm önbelleği | Build klasörü, test raporu |
| İndirme | Otomatik geri yüklenir | Elle indirilir veya job'lar arası aktarılır |

## Artifacts

Job'lar arası dosya aktarmak veya çıktıyı saklamak için kullanılır.

:::code{lang="yaml"}
```yaml
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v7
      - uses: actions/setup-node@v7
        with: { node-version: 22, cache: npm }
      - run: npm ci && npm run build
      - uses: actions/upload-artifact@v7
        with:
          name: web-build
          path: dist/
          retention-days: 7

  deploy:
    needs: build
    runs-on: ubuntu-latest
    steps:
      - uses: actions/download-artifact@v7
        with:
          name: web-build
          path: dist/
      - run: ls dist/
```
:::

Test raporlarını başarısızlıkta da saklamak için:

:::code{lang="yaml"}
```yaml
- uses: actions/upload-artifact@v7
  if: always()
  with:
    name: playwright-raporu
    path: playwright-report/
```
:::

## PostgreSQL ile entegrasyon testi

**Service containers**, job süresince yanında çalışan veritabanı gibi servislerdir. Gerçek PostgreSQL ile test yapmanı sağlar.

:::code{lang="yaml"}
```yaml
jobs:
  integration:
    runs-on: ubuntu-latest

    services:
      postgres:
        image: postgres:17
        env:
          POSTGRES_USER: test
          POSTGRES_PASSWORD: test
          POSTGRES_DB: magaza_test
        ports:
          - 5432:5432
        options: >-
          --health-cmd "pg_isready -U test"
          --health-interval 5s
          --health-timeout 5s
          --health-retries 10

    env:
      DATABASE_URL: postgresql://test:test@localhost:5432/magaza_test

    steps:
      - uses: actions/checkout@v7
      - uses: actions/setup-node@v7
        with: { node-version: 22, cache: npm }
      - run: npm ci
      - name: Şemayı oluştur
        run: npm run db:migrate
      - name: Örnek veri
        run: npm run db:seed
      - name: Entegrasyon testleri
        run: npm run test:integration
```
:::

Bu test veritabanı her çalıştırmada sıfırdan oluşur ve job bitince silinir. Böylece testler birbirini etkilemez.

Örnek entegrasyon testi (Jest + Supertest):

:::code{lang="javascript"}
```javascript
test('stoktan fazla sipariş 422 döner', async () => {
  const res = await request(app)
    .post('/api/v1/orders')
    .set('Authorization', `Bearer ${bayiToken}`)
    .send({ items: [{ productId: 12, quantity: 9999 }] });
  expect(res.status).toBe(422);
  expect(res.body.error.code).toBe('INSUFFICIENT_STOCK');
});
```
:::

## Test türleri ve test piramidi

:::code{lang="text"}
```text
          /\
         /E2E\          az sayıda, yavaş, pahalı
        /------\
       /Entegr. \       orta sayıda
      /----------\
     /   Unit     \     çok sayıda, hızlı, ucuz
    /--------------\
```
:::

| Tür | Ne test eder? | E-ticaret örneği |
|---|---|---|
| Unit | Tek fonksiyon | Bayi fiyatı hesaplama, KDV hesabı |
| Integration | API + veritabanı | POST /orders stok düşüyor mu? |
| E2E | Gerçek tarayıcıda akış | Giriş → sepete ekle → sipariş ver |
| Smoke | Deploy sonrası temel kontrol | Ana sayfa ve /health 200 dönüyor mu? |
| Contract | API sözleşmesi | OpenAPI şemasına uygun mu? |
| Performance | Yük altında davranış | 500 eşzamanlı ürün listeleme |

**Code coverage**, testlerin kodun yüzde kaçını çalıştırdığını gösterir. Kritik iş kurallarında (fiyat, stok, ödeme) yüksek coverage hedeflenir; ama %100 coverage hatasız kod anlamına gelmez.

E2E testi için Playwright örneği:

:::code{lang="yaml"}
```yaml
  e2e:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v7
      - uses: actions/setup-node@v7
        with: { node-version: 22, cache: npm }
      - run: npm ci
      - run: npx playwright install --with-deps chromium
      - run: npm run build && npm run start & npx wait-on http://localhost:3000
      - run: npx playwright test
      - uses: actions/upload-artifact@v7
        if: failure()
        with:
          name: e2e-rapor
          path: playwright-report/
```
:::

## Orijinal PDF sayfaları

:::callout{tone="info" title="Özgün görünüm"}
Bu dersin metni *CICD GitHub Actions Rehberi* PDF dosyasının 8–15. sayfalarının özgün hâlidir; sayfalar aşağıda PDF'teki görünümüyle yer alır.
:::

:::diagram{src="pdf-sayfa-08.png" alt="CICD GitHub Actions Rehberi - PDF sayfa 8"}
PDF sayfa 8 / 33
:::

:::diagram{src="pdf-sayfa-09.png" alt="CICD GitHub Actions Rehberi - PDF sayfa 9"}
PDF sayfa 9 / 33
:::

:::diagram{src="pdf-sayfa-10.png" alt="CICD GitHub Actions Rehberi - PDF sayfa 10"}
PDF sayfa 10 / 33
:::

:::diagram{src="pdf-sayfa-11.png" alt="CICD GitHub Actions Rehberi - PDF sayfa 11"}
PDF sayfa 11 / 33
:::

:::diagram{src="pdf-sayfa-12.png" alt="CICD GitHub Actions Rehberi - PDF sayfa 12"}
PDF sayfa 12 / 33
:::

:::diagram{src="pdf-sayfa-13.png" alt="CICD GitHub Actions Rehberi - PDF sayfa 13"}
PDF sayfa 13 / 33
:::

:::diagram{src="pdf-sayfa-14.png" alt="CICD GitHub Actions Rehberi - PDF sayfa 14"}
PDF sayfa 14 / 33
:::

:::diagram{src="pdf-sayfa-15.png" alt="CICD GitHub Actions Rehberi - PDF sayfa 15"}
PDF sayfa 15 / 33
:::

:::next{lesson="h-08-docker-deploy-ve-guvenlik"}
:::

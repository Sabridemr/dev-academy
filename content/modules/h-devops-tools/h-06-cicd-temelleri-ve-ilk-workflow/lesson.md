---
id: h-06-cicd-temelleri-ve-ilk-workflow
slug: cicd-temelleri-ve-ilk-workflow
module: h-devops-tools
order: 6
title:
  tr: "CI/CD ve GitHub Actions: Temeller, Pipeline ve İlk Workflow"
  en: "CI/CD and GitHub Actions: Fundamentals, Pipeline and First Workflow"
summary:
  tr: "CI/CD kavramlarını, pipeline aşamalarını ve branch protection'ı öğrenip ilk GitHub Actions workflow'unu yaz."
  en: "Learn CI/CD concepts, pipeline stages and branch protection, then write your first GitHub Actions workflow."
durationMinutes: 20
level: beginner
tags: [ci-cd, github-actions, pipeline, git, yaml]
prerequisites: [h-04-git-notes, f-02-code-journey-ci-cd]
concepts: [continuous-integration, continuous-delivery, continuous-deployment, pipeline, fail-fast, build-once-deploy-many, branch-protection, workflow]
---

## CI/CD nedir?

**CI/CD**, yazdığın kodun otomatik olarak test edilip, paketlenip canlı ortama güvenli biçimde çıkarılmasını sağlayan süreçler bütünüdür. Amaç, "benim bilgisayarımda çalışıyordu" sorununu ortadan kaldırmak ve her değişikliği küçük, hızlı ve tekrarlanabilir adımlarla yayınlamaktır.

CI/CD olmadan tipik bir yayın şöyle görünür:

:::code{lang="text"}
```text
Kodu yaz → elle test et → FTP/SSH ile sunucuya bağlan → dosyaları kopyala
→ sunucuda npm install → uygulamayı yeniden başlat → umarım bozulmamıştır
```
:::

CI/CD ile:

:::code{lang="text"}
```text
git push → testler otomatik çalışır → paket otomatik oluşur
→ staging'e otomatik çıkar → onaydan sonra canlıya çıkar → sorun olursa tek tıkla geri alınır
```
:::

Toptan satış sitende bu şu anlama gelir: Bayi fiyatı hesaplamasında yaptığın bir değişiklik, testleri geçmeden canlıya çıkamaz. Böylece yanlış fiyatla sipariş alma riski büyük ölçüde azalır.

## CI, CD ve CD farkı

Kısaltmadaki "CD" iki farklı anlama gelir; bu ayrım mülakatlarda çok sorulur.

| Kavram | Açılımı | Ne yapar? | İnsan onayı |
|---|---|---|---|
| CI | Continuous Integration | Her push'ta kodu derler, test eder, kontrol eder | Yok |
| CD | Continuous Delivery | Kod her an yayınlanabilir durumda tutulur; paket hazırdır | Canlıya çıkış için onay gerekir |
| CD | Continuous Deployment | Testleri geçen her değişiklik otomatik olarak canlıya çıkar | Yok |

### Continuous Integration (Sürekli Entegrasyon)

Geliştiriciler kodlarını sık sık (günde birkaç kez) ana dala birleştirir. Her birleştirmede otomatik olarak:

- Kod derlenir (build)
- Lint ve format kontrolleri yapılır
- Birim (unit) ve entegrasyon testleri çalışır
- Güvenlik taraması yapılır

Hata erken, küçükken ve kimin yaptığı belliyken yakalanır.

### Continuous Delivery (Sürekli Teslimat)

CI'ı geçen kod otomatik olarak paketlenir ve staging ortamına çıkar. Canlıya çıkış tek tıklık bir işlemdir ama bir insan onaylar. Ödeme ve sipariş içeren e-ticaret sistemleri için çoğu zaman en dengeli seçenektir.

### Continuous Deployment (Sürekli Dağıtım)

İnsan onayı tamamen kalkar. Testleri geçen her commit canlıya çıkar. Çok güçlü test kapsamı, izleme ve otomatik geri alma gerektirir.

:::callout{tone="tip" title="Mülakatta böyle söyle"}
Continuous Delivery'de kod her an yayınlanabilir durumdadır ama canlıya çıkış için onay vardır. Continuous Deployment'ta testleri geçen her değişiklik otomatik olarak canlıya çıkar.
:::

## Pipeline nedir?

**Pipeline**, kodun commit'ten canlı ortama kadar geçtiği otomatik adımlar zinciridir. Bir adım başarısız olursa zincir durur ve sonraki adımlar çalışmaz.

:::diagram{src="sekil-01.png" alt="Pipeline adımları: Commit/Push, Build, Lint, Test, Güvenlik, Paketleme, Staging, Onay ve Canlı kutularının oklarla sıralandığı akış|Pipeline stages: Commit/Push, Build, Lint, Test, Security, Package, Staging, Approval and Production boxes connected by arrows"}
:::

Aşamalar:

| Aşama | Amaç | Örnek araçlar |
|---|---|---|
| Source | Değişikliği tetiklemek | GitHub, GitLab |
| Build | Kodu çalışır hâle getirmek | npm run build, Vite, Webpack |
| Lint / format | Kod kalitesi ve stil | ESLint, Prettier |
| Unit test | Tek tek fonksiyonları test etmek | Jest, Vitest |
| Integration test | Veritabanı ve API ile birlikte test | Supertest + PostgreSQL |
| E2E test | Gerçek tarayıcıda kullanıcı akışı | Playwright, Cypress |
| Güvenlik | Açık ve sızıntı taraması | CodeQL, npm audit, Dependabot |
| Paketleme | Yayınlanacak çıktıyı üretmek | Docker image, zip artifact |
| Deploy | Sunucuya çıkarmak | SSH, Docker, Render, Vercel, AWS |
| İzleme | Canlıda sorunları görmek | Sentry, Grafana, UptimeRobot |

### Fail fast ilkesi

Hızlı ve ucuz kontroller önce çalışır. Lint 10 saniyede biter, E2E testleri 10 dakika sürebilir. Lint hatası varsa E2E testlerini beklemenin anlamı yoktur.

### Build once, deploy many

Paket (örneğin Docker image) bir kez üretilir. Aynı paket önce staging'e, sonra canlıya çıkar. Her ortam için yeniden build almak, "staging'de çalışıyordu ama canlıda çalışmıyor" sorununa yol açar.

## Ortamlar

Kodun canlıya çıkmadan önce geçtiği ortamlar:

| Ortam | Amacı | Kim kullanır? |
|---|---|---|
| Local (development) | Geliştirme | Sen, localhost:3000 |
| CI | Otomatik testler | GitHub Actions runner |
| Preview | Her PR için geçici ortam | Ekip, tasarım incelemesi |
| Staging | Canlının birebir kopyası | Son test, müşteri onayı |
| Production | Gerçek müşteriler | Bayiler, müşteriler |

Kurallar:

- Staging, canlıya olabildiğince benzemeli: aynı Node sürümü, aynı PostgreSQL sürümü, aynı ayarlar.
- Staging'de gerçek müşteri verisi kullanılmamalı; anonimleştirilmiş veya örnek veri kullanılmalı.
- Ödeme sağlayıcısında staging için test (sandbox) anahtarları kullanılmalı.
- Her ortamın kendi gizli anahtarları (secrets) olmalı.

## Git dallanma stratejileri

CI/CD, Git ile nasıl çalıştığına sıkı sıkıya bağlıdır.

### GitHub Flow (önerilen)

Küçük ekipler ve web projeleri için en sade yöntemdir.

:::code{lang="text"}
```text
main ──●──────●────────●──────── (her zaman yayınlanabilir)
        \    /  \      /
feature  ●──●    ●──●─●
         PR       PR
```
:::

1. `main` dalından yeni bir dal aç: `feature/bayi-fiyatlari`
2. Değişiklikleri yap ve push et.
3. Pull Request (PR) aç. CI otomatik çalışır.
4. Kod incelemesi yapılır ve testler geçer.
5. `main`'e birleştir. CD otomatik olarak staging'e çıkarır.

### Git Flow

`main`, `develop`, `feature/*`, `release/*` ve `hotfix/*` dallarını kullanır. Planlı sürüm çıkaran büyük ekipler ve masaüstü/mobil uygulamalar için uygundur; web için genelde gereğinden karmaşıktır.

### Trunk-based development

Herkes çok kısa ömürlü dallarla (bir günden az) doğrudan ana dala çalışır. Bitmemiş özellikler **feature flag** ile gizlenir. Google ve Meta gibi şirketlerin yaklaşımıdır.

### Dal isimlendirme ve commit mesajları

:::code{lang="text"}
```text
feature/google-login
fix/stok-eksi-deger
hotfix/odeme-webhook-imza
chore/bagimlilik-guncelleme
```
:::

**Conventional Commits** formatı, sürüm notlarının otomatik üretilmesini sağlar:

:::code{lang="text"}
```text
feat: bayi fiyat seviyesi eklendi
fix: stok sıfırın altına düşmesi engellendi
docs: API dokümantasyonu güncellendi
chore: eslint sürümü yükseltildi
feat!: ürün fiyat formatı değişti (BREAKING CHANGE)
```
:::

## Branch protection kuralları

GitHub'da **Settings → Branches** (veya Rulesets) altından `main` dalı korunur:

- Doğrudan `main`'e push yasak; değişiklik sadece PR ile girer.
- PR birleştirilmeden önce CI kontrolleri (`test`, `lint`) başarılı olmalı.
- En az bir onay (review) gerekir.
- Dal, `main`'in güncel hâliyle güncel olmalı.
- Force push ve dal silme engellenir.
- İsteğe bağlı: imzalı commit zorunluluğu.

Bu kurallar olmadan CI sadece bir öneridir; kurallarla birlikte zorunlu bir kalite kapısına dönüşür.

## GitHub Actions nedir?

**GitHub Actions**, GitHub'ın içine yerleşik CI/CD ve otomasyon platformudur. Depona `.github/workflows/` klasörü altında YAML dosyaları eklersin; GitHub belirlediğin olaylarda bu dosyaları çalıştırır.

Avantajları:

- Ayrı bir sunucu kurmana gerek yoktur.
- Kod, PR ve CI sonuçları aynı yerdedir.
- Marketplace'te binlerce hazır action vardır.
- Herkese açık depolarda standart runner'lar ücretsizdir; özel depolarda aylık ücretsiz dakika kotası vardır.

## Temel kavramlar

:::diagram{src="sekil-02.png" alt="GitHub Actions temel kavram zinciri: Event (push, pull_request), Workflow (.github/workflows/ci.yml), Job (test, build, deploy), Step (run / uses) ve Runner (ubuntu-latest)|GitHub Actions concept chain: Event (push, pull_request), Workflow (.github/workflows/ci.yml), Job (test, build, deploy), Step (run / uses) and Runner (ubuntu-latest)"}
:::

| Kavram | Anlamı |
|---|---|
| **Workflow** | `.github/workflows/` altındaki bir YAML dosyası; otomasyonun tamamı |
| **Event (tetikleyici)** | Workflow'u başlatan olay: push, pull_request, schedule, elle başlatma |
| **Job** | Aynı makinede çalışan adımlar grubu. Job'lar varsayılan olarak paralel çalışır |
| **Step** | Job içindeki tek bir adım: bir komut (`run`) veya hazır action (`uses`) |
| **Action** | Tekrar kullanılabilir hazır adım: `actions/checkout`, `actions/setup-node` |
| **Runner** | Job'u çalıştıran sanal makine (GitHub-hosted veya self-hosted) |
| **Artifact** | Job'un ürettiği ve saklanan dosya: build çıktısı, test raporu |
| **Secret** | Şifreli saklanan gizli değer: API anahtarı, SSH anahtarı |
| **Environment** | Staging, production gibi ortamlar; kendi secret'ları ve onay kuralları olur |

Önemli: Her job **temiz, ayrı bir makinede** başlar. Bir job'da kurulan paketler veya oluşan dosyalar diğer job'da yoktur; aktarmak için artifact veya cache kullanılır.

## YAML temelleri

GitHub Actions dosyaları YAML ile yazılır. YAML'da girinti (boşluk) anlam taşır; **tab kullanılmaz**, genelde 2 boşluk kullanılır.

:::code{lang="yaml"}
```yaml
# Yorum satırı
anahtar: değer
sayi: 20
dogru_mu: true

liste:
  - birinci
  - ikinci

nesne:
  ad: Zeytinyağı
  fiyat: 420

cok_satirli: |
  npm ci
  npm test
```
:::

En sık yapılan hatalar:

- Girintiyi yanlış hizalamak (bir step'in `run` satırının bir boşluk kayması)
- Tab karakteri kullanmak
- `on:` yerine `On:` yazmak (büyük-küçük harf duyarlı)
- `:` içeren metinleri tırnaksız yazmak: `name: "Test: birim"`

## İlk workflow

Depoda şu dosyayı oluştur: `.github/workflows/ci.yml`

:::code{lang="yaml"}
```yaml
name: CI

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest

    steps:
      - name: Kodu indir
        uses: actions/checkout@v7

      - name: Node.js kur
        uses: actions/setup-node@v7
        with:
          node-version: 22
          cache: npm

      - name: Bağımlılıkları yükle
        run: npm ci

      - name: Lint
        run: npm run lint

      - name: Testler
        run: npm test

      - name: Build
        run: npm run build
```
:::

Satır satır:

- `name`: Actions sekmesinde görünen ad.
- `on`: Ne zaman çalışacağı. Burada `main`'e push ve `main`'e açılan PR'larda.
- `jobs.test`: `test` adında bir job.
- `runs-on`: Ubuntu sanal makinesinde çalışır.
- `actions/checkout`: Depodaki kodu runner'a indirir. Bu olmadan makinede kodun yoktur.
- `actions/setup-node`: Node.js 22 kurar ve npm önbelleğini açar.
- `npm ci`: `package-lock.json`'a birebir uyan temiz kurulum yapar. CI'da `npm install` yerine her zaman `npm ci` kullanılır.

Dosyayı push ettiğinde GitHub'da **Actions** sekmesinde çalıştığını görürsün. PR'larda da yeşil tik veya kırmızı çarpı olarak sonuç görünür.

:::callout{tone="tip" title="Mülakatta böyle söyle"}
CI'da npm install yerine npm ci kullanırım; lock dosyasına birebir uyar, daha hızlıdır ve her çalıştırmada aynı bağımlılık sürümlerini garanti eder.
:::

## Dene: pipeline aşamaları

:::interactive{type="pipeline" stages=5 failureStage=0 retries=0}
Aşamaları ekleyip çıkar, bir aşamayı başarısız yap ve "fail fast" davranışını izle: hata hangi aşamada olursa olsun sonraki aşamalar çalışmaz.
:::

:::callout{tone="info" title="İlgili dersler"}
Bu konuyu başka bir açıdan anlatan dersler:

- [Kodun Yolculuğu ve CI/CD (Kod ve Altyapı modülü)](/lessons/f-02-code-journey-ci-cd)
:::

:::quiz{src="quiz.json"}
:::

:::next{lesson="h-07-tetikleyiciler-secrets-cache-ve-testler"}
:::

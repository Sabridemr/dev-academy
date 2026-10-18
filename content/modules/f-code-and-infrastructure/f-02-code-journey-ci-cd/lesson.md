---
id: f-02-code-journey-ci-cd
slug: code-journey-ci-cd
module: f-code-and-infrastructure
order: 2
title:
  tr: "Kodun Yolculuğu: Git → CI → Artifact → CD → Canary → Production"
  en: "The Code Journey: Git → CI → Artifact → CD → Canary → Production"
summary:
  tr: Monorepo/polyrepo, branching, pipeline, deploy stratejileri — tam animasyonlu.
  en: Monorepo/polyrepo, branching, pipelines, deploy strategies — fully animated.
durationMinutes: 30
level: intermediate
tags: [ci-cd, git, deployment, devops, pipeline, release]
prerequisites: [f-01-servers-datacenters-regions]
concepts: [monorepo-vs-polyrepo, trunk-based-development, gitflow, continuous-integration, artifact-registry, immutable-artifact, continuous-delivery, staging, canary-release, blue-green-deployment, rolling-deployment, rollback]
---

## Kavram: bir satır kod production'a nasıl ulaşır?

Önceki derste kodun çalışacağı makineleri gördük. Şimdi şu soruyu soralım: bir geliştirici dizüstü bilgisayarında `cart-service` içinde bir hata düzeltti. Bu değişiklik Frankfurt'taki bir pod'un içinde nasıl çalışır hâle gelir? Amazon ölçeğinde bir şirkette bu yolculuk **hiçbir zaman** "sunucuya SSH ile bağlanıp dosya kopyalamak" değildir. Tamamen otomatik, tekrarlanabilir ve geri alınabilir bir boru hattından (pipeline) geçer:

```
geliştirici makinesi → Git → CI (build · test · lint) → artifact registry → CD → staging → canary → production
```

Her aşamanın tek bir amacı vardır: **kötü bir değişikliğin bir sonraki aşamaya geçmesini engellemek.** Aşamalar ilerledikçe hatanın maliyeti büyür (dizüstü bilgisayarda bir hata saniyeler, production'da bir hata milyonlarca dolar), bu yüzden kontroller öne çekilir ("shift left").

## 1. Git: kod nerede durur?

### Monorepo mu, polyrepo mu?

| | **Monorepo** | **Polyrepo** |
|---|---|---|
| Yapı | Tüm servisler tek depoda (`/services/cart`, `/services/orders`, `/libs/auth`) | Her servis ayrı depoda |
| Çapraz değişiklik | Tek bir PR ile 5 servis + ortak kütüphane değişir, atomik | 5 PR, 5 sürüm, sıralama sorunu |
| Bağımlılık yönetimi | Herkes `libs/auth`'un aynı sürümünü kullanır | Her servis farklı sürümde kalabilir (diamond dependency) |
| Araç gereksinimi | Ciddi: değişen paketi bulup yalnızca onu build eden araç gerekir (Bazel, Nx, Turborepo, pnpm workspaces) | Standart araçlar yeter |
| Erişim kontrolü | Zor (herkes her şeyi görür) | Kolay (depo bazlı) |
| Kullananlar | Google, Meta, Uber, (bu uygulama: pnpm monorepo) | Amazon (çoğunlukla), Netflix |

Amazon'un yaklaşımı ilginçtir: binlerce küçük depo, ama bunları birbirine bağlayan **Brazil** adlı dahili bir build sistemi ve "version set" kavramı vardır; yani polyrepo'nun sahiplik netliğini monorepo'nun tutarlı bağımlılık çözümlemesiyle birleştirir.

### Trunk-based mi, Gitflow mu?

:::diagram{src="diagram.svg" alt="Trunk-based development ile Gitflow dallanma modellerinin karşılaştırmalı commit grafiği|Comparative commit graph of trunk-based development versus Gitflow branching"}
Üstte trunk-based: kısa ömürlü dallar main'e günde birkaç kez birleşir, her merge deploy edilebilir. Altta Gitflow: develop, release ve hotfix dalları uzun yaşar.
:::

- **Gitflow**: `develop`, `release/1.4`, `hotfix/...`, `feature/...` dalları. Sürüm bazlı yazılımlar (mobil uygulama, kutulu ürün) için mantıklıdır ama dallar haftalarca yaşadığı için **merge cehennemi** üretir ve sürekli teslimatı yavaşlatır.
- **Trunk-based development**: Herkes `main`'e (trunk) günde en az bir kez birleşir; dallar en fazla 1–2 gün yaşar. Yarım kalan özellikler **feature flag** arkasına gizlenir (bir sonraki derste). Yüksek performanslı ekiplerin (DORA araştırması) ortak özelliğidir.

:::callout{tone="info" title="Branch koruma kuralları"}
Trunk-based çalışmak "main'e doğrudan push" demek değildir. Tipik koruma: `main`'e yalnızca PR ile, en az 1 onay, CI yeşil, dal güncel (rebase/merge-queue). GitHub'da *merge queue*, aynı anda açılan 20 PR'ı sırayla main üzerinde test edip birleştirir; böylece "iki PR tek tek geçiyor ama birlikte bozuyor" problemi çözülür.
:::

## 2. CI: değişikliği doğrulamak

Continuous Integration, her push'ta otomatik çalışan ve değişikliğin **birleştirilebilir** olduğunu kanıtlayan adımlar dizisidir:

1. **Checkout + bağımlılık kurulumu** (cache'li, aksi hâlde her çalıştırma dakikalar kaybeder).
2. **Lint & format** (`eslint`, `prettier --check`, `tsc --noEmit`): en ucuz hata yakalama.
3. **Birim testleri** (saniyeler), **entegrasyon testleri** (Docker ile gerçek Postgres/Redis kaldırılır, dakikalar).
4. **Güvenlik taramaları**: bağımlılık zafiyeti (`npm audit`, Snyk), secret sızıntısı (gitleaks), SAST.
5. **Build**: derlenmiş çıktı ya da Docker imajı.

CI'ın altın kuralı: **main her zaman yeşil olmalıdır.** Kırmızı main, tüm ekibin işini durdurur; önce düzeltilir ya da değişiklik geri alınır.

## 3. Artifact registry: "bir kez derle, her yerde çalıştır"

CI'ın ürettiği şey bir **artifact**'tir: Docker imajı, JAR, npm paketi. Bu artifact bir kayıt defterine (ECR, GHCR, Artifactory) itilir ve en önemli özelliği **değişmez (immutable)** olmasıdır. İmaj, commit SHA'sı ile etiketlenir:

```
123456789012.dkr.ecr.eu-central-1.amazonaws.com/cart-service:a1b2c3d
```

`latest` etiketi production'da **asla** kullanılmaz; çünkü "latest" dün başka, bugün başka bir imajdır ve hangi kodun çalıştığını bilemezsiniz. SHA etiketli imaj sayesinde:

- Staging'de test edilen **bit bit aynı** imaj production'a gider (ortamlar arası "bende çalışıyordu" biter).
- Geri alma (rollback) yalnızca önceki SHA'yı tekrar deploy etmektir; yeniden derleme gerekmez.
- Tedarik zinciri güvenliği için imaj imzalanır (cosign) ve SBOM eklenir.

## 4. CD: artifact'i ortamlara taşımak

Continuous Delivery/Deployment, onaylı artifact'i sırayla ortamlara yayar:

- **Staging** (pre-prod): production'un küçük bir kopyası; aynı imaj, aynı konfigürasyon şablonu, sentetik veri. Burada smoke test ve uçtan uca testler çalışır.
- **Canary**: production'un **küçük bir dilimi** (%1–5) yeni sürümü alır; hata oranı, p99 gecikme ve iş metrikleri (sepete ekleme oranı!) eski sürümle karşılaştırılır.
- **Production**: kademeli olarak %25 → %50 → %100.

Aşağıdaki animasyon tüm yolculuğu 8 adımda gösterir.

:::animation{scene="scene.json"}
Bir commit'in geliştirici makinesinden production'a tam yolculuğu: Git, CI, artifact registry, CD, staging, canary ve tam yayın.
:::

## 5. Deploy stratejileri karşılaştırması

| Strateji | Nasıl çalışır? | Ek kapasite | Geri alma süresi | Risk | Ne zaman? |
|---|---|---|---|---|---|
| **Recreate** | Eskiyi kapat, yeniyi aç | Yok | Yeniden deploy (dakikalar) | Kesinti var | İç araçlar, batch |
| **Rolling** | Pod'ları teker teker (ör. %25'lik dalgalarla) değiştir | Az (%10–25) | Yavaş (dalga dalga geri) | İki sürüm aynı anda yaşar, API uyumu şart | Varsayılan Kubernetes stratejisi |
| **Blue-green** | Tam bir yeni ortam (green) kur, trafiği LB'de bir kerede çevir | 2× | **Saniyeler** (LB'yi geri çevir) | Veritabanı şeması iki sürümle uyumlu olmalı | Hızlı geri alma kritikse |
| **Canary** | Yeni sürümü küçük bir dilime ver, metrikleri izle, kademeli artır | Az | Hızlı (dilimi sıfırla) | En düşük patlama yarıçapı; iyi gözlemlenebilirlik şart | Yüksek trafikli, kullanıcıya dönük servisler |

:::diagram{src="deploy-strategies.svg" alt="Rolling, blue-green ve canary dağıtım stratejilerinin trafik akışı karşılaştırması|Traffic flow comparison of rolling, blue-green and canary deployment strategies"}
Üç strateji: rolling pod'ları dalga dalga değiştirir, blue-green trafiği tek seferde çevirir, canary trafiğin küçük bir yüzdesini yeni sürüme verip ölçer.
:::

İkinci sahne bir canary dağıtımının %5 → %25 → %100 ilerleyişini ve hata oranı yükselince otomatik geri almayı gösterir:

:::animation{scene="deploy-strategies.scene.json"}
Canary dağıtımı: v2 önce trafiğin %5'ini alır, metrikler temizse %25'e çıkar; hata oranı eşiği aşılınca otomatik rollback yapılır.
:::

:::interactive{type="pipeline" stages="lint,unit-test,build-image,push-registry,deploy-staging,e2e-test,canary-5,canary-25,production" failureStage="e2e-test"}
Pipeline'ı çalıştırın ve her aşamanın süresini izleyin. Bir aşamada hata enjekte edin (ör. e2e test başarısız) ve artifact'in bir sonraki aşamaya geçmediğini görün. Canary aşamasında hata oranı kaydırıcısını yükseltip otomatik geri almayı tetikleyin.
:::

## Örnek: GitHub Actions ile tam pipeline

:::code{lang="yaml" title="GitHub Actions: CI + imaj + staging + canary (özetlenmiş)"}
```yaml
name: cart-service
on:
  push:
    branches: [main]
  pull_request:

env:
  IMAGE: 123456789012.dkr.ecr.eu-central-1.amazonaws.com/cart-service

jobs:
  ci:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4
        with: { node-version: 22, cache: pnpm }
      - run: pnpm install --frozen-lockfile        # lockfile dışına çıkılamaz
      - run: pnpm lint && pnpm typecheck           # en ucuz kontroller önce
      - run: pnpm test -- --coverage               # birim testleri
      - name: Entegrasyon testleri (gerçek Postgres ile)
        run: docker compose -f docker-compose.test.yml up --abort-on-container-exit

  build-image:
    needs: ci
    if: github.ref == 'refs/heads/main'           # yalnızca main'e merge sonrası
    runs-on: ubuntu-latest
    permissions: { id-token: write, contents: read }  # OIDC: uzun ömürlü AWS anahtarı yok
    outputs:
      tag: ${{ steps.meta.outputs.tag }}
    steps:
      - uses: actions/checkout@v4
      - id: meta
        run: echo "tag=${GITHUB_SHA::7}" >> "$GITHUB_OUTPUT"   # imaj etiketi = commit SHA
      - uses: aws-actions/configure-aws-credentials@v4
        with: { role-to-assume: arn:aws:iam::123456789012:role/gha-ecr-push, aws-region: eu-central-1 }
      - uses: aws-actions/amazon-ecr-login@v2
      - run: |
          docker build -t $IMAGE:${{ steps.meta.outputs.tag }} .
          docker push $IMAGE:${{ steps.meta.outputs.tag }}
      - run: cosign sign --yes $IMAGE:${{ steps.meta.outputs.tag }}   # imajı imzala

  deploy-staging:
    needs: build-image
    runs-on: ubuntu-latest
    environment: staging
    steps:
      - run: kubectl -n staging set image deploy/cart-service app=$IMAGE:${{ needs.build-image.outputs.tag }}
      - run: kubectl -n staging rollout status deploy/cart-service --timeout=5m
      - run: pnpm e2e --base-url https://staging.shop.internal        # smoke + uçtan uca

  canary:
    needs: [build-image, deploy-staging]
    runs-on: ubuntu-latest
    environment: production            # korumalı ortam: onay + bekleme süresi
    steps:
      - name: Canary %5 → %25 → %100 (Argo Rollouts)
        run: |
          kubectl argo rollouts set image cart-service app=$IMAGE:${{ needs.build-image.outputs.tag }}
          kubectl argo rollouts promote cart-service --full=false   # analiz şablonu hata oranını izler
```
:::

Pipeline'ın canary aşamasında "ilerle / bekle / geri al" kararını veren mantık, Argo Rollouts ya da Flagger gibi araçların içinde şuna benzer:

:::code{lang="ts" title="Canary analiz kararı: baseline ile karşılaştırma"}
```ts
// Argo Rollouts / Flagger'ın analiz şablonlarının yaptığı işin özü
interface Metrics { errorRate: number; p99Ms: number; conversion: number }

export function canaryVerdict(baseline: Metrics, canary: Metrics): 'promote' | 'hold' | 'rollback' {
  // Hata oranı baseline'ın 2 katından fazla VEYA mutlak %1'i geçtiyse hemen geri al
  if (canary.errorRate > Math.max(baseline.errorRate * 2, 0.01)) return 'rollback';
  // p99 gecikme %20'den fazla kötüleştiyse ilerleme; bekle ve tekrar ölç
  if (canary.p99Ms > baseline.p99Ms * 1.2) return 'hold';
  // İş metriği (dönüşüm) anlamlı düştüyse de geri al — teknik metrikler temiz görünebilir
  if (canary.conversion < baseline.conversion * 0.97) return 'rollback';
  return 'promote';
}
```
```python
def canary_verdict(baseline: dict, canary: dict) -> str:
    # Hata oranı baseline'ın 2 katını veya mutlak %1'i aşarsa geri al
    if canary["error_rate"] > max(baseline["error_rate"] * 2, 0.01):
        return "rollback"
    # p99 %20'den fazla kötüleştiyse bekle, tekrar ölç
    if canary["p99_ms"] > baseline["p99_ms"] * 1.2:
        return "hold"
    # İş metriği düştüyse teknik metrikler temiz olsa bile geri al
    if canary["conversion"] < baseline["conversion"] * 0.97:
        return "rollback"
    return "promote"
```
:::

:::realworld{company="Amazon"}
Amazon'un dahili deploy sistemi **Apollo** (ve halka açık kuzeni **AWS CodeDeploy**) günde milyonlarca deploy'u otomatik yürütür. Bir pipeline tipik olarak şu dalgalardan geçer: **one-box** (tek bir host, üretim trafiğinin küçücük bir kısmı) → **bir AZ** → **bir region** → **tüm region'lar**, her dalga arasında "bake time" (pişme süresi) ile. Her dalgada CloudWatch alarmları izlenir; hata oranı ya da gecikme alarmı tetiklenirse pipeline **insan müdahalesi olmadan** önceki sürüme döner. Amazon'un ünlü ilkesi "deploy'lar sıkıcı olmalı": hiçbir deploy cuma akşamı ya da Prime Day sırasında başlamaz (pipeline'da "blocker" pencereleri vardır) ve her değişiklik **her zaman geri alınabilir** olmalıdır — bu yüzden veritabanı şema değişiklikleri kodla aynı deploy'da değil, önce geriye uyumlu biçimde ayrı yapılır.
:::

:::callout{tone="warning" title="Geri alınamayan değişiklik yapmayın"}
Canary ve blue-green yalnızca **geri alınabilir** değişikliklerde işe yarar. Bir kolonu silen ya da yeniden adlandıran migration, eski sürümün çalışmasını imkânsız kılar. Kural: **expand → migrate → contract**. Önce yeni kolonu ekleyin (eski kod etkilenmez), sonra kodu yeni kolonu kullanacak şekilde deploy edin, veriyi taşıyın, en son eski kolonu kaldırın — ayrı bir deploy'da.
:::

:::callout{tone="tip" title="Mülakat ipuçları"}
- "Nasıl deploy edersiniz?" sorusuna tek kelime (ör. "Kubernetes") yerine **akış** anlatın: PR → CI yeşil → SHA etiketli imaj → staging → canary (%5, metrik karşılaştırma) → kademeli production → otomatik rollback.
- Blue-green ile canary farkını netleştirin: blue-green **tüm trafiği tek seferde** çevirir ve hızlı geri alma sağlar; canary **küçük dilimle** riski ölçer.
- Rolling deploy'da iki sürümün **aynı anda** çalıştığını ve bu yüzden API/DB uyumluluğunun şart olduğunu söyleyin; mülakatçının aradığı derinlik budur.
- "Artifact immutable olmalı, `latest` kullanmam" cümlesi küçük ama güçlü bir sinyaldir.
:::

:::quiz{src="quiz.json"}
:::

:::next{lesson="f-03-kubernetes-basics"}
Pipeline'ın son adımında `kubectl set image` komutunu gördünüz. Sırada bu komutun arkasındaki dünya: Pod, Deployment, Service, Ingress ve otomatik ölçekleme (HPA).
:::

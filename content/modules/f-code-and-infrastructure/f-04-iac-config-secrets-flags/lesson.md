---
id: f-04-iac-config-secrets-flags
slug: iac-config-secrets-flags
module: f-code-and-infrastructure
order: 4
title:
  tr: "Infrastructure as Code, Konfigürasyon, Secret Yönetimi, Feature Flag’ler"
  en: "Infrastructure as Code, Configuration, Secrets, Feature Flags"
summary:
  tr: Terraform, ortam değişkenleri, vault, kademeli açılış.
  en: Terraform, environment variables, vaults, gradual rollout.
durationMinutes: 30
level: intermediate
tags: [terraform, iac, configuration, secrets, feature-flags, devops, security]
prerequisites: [f-02-code-journey-ci-cd, f-03-kubernetes-basics]
concepts: [infrastructure-as-code, terraform-plan-apply, terraform-state, drift, twelve-factor-config, environment-variables, secret-management, secret-rotation, feature-flag, gradual-rollout, kill-switch]
---

## Kavram: kodun dışında kalan her şey de koddur

Önceki iki derste bir imajın pipeline'dan geçip Kubernetes'te çalıştığını gördük. Ama bu hikâyede görünmeyen devasa bir katman var: **o Kubernetes kümesi, veritabanı, S3 bucket'ı, IAM rolleri, VPC ve subnet'ler kim tarafından yaratıldı?** Bir de uygulamanın davranışını kod değiştirmeden etkileyen şeyler var: hangi veritabanına bağlanacağı (config), şifresi (secret) ve yeni özelliğin kime açık olduğu (feature flag).

Amazon benzeri bir şirkette bu dört şeyin ortak kuralı şudur: **hiçbiri bir insanın konsolda tıklamasıyla ya da bir sunucuya elle girilmesiyle yönetilmez.** Hepsi sürüm kontrolünde, incelemeden geçen, otomatik uygulanan ve denetlenebilir (auditable) tanımlardır.

| Katman | Soru | Nerede yaşar? | Ne sıklıkla değişir? | Kim değiştirir? |
|---|---|---|---|---|
| **Kod** | Uygulama ne yapar? | Git → imaj | Günde birçok kez | Geliştirici, PR ile |
| **Altyapı (IaC)** | Kod nerede çalışır? | Git → Terraform state → bulut | Haftada birkaç kez | Geliştirici/platform ekibi, PR + plan incelemesi |
| **Konfigürasyon** | Bu ortamda nasıl davranır? | Ortam değişkeni, ConfigMap, parametre deposu | Deploy'da | Pipeline |
| **Secret** | Neye hangi kimlikle erişir? | Vault / Secrets Manager, asla Git'te | Rotasyonla (günler–aylar) | Otomatik rotasyon |
| **Feature flag** | Bu özellik şu an kime açık? | Flag servisi (LaunchDarkly, AppConfig) | Dakikalar içinde, deploy'suz | Ürün/ops, UI'dan |

:::diagram{src="diagram.svg" alt="Kod, altyapı, konfigürasyon, secret ve feature flag katmanlarının nerede yaşadığı ve değişim hızları|Where the code, infrastructure, configuration, secret and feature flag layers live and how fast each changes"}
Beş katman, beş farklı değişim hızı ve beş farklı depo. Hepsinin ortak noktası: elle değil, tanımla ve otomasyonla yönetilir.
:::

## 1. Infrastructure as Code: Terraform plan / apply

**IaC**, altyapıyı (VPC, küme, veritabanı, kuyruk, IAM) bir programlama diline benzer bildirimsel dosyalarla tanımlamaktır. Terraform'un HCL dili en yaygın olanıdır; AWS CDK (TypeScript ile), Pulumi ve CloudFormation alternatiflerdir. Üç kavram her şeyi açıklar:

1. **Tanım (`.tf` dosyaları)**: İstenen durum. "Bir RDS Postgres olsun, Multi-AZ, 100 GB, bu subnet'lerde."
2. **State**: Terraform'un "şu anda ne yarattım, hangi gerçek ID'ye sahip" defteri. Ekip çalışmasında **uzak bir backend'de** (S3 + DynamoDB kilidi) tutulur; iki kişinin aynı anda apply yapması kilitle engellenir.
3. **Plan → Apply**: `terraform plan`, tanım ile state'i (ve gerçek bulutu) karşılaştırıp **ne yapacağını** listeler: `+ create`, `~ update in-place`, `-/+ replace`, `- destroy`. Hiçbir şey değişmez. `terraform apply` ise onaylanan planı uygular.

Plan çıktısı bir **kod incelemesi nesnesidir**. "~ update" ile "-/+ replace" arasındaki fark, bir veritabanının yerinde büyütülmesi ile **silinip yeniden yaratılması** (veri kaybı!) arasındaki farktır. Bu yüzden olgun ekiplerde plan PR'a yorum olarak düşer, bir insan onaylar, apply yalnızca main'den çalışır.

:::animation{scene="scene.json"}
Terraform iş akışı: HCL değişikliği PR'a gelir, CI plan üretir ve state'i okur, plan incelenir, merge sonrası apply state'i kilitler, bulut API'sini çağırır ve state'i günceller.
:::

:::callout{tone="danger" title="Drift: konsolda yapılan değişiklik"}
Birisi acil durumda AWS konsolundan güvenlik grubuna bir port açarsa, gerçek dünya ile state ayrışır: buna **drift** denir. Bir sonraki `plan` bu portu "silinecek" olarak gösterir — ya da daha kötüsü, kimse plan'a dikkatle bakmazsa **siler**. Çözüm: konsol erişimini salt okunur yapmak, acil değişiklikleri bile PR ile yapmak ve düzenli drift tespiti (`terraform plan` cron'u) çalıştırmak.
:::

:::code{lang="hcl" title="Terraform: Multi-AZ RDS + secret + feature flag altyapısı"}
```hcl
terraform {
  required_version = ">= 1.6"
  backend "s3" {                          # state uzakta, kilitli
    bucket         = "shop-terraform-state"
    key            = "prod/cart/terraform.tfstate"
    region         = "eu-central-1"
    dynamodb_table = "terraform-locks"    # aynı anda iki apply olmasın
    encrypt        = true
  }
}

variable "environment" { type = string }  # staging | prod

# Veritabanı parolası: Terraform üretir, Secrets Manager saklar, Git'te asla görünmez
resource "random_password" "cart_db" {
  length  = 32
  special = false
}

resource "aws_secretsmanager_secret" "cart_db" {
  name       = "${var.environment}/cart/db"
  kms_key_id = aws_kms_key.secrets.arn
}

resource "aws_secretsmanager_secret_version" "cart_db" {
  secret_id     = aws_secretsmanager_secret.cart_db.id
  secret_string = jsonencode({ username = "cart", password = random_password.cart_db.result })
}

resource "aws_db_instance" "cart" {
  identifier              = "${var.environment}-cart"
  engine                  = "postgres"
  engine_version          = "16"
  instance_class          = var.environment == "prod" ? "db.r6g.xlarge" : "db.t4g.medium"
  allocated_storage       = 100
  multi_az                = var.environment == "prod"     # f-01: AZ-b'de senkron standby
  db_subnet_group_name    = aws_db_subnet_group.private.name
  vpc_security_group_ids  = [aws_security_group.db.id]
  username                = "cart"
  password                = random_password.cart_db.result
  backup_retention_period = 14
  deletion_protection     = true                           # yanlışlıkla "- destroy" olmasın
  skip_final_snapshot     = false

  lifecycle {
    prevent_destroy = true                                 # plan'da destroy görünürse apply durur
  }
}

# Otomatik rotasyon: 30 günde bir Lambda yeni parola üretir, DB'de değiştirir, secret'ı günceller
resource "aws_secretsmanager_secret_rotation" "cart_db" {
  secret_id           = aws_secretsmanager_secret.cart_db.id
  rotation_lambda_arn = aws_lambda_function.rotate_postgres.arn
  rotation_rules { automatically_after_days = 30 }
}

# Feature flag altyapısı (AWS AppConfig): flag'ler deploy'suz, kademeli değişir
resource "aws_appconfig_application" "cart" { name = "cart-service" }
resource "aws_appconfig_environment" "cart" {
  application_id = aws_appconfig_application.cart.id
  name           = var.environment
}
resource "aws_appconfig_deployment_strategy" "canary_10_percent" {
  name                           = "canary-10-percent-20min"
  deployment_duration_in_minutes = 20
  growth_factor                  = 10       # her adımda hedeflerin %10'una daha yay
  final_bake_time_in_minutes     = 10
  replicate_to                   = "NONE"
}

output "db_endpoint" { value = aws_db_instance.cart.address }
```
:::

## 2. Konfigürasyon: aynı imaj, farklı ortam

f-02'deki altın kural "bir kez derle, her yerde çalıştır" idi. Peki staging ile production farklı veritabanlarına bağlanıyorsa aynı imaj nasıl çalışır? Cevap **12-Factor App**'in üçüncü ilkesidir: *konfigürasyon ortamdan gelir, koddan değil.* Ortama göre değişen her şey (DB adresi, kuyruk adı, log seviyesi, dış servis URL'si) **ortam değişkeni** olarak enjekte edilir; imajın içinde `config.prod.json` diye bir dosya olmaz.

Kubernetes'te bunun karşılığı **ConfigMap**'tir (gizli olmayan ayarlar) ve pod'a `env` ya da dosya olarak bağlanır. Daha büyük sistemlerde merkezi bir parametre deposu (AWS SSM Parameter Store, Consul) kullanılır; uygulama açılışta oradan okur.

İyi konfigürasyon üç kuralı izler:

- **Açılışta doğrula**: Eksik ya da hatalı bir değişken varsa uygulama hemen çökmeli (fail fast), ilk istek gelince değil.
- **Tipli ve tek yerden oku**: Kodun her yerinde `process.env.X` okumak yerine tek bir `config` nesnesi.
- **Varsayılanları güvenli tut**: `DEBUG=false`, `TLS_VERIFY=true` varsayılan olsun.

## 3. Secret yönetimi: şifreler Git'e girmez

Secret, ele geçirilmesi doğrudan zarar veren her değerdir: DB parolası, API anahtarı, TLS özel anahtarı, imzalama anahtarı. Secret yönetiminin kuralları:

1. **Asla Git'te, asla imajda, asla logda.** CI'da `gitleaks` gibi tarayıcılar yanlışlıkla commit'lenen anahtarları yakalar; commit'lenen anahtar sızmış sayılır ve **döndürülür** (rotate), sadece silinmez — Git geçmişi kalıcıdır.
2. **Merkezi, şifreli, denetimli bir depo**: HashiCorp Vault, AWS Secrets Manager, GCP Secret Manager. Her okuma kaydedilir ("kim, ne zaman, hangi secret'ı okudu").
3. **Uygulama kimlikle alır, parolayla değil**: Pod, bir IAM rolü (EKS'te IRSA) ya da Vault'un Kubernetes auth'u ile kendini tanıtır ve yalnızca kendi secret'larını çeker. Böylece "secret'ı almak için gereken secret" sorunu çözülür.
4. **Rotasyon**: Secret'lar düzenli olarak (30–90 gün) ve bir sızıntı şüphesinde anında değişir. Sıfır kesintili rotasyon için **iki aktif anahtar** kalıbı kullanılır: yeni anahtar eklenir, istemciler yenisine geçer, eski anahtar iptal edilir.
5. **Kısa ömürlü tercih edilir**: Vault'un dinamik secret'ları her pod'a kendi 1 saatlik DB kullanıcısını üretir; süresi dolunca otomatik silinir. Sızsa bile bir saat sonra işe yaramaz.

:::callout{tone="warning" title="Kubernetes Secret şifreli değildir"}
Varsayılan bir Kubernetes `Secret` yalnızca **base64 ile kodlanmıştır** — bu şifreleme değildir. etcd'de şifreleme (encryption at rest) açılmalı, RBAC ile kimin okuyabileceği kısıtlanmalı ve tercihen **External Secrets Operator** ile asıl değer Vault/Secrets Manager'dan senkronlanmalıdır. Git'te YAML içinde `password: cGFzc3dvcmQ=` görürseniz bu bir sızıntıdır.
:::

## 4. Feature flag: deploy ile release'i ayırmak

Trunk-based geliştirmede (f-02) yarım özellikler main'e girer ama kullanıcıya görünmez. Bunu sağlayan **feature flag**'dir: koddaki bir `if (flags.isEnabled('new-checkout', user))` dalı ve bu dalı uzaktan, **deploy yapmadan** açıp kapatan bir servis. Flag'ler üç şeyi mümkün kılar:

- **Kademeli açılış (gradual rollout)**: Yeni ödeme akışını önce çalışanlara, sonra kullanıcıların %1'ine, %10'una, %50'sine açarsınız. Bu, canary'nin (f-02) **özellik seviyesindeki** karşılığıdır: canary yeni *imajı* küçük bir dilime verir, flag yeni *davranışı* küçük bir dilime verir; ikisi birlikte kullanılır.
- **Kill switch**: Yeni özellik production'da sorun çıkarırsa rollback beklemeden saniyeler içinde kapatılır.
- **Deney (A/B)**: Aynı flag, iki varyantı rastgele dağıtıp dönüşümü ölçer.

Önemli ayrıntı: kullanıcı atama **deterministik** olmalıdır. Aynı kullanıcı her istekte aynı varyantı görmeli; bunun için `hash(flagKey + userId) mod 100 < percentage` kullanılır, rastgele sayı değil. Aksi hâlde kullanıcı sayfayı yenileyince eski/yeni arasında zıplar.

:::code{lang="ts" title="Feature flag ile kademeli açılış: deterministik yüzde ve kill switch"}
```ts
import { createHash } from 'node:crypto';

export interface FlagRule {
  key: string;                       // "new-checkout"
  enabled: boolean;                  // kill switch: false ise herkese kapalı
  percentage: number;                // 0–100: kullanıcıların yüzde kaçına açık
  allowUsers?: string[];             // her zaman açık (çalışanlar, beta grubu)
  allowAttributes?: Record<string, string[]>; // ör. { country: ["TR", "DE"] }
}

export interface FlagContext {
  userId: string;
  attributes?: Record<string, string>;
}

/** 0–99 arası, aynı kullanıcı + aynı flag için her zaman aynı kova */
function bucket(flagKey: string, userId: string): number {
  const digest = createHash('sha256').update(`${flagKey}:${userId}`).digest();
  return digest.readUInt32BE(0) % 100;
}

export function isEnabled(rule: FlagRule, ctx: FlagContext): boolean {
  if (!rule.enabled) return false;                                   // kill switch her şeyi ezer
  if (rule.allowUsers?.includes(ctx.userId)) return true;            // iç kullanıcılar önce görür
  if (rule.allowAttributes) {                                        // ülke / plan gibi hedefleme
    for (const [attr, allowed] of Object.entries(rule.allowAttributes)) {
      if (!allowed.includes(ctx.attributes?.[attr] ?? '')) return false;
    }
  }
  return bucket(rule.key, ctx.userId) < rule.percentage;             // %10 → kova 0..9
}

// Flag servisi kuralları yayınlar; uygulama bellekte tutar ve SSE/polling ile 5 sn'de bir yeniler.
// Kademeli açılış: percentage 1 → 10 → 50 → 100 (deploy yok, imaj aynı).
// Sorun çıkarsa: enabled=false → saniyeler içinde herkese eski akış.
```
```python
import hashlib

def bucket(flag_key: str, user_id: str) -> int:
    digest = hashlib.sha256(f"{flag_key}:{user_id}".encode()).digest()
    return int.from_bytes(digest[:4], "big") % 100          # deterministik 0–99

def is_enabled(rule: dict, user_id: str, attributes: dict | None = None) -> bool:
    if not rule["enabled"]:                                   # kill switch
        return False
    if user_id in rule.get("allow_users", []):
        return True
    for attr, allowed in rule.get("allow_attributes", {}).items():
        if (attributes or {}).get(attr) not in allowed:
            return False
    return bucket(rule["key"], user_id) < rule["percentage"]
```
:::

## Hepsi birlikte: bir özelliğin tam yolculuğu

Yeni "tek tıkla ödeme" özelliği için sıra şöyle olur:

1. **IaC**: Yeni bir DynamoDB tablosu ve IAM politikası Terraform PR'ı ile eklenir; plan `+2 create` gösterir, onaylanır, apply edilir.
2. **Kod**: Özellik `one-click-checkout` flag'i arkasında, kapalı hâlde main'e girer; imaj pipeline'dan geçip production'a dağıtılır. Kullanıcı hiçbir şey görmez.
3. **Config & secret**: Tablonun adı ortam değişkeniyle gelir; ödeme sağlayıcısının API anahtarı Secrets Manager'dan IAM rolüyle okunur.
4. **Flag**: Önce çalışanlara, sonra %1, %10, %50, %100. Her adımda hata oranı ve dönüşüm izlenir; sorun olursa kill switch.
5. **Temizlik**: Özellik %100'de birkaç hafta sorunsuz kalınca flag ve eski kod yolu silinir — unutulan flag'ler teknik borçtur.

:::interactive{type="pipeline" stages="terraform-plan,plan-review,terraform-apply,deploy-image,flag-1,flag-10,flag-50,flag-100" failureStage="flag-10" mode="infrastructure"}
Pipeline'ı çalıştırın: önce Terraform plan çıktısını inceleyip onaylayın (bir kaynak "replace" görünüyorsa apply'ı reddetmeyi deneyin). Sonra flag yüzdesini kademeli artırın; %10 adımında hata oranı yükselince kill switch'e basın ve rollback gerekmeden trafiğin eski akışa döndüğünü gözlemleyin.
:::

:::realworld{company="Amazon"}
Amazon'un dahili altyapısında hiçbir production kaynağı konsoldan elle yaratılmaz; her şey **CDK/CloudFormation** ya da dahili IaC araçlarıyla, pipeline üzerinden kurulur ve "kaynak drift'i" otomatik taramalarla raporlanır. Secret'lar için AWS'nin kendi servisleri kullanılır: **Secrets Manager** veritabanı parolalarını 30 günde bir Lambda ile döndürür ve RDS'in IAM kimlik doğrulaması sayesinde birçok servis parola yerine **15 dakikalık imzalı token** ile bağlanır. Feature flag tarafında **AWS AppConfig**, amazon.com'daki özellikleri önce tek bir "one-box" host'a, sonra yüzdelik dilimlerle açar ve CloudWatch alarmı tetiklenirse flag'i **otomatik geri alır** — kod deploy'u ile aynı güvenlik ağı, ama saniyeler içinde. Prime Day'de yeni özelliklerin çoğu haftalar önce production'a deploy edilmiş, ancak o sabah flag ile açılmıştır; sorun çıkaran bir özellik rollback beklemeden kapatılır.
:::

:::callout{tone="tip" title="Mülakat ipuçları"}
- "Altyapıyı nasıl yönetirsiniz?" sorusuna **plan → inceleme → apply → state** döngüsünü ve drift'i anlatın; `-/+ replace` tehlikesinden bahsetmek sizi ayırır.
- Secret sorusunda üç kelime: **merkezi depo, kimlikle erişim, rotasyon**. "Git'te `.env` dosyası" cümlesi kurmayın.
- Feature flag ile canary'yi karıştırmayın: canary **imajı**, flag **davranışı** kademeli açar. İkisinin birlikte kullanıldığını söyleyin.
- Deterministik kullanıcı atamasını (`hash(flag + userId)`) açıklayabilmek, flag sistemini gerçekten anladığınızı gösterir.
:::

:::quiz{src="quiz.json"}
:::

:::next{lesson="f-05-physical-request-path"}
Altyapı tanımlandı, kod dağıtıldı, flag açıldı. Şimdi bir kullanıcı tarayıcıya adresi yazdığında isteğin fiziksel olarak hangi makinelerden, hangi binalardan geçtiğini uçtan uca izleyelim.
:::

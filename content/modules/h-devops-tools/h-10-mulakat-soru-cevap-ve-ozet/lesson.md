---
id: h-10-mulakat-soru-cevap-ve-ozet
slug: mulakat-soru-cevap-ve-ozet
module: h-devops-tools
order: 10
title:
  tr: "CI/CD ve GitHub Actions: Mülakat Soru-Cevap ve Tek Sayfalık Özet"
  en: "CI/CD and GitHub Actions: Interview Q&A and One-Page Summary"
summary:
  tr: "CI/CD ve GitHub Actions bilgini 30 mülakat sorusu ve tek sayfalık özetle pekiştir."
  en: "Reinforce your CI/CD and GitHub Actions knowledge with 30 interview questions and a one-page summary."
durationMinutes: 15
level: intermediate
tags: [interview, ci-cd, github-actions, summary]
prerequisites: [h-09-kalite-izleme-ve-tam-pipeline]
concepts: [continuous-delivery, pipeline, deployment-strategies, secrets, gitops, dora-metrics]
---

Bu ders modülün tekrarıdır. Soru-cevaplara geçmeden önce, önceki derslerde parça parça kurduğumuz akışın tamamına tek bir haritada bakın. Mülakatta "CI/CD sürecinizi anlatın" sorusunun iyi bir cevabı bu haritayı soldan sağa, yukarıdan aşağı anlatmaktır.

:::diagram{src="diagram.svg" alt="CI/CD akışının tek sayfalık haritası: pull request aşamasında tetikleyici, lint, test, güvenlik ve branch protection ile merge; main sonrasında bir kez build edilen SHA etiketli imaj, staging, onay ve dağıtım stratejisiyle production; canlıda izleme, alarm ve rollback; altta hız ve kararlılığı ölçen dört DORA metriği|One-page map of the CI/CD flow: in the pull request stage trigger, lint, test, security and merge with branch protection; after main a SHA-tagged image built once, staging, approval and production with a deployment strategy; in production monitoring, alerting and rollback; at the bottom the four DORA metrics measuring speed and stability"}
Üç şerit, üç soru: kod birleşmeye hazır mı, paket canlıya hazır mı, canlı sağlıklı mı?
:::

## Mülakat soru-cevap

**1. CI/CD nedir?** Kodun otomatik olarak entegre edilmesi, test edilmesi ve canlıya güvenli şekilde çıkarılması sürecidir.

**2. Continuous Delivery ile Continuous Deployment farkı nedir?** Delivery'de canlıya çıkış onay gerektirir; Deployment'ta testleri geçen her değişiklik otomatik çıkar.

**3. Pipeline nedir?** Kodun commit'ten canlıya kadar geçtiği otomatik adımlar zinciridir; bir adım başarısız olursa zincir durur.

**4. GitHub Actions'ta workflow, job ve step farkı nedir?** Workflow YAML dosyasının tamamıdır. Job aynı runner'da çalışan adımlar grubudur. Step tek bir komut veya action'dır.

**5. Job'lar paralel mi çalışır?** Evet, varsayılan olarak paraleldir. Sıra için `needs` kullanılır.

**6. Bir job'daki dosyayı diğer job'a nasıl aktarırsın?** Her job ayrı makinede çalıştığı için artifact (upload/download) ile aktarırım.

**7. Cache ile artifact farkı nedir?** Cache hızlandırma içindir (bağımlılıklar). Artifact çıktıyı saklamak ve job'lar arasında aktarmak içindir.

**8. Secret'ları nasıl yönetirsin?** GitHub Secrets'ta şifreli saklarım; production secret'larını environment seviyesinde tutarım, asla koda yazmam ve loglara basmam.

**9. GITHUB_TOKEN nedir?** Her çalıştırmada otomatik oluşan, çalıştırma bitince geçersiz olan geçici token'dır. İzinleri `permissions` ile kısıtlanır.

**10. Matrix stratejisi ne işe yarar?** Aynı job'u farklı sürüm ve işletim sistemi kombinasyonlarında paralel çalıştırır.

**11. Neden `npm install` yerine `npm ci`?** Lock dosyasına birebir uyar, daha hızlıdır ve tekrarlanabilir kurulum sağlar.

**12. Service container nedir?** Job süresince yanında çalışan PostgreSQL, Redis gibi servislerdir; gerçek veritabanıyla entegrasyon testi sağlar.

**13. Self-hosted runner ne zaman kullanılır ve riski nedir?** Özel ağ erişimi veya özel donanım gerektiğinde. Herkese açık depolarda fork PR'ları sunucunda kod çalıştırabileceği için risklidir.

**14. Blue-Green ile Canary farkı nedir?** Blue-Green trafiği tek seferde yeni ortama çevirir. Canary trafiği kademeli olarak (%5, %25, %100) yeni sürüme verir.

**15. Rolling deployment nedir?** Sunucuların sırayla güncellenmesidir; kesinti olmaz ama bir süre iki sürüm aynı anda çalışır.

**16. Rollback nasıl yapılır?** SHA ile etiketlenmiş önceki image'a dönerim veya git revert ile yeni commit oluştururum. En hızlısı feature flag'i kapatmaktır.

**17. Feature flag nedir?** Kodun canlıda olup özelliğin açılıp kapatılabilmesidir. Deploy ile yayını birbirinden ayırır.

**18. "Build once, deploy many" ne demek?** Paketi bir kez üretip aynı paketi tüm ortamlara çıkarmak; ortamlar arası farkı ortadan kaldırır.

**19. Veritabanı migration'larını CI/CD'de nasıl yönetirsin?** Versiyonlu migration dosyalarıyla, deploy sırasında otomatik, öncesinde yedek alarak ve expand-contract yöntemiyle geriye uyumlu yaparım.

**20. Concurrency neden önemlidir?** Aynı anda iki deploy'un çalışmasını engeller; PR'larda eski çalıştırmaları iptal ederek dakika tasarrufu sağlar.

**21. Reusable workflow ile composite action farkı nedir?** Reusable workflow job'ları tekrar kullanır ve secret alabilir. Composite action step gruplarını tekrar kullanır.

**22. pull_request ile pull_request_target farkı nedir?** `pull_request_target` hedef dalın bağlamında, secret erişimiyle çalışır. Fork'tan gelen kodu bu tetikleyicide çalıştırmak güvenlik açığıdır.

**23. Üçüncü taraf action'ları nasıl güvenli kullanırsın?** Commit SHA ile sabitlerim, izinleri kısıtlarım ve Dependabot ile güncel tutarım.

**24. OIDC ne işe yarar?** Bulut sağlayıcılara uzun ömürlü anahtar saklamadan, her çalıştırmada kısa ömürlü kimlikle erişim sağlar.

**25. Test piramidi nedir?** Çok sayıda hızlı unit test, daha az entegrasyon testi ve en az sayıda E2E testi olması gerektiğini anlatan modeldir.

**26. Flaky test nedir?** Kod değişmeden bazen geçen bazen kalan testtir. Zamanlama ve test bağımlılığından kaynaklanır; güveni azalttığı için hemen düzeltilmelidir.

**27. Smoke test nedir?** Deploy sonrası sistemin temel olarak ayakta olduğunu kontrol eden hızlı testtir (ör. `/health` 200 dönüyor mu).

**28. GitOps nedir?** Canlı ortamın istenen durumunun Git'te tanımlanıp bir aracın ortamı sürekli bu tanıma eşitlemesidir.

**29. DORA metrikleri nelerdir?** Deployment frequency, lead time for changes, change failure rate ve time to restore.

**30. Pipeline'ı nasıl hızlandırırsın?** Cache, paralel job'lar, fail fast sıralaması, `paths` filtresi, concurrency ile iptal ve ağır testleri gece çalıştırma.

## Tek sayfalık özet

| Temel kavramlar |  |
|---|---|
| **CI** | Her push'ta otomatik build + test |
| **Continuous Delivery** | Her an yayınlanabilir; canlı için onay |
| **Continuous Deployment** | Testi geçen her şey otomatik canlıya |
| **Pipeline** | Build → Lint → Test → Güvenlik → Paket → Staging → Canlı |
| **Build once, deploy many** | Tek paket, tüm ortamlar |
| **Fail fast** | Hızlı kontroller önce |

| GitHub Actions |  |
|---|---|
| **Workflow** | .github/workflows/*.yml |
| **on** | push, pull_request, schedule, workflow_dispatch, release |
| **Job / needs** | Paralel çalışır; sıra için needs |
| **Step** | run: komut / uses: action |
| **Runner** | ubuntu-latest, self-hosted |
| **Matrix** | Çoklu sürüm/OS kombinasyonu |
| **Cache / Artifact** | Hızlandırma / çıktı saklama |
| **Secrets / vars** | Gizli / gizli olmayan ayarlar |
| **Environment** | staging, production + onay |
| **Services** | Test için PostgreSQL konteyneri |
| **Concurrency** | Çakışan çalıştırmaları engeller |
| **permissions** | GITHUB_TOKEN için en az yetki |
| **workflow_call** | Reusable workflow |

| Deploy stratejileri |  |
|---|---|
| **Recreate** | Durdur, başlat; kısa kesinti |
| **Rolling** | Sırayla güncelle |
| **Blue-Green** | İki ortam, trafiği çevir |
| **Canary** | Önce trafiğin küçük kısmı |
| **Feature flag** | Deploy ile yayını ayır |
| **Rollback** | Önceki SHA image'ına dön |

| Güvenlik kontrol listesi |
|---|
| Secret'ları koda yazma · permissions kısıtla · action'ları SHA ile sabitle · pull_request_target'a dikkat · Dependabot + CodeQL aç · branch protection kur · production'a onay koy |

:::realworld{company="Google Cloud (DORA)"}
Mülakattaki 29. sorunun cevabı olan DORA metrikleri, bir araştırma programından gelir. DevOps Research and Assessment (DORA) ekibi Nicole Forsgren, Jez Humble ve Gene Kim'in çalışmalarıyla başladı ve 2018'de Google Cloud bünyesine katıldı. Ekip, binlerce kuruluştan toplanan anket verisine dayanan yıllık "State of DevOps" raporlarını yayımlar. Bulgular 2018'de "Accelerate" kitabında da toplandı. Araştırmanın en çok alıntılanan sonucu, hız ile kararlılığın birbirinin karşıtı olmadığıdır. En iyi performans gösteren ekipler hem daha sık dağıtım yapar ve değişikliği daha kısa sürede canlıya taşır, hem de daha düşük hata oranına ve daha kısa geri dönüş süresine sahiptir. Raporlar bu sonucu, bu modülde öğrendiğiniz pratiklerle ilişkilendirir: sürekli entegrasyon, test otomasyonu, küçük partiler hâlinde çalışma, gövde tabanlı geliştirme ve iyi izleme. Mülakatta DORA metriklerini sayarken bu bağlantıyı kurmak, ezber bir listeden daha güçlü bir cevap olur. Örneğin "fail fast ve küçük PR'lar teslim süresini kısaltır, hızlı rollback de geri dönüş süresini düşürür" diyebilirsiniz.
:::

:::callout{tone="info" title="İlgili dersler"}
Bu konuyu başka bir açıdan anlatan dersler:

- [Kodun Yolculuğu ve CI/CD](/lessons/f-02-code-journey-ci-cd)
:::

:::quiz{src="quiz.json"}
:::

:::next{lesson="h-11-grafana-notes"}
:::

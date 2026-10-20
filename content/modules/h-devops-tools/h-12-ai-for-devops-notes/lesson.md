---
id: h-12-ai-for-devops-notes
slug: ai-for-devops-notes
module: h-devops-tools
order: 12
title:
  tr: "DevOps’ta Yapay Zekâ: AIOps, Log Analizi ve Sorumlu Kullanım"
  en: "AI in DevOps: AIOps, Log Analysis and Responsible Use"
summary:
  tr: "Yapay zekayı CI/CD, izleme, olay yönetimi ve bulut maliyetinde güvenle kullanmayı öğren."
  en: "Learn to use AI safely across CI/CD, monitoring, incident response and cloud cost."
durationMinutes: 28
level: intermediate
tags: [ai, aiops, llm, devops, ci-cd, observability, incident-response, finops, github-actions]
prerequisites: [h-06-cicd-temelleri-ve-ilk-workflow, h-11-grafana-notes, g-05-llms]
concepts: [aiops, log-summarization, anomaly-detection, alert-noise-reduction, runbook-assistant, iac-generation, manifest-review, cloud-cost-analysis, coding-assistant, hallucination, data-leakage, human-in-the-loop]
---

## Kavram: AIOps — operasyon verisini modele, kararı insana bırakmak

Bir DevOps ekibinin günü üç tür veriyle geçer: **loglar** (ne oldu), **metrikler** (ne kadar) ve **izler** (hangi yoldan). Sistem büyüdükçe bu veri insanın okuyabileceği hacmi aşar; binlerce satırlık bir CI logu, dakikada yüzlerce alarm ya da yüz sayfalık bir bulut faturası kimsenin tek tek bakabileceği şeyler değildir. **AIOps**, bu operasyon verisini makine öğrenmesi ve büyük dil modelleriyle (LLM) işleyip insana *özet, sıralama ve öneri* olarak sunma yaklaşımıdır.

Burada iki farklı teknolojiyi ayırt etmek gerekir:

1. **Klasik makine öğrenmesi** — zaman serilerinde anomali bulma, alarmları kümeleme, kaynak kullanımını tahmin etme. Sayısal veriyle çalışır, açıklanabilirliği yüksektir, yıllardır izleme araçlarının içindedir.
2. **Büyük dil modelleri** — log, hata mesajı, YAML, Terraform ve runbook gibi *metinleri* okuyup üretir. Son birkaç yılın asıl değişimi budur: artık pipeline'daki başarısız job'un logunu bir model okuyup "testin 42. satırında ortam değişkeni eksik" diyebilir.

Bu dersin ana fikri tek cümleyle özetlenebilir: **yapay zekâ gözlemler, önerir ve hazırlar; üretimi etkileyen kararı insan verir.** Bu ilkeye *human-in-the-loop* (insan döngüde) denir ve dersin sonundaki kontrol listesinin omurgasıdır.

:::diagram{src="diagram.svg" alt="Loglar, metrikler, izler ve bulut faturası bir model katmanına akar; model özet, anomali, öneri ve taslak PR üretir; insan onay kapısından geçen aksiyonlar üretime uygulanır|Logs, metrics, traces and the cloud bill flow into a model layer; the model emits summaries, anomalies, suggestions and draft PRs; only actions that pass the human approval gate reach production"}
Model katmanı veriyi özete çevirir; üretime giden her aksiyon insan onay kapısından geçer.
:::

## CI/CD'de LLM: log özetleme, hata açıklama, test üretimi

CI/CD, yapay zekânın en hızlı değer ürettiği yerdir çünkü girdiler metindir ve geri bildirim döngüsü kısadır.

**Log özetleme.** Başarısız bir job'un logu genellikle birkaç bin satırdır; hata çoğu zaman ortadaki bir yerde, stack trace'in beş satır üstündedir. Bir model loga bakıp üç cümlelik bir özet çıkarabilir: hangi adım düştü, muhtemel neden ne, ilk bakılacak dosya hangisi. Bu özet pull request'e yorum olarak yazıldığında geliştirici logu açmadan sorunu görür.

**Hata açıklama.** `ECONNREFUSED 127.0.0.1:5432` gibi bir satırı ilk kez gören biri için model, "test aşaması Postgres servisine bağlanamadı; workflow'da `services:` bloğu ya da `DATABASE_URL` eksik olabilir" diyerek bağlam sağlar. Model doğrudan düzeltmez; nereye bakılacağını söyler.

**Test üretimi.** Bir fonksiyon verildiğinde model sınır durumları ve negatif senaryoları listeleyip test iskeleti yazabilir. Faydası, insanın aklına gelmeyen boş liste, negatif sayı, Unicode gibi girdileri hatırlatmasıdır. Tehlikesi, üretilen testin kodun *mevcut* davranışını doğru kabul etmesidir: yanlış çalışan kodu "doğru" diye kilitleyen test, test değildir. Üretilen her test önce okunmalı, sonra bilerek bozulan bir kodla gerçekten kırıldığı görülmelidir.

Aşağıdaki workflow, bu fikrin en küçük uygulanabilir hâlidir: ana job düşerse ikinci bir job başarısız adımların logunu çeker, gizli değerleri maskeler, bir LLM API'sine yollar ve özeti PR'a yorum olarak bırakır.

:::code{lang="yaml" title="GitHub Actions: başarısız job loglarını LLM ile özetleyip PR'a yorum bırakmak"}
```yaml
name: ci
on: [pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: npm ci
      - run: npm test

  explain-failure:
    needs: test
    if: failure()                       # yalnızca test job'u düştüğünde çalışır
    runs-on: ubuntu-latest
    permissions:
      actions: read                     # logları okumak için
      pull-requests: write              # yorum yazmak için
    steps:
      - name: Başarısız adımların logunu çek
        env:
          GH_TOKEN: ${{ github.token }}
        run: |
          gh run view ${{ github.run_id }} --repo ${{ github.repository }} \
            --log-failed | tail -n 400 > failed.log

      - name: Gizli değerleri maskele
        run: |
          # token, parola ve anahtar benzeri değerleri modele göndermeden önce sil
          sed -E 's/(token|password|secret|key)[=:][^ ]+/\1=***/Ig' failed.log > safe.log

      - name: LLM'den özet iste
        env:
          LLM_API_URL: ${{ secrets.LLM_API_URL }}
          LLM_API_KEY: ${{ secrets.LLM_API_KEY }}
        run: |
          PROMPT="Aşağıdaki CI logunu oku. 1) Hangi adım neden düştü? 2) İlk bakılacak dosya/komut? En fazla 5 cümle, Türkçe."
          jq -n --arg p "$PROMPT" --rawfile log safe.log \
            '{prompt: ($p + "\n\n" + $log), max_tokens: 300}' \
          | curl -sS "$LLM_API_URL" -H "Authorization: Bearer $LLM_API_KEY" \
              -H "Content-Type: application/json" -d @- \
          | jq -r '.text' > summary.md

      - name: PR'a yorum bırak
        env:
          GH_TOKEN: ${{ github.token }}
        run: |
          { echo "### CI hata özeti (yapay zekâ taslağı — doğrulayın)"; cat summary.md; } \
            | gh pr comment ${{ github.event.pull_request.number }} --body-file -
```
:::

Workflow'daki iki ayrıntı tesadüf değildir: `permissions` bloğu job'un yalnızca ihtiyacı kadar yetki almasını sağlar ve maskeleme adımı loglar modele gitmeden *önce* çalışır. Yorum başlığındaki "taslak — doğrulayın" ifadesi de bilinçlidir; özet bir ipucudur, hüküm değildir.

:::interactive{type="pipeline" stages="lint,test,build,deploy-staging,deploy-prod" failureStage="build" retries=1}
Pipeline'ı çalıştırıp beş aşamanın sırayla geçişini izleyin. "Hata enjekte et" kutusunu işaretleyin (aşama: build) ve yeniden çalıştırın: build aşaması bir yeniden denemeden sonra da geçmezse deploy-staging ve deploy-prod "atlandı" kalır. Yukarıdaki workflow'daki `explain-failure` job'u tam bu anda devreye girer; yeniden deneme sayısını 0'a çekip geçici (flaky) bir hatanın tek denemeyle pipeline'ı nasıl durdurduğunu karşılaştırın.
:::

## Anomali tespiti ve alarm gürültüsünü azaltmak

Klasik uyarı kuralı "CPU %80'i geçerse alarm ver" der. Sorun, normalin sabit olmamasıdır: gece 03:00'te %40 CPU anormal olabilirken kampanya gününde %85 beklenen değerdir. **Anomali tespiti**, bir metriğin kendi geçmişinden (günün saati, haftanın günü, mevsimsellik) bir *beklenti bandı* öğrenir ve yalnızca bu bandın dışına çıkan değerleri işaretler. Böylece eşik değeri elle ayarlama işi ortadan kalkar; yanlış pozitifler azalır çünkü kıyas noktası "sabit bir sayı" değil "bu saatte normalde ne olur" sorusudur.

**Alarm gürültüsü** ise ayrı bir derttir. Veritabanı yavaşladığında ona bağımlı API'ler, API'lere bağımlı ön yüz ve hepsinin sentetik kontrolleri aynı dakikada alarm üretir; nöbetçi otuz bildirim görür ama sorun tektir. Modern izleme araçları bu alarmları **ilişkilendirir** (correlation): zaman yakınlığına, servis bağımlılık grafiğine ve geçmişte birlikte görülme sıklığına bakarak otuz alarmı tek bir olaya indirger ve "ilk düşen" bileşeni kök neden adayı olarak öne çıkarır. Burada LLM'in rolü, bu kümeye başlık ve düz dille açıklama yazmaktır: "Sipariş servisi, Postgres bağlantı havuzunun dolmasından 40 saniye sonra hata vermeye başladı."

:::callout{tone="info" title="Gürültüyü azaltmanın ucuz yolu"}
Yapay zekâ olmadan da alarm hijyeni mümkündür: her alarmın bir sahibi ve bir runbook'u olmalı, bir aydır kimsenin aksiyon almadığı alarm silinmeli, sebep-sonuç ilişkisi bilinen alarmlar (DB düşünce API'nin düşmesi) tek alarma bağlanmalıdır. Model, temiz bir alarm kümesi üzerinde çok daha iyi çalışır; çöp girdiden içgörü çıkmaz.
:::

## Olay yönetiminde runbook asistanı

Gece 03:00'te uyandırılan nöbetçinin ihtiyacı yaratıcılık değil, doğru belgeye hızlı erişimdir. **Runbook asistanı**, ekibin kendi runbook'larını, geçmiş olay raporlarını ve mimari dokümanlarını indekslemiş bir LLM uygulamasıdır (RAG yaklaşımı). Alarm geldiğinde asistan şunları yapabilir:

- Alarmla eşleşen runbook'u bulup ilgili bölümü özetlemek,
- Geçmişte benzer belirtilerle açılmış olayları ve çözümlerini listelemek,
- Olay kanalındaki konuşmayı izleyip zaman çizelgesi (timeline) taslağı tutmak,
- Olay kapandığında postmortem iskeletini doldurmak.

Burada sınır nettir: asistan *öneriyi* üretir, `kubectl rollout undo` komutunu nöbetçi çalıştırır. Otomatik düzeltme (auto-remediation) yalnızca sonucu iyi bilinen, geri alınabilir ve kapsamı dar aksiyonlar için uygundur: pod'u yeniden başlatmak, bir replikayı havuzdan çıkarmak, önbelleği temizlemek gibi. Veritabanı şemasına dokunan ya da trafik yönlendiren bir aksiyon hiçbir zaman onaysız olmamalıdır.

## IaC ve Kubernetes manifest üretimi ve denetimi

Terraform modülü ya da Kubernetes manifest'i yazmak büyük ölçüde kalıp işidir ve modeller bu kalıpları iyi bilir. "Üç replikalı, sağlık kontrollü, kaynak limitli bir Deployment yaz" isteği saniyeler içinde kullanılabilir bir taslak üretir. Asıl değer ise **denetimde** ortaya çıkar: model bir manifest'i okuyup eksik `resources.limits`, `latest` etiketi, root olarak çalışan konteyner ya da herkese açık bir S3 bucket gibi klasik hataları işaretleyebilir.

Aşağıdaki örnek, bir modelin ürettiği taslağı ve inceleme sırasında eklenen düzeltmeleri bir arada gösterir. Yorum satırları gözden geçirme notlarıdır; üretilen YAML'ın "çalışıyor" olması ile "üretime uygun" olması arasındaki farkı gösterirler.

:::code{lang="yaml" title="Üretilen Deployment taslağı ve inceleme notları"}
```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: orders-api
spec:
  replicas: 3
  selector:
    matchLabels: { app: orders-api }
  template:
    metadata:
      labels: { app: orders-api }
    spec:
      securityContext:
        runAsNonRoot: true            # inceleme: taslakta yoktu, eklendi
      containers:
        - name: api
          image: registry.example.com/orders-api:1.14.2   # inceleme: "latest" → sabit sürüm
          ports: [{ containerPort: 8080 }]
          resources:
            requests: { cpu: "250m", memory: "256Mi" }
            limits:   { cpu: "500m", memory: "512Mi" }    # inceleme: limit eksikti
          readinessProbe:
            httpGet: { path: /health/ready, port: 8080 }
            periodSeconds: 5
          livenessProbe:
            httpGet: { path: /health/live, port: 8080 }   # inceleme: liveness derin kontrole bağlanmamalı
            periodSeconds: 10
          env:
            - name: DATABASE_URL
              valueFrom:
                secretKeyRef: { name: orders-db, key: url }   # inceleme: taslak düz metin yazmıştı
```
:::

Pratik kural: üretilen IaC kodu, insan yazmış gibi aynı yoldan geçer — `terraform plan` çıktısı okunur, `kubeconform` ve politika araçları (OPA/Conftest, Kyverno) çalışır, PR incelenir. Modelin ürettiği `plan` çıktısını yine modele özetletmek de yaygın ve faydalı bir kullanımdır: "bu plan 2 kaynak siliyor, 1 güvenlik grubunu herkese açıyor" cümlesi, 400 satırlık diff'ten daha çabuk okunur.

## Bulut maliyet analizi

Bulut faturası, yapılandırılmış ama devasa bir veridir: hesap, servis, bölge, etiket ve saat kırılımında milyonlarca satır. Yapay zekânın burada üç işi vardır. **Anomali**: dün gece 02:00'de başlayan ve açıklanamayan veri çıkış (egress) maliyeti artışını fark etmek. **Doğru boyutlandırma (right-sizing)**: iki haftadır %8 CPU'da çalışan büyük bir sanal makine için daha küçük bir tür önermek ve tasarrufu tahmin etmek. **Doğal dilde sorgu**: "geçen ay staging ortamı neden %30 pahalandı?" sorusunu maliyet verisi üzerinde SQL'e çevirip yanıtlamak.

Unutulmaması gereken nokta, right-sizing'in tek seferlik bir temizlik değil sürekli bir döngü olmasıdır. İş yükü değişir, trafik mevsimseldir, dün küçültülen makine önümüzdeki kampanyada yetmeyebilir. Öneriler düzenli gözden geçirilir ve uygulamadan önce performans etkisi staging'de ölçülür.

## Kodlama asistanları

IDE içindeki asistanlar (satır tamamlama, sohbet, ajan modu) DevOps mühendisinin günlük işinin büyük kısmına dokunur: shell betiği, Dockerfile, Helm chart, Ansible playbook, PromQL sorgusu. Verim artışı gerçektir ama iki noktada dikkat ister. Birincisi, asistan *kabul edilen* kodun sorumluluğunu almaz; bir `rm -rf "$DIR/"` satırında `DIR` boş kalırsa sonuç yine sizindir. İkincisi, asistanlar genellikle bağlam olarak açık dosyaları ve bazen deponun tamamını okur; `.env` dosyaları ve anahtarlar bu bağlamın dışında tutulmalıdır.

Aşağıdaki küçük yardımcı, loglar ya da yapılandırma dosyaları bir modele gönderilmeden önce gizli değerleri maskelemek için kullanılabilecek türden bir koddur. Önemli olan desenlerin tamlığı değil, bu adımın **her zaman** modele giden yolun üstünde olmasıdır.

:::code{lang="python" title="Modele göndermeden önce gizli değerleri maskelemek"}
```python
import re

PATTERNS = [
    r"(?i)(token|password|passwd|secret|api[_-]?key)\s*[=:]\s*\S+",   # KEY=value çiftleri
    r"AKIA[0-9A-Z]{16}",                                             # AWS access key id
    r"eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}",  # JWT
    r"-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?-----END [A-Z ]*PRIVATE KEY-----",
]

def redact(text: str) -> str:
    """Gizli görünen her şeyi *** ile değiştirir; şüphede kalınca maskeler."""
    for p in PATTERNS:
        text = re.sub(p, "***", text)
    return text

if __name__ == "__main__":
    import sys
    sys.stdout.write(redact(sys.stdin.read()))
```
```bash
# Kullanım: ham logu maskeleyip özet isteğine ekle
cat failed.log | python redact.py > safe.log
```
:::

## Riskler: halüsinasyon, gizli veri sızıntısı, aşırı güven

**Halüsinasyon.** Model, var olmayan bir Terraform argümanı, yanlış bir `kubectl` bayrağı ya da hiç yaşanmamış bir "benzer olay" uydurabilir ve bunu aynı kendinden emin tonla söyler. Operasyonda bu, yanlış teşhisle 20 dakika kaybetmek ya da yanlış kaynağı silmek demektir. Panzehir, modelin çıktısının her zaman *doğrulanabilir* bir biçimde sunulmasıdır: kaynak belgeye bağlantı, çalıştırılabilir ama henüz çalıştırılmamış komut, uygulanmamış diff.

**Gizli veri sızıntısı.** Loglar parola, token ve kişisel veri içerir; CI ortam değişkenleri anahtar taşır. Bunları harici bir modele göndermek, veriyi üçüncü tarafa vermektir. Maskeleme, veri işleme sözleşmesi olan sağlayıcılar ya da kendi altyapınızda çalışan modeller bu riskin cevaplarıdır.

**Aşırı güven.** En sinsi risk budur: model çoğunlukla haklı çıktıkça insanlar okumayı bırakır. "Yapay zekâ özetledi, ben de onayladım" cümlesi, onayın anlamsızlaştığı andır. Çözüm teknik değil kültüreldir: önerinin yanına her zaman "neye dayanarak" bilgisini koymak ve kritik aksiyonlarda ikinci bir göz istemek.

:::callout{tone="warning" title="Üretim verisi modele gitmeden önce"}
Herkese açık bir sohbet arayüzüne üretim logu yapıştırmak, o logu bir daha geri alamayacağınız bir yere kopyalamaktır. Ekip kuralı basit olmalı: harici bir modele giden her metin önce otomatik maskelemeden geçer, veri sınıflandırması "gizli" olan hiçbir şey (müşteri verisi, anahtarlar, iç IP planı) hiçbir koşulda dışarı çıkmaz. Kural yazılı olmalı ve CI'da uygulanmalı; iyi niyete bırakılmamalı.
:::

## Sorumlu kullanım kontrol listesi

Bir yapay zekâ özelliğini DevOps sürecine eklemeden önce şu soruların hepsine "evet" diyebilmelisiniz:

1. **Okuma mı, yazma mı?** Özellik yalnızca özetliyor/öneriyor mu, yoksa altyapıyı değiştiriyor mu? Yazma yetkisi varsa onay kapısı tanımlı mı?
2. **Veri nereye gidiyor?** Model nerede çalışıyor, sağlayıcı veriyi saklıyor mu, maskeleme otomatik mi?
3. **Çıktı doğrulanabilir mi?** Özetin yanında kaynak log satırı, önerinin yanında diff var mı?
4. **Geri alınabilir mi?** Otomatik aksiyonun geri alma yolu belli ve test edilmiş mi?
5. **Ölçüyor musunuz?** Modelin önerisi kaç kez doğru çıktı, kaç kez yanılttı? Bu oran izlenmiyorsa güven kör güvendir.
6. **Yetki en az mı?** Modeli çağıran job ya da ajan, ihtiyacından fazla izin taşıyor mu?
7. **İnsan hâlâ öğreniyor mu?** Ekipteki yeni mühendis, asistan olmadan da logu okuyabiliyor mu? Beceri erimesi uzun vadeli bir risktir.

:::realworld{company="Datadog"}
Datadog'un **Watchdog** özelliği, metrik ve log akışlarında kullanıcı eşik tanımlamadan anomali ve aykırı değer arar; servis bağımlılık haritasını kullanarak aynı kök nedene bağlı belirtileri tek bir olayda toplar. Bunun üstüne gelen **Bits AI** katmanı, olay kanalında doğal dille soru sormaya, olay özetini ve zaman çizelgesini otomatik üretmeye yarar. Tasarımın dikkat çeken yanı, aksiyonların öneri olarak sunulmasıdır: sistem "bu dağıtımı geri almayı düşünün" der, geri alma düğmesine insan basar. Bu, dersin başındaki ilkenin ticari bir üründe somutlaşmış hâlidir.
:::

:::callout{tone="tip" title="Mülakat özeti"}
- AIOps'u tek cümleyle tanımlayın: "operasyon verisini modelle işleyip özet ve öneriye çevirmek; kararı insanda tutmak."
- Somut üç kullanım sayın: başarısız CI logunu özetleme, alarm ilişkilendirme, IaC denetimi.
- Üç riski ve her birinin panzehirini söyleyin: halüsinasyon → doğrulanabilir çıktı; sızıntı → maskeleme ve özel model; aşırı güven → onay kapısı ve ölçüm.
- "Otomatik düzeltmeyi nerede açarsınız?" sorusuna: geri alınabilir, dar kapsamlı, sonucu bilinen aksiyonlarda.
:::

:::quiz{src="quiz.json"}
:::

:::next{lesson="i-01-how-apis-are-created-and-called"}
DevOps modülü burada bitiyor. Sıradaki modül API, SQL ve test: ilk derste bir API'nin nasıl tanımlandığını ve bir çağrının istemciden sunucuya hangi yoldan geçtiğini göreceksiniz.
:::

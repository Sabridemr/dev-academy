---
id: n-07-threat-modeling
slug: threat-modeling
module: n-auth-security
order: 7
title:
  tr: "Tehdit Modelleme ve Güvenli Tasarım"
  en: "Threat Modelling and Secure Design"
summary:
  tr: "STRIDE, saldırı yüzeyi, güven sınırları, gizli bilgi yönetimi ve tedarik zinciri güvenliği."
  en: "STRIDE, attack surface, trust boundaries, secrets management and supply-chain security."
durationMinutes: 35
level: advanced
tags: [threat-modeling, stride, secure-design, secrets, supply-chain, security]
prerequisites: [n-06-cryptography-basics, f-07-security-layers, f-04-iac-config-secrets-flags, f-08-devacademy-architecture]
concepts: [threat-modeling, stride, trust-boundary, data-flow-diagram, attack-surface, risk-prioritization, secrets-management, supply-chain-security]
---

## Kavram: saldırgandan önce düşünmek

Bu modülün önceki altı dersinde tek tek savunmalar öğrendik: çerez öznitelikleri, JWT doğrulaması, PKCE, varsayılan ret, parametreli sorgu, argon2id, AEAD. Ama hiçbir ekip her yere her savunmayı koyacak zamana sahip değildir ve bir savunmanın gerçekten gerekip gerekmediğini bilmeden eklenen kontroller hem maliyet hem karmaşıklık üretir. **Tehdit modelleme**, bu savunmaları nereye ve hangi öncelikle koyacağımıza karar vermenin yapılandırılmış yoludur.

OWASP dersinde gördüğümüz "güvensiz tasarım" kategorisi bu yüzden vardır: bazı zafiyetler kodda değil kararlardadır ve ancak tasarım masasında, kod yazılmadan önce yakalanabilir. Tehdit modelleme bir güvenlik uzmanının tek başına yaptığı bir denetim değil, bir özelliği tasarlayan ekibin birlikte yaptığı bir egzersizdir. Yaygın kabul gören çerçeve dört basit soruya dayanır:

1. **Ne üzerinde çalışıyoruz?** Sistemin bir modelini çiz: bileşenler, veri akışları, veri depoları ve güven sınırları.
2. **Ne ters gidebilir?** Model üzerinde, sistematik bir kontrol listesiyle tehditleri bul.
3. **Bununla ilgili ne yapacağız?** Her tehdit için azalt, kabul et, aktar ya da ortadan kaldır kararı ver.
4. **İyi bir iş çıkardık mı?** Kararları doğrula: testler, inceleme, olay sonrası gözden geçirme.

Bu soruların gücü, güvenliği bir "hissiyat" olmaktan çıkarıp gözden geçirilebilir bir belgeye dönüştürmeleridir. Altı ay sonra yeni katılan bir mühendis, "neden bu uç noktada ayrı bir hız sınırı var?" sorusunun cevabını tehdit modelinde bulabilir.

## Modeli çizmek: veri akışı ve güven sınırları

Tehdit modellemenin ilk ürünü bir **veri akış diyagramıdır (DFD)**. Beş öğesi vardır: kontrolünüz dışındaki **dış varlıklar** (kullanıcı, üçüncü taraf servis), veriyi işleyen **süreçler** (API, arka plan işçisi), veriyi tutan **depolar** (veritabanı, önbellek, nesne deposu), bunlar arasındaki **veri akışları** ve en önemlisi **güven sınırları**.

Güven sınırı, iki tarafın farklı güven seviyelerinde olduğu her çizgidir: internet ile sizin sunucunuz, uygulama süreci ile veritabanı, sizin altyapınız ile bir kimlik sağlayıcısı, yönetici paneli ile kullanıcı arayüzü. Tehditlerin büyük çoğunluğu bir veri akışının bir güven sınırını geçtiği noktada yaşar; çünkü orada bir tarafın diğerinin verisine körü körüne güvenme eğilimi vardır. Bu yüzden diyagramda en dikkatli çizilmesi gereken şey kutular değil, kesik çizgili sınırlardır.

:::diagram{src="diagram.svg" alt="Bu platformun güven sınırı diyagramı: internetteki tarayıcı ve mobil uygulama, kenar katmanında web sunucusu, uygulama bölgesinde API ve arka plan işleri, veri bölgesinde PostgreSQL, Redis ve nesne deposu; dışarıda Google ve Apple kimlik sağlayıcıları ile push ve e-posta servisleri. Her sınır geçişinde numaralı tehdit noktaları|Trust boundary diagram for this platform: browser and mobile app on the internet, the web server at the edge, the API and background jobs in the application zone, PostgreSQL, Redis and object storage in the data zone; outside, Google and Apple identity providers plus push and email services. Numbered threat points at every boundary crossing"}
Kesik çizgiler güven sınırlarıdır; numaralı noktalar aşağıdaki tehdit tablosundaki satırlara karşılık gelir.
:::

## STRIDE: ne ters gidebilir?

"Ne ters gidebilir?" sorusunu boş bir sayfayla cevaplamak zordur ve sonuç kişiden kişiye değişir. **STRIDE**, her DFD öğesine sorulacak altı tehdit kategorisini veren bir anımsatıcıdır. Her kategori, korumak istediğimiz bir güvenlik özelliğinin ihlalidir:

| Harf | Tehdit | İhlal edilen özellik | Örnek | Tipik savunma |
|---|---|---|---|---|
| **S** | Spoofing (kimlik taklidi) | Kimlik doğrulama | Çalınmış token ile başkası gibi davranmak | Güçlü kimlik doğrulama, kısa ömürlü token, MFA |
| **T** | Tampering (kurcalama) | Bütünlük | JWT gövdesinde rolü değiştirmek, yoldaki isteği değiştirmek | İmza, MAC, TLS, AEAD |
| **R** | Repudiation (inkâr) | İnkâr edilemezlik | "O ödemeyi ben onaylamadım" | Değiştirilemez denetim kaydı, imzalı işlemler |
| **I** | Information disclosure (bilgi sızması) | Gizlilik | IDOR ile başkasının faturası, hata mesajında yığın izi | Erişim kontrolü, şifreleme, en az veri |
| **D** | Denial of service (hizmet engelleme) | Erişilebilirlik | Giriş uç noktasını boğmak, pahalı sorgu tetiklemek | Hız sınırı, kota, zaman aşımı, otomatik ölçekleme |
| **E** | Elevation of privilege (yetki yükseltme) | Yetkilendirme | Toplu atamayla `role: admin` yazmak | Varsayılan ret, sunucu tarafı yetki, en az ayrıcalık |

Pratik bir kural, her öğe türüne hangi kategorilerin özellikle uygulandığıdır: dış varlıklar en çok kimlik taklidi ve inkâr tehdidi taşır; süreçler altı kategorinin tamamına açıktır; veri depoları kurcalama, bilgi sızması ve hizmet engellemeye; veri akışları ise kurcalama, bilgi sızması ve hizmet engellemeye açıktır. Bu eşleme, büyük bir diyagramda kontrol listesini yönetilebilir tutar.

## Örnek tehdit modeli: bu platform

Somut olmak için bu platformun kendisini modelleyelim. Sistem kabaca şöyledir: tarayıcı ve mobil istemciler internetten bağlanır; web istemcisi sunucu taraflı render yapan bir web sunucusundan gelir; tüm veri işlemleri bir API üzerinden yapılır; API PostgreSQL'e, Redis'e (önbellek, hız sınırı sayaçları, kimlik durumu önbelleği) ve bir nesne deposuna konuşur; sosyal giriş için Google ve Apple'ın ID token'larını doğrular; bildirimler için push ve e-posta servislerini çağırır. Diyagramdaki numaralı noktalar için seçilmiş tehditler:

| # | Nokta | STRIDE | Tehdit | Mevcut azaltım | Risk |
|---|---|---|---|---|---|
| 1 | Tarayıcı → web | I, T | Enjekte edilmiş betikle token sızdırma | Access token yalnızca bellekte, refresh HttpOnly çerezde; nonce'lu CSP; içerik SVG'leri DOMPurify ile temizlenir | Orta |
| 2 | İstemci → API `/auth/login` | S, D | Kaba kuvvet ve kimlik bilgisi doldurma | Redis'te paylaşılan hız sınırı, argon2id, genel hata mesajı, eşit yanıt süresi | Orta |
| 3 | İstemci → API `/auth/refresh` | S | Çalınmış refresh token'ın yeniden kullanımı | Rotasyon + aile iptali; DB'de yalnızca SHA-256 özeti | Düşük |
| 4 | İstemci → API yönetim uç noktaları | E | Editör olmayan kullanıcının içerik düzenlemesi | Rol koruyucusu, rol token'dan değil güncel kullanıcı durumundan | Düşük |
| 5 | İstemci → API kullanıcı verisi | I | IDOR ile başka kullanıcının ilerlemesini okumak | Sorgular token'daki kullanıcı kimliğiyle yapılır | Düşük |
| 6 | API → Google/Apple | S | Başka uygulama için alınmış ID token ile giriş | JWKS imza doğrulaması, `aud` istemci kimlikleri listesiyle | Düşük |
| 7 | API → PostgreSQL | T, I | SQL enjeksiyonu, sızan yedek | ORM ile parametreli sorgu; şifre ve token'lar hash'li | Orta |
| 8 | Geliştirici → depo / CI | I, T | Sızan gizli bilgi, zararlı bağımlılık | `.env` git dışında, ortam şeması doğrulaması, kilit dosyası, CI'da tarama | Orta |

Bu tablodaki "Risk" sütunu, olasılık ve etkinin kabaca bir birleşimidir. Puanlama sistemleri (olasılık × etki matrisleri gibi) faydalıdır, ama asıl değer sayıda değil, ekibin tehditleri **karşılaştırmalı** konuşabilmesindedir. Yüksek riskli satırlar bir sonraki sprintte ele alınır; düşük riskli ama ucuz azaltımı olanlar hemen yapılır; kabul edilen riskler gerekçesiyle yazılır.

Tablonun dikkat çekici bir sonucu, en riskli satırların çoğunun kodun "iş mantığı" kısmında değil, **sınırlarda** olmasıdır: kimlik doğrulama uç noktaları, dış sağlayıcılar ve geliştirme süreci. 8 numaralı satır özellikle önemlidir, çünkü saldırı yüzeyinin üretim sunucusuyla sınırlı olmadığını, kodun yazıldığı ve derlendiği her yeri kapsadığını hatırlatır.

## Saldırı yüzeyini küçültmek

**Saldırı yüzeyi**, bir saldırganın sisteme veri gönderebildiği ya da sistemden veri alabildiği tüm noktaların toplamıdır: açık portlar, HTTP uç noktaları, dosya yükleme alanları, yönetim arayüzleri, webhook alıcıları, hatta destek ekibinin kullandığı iç araçlar. Her yeni giriş noktası, korunması gereken yeni bir kapıdır.

En ucuz güvenlik önlemi, var olmayan bir kapıdır. Kullanılmayan uç noktaları kaldırmak, API dokümantasyon arayüzünü üretimde kapatmak (bu platformda yapıldığı gibi), yönetim arayüzlerini ayrı bir ağ ya da kimlik katmanının arkasına koymak, veritabanı ve önbelleği internetten erişilemez bir ağ bölümünde tutmak ve hata ayıklama özelliklerini derleme anında çıkarmak, savunma eklemekten çoğu zaman daha etkilidir. Tehdit modelinin her güncellenmesinde "bu giriş noktasına gerçekten ihtiyacımız var mı?" sorusu sorulmalıdır.

## Gizli bilgi yönetimi

Veritabanı parolaları, JWT sırları, üçüncü taraf API anahtarları ve bulut erişim anahtarları, sistemin geri kalanındaki tüm savunmaları atlatmanın en kısa yoludur. Çoğu ciddi sızıntının kökeninde gelişmiş bir saldırı değil, yanlış yerde unutulmuş bir anahtar vardır: herkese açık bir depoya gönderilmiş `.env` dosyası, bir log satırına basılmış bağlantı dizesi, bir ekran görüntüsünde görünen token.

Sağlam bir gizli bilgi yönetimi şu ilkelere dayanır:

- **Kod ve sırlar ayrıdır.** Kaynak kodu yalnızca değişken adlarını bilir; değerler çalışma anında ortamdan ya da bir gizli bilgi yöneticisinden gelir. Depoda yalnızca değerleri olmayan bir `.env.example` bulunur.
- **Açılışta doğrulama.** Uygulama açılırken tüm yapılandırmayı bir şemayla doğrular; eksik ya da zayıf bir sır (örneğin 32 karakterden kısa bir JWT sırrı) uygulamanın çalışmasını durdurur. Bu platformun API'si bunu tam olarak böyle yapar.
- **Merkezî yönetim.** Üretim sırları bir gizli bilgi yöneticisinde (bulut sağlayıcısının servisi ya da Vault gibi bir araç) durur; erişim IAM ile sınırlanır ve kaydedilir.
- **Kısa ömür ve rotasyon.** Mümkün olan yerde statik anahtar yerine kısa ömürlü, otomatik yenilenen kimlik bilgileri kullanılır (örneğin CI'ın bulut sağlayıcısına OIDC ile bağlanması). Statik sırlar düzenli olarak ve her şüpheli olayda döndürülür.
- **Tarama.** Depoya gönderilmeden önce ve CI'da, kod ve geçmiş gizli bilgi kalıplarına karşı taranır.

:::callout{tone="warning" title="Git geçmişi unutmaz"}
Yanlışlıkla depoya gönderilen bir sırrı sonraki bir commit ile silmek, onu geçmişten silmez; depoyu klonlayan herkes eski commit'lerde sırrı bulabilir. Herkese açık depolarda otomatik tarayıcılar yeni sırları dakikalar içinde bulur. Doğru tepki her zaman aynıdır: önce sırrı **iptal edip döndürün**, sonra geçmişi temizlemeyi düşünün. Geçmişi temizlemek, sızmış bir sırrı tekrar gizli yapmaz.
:::

## Tedarik zinciri güvenliği

Modern bir web uygulamasında çalışan kodun büyük çoğunluğu, ekibin yazmadığı bağımlılıklardır. Bu bağımlılıkların her biri, kendi bakımcıları, kendi bağımlılıkları ve kendi yayın süreçleriyle birer güven ilişkisidir. Tedarik zinciri saldırıları bu güveni hedefler: bakımcı hesabının ele geçirilip zararlı bir sürüm yayımlanması, popüler bir paket adına çok benzeyen sahte paketler (typosquatting), kurulum sırasında çalışan betiklerle geliştirici makinesinden ya da CI'dan sır çalınması, ya da derleme sunucusunun kendisinin ele geçirilmesi.

Savunmalar katmanlıdır:

- **Kilit dosyası ve tekrarlanabilir kurulum.** Tüm bağımlılık ağacı, sürümleri ve bütünlük özetleriyle kilit dosyasına yazılır; CI kilit dosyasını değiştirmeye izin vermeyen kurulum modunu kullanır.
- **Bilinen açık taraması.** Bağımlılıklar bilinen zafiyet veritabanlarına karşı CI'da taranır; yüksek önem dereceli bir açık derlemeyi durdurur. Otomatik güncelleme araçları yamaları küçük ve düzenli çekme isteklerine böler.
- **Yeni bağımlılık disiplini.** Yeni bir paket eklemek bir kod incelemesi konusudur: bakımı sürüyor mu, kaç kişi kullanıyor, gerçekten gerekli mi, kurulum betiği var mı?
- **CI'ın kendisini korumak.** CI eylemleri değiştirilebilir etiketlerle değil, sabit commit özetleriyle sabitlenir; iş akışlarına yalnızca gereken izinler verilir; çatallanmış depolardan gelen çekme isteklerine sır verilmez.
- **Kaynak ve imza.** Derleme çıktıları imzalanır ve hangi kaynaktan, hangi süreçle üretildikleri (provenance) kaydedilir; bir yazılım malzeme listesi (SBOM), bir açık duyurulduğunda "bundan etkileniyor muyuz?" sorusunu dakikalar içinde cevaplatır.

:::code{lang="ts" title="Gizli bilgi yönetimi: açılışta şema doğrulaması ve git dışı ortam dosyaları"}
```ts
// config/env.ts — sırlar koddan değil ortamdan gelir; zayıf ya da eksikse uygulama başlamaz
import { z } from 'zod';

const EnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  DATABASE_URL: z.string().url(),
  JWT_ACCESS_SECRET: z.string().min(32, 'JWT_ACCESS_SECRET en az 32 karakter olmalı'),
  GOOGLE_CLIENT_IDS: z.string().default(''),        // boşsa sosyal giriş kapalı
});

export const env = (() => {
  const parsed = EnvSchema.safeParse(process.env);
  if (!parsed.success) {
    // Değerleri DEĞİL, yalnızca hangi anahtarın hatalı olduğunu yaz
    console.error(parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('\n'));
    process.exit(1);
  }
  return parsed.data;
})();
```
```ini
# .gitignore — gerçek değerler depoya girmez, yalnızca şablon girer
.env
.env.local
.env.*
!.env.example

# .env.example — anahtar adları ve güvenli yer tutucular, gerçek değer yok
DATABASE_URL=postgresql://user:password@localhost:5432/app
JWT_ACCESS_SECRET=change-me-to-at-least-32-random-characters
GOOGLE_CLIENT_IDS=
```
:::

:::code{lang="yaml" title="CI'da bağımlılık ve gizli bilgi taraması"}
```yaml
name: security
on: [pull_request]

permissions:
  contents: read                     # iş akışına en az yetki

jobs:
  scan:
    runs-on: ubuntu-latest
    steps:
      # Eylemler değişebilen etiketle değil, sabit commit özetiyle sabitlenir
      - uses: actions/checkout@<tam-commit-sha>
        with:
          fetch-depth: 0             # geçmişteki commit'ler de taransın

      - uses: pnpm/action-setup@<tam-commit-sha>
      - run: pnpm install --frozen-lockfile   # kilit dosyası dışına çıkma

      # Bilinen açıklar: yüksek ve kritik önemde derlemeyi durdur
      - run: pnpm audit --audit-level=high --prod

      # Depoya sızmış gizli bilgi kalıpları (ör. gitleaks)
      - uses: gitleaks/gitleaks-action@<tam-commit-sha>
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```
:::

## Tehdit modelini yaşatmak

Tehdit modeli bir kez yazılıp rafa kaldırılan bir belge olduğunda değerini hızla yitirir. Onu yaşatmanın pratik yolları: büyük bir özellik ya da yeni bir dış bağımlılık eklendiğinde tasarım belgesinin bir bölümü olarak güncellemek; her güvenlik olayından sonra "modelimizde bu tehdit var mıydı, yoksa neden yoktu?" sorusunu sormak; azaltımları otomatik testlere bağlamak (örneğin "yönetim uç noktaları rolsüz kullanıcıya 403 döner" testi) ve modeli yılda en az bir kez ekip olarak yeniden okumak. Modelin amacı mükemmel olmak değil, sistemdeki en tehlikeli varsayımları görünür kılmaktır.

:::interactive{type="threat-model" scenario="web-app"}
Web uygulaması senaryosunda diyagramdaki her bileşene ve oka tek tek tıklayın (klavyede Tab ve Enter da çalışır). Alttaki panelde STRIDE'ın altı kategorisinden bu öğeye uyduğunu düşündüklerinizi işaretleyin ve her işaret için kısa gerekçenizi yazın. Kesikli kırmızı çerçeveler güven sınırlarıdır; bir sınırı geçen akışlara özellikle dikkat edin. Bitirdiğinizde **Bitirdim, göster** düğmesine basın: her kategori "buldun", "kaçırdın" ya da "beklenmiyor" olarak işaretlenir, beklenen her tehdit için bir gerekçe ve örnek önlem görünür, yan panelde bulunan/toplam puanınız çıkar. Ardından senaryoyu **CI/CD hattı** yapın ve aşağıdaki Codecov olayını okumadan önce CI çalıştırıcıdaki bilgi sızması tehdidini bulup bulamadığınıza bakın.
:::

:::realworld{company="Codecov"}
2021'in başında, CI süreçlerinde kod kapsamı raporu yüklemek için yaygın kullanılan Codecov'un indirilebilir yükleme betiği, saldırganlar tarafından değiştirildi. Saldırganlar, şirketin kapsayıcı imajı oluşturma sürecindeki bir hatadan elde ettikleri bir kimlik bilgisiyle betiğe tek satırlık bir ekleme yaptı: betik, çalıştığı CI ortamındaki **ortam değişkenlerini** saldırganın sunucusuna gönderiyordu. Değişiklik yaklaşık iki ay fark edilmedi ve bu sürede betiği kullanan binlerce müşterinin CI'ındaki erişim anahtarları, token'lar ve parolalar risk altına girdi. Olay, bu dersin iki konusunun nasıl birleştiğini gösterir: CI'daki sırlar bir tedarik zinciri saldırısının birincil hedefidir, ve indirilen betiklerin bütünlük özeti doğrulanmadan çalıştırılması saldırganın elindeki tek değişikliği tüm müşterilere dağıtır. Sonrasında birçok kuruluş CI sırlarını döndürdü, betikleri özet doğrulamasıyla çalıştırmaya ve CI'a yalnızca kısa ömürlü kimlik bilgileri vermeye yöneldi.
:::

:::callout{tone="tip" title="Mülakat özeti"}
- Dört soru: ne yapıyoruz, ne ters gidebilir, ne yapacağız, iyi yaptık mı?
- DFD çiz; tehditlerin çoğu **güven sınırlarında** yaşar. STRIDE ile her öğeyi sistematik olarak sorgula.
- Riskleri karşılaştırmalı önceliklendir; kabul edilen riski gerekçesiyle yaz.
- Sırlar kod dışında, açılışta doğrulanır, merkezde yönetilir ve döndürülür; sızan sır önce iptal edilir.
- Tedarik zinciri: kilit dosyası, bilinen açık taraması, sabitlenmiş CI eylemleri, en az izin, imza ve SBOM.
:::

:::quiz{src="quiz.json"}
:::

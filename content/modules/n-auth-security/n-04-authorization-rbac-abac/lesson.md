---
id: n-04-authorization-rbac-abac
slug: authorization-rbac-abac
module: n-auth-security
order: 4
title:
  tr: "Yetkilendirme: RBAC ve ABAC"
  en: "Authorisation: RBAC and ABAC"
summary:
  tr: "Rol ve öznitelik tabanlı erişim, politika motorları, en az ayrıcalık, çok kiracılı sistemlerde veri izolasyonu."
  en: "Role- and attribute-based access, policy engines, least privilege, data isolation in multi-tenant systems."
durationMinutes: 30
level: intermediate
tags: [authorization, rbac, abac, policy, multi-tenancy, security]
prerequisites: [n-03-oauth2-oidc, f-07-security-layers, d-01-relational-modeling-normalization]
concepts: [authn-vs-authz, rbac, abac, rebac, policy-engine, least-privilege, tenant-isolation, idor]
---

## Kavram: kim olduğunu bilmek, ne yapabileceğini bilmek değildir

Önceki üç derste tek bir soruyu cevapladık: **bu istek kimden geliyor?** Oturum, JWT ve OIDC, kimlik doğrulamanın (authentication) araçlarıdır. Bu derste ikinci ve çoğu zaman daha zor soruya geçiyoruz: **bu kişi bu kaynak üzerinde bu işlemi yapabilir mi?** Bu yetkilendirmedir (authorization) ve HTTP'de iki farklı durum koduyla ayrılır: kimlik kanıtı eksik ya da geçersizse `401 Unauthorized`, kimlik geçerli ama izin yoksa `403 Forbidden`. Bazı sistemler, kaynağın varlığını bile sızdırmamak için izinsiz erişimde `404` döndürmeyi tercih eder.

Kimlik doğrulama genellikle sistemin girişinde bir kez yapılır ve iyi kütüphanelerle çözülmüş bir problemdir. Yetkilendirme ise her uç noktada, her kaynakta ve her veri satırında yeniden verilen binlerce küçük karardır; bu yüzden OWASP'ın web uygulaması risk listesinde yıllardır ilk sırada **kırık erişim kontrolü** yer alır. Bir uç noktada kontrolü unutmak, bütün kimlik doğrulama altyapısını anlamsız kılar.

Her yetkilendirme kararı dört parçalı bir sorudur:

- **Özne (subject)**: Kim istiyor? Kullanıcı, servis, rolü, departmanı, kiracısı.
- **Eylem (action)**: Ne yapmak istiyor? Okuma, düzenleme, silme, onaylama.
- **Kaynak (resource)**: Neyin üzerinde? Belirli bir belge, sahibi, durumu, kiracısı.
- **Bağlam (context)**: Hangi koşullarda? Saat, IP aralığı, cihaz güveni, çok adımlı doğrulama yapılmış mı.

Farklı yetkilendirme modelleri, bu dört parçadan hangilerine ve nasıl baktıklarıyla ayrılır.

:::diagram{src="diagram.svg" alt="Yetkilendirme mimarisi: istek uygulamadaki politika uygulama noktasına (PEP) gelir, PEP özne, eylem, kaynak ve bağlamı politika karar noktasına (PDP) sorar; PDP politika deposu ve öznitelik kaynaklarını kullanarak izin ya da ret döndürür. Altta RBAC'ta kullanıcı rol izin zinciri, ABAC'ta öznitelik koşulları|Authorisation architecture: a request reaches the policy enforcement point (PEP) in the application, which asks the policy decision point (PDP) about subject, action, resource and context; the PDP uses the policy store and attribute sources to return allow or deny. Below, the user role permission chain in RBAC and attribute conditions in ABAC"}
Kararı veren (PDP) ile kararı uygulayan (PEP) ayrıldığında, politika koddan bağımsız değiştirilebilir ve test edilebilir.
:::

## ACL'den RBAC'a

En basit model **erişim kontrol listesidir (ACL)**: her kaynağın yanında "kim ne yapabilir" listesi durur. Dosya sistemleri ve paylaşılan belgeler bu modelle çalışır. Küçük ölçekte sezgiseldir, ama on bin kullanıcı ve milyon belgede "Ayşe ekipten ayrıldı, erişimlerini kaldır" sorusu, milyonlarca listeyi taramak demektir.

**Rol tabanlı erişim kontrolü (RBAC)** araya bir dolaylılık katmanı koyar: izinler rollere, roller kullanıcılara atanır. "Editör içerik düzenleyebilir, yönetici kullanıcıları yönetebilir" gibi kurallar, kurumun organizasyon yapısına doğal biçimde oturur. Ayşe ayrıldığında yalnızca rol atamasını kaldırırsınız. Denetçiye "bu izin kimlerde var?" sorusunun cevabı tek bir sorgudur. RBAC'ın gücü bu **basitlik ve denetlenebilirliktir**.

Zayıf yanı ise ifade gücüdür. "Editör yalnızca **kendi ekibinin** taslaklarını düzenleyebilir" kuralı, saf RBAC'ta her ekip için ayrı bir rol (`editor-team-a`, `editor-team-b`) üretmeyi gerektirir. Ekip, bölge ve ürün boyutları çarpıldıkça roller yüzlerce, sonra binlerce olur. Buna **rol patlaması** denir ve rol listesi kimsenin anlamadığı bir yapıya dönüştüğünde RBAC'ın denetlenebilirlik avantajı da kaybolur. Rol hiyerarşileri (yönetici, editörün tüm izinlerini devralır) bir ölçüde yardımcı olur ama sorunun kökünü çözmez.

## ABAC: kuralı özniteliklerle yazmak

**Öznitelik tabanlı erişim kontrolü (ABAC)**, kararı özne, kaynak, eylem ve bağlam özniteliklerinin üzerindeki koşullarla verir. Yukarıdaki kural tek bir politikaya dönüşür: *özne.rol = editör VE özne.ekip = kaynak.ekip VE kaynak.durum = taslak ise düzenlemeye izin ver.* Yeni bir ekip eklendiğinde politika değişmez; yalnızca öznitelikler değişir.

ABAC bağlama da bakabilir: "Finans raporları yalnızca şirket ağından ve çok adımlı doğrulamayla okunabilir", "Ödeme onayı mesai saatleri dışında ikinci bir onay gerektirir". Bu esneklik güçlüdür ama bedeli vardır: kararlar artık bir tabloya bakmak kadar basit değildir, politikaların test edilmesi gerekir ve "bu kullanıcı neye erişebilir?" sorusu tersine çevrilmesi zor bir hesaplama hâline gelir.

Üçüncü bir model, belge paylaşımı ve sosyal uygulamalar gibi ilişkinin kendisinin izin olduğu sistemlerde öne çıkar: **ilişki tabanlı erişim kontrolü (ReBAC)**. "Bu belgenin sahibi olan klasöre editör olarak eklenmiş kişiler belgeyi düzenleyebilir" gibi kurallar, özneler ve kaynaklar arasındaki bir graf üzerinde yol aramasıyla değerlendirilir.

| | RBAC | ABAC | ReBAC |
|---|---|---|---|
| Karar neye dayanır? | Kullanıcının rolleri | Özne, kaynak ve bağlam öznitelikleri | Özne ile kaynak arasındaki ilişki grafı |
| Güçlü yanı | Basit, denetlenebilir, hızlı | İnce taneli, bağlama duyarlı | Paylaşım ve hiyerarşiyi doğal ifade eder |
| Zayıf yanı | Rol patlaması | Test ve denetim zorluğu | Graf altyapısı ve tutarlılık maliyeti |
| Tipik kullanım | Yönetim panelleri, kurumsal uygulamalar | Regüle sektörler, çok boyutlu kurallar | Belge paylaşımı, klasörler, organizasyon ağaçları |

Pratikte çoğu sistem bunları karıştırır: kaba taneli kararlar için roller (yönetici paneline kim girebilir?), ince taneli kararlar için öznitelik ya da sahiplik koşulları (bu belgeyi kim düzenleyebilir?).

## Politika motorları: kararı koddan ayırmak

Yetkilendirme kuralları iş mantığının içine `if (user.role === 'admin' || doc.ownerId === user.id)` gibi satırlar olarak dağıldığında, "sistemdeki tüm erişim kuralları neler?" sorusunun cevabı tüm kod tabanını okumaktır. **Politika motorları** bu dağınıklığa karşı bir mimari önerir:

- **PEP (Policy Enforcement Point)**: İsteği karşılayan kod. Kararı kendisi vermez; özneyi, eylemi, kaynağı ve bağlamı toplayıp sorar ve cevabı uygular.
- **PDP (Policy Decision Point)**: Politikaları değerlendirip izin ya da ret döndüren bileşen. Bir kütüphane, bir yan süreç (sidecar) ya da ayrı bir servis olabilir.
- **PAP / politika deposu**: Politikaların yazıldığı, sürümlendiği ve incelendiği yer; genellikle kodla aynı depoda, kod incelemesinden geçen dosyalar.
- **PIP (Policy Information Point)**: Kararda gereken ek öznitelikleri (kullanıcının ekibi, belgenin durumu) sağlayan kaynaklar.

Yaygın araçlar farklı noktalara odaklanır. **Casbin**, bir model dosyası (istek, politika, eşleştirici tanımı) ve bir politika tablosuyla çalışan, birçok dilde bulunan bir kütüphanedir; RBAC ve ABAC'ı aynı biçimde ifade edebilir. **Open Policy Agent (OPA)**, Rego adlı bildirimsel bir dille yazılan politikaları değerlendiren genel amaçlı bir motordur; Kubernetes kabul denetimlerinden API yetkilendirmesine kadar geniş bir alanda kullanılır. **Cedar** gibi daha yeni diller, politikaların biçimsel olarak analiz edilebilmesini hedefler.

Politika motoru seçmekten daha önemli olan ilke, politikaların **kod gibi** ele alınmasıdır: sürüm kontrolünde durur, kod incelemesinden geçer ve birim testleriyle korunur. "Stajyer rolü fatura silememeli" bir test olarak yazıldığında, birinin yanlışlıkla rolü genişletmesi CI'da yakalanır.

:::code{lang="ini" title="Casbin modeli ve politikası: RBAC + sahiplik koşulu"}
```ini
# model.conf — istek, politika, rol tanımı ve eşleştirici
[request_definition]
r = sub, obj, act

[policy_definition]
p = sub, obj_type, act, eft

[role_definition]
g = _, _              # kullanıcı → rol

[policy_effect]
# en az bir izin olsun VE hiçbir açık ret olmasın (ret her zaman kazanır)
e = some(where (p.eft == allow)) && !some(where (p.eft == deny))

[matchers]
m = g(r.sub.id, p.sub) && r.obj.type == p.obj_type && r.act == p.act \
    && (p.sub != "author" || r.obj.ownerId == r.sub.id) \
    && r.obj.tenantId == r.sub.tenantId

# policy.csv — kurallar veri olarak durur
# p, author, draft,   edit,    allow
# p, editor, draft,   edit,    allow
# p, editor, draft,   publish, allow
# p, intern, invoice, delete,  deny
# g, u_42,   author
# g, u_77,   editor
```
```rego
# OPA (Rego) karşılığı — varsayılan ret, açık izin kuralları
package app.authz

import rego.v1

default allow := false

default deny := false

same_tenant if input.resource.tenantId == input.subject.tenantId

allow if {
    same_tenant
    input.action == "edit"
    input.resource.type == "draft"
    "editor" in input.subject.roles
    input.subject.team == input.resource.team          # ABAC: ekip eşleşmesi
}

allow if {
    same_tenant
    input.action == "edit"
    input.resource.ownerId == input.subject.id          # sahiplik
}

# bağlam: finans raporu yalnızca MFA ile
deny if {
    input.resource.type == "finance-report"
    not input.context.mfa
}

# nihai karar: en az bir izin VE hiçbir ret yok
decision if {
    allow
    not deny
}
```
```ts
// PEP: uç nokta kararı kendisi vermez, PDP'ye sorar ve uygular
export async function updateDraft(req: Request, res: Response) {
  const draft = await db.draft.findUnique({ where: { id: req.params.id } });
  if (!draft) return res.status(404).end();

  const allowed = await pdp.check({
    subject: { id: req.user.id, roles: req.user.roles, team: req.user.team, tenantId: req.user.tenantId },
    action: 'edit',
    resource: { type: 'draft', ownerId: draft.ownerId, team: draft.team, tenantId: draft.tenantId },
    context: { mfa: req.user.mfa, ip: req.ip },
  });
  if (!allowed) return res.status(404).end();   // varlığı sızdırma
  // ... güncelle
}
```
:::

## En az ayrıcalık ve varsayılan ret

**En az ayrıcalık ilkesi**, her öznenin işini yapmaya yetecek en dar izne sahip olması demektir. Kulağa açık gelir ama zamanla aşınır: bir kez acil bir iş için verilen geniş yetki, kimse geri almadığı için yıllarca kalır. Bu aşınmaya karşı birkaç pratik vardır:

- **Varsayılan ret**: Hiçbir kural eşleşmiyorsa cevap "hayır"dır. Yeni bir uç nokta eklendiğinde unutulan kontrol, açık bir kapı değil kırık bir özellik olarak ortaya çıkar.
- **Açık ret önceliği**: Bir izin ve bir ret çakışıyorsa ret kazanır. Böylece geniş bir izin, hassas bir istisnayı ezemez.
- **Zaman sınırlı yetki**: Üretim veritabanına erişim gibi yüksek riskli izinler talep üzerine, gerekçeyle ve birkaç saatlik süreyle verilir (just-in-time access).
- **Acil durum hesabı**: Her şeyin bozulduğu anlarda kullanılacak geniş yetkili erişim, ayrı tutulur, kullanımı alarm üretir ve sonrasında incelenir.
- **Düzenli gözden geçirme**: Kimde hangi rolün olduğu periyodik olarak yöneticilere onaylatılır; kullanılmayan izinler kaldırılır.

Aynı ilke servisler için de geçerlidir. Bir raporlama servisinin veritabanı kullanıcısı yalnızca okuma iznine sahip olmalı; bir resim küçültme işçisinin bulut kimliği yalnızca ilgili depolama kovasına yazabilmelidir. Güvenlik katmanları dersinde gördüğümüz IAM politikaları bu ilkenin altyapı tarafındaki uygulamasıdır.

## Çok kiracılı sistemlerde veri izolasyonu

Birden fazla müşterinin (kiracının) aynı uygulamayı ve çoğu zaman aynı veritabanını paylaştığı SaaS sistemlerinde, yetkilendirmenin en kritik kuralı tektir: **bir kiracı başka bir kiracının verisini asla görmemeli**. Bu kuralın ihlali tek bir kullanıcının değil, bir şirketin tüm verisinin başka bir şirkete sızması demektir.

İzolasyon için üç temel yaklaşım vardır:

| Yaklaşım | Açıklama | Güçlü yanı | Bedeli |
|---|---|---|---|
| Paylaşımlı tablo + `tenant_id` | Tüm kiracılar aynı tablolarda, her satırda kiracı kimliği | En ucuz, en kolay ölçeklenen | Her sorguda filtre şart; tek unutulan `WHERE` sızıntıdır |
| Kiracı başına şema | Aynı veritabanında ayrı şemalar | Daha güçlü ayrım, kiracı bazlı yedek | Şema göçleri ve bağlantı yönetimi karmaşıklaşır |
| Kiracı başına veritabanı | Her kiracıya ayrı veritabanı | En güçlü izolasyon, regülasyona uygun | En pahalı; çok sayıda küçük kiracıda yönetimi zor |

Paylaşımlı tablo modelinde "her sorguya `tenant_id` filtresi eklemeyi unutmamak" bir disiplin meselesi olarak bırakılmamalıdır. Kiracı kimliği istemcinin gönderdiği bir parametreden değil, doğrulanmış token'dan alınmalı; veri erişim katmanı her sorguya filtreyi otomatik eklemelidir. Bir adım daha ileri giderek PostgreSQL'in **satır düzeyi güvenliği (row-level security)** kullanılabilir: veritabanı, bağlantı için ayarlanmış kiracı kimliğine uymayan satırları uygulama ne sorgu gönderirse göndersin döndürmez. Böylece uygulama kodundaki bir hata bile kiracı sınırını aşamaz.

:::callout{tone="danger" title="IDOR: URL'deki kimliğe güvenmek"}
`GET /api/invoices/1043` isteğinde sunucu yalnızca kullanıcının giriş yapmış olduğunu kontrol edip 1043 numaralı faturayı döndürüyorsa, kullanıcı numarayı 1044 yaparak başkasının faturasını görebilir. Bu, **güvensiz doğrudan nesne referansı (IDOR)**, API dünyasındaki adıyla nesne düzeyinde kırık yetkilendirmedir. Rastgele UUID kullanmak tahmini zorlaştırır ama çözüm değildir. Her kaynak erişiminde sahiplik ve kiracı kontrolü sunucu tarafında yapılmalı, tercihen sorgunun kendisine gömülmelidir: `WHERE id = $1 AND tenant_id = $2`.
:::

Bu platformun API'si yetkilendirmede bilinçli olarak basit bir RBAC modeli kullanır: kullanıcıların `user`, `editor` ve `admin` rollerinden biri vardır, yönetim uç noktaları `@Roles('admin', 'editor')` gibi bir işaretle korunur ve bir rol koruyucusu (guard) isteği işleyiciye ulaşmadan önce kontrol eder. Yönetici rolü her yere girebilir. Rol bilgisi access token'a güvenilerek değil, kullanıcının güncel durumundan okunur; böylece bir editörün rolü kaldırıldığında eski token'ı birkaç dakika boyunca editör yetkisi taşımaya devam etmez. Kullanıcıya ait veriler (ilerleme, quiz geçmişi, ayarlar) ise her zaman token'daki kullanıcı kimliğiyle sorgulanır, URL'den gelen bir kullanıcı kimliğiyle değil.

:::realworld{company="AWS"}
AWS IAM, büyük ölçekte ABAC'ın nasıl işletildiğinin bilinen bir örneğidir. Değerlendirme mantığı **varsayılan ret** üzerine kuruludur: hiçbir politika bir eyleme izin vermiyorsa istek reddedilir ve herhangi bir politikadaki **açık ret** her izni ezer. Organizasyon düzeyindeki hizmet kontrol politikaları, hesaplardaki izinlerin üst sınırını çizer; bir hesap yöneticisi bile bu sınırın ötesine yetki veremez. ABAC tarafında kaynaklara ve kimliklere etiket (tag) verilir ve politika koşullarında karşılaştırılır: "Bir geliştirici yalnızca `project` etiketi kendi `project` etiketiyle aynı olan sunucuları yeniden başlatabilir" kuralı tek bir politikayla yazılır. Yeni bir proje eklendiğinde politika değişmez, yalnızca etiketler eklenir; bu, rol patlamasını önlemenin tam olarak ABAC'ın vaat ettiği yoludur.
:::

:::callout{tone="tip" title="Mülakat özeti"}
- 401 kimlik yok, 403 izin yok; yetkilendirme her uç noktada ve her nesnede yeniden verilir.
- RBAC basit ve denetlenebilir ama rol patlamasına açık; ABAC ince taneli ama test gerektirir; ikisini karıştırmak normaldir.
- Varsayılan ret, açık ret önceliği, politikaları kod gibi test etmek.
- Çok kiracılı sistemde kiracı kimliği token'dan gelir, sorguya otomatik eklenir; mümkünse satır düzeyi güvenlik.
:::

:::quiz{src="quiz.json"}
:::

:::next{lesson="n-05-owasp-top-10"}
Sırada: kırık erişim kontrolünün de başı çektiği OWASP Top 10 listesi; enjeksiyon, XSS, CSRF ve kaba kuvvete karşı savunmalar.
:::

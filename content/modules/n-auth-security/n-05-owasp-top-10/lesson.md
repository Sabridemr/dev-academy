---
id: n-05-owasp-top-10
slug: owasp-top-10
module: n-auth-security
order: 5
title:
  tr: "OWASP Top 10 ile Web Güvenliği"
  en: "Web Security with OWASP Top 10"
summary:
  tr: "Enjeksiyon, XSS, CSRF, kırık erişim kontrolü, güvensiz tasarım ve kaba kuvvet; savunmalar ve kod örnekleri; kaba kuvvet simülatörü."
  en: "Injection, XSS, CSRF, broken access control, insecure design and brute force; defences and code examples; brute-force simulator."
durationMinutes: 35
level: intermediate
tags: [owasp, web-security, injection, xss, csrf, brute-force, security]
prerequisites: [n-04-authorization-rbac-abac, f-07-security-layers, a-10-rate-limiting, i-03-api-ve-rest-api-tasarim-guvenlik-ve-idempotency]
concepts: [owasp-top-10, sql-injection, xss, content-security-policy, csrf, insecure-design, brute-force-defense, ssrf]
---

## Kavram: bir saldırı kataloğu değil, bir öncelik listesi

**OWASP (Open Worldwide Application Security Project)**, web uygulaması güvenliği üzerine çalışan, kâr amacı gütmeyen açık bir topluluktur. En bilinen ürünü olan **OWASP Top 10**, gerçek uygulamalarda en sık görülen ve en çok hasar veren risk kategorilerinin birkaç yılda bir güncellenen listesidir. Liste bir saldırı rehberi değildir; bir ekibin sınırlı güvenlik zamanını nereye harcaması gerektiğini söyleyen bir **öncelik listesidir**. Kategorilerin adları ve sıraları sürümden sürüme değişir, ama özleri yıllardır aynıdır: güvenilmeyen girdiye güvenmek, yetkiyi kontrol etmeyi unutmak, varsayılan ayarlarla üretime çıkmak ve güvenliği tasarımın değil son dakikanın işi saymak.

Bu derste listedeki kategorileri, önceki derslerde kurduğumuz kimlik ve yetki zemininin üzerine yerleştireceğiz. Her biri için zafiyetin **neden** oluştuğunu, savunmanın **hangi katmanda** yapılması gerektiğini ve kısa bir "zafiyetli / güvenli" kod çiftini göreceğiz. Amaç saldırı tekniklerini öğrenmek değil, kod incelemesinde bu kalıpları tanıyıp doğru savunmayı seçebilmektir.

| Kategori | Özü | Ana savunma |
|---|---|---|
| Kırık erişim kontrolü | Kullanıcı yetkisi olmayan veriye ya da işleme ulaşır | Her istekte sunucu tarafı yetki kontrolü, varsayılan ret |
| Kriptografik hatalar | Hassas veri korumasız ya da zayıf algoritmayla saklanır veya taşınır | TLS her yerde, doğru şifre hash'i, anahtar yönetimi |
| Enjeksiyon (SQL, komut, XSS) | Veri, kod olarak yorumlanır | Parametreli sorgu, bağlama uygun kaçışlama, CSP |
| Güvensiz tasarım | Mantık hatası; kod doğru, kural yanlış | Tehdit modelleme, kötüye kullanım senaryoları |
| Güvenlik yanlış yapılandırması | Varsayılan şifreler, açık hata ayrıntıları, gereksiz servisler | Sıkılaştırılmış, tekrarlanabilir yapılandırma |
| Savunmasız bileşenler / tedarik zinciri | Bilinen açığı olan bağımlılık | Bağımlılık taraması, hızlı yama |
| Kimlik doğrulama hataları | Kaba kuvvet, zayıf şifre, oturum yönetimi hatası | Hız sınırı, MFA, sızmış şifre kontrolü |
| Yazılım ve veri bütünlüğü hataları | İmzasız güncelleme, güvensiz serileştirme | İmza doğrulama, güvenli formatlar |
| Günlükleme ve izleme eksikliği | Saldırı olur, kimse fark etmez | Güvenlik olaylarını kaydetme ve alarm |
| SSRF | Sunucu, saldırganın seçtiği adrese istek atar | Hedef izin listesi, iç ağ ayrımı |

:::diagram{src="diagram.svg" alt="Bir web isteğinin katmanları ve her katmanda karşılaşılan OWASP riskleri: tarayıcıda XSS ve CSRF, giriş uç noktasında kaba kuvvet ve hız sınırı, uygulama katmanında erişim kontrolü ve güvensiz tasarım, veri katmanında enjeksiyon, dış çağrılarda SSRF; her riskin yanında savunması|The layers of a web request and the OWASP risks found at each: XSS and CSRF in the browser, brute force and rate limiting at the login endpoint, access control and insecure design in the application layer, injection at the data layer, SSRF on outbound calls; each risk shown with its defence"}
Risklerin çoğu, güvenilmeyen verinin bir güven sınırını kontrolsüz geçtiği noktada doğar.
:::

## Kırık erişim kontrolü: listenin zirvesi

Bir önceki derste ayrıntısıyla işlediğimiz bu kategori, listenin hem 2021 hem 2025 sürümlerinde ilk sıradadır. Tipik biçimleri: URL'deki kimliği değiştirerek başkasının kaydını görmek (IDOR), yalnızca arayüzde gizlenmiş bir yönetim düğmesinin API'sini doğrudan çağırmak, isteğe `role: "admin"` alanı ekleyip toplu atama (mass assignment) ile kendi yetkisini yükseltmek. Ortak kök, kararın **istemciye** ya da varsayıma bırakılmasıdır.

:::code{lang="ts" title="Erişim kontrolü: nesne sahipliği ve toplu atama"}
```ts
// ✗ ZAFİYETLİ: giriş yapmış herkes her faturayı görür; gövdedeki her alan kayda yazılır
app.get('/invoices/:id', requireAuth, async (req, res) => {
  res.json(await db.invoice.findUnique({ where: { id: req.params.id } }));
});
app.patch('/me', requireAuth, async (req, res) => {
  res.json(await db.user.update({ where: { id: req.user.id }, data: req.body })); // role da gelebilir!
});

// ✓ GÜVENLİ: sahiplik sorgunun parçası; yalnızca izin verilen alanlar doğrulanıp yazılır
const UpdateMe = z.object({ displayName: z.string().max(60), locale: z.enum(['tr', 'en']) }).strict();
app.get('/invoices/:id', requireAuth, async (req, res) => {
  const inv = await db.invoice.findFirst({ where: { id: req.params.id, ownerId: req.user.id } });
  return inv ? res.json(inv) : res.status(404).end();
});
app.patch('/me', requireAuth, async (req, res) => {
  const data = UpdateMe.parse(req.body);   // bilinmeyen alan → 400
  res.json(await db.user.update({ where: { id: req.user.id }, data }));
});
```
:::

## Enjeksiyon: veri koda dönüştüğünde

Enjeksiyonun her türü aynı hatadan doğar: güvenilmeyen bir değer, bir yorumlayıcıya (SQL motoru, işletim sistemi kabuğu, tarayıcının HTML ayrıştırıcısı) **kodun bir parçası** olarak verilir. Kullanıcının girdiği ad bir SQL ifadesinin içine string birleştirmeyle yapıştırıldığında, ad alanındaki tırnak işareti sorgunun yapısını değiştirebilir.

Savunma, girdiyi "temizlemeye" çalışmak değil, veriyi koddan **yapısal olarak ayırmaktır**. Parametreli sorgularda sorgu metni ve değerler veritabanına ayrı ayrı gönderilir; değer ne içerirse içersin yalnızca bir değer olarak ele alınır. ORM ve sorgu oluşturucular bunu varsayılan olarak yapar, ama "ham sorgu" kaçış kapıları (`$queryRawUnsafe`, string formatlanmış `execute`) her kod incelemesinde işaretlenmelidir. Tablo ya da sütun adı gibi parametreleştirilemeyen kısımlar kullanıcıdan geliyorsa, bunlar sabit bir izin listesiyle eşleştirilmelidir.

Aynı ilke işletim sistemi komutları için de geçerlidir: kullanıcı girdisini bir kabuk komutuna yapıştırmak yerine, argümanları dizi olarak alan ve kabuk çağırmayan API'ler kullanılır; çoğu zaman da dış komut çalıştırmak yerine aynı işi yapan bir kütüphane tercih edilir.

Aynı girdinin string birleştirmeyle ve parametreli sorguyla nasıl iki farklı sonuca yol açtığını adım adım izleyelim.

:::predict{id="parametreli-sorgu-sonucu"}
Arama kutusuna `' OR '1'='1` yazılıyor. API parametreli sorgu kullanıyorsa sonuç ne olur? | Someone types `' OR '1'='1` into the search box. If the API uses a parameterised query, what is the result?
- [ ] Tablodaki bütün satırlar döner | Every row in the table is returned
- [x] Bu adda bir kullanıcı olmadığı için sonuç boş döner | The result is empty because no user has that name
- [ ] Veritabanı sözdizimi hatası verir | The database raises a syntax error
Açıklama: Parametreli sorguda sorgunun yapısı değer gelmeden belirlenir; değer ne içerirse içersin tek bir ad olarak karşılaştırılır. Tüm satırların dönmesi, string birleştirmeyle kurulan sorgunun sonucudur. | With a parameterised query the structure is fixed before the value arrives; whatever the value contains, it is compared as a single name. All rows returning is what happens with a string-concatenated query.
:::

:::animation{scene="sql-injection.scene.json"}
Tırnak içeren girdi string birleştirmeyle sorgunun yapısını değiştirir ve tüm tablo sızar; parametreli sorguda şablon ve değer ayrı gider, sonuç boş döner.
:::

:::code{lang="ts" title="SQL enjeksiyonu: string birleştirme ve parametreli sorgu"}
```ts
// ✗ ZAFİYETLİ: girdi sorgu metninin parçası oluyor
const rows = await pool.query(`SELECT id, title FROM lessons WHERE title LIKE '%${q}%'`);

// ✓ GÜVENLİ: sorgu ve değer ayrı gönderilir; sıralama sütunu izin listesinden seçilir
const SORTABLE = { title: 'title', created: 'created_at' } as const;
const column = SORTABLE[req.query.sort as keyof typeof SORTABLE] ?? 'created_at';
const rows = await pool.query(
  `SELECT id, title FROM lessons WHERE title ILIKE $1 ORDER BY ${column} LIMIT 50`,
  [`%${q}%`],
);
```
```python
# ✗ ZAFİYETLİ
cur.execute(f"SELECT id, title FROM lessons WHERE title LIKE '%{q}%'")

# ✓ GÜVENLİ
SORTABLE = {"title": "title", "created": "created_at"}
column = SORTABLE.get(sort, "created_at")
cur.execute(
    f"SELECT id, title FROM lessons WHERE title ILIKE %s ORDER BY {column} LIMIT 50",
    (f"%{q}%",),
)
```
:::

## XSS: tarayıcıda enjeksiyon

**Siteler arası betik çalıştırma (XSS)**, enjeksiyonun tarayıcıdaki biçimidir: kullanıcının girdiği bir yorum, profil adı ya da URL parametresi, sayfaya kaçışlanmadan HTML olarak eklenir ve tarayıcı içindeki betiği sitenin kendi kodu gibi çalıştırır. Betik o sayfanın tüm yetkileriyle çalıştığı için kullanıcının adına istek gönderebilir, sayfadaki veriyi okuyabilir ve ilk derste tartıştığımız gibi `localStorage`'daki token'ları sızdırabilir.

Savunma katmanlıdır. Birinci katman **bağlama uygun çıktı kaçışlamadır**: React, Vue ve modern şablon motorları metni varsayılan olarak kaçışlar; zafiyetler neredeyse her zaman bu korumanın bilerek atlandığı yerlerde (`dangerouslySetInnerHTML`, `innerHTML`, `v-html`) doğar. Kullanıcıdan gelen zengin içeriğin gerçekten HTML olarak gösterilmesi gerekiyorsa, DOMPurify gibi iyi bakılan bir temizleyiciden geçirilir. İkinci katman **Content-Security-Policy (CSP)** başlığıdır: tarayıcıya hangi kaynaklardan betik yüklenebileceğini söyler. İstek başına üretilen bir *nonce* ile yalnızca sunucunun bilerek eklediği betikler çalışır; enjekte edilmiş satır içi betik, nonce'ı bilmediği için engellenir. Üçüncü katman ise hasarı sınırlamaktır: oturum çerezlerinin `HttpOnly` olması ve token'ların kalıcı depolarda tutulmaması.

:::code{lang="tsx" title="XSS: ham HTML ve kaçışlanmış metin + CSP nonce"}
```tsx
// ✗ ZAFİYETLİ: kullanıcı yorumu HTML olarak ekleniyor
<div dangerouslySetInnerHTML={{ __html: comment.body }} />

// ✓ GÜVENLİ: React metni kaçışlar; zengin içerik gerekiyorsa önce temizlenir
<p>{comment.body}</p>
<div dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(comment.html) }} />

// ✓ Sunucu: istek başına nonce'lu CSP ('unsafe-inline' yok)
const nonce = randomBytes(16).toString('base64');
res.setHeader(
  'Content-Security-Policy',
  `default-src 'self'; script-src 'self' 'nonce-${nonce}' 'strict-dynamic'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'`,
);
```
:::

## CSRF: tarayıcının iyi niyetini kullanmak

**Siteler arası istek sahteciliği (CSRF)**, kimlik doğrulaması çerezle yapılan uygulamalara özgüdür. Kullanıcı sizin sitenizde oturum açmışken başka bir sayfayı ziyaret eder; o sayfadaki gizli bir form, kullanıcının tarayıcısından sizin sitenize "e-posta adresini değiştir" isteği gönderir ve tarayıcı oturum çerezini otomatik olarak ekler. Sunucu açısından istek meşru görünür.

Savunma, isteğin gerçekten sizin sayfanızdan geldiğini doğrulamaktır. `SameSite=Lax` ya da `Strict` çerezler, siteler arası POST isteklerinde çerezin gönderilmesini engelleyerek ilk ve en etkili katmanı oluşturur. Durum değiştiren uç noktalarda buna ek olarak bir **CSRF token'ı** (sayfaya gömülen ve her istekle gönderilen, oturuma bağlı rastgele değer) ya da `Origin` başlığının beklenen kaynakla eşleştiği kontrol edilir. `GET` istekleri hiçbir zaman durum değiştirmemelidir; aksi hâlde bir resim etiketi bile saldırı aracına dönüşür. Kimlik doğrulaması yalnızca `Authorization` başlığıyla yapılan API'ler klasik CSRF'den etkilenmez, çünkü saldırganın sayfası bu başlığı kurbanın tarayıcısına ekletemez.

CSRF'nin nasıl işlediğini ve XSS'in bu savunmaları neden aştığını aynı tarayıcı üzerinde görelim.

:::animation{scene="csrf-xss.scene.json"}
Gizli form tarayıcıya çerezli bir istek attırır; SameSite ve Origin + CSRF token kontrolü onu durdurur. Sitenin kendi kökeninde çalışan XSS betiğini ise kaçışlama ve nonce'lu CSP durdurur.
:::

:::code{lang="ts" title="CSRF: çerezli durum değişikliği ve Origin + token kontrolü"}
```ts
// ✗ ZAFİYETLİ: çerez yeterli sayılıyor; başka siteden gelen form da geçer
app.post('/account/email', requireSessionCookie, changeEmail);

// ✓ GÜVENLİ: SameSite çerez + Origin kontrolü + oturuma bağlı CSRF token'ı
const ALLOWED_ORIGINS = new Set(['https://app.example.dev']);
function csrfGuard(req: Request, res: Response, next: NextFunction) {
  const origin = req.get('origin');
  if (!origin || !ALLOWED_ORIGINS.has(origin)) return res.status(403).end();
  const sent = req.get('x-csrf-token') ?? '';
  const expected = req.session.csrfToken ?? '';
  if (sent.length !== expected.length || !timingSafeEqual(Buffer.from(sent), Buffer.from(expected))) {
    return res.status(403).end();
  }
  next();
}
app.post('/account/email', requireSessionCookie, csrfGuard, changeEmail);
```
:::

## Kimlik doğrulama hataları ve kaba kuvvet

Giriş uç noktası, internete açık her uygulamanın en çok yoklanan kapısıdır. Saldırılar üç biçimde gelir: tek bir hesaba çok sayıda şifre denemek (**kaba kuvvet**), çok sayıda hesaba aynı birkaç yaygın şifreyi denemek (**şifre püskürtme**) ve başka sitelerden sızmış kullanıcı adı/şifre çiftlerini toplu denemek (**kimlik bilgisi doldurma**). Her biri farklı bir savunma gerektirir; bu yüzden tek bir sayaç yeterli değildir.

Aşağıdaki simülatörle, saldırganın deneme hızı ile hesap kilitleme kuralları arasındaki ilişkiyi kendiniz hesaplayabilirsiniz.

:::interactive{type="bruteforce-login" attemptsPerSecond=50 lockoutAfter=5 lockoutSeconds=300 passwordSpace=1000000}
Önce kilitlemenin etkisini görün: saniyede 50 deneme ve bir milyon olası şifreyle, kilitleme olmadan tüm alanı taramak birkaç saat sürer. Beş hatalı denemeden sonra 300 saniyelik kilitleme açıkken etkili hız dakikada yaklaşık bir denemeye düşer ve aynı tarama yıllara uzar. Ardından şifre alanını küçültüp (yaygın şifreler listesi gibi) kilitlemenin tek başına neden yetmediğini, büyütüp uzun parolaların neden işe yaradığını karşılaştırın.
:::

Hesap başına kilitleme kaba kuvveti durdurur ama iki zayıflığı vardır. Birincisi, saldırgan kilitlemeyi bir silah olarak kullanıp başkalarının hesaplarını kasten kilitleyebilir; bu yüzden kalıcı kilit yerine **artan bekleme süreleri** ve kilit sonrası e-postayla açma tercih edilir. İkincisi, şifre püskürtme ve kimlik bilgisi doldurma her hesaba yalnızca bir iki deneme yapar ve hesap sayacını hiç tetiklemez. Bunlara karşı **IP ve ağ bazlı hız sınırı**, sızmış şifre listelerine karşı kayıt anında kontrol ve en güçlüsü **çok adımlı doğrulama (MFA)** gerekir.

:::interactive{type="rate-limiter" algorithm="token-bucket" capacity=5 refillPerSec=1}
Giriş uç noktasını korumak için kapasitesi 5, saniyede 1 token dolan bir kova kullanın. Otomatik trafik hızını yükselterek bir saldırganın patlama (burst) hakkını kullandıktan sonra saniyede bir denemeye nasıl sıkıştırıldığını izleyin. Bu sınırın normal bir kullanıcıyı neredeyse hiç etkilemediğine, ama otomatik denemeleri dramatik biçimde yavaşlattığına dikkat edin.
:::

İki ince ayrıntı daha önemlidir. Hata mesajı "kullanıcı bulunamadı" ile "şifre yanlış" arasında ayrım yapmamalı; aksi hâlde giriş formu kayıtlı e-postaları sorgulama aracına dönüşür. Ve aynı sızıntı **zamanlama** üzerinden de olabilir: kayıtlı olmayan e-postada şifre hash'i hiç hesaplanmazsa yanıt belirgin biçimde daha hızlı döner. Çözüm, kullanıcı bulunmadığında da sahte bir hash doğrulaması yaparak iki yolun süresini eşitlemektir.

:::code{lang="ts" title="Giriş uç noktası: sınırsız deneme ve katmanlı savunma"}
```ts
// ✗ ZAFİYETLİ: sınırsız deneme, ayrıntılı hata, yanıt süresi e-postanın varlığını sızdırır
app.post('/login', async (req, res) => {
  const user = await db.user.findUnique({ where: { email: req.body.email } });
  if (!user) return res.status(404).json({ error: 'Kullanıcı bulunamadı' });
  if (!(await argon2.verify(user.passwordHash, req.body.password)))
    return res.status(401).json({ error: 'Şifre yanlış' });
  // ...
});

// ✓ GÜVENLİ: IP + hesap bazlı hız sınırı, genel hata, eşit süre
const DUMMY_HASH = await argon2.hash(randomBytes(16).toString('hex'));
app.post('/login', ipLimiter({ capacity: 5, refillPerSec: 1 }), async (req, res) => {
  const email = String(req.body.email).toLowerCase();
  if (await accountLimiter.isBlocked(email)) return res.status(429).json({ error: 'Çok fazla deneme' });

  const user = await db.user.findUnique({ where: { email } });
  const ok = await argon2.verify(user?.passwordHash ?? DUMMY_HASH, req.body.password);
  if (!user || !ok) {
    await accountLimiter.recordFailure(email);       // artan bekleme süresi
    audit.warn('login_failed', { email, ip: req.ip });  // şifreyi asla loglama
    return res.status(401).json({ error: 'E-posta veya şifre hatalı' });
  }
  await accountLimiter.reset(email);
  // ... oturum / token üret
});
```
:::

:::callout{tone="warning" title="Kilitleme tek başına bir savunma değil, bir parametredir"}
"Beş hatalı denemede kilitle" kuralı tek bir hesaba yönelik kaba kuvveti durdurur, ama bir milyon hesaba birer deneme yapan saldırganı hiç fark etmez ve kötü niyetli birine kullanıcılarınızı toplu kilitleme imkânı verir. Hız sınırını hem IP hem hesap ekseninde uygulayın, kalıcı kilit yerine artan bekleme kullanın, sızmış şifreleri kayıtta reddedin ve yüksek değerli hesaplarda MFA'yı zorunlu kılın.
:::

## Güvensiz tasarım: kod doğru, kural yanlış

Bazı zafiyetler tek bir satırda değil, iş kuralının kendisindedir. Şifre sıfırlama bağlantısının süresiz geçerli olması, kupon kodunun aynı siparişe sınırsız kez uygulanabilmesi, "güvenlik sorusu" ile hesap kurtarma, ödeme tutarının istemciden alınması... Bunların hiçbiri bir tarayıcıyla ya da kod tarayıcıyla bulunamaz, çünkü kod tam olarak yazıldığı gibi çalışır. Savunma tasarım aşamasındadır: her özellik için "bu nasıl kötüye kullanılabilir?" sorusunu sormak, yani bu modülün son dersinde ele alacağımız tehdit modellemesi.

:::code{lang="ts" title="Güvensiz tasarım: şifre sıfırlama token'ı"}
```ts
// ✗ ZAFİYETLİ: tahmin edilebilir, süresiz, tekrar kullanılabilir, düz metin saklanan token
const token = Math.random().toString(36).slice(2);
await db.user.update({ where: { id }, data: { resetToken: token } });

// ✓ GÜVENLİ: 256 bit rastgele, hash'i saklanır, 30 dk ömürlü, tek kullanımlık
const token = randomBytes(32).toString('base64url');
await db.passwordReset.create({
  data: { userId: id, tokenHash: sha256(token), expiresAt: addMinutes(new Date(), 30) },
});
// Kullanımda: hash ile bul, süresini kontrol et, kaydı sil ve kullanıcının tüm oturumlarını kapat.
```
:::

## Yanlış yapılandırma, bileşenler, günlükleme ve SSRF

**Güvenlik yanlış yapılandırması**, en "sıkıcı" ama en yaygın kategoridir: üretimde açık bırakılmış hata ayıklama modu, istemciye dönen yığın izleri, varsayılan yönetici şifreleri, herkese açık bırakılmış bir depolama kovası, gereksiz yere açık bir yönetim arayüzü. Savunma, yapılandırmanın kodla birlikte sürümlenmesi, ortamlar arasında tekrarlanabilir olması ve üretim için güvenli varsayılanlarla başlamasıdır.

**Savunmasız bileşenler** kategorisi, uygulamanızın büyük kısmının sizin yazmadığınız kod olduğunu hatırlatır. Bilinen bir açığı olan bağımlılık, kendi kodunuz kusursuz olsa bile kapıyı açar. Bağımlılık taraması ve hızlı yama süreci son derste ayrıntılı ele alınacak.

**Günlükleme ve izleme eksikliği** kendi başına bir saldırı değildir ama diğer her saldırının süresini uzatır. Başarısız girişler, yetki reddi, şifre ve e-posta değişiklikleri, yönetici işlemleri yapılandırılmış biçimde kaydedilmeli ve anormallikler alarm üretmelidir. Aynı ölçüde önemli olan, şifrelerin, token'ların ve kişisel verilerin **loglanmamasıdır**.

**SSRF (sunucu taraflı istek sahteciliği)**, sunucunun kullanıcının verdiği bir adrese istek attığı özelliklerde (bağlantı önizleme, webhook, URL'den resim içe aktarma) ortaya çıkar. Doğrulanmamış adres, sunucunun iç ağdaki servislere ya da bulut sağlayıcısının meta veri uç noktasına istek atmasına yol açabilir. Savunma: hedefleri bir izin listesiyle sınırlamak, adresi çözümledikten sonra özel ve yerel IP aralıklarını reddetmek, yönlendirmeleri takip etmemek ve bu işleri iç ağa erişimi olmayan ayrı bir çıkış katmanından yapmak.

:::code{lang="ts" title="Yapılandırma ve SSRF: hata ayrıntısı ve dış istek"}
```ts
// ✗ ZAFİYETLİ: yığın izi istemciye; kullanıcı URL'sine doğrudan istek
app.use((err, req, res, next) => res.status(500).json({ error: err.message, stack: err.stack }));
app.post('/preview', async (req, res) => res.send(await (await fetch(req.body.url)).text()));

// ✓ GÜVENLİ: genel hata + iç log; izin listesi, özel IP reddi, yönlendirme yok
app.use((err, req, res, _next) => {
  logger.error({ err, reqId: req.id });
  res.status(500).json({ error: 'Beklenmeyen bir hata oluştu', reqId: req.id });
});
app.post('/preview', async (req, res) => {
  const url = new URL(req.body.url);
  if (url.protocol !== 'https:' || !PREVIEW_ALLOWLIST.has(url.hostname)) return res.status(400).end();
  const { address } = await dns.lookup(url.hostname);
  if (isPrivateOrLoopback(address)) return res.status(400).end();
  const r = await fetch(url, { redirect: 'error', signal: AbortSignal.timeout(3000) });
  res.send((await r.text()).slice(0, 50_000));
});
```
:::

Bu platformun kendisi de bu listedeki savunmaların birçoğunu uygular: şifreler argon2id ile saklanır ve kayıtlı olmayan bir e-postayla giriş denendiğinde de sahte bir argon2 doğrulaması yapılarak yanıt süresi eşitlenir; hız sınırı tüm API örnekleri arasında paylaşılsın diye Redis'te tutulur; sayfalar istek başına nonce'lu bir CSP ile sunulur ve `'unsafe-inline'` kullanılmaz; ders içeriğindeki SVG'ler istemcide DOMPurify ile temizlenir; API dokümantasyon arayüzü üretimde kapalıdır.

:::realworld{company="Equifax"}
2017'deki Equifax veri ihlali, "savunmasız bileşenler" kategorisinin en çok alıntılanan örneğidir. Saldırganlar, şirketin internete açık bir başvuru portalında kullanılan web çatısındaki (Apache Struts) bilinen ve yaması aylar önce yayımlanmış bir uzaktan kod çalıştırma açığından içeri girdi. Yama süreci, etkilenen sistemi gözden kaçırmıştı. İçeride ağ ayrımının zayıf olması saldırganın başka veritabanlarına ilerlemesine izin verdi; süresi dolmuş bir sertifika nedeniyle trafik inceleme aracı uzun süre şifreli trafiği göremediği için sızıntı haftalarca fark edilmedi. Sonuçta yaklaşık 147 milyon kişinin kişisel verisi etkilendi. Olay, tek bir kategorinin değil, listedeki birkaç maddenin birleşimidir: yamalanmamış bileşen, yetersiz segmentasyon ve izleme eksikliği.
:::

:::callout{tone="tip" title="Mülakat özeti"}
- Enjeksiyonun ilacı veriyi koddan yapısal olarak ayırmaktır: parametreli sorgu, bağlama uygun kaçışlama, CSP.
- CSRF çerezle kimlik doğrulamanın sorunudur: SameSite + Origin kontrolü + CSRF token'ı; GET durum değiştirmez.
- Giriş uç noktası: IP ve hesap bazlı hız sınırı, artan bekleme, genel hata mesajı, eşit yanıt süresi, MFA.
- Güvensiz tasarım kod taramasıyla bulunmaz; tehdit modellemesi gerektirir.
:::

:::quiz{src="quiz.json"}
:::

:::next{lesson="n-06-cryptography-basics"}
Sırada: bu savunmaların altında yatan araçlar. Hash, şifre saklama, simetrik ve asimetrik şifreleme, TLS ve anahtar yönetimi.
:::

---
id: p-05-browser-security
slug: browser-security
module: p-frontend-web
order: 5
title:
  tr: "Tarayıcı Güvenliği: SOP, CORS ve CSP"
  en: "Browser Security: SOP, CORS and CSP"
summary:
  tr: "Same-origin policy, CORS ön uçuş isteği, nonce'lu CSP, XSS ve CSRF'in tarayıcı tarafı, HttpOnly ve SameSite çerezler."
  en: "The same-origin policy, CORS preflight, nonce-based CSP, the browser side of XSS and CSRF, HttpOnly and SameSite cookies."
durationMinutes: 35
level: intermediate
tags: [frontend, security, cors, csp, xss, csrf, cookies]
prerequisites: [p-01-browser-rendering-pipeline, n-05-owasp-top-10]
concepts: [same-origin-policy, origin, cors, cors-preflight, content-security-policy, csp-nonce, xss, csrf, httponly-cookie, samesite-cookie]
---

## Kavram: tarayıcı, birbirine güvenmeyen kodların ortak evidir

Bir sekmede bankanız, diğerinde bir forum, üçüncüsünde reklamlarla dolu bir haber sitesi açık. Hepsi aynı tarayıcıda, aynı çerez kavanozuyla çalışıyor. Tarayıcının güvenlik modeli, bu siteleri birbirinden yalıtmak üzerine kuruludur ve temel taşı **same-origin policy**'dir (SOP — aynı köken politikası).

Bir **origin** üç parçadan oluşur: **şema + host + port**. `https://app.devacademy.dev` ile `https://api.devacademy.dev` farklı origin'dir (host farklı); `http://` ile `https://` da farklıdır. SOP kabaca şunu söyler: bir origin'den yüklenen JavaScript, başka bir origin'in **yanıtlarını okuyamaz**, DOM'una dokunamaz. Dikkat edin: SOP isteği göndermeyi değil, yanıtı **okumayı** engeller. `<img>`, `<form>` ve `<script src>` ile başka origin'e istek göndermek web'in doğasıdır ve serbesttir. Bu ayrım, aşağıdaki CSRF tartışmasının anahtarıdır.

## CORS: SOP'a kontrollü bir delik

Modern uygulamalarda ön yüz ile API çoğu zaman farklı origin'lerdedir. Ön yüzün API yanıtını okuyabilmesi için API'nin tarayıcıya "bu origin'e güveniyorum" demesi gerekir. **CORS** (Cross-Origin Resource Sharing) bu konuşmanın protokolüdür ve tamamen HTTP başlıklarıyla yürür:

- Tarayıcı isteğe `Origin: https://app.devacademy.dev` başlığını ekler.
- Sunucu yanıtta `Access-Control-Allow-Origin: https://app.devacademy.dev` döndürürse tarayıcı JavaScript'in yanıtı okumasına izin verir; döndürmezse yanıt sayfadan **gizlenir** ve kod yalnızca genel bir ağ hatası görür.

**Basit istekler** (GET, HEAD ya da form türünde içerikli POST) doğrudan gönderilir. Ama `PUT`/`DELETE` gibi metotlar, `Content-Type: application/json` ya da `Authorization` gibi özel başlıklar içeren istekler için tarayıcı önce bir **ön uçuş** (preflight) isteği atar: `OPTIONS` metoduyla, `Access-Control-Request-Method` ve `Access-Control-Request-Headers` başlıklarını taşıyarak "bunu göndersem kabul eder misin?" diye sorar. Sunucu izin verirse asıl istek gider; vermezse asıl istek **hiç gönderilmez**. Ön uçuşun sonucu `Access-Control-Max-Age` süresince önbelleğe alınabilir; aksi hâlde her istek fazladan bir gidiş-dönüş öder.

Çerez göndermek isteyen (`credentials: 'include'`) bir istek için sunucu ayrıca `Access-Control-Allow-Credentials: true` döndürmeli ve `Access-Control-Allow-Origin` değeri `*` **olamaz**, açık origin olmalıdır. Bu projede backend `app.enableCors({ origin: CORS_ORIGINS, credentials: true })` ile tam olarak bunu yapar: yalnızca ortam değişkeninde listelenen origin'lere ve çerezli isteklere izin verir.

:::diagram{src="diagram.svg" alt="Tarayıcıda SOP, CORS ön uçuşu ve CSP'nin konumu: farklı origin'e giden isteğin OPTIONS ile sorulması, CSP'nin inline script'i engellemesi, HttpOnly çerezin JavaScript'ten gizlenmesi|Where SOP, CORS preflight and CSP sit in the browser: a cross-origin request asked first with OPTIONS, CSP blocking an inline script, an HttpOnly cookie hidden from JavaScript"}
Tarayıcı üç kapı tutar: SOP/CORS hangi yanıtın okunabileceğini, CSP hangi kodun çalışabileceğini, çerez öznitelikleri hangi kimlik bilgisinin nereye gideceğini belirler.
:::

:::animation{scene="scene.json"}
Önce reddedilen bir ön uçuş: OPTIONS gider, izin başlığı dönmez, PUT hiç gönderilmez. Sonra kabul edilen ön uçuş ve asıl istek. Ardından CSP: nonce'lu script çalışır, enjekte edilmiş inline script engellenir; HttpOnly çerez JavaScript'e görünmez.
:::

:::interactive{type="request-journey" layers="browser,dns,tcp,tls,options-preflight-http,put-http,api-service" failureStage="options-preflight-http" rttMs=60}
"İstek gönder" ile cross-origin bir PUT'un yolculuğunu izleyin: `options-preflight-http` adımı asıl istekten önce fazladan bir gidiş-dönüştür. RTT kaydırıcısını yükseltin ve ön uçuşun toplam gecikmedeki payının büyüdüğünü görün; `Access-Control-Max-Age` bu adımı tekrar eden isteklerde ortadan kaldırır. Sonra hata enjeksiyonu kutusunu işaretleyip tekrar gönderin: yolculuk ön uçuşta biter ve `put-http` adımına hiç ulaşılmaz. (Simülatör bunu genel bir sunucu hatası olarak etiketler; gerçek tarayıcıda bu bir CORS hatasıdır ve JavaScript yalnızca `TypeError: Failed to fetch` görür.)
:::

## CSP: hangi kod çalışabilir?

[N-05](/lessons/n-05-owasp-top-10) dersinde XSS'in özünü gördük: saldırganın verisi sayfada **kod** olarak yorumlanır. Çıktıyı bağlama uygun kaçışlamak birinci savunmadır; **Content Security Policy** ise ikinci hattır. CSP bir yanıt başlığıdır ve tarayıcıya "bu sayfada yalnızca şu kaynaklardan gelen script'ler çalışabilir" der.

En güçlü biçimi **nonce tabanlı** (strict) CSP'dir. Sunucu her istekte tahmin edilemez rastgele bir değer üretir, başlığa `script-src 'nonce-R4nd0m'` yazar ve meşru her `<script>` etiketine `nonce="R4nd0m"` ekler. Saldırgan bir yorum alanına `<script>…</script>` enjekte etse bile o istekteki nonce'u bilemeyeceği için tarayıcı script'i **çalıştırmaz** ve bir ihlal raporu üretir.

Bu projenin web uygulaması tam olarak bunu yapar: `web/src/middleware.ts` her istekte `crypto.randomUUID()` ile bir nonce üretir; `web/src/lib/csp.ts` politikayı kurar. `script-src` içinde `'unsafe-inline'` **yoktur**; Next.js kendi satır içi script'lerini başlıktaki nonce ile işaretler. Ayrıca `object-src 'none'`, `base-uri 'self'` ve `frame-ancestors 'self'` gibi yönergeler eklenti, `<base>` etiketi ve clickjacking saldırılarını kapatır. [P-02](/lessons/p-02-csr-ssr-ssg-isr)'de gördüğümüz gibi bunun bir bedeli vardır: istek başına değişen nonce, sayfanın statik HTML olarak önbelleğe alınmasını engeller.

## CSRF ve çerez öznitelikleri

SOP yanıtı okumayı engeller ama göndermeyi engellemez. Kötü niyetli bir site, kullanıcının tarayıcısından bankaya otomatik gönderilen bir form POST'u tetiklerse ve tarayıcı banka çerezini de eklerse, sunucu bunu meşru bir istek sanır: **CSRF**. CORS burada koruma **sağlamaz**, çünkü basit istekler ön uçuşsuz gider ve sunucu işlemi zaten yapmıştır; tarayıcı yalnızca yanıtı saklar.

Tarayıcı tarafındaki savunmalar çerez özniteliklerindedir:

- **`SameSite=Lax`** (modern tarayıcıların varsayılanı) ya da `Strict`: çerez, başka bir siteden başlatılan alt isteklere ve POST'lara eklenmez. CSRF'in büyük bölümünü tek başına keser.
- **`HttpOnly`**: çerez `document.cookie` ile okunamaz. XSS olsa bile oturum çerezi çalınamaz. Bu projede refresh token çerezi `httpOnly: true` ile ayarlanır.
- **`Secure`**: çerez yalnızca HTTPS üzerinden gider.

:::code{lang="ts" title="Express/Nest: dar CORS ve güvenli çerez"}
```ts
app.enableCors({
  origin: ['https://app.devacademy.dev'], // '*' DEĞİL: çerezli isteklerde zaten yasak
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  maxAge: 600, // ön uçuş sonucu 10 dk önbellekte: her isteğe +1 RTT ödenmez
});

res.cookie('refresh_token', token, {
  httpOnly: true,   // JS okuyamaz → XSS çalamaz
  secure: true,     // yalnızca HTTPS
  sameSite: 'lax',  // başka siteden gelen POST'a eklenmez → CSRF'e karşı
  path: '/api/v1/auth',
});
```
:::

:::realworld{company="GitHub"}
GitHub mühendislik blogunda yayımlanan *GitHub's CSP journey* yazısı, şirketin Content Security Policy'yi yıllar içinde nasıl sıkılaştırdığını anlatır. İlk adım, kod tabanındaki satır içi script'leri ve olay işleyicilerini (`onclick` gibi) ayrı dosyalara taşıyıp `script-src`'den `'unsafe-inline'`'ı kaldırabilmekti; bu, büyük bir uygulamada kademeli bir temizlik işidir. Ardından ekip, yalnızca script'lere değil diğer kaynak türlerine de odaklandı: görsellerin, formların ve bağlantıların hangi origin'lere gidebileceğini daraltarak, script çalıştıramayan bir saldırganın bile örneğin kapanmamış bir HTML özniteliğiyle sayfadaki gizli bilgiyi dış bir sunucuya sızdırmasını (dangling markup) zorlaştırdılar. Takip yazısı *GitHub's post-CSP journey*, CSP'nin tek başına yetmediği bu tür senaryolar için eklenen ek savunmaları ele alır. Ortak ders: CSP bir kerelik bir başlık değil, uygulamayla birlikte evrilen ve ihlal raporlarıyla izlenen bir politikadır.
:::

:::callout{tone="danger" title="CORS bir yetkilendirme mekanizması değildir"}
CORS yalnızca **tarayıcının** yanıtı sayfaya gösterip göstermeyeceğini belirler. `curl` ya da bir sunucu betiği CORS'u hiç umursamaz. API'nizi CORS ile "koruduğunuzu" düşünmeyin; kimlik doğrulama ve yetkilendirme sunucu tarafında yapılmalıdır. Ayrıca `Access-Control-Allow-Origin` değerini gelen `Origin` başlığını körü körüne yansıtarak üretmek, CORS'u tamamen anlamsız kılar.
:::

:::callout{tone="tip" title="Mülakat özeti"}
SOP okumayı engeller, göndermeyi değil. CORS bu kısıtı sunucunun izniyle gevşetir; özel metot ya da başlık varsa OPTIONS ön uçuşu gider. XSS'e karşı: kaçışlama + nonce'lu CSP + HttpOnly çerez. CSRF'e karşı: SameSite çerez + CSRF token; CORS CSRF'i önlemez.
:::

:::quiz{src="quiz.json"}
:::

:::resources
- [MDN: Same-origin policy](https://developer.mozilla.org/en-US/docs/Web/Security/Same-origin_policy) — belge
- [MDN: Cross-Origin Resource Sharing (CORS)](https://developer.mozilla.org/en-US/docs/Web/HTTP/CORS) — belge — basit istekler, ön uçuş, credentials
- [Mitigate cross-site scripting (XSS) with a strict Content Security Policy](https://web.dev/articles/strict-csp) — makale — Chrome ekibi: nonce tabanlı CSP
- [OWASP: Cross Site Request Forgery](https://owasp.org/www-community/attacks/csrf) — belge
:::

:::next{lesson="p-06-accessibility-design-systems"}
Sırada: hızlı ve güvenli bir arayüz herkes için kullanılabilir de olmalı. Semantik HTML, klavye, ARIA ve tasarım token'ları.
:::

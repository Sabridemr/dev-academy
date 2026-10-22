---
id: p-01-browser-rendering-pipeline
slug: browser-rendering-pipeline
module: p-frontend-web
order: 1
title:
  tr: "Tarayıcı Bir Sayfayı Nasıl Çizer?"
  en: "How Does the Browser Paint a Page?"
summary:
  tr: "HTML → DOM, CSS → CSSOM, render ağacı, layout, paint ve composite; kritik render yolu ve JavaScript'in ayrıştırıcıyı neden durdurduğu."
  en: "HTML → DOM, CSS → CSSOM, render tree, layout, paint and composite; the critical rendering path and why JavaScript blocks the parser."
durationMinutes: 30
level: beginner
tags: [frontend, browser, rendering, dom, css, javascript, performance]
prerequisites: [a-01-client-server-dns-http]
concepts: [dom, cssom, render-tree, layout-reflow, paint, compositing, critical-rendering-path, render-blocking-resources, parser-blocking-script]
---

## Kavram: baytlardan piksellere

[A-01](/lessons/a-01-client-server-dns-http) dersinde bir URL yazdığınızda DNS çözümlemesinin, TCP/TLS el sıkışmasının ve HTTP isteğinin nasıl gerçekleştiğini gördük. Hikâye orada bitmez: sunucudan gelen yanıt yalnızca bir bayt akışıdır. Tarayıcının bu baytları ekranda okunabilir, tıklanabilir piksellere dönüştürmesi ayrı bir boru hattıdır ve frontend performansının neredeyse tamamı bu boru hattının ne kadar erken ve ne kadar az tekrarla çalıştığına bağlıdır.

Boru hattının adımları kabaca şöyledir:

1. **HTML ayrıştırma → DOM.** Tarayıcı HTML'i baştan sona okur, etiketleri belirteçlere (token) ayırır ve bir ağaç kurar: **DOM** (Document Object Model). Ayrıştırma artımlıdır; dosyanın tamamı gelmeden ilk düğümler oluşmaya başlar.
2. **CSS ayrıştırma → CSSOM.** `<link rel="stylesheet">` ve `<style>` içindeki kurallar ikinci bir ağaca dönüşür: **CSSOM**. CSS'in doğası gereği CSSOM artımlı kullanılamaz; sonraki bir kural öncekini ezebileceği için tarayıcı tüm stil dosyası gelmeden "son" stili bilemez.
3. **Render ağacı.** DOM ve CSSOM birleştirilir; yalnızca görünecek düğümler kalır. `display: none` olan bir öğe render ağacına girmez (ama `visibility: hidden` girer, çünkü yer kaplar).
4. **Layout (reflow).** Her kutunun ekrandaki konumu ve boyutu hesaplanır: genişlikler, satır kırılmaları, yüzdelerin piksele çevrilmesi.
5. **Paint.** Kutular piksel komutlarına dönüşür: metin, renk, kenarlık, gölge, görsel.
6. **Composite.** Sayfa birden fazla katmana (layer) bölünmüşse bu katmanlar GPU'da doğru sırayla üst üste konur ve ekrana basılır.

Kullanıcının ilk anlamlı içeriği görmesi için bu altı adımın en az bir kez baştan sona çalışması gerekir. Buna **kritik render yolu** (critical rendering path) denir.

:::diagram{src="diagram.svg" alt="HTML ve CSS'in DOM ve CSSOM'a, ardından render ağacı, layout, paint ve composite adımlarına akışı; script'in ayrıştırıcıyı durdurduğu nokta|HTML and CSS flowing into DOM and CSSOM, then render tree, layout, paint and composite; the point where a script blocks the parser"}
İki ağaç birleşmeden hiçbir şey çizilmez. Kırmızı çizgi, `defer`/`async` olmayan bir script'in ayrıştırıcıyı durdurduğu yeri gösterir.
:::

## Neyi bloklar, ne bloklamaz?

Kritik render yolunu yavaşlatan iki tür engel vardır ve sık karıştırılır:

- **Render'ı bloklayan kaynaklar.** CSS, varsayılan olarak *render-blocking*'dir: CSSOM hazır olmadan tarayıcı ilk boyamayı yapmaz. Bu kasıtlıdır; aksi hâlde kullanıcı önce stilsiz bir sayfa görür, sonra her şey yerinden zıplar (FOUC — flash of unstyled content). CSS ayrıştırmayı durdurmaz, yalnızca çizimi bekletir.
- **Ayrıştırıcıyı bloklayan script'ler.** `<script src="app.js">` etiketine (ne `defer` ne `async` varsa) gelen ayrıştırıcı **durur**: dosyayı indirir, çalıştırır, sonra devam eder. Neden? Çünkü script `document.write` ile HTML'in geri kalanını değiştirebilir ya da henüz oluşmamış bir düğümü okumaya çalışabilir. Daha da kötüsü: script bir öğenin stilini sorgulayabileceği için tarayıcı script'i çalıştırmadan önce bekleyen CSS'in de bitmesini bekler. Yani yavaş bir CSS dosyası, dolaylı olarak JavaScript'i ve dolayısıyla DOM inşasını da bekletir.

Modern tarayıcılar bu bekleme süresini tamamen boşa harcamaz: bir **ön yükleme tarayıcısı** (preload scanner) duran ayrıştırıcının ilerisine bakar ve ileride geçen görselleri, stil ve script dosyalarını önceden istemeye başlar. Yine de DOM inşası durmuştur ve ilk boyama gecikir.

:::predict{id="script-head-etkisi"}
`<head>` içinde `defer` ya da `async` olmadan yüklenen 400 KB'lık bir `app.js` var. Ağ yavaş. Kullanıcı ne görür? | A 400 KB `app.js` is loaded in `<head>` without `defer` or `async`. The network is slow. What does the user see?
- [ ] Sayfa metni hemen görünür, script arka planda iner | The page text appears immediately while the script downloads in the background
- [x] Script inip çalışana kadar ayrıştırıcı durur; gövde DOM'a girmediği için ekran boş kalır | The parser stops until the script downloads and runs; the body never reaches the DOM so the screen stays blank
- [ ] Yalnızca görseller gecikir, metin etkilenmez | Only images are delayed, text is unaffected
Açıklama: Senkron script ayrıştırıcıyı durdurur. `<head>`'deyken `<body>` henüz ayrıştırılmamıştır; render ağacında çizilecek içerik yoktur. `defer` eklemek indirmeyi paralel yapar ve çalıştırmayı ayrıştırma bitene kadar erteler. | A synchronous script halts the parser. While it sits in `<head>`, `<body>` has not been parsed, so there is nothing to paint. Adding `defer` downloads it in parallel and postpones execution until parsing finishes.
:::

:::animation{scene="scene.json"}
Dosyalar gelir, ayrıştırıcı DOM'u kurar, CSS çizimi bekletir, senkron script ayrıştırıcıyı durdurur; sonunda render ağacı → layout → paint → composite ile ilk boyama olur.
:::

## `defer`, `async` ve `type="module"`

Script'in nasıl yüklendiği, kritik yoldaki en ucuz ve en etkili düğmedir:

| Biçim | İndirme | Çalışma zamanı | Sıra korunur mu? | Tipik kullanım |
|---|---|---|---|---|
| `<script src>` | Ayrıştırıcıyı durdurur | Hemen | Evet | Kaçının; ancak gerçekten erken çalışması gereken minik kodlar |
| `<script defer src>` | Paralel | Ayrıştırma bitince, `DOMContentLoaded`'dan önce | Evet | Uygulama kodunun varsayılanı |
| `<script async src>` | Paralel | İner inmez (ayrıştırmayı kısa süre keser) | Hayır | Bağımsız analitik, reklam |
| `<script type="module">` | Paralel | `defer` gibi | Evet | Modern paketlenmiş kod |

Next.js ve benzeri çatılar kendi ürettikleri script'leri zaten `defer` ya da `async` ile ekler; sorun genellikle sonradan elle eklenen üçüncü taraf etiketlerinde çıkar.

## Layout ve paint'i tekrar tetiklemek

İlk boyamadan sonra da boru hattı çalışmaya devam eder. JavaScript DOM'u ya da stilleri değiştirdiğinde tarayıcı etkilenen adımları yeniden çalıştırır:

- **Geometriyi** değiştiren bir değişiklik (genişlik, `top`, yazı tipi boyutu, yeni düğüm eklemek) layout → paint → composite zincirinin hepsini tetikler. En pahalısıdır.
- **Yalnızca görünümü** değiştiren bir değişiklik (renk, arka plan) layout'u atlar; paint ve composite yeterlidir.
- **`transform` ve `opacity`** genellikle yalnızca composite adımını tetikler; bu yüzden akıcı animasyonlar bu iki özellikle yapılır.

Klasik bir tuzak **layout thrashing**'dir: bir döngü içinde önce bir stil yazıp hemen ardından `offsetHeight` gibi bir geometri değeri okumak, tarayıcıyı her turda layout'u senkron olarak yeniden hesaplamaya zorlar. Önce tüm okumaları, sonra tüm yazmaları toplu yapmak bu sorunu çözer.

:::code{lang="html" title="Kritik yolu kısaltan bir <head>"}
```html
<head>
  <meta charset="utf-8" />
  <!-- Kritik, küçük CSS satır içinde: ilk boyama ağ beklemez -->
  <style>/* yalnızca ilk ekranın stilleri */</style>
  <!-- Geri kalan CSS: yine render'ı bloklar, bu yüzden küçük tutun -->
  <link rel="stylesheet" href="/app.css" />
  <!-- LCP görselini erken iste -->
  <link rel="preload" as="image" href="/hero.avif" />
  <!-- Uygulama kodu: paralel iner, ayrıştırma bitince çalışır -->
  <script defer src="/app.js"></script>
  <!-- Bağımsız analitik: sıradan bağımsız -->
  <script async src="/analytics.js"></script>
</head>
```
:::

:::realworld{company="Google Chrome"}
Chrome ekibinin geliştirici blogunda yayımlanan dört bölümlük *Inside look at modern web browser* serisi, bu dersteki boru hattının Chrome içinde nasıl çalıştığını anlatır. Yazı, tarayıcının çok süreçli mimarisini, renderer sürecindeki **ana iş parçacığının** (main thread) HTML ayrıştırma, stil hesaplama, layout ve paint kayıtlarını üretmekten sorumlu olduğunu, ardından **compositor iş parçacığının** katmanları karolara bölüp GPU'ya gönderdiğini açıklar. Serinin önemli bir dersi şudur: ana iş parçacığı uzun bir JavaScript görevi yüzünden meşgulken, yalnızca compositor ile yapılabilen işler (örneğin `transform` ile yapılan animasyonlar ya da olay dinleyicisi olmayan bir alanda kaydırma) akmaya devam edebilir; ama layout ya da paint gerektiren her şey bekler. Chrome ekibinin web.dev üzerindeki kritik render yolu rehberleri de aynı sonuca varır: kritik CSS'i küçültmek, script'leri `defer` ile yüklemek ve animasyonları composite adımına bırakmak, kullanıcının ilk içeriği görme süresini doğrudan kısaltır.
:::

:::callout{tone="warning" title="CSS'i ertelemek her zaman kazanç değildir"}
Tüm CSS'i asenkron yüklemek ilk boyamayı hızlandırır ama stilsiz içerik çizip ardından yerinden oynatır; bu hem kötü bir deneyimdir hem de CLS (düzen kayması) puanını bozar. Doğru denge: ilk ekranın kritik CSS'i satır içi ya da küçük bir dosyada, geri kalanı sonra.
:::

:::callout{tone="tip" title="Mülakat özeti"}
"Tarayıcıya URL yazınca ne olur?" sorusunun ikinci yarısı budur: DOM + CSSOM → render ağacı → layout → paint → composite. CSS render'ı, senkron JS ayrıştırmayı bloklar; `defer` ile `async` farkını ve `transform`/`opacity`'nin neden ucuz olduğunu söyleyebilmek sizi ayırır.
:::

:::quiz{src="quiz.json"}
:::

:::resources
- [Inside look at modern web browser (part 3)](https://developer.chrome.com/blog/inside-browser-part3) — blog — Chrome ekibi: renderer sürecinin iç işleyişi
- [MDN: Critical rendering path](https://developer.mozilla.org/en-US/docs/Web/Performance/Critical_rendering_path) — belge
- [MDN: The script element](https://developer.mozilla.org/en-US/docs/Web/HTML/Element/script) — belge — defer, async ve module
:::

:::next{lesson="p-02-csr-ssr-ssg-isr"}
Sırada: HTML'i kim, ne zaman üretiyor? Sunucuda mı, tarayıcıda mı, build anında mı? CSR, SSR, SSG ve ISR karşılaştırması.
:::

---
id: p-06-accessibility-design-systems
slug: accessibility-design-systems
module: p-frontend-web
order: 6
title:
  tr: "Erişilebilirlik ve Tasarım Sistemi"
  en: "Accessibility and Design Systems"
summary:
  tr: "Semantik HTML, klavye gezinmesi, ARIA, kontrast, prefers-reduced-motion; bileşen kütüphanesi ve tasarım token'ları."
  en: "Semantic HTML, keyboard navigation, ARIA, contrast, prefers-reduced-motion; component libraries and design tokens."
durationMinutes: 30
level: beginner
tags: [frontend, accessibility, a11y, aria, design-system, design-tokens, css]
prerequisites: [p-01-browser-rendering-pipeline]
concepts: [semantic-html, accessibility-tree, keyboard-navigation, aria, color-contrast, prefers-reduced-motion, focus-management, design-tokens, component-library]
---

## Kavram: arayüzü göremeyen, fare kullanamayan biri için

Şimdiye kadar sayfanın ne kadar hızlı çizildiğini ve ne kadar güvenli olduğunu konuştuk. Ama kullanıcıların önemli bir bölümü sayfayı bizim gibi görmez ya da kullanmaz: ekran okuyucu ile dinleyenler, yalnızca klavye veya anahtar cihazı kullananlar, büyütme ile okuyanlar, renk körleri, hareket hassasiyeti olanlar ve kırık ekranlı telefonla güneş altında işlem yapan herkes. **Erişilebilirlik** (accessibility, kısaca a11y), arayüzü bu kişilerin de kullanabilmesidir ve birçok ülkede kamu ve ticari hizmetler için yasal bir zorunluluktur. Uluslararası referans W3C'nin **WCAG** (Web Content Accessibility Guidelines) yönergeleridir; çoğu kurum AA düzeyini hedefler.

## Erişilebilirlik ağacı ve semantik HTML

Tarayıcı, [P-01](/lessons/p-01-browser-rendering-pipeline)'de gördüğümüz DOM'dan bir de **erişilebilirlik ağacı** türetir. Ekran okuyucular piksellere değil bu ağaca bakar. Ağaçtaki her düğümün üç temel bilgisi vardır: **rol** (düğme, bağlantı, başlık, gezinme bölgesi), **ad** (düğmenin üzerindeki metin ya da görselin `alt` metni) ve **durum** (işaretli, genişletilmiş, devre dışı).

Bu bilgilerin çoğunu **semantik HTML** bedavaya verir:

- `<button>` odaklanabilir, Enter ve Space ile tetiklenir, rolü "düğme"dir. `<div onclick>` ise hiçbirini yapmaz.
- `<nav>`, `<main>`, `<header>`, `<footer>` **landmark** (yer işareti) oluşturur; ekran okuyucu kullanıcısı tek tuşla "ana içeriğe" atlayabilir.
- `<h1>`–`<h6>` başlık hiyerarşisi bir içindekiler tablosu gibi çalışır; kullanıcılar sayfayı başlıklar arasında gezinerek tarar.
- `<label for>` form alanına ad verir; `<img alt>` görseli anlatır, süs görseli için `alt=""` onu yok sayar.

"Div çorbası" ile yazılmış bir sayfa görsel olarak aynı görünebilir ama erişilebilirlik ağacında başlıksız, bölgesiz, düğmesiz bir metin yığınına dönüşür.

:::diagram{src="diagram.svg" alt="Aynı arayüzün semantik HTML ile ve div çorbasıyla yazılmış hâllerinin erişilebilirlik ağaçları: birinde landmark, başlık ve düğme rolleri, diğerinde rolsüz düğümler|Accessibility trees for the same interface written with semantic HTML and with div soup: one has landmark, heading and button roles, the other has role-less nodes"}
Görsel olarak aynı iki sayfa, ekran okuyucu için iki farklı dünya: solda gezilebilir bir yapı, sağda düz bir metin akışı.
:::

:::animation{scene="scene.json"}
Ekran okuyucu semantik sayfada landmark'lar, başlıklar ve düğme arasında tuşlarla atlar; div çorbasında landmark ve başlık bulamaz, `<div onclick>` düğmesine Tab ile hiç ulaşamaz.
:::

## Klavye ve odak yönetimi

Her etkileşim yalnızca klavyeyle de yapılabilmelidir. Kurallar basittir ama sık çiğnenir:

- **Sekme sırası** DOM sırasını izler; görsel sırayı CSS ile değiştirip DOM'u bırakmak kullanıcıyı ekranda zıplatır. Pozitif `tabindex` değerlerinden kaçının.
- **Odak görünür olmalıdır.** `outline: none` yazıp yerine bir şey koymamak, klavye kullanıcısını kör eder. `:focus-visible` yalnızca klavye ile gelindiğinde halka gösterir; bu projede `globals.css` içindeki `:where(:focus-visible)` kuralı tüm öğelere ana renkte bir odak halkası verir.
- **Modal pencereler** açılınca odağı içeri almalı, içeride tutmalı (focus trap), Escape ile kapanmalı ve kapanınca odağı açan öğeye geri vermelidir.
- Sayfanın başında bir **"İçeriğe geç"** bağlantısı, her sayfada menüyü tekrar tekrar dinlemek zorunda kalan kullanıcıyı kurtarır. Bu projenin `Header` bileşeni de böyle bir bağlantıyla başlar.

## ARIA: yalnızca HTML yetmediğinde

**ARIA** (Accessible Rich Internet Applications), erişilebilirlik ağacına rol, ad ve durum eklemenin yoludur: `aria-label`, `aria-expanded`, `aria-live`, `role="dialog"`. Ama ARIA'nın birinci kuralı, onu **kullanmamaktır**: yerel bir HTML öğesi işi görüyorsa onu kullanın. `role="button"` eklemek bir `<div>`'i ekran okuyucuya düğme gibi tanıtır ama odaklanabilirlik ve klavye davranışını eklemez; bunları elle yazmanız gerekir. Yanlış ARIA, hiç ARIA olmamasından kötüdür, çünkü kullanıcıya yalan söyler.

ARIA'nın gerçekten parladığı yer dinamik içeriktir. `aria-live="polite"` bir bölgedeki değişiklikleri ekran okuyucuya duyurur. Bu projenin animasyon oynatıcısı (`ScenePlayer`) her adımın anlatımını böyle bir canlı bölgede gösterir; böylece sahneyi göremeyen kullanıcı da adımları dinleyebilir.

## Görsel erişilebilirlik ve hareket

- **Kontrast:** WCAG AA, normal metin için en az **4,5:1**, büyük metin ve arayüz bileşenleri için **3:1** kontrast oranı ister. Bilgiyi yalnızca renkle vermeyin; "kırmızı alanlar hatalıdır" yerine ikon ve metin ekleyin.
- **Hareket:** vestibüler bozukluğu olan kullanıcılar için büyük kaymalar ve paralaks baş dönmesi yapabilir. İşletim sistemindeki "hareketi azalt" ayarı CSS'te `prefers-reduced-motion` ile okunur. Bu projede `globals.css` bu ayar açıkken tüm animasyon ve geçiş sürelerini neredeyse sıfıra indirir; sahne oynatıcısı paketleri animasyonsuz gösterir ve adım transkriptini listeler. Ayrıca her sahne dosyasında `a11y.description` alanı zorunludur ve doğrulayıcı bunu denetler.

:::code{lang="css" title="Token'lar, odak ve hareket tercihi"}
```css
:root {
  /* Ham değer: Tailwind'in alfa desteği için RGB üçlüsü */
  --da-primary-rgb: 79 140 255;
  /* Anlamsal token: bileşenler ve SVG diyagramlar yalnızca bunu kullanır */
  --da-primary: rgb(var(--da-primary-rgb));
}

/* Sıfır özgüllük: bileşen kendi odak stilini tanımlayabilir ama varsayılan hep var */
:where(:focus-visible) {
  outline: 2px solid var(--da-primary);
  outline-offset: 2px;
}

@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    transition-duration: 0.01ms !important;
  }
}
```
:::

## Tasarım sistemi: erişilebilirliği bir kez doğru yapmak

Her ekip her düğmeyi baştan yazarsa, erişilebilirlik her seferinde yeniden unutulur. **Tasarım sistemi**, bu kararları merkezileştirir:

- **Tasarım token'ları:** renk, boşluk, yazı boyutu, köşe yarıçapı, gölge gibi kararların isimlendirilmiş değişkenleri. Bileşenler ham değer (`#4f8cff`) yerine anlamsal adı (`--da-primary`) kullanır. Bu projede tüm renkler `--da-*` değişkenleriyle tanımlıdır; koyu ve açık tema aynı adların farklı değerleridir. İçerik klasöründeki SVG diyagramlar da yalnızca bu değişkenleri kullandığı için temayla birlikte renk değiştirir. Her renk için ayrıca bir `-fg` tonu vardır: o rengin üzerinde ya da metin olarak kullanıldığında kontrastı sağlayan değer.
- **Bileşen kütüphanesi:** odak yönetimi, klavye davranışı ve ARIA'sı bir kez doğru yazılmış `Button`, `Dialog`, `Tabs` bileşenleri. Radix UI ya da React Aria gibi "başsız" (headless) kütüphaneler davranışı ve erişilebilirliği sağlar, görünümü size bırakır.
- **Dokümantasyon ve test:** her bileşenin nasıl ve ne zaman kullanılacağı, otomatik denetimler (axe gibi araçlar) ve gerçek yardımcı teknolojilerle elle test.

:::realworld{company="GOV.UK"}
Birleşik Krallık hükümetinin dijital hizmetlerini yöneten Government Digital Service (GDS), tüm kamu kurumlarının kullanması için açık kaynak **GOV.UK Design System**'i yayımlar. Sistemdeki bileşen ve kalıplar (tarih girişi, hata özeti, "bir şey seçin" soruları gibi) kullanıcı araştırmasıyla geliştirilir ve ekran okuyucular, ekran büyütücüler ve sesle kontrol yazılımları gibi yardımcı teknolojilerle test edilir; dokümantasyonda her bileşenin erişilebilirlikle ilgili bilinen sorunları açıkça yazılır. GOV.UK Frontend, ilerleyici geliştirme (progressive enhancement) ilkesini izler: temel işlev JavaScript olmadan da çalışır. Birleşik Krallık'taki kamu kurumu web sitelerinin erişilebilirlik düzenlemelerine göre WCAG'ın AA düzeyini karşılaması ve bir erişilebilirlik beyanı yayımlaması gerekir; ortak bir tasarım sistemi, yüzlerce ekibin bu yükü tek tek taşımak yerine doğru yapılmış bileşenleri yeniden kullanmasını sağlar. GDS ayrıca farklı engelleri olan kullanıcıları temsil eden erişilebilirlik personalarını açık kaynak olarak paylaşmıştır.
:::

:::callout{tone="warning" title="Otomatik araçlar sorunların ancak bir kısmını bulur"}
axe veya Lighthouse gibi araçlar eksik `alt` metnini, düşük kontrastı, etiketsiz form alanını yakalar. Ama "bu sekme sırası mantıklı mı?", "bu `aria-label` gerçekten anlamlı mı?" gibi soruları cevaplayamaz. Sayfayı en az bir kez yalnızca klavyeyle ve bir ekran okuyucuyla (NVDA, VoiceOver) kullanın.
:::

:::callout{tone="tip" title="Mülakat özeti"}
Önce semantik HTML, sonra gerekiyorsa ARIA. Her şey klavyeyle yapılabilmeli ve odak görünür olmalı. Kontrast AA: 4,5:1 / 3:1. Hareket için `prefers-reduced-motion`. Tasarım sistemi = token'lar + erişilebilirliği doğru bileşenler + dokümantasyon.
:::

:::quiz{src="quiz.json"}
:::

:::resources
- [WCAG 2 Overview](https://www.w3.org/WAI/standards-guidelines/wcag/) — belge — W3C WAI
- [ARIA Authoring Practices Guide](https://www.w3.org/WAI/ARIA/apg/) — belge — bileşen kalıpları ve klavye davranışları
- [GOV.UK Design System](https://design-system.service.gov.uk/) — belge — erişilebilir bileşenler ve kalıplar
- [MDN: prefers-reduced-motion](https://developer.mozilla.org/en-US/docs/Web/CSS/@media/prefers-reduced-motion) — belge
:::

:::next{lesson="f-08-devacademy-architecture"}
Modülün sonu. Şimdi bu modülde öğrendiklerinizi gerçek bir sistemde görün: DevAcademy'nin kendi mimarisi — Next.js ön yüzü, API, önbellek ve altyapı.
:::

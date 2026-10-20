---
id: l-10-dynamic-programming
slug: dynamic-programming
module: l-algorithms-data-structures
order: 10
title:
  tr: "Dinamik Programlama"
  en: "Dynamic Programming"
summary:
  tr: "Örtüşen alt problemler, memoization ve tabulation; Fibonacci, sırt çantası ve en uzun ortak alt dizi; Python izleriyle."
  en: "Overlapping subproblems, memoization and tabulation; Fibonacci, knapsack and longest common subsequence; with Python traces."
durationMinutes: 35
level: advanced
tags: [algoritmalar, dinamik-programlama, ozyineleme, python, mulakat]
prerequisites: [l-09-binary-search, k-08-ozyineleme]
concepts: [dynamic-programming, overlapping-subproblems, optimal-substructure, memoization, tabulation, knapsack, lcs]
---

## Kavram: aynı soruyu iki kez çözme

Bir arkadaşın sana "1 + 1 + 1 + 1 + 1 kaç eder?" diye sorsun; parmaklarınla sayıp "beş" dersin. Ardından sonuna bir "+ 1" daha ekleyip yeniden sorsun. Baştan saymazsın; az önceki cevabı hatırlar ve "altı" dersin. **Dinamik programlama** (dynamic programming, kısaca DP) bu kadar basit bir fikre dayanır: bir problemi daha küçük alt problemlere böl, her alt problemi **yalnızca bir kez** çöz, sonucu bir yere yaz ve aynı alt problem tekrar karşına çıktığında yeniden hesaplamak yerine yazdığın cevabı kullan.

İsim kafa karıştırıcı olabilir. "Programlama" burada kod yazmak değil, 1950'lerdeki anlamıyla "plan ya da tablo doldurmak" demektir; "dinamik" sözcüğü de daha çok kulağa hoş geldiği için seçilmiştir. Asıl önemli olan iki koşuldur ve bir problemin DP ile çözülebilmesi için ikisinin de sağlanması gerekir:

1. **Optimal alt yapı (optimal substructure):** Büyük problemin en iyi çözümü, alt problemlerin en iyi çözümlerinden kurulabilir. İstanbul'dan Ankara'ya en kısa yol Bolu'dan geçiyorsa, o yolun İstanbul–Bolu kısmı da İstanbul'dan Bolu'ya en kısa yol olmalıdır.
2. **Örtüşen alt problemler (overlapping subproblems):** Aynı alt problemler tekrar tekrar ortaya çıkar. Birleştirme sıralamasında (merge sort) alt problemler örtüşmez; her yarı bir kez sıralanır, bu yüzden orada DP'ye gerek yoktur. Fibonacci'de ise aynı değerler defalarca istenir.

Böl ve yönet (divide and conquer) ile DP arasındaki farkı tam da ikinci madde belirler. Açgözlü (greedy) algoritmalarla farkı ise birinci maddenin nasıl kullanıldığındadır: açgözlü yaklaşım her adımda o an en iyi görünen seçimi yapar ve geri dönmez; DP ise tüm seçenekleri değerlendirir, ama her alt problemi yalnızca bir kez.

## Fibonacci: üstelden doğrusala

Fibonacci dizisini özyinelemeyle yazmak çok doğaldır: `fib(n) = fib(n - 1) + fib(n - 2)`. Ancak bu tanımı doğrudan koda dökersen çağrı ağacı her seviyede ikiye dallanır. `fib(5)` hesaplanırken `fib(3)` iki kez, `fib(2)` üç kez hesaplanır; `fib(40)` için toplam çağrı sayısı yüz milyonları aşar. Zaman karmaşıklığı kabaca O(2ⁿ)'dir ve Big-O dersinde gördüğümüz gibi bu eğri çok kısa sürede kullanılamaz hâle gelir.

:::diagram{src="diagram.svg" alt="fib(5) çağrı ağacı: tekrarlanan fib(3) ve fib(2) düğümleri vurgulu; yanında memo tablosu ve tabulation dizisi|The fib(5) call tree with repeated fib(3) and fib(2) nodes highlighted, next to a memo table and a tabulation array"}
Solda saf özyinelemenin çağrı ağacı: aynı renkli düğümler aynı alt problemdir. Sağda aynı hesabın memo tablosuyla yalnızca bir kez yapılması.
:::

Çözüm, her `fib(k)` sonucunu ilk hesaplandığında bir sözlüğe yazmaktır. Bu tekniğe **memoization** (not alma) denir ve yukarıdan aşağıya (top-down) DP olarak da bilinir: özyinelemeli yapıyı aynen korursun, yalnızca fonksiyonun başına "bunu daha önce çözdüm mü?" kontrolünü, sonuna da "sonucu kaydet" adımını eklersin. Artık her `k` değeri için gövde en fazla bir kez çalışır; toplam süre O(n), ek bellek de memo tablosu ve çağrı yığını için O(n) olur.

Aşağıdaki izde `fib(5)` çağrısını satır satır izle. Çağrı yığınının önce `fib(1)`e kadar derinleştiğine, sonra geri dönerken `not_defteri` sözlüğünün dolduğuna ve `fib(3)` ile `fib(2)` ikinci kez istendiğinde fonksiyonun ilk `if` satırında hemen döndüğüne dikkat et.

:::trace{src="fib-memo.trace.json" title="Memoization ile Fibonacci|Fibonacci with memoization"}
Çağrı yığını panelinde aynı anda kaç `fib` çerçevesi açık olduğunu ve memo sözlüğünün hangi sırayla dolduğunu takip et.
:::

Python'da bu deseni elle yazmak zorunda değilsin: `functools.lru_cache` ya da `functools.cache` dekoratörü fonksiyonun argümanlarını anahtar olarak kullanıp sonuçları otomatik saklar. Kapsam ve dekoratörler dersinde gördüğümüz sarmalayıcı fonksiyon fikrinin pratikteki en yaygın kullanımlarından biri budur.

:::callout{tone="warning" title="Özyineleme derinliği sınırı"}
Memoization süreyi düzeltir ama çağrı yığını derinliği n kadar kalır. CPython'ın varsayılan özyineleme sınırı 1000 civarındadır; `fib(5000)` gibi bir çağrı `RecursionError` ile biter. Sınırı `sys.setrecursionlimit` ile yükseltmek mümkün olsa da gerçek çözüm aynı problemi döngüyle, yani tabulation ile yazmaktır.
:::

## Tabulation: tabloyu aşağıdan yukarıya doldurmak

DP'nin ikinci biçimi **tabulation**dır, yani aşağıdan yukarıya (bottom-up) yaklaşım. Burada özyineleme yoktur. Önce en küçük alt problemlerin cevaplarını bir tabloya yazarsın, sonra her hücreyi daha önce doldurulmuş hücrelerden hesaplayarak tabloyu sırayla doldurursun. Fibonacci için tablo `t[0] = 0`, `t[1] = 1` ile başlar ve `t[i] = t[i - 1] + t[i - 2]` kuralıyla ilerler. Her hücre yalnızca kendinden önceki iki hücreye baktığı için tüm tabloyu saklamana bile gerek yoktur; iki değişken yeter ve bellek O(1)'e düşer. Bu tür bellek iyileştirmeleri tabulation'ın en büyük avantajıdır.

İki yaklaşımı şöyle karşılaştırabiliriz. Memoization yazması daha kolaydır, çünkü problemin özyinelemeli tanımını neredeyse aynen kodlarsın; ayrıca yalnızca gerçekten ihtiyaç duyulan alt problemleri çözer. Tabulation ise yığın taşması riski taşımaz, fonksiyon çağrısı maliyeti olmadığı için genellikle daha hızlıdır ve bellek optimizasyonuna daha uygundur. Ama tabloyu hangi sırayla dolduracağını önceden düşünmeni gerektirir: bir hücreyi hesaplarken ihtiyaç duyduğun tüm hücreler zaten dolu olmalıdır.

## DP problemi nasıl kurulur? Dört adımlı reçete

DP'yi zor kılan şey teknik değil, problemi doğru biçimde ifade etmektir. Şu dört soru neredeyse her problemde yolu açar:

1. **Durum (state) nedir?** Bir alt problemi tek başına tanımlamak için hangi bilgilere ihtiyacın var? Fibonacci'de yalnızca `n`; sırt çantasında "ilk i eşya ve kalan kapasite c"; iki metni karşılaştırırken "birinci metnin ilk i harfi ve ikincinin ilk j harfi".
2. **Geçiş (recurrence) nedir?** Bir durumun cevabı daha küçük durumların cevaplarından nasıl hesaplanır? Genellikle "son adımda hangi seçimi yaptım?" sorusuyla bulunur: eşyayı aldım ya da almadım; harfler eşleşti ya da eşleşmedi.
3. **Temel durumlar nelerdir?** Hiç eşya yokken değer 0'dır; boş metinle ortak alt dizi uzunluğu 0'dır.
4. **Hesap sırası ve cevap nerede?** Tabloyu hangi yönde dolduracaksın ve nihai cevap hangi hücrede duruyor?

Durum sayısı ile her durumun geçiş maliyetinin çarpımı toplam karmaşıklığı verir. Bu yüzden durumu gereğinden fazla bilgiyle tanımlamak tabloyu gereksiz şişirir; eksik bilgiyle tanımlamak ise yanlış cevap üretir.

## 0/1 sırt çantası problemi

Bir yürüyüşe çıkıyorsun ve çantan en fazla 4 kg taşıyabiliyor. Elinde ağırlıkları 1, 3 ve 4 kg, değerleri 15, 20 ve 30 olan üç eşya var. Her eşyayı ya tamamen alırsın ya da hiç almazsın (adı buradan gelir: 0/1). Toplam değeri en yüksek yapacak seçim hangisidir?

Açgözlü bir yaklaşım en değerli eşyayı, yani 30 değerindeki 4 kg'lık eşyayı alır ve çanta dolar: toplam 30. Oysa 1 kg ve 3 kg'lık eşyaları birlikte almak 35 değer sağlar. Açgözlü seçim burada yanılır, çünkü bir seçimin sonraki seçenekleri nasıl kısıtladığını hesaba katmaz.

DP ile durum "kapasite c için şimdiye kadar incelenen eşyalarla ulaşılabilecek en yüksek değer" olur. Her yeni eşya için iki seçenek vardır: almazsan değer değişmez; alırsan değer, kalan kapasitenin (`c - ağırlık`) en iyi değeri artı eşyanın değeridir. İkisinden büyüğünü seçeriz. Tek boyutlu bir tablo kullanırken önemli bir ayrıntı vardır: kapasiteyi **büyükten küçüğe** gezmeliyiz. Küçükten büyüğe gezersek aynı tur içinde az önce güncellediğimiz hücreyi tekrar kullanır ve aynı eşyayı birden çok kez çantaya koymuş oluruz; bu da sınırsız sırt çantası adlı başka bir problemin çözümüdür.

:::trace{src="sirt-cantasi.trace.json" title="Tabulation ile 0/1 sırt çantası|0/1 knapsack with tabulation"}
Her eşyadan sonra yazdırılan tabloya bak: 3 kg'lık eşya eklendiğinde 4 kg hücresi 15'ten 35'e çıkıyor, 4 kg'lık eşya ise bu değeri geçemiyor.
:::

Bu çözümün süresi O(n · W)'dir; n eşya sayısı, W kapasitedir. Bu ifade polinom gibi görünse de W bir sayı olduğu için girdinin bit uzunluğuna göre üsteldir; sırt çantası problemi bu yüzden "sözde polinom" (pseudo-polynomial) olarak anılır. Kapasite milyonlar mertebesindeyse tablo da o kadar büyür ve farklı teknikler gerekir.

## En uzun ortak alt dizi (LCS)

İki metin arasındaki farkları bulan araçların temelinde **en uzun ortak alt dizi** (longest common subsequence, LCS) problemi yatar. Alt dizi, karakterlerin sırasını koruyarak ama araya boşluk bırakılabilerek seçilmesidir: "ABCBDAB" ile "BDCABA" için LCS uzunluğu 4'tür (ör. "BCBA"). Durum `(i, j)`: birinci metnin ilk i, ikinci metnin ilk j karakteri. Son karakterler eşitse cevap `lcs(i - 1, j - 1) + 1`; değilse karakterlerden birini atarak elde edilen iki seçeneğin büyüğü. Tablo (m + 1) × (n + 1) boyutundadır ve satır satır doldurulur; süre ve bellek O(m · n) olur. Yalnızca uzunluk isteniyorsa iki satır yeterlidir.

:::code{lang="python" title="LCS: tabulation ve lru_cache ile memoization"}
```python
from functools import lru_cache

def lcs_tablo(a: str, b: str) -> int:
    m, n = len(a), len(b)
    t = [[0] * (n + 1) for _ in range(m + 1)]   # t[i][j]: a[:i] ve b[:j] için LCS
    for i in range(1, m + 1):
        for j in range(1, n + 1):
            if a[i - 1] == b[j - 1]:
                t[i][j] = t[i - 1][j - 1] + 1
            else:
                t[i][j] = max(t[i - 1][j], t[i][j - 1])
    return t[m][n]

def lcs_memo(a: str, b: str) -> int:
    @lru_cache(maxsize=None)
    def coz(i: int, j: int) -> int:
        if i == 0 or j == 0:
            return 0
        if a[i - 1] == b[j - 1]:
            return coz(i - 1, j - 1) + 1
        return max(coz(i - 1, j), coz(i, j - 1))
    return coz(len(a), len(b))

print(lcs_tablo("ABCBDAB", "BDCABA"))  # 4
print(lcs_memo("ABCBDAB", "BDCABA"))   # 4
```
:::

Aynı kalıbın küçük bir çeşitlemesi, bir metni diğerine dönüştürmek için gereken en az ekleme, silme ve değiştirme sayısını veren **düzenleme mesafesi**dir (Levenshtein mesafesi). Yazım denetleyicileri "bunu mu demek istediniz?" önerisini, biyoinformatik araçları DNA dizilerini hizalamayı bu tablolarla yapar. Yapay zekâ alanında da benzer DP tabloları karşına çıkar: konuşma tanımada kullanılan bazı hizalama algoritmaları ve dil modellerinin çıktısını puanlayan bazı metrikler aynı satır satır doldurma mantığına dayanır.

:::realworld{company="Git"}
`git diff` ve klasik Unix `diff` aracı, iki dosya arasındaki farkı satırlar üzerinde bir ortak alt dizi problemi olarak çözer: ortak alt dizide kalan satırlar "değişmedi", dışında kalanlar "eklendi" ya da "silindi" olarak gösterilir. Git'in varsayılan algoritması Myers'ın fark algoritmasıdır; düz O(m · n) tablo yerine, farkın küçük olduğu yaygın durumda çok daha hızlı çalışan ve en kısa düzenleme betiğini bulan bir yaklaşımdır. `git diff --patience` ve `--histogram` seçenekleri aynı probleme farklı sezgisel yollarla yaklaşır. Kod incelemesinde her gün gördüğün yeşil ve kırmızı satırların arkasında, bu derste öğrendiğin tablo mantığının optimize edilmiş bir hâli çalışır.
:::

:::callout{tone="tip" title="Mülakat ipucu"}
DP sorusunda doğrudan tabloya atlama. Önce saf özyinelemeli çözümü sesli olarak kur ve durumu (`dp(i, c)` gibi) açıkça adlandır; ardından tekrar eden alt problemleri gösterip memoization ekle, karmaşıklığı "durum sayısı × geçiş maliyeti" ile hesapla. Zaman kalırsa tabulation'a ve bellek optimizasyonuna (iki satır, tek dizi) geç. "En az/en çok kaç yolla…", "en uzun/en kısa…", "mümkün mü?" kalıpları genellikle DP'ye işaret eder.
:::

:::callout{tone="info" title="DP her zaman gerekli değil"}
Alt problemler örtüşmüyorsa DP ek bellekten başka bir şey kazandırmaz; böl ve yönet yeterlidir. Açgözlü seçimin her zaman doğru olduğu kanıtlanabiliyorsa (ör. bozuk para sisteminin uygun olduğu durumlarda para üstü, aralık zamanlama) açgözlü çözüm hem daha basit hem daha hızlıdır. DP, açgözlünün yanıldığı ve alt problemlerin tekrar ettiği yerde parlar.
:::

## Modülün sonu: araç kutun

Bu dersle algoritmalar ve veri yapıları modülünü tamamladın. Big-O ile maliyeti ölçmeyi, dizilerden graflara kadar temel yapıları, sıralama ve ikili aramayı, son olarak da DP ile problemleri alt problemlere bölmeyi öğrendin. Yeni bir problemle karşılaştığında kendine şu soruları sor: Girdi ne kadar büyük ve hangi karmaşıklık kabul edilebilir? Veri sıralı mı ya da sıralanabilir mi? Hızlı arama için hash tablosu mu, sıra için heap mi gerekiyor? Problem bir graf olarak ifade edilebilir mi? Aynı alt problemler tekrar ediyor mu? Bu sorular, bir sonraki modülde büyük dil modelleriyle uygulama geliştirirken de işine yarayacak; token sayısını, önbelleklemeyi ve vektör aramasını değerlendirirken aynı maliyet düşüncesini kullanacaksın.

:::quiz{src="quiz.json"}
:::

:::next{lesson="m-01-tokens-context-window"}
Sırada: LLM uygulamaları modülü — metnin token'lara nasıl bölündüğü, bağlam penceresinin sınırları ve token maliyeti.
:::

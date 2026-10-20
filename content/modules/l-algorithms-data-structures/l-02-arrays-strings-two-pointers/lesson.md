---
id: l-02-arrays-strings-two-pointers
slug: arrays-strings-two-pointers
module: l-algorithms-data-structures
order: 2
title:
  tr: "Diziler, Stringler ve İki İşaretçi"
  en: "Arrays, Strings and Two Pointers"
summary:
  tr: "Bellekte ardışık dizi, dinamik diziler, kayan pencere ve iki işaretçi teknikleri; satır satır Python izleriyle."
  en: "Contiguous arrays in memory, dynamic arrays, sliding window and two-pointer techniques with line-by-line Python traces."
durationMinutes: 30
level: beginner
tags: [algoritmalar, dizi, string, iki-isaretci, kayan-pencere, python]
prerequisites: [l-01-big-o-complexity, k-05-koleksiyonlar-ve-kopyalama]
concepts: [contiguous-array, dynamic-array, amortized-append, string-immutability, sliding-window, two-pointers]
---

## Kavram: bellekte yan yana duran kutular

Dizi (array), bilgisayar biliminin en eski ve en temel veri yapısıdır. Fikri çok basittir: aynı boyuttaki elemanları
belleğe **yan yana**, boşluksuz yerleştirmek. Dizinin başladığı adresi (taban adres) ve her elemanın kaç bayt
kapladığını bilirsen, `i`. elemanın adresini tek bir çarpma ve toplamayla hesaplayabilirsin:
`adres(i) = taban + i × eleman_boyutu`. Bu hesap dizinin uzunluğundan bağımsızdır; bu yüzden **indeksle erişim
O(1)**'dir. İster üçüncü elemanı iste ister üç milyonuncuyu, işlemci aynı hızda oraya atlar.

Ardışık yerleşimin ikinci, daha az bilinen bir avantajı vardır: **önbellek dostu** olması. İşlemci bellekten tek bir
bayt değil, genellikle 64 baytlık bir blok (cache line) okur. Dizinin bir elemanına eriştiğinde komşuları da önbelleğe
gelir; ardından sıradaki elemana eriştiğinde veri zaten oradadır. Bu yüzden bir diziyi baştan sona taramak, aynı
sayıda elemanı bellekte dağınık duran bir bağlı listede gezmekten pratikte çok daha hızlıdır, Big-O'ları ikisi için
de O(n) olsa bile.

Ardışıklığın bedeli ise ortadaki değişikliklerde ödenir. Dizinin başına ya da ortasına eleman eklemek için arkadaki
tüm elemanları bir hücre kaydırman gerekir: O(n). Ortadan eleman silmek de aynı şekilde boşluğu kapatmak için kaydırma
gerektirir. Sondan ekleme ve silme ise kaydırma gerektirmez; bu yüzden diziler en çok "sona ekle, indeksle oku"
kullanımında parlar.

:::diagram{src="diagram.svg" alt="Bellekte ardışık dizi adresleri, üç elemanlık kayan pencere ve sıralı dizide iki işaretçi|Contiguous array addresses in memory, a three-element sliding window and two pointers on a sorted array"}
Üstte adres hesabı, ortada pencerenin bir adım kayması, altta içeri doğru ilerleyen iki işaretçi.
:::

## Dinamik diziler: Python listesi nasıl büyür?

Klasik dizinin boyutu oluşturulduğu anda sabitlenir. Ama Python'da `liste.append(x)` yazdığında listenin dolduğunu hiç
düşünmezsin. Bunun nedeni Python listesinin bir **dinamik dizi** olmasıdır: arka planda, ihtiyaçtan biraz daha büyük
bir bellek bloğu ayırır ve elemanları (daha doğrusu nesnelere işaret eden referansları) orada tutar.

Ayrılan alan dolduğunda liste daha büyük yeni bir blok ayırır, eski elemanları oraya kopyalar ve eski bloğu bırakır.
Bu kopyalama O(n)'dir. Peki `append` nasıl hızlı kalıyor? Sırrı kapasitenin **sabit bir oranla** büyütülmesindedir.
CPython yeni kapasiteyi mevcut boyutun yaklaşık %12,5 fazlası olarak seçer; ders kitaplarındaki klasik örnekte ise
kapasite her seferinde ikiye katlanır. İkiye katlama örneğinde 1, 2, 4, 8, 16... boyutlarında kopyalama olur;
n elemana kadar toplam kopya sayısı 1 + 2 + 4 + ... + n ≈ 2n'dir. Bu maliyet n ekleme işlemine yayıldığında ekleme
başına sabit bir değer çıkar: **amortize O(1)**.

Bu davranışın pratik sonuçları şöyle özetlenebilir:

- `append` ve `pop()` (sondan) amortize O(1)'dir; rahatça kullan.
- `insert(0, x)` ve `pop(0)` O(n)'dir, çünkü tüm elemanlar kayar. Baştan sık ekleme/çıkarma gerekiyorsa
  `collections.deque` kullan; yığın ve kuyruk dersinde göreceğiz.
- `x in liste`, `liste.index(x)` ve `liste.remove(x)` doğrusal aramadır: O(n).
- Dilimleme (`liste[a:b]`) yeni bir liste oluşturur; dilimin uzunluğu kadar zaman ve bellek harcar.

## Stringler: değiştirilemeyen diziler

Python'da bir string, karakterlerden oluşan bir dizi gibi düşünülebilir: indeksle erişim O(1)'dir, uzunluk O(1)'de
bilinir, dilimleme mümkündür. Önemli fark, stringlerin **değiştirilemez** (immutable) olmasıdır. `s[0] = "x"` yazamazsın;
`s = s + "x"` yazdığında mevcut string değişmez, birleştirilmiş içerikle **yeni** bir string oluşturulur.

Bu durum döngü içinde string biriktirirken gizli bir O(n²) tuzağı yaratır. Her `+=` işlemi o ana kadarki tüm metni
yeniden kopyalayabilir; n parça eklemek toplamda 1 + 2 + ... + n ≈ n²/2 karakter kopyalamak demektir. Doğru yol,
parçaları bir listede toplayıp sonda tek seferde `"".join(parcalar)` çağırmaktır: her karakter yalnızca bir kez
kopyalanır ve iş O(n) olur. Benzer şekilde, bir stringi karakter karakter değiştirmen gerekiyorsa önce `list(s)` ile
listeye çevir, değişiklikleri yap, sonra `"".join` ile geri birleştir.

Değiştirilemezliğin iyi tarafları da vardır. Bir string başka bir yerde değiştirilemeyeceği için güvenle paylaşılabilir,
hash değeri bir kez hesaplanıp saklanabilir ve sözlük anahtarı olarak kullanılabilir. Ayrıca Türkçe metinlerle
çalışırken şunu unutma: Python 3'te `len("ğüşiöç")` bayt sayısını değil karakter (kod noktası) sayısını, yani 6'yı
verir. UTF-8 ile kodlandığında aynı metin 12 bayt tutar; dosyaya yazarken ya da ağdan gönderirken boyut hesabını
bayt cinsinden yapmak gerekir.

## Kayan pencere: iç içe döngüyü tek geçişe indirmek

Dizi ve string problemlerinin büyük bir kısmı "ardışık bir bölüm" ile ilgilidir: toplamı en büyük olan k elemanlık
alt dizi, tekrar eden karakter içermeyen en uzun alt string, belirli bir toplamı aşmayan en uzun aralık... Kaba kuvvet
çözümü her başlangıç noktası için bölümü yeniden hesaplar ve kolayca O(n·k) ya da O(n²) olur.

**Kayan pencere** (sliding window) tekniği şu gözleme dayanır: bir pencereyi bir adım sağa kaydırdığında içeriğin
neredeyse tamamı aynı kalır. Yalnızca soldan bir eleman düşer ve sağdan bir eleman katılır. Toplamı sıfırdan hesaplamak
yerine bu iki değişikliği uygularsan her kaydırma O(1) olur ve tüm dizi O(n)'de taranır.

:::trace{src="kayan-pencere.trace.json" title="Sabit boyutlu kayan pencere|Fixed-size sliding window"}
`toplam` değişkeninin her turda nasıl güncellendiğini izle: yeniden toplama yok, yalnızca bir ekleme ve bir çıkarma var.
:::

Pencerenin boyutu her zaman sabit olmak zorunda değildir. **Değişken boyutlu pencerede** iki indeks tutarsın: `sol`
ve `sag`. `sag` her turda bir ilerleyerek pencereyi büyütür; pencere bir kuralı bozduğunda (örneğin aynı karakter iki
kez göründüğünde ya da toplam sınırı aştığında) `sol` ilerleyerek pencereyi kural yeniden sağlanana kadar küçültür.
İki indeks de yalnızca ileri gittiği ve her biri en fazla n adım attığı için toplam iş yine O(n)'dir. Bu "her işaretçi
en fazla n kez hareket eder" argümanı, iç içe görünen ama aslında doğrusal olan döngülerin karmaşıklığını kanıtlamanın
standart yoludur.

## İki işaretçi: iki uçtan içeri

**İki işaretçi** (two pointers) tekniğinin en bilinen biçiminde işaretçilerden biri dizinin başından, diğeri sonundan
başlar ve içeri doğru ilerler. Bu teknik özellikle **sıralı** dizilerde güçlüdür, çünkü sıralılık her karşılaştırmada
bir adayı kesin olarak elemeye izin verir.

Klasik örnek: sıralı bir dizide toplamı hedefe eşit olan iki eleman bulmak. Kaba kuvvet tüm çiftleri dener: O(n²).
İki işaretçiyle şöyle düşünürsün: en küçük ve en büyük elemanın toplamı hedeften küçükse, en küçük eleman hiçbir
elemanla hedefe ulaşamaz (en büyük eşi bile yetmedi), o hâlde onu eleyip sol işaretçiyi ilerletirsin. Toplam büyükse
aynı mantıkla en büyük elemanı eler, sağ işaretçiyi geri çekersin. Her adımda bir eleman elendiği için en fazla n adımda
cevaba ulaşırsın.

:::trace{src="iki-isaretci.trace.json" title="Sıralı dizide iki toplam|Two-sum on a sorted array"}
`sol` ve `sag` değerlerini ve her turdaki `toplam`ı izle. Hangi koşulda hangi işaretçinin hareket ettiğine dikkat et.
:::

Aynı desen pek çok probleme uyarlanır: bir stringin palindrom olup olmadığını iki uçtan karşılaştırarak kontrol etmek,
bir diziyi yerinde ters çevirmek, sıralı iki diziyi birleştirmek (bu sefer iki işaretçi iki farklı dizide durur) ya da
"en çok su tutan kap" gibi problemlerde alanı maksimize etmek. Bir başka çeşidi de **hızlı-yavaş işaretçi**dir: biri
her adımda bir, diğeri iki ilerler. Sıralı bir diziden tekrarları yerinde silmek ya da bağlı listede döngü tespit etmek
bu yöntemle yapılır.

:::code{lang="python" title="Değişken pencere ve iki işaretçi örnekleri"}
```python
def tekrarsiz_en_uzun(s: str) -> int:
    """Tekrar eden karakter içermeyen en uzun alt stringin uzunluğu. O(n) zaman."""
    son_gorulme = {}          # karakter → en son görüldüğü indeks
    sol = 0
    en_iyi = 0
    for sag, ch in enumerate(s):
        if ch in son_gorulme and son_gorulme[ch] >= sol:
            sol = son_gorulme[ch] + 1     # pencereyi tekrarın hemen sağına daralt
        son_gorulme[ch] = sag
        en_iyi = max(en_iyi, sag - sol + 1)
    return en_iyi


def palindrom_mu(s: str) -> bool:
    """Harf ve rakam dışını yok sayarak iki uçtan karşılaştırır. O(n) zaman, O(1) ek bellek."""
    sol, sag = 0, len(s) - 1
    while sol < sag:
        if not s[sol].isalnum():
            sol += 1
        elif not s[sag].isalnum():
            sag -= 1
        elif s[sol].lower() != s[sag].lower():
            return False
        else:
            sol, sag = sol + 1, sag - 1
    return True


print(tekrarsiz_en_uzun("abcabcbb"))      # 3 ("abc")
print(palindrom_mu("Ey Edip, Adana'da pide ye"))  # True
```
:::

## Ne zaman hangi teknik?

Bir dizi veya string problemiyle karşılaştığında kendine şu soruları sor:

- **Soru ardışık bir bölüm hakkında mı?** ("alt dizi", "alt string", "ardışık k eleman") Kayan pencere büyük olasılıkla
  işe yarar. Pencere boyutu sabitse tek indeks yeter; bir koşula göre büyüyüp küçülüyorsa iki indeks kullan.
- **Dizi sıralı mı ya da sıralanabilir mi?** Çift veya üçlü arama, yakın toplam bulma gibi sorularda iki uçtan
  içeri iki işaretçi düşün. Sıralama O(n log n) maliyet ekler ama genellikle O(n²)'den iyidir.
- **Yerinde değişiklik mi isteniyor?** Okuma ve yazma için iki ayrı işaretçi (biri tüm diziyi tarar, diğeri bir
  sonraki yazılacak yeri gösterir) ek bellek kullanmadan çözüm sağlar.
- **Herhangi bir eleman "daha önce görüldü mü?"** sorusu varsa bir sonraki dersin konusu olan hash tabloları (sözlük
  ve küme) devreye girer; yukarıdaki `tekrarsiz_en_uzun` fonksiyonu da iki tekniği birleştiriyor.

Bu sorular, problemi okuduktan sonraki ilk birkaç dakikada doğru yönü bulmana yardımcı olur. Unutma: tüm bu
tekniklerin ortak amacı, aynı veriyi tekrar tekrar okumaktan kaçınmak ve her elemana sabit sayıda kez dokunmaktır.

:::realworld{company="Netflix"}
Netflix gibi büyük yayın platformları izleme süresi, hata oranı ve başlatma gecikmesi gibi metrikleri sürekli bir
olay akışı olarak işler. "Son 5 dakikadaki ortalama hata oranı" gibi bir değer, her yeni olayda tüm geçmişi yeniden
toplamak yerine bir **kayan pencere** ile hesaplanır: pencereye giren olay toplama eklenir, pencereden çıkan olay
toplamdan düşülür. Apache Flink ve Kafka Streams gibi akış işleme çerçevelerindeki "sliding/tumbling window"
kavramları tam olarak bu fikrin dağıtık sistemlere taşınmış hâlidir. Aynı mantık API hız sınırlayıcılarında da
kullanılır: son bir dakikadaki istek sayısı kayan pencereyle tutulur.
:::

:::callout{tone="warning" title="Döngüde string biriktirme"}
`sonuc += parca` her seferinde yeni bir string oluşturabilir ve büyük metinlerde O(n²) davranışa yol açar. CPython bazı
durumlarda bunu yerinde optimize etse de buna güvenme; parçaları listede topla ve sonda `"".join(parcalar)` kullan.
:::

:::callout{tone="tip" title="Mülakat ipucu"}
Bir dizi probleminde ilk aklına gelen iç içe döngü çözümünü söyle ve karmaşıklığını belirt, sonra "Dizi sıralı olduğu
için iki işaretçiyle tek geçişte çözebilirim" ya da "Ardışık bir bölüm sorulduğu için kayan pencere kullanacağım" diye
optimizasyonu gerekçelendir. Değişken pencerede "her işaretçi en fazla n adım atar, toplam O(n)" argümanını açıkça
söylemek, mülakatçının en çok duymak istediği cümledir.
:::

:::quiz{src="quiz.json"}
:::

:::next{lesson="l-03-hash-tables"}
Sırada: "bu elemanı daha önce gördüm mü?" sorusunu ortalama O(1)'de cevaplayan hash tabloları; hash fonksiyonu,
çakışmalar ve yük faktörü.
:::

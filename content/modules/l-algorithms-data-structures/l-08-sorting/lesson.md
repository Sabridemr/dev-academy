---
id: l-08-sorting
slug: sorting
module: l-algorithms-data-structures
order: 8
title:
  tr: "Sıralama Algoritmaları"
  en: "Sorting Algorithms"
summary:
  tr: "Bubble, insertion, selection, merge ve quick sort; kararlılık, yerinde sıralama ve karşılaştırma; görsel sıralayıcı."
  en: "Bubble, insertion, selection, merge and quick sort; stability, in-place sorting and comparison; visual sorter."
durationMinutes: 35
level: intermediate
tags: [algoritmalar, siralama, merge-sort, quick-sort, timsort]
prerequisites: [l-07-graphs-bfs-dfs, k-08-ozyineleme]
concepts: [bubble-sort, insertion-sort, selection-sort, merge-sort, quick-sort, sort-stability, in-place-sort, comparison-lower-bound]
---

## Kavram: neden hâlâ sıralama öğreniyoruz?

Python'da bir listeyi sıralamak için `sorted(liste)` yazmak yeter; kendi sıralama fonksiyonunuzu üretimde neredeyse hiç yazmayacaksınız. O hâlde neden bu kadar çok sıralama algoritması öğreniyoruz? Üç iyi sebep var. Birincisi, sıralama algoritmaları algoritma tasarımının ana fikirlerini en sade hâlleriyle gösterir: kaba kuvvet, artımlı inşa, **böl ve yönet**, rastgeleleştirme ve alt sınır kanıtları. İkincisi, sıralanmış veri pek çok problemi kolaylaştırır: ikili arama, tekrarları bulma, iki listeyi birleştirme, aralıkları birleştirme ve medyan bulma gibi. Üçüncüsü, hangi yerleşik sıralamanın ne zaman pahalı olduğunu, ne zaman kararlı davrandığını ve ne zaman bellek harcadığını bilmek, gerçek sistemlerde doğru karar vermenizi sağlar.

Bir sıralama algoritmasını değerlendirirken zaman karmaşıklığının yanında iki özelliğe daha bakarız:

- **Kararlılık** (stability): Eşit anahtara sahip elemanlar, girişteki göreli sıralarını çıkışta da koruyor mu? Örneğin öğrencileri önce isme, sonra sınıfa göre sıralarsanız, kararlı bir sıralama aynı sınıftaki öğrencilerin isim sırasını bozmaz. Çok anahtarlı sıralamanın kolay yolu budur.
- **Yerinde olma** (in-place): Algoritma, girişin dışında yalnızca sabit ya da çok küçük (ör. O(log n)) ek bellek mi kullanıyor, yoksa girdi büyüklüğünde ikinci bir dizi mi istiyor? Bellek kısıtlı ortamlarda bu fark belirleyicidir.

:::diagram{src="diagram.svg" alt="Merge sort'un 8 elemanlı diziyi bölüp birleştirme ağacı ve quick sort'un pivot etrafında bölümleme adımı|Merge sort's split-and-merge tree for an 8-element array and quick sort's partition step around a pivot"}
Solda merge sort: dizi tek elemanlı parçalara bölünür, sonra sıralı biçimde birleştirilir. Sağda quick sort: pivotun solunda küçükler, sağında büyükler toplanır.
:::

## Basit O(n²) sıralamalar

**Bubble sort**, komşu iki elemanı karşılaştırır ve yanlış sıradaysa yer değiştirir. Her tam geçişte en büyük eleman, su yüzüne çıkan bir kabarcık gibi dizinin sonuna ulaşır. Bir geçişte hiç yer değiştirme olmazsa dizi sıralıdır ve erken durulabilir; bu sayede zaten sıralı bir dizide O(n) sürer. Ortalama ve en kötü durumda ise O(n²) karşılaştırma ve takas yapar. Kararlıdır ve yerindedir, ama pratikte nadiren tercih edilir; daha çok öğretim amaçlıdır.

**Selection sort**, sıralanmamış bölgedeki en küçük elemanı bulur ve bölgenin başına koyar. Girdinin durumu ne olursa olsun her zaman yaklaşık n²/2 karşılaştırma yapar; en iyi durumu yoktur. İlginç özelliği, en fazla n−1 takas yapmasıdır. Yazma işleminin çok pahalı olduğu (ör. eski flaş bellekler) nadir durumlarda bu işe yarayabilir. Uzak elemanları takas ettiği için standart hâliyle **kararsızdır**.

**Insertion sort**, iskambil kâğıtlarını elde dizme yöntemidir. Solda her zaman sıralı bir bölge tutulur; sıradaki eleman alınır, kendisinden büyük olan elemanlar birer sağa kaydırılır ve açılan boşluğa yerleştirilir. En kötü durumu O(n²)'dir, ama **neredeyse sıralı** girdide her eleman yalnızca birkaç adım kayar ve süre O(n)'e yaklaşır. Kararlıdır, yerindedir ve sabit çarpanı çok küçüktür. Bu yüzden küçük diziler (birkaç düzine eleman) için hızlı algoritmaların bile içinde kullanılır.

:::trace{src="insertion-sort.trace.json" title="Insertion sort satır satır|Insertion sort line by line"}
`dizi` listesinin heap'te tek bir nesne olarak kaldığına ve yalnızca elemanlarının değiştiğine dikkat edin. `j` geriye doğru ilerlerken büyük elemanlar sağa kayıyor.
:::

## Merge sort: böl, sırala, birleştir

**Merge sort**, böl ve yönet yaklaşımının klasik örneğidir. Diziyi iki yarıya böler, her yarıyı özyinelemeli olarak sıralar, sonra sıralı iki yarıyı tek bir sıralı diziye **birleştirir**. Birleştirme adımı iki işaretçiyle yapılır: her iki listenin başındaki elemanlardan küçük olanı sonuca alınır ve o listenin işaretçisi ilerletilir. Eşitlikte sol listeden almak algoritmayı kararlı yapar.

Özyineleme ağacının derinliği log₂ n'dir, çünkü her seviyede dizi ikiye bölünür. Her seviyede toplam n eleman birleştirilir. Sonuç, girdi ne olursa olsun **O(n log n)** zamandır; en iyi, ortalama ve en kötü durum aynıdır. Bu öngörülebilirlik merge sort'un en büyük artısıdır. Bedeli ise birleştirme için O(n) ek bellektir. Merge sort ayrıca bağlı listeler için idealdir (rastgele erişim gerektirmez) ve belleğe sığmayan büyük dosyaları parçalar hâlinde sıralayıp birleştiren **harici sıralamanın** (external sort) temelidir.

Böl ve birleştir aşamalarını sekiz elemanlı bir dizide adım adım izleyelim.

:::animation{scene="merge-sort-agaci.scene.json"}
Aşağı inerken yalnızca bölünür; sıralama işinin tamamı yukarı çıkarken, birleştirmede yapılır.
:::

:::code{lang="python" title="Merge sort ve quick sort"}
```python
def merge_sort(a):
    if len(a) <= 1:
        return a
    orta = len(a) // 2
    sol, sag = merge_sort(a[:orta]), merge_sort(a[orta:])
    sonuc, i, j = [], 0, 0
    while i < len(sol) and j < len(sag):
        if sol[i] <= sag[j]:          # '<=' eşitlikte soldan alır: kararlı
            sonuc.append(sol[i]); i += 1
        else:
            sonuc.append(sag[j]); j += 1
    return sonuc + sol[i:] + sag[j:]


def quick_sort(a, lo=0, hi=None):
    """Lomuto bölümlemesiyle yerinde quick sort."""
    if hi is None:
        hi = len(a) - 1
    if lo >= hi:
        return a
    pivot, k = a[hi], lo
    for i in range(lo, hi):
        if a[i] < pivot:
            a[i], a[k] = a[k], a[i]
            k += 1
    a[k], a[hi] = a[hi], a[k]          # pivot son yerine oturdu
    quick_sort(a, lo, k - 1)
    quick_sort(a, k + 1, hi)
    return a
```
:::

## Quick sort: pivot etrafında bölümlemek

**Quick sort** da böl ve yönet kullanır ama işi ters sırada yapar: önce bölümler, sonra özyineler, birleştirme adımına hiç ihtiyaç duymaz. Bir **pivot** seçilir; pivottan küçük elemanlar sola, büyükler sağa toplanır. Bu bölümlemeden sonra pivot, sıralı dizide olması gereken yere kesin olarak oturmuştur. Ardından sol ve sağ parçalar ayrı ayrı sıralanır.

Pivot her seferinde diziyi kabaca ikiye bölerse derinlik log n olur ve toplam iş **O(n log n)**'dir. Ama pivot sürekli en küçük ya da en büyük eleman olursa (örneğin zaten sıralı bir dizide hep son elemanı seçerseniz) parçalardan biri boş kalır, derinlik n'e çıkar ve süre **O(n²)**'ye düşer. Bunu önlemek için pivot rastgele seçilir ya da ilk, orta ve son elemanın medyanı alınır. Böylece kötü durum pratikte neredeyse imkânsız hâle gelir.

Quick sort yerinde çalışır (yalnızca özyineleme yığını için ortalama O(log n) ek bellek), önbellek dostudur çünkü bitişik bellek üzerinde ilerler ve sabit çarpanı küçüktür. Bu yüzden pek çok dilin ilkel tipleri sıralayan kütüphane fonksiyonu quick sort'un bir türevine dayanır. Standart hâliyle **kararsızdır**.

:::interactive{type="sorting-visualizer" algorithm="quick" size=24 speed=2}
Quick sort'u 24 elemanlı bir dizide "Oynat" ya da "Adım" ile izleyin: her bölümleme turunda pivotun kesin yerine oturduğunu ve dizinin giderek daha küçük parçalara ayrıldığını gözlemleyin. Ardından algoritmayı insertion, merge ve bubble sort ile değiştirip karşılaştırma, takas ve yazma sayaçlarını; tablodaki "Kararlı mı?" ve "Yerinde mi?" satırlarını karşılaştırın. "Karıştır" yeni bir dizi üretir.
:::

## Karşılaştırma tablosu

| Algoritma | En iyi | Ortalama | En kötü | Ek bellek | Kararlı mı? |
|---|---|---|---|---|---|
| Bubble sort | O(n) | O(n²) | O(n²) | O(1) | Evet |
| Selection sort | O(n²) | O(n²) | O(n²) | O(1) | Hayır |
| Insertion sort | O(n) | O(n²) | O(n²) | O(1) | Evet |
| Merge sort | O(n log n) | O(n log n) | O(n log n) | O(n) | Evet |
| Quick sort | O(n log n) | O(n log n) | O(n²) | O(log n) | Hayır |
| Heap sort | O(n log n) | O(n log n) | O(n log n) | O(1) | Hayır |

Heap sort'u bir önceki derslerde gördüğümüz ikili heap ile kurabilirsiniz: diziyi yerinde bir max-heap'e çevirip kökü tekrar tekrar sona taşırsınız. En kötü durumda bile O(n log n) ve O(1) ek bellek garanti eder, ama bellek erişimi dağınık olduğu için pratikte quick sort'tan yavaştır.

## O(n log n) neden bir duvar?

Yalnızca iki elemanı **karşılaştırarak** karar veren her sıralama algoritması, en kötü durumda en az yaklaşık n log n karşılaştırma yapmak zorundadır. Sezgisi şöyledir: n elemanın n! farklı dizilişi vardır ve algoritmanın bunların hepsini birbirinden ayırt etmesi gerekir. Her karşılaştırma yalnızca "evet ya da hayır" cevabı verir, yani olasılıkları en fazla ikiye böler. n! olasılığı teke indirmek için log₂(n!) kadar karşılaştırma gerekir ve bu değer yaklaşık n log n'dir. Merge sort ve heap sort bu sınıra ulaştığı için **asimptotik olarak en iyidir**.

Bu duvarı aşmanın tek yolu karşılaştırma yapmamaktır. Anahtarlar küçük bir aralıktaki tam sayılarsa **counting sort**, her değerin kaç kez geçtiğini sayarak O(n + k) sürede sıralar. **Radix sort** ise sayıları basamak basamak, her basamakta kararlı bir counting sort ile sıralar. Bunlar genel amaçlı değildir, ama posta kodu, yaş ya da sabit uzunluklu kimlik gibi verilerde çok hızlıdır.

## Gerçek hayatta kütüphane sıralamaları

Modern kütüphaneler tek bir algoritma kullanmaz; birkaçını **melez** biçimde birleştirir. Python'un `list.sort()` ve `sorted()` fonksiyonları kararlı, melez bir algoritma kullanır: veride zaten sıralı olan parçaları (run) bulur, kısa parçaları insertion sort ile uzatır, sonra merge sort mantığıyla birleştirir. Gerçek dünyadaki veri genellikle kısmen sıralı olduğu için bu yaklaşım çoğu durumda teorik n log n'den çok daha hızlı biter. Python'da `key=` parametresiyle sıralama ölçütü verilir ve kararlılık sayesinde çok aşamalı sıralama güvenle yapılabilir: önce ikincil, sonra birincil anahtara göre sıralamak yeterlidir.

## Sıralamayı bir araç olarak kullanmak

Sıralama çoğu zaman problemin kendisi değil, çözümün ilk adımıdır. Çakışan toplantı aralıklarını birleştirmek istediğinizi düşünün: aralıkları başlangıç saatine göre sıraladığınız an, yalnızca ardışık aralıkları karşılaştırmak yeterli olur ve tek bir geçişte sonuca ulaşırsınız. Bir listede tekrar eden elemanları bulmak için sıraladıktan sonra yan yana duran eşit elemanlara bakmak yeter. İki kelimenin anagram olup olmadığını anlamak için harflerini sıralayıp karşılaştırabilirsiniz. "Toplamı hedefe eşit olan iki sayı" sorusu, sıralı bir dizide iki işaretçi tekniğiyle doğrusal sürede çözülür. Bu kalıpların ortak noktası, O(n log n) maliyeti bir kez ödeyip ardından problemi basit bir O(n) taramasına indirgemektir. Toplam maliyet O(n log n) olur ve bu, iç içe döngülerle yazılmış O(n²) bir çözümden büyük girdilerde kat kat hızlıdır.

Bir başka pratik konu, ne zaman tamamen sıralamaya gerek olmadığıdır. Yalnızca en büyük k elemanı istiyorsanız tüm diziyi sıralamak yerine k boyutlu bir heap tutmak O(n log k) sürer. Yalnızca medyanı istiyorsanız quick sort'un bölümleme fikrini tek tarafa uygulayan **quickselect** ortalama O(n) sürede çalışır.

:::realworld{company="Python Software Foundation"}
Python'un yerleşik sıralaması **Timsort**, 2002'de Tim Peters tarafından CPython için geliştirildi. Merge sort ile insertion sort'u birleştirir, verideki doğal sıralı parçalardan yararlanır ve kararlıdır. Başarısı nedeniyle Java da nesne dizilerini sıralarken (`Arrays.sort(Object[])` ve `Collections.sort`) Timsort'a geçti; Android platformu ve V8 JavaScript motorunun `Array.prototype.sort` uygulaması da aynı fikri kullanır. Java, ilkel tipler (`int[]` gibi) için ise kararlılık gerekmediğinden çift pivotlu bir quick sort türevi kullanır.
:::

:::callout{tone="warning" title="Quick sort'un kötü günü"}
Pivotu her zaman ilk ya da son eleman seçen bir quick sort, zaten sıralı ya da ters sıralı girdide O(n²)'ye düşer ve Python'da özyineleme sınırına takılabilir. Kullanıcı girdisini sıralayan bir serviste bu, kasıtlı olarak hazırlanmış bir girdiyle sunucuyu yavaşlatma saldırısına bile dönüşebilir. Rastgele pivot ya da üçün medyanı kullanın.
:::

:::callout{tone="tip" title="Mülakat ipucu"}
- "Hangi sıralamayı kullanırsın?" sorusunda tek kelimelik cevap vermeyin; veri boyutunu, kararlılık ihtiyacını, bellek kısıtını ve verinin kısmen sıralı olup olmadığını sorun.
- Merge sort'un birleştirme adımını ve quick sort'un bölümleme adımını ezbere değil, iki işaretçi mantığıyla açıklayabilin; ikisi de pek çok sorunun yapı taşıdır.
- Çoğu problemde önce `sorted()` ile O(n log n) sıralayıp sonra tek geçişte çözmek, daha karmaşık bir O(n) fikrinden daha hızlı doğru sonuç verir.
:::

:::exercise{src="merge-sort.exercise.json"}
:::

:::quiz{src="quiz.json"}
:::

:::next{lesson="l-09-binary-search"}
Sırada: sıralı verinin en büyük ödülü olan ikili arama; O(log n) arama, alt ve üst sınır ve cevap üzerinde ikili arama.
:::

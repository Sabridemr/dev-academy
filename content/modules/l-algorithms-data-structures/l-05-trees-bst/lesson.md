---
id: l-05-trees-bst
slug: trees-bst
module: l-algorithms-data-structures
order: 5
title:
  tr: "Ağaçlar ve İkili Arama Ağacı"
  en: "Trees and Binary Search Trees"
summary:
  tr: "Ağaç terminolojisi, dolaşma sıraları, BST ekleme/arama/silme ve dengeli ağaçlara giriş."
  en: "Tree terminology, traversal orders, BST insert/search/delete and an introduction to balanced trees."
durationMinutes: 30
level: intermediate
tags: [algoritmalar, veri-yapilari, agac, bst, ozyineleme]
prerequisites: [l-04-stacks-queues, k-08-ozyineleme]
concepts: [tree-terminology, tree-traversal, inorder-traversal, bst-search, bst-insert, bst-delete, tree-height, balanced-tree]
---

## Kavram: neden ağaç?

Şimdiye kadar gördüğümüz diziler, yığınlar ve kuyruklar **doğrusal** yapılardı: her elemanın en fazla bir öncülü ve bir ardılı vardı. Gerçek dünyadaki verilerin önemli bir kısmı ise doğrusal değil, **hiyerarşiktir**. Bilgisayarındaki klasörler iç içe geçer, bir şirketin organizasyon şeması genel müdürden başlayıp dallanır, bir HTML sayfası `<html>` etiketinin altında iç içe etiketlerden oluşur, bir programlama dilinin derleyicisi kaynak kodu bir sözdizimi ağacına çevirir. Bu yapıların hepsinin ortak noktası, tek bir başlangıç noktasından aşağıya doğru dallanan ve hiçbir yerde döngü oluşturmayan bağlantılardır. Bu yapıya **ağaç** (tree) denir.

Ağaç, aynı zamanda arama problemine çok güçlü bir cevap verir. Sıralı bir dizide ikili arama ile O(log n) sürede eleman bulabiliriz, ama araya eleman eklemek dizinin yarısını kaydırmayı gerektirir ve O(n) sürer. Bağlı listede ekleme ucuzdur ama arama O(n) sürer. **İkili arama ağacı** (Binary Search Tree, BST) bu iki dünyanın arasında durur: düzgün şekilli bir BST'de hem arama hem ekleme hem de silme O(log n) sürede yapılabilir. Bu dersin büyük kısmı bu yapıyı ve onun neden bazen bozulduğunu anlamaya ayrılmış durumda.

## Terminoloji: kök, yaprak, derinlik

Bir ağacı konuşabilmek için ortak bir sözlüğe ihtiyacımız var. Aşağıdaki terimler mülakatlarda ve dokümantasyonlarda sürekli karşına çıkacak:

- **Düğüm (node):** Ağacın her bir elemanı. Bir değer ve çocuklarına giden bağlantılar taşır.
- **Kök (root):** Ebeveyni olmayan tek düğüm; ağacın başlangıç noktası.
- **Ebeveyn ve çocuk (parent/child):** Bir düğümden aşağıya doğru doğrudan bağlı düğümler onun çocuklarıdır.
- **Yaprak (leaf):** Hiç çocuğu olmayan düğüm.
- **Kenar (edge):** İki düğüm arasındaki bağlantı. n düğümlü bir ağaçta her zaman tam olarak n − 1 kenar bulunur, çünkü kök dışındaki her düğüm ebeveynine tek bir kenarla bağlıdır.
- **Derinlik (depth):** Bir düğümün köke olan uzaklığı, yani aradaki kenar sayısı. Kökün derinliği 0'dır.
- **Yükseklik (height):** Ağacın en derin yaprağının derinliği. Algoritmaların maliyeti genellikle doğrudan bu sayıya bağlıdır.
- **Alt ağaç (subtree):** Bir düğüm ve onun tüm torunlarından oluşan parça. Her alt ağacın kendisi de bir ağaçtır; ağaç algoritmalarının neredeyse hepsinin özyinelemeli yazılmasının sebebi budur.

**İkili ağaç** (binary tree), her düğümün en fazla iki çocuğu olduğu, bu çocukların da *sol* ve *sağ* diye ayrıldığı ağaçtır. Tam (complete) ikili ağaçta son seviye dışındaki tüm seviyeler doludur ve son seviye soldan doldurulur; bir sonraki derste göreceğimiz heap tam olarak bu şekli kullanır. h yüksekliğindeki bir ikili ağaç en fazla 2^(h+1) − 1 düğüm taşıyabilir. Tersinden bakarsak, n düğümü taşıyabilmek için yükseklik en az log₂ n civarında olmalıdır. Bu küçük hesap, dengeli ağaçların neden O(log n) performans verdiğinin özüdür.

## İkili arama ağacının kuralı

BST, ikili ağaca tek bir kural ekler: **her düğüm için sol alt ağaçtaki tüm değerler düğümden küçük, sağ alt ağaçtaki tüm değerler düğümden büyüktür.** Dikkat et, kural yalnızca doğrudan çocuklar için değil, alt ağacın tamamı için geçerlidir. Kökün sağ alt ağacının derinlerinde kökten küçük bir değer saklanıyorsa, o ağaç BST değildir; doğrulama yaparken sık yapılan hata, yalnızca ebeveyn-çocuk çiftlerini kontrol etmektir. Doğru yöntem, her düğüme inerken izin verilen bir alt ve üst sınır taşımaktır.

:::diagram{src="diagram.svg" alt="Kökü 8 olan dokuz düğümlü bir ikili arama ağacı; 7 değerinin aranma yolu vurgulanmış ve altında inorder sırası yazılı|A nine-node binary search tree rooted at 8; the search path for value 7 is highlighted and the inorder sequence is written below"}
7'yi ararken her düğümde yalnızca bir yöne gideriz: 8'den sola, 3'ten sağa, 6'dan sağa. Ziyaret edilen düğüm sayısı ağacın yüksekliğiyle sınırlıdır.
:::

Kuralın arama ve eklemeyi nasıl yönlendirdiğini, ve aynı kuralın sıralı veriyle nasıl kötü bir ağaç üretebileceğini
aşağıdaki sahnede izleyebilirsin. Önce bir tahminde bulun.

:::predict{id="bst-sirali-ekleme"}
1, 2, 3, 4, 5 değerlerini bu sırayla boş bir BST'ye eklersen 5'i aramak kaç karşılaştırma sürer? | If you insert 1, 2, 3, 4, 5 in this order into an empty BST, how many comparisons does searching for 5 take?
- [ ] Yaklaşık log₂ 5, yani 2 ya da 3 | About log₂ 5, so 2 or 3
- [x] 5, çünkü ağaç bir zincire dönüşür | 5, because the tree becomes a chain
- [ ] 1, çünkü son eklenen değer köke yakındır | 1, because the last inserted value sits near the root
Açıklama: Her yeni değer öncekilerin hepsinden büyük olduğu için hep sağa eklenir; ağaç sola hiç dallanmaz ve 5'e ulaşmak için tüm düğümlerden geçmek gerekir. Sahnenin son kısmı tam olarak bunu gösteriyor. | Every new value is larger than all previous ones, so it always goes right; the tree never branches left and reaching 5 means passing every node. The last part of the scene shows exactly this.
:::

:::animation{scene="bst-ekleme.scene.json"}
Solda dengeli bir ağaçta her karşılaştırma bir dalı eler; sağda sıralı ekleme ağacı listeye çevirir.
:::

### Arama

Kuraldan doğrudan bir arama algoritması çıkar. Kökten başla; aranan değer düğümdeki değere eşitse bulduk. Küçükse sola, büyükse sağa in. Boş bir alt ağaca (`None`) ulaştıysan değer ağaçta yoktur. Her adımda bir alt ağacın tamamını aday listesinden çıkardığımız için bu, sıralı dizideki ikili aramanın ağaç biçimidir. Maliyeti O(h), yani ağacın yüksekliği kadardır.

### Ekleme

Ekleme, aramanın neredeyse aynısıdır: değeri arıyormuş gibi aşağı inersin ve `None` ile karşılaştığın yere yeni bir yaprak olarak takarsın. Mevcut düğümlerin hiçbiri yer değiştirmez; bu, diziye göre büyük bir avantajdır. Aynı değer zaten varsa ne yapacağına önceden karar vermelisin: yok saymak, sayaç tutmak ya da eşitleri hep bir tarafa (ör. sağa) koymak yaygın seçeneklerdir.

### Silme

Silme üç duruma ayrılır ve mülakatlarda en çok burası sorulur:

1. **Yaprak siliniyorsa:** Ebeveynin ilgili bağlantısını `None` yapmak yeterlidir.
2. **Tek çocuklu düğüm siliniyorsa:** Düğümü atlayıp çocuğunu doğrudan ebeveyne bağlarsın; sıralama kuralı bozulmaz.
3. **İki çocuklu düğüm siliniyorsa:** Düğümün yerine, sıralamayı bozmayacak bir değer koyman gerekir. Bunun için **inorder ardılı** (sağ alt ağacın en soldaki, yani en küçük düğümü) ya da **inorder öncülü** (sol alt ağacın en büyük düğümü) kullanılır. Ardılın değeri silinecek düğüme kopyalanır, ardından ardılın kendisi silinir. Ardılın sol çocuğu olamayacağı için bu ikinci silme her zaman birinci ya da ikinci duruma düşer.

## Dolaşma sıraları: preorder, inorder, postorder

Bir ağacın bütün düğümlerini ziyaret etmenin birkaç standart yolu vardır. İlk üçü **derinlik öncelikli** (DFS) dolaşmanın varyantlarıdır ve yalnızca düğümün kendisini *ne zaman* işlediğimiz konusunda ayrılır:

- **Preorder (önce kök):** düğüm → sol → sağ. Ağacı kopyalamak ya da serileştirmek için kullanılır; çıktıdan ağaç aynı şekliyle yeniden kurulabilir.
- **Inorder (ortada kök):** sol → düğüm → sağ. BST'de değerleri **küçükten büyüğe sıralı** verir. Bir ağacın geçerli BST olup olmadığını anlamanın en kolay yolu, inorder çıktısının kesin artan olup olmadığına bakmaktır.
- **Postorder (sonda kök):** sol → sağ → düğüm. Bir düğümü işlemeden önce çocuklarının bitmesi gerektiğinde kullanılır: klasör boyutu hesaplamak, ağacı bellekten silmek, ifade ağacını değerlendirmek.

Dördüncüsü **seviye sırası** (level-order) dolaşmadır ve genişlik öncelikli aramanın (BFS) ağaçtaki hâlidir: önce kök, sonra derinliği 1 olan tüm düğümler, sonra derinliği 2 olanlar. Bir önceki derste gördüğümüz kuyruk yapısıyla yazılır. DFS varyantları ise özyinelemeyle, yani dolaylı olarak çağrı yığınıyla yazılır; istersen açık bir yığınla döngüye de çevirebilirsin. Aşağıdaki izde özyinelemeli inorder dolaşmanın çağrı yığınını nasıl büyütüp küçülttüğünü satır satır göreceksin.

:::trace{src="inorder.trace.json" title="Özyinelemeli inorder dolaşma|Recursive inorder traversal"}
Her `inorder` çağrısının yığına yeni bir çerçeve eklediğine ve `None` görünce hemen kapandığına dikkat et. `sonuc` listesi tüm çerçevelerde aynı heap nesnesini gösteriyor.
:::

Derinlik öncelikli dolaşmayı ağaçla sınırlı kalmadan genel bir graf üzerinde de görebilirsin. Aşağıdaki simülatör aynı fikri, yani "bir dalın sonuna kadar in, sonra geri dön" ilkesini dokuz düğümlü bir graf üzerinde gösteriyor.

:::interactive{type="graph-traversal" algorithm="dfs" nodes=9 start=0}
Gezinti 0 numaralı düğümden başlar. "Adım" ile tek tek ilerle, ziyaret sırasını ve yığın panelini izle. Bir dalın sonuna ulaşıldığında gezintinin nereye geri döndüğüne dikkat et; bu geri dönüş, özyinelemeli koddaki çerçevenin kapanmasına karşılık gelir. Başka bir düğüme tıklayıp başlangıcı değiştirdiğinde ya da "Yeni graf" ile farklı bir graf ürettiğinde ziyaret sırasının nasıl değiştiğini karşılaştır.
:::

:::code{lang="python" title="BST: arama, ekleme ve silme"}
```python
class Dugum:
    def __init__(self, deger):
        self.deger = deger
        self.sol = None
        self.sag = None


def ara(kok, hedef):
    dugum = kok
    while dugum is not None and dugum.deger != hedef:
        dugum = dugum.sol if hedef < dugum.deger else dugum.sag
    return dugum                       # bulunamazsa None


def ekle(kok, deger):
    if kok is None:
        return Dugum(deger)            # boş yere yeni yaprak
    if deger < kok.deger:
        kok.sol = ekle(kok.sol, deger)
    elif deger > kok.deger:
        kok.sag = ekle(kok.sag, deger)
    return kok                         # eşit değerleri yok sayıyoruz


def sil(kok, deger):
    if kok is None:
        return None
    if deger < kok.deger:
        kok.sol = sil(kok.sol, deger)
    elif deger > kok.deger:
        kok.sag = sil(kok.sag, deger)
    else:
        if kok.sol is None:            # yaprak ya da yalnızca sağ çocuk
            return kok.sag
        if kok.sag is None:            # yalnızca sol çocuk
            return kok.sol
        ardil = kok.sag                # iki çocuk: inorder ardılını bul
        while ardil.sol is not None:
            ardil = ardil.sol
        kok.deger = ardil.deger
        kok.sag = sil(kok.sag, ardil.deger)
    return kok


def gecerli_bst(dugum, alt=float("-inf"), ust=float("inf")):
    if dugum is None:
        return True
    if not (alt < dugum.deger < ust):
        return False
    return (gecerli_bst(dugum.sol, alt, dugum.deger)
            and gecerli_bst(dugum.sag, dugum.deger, ust))
```
:::

## Dengesizlik sorunu ve dengeli ağaçlar

BST'nin bütün güzel O(log n) vaatleri tek bir varsayıma dayanır: ağacın yüksekliğinin log n civarında kalması. Peki 1, 2, 3, 4, 5 sayılarını bu sırayla boş bir BST'ye eklersen ne olur? Her yeni sayı bir öncekinden büyük olduğu için hep sağa eklenir ve elinde aslında bir **bağlı liste** kalır. Yükseklik n − 1 olur, arama, ekleme ve silme O(n)'e düşer. Gerçek hayatta sıralı ya da neredeyse sıralı veri çok yaygındır: artan kimlik numaraları, zaman damgaları, alfabetik isim listeleri. Bu yüzden düz BST, üretim kodunda nadiren tek başına kullanılır.

Çözüm, her ekleme ve silmeden sonra ağacı küçük **rotasyonlarla** yeniden şekillendiren **kendini dengeleyen** ağaçlardır:

- **AVL ağacı:** Her düğümde sol ve sağ alt ağaç yükseklikleri arasındaki farkın en fazla 1 olmasını garanti eder. Çok sıkı dengelendiği için arama ağırlıklı işlerde hızlıdır, ama ekleme ve silmede daha fazla rotasyon yapar.
- **Kırmızı-siyah ağaç:** Düğümleri renklendirip birkaç kural koyarak en uzun yolun en kısa yolun iki katını geçmemesini sağlar. Dengesi biraz daha gevşektir ama güncellemeler ucuzdur. Java'nın `TreeMap`'i, C++'ın `std::map`'i ve Linux çekirdeğinin zamanlayıcısı bu yapıyı kullanır.
- **B-tree ve B+ tree:** Her düğümde iki değil, yüzlerce anahtar ve çocuk tutar. Böylece ağaç çok sığ kalır; milyonlarca kayıt üç dört seviyede saklanabilir. Diskten ya da SSD'den sayfa okumanın pahalı olduğu veritabanları ve dosya sistemleri için tasarlanmıştır.

Python'un standart kütüphanesinde hazır bir dengeli ağaç yoktur. Sıralı bir yapıya ihtiyaç duyduğunda genellikle sıralı liste ile `bisect` modülünü (küçük veri için yeterli) ya da `sortedcontainers` gibi üçüncü taraf bir paketi kullanırsın. Sıra önemli değilse, ortalama O(1) erişim sunan `dict` ve `set` neredeyse her zaman daha iyi bir seçimdir. Ağacı kendin yazman gereken yer genellikle mülakat sorusu ya da özel bir sistem bileşenidir.

:::callout{tone="warning" title="Özyineleme derinliği"}
Dengesiz bir BST'de yükseklik n'e yaklaşır. Python'un varsayılan özyineleme sınırı 1000 civarında olduğu için, sıralı 5000 sayı eklenmiş bir ağaçta özyinelemeli `inorder` çağrısı `RecursionError` verir. Böyle veride açık bir yığınla yazılmış döngü sürümünü kullan ya da ağacı dengeli tut.
:::

## Hangi işlem ne kadar sürer?

Özetle, h ağacın yüksekliği olmak üzere BST'deki arama, ekleme, silme, en küçük ve en büyük elemanı bulma işlemlerinin hepsi O(h) sürer. Dengeli bir ağaçta h = O(log n), en kötü durumda ise h = O(n) olur. Dolaşma işlemleri her düğümü bir kez ziyaret ettiği için her zaman O(n) zaman alır; özyinelemeli sürümün ek bellek maliyeti ise çağrı yığınından gelir ve O(h) kadardır. Sıralı dizi ile karşılaştırırsak, dengeli BST arama hızından neredeyse hiç ödün vermeden ekleme ve silmeyi O(n)'den O(log n)'e indirir. Bunun karşılığında her düğüm iki işaretçi taşıdığı için bellek tüketimi artar ve elemanlar bellekte dağınık durduğu için önbellek dostu değildir. Bu, okuma ağırlıklı ve az değişen veri için sıralı dizinin hâlâ çok güçlü bir seçenek olduğunu gösterir.

:::realworld{company="PostgreSQL"}
PostgreSQL'de `CREATE INDEX` komutunun varsayılan indeks türü **B-tree**'dir. İndeksin her düğümü bir disk sayfasına (8 KB) karşılık gelir ve içinde yüzlerce anahtar ile çocuk sayfalara giden işaretçiler bulunur. Bu yüksek dallanma sayesinde on milyonlarca satırlık bir tablodaki indeks genellikle yalnızca üç dört seviye derinliğindedir; bir `WHERE id = 42` sorgusu kökten yaprağa birkaç sayfa okuyarak sonuca ulaşır. Yaprak sayfalar birbirine bağlı olduğu için `BETWEEN` ve `ORDER BY` gibi aralık sorguları da yaprak seviyesinde soldan sağa yürüyerek, tıpkı inorder dolaşma gibi, sıralı sonuç üretir. Ekleme sırasında bir sayfa dolarsa ikiye bölünür ve ağaç kendiliğinden dengeli kalır; bu, bu derste gördüğümüz dengesizlik sorununun disk dünyasındaki çözümüdür.
:::

:::realworld{company="Linux"}
Linux çekirdeği, dengeli ağaç fikrinin en yoğun kullanıldığı yerlerden biridir. Çekirdeğin kendi kırmızı-siyah ağaç
kütüphanesi (`lib/rbtree.c`) vardır ve çekirdek belgelerinde yüksek çözünürlüklü zamanlayıcılar, epoll ve bazı dosya
sistemleri gibi kullanıcıları sayılır. En bilinen örnek süreç zamanlayıcısıdır: uzun yıllar varsayılan zamanlayıcı
olan CFS (Completely Fair Scheduler), çalışmaya hazır görevleri o ana kadar aldıkları sanal işlemci süresini gösteren
`vruntime` değerine göre sıralı bir kırmızı-siyah ağaçta tutar ve sıradaki görev olarak ağacın en solundaki, yani en
az süre almış görevi seçer. En soldaki düğüm ayrıca önbelleğe alındığı için bu seçim sabit sürede yapılır; görev
ekleme ve çıkarma ise O(log n) sürer. Çekirdek 6.6 ile gelen EEVDF zamanlayıcısı da görevleri yine bir kırmızı-siyah
ağaç üzerinde düzenler. Düz bir BST burada güvenilir olmazdı: `vruntime` değerleri zamanla hep artma eğiliminde
olduğundan, sahnede gördüğün sıralı ekleme durumu kolayca oluşur ve ağaç bir zincire dönüşebilirdi.
:::

:::callout{tone="tip" title="Mülakat ipucu"}
- "Bu ağaç geçerli bir BST mi?" sorusunda yalnızca ebeveyn-çocuk karşılaştırması yapma; her düğüme bir (alt, üst) aralığı taşı ya da inorder çıktısının kesin artan olduğunu kontrol et.
- Karmaşıklık sorulduğunda "O(log n)" deyip geçme; "dengeli ise O(log n), en kötü durumda O(n)" diye yüksekliğe bağla ve dengeli ağaç seçeneklerini an.
- İki çocuklu düğüm silmeyi inorder ardılı ile anlatabilmek, mülakatçının en çok beklediği ayrıntıdır.
:::

:::quiz{src="quiz.json"}
:::

:::next{lesson="l-06-heaps-priority-queues"}
Sırada: ağacın dizi içine sıkıştırılmış bir biçimi olan heap ve her zaman en öncelikli işi veren öncelik kuyruğu.
:::

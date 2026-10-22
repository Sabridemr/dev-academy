---
id: l-07-graphs-bfs-dfs
slug: graphs-bfs-dfs
module: l-algorithms-data-structures
order: 7
title:
  tr: "Graflar: BFS, DFS ve En Kısa Yol"
  en: "Graphs: BFS, DFS and Shortest Paths"
summary:
  tr: "Komşuluk listesi, BFS/DFS, topolojik sıralama ve Dijkstra; interaktif graf gezintisi."
  en: "Adjacency lists, BFS/DFS, topological sort and Dijkstra; interactive graph traversal."
durationMinutes: 35
level: intermediate
tags: [algoritmalar, graf, bfs, dfs, dijkstra, en-kisa-yol]
prerequisites: [l-06-heaps-priority-queues, l-04-stacks-queues]
concepts: [graph-representation, adjacency-list, bfs, dfs, topological-sort, dijkstra, visited-set]
---

## Kavram: her şey bir ağ

Şimdiye kadar gördüğümüz veri yapılarının çoğu belirli bir şekle sahipti: dizi düz bir sıra, yığın ve kuyruk iki uçlu bir hat, ağaç ise kökten yapraklara inen bir hiyerarşiydi. **Graf**, bu şekil kısıtlarının hepsini kaldıran en genel yapıdır. Bir graf iki şeyden oluşur: **düğümler** (vertex, node) ve bu düğümleri birbirine bağlayan **kenarlar** (edge). Bir şehirdeki kavşaklar ve yollar, bir sosyal ağdaki kişiler ve arkadaşlıklar, bir projedeki görevler ve "şu bitmeden bu başlayamaz" ilişkileri, bir mikroservis mimarisindeki servisler ve birbirlerine attıkları istekler; hepsi graftır.

Grafları birkaç eksende sınıflandırırız:

- **Yönlü ya da yönsüz**: Arkadaşlık genellikle karşılıklıdır (yönsüz), ama "takip etmek" tek yönlüdür (yönlü). Tek yönlü sokaklar da yönlü kenardır.
- **Ağırlıklı ya da ağırlıksız**: Kenarın bir maliyeti (mesafe, süre, ücret) olabilir. Ağırlık yoksa her kenar "1 adım" sayılır.
- **Döngülü ya da döngüsüz**: Bir düğümden çıkıp kenarları izleyerek aynı düğüme dönebiliyorsanız grafta döngü vardır. Yönlü ve döngüsüz graflara **DAG** (directed acyclic graph) denir; derleme sistemleri, iş akışı motorları ve paket yöneticileri DAG ile çalışır.
- **Bağlı ya da parçalı**: Her düğümden her düğüme bir yol varsa graf bağlıdır; yoksa birden fazla **bileşenden** oluşur.

Ağaç aslında özel bir graftır: bağlı, döngüsüz ve n düğüm için tam n−1 kenarı vardır. Bu yüzden önceki derste ağaçlar için öğrendiğimiz dolaşma sezgisi burada da işe yarayacak; tek büyük fark, grafta döngü olabileceği için **aynı düğüme tekrar gelme** riskidir.

:::diagram{src="diagram.svg" alt="Altı düğümlü yönsüz graf, komşuluk listesi gösterimi ve A düğümünden başlayan BFS katmanları|A six-node undirected graph, its adjacency list and the BFS layers starting from node A"}
Aynı graf iki biçimde: solda çizim, ortada komşuluk listesi, sağda BFS'nin A'dan başlayarak oluşturduğu mesafe katmanları.
:::

## Grafı bellekte tutmak

Bir grafı koda dökmenin iki klasik yolu vardır.

**Komşuluk matrisi**, n×n boyutunda bir tablodur; `M[i][j]` değeri i'den j'ye kenar olup olmadığını (ya da ağırlığını) tutar. "İki düğüm arasında kenar var mı?" sorusunu O(1) sürede cevaplar, ama bellek maliyeti her zaman O(n²) olur. Bir milyon kullanıcılı bir sosyal ağda bu, bir trilyon hücre demektir ve hücrelerin neredeyse hepsi boş kalır.

**Komşuluk listesi** ise her düğüm için yalnızca komşularını saklar. Python'da bunun en doğal hâli, anahtarları düğüm, değerleri komşu listesi olan bir sözlüktür. Bellek O(V + E) olur; yani düğüm ve kenar sayısıyla orantılı büyür. Gerçek dünyadaki grafların çoğu **seyrek** olduğu için (her kişinin milyonlarca değil birkaç yüz arkadaşı vardır) pratikte neredeyse her zaman komşuluk listesi kullanılır. Bu derste V düğüm sayısını, E kenar sayısını gösterecek.

## BFS: katman katman genişlemek

**Genişlik öncelikli arama** (Breadth-First Search), başlangıç düğümünden suya atılmış bir taşın oluşturduğu halkalar gibi yayılır. Önce başlangıca bir kenar uzaklıktaki bütün düğümleri, sonra iki kenar uzaklıktakileri, sonra üç kenar uzaklıktakileri ziyaret eder. Bu sırayı garanti eden yapı, yığın ve kuyruk dersinde tanıştığımız **FIFO kuyruğudur**: önce keşfedilen düğüm önce işlenir.

Algoritmanın iskeleti kısadır: başlangıcı kuyruğa koy ve ziyaret edildi olarak işaretle; kuyruk boşalana kadar baştan bir düğüm çıkar, ziyaret edilmemiş her komşusunu işaretleyip kuyruğun sonuna ekle. Buradaki ince ama kritik ayrıntı, düğümü **kuyruğa eklerken** işaretlemektir. Çıkarırken işaretlerseniz aynı düğüm birden fazla komşu tarafından kuyruğa eklenebilir; sonuç yine doğru çıkar ama iş ve bellek boşa harcanır, yoğun graflarda bu fark çok büyür.

BFS'nin en değerli özelliği şudur: **ağırlıksız bir grafta**, bir düğümü ilk keşfettiğiniz an ona giden en kısa yolu (en az kenarlı yolu) bulmuşsunuzdur. Çünkü k uzaklıktaki bütün düğümler, k+1 uzaklıktakilerden önce kuyruktan çıkar. Her düğüm en fazla bir kez kuyruğa girer ve her kenar en fazla iki kez (yönsüz grafta iki uçtan) incelenir; toplam zaman karmaşıklığı **O(V + E)**, bellek de en kötü durumda O(V) olur.

Önce BFS'nin kuyruğu nasıl kullandığını diyagramdaki grafla bir sahnede izleyelim, ardından aynı algoritmanın kodunu
satır satır görelim.

:::animation{scene="bfs-katmanlar.scene.json"}
Rozetler her düğümün A'ya uzaklığını gösterir; kuyruk kutusu sıradaki düğümleri listeler.
:::

:::trace{src="bfs-en-kisa-yol.trace.json" title="BFS ile ağırlıksız en kısa mesafe|Shortest unweighted distance with BFS"}
`kuyruk` değişkenini izleyin: düğümler sondan girip baştan çıkıyor. `mesafe` sözlüğü her yeni katmanda bir fazlasıyla büyüyor.
:::

Aşağıdaki simülatörde BFS'yi on düğümlü bir grafta 0 numaralı düğümden başlatıp 7 numaralı hedefe doğru ilerlerken izleyebilirsiniz.

:::interactive{type="graph-traversal" algorithm="bfs" nodes=10 start=0 target=7 weighted=false}
"Adım" ile tek tek ilerleyin ya da "Oynat" ile akışı izleyin: "Kuyruk (baş →)" panelinde hangi düğümün kuyruğa girdiğini, hangisinin işlendiğini ve hedef 7'ye kaç katmanda ulaşıldığını takip edin. "Yeni graf" ile farklı bir graf üretip ziyaret sırasının nasıl değiştiğini karşılaştırın.
:::

## DFS: dibe kadar inip geri dönmek

**Derinlik öncelikli arama** (Depth-First Search) bunun tam tersini yapar: bir komşuya geçer, onun bir komşusuna geçer, gidecek yer kalmayana kadar derine iner, sonra son ayrım noktasına geri dönüp (backtracking) başka bir dalı dener. Labirentte bir eli duvara koyarak yürümek gibidir. DFS'nin doğal yapısı **yığındır**: ya açıkça bir liste kullanıp `append` ve `pop` ile çalışırsınız ya da özyinelemeye başvurup Python'un çağrı yığınını kullanırsınız.

DFS de her düğümü ve kenarı bir kez işler; karmaşıklığı yine **O(V + E)**'dir. Ama verdiği bilgi farklıdır. DFS en kısa yolu **garanti etmez**; hedefe çok dolambaçlı bir yoldan ulaşabilir. Buna karşılık şu sorularda çok güçlüdür:

- **Bağlantı ve bileşenler**: Ziyaret edilmemiş her düğümden bir DFS başlatırsanız, her başlatma bir bağlı bileşeni bütünüyle boyar. "Haritada kaç ada var?" sorusunun standart çözümü budur.
- **Döngü tespiti**: Yönlü grafta DFS sırasında hâlâ "yolda" olan (yığında duran) bir düğüme geri kenar bulursanız döngü vardır.
- **Yol üretme ve geri izleme**: Sudoku, permütasyon üretme ve labirent çözme gibi problemler aslında örtük bir grafta DFS'dir.

Aşağıdaki sahne BFS sahnesindeki grafın aynısını DFS ile geziyor. İki ziyaret sırasını ve C düğümüne hangi yoldan
ulaşıldığını karşılaştır.

:::animation{scene="dfs-derinlik.scene.json"}
Rozetler ziyaret sırasını, yığın kutusu geri dönülecek düğümleri gösterir.
:::

Python'da özyinelemeli DFS'nin bir tuzağı vardır: varsayılan özyineleme sınırı yaklaşık bin çerçevedir. On binlerce düğümlük uzun bir zincirde `RecursionError` alırsınız. Üretim kodunda büyük graflar için açık bir yığın kullanan yinelemeli sürüm daha güvenlidir.

## Topolojik sıralama: bağımlılıkları sıraya koymak

Bir DAG'de düğümleri, her kenar soldan sağa bakacak şekilde dizmeye **topolojik sıralama** denir. "Önce `models` paketi derlenmeli, sonra `services`, en son `api`" gibi bağımlılık sorunlarının cevabıdır. İki yaygın yöntem vardır:

1. **Kahn algoritması (BFS tabanlı)**: Her düğümün kaç gelen kenarı olduğunu (giriş derecesi) sayın. Giriş derecesi sıfır olanları kuyruğa koyun. Kuyruktan çıkan her düğümü sonuca ekleyin ve komşularının giriş derecesini bir azaltın; sıfıra inenleri kuyruğa ekleyin. Sonunda tüm düğümleri yerleştiremediyseniz grafta döngü vardır; yani bağımlılıklar çözülemez.
2. **DFS tabanlı**: Bir düğümün tüm alt düğümleri bittikten sonra onu bir listeye ekleyin, sonra listeyi ters çevirin.

İkisi de O(V + E) sürede çalışır. Kahn algoritmasının ek bir avantajı, döngüyü kendiliğinden yakalaması ve "hangi görevler aynı anda yapılabilir?" sorusuna doğal bir cevap vermesidir: aynı anda kuyrukta duran düğümler birbirine bağımlı değildir.

## Dijkstra: ağırlıklı en kısa yol

Kenarların ağırlığı olduğunda BFS'nin garantisi bozulur. Üç kısa ama yavaş sokaktan geçen yol, tek bir uzun ama hızlı otoyoldan daha pahalı olabilir; BFS ise yalnızca kenar sayısına bakar. **Dijkstra algoritması** bu problemi, negatif ağırlık olmadığı sürece çözer.

Fikir, BFS'deki FIFO kuyruğunu bir önceki derste gördüğümüz **öncelik kuyruğuyla** (min-heap) değiştirmektir. Heap'ten her seferinde başlangıca **o ana kadar bilinen en yakın** düğüm çıkar. Ağırlıklar negatif olmadığı için bu düğüme daha kısa bir yoldan ulaşmak artık imkânsızdır; mesafesi kesinleşir. Sonra komşularına bakılır: "bu düğüm üzerinden komşuya gitmek, komşunun bilinen mesafesinden daha mı kısa?" Cevap evetse mesafe güncellenir ve komşu yeni önceliğiyle heap'e eklenir. Bu güncelleme adımına **gevşetme** (relaxation) denir.

Python'un `heapq` modülünde öncelik azaltma işlemi olmadığı için yaygın teknik, aynı düğümü yeni mesafeyle tekrar eklemek ve heap'ten çıkan eski, bayat kayıtları "bu mesafe zaten kesinleşmiş olandan büyük" kontrolüyle atlamaktır. Bu sürümün karmaşıklığı **O((V + E) log V)** civarındadır.

:::interactive{type="graph-traversal" algorithm="dijkstra" nodes=10 start=0 target=7 weighted=true}
Bu kez kenarlar ağırlıklı ve algoritma Dijkstra. Uzaklıklar panelinde değerlerin nasıl gevşetildiğini izleyin: heap'ten çıkan düğümün kenar sayısına göre değil, toplam ağırlığa göre seçildiğini ve 7'ye giden yolun BFS'ninkinden farklı olabileceğini gözlemleyin.
:::

:::code{lang="python" title="heapq ile Dijkstra"}
```python
import heapq

def dijkstra(graf, kaynak):
    """graf: {dugum: [(komsu, agirlik), ...]}"""
    mesafe = {kaynak: 0}
    heap = [(0, kaynak)]
    while heap:
        d, dugum = heapq.heappop(heap)
        if d > mesafe[dugum]:
            continue                     # bayat kayıt: daha kısa yol zaten bulunmuş
        for komsu, w in graf[dugum]:
            yeni = d + w
            if yeni < mesafe.get(komsu, float("inf")):
                mesafe[komsu] = yeni     # gevşetme (relaxation)
                heapq.heappush(heap, (yeni, komsu))
    return mesafe
```
:::

Negatif ağırlıklı kenar varsa Dijkstra yanlış sonuç verebilir, çünkü "kesinleşti" dediği bir mesafe sonradan negatif bir kenarla küçülebilir. Bu durumda O(V·E) süren **Bellman-Ford** kullanılır; o da negatif döngüleri tespit edebilir. Haritalar gibi çok büyük graflarda ise Dijkstra'ya hedefe olan tahmini uzaklığı ekleyen **A\*** algoritması, aranan alanı ciddi biçimde daraltır.

## Birkaç yaygın BFS varyantı

BFS'nin gücü küçük değişikliklerle genişler. **Çok kaynaklı BFS**'de kuyruğa tek bir başlangıç yerine birden fazla düğüm aynı anda konur; örneğin bir ızgarada her hücrenin en yakın hastaneye uzaklığını bulmak için bütün hastaneler mesafe sıfırla kuyruğa eklenir ve tek bir gezinti tüm cevapları verir. **Ebeveyn sözlüğü** tutarak her düğümün hangi düğümden keşfedildiğini kaydederseniz, hedefe ulaştıktan sonra bu zinciri geriye izleyip yolun kendisini de elde edersiniz. Kenar ağırlıkları yalnızca 0 ya da 1 ise, ağırlığı 0 olan komşuyu kuyruğun önüne, 1 olanı sonuna ekleyen **0-1 BFS**, Dijkstra'ya gerek kalmadan doğrusal sürede en kısa yolu bulur.

## Hangi algoritma, ne zaman?

Doğru algoritmayı seçmek çoğu zaman tek bir soruya iner: "Kenarların ağırlığı var mı ve ben tam olarak ne arıyorum?" Ağırlıksız en kısa yol ya da "en az adım" soruları BFS ister. Erişilebilirlik, bileşen sayma, döngü bulma ve tüm olasılıkları gezme DFS ile en kolay çözülür. Bağımlılık sırası topolojik sıralamadır. Negatif olmayan ağırlıklarla en kısa yol Dijkstra'dır. Problemi doğru modellemek de en az algoritma kadar önemlidir: bir ızgara haritası, her hücrenin dört komşusu olan bir graftır; kelime dönüştürme bulmacası, tek harf farkla ulaşılabilen kelimelerin grafıdır. Problemi graf olarak görebildiğiniz an, elinizde hazır ve kanıtlanmış bir araç kutusu olur.

:::realworld{company="Getir"}
Getir gibi hızlı teslimat yapan şirketlerde kuryenin depodan müşteriye gideceği rota, şehrin yol ağının ağırlıklı bir graf olarak modellenmesine dayanır: kavşaklar düğüm, sokaklar kenar, kenar ağırlıkları da tahmini geçiş süresidir. Ağırlıklar trafik ve günün saatine göre değiştiği için sabit mesafe değil, sürekli güncellenen süre tahmini kullanılır. Teslimat süresi tahmini, depo kapsama alanının belirlenmesi ve kuryeye sipariş atanması gibi kararların altında Dijkstra ve A\* ailesinden en kısa yol hesapları yatar. Ölçek büyüdükçe, şehir haritasının önceden işlenip sorguların milisaniyeler içinde cevaplanmasını sağlayan hiyerarşik teknikler de devreye girer.
:::

:::realworld{company="Google"}
Google Maps'in yol tarifi, kıta ölçeğinde milyonlarca düğümlü bir graf üzerinde çalışır. Sıradan Dijkstra her sorguda bu kadar büyük bir alanı tarayamayacağı için harita önceden işlenir: önemli yollar bir üst katmanda toplanır ve sorgu yalnızca başlangıç ile hedef çevresinde ayrıntıya iner. Temel fikir yine aynıdır: negatif olmayan ağırlıklar, bir öncelik kuyruğu ve gevşetme.
:::

:::callout{tone="warning" title="Ziyaret işaretini unutmak"}
Ağaçlarda ziyaret kümesine ihtiyaç duymazsınız, çünkü döngü yoktur. Grafta ise `visited` kümesi olmadan BFS ya da DFS iki düğüm arasında sonsuza kadar gidip gelir. Düğümü kuyruğa ya da yığına eklediğiniz anda işaretlemek en güvenli alışkanlıktır.
:::

:::callout{tone="tip" title="Mülakat ipucu"}
- Soruda "en az adım", "en kısa dönüşüm" ya da ızgarada en kısa yol geçiyorsa ilk düşünceniz BFS olsun; ağırlık varsa Dijkstra'ya geçin.
- Çözüme başlamadan grafın temsilini söyleyin: "Komşuluk listesi kuracağım, V düğüm ve E kenar için O(V + E)."
- Izgara problemlerinde komşuları dört yön dizisiyle üretin ve sınır kontrolünü tek bir yardımcı fonksiyona toplayın; hataların çoğu oradan çıkar.
:::

:::quiz{src="quiz.json"}
:::

:::next{lesson="l-08-sorting"}
Sırada: veriyi düzene sokmanın klasik yolları; bubble, insertion, merge ve quick sort'un nasıl çalıştığı ve neden O(n log n)'in bir sınır olduğu.
:::

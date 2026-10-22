---
id: l-04-stacks-queues
slug: stacks-queues
module: l-algorithms-data-structures
order: 4
title:
  tr: "Yığın ve Kuyruk"
  en: "Stacks and Queues"
summary:
  tr: "LIFO ve FIFO yapıları, parantez eşleme, çağrı yığını, deque ve monotonik yığın; Python izleriyle."
  en: "LIFO and FIFO structures, bracket matching, the call stack, deque and monotonic stack; with Python traces."
durationMinutes: 28
level: beginner
tags: [algoritmalar, veri-yapilari, yigin, kuyruk, deque]
prerequisites: [l-03-hash-tables, k-06-fonksiyonlar-ve-cagri-yigini]
concepts: [stack, queue, lifo, fifo, bracket-matching, call-stack, deque, monotonic-stack]
---

## Kavram: erişimi kısıtlamak neden güç verir?

Diziler ve hash tabloları sana büyük özgürlük tanır: istediğin indekse ya da anahtara istediğin an ulaşırsın. Yığın (stack) ve kuyruk (queue) ise bilerek bu özgürlüğü kısıtlar. Elemanlara rastgele erişemezsin; yalnızca belirli bir uçtan ekler, belirli bir uçtan çıkarırsın. İlk bakışta bu bir zayıflık gibi görünür ama aslında bir **sözleşmedir**: bir yapının yalnızca "en son eklenen" ya da yalnızca "en önce eklenen" elemanı verdiğini bilmek, algoritmanın doğruluğunu düşünmeyi büyük ölçüde kolaylaştırır. Üstelik bu kısıtlı işlemlerin hepsi O(1) sürer.

İki yapının farkını günlük hayattan bir benzetmeyle hatırlayabilirsin. **Yığın**, mutfaktaki tabak yığını gibidir: yeni tabağı en üste koyarsın, alırken de en üsttekini alırsın. Buna **LIFO** (Last In, First Out — son giren ilk çıkar) denir. **Kuyruk** ise bir bankadaki sıra gibidir: ilk gelen ilk hizmet alır, yeni gelen sıranın sonuna geçer. Buna da **FIFO** (First In, First Out — ilk giren ilk çıkar) denir.

Temel işlemlerin isimleri de bu benzetmeden gelir:

| İşlem | Yığın | Kuyruk |
|---|---|---|
| Ekleme | `push` — tepeye koy | `enqueue` — sona ekle |
| Çıkarma | `pop` — tepeden al | `dequeue` — baştan al |
| Bakma | `peek` / `top` — tepedekine bak | `front` — baştakine bak |
| Python karşılığı | `list.append`, `list.pop()` | `deque.append`, `deque.popleft()` |

:::diagram{src="diagram.svg" alt="Solda push ve pop'un aynı uçtan yapıldığı bir yığın, sağda elemanların bir uçtan girip diğer uçtan çıktığı bir kuyruk|On the left a stack where push and pop use the same end, on the right a queue where elements enter one end and leave the other"}
Yığında tek bir uç (tepe) vardır; kuyrukta giriş ve çıkış farklı uçlardadır.
:::

İki yapıyı iş başında görmek için aşağıdaki sahnede fonksiyon çağrılarını bir yığına, yazdırma işlerini bir kuyruğa
koyuyoruz.

:::animation{scene="yigin-kuyruk.scene.json"}
Yığında çerçeveler giriş sırasının tersine çıkar; kuyrukta işler geldikleri sırayla yazdırılır.
:::

## Yığın: geri dönmenin veri yapısı

Yığının öne çıktığı her problemde ortak bir desen vardır: bir şeyi **yarıda bırakıp** daha yeni bir şeyle uğraşırsın, o bitince de yarıda bıraktığına **geri dönersin**. En yeni iş, ilk bitirilmesi gereken iştir. Metin düzenleyicideki "geri al" (undo) özelliği böyle çalışır: yaptığın her değişiklik yığına konur, Ctrl+Z en son değişikliği çıkarıp geri alır. Tarayıcının geri tuşu, ziyaret ettiğin sayfaları bir yığında tutar. Derleyiciler ifadeleri ayrıştırırken, labirent çözen bir program çıkmaz sokaktan geri dönerken ve derinlik öncelikli arama (DFS) bir dalı bitirip bir önceki düğüme dönerken hep yığın kullanır.

### Parantez eşleme

Yığının klasik örneği, bir metindeki parantezlerin dengeli olup olmadığını kontrol etmektir. `{[()]}` dengelidir; `([)]` ise değildir, çünkü `[` kapanmadan önce `)` gelmiştir. Kural basittir: bir açılış parantezi görünce yığına koy; bir kapanış görünce yığının tepesindeki açılışla eşleşip eşleşmediğine bak. Eşleşmiyorsa ya da yığın boşsa metin dengesizdir. Metin bittiğinde yığın boş değilse kapanmamış açılış kalmış demektir. Her karakter en fazla bir kez yığına girip çıktığı için algoritma O(n) zaman ve en kötü durumda O(n) bellek kullanır. Kod editörlerinin eşleşmeyen parantezi kırmızıyla işaretlemesi, JSON ve HTML ayrıştırıcılarının iç içe yapıları doğrulaması bu fikre dayanır.

:::trace{src="parantez-esleme.trace.json" title="Yığın ile parantez eşleme|Bracket matching with a stack"}
Heap'teki `yigin` listesinin her açılışta büyüdüğünü, her doğru kapanışta küçüldüğünü izle.
:::

### Çağrı yığını

Python dersinde gördüğün **çağrı yığını** (call stack), yığın fikrinin donanım ve dil seviyesindeki karşılığıdır. Bir fonksiyon başka bir fonksiyonu çağırdığında yeni bir çerçeve (frame) yığının tepesine konur; çağrılan fonksiyon bitince çerçevesi çıkarılır ve kontrol, bir alttaki çerçevede kaldığı yere döner. Özyinelemeli bir fonksiyon aslında bu yığını senin yerine yönetir. Bu yüzden her özyinelemeli algoritma, açık bir yığın kullanan döngüsel bir algoritmaya çevrilebilir. Bunu bilmek pratikte işe yarar: Python'un varsayılan özyineleme sınırı yaklaşık bin çerçevedir. Çok derin bir ağacı özyinelemeyle gezersen `RecursionError` alırsın; aynı işi kendi listeni yığın olarak kullanarak yaparsan sınır yalnızca belleğin olur.

## Kuyruk: adil sıra ve katman katman ilerleme

Kuyruk, işlerin **geliş sırasına göre** işlenmesi gerektiğinde devreye girer. Yazıcıya gönderilen belgeler, bir web sunucusunun karşılayamadığı anda bekleyen istekler, işletim sisteminin sıradaki işlemi seçmesi ve mesaj kuyruklarında üretici ile tüketici arasında biriken işler hep FIFO mantığıyla yönetilir. Kuyruk, hızları farklı iki tarafın arasına konan bir **tampon** görevi görür: üretici bir anda çok iş üretse bile tüketici kendi hızında, sırayla işlemeye devam eder.

Algoritmalarda kuyruğun en önemli kullanımı **genişlik öncelikli aramadır** (BFS). Bir başlangıç düğümünden yola çıkıp önce tüm komşulara, sonra komşuların komşularına bakmak istiyorsan kuyruk tam olarak bu sırayı sağlar: kuyruğa ilk girenler başlangıca en yakın olanlardır ve onlar ilk işlenir. Bu yüzden BFS ağırlıksız bir grafta en kısa yolu bulur. Aşağıdaki iz küçük bir graf üzerinde BFS'i gösteriyor; graf algoritmalarını ileriki derste ayrıntılı işleyeceğiz, burada dikkatini kuyruğun davranışına ver.

:::trace{src="deque-bfs.trace.json" title="deque ile BFS kuyruğu|A BFS queue with deque"}
`kuyruk` nesnesinin soldan eleman verip sağdan eleman aldığını izle: düğümler A, sonra B ve C, sonra D ve E katmanı hâlinde çıkar.
:::

### Neden list değil de deque?

Python listesi yığın olarak mükemmeldir: `append` ve `pop()` listenin sonunda çalıştığı için amortize O(1) sürer. Ama listeyi kuyruk olarak kullanmak için `pop(0)` çağırırsan, önceki derste gördüğün gibi listenin başından eleman silmek geri kalan tüm elemanların bir sola kaydırılmasını gerektirir; bu O(n) bir işlemdir. Yüz bin elemanlık bir kuyrukta her çıkarma yüz bin kaydırma demektir ve BFS'in toplam maliyeti O(n²)'ye fırlar.

`collections.deque` (double-ended queue, çift uçlu kuyruk) bu sorunu çözer. İçeride sabit boyutlu bloklardan oluşan çift yönlü bir bağlı liste kullanır; böylece hem başa hem sona ekleme ve çıkarma O(1) sürer. `deque(maxlen=100)` biçiminde sınırlı bir kuyruk da oluşturabilirsin: dolduğunda yeni eleman eklenirken en eski eleman otomatik düşer. "Son 100 log satırını tut" ya da "son beş dakikanın isteklerini say" gibi kayan pencere problemlerinde bu çok kullanışlıdır. Bedeli, deque'de ortadaki bir elemana indeksle erişimin O(n) olmasıdır; deque bir dizi değildir.

:::callout{tone="warning" title="list.pop(0) sessiz bir performans tuzağıdır"}
`list.pop(0)` ve `list.insert(0, x)` küçük listelerde hızlı görünür, bu yüzden hata testlerde fark edilmez. Üretimde veri büyüdüğünde ise kuyruk işlemleri tüm programı yavaşlatır. Bir listenin başından eleman alıyorsan, ona `deque` gözüyle bak. Thread'ler arası iş kuyruğu gerekiyorsa `queue.Queue`, asyncio içinde `asyncio.Queue` kullan.
:::

## Monotonik yığın: "bir sonraki büyük eleman"

Yığının mülakatlarda en çok sevilen ileri kullanımı **monotonik yığındır**. Fikir, yığındaki elemanları her zaman belirli bir sırada (örneğin tepeden aşağıya artan) tutmaktır. Yeni bir eleman geldiğinde, bu sırayı bozacak tüm elemanları tepeden çıkarırsın; çıkardığın her eleman için yeni gelen eleman, "kendisinden sonra gelen ilk büyük eleman" olur.

Somut bir örnek: günlük sıcaklıklar `[23, 21, 25, 22, 26]` olsun ve her gün için "kaç gün sonra daha sıcak bir gün gelecek?" sorusunu cevaplamak isteyelim. Saf yaklaşım her gün için ileriye doğru tarar ve O(n²) sürer. Monotonik yığınla her günün indeksini yığına koyarız; yeni gün, yığının tepesindeki günden sıcaksa o günün cevabı artık bellidir, onu çıkarırız. Her indeks yığına bir kez girip bir kez çıktığı için toplam süre O(n) olur. Aynı teknik borsa grafiğinde "hisse fiyatının kaç gündür artan seride olduğunu" bulmak, histogramdaki en büyük dikdörtgeni hesaplamak ve yağmur suyu tutma gibi problemlerde de kullanılır.

:::code{lang="python" title="Monotonik yığın: daha sıcak güne kaç gün var?"}
```python
def daha_sicak_gun(sicakliklar):
    cevap = [0] * len(sicakliklar)
    yigin = []  # henüz cevabı bulunmamış günlerin indeksleri
    for i, t in enumerate(sicakliklar):
        # yeni gün, tepedeki günden sıcaksa o günün cevabı bulundu
        while yigin and sicakliklar[yigin[-1]] < t:
            j = yigin.pop()
            cevap[j] = i - j
        yigin.append(i)
    return cevap

print(daha_sicak_gun([23, 21, 25, 22, 26]))  # [2, 1, 2, 1, 0]
```
:::

## Hangi yapıyı ne zaman seçmeli?

Bir problemle karşılaştığında kendine şu soruyu sor: "İşlenmeyi bekleyen elemanlardan hangisini önce ele almalıyım?" Cevap **en yenisi** ise yığın, **en eskisi** ise kuyruk kullanırsın. Eğer cevap "en önemlisi" ya da "en küçüğü" ise ikisi de yetmez; o zaman ileride göreceğimiz **öncelik kuyruğuna** (heap) ihtiyaç duyarsın. Bu üç yapı aslında aynı soruya verilen üç farklı cevaptır ve graf algoritmalarında bu fark doğrudan görünür: yığınla gezersen DFS, kuyrukla gezersen BFS, öncelik kuyruğuyla gezersen Dijkstra algoritmasını elde edersin.

Bir diğer pratik nokta da yapıların sınırlarını düşünmektir. Gerçek sistemlerdeki kuyruklar sonsuz büyüyemez. Tüketici yavaşlarsa kuyruk şişer, bellek tükenir ve sistem çöker. Bu yüzden üretim ortamındaki kuyruklara bir üst sınır konur; sınır dolunca ya yeni işler reddedilir ya da üreticiye "yavaşla" sinyali gönderilir. Bu mekanizmaya **geri basınç** (backpressure) denir. Aynı şekilde, kontrolsüz derinleşen bir yığın da `RecursionError` ya da işletim sistemi seviyesinde stack overflow demektir.

Son olarak, yığın ve kuyruk ihtiyacı için Python'da çoğu zaman yeni bir sınıf yazmana gerek yoktur. Yığın için düz bir liste, kuyruk için `deque` yeterlidir. Kendi sınıfını yazman gereken durum, işlemleri kısıtlamak ve niyetini açıkça göstermek istediğin zamandır: yalnızca `push`, `pop` ve `peek` metodları olan bir `Yigin` sınıfı, kodunu okuyan herkese yapının LIFO olarak kullanıldığını hemen anlatır.

:::interactive{type="stack-queue" mode="brackets" expression="(a + b) * [c - d[i]]"}
"Adım" ile ifadeyi karakter karakter işle: her açılış parantezi yığına itilir, her kapanış tepedeki açılışla eşleşirse yığından çekilir. Yığın panelinde tepedeki elemanı, "Yığın derinliği" ve "En büyük derinlik" göstergelerini izle; "Geri" ile bir adım geri dönebilirsin. Ardından "İfade" alanına `(a]`, `a)` ya da `([]` gibi hatalı ifadeler yaz: simülatör hatanın konumunu işaretler ve hangi kapanışın beklendiğini söyler. Sonra "Mod" bölümünden "BFS kuyruğu"na geç: A'dan başlayan gezintide yeni keşfedilen komşuların kuyruğun sonuna eklendiğini, sıradaki düğümün baştan alındığını ve ziyaret sırasının katman katman ilerlediğini gözlemle. "Başlangıç düğümü"nü değiştirip "En uzun kuyruk" değerinin nasıl değiştiğine bak.
:::

:::realworld{company="Google"}
Google Chrome ve diğer modern tarayıcılar JavaScript'i tek bir ana iş parçacığında çalıştırır ve bunu bir yığın ile bir kuyruğun iş birliğiyle yönetir. Çalışan kod **çağrı yığınında** (call stack) yürür; bir zamanlayıcı dolduğunda, bir ağ yanıtı geldiğinde ya da kullanıcı bir düğmeye tıkladığında ilgili geri çağırma fonksiyonu doğrudan çalıştırılmaz, **görev kuyruğuna** (task queue) eklenir. **Olay döngüsü** (event loop), çağrı yığını boşaldığında kuyruğun başındaki görevi alıp yığına koyar. Promise geri çağırmaları ise ayrı bir mikro görev kuyruğunda bekler ve her görevden sonra önce onlar boşaltılır. Uzun süren senkron bir döngünün sayfayı dondurmasının nedeni budur: yığın boşalmadıkça kuyruktaki tıklama olayları işlenemez.
:::

:::callout{tone="tip" title="Mülakat ipucu"}
- "İç içe yapı", "eşleşen çift", "geri al" ya da "en son açılan" ifadelerini duyarsan aklına önce **yığın** gelsin.
- "En kısa adım sayısı", "katman katman" ya da "seviye seviye" geçiyorsa **kuyruk + BFS** düşün.
- "Her eleman için sağındaki ilk büyük/küçük eleman" kalıbı neredeyse her zaman **monotonik yığın** ile O(n)'de çözülür; her elemanın yığına bir kez girip bir kez çıktığını söyleyerek karmaşıklığı gerekçelendir.
- Python'da kuyruk için `list.pop(0)` yazarsan görüşmeci büyük olasılıkla soracaktır; baştan `collections.deque` kullan.
:::

:::quiz{src="quiz.json"}
:::

:::next{lesson="l-05-trees-bst"}
Sırada: doğrusal yapılardan hiyerarşik yapılara geçiyoruz; ağaçlar, dolaşma sıraları ve ikili arama ağacı.
:::

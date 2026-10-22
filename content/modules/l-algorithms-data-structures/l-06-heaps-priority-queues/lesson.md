---
id: l-06-heaps-priority-queues
slug: heaps-priority-queues
module: l-algorithms-data-structures
order: 6
title:
  tr: "Heap ve Öncelik Kuyruğu"
  en: "Heaps and Priority Queues"
summary:
  tr: "İkili heap, sift-up/sift-down, heapq ve en büyük k eleman, Dijkstra ile ilişkisi."
  en: "Binary heap, sift-up/sift-down, heapq and top-k, relation to Dijkstra."
durationMinutes: 30
level: intermediate
tags: [algoritmalar, veri-yapilari, heap, oncelik-kuyrugu, heapq]
prerequisites: [l-05-trees-bst, k-05-koleksiyonlar-ve-kopyalama]
concepts: [priority-queue, binary-heap, heap-array-layout, sift-up, sift-down, heapify, heapq, top-k]
---

## Kavram: her zaman en önemlisi önce

Yığın son gelene, kuyruk ilk gelene öncelik verir. Ama gerçek hayatta çoğu zaman sıra, geliş zamanına göre değil **önceliğe** göre belirlenir. Hastanenin acil servisinde kalp krizi geçiren hasta, kendisinden bir saat önce gelmiş burkulmuş bilekli hastadan önce muayene edilir. İşletim sistemi, arka planda çalışan bir yedekleme işinden önce kullanıcının tıkladığı pencereye işlemci zamanı verir. Bir harita uygulaması rota hesaplarken her adımda "şu ana kadar ulaşılması en ucuz olan" kavşağı işler. Bu davranışı sunan soyut veri tipine **öncelik kuyruğu** (priority queue) denir.

Bir öncelik kuyruğundan üç temel işlem bekleriz: yeni eleman eklemek, en öncelikli elemana bakmak ve en öncelikli elemanı çıkarmak. Bunu basit yapılarla da yapabiliriz, ama her birinin bir zayıf yanı vardır. Sırasız bir listede ekleme O(1) sürer ama en küçüğü bulmak için her seferinde tüm listeyi taramak gerekir, yani O(n). Sürekli sıralı tutulan bir listede en küçük eleman hep baştadır ama her eklemede doğru yeri bulup diğer elemanları kaydırmak O(n) sürer. Bir önceki dersteki dengeli ikili arama ağacı her iki işlemi de O(log n)'de yapar ama gerçekleştirmesi karmaşıktır ve bize gerekenden fazlasını, yani tam sıralamayı korur. **İkili heap** tam bu boşluğu doldurur: ekleme ve çıkarma O(log n), en küçüğe bakma O(1) sürer ve tamamen sıradan bir dizinin içinde yaşar.

## İkili heap: şekil ve sıra kuralı

İkili heap iki kuralı aynı anda sağlayan bir ikili ağaçtır:

1. **Şekil kuralı:** Ağaç **tam** (complete) bir ikili ağaçtır. Son seviye dışındaki tüm seviyeler doludur, son seviye de soldan sağa doldurulur. Bu sayede n elemanlı bir heap'in yüksekliği her zaman ⌊log₂ n⌋ olur; dengesizlik diye bir sorun hiç ortaya çıkmaz.
2. **Heap kuralı:** **Min-heap**'te her düğüm çocuklarından küçük ya da onlara eşittir; dolayısıyla en küçük eleman her zaman köktedir. **Max-heap**'te ise tersi geçerlidir.

Burada BST ile önemli bir fark var. BST'de sol ve sağ alt ağaçlar arasında kesin bir sıra vardır; heap'te ise kardeşler arasında hiçbir sıra garantisi yoktur. Heap yalnızca dikey yönde, yani ebeveyn ile çocuk arasında sıra tutar. Bu gevşeklik, heap'in neden bu kadar ucuz olduğunun da cevabıdır: tam sıralamayı korumak zorunda değildir, yalnızca "en küçük tepede" garantisini korur. Bu yüzden heap içinde belirli bir değeri aramak O(n) sürer; heap arama için değil, sürekli en uçtaki elemanı almak için tasarlanmıştır.

### Diziye yerleşim

Tam ikili ağacın en güzel özelliği, hiçbir işaretçiye ihtiyaç duymadan bir diziye sığabilmesidir. Düğümleri seviye seviye, soldan sağa numaralandırıp diziye yazarız. Sıfırdan başlayan indekslerle i indeksindeki bir düğüm için:

- sol çocuk: `2*i + 1`
- sağ çocuk: `2*i + 2`
- ebeveyn: `(i - 1) // 2`

Ağaçta gezinmek basit bir aritmetiğe dönüşür. Elemanlar bellekte yan yana durduğu için işlemci önbelleği de bu yapıyı sever; bu, işaretçili ağaçlara göre pratikte ciddi bir hız farkı yaratır.

:::diagram{src="diagram.svg" alt="Yedi elemanlı bir min-heap'in ağaç görünümü ve aynı elemanların dizideki yerleşimi; indeks okları ebeveyn-çocuk ilişkisini gösteriyor|A seven-element min-heap shown as a tree and as the same elements laid out in an array; index arrows show the parent-child relation"}
Ağaçtaki her seviye dizide ardışık bir parçaya karşılık gelir. 1 indeksli düğümün çocukları 3 ve 4 indekslerindedir.
:::

## Sift-up ve sift-down

Heap'i değiştiren her işlem önce şekil kuralını korur, sonra bozulan heap kuralını tek bir yol boyunca onarır.

**Ekleme (push) ve sift-up:** Yeni eleman dizinin sonuna eklenir; böylece ağaç hâlâ tamdır. Ancak bu eleman ebeveyninden küçük olabilir. Elemanı ebeveyniyle karşılaştırır, küçükse yer değiştiririz ve bunu ya köke ulaşana ya da ebeveyn daha küçük çıkana kadar sürdürürüz. Eleman en fazla ağacın yüksekliği kadar yukarı çıkabileceği için maliyet O(log n)'dir.

**Çıkarma (pop) ve sift-down:** En küçük eleman köktedir. Onu çıkarmak için dizinin son elemanını köke taşırız ve diziyi bir kısaltırız; ağaç yine tamdır. Kökteki bu eleman muhtemelen çok büyüktür. Onu iki çocuğundan **küçük olanla** karşılaştırırız ve gerekiyorsa yer değiştiririz. Daha küçük çocuğu seçmek şarttır; aksi hâlde yukarı taşınan çocuk kardeşinden büyük olur ve heap kuralı bozulur. Eleman yaprağa ulaşana ya da iki çocuğundan da küçük olana kadar aşağı iner. Bu da O(log n) sürer.

**Heapify:** Elinde hazır n elemanlı bir dizi varsa, onları tek tek ekleyerek O(n log n) sürede heap kurabilirsin. Ama daha akıllı bir yol var: son iç düğümden başlayıp köke doğru her düğüm için sift-down çalıştırmak. Düğümlerin yarısı yapraktır ve hiç hareket etmez, dörtte biri en fazla bir seviye iner, sekizde biri en fazla iki seviye iner. Bu toplamın matematiksel sonucu O(n)'dir. Python'un `heapq.heapify` fonksiyonu tam olarak bunu yapar; bu yüzden hazır bir listeyi heap'e çevirmek, onu sıralamaktan daha ucuzdur.

Aşağıdaki sahnede bir push ve bir pop işlemini hem ağaç hem dizi görünümünde adım adım izleyebilirsin; her takasın
dizide hangi iki indeksi değiştirdiğine dikkat et.

:::animation{scene="sift-up-down.scene.json"}
push sona ekleyip yukarı kaydırır, pop son elemanı köke taşıyıp küçük çocukla aşağı kaydırır.
:::

:::code{lang="python" title="Elle yazılmış min-heap: sift-up ve sift-down"}
```python
class MinHeap:
    def __init__(self):
        self.veri = []

    def push(self, x):
        self.veri.append(x)                      # şekil kuralı: sona ekle
        i = len(self.veri) - 1
        while i > 0:                             # sift-up
            ebeveyn = (i - 1) // 2
            if self.veri[i] >= self.veri[ebeveyn]:
                break
            self.veri[i], self.veri[ebeveyn] = self.veri[ebeveyn], self.veri[i]
            i = ebeveyn

    def pop(self):
        en_kucuk = self.veri[0]
        son = self.veri.pop()
        if self.veri:
            self.veri[0] = son                   # son elemanı köke taşı
            self._sift_down(0)
        return en_kucuk

    def _sift_down(self, i):
        n = len(self.veri)
        while True:
            sol, sag, kucuk = 2 * i + 1, 2 * i + 2, i
            if sol < n and self.veri[sol] < self.veri[kucuk]:
                kucuk = sol
            if sag < n and self.veri[sag] < self.veri[kucuk]:
                kucuk = sag
            if kucuk == i:
                return
            self.veri[i], self.veri[kucuk] = self.veri[kucuk], self.veri[i]
            i = kucuk
```
```ts
export class MinHeap {
  private data: number[] = [];

  push(x: number): void {
    this.data.push(x);
    let i = this.data.length - 1;
    while (i > 0) {
      const parent = (i - 1) >> 1;
      if (this.data[i] >= this.data[parent]) break;
      [this.data[i], this.data[parent]] = [this.data[parent], this.data[i]];
      i = parent;
    }
  }

  pop(): number | undefined {
    if (this.data.length === 0) return undefined;
    const top = this.data[0];
    const last = this.data.pop()!;
    if (this.data.length > 0) {
      this.data[0] = last;
      let i = 0;
      const n = this.data.length;
      for (;;) {
        const l = 2 * i + 1, r = 2 * i + 2;
        let m = i;
        if (l < n && this.data[l] < this.data[m]) m = l;
        if (r < n && this.data[r] < this.data[m]) m = r;
        if (m === i) break;
        [this.data[i], this.data[m]] = [this.data[m], this.data[i]];
        i = m;
      }
    }
    return top;
  }
}
```
:::

## Python'da heapq

Gerçek kodda heap'i kendin yazmazsın. Python'un standart kütüphanesindeki `heapq` modülü, sıradan bir `list` üzerinde çalışan fonksiyonlar sunar: `heappush(liste, x)`, `heappop(liste)`, `heapify(liste)`, kökü değiştiren `heapreplace` ve `heappushpop`, ayrıca `nlargest` ile `nsmallest`. Ayrı bir sınıf yoktur; liste, heap kuralına uyduğun sürece heap'tir. Yani listeye doğrudan `append` yaparsan ya da listeyi elle değiştirirsen heap kuralını sessizce bozarsın.

`heapq` her zaman **min-heap**'tir. Max-heap gerektiğinde iki yaygın yöntem vardır: sayıları eksi işaretiyle saklamak (`heappush(h, -x)`, çıkarırken tekrar eksi ile çarpmak) ya da karşılaştırması ters çalışan bir sarmalayıcı sınıf kullanmak. Öncelikli işler saklarken elemanları `(oncelik, sira_no, is)` biçiminde demet olarak eklemek de yaygındır. Python demetleri soldan sağa karşılaştırır; iki işin önceliği eşitse artan sıra numarası devreye girer ve karşılaştırılamayan `is` nesnelerine hiç ulaşılmaz. Aynı zamanda eşit öncelikliler ekleniş sırasıyla çıkar.

## En büyük k eleman

Heap'in en sık kullanıldığı mülakat sorularından biri "bir akıştaki en büyük k elemanı bul" sorusudur. Akla gelen ilk çözüm tüm veriyi sıralayıp son k elemanı almaktır; bu O(n log n) zaman ve O(n) bellek ister. Peki veri milyarlarca satırdan oluşuyorsa ya da hiç bitmeyen bir akış hâlinde geliyorsa?

Hile, ters görünen bir seçimdir: en büyük k eleman için **k boyutlu bir min-heap** tutarız. Heap'in kökünde, şimdiye kadar gördüğümüz en büyük k elemanın en küçüğü durur; yani kök, "ilk k'ya girmek için aşılması gereken baraj"dır. Yeni gelen sayı bu barajdan küçükse onu hiç düşünmeden atarız. Büyükse kökü çıkarır, yeni sayıyı ekleriz. Her eleman en fazla bir O(log k) işlem yaptığı için toplam maliyet O(n log k), bellek ise yalnızca O(k) olur. k küçük olduğunda bu, sıralamadan çok daha hızlıdır ve veri belleğe sığmasa bile çalışır.

:::trace{src="en-buyuk-k.trace.json" title="heapq ile en büyük k eleman|Top-k largest with heapq"}
`heap` listesinin her adımdaki düzenine bak: ilk eleman (`heap[0]`) her zaman listedeki en küçük sayıdır. Barajı aşamayan sayıların heap'e hiç girmediğine dikkat et.
:::

:::callout{tone="warning" title="heap[0] dışındaki sıraya güvenme"}
`heapq` ile tutulan bir listeyi yazdırdığında elemanlar sıralı görünmez; yalnızca `heap[0]` en küçüktür. Sıralı sonuç istiyorsan elemanları tek tek `heappop` ile çıkar ya da en sonda `sorted` çağır. Ayrıca bir elemanın önceliğini yerinde değiştirmek heap kuralını bozar; yeni bir kayıt ekleyip eskisini "geçersiz" diye işaretlemek yaygın çözümdür.
:::

## Dijkstra ile ilişkisi

Öncelik kuyruğunun en ünlü kullanıcılarından biri, bir sonraki derste ayrıntısıyla göreceğimiz **Dijkstra en kısa yol algoritmasıdır**. Dijkstra her adımda, başlangıca olan geçici uzaklığı en küçük olan ve henüz kesinleşmemiş düğümü seçer, sonra onun komşularının uzaklıklarını günceller. "Her adımda en küçüğü seç" cümlesi, bir min-heap'in tanımıdır. Heap'e `(uzaklik, dugum)` demetleri koyarız; bir düğüme daha kısa bir yol bulduğumuzda eski kaydı silmek yerine yeni bir kayıt ekleriz ve heap'ten çıkan eski kayıtları "zaten kesinleşti" kontrolüyle atlarız. Bu yöntemle algoritmanın maliyeti V düğüm ve E kenar için O((V + E) log V) olur; heap yerine her seferinde listeyi tarasaydık O(V²) olurdu ve büyük, seyrek yol ağlarında bu fark dakikalar ile milisaniyeler arasındaki farktır.

Aynı desen başka yerlerde de karşına çıkar: k tane sıralı listeyi birleştirmek (her listenin baş elemanı heap'e girer), bir akışta sürekli medyan bulmak (bir max-heap ve bir min-heap birlikte), zamanlayıcıları ve gecikmeli işleri saklamak (en yakın zamanlı iş kökte) ya da Huffman kodlamasında en düşük frekanslı iki düğümü birleştirmek. Hepsinde soru aynıdır: "Şu anda en küçük ya da en büyük olan hangisi?" Bu soruyu tekrar tekrar ve ucuza sorman gerekiyorsa cevabın heap'tir.

## Karmaşıklık özeti ve doğru yapıyı seçmek

İkili heap'in maliyetlerini bir arada görelim: en küçüğe bakmak O(1), ekleme ve çıkarma O(log n), hazır bir diziden heap kurmak O(n), belirli bir değeri aramak ise O(n). Heap ile tüm elemanları sırayla çıkarırsan O(n log n) sürede sıralı bir dizi elde edersin; bu, **heap sort** algoritmasıdır ve ek bellek gerektirmeden yerinde çalışır. Sıralama dersinde onu diğer algoritmalarla karşılaştıracağız.

Seçim yaparken şu soruyu sor: tüm sıraya mı ihtiyacım var, yoksa yalnızca uçtaki elemana mı? Elemanları sırayla gezmen, aralık sorgusu yapman ya da herhangi bir elemanı silmen gerekiyorsa dengeli ağaç ya da sıralı yapı daha uygundur. Yalnızca "sıradaki en öncelikli iş hangisi?" sorusunu soruyorsan heap hem daha basit hem daha hızlıdır. Tek seferlik bir soru için ise heap kurmaya bile gerek yoktur; `min(liste)` tek geçişte O(n) sürede cevap verir.

:::realworld{company="Getir"}
Getir gibi dakikalar içinde teslimat vaat eden hızlı market uygulamalarında, siparişleri hazırlayan depo personeli ve kuryeler için iş sırası sabit bir "ilk gelen ilk çıkar" kuyruğu değildir. Genel bilgi düzeyinde bakıldığında, bu tür sistemlerde her siparişe vaat edilen teslim süresine kalan zaman, siparişin büyüklüğü ve kuryenin konumu gibi etkenlere göre bir öncelik hesaplanır ve bir sonraki iş, en acil olan seçilerek atanır. Bu, öncelik kuyruğunun klasik kullanımıdır: yeni siparişler sürekli eklenir, en acil olan sürekli çıkarılır ve her iki işlemin de büyük hacimde ucuz olması gerekir. Rota planlamasında ise depo ile adres arasındaki en kısa yolu bulan Dijkstra benzeri algoritmalar yine heap tabanlı bir öncelik kuyruğuna dayanır.
:::

:::realworld{company="OSRM"}
Açık kaynaklı yönlendirme motoru OSRM (Open Source Routing Machine), OpenStreetMap verisi üzerinde araç, bisiklet ve
yaya rotası hesaplar ve kıta ölçeğindeki haritalarda bile sorguları çok hızlı yanıtlamak için tasarlanmıştır. Proje
belgelerinde iki ön işleme yöntemi anlatılır: Contraction Hierarchies (CH) ve Multi-Level Dijkstra (MLD). İkisinde de
ağır iş sorgudan önce yapılır: yol ağı, sorgu sırasında taranması gereken düğüm sayısını büyük ölçüde azaltan
kısayollar ya da bölümlerle zenginleştirilir. Sorgu anında çalışan ise bu derste gördüğün mekanizmadır: başlangıçtan
ve hedeften yayılan Dijkstra tarzı bir arama, sıradaki düğümü bir öncelik kuyruğundan (heap) en küçük mesafeyle çeker
ve bir komşunun mesafesi kısaldığında onun kuyruktaki önceliğini günceller. Ön işleme aranacak alanı küçültür; heap
ise kalan aramanın her adımda doğru düğümü O(log n) sürede seçmesini sağlar. Kısacası büyük ölçekli yönlendirme
sistemlerinin içinde de `heappush` ve `heappop`'un yakın akrabaları çalışır.
:::

:::callout{tone="tip" title="Mülakat ipucu"}
- "En büyük k" sorusunda boyutu k olan bir **min-heap**, "en küçük k" sorusunda boyutu k olan bir **max-heap** kullan; karmaşıklığı O(n log k) olarak ifade et ve neden O(n log n)'den iyi olduğunu açıkla.
- Python'da max-heap için sayıları negatif sakladığını ve eşit önceliklerde `(oncelik, sira_no, nesne)` demetiyle karşılaştırma hatasından kaçındığını söylemek, dili iyi bildiğini gösterir.
- "Heapify neden O(n)?" sorusuna "düğümlerin çoğu ağacın altında ve çok az iner" diye sezgisel bir cevap vermek genellikle yeterlidir.
:::

:::quiz{src="quiz.json"}
:::

:::next{lesson="l-07-graphs-bfs-dfs"}
Sırada: graflar, BFS ve DFS ile gezinti, topolojik sıralama ve öncelik kuyruğunun sahneye çıktığı Dijkstra en kısa yol algoritması.
:::

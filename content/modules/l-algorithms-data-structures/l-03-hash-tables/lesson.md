---
id: l-03-hash-tables
slug: hash-tables
module: l-algorithms-data-structures
order: 3
title:
  tr: "Hash Tabloları"
  en: "Hash Tables"
summary:
  tr: "Hash fonksiyonu, kova, çakışma çözümü (zincirleme, açık adresleme), yük faktörü ve yeniden boyutlama; interaktif hash tablosu."
  en: "Hash functions, buckets, collision resolution (chaining, open addressing), load factor and resizing; interactive hash table."
durationMinutes: 30
level: intermediate
tags: [algoritmalar, veri-yapilari, hash, dict, set]
prerequisites: [l-02-arrays-strings-two-pointers, k-05-koleksiyonlar-ve-kopyalama]
concepts: [hash-function, bucket, collision, chaining, open-addressing, load-factor, resizing, hashable-keys]
---

## Kavram: anahtardan adrese tek adımda

Önceki derste dizilerin gücünü gördük: indeksi bildiğin sürece `dizi[i]` işlemi tek adımda, O(1) sürede biter, çünkü bilgisayar elemanın adresini basit bir çarpma ve toplama ile hesaplar. Sorun şu ki gerçek hayatta verilere çoğu zaman sayısal bir indeksle değil, bir **anahtarla** ulaşmak isteriz: bir kullanıcı adı, bir ürün kodu, bir e-posta adresi ya da bir kelime. "ayse@ornek.com kullanıcısının kaydı nerede?" sorusunu sıralı olmayan bir dizide cevaplamak için elemanları tek tek gezmen gerekir; bu da O(n) demektir. Milyonlarca kayıtta her sorgu için milyonlarca karşılaştırma kabul edilemez.

**Hash tablosu** bu problemi zekice bir hileyle çözer: anahtarı bir **hash fonksiyonuna** verip bir tamsayıya dönüştürür, bu tamsayıyı da dizinin boyutuna göre küçültüp bir **kova** (bucket) indeksi elde eder. Böylece anahtar doğrudan bir dizi konumuna çevrilmiş olur. Ekleme, arama ve silme işlemleri ortalamada O(1) sürer. Python'daki `dict` ve `set`, Java'daki `HashMap`, JavaScript'teki `Map` ve nesneler, Go'daki `map` hep bu fikrin uygulamalarıdır. Yazılım mühendisliğinde belki de en sık kullanılan veri yapısıdır; mülakatlarda "bunu daha hızlı yapabilir misin?" sorusunun cevabı da çoğu zaman "bir hash tablosu kullanırım" olur.

Süreç üç adımdan oluşur:

1. **Hash hesapla:** `h = hash(anahtar)` — anahtar ne olursa olsun bir tamsayı üretilir.
2. **Kovaya indir:** `indeks = h % kova_sayisi` — tamsayı dizinin sınırlarına sığdırılır.
3. **Kovada işlem yap:** değeri yaz, oku ya da sil. Kovada başka anahtar da varsa (çakışma), aşağıda göreceğimiz yöntemlerden biriyle çözülür.

:::diagram{src="diagram.svg" alt="Anahtarların hash fonksiyonundan geçip 8 kovalı bir diziye yerleşmesi; bir kovada zincirleme ile çakışma|Keys passing through a hash function into an 8-bucket array; a collision resolved by chaining in one bucket"}
"elma" ve "kiraz" aynı kovaya düşüyor: zincirleme yönteminde kova küçük bir liste tutar.
:::

## İyi bir hash fonksiyonu nasıl olmalı?

Hash fonksiyonu tablonun kalbidir ve üç özelliği taşımalıdır. Birincisi **deterministik** olmalıdır: aynı anahtar her çağrıda aynı sayıyı üretmelidir, aksi hâlde yazdığın değeri bir daha bulamazsın. İkincisi **hızlı** olmalıdır; her işlemde çalıştığı için yavaş bir hash fonksiyonu O(1) vaadini anlamsız kılar. Üçüncüsü anahtarları kovalara **düzgün dağıtmalıdır**: birbirine çok benzeyen anahtarlar bile ("kullanici1", "kullanici2") farklı kovalara savrulmalıdır. Kötü bir fonksiyon, örneğin yalnızca stringin ilk harfine bakan bir fonksiyon, "a" ile başlayan tüm kelimeleri aynı kovaya yığar ve tablo fiilen bir bağlı listeye dönüşür.

Burada önemli bir ayrımı da yapalım: hash tablolarında kullanılan hash fonksiyonları ile parola saklamak için kullanılan kriptografik hash fonksiyonları (SHA-256, bcrypt) farklı amaçlara hizmet eder. Tablo için hız ve dağılım yeterlidir; kriptografik fonksiyonlar ise kasten yavaş ve geri döndürülemez tasarlanır. Python, string hash'lerini her süreç başlangıcında rastgele bir tohumla karıştırır (hash randomization). Böylece saldırgan, sunucuna aynı kovaya düşen binlerce anahtar göndererek tabloyu O(n)'e düşüremez. Bu yüzden `hash("elma")` değeri programı her çalıştırdığında farklı çıkar; ama tek bir çalışma boyunca sabittir.

## Çakışma: kaçınılmaz bir misafir

Anahtar uzayı (olası tüm stringler) sonsuzdur, kova sayısı ise sınırlıdır. Güvercin yuvası ilkesine göre iki farklı anahtarın aynı kovaya düşmesi kaçınılmazdır; buna **çakışma** (collision) denir. Doğum günü paradoksu bunun beklediğimizden çok daha erken olduğunu söyler: 365 kovalı bir tabloya yalnızca 23 anahtar koyduğunda en az bir çakışma olma ihtimali yüzde elliyi geçer. Dolayısıyla soru "çakışma olur mu?" değil, "çakışma olduğunda ne yapacağız?" sorusudur. İki ana yaklaşım vardır.

### Zincirleme (separate chaining)

Her kova tek bir değer yerine küçük bir liste (ya da bağlı liste) tutar. Aynı kovaya düşen anahtarlar bu listeye eklenir. Arama yaparken önce kovayı buluruz, sonra kovadaki kısa listeyi tek tek gezip anahtarı eşitlikle karşılaştırırız. Uygulaması basittir, tablo dolmaya yaklaşsa bile çalışmaya devam eder ve silme işlemi kolaydır. Dezavantajı, her düğüm için ek bellek ve işaretçi takibi gerektirmesidir; bu da işlemcinin önbelleğini (cache) verimsiz kullanır. Java'nın `HashMap` sınıfı zincirlemeyi kullanır ve bir kovadaki zincir sekiz elemanı aşarsa onu dengeli bir ağaca dönüştürerek en kötü durumu O(log n) ile sınırlar.

### Açık adresleme (open addressing)

Tüm elemanlar doğrudan dizinin içinde tutulur. Hedef kova doluysa, belirli bir kurala göre başka bir kova denenir: **doğrusal yoklamada** (linear probing) bir sonraki kovaya, **karesel yoklamada** 1, 4, 9 adım ötedeki kovalara, **çift hash'lemede** ise ikinci bir hash fonksiyonunun belirlediği adım kadar ileriye bakılır. Arama sırasında boş bir kovaya rastlayana kadar aynı yolu izleriz. Bellekte ardışık durduğu için önbellek dostudur ve ek işaretçi gerektirmez. Ancak tablo dolmaya yaklaştıkça yoklama zincirleri hızla uzar; doğrusal yoklamada dolu kovaların yan yana kümelenmesi (primary clustering) performansı düşürür. Silme de zordur: bir elemanı silip kovayı tamamen boşaltırsan, ondan sonra yerleşmiş elemanların arama yolu kopar. Bu yüzden silinen yere "mezar taşı" (tombstone) işareti bırakılır. CPython'un `dict` yapısı açık adresleme kullanır ve yoklama sırasını hash'in yüksek bitlerini de karıştıran sahte rastgele bir formülle belirler.

## Yük faktörü ve yeniden boyutlama

Bir hash tablosunun ne kadar dolu olduğunu **yük faktörü** (load factor) ölçer: `α = eleman_sayısı / kova_sayısı`. Yük faktörü küçükken kovaların çoğu boştur ve çakışma nadirdir; büyüdükçe zincirler uzar ya da yoklamalar artar. Bu yüzden tablolar bir eşik belirler: Java `HashMap` için varsayılan eşik 0,75'tir, CPython `dict` yaklaşık üçte iki doluluğa ulaştığında büyür. Eşik aşıldığında tablo **yeniden boyutlanır** (resize/rehash): genellikle iki katı büyüklükte yeni bir dizi ayrılır ve tüm elemanlar yeni kova sayısına göre baştan hash'lenip yerleştirilir. Kova sayısı değiştiği için `h % kova_sayisi` sonucu da değişir; elemanları eski yerlerinden kopyalamak yetmez.

Yeniden boyutlama tek başına O(n) süren pahalı bir işlemdir. Peki nasıl oluyor da eklemenin O(1) olduğunu söyleyebiliyoruz? Cevap, dinamik dizilerde gördüğümüz **amortize analizdir**. Tablo her seferinde iki katına çıktığı için pahalı yeniden boyutlamalar giderek seyrekleşir; n ekleme boyunca yapılan toplam kopyalama işi 1 + 2 + 4 + … + n ≈ 2n olur. Bu maliyeti n eklemeye paylaştırınca her ekleme için sabit bir ek yük kalır. Yine de gecikmeye çok duyarlı sistemlerde (ör. düşük gecikmeli bir oyun sunucusu) tek bir eklemenin aniden milisaniyeler sürmesi sorun olabilir; Redis gibi sistemler bu yüzden yeniden hash'lemeyi tek seferde değil, her işlemde birkaç kovayı taşıyarak **kademeli** yapar.

:::interactive{type="hash-table" buckets=8 collision="chaining" loadFactor=0.75}
"Ekle" ya da "Rastgele ekle" ile anahtarlar ekleyin ve işlem günlüğünde her anahtarın hash değerini ve düştüğü kovayı izleyin. Aynı kovaya iki anahtar düştüğünde zincirin nasıl uzadığına ve çakışma sayacının arttığına bakın; yük faktörü 0,75 sınırını aştığında kova sayısının iki katına çıkıp anahtarların yeniden dağıtıldığını gözlemleyin. "Ara" ve "Sil" ile birkaç anahtarı deneyin, sonra çakışma çözümünü doğrusal sondalamaya (açık adresleme) çevirip aynı anahtarları tekrar ekleyin.
:::

## Python'da dict ve set

Python'da hash tablosunu çoğu zaman sıfırdan yazmazsın; `dict` ve `set` zaten son derece optimize edilmiştir. `dict` anahtar-değer çiftleri tutar, `set` ise yalnızca anahtarları. İkisi de üyelik testini (`x in s`) ortalama O(1) sürede yapar; aynı test bir listede O(n) sürer. Aşağıdaki iz iki klasik kullanım kalıbını gösteriyor: "daha önce gördüklerini hatırla" kalıbıyla iki toplam problemi ve sayaç kalıbıyla kelime frekansı. Her adımda heap'teki sözlüğün nasıl büyüdüğünü takip et.

:::trace{src="dict-kullanimi.trace.json" title="dict ile iki toplam ve kelime sayma|Two-sum and word counting with dict"}
Döngünün her turunda önce eksik sayının sözlükte olup olmadığına bakılıyor, sonra mevcut sayı sözlüğe yazılıyor.
:::

Python 3.7'den itibaren `dict` ekleme sırasını korur. Bunu mümkün kılan da CPython'un iki parçalı tasarımıdır: küçük bir indeks dizisi (asıl hash tablosu) ve elemanların ekleme sırasıyla durduğu ayrı, sıkı bir giriş dizisi. Bu tasarım hem belleği azaltır hem de sözlükte gezinirken eklenme sırasını verir. Ancak bunu bir "sıralı yapı" gibi düşünme: sıralama ya da aralık sorgusu gerekiyorsa (ör. "100 ile 200 arasındaki anahtarlar") hash tablosu yanlış araçtır; o iş için sıralı dizi ya da dengeli ağaç gerekir.

Hangi nesneler anahtar olabilir? Yalnızca **hashable** olanlar: `int`, `str`, `float`, `tuple` (içindekiler de hashable ise), `frozenset` ve `__hash__` tanımlayan kendi sınıfların. `list`, `dict` ve `set` anahtar olamaz, çünkü değiştirilebilirler. Bir listeyi anahtar yapıp sonra içine eleman eklesen, hash'i değişir ve listen artık yanlış kovada durur; onu bir daha asla bulamazsın. Kendi sınıfında `__eq__` metodunu tanımlıyorsan `__hash__` ile tutarlı olmasına dikkat et: eşit iki nesnenin hash'i de eşit olmalıdır. Tersi gerekmez; farklı nesnelerin aynı hash'e sahip olması sadece çakışmadır.

:::code{lang="python" title="Zincirlemeli basit bir hash tablosu"}
```python
class HashTablosu:
    def __init__(self, kova_sayisi=8, esik=0.75):
        self.kovalar = [[] for _ in range(kova_sayisi)]
        self.boyut = 0
        self.esik = esik

    def _kova(self, anahtar):
        return self.kovalar[hash(anahtar) % len(self.kovalar)]

    def koy(self, anahtar, deger):
        kova = self._kova(anahtar)
        for i, (k, _) in enumerate(kova):
            if k == anahtar:           # anahtar zaten var: güncelle
                kova[i] = (anahtar, deger)
                return
        kova.append((anahtar, deger))  # çakışma olsa bile zincire ekle
        self.boyut += 1
        if self.boyut / len(self.kovalar) > self.esik:
            self._buyut()

    def al(self, anahtar):
        for k, v in self._kova(anahtar):
            if k == anahtar:
                return v
        raise KeyError(anahtar)

    def _buyut(self):
        eski = self.kovalar
        self.kovalar = [[] for _ in range(len(eski) * 2)]
        for kova in eski:              # tüm anahtarlar yeniden hash'lenir
            for k, v in kova:
                self._kova(k).append((k, v))
```
:::

:::callout{tone="warning" title="O(1) bir ortalamadır, garanti değil"}
Hash tablosu işlemleri **ortalama** O(1), **en kötü durumda** O(n) sürer. Tüm anahtarlar aynı kovaya düşerse (kötü hash fonksiyonu ya da kasıtlı saldırı) her arama tüm zinciri gezer. 2011'de birçok web çerçevesinde, aynı hash'e sahip binlerce form alanı gönderilerek sunucuları kilitleyen "hash flooding" açığı bulundu; Python'un hash randomization özelliği bu olaydan sonra varsayılan hâle geldi.
:::

## Hash tablosu ne zaman doğru seçim?

Hash tablosu bir sorguda "bu anahtar var mı, değeri ne?" sorusunu cevaplıyorsan neredeyse her zaman doğru seçimdir. Tekrar eden elemanları bulmak, bir listedeki benzersiz değerleri saymak, iki koleksiyonun kesişimini almak, frekans tablosu çıkarmak, önbellek (cache) kurmak, bir graf düğümünün komşularını tutmak ve veritabanı birleştirmelerindeki *hash join* işlemi bunun tipik örnekleridir. Bu kalıpların ortak noktası, iç içe iki döngüyle O(n²) sürecek bir işi, ekstra O(n) bellek harcayarak O(n) süreye indirmesidir. Bu, algoritmalardaki en temel **zaman-bellek takasıdır**.

Öte yandan hash tablosunun zayıf olduğu durumları da bilmek gerekir. Sıralı gezinme, en küçük ya da en büyük elemanı bulma, aralık sorguları ve "bu değerden hemen büyük olan" gibi komşuluk sorguları için hash tablosu hiçbir avantaj sağlamaz; anahtarların sırası rastgeledir. Ayrıca çok küçük koleksiyonlarda (birkaç eleman) hash hesaplamanın sabit maliyeti, basit bir listeyi taramaktan daha pahalı olabilir. Bellek de bedavaya gelmez: boş kovalar ve yük faktörü payı yüzünden bir hash tablosu aynı veriyi tutan sıkı bir diziden belirgin biçimde fazla yer kaplar.

Dağıtık sistemlere geçtiğinde aynı fikir bir kez daha karşına çıkacak: verileri sunuculara `hash(anahtar) % sunucu_sayisi` ile dağıtmak, sunucu sayısı değişince neredeyse tüm anahtarların yer değiştirmesine yol açar. Bu, tek makinedeki yeniden boyutlamanın ağ üzerindeki karşılığıdır ve *consistent hashing* tekniğiyle çözülür. Yani bu derste öğrendiğin kova, çakışma ve yeniden dağıtım kavramları, sistem tasarımı mülakatlarında da doğrudan işine yarayacak.

:::realworld{company="Trendyol"}
Trendyol gibi milyonlarca ürün ve satıcıyı barındıran bir e-ticaret platformunda, ürün detay sayfası her açıldığında fiyat, stok ve kampanya bilgisinin veritabanına gitmeden getirilmesi gerekir. Bu tür platformlar, genel olarak Redis ve Couchbase gibi anahtar-değer depolarını önbellek katmanı olarak kullanır; bu sistemlerin kalbinde de ürün kimliğini doğrudan bir bellek konumuna çeviren hash tabloları vardır. Aynı fikir sepet servisinde (kullanıcı kimliği → sepet), oturum yönetiminde (token → kullanıcı) ve kampanya dönemlerinde tekrarlanan isteklerin ayıklanmasında (istek kimliği → sonuç) karşımıza çıkar. Büyük indirim günlerinde trafik katlanırken bu sorguların O(1) kalması, sayfaların hızlı açılmasının temel nedenlerinden biridir.
:::

:::callout{tone="tip" title="Mülakat ipucu"}
- İç içe iki döngüyle çözdüğün bir problemde ilk soracağın soru şu olsun: "Daha önce gördüğüm değerleri bir `set` ya da `dict` içinde hatırlarsam ikinci döngüden kurtulur muyum?" Two-sum, ilk tekrar eden karakter, anagram gruplama gibi soruların hepsi bu kalıptır.
- Karmaşıklığı söylerken "ortalama O(1), en kötü O(n)" ayrımını yap ve ekstra O(n) belleği belirt.
- Anahtar olarak liste kullanman gerekiyorsa `tuple`'a çevir; anagram gruplamada `tuple(sorted(kelime))` klasik bir anahtardır.
:::

:::quiz{src="quiz.json"}
:::

:::next{lesson="l-04-stacks-queues"}
Sırada: verileri ekleme sırasına göre yöneten iki basit ama güçlü yapı, yığın ve kuyruk.
:::

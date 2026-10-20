---
id: l-09-binary-search
slug: binary-search
module: l-algorithms-data-structures
order: 9
title:
  tr: "İkili Arama ve Varyantları"
  en: "Binary Search and Its Variants"
summary:
  tr: "Sıralı veride O(log n) arama, alt/üst sınır, cevap üzerinde ikili arama ve sık hatalar."
  en: "O(log n) search on sorted data, lower/upper bound, binary search on the answer and common bugs."
durationMinutes: 30
level: intermediate
tags: [algoritmalar, ikili-arama, arama, python, mulakat]
prerequisites: [l-08-sorting, k-04-kosullar-ve-donguler]
concepts: [binary-search, loop-invariant, lower-bound, upper-bound, bisect, binary-search-on-answer, off-by-one]
---

## Kavram: her adımda yarısını çöpe atmak

Telefon rehberinde "Yılmaz" soyadını aradığını düşün. Rehberi ilk sayfadan başlayıp tek tek çevirmezsin; ortalardan bir yerden açarsın, gördüğün isim "Kaya" ise aradığının daha ileride olduğunu bilirsin ve rehberin ilk yarısını aklından tamamen silersin. Sonra kalan kısmın ortasını açarsın ve bu böyle sürer. Bu sezgisel davranışın adı **ikili arama**dır (binary search): sıralı bir koleksiyonda, her karşılaştırmada aday kümesini yarıya indiren arama yöntemi.

Doğrusal aramada (linear search) bir milyon elemanlık listede kötü durumda bir milyon karşılaştırma yaparsın. İkili aramada ise her adım aday sayısını ikiye böldüğü için en fazla yaklaşık log₂(1.000.000) ≈ 20 karşılaştırma yeterlidir. Bir milyardan bir trilyona çıksan bile adım sayısı yalnızca 30'dan 40'a yükselir. Big-O dersinde O(log n) eğrisinin neredeyse yatay göründüğünü görmüştük; ikili arama o eğrinin en bilinen temsilcisidir.

Ancak bu hızın bir bedeli vardır: **veri sıralı olmalıdır** ya da en azından aradığın özellik bakımından "monoton" olmalıdır. Sıralama dersinde gördüğümüz gibi sıralamanın kendisi O(n log n) sürer. Bu yüzden tek bir arama için sıralamak çoğu zaman kârlı değildir; ama aynı veride çok sayıda arama yapılacaksa bir kez sıralayıp sonra her aramayı logaritmik sürede yapmak büyük kazanç sağlar. Veritabanı indeksleri, sözlük yapıları ve sürüm geçmişinde hata avlamak gibi pek çok gerçek problem bu takasa dayanır.

:::diagram{src="diagram.svg" alt="Sekiz elemanlı sıralı dizide 31 değerinin üç adımda bulunması; her adımda sol, orta ve sağ işaretçileri ve elenen yarılar|Finding 31 in an eight-element sorted array in three steps; left, middle and right pointers and the discarded halves at each step"}
Her satır bir turu gösterir: gri hücreler elenen adaylardır, vurgulu hücre ortadaki karşılaştırmadır.
:::

## Döngü değişmezi: ikili aramayı doğru yazmanın anahtarı

İkili arama fikir olarak çok basittir ama doğru yazmak şaşırtıcı derecede zordur. Programlama tarihinin ünlü bir gözlemi, ilk ikili arama yayımlandıktan sonra hatasız bir sürümünün yayımlanmasının yıllar aldığıdır. Hataların neredeyse tamamı sınırlarda saklanır: `<` mi `<=` mi, `orta` mı `orta - 1` mi, döngü bittiğinde hangi değişken cevabı tutar?

Bu karmaşayı çözmenin yolu bir **döngü değişmezi** (loop invariant) seçip ona sadık kalmaktır. Değişmez, döngünün her turunun başında doğru olan bir cümledir. Klasik aramada değişmezimiz şudur: "Hedef dizide varsa, indeksi kapalı aralık `[sol, sag]` içindedir." Başlangıçta `sol = 0` ve `sag = len(dizi) - 1` seçeriz, yani tüm dizi adaydır. Ortadaki değer hedeften küçükse hedef ortanın solunda olamaz; ortanın kendisi de hedef değildir, bu yüzden `sol = orta + 1` yazarız. Büyükse aynı mantıkla `sag = orta - 1`. Aralık kapalı olduğu için `sol == sag` olduğunda hâlâ bir aday vardır; döngü koşulu bu yüzden `sol <= sag` olmalıdır. `sol > sag` olduğunda aralık boşalmıştır ve hedefin dizide olmadığını kesin olarak söyleyebiliriz.

Aşağıdaki izde bu mantığı satır satır izleyebilirsin. Önce var olan bir değeri (31), sonra olmayan bir değeri (20) arıyoruz. İkinci aramada aralığın nasıl daralıp sonunda boşaldığına özellikle dikkat et.

:::trace{src="klasik-ikili-arama.trace.json" title="Klasik ikili arama: kapalı aralık [sol, sag]|Classic binary search: closed range [sol, sag]"}
Her turda `sol`, `orta` ve `sag` değişkenlerini izle; aradaki fark her seferinde yaklaşık yarıya iner.
:::

:::callout{tone="warning" title="Taşma ve sonsuz döngü"}
Java, C++ gibi sabit genişlikli tamsayı kullanan dillerde `(sol + sag) / 2` çok büyük dizilerde taşabilir; güvenli biçim `sol + (sag - sol) / 2` ifadesidir. Python'da tamsayılar taşmaz ama başka bir tuzak her dilde geçerlidir: güncellemede ortayı elemezsen (ör. kapalı aralıkta `sol = orta`) iki elemanlı bir aralıkta `orta` hep aynı kalır ve döngü sonsuza kadar döner.
:::

## Alt sınır ve üst sınır: "ilk" ve "son" sorusu

Gerçek problemlerde çoğu zaman "bu değer var mı?" sorusundan daha zengin sorular sorarız. Sıralı bir not listesinde 55 alan ilk öğrenci hangi sırada? 55 alan kaç kişi var? 60 notunu sıralamayı bozmadan nereye eklemeliyim? Klasik ikili arama, değer birden fazla kez geçtiğinde bunlardan **herhangi birini** döndürebilir; bu sorular için yeterli değildir.

Burada iki temel varyant devreye girer:

- **Alt sınır (lower bound):** Değeri hedeften *küçük olmayan* (yani `>= hedef`) ilk elemanın indeksi.
- **Üst sınır (upper bound):** Değeri hedeften *büyük* (yani `> hedef`) ilk elemanın indeksi.

Bu ikisi elinde olduğunda pek çok soru tek satıra iner. Hedefin kaç kez geçtiği `ust_sinir - alt_sinir` farkıdır. Hedef yoksa iki sınır aynı yeri gösterir ve bu yer, değerin sıralamayı bozmadan ekleneceği konumdur. Tamsayılarda üst sınırı ayrıca yazmana bile gerek yoktur: `hedef + 1` için alt sınır, `hedef` için üst sınırla aynıdır.

Alt sınırı yazarken değişmezi biraz değiştiririz ve **yarı açık aralık** `[sol, sag)` kullanırız. Değişmez şöyledir: "Cevap `[sol, sag]` arasındadır ve `sag` her zaman geçerli bir cevap adayıdır." Başlangıçta `sag = len(dizi)` seçeriz, çünkü tüm elemanlar hedeften küçükse cevap dizinin sonudur. Ortadaki eleman hedeften küçükse cevap kesinlikle sağdadır: `sol = orta + 1`. Değilse ortadaki eleman bir aday olabilir, onu elememeliyiz: `sag = orta`. Döngü `sol < sag` olduğu sürece döner ve bittiğinde `sol == sag` olur; ikisi de cevabı gösterir. Bu kalıbın güzel yanı, döngüden çıktığında "bulundu mu?" diye ayrı bir dal gerektirmemesidir; cevap her zaman tanımlıdır.

:::trace{src="alt-sinir.trace.json" title="Alt sınır: ilk 55 nerede, kaç tane var?|Lower bound: where is the first 55, and how many are there?"}
`sag = orta` satırında ortanın neden elenmediğini gör; aynı fonksiyonu 56 ve 60 için çağırarak adet ve ekleme yerini bulduğumuza dikkat et.
:::

Python standart kütüphanesindeki `bisect` modülü bu iki fonksiyonu hazır sunar: `bisect_left` alt sınırı, `bisect_right` üst sınırı döndürür; `insort` ise elemanı doğru yere ekler. Mülakatlarda ve gerçek kodda tekerleği yeniden icat etmek yerine bunları kullanmak çoğu zaman daha doğrudur. Yine de içlerinde ne olduğunu bilmek, kendi özel karşılaştırma kuralına sahip bir problemle karşılaştığında aynı kalıbı uyarlayabilmeni sağlar.

:::code{lang="python" title="bisect ile alt/üst sınır ve aralık sayma"}
```python
from bisect import bisect_left, bisect_right, insort

notlar = [40, 55, 55, 55, 70, 85]

ilk = bisect_left(notlar, 55)       # 1: ilk 55'in indeksi
son = bisect_right(notlar, 55)      # 4: 55'ten büyük ilk elemanın indeksi
print(son - ilk)                    # 3 kişi 55 almış

# [50, 75] aralığındaki not sayısı: iki ikili arama, O(log n)
print(bisect_right(notlar, 75) - bisect_left(notlar, 50))   # 4

insort(notlar, 60)                  # sıralamayı bozmadan ekle
print(notlar)                       # [40, 55, 55, 55, 60, 70, 85]
```
:::

## Cevap üzerinde ikili arama

İkili aramanın en güçlü kullanımı, ortada hiçbir dizi yokken ortaya çıkar. Şöyle bir problem düşün: Bir kargo firmasının sırayla teslim edilmesi gereken paketleri var ve bunlar `D` gün içinde gönderilmeli. Kamyonun günlük kapasitesi en az ne olmalı? Kapasiteyi doğrudan hesaplayan bir formül yoktur. Ama şu soruyu kolayca cevaplayabiliriz: "Kapasite `k` olursa paketler `D` günde biter mi?" Bu soru paketleri bir kez gezerek O(n) sürede cevaplanır.

Kritik gözlem şudur: Kapasite `k` ile iş bitiyorsa `k + 1` ile de kesinlikle biter. Yani "yeter mi?" sorusunun cevabı kapasite arttıkça `hayır, hayır, hayır, evet, evet, evet` biçiminde ilerler. Bu bir **monoton yüklem**dir (monotonic predicate) ve monoton olan her şeyde ikili arama yapılabilir. Aradığımız şey, yüklemin "evet" olduğu ilk değerdir; bu da yukarıda yazdığımız alt sınır kalıbının ta kendisidir. Tek fark, `dizi[orta] < hedef` karşılaştırması yerine `yeter_mi(orta)` fonksiyonunu çağırmamızdır.

Arama aralığını da mantıkla belirleriz: Kapasite en ağır paketten küçük olamaz (o paket hiç taşınamaz), toplam ağırlıktan büyük olmasına da gerek yoktur (her şey tek günde biter). Böylece toplam çalışma süresi O(n · log(toplam)) olur. Aynı kalıp "en küçük maksimum", "en büyük minimum" türündeki pek çok problemde karşına çıkar: kitapları öğrencilere bölmek, sunuculara iş dağıtmak, bir değerin karekökünü belli bir hassasiyetle bulmak ya da bir sistemin kaldırabileceği en yüksek istek hızını yük testiyle bulmak gibi.

:::interactive{type="big-o-plotter" functions="logn,n" maxN=1024}
O(log n) ve O(n) eğrilerini aynı grafikte karşılaştır. n 1024'e ulaştığında doğrusal arama 1024 adıma çıkarken ikili arama yalnızca 10 adımda kalır; eğriler arasındaki farkın n büyüdükçe nasıl açıldığını gözlemle. "Logaritmik y ekseni" seçeneğini açıp kapatarak iki eğrinin aynı ölçekte ne kadar farklı göründüğünü ve zaman bütçesi göstergesinde her birinin kaldırabileceği en büyük n'yi karşılaştır.
:::

## Ondalıklı değerlerde ve sınırsız aralıklarda arama

Cevap her zaman bir tamsayı olmak zorunda değildir. Örneğin bir sayının karekökünü ya da bir fiyatlandırma modelinde kârı sıfırlayan eşik değeri bulmak istediğinde arama aralığı gerçek sayılardan oluşur. Bu durumda `orta ± 1` gibi güncellemeler anlamsızlaşır; bunun yerine `sol = orta` ve `sag = orta` yazar, döngüyü de aralık istenen hassasiyetten küçülene kadar ya da sabit sayıda tur (ör. 60 tur) çalıştırırsın. Her tur aralığı yarıya indirdiği için 60 tur, kayan noktalı sayıların hassasiyetini fazlasıyla tüketir ve kayan nokta karşılaştırmalarından doğan sonsuz döngü riskini de ortadan kaldırır.

Bazen de üst sınırı baştan bilmeyiz: sonu belli olmayan bir veri akışında ya da çok büyük bir sayı uzayında arama yapıyor olabiliriz. Bu durumda **üstel arama** (exponential search) kullanılır: önce 1, 2, 4, 8, … konumlarını kontrol ederek hedefi aşan ilk konumu bulur, ardından son iki konum arasında normal ikili arama yaparsın. Toplam maliyet yine O(log n) kalır; burada n, hedefin konumudur.

## Sık yapılan hatalar ve kontrol listesi

İkili arama kodu yazdıktan sonra şu kontrol listesinden geçmek, hataların çoğunu daha çalıştırmadan yakalamanı sağlar:

1. **Aralık türü tutarlı mı?** Kapalı aralık `[sol, sag]` seçtiysen başlangıç `sag = n - 1`, koşul `sol <= sag`, güncellemeler `orta ± 1` olmalıdır. Yarı açık `[sol, sag)` seçtiysen başlangıç `sag = n`, koşul `sol < sag`, güncelleme `sag = orta` olmalıdır. İki stili karıştırmak hataların bir numaralı kaynağıdır.
2. **Her tur aralığı küçültüyor mu?** İki elemanlı bir aralık için kodu kafanda çalıştır. `orta` aşağı yuvarlandığı için `sol = orta` gibi bir güncelleme ilerlemeyi durdurabilir.
3. **Boş ve tek elemanlı girdi:** Boş listede döngü hiç çalışmamalı ve anlamlı bir değer dönmeli.
4. **Tüm elemanlar küçük ya da tüm elemanlar büyük:** Alt sınır sırasıyla `n` ve `0` döndürmeli.
5. **Veri gerçekten sıralı mı?** Sıralı olmayan veride ikili arama hata vermez; sessizce yanlış cevap üretir. Bu, en tehlikeli hata türüdür.

Son olarak, ikili aramanın yalnızca dizilerle sınırlı olmadığını hatırla. Dengeli ikili arama ağaçları ve veritabanlarındaki B-ağacı indeksleri aynı "her adımda adayların büyük kısmını ele" fikrinin ağaç biçimindeki karşılıklarıdır. Ağaçlar dersinde gördüğümüz BST araması, aslında ağaç şekline sokulmuş bir ikili aramadır.

Aynı fikir koddan çok daha geniş bir alanda işe yarar. Git'in `git bisect` komutu, ikili aramanın sürüm geçmişine uygulanmış hâlidir: hatanın son sürümde var olduğunu ve belli eski bir sürümde olmadığını söylersin, Git aradaki commit'lerin ortasındakini çalışma dizinine getirir, sen test edip "iyi" ya da "kötü" dersin ve aralık yarıya iner. Bin commit'lik bir geçmişte hatayı getiren commit'i yaklaşık on denemede bulursun; `git bisect run <betik>` ile test bir betiğe bağlanırsa arama tamamen otomatik yürür. Burada sıralı bir dizi yoktur, yalnızca monoton bir yüklem vardır: "bu commit'te hata var mı?" sorusunun cevabı geçmiş boyunca yalnızca bir kez "hayır"dan "evet"e döner.

:::realworld{company="Google"}
2006'da Google'da çalışan Joshua Bloch, şirketin araştırma blogunda "neredeyse tüm ikili aramalar bozuk" başlıklı ünlü bir yazı yayımladı. Java standart kütüphanesindeki `Arrays.binarySearch` metodu yıllardır `int mid = (low + high) / 2` satırını kullanıyordu. Dizi 2³⁰'dan fazla eleman içerdiğinde `low + high` toplamı 32 bitlik tamsayı sınırını aşıyor, negatif bir sayıya dönüşüyor ve metot dizi sınırı dışına erişmeye çalışıyordu. Hata, ders kitaplarında yer alan ve "kanıtlanmış" kabul edilen bir koddaydı; ancak bu kadar büyük dizilerin pratikte kullanılmaya başlamasıyla ortaya çıktı. Düzeltme tek satırdı: `low + (high - low) / 2` ya da işaretsiz kaydırma `(low + high) >>> 1`. Bu olay, ikili aramanın sınır koşullarının neden ayrıca test edilmesi gerektiğinin klasik örneği olarak anlatılır.
:::

:::callout{tone="tip" title="Mülakat ipucu"}
Problemde "sıralı dizi", "en küçük/en büyük değer öyle ki…" ya da "en az kaç…" ifadeleri geçiyorsa ikili aramayı düşün. Kodlamadan önce yüksek sesle değişmezi söyle ("cevap her zaman [sol, sag) içinde"), aralık stilini seç ve iki elemanlı bir örnekle sınırları dene. Cevap üzerinde arama yapıyorsan önce `yeter_mi(x)` fonksiyonunu ayrı yaz ve monoton olduğunu gerekçesiyle açıkla; mülakatçı asıl bu gözlemi duymak ister.
:::

:::callout{tone="info" title="Python'da hazır araçlar"}
`bisect_left`, `bisect_right` ve `insort` C ile yazılmıştır ve elle yazılan döngüden hızlıdır. Python 3.10'dan itibaren `key=` parametresi de alırlar; böylece sözlüklerden oluşan bir listeyi belirli bir alana göre arayabilirsin. Ancak `insort` eklemeyi listede kaydırarak yaptığı için ekleme yine O(n)'dir; sık ekleme yapılan büyük veride dengeli ağaç ya da heap daha uygun olabilir.
:::

:::quiz{src="quiz.json"}
:::

:::next{lesson="l-10-dynamic-programming"}
Sırada: problemi alt problemlere bölüp sonuçları tekrar kullanan dinamik programlama — memoization, tabulation ve sırt çantası problemi.
:::

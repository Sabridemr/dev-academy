---
id: l-01-big-o-complexity
slug: big-o-complexity
module: l-algorithms-data-structures
order: 1
title:
  tr: "Big-O: Algoritma Karmaşıklığı"
  en: "Big-O: Algorithmic Complexity"
summary:
  tr: "Zaman ve bellek karmaşıklığını sezgisel ve grafikle öğren; O(1), O(log n), O(n), O(n log n), O(n²) ve O(2ⁿ) karşılaştırması."
  en: "Learn time and space complexity intuitively and with graphs; compare O(1), O(log n), O(n), O(n log n), O(n²) and O(2ⁿ)."
durationMinutes: 30
level: beginner
tags: [algoritmalar, big-o, karmasiklik, performans, python]
prerequisites: [k-04-kosullar-ve-donguler, k-06-fonksiyonlar-ve-cagri-yigini]
concepts: [big-o-notation, time-complexity, space-complexity, growth-rate, worst-case, amortized-analysis, nested-loops]
---

## Kavram: "ne kadar hızlı?" değil, "nasıl büyür?"

Bir fonksiyonun hızını ölçmek istediğinde ilk aklına gelen şey muhtemelen bir kronometre olur: kodu çalıştırırsın,
0,2 saniye sürdüğünü görürsün ve "yeterince hızlı" dersin. Bu ölçüm o gün, o bilgisayarda, o veriyle doğrudur; ama
yarın veri on kat büyüdüğünde ne olacağını söylemez. Aynı kod dizüstü bilgisayarında 0,2 saniye, eski bir sunucuda
0,8 saniye sürebilir; Python sürümü, işlemci önbelleği, arka planda çalışan başka programlar sonucu değiştirir. Saniye,
algoritmanın değil ortamın bir özelliğidir.

**Big-O gösterimi** bu yüzden farklı bir soru sorar: *Girdi büyüdükçe yapılan iş nasıl büyür?* Listede 1.000 yerine
1.000.000 eleman olduğunda iş bin kat mı artar, milyon kat mı, yoksa neredeyse hiç değişmez mi? Bu soru ortamdan
bağımsızdır ve bir algoritmanın ölçeklenip ölçeklenmeyeceğini, kodu hiç çalıştırmadan, yalnızca okuyarak tahmin
etmemizi sağlar.

Big-O üç basit fikre dayanır:

1. **Girdi boyutunu `n` ile adlandır.** Bir listenin uzunluğu, bir metnin karakter sayısı, bir graftaki düğüm sayısı...
2. **Temel işlemleri say.** Bir karşılaştırma, bir toplama, bir dizi indeksine erişim gibi sabit süren adımları bir
   birim say. Tam sayıyı bulmak zorunda değilsin; `n` ile nasıl ilişkili olduğunu bulman yeterli.
3. **Yalnızca en hızlı büyüyen terimi tut, sabitleri at.** `3n² + 5n + 20` işlem yapan bir algoritma için n büyüdükçe
   `n²` terimi diğer her şeyi ezer; bu yüzden algoritma **O(n²)** olarak yazılır.

Üçüncü madde ilk başta kafa karıştırabilir: "3 katı yavaş olmak önemsiz mi?" Pratikte önemlidir ve profil çıkarırken
sabitlere de bakarız. Ama Big-O, sabitlerden daha büyük bir şeyi yakalar: *büyüme şeklini*. 100n işlem yapan bir
algoritma, n = 1.000 iken n² işlem yapan bir algoritmadan on kat hızlıdır; n = 1.000.000 iken ise on bin kat. Sabit
çarpan hiçbir zaman büyüme şekli arasındaki farkı kapatamaz.

:::diagram{src="diagram.svg" alt="O(1), O(log n), O(n), O(n log n), O(n²) ve O(2ⁿ) büyüme eğrilerinin karşılaştırması|Comparison of the growth curves O(1), O(log n), O(n), O(n log n), O(n²) and O(2ⁿ)"}
n yalnızca 16 iken bile üstel ve karesel eğriler grafiğin dışına taşıyor; logaritmik eğri neredeyse yatay.
:::

Eğrilerin ardındaki sayıları somutlaştırmak için aşağıdaki sahnede aynı girdiyi adım adım büyütüp dört farklı
algoritmanın yaptığı işlem sayısını yan yana sayıyoruz.

:::animation{scene="buyume-siniflari.scene.json"}
n her ikiye katlandığında O(log n) yalnızca bir adım ekler, O(n) iki katına, O(n²) dört katına çıkar.
:::

## Altı temel büyüme sınıfı

Günlük mühendislikte karşılaşacağın algoritmaların büyük çoğunluğu aşağıdaki altı sınıftan birine düşer. Her birini
bir örnekle tanıyalım.

**O(1) — sabit zaman.** İş, girdi boyutundan bağımsızdır. Bir Python listesinin `liste[5]` ile beşinci elemanına
erişmek, bir sözlükte anahtarla değer okumak (ortalama durumda), bir yığının tepesine eleman koymak sabit zamanlıdır.
Liste on elemanlı da olsa on milyon elemanlı da olsa tek adım sürer.

**O(log n) — logaritmik zaman.** Her adımda problemi sabit bir oranda, genellikle yarıya küçültürsen ortaya çıkar.
Sıralı bir telefon rehberinde ismi ortadan açarak arama buna örnektir: 1.000.000 kayıt için yaklaşık 20 adım yeter,
çünkü 2²⁰ ≈ 1.000.000'dur. Girdi iki katına çıktığında yalnızca **bir** adım daha eklenir. İkili arama dersinde bunu
ayrıntılı göreceğiz.

**O(n) — doğrusal zaman.** Her elemana sabit sayıda kez bakarsın. Bir listenin toplamını almak, en büyük elemanı
bulmak, bir metinde bir harfi saymak doğrusaldır. Girdi iki katına çıkınca iş de iki katına çıkar. Çoğu zaman
"veriyi en az bir kez okumak zorundayım" durumu için ulaşılabilecek en iyi sonuç budur.

**O(n log n) — doğrusal-logaritmik zaman.** İyi sıralama algoritmalarının (merge sort, heap sort, Python'un
`sorted` fonksiyonu) karmaşıklığıdır. Problemi tekrar tekrar ikiye bölüp (log n seviye) her seviyede tüm elemanlarla
uğraşınca (n iş) ortaya çıkar. Pratikte O(n)'e oldukça yakın davranır; milyonlarca elemanı rahatça kaldırır.

**O(n²) — karesel zaman.** Genellikle iç içe iki döngünün işaretidir: her eleman için diğer tüm elemanlara bakmak.
Bir listede tekrar eden eleman var mı diye her çifti karşılaştırmak, bubble sort ve insertion sort bu sınıftadır.
n = 1.000 için bir milyon, n = 100.000 için on milyar işlem demektir. Küçük girdilerde sorun çıkarmaz ama veri büyüdüğünde
ilk patlayan kod genellikle budur.

**O(2ⁿ) — üstel zaman.** Her yeni eleman işi ikiye katlar. Bir kümenin tüm alt kümelerini denemek ya da Fibonacci
sayısını önbelleksiz özyinelemeyle hesaplamak bu sınıftadır. n = 30 civarında saniyeler, n = 60 civarında yüzyıllar
sürer. Dinamik programlama dersinde bu tür algoritmaları nasıl O(n) veya O(n²)'ye indirebileceğimizi göreceğiz.

Aşağıdaki çizicide bu fonksiyonları yan yana görebilirsin.

:::interactive{type="big-o-plotter" functions="1,logn,n,nlogn,n2,2n" maxN=64}
Eğrileri karşılaştır: n küçükken birbirine yakın olan fonksiyonların n büyüdükçe nasıl ayrıştığını izle. Özellikle
n log n ile n² arasındaki farkın n = 64'e doğru ne kadar açıldığına ve 2ⁿ eğrisinin ne kadar erken patladığına dikkat et.
Fonksiyonları tek tek gizleyip göstererek, "Logaritmik y ekseni" seçeneğini açarak ve zaman bütçesini değiştirerek her sınıfın
bu bütçede kaldırabileceği en büyük n'yi karşılaştır.
:::

## Kodu okuyarak karmaşıklık bulmak

Big-O'yu hesaplamak için çoğu zaman birkaç basit kural yeterlidir:

- **Ardışık bloklar toplanır, büyük olan kazanır.** Önce O(n) bir döngü, sonra O(n²) bir döngü varsa toplam
  O(n + n²) = O(n²) olur.
- **İç içe döngüler çarpılır.** Dış döngü n kez, iç döngü her seferinde n kez dönüyorsa iç gövde n · n = n² kez çalışır.
- **Yarıya bölen döngü logaritmiktir.** `while n > 1: n //= 2` döngüsü log₂ n kez döner.
- **Fonksiyon çağrılarının maliyetini de say.** Bir döngünün içinde `x in liste` yazmak masum görünür ama listede
  arama O(n)'dir; döngüyle birlikte O(n²) olur. Aynı satırı bir `set` ile yazarsan ortalama O(1) olur ve toplam O(n)'e düşer.

Son madde Python'da en sık karşılaşılan gizli performans tuzağıdır: `in`, `list.index`, `list.remove`,
`list.insert(0, x)` ve dilimleme (`liste[a:b]`) gibi tek satırlık işlemler aslında doğrusal maliyetlidir.

Şimdi iç içe bir döngünün kaç kez çalıştığını adım adım izleyelim. Aşağıdaki fonksiyon, n elemanlı bir kümedeki tüm
farklı çiftleri sayar; yani bir "her çifti karşılaştır" algoritmasının iskeletidir. İç döngü `i + 1`'den başladığı için
her çift yalnızca bir kez sayılır.

:::trace{src="ic-ice-dongu.trace.json" title="İç içe döngü kaç kez döner?|How many times does a nested loop run?"}
Sayaçtaki değeri ve `n` ile ilişkisini izle. İç döngü her turda biraz kısalsa da toplam n·(n-1)/2'dir; sabitleri ve
küçük terimleri atınca karmaşıklık O(n²) kalır.
:::

İzde gördüğün sonuç önemli bir dersi gösteriyor: iç döngünün her turda kısalması sabit çarpanı değiştirir (n² yerine
yaklaşık n²/2), ama büyüme şeklini değiştirmez. İç içe döngü hâlâ karesel büyür.

## En kötü, ortalama ve amortize durum

Aynı algoritma farklı girdilerde farklı sürebilir. Bir listede doğrusal arama yaparken aranan eleman en baştaysa tek
adımda bulursun (en iyi durum), en sonda ya da hiç yoksa n adım gerekir (en kötü durum). Big-O genellikle **en kötü
durumu** anlatmak için kullanılır, çünkü bir sistemin garantisini en kötü durum belirler: "her zaman en fazla şu kadar
sürer" demek, "genelde hızlıdır" demekten daha güçlü bir sözdür.

Bazı yapılarda ise **ortalama durum** daha anlamlıdır. Hash tablosunda arama ortalamada O(1)'dir, ama tüm anahtarlar
aynı kovaya düşerse en kötü durumda O(n) olur. Bu senaryo iyi bir hash fonksiyonuyla pratikte neredeyse hiç yaşanmaz;
bu yüzden "sözlük araması O(1)" deriz ve bunun ortalama durum olduğunu aklımızın bir köşesinde tutarız.

Üçüncü kavram **amortize analizdir**. Python listesine `append` ile eleman eklemek çoğu zaman tek adımdır; ama ayrılan
alan dolunca liste daha büyük bir bellek bloğuna taşınır ve tüm elemanlar kopyalanır. Bu tek seferlik işlem O(n)'dir.
Kapasite her seferinde sabit bir oranla büyütüldüğü için bu pahalı kopyalamalar giderek seyrekleşir; toplam maliyet n
ekleme boyunca yayıldığında ekleme başına **amortize O(1)** çıkar. Bunu bir sonraki derste, dinamik dizileri anlatırken
ayrıntılı göreceğiz.

## Bellek karmaşıklığı

Big-O yalnızca zaman için değil, **ek bellek** için de kullanılır. Bir listeyi yerinde ters çeviren algoritma yalnızca
birkaç değişken tutar: O(1) ek bellek. Listenin ters çevrilmiş bir kopyasını üreten `liste[::-1]` ise n elemanlık yeni
bir liste oluşturur: O(n) ek bellek. Özyinelemeli fonksiyonlarda çağrı yığınındaki her çerçeve de bellek tüketir;
derinliği n olan bir özyineleme, hiçbir liste oluşturmasa bile O(n) bellek kullanır ve Python'da varsayılan sınır olan
yaklaşık 1.000 çerçeveyi aşınca `RecursionError` verir.

Zaman ve bellek çoğu zaman birbirinin karşılığında takas edilir. Bir sonucu önbelleğe almak (memoization) belleği
artırıp zamanı düşürür; her şeyi anında yeniden hesaplamak ise tersini yapar. İyi bir mühendis bu takası bilinçli
yapar ve hangisinin kıt olduğuna göre karar verir: milyonlarca kullanıcıya hizmet veren bir sunucuda bellek pahalı
olabilir, gerçek zamanlı bir oyunda ise milisaniyeler.

:::code{lang="python" title="Aynı problem, iki farklı karmaşıklık"}
```python
def tekrar_var_mi_yavas(sayilar):
    """Her çifti karşılaştırır: O(n²) zaman, O(1) ek bellek."""
    for i in range(len(sayilar)):
        for j in range(i + 1, len(sayilar)):
            if sayilar[i] == sayilar[j]:
                return True
    return False


def tekrar_var_mi_hizli(sayilar):
    """Görülenleri kümede tutar: O(n) zaman, O(n) ek bellek."""
    gorulen = set()
    for x in sayilar:
        if x in gorulen:          # set'te arama ortalama O(1)
            return True
        gorulen.add(x)
    return False
```
:::

## Sayılarla sezgi kazanmak

Big-O'yu ezberlemek yerine kaba bir hesap tablosu kafanda olsun. Modern bir bilgisayar, Python'da saniyede kabaca on
milyonlarca basit işlem yapabilir (C gibi derlenen dillerde bunun on katı ya da daha fazlası). Bu varsayımla, bir
saniyelik bütçeyle şu girdi boyutlarını rahatça işleyebilirsin:

| Karmaşıklık | Bir saniyede kaldırılabilecek yaklaşık n |
|---|---|
| O(log n) | Pratikte sınırsız |
| O(n) | On milyonlar |
| O(n log n) | Milyonlar |
| O(n²) | Birkaç bin |
| O(2ⁿ) | 20–25 civarı |

Bu tablo mülakatlarda ve gerçek projelerde çok işe yarar. Girdi boyutu 100.000 ise O(n²) bir çözüm büyük ihtimalle
zaman aşımına uğrar; O(n log n) veya daha iyisini aramalısın. Girdi 20 ise üstel bir çözüm bile kabul edilebilir
olabilir. Kısıtlara bakıp hedef karmaşıklığı önceden tahmin etmek, doğru algoritmayı seçmenin en hızlı yoludur.

:::realworld{company="Shopify"}
Shopify gibi e-ticaret platformlarında bir mağazanın birkaç yüz ürünle başlayıp kısa sürede yüz binlerce ürüne
ulaşması olağandır. Geliştirme ortamında küçük test verisiyle sorunsuz çalışan bir kod parçası — örneğin her ürün için
tüm indirim kurallarını tek tek tarayan iç içe bir döngü — gerçek mağaza büyüdüğünde sayfa yüklemesini saniyelerce
yavaşlatabilir. Büyük ölçekli Ruby on Rails uygulamalarında sık görülen "N+1 sorgu" problemi de aynı mantıktır:
listedeki her eleman için ayrı bir veritabanı sorgusu atmak, sorgu sayısını n ile doğrusal büyütür; tek bir toplu
sorguya geçmek bunu sabite indirir. Bu yüzden büyük platformlar performans testlerini üretim ölçeğine yakın veriyle
çalıştırır ve kod incelemelerinde döngü içindeki pahalı çağrıları özellikle sorar.
:::

:::callout{tone="warning" title="Big-O her şey değildir"}
Big-O büyüme şeklini anlatır, gerçek süreyi değil. Küçük n için O(n²) bir algoritma, sabitleri küçük olduğu için
O(n log n) bir algoritmadan hızlı olabilir; Python'un sıralama algoritması bu yüzden küçük parçalarda insertion sort
kullanır. Kritik kodda Big-O ile yön belirle, sonra `timeit` veya bir profiler ile ölçerek doğrula.
:::

:::callout{tone="tip" title="Mülakat ipucu"}
Çözümü yazmadan önce karmaşıklığı sesli söyle: "Bu kaba kuvvet çözümü O(n²); bir küme kullanarak O(n) zamana inebilirim,
karşılığında O(n) ek bellek harcarım." Mülakatçılar hem zaman hem bellek karmaşıklığını ayrı ayrı belirtmeni ve
takası açıkça tartışmanı bekler. Girdi kısıtlarına bakarak hedef karmaşıklığı tahmin etmek de güçlü bir sinyaldir.
:::

:::quiz{src="quiz.json"}
:::

:::next{lesson="l-02-arrays-strings-two-pointers"}
Sırada: bellekte ardışık duran diziler, dinamik dizilerin amortize O(1) eklemesi ve iç içe döngüleri tek geçişe indiren
iki işaretçi ile kayan pencere teknikleri.
:::

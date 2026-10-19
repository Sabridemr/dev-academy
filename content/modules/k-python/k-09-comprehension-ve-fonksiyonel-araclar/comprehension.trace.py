def kare(x):
    return x * x


def tek_kareler(sayilar):
    #@ 'n' adında yerel bir değişkenimiz var. Comprehension da döngü değişkeni olarak 'n' kullanacak. | We have a local named 'n'. The comprehension will also use 'n' as its loop variable.
    n = "dış"
    #@ Python 3.12+ comprehension için ayrı çerçeve açmaz: döngü bu çerçevenin içinde döner, 'n' her turda tek_kareler çerçevesinde görünür. | Python 3.12+ does not open a separate frame for a comprehension: the loop runs inside this frame and 'n' shows up in tek_kareler on each pass.
    sonuc = [kare(n) for n in sayilar if n % 2 == 1]
    #@ Liste bitince 'sonuc' ismine bağlandı ve 'n' yine "dış": comprehension değişkeni dışarı sızmaz. | Once the list is complete it is bound to 'sonuc', and 'n' is "dış" again: the comprehension variable does not leak.
    return sonuc, n


#@ kare yalnızca filtreden geçen tek sayılar için çağrılacak: 1 ve 3 için evet, 2 için hayır. | kare will be called only for odd numbers that pass the filter: yes for 1 and 3, no for 2.
print(tek_kareler([1, 2, 3]))
#@ Koşullu ifade (x if koşul else y) filtre değildir: her eleman sonuca girer, yalnızca değeri seçilir. | A conditional expression (x if cond else y) is not a filter: every item gets in, only its value is chosen.
etiket = ["geçti" if p >= 50 else "kaldı" for p in [45, 82]]
#@ Dict comprehension anahtar: değer çiftlerinden yeni bir sözlük kurar. | A dict comprehension builds a new dict from key: value pairs.
karne = {isim: puan for isim, puan in [("ali", 82), ("ece", 45)]}
print(etiket, karne)

def iki_toplam(sayilar, hedef):
    #@ Boş bir sözlük: anahtar = görülen sayı, değer = o sayının indeksi. Heap'te büyüyüşünü izle. | An empty dict: key = a number seen so far, value = its index. Watch it grow on the heap.
    gorulen = {}
    for i, x in enumerate(sayilar):
        eksik = hedef - x
        #@ 'in' kontrolü listeyi taramaz: eksik'in hash'i hesaplanır ve doğrudan ilgili kovaya bakılır, ortalama O(1). | The 'in' check does not scan a list: the hash of eksik is computed and the matching bucket is checked directly, O(1) on average.
        if eksik in gorulen:
            return gorulen[eksik], i
        gorulen[x] = i
    return None


def kelime_say(metin):
    sayac = {}
    for kelime in metin.split():
        #@ get(anahtar, 0) anahtar yoksa 0 döndürür; böylece KeyError almadan sayacı artırırız. | get(key, 0) returns 0 when the key is missing, so we bump the counter without a KeyError.
        sayac[kelime] = sayac.get(kelime, 0) + 1
    return sayac


#@ 7'yi veren iki sayı aranıyor: 5 geldiğinde eksik olan 2 henüz görülmemiş, 2 geldiğinde ise 5 sözlükte bulunacak. | Looking for two numbers that sum to 7: when 5 arrives its partner 2 is not seen yet; when 2 arrives, 5 is found in the dict.
print(iki_toplam([3, 8, 11, 5, 2], 7))
print(kelime_say("elma armut elma kiraz elma"))

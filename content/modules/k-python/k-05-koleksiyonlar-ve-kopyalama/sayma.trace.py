kelimeler = ["elma", "armut", "elma", "kiraz", "elma", "armut"]
sayac = {}
for k in kelimeler:
    #@ get(k, 0): anahtar yoksa KeyError yerine 0 döner; sonra 1 ekleyip geri yazıyoruz. | get(k, 0) returns 0 instead of raising KeyError when the key is missing; we add 1 and store it back.
    sayac[k] = sayac.get(k, 0) + 1
print(sayac)
#@ set() tekrarları atar: her değerden yalnızca bir tane kalır. Küme sırasızdır, yazdırma sırasına güvenme. | set() drops duplicates: one of each value remains. Sets are unordered; do not rely on print order.
tekil = set(kelimeler)
#@ dict.fromkeys sırayı koruyarak tekilleştirir (dict ekleme sırasını korur, Python 3.7+). | dict.fromkeys de-duplicates while keeping order (dicts keep insertion order, Python 3.7+).
sirali_tekil = list(dict.fromkeys(kelimeler))
print(sirali_tekil)
print(len(tekil), "kiraz" in tekil)

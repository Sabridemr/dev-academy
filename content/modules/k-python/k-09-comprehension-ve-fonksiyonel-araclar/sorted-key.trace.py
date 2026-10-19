ogrenciler = [("ece", 72), ("ali", 90), ("can", 72)]
#@ key fonksiyonu sıralamadan ÖNCE her eleman için bir kez çağrılır; sorted karşılaştırmaları bu anahtarlarla yapar. | The key function is called once per item BEFORE sorting; sorted then compares those keys.
sirali = sorted(ogrenciler, key=lambda o: o[1])
#@ Puanı eşit olan ece ve can, listedeki ilk sıralarını korudu: Python'un sıralaması kararlıdır (stable). | ece and can have equal scores and kept their original order: Python's sort is stable.
print(sirali)
#@ Çok anahtarlı sıralama: anahtar bir tuple. Önce puan büyükten küçüğe (-puan), eşitse isim alfabetik. | Multi-key sort: the key is a tuple. Score descending first (-score), then name alphabetically on ties.
sirali2 = sorted(ogrenciler, key=lambda o: (-o[1], o[0]))
print(sirali2)
#@ max da key alır: en yüksek puanlı öğrencinin tamamını döndürür, yalnızca puanı değil. | max takes a key too: it returns the whole top student, not just the score.
en_iyi = max(ogrenciler, key=lambda o: o[1])
#@ sorted yeni bir liste döndürdü; orijinal 'ogrenciler' hiç değişmedi. | sorted returned a new list; the original 'ogrenciler' was never changed.
print(en_iyi, ogrenciler)

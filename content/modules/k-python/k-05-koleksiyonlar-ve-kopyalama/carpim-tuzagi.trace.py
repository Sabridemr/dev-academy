#@ * 3 dış listeye aynı iç listenin referansını üç kez koyar; üç ayrı satır oluşmaz. | * 3 puts a reference to the same inner list three times; it does not create three rows.
tuzak = [[0] * 3] * 3
#@ Tek bir hücreyi değiştirmek istiyoruz ama üç satır da aynı nesne. | We want to change one cell, but all three rows are the same object.
tuzak[0][0] = 1
print(tuzak)
#@ Comprehension her turda yeni bir [0, 0, 0] listesi oluşturur: üç bağımsız satır. | The comprehension builds a new [0, 0, 0] list on every pass: three independent rows.
dogru = [[0] * 3 for _ in range(3)]
#@ Şimdi yalnızca ilk satır değişecek. | Now only the first row will change.
dogru[0][0] = 1
print(dogru)

isimler = ["ali", "ece", "can"]
puanlar = [90, 72, 85]
#@ zip iki listeyi eleman eleman eşleştirir, enumerate de her çifte bir sıra numarası ekler. İkisi de tembeldir: çiftleri ancak döngü istedikçe üretir. | zip pairs the two lists item by item and enumerate adds a counter to each pair. Both are lazy: they produce pairs only as the loop asks.
for sira, (isim, puan) in enumerate(zip(isimler, puanlar), start=1):
    #@ Her turda gelen (1, ("ali", 90)) gibi iç içe tuple, sira, isim ve puan isimlerine açıldı (unpacking). | Each nested tuple like (1, ("ali", 90)) was unpacked into sira, isim and puan.
    print(sira, isim, puan)
#@ dict(zip(...)) iki listeden tek satırda sözlük kurar: birinci liste anahtar, ikinci değer. | dict(zip(...)) builds a dict from two lists in one line: the first gives keys, the second values.
karne = dict(zip(isimler, puanlar))
#@ Listeler farklı uzunluktaysa zip en kısasında durur; "can" sessizce düşecek. | If the lists differ in length, zip stops at the shortest; "can" will be silently dropped.
kisa = list(zip(isimler, [1, 2]))
print(karne, kisa)

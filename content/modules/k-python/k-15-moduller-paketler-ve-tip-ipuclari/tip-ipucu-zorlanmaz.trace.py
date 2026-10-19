def topla(a: int, b: int) -> int:
    #@ Tip ipuçları yalnızca açıklamadır: Python burada a ve b'nin gerçekten int olup olmadığını kontrol etmez. | Type hints are only annotations: Python does not check here whether a and b really are ints.
    return a + b


print(topla(2, 3))
#@ İpucu `int` diyor ama str veriyoruz. Çalışma zamanında hiçbir kontrol yok: `+` metinleri birleştirecek. | The hint says `int` but we pass str. There is no runtime check: `+` will concatenate the strings.
metin = topla("2", "3")
print(metin, type(metin).__name__)
liste = topla([1], [2])
print(liste)
#@ Şimdi hata alacağız, ama hatayı tip ipucu değil `+` operatörü üretecek: str ile int toplanamaz. | Now we will get an error, but it comes from the `+` operator, not from the type hint: str and int cannot be added.
topla("2", 3)

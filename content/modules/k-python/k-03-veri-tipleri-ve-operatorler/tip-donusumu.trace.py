#@ input() ve dosyalar hep str verir. Hesap yapmadan önce dönüştürmen gerekir. | input() and files always give you str. You must convert before doing arithmetic.
metin = "42"
sayi = int(metin)
#@ "42" + 1 TypeError verirdi; dönüştürülmüş 'sayi' ile toplama sorunsuz. | "42" + 1 would raise TypeError; adding with the converted 'sayi' works.
print(sayi + 1)
#@ int() baştaki/sondaki boşlukları tolere eder. | int() tolerates leading/trailing whitespace.
bosluklu = int("  7 ")
oran = float("3.5")
#@ int(3.5) ondalık kısmı keser (yuvarlamaz): sonuç 3. | int(3.5) truncates the fractional part (does not round): the result is 3.
kesik = int(oran)
yuvarlak = round(oran)
print(bosluklu, oran, kesik, yuvarlak)
#@ str() her nesneyi metne çevirir; bool() ise doluluğa bakar: "" False, "0" True (boş değil!). | str() turns any object into text; bool() checks emptiness: "" is False, "0" is True (it is not empty!).
print(str(sayi) + "!", bool(""), bool("0"), bool(0))
#@ int() ondalık noktalı bir METNİ kabul etmez: bu satır ValueError ile programı durduracak. | int() does not accept a STRING with a decimal point: this line will stop the program with ValueError.
hatali = int("3.5")
print("buraya gelinmez")

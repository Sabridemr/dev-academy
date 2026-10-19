sayac = 10


def oku():
    #@ Bu fonksiyonda 'sayac'a atama yok: isim global kapsamda bulunur. | No assignment to 'sayac' here: the name is found in the global scope.
    return sayac + 1


def artir():
    #@ Bu satırdaki atama yüzünden derleyici 'sayac'ı bu fonksiyonun YEREL değişkeni saydı. Yerel 'sayac'a henüz değer verilmedi: UnboundLocalError! | Because this line assigns to it, the compiler marked 'sayac' as LOCAL to this function. The local has no value yet: UnboundLocalError!
    sayac = sayac + 1
    return sayac


print(oku())
#@ Aynı ifade, fonksiyonda atama olduğu için bu sefer hata verecek. | The same expression will fail this time because the function assigns to the name.
artir()

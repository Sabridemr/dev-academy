def ekle(liste, oge):
    #@ Parametre 'liste', çağıranın listesine bağlanan yeni bir etiket: aynı nesne üzerinde çalışıyoruz. | The parameter 'liste' is a new label bound to the caller's list: we work on the same object.
    liste.append(oge)


def artir(sayi):
    #@ 'sayi' yerel bir etiket; yeniden bağlamak çağıranın değişkenini etkilemez. | 'sayi' is a local label; rebinding it does not affect the caller's variable.
    sayi = sayi + 1
    return sayi


notlar = [70, 85]
puan = 90
#@ Fonksiyon çağrısı yığına yeni bir çerçeve ekler; argümanlar kopyalanmaz, referansları aktarılır. | A call pushes a new frame; arguments are not copied, their references are passed.
ekle(notlar, 100)
yeni = artir(puan)
print(notlar, puan, yeni)

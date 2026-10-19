def kdv_ekle(tutar):
    #@ Yığının tepesinde kdv_ekle var; altında toplam_hesapla ve en altta Global bekliyor. | kdv_ekle is on top of the stack; toplam_hesapla and Global wait below it.
    sonuc = tutar * 1.2
    return sonuc


def toplam_hesapla(fiyat, adet):
    ara = fiyat * adet
    #@ Bu çağrı yeni bir çerçeve açacak; toplam_hesapla, kdv_ekle dönene kadar bu satırda bekler. | This call pushes a new frame; toplam_hesapla waits on this line until kdv_ekle returns.
    toplam = kdv_ekle(ara)
    #@ kdv_ekle'nin çerçevesi kapandı; dönen değer 'toplam' ismine bağlandı. | kdv_ekle's frame is gone; the returned value is bound to 'toplam'.
    return toplam


def siparis(urun, fiyat, adet):
    tutar = toplam_hesapla(fiyat, adet)
    print(urun, tutar)
    return tutar


#@ Üç katlı bir çağrı zinciri başlıyor: siparis -> toplam_hesapla -> kdv_ekle. | A three-level call chain starts: siparis -> toplam_hesapla -> kdv_ekle.
a = siparis("kalem", 10, 3)
#@ Aynı fonksiyonun ikinci çağrısı: öncekinden bağımsız, yepyeni çerçeveler açılacak. | A second call to the same function: brand-new frames, independent of the first.
b = siparis("defter", 25, 2)

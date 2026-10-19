def sayac_olustur(baslangic):
    sayi = baslangic

    def artir():
        nonlocal sayi
        #@ 'sayi' artir'in kendi yereli değil, kapsayan (enclosing) fonksiyondan yakalanan hücre (cell); çerçevede görünen değer o hücreden okunuyor. nonlocal sayesinde += hücreyi günceller: heap'teki closure değerini izle. | 'sayi' is not artir's own local but a cell captured from the enclosing function; the value shown in the frame is read from that cell. Thanks to nonlocal, += updates the cell: watch the closure value on the heap.
        sayi += 1
        return sayi

    #@ İç fonksiyon döndürülüyor: sayac_olustur'un çerçevesi kapanacak ama 'sayi' closure içinde yaşamaya devam edecek. | The inner function is returned: sayac_olustur's frame will close, but 'sayi' lives on inside the closure.
    return artir


#@ Her sayac_olustur çağrısı kendi 'sayi' hücresine sahip yeni bir closure üretir. | Each call to sayac_olustur produces a new closure with its own 'sayi' cell.
a = sayac_olustur(0)
b = sayac_olustur(100)
a()
#@ a'nın sayacı 1 oldu; şimdi 2'ye çıkacak. b'nin sayacı (100) bundan etkilenmez. | a's counter is now 1 and will go to 2; b's counter (100) is unaffected.
print(a())
print(b())

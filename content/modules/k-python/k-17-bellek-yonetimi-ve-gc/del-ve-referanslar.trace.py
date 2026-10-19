def rapor_uret():
    #@ Bu liste yalnızca yerel 'satirlar' adıyla tutuluyor: çerçeve kapanınca referansı da gidecek. | This list is held only by the local name 'satirlar': when the frame closes, its reference goes too.
    satirlar = ["giris", "sonuc"]
    return len(satirlar)


#@ Liste nesnesi oluşuyor; şu an onu gösteren tek referans 'veri' adı. | The list object is created; right now the only reference to it is the name 'veri'.
veri = [10, 20, 30]
#@ İkinci isim aynı nesneyi gösterecek: nesnenin referans sayısı bir artar, kopya oluşmaz. | A second name will point to the same object: its reference count goes up by one, no copy is made.
yedek = veri
#@ del nesneyi değil, 'veri' ismini siler. Liste 'yedek' üzerinden hâlâ erişilebilir, heap'te kalır. | del removes the name 'veri', not the object. The list is still reachable through 'yedek', so it stays on the heap.
del veri
print(yedek)
#@ Bu, listeye giden son referans. Silinince sayaç 0 olur ve CPython nesneyi hemen serbest bırakır. | This is the last reference to the list. Once it is deleted the count drops to 0 and CPython frees the object at once.
del yedek
#@ Heap görünümünde liste artık yok: hiçbir isimden ulaşılamıyor. Şimdi bir fonksiyon çağrılacak. | The list is gone from the heap view: no name can reach it. Now a function will be called.
adet = rapor_uret()
#@ Çerçeve kapandı; yerel liste de onunla birlikte erişilemez oldu. Sadece dönen int kaldı. | The frame has closed and the local list became unreachable with it. Only the returned int remains.
print(adet)

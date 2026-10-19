class Kitap:
    def __init__(self, baslik):
        self.baslik = baslik
        self.odunc_alan = None

class BellekDeposu:
    def __init__(self):
        self.kitaplar = {}
    def getir(self, isbn):
        #@ Depo, ISBN'e karşılık gelen Kitap nesnesinin kendisini döndürür; kopya değil, aynı nesneye referans. | The repository returns the Kitap object itself for the ISBN: a reference to the same object, not a copy.
        return self.kitaplar.get(isbn)

class OduncServisi:
    def __init__(self, depo):
        #@ Constructor injection: servis deposunu kendisi yaratmıyor, dışarıdan aldığı nesneyi saklıyor. | Constructor injection: the service does not create its repository; it stores the object it was given.
        self.depo = depo
    def odunc_ver(self, isbn, uye):
        kitap = self.depo.getir(isbn)
        #@ Yerel 'kitap' ile depodaki sözlük aynı Kitap nesnesini gösteriyor. Değişiklik doğrudan depodaki kitaba yansıyacak. | The local 'kitap' and the repository's dict point at the same Kitap object. The change will show up in the stored book directly.
        kitap.odunc_alan = uye
        return kitap
depo = BellekDeposu()
depo.kitaplar["111"] = Kitap("Dune")
#@ Servis oluşturulurken depo nesnesi içeri veriliyor: heap'te servis, depo ve kitap olmak üzere üç nesne birbirine bağlanacak. | The repository is passed in when the service is created: the service, repository and book objects on the heap will be linked together.
servis = OduncServisi(depo)
#@ Akış: servis → depo.getir → Kitap nesnesini güncelle. Çağrı yığınında çerçevelerin üst üste bindiğini izle. | Flow: service → depo.getir → update the Kitap object. Watch the frames stack up on the call stack.
kitap = servis.odunc_ver("111", "ayse")
print(kitap.baslik, "→", kitap.odunc_alan)

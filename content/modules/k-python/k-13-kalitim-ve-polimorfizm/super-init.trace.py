class Calisan:
    def __init__(self, ad, maas):
        #@ Üst sınıfın __init__'i çalışıyor. Yığında iki __init__ çerçevesi var ve ikisindeki 'self' AYNI Yonetici nesnesini gösteriyor. | The parent's __init__ is running. There are two __init__ frames on the stack and 'self' in both points to the SAME Yonetici object.
        self.ad = ad
        self.maas = maas

    def yillik(self):
        return self.maas * 12


class Yonetici(Calisan):
    def __init__(self, ad, maas, ekip):
        #@ Yonetici kendi __init__'ini tanımladığı için Calisan'ınki otomatik çalışmaz. super().__init__ ile açıkça çağırıyoruz. | Because Yonetici defines its own __init__, Calisan's does not run automatically. We call it explicitly with super().__init__.
        super().__init__(ad, maas)
        self.ekip = ekip  #@ Üst sınıf ad ve maas alanlarını kurdu; şimdi alt sınıf kendine özgü 'ekip' alanını ekliyor. | The parent set up ad and maas; now the subclass adds its own 'ekip' field.

    def yillik(self):
        #@ Metot ezme (override): Yonetici.yillik çalışıyor. super().yillik() üst sınıfın sürümünü çağırıp sonucu genişletecek. | Method override: Yonetici.yillik runs. super().yillik() will call the parent's version and extend the result.
        return super().yillik() + 10000


y = Yonetici("Ada", 5000, ["Linus", "Guido"])
print(y.ad, y.yillik())

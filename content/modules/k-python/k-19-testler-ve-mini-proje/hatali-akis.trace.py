class KitapZatenOduncte(Exception):
    pass

class Kitap:
    def __init__(self, baslik):
        self.baslik = baslik
        self.odunc_alan = None

class OduncServisi:
    def __init__(self, kitaplar):
        self.kitaplar = kitaplar
    def odunc_ver(self, isbn, uye):
        kitap = self.kitaplar[isbn]
        #@ Kural kontrolü: kitap başkasındaysa işlem yapılmadan özel bir istisna fırlatılacak. | Business rule check: if the book is already lent out, a custom exception is raised before any change.
        if kitap.odunc_alan is not None:
            raise KitapZatenOduncte(f"{kitap.baslik} zaten ödünçte: {kitap.odunc_alan}")
        kitap.odunc_alan = uye
        return kitap

servis = OduncServisi({"111": Kitap("Dune")})
#@ İlk ödünç alma başarılı olacak: kitap müsait. | The first loan will succeed: the book is available.
servis.odunc_ver("111", "ayse")
try:
    #@ Aynı kitap ikinci kez isteniyor. Kitap hâlâ 'ayse'de olduğu için odunc_ver istisna fırlatacak. | The same book is requested again. Since it is still with 'ayse', odunc_ver will raise.
    servis.odunc_ver("111", "mehmet")
except KitapZatenOduncte as hata:
    #@ İstisna çerçeveyi kapatıp buraya ulaştı; kitap nesnesi değişmedi, hâlâ 'ayse'de. | The exception closed the frame and arrived here; the book object is unchanged and still with 'ayse'.
    print("Hata:", hata)

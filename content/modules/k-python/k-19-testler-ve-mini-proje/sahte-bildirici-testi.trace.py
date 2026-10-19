class SahteBildirici:
    def __init__(self):
        self.mesajlar = []
    def gonder(self, alici, mesaj):
        #@ Fake gerçek e-posta göndermiyor; mesajı yalnızca listeye ekliyor ki test sonra kontrol edebilsin. | The fake sends no real e-mail; it only appends the message to a list so the test can check it later.
        self.mesajlar.append((alici, mesaj))

class OduncServisi:
    def __init__(self, kitaplar, bildirici):
        self.kitaplar = kitaplar
        self.bildirici = bildirici
    def odunc_ver(self, isbn, uye):
        self.kitaplar[isbn] = uye
        #@ Servis bildiricinin gerçek mi sahte mi olduğunu bilmiyor; yalnızca gonder metodunu çağırıyor. | The service does not know whether the notifier is real or fake; it only calls gonder.
        self.bildirici.gonder(uye, f"{isbn} sizde")

def test_odunc_bildirim_gonderir():
    #@ Hazırla (arrange): sahte bildiriciyi oluştur ve servise constructor üzerinden ver. | Arrange: create the fake notifier and hand it to the service through the constructor.
    sahte = SahteBildirici()
    servis = OduncServisi({}, sahte)
    servis.odunc_ver("111", "ayse")
    #@ Doğrula (assert): sahte nesnenin listesinde beklenen mesaj var mı? Yanlışsa AssertionError fırlar. | Assert: does the fake's list hold the expected message? If not, AssertionError is raised.
    assert sahte.mesajlar == [("ayse", "111 sizde")]

test_odunc_bildirim_gonderir()
print("test geçti")

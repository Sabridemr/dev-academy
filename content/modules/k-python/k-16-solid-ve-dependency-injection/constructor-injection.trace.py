class SqlDepo:
    def kaydet(self, urun):
        print("SQL: INSERT", urun)
class SahteDepo:
    def __init__(self):
        self.kayitlar = []
    def kaydet(self, urun):
        #@ Sahte (fake) depo veritabanına gitmez; kaydı bellekteki listeye yazar. Servis bu farkı bilmez. | The fake repository never touches a database; it writes to an in-memory list. The service does not know the difference.
        self.kayitlar.append(urun)
class Konsol:
    def gonder(self, mesaj):
        print("Bildirim:", mesaj)
class SiparisServisi:
    def __init__(self, depo, bildirim):
        #@ Servis bağımlılıklarını kendisi oluşturmuyor: dışarıdan verilen nesnelere referans tutacak. | The service does not create its dependencies: it will keep references to the objects passed in.
        self.depo = depo
        self.bildirim = bildirim
    def olustur(self, urun):
        #@ `self.depo` hangi nesneyi gösteriyorsa onun `kaydet` metodu çalışır: SqlDepo mu SahteDepo mu, servis umursamaz. | Whatever object `self.depo` points to, its `kaydet` method runs: SqlDepo or SahteDepo, the service does not care.
        self.depo.kaydet(urun)
        self.bildirim.gonder(f"{urun} alındı")

#@ Gerçek uygulama: servise gerçek depo ve bildirim nesneleri veriliyor. | Real application: the service receives the real repository and notifier.
canli = SiparisServisi(SqlDepo(), Konsol())
canli.olustur("kitap")
sahte = SahteDepo()
#@ Aynı SiparisServisi sınıfı, bu kez sahte depoyla kuruluyor. Sınıfın kodunda tek satır değişmedi. | The same SiparisServisi class, this time built with the fake repository. Not a single line of the class changed.
test = SiparisServisi(sahte, Konsol())
test.olustur("kalem")
print(sahte.kayitlar)

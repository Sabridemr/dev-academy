class Konteyner:
    def __init__(self):
        self._fabrikalar = {}

    def kaydet(self, ad, fabrika):
        self._fabrikalar[ad] = fabrika

    def coz(self, ad):
        #@ Kayıtlı fabrika bulunup çağrılıyor. Fabrika konteyneri parametre olarak alır, kendi bağımlılıklarını da ondan isteyebilir. | The registered factory is looked up and called. It receives the container, so it can ask for its own dependencies too.
        fabrika = self._fabrikalar[ad]
        return fabrika(self)


class BellekDepo:
    def __init__(self):
        self.veri = {}


class KullaniciServisi:
    def __init__(self, depo):
        self.depo = depo


#@ Konteyner oluşturuluyor. Sonraki iki satır kayıt: "depo" ve "servis" adlarına birer fabrika (lambda) bağlanacak, ama henüz hiçbir depo ya da servis nesnesi oluşmayacak. | The container is created. The next two lines register a factory (lambda) under the names "depo" and "servis", but no repository or service object will be created yet.
k = Konteyner()
k.kaydet("depo", lambda c: BellekDepo())
k.kaydet("servis", lambda c: KullaniciServisi(c.coz("depo")))
#@ Çözümleme: servis istendi. Servisin fabrikası önce depoyu çözecek; yığında iç içe `coz` çerçevelerini izle. | Resolution: the service is requested. Its factory first resolves the repository; watch the nested `coz` frames on the stack.
servis = k.coz("servis")
print(type(servis).__name__, "->", type(servis.depo).__name__)

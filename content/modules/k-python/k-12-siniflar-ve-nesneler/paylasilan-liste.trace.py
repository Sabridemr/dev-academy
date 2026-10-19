class Sepet:
    urunler = []  #@ TUZAK: bu liste sınıf gövdesinde bir kez oluşur ve sınıfa aittir; tüm sepetler aynı listeyi görecek. | TRAP: this list is created once in the class body and belongs to the class; every basket will see the same list.

    def ekle(self, urun):
        #@ self'te 'urunler' alanı yok; arama sınıfa geçer ve sınıftaki liste bulunur. append onu yerinde değiştirir; yeni alan oluşmaz. | self has no 'urunler', so the class's list is found. append mutates it in place; no new field is created.
        self.urunler.append(urun)


s1 = Sepet()
s2 = Sepet()
s1.ekle("elma")
#@ s2'ye hiç dokunmadık ama 'elma' onda da görünüyor: iki nesne de sınıftaki tek listeyi gösteriyor. | We never touched s2, yet 'elma' shows up there too: both objects refer to the class's single list.
print(s2.urunler)


class DogruSepet:
    def __init__(self):
        self.urunler = []  #@ Doğrusu: liste __init__ içinde oluşturulur, her nesne kendi listesini alır. | The fix: create the list in __init__ so each object gets its own list.

    def ekle(self, urun):
        self.urunler.append(urun)


d1 = DogruSepet()
d2 = DogruSepet()
d1.ekle("elma")
print(d1.urunler, d2.urunler)

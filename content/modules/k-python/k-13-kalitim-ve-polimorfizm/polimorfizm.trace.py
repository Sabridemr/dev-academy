class Sekil:
    def alan(self):
        raise NotImplementedError


class Kare(Sekil):
    def __init__(self, kenar):
        self.kenar = kenar

    def alan(self):
        return self.kenar * self.kenar  #@ s bir Kare olduğu için Kare.alan çalışıyor. | s is a Kare, so Kare.alan runs.


class Daire(Sekil):
    def __init__(self, r):
        self.r = r

    def alan(self):
        return round(3.14159 * self.r ** 2, 2)  #@ Aynı s.alan() satırı bu kez Daire.alan'a geldi: metodu nesnenin sınıfı seçer. | The same line s.alan() arrived at Daire.alan this time: the object's class chooses the method.


sekiller = [Kare(3), Daire(1), Kare(2)]
toplam = 0
for s in sekiller:
    #@ Döngü s'nin türünü bilmiyor ve sormuyor. Python çağrı anında s'nin sınıfında 'alan'ı arar. | The loop neither knows nor asks the type of s. At call time Python looks up 'alan' in s's class.
    toplam += s.alan()
print(toplam)

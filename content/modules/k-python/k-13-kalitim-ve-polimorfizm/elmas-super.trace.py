class A:
    def selam(self):
        print("A")  #@ Zincirin sonu: A, MRO'da object'ten önceki son sınıf. Yığında dört selam çerçevesi üst üste duruyor. | End of the chain: A is the last class before object in the MRO. Four selam frames are stacked up.


class B(A):
    def selam(self):
        print("B")
        #@ Dikkat: B'deki super() A'ya değil, D'nin MRO'sunda B'den sonra gelen C'ye gider. | Note: super() in B goes not to A but to C, the class after B in D's MRO.
        super().selam()


class C(A):
    def selam(self):
        print("C")
        super().selam()


class D(B, C):
    def selam(self):
        print("D")
        super().selam()  #@ super(), 'MRO'da benden sonraki sınıf' demektir. D'nin MRO'su: D, B, C, A, object. | super() means "the next class after me in the MRO". D's MRO: D, B, C, A, object.


D().selam()
print(D.__mro__)

class Kopek:
    tur = "Canis familiaris"  #@ Sınıf gövdesindeki atamalar sınıf niteliği olur: sınıf nesnesinin üzerinde, tek kopya. | Assignments in the class body become class attributes: one copy, stored on the class object.
    sayac = 0

    def __init__(self, ad):
        self.ad = ad  #@ self.ad = ... bir örnek niteliği oluşturur: alan bu nesnenin kendi üzerinde durur, her nesnenin ayrı bir 'ad'ı olur. | self.ad = ... creates an instance attribute: the field lives on this object itself, so each object has its own 'ad'.
        Kopek.sayac += 1  #@ Sayacı sınıf üzerinden artırıyoruz: tüm örneklerin paylaştığı tek değer değişir. | We increment the counter via the class: the single value shared by all instances changes.


a = Kopek("Karabaş")
b = Kopek("Pamuk")
#@ Örneklerde 'tur' alanı yok. Python önce nesneye, bulamayınca sınıfa bakar; ikisi de sınıftaki aynı değeri okur. | The instances have no 'tur' field. Python looks in the object first, then in the class; both read the same class value.
print(a.tur, b.tur)
#@ Örnek üzerinden atama sınıfı DEĞİŞTİRMEZ: b'nin kendi üzerinde yeni bir 'tur' alanı oluşur ve sınıftakini gölgeler. | Assigning via an instance does NOT change the class: a new 'tur' field is created on b itself and shadows the class value.
b.tur = "kurt"
print(a.tur, b.tur, Kopek.tur)
#@ Örnekteki alanı silince gölge kalkar; b.tur yeniden sınıftaki değeri gösterir. | Deleting the instance field removes the shadow; b.tur shows the class value again.
del b.tur
print(b.tur, Kopek.sayac)

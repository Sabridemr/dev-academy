class Hesap:
    def __init__(self, sahip, bakiye):
        #@ Python yeni ve boş bir Hesap nesnesi oluşturdu ve onu 'self' parametresine bağladı. Heap'te sınıf nesnesi ile bu yeni örnek ayrı kutulardır. | Python created a new, empty Hesap object and bound it to the parameter 'self'. On the heap, the class object and this new instance are separate boxes.
        self.sahip = sahip
        self.bakiye = bakiye  #@ 'sahip' alanı yerel değişkende değil, nesnenin kendi üzerinde oluştu. Şimdi 'bakiye' de eklenecek. | The field 'sahip' was created on the object itself, not in a local variable. Now 'bakiye' will be added too.

    def yatir(self, tutar):
        self.bakiye += tutar  #@ 'self', metodu çağıran nesneye bağlı. Değişiklik o nesnenin alanında olur. | 'self' is bound to the object the method was called on. The change happens in that object's field.
        return self.bakiye


#@ Hesap(...) çağrısı önce boş bir nesne oluşturur, sonra __init__'i bu nesneyle (self) ve verdiğin argümanlarla çağırır. | Calling Hesap(...) first creates an empty object, then calls __init__ with that object (self) and your arguments.
ada = Hesap("Ada", 100)
#@ __init__ None döndürdü ama Hesap(...) ifadesi oluşturulan nesneyi verdi; 'ada' ona bağlandı. Şimdi ikinci, bağımsız bir örnek oluşacak. | __init__ returned None, but the expression Hesap(...) produced the new object; 'ada' is bound to it. Now a second, independent instance is created.
linus = Hesap("Linus", 50)
#@ ada.yatir(25) bir bound method çağrısıdır: Python 'ada' nesnesini self olarak otomatik verir. | ada.yatir(25) is a bound method call: Python passes the object 'ada' as self automatically.
ada.yatir(25)
#@ Aynı şeyin uzun yazımı: metodu sınıftan alıp nesneyi açıkça ilk argüman olarak vermek. | The long form of the same thing: take the method from the class and pass the object explicitly as the first argument.
Hesap.yatir(linus, 10)
print(ada.bakiye, linus.bakiye)

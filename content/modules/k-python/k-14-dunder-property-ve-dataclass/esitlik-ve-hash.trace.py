class Para:
    def __init__(self, miktar, birim):
        self.miktar = miktar
        self.birim = birim

    def __eq__(self, diger):
        #@ `__eq__` çağrıldı: kimliğe değil, alanların değerine bakıyoruz. | `__eq__` was called: we compare field values, not identity.
        return (self.miktar, self.birim) == (diger.miktar, diger.birim)

    def __hash__(self):
        #@ Eşit nesneler aynı hash'i vermeli: bu yüzden hash de aynı alanlardan hesaplanıyor. | Equal objects must have equal hashes, so the hash is built from the same fields.
        return hash((self.miktar, self.birim))


a = Para(10, "TL")
b = Para(10, "TL")
#@ Heap'te iki ayrı Para nesnesi var. `==` bizim `__eq__` metodumuza gider. | There are two separate Para objects on the heap. `==` goes to our `__eq__` method.
print(a == b, a is b)
#@ Kümeye eklerken Python önce `__hash__` ile kovayı bulur, aynı hash'li öğe varsa `__eq__` ile eşitliği doğrular. | When adding to a set, Python first finds the bucket with `__hash__`; if an item with the same hash exists, it confirms with `__eq__`.
kume = {a, b}
#@ b, a'ya eşit sayıldığı için kümeye ikinci kez eklenmedi. | b counts as equal to a, so it was not added a second time.
print(len(kume))

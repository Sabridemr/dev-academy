class Vektor:
    def __init__(self, x, y):
        self.x = x
        self.y = y

    def __add__(self, diger):
        #@ `v1 + v2` ifadesi `v1.__add__(v2)` çağrısına dönüştü: 'self' v1'i, 'diger' v2'yi gösteriyor. | The expression `v1 + v2` became the call `v1.__add__(v2)`: 'self' points to v1, 'diger' to v2.
        return Vektor(self.x + diger.x, self.y + diger.y)

    def __repr__(self):
        return f"Vektor({self.x}, {self.y})"


v1 = Vektor(1, 2)
v2 = Vektor(3, 4)
#@ Python `+` operatörünü görünce sol işlenenin sınıfında `__add__` arar. | When Python sees `+`, it looks up `__add__` on the left operand's class.
v3 = v1 + v2
#@ v3 yepyeni bir nesne: v1 ve v2 hiç değişmedi. | v3 is a brand-new object: v1 and v2 did not change at all.
print(v3)
#@ print, nesneyi metne çevirmek için önce `__str__` arar; tanımlı olmadığı için `__repr__` kullanılır. | print looks for `__str__` first; since it is not defined, `__repr__` is used.
print([v1, v2])

class Sicaklik:
    def __init__(self, celsius):
        #@ Bu atama `_celsius`'a doğrudan değil, property'nin setter'ına gider: doğrulama kurulumda da çalışır. | This assignment does not touch `_celsius` directly; it goes through the property's setter, so validation runs at construction too.
        self.celsius = celsius

    @property
    def celsius(self):
        return self._celsius

    @celsius.setter
    def celsius(self, deger):
        if deger < -273.15:
            #@ Geçersiz değer: setter hata fırlatıyor, `_celsius` değişmeden kalacak. | Invalid value: the setter raises, `_celsius` stays unchanged.
            raise ValueError("Mutlak sıfırın altı olamaz")
        self._celsius = deger

    @property
    def fahrenheit(self):
        return self._celsius * 9 / 5 + 32


oda = Sicaklik(22)
#@ `oda.fahrenheit` parantezsiz okunuyor ama aslında bir metot çağrısı: salt okunur property. | `oda.fahrenheit` is read without parentheses but it is really a method call: a read-only property.
print(oda.fahrenheit)
oda.celsius = 25
#@ -300 setter'dan geçemeyecek: ValueError yakalanmazsa program burada durur. | -300 will not pass the setter: if the ValueError is not caught, the program stops here.
oda.celsius = -300
print("Bu satır çalışmaz")

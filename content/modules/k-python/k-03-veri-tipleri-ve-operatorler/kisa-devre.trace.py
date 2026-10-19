def sol(deger):
    print("sol çağrıldı")
    return deger


def sag(deger):
    print("sag çağrıldı")
    return deger


#@ and: sol taraf falsy (0) olduğu için sonuç zaten belli. Python sag()'ı HİÇ çağırmayacak ve 0'ı döndürecek. | and: the left side is falsy (0), so the result is already known. Python will NOT call sag() and returns 0.
a = sol(0) and sag(5)
#@ and: sol taraf truthy (3), bu yüzden sağ tarafa bakılır ve sonuç sağ operandın kendisi (5) olur. | and: the left side is truthy (3), so the right side is evaluated and the result is the right operand itself (5).
b = sol(3) and sag(5)
#@ or: sol taraf truthy ("Ada") olduğu için sag() çağrılmaz; sonuç "Ada". | or: the left side is truthy ("Ada"), so sag() is not called; the result is "Ada".
c = sol("Ada") or sag("misafir")
#@ or: sol taraf boş metin (falsy), bu yüzden sag() çağrılır ve "misafir" döner. Varsayılan değer deseni budur. | or: the left side is an empty string (falsy), so sag() is called and "misafir" is returned. This is the default-value pattern.
d = sol("") or sag("misafir")
print(a, b, c, d)

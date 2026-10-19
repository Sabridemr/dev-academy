def sayac(bitis):
    print("  [gen] başladı")
    n = 1
    while n <= bitis:
        #@ yield n değerini dışarı verir ve fonksiyonu ASKIYA alır: çerçeve yok olmaz, n ile birlikte kaldığı satırda bekler. | yield hands n out and SUSPENDS the function: the frame is not destroyed; it waits on this line together with n.
        yield n
        #@ Bir sonraki next() ile tam bu satırdan devam etti; n hâlâ hatırlanıyor. | The next next() resumed right here; n is still remembered.
        n += 1
    print("  [gen] bitti")


#@ Generator fonksiyonunu çağırmak gövdeyi ÇALIŞTIRMAZ: yalnızca bir generator nesnesi döner, yığına çerçeve eklenmez. | Calling a generator function does NOT run its body: it just returns a generator object; no frame is pushed.
gen = sayac(2)
#@ İlk next(): sayac çerçevesi yığına girer ve ilk yield'e kadar çalışır. | First next(): the sayac frame enters the stack and runs up to the first yield.
a = next(gen)
#@ Generator askıdayken yığında yalnızca Global var. Şimdi ikinci next() çerçeveyi geri getirecek. | While the generator is suspended only Global is on the stack. The second next() will bring the frame back.
b = next(gen)
print("alındı:", a, b)
#@ Üçüncü next(): döngü biter ve fonksiyon sona ulaşır. Generator bitince StopIteration fırlatır; next(gen, "tükendi") bunu yakalayıp varsayılan değeri döndürecek. | Third next(): the loop ends and the function finishes. A finished generator raises StopIteration; next(gen, "tükendi") catches it and returns the default.
c = next(gen, "tükendi")
print(c)

import functools


def logla(fonk):
    #@ Dekoratör çalışıyor: asıl fonksiyonu 'fonk' parametresi olarak aldı, yerine geçecek sarmalayıcıyı tanımlayacak. | The decorator runs: it received the original function as 'fonk' and will define the wrapper that replaces it.
    @functools.wraps(fonk)
    def sarmalayici(*args, **kwargs):
        print("->", fonk.__name__, args)
        #@ Yığında sarmalayici var; şimdi closure'daki 'fonk' çağrılacak ve asıl fonksiyonun çerçevesi onun üstüne açılacak. | sarmalayici is on the stack; now the 'fonk' captured in the closure is called and the original's frame opens above it.
        sonuc = fonk(*args, **kwargs)
        print("<-", sonuc)
        return sonuc

    return sarmalayici


#@ @logla, 'topla = logla(topla)' demektir: tanımdan hemen sonra logla çağrılacak. | @logla means 'topla = logla(topla)': logla is called right after the definition.
@logla
def topla(a, b):
    return a + b


#@ 'topla' artık sarmalayıcıyı gösteriyor; çağrı önce sarmalayici çerçevesini açacak. | 'topla' now points to the wrapper; the call opens a sarmalayici frame first.
x = topla(2, 3)
print(topla.__name__, x)

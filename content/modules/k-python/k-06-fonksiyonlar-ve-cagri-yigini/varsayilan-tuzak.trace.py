#@ def satırı çalışırken varsayılan [] BİR KEZ oluşturulur ve fonksiyon nesnesine iliştirilir. | When the def line runs, the default [] is created ONCE and attached to the function object.
def ekle_hatali(oge, liste=[]):
    #@ 'liste' parametresi, her çağrıda aynı varsayılan liste nesnesine bağlanıyor. | The parameter 'liste' is bound to the same default list object on every call.
    liste.append(oge)
    return liste


def ekle_dogru(oge, liste=None):
    #@ None değiştirilemez; her çağrıda burada yeni bir liste oluşturuyoruz. | None is immutable; we create a fresh list here on every call.
    if liste is None:
        liste = []
    liste.append(oge)
    return liste


x = ekle_hatali("a")
#@ Yeni boş liste beklenir ama 'x' ile aynı nesne geri gelecek: ['a', 'b']. | You expect a new empty list, but the same object as 'x' comes back: ['a', 'b'].
y = ekle_hatali("b")
print(x, y, x is y)
p = ekle_dogru("a")
q = ekle_dogru("b")
print(p, q, p is q)

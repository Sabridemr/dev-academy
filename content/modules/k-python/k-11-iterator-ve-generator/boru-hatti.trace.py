def oku(satirlar):
    for s in satirlar:
        #@ Kaynak bir satırı ancak biri next() ile istediğinde okuyor. | The source reads a line only when someone asks with next().
        print("oku:", s)
        yield s


def sayiya(kaynak):
    for s in kaynak:
        yield int(s)


def ciftler(kaynak):
    for x in kaynak:
        if x % 2 == 0:
            yield x


#@ Üç generator zincirlendi ama henüz HİÇBİR satır okunmadı: sadece üç generator nesnesi oluştu. | Three generators are chained but NO line has been read yet: only three generator objects were created.
hat = ciftler(sayiya(oku(["1", "2", "3"])))
#@ for, en dıştaki ciftler'den değer ister; o sayiya'dan, o da oku'dan ister. Yığında üç generator çerçevesi üst üste görünecek. | The for asks ciftler for a value; it asks sayiya, which asks oku. Three generator frames will stack up.
for x in hat:
    #@ Değerler tek tek, baştan sona akıyor: "2" okunup işlendikten sonra "3" daha okunmadı bile. | Values flow one at a time end to end: "3" has not even been read after "2" was processed.
    print("sonuç:", x)

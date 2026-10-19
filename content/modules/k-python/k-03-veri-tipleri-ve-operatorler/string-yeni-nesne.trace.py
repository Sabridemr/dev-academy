#! heap-primitives
#@ str değiştirilemez (immutable). Önce baştaki ve sondaki boşluklarla bir metin oluşturuluyor. | str is immutable. First a string with leading and trailing spaces is created.
ham = "  merhaba dünya  "
#@ strip() 'ham'ı değiştirmez; boşluksuz YENİ bir str nesnesi döndürür. | strip() does not change 'ham'; it returns a NEW str object without the spaces.
temiz = ham.strip()
#@ upper() da yeni nesne üretir. 'temiz' olduğu gibi kalacak. | upper() also creates a new object. 'temiz' stays the same.
buyuk = temiz.upper()
#@ Dilimleme [0:7] ilk 7 karakterden yeni bir metin üretir. | Slicing [0:7] produces a new string from the first 7 characters.
ilk = temiz[0:7]
#@ replace yeni nesne döndürür ve 'temiz' etiketi oraya taşınır. Eski "merhaba dünya" değişmedi; etiketi kalmadığı için heap'ten silinecek. | replace returns a new object and the label 'temiz' moves to it. The old "merhaba dünya" was not changed; with no label left it is removed from the heap.
temiz = temiz.replace("dünya", "Python")
#@ split metni parçalara bölüp bir LİSTE döndürür; liste de yeni bir nesne. | split breaks the text into pieces and returns a LIST, also a new object.
parcalar = temiz.split(" ")
birlesik = "-".join(parcalar)
print(repr(ham))
print(buyuk, "|", ilk, "|", birlesik)

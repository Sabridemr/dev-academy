import copy

#@ Dış liste iki iç liste tutuyor: heap'te toplam üç liste nesnesi oluşacak. | The outer list holds two inner lists: three list objects will exist on the heap.
takim = [["Ada", "Can"], ["Ece"]]
#@ copy() sığ kopyadır: yeni bir dış liste oluşturur ama iç listeleri kopyalamaz, aynı nesnelere referans koyar. | copy() is shallow: it creates a new outer list but stores references to the same inner lists.
sig = takim.copy()
#@ deepcopy iç listeleri de tek tek kopyalar: birbirinden tamamen bağımsız yeni bir ağaç oluşur. | deepcopy copies the inner lists one by one: a fully independent new tree is created.
derin = copy.deepcopy(takim)
#@ sig[0] ile takim[0] AYNI iç liste: bu append iki dış listeden de görülecek. | sig[0] and takim[0] are the SAME inner list: this append will be visible from both outer lists.
sig[0].append("Deniz")
#@ Dış listeye eleman eklemek yalnızca sig'i etkiler; dış listeler ayrı nesnelerdir. | Appending to the outer list affects only sig; the outer lists are separate objects.
sig.append(["Mert"])
#@ derin'in iç listesi ayrı bir nesne: takim bu değişiklikten etkilenmez. | derin's inner list is a separate object: takim is not affected by this change.
derin[1].append("Zeynep")
print(takim)
print(sig)
print(derin)

#@ Liste değiştirilebilir (mutable) bir nesnedir: içeriği yerinde değişebilir. | A list is mutable: its contents can change in place.
sepet = ["elma", "armut"]
#@ Atama kopyalamaz: 'yedek' aynı listeye ikinci etiket olur. | Assignment does not copy: 'yedek' becomes a second label on the same list.
yedek = sepet
#@ append listeyi yerinde değiştirir; aynı nesneyi gösteren iki etiket de değişikliği görür. | append mutates the list in place; both labels see the change because they share one object.
yedek.append("kiraz")
#@ Dilimleme [:] yeni bir liste nesnesi oluşturur: artık iki ayrı liste var. | Slicing [:] creates a new list object: now there are two separate lists.
kopya = sepet[:]
kopya.append("muz")
#@ == değerleri, is kimliği (aynı nesne mi?) karşılaştırır. | == compares values, is compares identity (same object?).
ayni_mi = sepet is yedek
esit_mi = sepet == kopya
print(sepet, kopya, ayni_mi, esit_mi)

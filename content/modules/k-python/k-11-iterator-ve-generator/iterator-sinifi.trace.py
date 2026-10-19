class GeriSayim:
    def __init__(self, baslangic):
        self.kalan = baslangic

    def __iter__(self):
        return self

    def __next__(self):
        #@ Sıradaki değer yoksa StopIteration fırlat: protokolde 'bitti' demenin yolu budur. | If there is no next value raise StopIteration: that is how the protocol says 'done'.
        if self.kalan <= 0:
            raise StopIteration
        self.kalan -= 1
        return self.kalan + 1


sayim = GeriSayim(2)
#@ for'un arka planda yaptığı: önce iter(), sonra döngüde next(), StopIteration gelince dur. | What for does behind the scenes: iter() first, then next() in a loop, stop on StopIteration.
it = iter(sayim)
while True:
    try:
        #@ next(it) aslında it.__next__() çağırır: yığına __next__ çerçevesi eklenecek. | next(it) really calls it.__next__(): a __next__ frame will be pushed.
        deger = next(it)
    except StopIteration:
        break
    print("değer:", deger)
#@ Aynı nesneyle ikinci döngü: kalan zaten 0, iterator tükendi. Gövde hiç çalışmayacak. | A second loop over the same object: kalan is already 0, the iterator is exhausted. The body will not run at all.
for deger in sayim:
    print("ikinci tur:", deger)
print("bitti")

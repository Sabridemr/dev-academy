def fib(n, bellek):
    #@ Önce sözlüğe bak: bu n daha önce hesaplandıysa hiç dallanmadan cevabı döndür. | Check the dict first: if this n was computed before, return the answer without branching.
    if n in bellek:
        return bellek[n]
    if n < 2:
        return n
    sonuc = fib(n - 1, bellek) + fib(n - 2, bellek)
    #@ Sonucu sözlüğe yaz: bütün çerçeveler AYNI sözlük nesnesini paylaşıyor, heap'te tek bir dict var. | Store the result: every frame shares the SAME dict object; there is only one dict on the heap.
    bellek[n] = sonuc
    return sonuc


#@ Boş bir önbellek sözlüğü oluştur ve her çağrıya aynı referansı ver. | Create an empty cache dict and pass the same reference to every call.
onbellek = {}
sonuc = fib(5, onbellek)
#@ Sözlükte 2–5 arası sonuçlar birikti. fib(2) ve fib(3) ikinci kez istendiğinde dallanmadan sözlükten geldi: toplam 9 çağrı (naif hâli 15 çağrı yapar). | The dict now holds results for 2–5. When fib(2) and fib(3) were requested again they came from the dict without branching: 9 calls in total (the naive version makes 15).
print(sonuc, onbellek)

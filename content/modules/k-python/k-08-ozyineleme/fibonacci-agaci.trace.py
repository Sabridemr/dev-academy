cagri_sayisi = 0


def fib(n):
    global cagri_sayisi
    #@ Her fib çağrısı sayacı artırır; birazdan aynı n için birden fazla kez geldiğimizi göreceksin. | Each fib call bumps the counter; soon you will see the same n computed more than once.
    cagri_sayisi += 1
    if n < 2:
        return n
    #@ Naif fibonacci İKİ kez kendini çağırır: önce fib(n - 1) bütün alt ağacıyla biter, sonra fib(n - 2) başlar. | Naive fibonacci calls itself TWICE: fib(n - 1) finishes its whole subtree first, then fib(n - 2) starts.
    return fib(n - 1) + fib(n - 2)


#@ fib(4) bir çağrı ağacı oluşturur; yığın aynı anda yalnızca ağacın bir dalını tutar. | fib(4) builds a call tree; the stack holds only one branch of that tree at a time.
sonuc = fib(4)
#@ fib(4) için 9 çağrı yapıldı: fib(2) iki kez, fib(1) üç kez hesaplandı. Bu tekrar n büyüdükçe üstel artar. | fib(4) made 9 calls: fib(2) was computed twice and fib(1) three times. This repetition grows exponentially with n.
print("fib(4) =", sonuc, "| çağrı sayısı:", cagri_sayisi)

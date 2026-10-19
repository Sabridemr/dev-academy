def faktoriyel(n):
    #@ Temel durum (base case): n 1'e indiğinde artık kendini çağırmadan doğrudan 1 döndürür. | Base case: once n reaches 1 the function returns 1 without calling itself.
    if n <= 1:
        return 1
    #@ Özyinelemeli durum: faktoriyel(n - 1) bitmeden bu çarpma yapılamaz; bu çerçeve askıda bekler. | Recursive case: this multiplication cannot happen until faktoriyel(n - 1) finishes, so this frame waits.
    sonuc = n * faktoriyel(n - 1)
    return sonuc


#@ İlk çağrı: yığına n=4 olan bir çerçeve eklenecek. Her çağrının KENDİ n'i olacak. | First call: a frame with n=4 is pushed. Each call will have its OWN n.
cevap = faktoriyel(4)
print("4! =", cevap)

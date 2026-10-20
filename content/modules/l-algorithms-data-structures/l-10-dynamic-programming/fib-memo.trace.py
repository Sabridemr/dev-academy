def fib(n, memo):
    #@ Önce not defterine bak: bu alt problem daha önce çözüldüyse hemen dön. | First check the notebook: if this subproblem was solved before, return at once.
    if n in memo:
        return memo[n]
    if n <= 1:
        return n
    #@ İki özyinelemeli çağrı açılacak; çağrı yığınının nasıl derinleştiğini izle. | Two recursive calls will open; watch the call stack grow deeper.
    sonuc = fib(n - 1, memo) + fib(n - 2, memo)
    #@ Sonucu sakla: aynı n için bir daha hesap yapılmayacak. | Store the result: this n will never be computed again.
    memo[n] = sonuc
    return sonuc


not_defteri = {}
#@ fib(5) çağrısı: fib(3) ve fib(2) ikinci kez istendiğinde memo'dan okunacak. | Calling fib(5): when fib(3) and fib(2) are requested again they are read from memo.
print(fib(5, not_defteri))
print(not_defteri)

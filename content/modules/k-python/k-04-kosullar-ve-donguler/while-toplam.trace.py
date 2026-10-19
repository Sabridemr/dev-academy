#@ Döngüden önce sayaç ve toplam başlangıç değerlerini alıyor. | Before the loop, the counter and the total get their initial values.
toplam = 0
i = 1
#@ Her turda önce koşul kontrol edilir: i <= 4 doğru olduğu sürece gövde çalışır. | Each round the condition is checked first: the body runs while i <= 4 is true.
while i <= 4:
    toplam += i
    #@ Sayacı artırmayı unutursan koşul hiç yanlış olmaz ve döngü sonsuza kadar sürer. | If you forget to increase the counter, the condition never becomes false and the loop runs forever.
    i += 1
#@ i 5 oldu, koşul yanlış: döngüden çıkıldı. Toplam 1+2+3+4 = 10. | i is 5, the condition is false: the loop has ended. The total is 1+2+3+4 = 10.
print("Toplam:", toplam)
kalan = 3
while True:
    print("Geri sayım:", kalan)
    kalan -= 1
    if kalan == 0:
        #@ while True kendiliğinden bitmez; break döngüyü hemen sonlandırır. | while True never ends on its own; break ends the loop immediately.
        break
print("Kalkış!")

def asal_mi(n):
    if n < 2:
        return False
    #@ Bölen adaylarını 2'den başlayarak deniyoruz. Bölen bulunursa break ile çıkacağız. | We try divisor candidates starting from 2. If one divides n we leave with break.
    for bolen in range(2, n):
        if n % bolen == 0:
            #@ Bölen bulundu: break döngüyü keser ve else bloğu ATLANIR. | A divisor was found: break stops the loop and the else block is SKIPPED.
            print(n, "asal değil, bölen:", bolen)
            break
    else:
        #@ Döngü break görmeden sona erdi: hiçbir bölen yok, else bloğu çalışıyor. | The loop finished without a break: no divisor, so the else block runs.
        print(n, "asal")
        return True
    return False


#@ Önce 7: 2, 3, 4, 5, 6 denenecek ve hiçbiri bölmeyecek. | First 7: 2, 3, 4, 5, 6 are tried and none divides it.
asal_mi(7)
asal_mi(9)

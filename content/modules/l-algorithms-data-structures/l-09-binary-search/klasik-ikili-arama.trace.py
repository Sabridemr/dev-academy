def ikili_ara(dizi, hedef):
    #@ Arama aralığı kapalı: [sol, sag]. Başta tüm dizi aday. | The search range is closed: [sol, sag]. At first the whole array is a candidate.
    sol, sag = 0, len(dizi) - 1
    while sol <= sag:
        #@ Ortayı (sol + sag) // 2 ile bul; her turda aday sayısı yarıya inecek. | Find the middle with (sol + sag) // 2; each round halves the candidates.
        orta = (sol + sag) // 2
        if dizi[orta] == hedef:
            return orta
        elif dizi[orta] < hedef:
            #@ Ortadaki değer küçük: hedef sağ yarıda olabilir, ortayı da eleyerek sol = orta + 1. | The middle value is too small: the target can only be in the right half, so sol = orta + 1 (the middle is discarded too).
            sol = orta + 1
        else:
            sag = orta - 1
    #@ sol > sag oldu: aralık boşaldı, hedef dizide yok. | sol > sag: the range is empty, the target is not in the array.
    return -1


sayilar = [3, 8, 12, 17, 23, 31, 42, 56]
print(ikili_ara(sayilar, 31))
#@ Olmayan bir değer: aralık daralıp boşalana kadar devam edecek. | A missing value: the loop runs until the range shrinks to nothing.
print(ikili_ara(sayilar, 20))

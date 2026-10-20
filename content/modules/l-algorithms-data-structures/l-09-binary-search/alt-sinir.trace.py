def alt_sinir(dizi, hedef):
    #@ Yarı açık aralık [sol, sag): sag = len(dizi) da geçerli bir cevap (hepsi küçükse). | Half-open range [sol, sag): sag = len(dizi) is also a valid answer (if everything is smaller).
    sol, sag = 0, len(dizi)
    while sol < sag:
        orta = (sol + sag) // 2
        if dizi[orta] < hedef:
            sol = orta + 1
        else:
            #@ dizi[orta] >= hedef: orta bir aday; onu ELEMİYORUZ, sag = orta. | dizi[orta] >= hedef: orta is a candidate, so we do NOT discard it: sag = orta.
            sag = orta
    #@ sol == sag: hedef'ten küçük olmayan ilk elemanın indeksi. | sol == sag: the index of the first element not less than hedef.
    return sol


notlar = [40, 55, 55, 55, 70, 85]
#@ 55 üç kez geçiyor; klasik arama herhangi birini bulabilirdi, alt sınır İLKİNİ bulur. | 55 appears three times; plain search could return any of them, lower bound returns the FIRST.
ilk = alt_sinir(notlar, 55)
son = alt_sinir(notlar, 56)
print("ilk:", ilk, "adet:", son - ilk)
print("60 eklenecek yer:", alt_sinir(notlar, 60))

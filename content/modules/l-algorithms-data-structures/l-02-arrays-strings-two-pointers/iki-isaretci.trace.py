def iki_toplam(sirali, hedef):
    #@ Bir işaretçi en küçük elemanda, diğeri en büyük elemanda başlıyor. | One pointer starts at the smallest element, the other at the largest.
    sol, sag = 0, len(sirali) - 1
    while sol < sag:
        toplam = sirali[sol] + sirali[sag]
        if toplam == hedef:
            return sol, sag
        elif toplam < hedef:
            #@ Toplam küçük: daha büyük bir sayı lazım. Dizi sıralı olduğu için tek çare sol işaretçiyi sağa almak. | The sum is too small: we need a bigger number. Because the array is sorted, the only option is to move the left pointer right.
            sol += 1
        else:
            #@ Toplam büyük: sağdaki eleman hiçbir sol elemanla hedefe ulaşamaz, onu eleyip sağ işaretçiyi sola alıyoruz. | The sum is too big: the right element cannot reach the target with any left element, so we drop it and move the right pointer left.
            sag -= 1
    return None


#@ Sıralı dizide toplamı 10 olan çift aranıyor. Her adımda bir aday elendiği için en fazla n adım sürer: O(n). | We look for a pair summing to 10 in a sorted array. Each step eliminates one candidate, so it takes at most n steps: O(n).
print(iki_toplam([1, 3, 4, 6, 8, 11], 10))

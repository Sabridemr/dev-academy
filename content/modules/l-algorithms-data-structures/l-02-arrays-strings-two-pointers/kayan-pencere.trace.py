def en_buyuk_pencere(sayilar, k):
    #@ İlk pencerenin toplamı bir kez, baştan hesaplanıyor: ilk k eleman. | The first window's sum is computed once from scratch: the first k elements.
    toplam = sum(sayilar[:k])
    en_iyi = toplam
    for sag in range(k, len(sayilar)):
        #@ Pencere bir adım sağa kayıyor: yeni eleman (sayilar[sag]) ekleniyor, soldan düşen (sayilar[sag - k]) çıkarılıyor. Toplamı yeniden hesaplamadan O(1) güncelleme! | The window slides one step right: the new element (sayilar[sag]) is added and the one falling off the left (sayilar[sag - k]) is subtracted. An O(1) update without recomputing the sum!
        toplam += sayilar[sag] - sayilar[sag - k]
        en_iyi = max(en_iyi, toplam)
    return en_iyi


#@ 3 elemanlık pencerelerin toplamları: 8, 7, 9, 6. En büyüğü 9 ([5, 1, 3]). | Sums of the 3-element windows: 8, 7, 9, 6. The largest is 9 ([5, 1, 3]).
print(en_buyuk_pencere([2, 1, 5, 1, 3, 2], 3))

agirlik = [1, 3, 4]
deger = [15, 20, 30]
kapasite = 4

#@ tablo[c]: kapasite c için şimdiye kadarki eşyalarla elde edilen en yüksek değer. | tablo[c]: the best value for capacity c using the items seen so far.
tablo = [0] * (kapasite + 1)
for i in range(len(agirlik)):
    #@ Kapasiteyi GERİYE doğru gez: böylece her eşya en fazla bir kez kullanılır (0/1 sırt çantası). | Walk capacity BACKWARDS so each item is used at most once (0/1 knapsack).
    for c in range(kapasite, agirlik[i] - 1, -1):
        al = tablo[c - agirlik[i]] + deger[i]
        if al > tablo[c]:
            tablo[c] = al
    print("eşya", i, "sonrası:", tablo)

#@ Son hücre cevaptır: 4 kg ile en yüksek değer. | The last cell is the answer: the best value within 4 kg.
print("en iyi:", tablo[kapasite])

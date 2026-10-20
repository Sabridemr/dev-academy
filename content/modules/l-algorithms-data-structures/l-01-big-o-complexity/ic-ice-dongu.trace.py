def cift_say(n):
    adim = 0
    for i in range(n):
        #@ İç döngü i'den sonraki her j için bir kez döner: i = 0 iken n - 1 tur, i = 1 iken n - 2 tur... | The inner loop runs once for every j after i: n - 1 rounds when i = 0, n - 2 when i = 1...
        for j in range(i + 1, n):
            #@ Sayaç, iç gövdenin kaç kez çalıştığını sayıyor. Toplam n·(n-1)/2 olacak: bu O(n²) demektir. | The counter records how many times the inner body runs. The total will be n·(n-1)/2, which is O(n²).
            adim += 1
    return adim


#@ n büyüdükçe adım sayısını izle: 2 → 1, 3 → 3, 4 → 6, 5 → 10. n iki katına çıkınca adım yaklaşık dört katına çıkar. | Watch the step count as n grows: 2 → 1, 3 → 3, 4 → 6, 5 → 10. Doubling n roughly quadruples the steps.
for n in [2, 3, 4, 5]:
    print(n, "eleman →", cift_say(n), "karşılaştırma")

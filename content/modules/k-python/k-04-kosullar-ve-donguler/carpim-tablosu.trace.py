#@ Dış döngü satırları, iç döngü sütunları dolaşır. Dış döngünün HER turunda iç döngü baştan sona çalışır. | The outer loop walks rows, the inner loop walks columns. On EVERY outer round the inner loop runs from start to end.
for satir in range(1, 4):
    #@ Her satır için boş bir liste: iç döngü bunu dolduracak. | An empty list for each row: the inner loop fills it.
    hucreler = []
    for sutun in range(1, 4):
        hucreler.append(satir * sutun)
    #@ İç döngü bitti; 'sutun' son değeri 3'te kaldı. Satır yazdırılıyor. | The inner loop is done; 'sutun' kept its last value 3. The row is printed.
    print(satir, "→", hucreler)
#@ 3 x 3 = 9 kez iç gövde çalıştı. Döngü değişkenleri döngüden sonra da yaşar. | The inner body ran 3 x 3 = 9 times. Loop variables still exist after the loop.
print("son değerler:", satir, sutun)

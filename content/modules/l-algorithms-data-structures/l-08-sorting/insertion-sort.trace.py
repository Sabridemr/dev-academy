def insertion_sort(dizi):
    for i in range(1, len(dizi)):
        #@ Solda dizi[0..i-1] zaten sıralı. 'anahtar' bu sıralı bölgeye doğru yerine yerleştirilecek. | dizi[0..i-1] on the left is already sorted. 'anahtar' will be inserted into its correct place there.
        anahtar = dizi[i]
        j = i - 1
        #@ Anahtardan büyük elemanları birer sağa kaydırıyoruz. '>' kullanıldığı için eşit elemanların sırası korunur: kararlı sıralama. | Elements larger than the key shift one step right. Using '>' keeps equal elements in order: a stable sort.
        while j >= 0 and dizi[j] > anahtar:
            dizi[j + 1] = dizi[j]
            j -= 1
        #@ Kaydırma bitti: açılan boşluğa anahtar yazılıyor. | Shifting is done: the key is written into the gap.
        dizi[j + 1] = anahtar
    return dizi


notlar = [5, 2, 4, 1, 3]
#@ Liste yerinde (in-place) sıralanır: fonksiyon aynı liste nesnesini değiştirir, kopya üretmez. | The list is sorted in place: the function mutates the same list object, no copy is made.
print(insertion_sort(notlar))

import heapq


def en_buyuk_k(sayilar, k):
    #@ k boyutlu bir MIN-heap tutacağız: kökte (heap[0]) şimdiye kadarki en büyük k sayının en küçüğü durur. | We keep a MIN-heap of size k: its root (heap[0]) holds the smallest of the k largest numbers seen so far.
    heap = []
    for x in sayilar:
        if len(heap) < k:
            #@ Heap henüz dolmadı: sayıyı ekle. heappush elemanı sona koyup yukarı kaydırır (sift-up). | The heap is not full yet: add the number. heappush appends it and sifts it up.
            heapq.heappush(heap, x)
        elif x > heap[0]:
            #@ Yeni sayı kökten büyük: kökü at, yeni sayıyı koy ve aşağı kaydır (sift-down). Tek işlemde O(log k). | The new number beats the root: pop the root, insert the new one and sift it down. One O(log k) operation.
            heapq.heapreplace(heap, x)
    #@ Heap'te tam olarak en büyük k sayı kaldı; yalnızca bu k elemanı sıralıyoruz. | Exactly the k largest numbers remain; we sort only these k elements.
    return sorted(heap, reverse=True)


#@ 7 sayı içinden en büyük 3'ü arıyoruz. Her adımda heap listesinin dizideki düzenini izle. | We look for the 3 largest of 7 numbers. Watch the heap list's array layout at each step.
print(en_buyuk_k([5, 1, 9, 3, 7, 12, 4], 3))

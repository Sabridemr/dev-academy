from collections import deque

komsular = {"A": ["B", "C"], "B": ["D"], "C": ["D", "E"],
            "D": ["F"], "E": ["F"], "F": []}


def bfs(baslangic):
    #@ deque iki uçtan da O(1) ekleme/çıkarma yapar; kuyruk olarak list.pop(0) yerine bunu kullanırız. | A deque adds and removes at both ends in O(1); we use it as a queue instead of list.pop(0).
    kuyruk = deque([baslangic])
    gorulen = {baslangic}
    sira = []
    while kuyruk:
        #@ FIFO: kuyruğa ilk giren düğüm ilk çıkar, bu yüzden düğümler katman katman ziyaret edilir. | FIFO: the node that entered first leaves first, so nodes are visited layer by layer.
        dugum = kuyruk.popleft()
        sira.append(dugum)
        for k in komsular[dugum]:
            if k not in gorulen:
                gorulen.add(k)
                kuyruk.append(k)
    return sira


print(bfs("A"))

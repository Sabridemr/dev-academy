from collections import deque

#@ Graf komşuluk listesiyle tutuluyor: her düğümün anahtarı, komşularının listesini gösterir. | The graph is stored as an adjacency list: each node key maps to the list of its neighbours.
graf = {
    "A": ["B", "C"],
    "B": ["A", "D"],
    "C": ["A", "D", "E"],
    "D": ["B", "C", "F"],
    "E": ["C", "F"],
    "F": ["D", "E"],
}


def bfs(baslangic):
    #@ mesafe sözlüğü hem 'ziyaret edildi' işaretini hem de kenar sayısı cinsinden uzaklığı tutar. | The mesafe dict is both the 'visited' mark and the distance in edges.
    mesafe = {baslangic: 0}
    kuyruk = deque([baslangic])
    while kuyruk:
        #@ FIFO: kuyruğun en önündeki (en eski eklenen) düğüm çıkıyor; böylece katman katman ilerleriz. | FIFO: the oldest node leaves the front of the queue, so we advance layer by layer.
        dugum = kuyruk.popleft()
        for komsu in graf[dugum]:
            if komsu not in mesafe:
                #@ Komşu ilk kez görülüyor: uzaklığı bir fazlası. Kuyruğa EKLERKEN işaretliyoruz ki iki kez eklenmesin. | First time we see this neighbour: its distance is one more. We mark it WHEN ENQUEUEING so it is never added twice.
                mesafe[komsu] = mesafe[dugum] + 1
                kuyruk.append(komsu)
    return mesafe


#@ Sonuçta F'ye uzaklık 3 çıkacak: A→B→D→F ya da A→C→E→F. | The distance to F will be 3: A→B→D→F or A→C→E→F.
print(bfs("A"))

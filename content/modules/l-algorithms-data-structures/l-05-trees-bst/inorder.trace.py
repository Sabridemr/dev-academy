class Dugum:
    def __init__(self, deger, sol=None, sag=None):
        self.deger = deger
        self.sol = sol
        self.sag = sag


def inorder(dugum, sonuc):
    #@ Taban durum: boş alt ağaca (None) gelince hiçbir şey yapmadan geri dön. Yığındaki çerçeve sayısına dikkat et. | Base case: on an empty subtree (None) return without doing anything. Watch how many frames are on the stack.
    if dugum is None:
        return
    #@ Önce sol alt ağacın tamamı gezilecek; bu çağrı yeni bir çerçeve açar. | First the whole left subtree is visited; this call opens a new frame.
    inorder(dugum.sol, sonuc)
    #@ Sol taraf bitti: şimdi düğümün kendisi listeye eklenir. BST'de bu, değerlerin küçükten büyüğe çıkması demek. | The left side is done: now the node itself is appended. In a BST this means values come out in ascending order.
    sonuc.append(dugum.deger)
    inorder(dugum.sag, sonuc)


#@ Elle kurulmuş küçük bir BST: kök 8, solunda 3 (1 ve 6 ile), sağında 10 (sağ çocuğu 14). | A small hand-built BST: root 8, 3 on its left (with 1 and 6), 10 on its right (right child 14).
kok = Dugum(8, Dugum(3, Dugum(1), Dugum(6)), Dugum(10, None, Dugum(14)))
sonuc = []
inorder(kok, sonuc)
#@ Ağaç karışık sırayla kurulmuştu ama inorder çıktısı sıralı: [1, 3, 6, 8, 10, 14]. | The tree was built in mixed order, but the inorder output is sorted: [1, 3, 6, 8, 10, 14].
print(sonuc)

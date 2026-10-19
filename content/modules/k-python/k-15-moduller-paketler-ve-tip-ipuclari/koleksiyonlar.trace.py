import collections

kelimeler = ["elma", "armut", "elma", "kiraz", "elma"]
#@ `Counter`, dict'in bir alt sınıfı: her öğenin kaç kez geçtiğini tek satırda sayar. | `Counter` is a dict subclass: it counts how many times each item appears in one line.
sayac = collections.Counter(kelimeler)
print(sayac.most_common(1))
#@ `defaultdict(list)`: olmayan bir anahtara erişildiğinde `list()` çağrılır ve boş liste kendiliğinden oluşur. | `defaultdict(list)`: when a missing key is accessed, `list()` is called and an empty list appears automatically.
gruplar = collections.defaultdict(list)
for k in kelimeler:
    gruplar[k[0]].append(k)
print(dict(gruplar))
#@ `deque(maxlen=3)`: iki uçtan hızlı ekleme/çıkarma yapılan kuyruk. Dolunca en eski öğe kendiliğinden atılır. | `deque(maxlen=3)`: a queue with fast appends and pops at both ends. When full, the oldest item is dropped automatically.
son_uc = collections.deque(maxlen=3)
for i in range(5):
    son_uc.append(i)
print(son_uc)

import gc


class Dugum:
    def __init__(self, ad):
        self.ad = ad
        self.komsu = None


x = Dugum("X")
y = Dugum("Y")
#@ Şimdi X, Y'yi gösterecek; ardından Y de X'i gösterecek. İki nesne bir döngü (cycle) kuracak. | Now X will point to Y, then Y will point back to X. The two objects will form a reference cycle.
x.komsu = y
y.komsu = x
#@ Okları takip et: x.komsu Y'dir, Y'nin komsusu yine X. | Follow the arrows: x.komsu is Y, and Y's neighbour is X again.
print(x.komsu.komsu.ad)
#@ 'x' ismi silinse de X nesnesi kalır: Y'nin 'komsu' alanı onu hâlâ gösteriyor. | Deleting the name 'x' does not free X: Y's 'komsu' field still refers to it.
del x
#@ Son isim de gidiyor. Bundan sonra iki nesneye de hiçbir isimden ulaşılamaz, ama birbirlerini gösterdikleri için sayaçları 1'de kalır. | The last name goes too. After this no name can reach either object, yet each still counts 1 because they point at each other.
del y
#@ Heap görünümü yalnızca erişilebilir nesneleri çizer, bu yüzden X ve Y kayboldu. Gerçekte bellekteler; onları ancak döngüsel çöp toplayıcı bulup silebilir. | The heap view draws only reachable objects, so X and Y disappeared. In reality they are still in memory; only the cyclic garbage collector can find and free them.
gc.collect()
print("toplama bitti")

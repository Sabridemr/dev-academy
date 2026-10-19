_onbellek = {}


def kullanici_getir(kid):
    if kid not in _onbellek:
        #@ Yeni sözlük global önbelleğe ekleniyor. Önbellek global olduğu için bu nesne program bitene kadar yaşayacak. | A new dict is added to the global cache. Because the cache is global, this object will live until the program ends.
        _onbellek[kid] = {"id": kid, "ad": "kullanici" + str(kid)}
    return _onbellek[kid]


#@ Her turda 'kid' sıradaki kimliğe bağlanır ve önbelleğe yeni bir kayıt eklenir; 'k' ismi dönen kayda taşınır. | Each turn binds 'kid' to the next id and adds a new cache entry; the name 'k' moves to the returned entry.
for kid in [1, 2, 3]:
    k = kullanici_getir(kid)
#@ 'k' artık son kullanıcıyı gösteriyor ama ilk ikisi silinmedi: önbellek sözlüğü onları tutuyor. Sınırsız büyüyen önbellek bir sızıntıdır. | 'k' now shows only the last user, but the first two were not freed: the cache dict holds them. An unbounded cache is a leak.
print(len(_onbellek))
#@ Önbelleği temizlemek referansları bırakır: 1 ve 2 numaralı kayıtlar erişilemez olup serbest kalır, 3 numara ise 'k' onu tuttuğu için yaşamaya devam eder. | Clearing the cache drops its references: entries 1 and 2 become unreachable and are freed, while entry 3 survives because 'k' still holds it.
_onbellek.clear()
print(len(_onbellek), k["ad"])

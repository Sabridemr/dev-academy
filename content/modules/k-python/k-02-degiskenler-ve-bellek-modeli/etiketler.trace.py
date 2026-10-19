#! heap-primitives
#@ Program başlıyor: global çerçeve boş, heap'te henüz bizim oluşturduğumuz nesne yok. | The program starts: the global frame is empty and no objects exist yet.
yas = 30
#@ 30 değerinde bir int nesnesi oluştu ve 'yas' etiketi ona bağlandı. Şimdi 'kopya' aynı nesneye ikinci bir etiket olarak bağlanacak; yeni nesne oluşmaz. | An int object 30 was created and 'yas' was bound to it. Now 'kopya' becomes a second label on the same object; no new object is created.
kopya = yas
#@ int değiştirilemez (immutable): yas + 1 yeni bir nesne (31) üretir ve 'yas' etiketi oraya taşınır. 'kopya' hâlâ 30'u gösteriyor. | int is immutable: yas + 1 creates a new object (31) and the label 'yas' moves to it. 'kopya' still points to 30.
yas = yas + 1
isim = "Ada"
#@ Stringler de değiştirilemez: birleştirme yeni bir str nesnesi üretir, eski "Ada" yerinde kalır. | Strings are immutable too: concatenation creates a new str object; "Ada" stays as it is.
selam = "Merhaba " + isim
#@ Artık 30'a 'kopya' dışında bağlı etiket yok; yeniden bağlarsak 30 erişilemez olur ve Python onu temizleyebilir. | Only 'kopya' still refers to 30; rebinding it makes 30 unreachable, and Python may reclaim it.
kopya = None
print(yas, selam)

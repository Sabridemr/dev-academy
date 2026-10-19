import io


class Kaynak:
    def __init__(self, ad):
        self.ad = ad
        self.acik = False

    def __enter__(self):
        self.acik = True  #@ with satırı __enter__'ı çağırdı. Bu metodun döndüreceği değer 'as' ile verilen isme (k) bağlanacak. | The with statement called __enter__. The value this method returns will be bound to the name after 'as' (k).
        print("aç:", self.ad)
        return self

    def __exit__(self, tur, deger, iz):
        #@ Blok bir hatayla yarıda kaldı ama __exit__ yine de çağrıldı. tur, deger, iz hatanın bilgisini taşıyor. | The block was cut short by an error, but __exit__ is still called. tur, deger, iz carry the error's details.
        self.acik = False
        print("kapat:", self.ad, "| hata:", tur.__name__ if tur else "yok")
        return False  #@ False dönmek "hatayı yutma" demektir: istisna with'in dışına yayılmaya devam eder. | Returning False means "don't swallow the error": the exception keeps propagating out of the with.


tampon = io.StringIO()
try:
    #@ with önce Kaynak(...) nesnesini oluşturur ve __enter__'ını çağırır; blok bitince (hata olsa bile) __exit__'ı çağırır. | with first creates the Kaynak(...) object and calls its __enter__; when the block ends (even with an error) it calls __exit__.
    with Kaynak("rapor.txt") as k:
        tampon.write("başlık\n")  #@ Gerçek dosya yerine bellekteki io.StringIO'ya yazıyoruz; davranış aynı. | We write to an in-memory io.StringIO instead of a real file; the behaviour is the same.
        int("bozuk")  #@ Bu satır ValueError fırlatacak. with bloğu yarıda kalır ama önce __exit__ çalışır. | This line will raise ValueError. The with block is cut short, but __exit__ runs first.
except ValueError as e:
    print("yakalandı:", e)
print(k.acik, repr(tampon.getvalue()))

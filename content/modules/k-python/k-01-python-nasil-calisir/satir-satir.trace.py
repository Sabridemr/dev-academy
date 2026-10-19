#@ Program başlıyor. Yorumlayıcı dosyayı en üstten okumaya başlar; global çerçevede henüz hiçbir isim yok. | The program starts. The interpreter begins at the top; the global frame has no names yet.
print("Program başladı")
#@ İlk print çalıştı ve Çıktı paneline yazdı. Şimdi 'urun' adı bir metne bağlanacak. | The first print ran and wrote to Output. Now the name 'urun' is bound to a string.
urun = "Kalem"
fiyat = 12
adet = 3
#@ Sağ taraf önce hesaplanır (12 * 3 = 36), sonra 'toplam' adı sonuca bağlanır. | The right side is evaluated first (12 * 3 = 36), then 'toplam' is bound to the result.
toplam = fiyat * adet
print(f"{adet} adet {urun}: {toplam} TL")
#@ Bir ismi yeniden bağlamak eski satırları geri çalıştırmaz: 'fiyat' 15 olacak ama 'toplam' 36 kalacak. | Rebinding a name does not re-run earlier lines: 'fiyat' becomes 15 but 'toplam' stays 36.
fiyat = 15
print("Yeni fiyat:", fiyat, "| toplam hâlâ:", toplam)
#@ Güncel toplamı istiyorsan hesabı yeniden yazman gerekir. | If you want the current total, you have to compute it again.
toplam = fiyat * adet
indirim = toplam // 10
odenecek = toplam - indirim
print("Toplam:", toplam, "İndirim:", indirim, "Ödenecek:", odenecek)
#@ Son satır. Bundan sonra program biter; çıktıdaki sıra, satırların çalışma sırasıyla aynı. | Last line. After it the program ends; the output order matches the order lines ran in.
print("Program bitti")

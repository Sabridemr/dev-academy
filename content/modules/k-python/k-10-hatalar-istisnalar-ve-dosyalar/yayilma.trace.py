def yas_coz(metin):
    #@ Metin sayı değilse int() ValueError fırlatır. Bu çerçevede try yok: hata bir üst çerçeveye (kayit_olustur) yayılır. | If the text is not a number, int() raises ValueError. There is no try in this frame: the error propagates to the caller (kayit_olustur).
    return int(metin)


def kayit_olustur(ad, yas_metni):
    yas = yas_coz(yas_metni)  #@ Yeni çerçeve açılıyor. Hata çıkarsa bu çerçevede de try olmadığı için bu fonksiyon da yarıda kalır. | A new frame opens. If an error occurs, this function has no try either, so it is abandoned too.
    return {"ad": ad, "yas": yas}


def kaydet(veriler):
    kayitlar = []
    for ad, yas in veriler:
        try:
            #@ İki çerçeve derinde bir hata olursa bu try onu yakalar; ara çerçeveler kapanmış olur. | If an error happens two frames deeper, this try catches it; the frames in between will have been closed.
            kayitlar.append(kayit_olustur(ad, yas))
        except ValueError as hata:
            print("atlandı:", ad, "->", hata)  #@ Yığına bak: yas_coz ve kayit_olustur çerçeveleri gitti, yalnızca kaydet kaldı. 'hata' istisna nesnesine bağlı. | Look at the stack: the yas_coz and kayit_olustur frames are gone, only kaydet remains. 'hata' is bound to the exception object.
    return kayitlar


sonuc = kaydet([("Ada", "36"), ("Linus", "otuz")])
print(sonuc)

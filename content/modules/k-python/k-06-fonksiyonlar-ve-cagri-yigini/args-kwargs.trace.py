def kaydet(seviye, *mesajlar, **etiketler):
    #@ Fazla konumsal argümanlar 'mesajlar' tuple'ında, isimli olanlar 'etiketler' sözlüğünde toplandı. | Extra positional args were collected into the tuple 'mesajlar', keyword args into the dict 'etiketler'.
    satir = seviye + ": " + " ".join(mesajlar)
    for anahtar, deger in etiketler.items():
        satir += " " + anahtar + "=" + str(deger)
    print(satir)
    return satir


kaydet("INFO", "sunucu", "başladı", port=8080)
parcalar = ["disk", "dolu"]
ayarlar = {"kod": 507, "kritik": True}
#@ * listeyi konumsal argümanlara, ** sözlüğü isimli argümanlara açar. | * unpacks the list into positional args, ** unpacks the dict into keyword args.
kaydet("HATA", *parcalar, **ayarlar)

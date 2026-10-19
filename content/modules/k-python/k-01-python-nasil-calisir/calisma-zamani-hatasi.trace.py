#@ Dosyanın sözdizimi doğru olduğu için derlendi ve çalışmaya başladı. Hatalar, satırlarına gelinince ortaya çıkacak. | The file has valid syntax, so it compiled and started running. Errors only appear when their lines are reached.
print("1. adım: hazırlık")
sayac = 10
isim = "Ada"
print("2. adım: sayaç =", sayac)
#@ Metin ile sayı f-string içinde sorunsuz birleşir: f-string her değeri metne çevirir. | Text and a number combine fine inside an f-string: it converts every value to text.
mesaj = f"{isim} için sayaç {sayac}"
print("3. adım:", mesaj)
sayac = sayac + 5
#@ Burada 'sayc' diye yazım hatası var. Python bu ismi global çerçevede ve yerleşik isimlerde arayacak, bulamayacak: NameError. | There is a typo here: 'sayc'. Python looks it up in the global frame and the builtins, fails, and raises NameError.
print("4. adım:", sayc + 1)
#@ Bu satıra hiç gelinmez: yakalanmamış hata programı durdurur. | This line is never reached: the uncaught error stops the program.
print("5. adım: bitti")

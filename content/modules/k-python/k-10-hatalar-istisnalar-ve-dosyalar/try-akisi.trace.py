def bol(a, b):
    #@ try bloğu "korunan bölge"dir: buradaki satırlardan biri hata fırlatırsa kalan try satırları atlanır ve uygun except aranır. | The try block is a "protected region": if a line here raises, the rest of the try is skipped and a matching except is searched for.
    try:
        sonuc = a / b  #@ Bölme burada deneniyor. b sıfırsa ZeroDivisionError fırlar ve akış doğrudan except'e atlar. | The division is attempted here. If b is zero, ZeroDivisionError is raised and control jumps straight to except.
    except ZeroDivisionError:
        print("except: sıfıra bölünemez")  #@ Hata yakalandı: except bloğu çalışıyor. else bu çağrıda atlanacak. | The error was caught: the except block runs. else will be skipped in this call.
        sonuc = None
    else:
        print("else: hata yok, sonuc =", sonuc)  #@ else yalnızca try hiç hata fırlatmadan bittiğinde çalışır. | else runs only when the try finished without raising.
    finally:
        print("finally: her durumda çalışır")  #@ finally, hata olsa da olmasa da çalışır: temizlik kodu için doğru yer. | finally runs whether or not an error happened: the right place for cleanup.
    return sonuc


#@ Birinci yol: hata yok. try → else → finally sırasını izle. | First path: no error. Watch try → else → finally.
x = bol(10, 4)
#@ İkinci yol: b = 0. try → except → finally sırasını izle; else atlanacak. | Second path: b = 0. Watch try → except → finally; else will be skipped.
y = bol(1, 0)
print(x, y)

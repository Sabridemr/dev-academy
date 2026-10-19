def selamla(isim):
    return f"Merhaba, {isim}!"


def main():
    #@ `main()` yalnızca dosya doğrudan çalıştırıldığında çağrıldı; programın asıl işi burada başlıyor. | `main()` was called only because the file was run directly; the program's real work starts here.
    print(selamla("Ada"))


#@ Python her modüle `__name__` adlı bir değişken verir. İzleyici bu kodu doğrudan (betik olarak) çalıştırıyor, bu yüzden değeri "__main__". | Python gives every module a variable called `__name__`. The visualizer runs this code directly (as a script), so its value is "__main__".
print("__name__ =", __name__)
#@ Koşul doğru. Bu dosya başka bir dosyadan `import` edilseydi `__name__` dosyanın adı olurdu ve `main()` çağrılmazdı. | The condition is true. If this file were imported from another file, `__name__` would be the file's name and `main()` would not be called.
if __name__ == "__main__":
    main()

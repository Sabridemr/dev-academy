sayac = {"deger": 0}


def artir(ad):
    #@ 1. adım: ortak değeri oku ve yerel bir değişkende tut. | Step 1: read the shared value and keep it in a local variable.
    gecici = sayac["deger"]
    #@ Gerçek thread'lerde işletim sistemi tam burada başka thread'e geçebilir. yield bu geçişi taklit ediyor. | With real threads the OS may switch to another thread right here. yield imitates that switch.
    yield
    #@ 2. adım: okunan eski değerin bir fazlasını yaz. Bu arada değer değişmişse o değişikliğin üstüne yazılır. | Step 2: write the old value plus one. If the value changed in the meantime, that change is overwritten.
    sayac["deger"] = gecici + 1
    print(ad, "yazdı:", sayac["deger"])


t1 = artir("T1")
t2 = artir("T2")
#@ T1 değeri okuyor (0) ve duruyor. | T1 reads the value (0) and pauses.
next(t1, None)
#@ T1 yazmadan önce T2 de aynı değeri okuyor (0). Yarış burada başlıyor. | Before T1 writes, T2 reads the same value (0). This is where the race begins.
next(t2, None)
next(t1, None)
#@ T1 1 yazdı. Şimdi T2, elindeki eski 0 değerine göre yine 1 yazacak: bir artış kayboluyor. | T1 wrote 1. Now T2 will write 1 again based on its stale 0: one increment is lost.
next(t2, None)
#@ İki kez artırdık ama sonuç 1. Buna yarış durumu (race condition) denir; çözüm oku-yaz bölümünü kilitle korumaktır. | We incremented twice but got 1. This is a race condition; the fix is to guard the read-write section with a lock.
print("sonuç:", sayac["deger"])

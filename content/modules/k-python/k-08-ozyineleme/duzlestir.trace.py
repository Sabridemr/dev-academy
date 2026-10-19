def duzlestir(veri):
    sonuc = []
    for oge in veri:
        #@ Eleman yine bir listeyse aynı problemi daha küçük bir parça için çöz: kendini çağır. | If the item is itself a list, solve the same problem for a smaller piece: call yourself.
        if isinstance(oge, list):
            #@ Alt çağrının döndürdüğü düz liste bu çerçevenin 'sonuc' listesine eklenir. | The flat list returned by the inner call is appended to this frame's own 'sonuc' list.
            sonuc.extend(duzlestir(oge))
        else:
            sonuc.append(oge)
    return sonuc


#@ İç içe derinlik önceden bilinmiyor: döngüyle yazmak zor, özyinelemeyle doğal. | The nesting depth is not known in advance: hard with loops, natural with recursion.
ic_ice = [1, [2, [3, 4]], 5]
duz = duzlestir(ic_ice)
print(duz)

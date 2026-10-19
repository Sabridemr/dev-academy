def hatali_olustur():
    fonksiyonlar = []
    for i in range(3):
        #@ lambda o anki DEĞERİ saklamaz; 'i' değişkeninin hücresini (cell) yakalar. Üç lambda da aynı hücreyi paylaşacak. | The lambda does not store the current VALUE; it captures the cell of variable 'i'. All three lambdas will share that one cell.
        fonksiyonlar.append(lambda: i)
    return fonksiyonlar


def dogru_olustur():
    fonksiyonlar = []
    for i in range(3):
        #@ Varsayılan argüman 'i=i' tanım anında değerlendirilir: her lambda o turdaki değeri kendi içinde saklar. | The default 'i=i' is evaluated at definition time: each lambda keeps that iteration's value.
        fonksiyonlar.append(lambda i=i: i)
    return fonksiyonlar


#@ hatali_olustur üç lambda üretecek, sonra hepsi sırayla çağrılacak. Döngü bitince paylaşılan hücrede i = 2 kalacağı için hepsi 2 döndürür. | hatali_olustur builds three lambdas, then each is called. After the loop the shared cell holds i = 2, so they all return 2.
print([f() for f in hatali_olustur()])
print([f() for f in dogru_olustur()])

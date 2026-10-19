def gorev(ad, adim):
    for i in range(1, adim + 1):
        print(ad, "adım", i)
        #@ yield görevi burada dondurur ve kontrolü zamanlayıcıya geri verir; yerel değişkenler saklanır. | yield freezes the task here and hands control back to the scheduler; its locals are kept.
        yield


#@ gorev(...) çağrısı gövdeyi çalıştırmaz, yalnızca iki generator nesnesi üretir. | Calling gorev(...) does not run the body; it only creates two generator objects.
kuyruk = [gorev("A", 1), gorev("B", 2)]
while kuyruk:
    #@ Zamanlayıcı kuyruğun başındaki görevi alıyor: olay döngüsünün yaptığı iş de budur. | The scheduler takes the task at the front of the queue: this is exactly what an event loop does.
    g = kuyruk.pop(0)
    try:
        #@ next(g) görevi kaldığı yerden bir sonraki yield'e kadar çalıştırır. | next(g) resumes the task from where it stopped until its next yield.
        next(g)
        #@ Görev bitmedi: kuyruğun sonuna geri ekleniyor. Sırada başka görev varsa önce o çalışacak. | The task is not finished: it goes back to the end of the queue. If another task is waiting, that one runs first.
        kuyruk.append(g)
    except StopIteration:
        #@ Görevin döngüsü bitti ve generator StopIteration fırlattı: kuyruğa geri eklenmiyor. | The task's loop ended and the generator raised StopIteration: it is not put back in the queue.
        print("bir görev bitti")
print("tüm görevler bitti")

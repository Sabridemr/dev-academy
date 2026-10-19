import asyncio


async def indir(ad):
    #@ Coroutine çalışmaya başladı; olay döngüsü onu bir görev (Task) olarak çalıştırıyor. | The coroutine started running; the event loop runs it as a Task.
    print(ad, "başladı")
    #@ await noktasında coroutine askıya alınır ve olay döngüsü sıradaki görevi çalıştırır. | At the await the coroutine is suspended and the event loop runs the next task.
    await asyncio.sleep(0)
    #@ Olay döngüsü bu coroutine'i kaldığı yerden devam ettirdi; yerel değişkenler aynen duruyor. Az önceki StopIteration adımı, beklenen işin bittiğini bildiren iç mekanizmadır, hata değil. | The event loop resumed this coroutine where it left off; its locals are intact. The StopIteration step just before is the internal signal that the awaited work finished, not an error.
    print(ad, "bitti")
    return ad.upper()


async def main():
    #@ gather iki coroutine'i görev olarak planlar ve ikisi de bitene kadar main'i askıya alır. | gather schedules both coroutines as tasks and suspends main until both finish.
    sonuclar = await asyncio.gather(indir("a"), indir("b"))
    print(sonuclar)


#@ asyncio.run bir olay döngüsü oluşturur, main() coroutine'ini çalıştırır ve sonunda döngüyü kapatır. | asyncio.run creates an event loop, runs the main() coroutine and closes the loop at the end.
asyncio.run(main())

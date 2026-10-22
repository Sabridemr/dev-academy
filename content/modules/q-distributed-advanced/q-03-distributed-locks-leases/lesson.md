---
id: q-03-distributed-locks-leases
slug: distributed-locks-leases
module: q-distributed-advanced
order: 3
title:
  tr: "Dağıtık Kilit, Lease ve Fencing Token"
  en: "Distributed Locks, Leases and Fencing Tokens"
summary:
  tr: ZooKeeper ve etcd ile kilit ve lider seçimi pratiği; lease süresi dolan kilidin tehlikesi, fencing token ve Redlock tartışması.
  en: Locks and leader election in practice with ZooKeeper and etcd; the danger of an expired lease, fencing tokens and the Redlock debate.
durationMinutes: 30
level: advanced
prerequisites: [q-02-consensus-raft]
tags: [distributed-systems, locks, leases, etcd, zookeeper, redis]
concepts: [distributed-lock, lease, fencing-token, process-pause, ephemeral-node, lease-keepalive, redlock, leader-election]
---

## Kavram: tek makinedeki mutex'in dağıtık hâli

Tek bir süreçte iki iş parçacığının aynı kaynağa aynı anda dokunmasını bir mutex ile engellersiniz. Dağıtık sistemde aynı ihtiyaç farklı biçimlerde karşınıza çıkar: gece raporunu üç sunucudan yalnızca biri üretmeli, bir dosyayı aynı anda tek bir işçi güncellemeli, bir Kubernetes denetleyicisinin yalnızca bir kopyası aktif olmalı. Bunların hepsi **dağıtık kilit** ya da onun özel bir hâli olan **lider seçimi** problemidir.

Martin Kleppmann bu kilitleri amaçlarına göre ikiye ayırır, ve bu ayrım doğru aracı seçmenin anahtarıdır:

- **Verimlilik (efficiency) için kilit:** Aynı işin iki kez yapılmasını önler. Kilit arada bir başarısız olsa bile sonuç biraz fazladan maliyettir; örneğin aynı e-posta iki kez gider ya da rapor iki kez üretilir.
- **Doğruluk (correctness) için kilit:** Kilit başarısız olursa veri bozulur, para iki kez çekilir, dosyanın yarısı bir istemciden yarısı diğerinden gelir. Burada "çoğunlukla çalışır" yeterli değildir.

## Neden kilit değil de lease?

Dağıtık kilidin klasik tuzağı şudur: kilidi alan süreç çökerse kilit sonsuza kadar tutulu kalır. Çözüm, kilidi bir süreyle sınırlamaktır. Bu süreli kilide **lease (kira)** denir: "bu kaynak 10 saniye boyunca senin". Sahip süreç yaşadığını göstermek için lease'i düzenli olarak yeniler (keepalive); yenilemezse süre dolar ve kilit başkasına geçer.

- **ZooKeeper:** İstemci bir oturum (session) açar ve `/locks/rapor-` altında **ephemeral sequential** bir düğüm oluşturur. En küçük sıra numarasına sahip istemci kilidi tutar; diğerleri yalnızca kendinden hemen önceki düğümü izler (watch), böylece kilit bırakıldığında herkes aynı anda uyanmaz. Oturum zaman aşımına uğrarsa ephemeral düğüm otomatik silinir.
- **etcd:** İstemci TTL'li bir **lease** alır, kilit anahtarını bu lease'e bağlar ve `KeepAlive` ile yeniler. Lease bittiğinde bağlı anahtarlar silinir. etcd'nin `concurrency` paketi kilit ve lider seçimini bu temel üzerine kurar.

İkisi de bir önceki dersteki konsensüs üzerinde çalışır (ZooKeeper kendi ZAB protokolüyle, etcd Raft ile). Yani kilit servisinin kendisi tek bir düğümün çökmesiyle yanlış karar vermez. Sorun kilit servisinde değil, **kilidi tuttuğunu sanan istemcidedir**.

:::diagram{src="diagram.svg" alt="Lease zaman çizelgesi: istemci 1 kilidi token 33 ile alır, GC duraklamasında lease biter, istemci 2 token 34 alır, depolama eski token 33'lü yazmayı reddeder|Lease timeline: client 1 takes the lock with token 33, its lease expires during a GC pause, client 2 gets token 34, storage rejects the stale write with token 33"}
Zaman soldan sağa akar. Gri bant istemci 1'in duraklamasını, kesikli çizgi lease'in bittiği anı gösterir.
:::

## Süresi dolan kilidin tehlikesi

Şu senaryoyu düşünün: İstemci 1, 10 saniyelik lease ile kilidi alır, depodaki dosyayı okur ve yazmaya hazırlanır. Tam o anda JVM'in çöp toplayıcısı uygulamayı 15 saniye durdurur (stop-the-world GC). Bu sırada lease biter, kilit servisi kilidi istemci 2'ye verir, istemci 2 dosyayı günceller. GC biter, istemci 1 kaldığı yerden devam eder ve **hâlâ kilidi tuttuğunu sanarak** eski veriye dayalı yazmasını yapar. İstemci 2'nin değişikliği ezilir.

Bunu "yazmadan hemen önce lease'in süresini kontrol ederim" diye çözemezsiniz: kontrol ile yazma arasında da bir duraklama olabilir. Duraklamanın kaynağı yalnızca GC değildir; sanal makinenin canlı taşınması, diske takas (swap), yavaş bir ağ paketi ya da işletim sisteminin süreci uzun süre zamanlamaması da aynı etkiyi yaratır. Ayrıca istemcinin saati kayabilir (Q-01): istemci "lease'imin 3 saniyesi kaldı" derken kilit servisinin saatine göre süre çoktan dolmuş olabilir.

:::predict{id="lease-gc-pause"}
İstemci 1, 10 saniyelik bir lease ile kilidi aldı ve hemen ardından 15 saniyelik bir GC duraklamasına girdi. Bu sırada istemci 2 kilidi aldı ve depoya yazdı. İstemci 1 uyanıp yazarsa, fencing token kullanılmıyorsa ne olur? | Client 1 took the lock with a 10-second lease and immediately hit a 15-second GC pause. Meanwhile client 2 took the lock and wrote to storage. If client 1 wakes up and writes, what happens when no fencing token is used?
- [ ] Kilit servisi istemci 1'in yazmasını engeller | The lock service blocks client 1's write
- [x] Depo yazmayı kabul eder ve istemci 2'nin değişikliği ezilir | Storage accepts the write and client 2's change is overwritten
- [ ] İstemci 1'in yazması otomatik olarak istemci 2'ninkiyle birleştirilir | Client 1's write is automatically merged with client 2's
Açıklama: Kilit servisi depoya giden yazmaların yolunda değildir; yalnızca kimin kilidi tuttuğunu bilir. Depo da kilitten habersizse istemci 1'in gecikmiş yazmasını normal bir yazma gibi kabul eder. Çözüm, deponun her yazmada artan bir fencing token istemesi ve gördüğü en büyük token'dan küçük olanları reddetmesidir. | The lock service is not on the path of writes to storage; it only knows who holds the lock. If storage is unaware of the lock too, it accepts client 1's delayed write as a normal write. The fix is for storage to require a monotonically increasing fencing token on every write and reject any token lower than the largest it has seen.
:::

:::animation{scene="scene.json"}
İstemci 1 kilidi token 33 ile alır ve GC duraklamasına girer; lease biter, istemci 2 token 34 alıp yazar; uyanan istemci 1'in token 33'lü yazması depoda reddedilir.
:::

## Fencing token: kararı depoya taşımak

Çözüm, kilit servisinin her kilit verişinde **monoton artan bir sayı** (fencing token) üretmesi ve kaynağın (veritabanı, dosya deposu) her yazmada bu sayıyı istemesidir. Depo şimdiye kadar gördüğü en büyük token'ı saklar ve daha küçük token'lı yazmaları reddeder. Böylece istemci ne kadar duraklarsa duraklasın, eski bir lease'e dayalı yazma kaynağa ulaşamaz. Doğruluğu artık istemcinin "kilidim var mı?" tahmini değil, kaynağın kendi kontrolü sağlar.

Token'ı nereden alırsınız? ZooKeeper'da düğümün `zxid`'i ya da sıra numarası, etcd'de anahtarın `revision` değeri bu iş için uygundur; ikisi de konsensüsle sıralanmış, yalnızca artan sayılardır. Google'ın Chubby kilit servisi de aynı fikri "sequencer" adıyla sunar.

:::code{lang="ts" title="Depo tarafında fencing kontrolü: koşullu güncelleme"}
```ts
// Her kaynağın gördüğü en büyük token'ı aynı satırda tutuyoruz.
// Koşullu UPDATE atomiktir: kontrol ile yazma arasında yarış yoktur.
export async function writeWithFence(db: Db, fileId: string, content: string, token: number) {
  const result = await db.query(
    `UPDATE files
        SET content = $1, fence = $2
      WHERE id = $3 AND fence < $2`,
    [content, token, fileId],
  );
  if (result.rowCount === 0) {
    throw new Error(`Eski fencing token (${token}): kilit artık başkasında`);
  }
}
```
```python
def write_with_fence(db, file_id: str, content: str, token: int) -> None:
    # Koşullu güncelleme: yalnızca daha büyük token yazabilir
    cur = db.execute(
        "UPDATE files SET content = %s, fence = %s WHERE id = %s AND fence < %s",
        (content, token, file_id, token),
    )
    if cur.rowcount == 0:
        raise RuntimeError(f"Eski fencing token ({token}): kilit artık başkasında")
```
:::

Fencing'in bir şartı vardır: kaynağın token'ı kontrol edebilmesi gerekir. Kontrol edemeyen bir dış servise (ör. bir ödeme sağlayıcısı) yazıyorsanız, idempotency anahtarı gibi başka bir koruma eklemelisiniz (Q-06'da ve I-03'te).

:::realworld{company="Redis / Redlock tartışması"}
Redis, birden fazla bağımsız Redis sunucusu üzerinde çalışan **Redlock** adlı bir dağıtık kilit algoritması önermiştir: istemci kilidi beş bağımsız ana sunucunun çoğunluğundan belirli bir süre içinde alabilirse kilidi tuttuğunu kabul eder. Martin Kleppmann 2016'da yayımladığı "How to do distributed locking" yazısında bu algoritmanın doğruluk gerektiren durumlar için güvenli olmadığını savundu. Gerekçeleri bu dersin konusudur: algoritma süreç duraklamalarının, ağ gecikmelerinin ve saat sıçramalarının sınırlı olduğunu varsayar, ve kilit monoton artan bir fencing token üretmediği için duraklamadan uyanan istemcinin yazmasını depo ayırt edemez. Redis'in yaratıcısı Salvatore Sanfilippo (antirez) bir yanıt yazısıyla bu eleştirilere itiraz etti ve tartışma topluluğun kilitleri daha dikkatli düşünmesine yol açtı. Kleppmann'ın önerisi pratik bir ayrımdır: yalnızca verimlilik için kilit gerekiyorsa tek bir Redis sunucusunda `SET anahtar değer NX PX 30000` yeterlidir; doğruluk gerekiyorsa ZooKeeper ya da etcd gibi konsensüs tabanlı bir sistem **ve** fencing token kullanılmalıdır.
:::

## Pratikte lider seçimi

Lider seçimi, "lider" adlı tek bir kaynağın kilidini almaktır. **Kubernetes** bunu `coordination.k8s.io` API grubundaki **Lease** nesneleriyle yapar: kube-controller-manager ve kube-scheduler gibi bileşenlerin birden fazla kopyası çalışır, ama yalnızca Lease nesnesini tutan kopya aktif iş yapar ve Lease'i düzenli olarak yeniler. Lease nesnesi etcd'de saklandığı için bu seçim dolaylı olarak Raft'a dayanır. Kendi denetleyicinizi yazarken client-go kütüphanesindeki leader election paketi aynı mekanizmayı kullanır.

Lider seçiminde de fencing aynı ölçüde önemlidir: duraklayan eski lider uyanıp "hâlâ lider benim" diyerek iş yapabilir. Q-02'deki Raft terimleri tam olarak bu sorunu konsensüs grubunun içinde çözer; dış kaynaklara yazarken ise terim ya da revision değerini fencing token olarak taşımanız gerekir.

:::callout{tone="danger" title="Lease süresini kısaltmak çözüm değildir"}
"GC 15 saniye sürüyorsa lease'i 60 saniye yapalım" yaklaşımı yalnızca olasılığı azaltır; duraklamanın üst sınırı yoktur. Kısa lease'ler ise gereksiz lider değişimlerine yol açar. Lease süresini kullanılabilirlik için ayarlayın; doğruluğu ise her zaman fencing token ya da koşullu yazma ile sağlayın.
:::

:::callout{tone="tip" title="Mülakat özeti"}
- Önce sorun: kilit **verimlilik** için mi, **doğruluk** için mi? Verimlilik için tek Redis yeter.
- Lease = süreli kilit; sahip çökerse kilit kendiliğinden serbest kalır. ZooKeeper ephemeral düğüm, etcd lease + KeepAlive.
- Tehlike: GC/VM duraklaması ya da saat kayması yüzünden süresi dolmuş lease'le yazma.
- Çözüm: monoton artan fencing token, kontrolü kaynakta (koşullu UPDATE).
- Redlock tartışması: zamanlama varsayımları ve fencing eksikliği (Kleppmann, 2016).
:::

:::quiz{src="quiz.json"}
:::

:::resources
- [How to do distributed locking](https://martin.kleppmann.com/2016/02/08/how-to-do-distributed-locking.html) — blog — Martin Kleppmann'ın Redlock eleştirisi ve fencing token
- [ZooKeeper Recipes and Solutions](https://zookeeper.apache.org/doc/current/recipes.html) — belge — kilit ve lider seçimi tarifleri
- [Kubernetes: Leases](https://kubernetes.io/docs/concepts/architecture/leases/) — belge — Lease nesneleri ve bileşenlerin lider seçimi
- [etcd documentation](https://etcd.io/docs/) — belge — lease, KeepAlive ve revision kavramları
:::

:::next{lesson="q-04-consistency-models"}
Sırada: "en son yazılanı okumak" ne demek? Linearizability'den eventual consistency'ye tutarlılık modelleri ve oturum garantileri.
:::

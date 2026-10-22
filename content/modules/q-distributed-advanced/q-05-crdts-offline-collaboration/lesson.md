---
id: q-05-crdts-offline-collaboration
slug: crdts-offline-collaboration
module: q-distributed-advanced
order: 5
title:
  tr: "CRDT'ler ve Çevrimdışı İş Birliği"
  en: "CRDTs and Offline Collaboration"
summary:
  tr: Koordinasyon olmadan doğru sonuca yakınsayan veri tipleri; G-Counter, PN-Counter, LWW-Register, OR-Set, metin CRDT'leri ve Figma ile Google Docs'un yaklaşımları.
  en: Data types that converge to the right answer without coordination; G-Counter, PN-Counter, LWW-Register, OR-Set, text CRDTs and how Figma and Google Docs approach it.
durationMinutes: 30
level: advanced
prerequisites: [q-04-consistency-models]
tags: [distributed-systems, crdt, offline-first, collaboration, figma]
concepts: [crdt, strong-eventual-consistency, g-counter, pn-counter, lww-register, or-set, merge-function, operational-transformation, local-first]
---

## Kavram: çakışmayı çözmek yerine imkânsız kılmak

Bir önceki derste eventual consistency'nin bedelini gördük: iki replika aynı veriye eşzamanlı yazarsa birinin değeri seçilmeli, diğeri kaybolmalıdır. Last-write-wins (LWW) bunu saat değerine bakarak yapar ve Q-01'de gördüğümüz gibi kaybeden yazma sessizce yok olur. Uçakta not alan bir telefon, metroda beğeni butonuna basan bir kullanıcı ya da aynı tasarım dosyasını açmış beş kişi düşünün: hepsi ağdan kopukken yazmak ister, bağlantı gelince de **hiçbir değişikliğin kaybolmaması** gerekir.

**CRDT (Conflict-free Replicated Data Type)**, bu sorunu çakışmayı çözmekle değil, veri tipini çakışma **oluşamayacak** biçimde tasarlamakla çözer. Her replika yerel olarak, kimseye sormadan yazar; replikalar birbirlerinin durumunu (ya da işlemlerini) aldıklarında belirli bir **birleştirme (merge)** fonksiyonu uygular. Bu fonksiyon üç matematiksel özelliği taşırsa tüm replikalar, mesajlar hangi sırayla, kaç kez gelirse gelsin, aynı duruma yakınsar:

- **Değişme (commutative):** merge(a, b) = merge(b, a). Sıra önemsiz.
- **Birleşme (associative):** merge(merge(a, b), c) = merge(a, merge(b, c)). Gruplama önemsiz.
- **Eşgüçlülük (idempotent):** merge(a, a) = a. Aynı mesajın iki kez gelmesi zararsız.

Bu garantiye **strong eventual consistency** denir: aynı güncellemeleri almış iki replika, ek bir koordinasyon turu olmadan, kesinlikle aynı durumdadır. CRDT'ler Q-04'teki hiyerarşide eventual tarafında durur ama "sonunda yakınsar" sözünü "aynı bilgiyi gören herkes aynı sonucu görür" sözüne yükseltir.

## Sayaçlar: G-Counter ve PN-Counter

En basit örnek beğeni sayacıdır. Her replikanın tek bir sayı tuttuğunu ve bağlantı gelince sayıları gönderdiğini düşünün. A replikası 5'i 8'e, B replikası 5'i 7'ye çıkarmışsa doğru sonuç 10'dur; ama "en büyük sayı kazansın" 8 der, "son gelen kazansın" 7 ya da 8 der. Bilgi kaybolmuştur, çünkü tek sayı **kimin** ne kadar artırdığını tutmaz.

**G-Counter (grow-only counter)** her replika için ayrı bir sayaç tutar: `{A: 6, B: 4}`. Kurallar:

- Bir replika yalnızca **kendi** bileşenini artırır.
- Değer, bileşenlerin toplamıdır.
- Birleştirme, bileşen bileşen **max** almaktır.

Max değişmeli, birleşmeli ve eşgüçlü olduğu için G-Counter bir CRDT'dir. Q-01'deki vektör saatle benzerliğe dikkat edin: yapı neredeyse aynıdır.

**PN-Counter** azaltmaya da izin verir: biri artışlar (P), biri azalışlar (N) için iki G-Counter tutar ve değer `toplam(P) − toplam(N)` olur. Beğeniyi geri çekmek N bileşenini artırmaktır.

:::diagram{src="diagram.svg" alt="G-Counter birleştirme: A replikası A=6 ve B=2, B replikası A=3 ve B=4 tutar; bileşen bileşen max ile A=6, B=4 ve toplam 10 bulunur; altta LWW'nin 8 ya da 7 vererek artışları kaybetmesi|G-Counter merge: replica A holds A=6 and B=2, replica B holds A=3 and B=4; component-wise max gives A=6, B=4 and a total of 10; below, LWW losing increments by returning 8 or 7"}
Üstte CRDT birleştirmesi, altta düz sayı ile last-write-wins. CRDT hangi sırayla birleştirilirse birleştirilsin 10 bulur.
:::

:::code{lang="ts" title="G-Counter ve PN-Counter: yerel artırma ve birleştirme"}
```ts
type GCounter = Record<string, number>;

export const gInc = (c: GCounter, node: string, by = 1): GCounter => ({ ...c, [node]: (c[node] ?? 0) + by });
export const gValue = (c: GCounter) => Object.values(c).reduce((a, b) => a + b, 0);
export function gMerge(a: GCounter, b: GCounter): GCounter {
  const out: GCounter = { ...a };
  for (const [k, v] of Object.entries(b)) out[k] = Math.max(out[k] ?? 0, v); // max: sıra ve tekrar önemsiz
  return out;
}

// PN-Counter: artış ve azalış için iki ayrı G-Counter
interface PNCounter { p: GCounter; n: GCounter }
export const pnInc = (c: PNCounter, node: string): PNCounter => ({ ...c, p: gInc(c.p, node) });
export const pnDec = (c: PNCounter, node: string): PNCounter => ({ ...c, n: gInc(c.n, node) });
export const pnValue = (c: PNCounter) => gValue(c.p) - gValue(c.n);
export const pnMerge = (a: PNCounter, b: PNCounter): PNCounter => ({ p: gMerge(a.p, b.p), n: gMerge(a.n, b.n) });
```
```python
def g_inc(c: dict, node: str, by: int = 1) -> dict:
    return {**c, node: c.get(node, 0) + by}

def g_value(c: dict) -> int:
    return sum(c.values())

def g_merge(a: dict, b: dict) -> dict:
    return {k: max(a.get(k, 0), b.get(k, 0)) for k in a.keys() | b.keys()}

# PN-Counter: (p, n) çifti
def pn_value(c) -> int:
    p, n = c
    return g_value(p) - g_value(n)

def pn_merge(a, b):
    return g_merge(a[0], b[0]), g_merge(a[1], b[1])
```
:::

:::predict{id="crdt-cift-mesaj"}
G-Counter kullanan bir sunucu, A telefonunun {A: 6, B: 2} durumunu ağ hatası yüzünden iki kez alır. Sunucudaki değer ne olur? | A server using a G-Counter receives phone A's state {A: 6, B: 2} twice because of a network retry. What happens to the value on the server?
- [ ] A'nın artışları iki kez sayılır | A's increments are counted twice
- [x] Değişmez; ikinci birleştirme etkisizdir | Nothing changes; the second merge has no effect
- [ ] Sunucu çakışma hatası verir | The server raises a conflict error
Açıklama: Birleştirme bileşen bileşen max almaktır ve max eşgüçlüdür: max(6, 6) = 6. Bu yüzden CRDT durumları "en az bir kez" teslimatla güvenle gönderilebilir; tekrar eden mesaj için ayrıca idempotency anahtarı gerekmez. Tek sayı gönderip toplayan naif bir tasarım ise tekrarı çift sayardı. | The merge takes the component-wise max, and max is idempotent: max(6, 6) = 6. That is why CRDT states can be sent safely with at-least-once delivery; a repeated message needs no extra idempotency key. A naive design that sends a single number and adds it up would count the repeat twice.
:::

:::animation{scene="scene.json"}
İki telefon çevrimdışıyken aynı sayacı artırır; düz sayıyla son yazan kazanınca artışlar kaybolur, G-Counter birleştirmesi ise hangi sırayla ve kaç kez yapılırsa yapılsın doğru toplamı (10) bulur.
:::

## Register ve küme: LWW-Register ve OR-Set

Her veri sayaç değildir. Bir şeklin rengi ya da bir kullanıcının adı gibi tek değerli alanlar için **LWW-Register** kullanılır: değer bir zaman damgasıyla saklanır, birleştirmede büyük damga kazanır, eşitlik replika kimliğiyle bozulur. Bu bir CRDT'dir (birleştirme deterministiktir), ama eşzamanlı yazmalardan biri **bilerek** atılır. Bunun kabul edilebilir olduğu yerde (bir şeklin son rengi) çok pratiktir; damga olarak duvar saati yerine Q-01'deki HLC ya da Lamport saati tercih edilir. Kaybın kabul edilemediği yerde **Multi-Value Register** iki değeri de saklar ve seçimi kullanıcıya bırakır (Dynamo sepetinin yaptığı gibi).

Kümeler daha incedir. Alice listeye "süt" ekler, Bob aynı anda "süt"ü siler; birleşince süt listede olmalı mı? **OR-Set (Observed-Remove Set)** her eklemeye benzersiz bir etiket verir. Silme yalnızca silen replikanın **o ana kadar gördüğü** etiketleri kaldırır. Bob, Alice'in yeni eklemesinin etiketini görmediği için onu silemez: eşzamanlı ekleme ile silmede **ekleme kazanır**. Bu, kullanıcıların çoğu zaman beklediği davranıştır.

## Metin: en zor CRDT

Ortak metin düzenlemede iki kişi aynı konuma aynı anda yazabilir. Konumları sayıyla ("5. karakter") tutmak işe yaramaz, çünkü önceki bir ekleme tüm sayıları kaydırır. Metin CRDT'leri (RGA, Logoot, Yjs ve Automerge'ün kullandığı yapılar) her karaktere **benzersiz ve kalıcı bir kimlik** verir ve yeni karakteri "şu kimlikli karakterden sonra" diye tanımlar. Silinen karakterler genellikle mezar taşı (tombstone) olarak kalır ki eşzamanlı ekleme onlara referans verebilsin. Zorluklar gerçektir: meta veri boyutu, uzun belgelerde performans ve iki kişinin aynı noktaya yazdığı kelimelerin karakter karakter iç içe geçmemesi (interleaving) üzerine hâlâ araştırma yapılmaktadır.

Google Docs farklı bir yol izler: **Operational Transformation (OT)**. Merkezi sunucu işlemleri sıraya koyar ve eşzamanlı bir işlemi diğerine göre "dönüştürür" (ör. benden önce 3 karakter eklendiyse benim konumumu 3 kaydır). OT merkezi sunucuyla iyi çalışır; CRDT'ler ise sunucusuz, eşler arası ve uzun süre çevrimdışı senaryolara daha uygundur. Ink & Switch araştırma grubunun **local-first** yazısı bu ikinci yaklaşımı savunur: veri önce kullanıcının cihazında yaşar, senkronizasyon arka planda CRDT'lerle olur.

Simülatörde CRDT yoktur, ama CRDT'lerin neden gerektiğini görebilirsiniz: AP modunda iki tarafa ayrı yazıp ağı onardığınızda simülatör çakışmayı last-write-wins ile çözer ve bir yazma kaybolur.

:::interactive{type="cap-theorem" mode="ap" replicas=3 partition=false}
Mod AP ve 3 replika ile başlayın. "Ağı böl" düğmesine basın, ardından Taraf A'daki bir replikaya ve Taraf B'deki bir replikaya ayrı ayrı yazın. Her iki taraftan okuyun: iki farklı "gerçek" var. Şimdi "Bölünmeyi onar" düğmesine basın ve günlüğe bakın: çakışma last-write-wins ile çözüldü ve yazmalardan biri kayboldu. Bu iki yazma bir sayacın artışları olsaydı, G-Counter ikisini de nasıl korurdu?
:::

:::realworld{company="Figma"}
**Figma**'nın gerçek zamanlı çok kullanıcılı düzenleme altyapısını anlatan 2019 tarihli "How Figma's multiplayer technology works" yazısı, CRDT fikirlerinin pratikte nasıl uyarlandığının iyi bir örneğidir. Ekip, Google Docs'un kullandığı OT'yi metin dışındaki bir tasarım belgesi için gereğinden karmaşık bulmuş ve CRDT'lerden **esinlenen** bir yaklaşım seçmiştir; yazı bunun "gerçek" bir CRDT olmadığını açıkça söyler. Fark, merkezi bir sunucunun bulunmasıdır: sunucu son sözü söyler, bu da tamamen dağıtık bir CRDT'nin taşıması gereken ek meta veriyi gereksiz kılar. Bir Figma belgesi nesnelerden oluşan bir ağaçtır ve her nesnenin özellikleri vardır. İki kullanıcı aynı nesnenin **farklı** özelliklerini değiştirirse iki değişiklik de korunur; **aynı** özelliğini değiştirirse sunucuya son ulaşan değer kazanır, yani özellik başına bir LWW-Register gibi davranır. Bir çerçevedeki nesnelerin sırası için de yazıda anlatılan "fractional indexing" kullanılır: her nesnenin konumu, iki komşusunun arasındaki bir kesir olarak tutulur, böylece eşzamanlı eklemeler diğer nesnelerin konumunu değiştirmez. Ders: CRDT'nin tüm genelliğine her zaman ihtiyaç yoktur; veri modelinize uyan en basit birleştirme kuralını seçin.
:::

:::callout{tone="warning" title="CRDT her değişmezi koruyamaz"}
CRDT'ler koordinasyonsuz yakınsamayı garanti eder, ama "bakiye sıfırın altına düşmesin" ya da "bu koltuk yalnızca bir kişiye satılsın" gibi kuralları koruyamaz: iki çevrimdışı replika aynı son koltuğu ayrı ayrı satabilir. Bu tür değişmezler koordinasyon (Q-02, Q-04'teki linearizable işlemler) ya da Q-06'daki telafi adımları gerektirir.
:::

:::callout{tone="tip" title="Mülakat özeti"}
- CRDT = yerel yazma + değişmeli, birleşmeli, eşgüçlü merge → strong eventual consistency.
- G-Counter: replika başına sayaç, merge = max, değer = toplam. PN-Counter: iki G-Counter.
- LWW-Register bilerek veri atar; OR-Set'te eşzamanlı ekleme silmeyi yener.
- Metin: karakter başına benzersiz kimlik (Yjs, Automerge) ya da merkezi OT (Google Docs). Figma: merkezi sunucu + özellik başına LWW.
:::

:::quiz{src="quiz.json"}
:::

:::resources
- [CRDT.tech](https://crdt.tech/) — belge — CRDT kaynakları, makaleler ve uygulamalar
- [How Figma's multiplayer technology works](https://www.figma.com/blog/how-figmas-multiplayer-technology-works/) — blog — Figma'nın CRDT'den esinlenen yaklaşımı
- [Local-first software](https://www.inkandswitch.com/local-first/) — makale — Ink & Switch, çevrimdışı-önce uygulamalar ve CRDT'ler
- [Automerge](https://automerge.org/) — belge — JSON benzeri belgeler için CRDT kütüphanesi
:::

:::next{lesson="q-06-distributed-transactions"}
Sırada: birden fazla servise ya da veritabanına yayılan işlemler — 2PC, saga, outbox ve idempotency.
:::

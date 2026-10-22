---
id: q-01-time-and-ordering
slug: time-and-ordering
module: q-distributed-advanced
order: 1
title:
  tr: "Zaman ve Sıralama: Saat Kayması, Lamport ve Vektör Saatler"
  en: "Time and Ordering: Clock Skew, Lamport and Vector Clocks"
summary:
  tr: Dağıtık sistemde "önce ne oldu?" sorusu; fiziksel saatlerin kayması, happens-before, Lamport ve vektör saatler, TrueTime fikri.
  en: The "what happened first?" question in distributed systems; physical clock skew, happens-before, Lamport and vector clocks, the TrueTime idea.
durationMinutes: 30
level: advanced
prerequisites: [a-12-replication]
tags: [distributed-systems, clocks, ordering, causality, spanner]
concepts: [clock-skew, ntp, happens-before, lamport-clock, vector-clock, concurrent-events, hybrid-logical-clock, truetime, commit-wait]
---

## Kavram: tek bir "şimdi" yoktur

Tek bir makinede olayların sırası bellidir: işlemci komutları sırayla çalıştırır, işletim sistemi tek bir saat tutar. Üç makineye geçtiğinizde bu konfor kaybolur. Her makinenin kendi kuvars saati vardır ve bu saatler **aynı hızda ilerlemez**. Sıcaklık, donanım farkı ve yaşlanma yüzünden saatler birbirinden uzaklaşır; buna **saat kayması (clock drift)** denir. İki saat arasındaki anlık farka da **clock skew** denir.

NTP (Network Time Protocol) saatleri bir referans sunucuya göre düzeltir, ama ağ gecikmesi değişken olduğu için düzeltme hiçbir zaman kusursuz değildir. Daha da kötüsü, NTP bir saati **geri** alabilir: 10:00:00.120'de yazılan kayıt, düzeltmeden sonra 10:00:00.090'da yazılmış gibi görünebilir. Sanal makinenin duraklatılması, artık saniye (leap second) ve yanlış yapılandırılmış bir NTP sunucusu da aynı sonucu doğurur.

Bu neden önemli? A-12'de gördüğünüz **last-write-wins** çakışma çözümü "en büyük zaman damgası kazanır" der. Eğer B düğümünün saati 50 ms geride ise B'ye *sonra* yapılan yazma, A'ya *önce* yapılan yazmaya kaybedebilir ve veri sessizce kaybolur. Log'ları zamana göre birleştirip hata ayıklarken de aynı sorun ortaya çıkar: "yanıt istekten önce gelmiş" gibi imkânsız sıralar görürsünüz.

Dağıtık sistemlerde iki tür saat ayrımı bu yüzden temeldir:

- **Duvar saati (wall clock):** "Takvimde saat kaç?" sorusunun cevabı. İnsanlara göstermek, süre dolumu hesaplamak için gerekir ama sıralama için güvenilmez.
- **Monoton saat (monotonic clock):** Yalnızca ileri gider; iki an arasındaki *süreyi* ölçmek için kullanılır. Ama makineler arasında karşılaştırılamaz.

Makineler arasında güvenilir sıralama istiyorsak, fiziksel zamanı bırakıp **nedenselliği** (causality) takip etmemiz gerekir.

## Happens-before ilişkisi

Leslie Lamport 1978'de bu soruyu fiziksel zamandan tamamen bağımsız tanımladı. **a → b** ("a, b'den önce olur") şu durumlarda doğrudur:

1. a ve b aynı süreçte ve a, b'den önce gerçekleşti.
2. a bir mesajın gönderilmesi, b aynı mesajın alınması.
3. Geçişlilik: a → b ve b → c ise a → c.

Ne a → b ne de b → a doğruysa iki olay **eşzamanlıdır (concurrent)**: aralarında bilgi akışı olmamıştır, biri diğerini etkileyemez. "Eşzamanlı" burada "aynı milisaniyede" demek değildir; "birbirinden habersiz" demektir.

:::diagram{src="diagram.svg" alt="Üç sürecin uzay-zaman diyagramı: A, B ve C yatay çizgiler; mesaj okları ve her olayın Lamport ve vektör saat değeri|Space-time diagram of three processes: A, B and C as horizontal lines; message arrows and each event's Lamport and vector clock values"}
Her yatay çizgi bir süreç, her nokta bir olay, her çapraz ok bir mesajdır. a1 ile c1 arasında hiçbir ok zinciri yoktur: bu iki olay eşzamanlıdır.
:::

## Lamport saatleri

Lamport saati her süreçte tutulan tek bir tamsayı sayaçtır. Kurallar çok kısadır:

- Her yerel olaydan ve mesaj göndermeden önce sayacı 1 artır.
- Mesaja sayacın değerini ekle.
- Mesaj alındığında: `sayaç = max(yerel, mesajdaki) + 1`.

Sonuç: **a → b ise L(a) < L(b)**. Nedensel olarak önce olan olay her zaman daha küçük numara alır. Eşitlikleri süreç kimliğiyle bozarsanız tüm olaylar için tutarlı bir **toplam sıra** elde edersiniz; tüm düğümler aynı sırayı kabul eder.

Ama ters yön geçerli değildir: L(a) < L(b) olması a'nın b'ye neden olduğunu göstermez. Lamport saati eşzamanlılığı **göremez**; iki bağımsız olaya da yapay bir sıra verir.

:::predict{id="lamport-esitlik"}
A süreci yerel bir olay yaşar ve sayacı 1 olur. Hiç mesaj almamış C süreci de yerel bir olay yaşar ve onun sayacı da 1 olur. Bu iki olay hakkında ne söyleyebiliriz? | Process A has a local event and its counter becomes 1. Process C, which has received no messages, also has a local event and its counter becomes 1. What can we say about these two events?
- [ ] Aynı anda gerçekleşmişlerdir | They happened at the same instant
- [x] Eşzamanlıdırlar; Lamport sayacı tek başına bunu kanıtlayamaz | They are concurrent; a Lamport counter alone cannot prove it
- [ ] A'nın olayı C'ninkinden önce olmuştur, çünkü A alfabede öndedir | A's event happened first because A comes first alphabetically
Açıklama: Aralarında mesaj zinciri olmadığı için olaylar nedensel olarak bağımsızdır, yani eşzamanlıdır. Ama eşit (ya da farklı) Lamport değerleri bunu kanıtlamaz: L(a) < L(b) iken de iki olay eşzamanlı olabilir. Eşzamanlılığı tespit etmek için vektör saat gerekir. Süreç kimliğiyle eşitlik bozmak yalnızca bir toplam sıra uydurur, nedensellik bilgisi eklemez. | There is no message chain between them, so the events are causally independent, i.e. concurrent. But equal (or different) Lamport values do not prove that: two events can be concurrent even when L(a) < L(b). Detecting concurrency needs vector clocks. Breaking ties by process id only invents a total order; it adds no causal information.
:::

:::animation{scene="scene.json"}
Üç düğüm mesajlaşırken Lamport sayaçları artar; aynı olaylar vektör saatlerle izlenince hangi olayların eşzamanlı olduğu ortaya çıkar.
:::

## Vektör saatler

Eşzamanlılığı yakalamak için her süreç **tüm süreçlerin** sayacını tutar: N süreçlik sistemde N elemanlı bir vektör. Kurallar Lamport'un genelleştirilmiş hâlidir:

- Yerel olayda yalnızca kendi bileşenini artır.
- Mesaja tüm vektörü ekle.
- Alırken bileşen bileşen `max` al, sonra kendi bileşenini artır.

Karşılaştırma: V(a) ≤ V(b) (her bileşende küçük ya da eşit) ve en az bir bileşende küçükse **a → b**. Ne V(a) ≤ V(b) ne de V(b) ≤ V(a) ise iki olay **eşzamanlıdır**. Diyagramdaki a1 = [1,0,0] ve c1 = [0,0,1] karşılaştırılamaz; tam olarak bu yüzden eşzamanlıdır.

Amazon'un 2007 tarihli Dynamo makalesi alışveriş sepeti için tam bu yöntemi kullandı: iki replika aynı sepete eşzamanlı yazma alırsa, vektör saatler "bu iki sürüm birbirinin devamı değil" der ve sistem iki sürümü de saklayıp birleştirmeyi uygulamaya bırakır. Riak'ın "sibling" kavramı da aynı fikirdir. Bedeli boyuttur: vektör, yazan düğüm ya da istemci sayısıyla büyür; pratikte eski girdiler budanır ya da "dotted version vector" gibi sıkıştırılmış biçimler kullanılır.

:::code{lang="ts" title="Vektör saat: artırma, birleştirme ve karşılaştırma"}
```ts
type VClock = Record<string, number>;

export function tick(v: VClock, node: string): VClock {
  return { ...v, [node]: (v[node] ?? 0) + 1 };
}

/** Mesaj alındığında: bileşen bileşen max, sonra kendi bileşenini artır */
export function receive(local: VClock, incoming: VClock, node: string): VClock {
  const merged: VClock = { ...local };
  for (const [k, n] of Object.entries(incoming)) merged[k] = Math.max(merged[k] ?? 0, n);
  return tick(merged, node);
}

export function compare(a: VClock, b: VClock): 'before' | 'after' | 'equal' | 'concurrent' {
  let less = false;
  let greater = false;
  for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) {
    if ((a[k] ?? 0) < (b[k] ?? 0)) less = true;
    if ((a[k] ?? 0) > (b[k] ?? 0)) greater = true;
  }
  if (less && greater) return 'concurrent';
  if (less) return 'before';
  if (greater) return 'after';
  return 'equal';
}
```
```python
def tick(v: dict, node: str) -> dict:
    return {**v, node: v.get(node, 0) + 1}

def receive(local: dict, incoming: dict, node: str) -> dict:
    merged = {k: max(local.get(k, 0), incoming.get(k, 0)) for k in local.keys() | incoming.keys()}
    return tick(merged, node)

def compare(a: dict, b: dict) -> str:
    keys = a.keys() | b.keys()
    less = any(a.get(k, 0) < b.get(k, 0) for k in keys)
    greater = any(a.get(k, 0) > b.get(k, 0) for k in keys)
    if less and greater:
        return "concurrent"
    return "before" if less else "after" if greater else "equal"
```
:::

## Fiziksel zamana geri dönüş: HLC ve TrueTime

Mantıksal saatler nedenselliği korur ama "dün 14:00'teki durumu göster" gibi bir sorguya cevap veremez; kullanıcılar takvim zamanı ister. İki pratik uzlaşma vardır:

- **Hybrid Logical Clock (HLC):** Zaman damgası, fiziksel saatin üst bitleri ile bir mantıksal sayacın birleşimidir. Fiziksel saate yakın kalır, ama mesaj alırken Lamport kuralı uygulandığı için nedensellik bozulmaz. CockroachDB ve YugabyteDB bu yaklaşımı kullanır; CockroachDB ayrıca düğümler arasında izin verilen en büyük saat farkını yapılandırma olarak tutar ve saati bu sınıra fazla yaklaşan düğüm, tutarlılığı bozmamak için kendini kapatır.
- **TrueTime:** Google Spanner saati tek bir değer olarak değil, bir **belirsizlik aralığı** olarak döndürür: `TT.now() = [earliest, latest]`. Gerçek zamanın bu aralıkta olduğu garanti edilir. Aralığı dar tutmak için veri merkezlerinde GPS alıcıları ve atomik saatler kullanılır.

:::realworld{company="Google"}
**Google Spanner**, küresel ölçekte dağıtılmış bir veritabanında transaction'lara gerçek zamana uyan bir sıra vermek için TrueTime'ı kullanır (OSDI 2012 makalesi). Her veri merkezinde GPS alıcılı ve atomik saatli zaman sunucuları bulunur; makinelerdeki zaman servisi bunlarla düzenli konuşur ve saatin olası hatasını (ε) hesaplar. Bir transaction commit edilirken Spanner ona `TT.now().latest` değerinde bir zaman damgası verir ve ardından **commit wait** yapar: `TT.now().earliest` bu damgayı geçene kadar bekler, sonra sonucu görünür kılar. Böylece bu transaction'dan *sonra* başlayan her transaction kesinlikle daha büyük bir zaman damgası alır; dış tutarlılık (external consistency) sağlanır. Bedeli, her yazmanın belirsizlik aralığı kadar beklemesidir. Bu yüzden Google aralığı küçültmeye donanımla yatırım yapmıştır; makalede ε'nin tipik olarak birkaç milisaniye olduğu raporlanır. Atomik saati olmayan CockroachDB ise aynı sorunu HLC ve "belirsizlik penceresi içindeki okumayı yeniden başlatma" ile çözer; Cockroach Labs bunu "Living Without Atomic Clocks" yazısında anlatır.
:::

:::callout{tone="warning" title="Zaman damgasıyla sıralamadan önce düşünün"}
Bir sistemde "en yeni kayıt kazanır" kuralını görürseniz sorun: bu zaman damgasını kim üretiyor? Farklı makinelerin duvar saatleri karşılaştırılıyorsa saat kayması kadar bir pencerede yazmalar sessizce kaybolabilir. Sıra önemliyse tek bir sıralayıcı (lider, ör. Raft), mantıksal saat ya da HLC kullanın; süre ölçmek için ise her zaman monoton saati tercih edin.
:::

:::callout{tone="tip" title="Mülakat özeti"}
- Duvar saati sıralama için güvenilmez: kayar, geri gidebilir, makineler arası farkı vardır.
- **a → b ⇒ L(a) < L(b)**, ama tersi geçerli değil. Lamport toplam sıra verir, eşzamanlılığı göremez.
- Vektör saat eşzamanlılığı tespit eder (Dynamo sepeti). Bedeli: düğüm sayısıyla büyüyen vektör.
- Spanner: TrueTime aralığı + commit wait. CockroachDB: HLC + izin verilen saat farkı.
:::

:::quiz{src="quiz.json"}
:::

:::resources
- [Time, Clocks, and the Ordering of Events in a Distributed System](https://lamport.azurewebsites.net/pubs/time-clocks.pdf) — bildiri — Lamport'un 1978 tarihli özgün makalesi
- [Spanner: Google's Globally-Distributed Database (OSDI 2012)](https://www.usenix.org/conference/osdi12/technical-sessions/presentation/corbett) — bildiri — TrueTime ve commit wait
- [Living Without Atomic Clocks](https://www.cockroachlabs.com/blog/living-without-atomic-clocks/) — blog — CockroachDB'nin HLC yaklaşımı
- [Designing Data-Intensive Applications](https://dataintensive.net/) — kitap — 8. ve 9. bölümler saatler ve sıralama üzerine
:::

:::next{lesson="q-02-consensus-raft"}
Sırada: bir grup düğümün tek bir sıra üzerinde **anlaşması** — Raft ile lider seçimi, log replikasyonu ve terim numaraları.
:::

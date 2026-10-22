---
id: o-01-tcp-udp
slug: tcp-udp
module: o-network-os
order: 1
title:
  tr: "TCP ve UDP: Güvenilir Akış ve Hızlı Datagram"
  en: "TCP and UDP: Reliable Streams and Fast Datagrams"
summary:
  tr: Üçlü el sıkışma, sıra numaraları, yeniden iletim, akış ve tıkanıklık kontrolü; UDP ne zaman doğru seçimdir.
  en: The three-way handshake, sequence numbers, retransmission, flow and congestion control; when UDP is the right choice.
durationMinutes: 30
level: intermediate
tags: [tcp, udp, networking, transport-layer, congestion-control]
prerequisites: [a-01-client-server-dns-http]
concepts: [tcp-handshake, sequence-number, retransmission, tcp-sliding-window, flow-control, congestion-control, slow-start, udp-datagram]
---

## Kavram: güvenilmez bir ağın üstünde güvenilir bir boru

İstemci-sunucu dersinde TCP'yi "bağlanmak için bir RTT harcayan güvenilir kanal" olarak tanıdık. Bu derste kapağı açıyoruz. Altta yatan gerçek şudur: **IP katmanı hiçbir şey vaat etmez.** Bir paket yolda kaybolabilir, iki kez gelebilir, sırası karışabilir ya da bir router'ın tamponu dolduğu için sessizce atılabilir. IP'nin tek işi paketi hedef adrese doğru "en iyi çabayla" (best effort) itmektir.

**TCP (Transmission Control Protocol)** bu kaotik zeminin üstüne uygulamaya şu soyutlamayı sunar: *sıralı, kayıpsız, tekrarsız bir byte akışı*. `send()` ile yazdığınız byte'lar karşı tarafta `recv()` ile aynı sırayla çıkar. **UDP (User Datagram Protocol)** ise neredeyse hiçbir şey eklemez: port numaraları, uzunluk ve bir sağlama toplamı. Gönderdiğiniz her datagram ya bütün olarak gelir ya hiç gelmez; sıra ve teslim garantisi yoktur.

İkisi de aynı IP'nin üstünde, aynı çekirdeğin ağ yığınında çalışır. Farkı anlamak, "bu servis neden yavaş", "bağlantılar neden TIME_WAIT'te birikiyor" ya da "QUIC neden UDP üstünde" gibi soruları cevaplamanın anahtarıdır.

:::diagram{src="diagram.svg" alt="Solda istemci ile sunucu arasında SYN, SYN-ACK, ACK el sıkışması ve veri segmentleri; sağda gönderici penceresinin onaylanmış, uçuştaki, gönderilebilir ve bekleyen byte'lara bölünmesi|On the left the SYN, SYN-ACK, ACK handshake and data segments between client and server; on the right the sender window split into acknowledged, in-flight, sendable and waiting bytes"}
TCP iki işi birlikte yapar: bağlantının iki ucundaki sıra numaralarını eşitler (el sıkışma) ve gönderilen ama henüz onaylanmamış byte'ları bir pencere içinde izler.
:::

## Üçlü el sıkışma ve sıra numaraları

TCP'de her byte'ın bir **sıra numarası (sequence number)** vardır. Bağlantı açılırken iki taraf da rastgele bir başlangıç numarası (ISN) seçer ve bunu karşıya bildirir:

1. **SYN** — istemci: "Bağlanmak istiyorum, benim ilk numaram `x`."
2. **SYN-ACK** — sunucu: "`x+1`'i bekliyorum (ACK), benim ilk numaram `y`."
3. **ACK** — istemci: "`y+1`'i bekliyorum." Bağlantı iki tarafta da `ESTABLISHED` olur.

ISN'in rastgele olması güvenlik içindir: tahmin edilebilir numaralar, araya giren birinin sahte segment enjekte etmesini kolaylaştırırdı. Üç adımın nedeni ise basittir: her iki yönün de kendi numarasını göndermesi **ve** karşının numarasını aldığını onaylaması gerekir; bu dört mesajdır, ortadaki ikisi tek segmentte birleşir.

El sıkışmanın bir bedeli vardır: sunucu her yarım açık bağlantı için bellek ayırır. Saldırgan sahte adreslerden binlerce SYN gönderirse (**SYN flood**) bu kuyruk dolar. Linux, kuyruk dolunca **SYN cookie** kullanır: durumu bellekte tutmak yerine SYN-ACK'in sıra numarasına kodlar ve yalnızca geçerli ACK gelince bağlantıyı oluşturur.

Bağlantı kapanırken de benzer bir dans olur (FIN/ACK). Kapatmayı başlatan taraf bir süre **TIME_WAIT** durumunda bekler; böylece ağda gecikmiş eski segmentler aynı port çiftini kullanan yeni bağlantıya karışmaz. Çok kısa ömürlü binlerce giden bağlantı açan bir servis, bu yüzden geçici port (ephemeral port) tükenmesi yaşayabilir. Çözüm çoğunlukla bağlantıları yeniden kullanmaktır (connection pool, keep-alive).

## Onay, kayıp ve yeniden iletim

Alıcı, sıralı olarak eksiksiz aldığı son byte'ın bir fazlasını **kümülatif ACK** olarak bildirir: "1001'e kadar her şey tamam, sıradaki 1001." Bir segment kaybolursa sonraki segmentler gelse bile ACK numarası ilerleyemez; alıcı aynı ACK'i tekrar tekrar gönderir (**duplicate ACK**). Gönderici iki yoldan kaybı anlar:

- **Zaman aşımı (RTO)**: Gönderici her segment için ölçtüğü RTT'den yumuşatılmış bir ortalama ve sapma hesaplar; onay bu süre içinde gelmezse segmenti yeniden gönderir. Zaman aşımı pahalıdır, çünkü süre en az birkaç RTT'dir ve ardından pencere sert biçimde küçülür.
- **Hızlı yeniden iletim (fast retransmit)**: Üç duplicate ACK, "arkadaki segmentler geliyor, yalnızca biri eksik" demektir. Gönderici zaman aşımını beklemeden eksik segmenti hemen yeniden yollar. **SACK** (selective ACK) seçeneği, alıcının hangi blokları aldığını da söylemesine izin verir; böylece yalnızca gerçekten eksik olanlar tekrar gönderilir.

Kayıp olmasa bile dikkat edilmesi gereken bir yan etki vardır: alıcı eksik segment gelene kadar sonrakileri uygulamaya **teslim edemez**. Sıralı byte akışı garantisinin bedeli budur ve buna taşıma katmanında **head-of-line blocking** denir. HTTP sürümleri dersinde bu sorunun HTTP/2'yi nasıl etkilediğini ve QUIC'in onu nasıl çözdüğünü göreceğiz.

:::predict{id="tcp-kayip-segment"}
Gönderici 4 segment yolladı; 2. segment yolda kayboldu, 3. ve 4. sunucuya ulaştı. Sunucudaki uygulama `recv()` çağırdığında ne olur? | The sender sent 4 segments; segment 2 was lost, segments 3 and 4 reached the server. What happens when the server application calls `recv()`?
- [ ] 1., 3. ve 4. segmentlerin verisini alır; 2. segment sonra eklenir | It gets the data of segments 1, 3 and 4; segment 2 is appended later
- [x] Yalnızca 1. segmentin verisini alır; 3 ve 4 çekirdek tamponunda 2'nin yeniden iletilmesini bekler | It gets only segment 1's data; 3 and 4 wait in the kernel buffer until 2 is retransmitted
- [ ] Bağlantı hata ile kapanır, uygulama yeniden bağlanmalıdır | The connection closes with an error and the application must reconnect
Açıklama: TCP sıralı bir byte akışı vaat eder. Alıcı 3 ve 4'ü tamponda tutar ve 1001 için duplicate ACK gönderir; gönderici üç duplicate ACK görünce 2'yi hemen yeniden yollar. Boşluk dolunca 2, 3 ve 4 birlikte uygulamaya teslim edilir. | TCP promises an ordered byte stream. The receiver buffers 3 and 4 and sends duplicate ACKs for 1001; after three duplicate ACKs the sender retransmits 2 immediately. Once the gap is filled, 2, 3 and 4 are delivered to the application together.
:::

:::animation{scene="scene.json"}
SYN, SYN-ACK, ACK ile bağlantı kurulur; dört segmentten biri kaybolur, duplicate ACK'ler hızlı yeniden iletimi tetikler ve tıkanıklık penceresi yarıya iner.
:::

## Akış kontrolü: alıcıyı boğmamak

Gönderici her segmenti onay gelmeden önce tek tek beklerse, 100 ms RTT'li bir hatta saniyede ancak 10 segment gönderebilir. Bu yüzden TCP bir **kayan pencere (sliding window)** kullanır: onay beklemeden belli miktarda byte'ı "uçuşta" tutabilir. Pencerenin bir sınırını alıcı belirler: her ACK'te **alıcı penceresi (rwnd)**, yani tamponunda kaç byte'lık boş yer kaldığı bildirilir. Uygulama verileri yavaş okuyorsa tampon dolar, rwnd sıfıra iner ve gönderici durur. Buna **akış kontrolü** denir; amaç hızlı göndericinin yavaş alıcıyı boğmasını önlemektir.

## Tıkanıklık kontrolü: ağı boğmamak

Diğer sınır ağın kendisidir. Aradaki bir router'ın kuyruğu dolduğunda paket atar; herkes körlemesine göndermeye devam ederse ağ çöker. TCP bu yüzden kendi içinde bir **tıkanıklık penceresi (cwnd)** tutar ve gerçekte uçuşta olabilecek veri `min(rwnd, cwnd)` kadardır.

- **Slow start**: Yeni bağlantı küçük bir cwnd ile başlar (Linux'ta varsayılan 10 segment) ve her RTT'de pencereyi kabaca ikiye katlar. "Yavaş" adına rağmen üstel büyür.
- **Congestion avoidance**: Bir eşiğe ulaşınca büyüme doğrusallaşır.
- **Kayıp tepkisi**: Kayıp, tıkanıklık sinyali sayılır; pencere küçültülür. Klasik algoritmalar "toplamsal artış, çarpımsal azalış" (AIMD) mantığıyla çalışır; Linux'un varsayılanı **CUBIC**'tir.

Bu mekanizmanın pratik sonucu önemlidir: **yeni bir TCP bağlantısı tam hızına hemen ulaşmaz.** Kısa bir HTTP yanıtı çoğu zaman slow start'tan çıkamadan biter. Bağlantıları yeniden kullanmak, CDN ile RTT'yi kısaltmak ve ilk yanıtı küçük tutmak bu yüzden işe yarar.

:::interactive{type="request-journey" stages="dns,tcp,http" rttMs=80}
"Ağ gidiş-dönüş (RTT) ms" kaydırıcısını 20'den 200'e çekip "İstek gönder"e basın: TCP el sıkışması ve HTTP isteği RTT ile doğrudan büyür, çünkü her biri en az bir gidiş-dönüş ister. "DNS önbellekte" kutusunu işaretleyip tekrar gönderin ve gecikme şelalesinde hangi adımın küçüldüğünü, hangisinin değişmediğini karşılaştırın.
:::

## UDP: ne zaman "garanti yok" daha iyidir?

UDP başlığı yalnızca 8 byte'tır ve el sıkışma, pencere, yeniden iletim yoktur. Bu eksiklik bazı işler için avantajdır:

| Durum | Neden UDP? |
|---|---|
| DNS sorguları | Tek paketlik soru-cevap; bağlantı kurmak sorudan pahalı olur |
| Sesli/görüntülü görüşme, canlı yayın | Geç gelen veri değersizdir; yeniden iletim yerine bir sonraki kare gönderilir |
| Çok oyunculu oyunlar | Konum güncellemesi kaybolursa bir sonraki zaten yolda |
| QUIC / HTTP/3 | Güvenilirliği kullanıcı alanında, stream başına yeniden kurar |

Son satır kritik bir fikri gösterir: UDP "güvenilmez" değil, **güvenilirlik kararını uygulamaya bırakan** bir protokoldür. Uygulama ihtiyaç duyduğu kadarını kendisi ekleyebilir: sıra numarası, seçici yeniden iletim, kendi tıkanıklık kontrolü. QUIC tam olarak budur. Bedeli de vardır: UDP'de tıkanıklık kontrolü yoksa ağa saygılı davranmak uygulamanın sorumluluğundadır ve bazı kurumsal güvenlik duvarları UDP trafiğini kısıtlar.

:::code{lang="python" title="Aynı mesaj, iki taşıma: TCP akışı ve UDP datagramı"}
```python
import socket

# TCP: önce bağlan (el sıkışma çekirdekte olur), sonra byte akışı gönder
with socket.create_connection(("example.com", 80), timeout=3) as tcp:
    tcp.setsockopt(socket.IPPROTO_TCP, socket.TCP_NODELAY, 1)  # Nagle'ı kapat: küçük yazmaları bekletme
    tcp.sendall(b"HEAD / HTTP/1.1\r\nHost: example.com\r\nConnection: close\r\n\r\n")
    print(tcp.recv(200))          # akış: mesaj sınırı yoktur, gelen byte'ları okursun

# UDP: bağlantı yok; her sendto() bağımsız bir datagram
with socket.socket(socket.AF_INET, socket.SOCK_DGRAM) as udp:
    udp.settimeout(2)
    udp.sendto(b"ping", ("127.0.0.1", 9999))   # karşıda dinleyen yoksa sessizce kaybolur
    try:
        data, addr = udp.recvfrom(1500)
    except (TimeoutError, ConnectionRefusedError):
        print("yanıt yok: UDP teslimat garantisi vermez")

# Linux'ta açık bağlantıların cwnd, rtt ve yeniden iletim sayılarını görmek için:
#   ss -tin state established
```
:::

:::callout{tone="warning" title="Nagle + delayed ACK tuzağı"}
TCP küçük yazmaları birleştirmek için **Nagle algoritmasını** kullanır: onaylanmamış veri varken yeni küçük segmenti bekletir. Alıcı tarafta ise **gecikmeli ACK** onayı kısa süre bekletir. İkisi birleşince, iki parça hâlinde yazılan küçük bir istek her seferinde onlarca milisaniye takılabilir. Etkileşimli protokollerde (RPC, Redis istemcileri, oyun sunucuları) `TCP_NODELAY` açılır ya da istek tek bir yazmada gönderilir.
:::

:::realworld{company="Google"}
Google, kayıp tabanlı tıkanıklık kontrolünün modern ağlarda yetersiz kaldığını gözlemleyip **BBR** (Bottleneck Bandwidth and Round-trip propagation time) algoritmasını geliştirdi ve 2016'da ACM Queue'da yayımladı. Klasik algoritmalar paket kaybını tıkanıklık işareti sayar; oysa derin tamponlu router'larda kayıp, kuyruklar çoktan dolup gecikme şiştikten sonra gelir, sığ tamponlu ya da kablosuz hatlarda ise tıkanıklık olmadan da paket kaybolabilir. BBR bunun yerine yolun darboğaz bant genişliğini ve en küçük RTT'yi sürekli ölçer ve gönderme hızını bu modele göre ayarlar. Google, BBR'ı kendi ağında ve YouTube trafiğinde kullanıma aldığını, bant genişliği ve gecikmede iyileşmeler gözlemlediğini yazdı; algoritma Linux çekirdeğine de eklendi ve bugün `sysctl net.ipv4.tcp_congestion_control=bbr` ile seçilebilir. Ders şudur: TCP'nin "güvenilir boru" vaadi sabittir ama boruyu ne kadar hızlı dolduracağınız değiştirilebilir bir politikadır.
:::

:::callout{tone="tip" title="Mülakat özeti"}
- El sıkışma 1 RTT'dir ve her yeni bağlantıda ödenir: bağlantıları yeniden kullanın.
- TCP kaybı iki yoldan anlar: zaman aşımı (pahalı) ve üç duplicate ACK (hızlı yeniden iletim).
- Uçuştaki veri `min(rwnd, cwnd)`: rwnd alıcıyı, cwnd ağı korur.
- UDP'yi "geç gelen veri değersizse" ya da güvenilirliği kendiniz kuracaksanız (QUIC) seçin.
:::

:::quiz{src="quiz.json"}
:::

:::resources
- [RFC 9293: Transmission Control Protocol](https://www.rfc-editor.org/rfc/rfc9293) — belge — TCP'nin güncel standardı
- [RFC 768: User Datagram Protocol](https://www.rfc-editor.org/rfc/rfc768) — belge — üç sayfalık UDP tanımı
- [BBR: Congestion-Based Congestion Control](https://queue.acm.org/detail.cfm?id=3022184) — makale — Google ekibinin ACM Queue yazısı
- [High Performance Browser Networking](https://hpbn.co/) — kitap — Ilya Grigorik; TCP, UDP ve TLS performansı
:::

:::next{lesson="o-02-dns-ip"}
Sırada: paketler hangi adrese gidecek? DNS çözümleme zincirini, TTL ve önbelleği, IPv4/IPv6 ve NAT'ı derinlemesine inceleyeceğiz.
:::

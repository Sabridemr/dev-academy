---
id: o-04-http-versions
slug: http-versions
module: o-network-os
order: 4
title:
  tr: "HTTP/1.1, HTTP/2 ve HTTP/3"
  en: "HTTP/1.1, HTTP/2 and HTTP/3"
summary:
  tr: "Keep-alive, head-of-line blocking, multiplexing ve QUIC: aynı istekler üç protokolde nasıl taşınır."
  en: "Keep-alive, head-of-line blocking, multiplexing and QUIC: how the same requests travel over three protocols."
durationMinutes: 30
level: intermediate
tags: [http, http2, http3, quic, networking, performance]
prerequisites: [o-03-tls-https]
concepts: [keep-alive, head-of-line-blocking, http2-multiplexing, http2-streams, hpack, quic, connection-migration, zero-rtt]
---

## Kavram: aynı anlam, farklı taşıma

HTTP'nin *anlamı* 1997'den beri neredeyse hiç değişmedi: metodlar (`GET`, `POST`), durum kodları, başlıklar ve gövde. HTTP/2 ve HTTP/3'te `GET /api/cart` hâlâ `GET /api/cart`'tır; uygulama kodunuzun büyük çoğunluğu hangi sürümün konuşulduğunu bilmez bile. Değişen, bu mesajların **kabloya nasıl dizildiğidir**. Üç sürümün hikâyesi tek bir soruya verilen üç cevaptır: *Bir sayfa aynı sunucudan onlarca dosya isterken, bu istekler birbirini nasıl bekletmesin?*

Bir önceki derste TLS el sıkışmasının bir gidiş-dönüş (RTT) maliyetini, o-01'de TCP'nin kayıp segmenti yeniden ilettiğini ve verileri **sıralı** teslim ettiğini gördük. Bu dersin kilit fikri tam olarak bu sıralı teslim garantisinden doğuyor: güvenilirlik için tasarlanan bir özellik, belirli koşullarda performansın baş düşmanına dönüşür.

## HTTP/1.1: keep-alive ve tek şeritli yol

HTTP/1.0'da her istek için yeni bir TCP bağlantısı açılıp kapatılırdı; her dosya bir TCP el sıkışması, üstüne TLS el sıkışması demekti. HTTP/1.1 varsayılan olarak **kalıcı bağlantı (keep-alive)** getirdi: bağlantı yanıttan sonra açık kalır ve sonraki istek aynı kanaldan gider. El sıkışma maliyeti bir kez ödenir.

Ama bir kural değişmedi: bir HTTP/1.1 bağlantısında **aynı anda yalnızca bir istek-yanıt** yolda olabilir. Yanıtlar sınır işaretleri olmadan art arda yazılır, bu yüzden istemci ikinci yanıtın nerede başladığını ancak birincisi tamamen bittiğinde bilir. Buna uygulama katmanında **head-of-line (HOL) blocking** denir: kuyruğun başındaki yavaş yanıt — büyük bir görsel ya da yavaş bir sorgu — arkasındaki her şeyi bekletir.

HTTP/1.1'in standarda koyduğu **pipelining** (yanıtı beklemeden istekleri peş peşe göndermek) bu sorunu çözmedi, çünkü yanıtlar yine sırayla dönmek zorundaydı ve aradaki proxy'lerin hatalı uygulamaları yüzünden tarayıcılar özelliği hiç varsayılan olarak açmadı. Pratik çözüm kaba kuvvet oldu: tarayıcılar alan adı başına **altı civarında paralel bağlantı** açar. Geliştiriciler de bu sınırı aşmak için dosyaları birleştirdi (bundling), küçük görselleri sprite'lara gömdü ve içeriği birden fazla alan adına dağıttı (domain sharding). Bu numaraların hepsi aslında protokolün eksikliğini telafi eden geçici çözümlerdi.

## HTTP/2: tek bağlantıda çok şerit

HTTP/2 metin tabanlı mesajları **ikili çerçevelere (frame)** böler. Her çerçeve bir **stream** kimliği taşır; aynı TCP bağlantısı üzerinde yüzlerce stream'in çerçeveleri iç içe geçerek akabilir. Buna **multiplexing (çoğullama)** denir. Yavaş bir yanıt artık diğerlerini bekletmez: sunucu hazır olan yanıtın çerçevelerini araya sıkıştırır, istemci çerçeveleri stream kimliğine göre yeniden birleştirir.

Ek kazanımlar:

- **HPACK başlık sıkıştırması**: Her istekte tekrar eden `cookie`, `user-agent`, `accept` başlıkları, iki tarafın ortak tuttuğu bir tabloya referansla birkaç bayta iner.
- **Tek bağlantı**: Altı bağlantı yerine bir bağlantı; TCP'nin tıkanıklık penceresi tek akışta büyür, el sıkışmalar azalır. Domain sharding ve sprite gibi numaralar artık zararlıdır, çünkü tek bağlantının avantajını bozar.
- **Öncelik sinyalleri**: İstemci, CSS'in görselden önce gelmesi gerektiğini söyleyebilir.

Sunucu itmesi (server push) de HTTP/2 ile gelmişti ancak pratikte faydası sınırlı kaldı ve Chrome desteği kaldırdı; yerini `103 Early Hints` gibi daha basit mekanizmalar aldı.

Peki sorun tamamen çözüldü mü? Hayır, yalnızca bir kat aşağı indi. Bütün stream'ler **tek bir TCP bağlantısında** akıyor ve TCP, baytları kesinlikle sıralı teslim eder. Bir segment kaybolduğunda, o segment yeniden iletilene kadar arkasından gelen **bütün** baytlar çekirdekte bekletilir — o baytlar tamamen başka stream'lere ait olsa bile. Buna **TCP seviyesinde HOL blocking** denir. Kayıpsız bir veri merkezi ağında fark edilmez; ama %1-2 kayıplı bir mobil bağlantıda HTTP/2, altı bağımsız bağlantı kullanan HTTP/1.1'den bile kötü davranabilir, çünkü tek kayıp tüm sayfayı durdurur.

:::diagram{src="diagram.svg" alt="Aynı dört isteğin HTTP/1.1'de tek bağlantıda seri, HTTP/2'de tek TCP bağlantısında çoğullanmış, HTTP/3'te QUIC üzerinde bağımsız stream'lerle taşınması; kayıp bir paketin her protokoldeki etkisi|The same four requests carried serially over one connection in HTTP/1.1, multiplexed over one TCP connection in HTTP/2 and as independent streams over QUIC in HTTP/3; the effect of one lost packet in each protocol"}
Kırmızı çarpı aynı kayıp paketi gösterir. Gri bölgeler o kayıp yüzünden bekleyen istekleri işaret eder.
:::

## HTTP/3: TCP'yi bırakıp QUIC'e geçmek

TCP işletim sistemi çekirdeğinde ve ağdaki sayısız cihazda (NAT, güvenlik duvarı, yük dengeleyici) gömülü olduğu için değiştirilmesi neredeyse imkânsızdır. **QUIC** bu yüzden **UDP** üzerine, kullanıcı alanında (user space) yeniden yazılmış bir taşıma protokolüdür. HTTP/3 ise HTTP'nin QUIC'e eşlenmiş hâlidir.

QUIC'in getirdikleri:

- **Bağımsız stream'ler**: Güvenilirlik ve sıralama stream başına yapılır. C stream'inin paketi kaybolursa yalnızca C bekler; A, B ve D teslim edilmeye devam eder. HOL blocking taşıma katmanında da ortadan kalkar.
- **Birleşik el sıkışma**: TLS 1.3, QUIC'in içine gömülüdür; taşıma ve şifreleme el sıkışması aynı paketlerde yapılır. Yeni bağlantı **1 RTT**, daha önce görüşülmüş sunucuya **0-RTT**. (0-RTT'nin replay riskini o-03'te gördük.)
- **Bağlantı göçü (connection migration)**: TCP bağlantısı dört değerle (kaynak IP/port, hedef IP/port) tanımlanır; telefon Wi-Fi'dan mobil veriye geçince IP değişir ve bağlantı kopar. QUIC bağlantıları bir **connection ID** ile tanımlanır, bu yüzden IP değişse de bağlantı yaşar.
- **Her şey şifreli**: QUIC başlıklarının çoğu da şifrelidir; aradaki cihazlar protokolü "tahmin edip" kurcalayamaz, bu da protokolün gelecekte evrilmesini kolaylaştırır.

Bedeli de var: UDP bazı kurumsal ağlarda engellenir, bu yüzden istemciler önce HTTP/2 ile bağlanır ve sunucunun `Alt-Svc` başlığıyla HTTP/3 desteğini duyurmasından sonra QUIC'e geçer; UDP engelliyse sessizce TCP'ye geri döner. Ayrıca kullanıcı alanında çalışan QUIC, çekirdekte olgunlaşmış TCP'ye göre bayt başına daha fazla CPU harcayabilir.

:::predict{id="h2-paket-kaybi"}
Bir sayfa dört dosyayı HTTP/2 ile tek TCP bağlantısında indiriyor. C dosyasına ait tek bir TCP segmenti kayboluyor. Ne olur? | A page downloads four files over a single TCP connection with HTTP/2. One TCP segment belonging to file C is lost. What happens?
- [ ] Yalnızca C bekler, diğer üç dosya akmaya devam eder | Only C waits; the other three keep flowing
- [x] Segment yeniden iletilene kadar dört dosyanın da kayıptan sonraki baytları bekletilir | Until the segment is retransmitted, the bytes after the loss are held back for all four files
- [ ] Bağlantı kapanır ve dört istek baştan gönderilir | The connection closes and all four requests are resent
Açıklama: TCP, stream kavramını bilmez; yalnızca sıralı bir bayt akışı görür. Kayıp segmentin arkasındaki baytlar hangi stream'e ait olursa olsun uygulamaya teslim edilmez. HTTP/3'te ise güvenilirlik stream başına olduğu için yalnızca C bekler. | TCP does not know about streams; it sees only an ordered byte stream. Bytes after the lost segment are not delivered to the application, whatever stream they belong to. In HTTP/3 reliability is per stream, so only C waits.
:::

:::animation{scene="scene.json"}
Aynı dört istek üç şeritte: HTTP/1.1'de sırayla, HTTP/2'de tek TCP bağlantısında iç içe ama bir kayıpta hepsi duruyor, HTTP/3'te kayıp yalnızca kendi stream'ini durduruyor.
:::

:::interactive{type="request-journey" stages="dns,tcp,tls,http" rttMs=100 http3=false}
RTT kaydırıcısını 20 ms'den 200 ms'ye çekin ve "İstek gönder" ile toplam gecikmenin nasıl büyüdüğünü izleyin: TCP, TLS ve HTTP aşamalarının her biri bir RTT ekler. Ardından "HTTP/3 (QUIC)" kutusunu işaretleyip tekrar gönderin: TCP aşaması ayrı bir gidiş-dönüş olmaktan çıkar, çünkü QUIC taşıma ve TLS el sıkışmasını birleştirir. Yüksek RTT'de kazancın daha belirgin olduğuna dikkat edin; bu, HTTP/3'ün özellikle mobil ve uzak kullanıcılar için anlamlı olmasının nedenidir. "DNS önbellekte" kutusuyla tekrar ziyaretin etkisini de karşılaştırın.
:::

:::code{lang="bash" title="Hangi sürüm konuşuluyor?"}
```bash
# Sunucunun anlaştığı HTTP sürümünü göster (ALPN ile seçilir)
curl -sI --http2 https://www.cloudflare.com -o /dev/null -w "%{http_version}\n"   # 2

# Sunucu HTTP/3 desteğini Alt-Svc başlığıyla duyurur
curl -sI https://www.cloudflare.com | grep -i alt-svc                            # h3=":443"; ma=86400

# curl HTTP/3 destekli derlendiyse doğrudan QUIC ile dene
curl -sI --http3 https://www.cloudflare.com -o /dev/null -w "%{http_version}\n"   # 3
```
```nginx
# nginx: HTTP/2 ve HTTP/3'ü birlikte sunmak (nginx 1.25+)
server {
    listen 443 ssl;
    listen 443 quic reuseport;     # QUIC = UDP 443
    http2 on;
    http3 on;
    add_header Alt-Svc 'h3=":443"; ma=86400';   # istemciye HTTP/3'ün varlığını duyur
    ssl_protocols TLSv1.3;                       # QUIC TLS 1.3 gerektirir
}
```
:::

:::callout{tone="warning" title="HTTP/1.1 dönemi optimizasyonlarını geri alın"}
Domain sharding, aşırı bundling ve sprite'lar HTTP/2 ve HTTP/3'te çoğu zaman zararlıdır: birden fazla alan adı ek DNS, TCP ve TLS maliyeti getirir; tek dev bundle ise küçük bir değişiklikte bütün önbelleği geçersiz kılar. Yeni bir projede varsayılan, makul boyutlu ayrı dosyalar ve tek bir köken (origin) olmalıdır.
:::

:::realworld{company="Cloudflare"}
Cloudflare, HTTP/3 ve QUIC'in standartlaşma sürecinde en görünür uygulayıcılardan biri oldu ve deneyimlerini mühendislik blogunda ayrıntılı yazdı. Şirket, QUIC uygulamasını **quiche** adıyla Rust ile yazıp açık kaynak olarak yayımladı; bu kütüphane hem kendi kenar sunucularında hem de başka projelerde kullanıldı. Cloudflare yazılarında QUIC'in tasarım gerekçesini bu derste gördüğümüz iki noktaya dayandırır: TCP seviyesindeki head-of-line blocking'in ortadan kalkması ve taşıma ile TLS el sıkışmasının birleşerek bağlantı kurulumunu kısaltması. Ölçüm yazılarında ise kazancın her koşulda aynı olmadığını açıkça belirtir: düşük gecikmeli, kayıpsız ağlarda HTTP/2 ile HTTP/3 arasındaki fark küçük, kayıplı ve yüksek gecikmeli mobil bağlantılarda daha belirgindir. QUIC'in kökeni ise Google'dır: Google kendi "gQUIC" protokolünü Chrome ile kendi sunucuları arasında yıllarca çalıştırdı, sonuçlarını SIGCOMM 2017'de "The QUIC Transport Protocol" makalesiyle yayımladı ve protokol IETF'te standartlaşarak RFC 9000 (QUIC) ve RFC 9114 (HTTP/3) oldu.
:::

:::callout{tone="tip" title="Mülakat özeti"}
HTTP/1.1: keep-alive var, ama bağlantı başına tek istek → uygulama HOL blocking. HTTP/2: tek TCP'de multiplexing ve HPACK → uygulama HOL çözülür, TCP HOL kalır. HTTP/3: QUIC (UDP) ile stream başına güvenilirlik, 1-RTT/0-RTT kurulum ve bağlantı göçü. Semantik üçünde de aynıdır.
:::

:::quiz{src="quiz.json"}
:::

:::resources
- [RFC 9114: HTTP/3](https://www.rfc-editor.org/rfc/rfc9114) — belge — HTTP'nin QUIC üzerine eşlenmesi
- [RFC 9000: QUIC: A UDP-Based Multiplexed and Secure Transport](https://www.rfc-editor.org/rfc/rfc9000) — belge — QUIC taşıma protokolü
- [RFC 9113: HTTP/2](https://www.rfc-editor.org/rfc/rfc9113) — belge — çerçeveler, stream'ler ve akış kontrolü
- [The QUIC Transport Protocol: Design and Internet-Scale Deployment](https://dl.acm.org/doi/10.1145/3098822.3098842) — bildiri — Google, SIGCOMM 2017
- [MDN: Evolution of HTTP](https://developer.mozilla.org/en-US/docs/Web/HTTP/Basics_of_HTTP/Evolution_of_HTTP) — belge — HTTP/0.9'dan HTTP/3'e tarihçe
:::

:::next{lesson="o-05-processes-threads"}
Ağ tarafını bitirdik. Şimdi sunucunun içine giriyoruz: bu bağlantıları kabul eden süreçler ve thread'ler CPU'yu nasıl paylaşır, zamanlayıcı kime ne zaman sıra verir?
:::

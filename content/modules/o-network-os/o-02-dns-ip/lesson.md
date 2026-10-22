---
id: o-02-dns-ip
slug: dns-ip
module: o-network-os
order: 2
title:
  tr: "DNS ve IP: Çözümleme Zinciri, Adresler ve NAT"
  en: "DNS and IP: The Resolution Chain, Addresses and NAT"
summary:
  tr: Recursive → root → TLD → authoritative zinciri, TTL ve önbellek, IPv4/IPv6, özel ağlar ve NAT.
  en: The recursive → root → TLD → authoritative chain, TTL and caching, IPv4/IPv6, private networks and NAT.
durationMinutes: 30
level: intermediate
tags: [dns, ip, nat, ipv6, networking]
prerequisites: [o-01-tcp-udp]
concepts: [recursive-resolver, dns-delegation, dns-ttl, negative-caching, anycast, cidr, private-address-space, nat]
---

## Kavram: isim, adres ve yol

TCP bir bağlantıyı iki uç noktası arasında kurar; bu uç noktalar **IP adresi + port** çiftleridir. Kullanıcı ise `shop.example.com` yazar. Aradaki boşluğu iki sistem doldurur: **DNS** ismi adrese çevirir, **IP** o adrese giden paketleri yönlendirir. İstemci-sunucu dersinde DNS zincirinin adımlarını ve kayıt tiplerini gördük. Bu derste üç soruya derinlemesine bakacağız: Çözümleyici zinciri gerçekte nasıl yürür ve her halkada neyi önbelleğe alır? TTL seçimi işletmeye nasıl yansır? Ve milyarlarca cihaz, sayısı 4,3 milyarla sınırlı IPv4 adresine nasıl sığar?

## Çözümleme zinciri: kim kime soruyor?

Uygulamanız `getaddrinfo("shop.example.com")` çağırdığında işletim sistemindeki **stub resolver** devreye girer. Stub akıllı değildir: kendi önbelleğine ve `/etc/hosts`'a bakar, bulamazsa soruyu yapılandırılmış **recursive resolver**'a (ISS'nin sunucusu, şirket içi resolver ya da `1.1.1.1`, `8.8.8.8` gibi genel servisler) olduğu gibi iletir ve "bana son cevabı getir" der.

Recursive resolver ise işi **iteratif** sorgularla yapar. Hiçbir sunucu onun yerine araştırma yapmaz; her biri yalnızca "bunu ben bilmem, şuna sor" der:

1. **Root sunucu**: `.com` bölgesinin yetkili sunucularını (NS kayıtları) döner. Bu bir **referral**'dır (yönlendirme), cevap değil.
2. **TLD sunucusu (.com)**: `example.com`'un yetkili sunucularını döner. Yetkili sunucunun adı aynı bölgenin içindeyse (`ns1.example.com`) tavuk-yumurta sorununu çözmek için IP adresi de **glue kaydı** olarak eklenir.
3. **Authoritative sunucu**: Kaydın sahibidir ve gerçek cevabı verir: `A 203.0.113.10`, `TTL 300`.

Bu hiyerarşinin adı **delegasyondur (delegation)**: root `.com`'u, `.com` da `example.com`'u başka sunuculara devreder. Her seviye yalnızca kendi altındakini bilir; bu yüzden sistem merkezi bir veritabanı olmadan ölçeklenir.

:::diagram{src="diagram.svg" alt="Stub resolver'dan recursive resolver'a, oradan root, TLD ve authoritative sunuculara iteratif sorgular; her kaydın önbellekte kalma süresi ve sağ altta özel ağdan NAT ile genel internete çıkış|Iterative queries from the stub resolver to the recursive resolver, then to root, TLD and authoritative servers; how long each record stays cached; and bottom right, egress from a private network to the public internet through NAT"}
Recursive resolver zincirin tek "akıllı" halkasıdır: soruları iteratif olarak sorar ve her cevabı kendi TTL'iyle önbelleğe alır. Alt kısımda özel adresli cihazların tek bir genel adresi NAT ile paylaşması görülüyor.
:::

## Önbellek: zincirin çoğu zaman yürünmemesinin nedeni

Zincirin tamamı yürünseydi her isim için dört gidiş-dönüş gerekirdi. Gerçekte resolver her cevabı kendi **TTL**'i boyunca saklar ve farklı seviyelerin TTL'leri çok farklıdır. `.com`'un NS kayıtları günlerce önbellekte kalabilirken bir uygulamanın `A` kaydı birkaç dakikalık olabilir. Sonuç: popüler bir resolver root'a neredeyse hiç gitmez, TLD'ye nadiren gider; çoğu sorgu ya doğrudan önbellekten ya da yalnızca authoritative sunucuya tek bir soruyla çözülür.

Var olmayan isimler de önbelleğe alınır. Authoritative sunucu `NXDOMAIN` döndüğünde bölgenin SOA kaydındaki süre kadar bu "yok" cevabı saklanır (**negative caching**). Bu yüzden yeni bir alt alan adını oluşturmadan önce test edip `NXDOMAIN` aldıysanız, kaydı ekledikten sonra bir süre hâlâ "yok" görebilirsiniz.

TTL seçimi bir pazarlıktır:

| TTL | Artısı | Eksisi |
|---|---|---|
| Kısa (30–60 s) | IP değişikliği ve failover hızlı yayılır | Daha çok sorgu, authoritative sunucuya daha çok yük, ilk istekte daha çok gecikme |
| Uzun (saatler) | Az sorgu, önbellekten hızlı cevap, sağlayıcı arızasına dayanıklılık | Hatalı kaydı düzeltmek saatler sürer |

Pratik bir kural: planlı bir geçişten (sunucu taşıma, sağlayıcı değiştirme) bir gün önce TTL'i kısaltın, geçişi yapın, her şey oturunca TTL'i yeniden uzatın. Bazı istemcilerin ve ara katmanların TTL'e tam uymadığını da unutmayın; eski IP'deki sunucuyu hemen kapatmayın.

:::predict{id="dns-ttl-degisiklik"}
`api.example.com` kaydının TTL'i 3600 saniye. Saat 10:00'da kaydı yeni bir IP'ye çevirdiniz. 10:05'te bir kullanıcının resolver'ı ne döndürür? | The record for `api.example.com` has a TTL of 3600 seconds. At 10:00 you point it to a new IP. What does a user's resolver return at 10:05?
- [ ] Yeni IP'yi; authoritative sunucu değişikliği resolver'lara anında iter | The new IP; the authoritative server pushes the change to resolvers instantly
- [x] Kaydı 10:00'dan kısa süre önce önbelleğe aldıysa eski IP'yi, TTL dolana kadar | The old IP, until the TTL expires, if it cached the record shortly before 10:00
- [ ] Hata; değişiklik sırasında kayıt geçersizdir | An error; the record is invalid during the change
Açıklama: DNS'te itme (push) yoktur. Resolver kaydı aldığı andan itibaren TTL boyunca saklar ve authoritative sunucuya tekrar sormaz. "DNS yayılması" dediğimiz şey, eski önbellek girdilerinin zamanla düşmesidir. | DNS has no push. A resolver keeps the record for the TTL from the moment it fetched it and does not ask the authoritative server again. What we call "DNS propagation" is just old cache entries expiring over time.
:::

:::animation{scene="scene.json"}
Önbelleği boş bir resolver root, TLD ve authoritative sunucuları sırayla sorgular; cevap TTL ile önbelleğe girer, ikinci kullanıcı aynı cevabı tek adımda alır, TTL dolunca yalnızca authoritative sunucuya sorulur.
:::

:::interactive{type="request-journey" layers="browser,dns,lb,service,db" rttMs=40}
"İstek gönder"e basıp gecikme şelalesinde DNS adımının payına bakın. Ardından "DNS önbellekte" kutusunu işaretleyip tekrar gönderin: DNS adımı neredeyse sıfıra iner, diğer katmanlar değişmez. "20 istek (rastgele hit)" düğmesi isteklerin çoğunun DNS'i önbellekten çözdüğü gerçekçi bir karışımı simüle eder; ortalama ile p95'i karşılaştırın, soğuk önbellekli istekler kuyruğu (p95) nasıl etkiliyor?
:::

## IP adresleri: IPv4, CIDR ve özel ağlar

IPv4 adresi 32 bittir; `203.0.113.10` gibi dört sekizli olarak yazılır. Adresler blok blok dağıtılır ve bir blok **CIDR** gösterimiyle yazılır: `10.0.0.0/16`, ilk 16 bitin ağı, kalan 16 bitin cihazları gösterdiği 65.536 adreslik bir bloktur. Bulut ortamında bir VPC'yi `/16`, içindeki alt ağları `/24` olarak bölmek bu yüzden sık görülür.

Üç blok internette yönlendirilmez ve herkesin kendi ağında serbestçe kullanabileceği **özel adres alanı** olarak ayrılmıştır (RFC 1918): `10.0.0.0/8`, `172.16.0.0/12` ve `192.168.0.0/16`. Evinizdeki dizüstü `192.168.1.23`, bir Kubernetes pod'u `10.244.3.7` olabilir; bu adresler dışarıdan doğrudan erişilemez.

## NAT: tek genel adresin arkasında bir ağ

Özel adresli bir cihaz internete nasıl çıkar? **NAT (Network Address Translation)** ile. Router ya da bulutun NAT gateway'i giden paketin kaynak adresini kendi genel adresiyle, kaynak portunu da boştaki bir portla değiştirir ve bu eşlemeyi bir **bağlantı tablosunda** tutar. Cevap geldiğinde tabloya bakıp paketi doğru iç cihaza geri çevirir. Böylece yüzlerce cihaz tek bir genel IPv4 adresini paylaşır.

NAT'ın sonuçları sistem tasarımında sık karşımıza çıkar:

- **Dışarıdan bağlantı başlatılamaz.** Tabloda eşleme yoksa gelen paket nereye gideceğini bilemez. Bu bir güvenlik yan etkisidir ama eşler arası (P2P) bağlantıları ve WebRTC'yi zorlaştırır.
- **Port ve tablo kapasitesi sınırlıdır.** Aynı hedefe çok sayıda giden bağlantı açan servisler NAT gateway'de port tükenmesi yaşayabilir; bağlantıları yeniden kullanmak burada da ilaçtır.
- **Sunucu gerçek istemci IP'sini görmez.** Load balancer ya da proxy arkasındaki uygulamalar istemci adresini `X-Forwarded-For` gibi başlıklardan okur.

## IPv6: adres kıtlığının kalıcı çözümü

IPv6 adresleri 128 bittir (`2001:db8::10`) ve adres alanı o kadar büyüktür ki her cihaza genel bir adres verilebilir; NAT bir zorunluluk olmaktan çıkar (güvenlik duvarı yine gereklidir). DNS'te IPv6 adresi `AAAA` kaydıyla döner. Geçiş yıllardır sürüyor ve çoğu ağ **dual-stack** çalışır: istemci hem `A` hem `AAAA` sorar, ikisine de bağlanmayı neredeyse aynı anda dener ve önce hangisi kurulursa onu kullanır (**Happy Eyeballs**). Böylece bozuk bir IPv6 yolu kullanıcıyı saniyelerce bekletmez.

:::code{lang="bash" title="Zinciri ve adresleri kendiniz görün"}
```bash
# Çözümleme zincirini root'tan başlayarak adım adım izle (resolver önbelleğini atlar)
dig +trace shop.example.com

# Resolver'ın önbellekteki cevabı: ikinci sorguda TTL sütununun azaldığını görün
dig shop.example.com A +noall +answer
dig shop.example.com AAAA +noall +answer

# Belirli bir resolver'a sor (ör. Cloudflare'in anycast adresi)
dig @1.1.1.1 shop.example.com

# Kendi arayüz adreslerin (çoğunlukla RFC 1918 özel adresler) ve dışarıdan görünen genel adresin
ip -brief addr
curl -s https://icanhazip.com
```
:::

Cloudflare'in `1.1.1.1` ve Google'ın `8.8.8.8` resolver'ları **anycast** kullanır: aynı IP adresi dünyanın birçok veri merkezinden duyurulur ve ağ yönlendirmesi her sorguyu en yakın olana götürür. Tek bir adres, yüzlerce fiziksel sunucunun ön kapısıdır.

:::realworld{company="Meta"}
4 Ekim 2021'de Facebook, Instagram ve WhatsApp saatlerce erişilemez oldu. Meta mühendislik ekibinin yayımladığı açıklamaya göre rutin bir bakım sırasında çalıştırılan bir komut, şirketin veri merkezlerini birbirine bağlayan omurga ağ bağlantılarını istemeden kesti. Meta'nın DNS sunucuları, omurgaya ulaşamadıklarını fark edince kendilerini sağlıksız sayıp BGP duyurularını geri çekecek şekilde tasarlanmıştı. Sonuç olarak dünyadaki recursive resolver'lar `facebook.com` için authoritative sunuculara giden bir yol bulamadı; isimler çözülemediği için sunucular ayakta olsa bile kimse onlara ulaşamadı. Önbellekteki kayıtların TTL'i dolunca etki tüm dünyaya yayıldı; Cloudflare da aynı gün yayımladığı yazıda, durmadan tekrar deneyen uygulamalar yüzünden kendi `1.1.1.1` resolver'ına gelen Facebook sorgularının belirgin biçimde arttığını aktardı. Olay DNS ile IP yönlendirmesinin ne kadar iç içe olduğunu gösterir: authoritative sunucularınıza giden yol kaybolursa, uygulamanızın geri kalanının sağlıklı olması hiçbir şey ifade etmez. Ekip ayrıca, uzaktan erişim araçları da aynı ağa bağlı olduğu için mühendislerin veri merkezlerine fiziksel olarak gitmesi gerektiğini anlattı.
:::

:::callout{tone="warning" title="DNS'i load balancer sanmayın"}
Bir isme birden fazla `A` kaydı koymak (DNS round-robin) basit bir dağıtım sağlar ama sağlık kontrolü yapmaz: ölü bir sunucunun adresi TTL boyunca istemcilere dağıtılmaya devam eder ve istemciler çoğunlukla listedeki ilk adrese yapışır. DNS'i bölge seçimi (GeoDNS) ve felaket kurtarma için kullanın; sunucular arası yük dağıtımını gerçek bir load balancer'a bırakın.
:::

:::quiz{src="quiz.json"}
:::

:::resources
- [RFC 1034: Domain Names — Concepts and Facilities](https://www.rfc-editor.org/rfc/rfc1034) — belge — DNS'in temel tasarımı, delegasyon ve önbellek
- [RFC 1918: Address Allocation for Private Internets](https://www.rfc-editor.org/rfc/rfc1918) — belge — özel IPv4 adres blokları
- [Cloudflare Learning: What is DNS?](https://www.cloudflare.com/learning/dns/what-is-dns/) — makale — recursive ve authoritative sunucular
- [More details about the October 4 outage](https://engineering.fb.com/2021/10/05/networking-traffic/outage-details/) — blog — Meta mühendislik ekibinin olay açıklaması
:::

:::next{lesson="o-03-tls-https"}
Sırada: doğru adrese ulaştık, peki karşıdaki gerçekten o sunucu mu? Sertifikaları, CA zincirini ve TLS el sıkışmasını inceleyeceğiz.
:::

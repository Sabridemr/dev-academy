---
id: o-03-tls-https
slug: tls-https
module: o-network-os
order: 3
title:
  tr: "TLS ve HTTPS: Sertifikalar ve Şifreli Kanal"
  en: "TLS and HTTPS: Certificates and the Encrypted Channel"
summary:
  tr: Sertifika ve CA zinciri, asimetrikten simetrik oturum anahtarına el sıkışma, TLS 1.3 ve Let's Encrypt ile otomatik sertifika.
  en: Certificates and the CA chain, the handshake from asymmetric keys to a symmetric session key, TLS 1.3 and automated certificates with Let's Encrypt.
durationMinutes: 30
level: intermediate
tags: [tls, https, certificates, cryptography, security, networking]
prerequisites: [o-02-dns-ip]
concepts: [tls-handshake, x509-certificate, certificate-chain, ecdhe-key-exchange, session-key, forward-secrecy, sni, acme-protocol, certificate-validation]
---

## Kavram: güvenmediğin bir ağda güvenli konuşmak

Önceki derslerde bir paketin TCP ile güvenilir biçimde taşındığını ve DNS ile doğru IP adresine ulaştığını gördük. Ama "güvenilir" kelimesi TCP'de yalnızca *eksiksiz ve sıralı* anlamına gelir. Kahvedeki Wi-Fi erişim noktası, ISS'nizin yönlendiricisi ya da DNS cevabını sahteleyen bir saldırgan, TCP segmentlerini okuyabilir, değiştirebilir ya da sizi bambaşka bir sunucuya bağlayabilir. TCP bunların hiçbirini fark etmez.

**TLS (Transport Layer Security)** bu boşluğu üç garantiyle doldurur:

- **Gizlilik**: aradaki kimse içeriği okuyamaz.
- **Bütünlük**: içerik yolda değiştirilirse alıcı bunu anlar ve bağlantıyı keser.
- **Kimlik doğrulama**: konuştuğunuz sunucunun gerçekten `shop.example.com` olduğundan emin olursunuz.

**HTTPS**, HTTP'nin TLS kanalı içinden konuşulmasından ibarettir; HTTP'nin kendisi değişmez. a-01 dersinde el sıkışmanın adımlarını kabaca gördük. Bu derste üç soruya derinlemesine bakacağız: Sertifika neyi kanıtlar ve tarayıcı ona neden güvenir? Asimetrik kriptografi neden yalnızca el sıkışmada kullanılır? TLS 1.3 önceki sürümlerden neyi attı?

## Sertifika: bir imzalı beyan

Bir **X.509 sertifikası** özünde şu cümleyi taşıyan imzalı bir belgedir: *"Bu açık anahtar, şu alan adlarına aittir; şu tarihten şu tarihe kadar geçerlidir."* İçindeki önemli alanlar:

| Alan | Anlamı |
|---|---|
| Subject Alternative Name (SAN) | Sertifikanın geçerli olduğu alan adları (`shop.example.com`, `*.example.com`) |
| Public key | Sunucunun açık anahtarı; özel anahtar yalnızca sunucuda durur |
| Validity (notBefore / notAfter) | Geçerlilik penceresi |
| Issuer | Sertifikayı imzalayan otorite (CA) |
| Signature | Issuer'ın özel anahtarıyla atılmış imza |

Tarayıcı bu imzayı doğrulamak için issuer'ın açık anahtarına ihtiyaç duyar. O da bir başka sertifikadadır: **ara sertifika (intermediate CA)**. Ara sertifikayı da bir **kök sertifika (root CA)** imzalar. Kök sertifikalar işletim sistemi ya da tarayıcı ile birlikte gelen **güven deposunda (trust store)** durur; kimse onları ağ üzerinden "kanıtlamaz", onlara önceden güvenilir.

Doğrulama böylece bir zincir hâlini alır: yaprak sertifika → ara CA → kök CA. Her halkada imza, tarih ve kullanım kısıtları kontrol edilir; yaprakta ayrıca istenen alan adının SAN listesinde olup olmadığına bakılır. Halkalardan biri koparsa — imza tutmaz, süre dolmuştur, ad eşleşmez, kök güven deposunda yoktur — tarayıcı bağlantıyı reddeder ve kırmızı uyarı sayfasını gösterir.

:::diagram{src="diagram.svg" alt="Yaprak sertifikadan ara CA'ya ve güven deposundaki kök CA'ya uzanan sertifika zinciri; altında TLS 1.3 el sıkışmasında asimetrik anahtar değişiminden simetrik oturum anahtarına geçiş|Certificate chain from leaf to intermediate CA to the root CA in the trust store; below it the TLS 1.3 handshake moving from asymmetric key exchange to a symmetric session key"}
Üst şerit güvenin nereden geldiğini, alt şerit anahtarın nasıl üretildiğini gösterir. İkisi el sıkışmanın içinde birleşir.
:::

## Neden iki tür kriptografi?

**Asimetrik kriptografi** (RSA, ECDSA, Ed25519, ECDHE) iki tarafın daha önce hiç buluşmadan ortak bir sır üzerinde anlaşmasını ve imza atmasını sağlar; ama pahalıdır. **Simetrik şifreleme** (AES-GCM, ChaCha20-Poly1305) ise her iki tarafın aynı anahtarı bilmesini gerektirir ve modern işlemcilerde donanım desteğiyle son derece hızlıdır.

TLS ikisini birleştirir: el sıkışmada asimetrik yöntemlerle bir **oturum anahtarı** türetilir, sonra bütün veri bu anahtarla simetrik olarak şifrelenir. Pahalı iş bağlantı başına bir kez yapılır; megabaytlarca veri ucuz yoldan akar.

TLS 1.3'te anahtar anlaşması her zaman **(EC)DHE** ile yapılır: istemci ve sunucu her bağlantı için geçici (ephemeral) bir anahtar çifti üretir, açık paylarını birbirine gönderir ve her biri kendi özel payıyla aynı ortak sırrı hesaplar. Bu sır kablodan hiç geçmez. Sunucunun sertifikadaki uzun ömürlü anahtarı yalnızca *imza* için kullanılır: "Bu el sıkışmayı gerçekten ben yaptım." Sonuç **forward secrecy (ileriye dönük gizlilik)**: sunucunun özel anahtarı yıllar sonra çalınsa bile, kaydedilmiş eski trafik çözülemez, çünkü geçici anahtarlar çoktan silinmiştir. TLS 1.2'de hâlâ izin verilen "RSA anahtar taşıma" yönteminde bu garanti yoktu; TLS 1.3 onu tamamen kaldırdı.

## TLS 1.3 el sıkışması adım adım

1. **ClientHello**: İstemci desteklediği şifre takımlarını, rastgele bir değeri, **SNI** uzantısında hangi alan adını istediğini ve — TLS 1.3'ün kilit yeniliği — tahmin ettiği gruba ait **key share**'ini tek mesajda gönderir.
2. **ServerHello**: Sunucu bir şifre takımı seçer ve kendi key share'ini döner. Bu noktada iki taraf ortak sırrı hesaplayabilir; sonraki her şey artık şifrelidir.
3. **EncryptedExtensions, Certificate, CertificateVerify, Finished**: Sunucu sertifika zincirini ve el sıkışma dökümünün imzasını gönderir. Sertifika bile şifreli gider; TLS 1.2'de açıkta giderdi.
4. **İstemci doğrular**: zinciri güven deposuna kadar kurar, tarihleri ve SAN'ı kontrol eder, CertificateVerify imzasını sertifikadaki açık anahtarla doğrular.
5. **Finished**: İstemci kendi Finished mesajını gönderir ve HTTP isteği hemen arkasından akar.

Toplam maliyet **1 RTT**. TLS 1.2'de bu iki RTT idi. Daha önce bağlanmış bir istemci, sunucunun verdiği oturum bileti (session ticket) ile **0-RTT** modunda ilk isteği ClientHello ile birlikte gönderebilir. Ancak 0-RTT verisi yeniden oynatılabilir (replay); bu yüzden yalnızca `GET` gibi idempotent istekler için açılmalıdır.

:::predict{id="tls-sertifika-suresi"}
Sunucunun sertifikası dün gece sona erdi, ama özel anahtar ve şifreleme ayarları tamamen sağlam. Bir tarayıcı bağlandığında ne olur? | The server's certificate expired last night, but the private key and cipher settings are fine. What happens when a browser connects?
- [ ] Bağlantı şifreli kurulur, yalnızca adres çubuğunda küçük bir uyarı çıkar | The connection is encrypted and only a small warning appears in the address bar
- [x] Tarayıcı el sıkışmayı yarıda keser ve tam sayfa uyarı gösterir; HTTP isteği hiç gönderilmez | The browser aborts the handshake and shows a full-page warning; no HTTP request is sent
- [ ] Sunucu otomatik olarak HTTP'ye düşer | The server automatically falls back to HTTP
Açıklama: Süresi dolmuş sertifika, zincir doğrulamasının başarısız olması demektir. İstemci kimliği kanıtlanamayan bir sunucuya veri göndermez; el sıkışma bir alert ile kapanır ve uygulama verisi hiç akmaz. Şifreleme matematiği sağlam olsa da "kiminle konuştuğum" sorusunun cevabı yoktur. | An expired certificate means chain validation fails. The client will not send data to a server whose identity is unproven; the handshake ends with an alert and no application data flows. The crypto may be fine, but "who am I talking to" has no answer.
:::

:::animation{scene="scene.json"}
TLS 1.3: ClientHello ve key share → ServerHello, sertifika ve Finished → zincir doğrulaması → simetrik anahtarla şifreli veri. Son adımda süresi dolmuş sertifikayla gelen bir bağlantı reddedilir.
:::

:::code{lang="bash" title="El sıkışmayı kendi gözünle görmek"}
```bash
# TLS 1.3 el sıkışması, seçilen şifre takımı ve sertifika zinciri
openssl s_client -connect example.com:443 -servername example.com -tls1_3 </dev/null

# Yalnızca yaprak sertifikanın alanları: SAN, issuer, geçerlilik
openssl s_client -connect example.com:443 -servername example.com </dev/null 2>/dev/null \
  | openssl x509 -noout -subject -issuer -dates -ext subjectAltName

# curl ile ayrıntılı el sıkışma çıktısı
curl -sv https://example.com -o /dev/null 2>&1 | grep -E "SSL connection|subject:|expire date|issuer:"
```
```ts
import tls from "node:tls";

// Node.js: el sıkışmayı yap ve karşı tarafın sertifikasını incele
const socket = tls.connect({ host: "example.com", port: 443, servername: "example.com" }, () => {
  const cert = socket.getPeerCertificate(true);
  console.log("protokol:", socket.getProtocol());          // "TLSv1.3"
  console.log("şifre takımı:", socket.getCipher().name);    // ör. "TLS_AES_256_GCM_SHA384"
  console.log("SAN:", cert.subjectaltname);
  console.log("bitiş:", cert.valid_to, "issuer:", cert.issuer.O);
  socket.end();
});
socket.on("error", (err) => console.error("el sıkışma reddedildi:", err.message)); // ör. CERT_HAS_EXPIRED
```
:::

## Sertifikalar neden kısa ömürlü olur?

Bir sertifikanın özel anahtarı sızarsa, sertifika süresi dolana kadar saldırganın elinde geçerli bir kimlik vardır. İptal mekanizmaları (CRL, OCSP) pratikte güvenilir çalışmadığı için sektör giderek **kısa ömürlü sertifikalara** yöneldi: tarayıcı forumunun (CA/Browser Forum) kararlarıyla genel sertifikaların azami ömrü yıllar içinde kademeli olarak kısaltılıyor. Kısa ömür yalnızca **otomatik yenileme** ile sürdürülebilir; elle yenilenen sertifika er geç unutulur ve gece yarısı kesintiye dönüşür.

**ACME protokolü** (RFC 8555) bu otomasyonun standardıdır. Sunucudaki bir istemci (certbot, Caddy, cert-manager, Traefik) CA'dan sertifika ister; CA alan adının gerçekten sizin kontrolünüzde olduğunu bir **meydan okuma (challenge)** ile doğrular: ya `http://alanadi/.well-known/acme-challenge/...` adresinde belirli bir dosya sunarsınız (HTTP-01) ya da DNS'e belirli bir TXT kaydı eklersiniz (DNS-01). Joker (`*.example.com`) sertifikalar yalnızca DNS-01 ile alınabilir.

:::callout{tone="warning" title="Sık yapılan üç hata"}
- **Eksik zincir**: Sunucu yalnızca yaprak sertifikayı gönderir, ara sertifikayı göndermez. Masaüstü tarayıcı önbellekteki ara sertifikayla çalışır, ama mobil uygulama ya da `curl` "unable to get local issuer certificate" hatası verir. Sunucuya her zaman *fullchain* dosyasını verin.
- **Doğrulamayı kapatmak**: Testte `rejectUnauthorized: false` ya da `verify=False` yazıp üretime taşımak, TLS'i kimlik doğrulamasız şifrelemeye indirger; araya giren herkes kendi sertifikasını sunabilir.
- **Süre takibi yok**: Otomatik yenileme sessizce bozulabilir (DNS sağlayıcı API anahtarı değişti, 80. port kapandı). Sertifika bitiş tarihini metrik olarak izleyin ve son 14 güne girince alarm üretin.
:::

## TLS'in maliyeti ve nerede sonlandırıldığı

Modern işlemcilerde AES donanım komutları sayesinde simetrik şifrelemenin CPU maliyeti çoğu servis için ihmal edilebilir. Asıl maliyet el sıkışmadaki gidiş-dönüşlerdir; bu yüzden bağlantıları yeniden kullanmak (keep-alive, bağlantı havuzu) ve oturum biletleri önemlidir. Büyük sistemlerde TLS genellikle kenarda — CDN'de ya da load balancer'da — **sonlandırılır (TLS termination)**; iç ağda trafik ya yeniden şifrelenir ya da servis ağı (service mesh) üzerinden **mTLS** ile, yani iki tarafın da sertifika sunduğu karşılıklı doğrulamayla taşınır. "İç ağ güvenlidir" varsayımı, saldırganın bir kez içeri girdiği senaryoda çöker; sıfır güven (zero trust) yaklaşımı bu yüzden servisler arası trafikte de TLS ister.

:::realworld{company="Let's Encrypt"}
Let's Encrypt, Internet Security Research Group (ISRG) tarafından işletilen, kâr amacı gütmeyen ve ücretsiz sertifika veren bir CA'dır. Kuruluş amacını "web'in tamamını HTTPS'e taşımak" olarak açıklar ve bunu iki tasarım kararına dayandırır: sertifikalar **ücretsiz** ve tamamen **otomatik**. Elle başvuru formu yoktur; her şey ACME protokolüyle yürür ve protokol IETF'te RFC 8555 olarak standartlaştırılmıştır. Let's Encrypt sertifikaları bilinçli olarak kısa ömürlüdür (uzun süre 90 gün oldu) ve kuruluş, bu kısalığın hem sızan anahtarın zarar penceresini daralttığını hem de ekipleri otomasyona zorladığını açıkça savunur; yenilemenin süre dolmadan çok önce yapılmasını önerir. Belgelerinde HTTP-01, DNS-01 ve TLS-ALPN-01 doğrulama yöntemlerinin hangi durumda seçileceği ayrıntılı anlatılır. Bugün Caddy gibi web sunucuları ve Kubernetes'teki cert-manager, ACME'yi yerleşik olarak konuşur: alan adını yapılandırmaya yazmanız sertifikanın alınıp yenilenmesi için yeterlidir. Let's Encrypt'in etkisi, HTTPS'in "ek maliyetli bir seçenek" olmaktan çıkıp varsayılan hâle gelmesinin başlıca nedenlerinden biri olarak gösterilir.
:::

:::callout{tone="tip" title="Mülakat özeti"}
Sertifika kimliği, (EC)DHE anahtarı, simetrik şifre veriyi korur. TLS 1.3: 1-RTT, zorunlu forward secrecy, şifreli sertifika, 0-RTT yalnızca idempotent istekler için. Doğrulama zinciri: imza + tarih + SAN + güvenilen kök.
:::

:::quiz{src="quiz.json"}
:::

:::resources
- [RFC 8446: The Transport Layer Security (TLS) Protocol Version 1.3](https://www.rfc-editor.org/rfc/rfc8446) — belge — TLS 1.3 standardı
- [RFC 8555: Automatic Certificate Management Environment (ACME)](https://www.rfc-editor.org/rfc/rfc8555) — belge — otomatik sertifika protokolü
- [Let's Encrypt: How It Works](https://letsencrypt.org/how-it-works/) — belge — ACME doğrulamasının sade anlatımı
- [Let's Encrypt: Challenge Types](https://letsencrypt.org/docs/challenge-types/) — belge — HTTP-01, DNS-01, TLS-ALPN-01
- [The Illustrated TLS 1.3 Connection](https://tls13.xargs.org/) — yazı — el sıkışmanın bayt bayt dökümü
:::

:::next{lesson="o-04-http-versions"}
Şifreli kanal hazır. Sırada bu kanalın üzerinden HTTP'nin nasıl taşındığı var: HTTP/1.1'in seri bağlantıları, HTTP/2'nin çoğullaması ve QUIC üzerinde HTTP/3.
:::

---
id: a-01-client-server-dns-http
slug: client-server-dns-http
module: a-system-design-fundamentals
order: 1
title:
  tr: "İstemci-Sunucu, DNS, HTTP/HTTPS, TCP/UDP, WebSocket"
  en: "Client-Server, DNS, HTTP/HTTPS, TCP/UDP, WebSocket"
summary:
  tr: Bir URL yazdığınızda ağda neler olur? DNS çözümlemeden TCP el sıkışmaya, TLS'ten HTTP isteğine ve WebSocket akışına kadar adım adım.
  en: What happens on the network when you type a URL? Step by step from DNS resolution to the TCP handshake, TLS, the HTTP request and WebSocket flows.
durationMinutes: 25
level: beginner
tags: [networking, dns, http, tcp, tls, websocket]
prerequisites: []
concepts: [client-server, dns-resolution, tcp-handshake, tcp-vs-udp, tls-handshake, http-request-response, http-versions, websocket]
---

## Kavram: her şey bir istekle başlar

Tarayıcıya `https://shop.example.com/urun/42` yazıp Enter'a bastığınızda ekranda sayfa belirene kadar geçen birkaç yüz milisaniyede, birbirinden bağımsız en az beş protokol sırayla devreye girer. Sistem tasarımının geri kalanı — load balancer, cache, CDN, gateway — bu zincirin halkalarına eklenen bileşenlerdir. Zinciri bilmeden eklentileri doğru yere koyamazsınız.

**İstemci-sunucu modeli (client-server)** en basit haliyle şudur: istemci (browser, mobil uygulama, başka bir servis) bir **istek (request)** gönderir, sunucu bu isteği işler ve bir **yanıt (response)** döner. İstemci konuşmayı başlatır; sunucu dinler. Bu asimetri önemlidir: sunucu istemciye kendiliğinden mesaj gönderemez — bu kısıtı dersin sonunda WebSocket ile aşacağız.

:::diagram{src="diagram.svg" alt="Tarayıcıdan sunucuya bir isteğin katmanları: DNS çözümleme, TCP el sıkışma, TLS, HTTP istek/yanıt ve WebSocket yükseltme|The layers of a request from browser to server: DNS resolution, TCP handshake, TLS, HTTP request/response and WebSocket upgrade"}
Bir URL'nin yolculuğu: önce adres bulunur (DNS), sonra güvenilir bir kanal açılır (TCP), kanal şifrelenir (TLS), nihayet uygulama konuşur (HTTP).
:::

## 1. Adım — DNS: isim yerine adres

Bilgisayarlar `shop.example.com` gibi isimlerle değil IP adresleriyle (`203.0.113.10`) konuşur. **DNS (Domain Name System)** bu çeviriyi yapan dağıtık, hiyerarşik bir veritabanıdır. Çözümleme sırası şöyledir:

1. **Tarayıcı cache'i** — aynı siteye az önce girdiyseniz cevap buradadır (~0 ms).
2. **İşletim sistemi cache'i / hosts dosyası**.
3. **Recursive resolver** — genelde ISS'nizin ya da `1.1.1.1` / `8.8.8.8` gibi genel bir servisin sunucusu. Cevabı bilmiyorsa sizin adınıza araştırır:
   - **Root sunucu** → "`.com` için şu TLD sunucularına sor."
   - **TLD sunucu (.com)** → "`example.com` için şu yetkili sunuculara sor."
   - **Authoritative (yetkili) sunucu** → "`shop.example.com` = `203.0.113.10`, TTL 300 s."

Her kayıt bir **TTL (time to live)** ile gelir; TTL dolana kadar ara katmanlar cevabı cache'ler. Bu yüzden bir DNS değişikliği "dünyaya yayılması dakikalar/saatler alır" dediğimiz şeydir — aslında yayılan bir şey yoktur, eski cache'ler zamanla düşer.

| Kayıt tipi | Ne döner | Örnek kullanım |
|---|---|---|
| `A` / `AAAA` | IPv4 / IPv6 adresi | `shop.example.com → 203.0.113.10` |
| `CNAME` | Başka bir isim (takma ad) | `www → shop.example.com` |
| `MX` | Posta sunucusu | e-posta yönlendirme |
| `TXT` | Serbest metin | alan adı doğrulama, SPF |
| `NS` | Yetkili sunucu | delegasyon |

DNS çoğunlukla **UDP** üzerinden, 53. porttan konuşur çünkü tek paketlik soru-cevap için bağlantı kurma maliyeti gereksizdir. Yanıt büyükse (DNSSEC) TCP'ye düşer.

## 2. Adım — TCP: güvenilir bir kanal

IP adresi elimizde. Şimdi sunucuyla konuşacak bir kanal gerekir. HTTP/1.1 ve HTTP/2, **TCP** üzerinde çalışır. TCP bağlantısı üç paketlik bir el sıkışmayla kurulur:

1. İstemci → Sunucu: **SYN** ("bağlanmak istiyorum, sıra numaram X")
2. Sunucu → İstemci: **SYN-ACK** ("tamam, X'i aldım, benim sıra numaram Y")
3. İstemci → Sunucu: **ACK** ("Y'yi aldım, başlayalım")

Bu üç adım bir **round-trip time (RTT)** kadar sürer — İstanbul'dan Frankfurt'a ~30 ms, ABD batı kıyısına ~160 ms. Henüz tek bir byte uygulama verisi gönderilmedi; sırf bağlanmak için bir RTT harcadık. Gecikme dersinde bu RTT'lerin neden bu kadar önemli olduğunu göreceğiz.

### TCP mi, UDP mi?

| | **TCP** | **UDP** |
|---|---|---|
| Bağlantı | Kurulur (3-way handshake) | Yok, paket atılır |
| Teslim garantisi | Var — kayıp paket yeniden gönderilir | Yok |
| Sıralama | Var | Yok |
| Akış/Tıkanıklık kontrolü | Var | Yok |
| Ek yük | Daha yüksek | Çok düşük |
| Tipik kullanım | HTTP, e-posta, dosya aktarımı, veritabanı | DNS, video/ses akışı, oyun, QUIC/HTTP3 |

Kural basit: **her byte önemliyse TCP, güncellik gecikmeden önemliyse UDP.** Görüntülü görüşmede 200 ms önceki kareyi yeniden göndermenin anlamı yoktur; dosya indirirken tek bir eksik byte dosyayı bozar.

## 3. Adım — TLS: kanalı şifrelemek

`https://` yazdık; demek ki HTTP'den önce **TLS (Transport Layer Security)** el sıkışması gerekir. TLS 1.3'te bu tek RTT sürer:

1. İstemci **ClientHello** gönderir: desteklediği şifre takımları, bir anahtar paylaşım değeri ve **SNI** (hangi alan adını istediği — aynı IP'de yüzlerce site barınabilir).
2. Sunucu **ServerHello** ile kendi anahtar payını, **sertifikasını** ve imzasını döner.
3. İstemci sertifikayı güvendiği kök otoritelere (CA) kadar zincirleyerek doğrular, iki taraf ortak oturum anahtarını türetir.

Bundan sonraki her HTTP paketi simetrik şifreyle (AES-GCM, ChaCha20) korunur. TLS'in üç garantisi vardır: **gizlilik** (araya giren okuyamaz), **bütünlük** (değiştiremez), **kimlik doğrulama** (gerçekten `shop.example.com` ile konuşuyorsunuz).

:::callout{tone="info" title="RTT muhasebesi"}
HTTPS üzerinden ilk isteğin maliyeti: DNS (0–1 RTT) + TCP (1 RTT) + TLS 1.3 (1 RTT) + HTTP isteği (1 RTT) = **3–4 RTT**. 160 ms RTT'li bir kullanıcı için bu, daha ilk byte gelmeden ~500 ms demektir. **HTTP/3 (QUIC)** TCP ve TLS el sıkışmalarını UDP üzerinde tek adımda birleştirir; tekrar bağlanan istemci için 0-RTT bile mümkündür. CDN'lerin kullanıcıya fiziksel olarak yakın olmasının asıl nedeni de bu RTT'leri kısaltmaktır.
:::

## 4. Adım — HTTP: uygulama konuşuyor

Kanal hazır. Tarayıcı nihayet asıl isteği gönderir:

```http
GET /urun/42 HTTP/1.1
Host: shop.example.com
Accept: text/html
Cookie: session=abc123
```

Sunucu yanıtlar:

```http
HTTP/1.1 200 OK
Content-Type: text/html; charset=utf-8
Cache-Control: max-age=60
Content-Length: 5120

<!doctype html>...
```

Bir HTTP mesajı dört parçadan oluşur: **metod + yol** (ne istiyorum), **başlıklar** (üst veri), boş satır ve **gövde**. Metodlar anlam taşır ve sistem tasarımında bu anlamlara güvenilir:

| Metod | Anlam | Idempotent? | Cache'lenebilir? |
|---|---|---|---|
| `GET` | Oku | Evet | Evet |
| `POST` | Oluştur / işlem başlat | Hayır | Genelde hayır |
| `PUT` | Tamamen değiştir | Evet | Hayır |
| `PATCH` | Kısmen değiştir | Hayır (tanım gereği) | Hayır |
| `DELETE` | Sil | Evet | Hayır |

**Idempotent** (aynı isteği iki kez göndermek tek seferle aynı sonucu verir) kavramı ileride retry ve mesaj kuyruğu derslerinde defalarca karşınıza çıkacak. Bir `POST /odeme` isteğini körlemesine tekrarlamak çift tahsilat demektir; bir `PUT /sepet/42` isteğini tekrarlamak zararsızdır.

Durum kodları da aileler hâlinde okunur: **2xx** başarı, **3xx** yönlendirme/cache (`301`, `304 Not Modified`), **4xx** istemci hatası (`400`, `401`, `403`, `404`, `429 Too Many Requests`), **5xx** sunucu hatası (`500`, `502 Bad Gateway`, `503 Service Unavailable`, `504 Gateway Timeout`).

### HTTP sürümleri neden değişti?

- **HTTP/1.1**: Her bağlantıda aynı anda tek istek (head-of-line blocking). Tarayıcılar bunu aşmak için alan adı başına 6 paralel bağlantı açar.
- **HTTP/2**: Tek TCP bağlantısında çoklu **stream** (multiplexing), başlık sıkıştırma (HPACK), sunucu itmesi. TCP seviyesinde paket kaybı hâlâ tüm stream'leri bekletir.
- **HTTP/3**: QUIC (UDP üstü) ile stream'ler birbirinden bağımsız; bir stream'in paket kaybı diğerlerini durdurmaz. Bağlantı göçü: Wi-Fi'dan 5G'ye geçince bağlantı kopmaz.

Aşağıdaki animasyon tüm zinciri tek akışta gösterir.

:::animation{scene="scene.json"}
URL yazımından WebSocket yükseltmesine: DNS → TCP → TLS → HTTP → Upgrade.
:::

## 5. Adım — WebSocket: sunucu da konuşsun

HTTP istek-yanıt modelinde sunucu, istemci sormadan konuşamaz. Sohbet uygulaması, canlı skor, borsa fiyatı gibi senaryolarda bu yetersizdir. Üç yaklaşım vardır:

1. **Polling**: İstemci her 2 saniyede "yeni bir şey var mı?" diye sorar. Basit ama israf; cevapların çoğu "hayır".
2. **Long polling**: Sunucu, yeni veri gelene kadar yanıtı bekletir. Daha az israf, ama her mesaj için yeni istek gerekir.
3. **WebSocket**: Normal bir HTTP isteğiyle başlar, `Upgrade: websocket` başlığıyla protokol değiştirilir; sunucu `101 Switching Protocols` döner. Artık aynı TCP bağlantısı üzerinde iki yön de istediği zaman çerçeve (frame) gönderebilir.

```http
GET /chat HTTP/1.1
Host: shop.example.com
Upgrade: websocket
Connection: Upgrade
Sec-WebSocket-Key: dGhlIHNhbXBsZSBub25jZQ==

HTTP/1.1 101 Switching Protocols
Upgrade: websocket
Connection: Upgrade
Sec-WebSocket-Accept: s3pPLMBiTxaQ9kYGzzhZRbK+xOo=
```

**Server-Sent Events (SSE)** dördüncü bir seçenektir: tek yönlü (sunucu → istemci), düz HTTP üstünde, otomatik yeniden bağlanma ile. Bildirim akışı gibi istemcinin nadiren konuştuğu senaryolarda WebSocket'ten daha basittir.

:::interactive{type="request-journey" stages="dns,tcp,tls,http,websocket" rttMs=40 http3=false}
RTT değerini değiştirip ilk byte'a kadar geçen sürenin nasıl katlandığını izleyin: DNS, TCP, TLS ve HTTP adımlarının her biri en az bir gidiş-dönüş ister. "HTTP/3 (QUIC)" kutusunu işaretleyin: TCP ve TLS el sıkışmaları tek adıma iner ve toplam bir RTT kısalır. "DNS önbellekte" kutusuyla tekrar ziyaretin etkisini karşılaştırın. WebSocket aşamasının yalnızca bir yükseltme (upgrade) maliyeti olduğuna dikkat edin; bağlantı sonrasında açık kalır ve mesajlar yeni el sıkışma gerektirmez.
:::

:::code{lang="ts" title="Node.js ile DNS çözümleme, HTTPS isteği ve WebSocket yükseltmesi"}
```ts
import dns from "node:dns/promises";
import https from "node:https";
import { WebSocketServer } from "ws"; // npm i ws

// 1) DNS: isim → IP (işletim sistemi çözümleyicisini atlayıp doğrudan sorgu)
export async function resolveHost(hostname: string): Promise<string[]> {
  const records = await dns.resolve4(hostname); // A kayıtları
  return records; // ör. ["203.0.113.10"]
}

// 2) TCP + TLS + HTTP tek çağrıda: https modülü el sıkışmaları bizim için yapar
export function fetchProduct(id: number): Promise<{ status: number; body: string }> {
  return new Promise((resolve, reject) => {
    const req = https.request(
      { hostname: "shop.example.com", path: `/urun/${id}`, method: "GET",
        headers: { accept: "application/json" }, timeout: 5_000 },
      (res) => {
        let body = "";
        res.setEncoding("utf8");
        res.on("data", (chunk) => (body += chunk));      // gövde parça parça gelir
        res.on("end", () => resolve({ status: res.statusCode ?? 0, body }));
      },
    );
    req.on("timeout", () => req.destroy(new Error("zaman aşımı")));
    req.on("error", reject);
    req.end(); // GET: gövde yok, isteği gönder
  });
}

// 3) WebSocket: HTTP sunucusunun Upgrade isteğini yakalayıp çift yönlü kanala çevir
export function attachChat(server: https.Server) {
  const wss = new WebSocketServer({ noServer: true });
  server.on("upgrade", (req, socket, head) => {
    if (req.url !== "/chat") return socket.destroy(); // yalnızca /chat yükseltilir
    wss.handleUpgrade(req, socket, head, (ws) => wss.emit("connection", ws, req));
  });
  wss.on("connection", (ws) => {
    ws.send(JSON.stringify({ type: "hello" }));          // sunucu ilk konuşan taraf olabilir
    ws.on("message", (data) => {
      for (const peer of wss.clients) if (peer.readyState === peer.OPEN) peer.send(data); // yayın
    });
  });
}
```
```python
import socket, ssl, json

def resolve_host(hostname: str) -> list[str]:
    # DNS çözümleme: işletim sistemi resolver'ı üzerinden A kayıtları
    return sorted({info[4][0] for info in socket.getaddrinfo(hostname, 443, socket.AF_INET)})

def fetch_product(product_id: int) -> tuple[int, bytes]:
    host = "shop.example.com"
    ctx = ssl.create_default_context()                      # kök CA listesi ile sertifika doğrulama
    with socket.create_connection((host, 443), timeout=5) as tcp:   # TCP 3-way handshake
        with ctx.wrap_socket(tcp, server_hostname=host) as tls:     # TLS handshake (SNI = host)
            tls.sendall(f"GET /urun/{product_id} HTTP/1.1\r\nHost: {host}\r\nConnection: close\r\n\r\n".encode())
            raw = b""
            while chunk := tls.recv(4096):
                raw += chunk
    head, _, body = raw.partition(b"\r\n\r\n")
    status = int(head.split(b" ")[1])
    return status, body
```
:::

:::realworld{company="Cloudflare"}
Cloudflare'in `1.1.1.1` çözümleyicisi günde trilyonlarca DNS sorgusu yanıtlar ve medyan yanıt süresi ~10 ms'dir. Bunu mümkün kılan iki şey var: **anycast** (aynı IP dünyanın 300'den fazla noktasından yayınlanır; BGP sizi en yakın PoP'a götürür) ve agresif **cache**. Aynı şirket, kullanıcı ile kendi edge sunucusu arasındaki bağlantıda **HTTP/3 + TLS 1.3** kullanarak ilk byte süresini (TTFB) özellikle mobil ağlarda belirgin şekilde düşürdüğünü raporlamıştır; çünkü yüksek kayıplı bir 4G bağlantısında TCP'nin head-of-line blocking problemi QUIC'te stream başına izole edilir. WebSocket tarafında Cloudflare, edge'de yükseltme isteğini kabul edip origin'e ayrı bir bağlantı açar; böylece milyonlarca boşta bekleyen sohbet bağlantısı origin yerine edge'de tutulur.
:::

:::callout{tone="tip" title="Mülakat ipuçları"}
- "URL yazınca ne olur?" sorusunun cevabı bir listedir ama puan **neden**'lerde: DNS neden UDP, TCP neden 3 paket, TLS neden sertifika, HTTP/2 neden multiplexing.
- İlk isteğin **RTT maliyetini** sayabilmek sizi ayırır: 3–4 RTT. Çözümler: CDN (RTT'yi kısalt), keep-alive (TCP'yi yeniden kullan), TLS session resumption, HTTP/3.
- Gerçek zamanlı özellik istenince "WebSocket koyarım" demeden önce SSE yeterli mi diye sorun; tek yönlüyse SSE daha ucuzdur.
- `POST` idempotent değildir; ödeme gibi akışlarda **idempotency key** başlığı isteyin.
:::

:::quiz{src="quiz.json"}
:::

:::next{lesson="a-02-latency-throughput-cap"}
Sırada: bu derste saydığımız RTT'leri ölçmek, gecikme ile verimliliği ayırmak ve dağıtık sistemlerin temel takası olan CAP teoremi.
:::

---
id: a-05-load-balancing
slug: load-balancing
module: a-system-design-fundamentals
order: 5
title:
  tr: "Load Balancer: L4/L7 ve Dağıtım Algoritmaları"
  en: "Load Balancer: L4/L7 and Distribution Algorithms"
summary:
  tr: Round-robin, least connections, IP hash, weighted, health check ve sticky session — her algoritma için istek dağılım animasyonu ve interaktif simülatör.
  en: Round-robin, least connections, IP hash, weighted, health checks and sticky sessions — a distribution animation and an interactive simulator for every algorithm.
durationMinutes: 25
level: intermediate
tags: [load-balancer, scaling, availability, networking]
prerequisites: [a-01-client-server-dns-http, a-03-horizontal-vertical-scaling]
concepts: [load-balancer, l4-vs-l7, round-robin, weighted-round-robin, least-connections, ip-hash, health-check, sticky-session]
---

## Kavram: tek kapı, çok sunucu

Yatay ölçekleme dersinde bir uygulamanın birden fazla kopyasını (replika) çalıştırmayı öğrendik. Peki kullanıcı hangi kopyaya bağlanacak? Bunu kullanıcıya bırakamayız. **Load balancer (yük dengeleyici)**, tek bir adres arkasında duran ve gelen istekleri bir sunucu havuzuna dağıtan bileşendir.

Bir yük dengeleyicinin üç temel görevi vardır:

1. **Dağıtım** — istekleri bir algoritmaya göre sunuculara paylaştırmak.
2. **Sağlık takibi** — düşen sunucuyu fark edip havuzdan çıkarmak (health check).
3. **Soyutlama** — sunucu ekleme/çıkarma işlemlerini kullanıcıdan gizlemek.

Bunun sonucu olarak sistem hem **daha fazla trafik** kaldırır (kapasite) hem de **tek bir sunucu çökse bile ayakta kalır** (yüksek erişilebilirlik).

:::diagram{src="diagram.svg" alt="İstemciler, L7 yük dengeleyici ve üç uygulama sunucusu; health check okları|Clients, an L7 load balancer and three application servers with health check arrows"}
Yük dengeleyici tek bir genel IP yayınlar; arka uçtaki sunucular özel ağda kalır.
:::

## L4 mü, L7 mi?

Yük dengeleyiciler OSI modelinde hangi katmana baktıklarına göre ikiye ayrılır:

| | **L4 (Taşıma katmanı)** | **L7 (Uygulama katmanı)** |
|---|---|---|
| Neye bakar? | IP adresi + TCP/UDP portu | HTTP başlıkları, URL, çerez, gövde |
| Karar örneği | "443 portuna gelen her bağlantıyı şu havuza yolla" | "`/api/orders` isteklerini sipariş servisine, `/static` isteklerini CDN'e yolla" |
| Hız | Çok hızlı (paketi açmaz) | Daha yavaş (isteği ayrıştırır) |
| TLS | Genelde pass-through | Genelde burada sonlandırılır |
| Örnekler | AWS NLB, HAProxy (tcp mode), IPVS | AWS ALB, NGINX, Envoy, HAProxy (http mode) |

Pratikte büyük sistemler ikisini üst üste kullanır: önde çok hızlı bir L4 katmanı milyonlarca bağlantıyı kabul eder, arkasında L7 katmanı içeriğe göre yönlendirme yapar.

## Dağıtım algoritmaları

Aşağıdaki animasyon en temel algoritma olan round-robin'i, bir sunucunun çökmesini ve health check'in devreye girmesini gösterir. Oynat/duraklat ve adım ileri/geri kontrollerini kullanın.

:::animation{scene="scene.json"}
Round-robin dağıtım, S2'nin çökmesi ve health check ile havuzdan çıkarılması.
:::

### Round-robin
İstekler sırayla dağıtılır: 1→S1, 2→S2, 3→S3, 4→S1... Uygulaması bir sayaçtan ibarettir. Sunucular eşit güçte ve istekler benzer maliyetteyse çok iyi çalışır; aksi hâlde yavaş sunucu diğerleriyle aynı yükü alır ve kuyruğu şişer.

### Weighted round-robin (ağırlıklı)
Her sunucuya bir ağırlık verilir. Ağırlığı 3 olan sunucu, ağırlığı 1 olana göre üç kat istek alır. Farklı boyuttaki makineleri karıştırırken ya da yeni sürümü kademeli açarken (canary) kullanılır. NGINX'in kullandığı *smooth weighted round-robin* varyantı, istekleri "3-1-1" gibi kümeler hâlinde değil, "S1 S1 S2 S1 S3" gibi dağınık gönderir.

### Least connections (en az bağlantı)
Her istek, o anda **en az aktif bağlantısı** olan sunucuya gider. Uzun süren istekler (dosya yükleme, raporlama, WebSocket) olduğunda round-robin'den çok daha adildir çünkü gerçek yükü ölçer. Ağırlıklı sürümü, bağlantı sayısını ağırlığa böler.

### IP hash
İstemcinin IP adresi hash'lenir ve sunucu sayısına göre mod alınır: `hash(ip) mod N`. Aynı istemci hep aynı sunucuya düşer — oturum bilgisi sunucuda tutuluyorsa işe yarar. Zayıf yanları: NAT arkasındaki binlerce kullanıcı aynı IP'den geliyormuş gibi görünür ve N değiştiğinde (sunucu ekleme/çıkarma) neredeyse tüm eşlemeler bozulur. Bu son problemi *consistent hashing* dersinde çözeceğiz.

### Random / power of two choices
Rastgele seçim, büyük havuzlarda şaşırtıcı derecede iyi dağılır. "İki rastgele sunucu seç, daha az yüklü olanı kullan" (power of two choices) ise neredeyse least-connections kadar iyi sonuç verir ve dağıtık yük dengeleyicilerde koordinasyon gerektirmez.

:::interactive{type="load-balancer" algorithm="round-robin" servers=3 sticky=false}
Algoritmayı değiştirin, istek gönderin, bir sunucuyu "düşürün" ve dağılımın nasıl değiştiğini izleyin. Ağırlıkları artırıp weighted round-robin'in etkisini karşılaştırın; dağılım dengesizliğini sağdaki standart sapma göstergesinde takip edin.
:::

## Health check: ölü sunucuya istek göndermemek

Yük dengeleyici periyodik olarak (ör. her 5 saniyede bir) her sunucuya küçük bir istek gönderir:

- **L4 health check**: TCP bağlantısı açılabiliyor mu?
- **L7 health check**: `GET /health` 200 döndürüyor mu? Gövdede bağımlılık durumu (DB, cache) var mı?

Arka arkaya *N* başarısız kontrolden sonra sunucu **unhealthy** sayılır ve havuzdan çıkarılır; *M* başarılı kontrolden sonra geri alınır. Bu eşikler kısa süreli dalgalanmalarda sunucuların sürekli girip çıkmasını (flapping) engeller.

:::callout{tone="warning" title="Sığ mı, derin mi?"}
`/health` uç noktası DB'ye de gidiyorsa, DB yavaşladığında **tüm** sunucular aynı anda unhealthy olur ve yük dengeleyici havuzu boşaltır — küçük bir sorun tam kesintiye dönüşür. Bu yüzden çoğu ekip yük dengeleyici için *sığ* (sadece süreç ayakta mı) bir liveness kontrolü, izleme için ayrı bir *derin* readiness kontrolü kullanır.
:::

## Sticky session (oturum yapışkanlığı)

Sunucu kullanıcının sepetini belleğinde tutuyorsa, kullanıcının her isteği aynı sunucuya gitmek zorundadır. Yük dengeleyici bunu bir çerez (`AWSALB`, `SERVERID`) ya da IP hash ile sağlar. Ancak bu yaklaşım:

- Dağılımı bozar (bazı sunucular "ağır" kullanıcılarla dolar),
- Sunucu düşerse oturum kaybolur,
- Ölçeklemeyi zorlaştırır.

Modern tasarım, durumu sunucudan çıkarıp paylaşımlı bir depoya (Redis) taşır ve servisleri **stateless** yapar; böylece sticky session'a gerek kalmaz. Bunu bir önceki derste gördük.

:::code{lang="ts" title="Smooth weighted round-robin (NGINX algoritması)"}
```ts
interface Server { id: string; weight: number; current: number }

/** Her çağrıda bir sonraki sunucuyu seçer; ağırlıkları dağınık biçimde uygular. */
export function pickWeighted(servers: Server[]): Server {
  const total = servers.reduce((sum, s) => sum + s.weight, 0);
  let best: Server | undefined;
  for (const s of servers) {
    s.current += s.weight;                       // her sunucu ağırlığı kadar puan toplar
    if (!best || s.current > best.current) best = s;
  }
  best!.current -= total;                        // seçilen sunucu toplam kadar geri düşer
  return best!;
}
```
```python
def pick_weighted(servers):
    """servers: [{"id": str, "weight": int, "current": int}]"""
    total = sum(s["weight"] for s in servers)
    best = None
    for s in servers:
        s["current"] += s["weight"]
        if best is None or s["current"] > best["current"]:
            best = s
    best["current"] -= total
    return best
```
```java
public Server pickWeighted(List<Server> servers) {
    int total = servers.stream().mapToInt(Server::weight).sum();
    Server best = null;
    for (Server s : servers) {
        s.current += s.weight;
        if (best == null || s.current > best.current) best = s;
    }
    best.current -= total;
    return best;
}
```
:::

## Yük dengeleyicinin kendisi darboğaz olursa?

Tek bir yük dengeleyici de tek hata noktasıdır (SPOF). Çözümler katman katman gelir:

1. **Aktif-pasif çift**: İki LB, sanal IP'yi (VIP) VRRP/keepalived ile paylaşır; biri düşerse diğeri IP'yi devralır.
2. **DNS round-robin / GeoDNS**: Birden çok LB IP'si DNS'te yayınlanır; kullanıcı coğrafyasına göre en yakın LB'ye gider.
3. **Anycast**: Aynı IP dünyanın birçok noktasından yayınlanır; BGP en yakın noktaya yönlendirir (Cloudflare, Google bunu kullanır).

:::realworld{company="Amazon"}
Amazon'da bir ürün sayfası isteği önce **Route 53** (DNS) ile en yakın bölgeye yönlendirilir, sonra **CloudFront** edge'inden geçer, ardından **Application Load Balancer (L7)** path'e göre doğru mikroservis hedef grubuna gönderir. Hedef grup içinde varsayılan algoritma round-robin'dir; uzun süreli isteklerde *least outstanding requests* seçilebilir. Her hedef için health check `HealthyThresholdCount` ve `UnhealthyThresholdCount` ile yapılandırılır. Prime Day gibi zirvelerde ALB kapasitesi önceden "ısıtılır" (pre-warming) çünkü ALB'nin kendisi de ölçeklenen bir filodur.
:::

:::callout{tone="tip" title="Mülakat özeti"}
- "Load balancer koyarım" demek yetmez: **L4 mü L7 mi**, **hangi algoritma**, **health check nasıl**, **LB'nin kendisi nasıl yedekleniyor** sorularına hazır olun.
- Durum (state) sunucudaysa sticky session, değilse herhangi bir algoritma — tercihen least connections ya da round-robin.
:::

:::quiz{src="quiz.json"}
:::

:::next{lesson="a-06-api-gateway"}
Sırada: yük dengeleyicinin L7'de yapabileceklerini bir adım ileri taşıyan API Gateway — routing, auth, rate limiting ve circuit breaker.
:::

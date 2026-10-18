---
id: f-05-physical-request-path
slug: physical-request-path
module: f-code-and-infrastructure
order: 5
title:
  tr: "Bir İsteğin Fiziksel Yolu"
  en: "The Physical Path of a Request"
summary:
  tr: Kullanıcı → DNS → CDN → LB → Gateway → Servis → Cache → DB; hangi katman hangi sunucuda?
  en: User → DNS → CDN → LB → Gateway → Service → Cache → DB; which layer runs on which server?
durationMinutes: 30
level: intermediate
tags: [networking, request-path, cdn, dns, latency, infrastructure, observability]
prerequisites: [a-01-client-server-dns-http, f-01-servers-datacenters-regions, f-03-kubernetes-basics]
concepts: [dns-resolution, anycast, edge-pop, cdn-cache, tls-termination, load-balancer-placement, api-gateway, service-pod, cache-node, database-instance, latency-budget, distributed-tracing]
---

## Kavram: her kutunun bir adresi, her adresin bir binası var

Sistem tasarımı diyagramlarında "DNS → CDN → LB → Gateway → Servis → Cache → DB" kutularını çizmeye alıştık. Bu ders kutuları **fiziksel dünyaya indirir**: İstanbul'daki bir kullanıcı `shop.example.com/cart` adresine dokunduğunda istek hangi binalardan, hangi şehirlerden, hangi sanal makinelerden geçer? Her katmanı "nerede çalışıyor?" sorusuyla etiketleyeceğiz, çünkü **gecikme bütçesi** (latency budget) ve hata ayıklama bu bilgiye dayanır: 200 ms'lik bir isteğin 90 ms'si İstanbul–Frankfurt arası fiber yolculuğuysa, kodu optimize etmek yerine edge'de cache'lemek doğru harekettir.

Senaryomuz: Amazon benzeri bir e-ticaret, tek region (eu-central-1, Frankfurt), üç AZ, Kubernetes üzerinde mikroservisler, CloudFront benzeri bir CDN.

## Katman katman fiziksel konum

| # | Katman | Fiziksel konum | Çalıştığı donanım | Tipik gecikme katkısı |
|---|---|---|---|---|
| 1 | **Kullanıcı cihazı** | İstanbul, kullanıcının eli | Telefon / dizüstü | — |
| 2 | **DNS çözümleme** | ISP resolver (İstanbul) → yetkili DNS (Route 53, **anycast**: dünyada 100+ PoP, en yakını İstanbul/Sofya) | Resolver sunucuları, anycast edge | 1–30 ms (cache'liyse ~0) |
| 3 | **CDN / edge PoP** | İstanbul edge PoP (internet değişim noktasında kiralanmış bir kafes) | Edge sunucuları: çok SSD, çok RAM, TLS hızlandırma | 5–15 ms RTT; **TLS burada sonlanır** |
| 4 | **Edge → origin** | İstanbul → Frankfurt, ~1.900 km fiber (çoğu zaman sağlayıcının özel omurgası) | Fiber, router'lar | ~25–35 ms RTT |
| 5 | **Load balancer (ALB)** | Frankfurt region, her AZ'de bir LB düğümü (AWS yönetir) | AWS'nin LB filosu (sizin görmediğiniz VM'ler) | < 1 ms |
| 6 | **API Gateway** | EKS kümesi, AZ-a/b/c'ye yayılmış pod'lar (Envoy/Kong) | `m6g.large` EC2 node'larındaki pod'lar | 1–3 ms (JWT doğrulama, rate limit) |
| 7 | **cart-service** | EKS pod, ör. node `ip-10-0-12-34` AZ-a | EC2 node içindeki container | 5–20 ms (iş mantığı) |
| 8 | **Cache (Redis)** | ElastiCache düğümü, **AZ-a** (servisle aynı AZ, replikası AZ-b) | `cache.r6g.large` VM, veri RAM'de | 0,3–1 ms (aynı AZ), 1–2 ms (çapraz AZ) |
| 9 | **Veritabanı (Postgres)** | RDS primary **AZ-a**, senkron standby **AZ-b**, read replica AZ-c | `db.r6g.xlarge` VM + EBS/NVMe disk | 2–10 ms (indeksli sorgu) |

Dikkat: Satır 4 tek başına tüm bütçenin en büyük kalemidir. Bu yüzden CDN yalnızca statik dosya için değil, **API yanıtlarını** da (kısa TTL ile) cache'lemek için kullanılır; cache hit'te istek Frankfurt'a hiç gitmez.

:::diagram{src="diagram.svg" alt="İstanbul'daki kullanıcıdan edge PoP'a, oradan Frankfurt region'ındaki üç AZ'ye yayılmış LB, gateway pod'ları, servis pod'u, Redis düğümü ve RDS primary/standby'a uzanan fiziksel istek yolu; her katmanın konumu ve gecikme katkısı|Physical request path from a user in Istanbul to the edge PoP, then to the LB, gateway pods, service pod, Redis node and RDS primary/standby spread across three AZs in the Frankfurt region; each layer's location and latency contribution"}
Her kutu bir binaya ve bir makineye karşılık gelir. Gecikmenin en büyük kalemi kutuların kendisi değil, aralarındaki mesafedir.
:::

## Yolculuğu adım adım izleyelim

Aşağıdaki animasyonda her düğümün alt etiketi **fiziksel konumunu** gösterir: edge PoP şehri, region, AZ, node ya da instance. Sahneyi oynatırken gecikme sayacını takip edin.

:::animation{scene="scene.json"}
İstanbul'dan Frankfurt'a bir sepet isteğinin fiziksel yolculuğu: DNS, edge PoP, bölgesel LB, gateway pod'u, servis pod'u, aynı AZ'deki Redis, AZ-a'daki RDS primary ve geri dönüş.
:::

### 1. DNS: adı adrese çevirmek

Tarayıcı önce `shop.example.com` için bir IP ister. Sırayla: tarayıcı cache'i → işletim sistemi → ISP'nin recursive resolver'ı (İstanbul'da bir veri merkezi) → yetkili DNS (Route 53). Route 53 **anycast** kullanır: aynı IP dünyanın 100'den fazla noktasından yayınlanır, BGP en yakın PoP'a yönlendirir. Dönen cevap CDN'in edge IP'sidir — ve bu IP de anycast'tir, yani kullanıcı otomatik olarak **en yakın edge PoP**'a düşer. TTL 60 sn gibi kısa tutulur ki felaket anında başka region'a yönlendirme hızlı olsun.

### 2. Edge PoP: şehirdeki ilk durak

Edge PoP, internet değişim noktalarına (İstanbul'da DE-CIX İstanbul gibi) yakın kiralanmış küçük bir veri merkezi alanıdır; birkaç rack, çok sayıda SSD ve bellek. Burada üç şey olur:

- **TCP + TLS el sıkışması** kullanıcıya en yakın noktada tamamlanır (3 gidiş-dönüş × 10 ms = 30 ms; aynı el sıkışma Frankfurt'la yapılsaydı 3 × 35 = 105 ms olurdu).
- **Cache kontrolü**: `/static/app.js` kesinlikle buradan döner; `/api/cart` kişiye özel olduğu için cache'lenmez, ama `/api/products/123` 30 sn TTL ile cache'lenebilir.
- **İlk güvenlik katmanı**: WAF kuralları ve DDoS filtreleri (f-07'de ayrıntılı).

Cache miss'te edge, origin'e **önceden açılmış, sıcak tutulan bağlantılar** üzerinden gider; her istek için yeni TLS kurmaz.

### 3. Region'a giriş: load balancer

İstek Frankfurt'a varınca AWS'nin ALB'sine düşer. ALB "tek kutu" değildir: her AZ'de en az bir düğümü olan, AWS'nin yönettiği bir filodur; DNS adı birden çok IP döner. ALB, hedef gruptaki **sağlıklı** gateway pod'larına yönlendirir ve mümkünse **aynı AZ'deki** hedefi tercih eder (çapraz AZ trafik hem gecikme hem para maliyetidir).

### 4. API Gateway pod'u

Gateway (Envoy, Kong ya da Amazon API Gateway) EKS'te 3 AZ'ye yayılmış pod'lardır. JWT doğrular, rate limit uygular, isteği `cart-service`'e yönlendirir. Bu noktadan sonra her şey **kümenin özel ağında** (VPC, 10.0.0.0/16) akar; internete açık değildir.

### 5. Servis pod'u

`cart-service` pod'u, diyelim `ip-10-0-12-34` adlı `m6g.large` node'unda, AZ-a'da çalışıyor (f-03). Servis iki şey yapar: önce Redis'e, sonra gerekirse Postgres'e gider.

### 6. Cache: aynı AZ'de, RAM'de

ElastiCache Redis düğümü de AZ-a'dadır — bilinçli bir tercih. Aynı AZ'de RTT 0,3–0,5 ms iken komşu AZ 1–2 ms'dir; saniyede on binlerce cache çağrısında bu fark birikir. Redis'in replikası AZ-b'de durur; primary düşerse 15–30 sn içinde terfi eder. Sepet verisi `cart:{userId}` anahtarıyla, 30 dk TTL ile burada tutulur.

### 7. Veritabanı: primary AZ-a, standby AZ-b

Cache miss'te servis Postgres'e gider. RDS primary AZ-a'da (`db.r6g.xlarge`, NVMe destekli EBS), **senkron** standby AZ-b'de; her commit iki AZ'ye yazılmadan onaylanmaz (bu da yazmaya ~1 ms ekler, karşılığında sıfır veri kaybı). Okumalar yoğunsa AZ-c'deki read replica'ya dağıtılır. Sorgu indeksliyse 2–5 ms'de döner.

### 8. Geri dönüş

Yanıt aynı yolu tersine izler: pod → gateway → ALB → özel omurga üzerinden İstanbul edge → TLS ile şifrelenip kullanıcıya. Edge, yanıttaki `Cache-Control` başlığına bakar; cache'lenebilirse bir sonraki kullanıcı için saklar.

:::callout{tone="info" title="Gecikme bütçesi: 200 ms nereye gidiyor?"}
Tipik bir cache miss'li `/api/cart` isteği (yaklaşık): DNS 0–5 · TLS (edge'de) 20–30 · İstanbul→Frankfurt gidiş-dönüş 30 · ALB + gateway 3 · servis mantığı 10 · Redis miss 1 · Postgres 5 · geri serileştirme 2 · **toplam ≈ 80–90 ms**. Aynı istek Frankfurt'ta oturan bir kullanıcı için ≈ 40 ms, São Paulo'daki bir kullanıcı için ≈ 250 ms. Kullanıcı coğrafyası gecikmeyi koddan çok etkiler; bu yüzden büyük sistemler ikinci region'ı performans için de açar.
:::

:::interactive{type="request-journey" path="dns,cdn-edge,load-balancer,api-gateway,service,cache,database" rttMs=40 cacheHitRate=70}
RTT kaydırıcısı kullanıcının Frankfurt'taki region'a uzaklığını temsil eder: 40 ms (İstanbul), 5 ms (Frankfurt) ve 200 ms (São Paulo) değerlerini deneyip her katmanın gecikme katkısının şelalede nasıl değiştiğini izleyin — ağ maliyeti kodun yaptığı işi gölgeliyor mu? "CDN hit" kutusunu işaretleyin: istek edge'den döner, Frankfurt'a hiç gitmez. "20 istek" ile cache hit oranını %0'dan %90'a çıkarın: isteklerin kaçı veritabanına inmekten kurtuluyor, ortalama ve p95 nasıl düşüyor?
:::

## Bu yolu production'da nasıl görürüz? Distributed tracing

Her katmanın nerede çalıştığını bilmek güzel; ama **belirli bir yavaş istekte** hangi katmanın suçlu olduğunu bulmak için her atlama noktasının zaman damgası ve konumu kaydedilmelidir. Bunu **distributed tracing** (OpenTelemetry, AWS X-Ray, Jaeger) yapar: edge bir `traceparent` başlığı üretir, her servis kendi **span**'ini (başlangıç, süre, konum nitelikleri) ekler ve hepsi tek bir iz (trace) olarak birleşir.

:::code{lang="ts" title="OpenTelemetry: her span'e fiziksel konum eklemek"}
```ts
import { trace, SpanStatusCode, type Span } from '@opentelemetry/api';
import { readPlacement } from './placement';   // f-01'deki IMDS okuyucu

const tracer = trace.getTracer('cart-service');

// Açılışta bir kez: bu pod nerede çalışıyor?
const placement = await readPlacement();        // { region, availabilityZone, instanceId, instanceType }
const podName = process.env.HOSTNAME ?? 'unknown-pod';

/** Her span'e konum nitelikleri ekler; trace görünümünde AZ bazlı filtreleme yapılabilir */
function tagLocation(span: Span) {
  span.setAttributes({
    'cloud.region': placement.region,                  // eu-central-1
    'cloud.availability_zone': placement.availabilityZone, // eu-central-1a
    'host.id': placement.instanceId,                   // i-0abc...
    'k8s.pod.name': podName,                           // cart-service-7f9c-a1
  });
}

export async function getCart(userId: string, redis: RedisLike, db: DbLike) {
  return tracer.startActiveSpan('GET /cart', async (span) => {
    tagLocation(span);
    try {
      // 1) Cache: aynı AZ'de olmalı; span süresi 1 ms'yi aşıyorsa çapraz AZ'ye düşmüşüz demektir
      const cached = await tracer.startActiveSpan('redis.get', async (s) => {
        s.setAttributes({ 'db.system': 'redis', 'net.peer.name': 'cart-redis.az-a', 'db.operation': 'GET' });
        const v = await redis.get(`cart:${userId}`);
        s.setAttribute('cache.hit', v !== null);
        s.end();
        return v;
      });
      if (cached) return JSON.parse(cached);

      // 2) Veritabanı: primary AZ-a; standby'a senkron yazma gecikmesi span'de görünür
      const rows = await tracer.startActiveSpan('postgres.query', async (s) => {
        s.setAttributes({ 'db.system': 'postgresql', 'net.peer.name': 'cart-db.az-a', 'db.statement': 'SELECT ... FROM cart_items WHERE user_id = $1' });
        const r = await db.query('SELECT sku, qty, price FROM cart_items WHERE user_id = $1', [userId]);
        s.end();
        return r;
      });

      await redis.set(`cart:${userId}`, JSON.stringify(rows), { EX: 1800 });  // 30 dk TTL
      return rows;
    } catch (err) {
      span.setStatus({ code: SpanStatusCode.ERROR, message: String(err) });
      throw err;
    } finally {
      span.end();   // süre otomatik hesaplanır; edge span'i ile birleşince uçtan uca iz oluşur
    }
  });
}

interface RedisLike { get(k: string): Promise<string | null>; set(k: string, v: string, o: { EX: number }): Promise<unknown> }
interface DbLike { query(sql: string, params: unknown[]): Promise<unknown[]> }
```
```python
from opentelemetry import trace
from placement import read_placement   # f-01'deki IMDS okuyucu

tracer = trace.get_tracer("cart-service")
placement = read_placement()

def tag_location(span):
    span.set_attributes({
        "cloud.region": placement["region"],
        "cloud.availability_zone": placement["availability_zone"],
        "host.id": placement["instance_id"],
    })

def get_cart(user_id: str, redis, db):
    with tracer.start_as_current_span("GET /cart") as span:
        tag_location(span)
        with tracer.start_as_current_span("redis.get") as s:          # aynı AZ: < 1 ms beklenir
            cached = redis.get(f"cart:{user_id}")
            s.set_attribute("cache.hit", cached is not None)
        if cached:
            return cached
        with tracer.start_as_current_span("postgres.query"):          # primary AZ-a
            rows = db.query("SELECT sku, qty, price FROM cart_items WHERE user_id = %s", (user_id,))
        redis.set(f"cart:{user_id}", rows, ex=1800)
        return rows
```
:::

:::realworld{company="Amazon"}
Amazon.com'un ana sayfası için istek yolu derste anlattığımızın büyük ölçekli hâlidir. **Route 53**, 100'den fazla edge lokasyonundan anycast ile cevap verir; **CloudFront**'un 600'den fazla PoP'u (İstanbul dâhil) TLS'i sonlandırır ve statik içeriğin yanı sıra kişiselleştirilmemiş API yanıtlarını da cache'ler. Origin tarafında istek **ALB**'den geçip EKS/ECS üzerindeki yüzlerce mikroservise dağılır; Amazon'un ünlü ölçümüne göre tek bir ürün sayfası arka planda **100–150 servise** dokunur. Bu yüzden Amazon, her servise "p99.9 gecikme bütçesi" verir ve her çağrıyı **X-Ray** benzeri dahili izleme ile AZ/host seviyesinde etiketler: bir AZ'deki yavaşlama izlerde anında belirir ve trafik o AZ'den çekilir (f-01'deki senaryo). Amazon'un 2000'lerin başında ölçtüğü "her 100 ms gecikme satışları %1 düşürür" bulgusu, edge cache ve aynı-AZ yerleşimi gibi kararların iş gerekçesidir.
:::

:::callout{tone="tip" title="Mülakat ipuçları"}
- Diyagram çizerken her kutunun **yanına konumunu yazın**: "edge PoP (kullanıcıya yakın)", "LB (region, her AZ)", "Redis (servisle aynı AZ)", "DB primary AZ-a / standby AZ-b". Bu, soyut kutular çizen adaylardan sizi ayırır.
- Gecikme sorulduğunda **mesafeyi** ilk sıraya koyun: ışık fiberde ~200 km/ms gider; İstanbul–Frankfurt gidiş-dönüş fiziksel olarak 20 ms'nin altına inemez.
- "TLS nerede sonlanır?" sorusuna hazır olun: **edge'de** (kullanıcıya yakın el sıkışma) ve gerekiyorsa origin'e yeniden şifreli bağlantı.
- Çapraz AZ trafiğinin hem gecikme hem **ücret** maliyeti olduğunu söyleyin; "aynı AZ'yi tercih et, ama AZ düşerse diğerine geçebil" dengesini anlatın.
:::

:::quiz{src="quiz.json"}
:::

:::next{lesson="f-06-where-data-lives"}
İsteğin yolunu makinelere kadar izledik. Sırada istek sonucunda üretilen verinin yolculuğu: hangi veri nerede tutulur — ilişkisel DB, NoSQL, S3, cache, data warehouse, log ve metrik depoları.
:::

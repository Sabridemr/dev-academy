---
id: f-01-servers-datacenters-regions
slug: servers-datacenters-regions
module: f-code-and-infrastructure
order: 1
title:
  tr: "Sunucu Türleri ve Veri Merkezi → Region → Availability Zone"
  en: "Server Types and Data Center → Region → Availability Zone"
summary:
  tr: Bare metal, VM, container, serverless; fiziksel yerleşim.
  en: Bare metal, VMs, containers, serverless; physical placement.
durationMinutes: 25
level: beginner
tags: [infrastructure, cloud, availability, data-center, compute]
prerequisites: [a-03-horizontal-vertical-scaling, a-05-load-balancing]
concepts: [bare-metal, virtual-machine, container, serverless, data-center, region, availability-zone, multi-az-failover, blast-radius]
---

## Kavram: kodunuz sonunda bir yerde, bir makinede çalışır

Bu modül boyunca Amazon benzeri büyük bir e-ticaret şirketindeki bir kod satırının hayatını izleyeceğiz: bir geliştiricinin dizüstü bilgisayarında yazılır, Git'e gider, derlenir, bir imaja paketlenir, test edilir ve sonunda **gerçek bir makinede, gerçek bir binada, dünyanın belirli bir noktasında** çalışır. Bulut ne kadar soyut görünse de altta hâlâ elektrik, soğutma, fiber kablo ve metal kasalar vardır. Sistem tasarımcısı bu fiziksel katmanı bilmek zorundadır, çünkü gecikme (latency), erişilebilirlik (availability) ve maliyet kararlarının çoğu buradan gelir.

Bu derste iki soruya cevap vereceğiz:

1. Kod **ne tür bir sunucuda** çalışır? (bare metal, sanal makine, container, serverless)
2. O sunucu **fiziksel olarak nerede** durur? (veri merkezi → availability zone → region)

## Sunucu türleri: soyutlama katmanları

Her soyutlama katmanı size bir şeyi kolaylaştırır ve bir şeyi elinizden alır. Dört ana model şöyle karşılaştırılır:

| | **Bare metal** | **Sanal makine (VM)** | **Container** | **Serverless (FaaS)** |
|---|---|---|---|---|
| Ne paylaşılır? | Hiçbir şey — makine sizindir | Fiziksel donanım (hypervisor üzerinden) | İşletim sistemi çekirdeği (kernel) | Her şey; siz sadece fonksiyon verirsiniz |
| Başlatma süresi | Saatler / günler | Dakikalar | Saniyeler | Milisaniyeler (cold start: 100 ms – birkaç sn) |
| İzolasyon | En güçlü (fiziksel) | Güçlü (hypervisor) | Orta (namespace + cgroup) | Sağlayıcıya bağlı (genelde microVM) |
| Yoğunluk (makine başına iş) | Düşük | Orta | Yüksek | Çok yüksek |
| Siz neyi yönetirsiniz? | Donanım, OS, runtime, uygulama | OS, runtime, uygulama | Runtime, uygulama | Sadece uygulama kodu |
| Ölçekleme birimi | Makine | VM | Pod / container | İstek / çağrı |
| Maliyet modeli | Sabit (CAPEX veya kiralama) | Saatlik / saniyelik | Saniyelik (orkestratör üzerinden) | Çağrı sayısı × süre × bellek |
| Tipik kullanım | Veritabanı, düşük gecikmeli ticaret, GPU kümeleri | Klasik uygulamalar, lift-and-shift | Mikroservisler, API'ler, batch işler | Event handler'lar, cron, glue kodu |
| AWS karşılığı | EC2 Bare Metal, Outposts | EC2 | ECS / EKS (üzerinde EC2 veya Fargate) | Lambda |

Kritik nokta şudur: **container bir VM değildir.** Container'lar aynı çekirdeği paylaşır; bu yüzden saniyeler içinde açılır ve bir makineye onlarcası sığar, ama çekirdek seviyesindeki bir güvenlik açığı tüm container'ları etkiler. Bu nedenle bulut sağlayıcıları farklı müşterilerin container'larını aynı VM'e koymaz; önce VM ile izole eder, sonra o VM'in içine container'ları dizer. Amazon'da bir Kubernetes pod'u tipik olarak bir **EC2 VM**'in içinde çalışır; o VM de bir **fiziksel sunucunun** (host) üzerindeki hypervisor tarafından yönetilir.

:::callout{tone="info" title="Katmanları üst üste koyun"}
Gerçek bir production ortamında bu modeller birbirini dışlamaz, iç içe geçer: **fiziksel host → hypervisor → VM (EC2) → container runtime → pod → sizin süreciniz.** Bir hata ayıklarken "kod hangi katmanda çalışıyor?" sorusunu sormak, CPU kısıtlaması (cgroup limit) ile gürültülü komşu (noisy neighbour) problemini ayırt etmenizi sağlar.
:::

## Fiziksel yerleşim: veri merkezi → AZ → region

Bulut sağlayıcılarının coğrafyayı modelleme biçimi üç katmanlıdır:

- **Veri merkezi (data center)**: Binlerce sunucu barındıran tek bir bina. Kendi jeneratörü, UPS'i, soğutması ve ağ çıkışı vardır. Bir binadaki tipik arıza nedenleri: elektrik kesintisi, soğutma arızası, yangın, bir ekskavatörün fiberi kesmesi.
- **Availability Zone (AZ)**: Birbirine **düşük gecikmeli (genellikle < 2 ms), yüksek bantlı özel fiber** ile bağlı bir ya da birkaç veri merkezi grubu. Aynı region içindeki AZ'ler birbirinden **kilometrelerce** uzaktadır; ayrı elektrik şebekesi, ayrı su baskını alanı, ayrı fiber girişi kullanır. Amaç: bir AZ'yi vuran felaketin diğerini vurmaması.
- **Region**: Aynı coğrafi bölgedeki (ör. Frankfurt, Kuzey Virginia, İrlanda) AZ'lerin tamamı. Region'lar arası mesafe yüzlerce-binlerce kilometredir; aradaki gecikme 20–200 ms'dir ve veriler region dışına **yalnızca siz isterseniz** çıkar (veri egemenliği / GDPR için kritik).

:::diagram{src="diagram.svg" alt="Region içinde üç availability zone, her birinde ayrı veri merkezleri; AZ'ler özel fiberle bağlı, region'lar arası mesafe ve gecikme karşılaştırması|A region containing three availability zones, each with its own data centers; AZs connected by private fiber, with distance and latency comparison between regions"}
Bir region, birbirinden fiziksel olarak izole ama düşük gecikmeyle bağlı AZ'lerden oluşur. Her AZ bir ya da birden fazla veri merkezi barındırır.
:::

### Patlama yarıçapı (blast radius)

Fiziksel yerleşim bir **hata izolasyonu** aracıdır. Her katmanı bir "patlama yarıçapı" olarak düşünün:

| Hata | Etkilenen | Nasıl korunursunuz? |
|---|---|---|
| Bir sunucu (host) ölür | Üzerindeki VM'ler / pod'lar | Replikalar farklı host'lara dağıtılır (anti-affinity) |
| Bir rack'in anahtarı (ToR switch) ölür | O rack'teki ~40 sunucu | Replikalar farklı rack'lere yayılır (placement group) |
| Bir AZ düşer | O AZ'deki her şey | **Multi-AZ**: her servisin en az iki AZ'de replikası, DB'nin senkron standby'ı |
| Bir region düşer | Tüm AZ'ler | **Multi-region**: DNS failover, asenkron replikasyon, aktif-aktif mimari |

Multi-AZ, modern sistem tasarımında **varsayılan** seviyedir: ucuzdur (AZ'ler arası trafik birkaç ms ve küçük bir ücret), uygulama kodunda değişiklik gerektirmez ve yılda birkaç kez yaşanan AZ kesintilerinden sizi korur. Multi-region ise pahalıdır: veriyi iki yerde tutarlı tutmak CAP teoreminin tam ortasına düşer. Çoğu şirket yalnızca ödeme, kimlik gibi kritik servisleri multi-region yapar.

## Sahne: bir AZ karardığında ne olur?

Aşağıdaki animasyonda Frankfurt region'ında (eu-central-1) iki AZ'ye yayılmış bir sipariş servisi var. AZ-a'da elektrik kesintisi yaşanır; yük dengeleyicinin health check'leri bunu fark eder, trafik AZ-b'ye kayar ve otomatik ölçekleme AZ-b'de yeni kapasite açar. Kullanıcı birkaç saniyelik hata dışında hiçbir şey fark etmez.

:::animation{scene="scene.json"}
Multi-AZ dağıtımda bir availability zone kesintisi: health check, trafik kayması ve AZ-b'de otomatik ölçekleme.
:::

Dikkat edilecek üç ayrıntı:

1. **Sığa payı (headroom)**: AZ-b tek başına tüm trafiği kaldıracak kadar büyümelidir. İki AZ'li bir sistemde her AZ normalde %50 yük taşır; biri düşünce diğeri %100'e çıkar. Bu yüzden ya her AZ'yi %50'nin altında tutarsınız ya da üç AZ kullanırsınız (biri düşünce kalan ikisi %75 yük alır).
2. **Veritabanı**: Uygulama sunucuları stateless olduğu için kolayca kayar; asıl zor olan veritabanıdır. Multi-AZ RDS'te primary ile standby arasında **senkron** replikasyon vardır; failover 30–60 saniye sürer ve bu sırada yazmalar başarısız olur. Uygulama katmanı **retry** yapmalıdır.
3. **Dalgalanma**: AZ-a kısmen geri geldiğinde health check'ler "sağlıklı – sağlıksız" arasında gidip gelebilir. İyi bir sistem, bir AZ'yi havuza geri almadan önce birkaç ardışık başarılı kontrol bekler.

:::interactive{type="scaling" mode="horizontal" zones=2 instancesPerZone=3 failureZone="a"}
Önce zone başına örnek (instance) sayısını ve bir zone'un normalde taşıdığı yük yüzdesini ayarlayın. Sonra "AZ-a'yı düşür" düğmesine basın ve kalan AZ'nin yükünün nasıl %100'e çıktığını, otomatik ölçeklemenin yeni örnekleri ne kadar sürede açtığını izleyin. Üç AZ'ye çıkıp headroom ihtiyacının nasıl azaldığını karşılaştırın.
:::

## Hangi yükü nereye koyarsınız? Karar kılavuzu

- **Gecikmeye aşırı duyarlı ve donanıma yakın işler** (yüksek frekanslı eşleştirme motoru, lisansı çekirdek sayısına bağlı eski veritabanı, GPU eğitim kümesi): **bare metal**.
- **Uzun ömürlü, durum tutan servisler** (kendi yönettiğiniz PostgreSQL, Kafka broker'ları): **VM**; container üzerinde çalıştırılabilir ama disk ve ağ kimliği yönetimi zorlaşır.
- **Stateless API'ler, mikroservisler, arka plan işçileri**: **container** (Kubernetes/ECS). Hızlı ölçeklenir, imaj olarak taşınabilir.
- **Seyrek, patlamalı, olay güdümlü işler** (yüklenen görseli küçült, saatlik rapor üret, webhook'u işle): **serverless**. Boşta sıfır maliyet, ama soğuk başlangıç ve 15 dakikalık çalışma süresi sınırı vardır.

:::code{lang="ts" title="Çalışma ortamını ve fiziksel konumu koddan okumak (EC2 IMDS v2)"}
```ts
// AWS'te çalışan bir süreç, bulunduğu VM'in metadata servisinden
// region, AZ ve instance türünü öğrenebilir. Loglara bu bilgiyi eklemek,
// "hata hangi AZ'de yoğunlaşıyor?" sorusunu saniyeler içinde cevaplatır.
const IMDS = 'http://169.254.169.254/latest';

async function imdsToken(): Promise<string> {
  // IMDSv2: önce kısa ömürlü bir token alınır (SSRF saldırılarına karşı koruma)
  const res = await fetch(`${IMDS}/api/token`, {
    method: 'PUT',
    headers: { 'X-aws-ec2-metadata-token-ttl-seconds': '21600' },
  });
  return res.text();
}

export interface Placement {
  region: string;          // ör. eu-central-1
  availabilityZone: string; // ör. eu-central-1a
  instanceType: string;     // ör. m6g.large
  instanceId: string;
}

export async function readPlacement(): Promise<Placement> {
  const token = await imdsToken();
  const get = async (path: string) =>
    (await fetch(`${IMDS}/meta-data/${path}`, { headers: { 'X-aws-ec2-metadata-token': token } })).text();

  const availabilityZone = await get('placement/availability-zone');
  return {
    availabilityZone,
    region: availabilityZone.slice(0, -1),      // son harf AZ'yi gösterir: "eu-central-1a" → "eu-central-1"
    instanceType: await get('instance-type'),
    instanceId: await get('instance-id'),
  };
}

// Kullanım: uygulama açılışında bir kez oku, her log satırına ekle
// const placement = await readPlacement();
// logger.info({ ...placement, msg: 'service started' });
```
```python
import requests

IMDS = "http://169.254.169.254/latest"

def imds_token() -> str:
    # IMDSv2 token'ı: kısa ömürlü, PUT ile alınır
    r = requests.put(f"{IMDS}/api/token", headers={"X-aws-ec2-metadata-token-ttl-seconds": "21600"}, timeout=1)
    return r.text

def read_placement() -> dict:
    token = imds_token()
    get = lambda path: requests.get(f"{IMDS}/meta-data/{path}", headers={"X-aws-ec2-metadata-token": token}, timeout=1).text
    az = get("placement/availability-zone")
    return {
        "availability_zone": az,
        "region": az[:-1],                 # "eu-central-1a" → "eu-central-1"
        "instance_type": get("instance-type"),
        "instance_id": get("instance-id"),
    }
```
:::

:::realworld{company="Amazon"}
AWS'nin kendi mimari ilkesi **"AZ'ler bağımsız hata alanlarıdır"** üzerine kuruludur. Bir AWS region'ında en az üç AZ bulunur; AZ'ler birbirinden tipik olarak onlarca kilometre uzaktadır, ayrı elektrik şebekelerinden beslenir ve aralarındaki özel fiber üzerinde gidiş-dönüş gecikmesi 1–2 ms civarındadır. Amazon.com'un sipariş servisleri gibi kritik iş yükleri **her AZ'de eşit kapasiteyle** çalışır ve AWS'nin kendi deploy sistemi, bir değişikliği aynı anda yalnızca tek bir AZ'ye uygular ("one-box → one-AZ → region" dalgaları). Böylece kötü bir deploy bile yalnızca bir AZ'nin patlama yarıçapıyla sınırlı kalır. 2021'deki us-east-1 kesintisinde dahi sorun tek region'la sınırlı kaldı; multi-region tasarlanmış servisler (Route 53 health check ile başka region'a failover yapanlar) etkilenmedi. AWS bunu "static stability" olarak adlandırır: bir AZ düştüğünde sistem **yeni kaynak açmak zorunda kalmadan** ayakta kalacak kadar fazladan kapasiteyle çalışır.
:::

:::callout{tone="tip" title="Mülakat ipuçları"}
- "Yüksek erişilebilirlik" dediğinizde hemen **"hangi hata alanına karşı?"** diye netleştirin: host, rack, AZ, region. Her biri farklı maliyet ve farklı mimari ister.
- Multi-AZ'yi varsayılan kabul edin; multi-region'ı yalnızca **RTO/RPO hedefleri** ya da veri egemenliği zorunlu kılıyorsa önerin ve maliyetini (çift kapasite, çapraz region replikasyon, tutarlılık) açıkça söyleyin.
- Container ile VM farkını tek cümleyle anlatabilin: *"Container çekirdeği paylaşır, VM donanımı paylaşır."*
- Serverless'ı önerirken **soğuk başlangıç** ve **çalışma süresi sınırı** gibi dezavantajları da söyleyin; mülakatçı bunu test eder.
:::

:::quiz{src="quiz.json"}
:::

:::next{lesson="f-02-code-journey-ci-cd"}
Artık kodun çalışacağı makineleri ve onların dünyadaki yerini biliyoruz. Sırada kodun oraya nasıl gittiği var: Git → CI → artifact → CD → canary → production.
:::

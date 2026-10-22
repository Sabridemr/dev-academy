---
id: b-04-multi-region-dr
slug: multi-region-dr
module: b-architectures
order: 4
title:
  tr: "Multi-Region, Aktif-Aktif/Aktif-Pasif, Disaster Recovery"
  en: "Multi-Region, Active-Active/Active-Passive, Disaster Recovery"
summary:
  tr: RPO/RTO, failover animasyonu, veri yerleşimi.
  en: RPO/RTO, failover animation, data residency.
durationMinutes: 30
level: advanced
tags: [multi-region, disaster-recovery, high-availability, failover, replication, data-residency]
prerequisites: [a-12-replication, a-01-client-server-dns-http, b-01-monolith-to-microservices]
concepts: [region-vs-az, rpo, rto, active-passive, active-active, dns-failover, health-check, replication-lag, split-brain, conflict-resolution, data-residency, dr-tiers, chaos-testing]
---

## Kavram: bir bölge çökerse ne olur?

Bulut sağlayıcıları dünyayı **region**'lara (Frankfurt, Virginia, Tokyo...) böler; her region birbirinden kilometrelerce uzak, bağımsız enerji ve ağa sahip birkaç **availability zone (AZ)** içerir. Çoklu AZ dağıtımı bir veri merkezi yangınına karşı korur ve çoğu bulut servisi bunu neredeyse bedavaya verir. Ama bir **region'ın tamamı** da düşer: 2021 AWS us-east-1 kesintisi, 2017 S3 kesintisi, 2024 CrowdStrike olayı gibi örnekler, "bölgesel hizmet" kontrol düzlemlerinin tek noktadan çökebildiğini gösterdi.

**Multi-region** tasarım iki ayrı soruyu cevaplar:

1. **Disaster recovery (DR)**: Birincil region kaybolursa ne kadar sürede, ne kadar veri kaybıyla ayağa kalkarız?
2. **Gecikme ve yerleşim**: Tokyo'daki kullanıcı Frankfurt'a gidip gelmek zorunda mı? Avrupa verisi Avrupa'da kalmak zorunda mı (GDPR, yerel mevzuat)?

## RPO ve RTO: iki sayı, tüm bütçe

| Metrik | Soru | Örnek |
|---|---|---|
| **RPO** (Recovery Point Objective) | En fazla **ne kadar veri** kaybetmeyi göze alıyoruz? | RPO = 5 dk → son 5 dakikanın yazmaları kaybolabilir |
| **RTO** (Recovery Time Objective) | Kesintiden sonra **ne kadar sürede** hizmet geri döner? | RTO = 30 dk → yarım saat kesinti kabul |

RPO'yu **replikasyon** belirler: asenkron replikasyonda RPO ≈ replication lag; senkron replikasyonda RPO = 0 ama her yazma iki region arası gidiş-dönüş bekler (Frankfurt–Virginia ~90 ms). RTO'yu ise **failover otomasyonu** belirler: tespit süresi + karar + DNS/trafik yönlendirme + yedek tarafın ısınması.

İkisi de sıfıra yaklaştıkça maliyet üstel artar. Bu yüzden DR stratejileri bir yelpaze oluşturur:

:::diagram{src="diagram.svg" alt="Dört DR katmanı: backup-restore, pilot light, warm standby, aktif-aktif; her biri için RPO, RTO ve maliyet; altta aktif-pasif ve aktif-aktif topolojilerinin karşılaştırması|Four DR tiers: backup-restore, pilot light, warm standby, active-active; RPO, RTO and cost for each; below, a comparison of active-passive and active-active topologies"}
Sağa gittikçe RPO ve RTO küçülür, maliyet ve karmaşıklık büyür. Çoğu sistem için doğru cevap "warm standby"dir; aktif-aktif yalnızca gerçekten gerekenlere.
:::

| Katman | Yedek region'da ne var? | RPO | RTO | Maliyet |
|---|---|---|---|---|
| **Backup & restore** | Yalnızca yedekler (S3) | Saatler | Saatler–günler | Çok düşük |
| **Pilot light** | Veri replikası sürekli, uygulama kapalı (AMI/image hazır) | Dakikalar | 10 dk–1 saat | Düşük |
| **Warm standby** | Küçültülmüş ama çalışan tam kopya | Saniyeler–dakikalar | Dakikalar | Orta |
| **Aktif-aktif (multi-site)** | Tam kapasite, trafik alıyor | ~0 | ~0 (otomatik) | Yüksek |

## Aktif-pasif: tek yazar, hazır yedek

Birincil region tüm yazmaları alır; ikincil region veriyi **asenkron** replike eder ve beklemede durur. Failover akışı:

1. Health check'ler birincilin düştüğünü **tespit** eder (3 ardışık başarısız kontrol, ~30–90 s).
2. **Karar**: Otomatik mi, insan onaylı mı? Yanlış alarmla failover yapmak da kesintidir.
3. İkincil veritabanı **promote** edilir (replika → birincil). Replication lag kadar veri kaybolur (RPO).
4. **DNS failover**: Route 53 / Cloud DNS, kaydın hedefini ikincil region'un yük dengeleyicisine çevirir. İstemciler DNS TTL'i dolunca yeni adresi görür; bu yüzden TTL 60 s gibi kısa tutulur.
5. Uygulama katmanı ısınır (cache boş, bağlantı havuzları yeni) — ikincil trafik dalgasıyla kısa süre yavaştır.

:::animation{scene="scene.json"}
Aktif-pasif failover: eu-west-1 çöker, health check'ler fark eder, replika promote edilir, DNS kaydı us-east-1'e çevrilir ve trafik oraya akar; failback ayrı bir karardır.
:::

:::callout{tone="danger" title="Failback failover'dan zordur"}
Birincil geri geldiğinde iki region'da da yazma olmuş olabilir (eski birincil çökmeden hemen önce commit ettiği ama replike edemediği yazmalar). Bunları birleştirmeden geri dönmek veri kaybettirir. Failback planlı, trafiksiz bir pencerede, ters yönde replikasyon tamamlandıktan sonra yapılır. Ayrıca eski birincilin "kendini hâlâ lider sanması" (**split-brain**) için koruma gerekir: fencing token, STONITH ya da yalnızca tek bir tarafın yazma yetkisi olduğundan emin olan bir koordinatör.
:::

## Aktif-aktif: her region yazıyor

Her region trafik alır ve yazar; veri çift yönlü replike edilir. Kullanıcı en yakın region'a gider (gecikme kazancı) ve bir region düşerse diğeri zaten çalışıyordur (RTO ≈ 0). Ancak **aynı kaydın iki region'da aynı anda değişmesi** çatışma (conflict) demektir. Üç strateji:

- **Veri bölümleme (partition by home region)**: Her kullanıcı/kiracı bir "ev" region'a atanır; yazmaları yalnızca orası alır. Çatışma yok, ama kullanıcı seyahat edince yazmalar uzak region'a gider. En yaygın ve en güvenli yol.
- **Çatışma çözümü (LWW, CRDT)**: Son yazan kazanır (last-writer-wins; saat kaymasıyla veri kaybedebilir) ya da matematiksel olarak birleştirilebilir veri tipleri (sayaçlar, kümeler). DynamoDB Global Tables LWW kullanır.
- **Global konsensüs**: Spanner, CockroachDB gibi sistemler her yazmada bölgeler arası Paxos/Raft çoğunluğu alır: tutarlılık güçlü, yazma gecikmesi bölgeler arası RTT kadar.

:::interactive{type="replication-quorum" nodes=5 regions=2 writeQuorum=3 readQuorum=3 latencyMs=90}
Beş replikanın üçü yerel, ikisi (R4, R5) 90 ms uzaklıktaki ikinci region'da. W ve R değerlerini değiştirin: W + R > N olduğunda okumalar her zaman son yazmayı görüyor mu? Yazma gecikmesine bakın: W=3'te onay bazen yalnızca yerel replikalardan (hızlı), bazen uzak bir replikadan (yavaş) gelir; W=4 ise mutlaka uzak region'ı bekler. Region'lar arası bağlantının kopmasını canlandırmak için R4 ve R5'e tıklayıp düşürün: çoğunluk tarafı (3 replika) W=3 ile devam eder; şimdi bunun yerine yerel üçten ikisini düşürün — azınlıkta kalan taraf yazma kabul edemez. Son olarak W=1 yapıp (asenkron replikasyona en yakın ayar) yazar yazmaz okuyun: bayat okumalar, RPO'nun sıfırdan büyüdüğünün göstergesidir.
:::

| | Aktif-pasif | Aktif-aktif |
|---|---|---|
| RTO | Dakikalar (DNS + promote) | Saniyeler / sıfır |
| RPO | Replication lag | Çatışma çözümüne bağlı; LWW'de veri kaybı mümkün |
| Yazma gecikmesi | Tek region, düşük | Bölümlemede düşük; konsensüste RTT kadar |
| Karmaşıklık | Orta (promote, DNS, failback) | Yüksek (çatışma, idempotency, çift yönlü replikasyon) |
| Maliyet | Yedek kapasite boşta | Kapasite her yerde kullanımda |
| Gecikme kazancı | Yok | Var (kullanıcı en yakına gider) |

:::code{lang="ts" title="Region health check + DNS failover kontrolcüsü (basitleştirilmiş)"}
```ts
type Region = 'eu-west-1' | 'us-east-1';
interface RegionState { healthy: boolean; consecutiveFailures: number }

const FAIL_THRESHOLD = 3;            // flapping'i önlemek için ardışık başarısızlık sayısı
const DNS_TTL_SECONDS = 60;          // kısa TTL → istemciler yeni kaydı hızlı görür

export class FailoverController {
  private state: Record<Region, RegionState> = {
    'eu-west-1': { healthy: true, consecutiveFailures: 0 },
    'us-east-1': { healthy: true, consecutiveFailures: 0 },
  };
  private primary: Region = 'eu-west-1';

  constructor(private readonly dns: DnsClient, private readonly db: DbAdmin, private readonly pager: Pager) {}

  /** Her 10 saniyede bir, birden fazla gözlem noktasından çağrılır (tek nokta yanılabilir). */
  async probe(region: Region, ok: boolean) {
    const s = this.state[region];
    s.consecutiveFailures = ok ? 0 : s.consecutiveFailures + 1;
    const wasHealthy = s.healthy;
    s.healthy = s.consecutiveFailures < FAIL_THRESHOLD;

    if (wasHealthy && !s.healthy && region === this.primary) {
      await this.failover();
    }
  }

  private async failover() {
    const target: Region = this.primary === 'eu-west-1' ? 'us-east-1' : 'eu-west-1';
    if (!this.state[target].healthy) {           // iki region da kötüyse failover değil, olay yönetimi
      return this.pager.page('both regions unhealthy — manual intervention');
    }
    const lagSeconds = await this.db.replicationLag(target);
    await this.pager.notify(`failover → ${target}, expected data loss ≈ ${lagSeconds}s (RPO)`);

    await this.db.fenceWrites(this.primary);     // split-brain koruması: eski birincil artık yazamaz
    await this.db.promote(target);               // replika → birincil
    await this.dns.upsert('api.example.com', { target: `lb.${target}.example.com`, ttl: DNS_TTL_SECONDS });
    this.primary = target;                       // failback otomatik DEĞİL: planlı pencerede, insan onayıyla
  }
}
```
```python
FAIL_THRESHOLD = 3
DNS_TTL_SECONDS = 60

class FailoverController:
    def __init__(self, dns, db, pager):
        self.dns, self.db, self.pager = dns, db, pager
        self.state = {"eu-west-1": [True, 0], "us-east-1": [True, 0]}   # [healthy, consecutive_failures]
        self.primary = "eu-west-1"

    def probe(self, region, ok):
        healthy, fails = self.state[region]
        fails = 0 if ok else fails + 1
        now_healthy = fails < FAIL_THRESHOLD
        self.state[region] = [now_healthy, fails]
        if healthy and not now_healthy and region == self.primary:
            self.failover()

    def failover(self):
        target = "us-east-1" if self.primary == "eu-west-1" else "eu-west-1"
        if not self.state[target][0]:
            return self.pager.page("both regions unhealthy — manual intervention")
        lag = self.db.replication_lag(target)
        self.pager.notify(f"failover → {target}, expected data loss ≈ {lag}s (RPO)")
        self.db.fence_writes(self.primary)        # split-brain koruması
        self.db.promote(target)
        self.dns.upsert("api.example.com", target=f"lb.{target}.example.com", ttl=DNS_TTL_SECONDS)
        self.primary = target                     # failback elle, planlı
```
```java
public final class FailoverController {
    private static final int FAIL_THRESHOLD = 3;
    private static final int DNS_TTL_SECONDS = 60;
    private final Map<String, int[]> failures = new HashMap<>(Map.of("eu-west-1", new int[]{0}, "us-east-1", new int[]{0}));
    private String primary = "eu-west-1";
    private final DnsClient dns; private final DbAdmin db; private final Pager pager;

    public FailoverController(DnsClient dns, DbAdmin db, Pager pager) { this.dns = dns; this.db = db; this.pager = pager; }

    public void probe(String region, boolean ok) {
        int[] f = failures.get(region);
        boolean wasHealthy = f[0] < FAIL_THRESHOLD;
        f[0] = ok ? 0 : f[0] + 1;
        boolean healthy = f[0] < FAIL_THRESHOLD;
        if (wasHealthy && !healthy && region.equals(primary)) failover();
    }

    private void failover() {
        String target = primary.equals("eu-west-1") ? "us-east-1" : "eu-west-1";
        if (failures.get(target)[0] >= FAIL_THRESHOLD) { pager.page("both regions unhealthy"); return; }
        pager.notify("failover → " + target + ", RPO ≈ " + db.replicationLag(target) + "s");
        db.fenceWrites(primary);                  // split-brain koruması
        db.promote(target);
        dns.upsert("api.example.com", "lb." + target + ".example.com", DNS_TTL_SECONDS);
        primary = target;                         // failback planlı, elle
    }
}
```
:::

## Veri yerleşimi (data residency) ve gecikme

Multi-region yalnızca felaket için değildir. **GDPR**, Türkiye KVKK, Çin, Rusya ve Hindistan gibi rejimler belirli verinin ülke/bölge dışına çıkmamasını isteyebilir. Bu, "ev region" bölümlemesini zorunlu kılar: AB kullanıcısının kişisel verisi yalnızca AB region'larında replike edilir; küresel servisler (arama, öneri) yalnızca anonimleştirilmiş veya toplu veriyle çalışır. Tasarımda kiracı/kullanıcı kimliğinden region'a eşleyen bir **yönlendirme katmanı** (genelde edge'de, kullanıcı id'sine göre) gerekir ve veri taşıma (kullanıcı ülke değiştirdi) ayrı bir iş akışıdır.

Gecikme tarafında kural: **okumaları yaklaştır, yazmaları toplayın**. Statik ve okuma ağırlıklı içerik CDN ve bölgesel okuma replikalarından; yazmalar ise ev region'a. Kullanıcı yazdıktan hemen sonra okuyacaksa (read-your-writes), kısa süre ev region'dan okutmak gerekir.

:::realworld{company="Netflix"}
Netflix, 2012 Noel arifesinde us-east-1'deki ELB kesintisiyle saatlerce yayın yapamayınca **aktif-aktif çoklu region** stratejisine geçti. Bugün üç AWS region'ı (us-east-1, us-west-2, eu-west-1) eşzamanlı trafik alır. Bir region sorun yaşadığında **Zuul** edge katmanı ve DNS, dakikalar içinde trafiği diğer ikisine kaydırır; buna "region evacuation" derler ve düzenli olarak **tatbikat** yaparlar — Chaos Monkey'in region düzeyindeki akrabası **Chaos Kong**, üretimde bir region'ı bilerek boşaltır. Veri tarafında Cassandra çok-bölgeli replikasyonla (her yazma yerel quorum, bölgeler arası asenkron) ve **EVCache** bölgeler arası cache replikasyonuyla çalışır; kullanıcı profili gibi çatışabilecek veriler için idempotent, LWW tabanlı birleştirme kullanılır. Kritik ders: failover'ı yalnızca felakette değil, her ay prova etmeyen ekiplerin planı kağıt üzerinde kalır.
:::

:::callout{tone="tip" title="Mülakat özeti"}
- Önce **RPO/RTO sorun**: "5 dakika veri kaybı ve 30 dakika kesinti kabul mü?" Cevap DR katmanını belirler.
- Aktif-pasif için beş adımı sayın: tespit → karar → promote → DNS → ısınma; DNS TTL'in neden kısa olduğunu açıklayın.
- Aktif-aktif deyince hemen **çatışma** konusunu açın: ev region bölümleme ilk tercih; LWW'nin riskini, konsensüsün gecikmesini söyleyin.
- Split-brain ve failback'i kendiliğinizden anın; "tatbikat yapılmayan DR planı yoktur" cümlesi iyi biter.
- Veri yerleşimi sorulursa kullanıcı → region yönlendirme katmanı ve anonimleştirilmiş küresel veri ayrımını anlatın.
:::

:::quiz{src="quiz.json"}
:::

:::next{lesson="b-05-modular-monolith"}
Sırada sistemin içine dönüyoruz: mikroservise geçmeden sınırları kodda çizen modüler monolit, modül API'leri ve sınır ihlalinin CI'da yakalanması.
:::

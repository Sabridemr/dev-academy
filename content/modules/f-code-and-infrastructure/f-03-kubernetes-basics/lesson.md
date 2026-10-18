---
id: f-03-kubernetes-basics
slug: kubernetes-basics
module: f-code-and-infrastructure
order: 3
title:
  tr: "Kubernetes Temelleri: Pod, Deployment, Service, Ingress, HPA"
  en: "Kubernetes Basics: Pod, Deployment, Service, Ingress, HPA"
summary:
  tr: Otomatik ölçekleme animasyonu.
  en: Autoscaling animation.
durationMinutes: 30
level: intermediate
tags: [kubernetes, containers, orchestration, autoscaling, devops]
prerequisites: [f-01-servers-datacenters-regions, f-02-code-journey-ci-cd]
concepts: [pod, deployment, replicaset, service, ingress, horizontal-pod-autoscaler, readiness-probe, liveness-probe, resource-requests-limits, declarative-reconciliation]
---

## Kavram: "istenen durum"u söyleyin, gerisini bırakın

Önceki derste pipeline'ın son adımı `kubectl set image deploy/cart-service app=cart-service:a1b2c3d` idi. Bu komut hiçbir sunucuya bağlanmaz, hiçbir süreci yeniden başlatmaz. Yalnızca Kubernetes'e şunu söyler: *"Benim istediğim durum (desired state) şu: cart-service'in 20 kopyası, hepsi a1b2c3d imajında çalışsın."* Gerisini Kubernetes'in **kontrol döngüleri (controllers)** halleder: mevcut durumu gözler, istenen durumla karşılaştırır, farkı kapatacak eylemleri yapar — ve bunu sonsuza dek, her birkaç saniyede bir tekrarlar. Buna **reconciliation (uzlaştırma)** denir ve Kubernetes'in tüm sihri bundan ibarettir.

Bu derste Amazon benzeri bir şirkette bir Kubernetes kümesinin (ör. EKS) içindeki beş temel nesneyi ve otomatik ölçeklemeyi öğreneceğiz.

## Küme anatomisi: control plane ve worker node'lar

| Bileşen | Nerede çalışır? | Görevi |
|---|---|---|
| **API server** | Control plane (EKS'te AWS yönetir, siz görmezsiniz) | Tüm istekler buraya gelir (`kubectl`, controller'lar, CI). Tek doğruluk kaynağı **etcd**'ye yazar. |
| **Scheduler** | Control plane | Yeni bir pod'u hangi node'a koyacağına karar verir (CPU/bellek isteği, affinity, AZ dağılımı). |
| **Controller manager** | Control plane | Deployment, ReplicaSet, Node vb. controller'ları çalıştırır. |
| **kubelet** | Her worker node'da | API server'dan aldığı pod tanımını container runtime (containerd) ile gerçek süreçlere çevirir; probe'ları çalıştırır. |
| **kube-proxy / CNI** | Her worker node'da | Service IP'lerini gerçek pod IP'lerine çeviren ağ kurallarını (iptables/IPVS/eBPF) yazar. |

Worker node'lar, f-01'de gördüğümüz **EC2 VM'leridir**; birkaç AZ'ye yayılmış bir node grubu (node group) olarak çalışırlar. Pod'lar bu VM'lerin içinde, bir container runtime'ın yönettiği Linux süreçleridir.

:::diagram{src="diagram.svg" alt="Kubernetes kümesi: Ingress, Service, Deployment, ReplicaSet ve iki node'a yayılmış pod'lar; HPA'nın metrics-server'dan CPU okuyup Deployment'ın replika sayısını değiştirdiği döngü|Kubernetes cluster: Ingress, Service, Deployment, ReplicaSet and pods spread across two nodes; the loop where the HPA reads CPU from metrics-server and changes the Deployment's replica count"}
Trafik Ingress → Service → Pod yolunu izler. Deployment, ReplicaSet üzerinden pod sayısını yönetir; HPA ise Deployment'ın replika sayısını metriklere göre ayarlar.
:::

## Beş temel nesne

### 1. Pod: en küçük birim

Pod, bir ya da birkaç container'ın **aynı ağ ad alanını ve depolamayı paylaştığı** en küçük dağıtım birimidir. Her pod'un kendi IP'si vardır; içindeki container'lar `localhost` üzerinden konuşur. Pod'lar **ölümlüdür**: node ölürse, bellek limitini aşarsa, yeni sürüm gelirse pod silinir ve **yeni bir IP ile** yenisi yaratılır. Bu yüzden hiçbir zaman doğrudan bir pod IP'sine bağlanmazsınız.

Çok container'lı pod kalıbı **sidecar**'dır: ana uygulamanın yanına log toplayıcı (Fluent Bit) ya da servis mesh proxy'si (Envoy) eklenir; f-07'de mTLS için bunu kullanacağız.

### 2. ReplicaSet: "N tane olsun"

ReplicaSet tek bir şey yapar: belirli bir pod şablonundan **tam olarak N kopya** çalışır tutar. Bir pod ölürse yenisini açar; fazla varsa siler. Doğrudan ReplicaSet yazmazsınız; Deployment sizin yerinize yönetir.

### 3. Deployment: sürüm yönetimi

Deployment, ReplicaSet'lerin üzerinde bir katmandır ve **güncellemeleri** yönetir. İmajı değiştirdiğinizde Deployment yeni bir ReplicaSet yaratır ve **rolling update** ile eski ReplicaSet'i küçültürken yenisini büyütür:

- `maxSurge: 25%` → istenen sayının en fazla %25 üzerine çıkılabilir (ek kapasite).
- `maxUnavailable: 0` → hiçbir anda istenen sayının altına düşülmez (sıfır kesinti).

Her Deployment eski ReplicaSet'leri (`revisionHistoryLimit`) saklar; `kubectl rollout undo` bir önceki ReplicaSet'i yeniden büyütmekten ibarettir — f-02'deki "rollback = önceki SHA" fikrinin Kubernetes karşılığı.

### 4. Service: sabit bir adres

Pod'lar gelip gittiğine göre onlara nasıl ulaşılır? **Service**, bir etiket seçicisiyle (`app: cart-service`) eşleşen pod'ların önünde duran **sabit bir sanal IP ve DNS adıdır**: `cart-service.shop.svc.cluster.local`. Readiness probe'u geçen pod'lar otomatik olarak Service'in **endpoint** listesine girer; başarısız olanlar çıkar. Kümenin içindeki yük dengeleyicidir.

| Tür | Erişim | Kullanım |
|---|---|---|
| `ClusterIP` | Yalnızca küme içinden | Servisler arası iletişim (varsayılan) |
| `NodePort` | Her node'un belirli bir portu | Nadiren, test |
| `LoadBalancer` | Bulut LB oluşturur (AWS NLB) | Küme dışına L4 erişim |

### 5. Ingress: dışarıdan içeri, L7

Her servise ayrı bir bulut LB açmak pahalıdır. **Ingress**, tek bir giriş noktasından (Ingress controller: NGINX, AWS ALB Controller, Envoy) host ve path'e göre L7 yönlendirme yapar: `shop.example.com/cart → cart-service:80`, `/orders → orders-service:80`. TLS sonlandırma genellikle burada olur. a-05'teki L7 yük dengeleyici, Kubernetes dünyasında Ingress'tir.

:::callout{tone="info" title="Probe'lar: Kubernetes'in sağlık kontrolü"}
- **Liveness probe**: "Süreç kilitlendi mi?" Başarısız olursa kubelet container'ı **yeniden başlatır**.
- **Readiness probe**: "Trafik almaya hazır mı?" Başarısız olursa pod Service endpoint'lerinden **çıkarılır** ama yeniden başlatılmaz (ör. ısınma, bağımlılık geçici olarak yok).
- **Startup probe**: Yavaş açılan uygulamalar için liveness'ı geciktirir.

a-05'teki uyarı burada da geçerlidir: liveness probe'u veritabanına bağlamayın; DB yavaşlayınca tüm pod'lar aynı anda yeniden başlar ve küçük bir sorun fırtınaya döner.
:::

## Kaynak istekleri ve limitler

Her container için iki değer belirlenir:

- **requests**: Scheduler'ın garanti ettiği miktar (`cpu: 250m` = çeyrek çekirdek, `memory: 256Mi`). Node seçimi buna göre yapılır.
- **limits**: Aşılamayacak tavan. CPU limiti aşılınca süreç **yavaşlatılır (throttling)**; bellek limiti aşılınca pod **OOMKilled** olur.

HPA'nın CPU yüzdesi **request'e göre** hesaplanır: `cpu: 250m` isteyen bir pod 200m kullanıyorsa kullanım %80'dir. Request'i yanlış ayarlarsanız HPA ya hiç ölçeklenmez ya da gereksiz ölçeklenir.

## HPA: yük artınca pod sayısını artırmak

**Horizontal Pod Autoscaler**, bir Deployment'ın replika sayısını metriklere göre ayarlayan bir controller'dır. Her 15 saniyede bir metrics-server'dan pod'ların CPU (veya bellek, ya da özel bir metrik: kuyruk uzunluğu, istek/sn) değerini okur ve şu formülü uygular:

```
desiredReplicas = ceil( currentReplicas × (currentMetric / targetMetric) )
```

Örnek: 2 pod, ortalama CPU %85, hedef %50 → `ceil(2 × 85/50) = ceil(3.4) = 4` pod.

Aşağıdaki animasyon tam bu senaryoyu gösterir: trafik artar, CPU yükselir, HPA 4 pod ister, ReplicaSet iki yeni pod yaratır, readiness geçince Service onları endpoint listesine ekler ve Ingress trafiği dört pod'a dağıtır.

:::animation{scene="scene.json"}
HPA döngüsü: metrics-server CPU'yu ölçer, HPA istenen replika sayısını hesaplar, ReplicaSet yeni pod'ları yaratır, Service endpoint'leri güncellenir ve Ingress yeni pod'lara trafik vermeye başlar.
:::

İki ayrıntı önemlidir:

1. **Scale-up hızlı, scale-down yavaş**: Yük düşünce HPA varsayılan olarak **5 dakikalık stabilizasyon penceresi** bekler; aksi hâlde trafik dalgalandıkça pod'lar sürekli açılıp kapanır (flapping) ve her açılışta soğuk başlangıç maliyeti ödenir.
2. **HPA pod ekler, node eklemez**: Node'larda yer kalmazsa yeni pod'lar `Pending` durumunda bekler. Bu noktada **Cluster Autoscaler** ya da **Karpenter** devreye girip yeni EC2 node'ları açar — bu dakikalar sürer. Bu yüzden HPA hedefini %50–60 gibi tutup node tarafında biraz boş kapasite bırakmak yaygındır.

:::interactive{type="kubernetes-hpa" minReplicas=2 maxReplicas=10 targetCpuPercent=50 cpuRequestMillicores=250 stabilizationWindowSec=300}
"Başlat"a basıp CPU talebi kaydırıcısını yükseltin ve ortalama CPU'nun hedefin üzerine çıkmasını izleyin: HPA formülünün hesapladığı istenen replika sayısını ve yeni pod'ların "başlıyor" durumundan geçip trafik almasını görün. Sonra talebi düşürün; stabilizasyon penceresi dolmadan pod sayısının azalmadığını fark edin. Hedef CPU'yu %80'e çıkarıp yük desenini "Ani artış" yapın: daha az pod ile daha yüksek kullanımda çalışmanın ani artışta ne kadar gecikmeye yol açtığını karşılaştırın.
:::

## Örnek manifest'ler

:::code{lang="yaml" title="deployment.yaml + service.yaml + hpa.yaml (cart-service)"}
```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: cart-service
  namespace: shop
spec:
  replicas: 2                      # HPA bunu geçersiz kılacak; başlangıç değeri
  selector:
    matchLabels: { app: cart-service }
  strategy:
    type: RollingUpdate
    rollingUpdate: { maxSurge: 25%, maxUnavailable: 0 }   # sıfır kesinti
  template:
    metadata:
      labels: { app: cart-service }
    spec:
      topologySpreadConstraints:          # pod'ları AZ'lere eşit dağıt (f-01)
        - maxSkew: 1
          topologyKey: topology.kubernetes.io/zone
          whenUnsatisfiable: ScheduleAnyway
          labelSelector: { matchLabels: { app: cart-service } }
      containers:
        - name: app
          image: 123456789012.dkr.ecr.eu-central-1.amazonaws.com/cart-service:a1b2c3d
          ports: [{ containerPort: 8080 }]
          resources:
            requests: { cpu: 250m, memory: 256Mi }   # HPA yüzdesi bu request'e göre
            limits:   { cpu: "1",  memory: 512Mi }
          readinessProbe:                 # geçmeden Service'e girmez
            httpGet: { path: /ready, port: 8080 }
            periodSeconds: 5
          livenessProbe:                  # sığ: yalnızca süreç ayakta mı
            httpGet: { path: /healthz, port: 8080 }
            periodSeconds: 10
            failureThreshold: 3
          env:
            - name: REDIS_URL
              valueFrom: { secretKeyRef: { name: cart-secrets, key: redisUrl } }
---
apiVersion: v1
kind: Service
metadata: { name: cart-service, namespace: shop }
spec:
  type: ClusterIP
  selector: { app: cart-service }
  ports: [{ port: 80, targetPort: 8080 }]
---
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata: { name: cart-service, namespace: shop }
spec:
  scaleTargetRef: { apiVersion: apps/v1, kind: Deployment, name: cart-service }
  minReplicas: 2                   # multi-AZ için en az 2
  maxReplicas: 20
  metrics:
    - type: Resource
      resource:
        name: cpu
        target: { type: Utilization, averageUtilization: 50 }
  behavior:
    scaleUp:
      stabilizationWindowSeconds: 0          # hemen büyü
      policies: [{ type: Percent, value: 100, periodSeconds: 60 }]   # dakikada en fazla 2×
    scaleDown:
      stabilizationWindowSeconds: 300        # 5 dk bekle, sonra küçül
      policies: [{ type: Pods, value: 2, periodSeconds: 60 }]
```
:::

:::code{lang="ts" title="HPA'nın ölçekleme kararı (controller mantığının özü)"}
```ts
interface PodSample { cpuMillicores: number; ready: boolean }

interface HpaSpec {
  minReplicas: number;
  maxReplicas: number;
  targetUtilization: number;  // ör. 50 (%)
  cpuRequestMillicores: number;
  tolerance?: number;         // varsayılan 0.1: ±%10 içindeyse dokunma
}

/** Kubernetes HPA'nın her 15 sn'de bir çalıştırdığı hesabın sadeleştirilmiş hâli */
export function desiredReplicas(current: number, pods: PodSample[], spec: HpaSpec): number {
  // Yalnızca hazır (ready) pod'ların ölçümü kullanılır; ısınan pod ortalamayı bozmasın
  const ready = pods.filter((p) => p.ready);
  if (ready.length === 0) return current;

  const avgMillicores = ready.reduce((s, p) => s + p.cpuMillicores, 0) / ready.length;
  const utilization = (avgMillicores / spec.cpuRequestMillicores) * 100;   // request'e göre yüzde
  const ratio = utilization / spec.targetUtilization;

  // Hedefe yeterince yakınsa hiçbir şey yapma (flapping'i önler)
  if (Math.abs(ratio - 1) <= (spec.tolerance ?? 0.1)) return current;

  const raw = Math.ceil(current * ratio);                                   // desired = ceil(cur × cur/target)
  return Math.min(spec.maxReplicas, Math.max(spec.minReplicas, raw));       // sınırlar içinde tut
}

// Örnek: 2 pod, ortalama 212m / 250m = %85, hedef %50 → ceil(2 × 1.7) = 4
// desiredReplicas(2, [{ cpuMillicores: 210, ready: true }, { cpuMillicores: 215, ready: true }],
//   { minReplicas: 2, maxReplicas: 20, targetUtilization: 50, cpuRequestMillicores: 250 }) === 4
```
```python
import math

def desired_replicas(current: int, pods: list[dict], spec: dict) -> int:
    ready = [p for p in pods if p["ready"]]
    if not ready:
        return current
    avg = sum(p["cpu_millicores"] for p in ready) / len(ready)
    utilization = avg / spec["cpu_request_millicores"] * 100     # request'e göre yüzde
    ratio = utilization / spec["target_utilization"]
    if abs(ratio - 1) <= spec.get("tolerance", 0.1):             # ±%10 tolerans
        return current
    raw = math.ceil(current * ratio)
    return min(spec["max_replicas"], max(spec["min_replicas"], raw))
```
:::

:::realworld{company="Amazon"}
Amazon Prime Video, Amazon Ads ve birçok dahili ekip **Amazon EKS** üzerinde çalışır; EKS'te control plane (API server, etcd) AWS tarafından üç AZ'ye yayılmış hâlde yönetilir, siz yalnızca worker node'ları ve pod'ları görürsünüz. Node tarafında ölçekleme için AWS'nin açık kaynak projesi **Karpenter** kullanılır: `Pending` durumda bekleyen pod'ların toplam CPU/bellek isteğine bakar ve bu isteği **en ucuz karşılayacak EC2 türünü** (ör. spot `m6g.xlarge`) saniyeler içinde açar; yük düşünce node'ları birleştirip (consolidation) boşalanları kapatır. HPA pod seviyesinde, Karpenter node seviyesinde ölçekler; ikisi birlikte "Prime Day sabahı 10× trafik" senaryosunu insan müdahalesi olmadan karşılar. Amazon ayrıca ölçekleme için yalnızca CPU'ya değil, SQS kuyruğundaki mesaj sayısı gibi **iş metriklerine** (KEDA ile) bakar: kuyruk uzarsa tüketici pod'ları artar.
:::

:::callout{tone="warning" title="Sık yapılan hatalar"}
- **Request belirtmemek**: HPA yüzdesi hesaplanamaz, scheduler pod'ları rastgele sıkıştırır, gürültülü komşu problemi başlar.
- **Liveness probe'u derin yapmak**: DB yavaşladı → tüm pod'lar yeniden başladı → DB'ye bağlantı fırtınası → daha da yavaşladı.
- **`replicas: 1`**: Node bakımında ya da AZ kesintisinde servis tamamen düşer. Minimum 2, tercihen farklı AZ'lerde (`topologySpreadConstraints`).
- **Graceful shutdown'ı unutmak**: Pod silinirken SIGTERM gelir; uygulama açık istekleri bitirip kapanmalı (`terminationGracePeriodSeconds`), yoksa rolling update sırasında kullanıcılar 502 görür.
:::

:::callout{tone="tip" title="Mülakat ipuçları"}
- Kubernetes'i tek cümleyle tanımlayın: *"İstenen durumu bildirdiğiniz, kontrol döngülerinin sürekli uzlaştırdığı bir container orkestratörü."*
- Nesne hiyerarşisini sıralayabilin: **Ingress → Service → (Deployment → ReplicaSet →) Pod**; her birinin tek bir sorumluluğu var.
- HPA formülünü yazın ve **request'e göre** hesaplandığını söyleyin; sonra "pod var ama node yoksa?" sorusunu kendiniz açıp Cluster Autoscaler/Karpenter'ı anlatın.
- Liveness ve readiness farkını örnekle açıklayın: biri **yeniden başlatır**, diğeri **trafikten çıkarır**.
:::

:::quiz{src="quiz.json"}
:::

:::next{lesson="f-04-iac-config-secrets-flags"}
Manifest'lerde `secretKeyRef` ve sabit imaj etiketleri gördünüz. Peki bu YAML'lar, kümeler ve veritabanları kim tarafından, nasıl yaratılıyor? Sırada Infrastructure as Code, konfigürasyon, secret yönetimi ve feature flag'ler.
:::

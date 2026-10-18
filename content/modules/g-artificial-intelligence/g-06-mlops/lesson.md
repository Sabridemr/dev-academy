---
id: g-06-mlops
slug: mlops
module: g-artificial-intelligence
order: 6
title:
  tr: "MLOps: Veri Pipeline, Feature Store, Eğitim, Serving, A/B, Drift"
  en: "MLOps: Data Pipelines, Feature Store, Training, Serving, A/B, Drift"
summary:
  tr: Modelin üretime giden yolu ve izlenmesi.
  en: The model’s path to production and its monitoring.
durationMinutes: 30
level: advanced
tags: [mlops, feature-store, model-registry, serving, ab-testing, drift, monitoring]
prerequisites: [g-01-ml-foundations, a-09-message-queues-event-driven]
concepts: [data-pipeline, feature-store, training-serving-skew, distributed-training, model-registry, batch-vs-online-serving, canary-deployment, ab-testing, data-drift, concept-drift, retraining-loop]
---

## Kavram: model kodun %5'idir

Google'ın ünlü "Hidden Technical Debt in ML Systems" makalesindeki şema hâlâ geçerli: ortadaki küçük kutu "ML kodu"dur; çevresindeki veri toplama, doğrulama, özellik çıkarımı, altyapı, serving ve izleme kutuları ondan kat kat büyüktür. **MLOps**, bu kutuları yazılım mühendisliği disipliniyle (sürümleme, CI/CD, otomasyon, gözlemlenebilirlik) yönetme pratiğidir. Klasik DevOps'tan farkı: üretime yalnızca kod değil, **veri ve model** de çıkar ve ikisi de zamanla sessizce bozulur.

:::diagram{src="diagram.svg" alt="MLOps yaşam döngüsü: veri kaynakları, pipeline, feature store, eğitim, değerlendirme, model registry, serving (batch ve online), izleme ve yeniden eğitim geri besleme oku|MLOps lifecycle: data sources, pipeline, feature store, training, evaluation, model registry, serving (batch and online), monitoring and the retraining feedback arrow"}
Döngü kapalıdır: izleme çıktısı yeniden eğitimi tetikler; feature store hem eğitime hem serving'e aynı tanımı verir.
:::

## Veri pipeline'ı ve doğrulama

Model kalitesinin tavanını veri belirler. Üretim pipeline'ı ham olayları (tıklama, işlem, sensör) toplar, temizler, birleştirir ve **özelliklere** (feature) dönüştürür. İki kural:

1. **Şema ve dağılım doğrulaması**: Her çalıştırmada kolon tipleri, eksik oranı, değer aralıkları ve dağılım istatistikleri beklenen profille karşılaştırılır (Great Expectations, TFDV). "Ülke kodu" kolonunun bir gün %40 boş gelmesi, modeli sessizce çökertir.
2. **Yeniden üretilebilirlik**: Her eğitim verisi anlık görüntüsü sürümlenir (Delta Lake / Iceberg zaman yolculuğu, DVC). "Geçen ayki modeli aynı veriyle yeniden eğit" mümkün olmalıdır.

## Feature store

Aynı özellik ("kullanıcının son 7 gündeki sipariş sayısı") iki yerde gerekir: eğitimde (geçmiş değerler, toplu) ve serving'de (şu anki değer, milisaniyede). İki farklı ekip iki farklı SQL yazarsa tanımlar sapar — buna **training-serving skew** denir ve üretimdeki en sinsi hatadır. **Feature store** tanımı bir kez yazdırır ve iki arayüz sunar:

| | Offline store | Online store |
|---|---|---|
| Depo | Veri gölü / DWH (Parquet, BigQuery) | Redis, DynamoDB, Cassandra |
| Erişim | Toplu, point-in-time doğru join'ler | Anahtar ile tek satır, < 10 ms |
| Kullanım | Eğitim seti üretimi, backfill | Çıkarım anında özellik getirme |
| Güncelleme | Günlük/saatlik batch | Stream (Kafka/Flink) ile saniyeler |

**Point-in-time correctness** kritiktir: eğitim örneği 3 Mart'taki bir işlemse, özellikler 3 Mart'taki değerler olmalıdır; sonraki bilgiyi kullanmak (leakage) modeli çevrimdışı mükemmel, üretimde kötü yapar.

## Eğitim altyapısı

Küçük modeller tek makinede, büyük modeller GPU kümelerinde eğitilir. Dağıtık eğitimin iki ana deseni:

- **Data parallelism**: Her GPU modelin tam kopyasını tutar, farklı mini-batch işler; gradyanlar her adımda **all-reduce** ile ortalanır (PyTorch DDP, Horovod). Model tek GPU'ya sığıyorsa varsayılan.
- **Model / tensor / pipeline parallelism**: Model sığmıyorsa katmanlar ya da tensörler GPU'lara bölünür (Megatron, DeepSpeed ZeRO, FSDP). LLM eğitimi bunların bileşimidir.

Eğitim işi bir **pipeline** olarak tanımlanır (Kubeflow, Airflow, Vertex AI, SageMaker Pipelines): veri çek → doğrula → özellik üret → eğit → değerlendir → kaydet. Her adım konteynerdir, çıktıları artefakttır, parametreler ve metrikler bir **experiment tracker**'a (MLflow, W&B) yazılır. Spot/preemptible GPU'lar maliyeti üçte bire indirir; bedeli checkpoint disiplinidir.

:::interactive{type="pipeline" stages="ingest,validate,features,train,evaluate,register,deploy" failureStage="validate" retries=2}
Pipeline'ı çalıştırıp yedi adımı izleyin. "Hata enjekte et" kutusunu işaretleyin (aşama: validate) ve yeniden çalıştırın: şema hatası iki yeniden denemeden sonra da geçmez, features'tan deploy'a kadar her şey "atlandı" kalır — bozuk veriyle eğitime hiç başlanmaz. "Yeniden deneme"yi 0'a indirip farkı görün; gerçek pipeline'da bu yeniden denemelerin karşılığı, checkpoint'ten devam eden eğitim adımıdır. Son olarak "Canary hata oranı"nı %2'nin üstüne çıkarın: yeni model üretime çıkar çıkmaz otomatik geri alınır.
:::

## Model registry

Eğitilen her model bir sürüm olarak **registry**'ye kaydedilir: ağırlıklar, eğitim verisi sürümü, kod commit'i, hiperparametreler, değerlendirme metrikleri, imza (girdi/çıktı şeması) ve aşama (`staging`, `production`, `archived`). Registry üç soruya cevap verir: üretimde hangi model var, nasıl üretildi, bir öncekine nasıl dönerim? Terfi (promotion) kuralı otomatikleştirilebilir: "doğrulama AUC'si üretimdeki modelden ≥ 0.5 puan yüksek ve adalet metrikleri eşiğin altında değilse staging'e al."

## Serving: batch mi, online mı?

| | **Batch serving** | **Online serving** |
|---|---|---|
| Ne zaman? | Tahminler önceden hesaplanabiliyorsa (gece "sana özel" listesi, churn skoru) | İstek anındaki bilgiye bağlıysa (arama sorgusu, fraud, gerçek zamanlı öneri) |
| Nasıl? | Spark/Beam işi → tablo/cache'e yaz | Model sunucusu (TorchServe, Triton, KServe) REST/gRPC |
| Gecikme | Saatler (önemsiz) | p99 10–100 ms |
| Maliyet | Ucuz, yüksek verimlilik | GPU/CPU sürekli açık, otomatik ölçekleme |
| Zorluk | Bayatlık | Özellik getirme + model + ağ gecikmesi bütçesi |

Çoğu sistem ikisini karıştırır: ağır kısmı (kullanıcı embedding'i) gece batch, hafif kısmı (son sıralama) online. Online serving'de klasik sistem tasarımı araçları geçerlidir: yük dengeleyici, otomatik ölçekleme, önbellek, zaman aşımı ve **fallback** (model cevap veremezse popüler öğeleri göster).

## Güvenli yayına alma: shadow, canary, A/B

Yeni model çevrimdışı metriklerde iyi olabilir ama üretimde iş metriğini (gelir, tıklama, dolandırıcılık kaybı) düşürebilir. Kademeli yayın:

1. **Shadow**: Yeni model trafiği alır, tahmin üretir ama cevap eskiden döner; tahminler karşılaştırılır. Risk sıfır.
2. **Canary**: Trafiğin %1–5'i yeni modele; hata oranı, gecikme ve iş metrikleri izlenir; sorun olursa otomatik geri alma.
3. **A/B testi**: Kullanıcılar rastgele iki gruba bölünür, istatistiksel anlamlılığa ulaşana dek (günler, haftalar) iş metrikleri karşılaştırılır. Grubu **kullanıcı id'sine göre** sabitleyin; aynı kullanıcı her istekte farklı model görürse deney bozulur.
4. **Tam yayın** ve eski modelin "sıcak yedek" olarak tutulması.

:::animation{scene="scene.json"}
Kapalı döngü: veri → feature store → dağıtık eğitim → registry → %5 canary → izleme → drift → yeniden eğitim.
:::

## İzleme ve drift

Model üretime çıktığı an eskimeye başlar. İzlenecek dört katman:

| Katman | Örnek sinyal | Araç |
|---|---|---|
| **Sistem** | p99 gecikme, hata oranı, GPU doluluğu | Prometheus, Grafana |
| **Veri (girdi)** | Özellik dağılımı eğitim verisinden kaydı mı? (**data drift**; PSI, KL ayrışımı, KS testi) | Evidently, whylogs, Vertex Model Monitoring |
| **Tahmin (çıktı)** | Pozitif tahmin oranı aniden %2'den %9'a çıktı mı? | Aynı araçlar |
| **İş / gerçek etiket** | Gerçek sonuçlar geldikçe (gecikmeli) AUC, precision; iş KPI'ları | Özel dashboard, A/B platformu |

**Data drift**: girdi dağılımı değişti (yeni bir pazar açıldı, fiyatlar enflasyonla kaydı). **Concept drift**: girdi–çıktı ilişkisi değişti (dolandırıcılar taktik değiştirdi, pandemi alışkanlıkları bozdu). İlki özellik dağılımından anında, ikincisi yalnızca gerçek etiketler geldikten sonra görülür. Çare, yeniden eğitimdir: zamanlanmış (haftalık) ya da tetiklenmiş (drift eşiği aşılınca). Yeniden eğitim pipeline'ı, yukarıdaki tüm adımları insan müdahalesi olmadan çalıştırabilmelidir — MLOps'un olgunluk ölçütü budur.

:::callout{tone="warning" title="Geri bildirim döngüleri"}
Öneri modeli yalnızca önerdiklerini gösterdiği için kullanıcı yalnızca onları tıklar; yeni eğitim verisi modelin kendi önyargısını doğrular ve çeşitlilik azalır. Fraud modeli engellediği işlemlerin gerçek etiketini hiç göremez. Çözümler: küçük bir rastgele keşif dilimi (exploration), etiket için örneklenmiş manuel inceleme, karşıolgusal (counterfactual) değerlendirme.
:::

:::code{lang="ts" title="Drift tespiti (PSI) ve canary terfi kararı"}
```ts
/** Population Stability Index: iki dağılımın (eğitim vs. üretim) ne kadar ayrıştığını ölçer. */
export function psi(expected: number[], actual: number[], bins = 10): number {
  const min = Math.min(...expected, ...actual);
  const max = Math.max(...expected, ...actual);
  const width = (max - min) / bins || 1;
  const hist = (xs: number[]) => {
    const h = new Array(bins).fill(1e-6);                       // sıfır bölme/log(0) koruması
    for (const x of xs) h[Math.min(bins - 1, Math.floor((x - min) / width))] += 1 / xs.length;
    return h;
  };
  const e = hist(expected), a = hist(actual);
  return e.reduce((s, ei, i) => s + (a[i] - ei) * Math.log(a[i] / ei), 0);
}
// Yaygın eşikler: < 0.1 kararlı · 0.1–0.25 izle · > 0.25 drift → yeniden eğitimi tetikle

export interface CanaryMetrics {
  errorRate: number;      // 5xx oranı
  p99LatencyMs: number;
  conversionRate: number; // iş metriği
  samples: number;
}

/** Canary'yi terfi ettir, beklet ya da geri al. Çağıran taraf bunu her değerlendirme penceresinde çalıştırır. */
export function canaryDecision(stable: CanaryMetrics, canary: CanaryMetrics, minSamples = 10_000) {
  if (canary.errorRate > stable.errorRate * 1.5 + 0.001) return 'rollback' as const;   // güvenlik önce
  if (canary.p99LatencyMs > stable.p99LatencyMs * 1.2) return 'rollback' as const;
  if (canary.samples < minSamples) return 'hold' as const;                              // istatistik için erken

  // İki oran için basit z-testi (gerçekte A/B platformu / sıralı test kullanın)
  const p = (stable.conversionRate * stable.samples + canary.conversionRate * canary.samples) / (stable.samples + canary.samples);
  const se = Math.sqrt(p * (1 - p) * (1 / stable.samples + 1 / canary.samples));
  const z = (canary.conversionRate - stable.conversionRate) / se;
  if (z < -1.96) return 'rollback' as const;   // iş metriği anlamlı şekilde kötü
  if (z > 1.96) return 'promote' as const;     // anlamlı şekilde iyi → trafiği artır
  return 'hold' as const;
}
```
```python
import numpy as np

def psi(expected, actual, bins=10):
    edges = np.histogram_bin_edges(np.concatenate([expected, actual]), bins=bins)
    e = np.histogram(expected, edges)[0] / len(expected) + 1e-6
    a = np.histogram(actual, edges)[0] / len(actual) + 1e-6
    return float(np.sum((a - e) * np.log(a / e)))

# Airflow/Kubeflow içinde günlük görev:
# if psi(train_feature, prod_feature_last_24h) > 0.25: trigger_dag("retrain_model")
```
:::

:::realworld{company="Uber"}
Uber'in **Michelangelo** platformu, bu dersteki kutuların hepsini tek bir iç üründe birleştiren ilk büyük örneklerden biriydi. **Palette** adlı feature store, "sürücünün son 1 saatteki ortalama kabul oranı" gibi özellikleri hem Hive'da (eğitim için geçmiş) hem Cassandra'da (serving için güncel) aynı tanımla tutar; stream işleri (Flink) online değerleri saniyeler içinde günceller. ETA tahmini, sürüş eşleştirme ve dolandırıcılık modelleri bu platformda eğitilir, registry'de sürümlenir ve Michelangelo'nun serving katmanında şehir bazında kademeli açılır: yeni ETA modeli önce birkaç şehirde canary olarak çalışır, gerçek varış süreleriyle karşılaştırılır (gecikmeli etiket) ve iyileşme kanıtlanınca yayılır. Uber'in paylaştığı derslerden biri, modellerin çoğunun "ilginç algoritma" değil **veri kalitesi ve özellik tazeliği** nedeniyle başarısız olduğuydu — bu yüzden izleme, özellik dağılımı seviyesinde yapılır.
:::

:::callout{tone="tip" title="Mülakat ipuçları"}
- "Çevrimdışı AUC arttı ama üretimde gelir düştü" → training-serving skew, çevrimdışı metrik–iş metriği uyumsuzluğu, gecikme artışı, A/B tasarım hatası. Teşhis sırasıyla.
- Feature store'un tek cümlelik gerekçesi: **aynı özellik tanımı, iki erişim deseni, point-in-time doğruluk.**
- Yayın merdiveni: shadow → canary → A/B → tam; geri alma otomatik olmalı.
- Drift türlerini ayırın: data drift girdiden anında görülür, concept drift etiket gelince.
:::

:::quiz{src="quiz.json"}
:::

:::next{lesson="g-07-production-ai-systems"}
Sırada: tüm bu parçaları 100 ms'lik bir bütçeye sığdırmak — Amazon'un öneri sistemi, arama sıralaması ve gerçek zamanlı fraud tespiti.
:::

---
id: g-01-ml-foundations
slug: ml-foundations
module: g-artificial-intelligence
order: 1
title:
  tr: "ML Temelleri: Öğrenme Türleri, Veri Ayrımı, Overfitting"
  en: "ML Foundations: Learning Types, Data Splits, Overfitting"
summary:
  tr: Supervised/unsupervised/reinforcement; overfitting animasyonu.
  en: Supervised/unsupervised/reinforcement; overfitting animation.
durationMinutes: 25
level: beginner
tags: [machine-learning, supervised, unsupervised, reinforcement, overfitting, bias-variance]
prerequisites: []
concepts: [supervised-learning, unsupervised-learning, reinforcement-learning, train-validation-test, overfitting, underfitting, bias-variance, regularization, gradient-descent]
---

## Kavram: kuralı yazmak yerine veriden öğrenmek

Klasik yazılımda programcı kuralı yazar: "fiyat 1000 TL'den büyükse ve kullanıcı yeniyse işlemi incele". **Makine öğrenmesi (machine learning, ML)** bu ilişkiyi tersine çevirir: biz örnekleri veririz, algoritma kuralı (modeli) kendisi çıkarır. Model, parametreleri (`w`, `b` gibi sayılar) veriye bakarak ayarlanan bir fonksiyondur: `y = f(x; θ)`.

Bir ML problemini tarif ederken üç şeyi netleştirmeliyiz:

1. **Girdi (features)** — modele ne gösteriyoruz? (işlem tutarı, saat, cihaz türü)
2. **Hedef (label / reward)** — modelin ne üretmesini istiyoruz? (fraud mu değil mi)
3. **Kayıp (loss)** — "yanlış" ne kadar yanlış? (hata oranı, kare hata, log-loss)

Bu üçlü sabitlenince öğrenme, **kaybı en aza indiren parametreleri aramaya** dönüşür.

## Üç öğrenme türü

| | **Supervised (gözetimli)** | **Unsupervised (gözetimsiz)** | **Reinforcement (pekiştirmeli)** |
|---|---|---|---|
| Veri | Etiketli örnekler `(x, y)` | Yalnızca `x`, etiket yok | Ortamla etkileşim: durum, eylem, ödül |
| Amaç | `x → y` eşlemesini öğrenmek | Yapıyı keşfetmek (küme, boyut, yoğunluk) | Uzun vadeli ödülü maksimize eden politika |
| Tipik görevler | Sınıflandırma (spam mı?), regresyon (fiyat tahmini) | Kümeleme (müşteri segmenti), boyut indirgeme (PCA), anomali tespiti | Oyun oynama, robot kontrolü, öneri sıralama, LLM hizalama (RLHF) |
| Geri bildirim | Her örnek için doğru cevap | Yok | Gecikmeli ve seyrek ödül |
| Ölçüm | Accuracy, precision/recall, RMSE | Silhouette, yeniden yapılandırma hatası | Toplam ödül (return) |

Pratikte sınırlar geçişkendir: **self-supervised** öğrenme (LLM'lerin ön eğitimi) etiketi verinin kendisinden üretir ("bir sonraki kelimeyi tahmin et"); **semi-supervised** az etiketle çok etiketsiz veriyi birleştirir.

:::diagram{src="diagram.svg" alt="Üç öğrenme türü ve eğitim-doğrulama-test ayrımı; model karmaşıklığına göre eğitim ve doğrulama hatası eğrileri|Three learning types and the train-validation-test split; training and validation error curves versus model complexity"}
Solda öğrenme türleri, sağda veri ayrımı ve klasik "U" eğrisi: doğrulama hatası önce düşer, sonra overfitting ile yükselir.
:::

## Veriyi neden üçe böleriz?

Modelin başarısını eğitimde gördüğü örneklerle ölçmek, sınav sorularını önceden vermek gibidir. Bu yüzden veri üç parçaya ayrılır:

| Parça | Tipik oran | Ne için? | Kaç kez bakılır? |
|---|---|---|---|
| **Train (eğitim)** | %60–80 | Parametreleri (`θ`) öğrenmek | Her epoch |
| **Validation (doğrulama)** | %10–20 | Hiperparametre seçmek (model karmaşıklığı, öğrenme oranı), erken durdurma | Her denemede |
| **Test** | %10–20 | Nihai, tarafsız başarı raporu | **Bir kez**, en sonda |

Doğrulama kümesine bakarak onlarca model denediğinizde, en iyi görünen model aslında doğrulama kümesine de hafifçe "uymuş" olur. Test kümesi bu sızıntıyı engeller. Veri azsa **k-fold cross-validation** kullanılır: veri k parçaya bölünür, her parça sırayla doğrulama olur, sonuçların ortalaması alınır.

:::callout{tone="danger" title="Veri sızıntısı (data leakage)"}
En sık görülen hata: normalizasyon istatistiklerini (ortalama, std) **tüm** veri üzerinde hesaplayıp sonra bölmek, ya da zaman serisinde geleceği rastgele eğitim kümesine karıştırmak. Model doğrulamada harika, üretimde berbat görünür. Kural: ayrımı **önce** yap, her dönüşümü yalnızca eğitim kümesinden öğren, zaman serilerinde kronolojik böl.
:::

## Overfitting ve underfitting

Model karmaşıklığı bir ayar düğmesidir: polinom derecesi, ağaç derinliği, nöron sayısı, eğitim epoch sayısı...

- **Underfitting (yetersiz uyum)**: Model çok basit; eğitim hatası da doğrulama hatası da yüksek. Doğrusal bir çizgi ile daire şeklindeki sınırı ayırmaya çalışmak gibi.
- **Overfitting (aşırı uyum)**: Model çok karmaşık; eğitim verisini (gürültüsü dahil) ezberler. Eğitim hatası sıfıra yaklaşırken doğrulama hatası yükselmeye başlar.

Aşağıdaki animasyon aynı veri üzerinde giderek karmaşıklaşan bir modelin eğitim ve doğrulama hatasını çubuklarla gösterir.

:::animation{scene="scene.json"}
Veri üçe bölünür; model karmaşıklığı arttıkça eğitim hatası düşer, doğrulama hatası önce düşüp sonra yükselir. Test kümesine yalnızca sonda bir kez bakılır.
:::

### Bias–variance ayrışımı

Beklenen test hatası üç parçaya ayrılabilir:

```
Hata = Bias² + Variance + İndirgenemez gürültü
```

- **Bias (yanlılık)**: Modelin varsayımları yüzünden sistematik olarak kaçırdığı kısım. Basit modellerde yüksek (underfitting).
- **Variance (varyans)**: Eğitim kümesi biraz değişince modelin ne kadar değiştiği. Karmaşık modellerde yüksek (overfitting).
- **Gürültü**: Etiketlerdeki ölçüm hatası; hiçbir model bunu azaltamaz.

Karmaşıklığı artırmak bias'ı düşürür, variance'ı yükseltir. "Tatlı nokta" doğrulama hatasının minimumudur. Modern derin ağlarda bu eğri bazen ikinci kez düşer (*double descent*), ama mülakatta klasik U eğrisi beklenir.

### Overfitting'e karşı araç kutusu

| Araç | Nasıl çalışır? |
|---|---|
| **Daha fazla veri** | Varyansı doğrudan düşürür; en güçlü ama en pahalı yol |
| **Regularization (L1/L2)** | Kayba `λ‖w‖` cezası ekler; büyük ağırlıkları caydırır. L1 ağırlıkları sıfıra iter (özellik seçimi) |
| **Early stopping** | Doğrulama hatası yükselmeye başlayınca eğitimi durdur |
| **Dropout** | Eğitimde nöronları rastgele kapat; ağ tek bir yola bağımlı kalamaz |
| **Data augmentation** | Görüntüyü döndür/kırp, metni yeniden yaz — veri çeşitliliğini artır |
| **Daha basit model** | Ağaç derinliğini, polinom derecesini azalt |
| **Ensemble** | Birçok yüksek varyanslı modelin ortalaması (random forest) |

## Öğrenme nasıl olur: gradient descent

Çoğu modelde "kaybı en aza indir" problemi **gradient descent (gradyan inişi)** ile çözülür. Kayıp fonksiyonunun parametrelere göre türevi (gradyan) en dik yükseliş yönünü verir; tersine küçük bir adım atarız:

```
θ ← θ − η · ∇L(θ)
```

`η` (öğrenme oranı, learning rate) adım boyudur: çok küçükse yakınsama saatler sürer, çok büyükse minimumun etrafında zıplar ya da ıraksar. **Stochastic gradient descent (SGD)** gradyanı tüm veri yerine küçük bir *mini-batch* üzerinden hesaplar; bu hem hızlıdır hem de gürültüsü sığ yerel minimumlardan kaçmaya yardım eder. Adam gibi optimizasyon yöntemleri adım boyunu parametre başına uyarlar.

:::interactive{type="gradient-descent" learningRate=0.1 startX=4 surface="bowl"}
Öğrenme oranını değiştirip başlangıç noktasını sürükleyin. 0.01'de kaç adımda yakınsıyor? 0.9'da ne oluyor? Yüzeyi "iki çukurlu" yapıp yerel minimuma takılmayı gözlemleyin.
:::

:::code{lang="ts" title="Train/val/test ayrımı, doğrusal regresyon ve overfitting kontrolü"}
```ts
type Row = { x: number[]; y: number };

/** Deterministik karıştırma + üçlü ayrım. Ayrımı normalizasyondan ÖNCE yap. */
export function split(rows: Row[], ratios = [0.7, 0.15, 0.15], seed = 42) {
  const shuffled = [...rows].sort(() => (seed = (seed * 9301 + 49297) % 233280) / 233280 - 0.5);
  const n = shuffled.length;
  const trainEnd = Math.floor(n * ratios[0]);
  const valEnd = trainEnd + Math.floor(n * ratios[1]);
  return { train: shuffled.slice(0, trainEnd), val: shuffled.slice(trainEnd, valEnd), test: shuffled.slice(valEnd) };
}

/** Mini-batch gradient descent ile L2 cezalı doğrusal regresyon. */
export function fitLinear(train: Row[], opts = { lr: 0.05, epochs: 200, l2: 0.001, batch: 32 }) {
  const d = train[0].x.length;
  let w = new Array(d).fill(0);
  let b = 0;
  for (let epoch = 0; epoch < opts.epochs; epoch++) {
    for (let i = 0; i < train.length; i += opts.batch) {
      const batch = train.slice(i, i + opts.batch);
      const gw = new Array(d).fill(0);
      let gb = 0;
      for (const { x, y } of batch) {
        const err = x.reduce((s, xi, j) => s + xi * w[j], b) - y; // tahmin − gerçek
        x.forEach((xi, j) => (gw[j] += (2 * err * xi) / batch.length));
        gb += (2 * err) / batch.length;
      }
      // L2: büyük ağırlıkları cezalandır (weight decay)
      w = w.map((wj, j) => wj - opts.lr * (gw[j] + 2 * opts.l2 * wj));
      b -= opts.lr * gb;
    }
  }
  return { w, b };
}

export function mse(rows: Row[], m: { w: number[]; b: number }) {
  return rows.reduce((s, { x, y }) => s + (x.reduce((a, xi, j) => a + xi * m.w[j], m.b) - y) ** 2, 0) / rows.length;
}

// Kullanım: doğrulama hatası eğitim hatasının çok üstündeyse overfitting şüphesi
// const { train, val, test } = split(rows);
// const model = fitLinear(train);
// console.log(mse(train, model), mse(val, model)); // test'e yalnızca en sonda bak
```
```python
import numpy as np
from sklearn.model_selection import train_test_split
from sklearn.linear_model import Ridge
from sklearn.metrics import mean_squared_error

# Önce ayır, sonra dönüştür — sızıntıyı engelle
X_train, X_tmp, y_train, y_tmp = train_test_split(X, y, test_size=0.3, random_state=42)
X_val, X_test, y_val, y_test = train_test_split(X_tmp, y_tmp, test_size=0.5, random_state=42)

for alpha in [0.0, 0.01, 0.1, 1.0]:          # L2 cezasının gücü
    model = Ridge(alpha=alpha).fit(X_train, y_train)
    print(alpha, mean_squared_error(y_train, model.predict(X_train)),
                 mean_squared_error(y_val, model.predict(X_val)))
# En iyi alpha'yı doğrulamaya göre seç; test'i yalnızca bir kez raporla
```
:::

## Doğru metriği seçmek

Fraud verisinde işlemlerin %0.1'i sahteyse "hepsi temiz" diyen model %99.9 accuracy alır — ve işe yaramaz. Dengesiz sınıflarda **precision** (yakaladıklarımın kaçı gerçekten sahte?), **recall** (sahtelerin kaçını yakaladım?), **F1** ve **PR-AUC** kullanılır. Regresyonda RMSE büyük hatalara, MAE her hataya eşit ağırlık verir. Metrik, iş hedefinden türemelidir: yanlış alarm mı pahalı, kaçırılan vaka mı?

:::realworld{company="Netflix"}
Netflix'in öneri modelleri kullanıcının geçmiş izleme verisinden eğitilir, ancak veri **zamana göre** bölünür: Ocak–Mayıs eğitim, Haziran doğrulama. Rastgele bölünse model "geleceği" görürdü. Çevrimdışı metrikler (RMSE, NDCG) yalnızca ön eleme için kullanılır; gerçek test, modelin küçük bir kullanıcı dilimine açıldığı **A/B deneyidir** çünkü çevrimdışı doğrulama kümesinde iyi görünen bir modelin üretimde izleme süresini artırmadığı çok görülmüştür. Bu, "doğrulama kümesine aşırı uyum" probleminin şirket ölçeğindeki hâlidir.
:::

:::callout{tone="tip" title="Mülakat ipuçları"}
- "Model eğitimde %99, üretimde %70" denirse ilk şüpheler: **overfitting**, **veri sızıntısı**, **dağılım kayması** (eğitim verisi üretimi temsil etmiyor).
- Hiperparametre seçerken test kümesine bakmak hile sayılır; "validation ile seçtim, test'i bir kez raporladım" deyin.
- Bias–variance'ı tek cümleyle anlatın: *basit model sistematik hata yapar, karmaşık model veriye göre savrulur; doğru karmaşıklık ikisinin toplamını en aza indirir.*
:::

:::quiz{src="quiz.json"}
:::

:::next{lesson="g-02-classical-algorithms"}
Sırada: bu temelleri somut algoritmalara dönüştürüyoruz — regresyon, karar ağaçları, SVM, k-means ve PCA.
:::

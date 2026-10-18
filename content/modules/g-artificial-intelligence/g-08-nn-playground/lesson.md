---
id: g-08-nn-playground
slug: nn-playground
module: g-artificial-intelligence
order: 8
title:
  tr: "Mini Playground: Tarayıcıda Sinir Ağı Eğitme"
  en: "Mini Playground: Train a Neural Network in the Browser"
summary:
  tr: TensorFlow.js ile ağırlık değişimini canlı izleyin.
  en: Watch weights change live with TensorFlow.js.
durationMinutes: 30
level: intermediate
tags: [neural-network, tensorflow-js, playground, xor, hyperparameters, training]
prerequisites: [g-03-neural-networks]
concepts: [xor-problem, decision-boundary, hidden-layers, activation-function, learning-rate, epoch, loss-curve, overfitting, tensorflow-js, weight-initialization]
---

## Kavram: teoriyi elinizle kırın

Önceki derslerde ileri ve geri yayılımı kâğıt üzerinde izledik. Bu derste aynı ağı tarayıcınızda, **TensorFlow.js** ile gerçekten eğiteceksiniz: veri kümesini seçin, katman ve nöron sayısını değiştirin, öğrenme oranını oynatın ve karar sınırının epoch'lar boyunca nasıl şekillendiğini izleyin. Amaç bir model üretmek değil; "öğrenme oranı neden önemli", "gizli katman neden gerekli", "overfitting neye benziyor" sorularının cevabını gözünüzle görmektir.

:::diagram{src="diagram.svg" alt="Playground anatomisi: üç oyuncak veri kümesi (XOR, daire, spiral), ayar paneli (katmanlar, aktivasyon, öğrenme oranı), 2-4-4-1 ağ çizimi ve epoch'lara göre eğitim/doğrulama kayıp eğrisi|Playground anatomy: three toy datasets (XOR, circle, spiral), the settings panel (layers, activation, learning rate), a 2-4-4-1 network drawing and the training/validation loss curve over epochs"}
Solda veri kümeleri, ortada ağ ve ayarlar, sağda kayıp eğrisi. Her ayar aşağıdaki interaktifte canlı değiştirilebilir.
:::

## Veri kümeleri: her biri bir ders

Üç oyuncak veri kümesi, iki özellikli (`x₁`, `x₂`) ve iki sınıflı düzlemsel problemlerdir. Küçük olmaları kasıtlı: eğitim saniyeler sürer ve karar sınırı çizilebilir.

| Veri kümesi | Yapı | Doğrusal model? | Minimum ağ | Ders |
|---|---|---|---|---|
| **XOR** | Çapraz köşeler aynı sınıf: (0,0) ve (1,1) → 0; (0,1) ve (1,0) → 1 | Hayır — tek bir doğru ayıramaz | 1 gizli katman, 2–3 nöron | Gizli katman + doğrusal olmayan aktivasyon neden şart |
| **Circle (daire)** | İçteki daire bir sınıf, dış halka diğer sınıf | Hayır | 1 gizli katman, 3–4 nöron | Ağ, doğrusal parçalardan eğri sınır kurar |
| **Spiral** | İki iç içe sarmal | Hayır, çok zor | 2 gizli katman, 6–8 nöron, çok epoch | Derinlik, öğrenme oranı ve sabrın etkisi; overfitting gürültülü sürümde görünür |

XOR tarihsel olarak da önemlidir: 1969'da tek katmanlı perceptron'un XOR'u öğrenemediğinin gösterilmesi, sinir ağı araştırmalarını yıllarca durdurmuştu. Çözüm — gizli katman ve backpropagation — g-03 dersinde türettiğimiz şeydir.

## Ayarlar ve etkileri

### Katman ve nöron sayısı

Her gizli nöron düzlemde bir "kırılma" ekler; ReLU'lu bir ağın karar sınırı, nöron sayısı kadar parçadan oluşan kırık bir çizgidir. XOR için 2 nöron teorik olarak yeter ama 3–4 nöron eğitimi çok daha güvenilir yapar (kötü başlangıçtan kurtulma şansı). Spiral için tek katmanda 8 nöron yetmezken iki katmanda 4+4 nöron yeter — **derinlik, aynı parametre sayısıyla daha karmaşık fonksiyonlar üretir**. Çok fazla nöron ise gürültülü veride her noktayı sarmalayan girintili sınırlar üretir: overfitting'in görünür hâli.

### Aktivasyon fonksiyonu

- **Linear** (aktivasyon yok): kaç katman eklerseniz ekleyin sınır düz bir çizgi kalır; XOR asla öğrenilmez. Bunu mutlaka deneyin.
- **ReLU**: hızlı yakınsar, keskin köşeli sınırlar; bazı nöronlar "ölür" (sınır değişmez olur).
- **tanh**: pürüzsüz sınırlar, küçük ağlarda XOR için çok iyi; büyük öğrenme oranında doyar.
- **sigmoid**: gizli katmanda en yavaşı (türev ≤ 0.25); çıkış katmanı için doğaldır.

### Öğrenme oranı

Playground'daki en öğretici düğme. Aynı ağda:

| Öğrenme oranı | Gözlem |
|---|---|
| 0.001 | Kayıp eğrisi neredeyse düz; 1000 epoch sonra hâlâ 0.69 civarı (rastgele tahmin) |
| 0.03 | Düzgün iniş; XOR 200–400 epoch'ta çözülür |
| 0.3 | Hızlı başlar, sonra kayıp zıplar; sınır her epoch'ta titrer |
| 3 | Iraksar: kayıp artar, ağırlıklar devasa olur, çıktı 0 ya da 1'e yapışır |

Kayıp eğrisinde uzun bir **plato** görürseniz (0.69'da bekleme), ağ henüz simetriyi kıramamıştır; ya biraz daha bekleyin ya da öğrenme oranını artırın. Plato sonrası ani düşüş, gizli nöronların "iş bölümü" yaptığı andır.

### Batch boyutu ve epoch

4 örnekli XOR'da batch = tüm veri; spiral gibi 200 noktalı kümelerde batch 10–32 gürültülü ama hızlı ilerleme sağlar. Bir **epoch**, tüm verinin bir kez görülmesidir. Doğrulama kaybının yükselmeye başladığı epoch, early stopping noktanızdır.

:::interactive{type="neural-network-playground" dataset="xor" hiddenLayers="4,4" learningRate=0.03}
Deney sırası: (1) Aktivasyonu "linear" yapın ve XOR'un neden asla öğrenilmediğini görün: doğrusal katmanların bileşimi yine doğrusaldır. (2) tanh'a dönün, gizli katmanları "2" yapın; kaç epoch'ta çözülüyor? (3) Öğrenme oranını 1'e (en sağ) çıkarın ve kaybın nasıl zıpladığını izleyin. (4) Spiral'e geçin: "4,4" ile 1000 epoch bekleyin; sonra gürültüyü %30 yapıp "8,8,8" ile eğitin — karar sınırı tek tek gürültülü noktaları sarmaya başlar (overfitting). Her denemede ağırlık çizgilerinin kalınlığının (ağırlığın mutlak değeri) nasıl değiştiğine bakın.
:::

## Ağırlıklar epoch'lar boyunca

Aşağıdaki sahne, XOR üzerinde 2-3-1'lik bir tanh ağının ağırlıklarını beş anda dondurur. Kenar etiketleri gerçek ağırlık değerleridir: başta küçük ve rastgele, platoda neredeyse değişmez, sonra hızla büyür ve simetri kırılır — h₂ "negatif dedektör" olurken h₁ ve h₃ "pozitif dedektör" olur.

:::animation{scene="scene.json"}
Epoch 0 → 20 → 100 → 300 → 800: kayıp 0.69'dan 0.04'e inerken kenar ağırlıklarının güncellenmesi ve son tahminler.
:::

## Kod: aynı ağı TensorFlow.js ile kurmak

Playground'un arkasında şu kod koşar. `tf.sequential` katmanları sırayla yığar; `compile` kayıp ve optimizasyon yöntemini seçer; `fit` forward → loss → backward → update döngüsünü çalıştırır. Tarayıcıda WebGL ya da WebGPU arka ucu matris çarpımlarını GPU'ya taşır; 4 örnekli XOR için bu fark etmez ama 10 000 noktalı bir kümede eder.

:::code{lang="ts" title="TensorFlow.js ile XOR'u öğrenen 2-4-4-1 ağ ve ağırlıkları okuma"}
```ts
import * as tf from '@tensorflow/tfjs';

// XOR: 4 örnek, 2 özellik, 1 ikili etiket
const xs = tf.tensor2d([[0, 0], [0, 1], [1, 0], [1, 1]]);
const ys = tf.tensor2d([[0], [1], [1], [0]]);

export function buildModel(hidden = [4, 4], activation: 'relu' | 'tanh' | 'sigmoid' = 'tanh', lr = 0.03) {
  const model = tf.sequential();
  hidden.forEach((units, i) =>
    model.add(tf.layers.dense({
      units,
      activation,
      inputShape: i === 0 ? [2] : undefined,     // yalnızca ilk katman girdi şeklini bilir
      kernelInitializer: 'glorotUniform',        // Xavier başlangıcı: tanh/sigmoid için uygun ölçek
    })),
  );
  model.add(tf.layers.dense({ units: 1, activation: 'sigmoid' }));   // ikili sınıf çıkışı
  model.compile({ optimizer: tf.train.adam(lr), loss: 'binaryCrossentropy', metrics: ['accuracy'] });
  return model;
}

/** Her epoch sonunda kayıp ve ilk katmanın ağırlıklarını dışarı ver (sahne/çizim için) */
export async function train(model: tf.Sequential, epochs = 500, onEpoch?: (e: number, loss: number, w: number[][]) => void) {
  await model.fit(xs, ys, {
    epochs,
    batchSize: 4,                                  // XOR'da tüm veri tek batch
    shuffle: true,
    callbacks: {
      onEpochEnd: async (epoch, logs) => {
        if (epoch % 20 === 0 && onEpoch) {
          const kernel = model.layers[0].getWeights()[0];          // [2, hidden[0]] ağırlık matrisi
          onEpoch(epoch, logs?.loss ?? NaN, (await kernel.array()) as number[][]);
        }
        await tf.nextFrame();                       // tarayıcıyı dondurma: UI'a nefes aldır
      },
    },
  });
}

// Tahmin: 0.5 eşiği ile sınıf
export async function predictXor(model: tf.Sequential) {
  const out = model.predict(xs) as tf.Tensor;
  const probs = (await out.array()) as number[][];
  out.dispose();                                   // GPU belleğini elle serbest bırak
  return probs.map(([p]) => ({ p: +p.toFixed(3), label: p > 0.5 ? 1 : 0 }));
}

// const m = buildModel([4, 4], 'tanh', 0.03);
// await train(m, 500, (e, loss) => console.log(`epoch ${e} loss ${loss.toFixed(3)}`));
// console.log(await predictXor(m)); // ≈ [{p:0.02,label:0},{p:0.97,label:1},{p:0.97,label:1},{p:0.03,label:0}]
```
```python
import tensorflow as tf
import numpy as np

xs = np.array([[0, 0], [0, 1], [1, 0], [1, 1]], dtype="float32")
ys = np.array([[0], [1], [1], [0]], dtype="float32")

model = tf.keras.Sequential([
    tf.keras.layers.Dense(4, activation="tanh", input_shape=(2,)),
    tf.keras.layers.Dense(4, activation="tanh"),
    tf.keras.layers.Dense(1, activation="sigmoid"),
])
model.compile(optimizer=tf.keras.optimizers.Adam(0.03), loss="binary_crossentropy", metrics=["accuracy"])
model.fit(xs, ys, epochs=500, batch_size=4, verbose=0)
print(model.predict(xs).round(3))          # ≈ [[0.02],[0.97],[0.97],[0.03]]
print(model.layers[0].get_weights()[0])    # ilk katmanın 2×4 ağırlık matrisi
```
:::

:::callout{tone="info" title="Tarayıcıda ML neden işe yarar?"}
TensorFlow.js ve ONNX Runtime Web, modeli kullanıcının cihazında çalıştırır: veri sunucuya gitmez (gizlilik), ağ gecikmesi yoktur (gerçek zamanlı kamera efektleri, el takibi) ve sunucu maliyeti sıfırdır. Sınır, model boyutu (birkaç yüz MB'ı indirmek pratik değil) ve cihaz gücüdür; bu yüzden tarayıcıda genelde küçük ya da damıtılmış (distilled) modeller koşar, büyük modeller sunucuda kalır.
:::

## Hata ayıklama kılavuzu

| Gözlem | Olası neden | Dene |
|---|---|---|
| Kayıp 0.69'da sabit | Öğrenme oranı çok düşük, aktivasyon linear, ya da plato | lr ×10, tanh/ReLU, biraz daha bekle |
| Kayıp artıyor / NaN | Öğrenme oranı çok yüksek | lr ÷10, Adam kullan |
| Eğitim kaybı düşük, doğrulama yüksek | Overfitting (çok nöron, gürültülü veri) | nöron azalt, L2, early stopping, daha fazla veri |
| Sınır hep aynı, bazı nöronlar donuk | Ölü ReLU | tanh ya da Leaky ReLU, daha küçük lr |
| Her çalıştırmada farklı sonuç | Rastgele başlangıç | seed sabitle, birkaç kez çalıştır, en iyisini al |

:::realworld{company="Google"}
Bu dersteki playground, Google'ın 2016'da yayımladığı **TensorFlow Playground**'dan esinlenir; Google içinde ML'e yeni başlayan mühendislerin eğitiminde kullanılmış, sonra açık kaynak olmuştur. TensorFlow.js'in kendisi de Google'ın üretimde kullandığı bir araçtır: **Google Meet**'in arka plan bulanıklaştırma özelliği, MediaPipe segmentasyon modelini tarayıcıda WebGL/WASM üzerinde çalıştırır — video karesi hiç sunucuya gitmez, bu hem gizlilik hem de ölçek (milyonlarca eşzamanlı toplantı için sunucu GPU'su gerekmez) demektir. Aynı altyapı Teachable Machine'de kullanıcıların kendi görüntü sınıflandırıcılarını dakikalar içinde eğitmesini sağlar: büyük bir ön eğitimli ağın (MobileNet) son katmanı tarayıcıda yeniden eğitilir (transfer learning) — g-05'teki fine-tuning fikrinin cihaz üstü hâli.
:::

:::callout{tone="tip" title="Mülakat ipuçları ve kapanış"}
- "XOR'u neden tek katmanlı perceptron öğrenemez?" → XOR doğrusal ayrılamaz; gizli katman + doğrusal olmayan aktivasyon uzayı katlar.
- "Öğrenme oranını nasıl seçersin?" → logaritmik tarama (0.001–1), kayıp eğrisine bak, ısınma + azaltma programı, Adam ile başla.
- "Kayıp düşmüyor" sorusuna sistematik cevap: veri (etiketler doğru mu?), model (kapasite, aktivasyon), optimizasyon (lr, başlangıç), kod (gradyan akıyor mu — küçük bir batch'i ezberletebiliyor musun?).
- Bu modülün özeti: veriyi böl ve sızdırma (g-01) → doğru model ailesini seç (g-02) → ağı anla (g-03, g-04) → LLM'leri bağlamla besle (g-05) → üretime kapalı döngüyle taşı (g-06) → huni ve bütçeyle tasarla (g-07) → ve elinle dene (g-08).
:::

:::quiz{src="quiz.json"}
:::

---
id: g-03-neural-networks
slug: neural-networks
module: g-artificial-intelligence
order: 3
title:
  tr: "Sinir Ağları: Nöron, Aktivasyon, Forward/Backward Propagation"
  en: "Neural Networks: Neurons, Activations, Forward/Backward Propagation"
summary:
  tr: Adım adım ileri ve geri yayılım animasyonu, loss yüzeyi.
  en: Step-by-step forward and backward propagation, loss surface.
durationMinutes: 30
level: intermediate
tags: [neural-network, deep-learning, backpropagation, activation, gradient-descent]
prerequisites: [g-01-ml-foundations, g-02-classical-algorithms]
concepts: [neuron, activation-function, relu, sigmoid, forward-propagation, backpropagation, chain-rule, loss-surface, vanishing-gradient, learning-rate]
---

## Kavram: lojistik regresyonu üst üste dizmek

Önceki derste lojistik regresyon tek bir doğrusal sınır çizebiliyordu. Peki birkaç lojistik regresyonu yan yana koyup çıktılarını yeni bir lojistik regresyona beslersek? İşte **yapay sinir ağı** budur: katmanlar hâlinde dizilmiş, her biri "ağırlıklı toplam + doğrusal olmayan fonksiyon" yapan küçük birimler. Aradaki doğrusal olmayan adım kritiktir; o olmasa yüz katman bile tek bir matris çarpımına indirgenir.

### Tek nöron

Bir nöron `n` girdi alır ve iki şey yapar:

1. **Doğrusal toplam**: `z = w₁x₁ + w₂x₂ + … + wₙxₙ + b`
2. **Aktivasyon**: `a = φ(z)`

`w` ağırlıkları "hangi girdi ne kadar önemli", `b` sapması (bias) "eşik nerede" sorusunu cevaplar; `φ` doğrusal olmayan aktivasyon fonksiyonudur. Öğrenme, tüm `w` ve `b` değerlerini kaybı düşürecek yönde ayarlamaktan ibarettir.

:::diagram{src="diagram.svg" alt="Tek bir nöronun anatomisi (girdiler, ağırlıklar, toplam, aktivasyon) ve dört aktivasyon fonksiyonunun grafikleri: sigmoid, tanh, ReLU, GELU|Anatomy of a single neuron (inputs, weights, sum, activation) and plots of four activation functions: sigmoid, tanh, ReLU, GELU"}
Solda nöronun iki adımı, sağda yaygın aktivasyon fonksiyonları ve türevlerinin davranışı.
:::

## Aktivasyon fonksiyonları

| Fonksiyon | Formül | Çıktı aralığı | Artı | Eksi | Nerede? |
|---|---|---|---|---|---|
| **Sigmoid** | `1 / (1 + e⁻ᶻ)` | (0, 1) | Olasılık yorumu | Uçlarda türev ≈ 0 → *vanishing gradient*; çıktı merkezlenmemiş | İkili sınıf **çıkış** katmanı |
| **tanh** | `(eᶻ − e⁻ᶻ) / (eᶻ + e⁻ᶻ)` | (−1, 1) | Sıfır merkezli | Yine doyuma girer | RNN kapıları |
| **ReLU** | `max(0, z)` | [0, ∞) | Ucuz, doymaz, hızlı yakınsar | Negatif bölgede türev 0 → "ölü nöron" | CNN ve MLP gizli katmanları (varsayılan) |
| **Leaky ReLU** | `max(0.01z, z)` | (−∞, ∞) | Ölü nöron sorununu azaltır | Eğim hiperparametre | ReLU'nun alternatifi |
| **GELU** | `z · Φ(z)` (Φ: normal CDF) | ≈ (−0.17, ∞) | Pürüzsüz, ReLU'ya yakın; sıfır civarında yumuşak geçiş | Hesabı biraz pahalı | Transformer FFN katmanları (BERT, GPT) |
| **Softmax** | `eᶻⁱ / Σeᶻʲ` | Toplamı 1 | Çok sınıflı olasılık dağılımı | — | Çok sınıflı **çıkış** katmanı |

Kural: gizli katmanlarda ReLU (ya da Transformer'da GELU), çıkışta görevin gerektirdiği fonksiyon — regresyon için hiçbiri (doğrusal), ikili sınıf için sigmoid, çok sınıf için softmax.

## Forward propagation (ileri yayılım)

Girdi katmandan katmana akar; her katman bir matris çarpımı ve bir aktivasyondur: `a⁽ˡ⁾ = φ(W⁽ˡ⁾ a⁽ˡ⁻¹⁾ + b⁽ˡ⁾)`. Aşağıdaki animasyonda 2 girdili, 3 gizli nöronlu, 1 çıktılı (2-3-1) bir ağ tek bir örneği işler; kenar etiketleri ağırlıkları gösterir. Hesapları takip edin — h2'nin ReLU'da sıfırlandığına dikkat.

:::animation{scene="scene.json"}
İleri yayılım: x = (1.0, 0.5) girdisinden ŷ = 0.614 çıktısına ve L = 0.488 kaybına.
:::

Çıkışta bir **kayıp fonksiyonu** tahmini hedefle karşılaştırır: regresyonda MSE, ikili sınıfta binary cross-entropy `L = −[y·ln ŷ + (1−y)·ln(1−ŷ)]`, çok sınıfta categorical cross-entropy. Hedef `y = 1` iken `ŷ = 0.614` için kayıp `−ln 0.614 = 0.488`.

## Backpropagation (geri yayılım)

Soru: kaybı düşürmek için her ağırlığı hangi yöne, ne kadar oynatmalıyız? Cevap gradyan `∂L/∂w`'dir ve **zincir kuralı** ile çıkıştan girişe doğru hesaplanır. Üç temel formül yeter:

1. Çıkış hatası: sigmoid + BCE birleşiminde `δ_out = ŷ − y` (bu sadeleşme, bu ikilinin birlikte kullanılmasının nedenidir).
2. Ağırlık gradyanı: `∂L/∂w_ij = δ_j · a_i` — hedef nöronun hatası × kaynak nöronun aktivasyonu.
3. Hatanın geriye taşınması: `δ_i = φ'(z_i) · Σ_j w_ij δ_j` — bir nöronun hatası, ileriye gönderdiği ağırlıklarla tartılmış hataların toplamı çarpı kendi aktivasyon türevi.

İleri geçişteki tüm `z` ve `a` değerleri saklanır (bu yüzden eğitim, çıkarımdan çok daha fazla bellek ister). Gradyanlar bulununca her parametre `w ← w − η · ∂L/∂w` ile güncellenir.

:::animation{scene="backprop.scene.json"}
Geri yayılım: δ çıkıştan gizli katmana taşınır, ağırlık gradyanları hesaplanır, η = 0.1 ile güncelleme sonrası kayıp 0.488'den düşer. ReLU'da sıfırlanan h2'ye gradyan ulaşmaz.
:::

:::callout{tone="warning" title="Vanishing / exploding gradient"}
Zincir kuralı türevleri çarpar. Sigmoid türevi en fazla 0.25'tir; 10 katmanda `0.25¹⁰ ≈ 10⁻⁶` — ilk katmanlar hiç öğrenemez (*vanishing*). Büyük ağırlıklarla çarpım patlar (*exploding*). Çareler: ReLU, dikkatli başlangıç (He/Xavier), batch normalization, residual bağlantılar, gradient clipping. Derin ağların 2012 sonrası aniden çalışmaya başlamasının nedeni büyük ölçüde budur.
:::

## Loss yüzeyi ve optimizasyon

Milyonlarca parametresi olan bir ağın kayıp yüzeyi yüksek boyutlu, dışbükey olmayan bir arazidir: vadiler, eyer noktaları, düzlükler. Yine de SGD şaşırtıcı derecede iyi çalışır çünkü yüksek boyutta gerçek yerel minimumlar nadirdir; takılma noktaları çoğunlukla eyerlerdir ve mini-batch gürültüsü oradan kurtarır.

- **Öğrenme oranı** en önemli hiperparametredir: ısınma (warm-up) + kosinüs azaltma yaygın bir programdır.
- **Momentum** geçmiş gradyanları biriktirerek vadide zikzakı azaltır.
- **Adam** her parametre için adım boyunu gradyanın büyüklüğüne göre ölçekler; çoğu problemde iyi bir varsayılandır.
- **Batch boyutu** gürültü–hız dengesini kurar; çok büyük batch'ler keskin minimumlara düşüp daha kötü genelleyebilir.

:::interactive{type="gradient-descent" surface="valley" learningRate=0.03 optimizer="sgd"}
Dar vadi yüzeyinde düz SGD ile başlayın: dik eksende zikzak çizip sığ eksende sürünüyor mu, kaç iterasyonda yakınsıyor? Optimizer'ı Momentum'a çevirin: aynı başlangıçtan yaklaşık yarı sürede iner, çünkü sığ eksende hız biriktirir. Adam'ı seçin: ilk birkaç yüz iterasyonda çukura iner ama dipte uzun süre küçük adımlarla titrer — adım boyu gradyanın anlık büyüklüğüne değil geçmişine göre ölçeklenir. (Lineer regresyonun kaybı dışbükeydir, eyer noktası yoktur; eyerler ve yerel minimumlar derin ağların yüzeyinde ortaya çıkar — ama vadideki bu fark orada da aynen geçerlidir.) Öğrenme oranını 0.5'e çıkarıp SGD ve Momentum'un ıraksadığını, Adam'ın ise normalize adımı sayesinde ayakta kaldığını gözlemleyin.
:::

:::code{lang="ts" title="Saf TypeScript ile mini MLP (2-3-1): forward, backward, SGD"}
```ts
const relu = (z: number) => Math.max(0, z);
const reluPrime = (z: number) => (z > 0 ? 1 : 0);
const sigmoid = (z: number) => 1 / (1 + Math.exp(-z));

export class MiniMLP {
  // Katman 1: 3 gizli nöron × 2 girdi; Katman 2: 1 çıktı × 3 gizli
  W1 = [[0.5, -0.3], [-0.8, 0.6], [0.2, 0.9]];
  b1 = [0.1, 0.0, -0.2];
  W2 = [1.0, -0.5, 0.7];
  b2 = -0.3;

  /** İleri geçiş: ara değerleri (z, a) geri yayılım için sakla */
  forward(x: number[]) {
    const z1 = this.W1.map((row, j) => row[0] * x[0] + row[1] * x[1] + this.b1[j]);
    const a1 = z1.map(relu);
    const z2 = a1.reduce((s, a, j) => s + a * this.W2[j], this.b2);
    const yHat = sigmoid(z2);
    return { z1, a1, z2, yHat };
  }

  /** Binary cross-entropy */
  loss(yHat: number, y: number) {
    const eps = 1e-9;
    return -(y * Math.log(yHat + eps) + (1 - y) * Math.log(1 - yHat + eps));
  }

  /** Geri yayılım + tek SGD adımı; kaybı döner */
  trainStep(x: number[], y: number, lr = 0.1) {
    const { z1, a1, yHat } = this.forward(x);
    const dOut = yHat - y;                                   // sigmoid+BCE sadeleşmesi: δ_out = ŷ − y
    const gW2 = a1.map((a) => dOut * a);                     // ∂L/∂W2_j = δ_out · a1_j
    const gb2 = dOut;
    const dHidden = this.W2.map((w, j) => dOut * w * reluPrime(z1[j])); // δ_j = δ_out·w_j·φ'(z_j)
    const gW1 = dHidden.map((d) => [d * x[0], d * x[1]]);    // ∂L/∂W1_jk = δ_j · x_k
    const gb1 = dHidden;

    // Parametre güncellemesi: gradyanın tersine küçük adım
    this.W2 = this.W2.map((w, j) => w - lr * gW2[j]);
    this.b2 -= lr * gb2;
    this.W1 = this.W1.map((row, j) => row.map((w, k) => w - lr * gW1[j][k]));
    this.b1 = this.b1.map((b, j) => b - lr * gb1[j]);
    return this.loss(yHat, y);
  }
}

// XOR'u öğrenmek: 4 örnek, birkaç bin epoch
const net = new MiniMLP();
const data: [number[], number][] = [[[0, 0], 0], [[0, 1], 1], [[1, 0], 1], [[1, 1], 0]];
for (let epoch = 0; epoch < 5000; epoch++) {
  for (const [x, y] of data) net.trainStep(x, y, 0.1);
}
console.log(data.map(([x]) => net.forward(x).yHat.toFixed(2))); // ≈ ["0.0x", "0.9x", "0.9x", "0.0x"]
```
```python
import numpy as np

relu = lambda z: np.maximum(0, z)
relu_prime = lambda z: (z > 0).astype(float)
sigmoid = lambda z: 1 / (1 + np.exp(-z))

W1 = np.array([[0.5, -0.3], [-0.8, 0.6], [0.2, 0.9]]); b1 = np.array([0.1, 0.0, -0.2])
W2 = np.array([1.0, -0.5, 0.7]); b2 = -0.3

def train_step(x, y, lr=0.1):
    global W1, b1, W2, b2
    z1 = W1 @ x + b1; a1 = relu(z1)            # ileri
    y_hat = sigmoid(W2 @ a1 + b2)
    d_out = y_hat - y                          # geri: δ_out = ŷ − y
    gW2, gb2 = d_out * a1, d_out
    d_hid = d_out * W2 * relu_prime(z1)        # δ_h = δ_out · W2 · φ'(z1)
    gW1, gb1 = np.outer(d_hid, x), d_hid
    W2 -= lr * gW2; b2 -= lr * gb2; W1 -= lr * gW1; b1 -= lr * gb1
    return -(y * np.log(y_hat) + (1 - y) * np.log(1 - y_hat))
```
:::

## Eğitim döngüsünün iskeleti

Her çerçeve (PyTorch, TensorFlow, JAX) aynı beş satırı sarmalar: **forward → loss → backward → update → zero_grad**. Otomatik türev (autograd) hesaplama grafiğini kaydeder ve geri geçişi sizin yerinize yazar; yukarıdaki elle türetilmiş formüller tam olarak bu grafın yaptığı iştir. Bir mülakatta "PyTorch `loss.backward()` ne yapar?" sorusunun cevabı bu derstir.

:::realworld{company="Google"}
Google'ın 2012'deki ünlü "kedi tanıyan ağ" deneyi, 16 000 CPU çekirdeğinde dokuz katmanlı bir ağı YouTube karelerinden etiketsiz eğitti ve derin ağların ölçekle öğrendiğini gösterdi. Ancak asıl kırılma aynı yıl ImageNet'te oldu: ReLU aktivasyonu, dropout ve GPU'lar sayesinde AlexNet hata oranını %26'dan %16'ya indirdi. ReLU'nun seçilmesi tesadüf değildi — sigmoid/tanh ile sekiz katmanlı bir ağın gradyanları ilk katmanlara ulaşmıyordu. Google bugün TPU kümelerinde aynı forward/backward döngüsünü binlerce çipe dağıtır; ara aktivasyonları saklamanın bellek maliyeti o kadar büyüktür ki *activation checkpointing* ile bazıları geri geçişte yeniden hesaplanır — hesaplama ile belleğin takası.
:::

:::callout{tone="tip" title="Mülakat ipuçları"}
- "Aktivasyon neden gerekli?" → doğrusal katmanların bileşimi doğrusaldır; ağ XOR'u bile öğrenemez.
- "Backprop ile gradient descent farkı?" → backprop gradyanı **hesaplar**, gradient descent gradyanla parametreyi **günceller**.
- "ReLU neden sigmoid'den iyi?" → doymaz (türev 1), ucuz, seyreklik yaratır; dezavantajı ölü nöronlar.
- Sigmoid + BCE'de `δ = ŷ − y` sadeleşmesini türetebilmek güçlü bir sinyaldir.
:::

:::quiz{src="quiz.json"}
:::

:::next{lesson="g-04-deep-learning-architectures"}
Sırada: aynı nöronları farklı biçimde bağlayınca ne olur? CNN, RNN/LSTM, Transformer, GAN ve diffusion mimarileri.
:::

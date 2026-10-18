---
id: g-04-deep-learning-architectures
slug: deep-learning-architectures
module: g-artificial-intelligence
order: 4
title:
  tr: "Derin Öğrenme Mimarileri: CNN, RNN/LSTM, Transformer, GAN, Diffusion"
  en: "Deep Learning Architectures: CNN, RNN/LSTM, Transformer, GAN, Diffusion"
summary:
  tr: Konvolüsyon filtresi ve self-attention görselleştirmesi.
  en: Convolution filter and self-attention visualization.
durationMinutes: 35
level: advanced
tags: [deep-learning, cnn, rnn, lstm, transformer, attention, gan, diffusion]
prerequisites: [g-03-neural-networks]
concepts: [convolution, pooling, receptive-field, rnn, lstm, self-attention, transformer, positional-encoding, residual-connection, gan, diffusion-model]
---

## Kavram: mimari = veriye uygun önsel bilgi

Önceki derste her nöronun her nörona bağlandığı tam bağlı (fully connected) ağı gördük. Bu ağ her şeyi öğrenebilir ama hiçbir şeyi verimli öğrenmez: 224×224 renkli bir görüntü 150 000 girdidir; tek bir gizli katman milyarlarca ağırlık ister ve "kedi sol üstte de sağ altta da kedidir" bilgisini sıfırdan keşfetmek zorundadır. **Mimari**, verinin yapısı hakkında bildiklerimizi ağa önceden gömmektir (inductive bias):

| Veri | Yapısal bilgi | Mimari |
|---|---|---|
| Görüntü | Yerel örüntüler, konumdan bağımsızlık | **CNN** |
| Sıralı veri (metin, ses, zaman serisi) | Sıra önemli, uzunluk değişken | **RNN / LSTM** |
| Uzun bağlam, paralel işleme | Her öğe diğer her öğeyle ilişkili olabilir | **Transformer** |
| Üretim (görüntü, ses) | Veri dağılımından örnekleme | **GAN, Diffusion** |

:::diagram{src="diagram.svg" alt="Beş mimarinin özet çizimi: CNN filtresi ve öznitelik haritası, zaman içinde açılmış RNN/LSTM hücreleri, Transformer bloğu (attention ve FFN), GAN üretici-ayırt edici ikilisi ve diffusion gürültü giderme zinciri|Summary sketches of five architectures: CNN filter and feature map, RNN/LSTM cells unrolled in time, a Transformer block (attention and FFN), the GAN generator-discriminator pair and the diffusion denoising chain"}
Her mimari aynı yapı taşlarından (ağırlıklı toplam + aktivasyon) kurulur; farkı bağlantı deseni yaratır.
:::

## CNN: konvolüsyon ve pooling

**Konvolüsyon** küçük bir filtreyi (örn. 3×3 ağırlık matrisi) görüntü üzerinde kaydırır ve her konumda nokta çarpımı alır. Sonuç bir **öznitelik haritasıdır** (feature map): filtre kenar arıyorsa kenarların olduğu yerler parlar. Üç önemli fikir:

- **Ağırlık paylaşımı**: aynı 9 ağırlık tüm görüntüde kullanılır → parametre sayısı girdi boyutundan bağımsız.
- **Yerellik**: her çıktı yalnızca küçük bir komşuluğa bakar; derinleştikçe **alıcı alan** (receptive field) büyür ve katmanlar kenar → doku → parça → nesne hiyerarşisi öğrenir.
- **Pooling** (max/average): haritayı küçültür, küçük kaymalara dayanıklılık sağlar, hesabı azaltır.

Tipik blok: `Conv → BatchNorm → ReLU → (Pool)`. ResNet'in katkısı **residual bağlantı** (`y = F(x) + x`): gradyan kısa yoldan geriye akar, 100+ katman eğitilebilir hâle gelir. Bu fikir Transformer'a da miras kalmıştır.

:::interactive{type="convolution" kernel="sobel-x" size=3 stride=1 padding="same"}
Sobel-x filtresini dikey kenarlı bir görüntüde kaydırın, sonra sobel-y'ye geçin. Kernel'i elle düzenleyip "bulanıklaştırma" (tüm hücreler 1/9) ve "keskinleştirme" filtrelerini deneyin; stride=2 ile çıktı boyutunun nasıl yarılandığını izleyin.
:::

## RNN ve LSTM: sırayı hatırlamak

**RNN** her adımda aynı hücreyi çalıştırır: `h_t = tanh(W_x x_t + W_h h_{t−1} + b)`. Gizli durum `h_t` geçmişin özetidir; ağırlıklar zaman boyunca paylaşılır, bu yüzden değişken uzunlukta diziler işlenebilir. Sorun: geri yayılım zaman boyunca açılır (BPTT) ve aynı `W_h` yüzlerce kez çarpılır → gradyan söner ya da patlar; uzun bağımlılıklar (cümlenin başındaki özne, sonundaki fiil) öğrenilemez.

**LSTM** buna bir **hücre durumu** (cell state, `c_t`) ve üç kapı ekler:

| Kapı | Soru | Formül |
|---|---|---|
| Forget | Eski bilgiden ne silinsin? | `f_t = σ(W_f·[h_{t−1}, x_t])` |
| Input | Yeni bilgiden ne yazılsın? | `i_t = σ(W_i·[h_{t−1}, x_t])`, `c̃_t = tanh(W_c·[h_{t−1}, x_t])` |
| Output | Durumdan ne okunsun? | `o_t = σ(W_o·[h_{t−1}, x_t])` |

`c_t = f_t ⊙ c_{t−1} + i_t ⊙ c̃_t` — toplama ile güncellenen hücre durumu, gradyanın çarpılmadan geçebileceği bir "otoyol"dur. GRU aynı fikrin iki kapılı, hafif sürümüdür. RNN'ler ardışık çalıştığı için GPU'da paralelleşmez; bu zayıflık Transformer'ın doğuşunun ana nedenidir.

## Transformer: self-attention

"Attention Is All You Need" (2017) tekrarlamayı tamamen attı. Fikir: her token, dizideki **tüm** tokenlara bakıp hangilerinin kendisi için önemli olduğuna karar versin — ve bu, tüm tokenlar için aynı anda (paralel) hesaplansın.

Her token vektöründen üç izdüşüm üretilir: **Query** (ne arıyorum?), **Key** (bende ne var?), **Value** (ne taşıyorum?). Skor `QKᵀ/√d_k`, softmax ile ağırlığa çevrilir, Value'lar bu ağırlıklarla toplanır:

```
Attention(Q, K, V) = softmax(QKᵀ / √d_k) · V
```

- **Multi-head**: aynı işlem 8–96 farklı izdüşümle paralel yapılır; bir kafa sözdizimini, diğeri eşgönderimi (coreference) yakalar.
- **Positional encoding**: attention sıraya duyarsızdır; konum bilgisi gömme vektörüne eklenir (sinüs tabloları ya da RoPE).
- **Blok**: `x + Attention(LN(x))` ardından `x + FFN(LN(x))`. FFN, GELU'lu iki katmanlı bir MLP'dir ve modelin "bilgisinin" çoğu buradadır.
- **Maske**: GPT tarzı decoder'da token yalnızca kendinden öncekilere bakar (causal mask); BERT tarzı encoder her iki yöne bakar.
- **Maliyet**: dizi uzunluğu `n` için `O(n²)` bellek ve hesap — uzun bağlam araştırmalarının (FlashAttention, sparse attention) nedeni.

:::animation{scene="scene.json"}
Bir Transformer bloğunda "The cat sat" tokenlarının akışı: gömme + konum → Q/K/V → attention ağırlıkları ("sat" en çok "cat"e bakar) → residual + norm → FFN → bir sonraki token tahmini.
:::

:::interactive{type="attention" sentence="The cat sat on the mat because it was tired" heads=2 causal=false}
"it" tokenını seçin: hangi kelimeye en çok ağırlık veriyor? Causal maskeyi açıp "it"in artık yalnızca sola bakabildiğini görün. İkinci kafanın farklı bir örüntü yakalayıp yakalamadığını karşılaştırın.
:::

:::callout{tone="info" title="Neden Transformer kazandı?"}
Üç nedenle: (1) tüm dizi paralel işlenir, GPU/TPU'yu doldurur; (2) herhangi iki token arasındaki yol uzunluğu 1'dir, uzun bağımlılık sorunu yoktur; (3) ölçekleme yasaları — veri, parametre ve hesap arttıkça kayıp öngörülebilir biçimde düşer. Aynı blok metin (GPT), görüntü (ViT: görüntüyü 16×16 yamalara böl, token say), ses (Whisper) ve protein (AlphaFold) için çalışır.
:::

## GAN: iki ağın oyunu

**Generative Adversarial Network**'te iki ağ yarışır: **üretici** (generator) rastgele gürültüden sahte örnek üretir, **ayırt edici** (discriminator) gerçek mi sahte mi diye sınıflandırır. Üretici ayırt ediciyi kandırmaya, ayırt edici yakalamaya çalışır; denge noktasında üretilen örnekler gerçek dağılımdan ayırt edilemez. Keskin, gerçekçi görüntüler üretir (StyleGAN) ama eğitimi kararsızdır: **mode collapse** (üretici hep aynı birkaç örneği üretir) ve salınım yaygındır.

## Diffusion: gürültüyü geri almak

**Diffusion modelleri** iki süreç tanımlar. İleri süreç bir görüntüye `T` adımda kademeli Gauss gürültüsü ekler, sonunda saf gürültü kalır. Model, **ters süreci** öğrenir: verilen gürültülü görüntüden eklenen gürültüyü tahmin eden bir ağ (genelde U-Net ya da Transformer). Üretim sırasında saf gürültüden başlanır ve ağ `T` kez çağrılarak gürültü adım adım temizlenir. Metin koşullandırması (Stable Diffusion, DALL·E, Imagen) attention ile metin gömmelerini U-Net'e enjekte eder. GAN'a göre eğitimi kararlı ve çeşitliliği yüksektir; bedeli, üretimin onlarca ileri geçiş gerektirmesidir (latent diffusion ve distillation bunu azaltır).

## Mimari karşılaştırması

| | CNN | LSTM | Transformer | GAN | Diffusion |
|---|---|---|---|---|---|
| Temel işlem | Konvolüsyon | Kapılı tekrarlama | Self-attention | İki ağ, min-max oyunu | Gürültü tahmini |
| Paralellik | Yüksek | Düşük (ardışık) | Yüksek | Yüksek | Üretimde ardışık |
| Uzun bağımlılık | Alıcı alanla sınırlı | Zor | Doğrudan | — | — |
| Tipik görev | Görüntü sınıflandırma, tespit | Zaman serisi, eski NLP | LLM, ViT, ses | Görüntü sentezi, süper çözünürlük | Metinden görüntü/video/ses |
| Zayıf yan | Küresel bağlam | Ölçeklenmez | O(n²) | Kararsız eğitim | Yavaş örnekleme |

:::code{lang="ts" title="2B konvolüsyon ve scaled dot-product attention (saf TS)"}
```ts
/** Tek kanallı 2B konvolüsyon ("valid" padding, stride 1). */
export function conv2d(image: number[][], kernel: number[][]): number[][] {
  const k = kernel.length;
  const out: number[][] = [];
  for (let i = 0; i + k <= image.length; i++) {
    const row: number[] = [];
    for (let j = 0; j + k <= image[0].length; j++) {
      let sum = 0;
      for (let a = 0; a < k; a++)
        for (let b = 0; b < k; b++) sum += image[i + a][j + b] * kernel[a][b]; // pencere · filtre
      row.push(sum);
    }
    out.push(row);
  }
  return out;
}

export const SOBEL_X = [[-1, 0, 1], [-2, 0, 2], [-1, 0, 1]]; // dikey kenarları bulur

function softmax(xs: number[]): number[] {
  const m = Math.max(...xs);                       // sayısal kararlılık için en büyüğü çıkar
  const exps = xs.map((x) => Math.exp(x - m));
  const s = exps.reduce((a, b) => a + b, 0);
  return exps.map((e) => e / s);
}

/** Tek kafalı self-attention: Q, K, V (n × d) → çıktı (n × d) ve ağırlık matrisi. */
export function attention(Q: number[][], K: number[][], V: number[][], causal = false) {
  const n = Q.length, d = Q[0].length;
  const scale = 1 / Math.sqrt(d);
  const weights = Q.map((q, i) => {
    const scores = K.map((k, j) =>
      causal && j > i ? -Infinity : q.reduce((s, qi, t) => s + qi * k[t], 0) * scale); // q·k/√d
    return softmax(scores);
  });
  const out = weights.map((w) =>
    V[0].map((_, t) => w.reduce((s, wj, j) => s + wj * V[j][t], 0)));                    // Σ wⱼ·vⱼ
  return { out, weights };
}

// Multi-head: X'i h farklı (Wq, Wk, Wv) ile izdüşür, her kafayı attention'dan geçir, birleştir, Wo uygula.
```
```python
import torch, torch.nn as nn, torch.nn.functional as F

class TransformerBlock(nn.Module):
    def __init__(self, d_model=512, n_heads=8, d_ff=2048, dropout=0.1):
        super().__init__()
        self.ln1 = nn.LayerNorm(d_model)
        self.attn = nn.MultiheadAttention(d_model, n_heads, dropout=dropout, batch_first=True)
        self.ln2 = nn.LayerNorm(d_model)
        self.ffn = nn.Sequential(nn.Linear(d_model, d_ff), nn.GELU(), nn.Linear(d_ff, d_model))

    def forward(self, x, causal_mask=None):
        h = self.ln1(x)                                   # pre-norm
        x = x + self.attn(h, h, h, attn_mask=causal_mask)[0]  # residual 1
        x = x + self.ffn(self.ln2(x))                     # residual 2
        return x
```
:::

:::realworld{company="Google"}
Transformer, Google'da makine çevirisi için icat edildi ve ilk büyük üretim etkisi 2019'da **BERT**'in Google Search'e girmesi oldu: "2019 brazil traveler to usa need a visa" sorgusunda "to" kelimesinin yönünü anlayabilen ilk sıralama modeliydi; Google bunu "son beş yılın en büyük arama ilerlemesi" diye duyurdu. BERT'i her sorguda çalıştırmak pahalıdır, bu yüzden Google arama için özel **TPU** çipleri kullandı ve modeli yalnızca sorguların ~%10'unda, uzun ve bağlam gerektiren olanlarda devreye aldı. Aynı mimari ailesi bugün YouTube önerilerinde (sıralı izleme geçmişini bir "cümle" gibi işleyen Transformer), Google Photos'ta (ViT) ve Gemini'de kullanılır. CNN'ler ise kaybolmadı: cihaz üstü (Pixel kamera) modellerde düşük gecikme için hâlâ MobileNet tarzı konvolüsyon ağları çalışır.
:::

:::callout{tone="tip" title="Mülakat ipuçları"}
- "CNN neden görüntüde iyi?" → ağırlık paylaşımı + yerellik + hiyerarşik alıcı alan; parametre sayısı görüntü boyutundan bağımsız.
- "LSTM gradyan sorununu nasıl çözer?" → toplama ile güncellenen hücre durumu; forget kapısı 1'e yakınken gradyan çarpılmadan akar.
- "Attention'da neden √d_k ile bölüyoruz?" → büyük boyutta nokta çarpımın varyansı büyür, softmax doyar, gradyan söner.
- "Transformer'ın darboğazı?" → O(n²) attention; KV-cache, FlashAttention, sliding window çözüm ailesi.
- GAN vs diffusion: kalite/çeşitlilik/kararlılık üçgeninde diffusion kararlı ve çeşitli, GAN hızlı.
:::

:::quiz{src="quiz.json"}
:::

:::next{lesson="g-05-llms"}
Sırada: Transformer bloğunu milyarlarca parametreye ölçekleyince ne olur? Tokenization, embedding, pretraining/fine-tuning, RAG ve agent'lar.
:::

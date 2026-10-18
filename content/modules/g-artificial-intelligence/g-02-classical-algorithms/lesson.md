---
id: g-02-classical-algorithms
slug: classical-algorithms
module: g-artificial-intelligence
order: 2
title:
  tr: "Klasik Algoritmalar: Regresyon, Ağaçlar, SVM, k-means, PCA"
  en: "Classical Algorithms: Regression, Trees, SVM, k-means, PCA"
summary:
  tr: İnteraktif gradient descent ve nokta bulutu görselleştirmeleri.
  en: Interactive gradient descent and point-cloud visualizations.
durationMinutes: 30
level: intermediate
tags: [machine-learning, regression, decision-tree, random-forest, svm, k-means, pca]
prerequisites: [g-01-ml-foundations]
concepts: [linear-regression, logistic-regression, decision-tree, random-forest, svm, k-means, pca, gradient-descent, feature-scaling]
---

## Kavram: derin öğrenmeden önce "klasik" araç kutusu

Tablo hâlindeki veride (müşteri kayıtları, işlem logları, sensör ölçümleri) kazananlar hâlâ çoğunlukla klasik algoritmalardır: hızlı eğitilir, az veriyle çalışır, açıklanabilir ve CPU'da milisaniyede tahmin üretir. Bu derste altı algoritmayı aynı kalıpla ele alacağız: **ne öğrenir, kaybı nasıl düşürür, ne zaman seçilir**.

:::diagram{src="diagram.svg" alt="Altı klasik algoritmanın özet haritası: doğrusal ve lojistik regresyon, karar ağacı, random forest, SVM, k-means ve PCA; her biri için mini çizim ve kullanım alanı|Summary map of six classical algorithms: linear and logistic regression, decision tree, random forest, SVM, k-means and PCA, each with a mini sketch and typical use"}
Üstte gözetimli, altta gözetimsiz yöntemler. Sağ sütun doğrusal olmayan sınırları nasıl ele aldıklarını gösterir.
:::

## Doğrusal regresyon (linear regression)

Hedef sürekli bir sayı (ev fiyatı, teslimat süresi). Model ağırlıklı toplamdır: `ŷ = w·x + b`. Kayıp **ortalama kare hata** (MSE). Küçük veri için kapalı form çözüm vardır (`w = (XᵀX)⁻¹Xᵀy`), büyük veri için gradient descent kullanılır. Özellikler farklı ölçeklerdeyse (metrekare 50–300, oda sayısı 1–5) kayıp yüzeyi uzun bir vadi olur ve gradient descent zikzak çizer; bu yüzden **standardizasyon** (ortalama 0, std 1) neredeyse zorunludur.

:::interactive{type="gradient-descent" learningRate=0.05 surface="valley" showContours=true}
"Vadi" yüzeyi ölçeklenmemiş iki özelliğin kayıp yüzeyini taklit eder. Öğrenme oranını artırınca neden bir eksende ıraksarken diğerinde sürünüyor? Özellikleri "standardize et" seçeneğiyle yüzeyin çanağa dönüşmesini izleyin.
:::

## Lojistik regresyon (logistic regression)

Adı regresyon ama işi **sınıflandırma**. Doğrusal skoru sigmoid'den geçirir: `p = σ(w·x + b) = 1 / (1 + e^{−z})`, çıktı 0–1 arası olasılıktır. Kayıp **log-loss (binary cross-entropy)**; MSE kullanılsaydı kayıp dışbükey olmaz ve gradient descent takılırdı. Karar sınırı doğrusaldır (bir hiperdüzlem). Ağırlıklar yorumlanabilir: `w_i` bir birim artınca log-odds `w_i` kadar değişir. Fraud ve tıklama tahmini gibi alanlarda hâlâ güçlü bir temel (baseline) modeldir; özellik mühendisliği ile çok ileri gidebilir.

## Karar ağacı (decision tree)

Veriyi "yaş < 30?", "tutar > 500?" gibi eşik sorularıyla art arda böler. Her bölmede **safsızlığı** (Gini ya da entropi) en çok düşüren özellik/eşik çifti seçilir — açgözlü (greedy) bir arama. Yaprağa düşen örneklerin çoğunluk sınıfı tahmindir.

- Artıları: ölçeklemeye duyarsız, kategorik veriyle rahat, insan tarafından okunabilir.
- Eksileri: derinleştikçe **yüksek varyans** — veri biraz değişince ağaç bambaşka olur, overfitting kolay. Çare: `max_depth`, `min_samples_leaf` ile budama.

:::interactive{type="decision-tree" maxDepth=3 criterion="gini" dataset="moons"}
Derinliği 1'den 10'a çıkarın: eğitim doğruluğu %100'e yaklaşırken doğrulama doğruluğu nerede tepe yapıyor? `min_samples_leaf` değerini artırıp sınırın nasıl yumuşadığını gözlemleyin.
:::

## Random forest ve gradient boosting

Tek ağacın varyansını düşürmenin yolu çok ağaç eğitip ortalamaktır. **Random forest** iki rastgelelik ekler: her ağaç verinin önyüklemeli (bootstrap) bir örneğiyle eğitilir ve her bölmede özelliklerin rastgele bir alt kümesine bakılır. Ağaçlar birbirinden farklılaşır; çoğunluk oyu gürültüyü süzer. Hemen hemen hiç ayar gerektirmeden güçlü sonuç verir.

**Gradient boosting** (XGBoost, LightGBM, CatBoost) ise ağaçları sırayla ekler: her yeni ağaç öncekilerin **artık hatasını** (residual) öğrenir. Tablo verisinde Kaggle yarışmalarının ve üretim sistemlerinin (arama sıralama, fraud) hâlâ varsayılan tercihidir; daha fazla ayar ister ama genelde random forest'ı geçer.

## SVM (support vector machine)

İki sınıfı ayıran **en geniş marjlı** hiperdüzlemi arar; sınıra en yakın noktalar (destek vektörleri) sınırı belirler, geri kalan veri sonucu değiştirmez. Doğrusal ayrılamayan veri için **kernel hilesi**: veriyi açıkça yüksek boyuta taşımadan, iç çarpımı bir kernel fonksiyonuyla (RBF, polinom) değiştirir ve doğrusal olmayan sınırlar elde eder. `C` parametresi marj genişliği ile hata toleransı arasındaki dengeyi kurar. Orta boy, yüksek boyutlu veride (metin TF-IDF vektörleri) güçlüdür; milyonlarca örnekte eğitim maliyeti (O(n²)) sorun olur.

## k-means (kümeleme)

Etiket yok; veriyi `k` gruba ayırmak istiyoruz. Lloyd algoritması iki adımı yineler:

1. **Atama**: her nokta en yakın merkeze (centroid) atanır.
2. **Güncelleme**: her merkez, kendisine atanan noktaların ortalamasına taşınır.

Atamalar değişmeyince durur. Her yineleme küme içi kare toplamını (inertia) azaltır, ama sonuç **başlangıca bağlıdır** — bu yüzden `k-means++` merkezleri birbirinden uzak seçer ve algoritma birkaç kez çalıştırılıp en iyi inertia alınır. `k` bilinmiyorsa **elbow** (dirsek) grafiği ya da silhouette skoru kullanılır.

:::animation{scene="scene.json"}
Kötü bir başlangıçtan iki yinelemede yakınsayan k-means: önce atama, sonra merkezlerin ortalamaya taşınması; p4 ikinci turda küme değiştirir.
:::

:::interactive{type="k-means" k=3 init="random" dataset="blobs"}
Önce `init="random"` ile birkaç kez çalıştırıp farklı sonuçlar aldığınızı görün; sonra k-means++ seçin. k'yı 2'den 8'e çıkarıp inertia eğrisindeki dirseği bulun.
:::

:::callout{tone="warning" title="k-means'in gizli varsayımları"}
k-means küresel, benzer boyutta ve benzer yoğunlukta kümeler varsayar. Hilal şeklindeki ya da iç içe halka kümelerde başarısız olur — orada DBSCAN ya da spektral kümeleme gerekir. Ayrıca ölçekleme kritiktir: "gelir" sütunu 0–100 000, "yaş" 0–100 ise uzaklığı tamamen gelir belirler.
:::

## PCA (principal component analysis)

Boyut indirgeme: 100 özellikli veriyi, varyansın çoğunu koruyan 10 yeni eksene (bileşen) izdüşürür. Bileşenler kovaryans matrisinin özvektörleridir; ilk bileşen verinin en çok yayıldığı yön, ikincisi ona dik ve kalan varyansın en büyüğü... Kullanım: görselleştirme (2B'ye indir), gürültü azaltma, çoklu doğrusallığı kırma, eğitimi hızlandırma. PCA **gözetimsizdir**: etiketi görmez, bu yüzden sınıflar için önemli ama düşük varyanslı bir yönü atabilir.

## Hangi algoritma ne zaman?

| Durum | İlk deneyecekleriniz |
|---|---|
| Sürekli hedef, az özellik, yorum gerekli | Doğrusal regresyon (+ L1/L2) |
| İkili sınıf, güçlü baseline, olasılık gerekli | Lojistik regresyon |
| Tablo verisi, en yüksek doğruluk | Gradient boosting, random forest |
| Küçük/orta veri, yüksek boyut, net marj | SVM (RBF) |
| Etiket yok, segment arıyorum | k-means (→ DBSCAN) |
| Çok özellik, görselleştirme/hızlandırma | PCA |
| Görüntü, ses, serbest metin | Sinir ağları (sonraki dersler) |

:::code{lang="ts" title="k-means (Lloyd) — sklearn benzeri fit/predict arayüzü"}
```ts
type Point = number[];

export class KMeans {
  centroids: Point[] = [];
  inertia = 0;

  constructor(private k: number, private maxIter = 100, private tol = 1e-4) {}

  /** k-means++ başlangıcı: her yeni merkez, mevcut merkezlere uzak noktalardan seçilir */
  private initPlusPlus(X: Point[]): Point[] {
    const centroids = [X[Math.floor(Math.random() * X.length)]];
    while (centroids.length < this.k) {
      const d2 = X.map((p) => Math.min(...centroids.map((c) => sqDist(p, c))));
      const total = d2.reduce((a, b) => a + b, 0);
      let r = Math.random() * total;
      for (let i = 0; i < X.length; i++) {
        r -= d2[i];
        if (r <= 0) { centroids.push(X[i]); break; }
      }
    }
    return centroids;
  }

  fit(X: Point[]): this {
    this.centroids = this.initPlusPlus(X);
    for (let iter = 0; iter < this.maxIter; iter++) {
      const labels = this.predict(X);                       // 1) atama adımı
      const next = this.centroids.map((c, j) => {           // 2) güncelleme adımı
        const members = X.filter((_, i) => labels[i] === j);
        if (members.length === 0) return c;                 // boş küme: merkezi koru
        return c.map((_, dim) => members.reduce((s, p) => s + p[dim], 0) / members.length);
      });
      const shift = Math.max(...next.map((c, j) => sqDist(c, this.centroids[j])));
      this.centroids = next;
      if (shift < this.tol) break;                          // merkezler oynamıyorsa dur
    }
    const labels = this.predict(X);
    this.inertia = X.reduce((s, p, i) => s + sqDist(p, this.centroids[labels[i]]), 0);
    return this;
  }

  predict(X: Point[]): number[] {
    return X.map((p) => {
      let best = 0;
      for (let j = 1; j < this.centroids.length; j++) {
        if (sqDist(p, this.centroids[j]) < sqDist(p, this.centroids[best])) best = j;
      }
      return best;
    });
  }
}

function sqDist(a: Point, b: Point) {
  return a.reduce((s, ai, i) => s + (ai - b[i]) ** 2, 0);
}

// Elbow: k=1..8 için inertia'yı çiz, kırılma noktasını seç
// const curve = [1,2,3,4,5,6,7,8].map((k) => new KMeans(k).fit(X).inertia);
```
```python
from sklearn.pipeline import make_pipeline
from sklearn.preprocessing import StandardScaler
from sklearn.cluster import KMeans
from sklearn.decomposition import PCA
from sklearn.ensemble import RandomForestClassifier
from sklearn.linear_model import LogisticRegression

# Kümeleme: ölçekle → k-means++ (n_init ile birden çok başlangıç)
clusterer = make_pipeline(StandardScaler(), KMeans(n_clusters=3, init="k-means++", n_init=10))
labels = clusterer.fit_predict(X)

# Gözetimli: baseline lojistik regresyon vs. random forest
baseline = make_pipeline(StandardScaler(), LogisticRegression(C=1.0)).fit(X_train, y_train)
forest = RandomForestClassifier(n_estimators=300, max_depth=None, min_samples_leaf=2).fit(X_train, y_train)

# Görselleştirme için 2 bileşene indir (açıklanan varyansa bak)
pca = PCA(n_components=2).fit(StandardScaler().fit_transform(X))
print(pca.explained_variance_ratio_)
```
:::

:::realworld{company="Stripe"}
Stripe Radar'ın ilk sürümleri fraud skorlamasını lojistik regresyon ve gradient boosting ağaçlarıyla yapıyordu; yüzlerce elle tasarlanmış özellik (kart ülkesi ile IP ülkesi uyuşmazlığı, son 1 saatteki deneme sayısı, cihaz parmak izi) bu modellere besleniyordu. Ağaç tabanlı modeller tercih edilmişti çünkü ölçekleme gerektirmez, eksik değerlerle baş eder ve her kararın "hangi özellik yüzünden" verildiği açıklanabilir — kart sahibine ya da düzenleyiciye gerekçe sunabilmek gerekir. Stripe daha sonra derin ağlara geçtiğinde bile klasik modeller düşük gecikmeli bir **baseline** ve karşılaştırma ölçütü olarak kaldı. Benzer biçimde, tablo verisinde yeni bir derin model önerildiğinde ilk soru hâlâ "boosting'i geçiyor mu?" olur.
:::

:::callout{tone="tip" title="Mülakat ipuçları"}
- "Lojistik regresyonda neden MSE değil log-loss?" → MSE sigmoid ile dışbükeyliği bozar; log-loss hem dışbükeydir hem de olasılıksal yorumu (maksimum olabilirlik) vardır.
- "Random forest neden tek ağaçtan iyi?" → bootstrap + özellik alt kümesi ağaçları ilişkisizleştirir; ilişkisiz yüksek varyanslı tahmincilerin ortalaması varyansı düşürür.
- "k-means her zaman aynı sonucu verir mi?" → hayır; yerel minimumlara takılır, k-means++ ve çoklu başlangıç şarttır.
- Ölçekleme gerektirenler: regresyon (GD ile), SVM, k-means, PCA. Gerektirmeyenler: ağaç tabanlılar.
:::

:::quiz{src="quiz.json"}
:::

:::next{lesson="g-03-neural-networks"}
Sırada: lojistik regresyonu üst üste dizip sinir ağına dönüştürüyoruz — nöron, aktivasyon, ileri ve geri yayılım.
:::

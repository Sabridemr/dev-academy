---
id: m-03-rag-pipeline
slug: rag-pipeline
module: m-llm-applications
order: 3
title:
  tr: "RAG: Getirme Destekli Üretim"
  en: "RAG: Retrieval-Augmented Generation"
summary:
  tr: "Belge parçalama, gömme, getirme ve üretim adımları; chunk boyutu ve top-k seçiminin cevaba etkisi; interaktif RAG hattı."
  en: "Chunking, embedding, retrieval and generation; how chunk size and top-k affect the answer; interactive RAG pipeline."
durationMinutes: 35
level: intermediate
tags: [llm, rag, retrieval, embedding, chunking, production]
prerequisites: [g-05-llms, m-02-prompt-engineering]
concepts: [rag, chunking, chunk-overlap, embedding, retrieval, top-k, reranking, grounding, citation]
---

## Kavram: modele kitap değil, ilgili sayfayı vermek

Bir LLM eğitildiği tarihe kadar gördüğü kamuya açık metni "bilir"; sizin şirketinizin iç dokümanlarını, dünkü fiyat listesini ya da bir müşterinin sözleşmesini bilmez. Bu bilgiyi modele kazandırmanın iki yolu vardır: modeli o veriyle yeniden eğitmek (fine-tuning) ya da her soruda ilgili bilgiyi bulup bağlama koymak. İkincisine **RAG (Retrieval-Augmented Generation, getirme destekli üretim)** denir ve üretimdeki LLM uygulamalarının büyük çoğunluğunun omurgasıdır.

RAG'ın tercih edilmesinin nedenleri pratiktir. Bilgi güncellenince yalnızca dizini güncellersiniz, modeli yeniden eğitmezsiniz. Cevabın hangi belgeye dayandığını gösterebilir, yani **kaynak gösterebilirsiniz**. Erişim kontrolünü getirme aşamasında uygulayıp kullanıcının görmeye yetkili olmadığı belgeleri hiç bağlama sokmayabilirsiniz. Fine-tuning ise modelin üslubunu, biçimini ya da belirli bir görevdeki becerisini değiştirmek için daha uygundur; olgu öğretmek için güvenilir bir yöntem değildir, çünkü model öğrendiği olguyu hangi kaynaktan aldığını söyleyemez ve yanlış hatırlayabilir.

İlk derste gördüğümüz bağlam penceresi sınırı da RAG'ı zorunlu kılar. On bin sayfalık bir bilgi tabanı hiçbir pencereye sığmaz; sığsa bile her soruda tamamını göndermek hem pahalı hem yavaş hem de "ortada kaybolma" etkisi nedeniyle isabetsiz olur. RAG'ın vaadi, modele kütüphaneyi değil, sorunun cevabının yazdığı birkaç sayfayı vermektir.

## İki aşama: dizinleme ve sorgulama

Bir RAG sistemi birbirinden bağımsız çalışan iki hattan oluşur. **Dizinleme (indexing)** hattı çevrim dışıdır: belgeler toplanır, temizlenir, parçalara bölünür, her parça bir gömme modeliyle vektöre çevrilir ve vektör veritabanına yazılır. Bu hat belgeler değiştikçe ya da yeni belge eklendikçe çalışır. **Sorgulama (query)** hattı ise her kullanıcı isteğinde çalışır: soru aynı gömme modeliyle vektöre çevrilir, veritabanında en yakın *k* parça bulunur, bu parçalar prompt'a eklenir ve LLM cevabı üretir.

İki hattın ayrı olması tasarımda önemli bir kolaylık sağlar: dizinleme yavaş ve pahalı olabilir, çünkü kullanıcı onu beklemez; sorgulama hattı ise her milisaniyesi önemli olan kritik yoldur. Tipik bir sorgu bütçesinde sorgu gömmesi birkaç on milisaniye, vektör araması on milisaniye mertebesinde sürerken toplam sürenin büyük kısmını LLM'in cevap üretmesi alır.

Aşağıdaki animasyon iki hattı adım adım gösterir.

:::animation{scene="scene.json"}
Üst sırada çevrim dışı dizinleme (belge → parçalama → gömme → vektör veritabanı), alt sırada her istekte çalışan sorgu hattı (soru → gömme → en yakın k parça → LLM → cevap).
:::

:::diagram{src="diagram.svg" alt="Parçalama stratejileri: sabit boyutlu parçalar ve örtüşme payı, başlıklara göre yapısal bölme; altta küçük ve büyük chunk boyutunun hassasiyet ile bağlam arasındaki ödünleşimi|Chunking strategies: fixed-size chunks with overlap, structural splitting by headings; below, the trade-off between precision and context for small and large chunk sizes"}
Küçük parçalar isabetli eşleşir ama bağlamı keser; büyük parçalar bağlamı korur ama aramayı bulanıklaştırır. Örtüşme, sınırda bölünen cümleleri kurtarır.
:::

## Parçalama: RAG kalitesinin gizli düğmesi

Getirme kalitesinin büyük kısmı, belgeleri nasıl böldüğünüzle belirlenir. Bir parça (chunk) hem aramada eşleşecek kadar odaklı hem de tek başına okunduğunda anlam taşıyacak kadar bütün olmalıdır. Bu iki hedef birbiriyle çelişir:

| Chunk boyutu | Artısı | Eksisi |
|---|---|---|
| **Küçük** (ör. 100–200 token) | Gömme tek bir fikri temsil eder, eşleşme isabetlidir | Cümlenin öncesi ve sonrası kaybolur; model eksik bağlamla cevap verir |
| **Büyük** (ör. 800–1500 token) | Bağlam korunur, tablo ve listeler bölünmez | Gömme birçok fikrin ortalamasıdır; alakasız sorgular da eşleşir, bağlam bütçesi hızla dolar |

**Örtüşme (overlap)**, ardışık parçaların sınırda bir miktar metni paylaşmasıdır. 200 tokenlık parçalar 40 token örtüşürse, sınıra denk gelen bir cümle iki parçada da tam olarak yer alır. Örtüşmenin bedeli dizin boyutunun ve gömme maliyetinin artmasıdır.

Sabit boyutlu bölme iyi bir başlangıçtır ama belgenin yapısını görmez. **Yapısal bölme**, Markdown başlıklarını, HTML bölümlerini, kod dosyalarındaki fonksiyon sınırlarını ya da PDF'teki paragrafları izler. Her parçanın başına belgenin başlığını ve bölüm yolunu ("Kullanıcı Kılavuzu › Faturalama › İade") eklemek, parçanın tek başına anlaşılmasını sağlar ve getirme kalitesini çoğu zaman belirgin biçimde artırır. Tablolar, kod blokları ve madde listeleri ortadan bölünmemelidir; bölünen bir tablonun alt yarısı başlıksız sayılara dönüşür.

## Getirme: en yakın k parça

Sorgu vektöre çevrildikten sonra veritabanından en benzer *k* parça istenir. **Top-k** seçimi de bir ödünleşimdir. Küçük *k* (ör. 2–3) bağlamı temiz tutar, ama doğru parça dördüncü sıradaysa cevap kaçar. Büyük *k* (ör. 20) kapsamı artırır, ama alakasız parçalar modelin dikkatini dağıtır, maliyeti ve gecikmeyi büyütür.

Üretimde sık kullanılan çözüm iki aşamalı getirmedir: önce hızlı vektör aramasıyla geniş bir aday kümesi (ör. 30–50 parça) çekilir, sonra bir **yeniden sıralayıcı (reranker)** her adayı soruyla birlikte okuyup daha isabetli bir puan verir ve en iyi birkaçı bağlama girer. Yeniden sıralayıcılar sorgu ile parçayı aynı anda gördüğü için yalnızca vektör benzerliğine bakan aramadan daha ince ayrımlar yapabilir; bedeli ek gecikmedir.

Saf vektör aramasının zayıf kaldığı yerler de vardır: ürün kodları, hata numaraları, kişi adları gibi tam eşleşme gerektiren terimler. Bu sorgularda klasik anahtar kelime araması (BM25) daha iyi çalışır. İkisini birleştiren **hibrit arama**yı bir sonraki derste ayrıntılı göreceğiz.

## Sorguyu aramaya hazırlamak

Kullanıcının yazdığı cümle her zaman iyi bir arama sorgusu değildir. Sohbetin üçüncü turunda gelen "peki yurt dışı siparişlerde?" sorusu tek başına hiçbir belgeyle eşleşmez; neyin sorulduğu önceki turlardadır. Bu yüzden birçok sistem getirmeden önce ucuz bir model çağrısıyla **sorguyu yeniden yazar**: sohbet geçmişini okuyup "Yurt dışı siparişlerde iade süresi ve kargo ücreti" gibi bağımsız bir sorgu üretir. Karmaşık sorularda soruyu birkaç alt sorguya bölüp her biri için ayrı getirme yapmak ve sonuçları birleştirmek de yaygın bir tekniktir. Bir başka yaklaşım, modele önce varsayımsal bir cevap yazdırıp aramayı soru yerine bu cevabın gömmesiyle yapmaktır; cevap metni belgelerin diline sorudan daha çok benzediği için eşleşme iyileşebilir. Her teknik ek bir çağrı, yani ek gecikme ve maliyet getirir; değerlendirme setinde fark yaratıp yaratmadığını ölçmeden eklemeyin.

## Dizini canlı tutmak

Dizinleme bir kez yapılıp unutulan bir iş değildir. Belge güncellendiğinde eski parçalarının silinmesi gerekir; aksi hâlde eski ve yeni sürüm aynı anda getirilir ve model çelişen iki bilgiyle karşılaşır. Bunun için her parçaya kaynak belge kimliği, sürüm ya da içerik özeti ve güncellenme tarihi yazılır; belge değişince o kimliğe ait tüm parçalar silinip yeniden üretilir. Gömme modelini değiştirmek ise daha büyük bir iştir: farklı modellerin vektörleri aynı uzayda değildir, bu yüzden tüm dizinin yeniden gömülmesi gerekir. Büyük dizinlerde bu, yeni dizini paralel kurup trafiği kademeli taşımak anlamına gelir.

:::interactive{type="rag-pipeline" chunkSize=200 overlap=40 topK=3 query="İade süresi kaç gün ve kargo ücretini kim öder?"}
200 tokenlık parçalar, 40 token örtüşme ve top-3 ile başlayın; sorgunun hangi parçaları getirdiğine bakın. Chunk boyutunu küçültüp büyütün: iade süresi ile kargo ücreti aynı parçaya mı düşüyor, ayrı parçalara mı? Örtüşmeyi sıfıra çekip sınırda bölünen cümleleri gözleyin. Son olarak top-k değerini 1'e indirip sorunun iki parçasından birinin cevapsız kaldığı durumu yakalayın.
:::

## Üretim: bağlamı prompt'a koymak

Getirilen parçalar prompt'a eklenirken önceki derste öğrendiğimiz ilkeler geçerlidir. Her parçayı bir kimlik ve kaynak bilgisiyle etiketleyin (`<kaynak id="3" belge="iade-politikasi.md">…</kaynak>`), modelden cevabı yalnızca bu kaynaklara dayandırmasını ve kullandığı kaynağın kimliğini belirtmesini isteyin. Kaynaklarda cevap yoksa "bilmiyorum" demesine açıkça izin verin. Bu üç talimat, **dayanaklılık (grounding)** ve **kaynak gösterme (citation)** için temel oluşturur.

Kaynak kimliklerini model ürettiği için, uygulamanın bunları doğrulaması gerekir: cevapta geçen her kimlik gerçekten bağlama verilen bir parçaya karşılık geliyor mu? Var olmayan bir kimlik görürseniz cevabı şüpheli olarak işaretleyin. Kullanıcıya kaynak bağlantılarını göstermek hem güveni artırır hem de yanlış bir cevabın hızla fark edilmesini sağlar.

:::code{lang="python" title="Minimal RAG: örtüşmeli parçalama, top-k getirme ve kaynaklı cevap"}
```python
import numpy as np

def chunk(text: str, size: int = 200, overlap: int = 40) -> list[str]:
    """Kelime bazlı yaklaşık parçalama; üretimde token bazlı ve yapısal bölme tercih edin."""
    words, step = text.split(), size - overlap
    return [" ".join(words[i:i + size]) for i in range(0, max(len(words) - overlap, 1), step)]

class Index:
    def __init__(self, embed):              # embed(list[str]) -> np.ndarray (n, d), normalize edilmiş
        self.embed, self.chunks, self.vecs = embed, [], None

    def add(self, doc_id: str, text: str):
        parts = chunk(text)
        self.chunks += [{"doc": doc_id, "text": p} for p in parts]
        v = self.embed(parts)
        self.vecs = v if self.vecs is None else np.vstack([self.vecs, v])

    def search(self, query: str, k: int = 3) -> list[dict]:
        q = self.embed([query])[0]
        scores = self.vecs @ q                  # normalize vektörlerde iç çarpım = kosinüs
        return [self.chunks[i] | {"score": float(scores[i])} for i in np.argsort(-scores)[:k]]

def answer(llm, index: Index, question: str, k: int = 3) -> str:
    hits = index.search(question, k)
    context = "\n".join(f'<kaynak id="{i}" belge="{h["doc"]}">{h["text"]}</kaynak>'
                        for i, h in enumerate(hits, 1))
    system = ("Yalnızca verilen kaynaklara dayanarak cevap ver. Her cümlenin sonunda [id] ile kaynak göster. "
              "Kaynaklarda cevap yoksa 'Bu bilgi kaynaklarda yok.' de.")
    return llm.complete(system=system,
                        messages=[{"role": "user", "content": f"{context}\n\nSoru: {question}"}],
                        temperature=0)
```
:::

## RAG neden yanlış cevap verir?

Bir RAG cevabı yanlış olduğunda hata üç yerden birindedir ve hangisi olduğunu bilmeden düzeltme yapmak zaman kaybıdır:

1. **Getirme hatası**: Doğru parça hiç getirilmedi. Belge dizinde yok, parçalama cevabı ikiye böldü ya da sorgu ile belge farklı kelimeler kullanıyor. Çözüm parçalama, hibrit arama, sorgu yeniden yazma ya da yeniden sıralamadadır.
2. **Bağlam hatası**: Doğru parça getirildi ama alakasız parçaların arasında kayboldu ya da eski ve yeni sürümü çelişen iki belge birlikte geldi. Çözüm daha küçük *k*, yeniden sıralama ve belgelere tarih/sürüm meta verisi ekleyip filtrelemektir.
3. **Üretim hatası**: Doğru bağlam vardı ama model onu yanlış yorumladı ya da bağlamın dışına çıkıp uydurdu. Çözüm prompt'ta, modelde ya da bir doğrulama katmanındadır.

Beşinci derste bu üç hatayı ayrı ayrı ölçen metrikleri (getirme isabeti, sadakat, cevap doğruluğu) kuracağız. Şimdilik akılda tutulacak kural şu: RAG kalitesi önce getirme kalitesidir. Model ne kadar güçlü olursa olsun, bağlamda olmayan bilgiyi doğru biçimde söyleyemez.

:::realworld{company="Morgan Stanley"}
Morgan Stanley'in servet yönetimi birimi, 2023'te finans danışmanları için kurum içi bir yapay zekâ asistanı devreye aldı. Asistan, şirketin yaklaşık 100 bin belgelik araştırma raporu, ürün ve süreç dokümanı kütüphanesi üzerinde getirme yaparak soruları yanıtlıyor; danışman cevabın dayandığı belgeye ulaşabiliyor. Yayımlanan açıklamalara göre ekip, üretime almadan önce cevap kalitesini uzmanların puanladığı bir değerlendirme süreciyle ölçtü ve bilgi tabanını, modeli değiştirmeden güncelleyebildi. Bu, RAG'ın temel vaadinin, yani güncel ve kaynağı gösterilebilir bilginin, düzenlemeye tabi bir sektörde uygulanmış hâlidir.
:::

:::callout{tone="warning" title="Erişim kontrolü getirmede uygulanır"}
Kullanıcının görmeye yetkili olmadığı bir belge bağlama girerse, modelden onu "söylememesini" istemek güvenilir bir koruma değildir. Her parçaya sahip, kiracı ve yetki meta verisi ekleyin ve vektör aramasını bu filtrelerle yapın; yetkisiz belge hiç getirilmesin.
:::

:::callout{tone="tip" title="Mülakat özeti"}
- RAG = dizinleme (parçala, göm, yaz) + sorgulama (göm, getir, üret).
- Chunk boyutu hassasiyet ile bağlam arasında, top-k kapsam ile gürültü arasında bir ödünleşimdir.
- Yanlış cevabı getirme, bağlam ve üretim hatası olarak ayırın; önce getirmeyi ölçün.
:::

:::quiz{src="quiz.json"}
:::

:::next{lesson="m-04-vector-databases"}
Sırada: getirme adımının arkasındaki motor — vektör veritabanları, HNSW ve IVF indeksleri, hibrit arama ve filtreleme.
:::

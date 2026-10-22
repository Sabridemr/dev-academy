---
id: m-05-evaluation
slug: evaluation
module: m-llm-applications
order: 5
title:
  tr: "LLM Uygulamalarını Değerlendirmek"
  en: "Evaluating LLM Applications"
summary:
  tr: "Altın veri seti, LLM-as-judge, RAG metrikleri (faithfulness, recall), regresyon testleri ve çevrimiçi değerlendirme."
  en: "Golden datasets, LLM-as-judge, RAG metrics (faithfulness, recall), regression tests and online evaluation."
durationMinutes: 30
level: advanced
tags: [llm, evaluation, testing, rag, quality, production]
prerequisites: [g-05-llms, m-04-vector-databases]
concepts: [golden-dataset, llm-as-judge, rubric, faithfulness, context-recall, answer-correctness, regression-testing, online-evaluation]
---

## Kavram: "bana iyi göründü" bir test değildir

Klasik yazılımda bir fonksiyonun doğru çalışıp çalışmadığını birim testleriyle anlarız: belirli bir girdi için beklenen çıktı ya gelir ya gelmez. LLM uygulamalarında bu kesinlik yoktur. Aynı soru için birçok doğru cevap vardır, aynı prompt iki çalıştırmada farklı kelimeler üretebilir ve "doğru" çoğu zaman bir derece meselesidir. Bu belirsizlik, birçok ekibi değerlendirmeyi tamamen atlayıp birkaç örneği elle deneyerek karar vermeye iter. Bu yaklaşımın adı halk arasında "vibe check"tir ve ilk birkaç haftadan sonra çöker.

Çöküşün nedeni basittir: önceki derslerde gördüğümüz her ayar — chunk boyutu, top-k, prompt sürümü, model seçimi, temperature — bir ödünleşimdir ve bir yeri iyileştirirken başka bir yeri bozabilir. Prompt'a eklediğiniz bir kural yeni vakayı düzeltip üç eski vakayı bozabilir; daha ucuz bir modele geçmek ortalamada fark etmezken belirli bir soru tipinde çökebilir. Bunları görmenin tek yolu, değişikliklerden önce ve sonra aynı ölçümleri tekrarlanabilir biçimde yapmaktır. Değerlendirme, bir LLM uygulamasının test paketidir; onsuz yapılan her değişiklik tahmindir.

## Değerlendirme katmanları

Tek bir ölçüm her şeyi yakalamaz. Olgun ekipler birkaç katmanı birlikte kullanır; ucuz ve hızlı katmanlar her değişiklikte, pahalı ve yavaş katmanlar daha seyrek çalışır.

| Katman | Ne ölçer? | Örnek | Maliyet |
|---|---|---|---|
| **Deterministik kontroller** | Biçim ve kurallar | JSON şemaya uyuyor mu, yasaklı kelime var mı, kaynak kimliği geçerli mi | Çok düşük |
| **Referansa göre karşılaştırma** | Beklenen cevapla örtüşme | Sınıflandırmada doğru etiket, bilgi çıkarmada alan eşleşmesi | Düşük |
| **LLM-as-judge** | Serbest metnin kalitesi | Cevap kaynağa sadık mı, soruyu karşılıyor mu | Orta |
| **İnsan değerlendirmesi** | Uzman yargısı, ince hatalar | Alan uzmanının 1–5 puanlaması | Yüksek |
| **Çevrimiçi sinyaller** | Gerçek kullanıcı deneyimi | Beğeni/beğenmeme, cevabın düzenlenmesi, insan temsilciye aktarım | Sürekli |

Kural şudur: bir şeyi kodla kontrol edebiliyorsanız modelle kontrol etmeyin. Bir JSON'un geçerli olup olmadığını ya da bir tutarın belirli bir aralıkta olduğunu sormak için LLM çağırmak hem pahalı hem güvenilmezdir. LLM yargıcını yalnızca gerçekten anlam gerektiren sorular için saklayın.

:::diagram{src="diagram.svg" alt="Değerlendirme döngüsü: altın veri seti çevrim dışı değerlendirmeye girer, deterministik kontroller, referans karşılaştırması ve LLM yargıcı puan üretir, CI kapısı geçerse kademeli dağıtım yapılır; üretimdeki çevrimiçi sinyaller ve başarısız örnekler yeniden altın veri setine eklenir|Evaluation loop: the golden dataset feeds offline evaluation, deterministic checks, reference comparison and an LLM judge produce scores, a CI gate allows gradual rollout; online signals and failing examples from production flow back into the golden dataset"}
Değerlendirme bir döngüdür: üretimde yakalanan her hata altın veri setine bir test olarak geri döner.
:::

Bu döngüyü tek bir değişiklik üzerinden izleyelim: bir prompt değişikliği CI'da altın veri setiyle çalışıyor, ortalama yükseliyor ama bir kırılım geriliyor.

:::predict{id="ci-kapisi-kirilim"}
Yeni prompt sürümünde ortalama puan önceki sürümden yüksek, ama "iade" etiketli sorularda belirlenen paydan fazla gerileme var. CI kapısı ne yapmalı? | In the new prompt version the average score beats the previous one, but questions labelled "returns" regress by more than the agreed margin. What should the CI gate do?
- [ ] Ortalama yükseldiği için geçirmeli | Pass, because the average went up
- [x] Kırılımdaki gerileme eşiği aştığı için durdurmalı | Block, because the slice regression exceeds the threshold
- [ ] Testi tekrar çalıştırıp geçen sonucu kabul etmeli | Rerun the tests and accept whichever run passes
Açıklama: Ortalama, belirli bir soru tipindeki çöküşü gizleyebilir. Kapı toplu eşiklere ve etiket kırılımlarına bağlanır; geçene kadar yeniden çalıştırmak ise olasılıksal sonuçları kendi lehine okumaktır. | An average can hide a collapse in one question type. The gate is tied to aggregate thresholds and label slices; rerunning until it passes just reads probabilistic results in your favour.
:::

:::animation{scene="eval-pipeline.scene.json"}
Değişiklik CI'ı tetikler; kural kontrolleri ve LLM yargıcı puanlar, kırılımdaki gerileme kapıyı kapatır, düzeltme sonrası kademeli dağıtım yapılır ve üretimdeki hata veri setine döner.
:::

## Altın veri seti nasıl kurulur?

**Altın veri seti (golden dataset)**, girdileri ve mümkünse beklenen çıktıları ya da değerlendirme ölçütleri belirlenmiş örnekler koleksiyonudur. Büyük olması gerekmez; iyi seçilmiş 50–200 örnek, rastgele seçilmiş binlerce örnekten daha değerlidir. Başlangıç için üç kaynak kullanılır:

1. **Gerçek trafik**: Üretim loglarından (kişisel veriler temizlenerek) farklı soru tiplerini temsil eden örnekler.
2. **Bilinen hatalar**: Kullanıcıların şikâyet ettiği, ekibin yakaladığı ya da bir olay sonrası incelemede bulunan vakalar. Bu örnekler en değerli olanlardır çünkü sistemin gerçekten zorlandığı yeri gösterir.
3. **Kasıtlı zor vakalar**: Kaynaklarda cevabı olmayan sorular, iki belgenin çeliştiği durumlar, belirsiz istekler, prompt enjeksiyonu denemeleri.

Her örneğe bir **etiket** (soru tipi, zorluk, hangi özelliği test ettiği) eklemek, sonuçları kırılımlara ayırmanızı sağlar. Ortalama puan %85'ten %86'ya çıkarken "iade" kategorisindeki soruların %90'dan %70'e düştüğünü ancak bu kırılımla görebilirsiniz. Veri seti de kod gibi sürümlenmeli ve gözden geçirilmelidir; yanlış bir beklenen cevap, doğru bir modeli yıllarca cezalandırabilir.

## RAG için üç katmanlı metrik

Üçüncü derste RAG hatalarını getirme, bağlam ve üretim olarak ayırmıştık. Metrikler de bu ayrımı izlemelidir; aksi hâlde "cevap yanlış" bilgisi neyi düzelteceğinizi söylemez.

| Metrik | Soru | Nasıl ölçülür? |
|---|---|---|
| **Context recall (getirme isabeti)** | Cevap için gereken parçalar getirildi mi? | Her örnek için beklenen kaynak kimlikleri; getirilenlerle kesişim |
| **Context precision** | Getirilen parçaların ne kadarı alakalı? | Alakalı parça / getirilen parça; LLM yargıcı ya da etiket |
| **Faithfulness (sadakat)** | Cevaptaki her iddia bağlamda dayanağa sahip mi? | Cevap iddialara bölünür, her biri bağlamla kontrol edilir |
| **Answer relevance** | Cevap soruyu gerçekten karşılıyor mu? | LLM yargıcı, rubrik ile |
| **Answer correctness** | Cevap beklenen cevapla aynı olguları içeriyor mu? | Referans cevaba karşı LLM yargıcı ya da alan eşleşmesi |

Bu metrikler birlikte okunmalıdır. Yüksek sadakat ama düşük doğruluk, modelin bağlama sadık kaldığını ama bağlamın yanlış olduğunu, yani sorunun getirmede olduğunu gösterir. Yüksek recall ama düşük sadakat ise doğru bilginin bağlamda olduğunu ama modelin dışına çıktığını, yani sorunun üretimde olduğunu söyler. Context recall'u ölçmek için LLM bile gerekmez; her örnekte beklenen belge kimliklerini işaretlemek yeterlidir ve bu, en ucuz ve en çok bilgi veren metriklerden biridir.

## LLM-as-judge: güvenilir bir yargıç kurmak

Serbest metnin kalitesini ölçeklenebilir biçimde değerlendirmenin en pratik yolu başka bir LLM çağrısını yargıç olarak kullanmaktır. Bu yöntem güçlüdür ama kendi önyargıları vardır ve dikkatsiz kurulursa yanıltıcı sayılar üretir. Bilinen önyargılar şunlardır:

- **Uzunluk önyargısı**: Yargıçlar daha uzun ve ayrıntılı cevapları, doğruluktan bağımsız olarak daha yüksek puanlama eğilimindedir.
- **Konum önyargısı**: İki cevabı karşılaştırırken, sırada önce ya da sonra gelen cevaba sistematik olarak avantaj verebilirler.
- **Kendini kayırma**: Bir model, kendi ürettiği ya da kendine benzeyen metni daha olumlu değerlendirebilir.
- **Belirsiz ölçek**: "1'den 10'a puanla" talimatı tutarsız sonuç verir; 6 ile 7 arasındaki farkın tanımı yoktur.

Bunlara karşı birkaç ilke işe yarar. Yargıca açık bir **rubrik** verin ve mümkünse ikili ya da az kademeli sorular sorun ("cevaptaki her iddia bağlamda var mı: evet/hayır") — ikili kararlar daha tutarlıdır. Yargıçtan puanı vermeden önce kısa bir gerekçe yazmasını isteyin; hem doğruluk artar hem de hatalı kararları inceleyebilirsiniz. İkili karşılaştırmalarda cevapların sırasını değiştirip iki kez sorun ve yalnızca tutarlı kararları sayın. En önemlisi, yargıcı **insan etiketleriyle kalibre edin**: birkaç yüz örneği uzmanlara puanlatıp yargıcın onlarla ne kadar uyuştuğunu ölçün. Uyum düşükse yargıcın verdiği sayılar size hiçbir şey söylemez.

:::code{lang="python" title="pytest ile değerlendirme: JSON altın veri seti, deterministik kontrol ve LLM yargıcı"}
```python
# evals/golden.json
# [
#   {"id": "iade-01", "tags": ["iade"], "question": "İade süresi kaç gün?",
#    "expected_sources": ["iade-politikasi#2"], "reference": "Teslimattan itibaren 14 gün."},
#   {"id": "yok-03", "tags": ["cevapsiz"], "question": "Mağazanız pazar günü açık mı?",
#    "expected_sources": [], "reference": "Bu bilgi kaynaklarda yok."}
# ]
import json, pathlib, pytest
from app.rag import answer_with_trace      # -> {"answer": str, "sources": [id], "context": str}
from app.llm import judge_llm              # sağlayıcıdan bağımsız sarmalayıcı, temperature=0

CASES = json.loads(pathlib.Path("evals/golden.json").read_text())

JUDGE = """Bir RAG cevabını değerlendiriyorsun. Önce kısa gerekçe yaz, sonra JSON ver.
<baglam>{context}</baglam>
<referans>{reference}</referans>
<cevap>{answer}</cevap>
Sorular (evet/hayır):
1. faithful: Cevaptaki HER iddia bağlamda dayanağa sahip mi?
2. correct: Cevap referanstaki olguları içeriyor ve onlarla çelişmiyor mu?
Son satır: {{"faithful": true|false, "correct": true|false}}"""

def judge(case, out) -> dict:
    raw = judge_llm(JUDGE.format(context=out["context"], reference=case["reference"], answer=out["answer"]))
    return json.loads(raw.strip().splitlines()[-1])

@pytest.mark.parametrize("case", CASES, ids=[c["id"] for c in CASES])
def test_rag_case(case):
    out = answer_with_trace(case["question"])
    # 1) Deterministik: getirme isabeti (context recall) — LLM gerekmez
    assert set(case["expected_sources"]) <= set(out["sources"]), "beklenen kaynak getirilmedi"
    # 2) LLM yargıcı: sadakat ve doğruluk
    verdict = judge(case, out)
    assert verdict["faithful"], "cevap bağlam dışına çıkıyor"
    assert verdict["correct"], "cevap referansla uyuşmuyor"
```
:::

## Regresyon testleri ve CI kapısı

Altın veri seti hazır olduğunda onu her prompt, model, chunk ayarı ya da kod değişikliğinde çalıştırmak gerekir. Ancak LLM testleri klasik testlerden iki noktada ayrılır. Birincisi, sonuçlar olasılıksaldır; tek bir örneğin bir çalıştırmada geçip diğerinde kalması normaldir. Bu yüzden kararı tek tek testlere değil, **toplu eşiklere** bağlayın: "sadakat oranı %95'in, context recall %90'ın altına düşmesin ve önceki sürüme göre hiçbir etiket kırılımında beş puandan fazla gerileme olmasın." İkincisi maliyet ve süredir; yüzlerce LLM yargıcı çağrısı her commit'te çalıştırılamayabilir. Yaygın çözüm, her pull request'te küçük ve hızlı bir alt kümeyi, gece ya da sürüm öncesinde tam seti çalıştırmaktır.

Sonuçları bir tabloya değil, karşılaştırmaya dönüştürün. "Yeni sürüm %87" bilgisi tek başına anlamsızdır; "eski sürüm %84, yeni sürüm %87; dört örnek düzeldi, bir örnek bozuldu, bozulan şu" bilgisi karar vermenizi sağlar. Bozulan örnekleri tek tek okumak, ortalama puana bakmaktan çok daha fazla şey öğretir.

:::interactive{type="prompt-playground" preset="classify" temperature=0.8}
Değerlendirmenin neden tek bir çalıştırmaya güvenemeyeceğini kendiniz görün. "Sınıflandır" şablonuyla, sıcaklık 0,8'deyken "Çalıştır"a basın; ardından "Yeni tohum" ile birkaç kez daha çalıştırıp çıktıdaki kelimelerin nasıl değiştiğini izleyin. Sonra sıcaklığı 0'a çekin ve aynı tohumla çıktının birebir tekrarlandığını doğrulayın. Son olarak "Yapılandırılmış çıktı (JSON)" anahtarını açın: serbest metin yerine JSON dönen bir çıktı, LLM yargıcına gerek kalmadan şema ve etiket eşleşmesi gibi deterministik kontrollerle puanlanabilir.
:::

## Çevrimiçi değerlendirme

Çevrim dışı set ne kadar iyi olursa olsun gerçek kullanıcıların her davranışını öngöremez. Üretimde toplanan sinyaller ikinci bir değerlendirme kaynağıdır: açık geri bildirim (beğeni, beğenmeme, yorum), örtük sinyaller (kullanıcının cevabı kopyalaması, soruyu farklı kelimelerle tekrar sorması, insan temsilciye geçmesi, üretilen metni düzenleme oranı) ve iş metrikleri (çözülen talep oranı, dönüşüm). Bunlara ek olarak trafiğin küçük bir örneklemini aynı LLM yargıcıyla sürekli puanlamak, kaliteyi gerçek dağılım üzerinde izlemenizi sağlar.

Yeni bir sürümü tüm kullanıcılara açmadan önce **A/B testi** ya da kademeli dağıtım yapın ve bu sinyalleri iki grup arasında karşılaştırın. Ve döngüyü kapatın: üretimde yakalanan her kötü cevap incelenmeli, nedeni sınıflandırılmalı ve altın veri setine yeni bir örnek olarak eklenmelidir. Zamanla veri seti, ürününüzün gerçekten zorlandığı vakaların haritasına dönüşür.

:::realworld{company="GitHub"}
GitHub, Copilot'a yeni bir model eklemeden ya da mevcut modeli güncellemeden önce çok katmanlı bir değerlendirmeden geçirdiğini mühendislik blogunda anlatıyor. Çevrim dışı tarafta, gerçek açık kaynak depolarından oluşturulmuş ve birim testleri bulunan bir test ortamı kullanılıyor: kodun bir kısmı bozuluyor, model düzeltme önerdiğinde testlerin yeniden geçip geçmediği ölçülüyor — yani değerlendirme mümkün olan her yerde deterministik bir sinyale dayanıyor. Sohbet gibi serbest metin cevaplarında ise bir LLM yargıcı kullanılıyor ve yargıcın kararları düzenli olarak insan değerlendirmeleriyle karşılaştırılıp kalibre ediliyor. Çevrim dışı eşikleri geçen modeller önce iç kullanıcılara, ardından kademeli olarak daha geniş kitleye açılıyor ve kabul oranı gibi çevrimiçi sinyallerle izleniyor.
:::

:::callout{tone="warning" title="Yargıç da bir modeldir"}
LLM yargıcının prompt'u ya da modeli değiştiğinde tüm geçmiş puanlarınız karşılaştırılamaz hâle gelir. Yargıcı da sürümleyin, değiştirdiğinizde insan etiketli kalibrasyon setinde yeniden ölçün ve yargıç ile değerlendirilen sistemi mümkünse farklı modellerden seçin.
:::

:::callout{tone="tip" title="Mülakat özeti"}
- Önce deterministik kontroller, sonra referans karşılaştırması, en son LLM-as-judge; kodla ölçülebileni modelle ölçmeyin.
- RAG'da getirme (context recall) ve üretim (faithfulness) metriklerini ayrı ölçün.
- CI kapısını toplu eşiklere ve kırılım bazlı gerilemeye bağlayın; üretimdeki her hata yeni bir test olsun.
:::

:::quiz{src="quiz.json"}
:::

:::next{lesson="m-06-agents-tool-use"}
Sırada: modelin yalnızca cevap vermediği, araç çağırıp eylem yaptığı sistemler — ajanlar ve araç kullanımı.
:::

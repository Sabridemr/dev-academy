---
id: m-08-cost-latency-caching
slug: cost-latency-caching
module: m-llm-applications
order: 8
title:
  tr: "Maliyet, Gecikme ve Önbellekleme"
  en: "Cost, Latency and Caching"
summary:
  tr: "Model seçimi, prompt önbelleği, semantik önbellek, akış (streaming), toplu işleme ve bütçe takibi."
  en: "Model selection, prompt caching, semantic caching, streaming, batching and budget tracking."
durationMinutes: 30
level: advanced
tags: [llm, cost, latency, caching, streaming, production]
prerequisites: [g-05-llms, m-07-guardrails-hallucination]
concepts: [model-routing, prompt-caching, semantic-cache, cache-invalidation, streaming, batching, budget-tracking, ttft]
---

## Kavram: her token bir maliyet, her milisaniye bir deneyim

İlk derste bir LLM çağrısının maliyetini ve süresini token cinsinden hesaplamayı öğrendik. Modülün son dersinde bu hesabı tersine çevireceğiz: aynı kaliteyi daha az token, daha küçük model ve daha az bekleme ile nasıl elde ederiz? Bir prototipte istek başına birkaç kuruşluk maliyet önemsiz görünür; günde yüz bin isteğe ulaşan bir üründe aynı rakam aylık bütçenin en büyük kalemine dönüşebilir. Gecikme de benzer biçimde birikir: RAG, guardrail ve ajan adımları eklendikçe tek bir model çağrısının birkaç saniyesi, kullanıcının sayfayı terk ettiği on saniyelere uzar.

Maliyet ve gecikme optimizasyonu birbirinden bağımsız değildir ve çoğu teknik ikisini birlikte iyileştirir. Küçük bir model hem ucuz hem hızlıdır; önbellekten dönen bir cevap hem bedava hem anlıktır; kısa bir çıktı hem daha az faturalanır hem daha erken biter. Bu derste beş kaldıracı sırayla ele alacağız: model seçimi ve yönlendirme, prompt önbelleği, semantik önbellek, akış ve toplu işleme, bütçe takibi.

## Model seçimi ve yönlendirme

En büyük tasarruf genellikle en basit karardan gelir: her iş için en büyük modeli kullanmamak. Model aileleri tipik olarak küçük, orta ve büyük sınıflarda sunulur ve sınıflar arasında token fiyatı bir büyüklük mertebesine kadar fark edebilir. Sınıflandırma, bilgi çıkarma, kısa özetleme, sorgu yeniden yazma ve guardrail kontrolleri gibi dar görevlerde küçük modeller çoğu zaman büyüklerle aynı kaliteyi verir. Karmaşık akıl yürütme, uzun belge analizi ve çok adımlı ajan görevleri ise büyük modeli hak eder.

Bu gözlemin sistem düzeyindeki karşılığı **model yönlendirmedir (model routing)**: gelen isteği ucuz bir sınıflandırıcıyla ya da kurallarla değerlendirip uygun modele göndermek. Yaygın bir kalıp **kademeli (cascade)** yaklaşımdır: istek önce küçük modele gider; cevap doğrulamadan geçemezse ya da model düşük güven bildirirse büyük modele yükseltilir. Trafiğin büyük kısmı basit isteklerden oluşuyorsa ortalama maliyet ciddi biçimde düşer. Her yönlendirme kararı, beşinci derste kurduğumuz değerlendirme setiyle doğrulanmalıdır: "küçük model yeterli" iddiası, etiket kırılımlarına göre ölçülmeden kabul edilmemelidir.

:::interactive{type="token-cost" model="small" inputTokens=1500 outputTokens=300 requestsPerDay=50000}
Küçük bir modelle istek başına 1 500 giriş ve 300 çıkış tokenı, günde 50 000 istek için aylık maliyeti inceleyin. Model sınıfını orta ve büyüğe çevirip aynı trafikte maliyetin kaç kat arttığını görün. Ardından küçük modele dönüp istek sayısını sabit tutun ve giriş tokenını, prompt önbelleğinin sabit ön eki ucuzlatması gibi düşünerek azaltın: hangi kaldıraç bütçede daha büyük fark yaratıyor?
:::

## Prompt önbelleği

Üretimdeki prompt'ların büyük kısmı her istekte aynıdır: uzun bir sistem talimatı, araç tanımları, few-shot örnekleri, bazen aynı kılavuz belgesi. Model her istekte bu sabit ön eki yeniden işler. **Prompt önbelleği (prompt caching)**, sağlayıcının bu ön ekin işlenmiş ara durumunu kısa bir süre saklaması ve aynı ön ekle gelen sonraki isteklerde yeniden kullanmasıdır. Sonuç, önbellekten okunan giriş tokenları için belirgin bir indirim ve ilk tokena kadar geçen sürede (TTFT) kısalmadır, çünkü prefill işinin büyük kısmı atlanır.

Prompt önbelleğinden yararlanmanın tek koşulu, prompt'u **sabit kısımlar başta, değişken kısımlar sonda** olacak biçimde düzenlemektir. Önbellek ön ek eşleşmesiyle çalışır; sistem talimatının en başına bugünün tarihini ya da kullanıcının adını koyarsanız ön ek her istekte değişir ve önbellek hiç tutmaz. Doğru sıra şudur: sistem talimatı ve araç tanımları, ardından sabit belgeler ve örnekler, en sonda sohbet geçmişi ve kullanıcının son mesajı. Bazı sağlayıcılar önbelleği otomatik uygular, bazıları ise önbelleğe alınacak sınırı açıkça işaretlemenizi ister; önbellek ömrü genellikle dakikalar mertebesindedir ve her isabette yenilenir. Önbellek yazma bazen normal fiyattan biraz pahalıdır; bu yüzden yalnızca gerçekten tekrar eden ve yeterince uzun ön eklerde kazanç sağlar.

Kaba bir hesapla etkisini görelim: istek başına 1 500 giriş tokenının 1 200'ü sabit sistem talimatı ve araç tanımlarıysa ve önbellekten okunan token normal fiyatın onda biriyle faturalanıyorsa, isabetli isteklerde giriş maliyeti (300 + 1 200 × 0,1 = 420 token eşdeğeri) yaklaşık %28’ine iner. Trafiğin sürekli aktığı bir üründe önbellek neredeyse her istekte tutar; gün içinde seyrek gelen isteklerde ise önbellek ömrü dolduğu için kazanç düşer.

## Semantik önbellek

Prompt önbelleği aynı ön eki tekrar kullanır ama model yine de cevap üretir. **Semantik önbellek** bir adım daha ileri gider: daha önce cevaplanmış, anlamca aynı bir soru gelirse modeli hiç çağırmadan kayıtlı cevabı döndürür. "İade süresi kaç gün?" ile "Ürünü kaç gün içinde geri gönderebilirim?" farklı metinlerdir ama aynı cevabı hak eder. Semantik önbellek, sorunun gömmesini önceki soruların gömmeleriyle karşılaştırır; benzerlik bir eşiğin üzerindeyse önbellekten cevap verir.

Bu teknik güçlüdür ama klasik önbellekten daha tehlikelidir, çünkü anahtar eşitliği yerine benzerliğe dayanır. Dört soruyu cevaplamadan kullanmayın:

| Soru | Risk | Önlem |
|---|---|---|
| **Eşik ne?** | Düşük eşik: farklı sorulara yanlış cevap. Yüksek eşik: isabet oranı düşer | Eşiği değerlendirme setiyle ayarlayın; yanlış isabet oranını ölçün |
| **Kimin cevabı?** | Bir kullanıcının kişisel cevabı başkasına döner | Önbelleği kiracıya ve gerekirse kullanıcıya göre ayırın; kişisel veri içeren cevapları önbelleğe almayın |
| **Ne kadar taze?** | Politika değişti, önbellek eski cevabı veriyor | TTL koyun; kaynak belge değişince ilgili girdileri geçersiz kılın |
| **Hangi sorular?** | Bağlama bağlı soru ("peki ya bu?") yanlış eşleşir | Yalnızca bağımsız, sık tekrarlanan sorularda kullanın; sorguyu önce yeniden yazın |

Önbellek kapasitesi sınırlıysa hangi girdinin atılacağına bir tahliye politikası karar verir. Sık sorulan soruların çoğu az sayıda kalıba toplandığı için LRU ya da LFU gibi klasik politikalar burada da iyi çalışır.

Semantik önbelleği, yönlendirmeyi ve toplu işlemeyi tek bir istek yolunda birlikte görelim; sağdaki sayaç her model çağrısının faturaya ve gecikmeye etkisini topluyor.

:::predict{id="semantik-onbellek-isabet"}
Kiracı A'nın önbelleğinde "İade süresi kaç gün?" sorusunun cevabı var. Aynı kiracıda başka bir kullanıcı "Ürünü kaç gün içinde geri gönderebilirim?" diye soruyor. Ne olur? | Tenant A's cache holds the answer to "How many days is the return window?". Another user in the same tenant asks "Within how many days can I send the product back?". What happens?
- [ ] Metin farklı olduğu için model yeniden çağrılır | The model is called again because the text differs
- [x] Gömmelerin benzerliği eşiği aşarsa kayıtlı cevap modeli çağırmadan döner | If the embedding similarity exceeds the threshold, the stored answer returns without calling the model
- [ ] İstek doğrudan büyük modele yükseltilir | The request is escalated straight to the large model
Açıklama: Semantik önbellek anahtar eşitliğine değil anlam benzerliğine bakar; eşik aşılırsa model hiç çağrılmaz ve sayaç değişmez. Bu yüzden eşik, değerlendirme setiyle ayarlanmalı ve önbellek kiracıya göre ayrılmalıdır. | A semantic cache looks at similarity of meaning, not key equality; above the threshold no model is called and the meter does not move. That is why the threshold must be tuned on the evaluation set and the cache scoped per tenant.
:::

:::animation{scene="semantic-cache.scene.json"}
Iskalayan soru küçük modele gider ve önbelleğe yazılır; anlamca aynı soru önbellekten döner; karmaşık soru büyük modele yükseltilir, gece işleri toplu kuyruktan indirimli işlenir.
:::

:::interactive{type="cache" capacity=6 policy="lru"}
Altı slotlu önbelleği bir semantik önbellek gibi düşünün: her anahtar (A–H) bir soru kalıbını, veritabanı ise pahalı LLM çağrısını temsil ediyor. Önbellek boşken birkaç anahtar okuyun; her "miss" bir model çağrısı demektir. "Rastgele 10 okuma" ile isabet oranının nasıl yükseldiğini izleyin ve DB okuma sayacını model çağrısı faturası olarak okuyun. Kapasiteyi küçültüp LRU'nun hangi soruyu attığını görün, sonra politikayı LFU'ya çevirip sık sorulan soruların slotta kalıp kalmadığını karşılaştırın.
:::

:::diagram{src="diagram.svg" alt="İstek yolu ve maliyet kaldıraçları: gelen soru önce semantik önbelleğe bakar, isabet varsa anında döner; ıskalarsa yönlendirici küçük ya da büyük modele gönderir; prompt önbelleği sabit ön eki ucuzlatır; cevap akışla kullanıcıya gider; toplu işler ayrı kuyruktan indirimli işlenir; tüm çağrılar bütçe sayacına yazılır|Request path and cost levers: an incoming question first checks the semantic cache and returns instantly on a hit; on a miss a router sends it to a small or large model; prompt caching makes the static prefix cheaper; the answer streams to the user; batch jobs run discounted from a separate queue; every call is recorded in a budget counter"}
En ucuz LLM çağrısı hiç yapılmayandır; ikinci en ucuzu doğru boyuttaki modele, önbelleğe alınmış bir ön ekle yapılandır.
:::

:::code{lang="python" title="Kiracıya ayrılmış semantik önbellek: eşik, TTL ve geçersiz kılma"}
```python
import time
import numpy as np

class SemanticCache:
    def __init__(self, embed, threshold: float = 0.92, ttl_s: int = 3600, capacity: int = 10_000):
        self.embed, self.threshold, self.ttl, self.capacity = embed, threshold, ttl_s, capacity
        self.rows: list[dict] = []      # üretimde: vektör DB + kiracı filtresi

    def get(self, tenant: str, question: str) -> str | None:
        q = self.embed(question)                          # normalize vektör
        now, best, best_score = time.time(), None, 0.0
        for r in self.rows:
            if r["tenant"] != tenant or now - r["at"] > self.ttl:
                continue                                  # başka kiracı ya da bayat girdi
            score = float(q @ r["vec"])
            if score > best_score:
                best, best_score = r, score
        if best and best_score >= self.threshold:
            best["last_hit"] = now                        # LRU için
            return best["answer"]
        return None

    def put(self, tenant: str, question: str, answer: str, sources: list[str]):
        if len(self.rows) >= self.capacity:               # LRU tahliye
            self.rows.remove(min(self.rows, key=lambda r: r["last_hit"]))
        now = time.time()
        self.rows.append({"tenant": tenant, "vec": self.embed(question), "answer": answer,
                          "sources": set(sources), "at": now, "last_hit": now})

    def invalidate_source(self, source_id: str):
        """Kaynak belge değişince ona dayanan tüm cevapları sil."""
        self.rows = [r for r in self.rows if source_id not in r["sources"]]

def answer(cache: SemanticCache, rag, tenant: str, question: str) -> str:
    if (hit := cache.get(tenant, question)) is not None:
        return hit                                        # model çağrısı yok: 0 token, ~10 ms
    out = rag.answer(question)
    if out["cited"] and not out.get("personal"):          # kişisel ya da kaynaksız cevabı önbelleğe alma
        cache.put(tenant, question, out["answer"], out["cited"])
    return out["answer"]
```
:::

## Akış ve algılanan gecikme

Kullanıcı açısından önemli olan çoğu zaman toplam süre değil, **ilk tepkinin ne zaman geldiğidir**. **Akış (streaming)** modunda sağlayıcı cevabı token token gönderir ve arayüz metni üretildikçe gösterir. Toplam süre değişmez ama kullanıcı ilk kelimeleri TTFT kadar bir sürede görür ve okumaya başlar; on saniyelik bir cevap boş bir ekranla on saniye beklemekten çok daha kısa hissettirir. Sohbet arayüzleri için akış neredeyse zorunludur.

Akışın üç mühendislik bedeli vardır. Birincisi, çıktı guardrail'leri tam cevabı beklemeden çalışamaz; ya parçalar hâlinde kontrol yapılır ya da kritik kontroller cevap bittikten sonra uygulanıp gerekirse cevap geri çekilir. İkincisi, yapılandırılmış çıktı (JSON) akış hâlinde yarım gelir ve ayrıştırılması zorlaşır. Üçüncüsü, sunucu tarafında bağlantı yönetimi (SSE ya da WebSocket, zaman aşımları, kullanıcı sayfayı kapatınca üretimi iptal etmek) gerekir. İptal özellikle önemlidir: kullanıcı ayrıldığı hâlde üretilmeye devam eden tokenlar boşa faturalanır.

Gecikmeyi azaltmanın diğer yolları da şunlardır: bağımsız adımları paralel çalıştırmak (getirme ile girdi guardrail'i aynı anda), çıktı uzunluğunu `max_tokens` ve net talimatla sınırlamak, kullanıcıya en yakın bölgedeki uç noktayı kullanmak ve ajan döngülerinde gereksiz adımları azaltmak.

## Toplu işleme

Her iş gerçek zamanlı değildir. Gece çalışan belge sınıflandırma, binlerce ürün açıklamasının çevirisi ya da değerlendirme setinin tamamının puanlanması dakikalar ya da saatler içinde bitse yeterlidir. Birçok sağlayıcı bu tür işler için **toplu işleme (batch)** arayüzü sunar: istekleri bir dosya hâlinde gönderirsiniz, sağlayıcı boş kapasitesinde işler ve sonuçları belirli bir süre içinde döndürür. Karşılığında token fiyatında ciddi bir indirim (çoğu zaman yaklaşık yarısı) uygulanır. Gerçek zamanlı ve toplu trafiği ayrı kuyruklara ayırmak, gerçek zamanlı trafiğin hız sınırlarını da korur.

## Bütçe takibi

Ölçmediğiniz maliyeti yönetemezsiniz. Her LLM çağrısında sağlayıcının döndürdüğü gerçek giriş, önbellekten okunan ve çıkış token sayılarını; model adını, prompt sürümünü, özelliği, kiracıyı ve kullanıcıyı loglayın. Bu kayıtlardan üç pano üretilir: özellik başına günlük maliyet, kullanıcı başına maliyet dağılımı (ortalama değil, en pahalı yüzde birlik dilim) ve önbellek isabet oranları. Bütçe aşımı için alarmlar ve kullanıcı ya da kiracı başına **kotalar** koyun; döngüye giren tek bir ajan ya da kötüye kullanan tek bir hesap, bir günde aylık bütçeyi tüketebilir. Hız sınırlama dersinde gördüğümüz token bucket gibi teknikler burada istek yerine token sayısı üzerinden uygulanabilir.

:::realworld{company="Anthropic"}
Anthropic, Ağustos 2024'te Claude API'sinde prompt önbelleğini duyurduğunda uzun prompt'lu kullanım senaryolarında maliyetin yüzde 90'a, gecikmenin yüzde 85'e kadar azalabileceğini açıkladı. Mekanizmada geliştirici, prompt'un önbelleğe alınacak sabit kısmını işaretler; önbellekten okunan tokenlar normal giriş fiyatının küçük bir kesriyle faturalanır, önbelleğe yazma ise normalden biraz pahalıdır. Örnek senaryolar arasında uzun bir belgeyle sohbet, çok sayıda örnek içeren prompt'lar ve büyük bir kod tabanını bağlam olarak taşıyan kodlama asistanları sayıldı. Diğer büyük sağlayıcılar da benzer, bazıları otomatik çalışan prompt önbelleği mekanizmaları sunuyor; hepsinde ortak kural, sabit içeriğin prompt'un başında durmasıdır.
:::

:::callout{tone="warning" title="Semantik önbellek bir veri sızıntısı kanalı olabilir"}
Kiracıya ve kullanıcıya göre ayrılmamış bir semantik önbellek, bir müşterinin kişisel bilgilerini içeren cevabı benzer soruyu soran başka bir müşteriye döndürebilir. Önbelleği yetki sınırlarıyla ayırın ve kişisel veri içeren cevapları hiç önbelleğe almayın.
:::

:::callout{tone="tip" title="Mülakat özeti"}
- En büyük tasarruf doğru boyuttaki modelden gelir: yönlendirme ve kademeli yükseltme, değerlendirme setiyle doğrulanarak.
- Prompt önbelleği için sabit kısımlar başta, değişkenler sonda; semantik önbellek için eşik, kiracı ayrımı, TTL ve geçersiz kılma.
- Akış algılanan gecikmeyi, toplu işleme maliyeti düşürür; her çağrıyı loglayıp kotalarla bütçeyi koruyun.
:::

:::quiz{src="quiz.json"}
:::

:::next{lesson="n-01-sessions-vs-tokens"}
Modül tamamlandı. Sırada güvenlik modülü: kullanıcıyı tanımanın temeli olan oturum ve token karşılaştırmasıyla kimlik doğrulama.
:::

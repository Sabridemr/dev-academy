---
id: m-06-agents-tool-use
slug: agents-tool-use
module: m-llm-applications
order: 6
title:
  tr: "Ajanlar ve Araç Kullanımı"
  en: "Agents and Tool Use"
summary:
  tr: "Araç çağırma döngüsü, planlama, bellek, MCP ile araç sunma ve ajan güvenliği."
  en: "The tool-calling loop, planning, memory, exposing tools with MCP and agent safety."
durationMinutes: 35
level: advanced
tags: [llm, agents, tool-use, mcp, security, production]
prerequisites: [g-05-llms, m-05-evaluation]
concepts: [agent-loop, tool-calling, tool-schema, tool-error-handling, planning, agent-memory, mcp, least-privilege, human-in-the-loop]
---

## Kavram: cevap veren modelden iş yapan sisteme

Şimdiye kadar kurduğumuz sistemlerde model tek bir şey yapıyordu: kendisine verilen bağlamı okuyup metin üretmek. Getirme bile uygulamanın kararıydı; hangi belgelerin bağlama gireceğini kod belirliyordu. **Ajan (agent)**, bu kontrolün bir kısmını modele devreden sistemdir: model, bir hedefe ulaşmak için hangi adımları atacağına, hangi aracı hangi argümanlarla çağıracağına ve ne zaman durulacağına kendisi karar verir. Uygulama ise bu kararları güvenli biçimde yürüten, sonuçlarını modele geri veren ve sınırları koruyan bir çalıştırıcıdır.

Bu güç bir bedelle gelir. Akış artık önceden bilinmez; aynı istek bir seferinde iki, başka bir seferinde sekiz araç çağrısıyla sonuçlanabilir. Maliyet ve gecikme değişkendir, hatalar zincirleme büyüyebilir ve model gerçek dünyada eylem yapabildiği için yanlış bir karar yanlış bir cümleden çok daha pahalıdır. Bu yüzden ilk kural şudur: **ajan, gerçekten gerektiğinde kullanılmalıdır.** Adımları önceden bilinen bir iş (ör. "belgeyi özetle, sonra çevir, sonra e-postala") sabit bir iş akışı olarak kodlanmalıdır; ajan, adımların girdiye göre değiştiği açık uçlu görevler içindir.

## Araç çağırma döngüsü

Modern LLM API'leri **araç çağırmayı (tool calling / function calling)** yerel olarak destekler. Uygulama, isteğe her aracın adını, ne işe yaradığını anlatan bir açıklamayı ve argümanlarının JSON şemasını ekler. Model cevap olarak metin yerine "şu aracı şu argümanlarla çağır" anlamına gelen yapılandırılmış bir blok döndürebilir. Önemli olan şudur: **model aracı kendisi çalıştırmaz.** Aracı uygulamanız çalıştırır, sonucu bir "araç sonucu" mesajı olarak sohbete ekler ve modeli yeniden çağırır. Model ya yeni bir araç ister ya da nihai cevabı verir.

Döngü şöyle ilerler:

1. Kullanıcının isteği ve araç tanımları modele gönderilir.
2. Model bir araç çağrısı döndürür (ör. `hava_durumu(sehir="İstanbul", gun="yarin")`).
3. Çalıştırıcı argümanları doğrular, aracı çalıştırır ve sonucu (ya da hatayı) **gözlem** olarak geçmişe ekler.
4. Model gözlemi okuyup bir sonraki adıma karar verir: yeni bir araç ya da cevap.
5. Model araç istemeyi bıraktığında ya da bir sınır (adım, süre, bütçe) aşıldığında döngü biter.

Aşağıdaki animasyon, iki araç kullanan bir ajanın bu döngüyü nasıl dolaştığını gösteriyor.

:::animation{scene="scene.json"}
Kullanıcı sorusu → LLM araç çağrısına karar verir → çalıştırıcı hava durumu ve sipariş veritabanı araçlarını çağırır → gözlemler LLM'e döner → LLM cevabı üretir.
:::

## İyi bir araç nasıl tasarlanır?

Model araçlarınızı yalnızca adları, açıklamaları ve şemaları üzerinden tanır. Bu yüzden araç tasarımı, prompt mühendisliğinin bir parçasıdır ve ajan kalitesini model seçiminden daha çok etkileyebilir.

| İlke | Kötü | İyi |
|---|---|---|
| **Açık ad ve açıklama** | `get_data(q)` | `siparis_durumu(siparis_no)`: "Siparişin kargo durumunu ve tahmini teslim tarihini döndürür. Sipariş numarası bilinmiyorsa önce `siparis_ara` kullan." |
| **Dar ve sıkı şema** | `{"params": "string"}` | `siparis_no` için desen, `gun` için `enum: ["bugun", "yarin"]` |
| **Az ve öz çıktı** | 50 KB'lık ham API yanıtı | Yalnızca karar için gereken 5–6 alan |
| **Anlamlı hata** | `500 Internal Error` | `"Sipariş bulunamadı. Numara 10 haneli olmalı; kullanıcıya teyit ettir."` |
| **Az sayıda araç** | Benzer işi yapan 40 araç | Birbirinden net ayrışan 5–10 araç |

Hata mesajları özellikle önemlidir. Model bir araç hatasını okuyup davranışını düzeltebilir — ama yalnızca hata ona ne yapacağını söylüyorsa. "Zaman aşımı, birkaç saniye sonra tekrar denenebilir" ile "Bu kullanıcının bu siparişi görme yetkisi yok, tekrar deneme" arasındaki fark, ajanın yeniden denemesi mi yoksa kullanıcıya açıklama yapması mı gerektiğini belirler.

## Hatalar, yeniden deneme ve sınırlar

Araçlar dış sistemlerdir ve dış sistemler düşer. Bir ajan çalıştırıcısı bu yüzden klasik dağıtık sistem disiplinini uygulamalıdır. **Geçici hatalarda** (zaman aşımı, 429, 503) çalıştırıcı aracı modele sormadan, üstel bekleme ile sınırlı sayıda yeniden dener. **Kalıcı hatalarda** (doğrulama hatası, yetki yok, kayıt bulunamadı) yeniden deneme anlamsızdır; hata açıklayıcı bir gözlem olarak modele verilir ve model başka bir yol seçer. **Yan etkili araçlarda** (ödeme, e-posta gönderme, kayıt silme) yeniden deneme ancak araç idempotent ise güvenlidir; bunun için her çağrıya bir idempotency anahtarı eklemek gerekir, aksi hâlde bir zaman aşımı sonrası müşteriye iki kez para iade edebilirsiniz.

Döngünün kendisi de sınırlandırılmalıdır. Modelin aynı aracı aynı argümanlarla tekrar tekrar çağırdığı döngüler gerçek bir üretim sorunudur. En az üç sınır koyun: azami adım sayısı, toplam süre ve toplam token ya da para bütçesi. Sınır aşıldığında ajan sessizce durmamalı; o ana kadar topladığı bilgiyle kısmi bir cevap vermeli ya da işi bir insana devretmelidir.

:::interactive{type="pipeline" stages=4 failureStage=3 retries=1}
Hattın her aşamasını bir ajan adımı gibi düşünün: plan, araç çağrısı, gözlem, cevap. "Hata enjekte et" kutusunu işaretleyip "Hata aşaması" listesinden bir aşama seçin; bu, araç çağrısının zaman aşımına uğraması gibidir. "Yeniden deneme" değeri 1 iken hattı çalıştırın ve logda geçici hatanın bir kez yeniden denendiğini izleyin. Değeri 0'a çekip tekrar çalıştırın: tek bir hata tüm akışı durduruyor ve sonraki aşamalar hiç çalışmıyor. Yan etkili bir araçta yeniden denemenin neden idempotency anahtarı gerektirdiğini düşünün.
:::

:::code{lang="python" title="Minimal ajan döngüsü: araç çağrısı, gözlem, geçici hatada yeniden deneme ve adım sınırı"}
```python
import json, time
import anthropic   # diğer sağlayıcılarda da yapı aynıdır: araç şeması → araç çağrısı → araç sonucu

client = anthropic.Anthropic()
MODEL = "..."      # kullandığınız modelin kimliği

TOOLS = [{
    "name": "hava_durumu",
    "description": "Bir şehir için bugün veya yarının hava tahminini döndürür.",
    "input_schema": {"type": "object",
                     "properties": {"sehir": {"type": "string"},
                                    "gun": {"type": "string", "enum": ["bugun", "yarin"]}},
                     "required": ["sehir", "gun"]},
}]

class TransientError(Exception): ...

REGISTRY = {"hava_durumu": lambda sehir, gun: weather_api.forecast(sehir, gun)}  # ad → gerçek fonksiyon

def run_tool(name: str, args: dict, retries: int = 1) -> tuple[str, bool]:
    for attempt in range(retries + 1):
        try:
            return json.dumps(REGISTRY[name](**args), ensure_ascii=False), False
        except TransientError:
            time.sleep(2 ** attempt)                 # geçici hata: modele sormadan yeniden dene
        except Exception as e:                        # kalıcı hata: açıklayıcı gözlem olarak geri ver
            return f"Hata: {e}", True
    return "Hata: servis şu an yanıt vermiyor, başka bir yol dene ya da kullanıcıya bildir.", True

def run_agent(question: str, max_steps: int = 6) -> str:
    messages = [{"role": "user", "content": question}]
    for _ in range(max_steps):
        resp = client.messages.create(model=MODEL, max_tokens=1024, tools=TOOLS, messages=messages)
        if resp.stop_reason != "tool_use":
            return "".join(b.text for b in resp.content if b.type == "text")
        messages.append({"role": "assistant", "content": resp.content})
        results = []
        for block in resp.content:
            if block.type == "tool_use":
                output, is_error = run_tool(block.name, block.input)
                results.append({"type": "tool_result", "tool_use_id": block.id,
                                "content": output, "is_error": is_error})
        messages.append({"role": "user", "content": results})
    return "Adım sınırına ulaşıldı; talebi bir temsilciye aktarıyorum."
```
:::

## Planlama ve bellek

Basit görevlerde model bir sonraki adımı her turda yeniden düşünerek ilerler; bu, "düşün, eyle, gözle" kalıbı olarak bilinir. Uzun görevlerde ise önce açık bir **plan** yazdırmak (adım listesi) ve her adımdan sonra planı güncellemek, ajanın hedeften sapmasını azaltır. Planı kullanıcıya göstermek de iyi bir uygulamadır: kullanıcı yanlış anlaşılan bir hedefi daha ilk adımda düzeltebilir.

**Bellek** iki düzeyde düşünülür. Kısa süreli bellek, döngü boyunca biriken mesaj geçmişidir ve ilk derste gördüğümüz bağlam penceresi sınırına tabidir; uzun görevlerde eski araç çıktılarını özetlemek ya da yalnızca son birkaç gözlemi tam tutmak gerekir. Uzun süreli bellek ise oturumlar arasında kalıcı bilgidir: kullanıcı tercihleri, önceki görevlerin sonuçları. Bu genellikle ajanın okuyup yazabildiği bir araç (not defteri, anahtar–değer deposu ya da vektör dizini) olarak uygulanır. Belleğe ne yazılacağını sınırlamak önemlidir; doğrulanmamış bir bilgi belleğe girerse sonraki oturumlarda olgu gibi kullanılır.

Tek bir ajan çok fazla araç ve sorumlulukla zorlandığında iş **çoklu ajan** yapısına bölünebilir: bir yönetici ajan görevi alt görevlere ayırır, her biri dar araç setine sahip uzman ajanlara gider. Bu yapı bağlamı temiz tutar ama koordinasyon maliyeti, gecikme ve hata ayıklama zorluğu getirir; tek ajanla ölçülebilir bir sorun yaşamadan başvurulmamalıdır.

## MCP: araçları standart biçimde sunmak

Her uygulamanın her araç için kendi entegrasyonunu yazması hızla sürdürülemez hâle gelir. **Model Context Protocol (MCP)**, bu sorunu çözmek için önerilmiş açık bir protokoldür. Bir **MCP sunucusu** araçlarını (ve okunabilir kaynaklarını, hazır prompt şablonlarını) standart bir biçimde tanımlar; bir **MCP istemcisi** olan herhangi bir ajan uygulaması bu sunucuya bağlanıp araçları listeleyebilir ve çağırabilir. Böylece bir kez yazılan "sipariş veritabanı" sunucusu birden çok ajan ve uygulama tarafından kullanılabilir. Sunucular yerelde standart giriş–çıkış üzerinden ya da uzakta HTTP üzerinden çalışabilir.

MCP, araçları sunmanın biçimini standartlaştırır ama güvenliği sizin yerinize çözmez. Bir MCP sunucusu ajanınıza yeni bir yetenek, dolayısıyla yeni bir saldırı yüzeyi ekler; güvenilmeyen bir sunucunun araç açıklamaları bile modele talimat sızdırabilir. Sunucuları bağımlılık gibi değerlendirin: kaynağını doğrulayın, sürümünü sabitleyin, verdiği yetkiyi en aza indirin.

## Ajan güvenliği

Ajanlar, LLM'lerin bilinen zayıflıklarını eylemle birleştirir. Bir web sayfasından, e-postadan ya da araç çıktısından gelen metin modele talimat gibi görünebilir (dolaylı prompt enjeksiyonu) ve model bu talimatla bir aracı çağırabilir. Bir sonraki derste bu saldırıları ayrıntılı göreceğiz; ajan tasarımında uygulanacak temel ilkeler şunlardır:

- **En az ayrıcalık**: Her araç yalnızca görevi için gereken izinle çalışsın. Sipariş durumunu okuyan bir araç, sipariş silme yetkisine sahip bir veritabanı kullanıcısıyla bağlanmasın.
- **Kullanıcı adına yetki**: Araçlar ajanın değil, isteği yapan kullanıcının yetkileriyle çalışsın; model başka bir kullanıcının kimliğini argüman olarak verse bile erişim katmanı bunu reddetsin.
- **İnsan onayı**: Geri alınamaz ya da yüksek etkili eylemler (para transferi, toplu e-posta, üretim veritabanında yazma) çalışmadan önce kullanıcıya açık bir özetle onaylatılsın.
- **İzlenebilirlik**: Her adım, araç çağrısı, argüman ve sonuç bir iz (trace) olarak kaydedilsin; beşinci derste gördüğümüz değerlendirme bu izler üzerinde yapılır.

:::diagram{src="diagram.svg" alt="Ajan çalıştırıcısının kontrol noktaları: LLM araç çağrısı üretir, çalıştırıcı şema doğrulama, kullanıcı yetkisi, insan onayı ve sınırlar katmanlarından geçirir; okuma araçları, yan etkili araçlar ve MCP sunucuları sağda; tüm adımlar iz kaydına yazılır|Agent runtime checkpoints: the LLM produces a tool call, the runtime passes it through schema validation, user authorisation, human approval and limits; read tools, side-effecting tools and MCP servers on the right; every step is written to a trace"}
Güvenlik modelin iyi niyetine değil, çalıştırıcıdaki kontrol noktalarına dayanır.
:::

:::realworld{company="Anthropic"}
Anthropic, Kasım 2024'te Model Context Protocol'ü (MCP) açık kaynaklı bir standart olarak duyurdu ve dosya sistemi, GitHub, Slack, PostgreSQL gibi sistemler için örnek sunucular yayımladı. Amaç, her yapay zekâ uygulaması ile her veri kaynağı arasında ayrı ayrı yazılan entegrasyonları tek bir protokolle değiştirmekti. Protokol kısa sürede başka yapay zekâ sağlayıcıları, geliştirici araçları ve IDE'ler tarafından da benimsendi; bugün birçok şirket iç sistemlerini ajanlara MCP sunucuları aracılığıyla açıyor. Protokolün belgeleri, araç çağrılarından önce kullanıcı onayı alınmasını ve sunucuların en az ayrıcalıkla çalıştırılmasını açıkça öneriyor.
:::

:::callout{tone="danger" title="Model aracı çalıştırmaz, siz çalıştırırsınız"}
Modelin ürettiği argümanlar güvenilmeyen girdidir. Her araç çağrısında şemayı doğrulayın, yetkiyi kullanıcı bağlamında kontrol edin ve modelin ürettiği bir metni asla doğrudan kabuk komutu, SQL ya da `eval` olarak çalıştırmayın.
:::

:::callout{tone="tip" title="Mülakat özeti"}
- Ajan = model kararı + çalıştırıcı döngüsü; adımlar önceden biliniyorsa sabit iş akışı daha iyidir.
- Geçici hatada çalıştırıcı yeniden dener, kalıcı hatada açıklayıcı gözlem modele döner; yan etkili araçlar idempotent olmalıdır.
- Adım, süre ve bütçe sınırı; en az ayrıcalık; yüksek etkili eylemlerde insan onayı.
:::

:::quiz{src="quiz.json"}
:::

:::next{lesson="m-07-guardrails-hallucination"}
Sırada: modelin söylediklerini ve yaptıklarını sınırlamak — girdi/çıktı filtreleri, prompt enjeksiyonu ve halüsinasyon yönetimi.
:::

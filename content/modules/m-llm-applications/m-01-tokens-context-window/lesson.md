---
id: m-01-tokens-context-window
slug: tokens-context-window
module: m-llm-applications
order: 1
title:
  tr: "Token, Bağlam Penceresi ve Maliyet"
  en: "Tokens, Context Windows and Cost"
summary:
  tr: "LLM'lerin metni nasıl böldüğü, bağlam penceresinin sınırları, giriş/çıkış token maliyeti ve kesme stratejileri."
  en: "How LLMs split text, context window limits, input/output token cost and truncation strategies."
durationMinutes: 30
level: intermediate
tags: [llm, tokens, context-window, cost, production]
prerequisites: [g-05-llms]
concepts: [token, tokenizer, context-window, input-output-tokens, token-cost, prefill-decode, truncation, lost-in-the-middle]
---

## Kavram: modelin gördüğü dünya tokenlardan ibaret

Yapay zekâ dersinde büyük dil modellerinin metni **token** adı verilen parçalara bölerek okuduğunu gördük. Bu modülde aynı modele bir mühendis gözüyle bakacağız: bir LLM'i ürün içine yerleştirdiğinizde karşınıza çıkan ilk üç sınır — ne kadar metin gönderebileceğiniz, ne kadar beklemeniz gerektiği ve faturanın ne kadar tutacağı — hep aynı birimle ölçülür. Kelime değil, karakter değil, sayfa değil: token.

Bir uygulama geliştiricisi için tokenı şöyle düşünmek yeterlidir: model, sabit boyutlu bir sözlükteki (tipik olarak 50 000 ile 200 000 arası girdi) parçaların kimlik numaralarını görür. "merhaba" tek bir token olabilir, "yapılandırılamayanlardan" ise beş altı parçaya ayrılabilir. Model ne giriş metninin harflerini ne de sizin aklınızdaki kelime sınırlarını bilir; yalnızca bu numara dizisini işler ve yine bir numara dizisi üretir. Ürettiği numaralar sonra tekrar metne çevrilir.

Bu basit gerçeğin üretimde üç somut sonucu var:

1. **Sınırlar token cinsindendir.** Bağlam penceresi "128 bin token" diye ifade edilir; bu, kaç sayfa Türkçe metin ettiğini ancak tokenizer'ı çalıştırarak bilebilirsiniz.
2. **Fatura token cinsindendir.** Sağlayıcılar milyon token başına fiyat verir ve giriş ile çıkış tokenlarını ayrı fiyatlandırır.
3. **Gecikme token cinsindendir.** Uzun bir girdi işlenmesi gereken bir yüktür; uzun bir çıktı ise tek tek üretilmesi gereken tokenlar demektir.

## Tokenizer neden önemli?

Tokenizer'lar çoğunlukla eğitim korpusundaki sık karakter dizilerini birleştiren bir algoritmayla (BPE ve türevleri) üretilir. Korpus ağırlıklı olarak İngilizce ve kod olduğu için İngilizce kelimeler genellikle tek tokenda kalırken Türkçe gibi eklemeli dillerde bir kelime birkaç parçaya bölünür. Aynı anlamı taşıyan bir paragraf Türkçede İngilizcesine göre belirgin biçimde daha fazla token tutabilir. Bu fark küçük bir ayrıntı gibi görünse de günde milyonlarca istek alan bir üründe doğrudan maliyete ve sığdırabileceğiniz bağlama yansır.

Tokenizer'ın sürpriz yaptığı diğer yerler şunlardır:

- **Sayılar**: "2026" tek token olabilir, "20261020" üç parçaya bölünebilir. Modelin uzun sayılarla aritmetikte zorlanmasının nedenlerinden biri, basamakların tutarsız gruplanmasıdır.
- **Boşluk ve girinti**: Kodda dört boşluk bir token, iki sekme başka bir token olabilir. Gereksiz biçimlendirme, JSON içindeki girinti ve uzun satır sonu dizileri sessizce token harcar.
- **Emoji ve nadir karakterler**: Sözlükte yoksa UTF-8 baytlarına düşer; tek bir emoji birkaç token tutabilir.
- **Model değişikliği**: Farklı model aileleri farklı tokenizer kullanır. Bir modelde 1 000 token tutan metin diğerinde 1 200 tutabilir; maliyet hesabınızı model değiştirirken yeniden yapmanız gerekir.

:::interactive{type="tokenizer" text="Yapılandırılamayanlardan mısınız? Sipariş no 20261020, toplam 1499,90 TL."}
Cümledeki uzun Türkçe kelimenin kaç parçaya bölündüğüne ve sayıların nasıl gruplandığına bakın. Aynı cümlenin İngilizcesini yazıp token sayısını karşılaştırın. Birleştirme sayısı kaydırıcısını azaltarak sözlük küçüldükçe token sayısının nasıl arttığını, "Byte fallback" sayacında da sözlükte olmayan karakterlerin bayt tokenlarına düştüğünü izleyin.
:::

## Bağlam penceresi: modelin kısa süreli belleği

**Bağlam penceresi (context window)**, modelin tek bir çağrıda görebileceği toplam token sayısıdır ve hem girdiyi hem de üretilecek çıktıyı kapsar. Model önceki çağrıları hatırlamaz; bir sohbet uygulaması "hatırlıyor" gibi görünüyorsa bunun nedeni, uygulamanın her turda geçmiş mesajların tamamını ya da bir özetini yeniden göndermesidir. Yani bağlam penceresi bir veritabanı değil, her istekte sıfırdan doldurulan bir çalışma masasıdır.

Bir üretim isteğinin bağlamı genellikle beş parçadan oluşur: sistem talimatı, araç tanımları, getirilen belgeler, sohbet geçmişi ve kullanıcının son mesajı. Bunlara bir de **çıktı için ayrılan pay** eklenmelidir; `max_tokens` (ya da benzeri) parametresiyle verdiğiniz üst sınır pencereden düşülür. Pencere 128 bin token ise ve 4 bin tokenlık bir cevap istiyorsanız, girdiye en fazla 124 bin token kalır.

:::diagram{src="diagram.svg" alt="Bağlam penceresi bütçesi: sistem talimatı, araç tanımları, getirilen belgeler, sohbet geçmişi, kullanıcı mesajı ve çıktı payı tek bir çubukta; altta prefill ve decode aşamaları|Context window budget: system prompt, tool definitions, retrieved documents, chat history, user message and output reserve in one bar; below, prefill and decode phases"}
Bağlam penceresi girdi ve çıktının toplamıdır. Çıktı payını ayırmadan girdiyi doldurmak, cevabın yarıda kesilmesine yol açar.
:::

Pencere büyüdükçe her şeyi içine atmak cazip gelir. Ancak üç neden bunu kötü bir varsayılan yapar. Birincisi maliyet: her token her istekte yeniden faturalanır. İkincisi gecikme: model ilk tokenı üretmeden önce tüm girdiyi işlemek zorundadır. Üçüncüsü kalite: araştırmalar, uzun bağlamın ortasına gömülen bilginin başta veya sonda duran bilgiye göre daha az kullanıldığını göstermiştir. Bu etki literatürde **"lost in the middle" (ortada kaybolma)** olarak bilinir. Modeller her nesilde bu konuda iyileşse de, "pencere yeterince büyük, her şeyi koyarım" yaklaşımı hem pahalı hem de kırılgandır.

## Giriş ve çıkış tokenları neden farklı fiyatlanır?

Bir LLM çağrısı iki aşamada çalışır. **Prefill** aşamasında modelin tüm girdi tokenlarını paralel olarak işleyip dikkat (attention) için gereken ara durumu hesaplar. Bu iş GPU'da büyük matris çarpımlarıyla yapılır ve token başına ucuzdur. **Decode** aşamasında ise model her adımda yalnızca bir token üretir, onu girdiye ekler ve bir sonrakine geçer. Bu sıralı işlem donanımı daha az verimli kullanır; bu yüzden çıkış tokenları çoğu sağlayıcıda giriş tokenlarından birkaç kat (tipik olarak 3–5 kat) pahalıdır.

Bu ayrım gecikmeyi de açıklar. Kullanıcının hissettiği bekleme iki bileşenden oluşur:

| Ölçüt | Ne ölçer? | Neye bağlıdır? |
|---|---|---|
| **TTFT** (time to first token) | İlk tokenın gelmesine kadar geçen süre | Girdi uzunluğu, kuyruk, model boyutu |
| **TPOT** (time per output token) | Her yeni tokenın süresi | Model boyutu, donanım, eşzamanlı yük |
| **Toplam süre** | TTFT + çıkış tokenı × TPOT | Özellikle çıktı uzunluğu |

Bir örnekle bakalım: TTFT 0,4 saniye ve token başına 20 milisaniye olan bir modelden 800 tokenlık bir cevap istemek yaklaşık 0,4 + 16 = 16,4 saniye sürer. Aynı cevabı 200 token ile sınırlamak süreyi 4,4 saniyeye indirir. Çıktıyı kısaltmak, girdiyi kısaltmaktan çoğu zaman daha büyük kazanç sağlar.

Maliyet hesabı da aynı mantıkla yapılır: günlük maliyet ≈ istek sayısı × (giriş tokenı × giriş fiyatı + çıkış tokenı × çıkış fiyatı). Aşağıdaki simülatörde örnek fiyatlarla bu hesabı deneyebilirsiniz; gerçek fiyatlar sağlayıcıya ve zamana göre değişir, bu yüzden kendi hesabınızı güncel fiyat listesiyle yapın.

:::interactive{type="token-cost" model="mid" inputTokens=2000 outputTokens=500 requestsPerDay=10000}
Orta sınıf bir modelle istek başına 2 000 giriş ve 500 çıkış tokenı, günde 10 000 istek için aylık maliyeti inceleyin. Önce çıkış tokenını yarıya indirin, sonra giriş tokenını yarıya indirin: hangisi faturayı daha çok düşürüyor? Ardından model sınıfını değiştirip aynı trafikte maliyetin kaç kat değiştiğini karşılaştırın.
:::

## Bağlam dolduğunda: kesme stratejileri

Sohbet uzadıkça, getirilen belge sayısı arttıkça ya da araç çıktıları büyüdükçe bağlam bütçesi tükenir. Bu noktada ne atılacağına uygulama karar vermelidir; sağlayıcıya bırakırsanız istek ya hata verir ya da cevap yarıda kesilir. Yaygın stratejiler şunlardır:

- **Kayan pencere (sliding window)**: En eski mesajları atıp son *N* turu tutmak. Basit ve öngörülebilirdir; ancak kullanıcının ilk mesajda verdiği kritik bir bilgi (ör. "ben vejetaryenim") kaybolabilir.
- **Özetleme**: Eski turları ucuz bir modelle kısa bir özete çevirip özeti sistem talimatının hemen arkasına koymak. Bağlamı korur ama özetleme bir ek çağrı ve bilgi kaybı riski getirir.
- **Sabitleme (pinning)**: Sistem talimatı, kullanıcı tercihleri ve görev tanımı gibi parçaları hiçbir zaman atılmayacak biçimde işaretlemek.
- **Getirme (retrieval)**: Tüm geçmişi tutmak yerine, geçmişi bir arama dizinine yazıp her turda yalnızca ilgili parçaları çağırmak. Bu, üçüncü derste göreceğimiz RAG'ın sohbet geçmişine uygulanmış hâlidir.
- **Araç çıktısını kırpmak**: Bir API'nin döndürdüğü 50 KB'lık JSON'u modele olduğu gibi vermek yerine yalnızca gerekli alanları seçmek. Ajan uygulamalarında en hızlı tükenen bütçe kalemi genellikle budur.

Hangi stratejiyi seçerseniz seçin, sıralama önemlidir: talimatlar ve en kritik bilgiler başta, kullanıcının sorusu en sonda olmalıdır. Uzun bir belgeyle çalışırken soruyu belgenin arkasına koymak, modelin soruyu "taze" görmesini sağlar ve genellikle daha iyi sonuç verir.

:::code{lang="python" title="Token bütçesi: çıktı payını ayır, geçmişi sondan doldur"}
```python
import tiktoken  # yaklaşık sayım için; kendi modelinizin tokenizer'ı varsa onu kullanın

enc = tiktoken.get_encoding("cl100k_base")

def count(text: str) -> int:
    return len(enc.encode(text))

def build_context(system: str, history: list[dict], user_msg: str,
                  window: int = 128_000, output_reserve: int = 4_000) -> list[dict]:
    """Sistem talimatı ve son mesaj sabit; geçmiş yeniden eskiye doğru sığdığı kadar eklenir."""
    budget = window - output_reserve - count(system) - count(user_msg)
    if budget < 0:
        raise ValueError("Sistem talimatı ve son mesaj tek başına pencereyi aşıyor")
    kept: list[dict] = []
    for msg in reversed(history):              # en yeni mesajdan başla
        cost = count(msg["content"]) + 4       # rol ve ayraçlar için küçük pay
        if cost > budget:
            break                               # eskileri at (ya da özetle)
        kept.append(msg)
        budget -= cost
    return [{"role": "system", "content": system},
            *reversed(kept),
            {"role": "user", "content": user_msg}]
```
```ts
type Msg = { role: 'system' | 'user' | 'assistant'; content: string };

// Kaba tahmin: üretimde modelin kendi tokenizer'ını ya da sağlayıcının sayım uç noktasını kullanın.
const count = (t: string) => Math.ceil(t.length / 3.5);

export function buildContext(system: string, history: Msg[], userMsg: string,
                             window = 128_000, outputReserve = 4_000): Msg[] {
  let budget = window - outputReserve - count(system) - count(userMsg);
  if (budget < 0) throw new Error('Sistem talimatı ve son mesaj pencereyi aşıyor');
  const kept: Msg[] = [];
  for (const m of [...history].reverse()) {
    const cost = count(m.content) + 4;
    if (cost > budget) break;
    kept.unshift(m);
    budget -= cost;
  }
  return [{ role: 'system', content: system }, ...kept, { role: 'user', content: userMsg }];
}
```
:::

## Üretimde token muhasebesi

Token sayımını tahmine bırakmayın. Sağlayıcıların çoğu her cevapta gerçek giriş ve çıkış token sayılarını döndürür (genellikle `usage` alanında); bunları her istekte loglamak, maliyet panolarının ve bütçe alarmlarının temelidir. İstek göndermeden önce sayım gerekiyorsa sağlayıcının tokenizer kütüphanesini ya da token sayım uç noktasını kullanın; "karakter sayısı bölü dört" gibi kurallar İngilizce için kabaca çalışır ama Türkçe metinde, kodda ve JSON'da ciddi sapar.

Ölçülmesi gereken üç değer şunlardır: istek başına ortalama ve 95. yüzdelik giriş tokenı, istek başına çıkış tokenı ve kullanıcı başına günlük token tüketimi. Bir özelliğin maliyeti beklenmedik biçimde arttığında sebep çoğu zaman bu üçünden birinde görünür: sistem talimatına eklenen uzun bir örnek, döngüye giren bir ajan ya da her turda tüm geçmişi yeniden gönderen bir sohbet.

Son olarak `max_tokens` değerini her zaman bilinçli verin. Çok düşük verirseniz cevap cümle ortasında kesilir ve sağlayıcı bunu bir "durma nedeni" alanıyla (ör. `length` ya da `max_tokens`) bildirir; uygulamanız bu durumu yakalayıp kullanıcıya yarım cevap göstermemelidir. Çok yüksek verirseniz kontrolden çıkan bir üretim hem süre hem para yakar.

:::realworld{company="GitHub"}
GitHub Copilot'un kod tamamlama özelliği, bağlam penceresini sınırlı bir kaynak olarak yönetmenin iyi bilinen bir örneğidir. GitHub mühendislik blogunda anlatıldığı üzere Copilot, imlecin önündeki ve arkasındaki kodu, dosya yolunu ve editörde açık olan diğer sekmelerden seçilen benzer kod parçalarını bir "prompt kütüphanesi" ile öncelik sırasına koyar ve pencereye sığacak şekilde birleştirir. Açık sekmelerden bağlam eklemek öneri kalitesini ölçülebilir biçimde artırmıştır; ama hepsi sığmadığı için hangi parçanın gireceğine bir puanlama karar verir. Tamamlama gecikmeye çok duyarlı olduğundan girdi kısa ve çıktı birkaç satırla sınırlı tutulur.
:::

:::callout{tone="warning" title="Türkçe metin daha çok token tutar"}
Maliyet ve kapasite planını İngilizce örnek metinle yapıp Türkçe trafiğe açarsanız tahminleriniz düşük kalır. Hesabı kendi gerçek kullanıcı metinlerinizden alınmış bir örneklem üzerinde, kullanacağınız modelin tokenizer'ıyla yapın.
:::

:::callout{tone="tip" title="Mülakat özeti"}
- Bağlam penceresi = girdi + çıktı; çıktı payını ayırmadan girdiyi doldurmayın.
- Çıkış tokenı pahalı ve yavaştır (decode sıralıdır); cevabı kısaltmak çoğu zaman en ucuz iyileştirmedir.
- Uzun bağlam ≠ iyi bağlam: maliyet, TTFT ve "ortada kaybolma" etkisini birlikte düşünün.
:::

:::quiz{src="quiz.json"}
:::

:::next{lesson="m-02-prompt-engineering"}
Sırada: bu sınırlı pencereye ne yazacağımız — sistem talimatı, örnekler ve yapılandırılmış çıktıyla prompt mühendisliği.
:::

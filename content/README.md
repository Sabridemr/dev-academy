# İçerik Yazım Kılavuzu (`content/`)

Tüm dersler bu klasörde **Markdown + JSON** olarak tutulur. Backend seed scripti (`pnpm db:seed`) bu klasörü okuyup veritabanına yükler; `pnpm content:validate` dosyaları şemalara göre doğrular ve müfredat kapsama raporu üretir.

```
content/
  paths.json                                  → öğrenme yolları
  modules/<module-id>/module.json             → modül bilgisi
  modules/<module-id>/<lesson-id>/
      lesson.md                               → ders (frontmatter + Markdown + directive blokları)
      lesson.en.md                            → (opsiyonel) İngilizce paralel metin
      scene.json | <ad>.scene.json            → animasyon sahneleri (birden fazla olabilir)
      quiz.json                               → quiz
      *.svg                                   → diyagramlar
      <ad>.trace.py → <ad>.trace.json         → kod simülasyonu (kaynak + üretilmiş iz)
```

Modül ve ders kimlikleri `packages/shared/src/content/curriculum.ts` içindeki müfredattan gelir. Klasör adı = `lesson id` olmalıdır (ör. `a-05-load-balancing`).

## Ders dosyası (`lesson.md`)

```md
---
id: a-05-load-balancing
slug: load-balancing
module: a-system-design-fundamentals
order: 5
title:
  tr: Load Balancer
  en: Load Balancer
summary:
  tr: Kısa özet
  en: Short summary
durationMinutes: 20
level: intermediate            # beginner | intermediate | advanced
tags: [load-balancer, scaling]
prerequisites: [a-01-client-server-dns-http]
concepts: [round-robin, least-connections]
---

## Kavram
Serbest Markdown...

:::diagram{src="diagram.svg" alt="Türkçe alt metin|English alt text"}
İsteğe bağlı alt yazı
:::

:::animation{scene="scene.json"}
İsteğe bağlı alt yazı
:::

:::interactive{type="load-balancer" algorithm="round-robin" servers=3}
Kullanıcıya yönerge
:::

:::code{lang="ts" title="Başlık"}
```ts
// ana örnek
```
```python
# alternatif dil sürümü (sekme olarak gösterilir)
```
:::

:::realworld{company="Amazon"}
Gerçek dünya örneği (Markdown)
:::

:::callout{tone="tip" title="İpucu"}
info | tip | warning | danger
:::

:::trace{src="ornek.trace.json" title="Türkçe başlık|English title"}
İsteğe bağlı yönerge
:::

:::quiz{src="quiz.json"}
:::

:::next{lesson="a-06-api-gateway"}
:::
```

Her ders şu sırayı izler: **kavram → diyagram → animasyon → interaktif deney → gerçek dünya örneği → quiz → sonraki adım**.

### Tahmin sorusu (`:::predict`)

Animasyon ya da simülatörden **hemen önce** öğrenciye "sence ne olacak?" diye sorulur
(predict-observe-explain). Önce tahmin edip sonra izlemek, yanlış sezgiyi görünür kılar.

```md
:::predict{id="lb-cokmus-sunucu"}
Soru metni (Markdown) | İsteğe bağlı İngilizce
- [ ] Seçenek A | Option A
- [x] Doğru seçenek B | Option B
- [ ] Seçenek C
Açıklama: Doğru cevap neden B (Markdown, birden fazla satır olabilir). | Why B
:::
```

- `id` zorunlu, kebab-case ve ders içinde benzersiz olmalıdır.
- 2–5 seçenek (`- [ ]`), tam olarak biri `- [x]` ile işaretli. Seçenek id'leri sırayla `a, b, c…` olur.
- `Açıklama:` (ya da `Explanation:`) satırından bloğun sonuna kadarki metin, kullanıcı seçim yaptıktan
  sonra doğru cevapla birlikte gösterilir. Açıklamasız blok `--strict`te uyarı verir.
- Türkçe ve İngilizce, boşlukla çevrili `|` (` | `) ile ayrılır; ayırıcı yoksa metin yalnızca Türkçedir.
  Metnin içinde ayırıcı dışında ` | ` kullanmayın.
- Quiz'in aksine **puanlanmaz**, sunucuya gönderilmez ve ilerlemeyi etkilemez; doğru cevap istemciye gider.
  Soru metni dersin arama metnine eklenir.

### Kaynakça (`:::resources`)

Dersin sonunda (quiz'den sonra) öğrencinin konuyu derinleştirebileceği dış kaynaklar:

```md
:::resources
- [Designing Data-Intensive Applications](https://dataintensive.net/) — kitap — İsteğe bağlı not
- [Using nginx as HTTP load balancer](https://nginx.org/en/docs/http/load_balancing.html) — belge
:::
```

- Her satır `- [Başlık](https://…)`, ardından isteğe bağlı ` — tür` ve ` — not` (ayırıcı `—`, `–` ya da `--`).
- Türler: `kitap` (book), `makale`/`yazı`/`blog` (article), `belge`/`dokümantasyon` (docs), `video`,
  `bildiri`/`akademik makale` (paper), `depo` (repo); İngilizce adlar da kabul edilir. Tanınmayan ilk
  parça not olarak alınır.
- URL `https://` ile başlamalı, en az bir öğe olmalı; `--strict`te 8'den fazla öğe uyarı verir.
- Yalnızca gerçek, erişilebilir ve saygın kaynaklar kullanın (resmi dokümantasyon, tanınmış mühendislik
  blogları, kitaplar, hakemli bildiriler). Emin olmadığınız URL'yi eklemeyin.
- Kaynakça arama metnine eklenmez. Web'de bağlantılar yeni sekmede (`rel="noopener noreferrer"`),
  mobilde sistem tarayıcısında açılır.

### Interaktif türleri

`load-balancer`, `cache`, `rate-limiter`, `consistent-hashing`, `gradient-descent`, `attention`, `neural-network-playground`, `capacity-estimator`, `er-diagram`, `cap-theorem`, `scaling`, `message-queue`, `replication-quorum`, `index-query-plan`, `isolation-levels`, `k-means`, `decision-tree`, `convolution`, `tokenizer`, `embedding-space`, `pipeline`, `kubernetes-hpa`, `request-journey`, `traffic-wave`, `fan-out`, `geo-index`, `sorting-visualizer`, `graph-traversal`, `hash-table`, `big-o-plotter`, `rag-pipeline`, `prompt-playground`, `token-cost`, `oauth-flow`, `jwt-inspector`, `bruteforce-login`, `git-graph`, `rbac-abac`, `threat-model`, `hash-salt`, `regex-playground`

Her türün web ve mobilde bir bileşeni vardır; ek öznitelikler `params` olarak bileşene geçirilir.

## Animasyon sahnesi (`*.scene.json`)

Şema: `packages/shared/schema/animation-scene.schema.json` (VS Code otomatik tamamlama için `"$schema"` alanını kullanın). Örnek: `packages/shared/examples/load-balancer-round-robin.scene.json`.

- `nodes`: tuval (varsayılan 1000×600) üzerinde merkez koordinatlı bileşenler. `kind` ikonu belirler.
- `edges`: bağlantılar; `curvature` ile eğri.
- `steps`: her adımda `narration`, `highlight`, `nodeStates`, `edgeStates`, `packets`, `annotations`. Adımlar varsayılan olarak önceki durumu devralır (`inherit: true`).
- `a11y.description` zorunludur; `prefers-reduced-motion` açıkken paketler animasyonsuz gösterilir ve transkript listelenir.

## İnteraktif parametreler

`:::interactive{type="..." key=value}` bloğundaki her parametre, o simülatörün okuduğu bir anahtar olmalıdır. Kabul edilen anahtarlar `packages/shared/src/content/schema.ts` içindeki `INTERACTIVE_PARAMS` listesindedir; listede olmayan parametre `pnpm content:validate` tarafından hata olarak raporlanır. Bir simülatöre yeni parametre eklerken listeyi de güncelleyin (web birim testi ikisinin uyumunu kontrol eder). Yönerge metni yalnızca simülatörde gerçekten bulunan kontrollere atıf yapmalıdır.

## Quiz (`quiz.json`)

```json
{
  "id": "a-05-load-balancing-quiz",
  "title": { "tr": "Load Balancer Quiz", "en": "Load Balancer Quiz" },
  "passScore": 70,
  "questions": [
    {
      "id": "q1",
      "type": "single",
      "prompt": { "tr": "...", "en": "..." },
      "options": [{ "id": "a", "text": "..." }, { "id": "b", "text": "..." }],
      "correct": ["b"],
      "explanation": { "tr": "...", "en": "..." },
      "difficulty": "easy",
      "concepts": ["round-robin"]
    }
  ]
}
```

Soru tipleri: `single`, `multiple`, `truefalse`, `order`. Her derste 3–6 soru bulunmalıdır (genellikle 5); doğrulayıcı bu aralığın dışını hata sayar. `concepts` alanı yanlış cevaplarda tekrar listesine (spaced repetition) eklenecek kavramı belirler.

## SVG diyagramlar

- `viewBox` zorunlu, sabit `width/height` kullanmayın (responsive).
- Renkleri CSS değişkenleriyle verin: `var(--da-fg)`, `var(--da-muted)`, `var(--da-primary)`, `var(--da-accent)`, `var(--da-surface)`, `var(--da-border)`, `var(--da-success)`, `var(--da-danger)`. Böylece açık/koyu temaya uyum sağlar.
- Metinler için `font-family="inherit"` kullanın.

## Kod simülasyonları (`*.trace.py`)

Python kodunu satır satır oynatan simülasyon: çalışacak satır, çağrı yığını (çerçeveler ve değişkenler), heap'teki
nesneler ve referans okları, çıktı. İz, kodu **gerçekten çalıştırarak** üretilir; istemciler kod çalıştırmaz.

```python
#! heap-primitives                       # (opsiyonel) int/str gibi basit değerleri de heap nesnesi göster
#@ Tek başına not: sonraki satıra bağlanır | English note
a = [1, 2]
b = a  #@ Bu satır çalışmadan önce gösterilir | Shown right before this line runs
```

```bash
pnpm content:traces   # tüm <ad>.trace.py dosyalarından <ad>.trace.json üretir (python3 gerekir)
```

- `#@` yorumları ve `#!` satırları gösterilen koddan çıkarılır; satır numaraları buna göre verilir.
- Üretilen iz kaynağın SHA-256 özetini taşır; kaynak değişip iz yeniden üretilmediyse doğrulayıcı hata verir.
- Kod kısa olsun (≤ 25 satır, en fazla 300 adım). `input()`, rastgelelik, thread ve gerçek dosya yazma kullanmayın.
- Üretici: `packages/shared/scripts/python-trace/tracer.py` (testleri: `python3 -m unittest discover -s packages/shared/scripts/python-trace`).

## Raster görseller (png, jpg, webp)

Ekran görüntüsü, fotoğraf ya da PDF sayfası gibi görseller ders klasörüne konur ve diyagram bloğuyla
kullanılır:

```md
:::diagram{src="sekil-01.png" alt="Türkçe açıklama|English description"}
İsteğe bağlı alt yazı
:::
```

- Seed görseli içerik özetiyle (SHA-256) veritabanına yazar ve API'den `/api/v1/assets/<sha>.<ext>`
  adresiyle, kalıcı önbellekle sunar; MinIO gerekmez, görseller veritabanı yedeğine dahildir.
- Görsel yeniden sıkıştırılmaz; dosya en fazla 15 MB olabilir. Doğrulayıcı bozuk ya da eksik dosyayı hata sayar.
- `alt` metni zorunludur (ekran okuyucu ve arama için); öznitelikte `"`, `}` ve (ayırıcı dışında) `|` kullanmayın.


## Panelden dışa aktarım

Admin panelinde düzenlenip yayınlanan dersler veritabanında yeni bir sürüm olarak durur. Bunları bu klasöre geri
almak için:

```bash
pnpm content:export --lesson a-05-load-balancing   # tek ders (tekrarlanabilir); --lesson yoksa yayındaki tüm dersler
pnpm content:export --out /tmp/content             # başka klasöre yaz (varsayılan: CONTENT_DIR, yani content/)
pnpm content:validate --strict && git diff         # doğrula ve değişiklikleri gözden geçir
```

Ders editöründeki **content/ formatında dışa aktar** düğmesi (yalnızca admin) aynı dosyaları bir pencerede gösterir;
her dosya kopyalanabilir ya da indirilebilir. Çıktı: `lesson.md` (gerekirse `lesson.en.md`), gömülü SVG'ler,
`*.scene.json`, `quiz.json`, `*.trace.json` ve raster görseller.

- Çıktı seed ile yeniden yüklendiğinde aynı blokları üretir; ancak biçim birebir aynı olmayabilir: JSON dosyaları
  `JSON.stringify` girintisiyle yazılır, `:::interactive` parametrelerinin sırası değişebilir, frontmatter'da
  tırnak kullanımı sadeleşir. Blok kimlikleri yazılmaz (ayrıştırıcı tür sırasıyla yeniden üretir).
- `*.trace.py` kaynakları veritabanında tutulmaz; klasördeki mevcut kaynak korunmalıdır (CLI dosya silmez).
- Klasörde aynı içerikli görsel yoksa raster görseller `gorsel-<sha256 ilk 12>.<uzantı>` adıyla yazılır.
- Biçimin taşıyamadığı durumlar (ör. öznitelikte `}`, ardışık iki metin bloğu, iç içe obje parametreler)
  uyarı olarak listelenir.
- Seed, panelde yayınlanmış bir sürümü bu klasördeki ders değişmediği sürece ezmez ve uyarır; içeriği dışa
  aktarıp commit'leyin ya da panel sürümünü bilerek ezmek için `pnpm db:seed -- --force` kullanın.

```bash
pnpm content:validate          # hatalar varsa çıkış kodu 1
pnpm content:validate --strict # uyarıları da hata say
```

Doğrulayıcının içerik kalitesi kuralları:

- **Hata:** üçüncü taraf not seti ifadesi ("tüm hakları yazarına aittir" vb.) — dersler özgün metinle yazılır.
- **Hata:** blok şemaya uymuyor (ör. `:::predict`'te 2–5 seçenek ve tek doğru dışı, tekrarlanan id;
  `:::resources`'ta https olmayan URL ya da boş liste).
- **Uyarı:** açıklamasız `:::predict`; 8'den fazla öğeli `:::resources`; düzyazı 400 kelimenin altında; `order > 1` olan derste `prerequisites` boş; 500 KB üstü raster görsel;
  raster görselde İngilizce alt metin yok (`alt="tr|en"`).

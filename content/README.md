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

:::quiz{src="quiz.json"}
:::

:::next{lesson="a-06-api-gateway"}
:::
```

Her ders şu sırayı izler: **kavram → diyagram → animasyon → interaktif deney → gerçek dünya örneği → quiz → sonraki adım**.

### Interaktif türleri

`load-balancer`, `cache`, `rate-limiter`, `consistent-hashing`, `gradient-descent`, `attention`, `neural-network-playground`, `capacity-estimator`, `er-diagram`, `cap-theorem`, `scaling`, `message-queue`, `replication-quorum`, `index-query-plan`, `isolation-levels`, `k-means`, `decision-tree`, `convolution`, `tokenizer`, `embedding-space`, `pipeline`, `kubernetes-hpa`, `request-journey`, `traffic-wave`, `fan-out`, `geo-index`

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


```bash
pnpm content:validate          # hatalar varsa çıkış kodu 1
pnpm content:validate --strict # uyarıları da hata say
```

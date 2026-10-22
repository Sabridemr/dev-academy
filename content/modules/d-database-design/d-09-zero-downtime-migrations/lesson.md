---
id: d-09-zero-downtime-migrations
slug: zero-downtime-migrations
module: d-database-design
order: 9
title:
  tr: "Sıfır Kesintiyle Şema Değişiklikleri: Expand/Contract"
  en: "Zero-Downtime Schema Changes: Expand/Contract"
summary:
  tr: Geriye uyumlu migration, CONCURRENTLY indeks, NOT NULL tuzağı, partili backfill ve geri alma planı.
  en: Backward-compatible migrations, CONCURRENTLY indexes, the NOT NULL trap, batched backfills and rollback plans.
durationMinutes: 35
level: advanced
tags: [database, migration, postgresql, prisma, deployment, zero-downtime]
prerequisites: [d-03-transactions-acid-isolation, d-07-query-planner-explain]
concepts: [expand-contract, backward-compatible-migration, rolling-deploy, lock-queue, lock-timeout, create-index-concurrently, not-null-constraint, batched-backfill, migration-drift, roll-forward]
---

## Kavram: şema ile kod aynı anda değişmez

Tek sunuculu bir uygulamada şema değişikliği basittir: uygulamayı durdur, migration'ı çalıştır, yeni sürümü başlat. Kesintiye izin verilmeyen bir sistemde bu sıra mümkün değildir. Kubernetes gibi ortamlarda dağıtım **kademeli** (rolling) yapılır: birkaç dakika boyunca eski sürümün pod'ları ile yeni sürümün pod'ları **aynı veritabanına** aynı anda yazar. Migration ise ya bu sürecin başında ya da sonunda tek seferde çalışır.

Bundan çıkan kural, bu dersin özüdür: **her migration, hem kendisinden önceki hem de sonraki uygulama sürümüyle uyumlu olmalıdır.** Bir sütunu tek adımda yeniden adlandırırsanız, eski sürüm hâlâ eski adı sorgularken sütun kaybolur ve eski pod'lar hata vermeye başlar. Çözüm, tek kırıcı değişikliği birkaç uyumlu adıma bölmektir: **expand/contract** (paralel değişiklik) deseni.

:::diagram{src="diagram.svg" alt="Expand/contract zaman çizelgesi: expand migration'ı, çift yazan sürüm, partili backfill, okumanın yeni sütuna geçişi, eski sütuna yazmanın durması ve contract migration'ı; her geçişte yan yana çalışan iki uygulama sürümü|Expand/contract timeline: expand migration, dual-writing release, batched backfill, reads switching to the new column, writes to the old column stopping, and the contract migration; two app versions running side by side at every transition"}
Her kutu ayrı bir dağıtımdır. Kesikli çizgiler, iki sürümün aynı anda çalıştığı pencereleri gösterir; her pencerede şema iki sürümle de uyumludur.
:::

## Expand/contract adım adım

Örnek: `users.name` sütununu `display_name` olarak yeniden adlandırmak.

1. **Expand**: yeni sütunu ekleyen migration (`ADD COLUMN display_name text`, NULL olabilir). Eski kod bu sütunu bilmez, umursamaz.
2. **Çift yazma**: uygulama her yazmada iki sütunu da doldurur, okumayı hâlâ eski sütundan yapar.
3. **Backfill**: eski satırlar arka planda, küçük partiler hâlinde kopyalanır.
4. **Okumayı değiştir**: uygulama yeni sütundan okur, iki sütuna da yazmaya devam eder. Bu noktada geri dönmek hâlâ güvenlidir.
5. **Eski sütuna yazmayı bırak**: kod eski sütunu tamamen unutur.
6. **Contract**: ayrı ve sonraki bir dağıtımda eski sütun silinir.

Altı adım, tek satırlık bir `RENAME COLUMN`'a göre çok uzun görünür. Karşılığında hiçbir an iki sürümden biri bozulmaz ve 5. adıma kadar her adım uygulama sürümünü geri alarak geri dönülebilir.

:::predict{id="rename-rolling-deploy"}
Kademeli dağıtımda migration önce çalışır ve tek adımda `ALTER TABLE users RENAME COLUMN name TO display_name` yapar; yeni sürüm `display_name` kullanır. Dağıtım sürerken ne olur? | In a rolling deploy the migration runs first and does `ALTER TABLE users RENAME COLUMN name TO display_name` in one step; the new release uses `display_name`. What happens while the rollout is in progress?
- [ ] Hiçbir şey; PostgreSQL eski adı bir süre takma ad olarak tutar | Nothing; PostgreSQL keeps the old name as an alias for a while
- [x] Hâlâ çalışan eski sürüm pod'ları `name` sütununu bulamaz ve hata verir | Old-release pods still running cannot find the `name` column and fail
- [ ] Yeni sürüm pod'ları hata verir, eski sürüm çalışır | New-release pods fail while the old release works
- [ ] Migration, eski pod'lar kapanana kadar otomatik bekler | The migration automatically waits until old pods shut down
Açıklama: Yeniden adlandırma anında gerçekleşir ve takma ad bırakmaz. Dağıtım tamamlanana kadar trafiğin bir kısmı eski sürüme gider ve eski sürüm artık var olmayan sütunu sorgular. Expand/contract bu pencereyi iki sütunun birlikte yaşadığı bir döneme çevirir. | The rename is instant and leaves no alias. Until the rollout finishes, part of the traffic still goes to the old release, which queries a column that no longer exists. Expand/contract turns that window into a period where both columns live side by side.
:::

:::animation{scene="scene.json"}
Eski ve yeni uygulama sürümleri aynı anda çalışırken expand → çift yazma → partili backfill → okuma geçişi → contract adımları; her geçişte iki sürüm de şemayla uyumludur.
:::

## Kilit kuyruğu: "hızlı" migration neden sistemi durdurur?

PostgreSQL'de çoğu `ALTER TABLE` kısa da olsa `ACCESS EXCLUSIVE` kilidi ister; bu kilit, tablodaki her okumayı ve yazmayı bloklar. İşlem kendisi milisaniye sürse bile, tabloyu okuyan uzun süreli bir sorgu varsa `ALTER` onun bitmesini bekler. Asıl tehlike buradadır: bekleyen `ALTER`'ın arkasına, normalde birbirini hiç bloklamayan sıradan `SELECT`'ler de dizilir. Birkaç saniyede bağlantı havuzu dolar (d-08) ve uygulama durmuş gibi görünür.

Önlem basittir: migration oturumunda kısa bir `lock_timeout` ayarlayın (ör. `SET lock_timeout = '5s'`). Kilit alınamazsa migration hızlıca düşer, trafik etkilenmez ve tekrar denenir. Büyük ekiplerin migration yardımcıları bu "kısa bekle, düş, tekrar dene" döngüsünü otomatikleştirir.

## PostgreSQL'e özgü tuzaklar

| İşlem | Risk | Güvenli yol |
|---|---|---|
| `ADD COLUMN x text` (NULL olabilir) | Yalnızca katalog değişir, hızlı | Doğrudan; `lock_timeout` ile |
| `ADD COLUMN x int DEFAULT 0` | PostgreSQL 11+'da sabit varsayılan değer de yalnızca katalog değişikliğidir; `clock_timestamp()` gibi değişken (volatile) varsayılan ise tabloyu yeniden yazar | Sabit varsayılan kullanın |
| `ALTER COLUMN x SET NOT NULL` | Tüm tabloyu `ACCESS EXCLUSIVE` kilidi altında tarar | Önce `CHECK (x IS NOT NULL) NOT VALID`, sonra `VALIDATE CONSTRAINT`, sonra `SET NOT NULL` (PostgreSQL 12+ doğrulanmış kısıtı kullanıp taramayı atlar) |
| `CREATE INDEX` | Tablo boyunca yazmaları bloklar | `CREATE INDEX CONCURRENTLY` (transaction bloğu içinde çalışamaz; başarısız olursa geride `INVALID` indeks bırakır, silinip yeniden denenmeli) |
| `ADD FOREIGN KEY` | İki tabloyu kilitleyip tarar | `NOT VALID` ile ekle, sonra ayrı adımda `VALIDATE CONSTRAINT` |
| `ALTER COLUMN TYPE` | Çoğu tür değişikliği tabloyu yeniden yazar | Yeni sütun + backfill + geçiş (expand/contract) |
| `RENAME COLUMN` / `DROP COLUMN` | Hâlâ çalışan eski kod kırılır | Expand/contract; silme en son, ayrı dağıtımda |

`VALIDATE CONSTRAINT` daha hafif bir kilit alır (`SHARE UPDATE EXCLUSIVE`): tarama sürerken okuma ve yazmalar devam eder.

:::code{lang="sql" title="NOT NULL'u kilitlemeden eklemek ve partili backfill"}
```sql
-- 1) Expand: kısa kilit, hızlı düş
SET lock_timeout = '5s';
ALTER TABLE users ADD COLUMN display_name text;

-- 2) Backfill: küçük partiler, her parti kendi transaction'ında (uygulama ya da iş kuyruğu döngüsü)
UPDATE users SET display_name = name
WHERE id IN (
  SELECT id FROM users
  WHERE display_name IS NULL AND name IS NOT NULL
  ORDER BY id LIMIT 1000
);
-- 0 satır güncellenene kadar tekrarla; partiler arasında kısa bekleme replika gecikmesini sınırlar

-- 3) NOT NULL: önce doğrulanmamış kısıt (anlık), sonra hafif kilitle doğrulama
ALTER TABLE users ADD CONSTRAINT users_display_name_nn CHECK (display_name IS NOT NULL) NOT VALID;
ALTER TABLE users VALIDATE CONSTRAINT users_display_name_nn;
ALTER TABLE users ALTER COLUMN display_name SET NOT NULL;   -- PG 12+: tarama yapmaz
ALTER TABLE users DROP CONSTRAINT users_display_name_nn;

-- 4) Büyük tabloda indeks: kendi migration dosyasında, transaction dışında
CREATE INDEX CONCURRENTLY IF NOT EXISTS users_display_name_idx ON users (display_name);
```
:::

**Backfill neden partili?** Tek bir `UPDATE users SET display_name = name` milyonlarca satırı tek transaction'da değiştirir: satır kilitleri uzun süre tutulur, büyük miktarda WAL üretilir, replikalar geride kalır (d-05) ve eski satır sürümleri autovacuum'a yük olur. Kimlik aralığına göre ilerleyen küçük partiler, her biri hızla commit edilen kısa transaction'lar demektir; iş yarıda kesilirse kaldığı yerden devam eder.

## Bu projede migration akışı

Backend, Prisma Migrate kullanır. Şema `backend/prisma/schema.prisma`'da tanımlıdır; her değişiklik `prisma migrate dev` ile `backend/prisma/migrations/<zaman>_<ad>/migration.sql` dosyası olarak üretilir ve üretimde `prisma migrate deploy` ile uygulanır. Üretilen SQL elle düzenlenebilir; d-07'de gördüğümüz GIN arama indeksi de Prisma şemasında ifade edilemediği için elle yazılmış bir migration'dır.

CI'da (`.github/workflows/ci.yml`) bir adım şu komutu çalıştırır:

```bash
prisma migrate diff --exit-code \
  --from-migrations prisma/migrations \
  --to-schema-datamodel prisma/schema.prisma \
  --shadow-database-url "$SHADOW_DATABASE_URL"
```

Komut, migration geçmişini boş bir gölge veritabanında baştan uygular ve sonucu `schema.prisma` ile karşılaştırır; fark varsa sıfırdan farklı çıkış koduyla CI'ı düşürür. Yani biri `schema.prisma`'ya alan ekleyip migration'ı üretmeyi unutursa, bu hata üretime gitmeden yakalanır. Bu kontrol **şemanın tutarlı** olduğunu söyler; migration'ın **sıfır kesintili** olduğunu söylemez. O inceleme insan işidir.

Örnek olarak `20261019141000_bookmark_block_not_null` migration'ı tek dosyada kopyaları siler, NULL değerleri `''` ile doldurur ve `SET NOT NULL` uygular. Küçük bir tabloda bu doğru ve pratik bir tercihtir. Aynı değişiklik milyonlarca satırlık bir tabloda yapılsaydı yukarıdaki tablo devreye girerdi: güncelleme partilere bölünür, `NOT NULL` doğrulanmış bir `CHECK` kısıtıyla eklenir ve şema değişikliği ile veri değişikliği ayrı adımlara ayrılırdı.

:::callout{tone="warning" title="Geri alma planı: çoğu zaman ileri sar"}
Prisma Migrate otomatik "down" migration'ı üretmez; gerekirse `migrate diff` ile ters SQL elle hazırlanır. Pratikte sıfır kesinti yaklaşımında geri alma **uygulama sürümünü** geri almak demektir ve expand/contract bunu güvenli kılar: contract adımına kadar eski sütun yerinde ve günceldir. Contract (sütun silme) geri alınamaz; o yüzden en son ve ayrı yapılır. Veri kaybettiren bir hata için tek gerçek geri alma, test edilmiş bir yedektir.
:::

:::realworld{company="GitLab"}
GitLab, kendi barındırdığı GitLab.com'u ve binlerce kurumun kurduğu sürümleri aynı kod tabanından çalıştırır; bu yüzden migration'larının hem çok büyük tablolarda hem de bakım penceresi olmadan çalışması gerekir. Kamuya açık migration stil rehberi bu dersteki kuralları kod hâline getirir. Migration'lar ikiye ayrılır: dağıtımdan önce çalışan normal migration'lar (expand) ve yeni kod tüm sunuculara yayıldıktan sonra çalışan **post-deployment migration**'lar (contract, ör. sütun silme). Bir sütun silinmeden önce model sınıfında `ignore_column` ile işaretlenir ki hâlâ çalışan kod onu okumaya çalışmasın. Büyük tablolarda indeksler `add_concurrent_index` yardımcısıyla eşzamanlı oluşturulur, kilit gerektiren işlemler `with_lock_retries` ile kısa kilit zaman aşımı ve yeniden denemeyle sarılır, milyonlarca satırlık veri dönüşümleri ise partiler hâlinde arka planda çalışan **batched background migration**'larla yapılır. Veritabanı incelemesi, büyük tabloya dokunan her değişikliği bu yardımcıların kullanılıp kullanılmadığına göre denetler.
:::

:::realworld{company="Stripe"}
Stripe'ın "Online migrations at scale" yazısı, abonelik verisini canlı trafik altında yeni bir veri modeline taşımayı anlatır ve aynı deseni dört adımda özetler: önce eski ve yeni yere birlikte yazmak (dual writing), sonra tüm okuma yollarını yeni modele çevirmek, ardından yazmaları yalnızca yeni modele yapmak ve en son eski veriyi kaldırmak. Geçmiş verinin kopyalanması çevrimdışı bir toplu iş olarak yapılır; okuma yolları değiştirilirken eski ve yeni sonuçlar karşılaştırılarak farklar yakalanır. Yazının ana fikri bu dersin de ana fikridir: büyük bir göç, her biri ayrı ayrı geri alınabilen küçük adımlara bölündüğünde güvenli hâle gelir. MySQL dünyasında GitHub'ın gh-ost'u ve Shopify'ın sürdürdüğü LHM gibi araçlar, tabloyu gölge kopya üzerinden değiştirerek aynı amaca hizmet eder.
:::

:::callout{tone="tip" title="Mülakat özeti"}
- Kademeli dağıtımda iki sürüm aynı anda çalışır: her migration N ve N+1 ile uyumlu olmalı.
- Kırıcı değişiklik → expand, çift yazma, backfill, okuma geçişi, yazmayı bırakma, contract.
- `lock_timeout` olmadan `ALTER TABLE` çalıştırmayın: kilit kuyruğu tüm trafiği durdurur.
- Büyük tabloda `CREATE INDEX CONCURRENTLY`, `NOT VALID` + `VALIDATE`, partili backfill.
- CI'daki şema farkı kontrolü eksik migration'ı yakalar; kesinti riskini ise insan incelemesi yakalar.
:::

:::quiz{src="quiz.json"}
:::

:::resources
- [PostgreSQL: ALTER TABLE](https://www.postgresql.org/docs/current/sql-altertable.html) — belge — kilit düzeyleri, NOT VALID ve VALIDATE CONSTRAINT
- [PostgreSQL: CREATE INDEX (Building Indexes Concurrently)](https://www.postgresql.org/docs/current/sql-createindex.html) — belge — CONCURRENTLY'nin işleyişi ve sınırları
- [GitLab: Migration Style Guide](https://docs.gitlab.com/ee/development/migration_style_guide.html) — belge — post-deployment migration, kilit yeniden denemeleri
- [Stripe: Online migrations at scale](https://stripe.com/blog/online-migrations) — makale — dört adımlı çift yazma deseni
- [strong_migrations](https://github.com/ankane/strong_migrations) — depo — tehlikeli migration'ları yakalayan Rails aracı ve güvenli karşılıkları
:::

:::next{lesson="d-10-time-series-graph-document"}
Sırada: ilişkisel modelin yetmediği yerler — zaman serisi, graf ve belge veritabanlarında veri düzeni ve sorgu şekli.
:::

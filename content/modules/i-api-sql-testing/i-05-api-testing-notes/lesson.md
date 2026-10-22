---
id: i-05-api-testing-notes
slug: api-testing-notes
module: i-api-sql-testing
order: 5
title:
  tr: "API Testi: Piramit, Contract Test ve Yük Testi"
  en: "API Testing: Pyramid, Contract Tests and Load Tests"
summary:
  tr: "HTTP, durum kodları, kimlik doğrulama ve JSONPath ile API yanıtlarını eksiksiz doğrulamayı öğren."
  en: "Learn to fully validate API responses using HTTP, status codes, authentication and JSONPath."
durationMinutes: 28
level: intermediate
tags: [api-testing, test-pyramid, contract-testing, pact, postman, newman, pytest, k6, ci, qa]
prerequisites: [i-01-how-apis-are-created-and-called, i-03-api-ve-rest-api-tasarim-guvenlik-ve-idempotency, h-07-tetikleyiciler-secrets-cache-ve-testler]
concepts: [test-pyramid, status-code-assertions, schema-validation, response-time-assertions, contract-testing, consumer-driven-contracts, test-doubles, negative-testing, boundary-testing, idempotency-testing, load-testing, ci-test-stage, test-data-management]
---

## Kavram: arayüzü değil sözleşmeyi test etmek

Bir web uygulamasını tarayıcıdan tıklayarak test etmek yavaş, kırılgan ve pahalıdır: düğme bir piksel kayınca test kırılır, her senaryo saniyeler sürer. Oysa uygulamanın asıl davranışı API'de yaşar; ön yüz çoğu zaman API'nin döndürdüğünü boyayan bir katmandır. **API testi**, uygulamanın bu sözleşme katmanını doğrudan HTTP istekleriyle sınamaktır: doğru girdiye doğru durum kodu, doğru şema ve doğru veri dönüyor mu; yanlış girdiye anlaşılır bir hata veriliyor mu; sistem yük altında ve ağ hatalarında nasıl davranıyor?

API testlerinin değeri üç yerden gelir. Hızlıdırlar: bir istek milisaniyeler sürer, bir test dosyası yüzlerce senaryoyu dakikada bitirir. Kararlıdırlar: HTTP sözleşmesi arayüzden çok daha yavaş değişir. Ve erken çalışırlar: arayüz daha yazılmadan, hatta servis daha yazılmadan (sözleşme testleriyle) hataları yakalarlar.

:::diagram{src="diagram.svg" alt="Test piramidi: altta çok sayıda birim testi, ortada API ve entegrasyon testleri, üstte az sayıda uçtan uca test; yanında tüketici ile sağlayıcı arasındaki sözleşme dosyası ve CI'da çalışan test aşaması|The test pyramid: many unit tests at the bottom, API and integration tests in the middle, few end-to-end tests at the top; beside it the contract file between consumer and provider and the test stage running in CI"}
Piramidin ortası API testlerinin yaşadığı yerdir: birim testinden gerçekçi, uçtan uca testten hızlı ve kararlı.
:::

## Test piramidi

**Birim testleri** tek bir fonksiyonu, dış bağımlılık olmadan sınar: "fiyat hesaplayıcı %18 KDV'yi doğru ekliyor mu?" Binlercesi saniyeler içinde çalışır; piramidin geniş tabanıdır.

**Entegrasyon / API testleri** servisi gerçek ya da gerçeğe yakın bağımlılıklarıyla sınar: HTTP isteği gönderilir, yanıt doğrulanır, veritabanına gerçekten yazılıp yazılmadığına bakılır. Bu katman, birim testlerinin göremediği hataları yakalar: yanlış serileştirme, eksik `Content-Type`, unutulmuş yetki kontrolü, yanlış durum kodu.

**Uçtan uca (E2E) testler** gerçek bir kullanıcı gibi davranır: tarayıcı açar, giriş yapar, sipariş verir. En gerçekçi ama en yavaş ve en kırılgan testlerdir; yalnızca kritik akışlar için az sayıda yazılır.

Piramidin biçimi bir uyarıdır: üstteki test sayısı alttakinden fazlaysa (ters piramit ya da "dondurma külahı") test süiti yavaşlar, rastgele kırılır ve ekip ona güvenmeyi bırakır. API testleri, "yeterince gerçekçi ama hâlâ hızlı" dengesini sağladığı için orta katmanın omurgasıdır.

Katmanların farkı en iyi aynı servisi her birinin nasıl sınadığına bakınca görünür. Aşağıdaki animasyon bir sipariş servisini birim, API, sözleşme ve uçtan uca testlerle sınar ve gerçek ödeme servisinin yerine bir mock sunucunun nasıl geçtiğini gösterir; mock ve sözleşme konularını ilerleyen bölümlerde ayrıntılı işleyeceğiz.

:::predict{id="mock-eskirse"}
Ödeme servisi ekibi yanıttaki `status` alanının adını `state` olarak değiştirdi. Sipariş servisinin API testleri bu servisi hep bir mock ile çalıştırıyor ve mock eski yanıtı dönmeye devam ediyor. Hata nerede yakalanır? | The payment team renamed the `status` field in its response to `state`. The order service's API tests always run against a mock, and the mock keeps returning the old response. Where is the bug caught?
- [ ] Sipariş servisinin API testlerinde; mock kullanılsa da testler kırılır | In the order service's API tests; they break even with the mock
- [x] Sözleşme testi varsa ödeme ekibinin CI'ında; yoksa ancak üretimde | In the payment team's CI if there is a contract test; otherwise only in production
- [ ] Birim testlerinde, çünkü alan adları orada kontrol edilir | In the unit tests, because field names are checked there
- [ ] Hiçbir yerde; JSON alan adı değişikliği istemcileri etkilemez | Nowhere; renaming a JSON field does not affect clients
Açıklama: Mock eski yanıtı vermeye devam ettiği için tüketicinin testleri yeşil kalır. Bu değişikliği yakalayan, tüketicinin beklentilerini (`status` alanı) sağlayıcının CI'ında gerçek servise karşı oynatan sözleşme testidir. O yoksa hata ancak üretimde, gerçek servisle konuşulunca ortaya çıkar. | Because the mock keeps returning the old response the consumer's tests stay green. What catches the change is a contract test that replays the consumer's expectations (the `status` field) against the real service in the provider's CI. Without it the bug only surfaces in production, when the real service is called.
:::

:::animation{scene="test-layers.scene.json"}
Birim → API/entegrasyon → sözleşme → E2E; mock gerçek bağımlılığın yerine geçer, sözleşme mock'u gerçeğe bağlar.
:::

## Bir API testinde ne doğrulanır?

Tek bir `GET /v1/users/42` isteği için bile beş ayrı doğrulama vardır:

1. **Durum kodu** — beklenen `200` mü geldi? Olmayan kullanıcı için `404`, token yoksa `401`, yetki yoksa `403`?
2. **Şema** — gövde beklenen biçimde mi: `id` tam sayı, `email` e-posta biçiminde, zorunlu alanlar yerinde, fazladan beklenmeyen alan yok?
3. **Gövde değerleri** — `id` gerçekten `42` mi, `email` veritabanındaki değerle aynı mı? Şema "biçim"i, değer "içerik"i doğrular; ikisi birbirinin yerine geçmez.
4. **Başlıklar** — `Content-Type: application/json`, önbellek kuralları, `X-Request-Id` gibi izleme başlıkları, güvenlik başlıkları.
5. **Süre** — yanıt belirlenen bütçenin (örneğin 300 ms) altında mı? Tek bir isteğin süresi gürültülüdür; bu kontrol yük testinde yüzdelik dilimlerle (p95) daha anlamlıdır, ama fonksiyonel testte kaba bir sınır bile ani gerilemeleri yakalar.

Aşağıdaki örnek, Python'da `pytest` ve `requests` ile bu beş doğrulamayı tek testte toplar. Şema doğrulaması için `jsonschema` kütüphanesi kullanılır; şema, OpenAPI belgesinden alınabilir.

:::code{lang="python" title="pytest + requests: durum kodu, şema, gövde, başlık ve süre doğrulaması"}
```python
import os
import pytest
import requests
from jsonschema import validate

BASE = os.environ.get("API_BASE", "http://localhost:3000")
TOKEN = os.environ["API_TOKEN"]
HEADERS = {"Authorization": f"Bearer {TOKEN}", "Accept": "application/json"}

USER_SCHEMA = {
    "type": "object",
    "required": ["id", "name", "email"],
    "additionalProperties": False,            # beklenmeyen alan sızmasın
    "properties": {
        "id": {"type": "integer"},
        "name": {"type": "string", "minLength": 1},
        "email": {"type": "string", "format": "email"},
    },
}

@pytest.fixture
def user():
    """Her test kendi verisini yaratır ve sonunda temizler."""
    res = requests.post(f"{BASE}/v1/users", headers=HEADERS,
                        json={"name": "Test Kullanıcı", "email": "t-1@example.com"})
    assert res.status_code == 201
    created = res.json()
    yield created
    requests.delete(f"{BASE}/v1/users/{created['id']}", headers=HEADERS)

def test_get_user_happy_path(user):
    res = requests.get(f"{BASE}/v1/users/{user['id']}", headers=HEADERS, timeout=5)

    assert res.status_code == 200                                   # 1. durum kodu
    validate(instance=res.json(), schema=USER_SCHEMA)               # 2. şema
    assert res.json()["email"] == "t-1@example.com"                 # 3. gövde değeri
    assert res.headers["Content-Type"].startswith("application/json")  # 4. başlık
    assert res.elapsed.total_seconds() < 0.3                        # 5. süre

@pytest.mark.parametrize("user_id,expected", [(999_999, 404), ("abc", 400)])
def test_get_user_negative(user_id, expected):
    res = requests.get(f"{BASE}/v1/users/{user_id}", headers=HEADERS)
    assert res.status_code == expected
    assert "error" in res.json()                                    # hata gövdesi sabit biçimde

def test_get_user_without_token_is_401():
    res = requests.get(f"{BASE}/v1/users/1")
    assert res.status_code == 401
```
:::

## Postman ve Newman

**Postman**, istekleri koleksiyonlar hâlinde düzenleyen ve her isteğe JavaScript ile test betiği eklemeye izin veren bir araçtır; keşif ve hata ayıklama için idealdir. **Newman** ise aynı koleksiyonu komut satırında çalıştıran motorudur; koleksiyonu CI'da koşturmanın yolu budur. Ortam değişkenleri (`{{baseUrl}}`, `{{token}}`) bir ortam dosyasında tutulur ve böylece aynı koleksiyon staging ve üretim için ayrı ayrı çalıştırılır.

:::code{lang="js" title="Postman test betiği ve Newman ile çalıştırma"}
```js
// Postman → istek → "Tests" sekmesi
pm.test("durum kodu 200", () => pm.response.to.have.status(200));

pm.test("yanıt 300 ms altında", () => pm.expect(pm.response.responseTime).to.be.below(300));

pm.test("şemaya uyuyor", () => {
  const schema = {
    type: "object",
    required: ["id", "name", "email"],
    properties: { id: { type: "integer" }, name: { type: "string" }, email: { type: "string" } },
  };
  pm.response.to.have.jsonSchema(schema);
});

pm.test("e-posta doğru", () => {
  const body = pm.response.json();
  pm.expect(body.email).to.eql(pm.environment.get("expectedEmail"));
});

// Sonraki istekte kullanmak üzere id'yi ortam değişkenine yaz (istek zincirleme)
pm.environment.set("userId", pm.response.json().id);
```
```bash
# Koleksiyonu staging ortamıyla çalıştır; JUnit raporu CI'ın test sekmesinde görünür
newman run users.postman_collection.json \
  -e staging.postman_environment.json \
  --env-var "token=$API_TOKEN" \
  --reporters cli,junit --reporter-junit-export results/newman.xml
```
:::

## Sözleşme testi: tüketici ne bekliyor, sağlayıcı ne veriyor?

Mikroservis dünyasında bir API'nin birden çok tüketicisi vardır ve en sık görülen üretim hatası şudur: sağlayıcı ekibi bir alanı yeniden adlandırır, kendi testleri geçer, ama mobil uygulama çöker. **Sözleşme testi** (contract testing) bu sınıfı yakalar. Fikir basittir: tüketici, sağlayıcıdan *ne beklediğini* makine tarafından okunabilir bir dosyaya yazar; sağlayıcı kendi CI'ında bu dosyayı alıp "ben hâlâ bu beklentileri karşılıyor muyum" diye kontrol eder.

**Tüketici odaklı sözleşmeler** (consumer-driven contracts) ve bunun en bilinen aracı **Pact**, akışı şöyle kurar:

1. Tüketici testi, sahte bir sağlayıcıya karşı yazılır: "`GET /v1/users/42` çağırırsam `id`, `name` ve `email` içeren 200 beklerim."
2. Test çalışınca bu beklenti bir **pact dosyası** (JSON) olarak üretilir ve bir sözleşme deposuna (broker) yüklenir.
3. Sağlayıcının CI'ı pact dosyasını indirir, gerçek servise bu istekleri gönderir ve yanıtların beklentiyle uyuştuğunu doğrular.
4. İki taraf da "sözleşme yeşil" sinyalini görmeden dağıtım yapmaz.

Sözleşme testinin kritik inceliği şudur: tüketici yalnızca *kullandığı* alanları yazar. Böylece sağlayıcı kullanılmayan alanları özgürce değiştirebilir, ama bir tüketicinin gerçekten dayandığı alanı kırarsa anında öğrenir. OpenAPI belgesiyle uyum kontrolü (şema uyumu) bunun daha hafif bir biçimidir; Pact ise "kim neye dayanıyor" bilgisini ekler.

## Mock, stub ve fake: bağımlılıkları yerine koymak

Testte gerçek bağımlılıkları kullanmak her zaman mümkün ya da akıllıca değildir: ödeme sağlayıcısı gerçek para çeker, üçüncü taraf API'nin kotası vardır, bir bağımlılık henüz yazılmamıştır. Bu durumda **test çiftleri** (test doubles) devreye girer ve adları sıkça karıştırılır:

- **Stub**: sabit, önceden hazırlanmış yanıt döner. "Döviz kuru servisi her zaman 1 USD = 34,20 TL desin." Davranışı sınamaz, yalnızca testin ilerlemesini sağlar.
- **Mock**: stub gibi yanıt döner ama ek olarak *nasıl çağrıldığını* kaydeder ve bunu doğrular. "E-posta servisi tam bir kez, doğru adresle çağrıldı mı?" sorusu mock'un işidir.
- **Fake**: gerçeğin çalışan ama basitleştirilmiş sürümü. Bellek içi bir veritabanı ya da diske yazmayan bir dosya sistemi gibi. Gerçeğe en yakın olanıdır; davranışın tamamını sınar ama üretim altyapısı gerektirmez.

API testinde bu araçlar iki yönde kullanılır. **Dışa doğru**: servisimizin çağırdığı üçüncü taraf API'ler, WireMock ya da benzeri bir araçla stub'lanır; böylece testler ağ olmadan ve belirlenimci biçimde çalışır. **İçe doğru**: henüz hazır olmayan bir servis için OpenAPI belgesinden bir mock sunucu üretilir ve tüketici ekibi gerçek servisi beklemeden geliştirmeye başlar.

:::callout{tone="warning" title="Mock'a aşırı güvenmek"}
Her şeyi mock'layan bir test süiti, yalnızca mock'ların doğru olduğunu kanıtlar. Üçüncü taraf API bir alanı değiştirdiğinde stub eski yanıtı vermeye devam eder ve testler yeşil kalırken üretim kırılır. Bu yüzden stub'lar sözleşme testleriyle gerçek servise karşı doğrulanmalı, en azından kritik entegrasyonlar için gerçek bir sandbox ortamına karşı düzenli "duman testi" çalıştırılmalıdır.
:::

## Negatif ve sınır testleri

Mutlu yol testleri API'nin çalıştığını gösterir; **negatif testler** doğru biçimde *reddettiğini* gösterir ve üretimdeki hataların çoğu bu ikinci gruptan çıkar. Her uç nokta için sorulacak sorular:

- **Eksik ve hatalı girdi**: zorunlu alan yok, yanlış tip (`"age": "on iki"`), geçersiz JSON, boş gövde, yanlış `Content-Type`. Beklenen: `400` ya da `422` ve açıklayıcı hata gövdesi; asla `500`.
- **Kimlik ve yetki**: token yok (`401`), süresi dolmuş token (`401`), başka kullanıcının kaynağına erişim (`403` ya da bilgi sızdırmamak için `404`), yetkisiz rolle silme (`403`).
- **Olmayan kaynak**: `GET /users/999999` → `404`, `DELETE` aynı kaynak ikinci kez → `404` ya da `204`, ama tutarlı.
- **Güvenlik girdileri**: SQL ve betik enjeksiyonu kalıpları, çok uzun dizgeler, Unicode ve emoji, baştaki/sondaki boşluklar.

**Sınır testleri** ise değer aralığının kenarlarını hedefler: sayfalama için `limit=0`, `limit=1`, `limit=100` (üst sınır), `limit=101` (reddedilmeli), negatif değer; metin alanları için tam olarak izin verilen uzunluk ve bir fazlası; tarih alanları için yıl sonu, artık yıl ve saat dilimi sınırları. Hataların kenarlarda birikmesi bir deneyim kuralıdır ve "0, 1, N, N+1" kalıbı ucuz ama etkili bir araçtır.

## Idempotency ve yeniden deneme testleri

Ağ güvenilmezdir: istemci isteği gönderir, sunucu işler, ama yanıt yolda kaybolur. İstemci tekrar dener. Sonuç ne olmalı? `GET`, `PUT` ve `DELETE` için ikinci istek zararsız olmalıdır; `POST` için ise sunucu bir **idempotency anahtarı** desteklemiyorsa iki kayıt oluşur. Bu davranış doğrudan test edilmelidir:

- Aynı `PUT /users/42` gövdesini iki kez gönder; ikinci yanıt da `200` olmalı ve veri değişmemeli.
- `DELETE /users/42` iki kez; ikinci yanıt tutarlı (`404` ya da `204`) olmalı ve hata üretmemeli.
- Aynı `Idempotency-Key` başlığıyla `POST /orders` iki kez; ikinci yanıt ilkiyle aynı sipariş kimliğini döndürmeli, veritabanında tek sipariş olmalı.
- Aynı anahtarla *farklı* gövde gönderildiğinde `409` ya da `422` gibi bir çatışma yanıtı beklenmeli.

Yeniden deneme testleri ise istemci tarafını sınar: sunucu stub'ı ilk çağrıda `503`, ikincide `200` döndürecek şekilde kurulur ve istemcinin bekleyip yeniden denediği, ama `400` gibi kalıcı hatalarda denemeyi bıraktığı doğrulanır. Bu, üretimde "yeniden deneme fırtınası" yaratmayan bir istemcinin garantisidir.

## Yük testi: k6 ile performans sınırlarını görmek

Fonksiyonel testler "doğru mu" sorusunu yanıtlar; **yük testi** "kaç kullanıcıyla hâlâ doğru mu" sorusunu sorar. **k6**, test senaryolarını JavaScript ile yazdıran ve sanal kullanıcı (VU) sayısını zamanla değiştirebilen bir araçtır. Başarı ölçütü ortalama değil **yüzdelik dilimlerdir**: p95 300 ms demek, isteklerin %95'inin 300 ms altında bittiği anlamına gelir; ortalama güzel görünürken p99'un patlaması tipik bir üretim sorunudur.

:::code{lang="js" title="k6: kademeli yük ve eşik (threshold) tanımı"}
```js
import http from "k6/http";
import { check, sleep } from "k6";

export const options = {
  stages: [
    { duration: "1m", target: 20 },   // ısınma: 20 sanal kullanıcıya çık
    { duration: "3m", target: 100 },  // yük: 100 kullanıcı sabit
    { duration: "1m", target: 0 },    // soğuma
  ],
  thresholds: {
    http_req_duration: ["p(95)<300", "p(99)<800"],  // gecikme bütçesi
    http_req_failed: ["rate<0.01"],                  // hata oranı %1'in altında
  },
};

const BASE = __ENV.API_BASE;
const headers = { Authorization: `Bearer ${__ENV.API_TOKEN}` };

export default function () {
  const id = Math.floor(Math.random() * 1000) + 1;        // sıcak önbelleği kandırmamak için farklı id'ler
  const res = http.get(`${BASE}/v1/users/${id}`, { headers });
  check(res, {
    "200 veya 404": (r) => r.status === 200 || r.status === 404,
    "JSON gövde": (r) => r.headers["Content-Type"].includes("application/json"),
  });
  sleep(1);                                               // gerçek kullanıcı düşünme süresi
}
```
```bash
# Eşik ihlalinde k6 sıfırdan farklı çıkış kodu döner; CI adımı böylece kırılır
k6 run --env API_BASE=https://staging.example.com --env API_TOKEN="$API_TOKEN" load.js
```
:::

Yük testi türleri amaçla ayrılır: **yük testi** beklenen trafiği, **stres testi** kırılma noktasını, **dayanıklılık (soak) testi** saatler süren sabit yükte bellek sızıntısı ve bağlantı tükenmesini, **ani yük (spike) testi** kampanya anını simüle eder. Hepsi üretime değil, üretimle aynı boyutta bir staging ortamına karşı çalıştırılır; aksi hâlde ölçtüğünüz şey ortamın küçüklüğüdür.

## CI'da çalıştırma

API testleri, CI pipeline'ında birim testlerinden sonra ve dağıtımdan önce kendi aşamasında çalışır. Tipik düzen: servis ve bağımlılıkları (veritabanı, önbellek) konteyner olarak ayağa kalkar, servis sağlıklı olana kadar beklenir, testler koşar, raporlar JUnit biçiminde toplanır. Yük testleri her commit'te değil, gece ya da sürüm öncesi çalıştırılır; sözleşme doğrulaması ise her iki tarafın CI'ında her commit'te çalışır.

:::code{lang="yaml" title="GitHub Actions: API test aşaması (pytest + Newman) ve gece yük testi"}
```yaml
name: api-tests
on:
  pull_request:
  schedule:
    - cron: "0 2 * * *"          # gece 02:00 — yalnızca yük testi için

jobs:
  api-tests:
    if: github.event_name == 'pull_request'
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:16
        env: { POSTGRES_PASSWORD: test, POSTGRES_DB: app }
        options: >-
          --health-cmd "pg_isready -U postgres" --health-interval 5s --health-retries 10
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 20 }
      - run: npm ci && npm run migrate && (npm start &)
        env: { DATABASE_URL: postgres://postgres:test@localhost:5432/app }
      - name: Servisin hazır olmasını bekle
        run: npx wait-on http://localhost:3000/health/ready --timeout 60000
      - uses: actions/setup-python@v5
        with: { python-version: "3.12" }
      - run: pip install pytest requests jsonschema
      - run: pytest tests/api --junitxml=results/pytest.xml
        env: { API_BASE: http://localhost:3000, API_TOKEN: ${{ secrets.TEST_API_TOKEN }} }
      - run: npx newman run tests/postman/users.json -e tests/postman/ci.json --env-var "token=${{ secrets.TEST_API_TOKEN }}" --reporters cli,junit --reporter-junit-export results/newman.xml
      - uses: actions/upload-artifact@v4
        if: always()
        with: { name: api-test-results, path: results/ }

  load-test:
    if: github.event_name == 'schedule'
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: grafana/setup-k6-action@v1
      - run: k6 run tests/load/load.js
        env: { API_BASE: https://staging.example.com, API_TOKEN: ${{ secrets.STAGING_API_TOKEN }} }
```
:::

Aşağıdaki pipeline'da test aşamalarını piramidin sırasıyla dizdik: ucuz ve hızlı testler önde, pahalı olanlar sonda.

:::interactive{type="pipeline" stages="lint,unit-test,api-test,contract-verify,build-image,deploy-staging,e2e-test,production" failureStage="contract-verify" retries=0}
"Pipeline'ı çalıştır" düğmesiyle aşamaların sırayla yeşile döndüğünü izle. Sonra "Hata enjekte et" kutusunu işaretle; "Hata aşaması" listesinde `contract-verify` seçiliyken tekrar çalıştır: sözleşme kırıldığında imaj hiç üretilmez ve staging'e dağıtım yapılmaz. Hata aşamasını `e2e-test` yapıp karşılaştır: aynı hata ne kadar geç yakalanırsa o kadar çok aşama boşuna çalışır. Son olarak "Yeniden deneme" değerini 1'e çıkar: logda aşamanın bir kez daha denendiğini ama gerçek bir hatanın yeniden denemeyle düzelmediğini gör. Yeniden deneme yalnızca geçici sorunlar içindir; kararsız (flaky) testleri onunla gizlemek, gerçek hataları da gizler.
:::

## Test verisi yönetimi

API testlerinin en sık ihmal edilen parçası veridir. Üç ilke işi büyük ölçüde çözer. **Her test kendi verisini yaratır ve temizler**: yukarıdaki `pytest` fixture'ı gibi; testler paylaşılan "sihirli" kayıtlara dayanırsa birbirine bağımlı hâle gelir ve sırayla çalışmak zorunda kalır. **Veri üretilir, kopyalanmaz**: `faker` benzeri kütüphanelerle sentetik veri üretmek, üretim veritabanını kopyalamaktan hem daha güvenli hem daha tekrarlanabilirdir; üretim verisi mutlaka kullanılacaksa önce anonimleştirilir. **Ortam izole edilir**: her CI çalışması taze bir veritabanı konteyneriyle başlar; testler paralel koşacaksa her biri kendi şemasını ya da benzersiz ön ekli kayıtlarını kullanır.

Bu ilkelerin karşılığı, "benim makinemde geçiyordu" ve "testler bazen kırılıyor" cümlelerinin ortadan kalkmasıdır; kararsız (flaky) test süitlerinin kök nedeni çoğunlukla paylaşılan ve kirlenen veridir.

:::realworld{company="Stripe"}
Stripe, API'sini kullanan binlerce ekibin test yazabilmesi için bu dersteki fikirlerin çoğunu ürünleştirmiştir. **Test modu** anahtarları ile tüm uç noktalar gerçek para hareketi olmadan çağrılabilir; `4242 4242 4242 4242` gibi özel test kart numaraları başarılı ödeme, red, 3-D Secure gibi senaryoları belirlenimci biçimde tetikler — negatif testlerin hazır bir kataloğu gibidir. Açık kaynak **stripe-mock** sunucusu, OpenAPI belgesinden üretilir ve ağa çıkmadan şema uyumlu yanıtlar döndürür; Stripe'ın kendi istemci kütüphaneleri de CI'da ona karşı test edilir. `Idempotency-Key` desteği sayesinde yeniden deneme davranışı da aynı sandbox'ta güvenle sınanabilir.
:::

:::callout{tone="tip" title="Mülakat özeti"}
- Piramidi ve API testinin orta katmandaki rolünü anlatın: birim testinden gerçekçi, E2E'den hızlı.
- Beş doğrulama: durum kodu, şema, gövde değeri, başlıklar, süre.
- Stub / mock / fake farkını bir cümleyle: sabit yanıt / çağrıyı doğrular / çalışan basit sürüm.
- Sözleşme testini "tüketici ne bekliyor, sağlayıcı CI'ında bunu doğruluyor" diye özetleyin.
- Yük testinde ortalamaya değil p95/p99'a baktığınızı söyleyin.
:::

:::quiz{src="quiz.json"}
:::

:::next{lesson="i-06-sql-notes"}
Sırada: API'lerin arkasındaki veriyi sorgulamak — SELECT, JOIN, GROUP BY ve window fonksiyonlarıyla SQL.
:::

---
id: b-06-hexagonal-clean-architecture
slug: hexagonal-clean-architecture
module: b-architectures
order: 6
title:
  tr: "Hexagonal ve Clean Architecture: Port, Adaptör, Use Case"
  en: "Hexagonal and Clean Architecture: Ports, Adapters, Use Cases"
summary:
  tr: Bağımlılık yönü, use case katmanı, sürücü ve sürülen adaptörler, veritabanını sahteyle değiştirerek test.
  en: Dependency direction, the use case layer, driving and driven adapters, testing by swapping the database for a fake.
durationMinutes: 30
level: advanced
tags: [architecture, hexagonal, clean-architecture, ports-and-adapters, testing, nestjs]
prerequisites: [b-03-serverless-bff-clean-ddd, b-05-modular-monolith, f-08-devacademy-architecture]
concepts: [hexagonal-architecture, ports-and-adapters, dependency-rule, dependency-inversion, use-case, driving-adapter, driven-adapter, test-double, contract-test]
---

## Kavram: çekirdek dışarıyı bilmez

b-03'te hexagonal ve clean architecture'ı tek bir kural üzerinden tanıttık: **kaynak kodu bağımlılıkları içeri, iş alanına doğru akar**. O derste dört konu yan yana olduğu için kural bir kod örneğiyle sınırlı kaldı. Bu derste kuralın nasıl uygulandığını, bir isteğin katmanlar arasında nasıl yol aldığını, testlerin neden hızlandığını ve bedelin nerede ödendiğini adım adım işliyoruz.

Önce sorunu netleştirelim. Klasik katmanlı bir serviste akış ve bağımlılık aynı yöndedir: controller servisi, servis repository'yi, repository ORM'i çağırır ve her katman bir altındakini **import eder**. Sonuçta iş kuralı, en alttaki teknolojinin şeklini öğrenir. Sorgu nesneleri, ORM'in döndürdüğü tipler, çerçevenin hata sınıfları iş mantığının içine sızar. ORM sürümü değiştiğinde iş kuralı derlenmez; birim testi yazmak için ORM'in sorgu API'sini taklit etmek gerekir.

Hexagonal mimari (Alistair Cockburn, *ports and adapters*) bu ikisini ayırır: **akış** hâlâ dışarıdan içeri ve içeriden dışarı gider, ama **bağımlılık** her zaman içeri bakar. Bunun aracı, nesne yönelimli tasarımdaki **bağımlılığın tersine çevrilmesi** ilkesidir (dependency inversion). Use case veritabanına bir şey yazdırmak istediğinde Prisma'yı çağırmaz; kendi dilinde tanımladığı bir arayüzü, yani bir **port**'u çağırır. O arayüzü uygulayan Prisma kodu dış halkadadır ve çekirdeği import eden odur, tersi değil.

## Halkalar ve sorumluluklar

Robert Martin'in Clean Architecture'ı aynı fikri iç içe halkalarla çizer; Jeffrey Palermo'nun onion architecture'ı da öyle. İsimler farklı olsa da sorumluluk dağılımı benzerdir:

| Halka | İçerik | Ne import edebilir? |
|---|---|---|
| **Domain** | Varlıklar, değer nesneleri, saf iş kuralları (`gradeAnswer`, `Order.markPaid`) | Hiçbir şey (yalnızca dilin standart kütüphanesi) |
| **Application** | Use case'ler (`SubmitAttempt`), giriş/çıkış port'ları, DTO'lar | Domain |
| **Adapters** | Controller, kuyruk tüketicisi, Prisma repository, e-posta istemcisi | Application ve Domain |
| **Frameworks & drivers** | NestJS, Express, Prisma Client, PostgreSQL, Redis | Herkes onları kullanır; onlar çekirdeği bilmez |

Port'lar ikiye ayrılır. **Sürücü (driving, primary) port**, dünyanın çekirdekten istediği şeydir: "bir quiz denemesi gönder". Onu çağıran **sürücü adaptörler**: HTTP controller, bir CLI komutu, bir kuyruk tüketicisi, bir test. **Sürülen (driven, secondary) port**, çekirdeğin dünyadan istediği şeydir: "bu denemeyi kaydet", "kullanıcıya bildirim gönder". Onu uygulayan **sürülen adaptörler**: Prisma repository, SMTP istemcisi, bellek içi sahte.

İnce ama önemli bir ayrıntı: sürülen port'un sahibi **çekirdektir**. Arayüz, çekirdeğin ihtiyacına göre ve çekirdeğin dilinde yazılır: `attempts.save(attempt)`. `prisma.attempt.upsert({ where, create, update })` gibi bir imza bir port değil, ORM'in kendisidir; onu bir arayüzün arkasına saklamak bağımlılığı tersine çevirmez, yalnızca bir katman ekler.

:::diagram{src="diagram.svg" alt="İç içe dört halka: merkezde Domain, çevresinde Application (use case ve port'lar), onun çevresinde Adapters, en dışta Frameworks; solda sürücü adaptörler (HTTP controller, kuyruk tüketicisi, Jest testi), sağda sürülen adaptörler (Prisma repository, bellek içi sahte, e-posta); bütün bağımlılık okları içeri bakıyor; altta isteğin yolu adaptör, port, use case, port, adaptör olarak gösteriliyor|Four nested rings: Domain in the centre, Application (use cases and ports) around it, then Adapters, Frameworks outermost; driving adapters on the left (HTTP controller, queue consumer, Jest test), driven adapters on the right (Prisma repository, in-memory fake, email); all dependency arrows point inward; below, a request's path is shown as adapter, port, use case, port, adapter"}
Akış soldan sağa (istek → veritabanı) gider, bağımlılık okları ise her iki taraftan da merkeze bakar. Sağdaki Prisma adaptörü port'u import eder; port Prisma'yı bilmez.
:::

## Bir isteğin yolu

Bu projenin backend'indeki (f-08) quiz gönderimini hexagonal biçimde düşünelim. `POST /quizzes/:id/attempts` isteği geldiğinde:

1. **Sürücü adaptör** (NestJS controller) HTTP'ye özgü her şeyi çözer: JWT'den kullanıcı kimliği, gövdenin doğrulanması, `SubmitAttemptCommand` nesnesinin üretilmesi.
2. Controller, **giriş port'u** üzerinden use case'i çağırır. Use case HTTP'yi, durum kodlarını, çerezleri bilmez.
3. **Use case** akışı yönetir: quiz'i **çıkış port'undan** ister, cevapları domain kuralıyla puanlar, sonucu kaydettirir, ilerleme ve rozet olaylarını tetikler.
4. **Domain** kuralı (`gradeAnswer`) saf bir fonksiyondur: girdi alır, sonuç döner, hiçbir G/Ç yapmaz. Bu projede zaten `@devacademy/shared` paketinde yaşar ve hem web'de hem mobilde aynı mantığı paylaşır.
5. **Sürülen adaptör** (`PrismaQuizRepository`) port'u uygular, Prisma sorgusunu yazar, veritabanı satırını domain nesnesine çevirir.
6. Sonuç aynı yoldan geri döner; controller onu HTTP yanıtına çevirir. Domain hatası (`QuizNotPublished`) burada `404`'e eşlenir.

:::predict{id="hexagonal-test-hizi"}
Use case'in testinde PrismaQuizRepository yerine bellek içi bir sahte takılıyor. Test neyi doğrulamış olur? | In the use case's test, an in-memory fake is plugged in instead of PrismaQuizRepository. What does the test verify?
- [ ] Prisma sorgusunun doğru SQL ürettiğini | That the Prisma query produces correct SQL
- [x] Use case'in iş akışını ve domain kuralını; veritabanı sözleşmesi ayrıca test edilmelidir | The use case's flow and the domain rule; the database contract must be tested separately
- [ ] Uçtan uca bütün sistemi; ayrıca entegrasyon testine gerek kalmaz | The whole system end to end; no integration test is needed any more
- [ ] Hiçbir şeyi; sahteyle yazılan test değersizdir | Nothing; a test written against a fake is worthless
Açıklama: Sahte adaptör, use case testini milisaniyelere indirir ve iş akışını izole eder; ama sahtenin gerçek adaptörle aynı davrandığını kanıtlamaz. Bu yüzden aynı sözleşme testi hem sahteye hem de gerçek bir veritabanına karşı çalışan Prisma adaptörüne uygulanır. | The fake brings the use case test down to milliseconds and isolates the flow, but it does not prove the fake behaves like the real adapter. That is why the same contract test is run against both the fake and the Prisma adapter backed by a real database.
:::

:::animation{scene="scene.json"}
İsteğin adaptör → port → use case → port → adaptör yolculuğu, bağımlılık oklarının içeri bakması ve Prisma adaptörünün testte bellek içi sahteyle değiştirilmesi.
:::

## Test edilebilirlik: asıl kazanç

Bu projede `QuizzesService` bugün `PrismaService`'i doğrudan kullanır ve birim testi Prisma'nın şeklini taklit eden bir nesne kurar: `{ quiz: { findFirst: jest.fn() } }`. Test çalışır, ama sorgunun `where` cümlesinin içeriğini bilmek zorundadır; sorgu yeniden yazılırsa iş kuralı değişmediği hâlde test kırılır. Port olsaydı sahte, ORM'in değil çekirdeğin dilini konuşurdu: `findPublishedQuiz(id)` ya `Quiz` döner ya `null`.

Hexagonal düzende test stratejisi üç katmana ayrılır:

- **Domain testleri**: saf fonksiyonlar, mock yok, en hızlıları.
- **Use case testleri**: sürülen port'lara bellek içi sahteler takılır; iş akışının her dalı milisaniyeler içinde denenir. Test sayısının çoğu buradadır.
- **Adaptör sözleşme testleri**: aynı test paketi hem bellek içi sahteye hem de geçici bir veritabanına bağlı Prisma adaptörüne karşı koşar. Böylece sahte "yalan söyleyemez"; ikisi aynı davranışı sergilemek zorundadır.

Bunun üstüne az sayıda uçtan uca test eklenir. Sonuç, yavaş ve kırılgan entegrasyon testlerine yaslanan bir test piramidi yerine geniş ve hızlı bir tabandır.

:::interactive{type="request-journey" stages="client,controller:3,use-case:1,quiz-repository:2,prisma-adapter:4,postgres" failureStage="postgres" slowService="none" slowPenaltyMs=200}
Bu yolculuk hexagonal bir servisin içini gösteriyor. "İstek gönder" ile şelaleye bakın: use case'in kendi payı yalnızca birkaç milisaniye; sürenin büyük kısmı adaptörlerde ve `postgres` durağında harcanıyor. Use case testinde Prisma adaptörü ve veritabanı yerine bellek içi sahte takılınca şelalenin bu kısmı tamamen kalkar; testlerin hızlanmasının nedeni budur. "Hata enjekte et: postgres" kutusunu işaretleyip yeniden gönderin: hata adaptörde yakalanıp bir domain hatasına çevrilmezse ham veritabanı hatası controller'a kadar sızar. Son olarak "Yavaş katman" listesinden `prisma-adapter`'ı seçin: tek bir adaptördeki yavaşlık, iş kuralına dokunmadan yalnızca o adaptör değiştirilerek giderilebilir.
:::

:::code{lang="ts" title="NestJS'te port + iki adaptör: üretimde Prisma, testte bellek içi sahte"}
```ts
// quizzes/application/ports.ts — sürülen port: çekirdeğin dilinde, Prisma tipi YOK
export interface QuizRepository {
  findPublished(quizId: string): Promise<Quiz | null>;
  saveAttempt(attempt: Attempt): Promise<void>;
}
export const QUIZ_REPOSITORY = Symbol('QUIZ_REPOSITORY'); // DI anahtarı

// quizzes/application/submit-attempt.ts — use case: NestJS'e bağımlı değil
export class SubmitAttempt {
  constructor(private readonly quizzes: QuizRepository) {}
  async execute(cmd: { userId: string; quizId: string; answers: Map<string, string[]> }) {
    const quiz = await this.quizzes.findPublished(cmd.quizId);
    if (!quiz) throw new QuizNotPublished(cmd.quizId);           // domain hatası
    const attempt = Attempt.grade(cmd.userId, quiz, cmd.answers); // saf kural (gradeAnswer)
    await this.quizzes.saveAttempt(attempt);
    return { score: attempt.score, passed: attempt.passed };
  }
}

// quizzes/adapters/prisma-quiz.repository.ts — sürülen adaptör: port'u import eden O
@Injectable()
export class PrismaQuizRepository implements QuizRepository {
  constructor(private readonly prisma: PrismaService) {}
  async findPublished(id: string) {
    const row = await this.prisma.quiz.findFirst({ where: { id, ...PUBLIC_QUIZ }, include: { questions: true } });
    return row ? toDomainQuiz(row) : null;                       // satır → domain nesnesi
  }
  async saveAttempt(a: Attempt) { await this.prisma.attempt.create({ data: toRow(a) }); }
}

// quizzes/quizzes.module.ts — bağlama noktası (composition root)
@Module({
  providers: [
    { provide: QUIZ_REPOSITORY, useClass: PrismaQuizRepository },
    { provide: SubmitAttempt, useFactory: (r: QuizRepository) => new SubmitAttempt(r), inject: [QUIZ_REPOSITORY] },
  ],
})
export class QuizzesModule {}

// test: aynı modül, veritabanı yerine sahte
const moduleRef = await Test.createTestingModule({ imports: [QuizzesModule] })
  .overrideProvider(QUIZ_REPOSITORY)
  .useValue(new InMemoryQuizRepository([publishedQuiz]))
  .compile();
```
```python
from typing import Protocol, Optional

class QuizRepository(Protocol):                    # sürülen port
    def find_published(self, quiz_id: str) -> Optional["Quiz"]: ...
    def save_attempt(self, attempt: "Attempt") -> None: ...

class SubmitAttempt:                               # use case: çerçeve yok
    def __init__(self, quizzes: QuizRepository):
        self.quizzes = quizzes
    def execute(self, user_id, quiz_id, answers):
        quiz = self.quizzes.find_published(quiz_id)
        if quiz is None:
            raise QuizNotPublished(quiz_id)
        attempt = Attempt.grade(user_id, quiz, answers)
        self.quizzes.save_attempt(attempt)
        return attempt.score

class InMemoryQuizRepository:                      # test adaptörü
    def __init__(self, quizzes): self.quizzes, self.attempts = {q.id: q for q in quizzes}, []
    def find_published(self, quiz_id): return self.quizzes.get(quiz_id)
    def save_attempt(self, attempt): self.attempts.append(attempt)
```
:::

## Bedel: ne zaman fazla gelir?

Hexagonal düzen bedava değildir. Her sınırda bir **eşleme** (mapping) vardır: HTTP DTO'su → komut, satır → domain nesnesi, domain nesnesi → yanıt. İş kuralı az olan bir CRUD servisinde bu eşlemeler kodun çoğunu oluşturur ve kazanç küçük kalır. **Transaction yönetimi** de bir tasarım sorusudur: iki port'a yazılan verinin atomik olması gerekiyorsa use case'e bir "unit of work" port'u verilir ya da transaction, adaptörün tek bir metodunun içinde kalacak şekilde port yeniden tasarlanır. Son olarak her şey için port açmak bir tören hâline gelebilir; saat, kimlik üretici, rastgelelik gibi küçük bağımlılıklar için basit fonksiyon parametreleri çoğu zaman yeterlidir.

Pratik kural: domain mantığı zengin, ömrü uzun ve altyapısı değişmesi muhtemel servislerde hexagonal düzen kendini hızla öder. İnce bir proxy, bir raporlama uç noktası ya da birkaç haftalık bir deney için katmanlı basit kod daha dürüsttür.

:::realworld{company="Netflix"}
Netflix Studio mühendisleri 2020'de yayımladıkları "Ready for changes with Hexagonal Architecture" yazısında, stüdyo süreçlerini yöneten yeni bir uygulamayı neden ve nasıl hexagonal düzende kurduklarını anlatır. Uygulama başlangıçta verisini mevcut bir monolitten okumak zorundaydı, ama o verinin ileride yeni mikroservislere taşınacağı biliniyordu. Ekip kodu üç kavram etrafında düzenledi: domain nesneleri olan **varlıklar** (entities), bir iş eylemini yürüten **etkileşimciler** (interactors, yani use case'ler) ve veri kaynağının ayrıntısını saklayan **repository arayüzleri**; bunların dışında veri kaynağı adaptörleri ve HTTP gibi taşıma katmanları vardı. Yazının ana mesajı, veri kaynağı değiştiğinde yalnızca ilgili adaptörün yeniden yazıldığı ve iş mantığına dokunulmadığıdır. Test tarafında da benzer bir ayrım anlatılır: etkileşimciler veri kaynakları sahtelenerek hızlı test edilir, adaptörler ayrıca entegrasyon testlerinden geçer. Buradan çıkan genel ders şudur: iyi bir mimari, hangi veritabanının ya da protokolün kullanılacağı gibi kararları ertelemeye izin verir; iş kuralları yazılırken bunların bilinmesi gerekmez.
:::

:::callout{tone="warning" title="Sık yapılan hatalar"}
- **ORM'i arayüzle sarmak**: Port imzası `findFirst(where)` ise bağımlılık tersine dönmemiştir. Port, çekirdeğin ihtiyacını çekirdeğin diliyle anlatmalıdır.
- **Domain'e çerçeve dekoratörü sızdırmak**: Varlık sınıfında `@Column`, `@ApiProperty` gibi dekoratörler domain'i çerçeveye bağlar. Eşleme maliyetini kabul edin ya da bilinçli bir uzlaşma olarak belgeleyin.
- **Her adaptöre ayrı use case**: HTTP ve kuyruk aynı işi yapıyorsa aynı use case'i çağırmalı; iş kuralı adaptörlere kopyalanırsa hexagonal düzenin bütün değeri kaybolur.
:::

:::callout{tone="info" title="Mülakat ipuçları"}
- Tek cümle: "Akış iki yöne gider, bağımlılık yalnızca içeri; port'u çekirdek tanımlar, adaptör uygular."
- Sürücü ve sürülen port farkını örnekle söyleyin: controller ve kuyruk tüketicisi sürücü, repository ve e-posta istemcisi sürülen adaptördür.
- Test stratejisini sayın: saf domain testleri, sahtelerle use case testleri, sahte ve gerçek adaptöre karşı aynı sözleşme testi.
:::

:::quiz{src="quiz.json"}
:::

:::resources
- [Hexagonal architecture](https://alistair.cockburn.us/hexagonal-architecture/) — makale — Alistair Cockburn'ün özgün yazısı
- [The Clean Architecture](https://blog.cleancoder.com/uncle-bob/2012/08/13/the-clean-architecture.html) — blog — Robert C. Martin
- [Ready for changes with Hexagonal Architecture](https://netflixtechblog.com/ready-for-changes-with-hexagonal-architecture-b315ec967749) — blog — Netflix Technology Blog
- [NestJS: Custom providers](https://docs.nestjs.com/fundamentals/custom-providers) — belge — enjeksiyon anahtarları ve useClass/useFactory
:::

:::next{lesson="b-07-event-sourcing-cqrs"}
Sırada: durumu değil olayları saklamak. Olay deposu, projeksiyonlar, replay ve snapshot ile event sourcing ve CQRS'e derin bakış.
:::

---
id: n-06-cryptography-basics
slug: cryptography-basics
module: n-auth-security
order: 6
title:
  tr: "Kriptografi Temelleri"
  en: "Cryptography Basics"
summary:
  tr: "Hash ve şifre saklama (bcrypt/argon2), simetrik ve asimetrik şifreleme, TLS el sıkışması, imza ve anahtar yönetimi."
  en: "Hashing and password storage (bcrypt/argon2), symmetric and asymmetric encryption, the TLS handshake, signatures and key management."
durationMinutes: 35
level: intermediate
tags: [cryptography, hashing, password-storage, encryption, tls, key-management, security]
prerequisites: [n-05-owasp-top-10, n-02-jwt, f-07-security-layers]
concepts: [cryptographic-hash, password-hashing, hmac, symmetric-encryption, aead, asymmetric-cryptography, tls-handshake, key-management]
---

## Kavram: üç soru, altı araç

Önceki derslerde JWT imzalarından, refresh token hash'lerinden, argon2id'den ve TLS'ten defalarca bahsettik ama bunları bir kara kutu gibi kullandık. Bu derste kutuyu açıyoruz. Amaç kriptografik algoritmaları matematiksel olarak türetmek değil; bir yazılım mühendisinin her gün verdiği "burada hangi aracı, hangi ayarla kullanmalıyım?" kararını doğru verebilmek.

Kriptografi temelde üç soruya cevap verir:

- **Gizlilik**: Bu veriyi yetkisiz biri okuyabilir mi?
- **Bütünlük**: Bu veri yolda ya da depoda değiştirildi mi?
- **Köken doğrulama**: Bu veriyi gerçekten iddia edilen taraf mı üretti?

Bu sorulara cevap veren araçlar sınırlı sayıdadır ve her birinin net bir işi vardır:

| Araç | Ne sağlar? | Anahtar | Tipik örnek |
|---|---|---|---|
| Kriptografik hash | Bütünlük (parmak izi) | Yok | SHA-256, dosya özeti, refresh token özeti |
| Şifre hash'i (KDF) | Şifreyi geri döndürülemez ve yavaş saklamak | Tuz (gizli değil) | argon2id, bcrypt, scrypt |
| MAC (HMAC) | Bütünlük + köken (paylaşılan sırla) | Simetrik sır | HS256 JWT, webhook imzası |
| Simetrik şifreleme (AEAD) | Gizlilik + bütünlük | Simetrik anahtar | AES-256-GCM, ChaCha20-Poly1305 |
| Asimetrik şifreleme / anahtar değişimi | Anahtarı güvensiz kanalda kurmak | Açık/özel anahtar çifti | ECDHE (TLS), RSA-OAEP |
| Dijital imza | Bütünlük + köken (herkes doğrulayabilir) | Özel anahtar imzalar, açık doğrular | Ed25519, ECDSA, RS256 JWT |

Bu tablonun en önemli dersi, araçların birbirinin yerine **kullanılamayacağıdır**. Şifreleme bütünlük sağlamaz (AEAD hariç), hash gizlilik sağlamaz, MAC herkese doğrulatılamaz. Güvenlik hatalarının önemli bir kısmı yanlış aracın seçilmesinden doğar.

:::diagram{src="diagram.svg" alt="Kriptografi araç kutusu ve TLS 1.3 el sıkışması: solda hash, şifre hash'i, HMAC, AEAD, anahtar değişimi ve imzanın sağladığı garantiler; sağda istemci ve sunucu arasında ClientHello, ServerHello ile ECDHE anahtar paylaşımı, sertifika ve imza doğrulaması, Finished mesajları ve ardından AEAD ile şifreli uygulama verisi|Cryptography toolbox and the TLS 1.3 handshake: on the left the guarantees provided by hashes, password hashes, HMAC, AEAD, key exchange and signatures; on the right ClientHello and ServerHello with ECDHE key shares, certificate and signature verification, Finished messages and then application data encrypted with AEAD between client and server"}
TLS, tablodaki araçların neredeyse hepsini tek bir protokolde birleştirir.
:::

## Hash: parmak izi

Kriptografik bir hash fonksiyonu, herhangi uzunluktaki girdiden sabit uzunlukta bir özet üretir ve üç özellik taşır: özetten girdiye geri gitmek pratikte imkânsızdır (ön görüntü direnci), aynı özeti veren iki farklı girdi bulmak pratikte imkânsızdır (çakışma direnci) ve girdideki tek bir bitlik değişiklik özetin tamamen farklılaşmasına yol açar. Bugün varsayılan seçim SHA-256 ya da SHA-3 ailesidir. MD5 ve SHA-1'de pratik çakışmalar bulunmuştur; güvenlik amaçlı yeni hiçbir yerde kullanılmamalıdır.

Hash'in tipik kullanımları: indirilen bir dosyanın bozulmadığını doğrulamak, içerik adresli depolama (aynı özet aynı içerik demektir), ilk derste gördüğümüz gibi yüksek entropili token'ların veritabanında özetle saklanması. Ama düz bir hash tek başına **köken** kanıtı değildir: bir dosyayı değiştiren saldırgan, yanındaki özeti de yeniden hesaplayabilir. Köken için anahtarlı bir yapıya, MAC'e ya da imzaya ihtiyaç vardır.

## Şifre saklama: bilerek yavaş olmak

Şifreler hash'in en yaygın ve en sık yanlış uygulandığı alandır. SHA-256 tasarım gereği **hızlıdır**; modern bir ekran kartı saniyede milyarlarca SHA-256 hesaplayabilir. Veritabanınız sızdığında saldırgan, elindeki şifre hash'lerine karşı sözlükleri ve yaygın şifre kalıplarını çevrimdışı ve sınırsız hızda dener. Şifrelerin entropisi düşük olduğu için (insanlar tahmin edilebilir şifreler seçer) bu deneme şaşırtıcı derecede verimlidir.

Şifre saklamanın üç kuralı vardır:

1. **Tuz (salt)**: Her şifre için rastgele, benzersiz bir değer hash'e katılır ve hash'in yanında saklanır. Böylece aynı şifreye sahip iki kullanıcının hash'leri farklı olur ve önceden hesaplanmış tablolar işe yaramaz. Tuz gizli değildir.
2. **Yavaşlık**: Hash bilerek pahalı yapılır; tek bir doğrulama yaklaşık on ile yüz milisaniye sürecek şekilde ayarlanır. Kullanıcı için fark edilmez, ama saldırganın her denemesi aynı maliyeti öder.
3. **Bellek zorluğu**: Hesaplama çok miktarda bellek gerektirirse, özel donanım ve ekran kartlarıyla paralel deneme ekonomik olmaktan çıkar.

Bu kuralları bir arada uygulayan algoritmalar **argon2id** (güncel varsayılan öneri; bellek, zaman ve paralellik parametreleri ayarlanabilir), **scrypt** (bellek zorluğu olan eski bir seçenek), **bcrypt** (yaygın ve olgun, ama bellek zorluğu sınırlı ve girdiyi 72 baytta keser) ve uyumluluk gerektiğinde yüksek tekrar sayısıyla **PBKDF2**'dir. Modern kütüphaneler tuzu kendileri üretir ve parametrelerle birlikte tek bir dizeye (`$argon2id$v=19$m=65536,t=3,p=4$…`) kodlar. Bu sayede donanım hızlandıkça parametreleri artırabilir ve kullanıcı bir sonraki girişte doğru şifreyi girdiğinde hash'ini yeni parametrelerle yeniden hesaplayabilirsiniz.

Bazı sistemler ek olarak bir **biber (pepper)** kullanır: tüm şifrelere katılan ama veritabanında değil, ayrı bir gizli bilgi yöneticisinde tutulan bir sır. Yalnızca veritabanı sızarsa, biber olmadan hash'ler denenemez.

Tuzun ve bilerek yavaş bir hash'in birlikte ne kazandırdığını, kayıttan girişe ve bir yedek sızıntısına kadar izleyelim.

:::predict{id="ayni-sifre-farkli-tuz"}
İki kullanıcı aynı şifreyi seçiyor; şifreler argon2id ile, her kullanıcı için ayrı tuzla saklanıyor. Tablodaki iki hash dizesi için ne söylenebilir? | Two users pick the same password; passwords are stored with argon2id and a separate salt per user. What can be said about the two hash strings in the table?
- [ ] Aynıdır, çünkü şifre aynıdır | They are identical because the password is the same
- [x] Tamamen farklıdır, çünkü her birinin tuzu farklıdır | They are completely different because each has a different salt
- [ ] Yalnızca parametre kısmı farklıdır | Only the parameter part differs
Açıklama: Tuz hash'e katıldığı için aynı şifre farklı özetler üretir. Böylece bir hash'i kırmak, aynı şifreyi kullanan diğer hesapları otomatik olarak açmaz ve önceden hesaplanmış tablolar işe yaramaz. | Because the salt is mixed into the hash, the same password yields different digests. Cracking one hash therefore does not unlock other accounts with the same password, and precomputed tables are useless.
:::

:::animation{scene="password-hash.scene.json"}
Kayıtta rastgele tuz ve argon2id; aynı şifre farklı dize üretir, girişte aynı parametrelerle yeniden hesaplanır, sızan yedekte her tahmin ayrı ve pahalıdır.
:::

:::code{lang="ts" title="Şifre saklama: argon2id ile hash, doğrulama ve parametre yükseltme"}
```ts
import * as argon2 from 'argon2';

const PARAMS = { type: argon2.argon2id, memoryCost: 64 * 1024, timeCost: 3, parallelism: 1 } as const;

export async function hashPassword(plain: string): Promise<string> {
  return argon2.hash(plain, PARAMS);            // tuz otomatik; sonuç parametreleri de içerir
}

export async function verifyAndUpgrade(stored: string, plain: string, save: (h: string) => Promise<void>) {
  const ok = await argon2.verify(stored, plain); // sabit zamanlı karşılaştırma kütüphanede
  if (ok && argon2.needsRehash(stored, PARAMS)) {
    await save(await hashPassword(plain));        // eski parametreler → yeni hash
  }
  return ok;
}

// ✗ ASLA: createHash('sha256').update(plain).digest('hex')  — hızlı, tuzsuz, sözlükle kırılır
```
```python
from argon2 import PasswordHasher
from argon2.exceptions import VerifyMismatchError
import bcrypt

ph = PasswordHasher(time_cost=3, memory_cost=64 * 1024, parallelism=1)  # argon2id varsayılan

def hash_password(plain: str) -> str:
    return ph.hash(plain)

def verify_and_upgrade(stored: str, plain: str, save) -> bool:
    try:
        ph.verify(stored, plain)
    except VerifyMismatchError:
        return False
    if ph.check_needs_rehash(stored):
        save(ph.hash(plain))
    return True

# bcrypt alternatifi: girdi 72 bayta kesilir; cost (rounds) ≥ 12
def bcrypt_hash(plain: str) -> bytes:
    return bcrypt.hashpw(plain.encode(), bcrypt.gensalt(rounds=12))
```
:::

## HMAC: sırrı bilenin imzası

**HMAC**, bir hash fonksiyonunu gizli bir anahtarla birleştirerek mesaj doğrulama kodu üretir. Mesajı ve sırrı bilen taraf aynı kodu yeniden hesaplayıp karşılaştırır; sırrı bilmeyen biri mesajı değiştirdiğinde geçerli kodu üretemez. HS256 ile imzalanan JWT'ler, ödeme sağlayıcılarının webhook imzaları ve imzalı indirme bağlantıları HMAC'e dayanır.

HMAC'in güvenliği tamamen sırra bağlıdır. Algoritma herkesçe bilinir; tek gizli olan anahtardır. Bu yüzden sır yeterince uzun ve rastgele olmalı, kodda değil gizli bilgi yöneticisinde durmalı ve periyodik olarak döndürülmelidir. Karşılaştırma da **sabit zamanlı** yapılmalıdır: ilk farklı baytta duran sıradan bir string karşılaştırması, yanıt süresi üzerinden doğru koda adım adım yaklaşılmasına izin verebilir.

:::interactive{type="jwt-inspector" secret="rotate-me" token=""}
Örnek token'ın `rotate-me` sırrıyla imzalandığını ve imzanın geçerli göründüğünü doğrulayın. Şimdi gövdeye hiç dokunmadan yalnızca **sırrı** değiştirin: imza durumu geçersize döner, çünkü HMAC aynı mesaj için farklı sırla tamamen farklı bir kod üretir. Sırrı tekrar `rotate-me` yaptığınızda imza yeniden geçerli olur. Bu, anahtar rotasyonunun neden eski token'ları geçersiz kıldığını ve kısa, tahmin edilebilir bir sırrın neden çevrimdışı denemeyle bulunabileceğini gösterir.
:::

## Simetrik şifreleme: AEAD varsayılandır

Simetrik şifrelemede aynı anahtar şifreler ve çözer. Hızlıdır ve büyük veriler için tek pratik seçenektir. Günümüzde doğru seçim neredeyse her zaman bir **AEAD** (ilişkili veriyle doğrulanmış şifreleme) yapısıdır: **AES-256-GCM** ya da donanım hızlandırması olmayan cihazlarda **ChaCha20-Poly1305**. AEAD, veriyi hem şifreler hem de bir doğrulama etiketi üretir; şifreli metin tek bir bit değiştirilse bile çözme işlemi hata verir. Ayrıca şifrelenmeyen ama bütünlüğü korunması gereken "ilişkili veri" (örneğin kaydın kimliği) de etikete dahil edilebilir; böylece bir kaydın şifreli alanı başka bir kayda taşınamaz.

AES-GCM'nin tek ama acımasız kuralı vardır: aynı anahtarla **aynı nonce asla iki kez kullanılmamalıdır**. 96 bitlik nonce her şifrelemede rastgele üretilir ve şifreli metnin yanında saklanır (gizli değildir). Nonce tekrarlanırsa saldırgan iki mesajın düz metinleri arasındaki ilişkiyi çıkarabilir ve doğrulama anahtarını ele geçirip sahte mesaj üretebilir. Çok yüksek hacimde şifreleme yapan sistemler bu yüzden anahtarı belirli bir mesaj sayısından sonra döndürür.

:::callout{tone="info" title="Derinleşme"}
Eski bir hata kalıbını da bilmek gerekir: blokları birbirinden bağımsız şifreleyen **ECB modu**, aynı düz metin bloklarını aynı şifreli bloklara çevirir ve verinin desenini açığa çıkarır. Doğrulama etiketi olmayan **CBC** gibi modlar ise ek bir MAC olmadan değiştirilmeye açıktır. Kütüphanenizin size mod seçtirdiği her yerde GCM'i seçin.
:::

:::callout{tone="warning" title="Nonce tekrar etmez, anahtar kodda durmaz"}
AES-GCM'de sabit bir nonce kullanmak ("hep sıfır") ya da sayaç tabanlı nonce'u yeniden başlatmalarda sıfırlamak, şifrelemenin bütün garantisini çöpe atar. Anahtarı kaynak koduna ya da yapılandırma dosyasına gömmek ise şifrelemeyi bir formaliteye çevirir: kodu gören herkes veriyi çözer. Nonce her seferinde kriptografik rastgele üreticiden gelsin, anahtar bir anahtar yönetim servisinden.
:::

:::code{lang="ts" title="AES-256-GCM ile alan şifreleme (ilişkili veriyle)"}
```ts
import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

/** key: 32 bayt; KMS'ten çözülmüş veri anahtarı (DEK). aad: kaydın kimliği gibi bağlam. */
export function encrypt(key: Buffer, plaintext: string, aad: string): string {
  const iv = randomBytes(12);                                  // 96 bit, HER şifrelemede yeni
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  cipher.setAAD(Buffer.from(aad));
  const ct = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();                              // 16 bayt doğrulama etiketi
  return [iv, tag, ct].map((b) => b.toString('base64url')).join('.');
}

export function decrypt(key: Buffer, packed: string, aad: string): string {
  const [iv, tag, ct] = packed.split('.').map((s) => Buffer.from(s, 'base64url'));
  const decipher = createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAAD(Buffer.from(aad));
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ct), decipher.final()]).toString('utf8'); // değiştirilmişse hata
}
```
```python
import base64, os
from cryptography.hazmat.primitives.ciphers.aead import AESGCM

def encrypt(key: bytes, plaintext: str, aad: str) -> str:
    nonce = os.urandom(12)                                     # her şifrelemede yeni
    ct = AESGCM(key).encrypt(nonce, plaintext.encode(), aad.encode())  # etiket ct'nin sonunda
    return base64.urlsafe_b64encode(nonce + ct).decode()

def decrypt(key: bytes, packed: str, aad: str) -> str:
    raw = base64.urlsafe_b64decode(packed)
    nonce, ct = raw[:12], raw[12:]
    return AESGCM(key).decrypt(nonce, ct, aad.encode()).decode()  # InvalidTag → değiştirilmiş
```
:::

## Asimetrik kriptografi: anahtar dağıtımı problemine cevap

Simetrik şifrelemenin çözemediği soru şudur: iki taraf daha önce hiç buluşmadıysa ortak anahtarı nasıl paylaşacak? **Asimetrik kriptografi** her tarafa bir anahtar çifti verir: özel anahtar sahibinde kalır, açık anahtar herkese verilebilir. Bu yapı iki farklı işe yarar.

**Anahtar değişimi**: Diffie-Hellman ailesi (bugün eliptik eğri versiyonu **ECDHE**), iki tarafın açık kanalda yalnızca açık değerler paylaşarak, dinleyen birinin hesaplayamayacağı ortak bir sır üretmesini sağlar. "E" harfi *ephemeral*, yani geçici demektir: her bağlantı için yeni anahtar çifti üretilir. Bu sayede sunucunun uzun ömürlü özel anahtarı yıllar sonra sızsa bile geçmişte kaydedilmiş trafik çözülemez. Bu özelliğe **ileri gizlilik (forward secrecy)** denir.

**Dijital imza**: Özel anahtarla imzalanan bir mesajı, açık anahtarı bilen herkes doğrulayabilir; ama yalnızca özel anahtar sahibi imzalayabilir. RS256 JWT'ler, yazılım paketlerinin imzaları ve TLS sertifikaları bu ilkeye dayanır. Güncel tercih **Ed25519** ya da **ECDSA P-256**'dır; RSA kullanılacaksa en az 2048, tercihen 3072 bit anahtar ve imza için PSS, şifreleme için OAEP dolgusu seçilmelidir.

Asimetrik işlemler simetrik olanlardan çok daha yavaştır. Bu yüzden pratikte **hibrit** kullanılır: asimetrik kriptografi yalnızca bir simetrik anahtar üzerinde anlaşmak ya da onu sarmak için kullanılır, verinin kendisi AEAD ile şifrelenir.

## TLS 1.3 el sıkışması: hepsi bir arada

Tarayıcınızın adres çubuğundaki kilit simgesi, tablodaki araçların neredeyse hepsinin tek bir gidiş-dönüşte birlikte çalıştığı anlamına gelir:

1. **ClientHello**: İstemci desteklediği şifre takımlarını ve bir ECDHE açık anahtar payını gönderir.
2. **ServerHello**: Sunucu bir takım seçer ve kendi ECDHE payını gönderir. Bu noktadan sonra iki taraf ortak sırrı hesaplamıştır ve el sıkışmanın geri kalanı zaten şifrelidir.
3. **Sertifika ve CertificateVerify**: Sunucu, alan adının kendisine ait olduğunu gösteren ve bir sertifika otoritesince imzalanmış sertifikasını gönderir; ardından el sıkışma dökümünü özel anahtarıyla imzalar. İstemci sertifika zincirini güvendiği kök otoritelere kadar doğrular, alan adını kontrol eder ve imzayı sertifikadaki açık anahtarla doğrular. Böylece konuştuğu tarafın gerçekten o alan adının sahibi olduğundan emin olur.
4. **Finished**: İki taraf da el sıkışmanın tamamı üzerinde bir HMAC gönderir; araya giren biri herhangi bir mesajı değiştirdiyse burada yakalanır.
5. **Uygulama verisi**: Türetilen anahtarlarla AES-GCM ya da ChaCha20-Poly1305 kullanılarak şifrelenir.

TLS 1.3, eski sürümlerdeki zayıf seçenekleri (statik RSA anahtar değişimi, CBC modları, RC4) tamamen kaldırmış ve el sıkışmayı tek gidiş-dönüşe indirmiştir. Sizin işiniz büyük ölçüde doğru yapılandırmadır: TLS 1.2 altını kapatmak, sertifikaları otomatik yenilemek ve tarayıcıya siteye yalnızca HTTPS ile bağlanmasını söyleyen **HSTS** başlığını göndermek.

El sıkışmanın beş adımını, asimetrik anahtar değişiminden simetrik oturum anahtarına geçişi ve ileri gizliliği sahnede izleyin.

:::animation{scene="tls-handshake.scene.json"}
ClientHello ve ServerHello ile ECDHE payları değişir, iki taraf aynı sırrı hesaplar; sertifika ve imza doğrulanır, Finished mesajlarından sonra veri AES-GCM ile akar.
:::

## Anahtar yönetimi: kriptografinin zor kısmı

Algoritmalar çoğu zaman sorun değildir; anahtarlar sorundur. Sağlam bir anahtar yönetimi birkaç ilkeye dayanır:

- **Rastgelelik**: Anahtarlar, nonce'lar, tuzlar ve token'lar yalnızca kriptografik rastgele sayı üreticisinden (`crypto.randomBytes`, `secrets`) gelir; `Math.random` gibi üreticiler tahmin edilebilir.
- **Zarf şifreleme (envelope encryption)**: Veri, rastgele bir veri anahtarıyla (DEK) şifrelenir; DEK ise bir anahtar yönetim servisinde (KMS) duran ve hiçbir zaman servisten çıkmayan ana anahtarla (KEK) şifrelenip verinin yanında saklanır. Ana anahtarı döndürmek, tüm veriyi yeniden şifrelemeden yalnızca DEK'leri yeniden sarmak demektir.
- **Rotasyon ve sürümleme**: Her anahtarın bir kimliği ve sürümü vardır; şifreli verinin yanında hangi anahtar sürümüyle şifrelendiği yazılır. Böylece eski veri çözülebilirken yeni veri yeni anahtarla yazılır.
- **Ayrım**: İmza anahtarı, şifreleme anahtarı ve HMAC sırrı farklıdır; aynı anahtarı birden fazla amaçla kullanmak, bir kullanımdaki zayıflığın diğerine sıçramasına yol açar.
- **Erişim ve denetim**: Kimin hangi anahtarı kullanabildiği IAM ile sınırlandırılır ve her kullanım kaydedilir.

:::callout{tone="danger" title="Kendi kriptonu yazma"}
Kendi şifreleme algoritmanızı, kendi "karıştırma" fonksiyonunuzu ya da hash'leri art arda birleştiren kendi şifre saklama düzeninizi tasarlamayın. Kriptografide hata, kod çalışmaya devam ederken sessizce oluşur ve testlerle yakalanmaz. Olgun, yüksek seviyeli kütüphaneleri (libsodium, platformun yerleşik `crypto` modülü, `cryptography` paketi) varsayılan ayarlarıyla kullanın; mod, dolgu ve nonce gibi ayrıntıları size bırakan düşük seviyeli API'lerden mümkünse uzak durun.
:::

Bu platformda şifreler argon2id ile hash'lenir; refresh token'lar yüksek entropili rastgele değerler olduğu için veritabanında SHA-256 özetiyle saklanır; access token'lar HMAC-SHA256 ile imzalanır ve sırrı ortam değişkeninden okunur; Google ve Apple ID token'ları ise sağlayıcıların asimetrik açık anahtarlarıyla doğrulanır. Tek bir uygulamada tablodaki araçların dördü, her biri kendi doğru yerinde kullanılır.

:::realworld{company="LinkedIn"}
2012'de LinkedIn'den yaklaşık 6,5 milyon şifre hash'i bir forumda yayımlandı ve kısa sürede büyük kısmı kırıldı. Sebep, şifrelerin **tuzsuz SHA-1** ile saklanmasıydı: hızlı bir hash olduğu için sözlük denemeleri ekran kartlarında çok hızlı ilerledi ve tuz olmadığı için aynı şifreyi kullanan herkesin hash'i aynıydı, tek bir kırılma binlerce hesabı birden açtı. Dört yıl sonra aynı ihlalin aslında 100 milyonu aşkın hesabı kapsadığı ortaya çıktı. Şirket o dönemde tuzlu ve daha güçlü bir hash'e geçmişti, ama eski hash'ler zaten sızmıştı ve birçok kullanıcı aynı şifreyi başka sitelerde de kullandığı için etki LinkedIn'in ötesine geçti. Olay, "hash'liyoruz" demenin yeterli olmadığının, hash'in **türünün** belirleyici olduğunun klasik örneğidir.
:::

:::callout{tone="tip" title="Mülakat özeti"}
- Şifre için hızlı hash değil, tuzlu ve yavaş bir KDF: argon2id (ya da bcrypt/scrypt); parametreleri zamanla yükselt.
- Simetrik şifreleme için AEAD (AES-GCM, ChaCha20-Poly1305); nonce asla tekrar etmez.
- HMAC paylaşılan sırla, imza özel anahtarla köken kanıtlar; imzayı herkes doğrulayabilir, HMAC'i yalnızca sırrı bilen.
- TLS 1.3: ECDHE ile ileri gizlilik, sertifika imzasıyla kimlik, AEAD ile veri.
- Zor kısım anahtar yönetimidir: KMS, zarf şifreleme, rotasyon, amaç başına ayrı anahtar.
:::

:::quiz{src="quiz.json"}
:::

:::next{lesson="n-07-threat-modeling"}
Sırada: tüm bu araçları nerede kullanacağımıza karar vermek. STRIDE, güven sınırları, gizli bilgi yönetimi ve tedarik zinciri güvenliği.
:::

---
id: h-04-git-notes
slug: git-notes
module: h-devops-tools
order: 4
title:
  tr: "Git: Commit Grafiği, Dallanma, Merge ve Rebase"
  en: "Git: Commit Graph, Branching, Merge and Rebase"
summary:
  tr: "Git'te commit, dal, merge/rebase ve uzak depo akışını öğren; hataları güvenle geri al ve kurtar."
  en: "Learn Git's commit, branch, merge/rebase and remote workflow, and safely undo and recover mistakes."
durationMinutes: 30
level: beginner
tags: [git, version-control, github, branching, ci-cd, collaboration]
prerequisites: [h-01-linux-notes, f-02-code-journey-ci-cd]
concepts: [git-objects, commit-graph, staging-area, commit, branching, merge, fast-forward, rebase, merge-conflict, remote-repository, pull-request, git-stash, cherry-pick, git-reflog, gitignore, commit-message]
---

## Kavram: zamanda yolculuk yapabilen bir dosya sistemi

Bir projeyi tek başınıza bile geliştirseniz iki soruyla karşılaşırsınız: "Dün çalışan hâli nasıl geri getiririm?" ve "Bu deneysel değişikliği ana kodu bozmadan nasıl denerim?" Ekip hâlinde çalışmaya başladığınızda üçüncü soru eklenir: "İkimiz aynı dosyayı değiştirdik, şimdi ne olacak?" **Git**, bu üç soruya tek bir modelle cevap veren dağıtık bir sürüm kontrol sistemidir.

Git'i anlamanın anahtarı, onu "dosya değişikliklerini kaydeden bir araç" olarak değil, **projenin anlık görüntülerinden (snapshot) oluşan bir grafik** olarak görmektir. Her commit, o andaki tüm projenin bir fotoğrafıdır ve bir önceki fotoğrafı işaret eder. Dallar, birleştirmeler ve kurtarma işlemlerinin hepsi bu grafiğin üzerinde yapılan basit hamlelerdir.

## Git'in iç yapısı: blob, tree, commit

`.git` klasörünün içinde içerik adresli (content-addressed) bir nesne veritabanı yaşar. Her nesnenin adı, içeriğinin **SHA-1 özetidir**; aynı içerik her zaman aynı adı alır. Üç nesne türü vardır:

- **blob** — bir dosyanın içeriği. Dosyanın adı ya da yolu blob'da yoktur; yalnızca baytlar vardır. İki farklı dosyanın içeriği aynıysa tek bir blob paylaşılır.
- **tree** — bir dizin. İçindeki dosya adlarını, izinlerini ve her birinin işaret ettiği blob ya da alt tree'yi listeler.
- **commit** — kök tree'yi, yazar ve tarih bilgisini, mesajı ve **ebeveyn commit'i** işaret eden nesne. Bir birleştirme commit'inin iki ebeveyni vardır.

Commit'lerin birbirini işaret etmesi, geçmişi bir **yönlü döngüsüz grafik (DAG)** hâline getirir. Bir dosyayı değiştirmeden yalnızca adını değiştirdiğinizde blob aynı kalır; yeni bir tree ve yeni bir commit oluşur. Bu yüzden Git yeniden adlandırmayı ayrıca kaydetmez, iki tree'yi karşılaştırarak çıkarır.

**Dal (branch)**, bir commit'i işaret eden 41 baytlık küçük bir dosyadır; `.git/refs/heads/main` içinde yalnızca bir hash yazar. **HEAD** ise "şu an hangi daldayım" sorusunun cevabıdır. Dal açmanın anında olmasının sebebi budur: kopyalanan hiçbir şey yoktur, yalnızca bir işaretçi yazılır.

## Dört alan: çalışma dizini, staging, yerel depo, uzak depo

Bir değişiklik Git'te dört alandan geçer. **Çalışma dizini (working directory)** diskinizdeki gerçek dosyalardır. **Staging alanı (index)**, bir sonraki commit'e girecek değişikliklerin hazırlandığı ara bölgedir; `git add` ile dosyaları buraya taşırsınız ve yalnızca istediklerinizi seçebilirsiniz. **Yerel depo (.git)**, commit'lerin kalıcı olarak yazıldığı yerdir. **Uzak depo (remote)** ise GitHub, GitLab ya da bir sunucudaki kopyadır; `push` ile gönderir, `fetch` ile çekersiniz.

:::diagram{src="diagram.svg" alt="Dört Git alanı: çalışma dizini, staging alanı, yerel depo ve uzak depo; aralarında git add, git commit, git push, git fetch, git merge, git pull ve git checkout okları|The four Git areas: working directory, staging area, local repository and remote; arrows for git add, git commit, git push, git fetch, git merge, git pull and git checkout"}
Staging alanı sayesinde bir dosyadaki değişikliklerin yalnızca bir kısmını commit'e alabilirsiniz (`git add -p`).
:::

Staging alanının varlığı yeni başlayanlara gereksiz görünür ama asıl gücü buradadır: üç dosya değiştirip bunları iki anlamlı commit'e bölebilirsiniz. Hangi dosyanın hangi alanda olduğunu her zaman `git status` söyler; iki alan arasındaki farkı `git diff` (çalışma dizini ↔ staging) ve `git diff --staged` (staging ↔ son commit) gösterir.

:::code{lang="bash" title="Temel akış: depo oluştur, değiştir, kaydet, gönder"}
```bash
git init                                  # ya da: git clone git@github.com:ekip/proje.git
git config --global user.name "Ada Yılmaz"
git config --global user.email "ada@ornek.com"

echo "# Proje" > README.md
git status                                # README.md: untracked
git add README.md                         # staging'e al
git commit -m "docs: README iskeleti"     # yerel depoya yaz

git log --oneline --graph --all           # geçmişi grafik olarak gör
git diff                                  # kaydedilmemiş değişiklikler
git diff --staged                         # commit'e girecek değişiklikler

git remote add origin git@github.com:ekip/proje.git
git push -u origin main                   # ilk gönderimde takip ilişkisini kur
```
:::

## Dallanma: ucuz, bol ve kısa ömürlü

Her yeni iş için bir dal açmak Git'te bir alışkanlık değil, varsayılan çalışma biçimidir. `git switch -c feature/login` komutu yeni bir işaretçi oluşturur ve HEAD'i oraya taşır; artık yapacağınız commit'ler `main`'i etkilemez. İş bitince dal `main` ile birleştirilir ve silinir. Dallar kısa ömürlü olduğunda (birkaç gün) birleştirme çakışmaları küçük kalır; haftalarca yaşayan dallar ise birleştirildiğinde acı verir.

Ekiplerin çoğu basit bir adlandırma kuralı kullanır: `feature/...`, `fix/...`, `chore/...`. `main` her zaman dağıtılabilir durumdadır; kimse doğrudan `main`'e commit atmaz, her değişiklik bir pull request ile girer.

## Merge mi, rebase mi?

İki dal aynı noktadan ayrılıp farklı commit'ler aldığında onları birleştirmenin iki yolu vardır.

**Merge**, iki dalın ucunu ve ortak atasını alıp yeni bir **merge commit** üretir. Bu commit'in iki ebeveyni vardır ve geçmiş olduğu gibi korunur: kimin ne zaman ne yaptığı değişmez. Ortak ata ile iki ucun karşılaştırılmasından dolayı buna **üç yollu birleştirme (3-way merge)** denir. Özel bir durum vardır: `main` dal ayrıldığından beri hiç ilerlemediyse Git merge commit üretmek yerine `main` işaretçisini feature dalının ucuna kaydırır; buna **fast-forward** denir. Pull request'in geçmişte görünür bir iz bırakmasını isteyen ekipler `--no-ff` ile her zaman merge commit üretir.

**Rebase** ise feature dalındaki commit'leri alıp `main`'in son commit'inin üzerine **yeniden uygular**. Sonuç düz, doğrusal bir geçmiştir; ama commit'ler yeniden yazıldığı için hash'leri değişir. Bu yüzden altın kural: **paylaşılan bir dalı asla rebase etmeyin.** Kendi feature dalınızı pull request'ten önce `main` üzerine rebase etmek temiz bir geçmiş verir; `main`'i rebase etmek ise ekip arkadaşlarınızın geçmişini bozar.

Aşağıdaki animasyon tipik bir akışı gösterir: `main` üzerinde iki commit, bir feature dalı, iki tarafta da ilerleme ve sonunda bir merge commit.

:::animation{scene="scene.json"}
Ortak ata C2'den ayrılan main ve feature dalları, üç yollu birleştirmeyle M commit'inde buluşur.
:::

**Çakışma (conflict)**, iki taraf aynı dosyanın aynı satırlarını farklı biçimde değiştirdiğinde ortaya çıkar. Git karar veremez ve dosyaya `<<<<<<<`, `=======`, `>>>>>>>` işaretleri koyar. Siz dosyayı düzenleyip doğru hâli bırakır, `git add` ile çözüldüğünü bildirir ve `git merge --continue` (ya da rebase sırasında `git rebase --continue`) ile devam edersiniz. Çakışmalar hata değil, iki insanın aynı yere dokunduğunun kanıtıdır; onları küçük tutmanın yolu sık birleştirmektir.

:::code{lang="bash" title="Dal açma, merge, rebase ve çakışma çözme"}
```bash
git switch -c feature/login               # dal aç ve geç
git commit -am "feat: login formu"        # izlenen dosyaları add+commit

# main'i güncel tut, feature'ı üzerine rebase et (yalnızca kendi dalında!)
git switch main && git pull
git switch feature/login
git rebase main                           # çakışma olursa: düzenle, git add, git rebase --continue

# merge: feature'ı main'e al
git switch main
git merge --no-ff feature/login           # her zaman merge commit üret
git branch -d feature/login               # birleşmiş dalı sil

# çakışma anında
git status                                # "both modified: src/auth.ts"
# dosyayı düzenle, işaretleri kaldır
git add src/auth.ts
git merge --continue
git merge --abort                         # vazgeçip başa dön
```
:::

:::callout{tone="warning" title="Geçmişi yeniden yazan komutlar"}
`rebase`, `commit --amend`, `reset --hard` ve `push --force` commit'leri değiştirir ya da siler. Bunlar yalnızca henüz paylaşılmamış, size ait commit'lerde güvenlidir. Zorunlu kaldığınızda `git push --force-with-lease` kullanın: uzak dal sizin bildiğinizden farklıysa gönderimi reddeder ve ekip arkadaşınızın commit'lerini ezmenizi engeller.
:::

## Dene: commit grafiğini kendin kur

:::interactive{type="git-graph" scenario="merge"}
main ve feature dallarına commit ekle, sonra "merge" ile üç yollu birleştirmeyi, "rebase" ile doğrusal geçmişi karşılaştır. Çakışma senaryosunu seçip aynı dosyayı iki dalda değiştirdiğinde Git'in neden duraksadığını ve çözüm adımını izle; sağdaki komut günlüğü her tıklamanın karşılık geldiği git komutunu gösterir.
:::

## Uzak depo ve pull request akışı

`git fetch` uzak depodaki yeni commit'leri indirir ama dallarınıza dokunmaz; `origin/main` gibi uzak takip dalları güncellenir ve siz incelemeden hiçbir şey birleşmez. `git pull` ise `fetch` artı `merge`'dür (ayarlarsanız `fetch` artı `rebase`). Alışkanlık olarak önce `fetch`, sonra `git log main..origin/main` ile ne geldiğine bakmak, ardından birleştirmek daha güvenlidir.

**Pull request (PR)** — GitLab'da merge request — Git'in değil barındırma platformunun kavramıdır: "feature dalımı main'e almak istiyorum, inceleyin" demektir. Tipik akış şöyledir: dal aç → commit'le → `push` → PR aç → otomatik testler (CI) koşar → bir ekip arkadaşı inceler → istenen düzeltmeler yeni commit'lerle gelir → PR birleştirilir → dal silinir. CI/CD dersinde gördüğünüz boru hattı tam olarak bu PR'ın üzerinde tetiklenir; birleştirme düğmesi testler yeşil olmadan açılmaz.

## Kurtarma araçları: stash, cherry-pick, reflog

**Stash**, yarım kalan değişiklikleri commit etmeden kenara koyar. Acil bir hata düzeltmesi için dal değiştirmeniz gerektiğinde `git stash` çalışma dizinini temizler, işiniz bitince `git stash pop` değişiklikleri geri getirir. `git stash list` birikenleri gösterir; `apply` uygulayıp listede tutar, `pop` uygulayıp siler.

**Cherry-pick**, başka bir daldaki tek bir commit'i alıp bulunduğunuz dala uygular. Sürüm dalına yalnızca bir hata düzeltmesini taşımak için idealdir; ama aynı değişikliğin iki farklı hash ile iki dalda yaşadığını unutmayın.

**Reflog**, Git'in gizli emniyet kemeridir. HEAD'in gittiği her yer — her commit, checkout, reset, rebase — yerel olarak kaydedilir. Yanlışlıkla `reset --hard` yaptınız ya da rebase sırasında commit kaybettiniz diyelim: `git reflog` ile eski konumu bulur, `git reset --hard HEAD@{3}` ya da `git branch kurtarma <hash>` ile geri alırsınız. Commit edilmiş hiçbir şey hemen kaybolmaz; nesneler haftalarca çöp toplayıcı tarafından silinmez.

:::code{lang="bash" title="Geri alma ve kurtarma"}
```bash
git restore src/app.ts                    # çalışma dizinindeki değişikliği at
git restore --staged src/app.ts           # staging'den çıkar, değişikliği koru
git commit --amend                        # son commit'i düzelt (paylaşılmadıysa)
git revert a1b2c3d                        # commit'i tersine çeviren YENİ commit (paylaşılan dallarda güvenli)
git reset --soft HEAD~1                   # son commit'i geri al, değişiklikler staging'de kalsın

git stash && git switch main              # yarım işi sakla, dal değiştir
git stash pop                             # geri getir

git cherry-pick 9f8e7d6                   # tek commit'i bu dala uygula

git reflog                                # HEAD'in geçmişi
git reset --hard HEAD@{2}                 # iki hamle önceki duruma dön
```
:::

## .gitignore ve iyi commit mesajı

Derleme çıktıları, `node_modules`, `.env` dosyaları ve editör ayarları depoya girmemelidir. `.gitignore` dosyası desenlerle bunları dışarıda tutar: `*.log`, `dist/`, `.env*`, `!.env.example`. Yanlışlıkla izlenmeye başlanmış bir dosyayı `git rm --cached` ile depodan çıkarıp desen eklersiniz; bir gizli anahtar bir kez push edildiyse yalnızca silmek yetmez, anahtarı **iptal edip yenilemeniz** gerekir çünkü geçmişte yaşamaya devam eder.

İyi bir commit mesajı, altı ay sonra `git log` okuyan kişiye "neden" sorusunu cevaplar. Yaygın bir sözleşme (Conventional Commits) ilk satırı `tür(kapsam): kısa özet` biçiminde yazar: `fix(auth): süresi dolan token'da 401 yerine 500 dönmesini düzelt`. İlk satır 50–72 karakter, emir kipinde ve nokta olmadan; gerekirse boş bir satırdan sonra gövdede gerekçe ve ilgili iş numarası. Bu biçim, sürüm notlarının ve sürüm numarasının otomatik üretilmesini de mümkün kılar.

:::realworld{company="GitHub"}
GitHub'ın kendi web uygulaması, yüzlerce mühendisin aynı depoda çalıştığı ve günde onlarca kez dağıtım yapılan bir monolittir. Ekip yıllardır "GitHub Flow" dediği sade bir modeli anlatır: `main` her zaman dağıtılabilir; her iş kısa ömürlü bir dalda yapılır; dal açıldığı anda, iş bitmeden bile taslak PR açılır ki tartışma erken başlasın; otomatik testler ve en az bir inceleme olmadan birleştirme yapılmaz; birleştirmeden önce dal üretime dağıtılıp gözlenir, sorun yoksa `main`'e alınır. Uzun ömürlü `develop` ya da `release` dalları yoktur. Bu akışın işlemesini sağlayan şey Git'in dalı ucuz yapması ve PR'ın inceleme, CI ve tartışmayı tek bir yerde toplamasıdır.
:::

:::callout{tone="tip" title="Mülakat özeti"}
- Commit, projenin tam bir anlık görüntüsüdür; blob içerik, tree dizin, commit ebeveyn + tree + mesajdır. Dal yalnızca bir işaretçidir.
- `add` staging'e, `commit` yerel depoya, `push` uzak depoya; `fetch` indirir, `pull` indirip birleştirir.
- Merge geçmişi korur ve merge commit üretir; rebase geçmişi düzleştirir ama yeniden yazar — paylaşılan dalda yapılmaz.
- Kayıp commit için `reflog`; paylaşılan daldaki hatayı geri almak için `reset` değil `revert`.
- İyi commit mesajı "ne"yi değil "neden"i anlatır; gizli dosyalar `.gitignore` ile dışarıda kalır.
:::

:::quiz{src="quiz.json"}
:::

:::next{lesson="h-05-devops-ve-docker-kullanim-rehberi"}
Sırada: kodunuz artık sürüm kontrolünde; şimdi onu her ortamda aynı biçimde çalıştırmak için Docker ile paketlemeyi öğreniyoruz.
:::

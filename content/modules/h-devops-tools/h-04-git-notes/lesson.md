---
id: h-04-git-notes
slug: git-notes
module: h-devops-tools
order: 4
title:
  tr: "Git: Başlangıçtan İleri Seviyeye Tam Notlar"
  en: "Git Complete Notes (Beginner to Advanced)"
summary:
  tr: "Git'te commit, dal, merge/rebase ve uzak depo akışını öğren; hataları güvenle geri al ve kurtar."
  en: "Learn Git's commit, branch, merge/rebase and remote workflow, and safely undo and recover mistakes."
durationMinutes: 29
level: beginner
tags: [git, version-control, github, ci-cd, qa-automation]
prerequisites: []
concepts: [staging-area, commit, branching, merge, rebase, remote-repository, pull-request, git-stash, git-reflog, cherry-pick]
---

:::callout{tone="info" title="Kaynak"}
Bu ders, **@qa_insights** tarafından hazırlanan *Git Complete Notes (Beginner to Advanced)* not setinin 19 sayfasından oluşur. Sayfalar özgün hâliyle, değiştirilmeden yer alır; tüm hakları yazarına aittir. Kişisel çalışma notu olarak eklenmiştir.
:::

:::diagram{src="sayfa-01.png" alt="Kapak: @qa_insights tarafından Git tam notları, başlangıçtan ileri seviyeye. Ortada turuncu Git logosu."}
Sayfa 1 / 19 · GIT COMPLETE NOTES (Git)
:::

## Introduction to Git

:::diagram{src="sayfa-02.png" alt="Git'e giriş: Git dağıtık sürüm kontrol sistemidir. Sürüm kontrolü nedir, Git ile GitHub farkı, Git neden önemli ve iş birliği, güvenlik, hız, dallanma, yedekleme gibi temel faydaları."}
Sayfa 2 / 19 · Introduction to Git
:::

## Git Architecture

:::diagram{src="sayfa-03.png" alt="Git mimarisi 4 katman: çalışma dizini, staging alanı, yerel depo ve uzak depo. git add, git commit, git push geçişleri, Modified, Staged, Committed, Pushed yaşam döngüsü ve git status."}
Sayfa 3 / 19 · Git Architecture
:::

## Installation & Configuration

:::diagram{src="sayfa-04.png" alt="Kurulum ve yapılandırma: git-scm.com'dan kurulum, git --version ile kontrol, git config --global ile kullanıcı adı ve e-posta, git config --list ve varsayılan dalı main yapma."}
Sayfa 4 / 19 · Installation & Configuration
:::

## Essential Git Commands

:::diagram{src="sayfa-05.png" alt="Temel Git komutları örnek çıktılarla: git init, git clone, git status, git add, git commit -m, git log --oneline ve git diff ile çalışma dizini, staging ve commitler arası farklar."}
Sayfa 5 / 19 · Essential Git Commands
:::

## Complete Git Workflow

:::diagram{src="sayfa-06.png" alt="Uçtan uca Git iş akışı 9 adım: clone, dal oluşturma, kod yazma, add, commit, pull, push, pull request ve inceleme sonrası merge. Ayrı dalda çalış, main'e doğrudan push etme."}
Sayfa 6 / 19 · Complete Git Workflow
:::

## Branching

:::diagram{src="sayfa-07.png" alt="Dallanma: git branch ile dal oluşturma, git switch ve switch -c, branch -m ile yeniden adlandırma, -d ve -D ile silme. feature, bugfix, hotfix, release, chore adlandırma kuralları."}
Sayfa 7 / 19 · Branching
:::

## Merge vs Rebase

:::diagram{src="sayfa-08.png" alt="Merge ve rebase karşılaştırması: merge yeni bir merge commit ile geçmişi korur, rebase commitleri en son commit üstüne yeniden uygular ve doğrusal geçmiş verir. Paylaşılan dallarda rebase yapma."}
Sayfa 8 / 19 · Merge vs Rebase
:::

## Remote Repository

:::diagram{src="sayfa-09.png" alt="Uzak depo: push, pull, fetch, origin ve upstream dallar. git remote -v ile kontrol, remote add, remove, rename komutları. Fetch birleştirmeden indirir, pull indirip birleştirir."}
Sayfa 9 / 19 · Remote Repository
:::

## Undo & Recovery

:::diagram{src="sayfa-10.png" alt="Geri alma ve kurtarma: git restore, git reset --soft, --mixed, --hard, git revert, git checkout ve git reflog. Paylaşılan dallarda reset --hard yerine revert kullanma önerisi."}
Sayfa 10 / 19 · Undo & Recovery
:::

## Stash, Tags & .gitignore

:::diagram{src="sayfa-11.png" alt="Stash, etiket ve .gitignore: git stash, stash pop, apply, drop ile işi geçici saklama. git tag ve -a ile annotated sürüm etiketleri. .gitignore ile log, node_modules, .env gibi dosyaları dışlama."}
Sayfa 11 / 19 · Stash, Tags & .gitignore
:::

## GitHub Collaboration

:::diagram{src="sayfa-12.png" alt="GitHub iş birliği 5 adım: fork, clone, pull request, kod incelemesi ve merge. Fork'u güncel tutma, küçük ve odaklı PR, net PR açıklamaları, git fetch upstream ile senkronizasyon."}
Sayfa 12 / 19 · GitHub Collaboration
:::

## Git for QA Engineers

:::diagram{src="sayfa-13.png" alt="QA mühendisleri için Git: Selenium, Playwright ve API otomasyon iş akışları, feature dalları ve commit örnekleri, release dalı ve etiketlerle framework sürümleme, tipik QA proje klasör yapısı."}
Sayfa 13 / 19 · Git for QA Engineers
:::

## Git with CI/CD

:::diagram{src="sayfa-14.png" alt="Git ile CI/CD: Git, GitHub, Jenkins, build, test ve deploy akışı. Jenkins webhook ile tetiklenir, testleri çalıştırır. Checkout, Build, Test, Deploy aşamalı örnek Jenkins declarative pipeline."}
Sayfa 14 / 19 · Git with CI/CD
:::

## Common Git Errors

:::diagram{src="sayfa-15.png" alt="Sık Git hataları ve çözümleri: yerel değişikliklerin üzerine yazılması, failed to push some refs, unrelated histories, merge öncesi commit veya stash gerekmesi, not a git repository ve merge conflict."}
Sayfa 15 / 19 · Common Git Errors
:::

## Advanced Git

:::diagram{src="sayfa-16.png" alt="İleri Git: cherry-pick ile tek commit taşıma, rebase -i ile düzenleme, squash ile commitleri birleştirme, commit --amend ve reflog ile kayıp commit kurtarma. Paylaşılan dalda push --force yapma."}
Sayfa 16 / 19 · Advanced Git
:::

## Git Interview Questions

:::diagram{src="sayfa-17.png" alt="Git mülakat soruları: başlangıç seviyesinde Git, depo, dal, git add ve commit farkı. İleri seviyede fetch ve pull farkı, rebase, cherry-pick, stash, son commit'i geri alma ve reflog."}
Sayfa 17 / 19 · Git Interview Questions
:::

## Git Best Practices

:::diagram{src="sayfa-18.png" alt="Git en iyi uygulamaları: anlamlı commit mesajları ve conventional commit örnekleri, kısa ömürlü feature dalları, hassas veriyi commit etmeme ve 2FA, ekip iş birliği, yapılması ve yapılmaması gerekenler."}
Sayfa 18 / 19 · Git Best Practices
:::

## Ultimate Git Cheat Sheet

:::diagram{src="sayfa-19.png" alt="Kapsamlı Git kopya kağıdı: temel komut tablosu, iş akışı, yaşam döngüsü, main, develop, feature, hotfix dal stratejisi, ileri komutlar, geri alma, alias örnekleri ve commit mesaj rehberi."}
Sayfa 19 / 19 · Ultimate Git Cheat Sheet
:::

:::quiz{src="quiz.json"}
:::

:::next{lesson="h-05-devops-ve-docker-kullanim-rehberi"}
:::

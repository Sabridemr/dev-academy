---
id: h-01-linux-notes
slug: linux-notes
module: h-devops-tools
order: 1
title:
  tr: "Linux: Başlangıçtan İleri Seviyeye Tam Notlar"
  en: "Linux Complete Notes (Beginner to Advanced)"
summary:
  tr: "Linux mimarisi, dosya sistemi, izinler ve temel komutlarla terminalde rahatça çalışmayı öğren."
  en: "Work confidently in the Linux terminal with its architecture, file system, permissions and core commands."
durationMinutes: 24
level: beginner
tags: [linux, command-line, shell, devops, system-administration]
prerequisites: []
concepts: [kernel, file-system-hierarchy, file-permissions, chmod, grep, process-management, package-manager, shell-scripting, ssh, cron]
---

:::callout{tone="info" title="Kaynak"}
Bu ders, **@qa_insights** tarafından hazırlanan *Linux Complete Notes (Beginner to Advanced)* not setinin 16 sayfasından oluşur. Sayfalar özgün hâliyle, değiştirilmeden yer alır; tüm hakları yazarına aittir. Kişisel çalışma notu olarak eklenmiştir.
:::

:::diagram{src="sayfa-01.png" alt="Kapak: @qa_insights tarafından Linux tam notları, başlangıçtan ileri seviyeye. Ortada Linux penguen maskotu Tux."}
Sayfa 1 / 16 · LINUX COMPLETE NOTES (Linux)
:::

## 1. INTRODUCTION TO LINUX

:::diagram{src="sayfa-02.png" alt="Linux'a giriş: Unix tabanlı ücretsiz, açık kaynak işletim sistemi. 1991'de Linus Torvalds, GPL lisansı, çok kullanıcılı ve güvenli olması, kullanım alanları ve Linux ile Windows karşılaştırma tablosu."}
Sayfa 2 / 16 · 1. INTRODUCTION TO LINUX
:::

## 2. LINUX ARCHITECTURE

:::diagram{src="sayfa-03.png" alt="Linux mimarisi katmanları: kullanıcı alanı, bash ve zsh gibi shell, kernel, dosya sistemi ve donanım. Komutun katmanlardan geçişi ve uname -r, ps aux, df -h, free -m gibi hızlı komutlar."}
Sayfa 3 / 16 · 2. LINUX ARCHITECTURE
:::

## 3. LINUX FILE SYSTEM

:::diagram{src="sayfa-04.png" alt="Linux dosya sistemi: her şey bir dosyadır, kök dizinden başlayan ağaç yapısı. home, etc, var, usr, opt, tmp ve bin dizinlerinin görevleri, örnek yapı ve ls, cd, tree komutları."}
Sayfa 4 / 16 · 3. LINUX FILE SYSTEM
:::

## 4. NAVIGATION COMMANDS

:::diagram{src="sayfa-05.png" alt="Gezinme komutları: pwd ile bulunulan dizin, ls ile listeleme, cd ile dizin değiştirme, tree, clear ve history. Uygulamalı örnek akış, cd .. ile üst dizine çıkma ve Tab ile otomatik tamamlama."}
Sayfa 5 / 16 · 4. NAVIGATION COMMANDS
:::

## 5. FILE & DIRECTORY COMMANDS

:::diagram{src="sayfa-06.png" alt="Dosya ve dizin komutları: mkdir, touch, cp, mv, rm, rmdir, cat, nano ve vi örnekleriyle. -r, -p, -f, -i, -v seçenekleri ve rm -r ile veri kaybına karşı uyarı."}
Sayfa 6 / 16 · 5. FILE & DIRECTORY COMMANDS
:::

## 6. FILE PERMISSIONS

:::diagram{src="sayfa-07.png" alt="Dosya izinleri: kullanıcı, grup ve diğerleri. Okuma 4, yazma 2, çalıştırma 1 değerleri ve rwx tablosu, chmod ve chown kullanımı, ls -l ile izinleri görme, en az yetki ilkesi."}
Sayfa 7 / 16 · 6. FILE PERMISSIONS
:::

## 7. SEARCHING & TEXT PROCESSING

:::diagram{src="sayfa-08.png" alt="Arama ve metin işleme komutları tablosu: find, locate, grep, awk, sed, sort, uniq, wc, head ve tail örnekleri. Log dosyasında hata arama iş akışı ve komutları pipe ile birleştirme."}
Sayfa 8 / 16 · 7. SEARCHING & TEXT PROCESSING
:::

## 8. PROCESS MANAGEMENT

:::diagram{src="sayfa-09.png" alt="Süreç yönetimi komutları: ps aux, top, htop, jobs, bg, fg, kill, kill -9 ve nice. İş durumları, Ctrl+Z ile durdurma, kill komutunun varsayılan TERM sinyali."}
Sayfa 9 / 16 · 8. PROCESS MANAGEMENT
:::

## 9. DISK & MEMORY COMMANDS

:::diagram{src="sayfa-10.png" alt="Disk ve bellek komutları: df -h, du -sh, free -h, uptime, vmstat, iostat, mount, umount, lsblk ve df -i. Örnek çıktılar ve yüksek load average'ın sistemin meşgul olduğunu göstermesi."}
Sayfa 10 / 16 · 9. DISK & MEMORY COMMANDS
:::

## 10. NETWORKING COMMANDS

:::diagram{src="sayfa-11.png" alt="Ağ komutları: ping, curl, wget, ssh, scp, netstat, ss, nslookup, dig ve traceroute örnekleri. Yaygın portlar tablosu: 22 SSH, 53 DNS, 80 HTTP, 443 HTTPS, 3306 MySQL."}
Sayfa 11 / 16 · 10. NETWORKING COMMANDS
:::

## 11. PACKAGE MANAGEMENT

:::diagram{src="sayfa-12.png" alt="Paket yönetimi: apt, yum, dnf, rpm ve dpkg komutları. Debian ve Ubuntu için apt, RHEL ve CentOS için yum, Fedora için dnf. Install, update, remove örnekleri ve RPM ile DEB farkı."}
Sayfa 12 / 16 · 11. PACKAGE MANAGEMENT
:::

## 12. SHELL SCRIPTING BASICS

:::diagram{src="sayfa-13.png" alt="Shell betiği temelleri: değişkenler, if koşulu ve -eq, -gt gibi operatörler, for ve while döngüleri, fonksiyonlar, $0 ve $1 argümanları, örnek betik ve chmod +x ile çalıştırma izni."}
Sayfa 13 / 16 · 12. SHELL SCRIPTING BASICS
:::

## 13. LINUX IN REAL PROJECTS

:::diagram{src="sayfa-14.png" alt="Gerçek projelerde Linux: yazılım geliştirme, bulut DevOps, siber güvenlik, veri mühendisliği, yapay zeka ve web barındırma. Geliştiriciden Git, Linux sunucu, Docker, Jenkins, Kubernetes ve buluta akış."}
Sayfa 14 / 16 · 13. LINUX IN REAL PROJECTS
:::

## 14. MOST ASKED LINUX INTERVIEW QUESTIONS

:::diagram{src="sayfa-15.png" alt="En sık Linux mülakat soruları: Linux nedir, kernel ile shell farkı, soft link ve hard link, chmod ile chown, grep ile find, süreç ve thread, zombie süreç, cron, ortam değişkenleri, pipe ve yönlendirme."}
Sayfa 15 / 16 · 14. MOST ASKED LINUX INTERVIEW QUESTIONS
:::

## 15. CHEAT SHEET & ROADMAP

:::diagram{src="sayfa-16.png" alt="Kopya kağıdı: en önemli 50 Linux komutu ve amaçları, pwd'den clear'a. 7 adımlı öğrenme yol haritası: temeller, komutlar, sistem yönetimi, ağ, DevOps araçları, orkestrasyon ve bulut."}
Sayfa 16 / 16 · 15. CHEAT SHEET & ROADMAP
:::

:::quiz{src="quiz.json"}
:::

:::next{lesson="h-02-linux-temelleri-vps-kurulumu-ve-guvenlik"}
:::

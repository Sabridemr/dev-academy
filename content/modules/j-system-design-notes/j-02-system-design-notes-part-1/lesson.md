---
id: j-02-system-design-notes-part-1
slug: system-design-notes-part-1
module: j-system-design-notes
order: 2
title:
  tr: "Sistem Tasarımı: Kapsamlı Notlar (Bölüm 1)"
  en: "System Design Complete Notes Part 1"
summary:
  tr: "Temel bileşenler, önbellek, yük dengeleme ve ölçeklemeyle ölçeklenebilir sistem tasarlamayı öğren."
  en: "Learn to design scalable systems from the request path to databases, caching, load balancing and scaling."
durationMinutes: 29
level: beginner
tags: [system-design, architecture, scalability, interview-prep, backend]
prerequisites: []
concepts: [functional-requirements, non-functional-requirements, load-balancing, caching, cdn, database-indexing, acid-vs-base, horizontal-scaling, microservices, cap-theorem]
---

:::callout{tone="info" title="Kaynak"}
Bu ders, **@qa_insights** tarafından hazırlanan *System Design Complete Notes Part 1* not setinin 19 sayfasından oluşur. Sayfalar özgün hâliyle, değiştirilmeden yer alır; tüm hakları yazarına aittir. Kişisel çalışma notu olarak eklenmiştir.
:::

:::diagram{src="sayfa-01.png" alt="Kapak: System Design Complete Notes Part 1, Beginner to Advanced. Kullanıcı, DNS, CDN, yük dengeleyici, uygulama sunucusu, Redis, veritabanı ve nesne depolama şeması; öğrenilecek konular listesi."}
Sayfa 1 / 19 · SYSTEM DESIGN COMPLETE NOTES PART 1
:::

## What is System Design?

:::diagram{src="sayfa-02.png" alt="Sistem tasarımı nedir: ölçeklenebilir, güvenilir, verimli sistemler tasarlama süreci. Neden önemli, Instagram, WhatsApp, Amazon örnekleri, iyi bir sistemin hedefleri ve mini mimari çizimi."}
Sayfa 2 / 19 · What is System Design?
:::

## System Design Terminology

:::diagram{src="sayfa-03.png" alt="Sistem tasarımı terimleri: HLD, LLD, ölçeklenebilirlik, erişilebilirlik, güvenilirlik, gecikme, throughput ve hata toleransı tanımları; istemciden veritabanına genel mimari görünümü."}
Sayfa 3 / 19 · System Design Terminology
:::

## Functional vs Non-Functional Requirements

:::diagram{src="sayfa-04.png" alt="Fonksiyonel gereksinimler sistemin ne yaptığını, fonksiyonel olmayanlar ne kadar iyi çalıştığını tanımlar. Karşılaştırma tablosu, e-ticaret örnekleri ve mülakat soruları."}
Sayfa 4 / 19 · Functional vs Non-Functional Requirements
:::

## How the Internet Works

:::diagram{src="sayfa-05.png" alt="Bir isteğin yolculuğu altı adımda: kullanıcı URL yazar, tarayıcı HTTP isteği gönderir, DNS alan adını IP'ye çevirir, istek internetten sunucuya gider, sunucu veritabanını kullanır, yanıt geri döner."}
Sayfa 5 / 19 · How the Internet Works
:::

## Complete Request Lifecycle

:::diagram{src="sayfa-06.png" alt="Uçtan uca istek yaşam döngüsü yedi adımda: tarayıcı, DNS, CDN, yük dengeleyici, uygulama sunucusu, veritabanı ve JSON yanıtın aynı yoldan tarayıcıya dönmesi."}
Sayfa 6 / 19 · Complete Request Lifecycle
:::

## System Design Interview Workflow

:::diagram{src="sayfa-07.png" alt="Mülakat akışı yedi adım: gereksinimler, ölçek tahmini, API tasarımı, veritabanı tasarımı, üst düzey tasarım, darboğazları bulma ve optimizasyon. Örnek varsayımlar ve ipuçları."}
Sayfa 7 / 19 · System Design Interview Workflow
:::

## Core Components of a System

:::diagram{src="sayfa-08.png" alt="Sistemin temel bileşenleri sekiz numarayla: istemci, CDN, yük dengeleyici, web sunucusu, uygulama sunucusu, önbellek, veritabanı ve dosyalar için depolama; akış şeması ve görevleri."}
Sayfa 8 / 19 · Core Components of a System
:::

## API Design Fundamentals

:::diagram{src="sayfa-09.png" alt="API tasarım temelleri: REST, HTTP metotları tablosu, JSON, durum kodu sınıfları, kimlik doğrulama ve JWT, sayfalama parametreleri, versiyonlama ve en iyi uygulamalar."}
Sayfa 9 / 19 · API Design Fundamentals
:::

## Database Fundamentals

:::diagram{src="sayfa-10.png" alt="Veritabanı temelleri: SQL ilişkisel ve NoSQL ilişkisel olmayan veritabanları, tablo ile koleksiyon karşılaştırması, birincil ve yabancı anahtar, ACID ve BASE özellikleri."}
Sayfa 10 / 19 · Database Fundamentals
:::

## Database Indexing

:::diagram{src="sayfa-11.png" alt="Veritabanı indeksleme: indeks nedir, neden kullanılır, avantajları ve ek depolama, yavaş yazma gibi dezavantajları. B-Tree örneği, kitap dizini benzetmesi ve tam tablo taraması karşılaştırması."}
Sayfa 11 / 19 · Database Indexing
:::

## Caching in System Design

:::diagram{src="sayfa-12.png" alt="Önbellekleme: cache hit ve miss, Redis bellek içi önbellek, TTL, en yaygın Cache-Aside kalıbı ve adımları, ne zaman kullanılacağı, artılar ve eksiler."}
Sayfa 12 / 19 · Caching in System Design
:::

## Content Delivery Network (CDN)

:::diagram{src="sayfa-13.png" alt="CDN statik içeriği en yakın konumdan sunan dağıtık sunucu ağıdır. Statik ve dinamik içerik, CDN istek akışı, küresel uç sunucular, faydalar ve Cloudflare, CloudFront, Akamai, Azure."}
Sayfa 13 / 19 · Content Delivery Network (CDN)
:::

## Load Balancer

:::diagram{src="sayfa-14.png" alt="Yük dengeleyici trafiği sunucular arasında dağıtır. Çalışma adımları, sağlıksız sunucuyu çıkaran mimari, Round Robin ve Least Connections gibi algoritmalar, sağlık kontrolleri, reverse proxy."}
Sayfa 14 / 19 · Load Balancer
:::

## Scaling Applications

:::diagram{src="sayfa-15.png" alt="Uygulama ölçekleme: dikey ölçekleme tek sunucuyu güçlendirir, yatay ölçekleme sunucu ekler. Durumsuz ve durumlu sunucular, otomatik ölçekleme ve karşılaştırma tablosu."}
Sayfa 15 / 19 · Scaling Applications
:::

## Monolithic vs Microservices Architecture

:::diagram{src="sayfa-16.png" alt="Monolit tek parça olarak dağıtılır, mikroservisler kendi veritabanı olan bağımsız servislerdir. Karşılaştırma tablosu, avantaj ve dezavantajlar, ne zaman hangisi ve gerçek örnekler."}
Sayfa 16 / 19 · Monolithic vs Microservices Architecture
:::

## Putting Everything Together

:::diagram{src="sayfa-17.png" alt="Modern ölçeklenebilir web uygulamasının tam mimarisi dokuz katmanla: kullanıcı, DNS, CDN, yük dengeleyici, durumsuz uygulama sunucuları, Redis, veritabanı, nesne depolama, izleme."}
Sayfa 17 / 19 · Putting Everything Together
:::

## Design a Simple E-Commerce System

:::diagram{src="sayfa-18.png" alt="Basit e-ticaret sistemi tasarımı: göz atma, arama, sepet, ödeme, sipariş onayı akışı; ürün, sipariş, ödeme gibi modüller, mesaj kuyruklu mimari, örnek teknoloji yığını."}
Sayfa 18 / 19 · Design a Simple E-Commerce System
:::

## Quick Revision Cheat Sheet

:::diagram{src="sayfa-19.png" alt="Tek sayfalık tekrar özeti: temel terimler, mülakat akışı, bileşenler, SQL ve NoSQL, API, Redis, CDN, yük dengeleyici, ölçekleme, monolit ve mikroservis. Bölüm 2'nin 18 konusu listelenir."}
Sayfa 19 / 19 · Quick Revision Cheat Sheet
:::

:::quiz{src="quiz.json"}
:::

:::next{lesson="j-03-system-design-with-redis-and-kafka"}
:::

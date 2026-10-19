---
id: i-05-api-testing-notes
slug: api-testing-notes
module: i-api-sql-testing
order: 5
title:
  tr: "API Testi: Kapsamlı Notlar"
  en: "API Testing Complete Notes"
summary:
  tr: "HTTP, durum kodları, kimlik doğrulama ve JSONPath ile API yanıtlarını eksiksiz doğrulamayı öğren."
  en: "Learn to fully validate API responses using HTTP, status codes, authentication and JSONPath."
durationMinutes: 24
level: beginner
tags: [api-testing, http, rest-api, postman, rest-assured, qa]
prerequisites: []
concepts: [http-methods, http-status-codes, request-response-cycle, authentication-authorization, jwt, oauth-2, jsonpath, schema-validation, idempotency, newman]
---

:::callout{tone="info" title="Kaynak"}
Bu ders, **@qa_insights** tarafından hazırlanan *API Testing Complete Notes* not setinin 16 sayfasından oluşur. Sayfalar özgün hâliyle, değiştirilmeden yer alır; tüm hakları yazarına aittir. Kişisel çalışma notu olarak eklenmiştir.
:::

:::diagram{src="sayfa-01.png" alt="Kapak: API Testing Complete Notes. Başlangıçtan ileri seviyeye API testi notları, @qa_insights imzalı."}
Sayfa 1 / 16 · API TESTING COMPLETE NOTES
:::

## API TESTING INTRODUCTION

:::diagram{src="sayfa-02.png" alt="API testine giriş: API nedir, API ile web servis farkı, REST ile SOAP karşılaştırması, API testinin neden yapıldığı ve ödeme, hava durumu, harita gibi gerçek dünya örnekleri."}
Sayfa 2 / 16 · API TESTING INTRODUCTION
:::

## HTTP FUNDAMENTALS

:::diagram{src="sayfa-03.png" alt="HTTP temelleri: istemci-sunucu mimarisi, istek-yanıt döngüsü, URL yapısı (protokol, alan adı, port, yol, sorgu) ve durumsuz iletişim. İpucu: her zaman HTTPS kullan."}
Sayfa 3 / 16 · HTTP FUNDAMENTALS
:::

## HTTP METHODS

:::diagram{src="sayfa-04.png" alt="HTTP metotları ve örnek istekleri: GET, POST, PUT, PATCH, DELETE, HEAD, OPTIONS. Güvenli metotlar GET, HEAD, OPTIONS; PUT ve DELETE idempotent, POST idempotent değil."}
Sayfa 4 / 16 · HTTP METHODS
:::

## API REQUEST STRUCTURE

:::diagram{src="sayfa-05.png" alt="API isteğinin parçaları: endpoint (URL), header'lar, path parametreleri, query parametreleri, istek gövdesi (JSON) ve Content-Type, her biri örnekle."}
Sayfa 5 / 16 · API REQUEST STRUCTURE
:::

## API RESPONSE STRUCTURE

:::diagram{src="sayfa-06.png" alt="API yanıtının yapısı: durum kodu, yanıt gövdesi, header'lar, çerezler, yanıt süresi (ms) ve JSON yanıt örneği. Önce durum kodunu doğrula."}
Sayfa 6 / 16 · API RESPONSE STRUCTURE
:::

## HTTP STATUS CODES

:::diagram{src="sayfa-07.png" alt="HTTP durum kodları: 1xx bilgi, 2xx başarı, 3xx yönlendirme, 4xx istemci hatası, 5xx sunucu hatası. Mülakat tablosu: 200, 201, 204, 400, 401, 403, 404, 409, 500, 503."}
Sayfa 7 / 16 · HTTP STATUS CODES
:::

## AUTHENTICATION & AUTHORIZATION

:::diagram{src="sayfa-08.png" alt="Kimlik doğrulama ve yetkilendirme: Basic Auth, Bearer token, API key, OAuth 2.0, JWT (header, payload, signature) ve iki kavramın farkı; tipik token akışı."}
Sayfa 8 / 16 · AUTHENTICATION & AUTHORIZATION
:::

## JSON & JSONPath

:::diagram{src="sayfa-09.png" alt="JSON ve JSONPath: nesneler, diziler, veri tipleri, iç içe JSON, $ ile başlayan JSONPath ifadeleri ve durum kodu, header, gövde doğrulama örnekleri."}
Sayfa 9 / 16 · JSON & JSONPath
:::

## API TESTING WORKFLOW

:::diagram{src="sayfa-10.png" alt="API test iş akışı: tasarla, isteği hazırla, çalıştır, doğrula, raporla ve otomatikleştir (CI/CD). Pozitif ve negatif senaryoları birlikte doğrula."}
Sayfa 10 / 16 · API TESTING WORKFLOW
:::

## API VALIDATION CHECKLIST

:::diagram{src="sayfa-11.png" alt="API doğrulama kontrol listesi: durum kodu, header'lar, gövde, şema, yanıt süresi, veritabanı ve iş kuralları doğrulaması. Yalnızca 200 OK'e bakma."}
Sayfa 11 / 16 · API VALIDATION CHECKLIST
:::

## POSTMAN COMPLETE GUIDE

:::diagram{src="sayfa-12.png" alt="Postman rehberi: koleksiyonlar, ortam değişkenleri, pre-request script'ler, pm.test ile testler, Collection Runner ve CI/CD için Newman (CLI) komutu."}
Sayfa 12 / 16 · POSTMAN COMPLETE GUIDE
:::

## REST ASSURED AUTOMATION

:::diagram{src="sayfa-13.png" alt="REST Assured ile Java otomasyonu: proje yapısı, given-when-then istek tanımı, assertion'lar, serialization ve deserialization (POJO, Jackson) ve loglama."}
Sayfa 13 / 16 · REST ASSURED AUTOMATION
:::

## API INTERVIEW QUESTIONS

:::diagram{src="sayfa-14.png" alt="API mülakat soruları ve tek satırlık cevaplar: API, GET ile POST farkı, durum kodları, REST, kimlik doğrulama ile yetkilendirme, JSON, JSONPath, idempotency, Newman."}
Sayfa 14 / 16 · API INTERVIEW QUESTIONS
:::

## COMMON API ERRORS & DEBUGGING

:::diagram{src="sayfa-15.png" alt="Yaygın API hataları ve hata ayıklama: 400, 401, 403, 404, 405, 409, 415, 429, 500, 503 için anlam ve hızlı çözüm ipuçları, genel hata ayıklama kontrol listesi."}
Sayfa 15 / 16 · COMMON API ERRORS & DEBUGGING
:::

## ULTIMATE API TESTING CHEAT SHEET

:::diagram{src="sayfa-16.png" alt="API testi kopya kağıdı: HTTP metotları, durum kodu aralıkları, kimlik doğrulama türleri, istek ve yanıt örneği, JSONPath, Postman, REST Assured ve doğrulama listesi."}
Sayfa 16 / 16 · ULTIMATE API TESTING CHEAT SHEET
:::

:::quiz{src="quiz.json"}
:::

:::next{lesson="i-06-sql-notes"}
:::

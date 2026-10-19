---
id: i-01-how-apis-are-created-and-called
slug: how-apis-are-created-and-called
module: i-api-sql-testing
order: 1
title:
  tr: "API Nasıl Oluşturulur? / API Çağrıldığında Ne Olur?"
  en: "How to Create an API? / What Happens When an API is Called?"
summary:
  tr: "Node.js, Express ve MongoDB ile adım adım API kurmayı ve bir API çağrısının uçtan uca akışını öğren."
  en: "Learn to build an API step by step with Node.js, Express and MongoDB and trace an API call end to end."
durationMinutes: 5
level: beginner
tags: [api, nodejs, express, mongodb, backend]
prerequisites: []
concepts: [http-methods, endpoint, mongoose-schema, express-router, controller, middleware, request-validation, status-codes, json-response, deployment]
---

:::callout{tone="info" title="Kaynak"}
Bu ders, **@qa_insights** tarafından hazırlanan *How to Create an API? / What Happens When an API is Called?* not setinin 3 sayfasından oluşur. Sayfalar özgün hâliyle, değiştirilmeden yer alır; tüm hakları yazarına aittir. Kişisel çalışma notu olarak eklenmiştir.
:::

:::diagram{src="sayfa-01.png" alt="Kapak: @qa_insights notları. İki konu: 01 API nasıl oluşturulur, 02 bir API çağrıldığında ne olur. Bilgisayar, API, veritabanı ve telefon akış çizimi."}
Sayfa 1 / 3 · How to Create an API? / What Happens When an API is Called?
:::

## How to Create an API? End to End Flow

:::diagram{src="sayfa-02.png" alt="API oluşturmanın 9 adımı: API planlama ve uç noktalar, Node.js ve Express kurulumu, MongoDB bağlantısı, Mongoose şeması, rotalar, controller, sunucu, Postman veya Thunder Client ile test, bulutta yayın."}
Sayfa 2 / 3 · How to Create an API? End to End Flow
:::

## What Happens When an API is Called?

:::diagram{src="sayfa-03.png" alt="API çağrısının 10 adımı: istemci, HTTP isteği, uç nokta, istek doğrulama, iş mantığı, veritabanı veya harici servis, JSON yanıt üretimi, HTTP yanıtı, istemcinin işlemesi, arayüz güncellemesi."}
Sayfa 3 / 3 · What Happens When an API is Called?
:::

:::quiz{src="quiz.json"}
:::

:::next{lesson="i-02-api-ve-rest-api-temeller-ve-guvenlik"}
:::

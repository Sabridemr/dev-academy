---
id: i-06-sql-notes
slug: sql-notes
module: i-api-sql-testing
order: 6
title:
  tr: "SQL Kapsamlı Notlar"
  en: "SQL Complete Notes"
summary:
  tr: "SQL temellerinden SELECT, filtreleme, sıralama, aggregate fonksiyonlar, GROUP BY, JOIN, alt sorgular, CASE, DDL, DML, TCL, kısıtlar, indeksler, view ve window fonksiyonlarına, mülakat özetiyle birlikte."
  en: "From SQL basics through SELECT, filtering, sorting, aggregate functions, GROUP BY, joins, subqueries, CASE, DDL, DML, TCL, constraints, indexes, views and window functions, with an interview cheat sheet."
durationMinutes: 29
level: intermediate
tags: [sql, databases, relational-databases, interview-prep, cheat-sheet]
prerequisites: []
concepts: [select-statement, where-clause, aggregate-functions, group-by-having, sql-joins, subqueries, set-operators, ddl-dml-tcl, constraints-indexes, window-functions]
---

:::callout{tone="info" title="Kaynak"}
Bu ders, **@qa_insights** tarafından hazırlanan *SQL Complete Notes* not setinin 19 sayfasından oluşur. Sayfalar özgün hâliyle, değiştirilmeden yer alır; tüm hakları yazarına aittir. Kişisel çalışma notu olarak eklenmiştir.
:::

:::diagram{src="sayfa-01.png" alt="Kapak: SQL Complete Notes (Structured Query Language), Beginner to Advanced. Örnek SELECT, FROM, WHERE, ORDER BY sorgusu ve ID, Name, Age tablosu çizimi."}
Sayfa 1 / 19 · SQL Complete Notes
:::

:::diagram{src="sayfa-02.png" alt="What is SQL?: ilişkisel veritabanlarıyla iletişim dili. Veritabanı neden gerekir, DBMS ile RDBMS farkı, SQL kullanım alanları, MySQL, PostgreSQL, SQL Server ve Oracle."}
Sayfa 2 / 19 · What is SQL?
:::

:::diagram{src="sayfa-03.png" alt="Database Basics: veritabanı, tablo, satır ve sütun terimleri; Employees tablo örneği; Primary Key ve Foreign Key; şema hiyerarşisi; INT, VARCHAR, DATE, BOOLEAN, DECIMAL veri tipleri."}
Sayfa 3 / 19 · Database Basics
:::

:::diagram{src="sayfa-04.png" alt="SELECT Statement: temel SELECT, belirli sütunları seçme, DISTINCT, LIMIT ve TOP, AS ile takma ad; üretimde SELECT * yerine yalnızca gereken sütunları seçme önerisi."}
Sayfa 4 / 19 · SELECT Statement
:::

:::diagram{src="sayfa-05.png" alt="Filtering Data (WHERE Clause): AND, OR, NOT operatörleri; BETWEEN, IN, LIKE ve % ile _ jokerleri; IS NULL ve IS NOT NULL; NULL ile = veya <> karşılaştırmasının çalışmaması."}
Sayfa 5 / 19 · Filtering Data (WHERE Clause)
:::

:::diagram{src="sayfa-06.png" alt="Sorting & Limiting: ORDER BY, ASC ve DESC sıralama, LIMIT, OFFSET ile satır atlama, SQL Server için TOP, ANSI standardı FETCH FIRST; ORDER BY olmadan satır sırası garanti değil."}
Sayfa 6 / 19 · Sorting & Limiting
:::

:::diagram{src="sayfa-07.png" alt="Aggregate Functions: COUNT, SUM, AVG, MIN, MAX ve Employees tablosunda sonuç örnekleri; COUNT(*) ile COUNT(column) farkı, NULL değerlerin yok sayılması, GROUP BY ile kullanım."}
Sayfa 7 / 19 · Aggregate Functions
:::

:::diagram{src="sayfa-08.png" alt="GROUP BY & HAVING: söz dizimi, WHERE satırları gruplamadan önce, HAVING grupları sonra filtreler; gruplama kuralları, geçerli ve geçersiz örnekler, departman bazlı mülakat örnekleri."}
Sayfa 8 / 19 · GROUP BY & HAVING
:::

:::diagram{src="sayfa-09.png" alt="SQL Joins: Employees ve Departments örnek tabloları; INNER, LEFT, RIGHT, FULL OUTER ve CROSS JOIN, Venn şemaları ve sorgu örnekleri; ON ile birleştirme koşulu belirtme ipucu."}
Sayfa 9 / 19 · SQL Joins
:::

:::diagram{src="sayfa-10.png" alt="Self Join & UNION: tabloyu kendisiyle birleştirme ve yönetici-çalışan örneği; UNION, UNION ALL, INTERSECT, EXCEPT ve MINUS küme operatörleri; tekrar eden satırlar karşılaştırma tablosu."}
Sayfa 10 / 19 · Self Join & UNION
:::

:::diagram{src="sayfa-11.png" alt="Subqueries: tek satırlı ve çok satırlı alt sorgular, ilişkili (correlated) alt sorgu, EXISTS ve NOT EXISTS, IN ile EXISTS karşılaştırması; NULL durumunda EXISTS tercih etme önerisi."}
Sayfa 11 / 19 · Subqueries
:::

:::diagram{src="sayfa-12.png" alt="SQL Functions: UPPER, LOWER, LENGTH, SUBSTRING metin fonksiyonları; ROUND ve CEIL sayısal fonksiyonlar; NOW, CURRENT_DATE, DATE_ADD tarih fonksiyonları ve örnek çıktıları."}
Sayfa 12 / 19 · SQL Functions
:::

:::diagram{src="sayfa-13.png" alt="CASE Statement: simple CASE ve searched CASE örnekleri, IFNULL ve COALESCE ile NULL yerine varsayılan değer, NULL karşılaştırmasında IS NULL kullanımı, sorgularda koşullu mantık."}
Sayfa 13 / 19 · CASE Statement
:::

:::diagram{src="sayfa-14.png" alt="DDL Commands: CREATE ile tablo oluşturma, ALTER ile sütun ekleme, değiştirme, silme ve yeniden adlandırma; DROP, TRUNCATE ve RENAME; DDL komutlarının çoğu sistemde örtük COMMIT yapması."}
Sayfa 14 / 19 · DDL Commands
:::

:::diagram{src="sayfa-15.png" alt="DML & TCL Commands: INSERT, UPDATE, DELETE için amaç, söz dizimi ve örnekler; WHERE kullanma uyarısı; işlem kontrolü için COMMIT, ROLLBACK ve SAVEPOINT."}
Sayfa 15 / 19 · DML & TCL Commands
:::

:::diagram{src="sayfa-16.png" alt="Constraints & Indexes: PRIMARY KEY, FOREIGN KEY, UNIQUE, CHECK, DEFAULT, NOT NULL, INDEX ve AUTO_INCREMENT veya IDENTITY; fazla indeksin INSERT, UPDATE, DELETE işlemlerini yavaşlatması."}
Sayfa 16 / 19 · Constraints & Indexes
:::

:::diagram{src="sayfa-17.png" alt="Views & Stored Objects: VIEW sanal tablosu, stored procedure, kullanıcı tanımlı fonksiyon, trigger ve sequence; her biri için söz dizimi, örnek ve temel noktalar."}
Sayfa 17 / 19 · Views & Stored Objects
:::

:::diagram{src="sayfa-18.png" alt="Window Functions: OVER, PARTITION BY ve ORDER BY bileşenleri; ROW_NUMBER, RANK, DENSE_RANK, LEAD, LAG; satırları GROUP BY gibi tek satıra indirmeden hesaplama, PARTITION BY örneği."}
Sayfa 18 / 19 · Window Functions
:::

:::diagram{src="sayfa-19.png" alt="SQL Interview Cheat Sheet: SQL çalışma sırası, JOIN karşılaştırması, sık mülakat soruları, performans ipuçları, DDL, DML, DCL ve TCL sınıflandırması, önemli farklar ve söz dizimi hatırlatmaları."}
Sayfa 19 / 19 · SQL Interview Cheat Sheet
:::

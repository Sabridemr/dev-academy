/**
 * SQL oyun alanının hazır örnek veritabanları. Her veri kümesi bellek içi bir SQLite'a (sql.js)
 * yüklenen DDL + INSERT betiği, şema özeti ve beklenen sonucu referans sorguyla tanımlanan görevlerden oluşur.
 * Veriler küçük ve gerçekçi tutuldu: her tablo 8-30 satır, JOIN ile eşleşmeyen satırlar bilinçli olarak var
 * (ör. hiç sipariş vermemiş müşteri) ki INNER/LEFT JOIN farkı görülebilsin.
 */

export const SQL_DATASETS = ['shop', 'school', 'library'] as const;
export type SqlDatasetId = (typeof SQL_DATASETS)[number];

type Bi = { tr: string; en: string };

export interface SqlTask {
  id: string;
  prompt: Bi;
  /** Doğru cevabı üreten referans sorgu; kullanıcının sonucu bununla satır kümesi olarak karşılaştırılır */
  reference: string;
  /** true ise satır sırası da karşılaştırılır (ORDER BY isteyen görevler) */
  ordered?: boolean;
  hint: Bi;
}

export interface SqlDataset {
  id: SqlDatasetId;
  label: Bi;
  /** Şema + örnek veri betiği */
  script: string;
  /** Editörde ilk görünen sorgu */
  starter: string;
  tasks: SqlTask[];
}

const rows = (table: string, cols: string, values: (string | number | null)[][]) =>
  `INSERT INTO ${table} (${cols}) VALUES\n` +
  values
    .map(
      (r) =>
        '  (' +
        r
          .map((v) =>
            v === null ? 'NULL' : typeof v === 'number' ? String(v) : `'${v.replace(/'/g, "''")}'`,
          )
          .join(', ') +
        ')',
    )
    .join(',\n') +
  ';';

const SHOP_SCRIPT = [
  `CREATE TABLE customers (id INTEGER PRIMARY KEY, name TEXT NOT NULL, city TEXT NOT NULL, joined_at TEXT NOT NULL);`,
  `CREATE TABLE products (id INTEGER PRIMARY KEY, name TEXT NOT NULL, category TEXT NOT NULL, price REAL NOT NULL);`,
  `CREATE TABLE orders (id INTEGER PRIMARY KEY, customer_id INTEGER NOT NULL REFERENCES customers(id), order_date TEXT NOT NULL, status TEXT NOT NULL);`,
  `CREATE TABLE order_items (id INTEGER PRIMARY KEY, order_id INTEGER NOT NULL REFERENCES orders(id), product_id INTEGER NOT NULL REFERENCES products(id), quantity INTEGER NOT NULL, unit_price REAL NOT NULL);`,
  rows('customers', 'id, name, city, joined_at', [
    [1, 'Ayşe Yılmaz', 'İstanbul', '2025-01-12'],
    [2, 'Mehmet Kaya', 'Ankara', '2025-02-03'],
    [3, 'Zeynep Demir', 'İzmir', '2025-02-20'],
    [4, 'Emre Şahin', 'İstanbul', '2025-03-08'],
    [5, 'Elif Çelik', 'Bursa', '2025-04-15'],
    [6, 'Burak Arslan', 'Ankara', '2025-05-01'],
    [7, 'Selin Koç', 'İstanbul', '2025-06-22'],
    [8, 'Can Aydın', 'Antalya', '2025-07-30'],
    [9, 'Deniz Öztürk', 'İzmir', '2025-09-11'],
    [10, 'Merve Yıldız', 'Eskişehir', '2025-10-05'],
  ]),
  rows('products', 'id, name, category, price', [
    [1, 'Kablosuz Kulaklık', 'elektronik', 1299.9],
    [2, 'Mekanik Klavye', 'elektronik', 2450],
    [3, 'USB-C Kablo', 'elektronik', 149.5],
    [4, 'Termos Bardak', 'ev', 389],
    [5, 'French Press', 'ev', 549],
    [6, 'Filtre Kahve 500g', 'gıda', 320],
    [7, 'Yeşil Çay 100g', 'gıda', 95],
    [8, 'Roman: Kürk Mantolu Madonna', 'kitap', 85],
    [9, 'Clean Code', 'kitap', 610],
    [10, 'Masa Lambası', 'ev', 899],
  ]),
  rows('orders', 'id, customer_id, order_date, status', [
    [101, 1, '2026-01-05', 'paid'],
    [102, 2, '2026-01-09', 'paid'],
    [103, 1, '2026-01-21', 'shipped'],
    [104, 3, '2026-02-02', 'paid'],
    [105, 4, '2026-02-14', 'cancelled'],
    [106, 5, '2026-02-18', 'paid'],
    [107, 1, '2026-03-01', 'paid'],
    [108, 6, '2026-03-07', 'shipped'],
    [109, 3, '2026-03-15', 'paid'],
    [110, 7, '2026-03-22', 'pending'],
    [111, 2, '2026-04-02', 'paid'],
    [112, 4, '2026-04-10', 'paid'],
    [113, 7, '2026-04-18', 'shipped'],
    [114, 5, '2026-05-03', 'paid'],
    [115, 6, '2026-05-12', 'cancelled'],
  ]),
  rows('order_items', 'id, order_id, product_id, quantity, unit_price', [
    [1, 101, 1, 1, 1299.9],
    [2, 101, 3, 2, 149.5],
    [3, 102, 6, 3, 320],
    [4, 102, 7, 2, 95],
    [5, 103, 9, 1, 610],
    [6, 104, 2, 1, 2450],
    [7, 104, 3, 1, 149.5],
    [8, 105, 10, 1, 899],
    [9, 106, 4, 2, 389],
    [10, 106, 5, 1, 549],
    [11, 106, 6, 1, 320],
    [12, 107, 8, 2, 85],
    [13, 107, 7, 4, 95],
    [14, 108, 1, 1, 1299.9],
    [15, 108, 10, 1, 899],
    [16, 109, 6, 2, 320],
    [17, 110, 2, 1, 2450],
    [18, 111, 9, 1, 610],
    [19, 111, 8, 1, 85],
    [20, 112, 5, 1, 549],
    [21, 112, 4, 1, 389],
    [22, 113, 3, 3, 149.5],
    [23, 114, 1, 1, 1299.9],
    [24, 114, 7, 1, 95],
    [25, 115, 2, 1, 2450],
  ]),
].join('\n');

const SCHOOL_SCRIPT = [
  `CREATE TABLE students (id INTEGER PRIMARY KEY, name TEXT NOT NULL, year INTEGER NOT NULL, city TEXT NOT NULL);`,
  `CREATE TABLE courses (id INTEGER PRIMARY KEY, code TEXT NOT NULL UNIQUE, title TEXT NOT NULL, department TEXT NOT NULL, credits INTEGER NOT NULL);`,
  `CREATE TABLE enrollments (student_id INTEGER NOT NULL REFERENCES students(id), course_id INTEGER NOT NULL REFERENCES courses(id), term TEXT NOT NULL, grade INTEGER, PRIMARY KEY (student_id, course_id, term));`,
  rows('students', 'id, name, year, city', [
    [1, 'Ali Vural', 1, 'Ankara'],
    [2, 'Büşra Tan', 2, 'İstanbul'],
    [3, 'Cem Uçar', 2, 'İzmir'],
    [4, 'Dilan Ekinci', 3, 'Ankara'],
    [5, 'Efe Korkmaz', 1, 'Trabzon'],
    [6, 'Fatma Güneş', 4, 'İstanbul'],
    [7, 'Gökhan Bal', 3, 'Konya'],
    [8, 'Hande Er', 2, 'İzmir'],
    [9, 'İlker Toprak', 4, 'Ankara'],
    [10, 'Jale Sarı', 1, 'Bursa'],
    [11, 'Kaan Polat', 3, 'İstanbul'],
    [12, 'Lale Aksoy', 2, 'Adana'],
  ]),
  rows('courses', 'id, code, title, department, credits', [
    [1, 'CENG101', 'Programlamaya Giriş', 'Bilgisayar', 6],
    [2, 'CENG213', 'Veri Yapıları', 'Bilgisayar', 6],
    [3, 'CENG351', 'Veritabanı Sistemleri', 'Bilgisayar', 5],
    [4, 'MATH119', 'Kalkülüs I', 'Matematik', 5],
    [5, 'MATH260', 'Lineer Cebir', 'Matematik', 4],
    [6, 'STAT201', 'Olasılık', 'İstatistik', 4],
    [7, 'ENG101', 'Akademik İngilizce', 'Diller', 3],
    [8, 'CENG477', 'Bilgisayar Grafiği', 'Bilgisayar', 5],
    // Henüz kimsenin kaydolmadığı ders: LEFT JOIN + COUNT görevinde 0 ile görünmeli
    [9, 'CENG499', 'Bitirme Projesi', 'Bilgisayar', 8],
  ]),
  rows('enrollments', 'student_id, course_id, term, grade', [
    [1, 1, '2025-güz', 78],
    [1, 4, '2025-güz', 64],
    [1, 7, '2025-güz', 88],
    [2, 1, '2024-güz', 91],
    [2, 2, '2025-bahar', 84],
    [2, 5, '2025-bahar', 72],
    [3, 2, '2025-bahar', 58],
    [3, 4, '2024-güz', 47],
    [3, 6, '2025-güz', 69],
    [4, 3, '2025-güz', 93],
    [4, 2, '2024-bahar', 81],
    [4, 5, '2024-bahar', 76],
    [5, 1, '2025-güz', 55],
    [5, 7, '2025-güz', 70],
    [6, 3, '2024-güz', 89],
    [6, 8, '2025-güz', 95],
    [7, 3, '2025-güz', 61],
    [7, 6, '2024-güz', 82],
    [8, 2, '2025-bahar', 74],
    [8, 4, '2024-güz', 68],
    [9, 8, '2025-güz', 87],
    [9, 3, '2024-güz', 90],
    [10, 1, '2025-güz', null],
    [11, 3, '2025-güz', 73],
    [11, 5, '2025-bahar', 66],
  ]),
].join('\n');

const LIBRARY_SCRIPT = [
  `CREATE TABLE authors (id INTEGER PRIMARY KEY, name TEXT NOT NULL, country TEXT NOT NULL);`,
  `CREATE TABLE books (id INTEGER PRIMARY KEY, title TEXT NOT NULL, author_id INTEGER NOT NULL REFERENCES authors(id), genre TEXT NOT NULL, published_year INTEGER NOT NULL, copies INTEGER NOT NULL);`,
  `CREATE TABLE members (id INTEGER PRIMARY KEY, name TEXT NOT NULL, joined_at TEXT NOT NULL);`,
  `CREATE TABLE loans (id INTEGER PRIMARY KEY, book_id INTEGER NOT NULL REFERENCES books(id), member_id INTEGER NOT NULL REFERENCES members(id), loaned_at TEXT NOT NULL, returned_at TEXT);`,
  rows('authors', 'id, name, country', [
    [1, 'Sabahattin Ali', 'Türkiye'],
    [2, 'Orhan Pamuk', 'Türkiye'],
    [3, 'Elif Şafak', 'Türkiye'],
    [4, 'George Orwell', 'Birleşik Krallık'],
    [5, 'Ursula K. Le Guin', 'ABD'],
    [6, 'Gabriel García Márquez', 'Kolombiya'],
    [7, 'Yaşar Kemal', 'Türkiye'],
    [8, 'Haruki Murakami', 'Japonya'],
  ]),
  rows('books', 'id, title, author_id, genre, published_year, copies', [
    [1, 'Kürk Mantolu Madonna', 1, 'roman', 1943, 4],
    [2, 'İçimizdeki Şeytan', 1, 'roman', 1940, 2],
    [3, 'Benim Adım Kırmızı', 2, 'roman', 1998, 3],
    [4, 'Masumiyet Müzesi', 2, 'roman', 2008, 2],
    [5, 'Aşk', 3, 'roman', 2009, 3],
    [6, '1984', 4, 'distopya', 1949, 5],
    [7, 'Hayvan Çiftliği', 4, 'distopya', 1945, 3],
    [8, 'Mülksüzler', 5, 'bilimkurgu', 1974, 2],
    [9, 'Yerdeniz Büyücüsü', 5, 'fantastik', 1968, 2],
    [10, 'Yüzyıllık Yalnızlık', 6, 'roman', 1967, 3],
    [11, 'İnce Memed', 7, 'roman', 1955, 2],
    [12, 'Sahilde Kafka', 8, 'roman', 2002, 2],
    [13, 'Karanlığın Sol Eli', 5, 'bilimkurgu', 1969, 1],
    [14, 'Kar', 2, 'roman', 2002, 1],
  ]),
  rows('members', 'id, name, joined_at', [
    [1, 'Nazlı Ateş', '2024-09-01'],
    [2, 'Oğuz Kurt', '2024-11-15'],
    [3, 'Pelin Duman', '2025-01-20'],
    [4, 'Rıza Bozkurt', '2025-03-03'],
    [5, 'Sevgi Altun', '2025-06-10'],
    [6, 'Tolga Işık', '2025-08-25'],
    [7, 'Ufuk Kara', '2026-01-07'],
  ]),
  rows('loans', 'id, book_id, member_id, loaned_at, returned_at', [
    [1, 1, 1, '2026-01-03', '2026-01-17'],
    [2, 6, 2, '2026-01-05', '2026-01-25'],
    [3, 3, 1, '2026-01-20', '2026-02-10'],
    [4, 6, 3, '2026-02-01', '2026-02-14'],
    [5, 8, 4, '2026-02-03', null],
    [6, 1, 5, '2026-02-11', '2026-03-01'],
    [7, 10, 2, '2026-02-15', '2026-03-05'],
    [8, 12, 6, '2026-02-20', null],
    [9, 7, 1, '2026-03-02', '2026-03-12'],
    [10, 5, 3, '2026-03-04', '2026-03-28'],
    [11, 6, 5, '2026-03-10', null],
    [12, 11, 2, '2026-03-18', '2026-04-08'],
    [13, 1, 3, '2026-04-01', null],
    [14, 9, 4, '2026-04-05', '2026-04-20'],
    [15, 3, 6, '2026-04-09', '2026-04-30'],
    [16, 13, 1, '2026-04-15', null],
    [17, 4, 5, '2026-04-22', '2026-05-10'],
    [18, 6, 4, '2026-05-02', null],
  ]),
].join('\n');

export const DATASETS: Record<SqlDatasetId, SqlDataset> = {
  shop: {
    id: 'shop',
    label: { tr: 'E-ticaret (shop)', en: 'E-commerce (shop)' },
    script: SHOP_SCRIPT,
    starter: `SELECT c.name, SUM(oi.quantity * oi.unit_price) AS total
FROM customers c
JOIN orders o ON o.customer_id = c.id
JOIN order_items oi ON oi.order_id = o.id
WHERE o.status <> 'cancelled'
GROUP BY c.id, c.name
ORDER BY total DESC
LIMIT 5;`,
    tasks: [
      {
        id: 'istanbul',
        prompt: {
          tr: "İstanbul'daki müşterilerin adlarını listele.",
          en: 'List the names of customers in İstanbul.',
        },
        reference: "SELECT name FROM customers WHERE city = 'İstanbul'",
        hint: { tr: 'Tek tablo ve WHERE yeterli.', en: 'One table and a WHERE are enough.' },
      },
      {
        id: 'spend',
        prompt: {
          tr: 'Her müşterinin toplam harcamasını bul (iptal edilen siparişler hariç; müşteri adı + toplam).',
          en: 'Find each customer’s total spend (excluding cancelled orders; customer name + total).',
        },
        reference: `SELECT c.name, SUM(oi.quantity * oi.unit_price) FROM customers c
JOIN orders o ON o.customer_id = c.id JOIN order_items oi ON oi.order_id = o.id
WHERE o.status <> 'cancelled' GROUP BY c.id, c.name`,
        hint: {
          tr: 'customers → orders → order_items zincirini JOIN et, WHERE ile iptalleri ele, GROUP BY ile müşteri başına SUM al.',
          en: 'JOIN customers → orders → order_items, drop cancellations with WHERE, then SUM per customer with GROUP BY.',
        },
      },
      {
        id: 'no-orders',
        prompt: {
          tr: 'Hiç sipariş vermemiş müşterileri bul (yalnızca ad).',
          en: 'Find customers who never placed an order (name only).',
        },
        reference:
          'SELECT c.name FROM customers c LEFT JOIN orders o ON o.customer_id = c.id WHERE o.id IS NULL',
        hint: {
          tr: 'LEFT JOIN eşleşmeyen satırları NULL ile korur; WHERE o.id IS NULL ile onları seç.',
          en: 'LEFT JOIN keeps unmatched rows padded with NULL; select them with WHERE o.id IS NULL.',
        },
      },
      {
        id: 'category-revenue',
        prompt: {
          tr: 'Kategori başına satılan toplam adet ve ciroyu hesapla (iptaller hariç; kategori, adet, ciro).',
          en: 'Compute total units sold and revenue per category (excluding cancellations; category, units, revenue).',
        },
        reference: `SELECT p.category, SUM(oi.quantity), SUM(oi.quantity * oi.unit_price) FROM order_items oi
JOIN products p ON p.id = oi.product_id JOIN orders o ON o.id = oi.order_id
WHERE o.status <> 'cancelled' GROUP BY p.category`,
        hint: {
          tr: 'order_items’ı products ve orders ile birleştir, p.category’ye göre grupla.',
          en: 'Join order_items with products and orders, then group by p.category.',
        },
      },
      {
        id: 'top3',
        prompt: {
          tr: 'En çok adet satılan 3 ürünü, adede göre azalan sırada getir (ürün adı, toplam adet).',
          en: 'Return the 3 best-selling products by units, descending (product name, total units).',
        },
        reference: `SELECT p.name, SUM(oi.quantity) AS units FROM order_items oi
JOIN products p ON p.id = oi.product_id GROUP BY p.id, p.name ORDER BY units DESC, p.name LIMIT 3`,
        ordered: true,
        hint: {
          tr: 'GROUP BY + ORDER BY ... DESC + LIMIT 3. Eşit adette ada göre sırala.',
          en: 'GROUP BY + ORDER BY ... DESC + LIMIT 3. Break ties by name.',
        },
      },
      {
        id: 'repeat',
        prompt: {
          tr: 'En az 2 siparişi olan müşterileri ve sipariş sayılarını listele.',
          en: 'List customers with at least 2 orders and their order counts.',
        },
        reference: `SELECT c.name, COUNT(*) FROM customers c JOIN orders o ON o.customer_id = c.id
GROUP BY c.id, c.name HAVING COUNT(*) >= 2`,
        hint: {
          tr: 'Grupları süzmek için WHERE değil HAVING kullanılır.',
          en: 'Filter groups with HAVING, not WHERE.',
        },
      },
    ],
  },
  school: {
    id: 'school',
    label: { tr: 'Okul (school)', en: 'School (school)' },
    script: SCHOOL_SCRIPT,
    starter: `SELECT s.name, c.title, e.grade
FROM enrollments e
JOIN students s ON s.id = e.student_id
JOIN courses c ON c.id = e.course_id
WHERE c.department = 'Bilgisayar'
ORDER BY e.grade DESC;`,
    tasks: [
      {
        id: 'first-years',
        prompt: {
          tr: '1. sınıf öğrencilerinin adlarını listele.',
          en: 'List first-year students.',
        },
        reference: 'SELECT name FROM students WHERE year = 1',
        hint: { tr: 'students tablosunda year sütunu.', en: 'Use the year column in students.' },
      },
      {
        id: 'course-counts',
        prompt: {
          tr: 'Her dersin kaç kayıtlı öğrencisi olduğunu bul (ders başlığı, öğrenci sayısı); kaydı olmayan dersler 0 ile görünsün.',
          en: 'Count enrolled students per course (title, count); courses without enrollments should show 0.',
        },
        reference: `SELECT c.title, COUNT(e.student_id) FROM courses c
LEFT JOIN enrollments e ON e.course_id = c.id GROUP BY c.id, c.title`,
        hint: {
          tr: 'LEFT JOIN + COUNT(e.student_id): COUNT(*) NULL satırı da sayar.',
          en: 'LEFT JOIN + COUNT(e.student_id): COUNT(*) would also count the NULL row.',
        },
      },
      {
        id: 'avg-grade',
        prompt: {
          tr: 'Her öğrencinin not ortalamasını hesapla (ad, ortalama); notu olmayan kayıtları sayma.',
          en: 'Compute each student’s average grade (name, average); ignore enrollments without a grade.',
        },
        reference: `SELECT s.name, AVG(e.grade) FROM students s JOIN enrollments e ON e.student_id = s.id
WHERE e.grade IS NOT NULL GROUP BY s.id, s.name`,
        hint: {
          tr: 'AVG zaten NULL’ları atlar ama WHERE e.grade IS NOT NULL niyetini açık eder.',
          en: 'AVG already skips NULLs, but WHERE e.grade IS NOT NULL makes the intent explicit.',
        },
      },
      {
        id: 'dept-credits',
        prompt: {
          tr: 'Bölüm başına toplam kredi ve ders sayısını getir (bölüm, ders sayısı, toplam kredi).',
          en: 'Return course count and total credits per department (department, courses, credits).',
        },
        reference: 'SELECT department, COUNT(*), SUM(credits) FROM courses GROUP BY department',
        hint: { tr: 'Tek tablo, GROUP BY department.', en: 'One table, GROUP BY department.' },
      },
      {
        id: 'db-honors',
        prompt: {
          tr: 'CENG351 dersinden 85 ve üzeri alanları nota göre azalan sırada listele (ad, not).',
          en: 'List students scoring 85+ in CENG351, by grade descending (name, grade).',
        },
        reference: `SELECT s.name, e.grade FROM enrollments e JOIN students s ON s.id = e.student_id
JOIN courses c ON c.id = e.course_id WHERE c.code = 'CENG351' AND e.grade >= 85 ORDER BY e.grade DESC`,
        ordered: true,
        hint: {
          tr: 'Üç tabloyu birleştir, iki koşulu AND ile bağla, ORDER BY e.grade DESC.',
          en: 'Join three tables, combine both conditions with AND, ORDER BY e.grade DESC.',
        },
      },
    ],
  },
  library: {
    id: 'library',
    label: { tr: 'Kütüphane (library)', en: 'Library (library)' },
    script: LIBRARY_SCRIPT,
    starter: `SELECT b.title, COUNT(*) AS loan_count
FROM loans l
JOIN books b ON b.id = l.book_id
GROUP BY b.id, b.title
ORDER BY loan_count DESC
LIMIT 3;`,
    tasks: [
      {
        id: 'turkish-authors',
        prompt: {
          tr: "Türkiye'den yazarların kitap başlıklarını listele.",
          en: 'List book titles by authors from Türkiye.',
        },
        reference: `SELECT b.title FROM books b JOIN authors a ON a.id = b.author_id WHERE a.country = 'Türkiye'`,
        hint: {
          tr: 'books ile authors’ı author_id üzerinden birleştir.',
          en: 'Join books and authors on author_id.',
        },
      },
      {
        id: 'open-loans',
        prompt: {
          tr: 'Henüz iade edilmemiş ödünçleri getir (üye adı, kitap başlığı).',
          en: 'Return loans not yet returned (member name, book title).',
        },
        reference: `SELECT m.name, b.title FROM loans l JOIN members m ON m.id = l.member_id
JOIN books b ON b.id = l.book_id WHERE l.returned_at IS NULL`,
        hint: { tr: 'NULL için = değil IS NULL kullanılır.', en: 'Use IS NULL, not = NULL.' },
      },
      {
        id: 'never-loaned',
        prompt: {
          tr: 'Hiç ödünç verilmemiş kitapları bul (başlık).',
          en: 'Find books never loaned (title).',
        },
        reference:
          'SELECT b.title FROM books b LEFT JOIN loans l ON l.book_id = b.id WHERE l.id IS NULL',
        hint: { tr: 'LEFT JOIN + IS NULL kalıbı.', en: 'The LEFT JOIN + IS NULL pattern.' },
      },
      {
        id: 'genre-counts',
        prompt: {
          tr: 'Tür başına ödünç sayısını bul ve en az 3 ödünç alan türleri göster (tür, sayı).',
          en: 'Count loans per genre and show genres with at least 3 loans (genre, count).',
        },
        reference: `SELECT b.genre, COUNT(*) FROM loans l JOIN books b ON b.id = l.book_id
GROUP BY b.genre HAVING COUNT(*) >= 3`,
        hint: { tr: 'GROUP BY b.genre + HAVING.', en: 'GROUP BY b.genre + HAVING.' },
      },
      {
        id: 'active-members',
        prompt: {
          tr: 'Üyeleri ödünç sayısına göre azalan, eşitlikte ada göre artan sırala (ad, sayı); hiç ödünç almayan da 0 ile görünsün.',
          en: 'Rank members by loan count descending, ties by name (name, count); members with no loans show 0.',
        },
        reference: `SELECT m.name, COUNT(l.id) AS n FROM members m LEFT JOIN loans l ON l.member_id = m.id
GROUP BY m.id, m.name ORDER BY n DESC, m.name`,
        ordered: true,
        hint: {
          tr: 'LEFT JOIN + COUNT(l.id) + ORDER BY n DESC, m.name.',
          en: 'LEFT JOIN + COUNT(l.id) + ORDER BY n DESC, m.name.',
        },
      },
    ],
  },
};

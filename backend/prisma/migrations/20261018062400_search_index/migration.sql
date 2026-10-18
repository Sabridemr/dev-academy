-- Arama performansı: ders düz metni üzerinde full-text GIN indeksi ('simple' sözlük)
CREATE INDEX IF NOT EXISTS "Lesson_searchText_fts_idx" ON "Lesson" USING GIN (to_tsvector('simple', "searchText"));
